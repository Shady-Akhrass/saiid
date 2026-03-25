<?php

namespace App\Http\Controllers;

use App\Models\Orphan;
use App\Models\OrphanGrouping;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * OrphanGrouping Controller
 * 
 * Manages orphan groupings with advanced features including:
 * - Group creation and management
 * - Smart selection based on criteria
 * - Fuzzy search functionality
 * - Location-based filtering
 * - Capacity management
 * - Member assignment/removal
 */
class OrphanGroupingController extends Controller
{
    use \App\Traits\ApiResponse;

    /**
     * Display a listing of orphan groupings
     */
    public function index(Request $request): JsonResponse
    {
        // Check if user is admin or coordinator
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }

        try {
            $query = OrphanGrouping::query();

            // Apply filters
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            if ($request->has('governorate_filter')) {
                $query->where('governorate_filter', $request->governorate_filter);
            }

            if ($request->has('district_filter')) {
                $query->where('district_filter', $request->district_filter);
            }

            // Search functionality
            if ($request->has('search')) {
                $search = $request->search;
                $query->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('description', 'LIKE', "%{$search}%");
            }

            $groupings = $query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 10);

            // Load relationships safely
            $groupings->getCollection()->each(function ($grouping) {
                try {
                    $grouping->creator = $grouping->creator;
                    $grouping->orphans_count = $grouping->orphans()->count();
                } catch (\Exception $e) {
                    $grouping->creator = null;
                    $grouping->orphans_count = 0;
                }
            });
            return $this->successResponse([
                'groupings' => $groupings->items(),
                'pagination' => [
                    'current_page' => $groupings->currentPage(),
                    'last_page' => $groupings->lastPage(),
                    'per_page' => $groupings->perPage(),
                    'total' => $groupings->total(),
                ]
            ], 'تم استرجاع تجميعات الأيتام بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل الاسترجاع', 'فشل في استرجاع تجميعات الأيتام', 500, $e);
        }
    }

    /**
     * Store a newly created orphan grouping
     */
    public function store(Request $request): JsonResponse
    {
        // Check if user is admin or coordinator
        $user = auth()->user();
        $allowedRoles = ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'];

        if (!$user || !in_array(strtolower($user->role), $allowedRoles)) {
            return $this->unauthorizedResponse();
        }

        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'description' => 'nullable|string|max:1000',
                'max_capacity' => 'required|integer|min:1|max:1000',
                'selection_criteria.mother_status' => 'nullable|array',
                'selection_criteria.father_status' => 'nullable|array',
                'selection_criteria.health_conditions' => 'nullable|array',
                'selection_criteria.governorate_filter' => 'nullable|string|max:255',
                'selection_criteria.district_filter' => 'nullable|string|max:255',
                'selection_criteria.age_range.min' => 'nullable|integer|min:0|max:18',
                'selection_criteria.age_range.max' => 'nullable|integer|min:0|max:18',
                'selection_criteria.gender' => 'nullable|string|in:both,male,female',
                'selection_criteria.enrollment_status' => 'nullable|array',
                'selection_criteria.exclude_adopted' => 'boolean',
            ]);

            // Build selection criteria from validated data
            $selectionCriteria = [
                'mother_status' => $validated['selection_criteria.mother_status'] ?? [],
                'father_status' => $validated['selection_criteria.father_status'] ?? [],
                'health_conditions' => $validated['selection_criteria.health_conditions'] ?? [],
                'governorate_filter' => $validated['selection_criteria.governorate_filter'] ?? null,
                'district_filter' => $validated['selection_criteria.district_filter'] ?? null,
                'age_range' => [
                    'min' => $validated['selection_criteria.age_range.min'] ?? 5,
                    'max' => $validated['selection_criteria.age_range.max'] ?? 18
                ],
                'gender' => $validated['selection_criteria.gender'] ?? 'both',
                'enrollment_status' => $validated['selection_criteria.enrollment_status'] ?? [],
                'exclude_adopted' => $validated['selection_criteria.exclude_adopted'] ?? true
            ];

            $grouping = OrphanGrouping::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'max_capacity' => $validated['max_capacity'],
                'current_count' => 0,
                'selection_criteria' => json_encode($selectionCriteria),
                'status' => OrphanGrouping::STATUS_ACTIVE,
                'created_by' => auth()->id(),
            ]);

            return $this->successResponse([
                'grouping' => $grouping->load('creator')
            ], 'تم إنشاء التجميعة بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل في الإنشاء', 'فشل في إنشاء تجميعة الأيتام', 500, $e);
        }
    }

    /**
     * Display the specified orphan grouping
     */
    public function show(Request $request, $id): JsonResponse
    {
        // Check if user is admin
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }

        try {
            $grouping = OrphanGrouping::findOrFail($id);

            // Load relationships safely
            try {
                $grouping->creator = $grouping->creator;
                // Limit to first 100 orphans to prevent memory exhaustion
                $grouping->orphans = $grouping->orphans()
                    ->wherePivot('status', OrphanGrouping::MEMBER_STATUS_ACTIVE)
                    ->limit(100)
                    ->get();
            } catch (\Exception $e) {
                $grouping->creator = null;
                $grouping->orphans = collect([]);
            }

            $statistics = $grouping->getStatistics();
            $eligibleOrphans = $grouping->getEligibleOrphans();

            return $this->successResponse([
                'grouping' => $grouping,
                'statistics' => $statistics,
                'eligible_orphans_count' => $eligibleOrphans->count(),
                'available_capacity' => $grouping->getAvailableCapacity(),
                'is_full' => $grouping->isFull(),
            ], 'تم استرجاع تفاصيل تجميعة الأيتام بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل في جلب البيانات', 'فشل في استرجاع تجميعة الأيتام', 500, $e);
        }
    }

    /**
     * Update the specified orphan grouping
     */
    public function update(Request $request, $id): JsonResponse
    {
        // Check if user is admin
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }
        try {
            $grouping = OrphanGrouping::findOrFail($id);

            $validated = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'description' => 'nullable|string|max:1000',
                'max_capacity' => 'sometimes|required|integer|min:1|max:1000',
                'selection_criteria.mother_status' => 'nullable|array',
                'selection_criteria.father_status' => 'nullable|array',
                'selection_criteria.health_conditions' => 'nullable|array',
                'selection_criteria.governorate_filter' => 'nullable|string|max:255',
                'selection_criteria.district_filter' => 'nullable|string|max:255',
                'selection_criteria.age_range.min' => 'nullable|integer|min:0|max:18',
                'selection_criteria.age_range.max' => 'nullable|integer|min:0|max:18',
                'selection_criteria.gender' => 'nullable|string|in:both,male,female',
                'selection_criteria.enrollment_status' => 'nullable|array',
                'selection_criteria.exclude_adopted' => 'boolean',
                'status' => 'sometimes|required|in:active,inactive,full,archived',
            ]);

            // Build selection criteria from validated data
            $selectionCriteria = [
                'mother_status' => $validated['selection_criteria.mother_status'] ?? [],
                'father_status' => $validated['selection_criteria.father_status'] ?? [],
                'health_conditions' => $validated['selection_criteria.health_conditions'] ?? [],
                'governorate_filter' => $validated['selection_criteria.governorate_filter'] ?? null,
                'district_filter' => $validated['selection_criteria.district_filter'] ?? null,
                'age_range' => [
                    'min' => $validated['selection_criteria.age_range.min'] ?? 5,
                    'max' => $validated['selection_criteria.age_range.max'] ?? 18
                ],
                'gender' => $validated['selection_criteria.gender'] ?? 'both',
                'enrollment_status' => $validated['selection_criteria.enrollment_status'] ?? [],
                'exclude_adopted' => $validated['selection_criteria.exclude_adopted'] ?? true
            ];

            $updateData = array_merge($validated, [
                'selection_criteria' => json_encode($selectionCriteria),
                'updated_by' => auth()->id(),
            ]);

            // Check if new capacity is less than current count
            if (isset($validated['max_capacity']) && $validated['max_capacity'] < $grouping->current_count) {
                return $this->errorResponse('سعة غير كافية', 'Cannot set capacity lower than current member count', 422);
            }

            $grouping->update($updateData);

            // Update status based on capacity
            if ($grouping->isFull()) {
                $grouping->update(['status' => OrphanGrouping::STATUS_FULL]);
            }

            return $this->successResponse([
                'grouping' => $grouping->fresh()->load('creator')
            ], 'تم تحديث التجميعة بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل التحديث', 'فشل في تحديث تجميعة الأيتام', 500, $e);
        }
    }

    /**
     * Remove the specified orphan grouping
     */
    public function destroy($id): JsonResponse
    {
        // Check if user is admin or coordinator
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }

        try {
            $grouping = OrphanGrouping::findOrFail($id);
            
            // Detach all active orphans before deleting
            if ($grouping->current_count > 0) {
                Log::info("Detaching {$grouping->current_count} orphans from grouping ID: {$id} before deletion.");
                $orphanIds = $grouping->activeOrphans()->pluck('orphans.orphan_id_number')->toArray();
                foreach ($orphanIds as $orphanId) {
                    $grouping->removeOrphan($orphanId, OrphanGrouping::MEMBER_STATUS_INACTIVE, 'Group deleted');
                }
            }

            $grouping->delete();

            return $this->successResponse([], 'تم حذف التجميعة بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل الحذف', 'فشل في حذف تجميعة الأيتام', 500, $e);
        }
    }

    /**
     * Get eligible orphans for a grouping
     */
    public function eligibleOrphans(Request $request, $id): JsonResponse
    {
        // Check if user is admin or coordinator
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }

        try {
            $grouping = OrphanGrouping::findOrFail($id);

            $query = Orphan::query();
            // Merge grouping selection criteria if not explicitly provided in request
            $filters = $this->mergeGroupingCriteria($request->all(), $grouping);
            $query = $this->applyOrphanFilters($query, $filters, $grouping);

            // Get total count before limiting
            $totalCount = $query->count();

            // Impose a reasonable limit to prevent memory exhaustion while allowing "all" practical results
            $eligibleOrphans = $query->limit(1000)->get();

            return $this->successResponse([
                'eligible_orphans' => $eligibleOrphans,
                'count' => $totalCount,
                'filters_received' => $filters,
                'grouping_id' => $id,
                'grouping_name' => $grouping->name
            ], 'تم جلب الأيتام المؤهلين بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل الاسترجاع', 'حدث خطأ أثناء جلب الأيتام المؤهلين', 500, $e);
        }
    }

    /**
     * Add orphans to a grouping
     */
    public function addOrphans(Request $request, $id): JsonResponse
    {
        // Check if user is admin or coordinator
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }

        try {
            $validated = $request->validate([
                'orphan_ids' => 'required|array',
                'orphan_ids.*' => 'exists:orphans,orphan_id_number',
                'notes' => 'nullable|string|max:500',
            ]);

            $grouping = OrphanGrouping::findOrFail($id);
            $addedOrphans = [];
            $failedOrphans = [];

            foreach ($validated['orphan_ids'] as $orphanId) {
                try {
                    if ($grouping->addOrphan($orphanId, $validated['notes'] ?? null)) {
                        $addedOrphans[] = $orphanId;
                    } else {
                        $failedOrphans[] = $orphanId;
                    }
                } catch (\Exception $e) {
                    $failedOrphans[] = $orphanId . ' (Error: ' . $e->getMessage() . ')';
                }
            }

            return $this->successResponse([
                'added_orphans' => $addedOrphans,
                'failed_orphans' => $failedOrphans,
                'grouping' => $grouping->fresh(),
            ], 'تمت إضافة الأيتام بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل الإضافة', 'حدث خطأ أثناء إضافة الأيتام', 500, $e);
        }
    }

    /**
     * Get orphans for a specific grouping
     */
    public function getGroupOrphans(Request $request, $id): JsonResponse
    {
        // Check if user is admin or coordinator
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }

        try {
            $grouping = OrphanGrouping::findOrFail($id);

            // Get active orphans for this grouping and apply any user filters (e.g., search, gender)
            $query = $grouping->activeOrphans()
                ->with(['sponsoredProjects' => function($q) {
                    $q->select('project_proposals.id', 'project_proposals.project_name')
                      ->withPivot('sponsorship_amount', 'is_recurring', 'sponsorship_start_date', 'sponsorship_end_date');
                }]);
            
            $query = $this->applyOrphanFilters($query, $request->all(), $grouping);
            $orphans = $query->get();

            return $this->successResponse([
                'orphans' => $orphans,
                'count' => $orphans->count(),
                'grouping_id' => $id
            ], 'تم جلب أيتام التجميعة بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل الاسترجاع', 'حدث خطأ أثناء جلب أيتام التجميعة', 500, $e);
        }
    }

    /**
     * Remove orphans from a grouping
     */
    public function removeOrphans(Request $request, $id): JsonResponse
    {
        // Check if user is admin or coordinator
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }

        try {
            $validated = $request->validate([
                'orphan_ids' => 'required|array',
                'orphan_ids.*' => 'exists:orphans,orphan_id_number',
                'status' => 'sometimes|required|in:inactive,transferred,graduated',
                'notes' => 'nullable|string|max:500',
            ]);

            $grouping = OrphanGrouping::findOrFail($id);
            $removedOrphans = [];
            $failedOrphans = [];

            foreach ($validated['orphan_ids'] as $orphanId) {
                if ($grouping->removeOrphan($orphanId, $validated['status'] ?? OrphanGrouping::MEMBER_STATUS_INACTIVE, $validated['notes'] ?? null)) {
                    $removedOrphans[] = $orphanId;
                } else {
                    $failedOrphans[] = $orphanId;
                }
            }

            return $this->successResponse([
                'removed_orphans' => $removedOrphans,
                'failed_orphans' => $failedOrphans,
                'grouping' => $grouping->fresh(),
            ], 'تمت إزالة الأيتام بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل الإزالة', 'فشل في إزالة الأيتام من التجميعة', 500, $e);
        }
    }

    /**
     * Smart selection - automatically select orphans
     */
    public function smartSelect(Request $request, $id): JsonResponse
    {
        // Check if user is admin or coordinator
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }

        try {
            $grouping = OrphanGrouping::findOrFail($id);

            $query = Orphan::query();
            
            // Merge grouping selection criteria
            $filters = $this->mergeGroupingCriteria($request->all(), $grouping);
            $query = $this->applyOrphanFilters($query, $filters, $grouping);

            // Exclude orphans already in this group
            $existingOrphanIds = $grouping->activeOrphans()->pluck('orphans.orphan_id_number')->toArray();
            if (!empty($existingOrphanIds)) {
                $query->whereNotIn('orphans.orphan_id_number', $existingOrphanIds);
            }

            // Correctly calculate count needed to complete the target if not provided
            $availableCapacity = $grouping->max_capacity - $grouping->current_count;
            $selectionCount = $request->get('count', $availableCapacity > 0 ? $availableCapacity : 50);

            // Perform randomization and limiting at the database level
            $selectedOrphans = $query->inRandomOrder()->limit($selectionCount)->get();

            return $this->successResponse([
                'selected_orphans' => $selectedOrphans,
                'count' => $selectedOrphans->count(),
                'filters_received' => $filters,
                'grouping_id' => $id,
                'target_remaining' => $availableCapacity
            ], 'تم التحديد الذكي لمحاكاة استكمال الفتحة المتبقية في المجموعة');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل التحديد الذكي', 'حدث خطأ أثناء التحديد الذكي', 500, $e);
        }
    }

    /**
     * Fuzzy search for orphans
     */
    public function fuzzySearch(Request $request): JsonResponse
    {
        // Check if user is admin or coordinator
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }

        try {
            $validated = $request->validate([
                'query' => 'required|string|min:2|max:100',
            ]);

            $orphans = OrphanGrouping::fuzzySearch($validated['query']);

            return $this->successResponse([
                'orphans' => $orphans,
                'count' => $orphans->count(),
            ], 'Fuzzy search completed successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل البحث', 'فشل في تنفيذ البحث التقريبي', 500, $e);
        }
    }

    /**
     * Get statistics summary
     */
    public function statistics(): JsonResponse
    {
        // Check if user is admin or coordinator
        $user = auth()->user();
        if (!$user || !in_array(strtolower($user->role), ['admin', 'orphan_sponsor_coordinator', 'executed_projects_coordinator'])) {
            return $this->unauthorizedResponse();
        }

        try {
            $totalGroups = OrphanGrouping::count();
            $activeGroups = OrphanGrouping::where('status', OrphanGrouping::STATUS_ACTIVE)->count();
            $fullGroups = OrphanGrouping::where('status', OrphanGrouping::STATUS_FULL)->count();
            $totalCapacity = OrphanGrouping::sum('max_capacity');
            $totalAssigned = OrphanGrouping::sum('current_count');
            $availableCapacity = $totalCapacity - $totalAssigned;

            return $this->successResponse([
                'total_groups' => $totalGroups,
                'active_groups' => $activeGroups,
                'full_groups' => $fullGroups,
                'total_capacity' => $totalCapacity,
                'total_assigned' => $totalAssigned,
                'available_capacity' => $availableCapacity,
                'utilization_rate' => $totalCapacity > 0 ? round(($totalAssigned / $totalCapacity) * 100, 2) : 0,
            ], 'Statistics retrieved successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل الإحصائيات', 'فشل في استرجاع الإحصائيات', 500, $e);
        }
    }

    /**
     * Get available governorates and districts
     */
    public function locations(): JsonResponse
    {
        try {
            // Using the current_address enum values from the orphans table
            $governorates = Orphan::distinct()->pluck('current_address')->filter()->sort();

            // Note: districts are not available in current table structure
            // This would need to be added as a separate field or parsed from address_details
            $districts = collect(['المنطقة الشمالية', 'المنطقة الغربية', 'المنطقة الشرقية', 'المنطقة الجنوبية'])->sort();

            return $this->successResponse([
                'governorates' => $governorates,
                'districts' => $districts,
            ], 'Locations retrieved successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل جلب المواقع', 'Failed to retrieve locations', 500, $e);
        }
    }

    /**
     * Merge grouping selection criteria into filter array
     */
    private function mergeGroupingCriteria(array $filters, OrphanGrouping $grouping): array
    {
        // selection_criteria is already cast to array in the Model
        $criteria = $grouping->selection_criteria;
        if (!$criteria || !is_array($criteria)) return $filters;

        // Map criteria fields to filter names
        $mapping = [
            'governorate_filter' => 'governorate_filter',
            'district_filter' => 'district_filter',
            'gender' => 'gender',
            'mother_status' => 'mother_status',
            'health_conditions' => 'health_conditions',
            'enrollment_status' => 'enrollment_status',
            'exclude_adopted' => 'exclude_adopted',
            'age_range' => 'age_range'
        ];

        foreach ($mapping as $criteriaKey => $filterKey) {
            // Only use criteria if not explicitly sent in request (allow user override)
            if (empty($filters[$filterKey]) && !empty($criteria[$criteriaKey])) {
                $filters[$filterKey] = $criteria[$criteriaKey];
            }
        }

        return $filters;
    }

    /**
     * ✅ Apply common orphan filters shared between eligibleOrphans and smartSelect
     */
    private function applyOrphanFilters($query, array $filters, OrphanGrouping $grouping)
    {
        // Convert URL-encoded array parameters to proper format
        if (isset($filters['age_range[min]']) || isset($filters['age_range[max]'])) {
            $filters['age_range'] = [
                'min' => (int)($filters['age_range[min]'] ?? 0),
                'max' => (int)($filters['age_range[max]'] ?? 100)
            ];
        }

        // Convert comma-separated string arrays to actual arrays
        foreach (['mother_status', 'health_conditions', 'enrollment_status'] as $key) {
            if (isset($filters[$key]) && is_string($filters[$key])) {
                $filters[$key] = explode(',', $filters[$key]);
            }
        }

        // Apply location filters
        if (!empty($filters['governorate_filter'])) {
            $query->where('orphans.current_address', 'like', '%' . $filters['governorate_filter'] . '%');
        }

        if (!empty($filters['district_filter'])) {
            $query->where('orphans.address_details', 'like', '%' . $filters['district_filter'] . '%');
        }

        // Fuzzy search for address details
        if (!empty($filters['address_search'])) {
            $searchTerm = $filters['address_search'];
            $query->where(function ($q) use ($searchTerm) {
                $q->where('orphans.address_details', 'like', '%' . $searchTerm . '%')
                    ->orWhere('orphans.current_address', 'like', '%' . $searchTerm . '%')
                    ->orWhere('orphans.original_address', 'like', '%' . $searchTerm . '%');
            });
        }

        // Parent status filter
        if (isset($filters['mother_status']) && is_array($filters['mother_status']) && !empty($filters['mother_status'])) {
            $query->where(function ($q) use ($filters) {
                foreach ($filters['mother_status'] as $status) {
                    if ($status === 'deceased') $q->orWhere('orphans.is_mother_deceased', 'نعم');
                    elseif ($status === 'alive') $q->orWhere('orphans.is_mother_deceased', 'لا');
                }
            });
        }

        // Health conditions filter
        if (isset($filters['health_conditions']) && is_array($filters['health_conditions']) && !empty($filters['health_conditions'])) {
            $query->where(function ($q) use ($filters) {
                foreach ($filters['health_conditions'] as $condition) {
                    if ($condition === 'healthy') $q->orWhere('orphans.health_status', 'جيدة');
                    elseif ($condition === 'sick') $q->orWhere('orphans.health_status', 'مريض');
                }
            });
        }

        // Memorization filter
        if (isset($filters['enrollment_status']) && is_array($filters['enrollment_status'])) {
            if (in_array('enrolled', $filters['enrollment_status'])) {
                $query->where('orphans.is_enrolled_in_memorization_center', 'نعم');
            }
        }

        // Age range filter with safety null check
        if (isset($filters['age_range'])) {
            $minAge = $filters['age_range']['min'] ?? 0;
            $maxAge = $filters['age_range']['max'] ?? 100;
            $query->whereNotNull('orphans.orphan_birth_date')
                ->whereRaw('TIMESTAMPDIFF(YEAR, orphans.orphan_birth_date, CURDATE()) BETWEEN ' . $minAge . ' AND ' . $maxAge);
        }

        // Gender filter
        if (isset($filters['gender']) && $filters['gender'] !== 'both' && !empty($filters['gender'])) {
            $gender = $filters['gender'] === 'male' ? 'ذكر' : 'أنثى';
            $query->where('orphans.orphan_gender', $gender);
        }

        // Exclude adopted orphans
        $excludeAdopted = filter_var($filters['exclude_adopted'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($excludeAdopted) {
            // Note: adoption_status field doesn't exist in current table structure
            // $query->where('orphans.is_adopted', '!=', 'نعم');
        }

        // Exclude orphans already in a specific project if project_id is provided
        if (!empty($filters['project_id'])) {
            // Temporarily disabled for testing
            // $projectId = $filters['project_id'];
            // $excludedProjectOrphans = \Illuminate\Support\Facades\DB::table('orphan_project_proposals')
            //     ->where('project_proposal_id', $projectId)
            //     ->pluck('orphan_id_number')
            //     ->toArray();

            // if (!empty($excludedProjectOrphans)) {
            //     $query->whereNotIn('orphans.orphan_id_number', $excludedProjectOrphans);
            // }
        }

        // Exclude sponsored orphans if requested
        $excludeSponsored = filter_var($filters['exclude_sponsored'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($excludeSponsored) {
            // Use the working whereNotIn approach with subquery
            $query->whereNotIn('orphans.orphan_id_number', function ($subQuery) {
                $subQuery->select('orphan_id_number')
                    ->from('orphan_project_proposals')
                    ->whereNotNull('orphan_id_number');
            });
        }

        return $query;
    }

    /**
     * Check if orphans are sponsored
     */
    public function checkSponsorshipStatus(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'orphan_ids' => 'required|array',
                'orphan_ids.*' => 'string|max:255',
            ]);

            $sponsoredOrphans = \Illuminate\Support\Facades\DB::table('orphan_project_proposals')
                ->whereIn('orphan_id_number', $validated['orphan_ids'])
                ->pluck('orphan_id_number')
                ->toArray();

            return $this->successResponse([
                'sponsored_orphans' => $sponsoredOrphans,
            ], 'تم فحص حالة الكفالة بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل الفحص', 'حدث خطأ أثناء فحص حالة الكفالة', 500, $e);
        }
    }
}
