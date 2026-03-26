<?php
// app/Http/Controllers/ProjectProposalController.php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\AssignMontageProducerRequest;
use App\Http\Requests\AssignPhotographerRequest;
use App\Http\Requests\AssignResearcherRequest;
use App\Http\Requests\BatchAssignProducerRequest;
use App\Http\Requests\BatchUpdateStatusRequest;
use App\Http\Requests\BulkAssignPhotographerRequest;
use App\Http\Requests\ConvertToShekelRequest;
use App\Http\Requests\MarkAsExecutedRequest;
use App\Http\Requests\PostponeProjectRequest;
use App\Http\Requests\SelectShelterRequest;
use App\Http\Requests\StoreProjectProposalRequest;
use App\Http\Requests\UpdateExecutionStatusRequest;
use App\Http\Requests\UpdateMediaStatusRequest;
use App\Http\Requests\UpdateProjectProposalRequest;
use App\Models\ProjectProposal;
use App\Models\TeamPersonnel;
use App\Services\CurrencyConversionService;
use App\Services\DashboardService;
use App\Services\ExecutionStatusService;
use App\Services\MediaDashboardService;
use App\Services\MediaStatusService;
use App\Services\MontageAssignmentService;
use App\Services\ProjectAssignmentService;
use App\Services\ProjectDeleteService;
use App\Services\ProjectProposalImageService;
use App\Services\ProjectProposalIndexService;
use App\Services\ProjectProposalQuery;
use App\Services\ProjectProposalService;
use App\Services\ProjectStatusService;
use App\Services\ProjectUpdateService;
use App\Services\TimelineService;
use App\Traits\ApiResponse;
use App\Traits\CacheBustResponse;
use App\Traits\CacheableResponse;
use App\Traits\ChecksAuthorization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Services\ExportService;
use App\Services\MediaReportingService;
use App\Traits\ServesProjectImages;
use App\Services\AdvancedUpdateService;
use App\Services\BeneficiaryService;
use App\Traits\OrphanProjectManager;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\ProjectProposalsExport;

class ProjectProposalController extends Controller
{
    use ApiResponse, CacheBustResponse, CacheableResponse, ChecksAuthorization, ServesProjectImages, OrphanProjectManager;

    public function __construct(
        protected ProjectProposalQuery $query,
        protected ProjectProposalIndexService $indexService,
        protected ProjectProposalImageService $imageService,
        protected ProjectProposalService $service,
        protected ProjectUpdateService $updateService,
        protected ProjectDeleteService $deleteService,
        protected ProjectAssignmentService $assignmentService,
        protected ProjectStatusService $statusService,
        protected CurrencyConversionService $conversionService,
        protected MontageAssignmentService $montageService,
        protected MediaStatusService $mediaStatusService,
        protected ExecutionStatusService $executionService,
        protected TimelineService $timelineService,
        protected DashboardService $dashboardService,
        protected MediaDashboardService $mediaDashboardService,
        protected MediaReportingService $mediaReportService,
        protected ExportService $exportService,
        protected AdvancedUpdateService $advancedUpdateService,
        protected BeneficiaryService $beneficiaryService,
    ) {}

    // ═══════════════════════════════════════════════════════
    //  CRUD
    // ═══════════════════════════════════════════════════════

    public function create(StoreProjectProposalRequest $request): JsonResponse
    {
        $result = $this->service->createProject($request, $request->user());
        if (!$result['success']) {
            return $this->errorResponse('فشل إنشاء المشروع', $result['error'], $result['code'] ?? 500);
        }

        $project = $result['project'];
        $sync = $this->imageService->syncNoteImages($request, $project);
        if (isset($sync['error'])) return $sync['error'];

        $this->copyImagesToChildren($project);
        $this->clearProjectsCache();

        return $this->buildCreateResponse($project, $result['phase_result'] ?? null);
    }

    /**
     * ✅ FIX: The index method was double-serializing data through getCachedResponse,
     *    causing numeric values to become 0/null and relationship data to be lost.
     *
     *    ROOT CAUSE:
     *    1. indexService->getProjects() returns JsonResponse with properly cast models
     *    2. ->getData(true) strips Eloquent casts (floats→strings, nulls→0)
     *    3. Cache serializes the degraded array
     *    4. getCachedResponse wraps it in another JsonResponse
     *
     *    FIX: Build the response data array DIRECTLY from the query/pagination,
     *    not from an intermediate JsonResponse. This preserves all data types.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->unauthorizedResponse('يجب تسجيل الدخول');
        }

        $userRole = strtolower($user->role ?? 'guest');

        // ✅ Build cache key
        $cacheKey = $this->buildCacheKey('project_proposals', $request, $user->id, $userRole);

        $ttl = $userRole === 'media_manager' ? 60 : 300;

        return $this->getCachedResponse($cacheKey, function () use ($request, $user, $userRole) {
            // ✅ FIX: Get data directly from query + pagination, NOT through JsonResponse->getData()
            //    This preserves all Eloquent casts, accessors, and relationship data.
            return $this->buildIndexResponseData($request, $user, $userRole);
        }, $ttl);
    }

    /**
     * ✅ NEW: Build the index response data array directly.
     *    This avoids the double-serialization problem.
     *
     *    Returns a plain array that getCachedResponse() will wrap in JsonResponse.
     */
    private function buildIndexResponseData(Request $request, $user, string $userRole): array
    {
        // Build the query using ProjectProposalQuery
        $queryBuilder = $this->query->buildListQuery($request, $user);

        // Get per-page value
        $perPage = $this->query->getPerPageValue($request, $userRole);

        // Paginate
        $paginated = $queryBuilder->paginate($perPage);

        // ✅ KEY FIX: Convert each model to array WITH proper casting
        //    Using ->through() preserves the paginator structure while
        //    ensuring each model's casts/accessors are applied.
        $projects = collect($paginated->items())->map(function (ProjectProposal $project) {
            $data = $project->toArray();

            // ✅ Ensure numeric fields are properly typed (not null/0 when they have values)
            $numericFields = [
                'donation_amount',
                'net_amount',
                'amount_in_usd',
                'amount_in_shekel',
                'shekel_exchange_rate',
                'transfer_discount_percentage',
                'estimated_duration_days',
                'beneficiaries_count',
                'beneficiaries_per_unit',
                'total_beneficiaries',
            ];

            foreach ($numericFields as $field) {
                if (array_key_exists($field, $data)) {
                    // Keep null as null, but ensure non-null values are proper numbers
                    if ($data[$field] !== null) {
                        $data[$field] = is_numeric($data[$field])
                            ? (strpos((string)$data[$field], '.') !== false ? (float)$data[$field] : (int)$data[$field])
                            : $data[$field];
                    }
                }
            }

            return $data;
        })->all();

        return [
            'success'     => true,
            'projects'    => $projects,
            'total'       => $paginated->total(),
            'currentPage' => $paginated->currentPage(),
            'totalPages'  => $paginated->lastPage(),
            'perPage'     => $paginated->perPage(),
            'from'        => $paginated->firstItem(),
            'to'          => $paginated->lastItem(),
        ];
    }

    public function show(int $id): JsonResponse
    {
        try {
            $project = ProjectProposal::findOrFail($id);
            $this->loadProjectRelations($project);
            return $this->addCorsHeaders(response()->json([
                'success' => true,
                'project' => $this->ensureNumericTypes($project->toArray()),
            ]));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return $this->notFoundResponse('المشروع غير موجود');
        } catch (\Exception $e) {
            return $this->errorResponse('خطأ في جلب المشروع', 'خطأ في قاعدة البيانات', 500, $e);
        }
    }

    public function update(UpdateProjectProposalRequest $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($this->updateService->isBeneficiariesOnlyUpdate($request)
            && $this->hasRole($user, [UserRole::ADMIN, UserRole::PROJECT_MANAGER, UserRole::EXECUTED_PROJECTS_COORDINATOR, UserRole::ORPHAN_SPONSOR_COORDINATOR])) {
            return $this->updateBeneficiaries($request, $id);
        }

        try {
            $result = $this->updateService->update($request, $id, $user);
            if (!$result['success']) {
                return $this->errorResponse('فشل تحديث المشروع', $result['error'], $result['code'] ?? 500);
            }
            $this->clearProjectsCache();
            return $this->successResponse([
                'project' => $this->ensureNumericTypes(
                    $result['project'] instanceof ProjectProposal
                        ? $result['project']->toArray()
                        : (array)$result['project']
                ),
            ], 'تم تحديث المشروع بنجاح');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return $this->notFoundResponse('المشروع غير موجود');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل تحديث المشروع', 'حدث خطأ', 500, $e);
        }
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$this->isAdmin($request->user())) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لحذف مشروع');
        }

        try {
            $result = $this->deleteService->delete($id, $request->user());
            $this->clearProjectsCache();
            return $this->successResponse([
                'items_returned_to_warehouse'    => $result['items_returned'],
                'project_status_before_deletion' => $result['status_before'],
            ], $result['message']);
        } catch (\Exception $e) {
            return $this->errorResponse('فشل حذف المشروع', $e->getMessage(), 500, $e);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  ASSIGNMENTS
    // ═══════════════════════════════════════════════════════

    public function assignProject(AssignResearcherRequest $request, int $id): JsonResponse
    {
        return $this->handleServiceCall(
            fn () => $this->assignmentService->assignResearcher($request, $id, $request->user()),
            'فشل إسناد المشروع',
            afterSuccess: fn () => $this->clearProjectsCache()
        );
    }

    public function assignPhotographer(AssignPhotographerRequest $request, int $id): JsonResponse
    {
        try {
            $project = ProjectProposal::findOrFail($id);
            $fix = $this->assignmentService->autoFixMissingResearcher($project, $request->user());
            if ($fix['fixed']) {
                return response()->json([
                    'success'    => false,
                    'error'      => 'لا يمكن إسناد المصور',
                    'message'    => $fix['error'],
                    'auto_fixed' => true,
                    'new_status' => 'تم التوريد',
                ], 422);
            }
            if (isset($fix['error'])) {
                return $this->errorResponse('لا يمكن إسناد المصور', $fix['error'], 422);
            }

            $result = $this->assignmentService->assignPhotographer(
                $project,
                (int) $request->assigned_photographer_id,
                $request->user()
            );
            if (!$result['success']) {
                return $this->errorResponse('لا يمكن إسناد المصور', $result['message'], 422);
            }

            $project->load(['assignedResearcher', 'photographer', 'assignedBy']);
            $this->clearProjectsCache();

            return $this->successResponse([
                'project'         => $project,
                'status_changed'  => $result['status_changed'],
                'is_reassignment' => $result['is_reassignment'],
            ], match (true) {
                $result['is_reassignment'] => 'تم إعادة إسناد المصور بنجاح',
                $result['status_changed']  => 'تم إسناد المصور - المشروع جاهز للتنفيذ',
                default                    => 'تم إسناد المصور بنجاح',
            });
        } catch (\Exception $e) {
            return $this->errorResponse('فشل إسناد المصور', $e->getMessage(), 500, $e);
        }
    }

    public function bulkAssignPhotographer(BulkAssignPhotographerRequest $request): JsonResponse
    {
        $photographer = TeamPersonnel::findOrFail($request->assigned_photographer_id);
        if ($photographer->personnel_type !== 'مصور') {
            return $this->errorResponse('المحدد ليس مصور', 'يرجى اختيار مصور', 422);
        }

        $ids = array_values(array_unique(array_map('intval', $request->project_ids)));
        $assigned = 0;
        $failedReasons = [];

        foreach ($ids as $pid) {
            $p = ProjectProposal::find($pid);
            if (!$p) {
                $failedReasons[$pid] = 'المشروع غير موجود';
                continue;
            }
            $r = $this->assignmentService->assignPhotographer($p, (int) $request->assigned_photographer_id, $request->user());
            $r['success'] ? $assigned++ : ($failedReasons[$pid] = $r['message'] ?? 'فشل');
        }

        $this->clearProjectsCache();
        $failed = count($failedReasons);

        return $this->successResponse([
            'assigned_count' => $assigned,
            'failed_count'   => $failed,
            'failed_ids'     => array_keys($failedReasons),
            'failed_reasons' => $failedReasons,
        ], $failed === 0
            ? "تم إسناد المصور لـ {$assigned} مشاريع"
            : "تم {$assigned}، فشل {$failed}"
        );
    }

    public function assignMontageProducer(AssignMontageProducerRequest $request, int $id): JsonResponse
    {
        return $this->handleServiceCall(
            fn () => $this->montageService->assign($id, (int) $request->montage_producer_id, $request->user()),
            'فشل إسناد ممنتج المونتاج',
            afterSuccess: fn () => $this->clearProjectsCache(),
            successMessageKey: 'is_reassignment',
            successMessages: [
                true  => 'تم إعادة إسناد ممنتج المونتاج بنجاح',
                false => 'تم إسناد ممنتج المونتاج بنجاح',
            ]
        );
    }

    public function batchAssignProducer(BatchAssignProducerRequest $request): JsonResponse
    {
        return $this->handleBatchOperation(
            fn () => $this->montageService->batchAssign(
                array_unique($request->input('project_ids')),
                (int) $request->montage_producer_id,
                $request->user()
            ),
            'إسناد',
            'ممنتج المونتاج'
        );
    }

    // ═══════════════════════════════════════════════════════
    //  STATUS TRANSITIONS
    // ═══════════════════════════════════════════════════════

    public function returnToSupply(Request $request, int $id): JsonResponse
    {
        return $this->handleStatusTransition(
            fn () => $this->statusService->returnToSupply($id, $request->user()),
            'فشل إرجاع المشروع',
            'تم إرجاع المشروع إلى حالة التوريد بنجاح'
        );
    }

    public function postponeProject(PostponeProjectRequest $request, int $id): JsonResponse
    {
        return $this->handleStatusTransition(
            fn () => $this->statusService->postpone($id, $request->user(), $request->postponement_reason),
            'فشل تأجيل المشروع',
            'تم تأجيل المشروع بنجاح'
        );
    }

    public function resumeProject(Request $request, int $id): JsonResponse
    {
        return $this->handleStatusTransition(
            fn () => $this->statusService->resume($id, $request->user()),
            'فشل استئناف المشروع',
            'تم استئناف المشروع بنجاح'
        );
    }

    public function moveToSupply(Request $request, int $id): JsonResponse
    {
        return $this->handleStatusTransition(
            fn () => $this->statusService->moveToSupply($id, $request->user() ?? auth()->user()),
            'فشل نقل المشروع',
            'تم نقل المشروع لمرحلة التوريد'
        );
    }

    public function selectShelter(SelectShelterRequest $request, int $id): JsonResponse
    {
        return $this->handleStatusTransition(
            fn () => $this->statusService->selectShelter($id, $request->shelter_id, $request->user()),
            'فشل اختيار المخيم',
            'تم اختيار المخيم بنجاح',
            extraData: ['next_step' => 'يمكنك الآن الضغط على "نقل للتنفيذ"']
        );
    }

    public function transferToExecution(Request $request, int $id): JsonResponse
    {
        try {
            $result = $this->statusService->transferToExecution($id, $request->user());
            if (!$result['success']) {
                return $this->errorResponse('لا يمكن نقل المشروع', $result['error'], $result['code'] ?? 422);
            }

            $this->clearProjectsCache();
            $isSponsorship = $result['is_sponsorship'] ?? false;
            $alreadyTransferred = $result['already_transferred'] ?? false;

            $data = [
                'success'   => true,
                'proposal'  => $result['project'],
                'message'   => $alreadyTransferred ? 'المشروع تم نقله مسبقاً' : 'تم نقل المشروع للتنفيذ بنجاح',
                'next_step' => $isSponsorship ? 'متابعة تنفيذ الكفالة' : 'مدير المشاريع يحدث الحالة إلى "تم التنفيذ"',
            ];
            if (!$isSponsorship && isset($result['executed_project'])) {
                $data['executed_project'] = $result['executed_project'];
            }
            if ($alreadyTransferred) {
                $data['already_transferred'] = true;
            }

            return $this->cacheBustResponse($data);
        } catch (\Exception $e) {
            return $this->errorResponse('فشل نقل المشروع', $e->getMessage(), 500, $e);
        }
    }

    public function markAsExecuted(MarkAsExecutedRequest $request, int $id): JsonResponse
    {
        return $this->handleStatusTransition(
            fn () => $this->statusService->markAsExecuted($id, $request->user(), $request->execution_date, $request->notes, $request),
            'فشل تحديث حالة المشروع',
            'تم تحديث حالة المشروع إلى تم التنفيذ بنجاح'
        );
    }

    // ═══════════════════════════════════════════════════════
    //  EXECUTION STATUS
    // ═══════════════════════════════════════════════════════

    public function updateExecutionStatus(UpdateExecutionStatusRequest $request, int $id): JsonResponse
    {
        try {
            $result = $this->executionService->updateStatus($id, $request->status, $request->user());

            if (!$result['success']) {
                return $this->addCorsHeaders(
                    response()->json([
                        'success' => false,
                        'error'   => 'لا يمكن تحديث الحالة',
                        'message' => $result['error'],
                    ], $result['code'] ?? 422)
                );
            }

            $this->clearProjectsCache();

            return $this->cacheBustResponse([
                'success' => true,
                'message' => 'تم تحديث حالة المشروع بنجاح',
                'project' => $result['project'],
            ]);
        } catch (\Exception $e) {
            return $this->errorResponse('فشل تحديث حالة المشروع', $e->getMessage(), 500, $e);
        }
    }

    public function markAsCompleted(Request $request, int $id): JsonResponse
    {
        if (!$this->isAdmin($request->user())) {
            return $this->unauthorizedResponse('الصلاحيات مقتصرة على الإدارة فقط');
        }

        try {
            $result = $this->executionService->markAsCompleted($id, $request->user());

            if (!$result['success']) {
                return $this->errorResponse('لا يمكن إنهاء المشروع', $result['error'], $result['code'] ?? 422);
            }

            $this->clearProjectsCache();

            return $this->successResponse(
                ['project' => $result['project']],
                'تم تحويل المشروع إلى حالة "منتهي" بنجاح'
            );
        } catch (\Exception $e) {
            return $this->errorResponse('فشل إنهاء المشروع', $e->getMessage(), 500, $e);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  MEDIA STATUS
    // ═══════════════════════════════════════════════════════

    public function updateMediaStatus(UpdateMediaStatusRequest $request, int $id): JsonResponse
    {
        try {
            $result = $this->mediaStatusService->updateStatus(
                $id, $request->status, $request->user(),
                $request->notes, $request->rejection_reason
            );

            if (!$result['success']) {
                return $this->errorResponse('فشل تحديث الحالة', $result['error'] ?? 'خطأ', $result['code'] ?? 400);
            }

            $this->clearAllMediaCaches();

            return $this->successResponse([
                'project'          => $result['project'],
                'old_status'       => $result['old_status'],
                'new_status'       => $result['new_status'],
                'old_media_status' => $result['old_media_status'],
                'new_media_status' => $result['new_media_status'],
            ], 'تم تحديث حالة المونتاج بنجاح');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return $this->notFoundResponse('المشروع غير موجود');
        } catch (\Exception $e) {
            return $this->errorResponse('خطأ في تحديث الحالة', $e->getMessage(), 500, $e);
        }
    }

    public function batchUpdateStatus(BatchUpdateStatusRequest $request): JsonResponse
    {
        return $this->handleBatchOperation(
            fn () => $this->mediaStatusService->batchUpdate(
                array_unique($request->input('project_ids')),
                $request->status,
                $request->user(),
                $request->notes,
                $request->rejection_reason,
            ),
            'تحديث حالة',
            'مشاريع',
            resultKey: 'updated'
        );
    }

    // ═══════════════════════════════════════════════════════
    //  CURRENCY CONVERSION
    // ═══════════════════════════════════════════════════════

    public function convertToShekel(ConvertToShekelRequest $request, int $id): JsonResponse
    {
        try {
            $result = $this->conversionService->convertToShekel(
                $id, $request->user(),
                (float) $request->shekel_exchange_rate,
                (float) $request->input('transfer_discount_percentage', 0)
            );

            if (!$result['success']) {
                return $this->errorResponse('لا يمكن تحويل المبلغ', $result['error'], $result['code'] ?? 422);
            }
            $this->clearProjectsCache();
            return $this->successResponse(['data' => $result['data']], 'تم تحويل المبلغ للشيكل بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل تحويل المبلغ', $e->getMessage(), 500, $e);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  TIMELINE
    // ═══════════════════════════════════════════════════════

    public function getTimeline(int $id): JsonResponse
    {
        try {
            $result = $this->timelineService->getTimeline(
                $id,
                (int) request()->query('perPage', 50),
                (int) request()->query('page', 1)
            );

            return $this->successResponse($result);
        } catch (\Exception $e) {
            return $this->errorResponse('فشل جلب السجل', $e->getMessage(), 500, $e);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  DASHBOARDS
    // ═══════════════════════════════════════════════════════

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'error' => 'غير مصرح'], 401);
        }

        if (!$this->hasRole($user, [UserRole::ADMIN, UserRole::EXECUTED_PROJECTS_COORDINATOR])) {
            return $this->unauthorizedResponse('الصلاحيات مقتصرة على الإدارة ومنسق المشاريع المنفذة');
        }

        try {
            $filters = $request->only(['start_date', 'end_date', 'status', 'project_type']);
            $stats = $this->dashboardService->getAdminDashboard($filters);
            return $this->successResponse(['data' => $stats]);
        } catch (\Exception $e) {
            return $this->errorResponse('فشل جلب الإحصائيات', $e->getMessage(), 500, $e);
        }
    }

    public function mediaDashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'media_manager') {
            return $this->unauthorizedResponse('الصلاحيات مقتصرة على مدير الإعلام');
        }

        try {
            $result = $this->mediaDashboardService->getData($user, $request->has('_refresh'));
            return $this->successResponse([
                'data'   => $result['data'],
                'cached' => $result['cached'],
            ]);
        } catch (\Exception $e) {
            return $this->errorResponse('فشل جلب الإحصائيات', $e->getMessage(), 500, $e);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  TEST
    // ═══════════════════════════════════════════════════════

    public function testData(): JsonResponse
    {
        $project = ProjectProposal::with([
            'currency', 'shelter', 'creator', 'assignedToTeam',
            'assignedResearcher', 'photographer', 'assignedMontageProducer', 'subcategory',
        ])->first();

        return $project
            ? $this->successResponse([
                'project_raw'  => $project->toArray(),
                'field_checks' => $this->buildFieldChecks($project),
            ])
            : $this->notFoundResponse('لا توجد مشاريع');
    }

    // ═══════════════════════════════════════════════════════
    //  GENERIC PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════

    /**
     * ✅ Numeric fields that must preserve their type through serialization.
     *    Used by ensureNumericTypes() and buildIndexResponseData().
     */
    private const NUMERIC_FIELDS = [
        'donation_amount',
        'net_amount',
        'amount_in_usd',
        'amount_in_shekel',
        'shekel_exchange_rate',
        'transfer_discount_percentage',
        'estimated_duration_days',
        'beneficiaries_count',
        'beneficiaries_per_unit',
        'total_beneficiaries',
        'phase_day',
        'month_number',
        'total_phases',
        'phase_budget',
    ];

    /**
     * ✅ NEW: Ensure numeric fields maintain proper types after array conversion.
     *    Prevents null→0 and float→string issues when data passes through
     *    toArray() → cache → json_encode.
     */
    private function ensureNumericTypes(array $data): array
    {
        foreach (self::NUMERIC_FIELDS as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }

            $value = $data[$field];

            // ✅ Keep null as null (don't convert to 0)
            if ($value === null) {
                $data[$field] = null;
                continue;
            }

            // ✅ Ensure proper numeric type
            if (is_numeric($value)) {
                $data[$field] = str_contains((string) $value, '.')
                    ? (float) $value
                    : (int) $value;
            }
        }

        return $data;
    }

    /**
     * Generic handler for status transition endpoints.
     */
    private function handleStatusTransition(
        callable $call,
        string   $errorLabel,
        string   $successMsg,
        array    $extraData = []
    ): JsonResponse {
        try {
            $result = $call();
            if (!$result['success']) {
                $code = $result['code'] ?? 422;
                return $code === 403
                    ? $this->unauthorizedResponse($result['error'])
                    : $this->errorResponse($errorLabel, $result['error'], $code);
            }
            $this->clearProjectsCache();
            return $this->cacheBustResponse(array_merge([
                'success' => true,
                'message' => $successMsg,
                'project' => $result['project'],
            ], $extraData));
        } catch (\Exception $e) {
            return $this->errorResponse($errorLabel, $e->getMessage(), 500, $e);
        }
    }

    /**
     * Generic handler for service calls returning {success, message/error, ...}.
     */
    private function handleServiceCall(
        callable  $call,
        string    $errorLabel,
        ?callable $afterSuccess = null,
        ?string   $successMessageKey = null,
        array     $successMessages = []
    ): JsonResponse {
        try {
            $result = $call();
            if (!$result['success']) {
                return $this->errorResponse(
                    $errorLabel,
                    $result['message'] ?? $result['error'] ?? 'فشل',
                    $result['code'] ?? 422
                );
            }
            if ($afterSuccess) {
                $afterSuccess();
            }

            $message = 'تمت العملية بنجاح';
            if ($successMessageKey && isset($result[$successMessageKey], $successMessages[$result[$successMessageKey]])) {
                $message = $successMessages[$result[$successMessageKey]];
            } elseif (isset($result['message'])) {
                $message = $result['message'];
            }

            return $this->successResponse($result, $message);
        } catch (\Exception $e) {
            return $this->errorResponse($errorLabel, $e->getMessage(), 500, $e);
        }
    }

    /**
     * Generic handler for batch operations returning {assigned/updated: [], failed: []}.
     */
    private function handleBatchOperation(
        callable $call,
        string   $verb,
        string   $target,
        string   $resultKey = 'assigned'
    ): JsonResponse {
        try {
            $result = $call();
            $successItems = $result[$resultKey] ?? [];
            $failedItems  = $result['failed'] ?? [];

            $this->clearAllMediaCaches();

            $successCount = count($successItems);
            $failedCount  = count($failedItems);

            if ($successCount === 0) {
                return response()->json([
                    'success'               => false,
                    'message'               => "لم يتم {$verb} أي مشروع",
                    "{$resultKey}_count"     => 0,
                    'failed_projects'        => $failedItems,
                ], 400);
            }

            return $this->successResponse([
                "{$resultKey}_count" => $successCount,
                'projects'           => $successItems,
                'failed_projects'    => $failedItems,
            ], "تم {$verb} {$successCount} {$target} بنجاح" . ($failedCount > 0 ? "، فشل {$failedCount}" : ''));
        } catch (\Exception $e) {
            return $this->errorResponse("فشل {$verb} {$target}", $e->getMessage(), 500, $e);
        }
    }

    private function copyImagesToChildren(ProjectProposal $project): void
    {
        if (!$project->is_divided_into_phases) {
            return;
        }
        $project->refresh();
        $project->copyNoteImagesToAllChildren(
            $project->dailyPhases->concat($project->monthlyPhases)
        );
    }

    private function buildCreateResponse(ProjectProposal $project, ?array $phaseResult): JsonResponse
    {
        if (!$project->id) {
            return $this->errorResponse('فشل التحقق', 'لم يتم حفظ المشروع', 500);
        }

        $base = ['project' => $project, 'serial_number' => $project->serial_number];

        if (!$phaseResult) {
            $base['project'] = $project->fresh(['currency', 'creator']);
            return $this->successResponse($base, 'تم إنشاء المشروع بنجاح', 201);
        }

        if ($phaseResult['type'] === 'daily') {
            $base['daily_phases_count'] = $phaseResult['count'];
            return $this->successResponse($base, "تم إنشاء المشروع مع {$phaseResult['count']} مشروع يومي", 201);
        }

        $base += [
            'total_months'         => $phaseResult['total_months'],
            'monthly_phases_count' => $phaseResult['count'],
            'first_monthly_phase'  => $phaseResult['first_phase'] ?? null,
        ];
        return $this->successResponse($base, "تم إنشاء المشروع مع {$phaseResult['count']} مشروع شهري", 201);
    }

    private function loadProjectRelations(ProjectProposal $project): void
    {
        $full = [
            'currency', 'creator', 'assignedToTeam', 'shelter', 'subcategory',
            'projectType', 'assignedBy', 'assignedResearcher', 'photographer',
            'assignedMontageProducer', 'parentProject', 'executedProject',
        ];

        try {
            $project->load($full);
        } catch (\Exception) {
            $project->load(['currency', 'creator', 'shelter', 'projectType']);
        }

        if ($project->is_divided_into_phases) {
            try {
                $project->load(['dailyPhases', 'monthlyPhases']);
            } catch (\Exception) {
                // Silently skip if phases relations don't exist
            }
        }
    }

    private function buildFieldChecks(ProjectProposal $p): array
    {
        $checks = [];
        $fields = [
            'donor_name', 'project_description', 'donation_amount',
            'net_amount', 'amount_in_usd', 'estimated_duration_days',
        ];

        foreach ($fields as $f) {
            $checks[$f] = [
                'exists' => !is_null($p->$f),
                'value'  => $p->$f,
                'type'   => gettype($p->$f),
            ];
        }

        return $checks;
    }

    private function handleDatabaseQueryError(\Illuminate\Database\QueryException $e, $user): JsonResponse
    {
        Log::error('DB error', ['user_id' => $user->id ?? null, 'error' => $e->getMessage()]);

        if (str_contains($e->getMessage(), 'timeout')
            || str_contains($e->getMessage(), 'timed out')
            || $e->getCode() == 2006
        ) {
            return response()->json([
                'success'     => true,
                'projects'    => [],
                'total'       => 0,
                'currentPage' => 1,
                'totalPages'  => 0,
                'perPage'     => 20,
                'message'     => 'انتهت مهلة الاتصال.',
            ]);
        }

        return $this->handleDatabaseException($e);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Cache Clearing Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private function clearProjectsCache(): void
    {
        try {
            Cache::tags('projects')->flush();
        } catch (\Exception) {
            // Tag-based flushing not supported — rely on TTL expiration
        }
    }

    private function clearMediaCache(): void
    {
        try {
            Cache::tags('projects')->flush();
        } catch (\Exception) {
        }
    }

    private function clearAllMediaCaches(): void
    {
        $this->clearMediaCache();
        $this->clearProjectsCache();
        try {
            Cache::tags(['projects', 'project-proposals'])->flush();
        } catch (\Exception) {
            try {
                Cache::flush();
            } catch (\Exception) {
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    //  MEDIA REPORTS & PHOTOGRAPHER ASSIGNMENT
    // ═══════════════════════════════════════════════════════

    public function getNewProjectsNeedingPhotographer(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$this->hasRole($user, [UserRole::MEDIA_MANAGER, UserRole::ADMIN])) {
            return $this->unauthorizedResponse('الصلاحيات مقتصرة على مدير الإعلام والإدارة');
        }

        try {
            $result = $this->mediaReportService->getProjectsNeedingPhotographer(
                $user->id,
                (int) $request->query('page', 1),
                (int) $request->query('perPage', 15),
                $request->query('searchQuery', ''),
                $request->has('_refresh')
            );

            return $this->addCorsHeaders(response()->json(array_merge(
                ['success' => true],
                $result['data'],
                ['cached' => $result['cached']]
            ), 200));
        } catch (\Exception $e) {
            Log::error('Error fetching new projects', ['error' => $e->getMessage()]);
            return $this->errorResponse('فشل جلب المشاريع', $e->getMessage(), 500, $e);
        }
    }

    public function mediaReports(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$this->hasRole($user, [UserRole::MEDIA_MANAGER])) {
            return $this->unauthorizedResponse('الصلاحيات مقتصرة على مدير الإعلام');
        }

        try {
            $data = $this->mediaReportService->generateReport(
                $request->query('month'),
                $request->query('year'),
                $request->query('project_type')
            );

            return $this->successResponse(['data' => $data]);
        } catch (\Exception $e) {
            return $this->errorResponse('فشل جلب التقارير', $e->getMessage(), 500, $e);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  EXPORT & IMAGES
    // ═══════════════════════════════════════════════════════

    public function export(Request $request)
    {
        $startDate   = $request->query('start_date');
        $endDate     = $request->query('end_date');
        $statuses    = $request->query('statuses');
        $projectType = $request->query('project_type');

        if ($startDate && !strtotime($startDate)) {
            return response()->json([
                'success' => false,
                'error'   => 'تاريخ البداية غير صحيح',
                'message' => 'يجب أن يكون تاريخ البداية بصيغة صحيحة (YYYY-MM-DD)',
            ], 400);
        }

        if ($endDate && !strtotime($endDate)) {
            return response()->json([
                'success' => false,
                'error'   => 'تاريخ النهاية غير صحيح',
                'message' => 'يجب أن يكون تاريخ النهاية بصيغة صحيحة (YYYY-MM-DD)',
            ], 400);
        }

        if ($startDate && $endDate && strtotime($startDate) > strtotime($endDate)) {
            return response()->json([
                'success' => false,
                'error'   => 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
                'message' => 'الرجاء التحقق من التواريخ المدخلة',
            ], 400);
        }

        $statusArray = $this->parseStatusFilter($statuses, $request->query('status'));

        $query = ProjectProposal::query();

        if ($startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        }
        if (!empty($statusArray)) {
            $query->whereIn('status', $statusArray);
        }
        if ($projectType) {
            $query->where('project_type', $projectType);
        }

        if ($query->count() === 0) {
            return response()->json([
                'success' => false,
                'error'   => 'لا يوجد مشاريع للتصدير',
                'message' => 'لا توجد مشاريع تطابق معايير الفلترة المحددة',
            ], 404);
        }

        $fileName = $this->buildExportFileName($startDate, $endDate, $statusArray, $projectType);

        try {
            return Excel::download(
                new ProjectProposalsExport($startDate, $endDate, $statusArray, $projectType),
                $fileName
            );
        } catch (\Exception $e) {
            Log::error('Error exporting project proposals to Excel: ' . $e->getMessage(), [
                'start_date'   => $startDate,
                'end_date'     => $endDate,
                'statuses'     => $statusArray,
                'project_type' => $projectType,
                'trace'        => $e->getTraceAsString(),
            ]);
            return response()->json([
                'success' => false,
                'error'   => 'فشل تصدير البيانات',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * ✅ NEW: Parse status filter from multiple possible input formats.
     */
    private function parseStatusFilter(mixed $statuses, ?string $singleStatus): array
    {
        $statusArray = [];

        if ($statuses) {
            if (is_array($statuses)) {
                $statusArray = $statuses;
            } elseif (is_string($statuses)) {
                $decoded = json_decode($statuses, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $statusArray = $decoded;
                } elseif (str_contains($statuses, ',')) {
                    $statusArray = array_map('trim', explode(',', $statuses));
                } else {
                    $statusArray = [$statuses];
                }
            }
        }

        if (empty($statusArray) && $singleStatus && $singleStatus !== 'all' && $singleStatus !== 'الكل') {
            $statusArray = [$singleStatus];
        }

        return array_values(array_filter($statusArray, fn ($s) => !empty($s) && $s !== 'all' && $s !== 'الكل'));
    }

    /**
     * ✅ NEW: Build export filename from filter params.
     */
    private function buildExportFileName(?string $startDate, ?string $endDate, array $statusArray, ?string $projectType): string
    {
        $fileName = 'project_proposals';

        if ($startDate && $endDate) {
            $fileName .= "_{$startDate}_to_{$endDate}";
        } elseif ($startDate) {
            $fileName .= "_from_{$startDate}";
        } elseif ($endDate) {
            $fileName .= "_until_{$endDate}";
        }

        if (!empty($statusArray)) {
            $statusStr = implode('_', array_map(fn ($s) => str_replace(' ', '_', $s), $statusArray));
            $fileName .= "_status_{$statusStr}";
        }

        if ($projectType) {
            $fileName .= '_type_' . str_replace(' ', '_', $projectType);
        }

        return $fileName . '.xlsx';
    }

    public function getProjectImage($id)
    {
        try {
            $project = ProjectProposal::with('noteImages')->findOrFail($id);
            $corsOrigin = $this->resolveCorsOrigin();

            // Check note images first
            $firstNoteImage = $project->noteImages->first();
            if ($firstNoteImage && $firstNoteImage->image_path && file_exists(public_path($firstNoteImage->image_path))) {
                return $this->serveImageFile(public_path($firstNoteImage->image_path), $corsOrigin);
            }

            // Fallback to old project_image field
            if ($project->project_image && file_exists(public_path($project->project_image))) {
                return $this->serveImageFile(public_path($project->project_image), $corsOrigin);
            }

            // Default image
            $defaultImage = public_path('images/default-project.jpg');
            if (file_exists($defaultImage)) {
                return $this->serveImageFile($defaultImage, $corsOrigin);
            }

            return response()->json(['success' => false, 'error' => 'الصورة غير موجودة'], 404)
                ->withHeaders($this->imageCorsHeaders($corsOrigin));
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error'   => 'المشروع غير موجود',
                'message' => $e->getMessage(),
            ], 404)->withHeaders($this->imageCorsHeaders($this->resolveCorsOrigin()));
        }
    }

    /**
     * ✅ NEW: Serve an image file with proper headers.
     */
    private function serveImageFile(string $filePath, string $corsOrigin)
    {
        $mimeType = mime_content_type($filePath) ?: 'image/jpeg';

        return response()->file($filePath, array_merge(
            ['Content-Type' => $mimeType, 'Cache-Control' => 'public, max-age=31536000'],
            $this->imageCorsHeaders($corsOrigin)
        ));
    }

    /**
     * ✅ NEW: Resolve CORS origin for image endpoints.
     */
    private function resolveCorsOrigin(): string
    {
        $origin = request()->header('Origin');
        $allowedOrigins = config('cors.allowed_origins', []);

        return ($origin && in_array($origin, $allowedOrigins)) ? $origin : '*';
    }

    /**
     * ✅ NEW: CORS headers for image endpoints.
     */
    private function imageCorsHeaders(string $corsOrigin): array
    {
        return [
            'Access-Control-Allow-Origin'      => $corsOrigin,
            'Access-Control-Allow-Methods'     => 'GET, OPTIONS',
            'Access-Control-Allow-Headers'     => 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials' => 'true',
        ];
    }

    public function getNotesImage(int $id)
    {
        return $this->serveNotesImage($id);
    }

    public function getNoteImages(int $id): JsonResponse
    {
        try {
            $project = ProjectProposal::with('noteImages')->findOrFail($id);

            $images = $project->noteImages->map(fn ($image) => [
                'id'            => $image->id,
                'image_path'    => $image->image_path,
                'display_order' => $image->display_order,
            ])->toArray();

            return $this->successResponse(['images' => $images], 'تم جلب صور الملاحظات بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل جلب صور الملاحظات', $e->getMessage(), 404);
        }
    }

    public function downloadNotesImage(int $id)
    {
        return $this->serveNotesImage($id, true);
    }

    public function reorderNoteImages(Request $request): JsonResponse
    {
        return $this->reorderImages($request);
    }

    // ═══════════════════════════════════════════════════════
    //  BENEFICIARIES
    // ═══════════════════════════════════════════════════════

    public function updateBeneficiaries(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasRole($user, [
            UserRole::ADMIN, UserRole::PROJECT_MANAGER,
            UserRole::EXECUTED_PROJECTS_COORDINATOR, UserRole::ORPHAN_SPONSOR_COORDINATOR,
        ])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لتحديث المستفيدين');
        }

        try {
            $result = $this->beneficiaryService->updateCounts(
                $id,
                (int) $request->beneficiaries_count,
                (int) $request->beneficiaries_per_unit,
                $user
            );

            if (!$result['success']) {
                return $this->errorResponse('فشل التحديث', $result['error'], $result['code'] ?? 500);
            }

            $this->clearProjectsCache();
            return $this->successResponse(['project' => $result['project']], 'تم تحديث عدد المستفيدين بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('فشل التحديث', $e->getMessage(), 500, $e);
        }
    }

    public function getExecutedProjectsForBeneficiaries(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasRole($user, [UserRole::ADMIN, UserRole::EXECUTED_PROJECTS_COORDINATOR])) {
            return $this->unauthorizedResponse('الصلاحيات مقتصرة على الإدارة وقسم التنفيذ');
        }

        try {
            $data = $this->beneficiaryService->getExecutedProjects(
                (int) $request->input('page', 1),
                (int) $request->input('per_page', 10000),
                $request->input('search'),
                $user
            );

            return $this->successResponse(array_merge(['success' => true], $data));
        } catch (\Exception $e) {
            Log::error('Error fetching executed projects', ['error' => $e->getMessage()]);
            return $this->errorResponse('فشل جلب البيانات', $e->getMessage(), 500, $e);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  ADVANCED SEARCH & DETAILS
    // ═══════════════════════════════════════════════════════

    public function advancedSearch(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user || !$this->hasRole($user, [UserRole::ADMIN, UserRole::PROJECT_MANAGER])) {
            return $this->unauthorizedResponse(
                'ليس لديك صلاحيات للوصول إلى البحث المتقدم. الصلاحيات مقتصرة على الإدارة ومدير المشاريع فقط.'
            );
        }

        try {
            $query = ProjectProposal::query();

            $this->service->applyAdvancedSearchFilters($query, $request);

            $sortBy    = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $allowedSortFields = ['created_at', 'updated_at', 'project_name', 'status', 'execution_date', 'montage_completed_date'];

            if (in_array($sortBy, $allowedSortFields, true)) {
                $query->orderBy($sortBy, $sortOrder === 'asc' ? 'asc' : 'desc');
            } else {
                $query->orderBy('created_at', 'desc');
            }

            $perPage = min(max(1, (int) $request->get('per_page', 15)), 200);
            $page    = max(1, (int) $request->get('page', 1));

            $query->with([
                'currency:id,currency_code,currency_name_ar',
                'shelter:manager_id_number,camp_name',
                'projectType:id,name',
                'subcategory:id,name_ar',
                'assignedToTeam:id,team_name',
                'assignedResearcher:id,name',
                'photographer:id,name',
                'assignedMontageProducer:id,name',
            ]);

            $projects = $query->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'success' => true,
                'data'    => [
                    'projects'   => collect($projects->items())->map(
                        fn ($p) => $this->ensureNumericTypes($p->toArray())
                    )->all(),
                    'pagination' => [
                        'current_page' => $projects->currentPage(),
                        'last_page'    => $projects->lastPage(),
                        'per_page'     => $projects->perPage(),
                        'total'        => $projects->total(),
                        'from'         => $projects->firstItem(),
                        'to'           => $projects->lastItem(),
                    ],
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Advanced search error', [
                'error'   => $e->getMessage(),
                'trace'   => $e->getTraceAsString(),
                'user_id' => $user->id ?? null,
            ]);

            return $this->errorResponse('خطأ في البحث', 'حدث خطأ أثناء البحث: ' . $e->getMessage(), 500, $e);
        }
    }

    public function getFullProjectDetails(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasRole($user, [UserRole::ADMIN, UserRole::PROJECT_MANAGER])) {
            return $this->unauthorizedResponse();
        }

        try {
            $project = ProjectProposal::with([
                'currency', 'shelter', 'projectType', 'subcategory',
                'assignedToTeam', 'assignedResearcher', 'photographer',
                'assignedMontageProducer', 'assignedBy', 'creator',
                'parentProject', 'executedProject',
                'surplusRecorder', 'surplusCategory', 'sponsoredOrphans',
            ])->find($id);

            if (!$project) {
                return $this->notFoundResponse('المشروع غير موجود');
            }

            $timeline = $project->timeline()
                ->with('changedBy:id,name')
                ->orderBy('created_at', 'desc')
                ->get();

            $dailyPhases = [];
            if ($project->is_divided_into_phases && $project->phase_type === 'daily') {
                $dailyPhases = ProjectProposal::where('parent_project_id', $project->id)
                    ->where('is_daily_phase', true)
                    ->with(['currency', 'shelter'])
                    ->orderBy('phase_day', 'asc')
                    ->get();
            }

            $monthlyPhases = [];
            if ($project->is_divided_into_phases && $project->phase_type === 'monthly') {
                $monthlyPhases = ProjectProposal::where('parent_project_id', $project->id)
                    ->where('is_monthly_phase', true)
                    ->with(['currency', 'shelter', 'sponsoredOrphans'])
                    ->orderBy('month_number', 'asc')
                    ->get();
            }

            $warehouseItems = $project->warehouseItems()->with('warehouseItem')->get();

            $additionalInfo = [
                'has_warehouse_items'              => $warehouseItems->isNotEmpty(),
                'confirmed_warehouse_items_count'  => $project->confirmedWarehouseItems()->count(),
                'pending_warehouse_items_count'    => $project->pendingWarehouseItems()->count(),
                'has_beneficiaries_file'           => $project->hasBeneficiariesFile(),
                'beneficiaries_count_from_db'      => $project->beneficiaries()->count(),
                'is_parent_project'                => $project->isParentProject(),
                'is_sponsorship_project'           => $project->isSponsorshipProject(),
                'has_surplus_recorded'             => !is_null($project->surplus_recorded_at),
                'has_shekel_conversion'            => $project->hasShekelConversion(),
                'days_since_creation'              => $project->getDaysSinceCreation(),
                'days_since_assignment'            => $project->getDaysSinceAssignment(),
            ];

            return response()->json([
                'success' => true,
                'data'    => [
                    'project'         => $this->ensureNumericTypes($project->toArray()),
                    'timeline'        => $timeline,
                    'daily_phases'    => $dailyPhases,
                    'monthly_phases'  => $monthlyPhases,
                    'warehouse_items' => $warehouseItems,
                    'additional_info' => $additionalInfo,
                ],
            ], 200);
        } catch (\Exception $e) {
            return $this->errorResponse('خطأ في جلب التفاصيل', $e->getMessage(), 500, $e);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  ADVANCED UPDATE
    // ═══════════════════════════════════════════════════════

    public function advancedUpdate(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasRole($user, [UserRole::ADMIN, UserRole::PROJECT_MANAGER])) {
            return $this->unauthorizedResponse();
        }

        try {
            $result = $this->advancedUpdateService->update($id, $request, $user);

            if (!$result['success']) {
                return $this->errorResponse('خطأ في التحديث', $result['error'], $result['code'] ?? 500);
            }

            $this->clearProjectsCache();
            return $this->successResponse(['data' => $result['data']], 'تم تحديث المشروع بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('خطأ في التحديث', $e->getMessage(), 500, $e);
        }
    }

    public function changeStatus(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasRole($user, [UserRole::ADMIN, UserRole::PROJECT_MANAGER])) {
            return $this->unauthorizedResponse();
        }

        try {
            $newStatus = $request->input('status');
            $note      = $request->input('note', '');

            $result = $this->advancedUpdateService->changeStatus($id, $newStatus, $note, $user, $request);

            if (!$result['success']) {
                return $this->errorResponse('خطأ في التغيير', $result['error'], $result['code'] ?? 500);
            }

            $this->clearProjectsCache();
            return $this->successResponse([
                'data' => [
                    'project'    => $result['data'],
                    'old_status' => $result['old_status'],
                    'new_status' => $result['new_status'],
                ],
            ], 'تم تغيير حالة المشروع بنجاح');
        } catch (\Exception $e) {
            return $this->errorResponse('خطأ في التغيير', $e->getMessage(), 500, $e);
        }
    }

    public function getDailyPhases(Request $request, int $id): JsonResponse
    {
        try {
            $data = $this->query->getDailyPhases($id);
            return $this->successResponse($data);
        } catch (\Exception $e) {
            return $this->errorResponse('خطأ في جلب المراحل', $e->getMessage(), 500, $e);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  ORPHAN SPONSORSHIP
    // ═══════════════════════════════════════════════════════

    public function addOrphansToProject(Request $request, int $id): JsonResponse
    {
        return $this->addOrphans($request, $id);
    }

    public function removeOrphanFromProject(Request $request, int $id, string $orphanId): JsonResponse
    {
        return $this->removeOrphan($request, $id, $orphanId);
    }

    public function getProjectOrphans(Request $request, int $id): JsonResponse
    {
        return $this->getProjectOrphansList($request, $id);
    }

    public function getOrphanProjects(Request $request, string $orphanId): JsonResponse
    {
        return $this->getOrphanProjectsList($request, $orphanId);
    }
}