<?php

namespace App\Services;

use App\Models\ProjectProposal;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Builder;

class ProjectProposalQuery
{
    /**
     * Build query for listing projects with filters
     */
    public function buildListQuery(Request $request, User $user): Builder
    {
        $userRole = strtolower($user->role ?? 'guest');
        $userId = $user->id ?? 0;
        
        $query = ProjectProposal::query();
        
        // Role-based filtering
        $this->applyRoleFilters($query, $userRole, $userId);
        
        // Status filter
        $this->applyStatusFilter($query, $request);
        
        // Project type filter
        $this->applyProjectTypeFilter($query, $request);
        
        // Search filter
        $this->applySearchFilter($query, $request);
        
        // Date filters
        $this->applyDateFilters($query, $request);
        
        // Additional filters
        $this->applyAdditionalFilters($query, $request, $userRole);
        
        // Eager load relationships
        $this->loadRelationships($query, $userRole);
        
        // Apply sorting
        $this->applySorting($query, $request);
        
        return $query;
    }

    /**
     * Apply role-based filters
     */
    private function applyRoleFilters(Builder $query, string $userRole, int $userId): void
    {
        switch ($userRole) {
            case 'admin':
                // ✅ Admin sees only parent projects (excludes daily and monthly sub-projects)
                // 🎯 المنطق: أي مشروع له parent_project_id أو is_monthly_phase أو is_daily_phase ⇒ لا يظهر للإدارة
                // ✅ تحسين: تجنب التداخل العميق لتحسين الأداء
                $query->whereNull('parent_project_id')
                      ->where(function($q) {
                          $q->where('is_monthly_phase', false)
                            ->orWhereNull('is_monthly_phase');
                      })
                      ->where(function($q) {
                          $q->where('is_daily_phase', false)
                            ->orWhereNull('is_daily_phase');
                      })
                      ->whereNull('month_number')
                      ->whereNull('phase_day');
                break;
                
            case 'project_manager':
                // ✅ تحسين الأداء: استخدام whereIn بدلاً من whereHas لتجنب subqueries معقدة
                // Project managers see projects assigned to their teams or assigned by them
                $query->where(function($q) use ($userId) {
                    // ✅ تحسين: جلب team_ids أولاً ثم استخدام whereIn
                    $teamIds = DB::table('team_members')
                        ->where('user_id', $userId)
                        ->pluck('team_id')
                        ->toArray();
                    
                    if (!empty($teamIds)) {
                        $q->whereIn('assigned_to_team_id', $teamIds);
                    }
                    
                    $q->orWhere('assigned_by', $userId);
                });
                break;
                
            case 'media_manager':
                // Media managers see projects needing photographer or assigned to photographer
                $query->where(function($q) {
                    $q->whereNull('assigned_photographer_id')
                      ->orWhereNotNull('assigned_photographer_id');
                });
                break;
                
            case 'executed_projects_coordinator':
                // Coordinators see executed projects and projects ready for execution
                $query->where(function($q) {
                    $q->where('status', 'جاهز للتنفيذ')
                      ->orWhere('status', 'تم التنفيذ')
                      ->orWhere('is_daily_phase', true)
                      ->orWhere('is_monthly_phase', true)
                      ->orWhere(function($subQ) {
                          $subQ->where('is_divided_into_phases', false)
                               ->where('status', '!=', 'جديد');
                      });
                });
                break;
                
            default:
                // Other roles see only their assigned projects
                $query->where('created_by', $userId);
                break;
        }
    }

    /**
     * Apply status filter
     */
    private function applyStatusFilter(Builder $query, Request $request): void
    {
        $status = $request->get('status', 'all');
        
        if ($status !== 'all' && !empty($status)) {
            if (is_string($status) && str_contains($status, ',')) {
                $status = explode(',', $status);
            }
            if (is_array($status)) {
                $query->whereIn('status', $status);
            } else {
                $query->where('status', $status);
            }
        }
    }

    /**
     * Apply project type filter
     */
    private function applyProjectTypeFilter(Builder $query, Request $request): void
    {
        $projectType = $request->get('project_type', 'all');
        
        if ($projectType !== 'all' && !empty($projectType)) {
            if (is_string($projectType) && str_contains($projectType, ',')) {
                $projectType = explode(',', $projectType);
            }
            if (is_array($projectType)) {
                $query->whereIn('project_type', $projectType);
            } else {
                $query->where('project_type', $projectType);
            }
        }
    }

    /**
     * Apply search filter
     */
    private function applySearchFilter(Builder $query, Request $request): void
    {
        $searchQuery = $request->get('searchQuery', '');
        
        if (!empty($searchQuery)) {
            $query->where(function($q) use ($searchQuery) {
                $q->where('project_name', 'like', "%{$searchQuery}%")
                  ->orWhere('serial_number', 'like', "%{$searchQuery}%")
                  ->orWhere('donor_name', 'like', "%{$searchQuery}%")
                  ->orWhere('donor_code', 'like', "%{$searchQuery}%")
                  ->orWhere('internal_code', 'like', "%{$searchQuery}%");
            });
        }
    }

    /**
     * Apply date filters (تاريخ الإدخال created_at + تاريخ التنفيذ execution_date)
     * ✅ دعم معاملات التقارير: start_date/end_date وبدائلهما created_at_start/created_at_end
     */
    private function applyDateFilters(Builder $query, Request $request): void
    {
        $startDate = $request->filled('start_date') ? $request->start_date
            : ($request->filled('created_at_start') ? $request->created_at_start : $request->get('created_from'));
        $endDate   = $request->filled('end_date')   ? $request->end_date
            : ($request->filled('created_at_end')   ? $request->created_at_end   : $request->get('created_to'));
        if ($startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        }
        if ($request->filled('execution_date_from')) {
            $query->whereDate('execution_date', '>=', $request->execution_date_from);
        }
        if ($request->filled('execution_date_to')) {
            $query->whereDate('execution_date', '<=', $request->execution_date_to);
        }
    }

    /**
     * Apply additional filters
     */
    private function applyAdditionalFilters(Builder $query, Request $request, string $userRole): void
    {
        // Filter by team
        if ($request->has('team_id') && !empty($request->team_id)) {
            $teamId = $request->team_id;
            if (is_string($teamId) && str_contains($teamId, ',')) $teamId = explode(',', $teamId);
            if (is_array($teamId)) $query->whereIn('assigned_to_team_id', $teamId);
            else $query->where('assigned_to_team_id', $teamId);
        }
        
        // Filter by photographer
        if ($request->has('photographer_id') && !empty($request->photographer_id)) {
            $photographerId = $request->photographer_id;
            if (is_string($photographerId) && str_contains($photographerId, ',')) $photographerId = explode(',', $photographerId);
            if (is_array($photographerId)) $query->whereIn('assigned_photographer_id', $photographerId);
            else $query->where('assigned_photographer_id', $photographerId);
        }
        
        // Filter by shelter
        if ($request->has('shelter_id') && !empty($request->shelter_id)) {
            $shelterId = $request->shelter_id;
            if (is_string($shelterId) && str_contains($shelterId, ',')) $shelterId = explode(',', $shelterId);
            if (is_array($shelterId)) $query->whereIn('shelter_id', $shelterId);
            else $query->where('shelter_id', $shelterId);
        }
        
        // Filter by subcategory
        if ($request->has('subcategory_id') && !empty($request->subcategory_id)) {
            $subcategoryId = $request->subcategory_id;
            if (is_string($subcategoryId) && str_contains($subcategoryId, ',')) $subcategoryId = explode(',', $subcategoryId);
            if (is_array($subcategoryId)) $query->whereIn('subcategory_id', $subcategoryId);
            else $query->where('subcategory_id', $subcategoryId);
        }
        
        // Filter by phase type
        if ($request->has('phase_type')) {
            $phaseType = $request->phase_type;
            if ($phaseType === 'daily') {
                $query->where('is_daily_phase', true);
            } elseif ($phaseType === 'monthly') {
                $query->where('is_monthly_phase', true);
            } elseif ($phaseType === 'parent') {
                $query->where('is_divided_into_phases', true)
                      ->whereNull('parent_project_id');
            }
        }
    }

    /**
     * Load relationships based on user role
     */
    private function loadRelationships(Builder $query, string $userRole): void
    {
        $withRelations = [
            'currency:id,currency_code,currency_name_ar',
        ];
        
        if (in_array($userRole, ['project_manager', 'admin', 'executed_projects_coordinator', 'media_manager'])) {
            $withRelations['assignedToTeam'] = function($q) {
                $q->select('id', 'team_name')
                  ->with(['photographers:id,name,phone_number']);
            };
            
            $withRelations[] = 'assignedResearcher:id,name,phone_number';
            $withRelations[] = 'photographer:id,name';
        }
        
        if (in_array($userRole, ['executed_projects_coordinator', 'admin', 'media_manager'])) {
            $withRelations[] = 'shelter:manager_id_number,camp_name';
        }
        
        $query->with($withRelations);
    }

    /**
     * Apply sorting
     */
    private function applySorting(Builder $query, Request $request): void
    {
        $sortBy = $request->get('sort_by', 'default');
        $sortOrder = $request->get('sort_order', 'desc');
        
        switch ($sortBy) {
            case 'created_at':
                $query->orderBy('created_at', $sortOrder);
                break;
            case 'execution_date':
                $query->orderBy('execution_date', $sortOrder);
                break;
            case 'donation_amount':
                $query->orderBy('donation_amount', $sortOrder);
                break;
            case 'status':
                $query->orderBy('status', $sortOrder);
                break;
            default:
                $query->orderBy('created_at', 'desc');
                break;
        }
    }

    /**
     * Get pagination per page value based on user role
     * ✅ دعم perPage كبير (حتى 10000) لمدير الإعلام كما هو مطلوب في التوثيق
     * ✅ منسق الكفالة: يمكنه طلب حتى 5000 مشروع
     * ✅ وضع التقارير: عند إرسال فلاتر تاريخ (start_date/end_date أو بدائلهما) يُسمح بـ per_page حتى 10000
     */
    public function getPerPageValue(Request $request, string $userRole): int
    {
        $defaultPerPage = 15;
        $maxPerPage = 50;
        $maxPerPageManager = 2000; // ✅ حد أقصى آمن للمديرين
        $maxPerPageMediaManager = 1000; // ✅ حد أقصى لمدير الإعلام (حسب التوثيق)
        $maxPerPageOrphanSponsorCoordinator = 5000; // ✅ حد أقصى آمن لمنسق الكفالة (5000 لتجنب timeout)
        $maxPerPageReports = 10000; // ✅ حد أقصى لصفحة التقارير عند استخدام فلاتر التاريخ

        $perPageInput = $request->query('perPage', $defaultPerPage);
        $perPageInput = $request->query('per_page', $perPageInput);

        $hasDateFilter = $request->filled('start_date') || $request->filled('end_date')
            || $request->filled('created_at_start') || $request->filled('created_at_end');

        // ✅ وضع التقارير: عند وجود فلاتر تاريخ نسمح بـ per_page حتى 10000 لأي دور
        if ($hasDateFilter) {
            $requested = (int) $perPageInput;
            if ($requested >= 1) {
                return min($requested, $maxPerPageReports);
            }
        }

        // ✅ منسق الكفالة: يمكنه طلب عدد كبير من المشاريع (حتى 5000)
        if ($userRole === 'orphan_sponsor_coordinator') {
            if ($perPageInput === 'all' || $perPageInput === 'الكل') {
                return $maxPerPageOrphanSponsorCoordinator;
            }
            if ($request->has('per_page') || $request->has('perPage')) {
                $perPage = (int) $perPageInput;
                return min(max(1, $perPage), $maxPerPageOrphanSponsorCoordinator);
            }
            return 1000;
        }

        // ✅ إجبار filter عند طلب "all" لتجنب Memory spike (للدورات الأخرى)
        if ($perPageInput === 'all' || $perPageInput === 'الكل') {
            $hasFilter = $request->filled('status') && $request->get('status') !== 'all' ||
                        $request->filled('project_type') && $request->get('project_type') !== 'all' ||
                        $request->filled('searchQuery') ||
                        $request->filled('team_id') ||
                        $request->filled('photographer_id') ||
                        $request->filled('shelter_id') ||
                        $hasDateFilter;
            if (!$hasFilter) {
                abort(422, 'يجب تحديد فلترة (status, project_type, searchQuery, team_id, تواريخ، إلخ) عند طلب جميع المشاريع');
            }
            if ($userRole === 'media_manager') {
                return $maxPerPageMediaManager;
            }
            return $maxPerPageManager;
        }

        if ($request->has('per_page') || $request->has('perPage')) {
            $perPage = (int) $perPageInput;
            if ($userRole === 'media_manager') {
                return min(max(1, $perPage), $maxPerPageMediaManager);
            }
            if (in_array($userRole, ['admin', 'project_manager'])) {
                return min(max(1, $perPage), $maxPerPageManager);
            }
            return min(max(1, $perPage), $maxPerPage);
        }

        return $defaultPerPage;
    }
}

