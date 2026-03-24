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
 * 
 * Features:
 * - Role-based filtering
 * - Intelligent caching with ETag support
 * - Full-text search with LIKE fallback
 * - Eager loading to prevent N+1 queries
 * - Optimized for performance
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

    // Cache Constants
    // ✅ زيادة TTL لتحسين الأداء (من 30 إلى 60 ثانية)
    private const CACHE_TTL_SECONDS = 60;

    // Pagination Constants
    private const DEFAULT_PER_PAGE = 15;
    private const MAX_PER_PAGE = 50;
    private const MAX_PER_PAGE_MANAGER = 2000;
    /** حد أقصى لـ per_page عند استخدام فلاتر التقارير (من تاريخ - إلى تاريخ) */
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
     *
     * @param Request $request
     * @param User $user
     * @return array
     */
    public function getProjects(Request $request, User $user): array
    {
        $userRole = strtolower($user->role ?? 'guest');
        $userId = $user->id ?? 0;

        // Cache management
        $useCache = !$request->has('_t');
        $perPage = $this->getEffectivePerPage($request, $userRole);
        $cacheKeyParams = [
            'per_page' => $perPage,
            'sort_by' => $request->get('sort_by', 'default'),
        ];
        // ✅ تضمين فلاتر التاريخ في مفتاح الكاش حتى لا تُعاد نفس الاستجابة لفترات مختلفة
        if ($request->filled('start_date')) {
            $cacheKeyParams['start_date'] = $request->start_date;
        }
        if ($request->filled('end_date')) {
            $cacheKeyParams['end_date'] = $request->end_date;
        }
        if ($request->filled('created_at_start')) {
            $cacheKeyParams['created_at_start'] = $request->created_at_start;
        }
        if ($request->filled('created_at_end')) {
            $cacheKeyParams['created_at_end'] = $request->created_at_end;
        }
        if ($request->filled('assigned_researcher_id') || $request->filled('researcher_id')) {
            $cacheKeyParams['assigned_researcher_id'] = $request->get('assigned_researcher_id') ?: $request->get('researcher_id');
        }
        $cacheKey = CacheService::buildKeyFromRequest($request, CacheService::PREFIX_PROJECTS, $cacheKeyParams);
        $cacheTtl = $useCache ? CacheService::TTL_DYNAMIC : 0;

        // Return cached data if available
        if ($useCache && $cachedData = CacheService::get($cacheKey, null, true)) {
            return $this->buildCachedResponse($cachedData, $cacheKey, $request->header('If-None-Match'), $cacheTtl);
        }

        // ✅ تحسين الأداء: استخدام query optimization
        // Build query
        $query = $this->buildQuery($request, $user, $userRole);
        
        // ✅ إضافة indexes hints وتحسين query
        // Get pagination values
        $page = max(1, (int) $request->query('page', 1));

        // ✅ تحسين الأداء: استخدام chunking للـ large datasets
        // Execute query with pagination
        // ✅ لا حاجة لـ select() هنا لأن buildQuery() يستخدمه بالفعل
        $usedSimplifiedQuery = false;
        
        try {
            // ✅ لمنسق الكفالة: استخدام pagination محسّن للاستعلامات الكبيرة
            if ($userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR && $perPage > 1000) {
                // ✅ استخدام simplePaginate للاستعلامات الكبيرة لتقليل وقت الاستجابة
                // لكن نستخدم paginate للحصول على total count
                $projects = $query->paginate($perPage, ['*'], 'page', $page);
            } else {
                $projects = $query->paginate($perPage, ['*'], 'page', $page);
            }
        } catch (\Exception $e) {
            Log::error('Project query timeout - using simplified query', [
                'user_id' => $userId,
                'role' => $userRole,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => app()->environment('local') ? substr($e->getTraceAsString(), 0, 2000) : null,
            ]);
            
            // Fallback to simplified query
            try {
                $usedSimplifiedQuery = true;
                $projects = $this->buildSimplifiedQuery($request, $user, $userRole)->paginate($perPage, ['*'], 'page', $page);
            } catch (\Exception $fallbackException) {
                Log::error('Simplified query also failed', [
                    'user_id' => $userId,
                    'role' => $userRole,
                    'error' => $fallbackException->getMessage(),
                    'file' => $fallbackException->getFile(),
                    'line' => $fallbackException->getLine(),
                    'trace' => app()->environment('local') ? substr($fallbackException->getTraceAsString(), 0, 2000) : null,
                ]);
                
                // Last resort: minimal query (مع فلتر حسب الدور حتى في سياق الخطأ)
                $usedSimplifiedQuery = true;
                $minimalQuery = ProjectProposal::select(['id', 'serial_number', 'project_name', 'status', 'created_at'])
                    ->orderBy('created_at', 'DESC');
                
                if ($userRole === self::ROLE_ADMIN) {
                    $minimalQuery->forSurplusStatistics();
                } elseif ($userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR) {
                    $minimalQuery->where('project_type', 'الكفالات')
                        ->where('status', '!=', self::STATUS_COMPLETED)
                        ->whereIn('status', [
                            'جديد', 'قيد التوريد', 'تم التوريد', 'مسند لباحث', 'جاهز للتنفيذ',
                            'قيد التنفيذ', 'تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'وصل للمتبرع'
                        ]);
                }
                
                $projects = $minimalQuery->paginate($perPage, ['*'], 'page', $page);
            }
        }

        // ✅ Logging فقط في بيئة التطوير: count + sample ids لمنسق الكفالة
        if ($userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR && app()->environment('local')) {
            $rawItems = $projects->items();
            $monthlyPhasesCount = collect($rawItems)->filter(function($p) {
                $isArray = is_array($p);
                return $isArray ? ($p['is_monthly_phase'] ?? false) : ($p->is_monthly_phase ?? false);
            })->count();
            $sampleIds = collect($rawItems)->take(5)->map(function($p) {
                return is_array($p) ? ($p['id'] ?? null) : ($p->id ?? null);
            })->filter()->values()->all();
            Log::debug('🔍 Orphan Sponsor Coordinator - Query results', [
                'total_count' => $projects->total(),
                'current_page_count' => count($rawItems),
                'monthly_phases_count' => $monthlyPhasesCount,
                'sample_ids' => $sampleIds,
            ]);
        }

        // Process results
        $projectsItems = $this->processProjects($projects->items(), $userRole);

        // Build response
        $cacheTime = time();
        $responseData = $this->buildResponseData($projects, $projectsItems, $userRole, $cacheTime, $usedSimplifiedQuery);

        // ✅ حفظ في الكاش باستخدام CacheService مع TTL محسّن
        if ($useCache) {
            CacheService::put($cacheKey, $responseData, $cacheTtl, true);
        }

        // Return response
        $etag = md5($cacheKey . '_' . $cacheTime);
        return [
            'response' => response()->json($responseData, 200)
                ->header('ETag', $etag)
                ->header('Cache-Control', $useCache ? 'private, max-age=30' : 'no-cache, must-revalidate')
                ->header('Pragma', $useCache ? null : 'no-cache')
                ->header('Expires', $useCache ? null : '0')
                ->header('X-Cache', 'MISS')
                ->header('X-Fallback', $usedSimplifiedQuery ? '1' : '0')
                ->header('Last-Modified', gmdate('D, d M Y H:i:s', $cacheTime) . ' GMT')
        ];
    }

    /**
     * Build query with all filters
     */
    private function buildQuery(Request $request, User $user, string $userRole): Builder
    {
        $selectFields = $this->getSelectFields();
        
        // ✅ تحسين الأداء: لمنسق الكفالة، نستخدم join بدلاً من whereHas
        // لذا نبدأ بدون select ونضيفه بعد join
        if ($userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR) {
            $query = ProjectProposal::query(); // بدون select أولاً
        } else {
            $query = ProjectProposal::select($selectFields);
        }

        // Apply role-based filters
        $this->applyRoleBasedFilters($query, $request, $user, $userRole);

        // Apply common filters
        $this->applyCommonFilters($query, $request, $userRole);

        // Load relationships
        $this->loadRelationships($query, $userRole, $request);

        // Apply sorting
        $this->applySorting($query, $request, $userRole);

        return $query;
    }

    /**
     * الحصول على قيمة per_page الفعلية مع رفع الحد للتقارير عند وجود فلاتر تاريخ
     * عند إرسال start_date أو end_date (أو بدائلهما) يُسمح بـ per_page حتى MAX_PER_PAGE_REPORTS
     */
    private function getEffectivePerPage(Request $request, string $userRole): int
    {
        $perPage = $this->query->getPerPageValue($request, $userRole);
        $hasDateFilter = $request->filled('start_date') || $request->filled('end_date')
            || $request->filled('created_at_start') || $request->filled('created_at_end');
        if ($hasDateFilter) {
            $requested = (int) $request->query('per_page', $request->query('perPage', $perPage));
            return min(max($requested, 1), self::MAX_PER_PAGE_REPORTS);
        }
        return $perPage;
    }

    /**
     * Get select fields for query
     */
    private function getSelectFields(): array
    {
        return [
            'id', 'serial_number', 'project_name', 'project_description', 
            'donor_name', 'donor_code', 'internal_code', 'project_type', 'status', 
            'donation_amount', 'net_amount', 'amount_in_usd', 'currency_id',
            'admin_discount_percentage', 'discount_amount',
            'shekel_exchange_rate', 'net_amount_shekel',
            'shekel_converted_at', 'shekel_converted_by',
            'quantity', 'beneficiaries_count', 'beneficiaries_per_unit',
            'unit_cost', 'supply_cost', 'surplus_amount', 'has_deficit', 'is_urgent',
            'estimated_duration_days', 'assignment_date',
            'assigned_to_team_id', 'assigned_researcher_id', 'assigned_photographer_id', 
            'assigned_montage_producer_id', 'assigned_by',
            'shelter_id', 'created_by',
            'subcategory_id',
            'execution_date', 'media_received_date', 
            'montage_start_date', 'montage_completed_date',
            'parent_project_id', 'notes', 'notes_image', 'project_image',
            'is_daily_phase', 'is_divided_into_phases', 
            'phase_type', 'total_months', 'phase_duration_days', 'phase_start_date',
            'phase_day',
            'month_number',
            'month_start_date',
            'is_monthly_phase',
            // ✅ حقول سبب الرفض
            'rejection_reason',
            'rejection_message',
            'admin_rejection_reason',
            'media_rejection_reason',
            'created_at', 'updated_at'
        ];
    }

    /**
     * Apply role-based filters
     */
    private function applyRoleBasedFilters(Builder $query, Request $request, User $user, string $userRole): void
    {
        switch ($userRole) {
            case self::ROLE_PROJECT_MANAGER:
                $this->applyProjectManagerFilters($query, $request);
                break;
                
            case self::ROLE_MEDIA_MANAGER:
                $this->applyMediaManagerFilters($query, $request);
                break;
                
            case self::ROLE_EXECUTED_PROJECTS_COORDINATOR:
                $this->applyExecutedProjectsCoordinatorFilters($query, $request);
                break;
                
            case self::ROLE_ORPHAN_SPONSOR_COORDINATOR:
                $this->applyOrphanSponsorCoordinatorFilters($query, $request);
                break;
                
            case self::ROLE_ADMIN:
                $this->applyAdminFilters($query, $request);
                break;
                
            default:
                $query->where('created_by', $user->id ?? 0);
                break;
        }
    }

    /**
     * Apply project manager filters
     * ✅ المراحل اليومية: نعرض فقط المستحقة حتى اليوم (execution_date <= today) حتى لا يختفي اليوم الأول في اليوم التالي
     */
    private function applyProjectManagerFilters(Builder $query, Request $request): void
    {
        $today = Carbon::now(config('app.timezone', 'UTC'))->format('Y-m-d');

        $query->where(function($q) {
            // Non-divided projects
            $q->where(function($nonDividedQ) {
                $nonDividedQ->where(function($dividedCheck) {
                    $dividedCheck->where('is_divided_into_phases', false)
                                 ->orWhere('is_divided_into_phases', 0)
                                 ->orWhereNull('is_divided_into_phases');
                })
                ->where(function($phaseCheck) {
                    $phaseCheck->where('is_daily_phase', false)
                               ->orWhereNull('is_daily_phase')
                               ->orWhere('is_daily_phase', 0);
                })
                ->where(function($monthlyCheck) {
                    $monthlyCheck->where('is_monthly_phase', false)
                                 ->orWhereNull('is_monthly_phase')
                                 ->orWhere('is_monthly_phase', 0);
                });
            })
            // Daily phases
            ->orWhere(function($dailyQ) {
                $dailyQ->where('is_daily_phase', true)
                       ->orWhere(function($subQ) {
                           $subQ->whereNotNull('parent_project_id')
                                ->whereNotNull('phase_day');
                       });
            })
            // Monthly phases
            ->orWhere(function($monthlyQ) {
                $monthlyQ->where('is_monthly_phase', true)
                         ->orWhere(function($subQ) {
                             $subQ->whereNotNull('parent_project_id')
                                  ->whereNotNull('month_number');
                         });
            });
        });

        // ✅ المراحل اليومية فقط: إظهار المستحقة حتى اليوم (لا إخفاء اليوم السابق إذا لم يُنفّذ)
        $query->where(function($q) use ($today) {
            $q->where(function($notDaily) {
                $notDaily->where('is_daily_phase', false)
                         ->orWhereNull('is_daily_phase')
                         ->orWhere('is_daily_phase', 0);
            })
            ->orWhere(function($dailyDue) use ($today) {
                $dailyDue->where(function($d) {
                    $d->where('is_daily_phase', true)
                      ->orWhere(function($sub) {
                          $sub->whereNotNull('parent_project_id')->whereNotNull('phase_day');
                      });
                })
                ->where(function($due) use ($today) {
                    $due->whereNull('execution_date')
                        ->orWhereDate('execution_date', '<=', $today);
                });
            });
        });

        // Status filter
        if ($request->has('status') && $request->status !== 'all' && $request->status !== '') {
            if (is_array($request->status)) {
                $query->whereIn('status', $request->status);
            } else {
                $query->where('status', $request->status);
            }
        }
        
        // ✅ إخفاء المشاريع المنتهية من مدير المشاريع
        $query->where('status', '!=', self::STATUS_COMPLETED);
        
        // ✅ استبعاد مشاريع الكفالات من project_manager (لا يراها)
        // مشاريع الكفالات: project_type = 'الكفالات' AND subcategory = 'كفالة أيتام'
        $query->where(function($q) {
            $q->where('project_type', '!=', 'الكفالات')
              ->orWhereNull('project_type')
              ->orWhereDoesntHave('subcategory', function($subQ) {
                  $subQ->where(function($nameQ) {
                      $nameQ->where('name_ar', 'كفالة أيتام')
                            ->orWhere('name', 'Orphan Sponsorship');
                  });
              });
        });
    }

    /**
     * Apply media manager filters
     */
    private function applyMediaManagerFilters(Builder $query, Request $request): void
    {
        $query->where(function($q) {
            $q->where(function($subQ) {
                $subQ->where('is_divided_into_phases', false)
                     ->orWhereNull('is_divided_into_phases');
            })->orWhere('is_daily_phase', true);
        });

        // Status filter
        if ($request->has('status') && $request->status === self::STATUS_ASSIGNED_TO_RESEARCHER) {
            // ✅ عند البحث المحدد عن "مسند لباحث"، نعرض فقط المشاريع التي ليس لها مصور
            $query->where('status', self::STATUS_ASSIGNED_TO_RESEARCHER)
                  ->whereNull('assigned_photographer_id');
        } elseif ($request->has('status') && $request->status !== 'all' && $request->status !== 'الكل' && $request->status !== '') {
            // ✅ إذا تم تحديد status محدد (غير all)، نستخدمه مباشرة
            if (is_array($request->status)) {
                $query->whereIn('status', $request->status);
            } else {
                $query->where('status', $request->status);
            }
        } else {
            // ✅ عند عدم تحديد status أو status = 'all'، نعرض جميع الحالات المطلوبة لمدير الإعلام
            // ✅ إضافة جميع الحالات المطلوبة: مسند لباحث، جاهز للتنفيذ، تم اختيار المخيم، قيد التنفيذ، تم التنفيذ، في المونتاج، تم المونتاج، معاد مونتاجه، وصل للمتبرع
            $allowedStatuses = [
                self::STATUS_ASSIGNED_TO_RESEARCHER,   // مسند لباحث - ✅ إضافته
                self::STATUS_READY,                     // جاهز للتنفيذ
                'تم اختيار المخيم',                     // تم اختيار المخيم
                self::STATUS_EXECUTING,                 // قيد التنفيذ
                self::STATUS_EXECUTED,                  // تم التنفيذ
                self::STATUS_MONTAGE,                   // في المونتاج
                self::STATUS_MONTAGE_COMPLETED,         // تم المونتاج
                self::STATUS_MONTAGE_REDO,              // يجب إعادة المونتاج
                'معاد مونتاجه',                         // معاد مونتاجه
                self::STATUS_DELIVERED                  // وصل للمتبرع
            ];
            
            $query->whereIn('status', $allowedStatuses)
                  ->where('status', '!=', self::STATUS_COMPLETED);
        }

        // Montage status filter
        if ($request->has('montage_status') && $request->montage_status) {
            $query->where('status', $request->montage_status);
        }

        // Project type filter
        if ($request->has('project_type') && $request->project_type && $request->project_type !== 'all' && $request->project_type !== 'الكل') {
            if (is_array($request->project_type)) {
                $query->whereIn('project_type', $request->project_type);
            } else {
                $query->where('project_type', $request->project_type);
            }
        }

        // Execution date filters
        if ($request->has('execution_date_from') && $request->execution_date_from) {
            $query->where('execution_date', '>=', $request->execution_date_from);
        }
        if ($request->has('execution_date_to') && $request->execution_date_to) {
            $query->where('execution_date', '<=', $request->execution_date_to);
        }

        // Priority filter
        if ($request->has('priority_only') && $request->priority_only) {
            $query->montageDelayed();
        }
    }

    /**
     * Apply executed projects coordinator filters
     */
    private function applyExecutedProjectsCoordinatorFilters(Builder $query, Request $request): void
    {
        $includeNonDivided = $request->boolean('include_non_divided', false);
        $includeDailyPhases = $request->boolean('include_daily_phases', true);
        $includeMonthlyPhases = $request->boolean('include_monthly_phases', true);

        $executedStatuses = [
            self::STATUS_EXECUTED,
            'منفذ',
            self::STATUS_MONTAGE,
            self::STATUS_MONTAGE_COMPLETED,
            'معاد مونتاجه',
            self::STATUS_DELIVERED
        ];
        $executionStatuses = [
            self::STATUS_READY,
            'تم اختيار المخيم',
            self::STATUS_EXECUTING
        ];

        $requestedStatuses = [];
        if ($request->has('status') && in_array($request->status, $executedStatuses)) {
            $requestedStatuses = [$request->status];
        } elseif ($request->has('include_executed') && $request->include_executed) {
            $requestedStatuses = $executedStatuses;
        } else {
            $requestedStatuses = $executionStatuses;
        }

        $query->where(function($q) use ($includeNonDivided, $includeDailyPhases, $includeMonthlyPhases) {
            $hasCondition = false;
            
            if ($includeNonDivided) {
                $q->where(function($nonDividedQ) {
                    $nonDividedQ->where('is_divided_into_phases', false)
                                 ->orWhereNull('is_divided_into_phases');
                });
                $hasCondition = true;
            }
            
            if ($includeDailyPhases) {
                if ($hasCondition) {
                    $q->orWhere('is_daily_phase', true);
                } else {
                    $q->where('is_daily_phase', true);
                }
                $hasCondition = true;
            }
            
            if ($includeMonthlyPhases) {
                if ($hasCondition) {
                    $q->orWhere('is_monthly_phase', true);
                } else {
                    $q->where('is_monthly_phase', true);
                }
            }
        });

        $query->whereIn('status', $requestedStatuses);
    }

    /**
     * Apply orphan sponsor coordinator filters — Backend مصدر الحقيقة، الفرونت يعرض فقط ما يرجعه الـ API.
     *
     * 1) Scope: project_type = 'الكفالات'
     * 2) لا نعرض المشروع الأب المقسم شهرياً؛ نعرض فقط الفرعيات الشهرية للشهر الحالي (أو fallback).
     * 3) المشاريع غير المقسمة: parent_project_id IS NULL وليست يومية/شهرية.
     * 4) Fallback: parent موجود و phase_start_date NULL ⇒ child.month_start_date ضمن الشهر الحالي فقط.
     * 5) الحالة: قائمة مسموحة أو status من الطلب؛ استبعاد 'منتهي'.
     */
    private function applyOrphanSponsorCoordinatorFilters(Builder $query, Request $request): void
    {
        $timezone = config('app.timezone', 'UTC');
        $now = Carbon::now($timezone);
        $nowMonthStart = $now->copy()->startOfMonth()->format('Y-m-d');
        $monthStart = $now->copy()->startOfMonth()->format('Y-m-d');
        $monthEnd = $now->copy()->endOfMonth()->format('Y-m-d');

        $query->leftJoin(
            'project_proposals as parent_proposals',
            'parent_proposals.id',
            '=',
            'project_proposals.parent_project_id'
        );

        // 1) Scope أساسي: الكفالات فقط
        $query->where('project_proposals.project_type', 'الكفالات');

        // 2+3+4) نوع الصف: إما غير مقسم، أو فرعي شهري (شهر حالي أو fallback)
        $query->where(function ($scopeQ) use ($nowMonthStart, $monthStart, $monthEnd) {

            // 3) المشاريع غير المقسمة
            $scopeQ->where(function ($nonDivided) {
                $nonDivided->whereNull('project_proposals.parent_project_id')
                    ->where(function ($q) {
                        $q->where('project_proposals.is_divided_into_phases', false)
                          ->orWhereNull('project_proposals.is_divided_into_phases');
                    })
                    ->where(function ($q) {
                        $q->where('project_proposals.is_monthly_phase', false)
                          ->orWhereNull('project_proposals.is_monthly_phase')
                          ->orWhere('project_proposals.is_monthly_phase', 0);
                    })
                    ->where(function ($q) {
                        $q->where('project_proposals.is_daily_phase', false)
                          ->orWhereNull('project_proposals.is_daily_phase')
                          ->orWhere('project_proposals.is_daily_phase', 0);
                    })
                    ->whereNull('project_proposals.month_number')
                    ->whereNull('project_proposals.phase_day');
            })

            // 2) المراحل الشهرية: فقط الشهر الحالي من منظور المشروع
            ->orWhere(function ($monthlyChild) use ($nowMonthStart, $monthStart, $monthEnd) {

                $monthlyChild->whereNotNull('project_proposals.parent_project_id')
                    ->where(function ($monthBranch) use ($nowMonthStart, $monthStart, $monthEnd) {

                        // عند وجود phase_start_date
                        $monthBranch->where(function ($hasPhaseStart) use ($nowMonthStart) {
                            $hasPhaseStart->whereNotNull('parent_proposals.id')
                                ->whereNotNull('parent_proposals.phase_start_date')
                                ->whereRaw(
                                    "DATE_FORMAT(parent_proposals.phase_start_date, '%Y-%m-01') <= ?",
                                    [$nowMonthStart]
                                )
                                ->whereRaw(
                                    "project_proposals.month_number = ((YEAR(?) - YEAR(parent_proposals.phase_start_date)) * 12 + (MONTH(?) - MONTH(parent_proposals.phase_start_date)) + 1)",
                                    [$nowMonthStart, $nowMonthStart]
                                );
                        })

                        // Fallback: parent موجود و phase_start_date NULL
                        ->orWhere(function ($fallback) use ($monthStart, $monthEnd) {
                            $fallback->whereNotNull('parent_proposals.id')
                                ->whereNull('parent_proposals.phase_start_date')
                                ->whereBetween('project_proposals.month_start_date', [$monthStart, $monthEnd]);
                        });
                    });
            });
        }); // إغلاق where(function($scopeQ)...)

        // select بعد الـ join
        $selectFields = $this->getSelectFields();
        $projectProposalColumns = array_map(
            function ($f) {
                return "project_proposals.{$f}";
            },
            $selectFields
        );
        $query->select($projectProposalColumns);

        // 5) الحالة: طلب محدد أو قائمة مسموحة؛ استبعاد منتهي
        $allowedStatuses = [
            'جديد',
            'قيد التوريد',
            'تم التوريد',
            'مسند لباحث',
            'جاهز للتنفيذ',
            'قيد التنفيذ',
            'تم التنفيذ',
            'في المونتاج',
            'تم المونتاج',
            'وصل للمتبرع'
        ];

        if ($request->filled('status') && !in_array($request->status, ['all', 'الكل'], true)) {
            if (is_array($request->status)) {
                $query->whereIn('project_proposals.status', $request->status);
            } else {
                $query->where('project_proposals.status', $request->status);
            }
        } else {
            $query->whereIn('project_proposals.status', $allowedStatuses);
        }

        $query->where('project_proposals.status', '!=', self::STATUS_COMPLETED);

        if (app()->environment('local')) {
            Log::debug('🔍 Orphan Sponsor Coordinator - Applied filters', [
                'sql' => $query->toSql(),
                'bindings' => $query->getBindings(),
            ]);
        }
    }

    /**
     * Check if project is a sponsorship project (يدعم object أو array أو null).
     * يجب أن يكون: project_type = 'الكفالات' AND subcategory = 'كفالة أيتام'
     */
    private function isSponsorshipProject($project): bool
    {
        if ($project === null) {
            return false;
        }

        $isArray = is_array($project);
        $projectType = $isArray ? ($project['project_type'] ?? null) : ($project->project_type ?? null);
        if ($projectType !== 'الكفالات') {
            return false;
        }

        $subcategoryId = $isArray ? ($project['subcategory_id'] ?? null) : ($project->subcategory_id ?? null);
        if ($subcategoryId === null || $subcategoryId === '') {
            return false;
        }

        $subcategory = $isArray ? ($project['subcategory'] ?? null) : ($project->subcategory ?? null);
        if ($subcategory === null || $subcategory === []) {
            return false;
        }

        $nameAr = is_object($subcategory) ? ($subcategory->name_ar ?? '') : ($subcategory['name_ar'] ?? '');
        $name = is_object($subcategory) ? ($subcategory->name ?? '') : ($subcategory['name'] ?? '');
        $nameAr = trim((string) $nameAr);
        $name = trim((string) $name);

        return $nameAr === 'كفالة أيتام' || strtolower($name) === 'orphan sponsorship';
    }

    /**
     * Apply admin filters
     * ✅ الإدارة ترى فقط: المشاريع الأصلية (المقسمة) + المشاريع غير المقسمة
     * ❌ لا ترى: المشاريع الفرعية (اليومية أو الشهرية)
     * 
     * 🎯 المنطق المعتمد:
     * - أي مشروع له parent_project_id ⇒ لا يظهر للإدارة
     * - أي مشروع له is_monthly_phase = true ⇒ لا يظهر للإدارة
     * - أي مشروع له is_daily_phase = true ⇒ لا يظهر للإدارة
     * - المشاريع غير المقسمة: is_divided_into_phases = false/NULL AND parent_project_id IS NULL
     * - المشاريع الأصلية المقسمة: is_divided_into_phases = true AND parent_project_id IS NULL
     * - المشاريع الفرعية (اليومية/الشهرية): تظهر عند بدء أي إجراء أو عند وصولها لمرحلة تم التوريد وما بعد
     */
    private static function getAdminVisibleSubProjectStatuses(): array
    {
        return [
            self::STATUS_SUPPLY,              // قيد التوريد - بدء إجراء
            self::STATUS_SUPPLIED,             // تم التوريد
            self::STATUS_DISTRIBUTION,         // قيد التوزيع
            self::STATUS_ASSIGNED_TO_RESEARCHER,
            self::STATUS_READY,
            self::STATUS_EXECUTING,
            self::STATUS_EXECUTED,
            self::STATUS_MONTAGE,
            self::STATUS_MONTAGE_COMPLETED,
            self::STATUS_MONTAGE_REDO,
            self::STATUS_DELIVERED,
            self::STATUS_COMPLETED,
            self::STATUS_POSTPONED,
            'تم اختيار المخيم',
            'معاد مونتاجه',
        ];
    }

    private function applyAdminFilters(Builder $query, Request $request): void
    {
        // Apply common filters first (status, project_type, etc.)
        $status = $request->get('status', 'all');
        $projectType = $request->get('project_type', 'all');

        // Status filter for admin
        if ($status !== 'all' && $status !== 'الكل' && $status !== '' && $status !== null) {
            if (is_array($status)) {
                if (!empty($status)) {
                    $query->whereIn('status', $status);
                }
            } else {
                $query->where('status', $status);
            }
        }

        // Project type filter for admin
        if ($projectType !== 'all' && $projectType !== 'الكل' && $projectType !== '' && $projectType !== null) {
            if (is_array($projectType)) {
                if (!empty($projectType)) {
                    $query->whereIn('project_type', $projectType);
                }
            } else {
                $query->where('project_type', $projectType);
            }
        }

        // ✅ عرض: المشاريع الأصلية (غير المقسمة + المقسمة) + المشاريع الفرعية عند بدء إجراء أو تم التوريد وما بعد
        $query->where(function($q) {
            // 1) المشاريع الأصلية: بدون parent وليست مرحلة يومية/شهرية
            $q->where(function($parentQ) {
                $parentQ->whereNull('parent_project_id')
                  ->where(function($subQ) {
                      $subQ->where('is_monthly_phase', false)
                           ->orWhereNull('is_monthly_phase')
                           ->orWhere('is_monthly_phase', 0);
                  })
                  ->where(function($subQ) {
                      $subQ->where('is_daily_phase', false)
                           ->orWhereNull('is_daily_phase')
                           ->orWhere('is_daily_phase', 0);
                  })
                  ->whereNull('phase_day')
                  ->whereNull('month_number');
            });
            // 2) المشاريع الفرعية (اليومية/الشهرية): تظهر عند بدء أي إجراء أو عند وصولها لمرحلة تم التوريد
            $q->orWhere(function($subProjectQ) {
                $subProjectQ->whereNotNull('parent_project_id')
                  ->where(function($phaseQ) {
                      $phaseQ->where('is_daily_phase', true)
                             ->orWhere('is_monthly_phase', true);
                  })
                  ->whereIn('status', self::getAdminVisibleSubProjectStatuses());
            });
        });

        // ✅ فلترة اختيارية: المشاريع غير المقسمة فقط أو المشاريع المقسمة فقط
        $includeNonDivided = $request->boolean('include_non_divided', true);
        $includeDividedParents = $request->boolean('include_divided_parents', true); // ✅ الافتراضي: true (نعرض المشاريع الأصلية المقسمة)

        if (!$includeNonDivided && $includeDividedParents) {
            // فقط المشاريع الأصلية المقسمة
            $query->where('is_divided_into_phases', true);
        } elseif ($includeNonDivided && !$includeDividedParents) {
            // فقط المشاريع غير المقسمة
            $query->where(function($q) {
                $q->where('is_divided_into_phases', false)
                  ->orWhereNull('is_divided_into_phases');
            });
        }
        // إذا كان كلاهما true (الافتراضي)، نعرض جميع المشاريع الأصلية (المقسمة وغير المقسمة)

        // Apply additional common filters for admin
        $searchQuery = $request->get('searchQuery', '');
        if (!empty($searchQuery)) {
            $this->applySearchFilter($query, trim($searchQuery));
        }

        // Subcategory filter
        if ($request->has('subcategory_id') && $request->subcategory_id !== null && $request->subcategory_id !== '' && $request->subcategory_id !== 'all') {
            $subcategoryId = $request->subcategory_id;
            if (is_array($subcategoryId)) {
                if (!empty($subcategoryId)) {
                    $query->whereIn('subcategory_id', $subcategoryId);
                }
            } else {
                if (is_numeric($subcategoryId)) {
                    $query->where('subcategory_id', (int) $subcategoryId);
                } else {
                    $query->where('subcategory_id', $subcategoryId);
                }
            }
        }

        // Team filter
        if ($request->has('team_id') && $request->team_id !== null && $request->team_id !== '' && $request->team_id !== 'all') {
            $teamId = $request->team_id;
            if (is_numeric($teamId)) {
                $query->where('assigned_to_team_id', (int) $teamId);
            } else {
                $query->where('assigned_to_team_id', $teamId);
            }
        }

        // Photographer filter
        if ($request->has('photographer_id') && $request->photographer_id !== null && $request->photographer_id !== '' && $request->photographer_id !== 'all') {
            $photographerId = $request->photographer_id;
            if (is_numeric($photographerId)) {
                $query->where('assigned_photographer_id', (int) $photographerId);
            } else {
                $query->where('assigned_photographer_id', $photographerId);
            }
        }

        // Researcher filter
        $researcherId = $request->get('assigned_researcher_id') ?: $request->get('researcher_id');
        if ($researcherId !== null && $researcherId !== '' && $researcherId !== 'all') {
            if (is_numeric($researcherId)) {
                $query->where('assigned_researcher_id', (int) $researcherId);
            } else {
                $query->where('assigned_researcher_id', $researcherId);
            }
        }

        // Shelter filter
        if ($request->has('shelter_id') && $request->shelter_id !== null && $request->shelter_id !== '' && $request->shelter_id !== 'all') {
            $shelterId = $request->shelter_id;
            $query->where('shelter_id', $shelterId);
        }

        // Date filters
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

        // ✅ Logging للتشخيص (فقط في بيئة التطوير)
        if (app()->environment('local')) {
            Log::debug('🔍 Admin Filters Applied', [
                'sql' => $query->toSql(),
                'bindings' => $query->getBindings(),
                'filter_description' => 'المشاريع الأصلية + الفرعية (اليومية/الشهرية) عند بدء إجراء أو تم التوريد وما بعد',
                'include_non_divided' => $includeNonDivided,
                'include_divided_parents' => $includeDividedParents
            ]);
        }
    }

    /**
     * Apply common filters (status, project type, search, dates)
     */
    private function applyCommonFilters(Builder $query, Request $request, string $userRole): void
    {
        $status = $request->get('status', 'all');
        $projectType = $request->get('project_type', 'all');
        $searchQuery = $request->get('searchQuery', '');

        // Status filter - handle array
        // ✅ Allow status filtering for all roles except where it's handled in role-specific methods
        if ($status !== 'all' && 
            $status !== 'الكل' && 
            $status !== '' && 
            $status !== null &&
            !($userRole === self::ROLE_ADMIN) &&
            !($userRole === self::ROLE_PROJECT_MANAGER) &&
            !($userRole === self::ROLE_MEDIA_MANAGER && $request->has('montage_status')) &&
            !($userRole === self::ROLE_EXECUTED_PROJECTS_COORDINATOR) &&
            !($userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR)) {
            if (is_array($status)) {
                if (!empty($status)) {
                    $query->whereIn('status', $status);
                }
            } else {
                $query->where('status', $status);
            }
        }

        // Project type filter - handle array
        // ✅ Allow project type filtering for all roles except where it's handled in role-specific methods
        if ($projectType !== 'all' && 
            $projectType !== 'الكل' && 
            $projectType !== '' && 
            $projectType !== null &&
            !($userRole === self::ROLE_ADMIN) &&
            !($userRole === self::ROLE_MEDIA_MANAGER) &&
            !($userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR)) {
            if (is_array($projectType)) {
                if (!empty($projectType)) {
                    $query->whereIn('project_type', $projectType);
                }
            } else {
                $query->where('project_type', $projectType);
            }
        }

        // Search filter
        // ✅ Skip for admin - applyAdminFilters already handles search
        if (!empty($searchQuery) && $userRole !== self::ROLE_ADMIN) {
            $this->applySearchFilter($query, trim($searchQuery));
        }

        // ✅ Skip subcategory, team, photographer, researcher, shelter, date filters for admin
        // ✅ applyAdminFilters already handles all of these to avoid duplicate WHERE clauses
        if ($userRole === self::ROLE_ADMIN) {
            return;
        }

        // Subcategory filter (التفريعات - التصنيفات الفرعية) - handle array
        if ($request->has('subcategory_id') && $request->subcategory_id !== null && $request->subcategory_id !== '' && $request->subcategory_id !== 'all') {
            $subcategoryId = $request->subcategory_id;
            if (is_array($subcategoryId)) {
                if (!empty($subcategoryId)) {
                    $query->whereIn('subcategory_id', $subcategoryId);
                }
            } else {
                // دعم القيم الرقمية والنصية
                if (is_numeric($subcategoryId)) {
                    $query->where('subcategory_id', (int) $subcategoryId);
                } else {
                    $query->where('subcategory_id', $subcategoryId);
                }
            }
        }

        // Team filter (team_id or assigned_to_team_id)
        if ($request->has('team_id') && $request->team_id !== null && $request->team_id !== '' && $request->team_id !== 'all') {
            $teamId = $request->team_id;
            // دعم القيم الرقمية والنصية
            if (is_numeric($teamId)) {
                $query->where('assigned_to_team_id', (int) $teamId);
            } else {
                $query->where('assigned_to_team_id', $teamId);
            }
        }

        // Photographer filter
        if ($request->has('photographer_id') && $request->photographer_id !== null && $request->photographer_id !== '' && $request->photographer_id !== 'all') {
            $photographerId = $request->photographer_id;
            // دعم القيم الرقمية والنصية
            if (is_numeric($photographerId)) {
                $query->where('assigned_photographer_id', (int) $photographerId);
            } else {
                $query->where('assigned_photographer_id', $photographerId);
            }
        }

        // Researcher filter (فلترة بالباحث - لصفحة المشاريع الجديدة لمدير الإعلام وغيرها)
        $researcherId = $request->get('assigned_researcher_id') ?: $request->get('researcher_id');
        if ($researcherId !== null && $researcherId !== '' && $researcherId !== 'all') {
            if (is_numeric($researcherId)) {
                $query->where('assigned_researcher_id', (int) $researcherId);
            } else {
                $query->where('assigned_researcher_id', $researcherId);
            }
        }

        // Shelter filter
        if ($request->has('shelter_id') && $request->shelter_id !== null && $request->shelter_id !== '' && $request->shelter_id !== 'all') {
            $shelterId = $request->shelter_id;
            // دعم القيم الرقمية والنصية (shelter_id هو manager_id_number في جدول shelters)
            $query->where('shelter_id', $shelterId);
        }

        // Date filters (تاريخ الإدخال - created_at)
        // دعم معاملات التقارير: start_date/end_date وبدائلهما created_at_start/created_at_end، بالإضافة إلى created_from/created_to
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
        // ✅ مدير المشاريع: لا نطبّق execution_date_from حتى تظهر المراحل اليومية المستحقة سابقاً (مثل اليوم 1 بحالة "جديد")
        if ($request->filled('execution_date_from') && $userRole !== self::ROLE_PROJECT_MANAGER) {
            $query->whereDate('execution_date', '>=', $request->execution_date_from);
        }
        if ($request->filled('execution_date_to')) {
            $query->whereDate('execution_date', '<=', $request->execution_date_to);
        }
    }

    /**
     * Apply search filter with full-text search support
     */
    private function applySearchFilter(Builder $query, string $search): void
    {
        if (strlen($search) < 1) {
            return;
        }

        try {
            // Check for full-text index availability
            $hasFulltext = \Cache::remember('has_fulltext_index_pp', 3600, function() {
                try {
                    $indexes = \DB::select("SHOW INDEX FROM project_proposals WHERE Index_type = 'FULLTEXT'");
                    return !empty($indexes);
                } catch (\Exception $e) {
                    return false;
                }
            });
            
            // Use full-text search if available and search term is long enough
            if ($hasFulltext && strlen($search) >= 3) {
                $query->where(function($q) use ($search) {
                    $q->whereRaw("MATCH(project_name, project_description, donor_name, donor_code) AGAINST(? IN BOOLEAN MODE)", [$search])
                      ->orWhere('serial_number', 'LIKE', "%{$search}%")
                      ->orWhere('internal_code', 'LIKE', "%{$search}%");
                });
            } else {
                // Fallback to LIKE search
                $this->applyLikeSearch($query, $search);
            }
        } catch (\Exception $e) {
            Log::warning('Full-text search failed', ['error' => $e->getMessage()]);
            $this->applyLikeSearch($query, $search);
        }
    }

    /**
     * Apply LIKE search fallback
     */
    private function applyLikeSearch(Builder $query, string $search): void
    {
        $query->where(function($q) use ($search) {
            $q->where('serial_number', 'LIKE', "%{$search}%")
              ->orWhere('internal_code', 'LIKE', "%{$search}%")
              ->orWhere('project_name', 'LIKE', "%{$search}%")
              ->orWhere('project_description', 'LIKE', "%{$search}%")
              ->orWhere('donor_name', 'LIKE', "%{$search}%")
              ->orWhere('donor_code', 'LIKE', "%{$search}%");
        });
    }

    /**
     * Load relationships based on user role
     * ✅ تم التحسين: استخدام Eager Loading الذكي لتجنب N+1 Queries
     * ✅ إصلاح: تحميل جميع العلاقات الأساسية لجميع الأدوار لعرض البيانات بشكل كامل
     */
    private function loadRelationships(Builder $query, string $userRole, Request $request): void
    {
        // ✅ تحسين الأداء: للطلبات الكبيرة (التقارير) نحمل فقط العلاقات الأساسية للحسابات
        // هذا يمنع تجاوز حد الذاكرة (134MB) عند جلب آلاف المشاريع مع جميع العلاقات
        $perPage = (int) $request->query('per_page', $request->query('perPage', 15));
        $isReportMode = $request->has('_report') || $perPage > 2000;

        if ($isReportMode) {
            // ✅ وضع التقارير: فقط العلاقات الضرورية للحسابات المالية والإحصائيات
            $query->with([
                'currency:id,currency_code,currency_name_ar,exchange_rate_to_usd',
                'assignedToTeam:id,team_name,team_leader_name',
                'subcategory:id,name_ar,name',
                'assignedResearcher:id,name',
                'photographer:id,name',
                'shelter' => function($q) {
                    $q->select('manager_id_number', 'camp_name', 'governorate', 'district');
                },
            ]);
            return;
        }

        // ✅ العلاقات الأساسية (مطلوبة دائماً لجميع الأدوار)
        $withRelations = [
            // Currency - مطلوب لجميع المشاريع
            'currency:id,currency_code,currency_name_ar,exchange_rate_to_usd',
            
            // ✅ إصلاح: تحميل جميع العلاقات الأساسية لجميع الأدوار
            // Researcher & Photographer - ضروري لعرض معلومات المشروع كاملة
            // ✅ إصلاح: team_personnel لا يحتوي على email
            'assignedResearcher:id,name,phone_number',
            'photographer:id,name,phone_number',
            
            // Team - ضروري لعرض معلومات الفريق
            'assignedToTeam:id,team_name,team_leader_name',
            
            // Montage Producer - مطلوب لجميع الأدوار
            // ✅ User يحتوي على email (ليس TeamPersonnel)
            'assignedMontageProducer:id,name,phone_number,email',
            
            // Shelter & Subcategory - ضروري لعرض معلومات المخيم والتصنيف
            // ✅ إصلاح: استخدام closure لتحديد select بشكل صحيح (جدول shelters لا يحتوي على id أو name)
            'shelter' => function($query) {
                $query->select('manager_id_number', 'camp_name', 'governorate', 'district');
            },
            'subcategory:id,name_ar,name',
            
            // Creator - ضروري لعرض من أنشأ المشروع
            'creator:id,name,phone_number',
            
            // Assigned By - ضروري لعرض من أسند المشروع
            'assignedBy:id,name',
        ];

        // ✅ تحسين الأداء: جلب parentProject بشكل مشروط (فقط للمشاريع الفرعية)
        // استخدام eager loading لتجنب N+1 queries
        if (in_array($userRole, ['project_manager', 'media_manager', 'executed_projects_coordinator', 'admin', 'orphan_sponsor_coordinator'])) {
            // ✅ جلب parentProject فقط للمشاريع التي لها parent_project_id
            // هذا يمنع N+1 queries عند عرض المشاريع الفرعية
            $withRelations[] = 'parentProject:id,serial_number,project_name,donor_code,internal_code,project_type,currency_id,is_divided_into_phases,phase_type,total_months,phase_duration_days,phase_start_date,subcategory_id';
            $withRelations[] = 'parentProject.currency:id,currency_code,currency_name_ar';
            // ✅ جلب subcategory من parentProject لمنسق الكفالات (للمشاريع الفرعية)
            if ($userRole === 'orphan_sponsor_coordinator') {
                $withRelations[] = 'parentProject.subcategory:id,name_ar,name';
            }
        }

        // ✅ جلب الأيتام المكفولين لمنسق الكفالة والإدارة
        // ✅ تحسين الأداء: إضافة limit لتجنب تحميل آلاف الأيتام
        if (in_array($userRole, ['orphan_sponsor_coordinator', 'admin', 'executed_projects_coordinator'])) {
            $withRelations['sponsoredOrphans'] = function($q) {
                $q->select('orphan_id_number', 'orphan_full_name', 'orphan_birth_date', 'orphan_gender')
                  ->limit(100); // ✅ حد أقصى 100 يتيم لكل مشروع
            };
        }

        // ✅ تحسين الأداء: جلب phases فقط عند الطلب صراحة
        // هذا يمنع تحميل بيانات غير ضرورية (قد تكون آلاف المشاريع الفرعية)
        if (($userRole === 'admin' || $userRole === 'project_manager') && $request->get('include_phases', false)) {
            // ✅ Daily Phases مع limit لتجنب بطء الاستعلام
            $withRelations['dailyPhases'] = function($q) {
                $q->select('id', 'parent_project_id', 'serial_number', 'project_name', 'donor_code', 'internal_code', 'status', 'phase_day', 'execution_date', 'net_amount', 'currency_id')
                  ->with('currency:id,currency_code,currency_name_ar')
                  ->orderBy('phase_day', 'ASC')
                  ->limit(100); // ✅ حد أقصى 100 مشروع يومي لكل مشروع أصلي
            };
            
            // ✅ Monthly Phases مع limit لتجنب بطء الاستعلام
            $withRelations['monthlyPhases'] = function($q) {
                $q->select('id', 'parent_project_id', 'serial_number', 'project_name', 'donor_code', 'internal_code', 'status', 'month_number', 'month_start_date', 'execution_date', 'net_amount', 'currency_id')
                  ->with('currency:id,currency_code,currency_name_ar')
                  ->orderBy('month_number', 'ASC')
                  ->limit(100); // ✅ حد أقصى 100 مشروع شهري لكل مشروع أصلي
            };
        }

        // ✅ تطبيق Eager Loading على الـ Query
        $query->with($withRelations);
    }

    /**
     * Apply sorting
     */
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

    /**
     * Build simplified query for timeout fallback
     */
    private function buildSimplifiedQuery(Request $request, User $user, string $userRole): Builder
    {
        // ✅ إضافة الحقول الأساسية المطلوبة لتجنب NULL في النتائج
        $query = ProjectProposal::select([
            'id', 'serial_number', 'project_name', 'donor_code', 'internal_code', 'project_type', 'status', 
            'is_daily_phase', 'is_divided_into_phases', 'execution_date', 'created_at', 'updated_at',
            // ✅ الحقول الأساسية المطلوبة
            'donor_name', 'project_description',
            'donation_amount', 'net_amount', 'amount_in_usd', 'currency_id',
            'admin_discount_percentage', 'discount_amount',
            'shekel_exchange_rate', 'net_amount_shekel',
            'shekel_converted_at', 'shekel_converted_by',
            'quantity', 'beneficiaries_count', 'beneficiaries_per_unit',
            'unit_cost', 'supply_cost', 'surplus_amount', 'has_deficit', 'is_urgent',
            'estimated_duration_days', 'shelter_id',
            'assigned_to_team_id', 'assigned_researcher_id', 'assigned_photographer_id',
            'assigned_montage_producer_id', 'assigned_by',
            // ✅ إضافة notes_image و project_image للتحميل
            'notes_image', 'project_image',
            // ✅ إضافة subcategory_id للفلترة
            'subcategory_id',
        ])
        ->with([
            'currency:id,currency_code,currency_name_ar,exchange_rate_to_usd',
            // ✅ إصلاح: استخدام closure لتحديد select بشكل صحيح (جدول shelters لا يحتوي على id أو name)
            'shelter' => function($query) {
                $query->select('manager_id_number', 'camp_name', 'governorate', 'district');
            },
            // ✅ إضافة subcategory للفلترة
            'subcategory:id,name_ar,name',
        ])
        ->orderBy('created_at', 'DESC');

        // Apply basic role filters
        if ($userRole === self::ROLE_PROJECT_MANAGER) {
            $this->applyProjectManagerFilters($query, $request);
        } elseif ($userRole === self::ROLE_MEDIA_MANAGER) {
            $this->applyMediaManagerFilters($query, $request);
        } elseif ($userRole === self::ROLE_EXECUTED_PROJECTS_COORDINATOR) {
            $this->applyExecutedProjectsCoordinatorFilters($query, $request);
        } elseif ($userRole === self::ROLE_ADMIN) {
            // ✅ تطبيق فلتر الإدارة في simplified query أيضاً
            $this->applyAdminFilters($query, $request);
        } elseif ($userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR) {
            $this->applyOrphanSponsorCoordinatorFilters($query, $request);
        }

        return $query;
    }

    /**
     * Process projects after fetching
     */
    private function processProjects(array $projects, string $userRole): array
    {
        $today = Carbon::today();
        $currentMonthStart = $today->copy()->startOfMonth();
        $currentMonthEnd = $today->copy()->endOfMonth();

        return collect($projects)->map(function ($project) use ($userRole, $today, $currentMonthStart, $currentMonthEnd) {
            $isArray = is_array($project);
            $isDailyPhase = $isArray ? ($project['is_daily_phase'] ?? false) : ($project->is_daily_phase ?? false);
            $isMonthlyPhase = $isArray ? ($project['is_monthly_phase'] ?? false) : ($project->is_monthly_phase ?? false);

            // Add parent project info for phases
            if (($isDailyPhase || $isMonthlyPhase) && !$isArray && !$project->relationLoaded('parentProject') && $project->parent_project_id) {
                $parentProject = ProjectProposal::select([
                    'id', 'serial_number', 'project_name', 'donor_code', 
                    'internal_code', 'project_type', 'currency_id', 
                    'is_divided_into_phases', 'phase_type', 'total_months', 
                    'phase_duration_days', 'phase_start_date'
                ])
                ->with('currency:id,currency_code,currency_name_ar')
                ->find($project->parent_project_id);
                
                if ($parentProject) {
                    $project->setRelation('parentProject', $parentProject);
                }
            }

            // Add filter info for monthly phases
            if ($isMonthlyPhase) {
                $monthStartDate = $isArray ? ($project['month_start_date'] ?? null) : ($project->month_start_date ?? null);
                $executionDate = $isArray ? ($project['execution_date'] ?? null) : ($project->execution_date ?? null);
                $monthNumber = $isArray ? ($project['month_number'] ?? null) : ($project->month_number ?? null);
                
                $filterInfo = [
                    'has_month_start_date' => !empty($monthStartDate),
                    'has_execution_date' => !empty($executionDate),
                    'month_start_date' => $monthStartDate,
                    'execution_date' => $executionDate,
                    'month_number' => $monthNumber,
                    'current_month_start' => $currentMonthStart->format('Y-m-d'),
                    'current_month_end' => $currentMonthEnd->format('Y-m-d'),
                ];
                
                if (!$isArray) {
                    $filterInfo['is_in_current_month'] = $this->isMonthlyPhaseInCurrentMonth($project, $currentMonthStart, $currentMonthEnd);
                }
                
                if ($isArray) {
                    $project['filter_info'] = $filterInfo;
                } else {
                    $project->filter_info = $filterInfo;
                }
            }

            // Add filter info for daily phases
            if ($isDailyPhase) {
                $threeDaysLater = $today->copy()->addDays(3);
                $phaseDay = $isArray ? ($project['phase_day'] ?? null) : ($project->phase_day ?? null);
                $executionDate = $isArray ? ($project['execution_date'] ?? null) : ($project->execution_date ?? null);
                
                $filterInfo = [
                    'has_phase_day' => !empty($phaseDay),
                    'phase_day' => $phaseDay,
                    'has_execution_date' => !empty($executionDate),
                    'execution_date' => $executionDate,
                    'today' => $today->format('Y-m-d'),
                    'three_days_later' => $threeDaysLater->format('Y-m-d'),
                ];
                
                if (!$isArray) {
                    $filterInfo['is_in_window'] = $this->isDailyPhaseInWindow($project, $today, $threeDaysLater);
                }
                
                if ($isArray) {
                    $project['filter_info'] = $filterInfo;
                } else {
                    $project->filter_info = $filterInfo;
                }
            }

            // إضافة معالجة صريحة للعلاقات لضمان ظهورها في Frontend
            if (!$isArray) {
                $this->addProjectRelationships($project);
            }

            // ✅ تحويل لـ array مع الاحتفاظ بجميع البيانات والعلاقات
            if (!$isArray) {
                // ✅ دمج attributes مع العلاقات والـ appends
                // ✅ استخدام getAttributes() أولاً ثم toArray() لضمان جلب جميع الحقول
                $projectAttributes = $project->getAttributes(); // ✅ الحقول الأساسية من قاعدة البيانات
                $projectRelations = $project->toArray(); // ✅ العلاقات والـ appends
                $projectArray = array_merge($projectAttributes, $projectRelations);
                
                // ✅ جلب الحقول الأساسية مباشرة من الـ model باستخدام accessors
                // هذا يضمن جلب القيم حتى لو كانت null
                
                // ✅ للمشاريع الشهرية الفرعية: إذا لم يكن project_type موجوداً، نأخذه من parent_project
                $projectType = $project->project_type;
                if (empty($projectType) && $project->parent_project_id && $project->parentProject) {
                    $projectType = $project->parentProject->project_type ?? null;
                }
                
                $essentialFields = [
                    // ✅ الحقول الأساسية للمشروع
                    'donor_name' => $project->donor_name,
                    'project_description' => $project->project_description,
                    'project_type' => $projectType, // ✅ إضافة project_type لضمان إرساله مع البيانات (من المشروع أو من parent_project)
                    'donation_amount' => $project->donation_amount,
                    'net_amount' => $project->net_amount,
                    'amount_in_usd' => $project->amount_in_usd,
                    'estimated_duration_days' => $project->estimated_duration_days,
                    'quantity' => $project->quantity,
                    'beneficiaries_count' => $project->beneficiaries_count,
                    'beneficiaries_per_unit' => $project->beneficiaries_per_unit,
                    'unit_cost' => $project->unit_cost,
                    'supply_cost' => $project->supply_cost,
                    'surplus_amount' => $project->surplus_amount,
                    'has_deficit' => $project->has_deficit,
                    'is_urgent' => $project->is_urgent,
                    'discount_amount' => $project->discount_amount,
                    'admin_discount_percentage' => $project->admin_discount_percentage,
                    'shekel_exchange_rate' => $project->shekel_exchange_rate,
                    'net_amount_shekel' => $project->net_amount_shekel,
                    'shekel_converted_at' => $project->shekel_converted_at,
                    'shekel_converted_by' => $project->shekel_converted_by,
                    // ✅ إضافة notes_image و notes_image_url لضمان ظهورها في القائمة
                    // notes_image تستخدم الآن أول صورة من noteImages (إن وُجدت) أو القيمة القديمة للتوافق
                    'notes_image' => $project->notes_image_path,
                    'notes_image_url' => $project->notes_image_url,
                    'notes_image_download_url' => $project->notes_image_download_url,
                    'project_image' => $project->project_image,
                    'project_image_url' => $project->project_image_url,
                    // ✅ إضافة subcategory_id و subcategory لضمان ظهوره في الاستجابة للفلترة
                    'subcategory_id' => $project->subcategory_id,
                    'subcategory' => $project->subcategory ? [
                        'id' => $project->subcategory->id,
                        'name_ar' => $project->subcategory->name_ar ?? null,
                        'name' => $project->subcategory->name ?? null,
                    ] : null,
                    // ✅ إضافة حقول المشاريع الشهرية: month_number, month_start_date, is_monthly_phase
                    'month_number' => $project->month_number ?? null,
                    'month_start_date' => $project->month_start_date ?? null,
                    'is_monthly_phase' => $project->is_monthly_phase ?? false,
                    // ✅ إضافة حقول المشاريع اليومية: phase_day, is_daily_phase
                    'phase_day' => $project->phase_day ?? null,
                    'is_daily_phase' => $project->is_daily_phase ?? false,
                    // ✅ إضافة parent_project_id للمشاريع الفرعية
                    'parent_project_id' => $project->parent_project_id ?? null,
                    // ✅ إضافة currency إذا كانت محملة
                    'currency' => $project->currency ? [
                        'id' => $project->currency->id,
                        'currency_code' => $project->currency->currency_code ?? null,
                        'currency_name_ar' => $project->currency->currency_name_ar ?? null,
                        'exchange_rate_to_usd' => $project->currency->exchange_rate_to_usd ?? null,
                    ] : null,
                    // ✅ إضافة shelter إذا كانت محملة
                    'shelter' => $project->shelter ? [
                        'manager_id_number' => $project->shelter->manager_id_number ?? null,
                        'camp_name' => $project->shelter->camp_name ?? null,
                        'governorate' => $project->shelter->governorate ?? null,
                        'district' => $project->shelter->district ?? null,
                    ] : null,
                ];
                
                // ✅ دمج الحقول الأساسية مع البيانات الأخرى
                // نضع $essentialFields أولاً ثم $projectArray لتجنب استبدال القيم الموجودة
                // ✅ استخدام array_merge مع essentialFields أولاً لضمان أن القيم الصحيحة لها الأولوية
                $merged = array_merge($projectArray, $essentialFields);
                
                // ✅ التأكد من أن جميع الحقول من essentialFields موجودة (حتى لو كانت null)
                foreach ($essentialFields as $key => $value) {
                    $merged[$key] = $value;
                }
                
                return $merged;
            }

            return $project;
        })->toArray();
    }

    /**
     * Build response data
     */
    private function buildResponseData($projects, array $projectsItems, string $userRole, int $cacheTime, bool $usedSimplifiedQuery = false): array
    {
        // ✅ Logging فقط في بيئة التطوير لتسريع الاستجابة
        if ($userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR && app()->environment('local')) {
            $currentMonth = (int) Carbon::now(config('app.timezone'))->month;
            $monthlyPhasesInResponse = collect($projectsItems)->filter(function($p) {
                return ($p['is_monthly_phase'] ?? false) === true;
            });
            
            // ✅ التحقق من أن جميع المشاريع الشهرية هي للشهر الحالي
            $monthlyPhasesByMonth = $monthlyPhasesInResponse->map(function($p) {
                return $p['month_number'] ?? null;
            })->filter()->groupBy(function($month) {
                return $month;
            })->map->count();
            
            Log::debug('🔍 Orphan Sponsor Coordinator - Building response', [
                'total_projects_in_response' => count($projectsItems),
                'monthly_phases_count' => $monthlyPhasesInResponse->count(),
                'current_month' => $currentMonth,
                'monthly_phases_by_month' => $monthlyPhasesByMonth->toArray(),
                'non_monthly_projects' => count($projectsItems) - $monthlyPhasesInResponse->count(),
                'sample_monthly_phases' => $monthlyPhasesInResponse->take(5)->map(function($p) {
                    return [
                        'id' => $p['id'] ?? null,
                        'name' => $p['project_name'] ?? null,
                        'month_number' => $p['month_number'] ?? null,
                        'is_monthly_phase' => $p['is_monthly_phase'] ?? false,
                    ];
                })->toArray(),
            ]);
            
            // ملاحظة: month_number = ترتيب الشهر في المشروع (1,2,3...) وليس رقم الشهر التقويمي
            // الفلترة تتم حسب month_number == currentProjectMonth (محسوب من phase_start_date للأب)
        }

        // ✅ Logging للتشخيص (للإدارة فقط)
        if ($userRole === self::ROLE_ADMIN && app()->environment('local')) {
            Log::debug('🔍 Admin Reports - Total Projects Calculation', [
                'total_from_pagination' => $projects->total(),
                'per_page' => $projects->perPage(),
                'current_page' => $projects->currentPage(),
                'total_pages' => $projects->lastPage(),
                'projects_in_response' => count($projectsItems),
                'used_simplified_query' => $usedSimplifiedQuery,
            ]);
        }

        $responseData = [
            'success' => true,
            'projects' => $projectsItems,
            'total' => $projects->total(), // ✅ هذا يجب أن يكون 275 بعد إصلاح الفلترة
            'currentPage' => $projects->currentPage(),
            'totalPages' => $projects->lastPage(),
            'perPage' => $projects->perPage(),
            'cache_time' => $cacheTime,
            'used_simplified_query' => $usedSimplifiedQuery, // ✅ Flag لتتبع استخدام fallback
        ];

        // Add total amount for admin and coordinator
        if (in_array($userRole, ['admin', 'executed_projects_coordinator'])) {
            $responseData['total_amount_before_discount'] = $this->calculateTotalAmount();
        }

        // Add filter info for project manager
        if ($userRole === 'project_manager') {
            $responseData['filter_info'] = $this->buildProjectManagerFilterInfo($projectsItems);
        }

        // ✅ إضافة معلومات الشهر الحالي لمنسق الكفالة
        if ($userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR) {
            $currentMonth = (int) Carbon::now(config('app.timezone'))->month;
            $getMonthNameArabic = function($monthNumber) {
                $months = [
                    1 => 'يناير', 2 => 'فبراير', 3 => 'مارس', 4 => 'أبريل',
                    5 => 'مايو', 6 => 'يونيو', 7 => 'يوليو', 8 => 'أغسطس',
                    9 => 'سبتمبر', 10 => 'أكتوبر', 11 => 'نوفمبر', 12 => 'ديسمبر',
                ];
                return $months[$monthNumber] ?? '';
            };
            
            $responseData['meta'] = [
                'current_month' => $currentMonth,
                'current_month_name' => $getMonthNameArabic($currentMonth),
                'filter_description' => 'المشاريع غير المقسمة + المشاريع الشهرية الفرعية حيث month_number = currentProjectMonth (من phase_start_date للأب)'
            ];
        }
        
        // ✅ Logging فقط في بيئة التطوير لتسريع الاستجابة
        if ($userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR && app()->environment('local')) {
            Log::debug('🔍 Orphan Sponsor Coordinator - Response built', [
                'response_total' => $responseData['total'],
                'response_projects_count' => count($responseData['projects']),
                'current_month' => $responseData['meta']['current_month'] ?? null,
                'current_month_name' => $responseData['meta']['current_month_name'] ?? null,
            ]);
        }

        return $responseData;
    }

    /**
     * Calculate total donation amount (before discount)
     * ✅ المنطق الصحيح: حساب مجموع المبلغ قبل الخصم (donation_amount * exchange_rate)
     * للمشاريع غير المقسمة + المشاريع الفرعية (اليومية والشهرية) فقط
     * استبعاد المشاريع الأصلية المقسمة من المبالغ لأنها تكرار (المبالغ موجودة في المشاريع الفرعية)
     */
    private function calculateTotalAmount(): float
    {
        return round(
            ProjectProposal::forSurplusStatistics()
                ->whereNotNull('donation_amount')
                ->whereNotNull('exchange_rate')
                ->where('donation_amount', '>', 0)
                ->where('exchange_rate', '>', 0)
                ->selectRaw('SUM(COALESCE(donation_amount, 0) * COALESCE(exchange_rate, 0)) as total')
                ->value('total') ?? 0,
            2
        );
    }

    /**
     * Build filter info for project manager
     */
    private function buildProjectManagerFilterInfo(array $projectsItems): array
    {
        $collection = collect($projectsItems);
        
        return [
            'message' => 'Backend يرجع جميع المشاريع (غير المقسمة + جميع اليومية + جميع الشهرية). Frontend يجب أن يفلترها حسب phase_day و month_start_date.',
            'non_divided_count' => $collection->filter(function($p) {
                $isDaily = is_array($p) ? ($p['is_daily_phase'] ?? false) : ($p->is_daily_phase ?? false);
                $isMonthly = is_array($p) ? ($p['is_monthly_phase'] ?? false) : ($p->is_monthly_phase ?? false);
                return !$isDaily && !$isMonthly;
            })->count(),
            'daily_phases_count' => $collection->filter(function($p) {
                return is_array($p) ? ($p['is_daily_phase'] ?? false) : ($p->is_daily_phase ?? false);
            })->count(),
            'monthly_phases_count' => $collection->filter(function($p) {
                return is_array($p) ? ($p['is_monthly_phase'] ?? false) : ($p->is_monthly_phase ?? false);
            })->count(),
        ];
    }

    /**
     * Check if monthly phase is in current month
     */
    private function isMonthlyPhaseInCurrentMonth($project, Carbon $currentMonthStart, Carbon $currentMonthEnd): bool
    {
        $monthStartDate = is_array($project) ? ($project['month_start_date'] ?? null) : ($project->month_start_date ?? null);
        if (!$monthStartDate) {
            return false;
        }

        try {
            $monthStart = Carbon::parse($monthStartDate);
            return $monthStart->between($currentMonthStart, $currentMonthEnd);
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Check if daily phase is in window
     */
    private function isDailyPhaseInWindow($project, Carbon $today, Carbon $threeDaysLater): bool
    {
        $phaseDay = is_array($project) ? ($project['phase_day'] ?? null) : ($project->phase_day ?? null);
        if (!$phaseDay) {
            return false;
        }

        try {
            $phaseDate = Carbon::parse($phaseDay);
            return $phaseDate->between($today, $threeDaysLater);
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Build cached response with proper headers
     */
    private function buildCachedResponse(array $cachedData, string $cacheKey, ?string $requestEtag, int $cacheTtl): array
    {
        $etag = md5($cacheKey . '_' . ($cachedData['cache_time'] ?? time()));
        
        // Return 304 Not Modified if ETag matches
        if ($requestEtag === $etag) {
            return ['response' => response()->json([], 304)->header('ETag', $etag)];
        }
        
        // Return cached data with headers
        return [
            'response' => response()->json($cachedData, 200)
                ->header('ETag', $etag)
                ->header('Cache-Control', 'private, max-age=' . $cacheTtl)
                ->header('X-Cache', 'HIT')
                ->header('Last-Modified', gmdate('D, d M Y H:i:s', $cachedData['cache_time'] ?? time()) . ' GMT')
        ];
    }

    /**
     * Add project relationships as separate properties for frontend
     */
    private function addProjectRelationships($project): void
    {
        // Montage Producer
        if (!isset($project->producer_name)) {
            $project->producer_name = $project->assignedMontageProducer->name ?? null;
        }
        
        // Team
        if (!isset($project->team)) {
            $project->team = $project->assignedToTeam ? [
                'id' => $project->assignedToTeam->id,
                'team_name' => $project->assignedToTeam->team_name,
                'team_leader_name' => $project->assignedToTeam->team_leader_name ?? null,
            ] : null;
        }
        
        // Photographer
        if (!isset($project->photographer_data)) {
            $project->photographer_data = $project->photographer ? [
                'id' => $project->photographer->id,
                'name' => $project->photographer->name,
                'phone_number' => $project->photographer->phone_number ?? null,
                'email' => $project->photographer->email ?? null,
            ] : null;
        }
        
        // Researcher
        if (!isset($project->researcher)) {
            $project->researcher = $project->assignedResearcher ? [
                'id' => $project->assignedResearcher->id,
                'name' => $project->assignedResearcher->name,
                'phone_number' => $project->assignedResearcher->phone_number ?? null,
                'email' => $project->assignedResearcher->email ?? null,
            ] : null;
        }
        
        // Montage Producer (detailed)
        if (!isset($project->montage_producer)) {
            $project->montage_producer = $project->assignedMontageProducer ? [
                'id' => $project->assignedMontageProducer->id,
                'name' => $project->assignedMontageProducer->name,
                'phone_number' => $project->assignedMontageProducer->phone_number ?? null,
                'email' => $project->assignedMontageProducer->email ?? null,
            ] : null;
        }
        
        // Shelter
        if (!isset($project->shelter_data)) {
            $project->shelter_data = $project->shelter ? [
                'manager_id_number' => $project->shelter->manager_id_number,
                'camp_name' => $project->shelter->camp_name,
                'name' => $project->shelter->name ?? null,
                'governorate' => $project->shelter->governorate ?? null,
                'district' => $project->shelter->district ?? null,
            ] : null;
        }
        
        // Subcategory - ✅ إضافة subcategory لضمان ظهورها في الاستجابة
        if (!isset($project->subcategory_data)) {
            $project->subcategory_data = $project->subcategory ? [
                'id' => $project->subcategory->id,
                'name_ar' => $project->subcategory->name_ar ?? null,
                'name' => $project->subcategory->name ?? null,
            ] : null;
        }
    }
}

