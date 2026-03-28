<?php

namespace App\Services;

use App\Models\ProjectProposal;
use App\Models\User;
use App\Services\CacheService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\Eloquent\Builder;
use Carbon\Carbon;

/**
 * Service for handling project proposals listing with optimized queries
 */
class ProjectProposalIndexService
{
    // Project Status Constants
    private const STATUS_NEW = 'جديد';
    private const STATUS_SUPPLY = 'قيد التوريد';
    private const STATUS_SUPPLIED = 'تم التوريد';
    private const STATUS_DISTRIBUTION = 'قيد التوزيع';
    private const STATUS_READY = 'جاهز للتنفيذ';
    private const STATUS_EXECUTING = 'قيد التنفيذ';
    private const STATUS_POSTPONED = 'مؤجل';
    private const STATUS_EXECUTED = 'تم التنفيذ';
    private const STATUS_MONTAGE = 'في المونتاج';
    private const STATUS_MONTAGE_COMPLETED = 'تم المونتاج';
    private const STATUS_MONTAGE_REDO = 'يجب إعادة المونتاج';
    private const STATUS_DELIVERED = 'وصل للمتبرع';
    private const STATUS_COMPLETED = 'منتهي';
    private const STATUS_ASSIGNED_TO_RESEARCHER = 'مسند لباحث';

    // User Role Constants
    private const ROLE_ADMIN = 'admin';
    private const ROLE_PROJECT_MANAGER = 'project_manager';
    private const ROLE_MEDIA_MANAGER = 'media_manager';
    private const ROLE_EXECUTED_PROJECTS_COORDINATOR = 'executed_projects_coordinator';
    private const ROLE_ORPHAN_SPONSOR_COORDINATOR = 'orphan_sponsor_coordinator';
    private const ROLE_SUPERVISION = 'supervision';

    // Cache Constants
    private const CACHE_TTL_SECONDS = 60;

    // Pagination Constants
    private const DEFAULT_PER_PAGE = 15;
    private const MAX_PER_PAGE = 50;
    private const MAX_PER_PAGE_MANAGER = 2000;
    private const MAX_PER_PAGE_REPORTS = 10000;

    protected ProjectProposalQuery $query;
    protected ProjectsCacheService $cacheService;

    public function __construct(ProjectProposalQuery $query, ProjectsCacheService $cacheService)
    {
        $this->query = $query;
        $this->cacheService = $cacheService;
    }

    /**
     * Get paginated projects with filters
     */
    public function getProjects(Request $request, User $user, bool $finishedOnly = false): array
    {
        $userRole = strtolower($user->role ?? 'guest');
        $userId = $user->id ?? 0;

        $useCache = !$request->has('_t');
        $perPage = $this->getEffectivePerPage($request, $userRole);
        $cacheKeyParams = [
            'per_page' => $perPage,
            'sort_by' => $request->get('sort_by', 'default'),
            'finished_only' => $finishedOnly ? '1' : '0',  // ✅ FIX: Separate cache keys
        ];
        if ($request->filled('start_date'))
            $cacheKeyParams['start_date'] = $request->start_date;
        if ($request->filled('end_date'))
            $cacheKeyParams['end_date'] = $request->end_date;

        $cacheKey = CacheService::buildKeyFromRequest($request, CacheService::PREFIX_PROJECTS, $cacheKeyParams);
        $cacheTtl = $useCache ? CacheService::TTL_DYNAMIC : 0;

        // Return cached data if available
        if ($useCache && $cachedData = CacheService::get($cacheKey, null, true)) {
            return $this->buildCachedResponse($cachedData, $cacheKey, $request->header('If-None-Match'), $cacheTtl);
        }

        // Build query
        $query = $this->buildQuery($request, $user, $userRole, $finishedOnly);
        $page = max(1, (int) $request->query('page', 1));

        $usedSimplifiedQuery = false;
        try {
            $projects = $query->paginate($perPage, ['*'], 'page', $page);
        } catch (\Exception $e) {
            Log::error('Project query timeout - using simplified query', ['error' => $e->getMessage()]);
            $usedSimplifiedQuery = true;
            $projects = $this->buildSimplifiedQuery($request, $user, $userRole, $finishedOnly)->paginate($perPage, ['*'], 'page', $page);
        }

        // Process results
        $projectsItems = $this->processProjects($projects->items(), $userRole);

        // Build response
        $cacheTime = time();
        $responseData = $this->buildResponseData($projects, $projectsItems, $userRole, $cacheTime, $usedSimplifiedQuery);

        // Save to cache
        if ($useCache) {
            CacheService::put($cacheKey, $responseData, $cacheTtl, true);
        }

        $etag = md5($cacheKey . '_' . $cacheTime);
        return [
            'response' => response()->json($responseData, 200)
                ->header('ETag', $etag)
                ->header('Cache-Control', $useCache ? 'private, max-age=30' : 'no-cache, must-revalidate')
                ->header('X-Cache', 'MISS')
                ->header('X-Fallback', $usedSimplifiedQuery ? '1' : '0')
        ];
    }

    private function buildQuery(Request $request, User $user, string $userRole, bool $finishedOnly = false): Builder
    {
        $selectFields = $this->getSelectFields();

        // ✅ تم إجبار اختيار الحقول لضمان توفر project_type وكافة الخصائص في الموديل
        $query = ProjectProposal::query()->select($selectFields);

        // ✅ FIX: Apply finished/unfinished filter CENTRALLY
        if ($finishedOnly) {
            $query->where('status', self::STATUS_COMPLETED);
        } else {
            $query->where('status', '!=', self::STATUS_COMPLETED);
        }

        $this->applyRoleBasedFilters($query, $request, $user, $userRole, $finishedOnly);
        $this->applyCommonFilters($query, $request, $userRole, $finishedOnly);
        $this->loadRelationships($query, $userRole, $request);
        $this->applySorting($query, $request, $userRole);

        return $query;
    }

    private function getEffectivePerPage(Request $request, string $userRole): int
    {
        $perPage = $this->query->getPerPageValue($request, $userRole);
        $hasDateFilter = $request->filled('start_date') || $request->filled('end_date') || $request->filled('created_at_start') || $request->filled('created_at_end');
        if ($hasDateFilter) {
            $requested = (int) $request->query('per_page', $request->query('perPage', $perPage));
            return min(max($requested, 1), self::MAX_PER_PAGE_REPORTS);
        }
        return $perPage;
    }

    private function getSelectFields(): array
    {
        return [
            'id',
            'serial_number',
            'project_name',
            'project_description',
            'donor_name',
            'donor_code',
            'internal_code',
            'project_type',
            'status',
            'donation_amount',
            'net_amount',
            'amount_in_usd',
            'currency_id',
            'admin_discount_percentage',
            'discount_amount',
            'shekel_exchange_rate',
            'net_amount_shekel',
            'shekel_converted_at',
            'shekel_converted_by',
            'quantity',
            'beneficiaries_count',
            'beneficiaries_per_unit',
            'unit_cost',
            'supply_cost',
            'surplus_amount',
            'has_deficit',
            'is_urgent',
            'estimated_duration_days',
            'assignment_date',
            'assigned_to_team_id',
            'assigned_researcher_id',
            'assigned_photographer_id',
            'assigned_montage_producer_id',
            'assigned_by',
            'shelter_id',
            'created_by',
            'subcategory_id',
            'execution_date',
            'media_received_date',
            'montage_start_date',
            'montage_completed_date',
            'parent_project_id',
            'notes',
            'notes_image',
            'project_image',
            'is_daily_phase',
            'is_divided_into_phases',
            'phase_type',
            'total_months',
            'phase_duration_days',
            'phase_start_date',
            'phase_day',
            'month_number',
            'month_start_date',
            'is_monthly_phase',
            'rejection_reason',
            'rejection_message',
            'admin_rejection_reason',
            'media_rejection_reason',
            'created_at',
            'updated_at'
        ];
    }

    private function applyRoleBasedFilters(Builder $query, Request $request, User $user, string $userRole, bool $finishedOnly = false): void
    {
        switch ($userRole) {
            case self::ROLE_PROJECT_MANAGER:
                $this->applyProjectManagerFilters($query, $request, $finishedOnly);
                break;
            case self::ROLE_MEDIA_MANAGER:
                $this->applyMediaManagerFilters($query, $request, $finishedOnly);
                break;
            case self::ROLE_EXECUTED_PROJECTS_COORDINATOR:
                $this->applyExecutedProjectsCoordinatorFilters($query, $request, $finishedOnly); // ✅ Pass it
                break;
            case self::ROLE_ORPHAN_SPONSOR_COORDINATOR:
                $this->applyOrphanSponsorCoordinatorFilters($query, $request, $finishedOnly);
                break;
            case self::ROLE_SUPERVISION:
            case self::ROLE_ADMIN:
                $this->applyAdminFilters($query, $request, $finishedOnly);
                break;
            default:
                $query->where('created_by', $user->id ?? 0);
                // ✅ FIX: Removed redundant finished check — buildQuery() handles it
                break;
        }
    }

    private function applyProjectManagerFilters(Builder $query, Request $request, bool $finishedOnly = false): void
    {
        $today = Carbon::now(config('app.timezone', 'UTC'))->format('Y-m-d');

        if (!$finishedOnly) {
            $query->where(function ($q) {
                $q->where(function ($nonDividedQ) {
                    $nonDividedQ->where('is_divided_into_phases', false)->orWhereNull('is_divided_into_phases');
                })
                    ->orWhere('is_daily_phase', true)
                    ->orWhere('is_monthly_phase', true);
            });

            $query->where(function ($q) use ($today) {
                $q->where('is_daily_phase', false)
                    ->orWhere(function ($due) use ($today) {
                        $due->whereNull('execution_date')->orWhereDate('execution_date', '<=', $today);
                    });
            });
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->whereIn('status', (array) $request->status);
        }

        // ✅ إخفاء مشاريع الكفالة عن مدير المشاريع في صفحة المشاريع العامة
        $query->where(function ($q) {
            $q->where('project_type', '!=', 'الكفالات')
                ->orWhereNull('project_type');
        });
    }

    private function applyMediaManagerFilters(Builder $query, Request $request, bool $finishedOnly = false): void
    {
        if (!$finishedOnly) {
            $query->where(function ($q) {
                $q->whereNull('is_divided_into_phases')
                    ->orWhere('is_divided_into_phases', false)
                    ->orWhere('is_daily_phase', true);
            });
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->whereIn('status', (array) $request->status);
        } elseif (!$finishedOnly) {
            $query->whereIn('status', [
                self::STATUS_ASSIGNED_TO_RESEARCHER,
                self::STATUS_READY,
                'تم اختيار المخيم',
                self::STATUS_EXECUTING,
                self::STATUS_EXECUTED,
                self::STATUS_MONTAGE,
                self::STATUS_MONTAGE_COMPLETED,
                self::STATUS_MONTAGE_REDO,
                'معاد مونتاجه',
                self::STATUS_DELIVERED,
            ]);
            // ✅ FIX: Removed redundant ->where('status', '!=', self::STATUS_COMPLETED)
        }
    }
    private function applyExecutedProjectsCoordinatorFilters(Builder $query, Request $request, bool $finishedOnly = false): void
    {
        if ($finishedOnly) {
            // ✅ For finished endpoint: buildQuery() already set status = 'منتهي'
            return;
        }

        // ── Non-finished: existing logic ──
        $executedStatuses = [
            self::STATUS_EXECUTED,
            'منفذ',
            self::STATUS_MONTAGE,
            self::STATUS_MONTAGE_COMPLETED,
            'معاد مونتاجه',
            self::STATUS_DELIVERED,
        ];
        $executionStatuses = [self::STATUS_READY, 'تم اختيار المخيم', self::STATUS_EXECUTING];

        if ($request->filled('status') && in_array($request->status, $executedStatuses)) {
            $query->where('status', $request->status);
        } else {
            $query->whereIn('status', $executionStatuses);
        }
    }

    private function applyOrphanSponsorCoordinatorFilters(Builder $query, Request $request, bool $finishedOnly = false): void
    {
        $query->where('project_type', 'الكفالات');

        if (!$finishedOnly) {
            // ✅ لمنسق الكفالة: إخفاء المشاريع الأب إذا كانت مقسمة (is_divided_into_phases = true)
            // ✅ عرض فقط المشاريع غير المقسمة (التي ليس لها أبناء) أو المشاريع الفرعية نفسها
            $query->where(function ($q) {
                $q->where(function ($sub) {
                    $sub->whereNull('parent_project_id')
                        ->where(function ($divided) {
                            $divided->where('is_divided_into_phases', false)
                                ->orWhereNull('is_divided_into_phases');
                        });
                })
                    ->orWhereNotNull('parent_project_id');
            });

            // ✅ تطبيق فلترة الحالة لضمان ظهور المشاريع النشطة فقط (سواء كانت أب أو ابن)
            $query->whereIn('status', [
                self::STATUS_SUPPLY,
                self::STATUS_SUPPLIED,
                self::STATUS_DISTRIBUTION,
                self::STATUS_ASSIGNED_TO_RESEARCHER,
                self::STATUS_READY,
                self::STATUS_EXECUTING,
                self::STATUS_EXECUTED,
                self::STATUS_MONTAGE,
                self::STATUS_MONTAGE_COMPLETED,
                self::STATUS_MONTAGE_REDO,
                self::STATUS_DELIVERED,
                self::STATUS_COMPLETED
            ]);

            if ($request->filled('status') && $request->status !== 'all') {
                $query->whereIn('status', (array) $request->status);
            }
        }
    }

    private function applyAdminFilters(Builder $query, Request $request, bool $finishedOnly = false): void
    {
        if (!$finishedOnly) {
            if ($request->filled('status') && $request->status !== 'all') {
                $query->whereIn('status', (array) $request->status);
            }
            if ($request->filled('project_type') && $request->project_type !== 'all') {
                $query->whereIn('project_type', (array) $request->project_type);
            }

            $query->where(function ($q) {
                $q->whereNull('parent_project_id')
                    ->orWhereIn('status', [self::STATUS_SUPPLY, self::STATUS_SUPPLIED, self::STATUS_DISTRIBUTION, self::STATUS_ASSIGNED_TO_RESEARCHER, self::STATUS_READY, self::STATUS_EXECUTING, self::STATUS_EXECUTED, self::STATUS_MONTAGE, self::STATUS_MONTAGE_COMPLETED, self::STATUS_MONTAGE_REDO, self::STATUS_DELIVERED, self::STATUS_COMPLETED]);
            });
        }
    }

    private function applyCommonFilters(Builder $query, Request $request, string $userRole, bool $finishedOnly = false): void
    {
        if ($userRole !== self::ROLE_ADMIN) {
            if ($request->filled('subcategory_id'))
                $query->whereIn('subcategory_id', (array) $request->subcategory_id);
            if ($request->filled('team_id'))
                $query->where('assigned_to_team_id', $request->team_id);

            $startDate = $request->get('start_date') ?: $request->get('created_at_start');
            if ($startDate)
                $query->whereDate('created_at', '>=', $startDate);
        }

        $searchQuery = $request->get('searchQuery', '');
        if (!empty($searchQuery))
            $this->applySearchFilter($query, trim($searchQuery));
    }

    private function applySearchFilter(Builder $query, string $search): void
    {
        $query->where(function ($q) use ($search) {
            $q->where('serial_number', 'LIKE', "%{$search}%")
                ->orWhere('project_name', 'LIKE', "%{$search}%")
                ->orWhere('donor_name', 'LIKE', "%{$search}%");
        });
    }

    private function loadRelationships(Builder $query, string $userRole, Request $request): void
    {
        $withRelations = [
            'currency:id,currency_code,currency_name_ar,exchange_rate_to_usd',
            'assignedResearcher:id,name,phone_number',
            'photographer:id,name,phone_number',
            'assignedToTeam:id,team_name,team_leader_name',
            'assignedMontageProducer:id,name,phone_number,email',
            'shelter' => fn($q) => $q->select('manager_id_number', 'camp_name', 'governorate', 'district'),
            'subcategory:id,name_ar,name',
            'parentProject:id,serial_number,project_name,donor_code,internal_code,project_type,currency_id,subcategory_id',
            'parentProject.currency:id,currency_code,currency_name_ar',
        ];

        if (in_array($userRole, [self::ROLE_ORPHAN_SPONSOR_COORDINATOR, self::ROLE_ADMIN])) {
            $withRelations['sponsoredOrphans'] = fn($q) => $q->select('orphan_id_number', 'orphan_full_name')->limit(100);
        }

        $query->with($withRelations);
    }

    private function processProjects(array $projects, string $userRole): array
    {
        $processed = [];
        foreach ($projects as $project) {
            if (is_array($project)) {
                $processed[] = $project;
                continue;
            }

            $projectArray = $project->toArray();

            // Add manual relationship mappings to the array
            $producer = $project->assignedMontageProducer;
            $producerName = $producer->name ?? null;

            // ✅ Frontend expects multiple possible shapes. Ensure we populate the common ones.
            $projectArray['producer_name'] = $producerName;
            $projectArray['montage_producer_name'] = $producerName;
            $projectArray['assigned_montage_producer_name'] = $producerName;

            $projectArray['assigned_montage_producer'] = $producer
                ? ['id' => $producer->id, 'name' => $producer->name]
                : null;

            // also add camelCase variants for safety
            $projectArray['assignedMontageProducer'] = $producer
                ? ['id' => $producer->id, 'name' => $producer->name]
                : null;

            $projectArray['montageProducer'] = $producer
                ? ['id' => $producer->id, 'name' => $producer->name]
                : null;

            $projectArray['montageProducerName'] = $producerName;
            $projectArray['team'] = $project->assignedToTeam ? ['id' => $project->assignedToTeam->id, 'team_name' => $project->assignedToTeam->team_name] : null;
            $projectArray['researcher'] = $project->assignedResearcher ? ['id' => $project->assignedResearcher->id, 'name' => $project->assignedResearcher->name] : null;
            $projectArray['photographer_name'] = $project->photographer->name ?? null;

            if (empty($projectArray['project_type']) && $project->parent_project_id && $project->relationLoaded('parentProject')) {
                $projectArray['project_type'] = $project->parentProject->project_type ?? null;
            }

            $projectArray['notes_image'] = $project->notes_image_path;
            $projectArray['notes_image_url'] = $project->notes_image_url;
            $projectArray['notes_image_download_url'] = $project->getNotesImageDownloadUrlAttribute();
            $projectArray['project_image_url'] = $project->project_image_url;

            $processed[] = $projectArray;
        }
        return $processed;
    }


    private function buildResponseData($projects, array $projectsItems, string $userRole, int $cacheTime, bool $usedSimplifiedQuery): array
    {
        return [
            'success' => true,
            'projects' => $projectsItems,
            'total' => $projects->total(),
            'currentPage' => $projects->currentPage(),
            'totalPages' => $projects->lastPage(),
            'perPage' => $projects->perPage(),
            'cache_time' => $cacheTime,
            'used_simplified_query' => $usedSimplifiedQuery,
        ];
    }

    private function buildSimplifiedQuery(Request $request, User $user, string $userRole, bool $finishedOnly = false): Builder
    {
        /** @var Builder $query */
        $query = ProjectProposal::query()->select([
            'id',
            'serial_number',
            'donor_code',
            'internal_code',
            'project_name',
            'project_description',
            'donor_name',
            'status',
            'execution_date',
            'is_urgent',
            'phase_day',
            'is_daily_phase',
            'is_monthly_phase',
            'month_number',
            'parent_project_id',
            'donation_amount',
            'net_amount',
            'amount_in_usd',
            'currency_id',
            'assigned_montage_producer_id',
            'assigned_photographer_id',
            'assigned_researcher_id',
            'assigned_to_team_id',
            'subcategory_id',
            'shelter_id',
            'rejection_reason',
            'media_rejection_reason',
            'admin_rejection_reason',
            'project_type',
            'created_at',
            'updated_at'
        ])
            ->with([
                'assignedMontageProducer:id,name',
                'photographer:id,name',
                'assignedResearcher:id,name',
                'assignedToTeam:id,team_name',
                'subcategory:id,name_ar,name',
                'currency:id,currency_code,currency_name_ar',
                'parentProject:id,serial_number,project_name,project_type,donation_amount,net_amount,amount_in_usd,currency_id',
                'parentProject.currency:id,currency_code,currency_name_ar'
            ]);

        // ✅ تطبيق الفلاتر الخاصة بالأدوار (لضمان إخفاء الأبناء/الآباء حسب الحاجة)
        $this->applyRoleBasedFilters($query, $request, $user, $userRole, $finishedOnly);

        // ✅ تطبيق الفلاتر العامة (البحث، التاريخ، إلخ)
        $this->applyCommonFilters($query, $request, $userRole, $finishedOnly);

        // ✅ إضافة الترتيب الافتراضي إذا لم يتم تحديده
        if (!$request->has('sort_by')) {
            $query->orderBy('created_at', 'DESC');
        }

        return $query;
    }

    private function applySorting(Builder $query, Request $request, string $userRole): void
    {
        $sortBy = $request->get('sort_by', 'default');

        if ($userRole === self::ROLE_MEDIA_MANAGER) {
            if ($sortBy === 'date' || $sortBy === 'priority') {
                $query->orderBy('execution_date', 'DESC');
            } elseif ($sortBy === 'name') {
                $query->orderBy('project_name', 'ASC');
            } else {
                $query->orderBy('created_at', 'DESC');
            }
        } else {
            $query->orderBy('created_at', 'DESC');
        }
    }

    private function calculateTotalAmount(): float
    {
        return round(
            ProjectProposal::whereNotNull('donation_amount')
                ->where('donation_amount', '>', 0)
                ->selectRaw('SUM(COALESCE(donation_amount, 0)) as total')
                ->value('total') ?? 0,
            2
        );
    }

    private function buildProjectManagerFilterInfo(array $projectsItems): array
    {
        $collection = collect($projectsItems);
        return [
            'non_divided_count' => $collection->filter(fn($p) => !($p['is_daily_phase'] ?? false) && !($p['is_monthly_phase'] ?? false))->count(),
            'daily_phases_count' => $collection->filter(fn($p) => $p['is_daily_phase'] ?? false)->count(),
            'monthly_phases_count' => $collection->filter(fn($p) => $p['is_monthly_phase'] ?? false)->count(),
        ];
    }

    private function buildCachedResponse(array $cachedData, string $cacheKey, ?string $requestEtag, int $cacheTtl): array
    {
        $etag = md5($cacheKey . '_' . ($cachedData['cache_time'] ?? time()));
        if ($requestEtag === $etag)
            return ['response' => response()->json([], 304)->header('ETag', $etag)];
        return ['response' => response()->json($cachedData, 200)->header('ETag', $etag)->header('X-Cache', 'HIT')];
    }
}