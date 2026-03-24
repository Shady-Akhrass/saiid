<?php

namespace App\Http\Controllers;

use App\Models\ProjectProposal;
use App\Models\MediaArchive;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Helpers\NotificationHelper;

class MontageProducerProjectsController extends Controller
{
    /**
     * Get projects assigned to current montage producer
     */
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'montage_producer') {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات للوصول إلى هذه الصفحة'
                ], 403);
            }
            
            $query = ProjectProposal::assignedToMontageProducer($user->id);
            
            // فلترة حسب الحالة
            if ($request->has('status') && $request->status) {
                $statuses = is_array($request->status) ? $request->status : [$request->status];
                $query->whereIn('status', $statuses);
            } else {
                // الحالات الافتراضية: الحالية، المنجزة، المتأخرة، المعاد منتاجها
                $query->whereIn('status', ['في المونتاج', 'تم المونتاج', 'وصل للمتبرع', 'يجب إعادة المونتاج']);
            }
            
            // فلترة المشاريع الحالية
            if ($request->has('current_only') && $request->current_only) {
                $query->where('status', 'في المونتاج');
            }
            
            // فلترة المشاريع المنجزة
            if ($request->has('completed_only') && $request->completed_only) {
                $query->where('status', 'تم المونتاج');
            }
            
            // فلترة المشاريع المتأخرة
            if ($request->has('delayed_only') && $request->delayed_only) {
                $query->where('status', 'في المونتاج')
                      ->whereNotNull('montage_producer_assigned_at')
                      ->whereRaw('DATEDIFF(NOW(), montage_producer_assigned_at) > 5');
            }
            
            // فلترة المشاريع المعاد منتاجها
            if ($request->has('redone_only') && $request->redone_only) {
                $query->where('status', 'يجب إعادة المونتاج');
            }
            
            // ترتيب حسب تاريخ الإسناد
            $query->orderBy('montage_producer_assigned_at', 'DESC');
            
            $perPage = $request->query('perPage', 20);
            
            // تحميل العلاقات المطلوبة قبل pagination
            $query->with(['parentProject', 'currency']);
            
            $projects = $query->paginate($perPage);
            
            // إضافة معلومات إضافية لكل مشروع
            $projectsData = $projects->items();
            foreach ($projectsData as $project) {
                // حساب أيام التأخير
                if ($project->status === 'في المونتاج' && $project->montage_producer_assigned_at) {
                    $assignedAt = \Carbon\Carbon::parse($project->montage_producer_assigned_at);
                    $daysDelayed = max(0, $assignedAt->diffInDays(now()) - 5);
                    $project->days_delayed = $daysDelayed > 0 ? $daysDelayed : 0;
                } else {
                    $project->days_delayed = 0;
                }
                
                // ✅ إضافة donation_description و donor_name
                // إذا كان المشروع مشروع يومي، نأخذ البيانات من المشروع الأصلي
                if ($project->parentProject) {
                    $project->donation_description = $project->parentProject->project_description ?? null;
                    $project->donor_name = $project->parentProject->donor_name ?? $project->donor_name ?? null;
                } else {
                    $project->donation_description = $project->project_description ?? null;
                    // donor_name موجود بالفعل في المشروع، لا حاجة لتعديله
                }
            }
            
            return response()->json([
                'success' => true,
                'projects' => $projectsData,
                'total' => $projects->total(),
                'currentPage' => $projects->currentPage(),
                'totalPages' => $projects->lastPage(),
                'perPage' => $projects->perPage()
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error fetching montage producer projects', [
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب المشاريع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Show project details for montage producer
     */
    public function show(Request $request, $id)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'montage_producer') {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات للوصول إلى هذه الصفحة'
                ], 403);
            }
            
            $project = ProjectProposal::assignedToMontageProducer($user->id)
                ->findOrFail($id);
            
            // ✅ تحميل العلاقات المطلوبة
            $project->load([
                'currency',
                'parentProject', // ✅ تأكد من تحميل parentProject
                'assignedMontageProducer' => function($q) {
                    $q->select('id', 'name');
                }
            ]);
            
            // إضافة معلومات إضافية
            $project->days_delayed = 0;
            if ($project->status === 'في المونتاج' && $project->montage_producer_assigned_at) {
                $assignedAt = \Carbon\Carbon::parse($project->montage_producer_assigned_at);
                $daysDelayed = max(0, $assignedAt->diffInDays(now()) - 5);
                $project->days_delayed = $daysDelayed > 0 ? $daysDelayed : 0;
            }
            
            // ✅ تحديد donation_description و donor_name
            // قراءة donor_name مباشرة من المشروع أولاً (هذا هو المفتاح!)
            $donorName = $project->donor_name ?? null;
            $donationDescription = null; // ✅ تهيئة متغير donation_description
            
            // تحديد donation_description
            if ($project->parentProject) {
                // إذا كان هناك parentProject، نأخذ البيانات منه
                $donationDescription = $project->parentProject->description 
                    ?? $project->parentProject->project_description 
                    ?? null;
                
                // الجهة المتبرعة: من المشروع الأصلي أولاً
                if ($project->parentProject->donor_name) {
                    $donorName = $project->parentProject->donor_name;
                }
            } else {
                // للمشاريع العادية: نتحقق من description أولاً، ثم project_description
                // ملاحظة: description غير موجود في Model، نستخدم project_description فقط
                $donationDescription = $project->project_description ?? null;
            }
            
            // ✅ التأكد من أن donation_description محدد دائماً (حتى لو null)
            if ($donationDescription === null) {
                // إذا كان donation_description لا يزال null، نستخدم project_description كبديل
                $donationDescription = $project->project_description ?? null;
            }
            
            // ✅ بناء parent_project object
            $parentProjectData = null;
            if ($project->parentProject) {
                $parentProjectData = [
                    'id' => $project->parentProject->id,
                    'project_name' => $project->parentProject->project_name ?? null,
                    'donor_name' => $project->parentProject->donor_name ?? null,
                    'description' => $project->parentProject->description ?? null,
                    'project_description' => $project->parentProject->project_description ?? null,
                ];
            }
            
            // ✅ التأكد من أن donation_description محدد دائماً (حتى لو null)
            if (!isset($donationDescription)) {
                $donationDescription = $project->project_description ?? null;
            }
            
            // ✅ التأكد من أن donor_name محدد دائماً (حتى لو null)
            if (!isset($donorName)) {
                $donorName = $project->donor_name ?? null;
            }
            
            // ✅ التأكد من أن donation_description محدد دائماً (حتى لو null)
            // إذا كان null، نستخدم project_description كبديل
            if ($donationDescription === null || $donationDescription === '') {
                $donationDescription = $project->project_description ?? null;
            }
            
            // ✅ التأكد من أن donor_name محدد دائماً (حتى لو null)
            if ($donorName === null || $donorName === '') {
                $donorName = $project->donor_name ?? null;
            }
            
            // ✅ بناء response data - التأكد من إرسال جميع الحقول دائماً
            $responseData = [
                'success' => true,
                'project' => [
                    'id' => $project->id,
                    'serial_number' => $project->serial_number ?? null,
                    'donor_code' => $project->donor_code ?? null,
                    'internal_code' => $project->internal_code ?? null,
                    'project_name' => $project->project_name ?? null,
                    'project_description' => $project->project_description ?? null, // ✅ يُرسل دائماً (حتى لو null)
                    'donation_description' => $donationDescription, // ✅ إضافة وصف التبرع (يُرسل دائماً حتى لو null)
                    'donor_name' => $donorName, // ✅ إضافة الجهة المتبرعة (يُرسل دائماً حتى لو null)
                    'notes' => $project->notes ?? null,
                    'notes_image_url' => $project->notes_image_url ?? null,
                    'status' => $project->status ?? null,
                    'montage_producer_assigned_at' => $project->montage_producer_assigned_at ?? null,
                    'montage_completed_at' => $project->montage_completed_at ?? null,
                    'days_delayed' => $project->days_delayed ?? 0,
                    'currency' => $project->currency ? [
                        'id' => $project->currency->id,
                        'currency_code' => $project->currency->currency_code ?? null,
                        'currency_name' => $project->currency->currency_name_ar,
                        'currency_name_ar' => $project->currency->currency_name_ar,
                        'currency_name_en' => $project->currency->currency_name_en,
                    ] : null,
                    'parent_project' => $parentProjectData, // ✅ إضافة parent_project (يُرسل null إذا لم يكن موجوداً)
                ]
            ];
            
            // ✅ التحقق النهائي من وجود الحقول في الاستجابة - إضافة صريحة ومباشرة
            // إضافة الحقول بشكل صريح لضمان وجودها حتى لو كانت null
            $responseData['project']['project_description'] = $project->project_description ?? null;
            $responseData['project']['donation_description'] = $donationDescription ?? null;
            $responseData['project']['donor_name'] = $donorName ?? null;
            $responseData['project']['parent_project'] = $parentProjectData ?? null;
            
            // ✅ التحقق النهائي من وجود جميع الحقول المطلوبة
            $requiredFields = [
                'project_description',
                'donation_description',
                'donor_name',
                'parent_project'
            ];
            
            foreach ($requiredFields as $field) {
                if (!array_key_exists($field, $responseData['project'])) {
                    $responseData['project'][$field] = null;
                    Log::warning("Field {$field} was missing, added as null", ['project_id' => $project->id]);
                }
            }
            
            // ✅ التحقق النهائي قبل الإرسال - ضمان وجود جميع الحقول
            // إضافة الحقول بشكل صريح مرة أخرى قبل الإرسال (بعد باقي البيانات لضمان عدم الكتابة عليها)
            $responseData['project'] = array_merge($responseData['project'], [
                'project_description' => $project->project_description ?? null,
                'donation_description' => $donationDescription ?? null,
                'donor_name' => $donorName ?? null,
                'parent_project' => $parentProjectData ?? null,
            ]);
            
            // ✅ التحقق النهائي مرة أخرى - استخدام array_key_exists بدلاً من isset
            // لأن isset يعيد false للقيم null
            if (!array_key_exists('project_description', $responseData['project'])) {
                $responseData['project']['project_description'] = null;
                Log::warning('project_description was missing, added as null', ['project_id' => $project->id]);
            }
            if (!array_key_exists('donation_description', $responseData['project'])) {
                $responseData['project']['donation_description'] = null;
                Log::warning('donation_description was missing, added as null', ['project_id' => $project->id]);
            }
            if (!array_key_exists('donor_name', $responseData['project'])) {
                $responseData['project']['donor_name'] = null;
                Log::warning('donor_name was missing, added as null', ['project_id' => $project->id]);
            }
            if (!array_key_exists('parent_project', $responseData['project'])) {
                $responseData['project']['parent_project'] = null;
                Log::warning('parent_project was missing, added as null', ['project_id' => $project->id]);
            }
            
            // ✅ التأكد من أن القيم موجودة (حتى لو null) - إضافة صريحة
            $responseData['project']['project_description'] = $responseData['project']['project_description'] ?? null;
            $responseData['project']['donation_description'] = $responseData['project']['donation_description'] ?? null;
            $responseData['project']['donor_name'] = $responseData['project']['donor_name'] ?? null;
            $responseData['project']['parent_project'] = $responseData['project']['parent_project'] ?? null;
            
            // ✅ Debug: تسجيل البيانات بعد التحقق النهائي
            $responseProject = $responseData['project'];
            Log::info('Montage Producer Project Details - Before Response', [
                'project_id' => $project->id,
                'donor_name_from_project' => $project->donor_name,
                'donor_name_final' => $donorName,
                'has_parent_project' => !!$project->parentProject,
                'donation_description_value' => $donationDescription,
                'donation_description_type' => gettype($donationDescription),
                'project_description_value' => $project->project_description,
                'project_description_type' => gettype($project->project_description),
                'response_has_project_description' => array_key_exists('project_description', $responseProject),
                'response_has_donor_name' => array_key_exists('donor_name', $responseProject),
                'response_has_donation_description' => array_key_exists('donation_description', $responseProject),
                'response_has_parent_project' => array_key_exists('parent_project', $responseProject),
                'response_project_description_value' => array_key_exists('project_description', $responseProject) 
                    ? ($responseProject['project_description'] !== null ? $responseProject['project_description'] : 'NULL_VALUE') 
                    : 'NOT_SET',
                'response_donation_description_value' => array_key_exists('donation_description', $responseProject) 
                    ? ($responseProject['donation_description'] !== null ? $responseProject['donation_description'] : 'NULL_VALUE') 
                    : 'NOT_SET',
                'response_donor_name_value' => array_key_exists('donor_name', $responseProject) 
                    ? ($responseProject['donor_name'] !== null ? $responseProject['donor_name'] : 'NULL_VALUE') 
                    : 'NOT_SET',
                'response_all_keys' => array_keys($responseProject),
            ]);
            
            // ✅ إرسال الحقول في الاستجابة - هذا هو الجزء المهم!
            return response()->json($responseData, 200, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
        } catch (\Exception $e) {
            Log::error('Error fetching project details for montage producer', [
                'project_id' => $id,
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب تفاصيل المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Complete montage for a project
     */
    public function completeMontage(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'montage_producer') {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات لإكمال المونتاج'
                ], 403);
            }
            
            $project = ProjectProposal::assignedToMontageProducer($user->id)
                ->findOrFail($id);
            
            // التحقق من أن المشروع في حالة "في المونتاج"
            if ($project->status !== 'في المونتاج') {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن إكمال المونتاج',
                    'message' => 'المشروع ليس في حالة "في المونتاج"'
                ], 422);
            }
            
            $oldStatus = $project->status;
            
            // تحديث المشروع
            $project->update([
                'status' => 'تم المونتاج',
                'montage_completed_at' => now(),
                'montage_completed_date' => now()->toDateString(),
            ]);
            
            // تسجيل في Timeline
            $notes = $request->notes 
                ? "تم إكمال المونتاج من قبل ممنتج المونتاج. {$request->notes}"
                : 'تم إكمال المونتاج من قبل ممنتج المونتاج';
            $project->recordStatusChange($oldStatus, 'تم المونتاج', $user->id, $notes);
            
            // إرسال إشعار لمدير الإعلام
            NotificationHelper::createMontageCompletedByProducerNotification($project, $user);
            
            // مسح cache
            $this->clearProjectsCache();
            
            return response()->json([
                'success' => true,
                'message' => 'تم إكمال المونتاج بنجاح',
                'project' => [
                    'id' => $project->id,
                    'status' => $project->status,
                    'montage_completed_at' => $project->montage_completed_at,
                ]
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error completing montage', [
                'project_id' => $id,
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل إكمال المونتاج',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ تحديث حالة المشروع للمنتج
     * 
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:في المونتاج,تم المونتاج,يجب إعادة المونتاج,معاد مونتاجه,وصل للمتبرع',
            'notes' => 'nullable|string|max:500',
            'rejection_reason' => 'nullable|string',
        ], [
            'status.required' => 'يرجى تحديد الحالة',
            'status.in' => 'الحالة المختارة غير صحيحة',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'montage_producer') {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات لتحديث حالة المشروع'
                ], 403);
            }
            
            // ✅ التحقق من أن المشروع مسند للمنتج الحالي
            $project = ProjectProposal::assignedToMontageProducer($user->id)
                ->findOrFail($id);

            $oldStatus = $project->status;
            $oldMediaStatus = $project->status; // في هذا النظام status و media_status نفس الشيء
            $newStatus = $request->status;
            
            // ✅ التحقق من صحة الحالة
            $allowedStatuses = ['في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];
            if (!in_array($newStatus, $allowedStatuses)) {
                return response()->json([
                    'success' => false,
                    'message' => 'الحالة المختارة غير صحيحة'
                ], 400);
            }
            
            // ✅ تحديث حالة المشروع
            $updateData = ['status' => $newStatus];
            
            // ✅ تحديث الملاحظات إذا كانت موجودة
            if ($request->has('notes')) {
                $updateData['media_notes'] = $request->notes;
            }
            
            // ✅ إضافة سبب الرفض إذا كانت الحالة "معاد مونتاجه" أو "يجب إعادة المونتاج"
            if (in_array($newStatus, ['معاد مونتاجه', 'يجب إعادة المونتاج']) && $request->has('rejection_reason')) {
                $updateData['rejection_reason'] = $request->rejection_reason;
            }

            // ✅ تحديث التواريخ حسب الحالة
            if ($newStatus === 'في المونتاج' && !$project->montage_producer_assigned_at) {
                $updateData['montage_producer_assigned_at'] = now();
            }
            
            if ($newStatus === 'تم المونتاج') {
                $updateData['montage_completed_at'] = now();
                $updateData['montage_completed_date'] = now()->toDateString();
            }
            
            if (in_array($newStatus, ['معاد مونتاجه', 'يجب إعادة المونتاج'])) {
                // ✅ إعادة تعيين تواريخ المونتاج
                $updateData['montage_start_date'] = null;
                $updateData['montage_completed_at'] = null;
                $updateData['montage_completed_date'] = null;
            }
            
            if ($newStatus === 'وصل للمتبرع') {
                $updateData['sent_to_donor_date'] = now();
                $updateData['delivered_to_donor_at'] = now();
            }

            $project->update($updateData);
            $project->refresh();
            
            // ✅ إعادة تحميل المشروع مع العلاقات
            $project = $project->fresh()->load([
                'currency',
                'shelter',
                'projectType',
                'subcategory',
                'assignedToTeam',
                'assignedResearcher',
                'photographer',
                'assignedMontageProducer',
            ]);

            // ✅ تحديث اسم الممنتج في الأرشيف تلقائياً إذا كان المشروع موجوداً في الأرشيف
            // تحديث فقط إذا كان هناك ممنتج مسند للمشروع
            if ($project->assigned_montage_producer_id && $user) {
                MediaArchive::where('project_proposal_id', $project->id)
                    ->update(['producer_name' => $user->name]);
            }

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();
            try {
                \Illuminate\Support\Facades\Cache::tags(['projects', 'project-proposals'])->flush();
            } catch (\Exception $e) {
                // ✅ إذا كان cache store لا يدعم tagging، استخدم flush() مباشرة
                \Illuminate\Support\Facades\Cache::flush();
            }

            // ✅ تسجيل في Timeline
            $notes = $request->notes 
                ? "تم تحديث حالة المشروع من قبل ممنتج المونتاج. {$request->notes}"
                : 'تم تحديث حالة المشروع من قبل ممنتج المونتاج';
            $project->recordStatusChange($oldStatus, $newStatus, $user->id, $notes);

            // ✅ إنشاء إشعار تحديث المونتاج
            NotificationHelper::createMediaUpdatedNotification(
                $project,
                $newStatus,
                $request->notes ?? null,
                $user
            );

            // ✅ إذا تغيرت حالة المشروع، إنشاء إشعار تغيير الحالة
            if ($oldStatus !== $newStatus) {
                NotificationHelper::createProjectStatusChangedNotification(
                    $project,
                    $oldStatus,
                    $newStatus,
                    $user
                );
            }

            // ✅ إرجاع بيانات المشروع المحدثة
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث حالة المشروع بنجاح',
                'project' => $project, // ✅ إرجاع المشروع المحدث
                'old_status' => $oldStatus,
                'new_status' => $project->status,
                'old_media_status' => $oldMediaStatus,
                'new_media_status' => $newStatus,
            ], 200);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود أو غير مسند لك'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error updating montage project status', [
                'project_id' => $id,
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'حدث خطأ أثناء تحديث الحالة',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * مسح cache المشاريع
     */
    private function clearProjectsCache(): void
    {
        try {
            if (method_exists(\Illuminate\Support\Facades\Cache::getStore(), 'tags')) {
                \Illuminate\Support\Facades\Cache::tags(['projects'])->flush();
            } else {
                \Illuminate\Support\Facades\Cache::flush();
            }
        } catch (\Exception $e) {
            Log::warning('Failed to clear projects cache', [
                'error' => $e->getMessage()
            ]);
        }
    }
}
