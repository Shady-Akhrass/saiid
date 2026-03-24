<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectProposal;
use App\Models\ProjectTimeline;
use App\Models\Notification;
use App\Models\User;
use App\Models\Shelter;
use App\Exports\ProjectsExport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Facades\Excel;

class ProjectController extends Controller
{
    /**
     * Create a new project
     * Allows adding projects regardless of existing incomplete projects
     */
    public function create(Request $request)
    {
        // ✅ التحقق من الصلاحيات: Admin أو Executed Projects Coordinator فقط
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'يجب تسجيل الدخول أولاً'
            ], 401);
        }
        
        // ✅ التحقق من الدور
        $userRole = strtolower($user->role ?? '');
        if (!in_array($userRole, ['admin', 'executed_projects_coordinator'])) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات لإضافة مشروع. الصلاحيات مقتصرة على الإدارة ومنسق المشاريع المنفذة فقط.'
            ], 403);
        }
        
        // ✅ Log البيانات المرسلة للمساعدة في التشخيص
        \Log::info('Creating project - Request data:', [
            'user_id' => $user->id,
            'user_role' => $user->role,
            'request_data' => $request->all(),
        ]);

        // ✅ إذا كان المشروع مستورداً من ProjectProposal، جلب البيانات المفقودة
        $sourceProject = null;
        if ($request->source_project_id) {
            $sourceProject = ProjectProposal::find($request->source_project_id);
            
            if ($sourceProject) {
                // ✅ ملء الحقول المفقودة من ProjectProposal
                if (empty($request->project_name) && !empty($sourceProject->project_name)) {
                    $request->merge(['project_name' => $sourceProject->project_name]);
                }
                
                if (empty($request->aid_type) && !empty($sourceProject->project_type)) {
                    $request->merge(['aid_type' => $sourceProject->project_type]);
                }
                
                if (empty($request->shelter_id) && !empty($sourceProject->shelter_id)) {
                    // ✅ التحقق من وجود shelter_id في جدول shelters
                    $shelterId = (string) $sourceProject->shelter_id; // ✅ تحويل إلى string
                    $shelterExists = Shelter::where('manager_id_number', $shelterId)->exists();
                    if ($shelterExists) {
                        $request->merge(['shelter_id' => $shelterId]);
                    } else {
                        \Log::warning('Source project shelter_id not found in shelters table:', [
                            'source_project_id' => $sourceProject->id,
                            'shelter_id_from_proposal' => $sourceProject->shelter_id,
                            'shelter_id_converted' => $shelterId,
                        ]);
                    }
                }
                
                if (empty($request->quantity) && !empty($sourceProject->quantity)) {
                    $request->merge(['quantity' => (int) $sourceProject->quantity]);
                } elseif (empty($request->quantity)) {
                    $request->merge(['quantity' => 1]); // قيمة افتراضية
                }
            }
        }

        // ✅ تحويل quantity إلى integer إذا كان string
        if ($request->has('quantity') && is_string($request->quantity)) {
            $request->merge(['quantity' => (int) $request->quantity]);
        }
        
        // ✅ تحويل shelter_id إلى string إذا كان رقماً
        // لأن manager_id_number في جدول shelters هو string
        if ($request->has('shelter_id')) {
            $shelterId = $request->shelter_id;
            if (is_numeric($shelterId) || is_int($shelterId)) {
                $request->merge(['shelter_id' => (string) $shelterId]);
            }
        }

        // ✅ تحويل status "تم التنفيذ" إلى "مكتمل" لأن Project model لا يدعم "تم التنفيذ"
        // "تم التنفيذ" هو status خاص بـ ProjectProposal، أما Project فيستخدم "مكتمل" أو "غير مكتمل"
        if ($request->has('status') && $request->status === 'تم التنفيذ') {
            $request->merge(['status' => 'مكتمل']);
        }

        // Validate input
        $validator = Validator::make($request->all(), [
            'project_name' => 'required|string|min:3',
            'aid_type' => 'required|string',
            'quantity' => 'required|integer|min:1',
            'shelter_id' => 'required|string|exists:shelters,manager_id_number',
            'execution_date' => 'required|date',
            'status' => 'nullable|in:مكتمل,غير مكتمل',
            'source_project_id' => 'nullable|exists:project_proposals,id',
        ], [
            'project_name.required' => 'اسم المشروع مطلوب',
            'project_name.min' => 'اسم المشروع يجب أن يكون على الأقل 3 أحرف',
            'aid_type.required' => 'نوع المساعدة مطلوب',
            'quantity.required' => 'الكمية مطلوبة',
            'quantity.integer' => 'الكمية يجب أن تكون رقماً',
            'quantity.min' => 'الكمية يجب أن تكون أكبر من صفر',
            'shelter_id.required' => 'المخيم مطلوب. يرجى اختيار مخيم من القائمة.',
            'shelter_id.exists' => 'المخيم المحدد غير موجود في قاعدة البيانات. يرجى التحقق من رقم المخيم أو اختيار مخيم آخر.',
            'execution_date.required' => 'تاريخ التنفيذ مطلوب',
            'execution_date.date' => 'تاريخ التنفيذ يجب أن يكون تاريخاً صحيحاً',
            'status.in' => 'حالة المشروع يجب أن تكون إما "مكتمل" أو "غير مكتمل"',
            'source_project_id.exists' => 'المشروع المصدر المحدد غير موجود',
        ]);

        if ($validator->fails()) {
            \Log::warning('Project creation validation failed:', [
                'errors' => $validator->errors()->toArray(),
                'request_data' => $request->all(),
                'source_project' => $sourceProject ? [
                    'id' => $sourceProject->id,
                    'project_name' => $sourceProject->project_name,
                    'project_type' => $sourceProject->project_type,
                    'shelter_id' => $sourceProject->shelter_id,
                    'quantity' => $sourceProject->quantity,
                ] : null,
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'البيانات المدخلة غير صحيحة',
                'errors' => $validator->errors()
            ], 400);
        }

        // ✅ Create project
        try {
            $project = Project::create([
                'project_name' => $request->project_name,
                'aid_type' => $request->aid_type,
                'quantity' => $request->quantity,
                'shelter_id' => $request->shelter_id,
                'execution_date' => $request->execution_date,
                'status' => $request->status ?? 'غير مكتمل',
                'source_project_id' => $request->source_project_id,
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to create project:', [
                'error' => $e->getMessage(),
                'request_data' => $request->all(),
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'فشل إنشاء المشروع',
                'error' => $e->getMessage()
            ], 500);
        }

        // ✅ إذا كان المشروع مستورداً من ProjectProposal، تحديث معلوماته فقط (بدون تغيير الحالة)
        // ✅ الحالة تبقى كما هي - فقط مدير المشاريع يمكنه تغييرها إلى "تم التنفيذ" يدوياً
        if ($request->source_project_id) {
            // ✅ استخدام $sourceProject الذي تم جلبه سابقاً
            if (!$sourceProject) {
                $sourceProject = ProjectProposal::find($request->source_project_id);
            }
            
            if ($sourceProject) {
                // ✅ تحديث معلومات المشروع المصدر فقط (بدون تغيير الحالة)
                // ✅ الحالة تبقى كما هي (جاهز للتنفيذ، تم اختيار المخيم، قيد التنفيذ)
                // ✅ فقط مدير المشاريع يمكنه تغيير الحالة إلى "تم التنفيذ" يدوياً
                $updateData = [
                    'project_id' => $project->id,
                    'transferred_to_projects' => true,
                ];
                
                // ✅ تحديث shelter_id فقط إذا لم يكن موجوداً
                if (!$sourceProject->shelter_id && $request->shelter_id) {
                    $updateData['shelter_id'] = $request->shelter_id;
                }
                
                // ✅ تحديث execution_date فقط إذا لم يكن موجوداً
                if (!$sourceProject->execution_date && $request->execution_date) {
                    $updateData['execution_date'] = $request->execution_date;
                }
                
                $sourceProject->update($updateData);

                // ✅ إضافة سجل في timeline (بدون تغيير الحالة)
                // ✅ الحصول على المستخدم الحالي أو أول مستخدم admin موجود
                $userId = null;
                if ($request->user() && $request->user()->id) {
                    $userId = $request->user()->id;
                } else {
                    // ✅ إذا لم يكن هناك مستخدم مسجل دخول، نستخدم أول مستخدم admin موجود
                    $adminUser = User::where('role', 'admin')->first();
                    if ($adminUser) {
                        $userId = $adminUser->id;
                    } else {
                        // ✅ إذا لم يكن هناك admin، نستخدم أول مستخدم موجود
                        $firstUser = User::first();
                        if ($firstUser) {
                            $userId = $firstUser->id;
                        }
                    }
                }
                
                // ✅ إضافة سجل في timeline (بدون تغيير الحالة)
                if ($userId) {
                    $sourceProject->recordStatusChange(
                        $sourceProject->status, // ✅ الحالة القديمة = الحالة الجديدة (لا تغيير)
                        $sourceProject->status, // ✅ الحالة الجديدة = الحالة القديمة (لا تغيير)
                        $userId,
                        "تم نقل المشروع للمشاريع المنفذة (مشروع منفذ #{$project->id}) - الحالة: {$sourceProject->status}"
                    );
                } else {
                    \Log::warning('Cannot record timeline entry: No user found', [
                        'project_id' => $sourceProject->id,
                        'status' => $sourceProject->status,
                    ]);
                }
                
                // ✅ مسح cache للمشاريع بعد تحديث ProjectProposal
                $this->clearProjectsCache();
            }
        }

        // Load shelter relationship
        $project->load('shelter');

        // ✅ مسح cache للمشاريع المنفذة بعد الإنشاء
        $this->clearExecutedProjectsCache();

        return response()->json([
            'success' => true,
            'message' => $request->source_project_id 
                ? 'تم إنشاء المشروع بنجاح. تم ربط المشروع المصدر بالمشروع المنفذ.'
                : 'تم إنشاء المشروع بنجاح',
            'data' => $project,
            'source_project_updated' => $request->source_project_id ? true : false,
        ], 201);
    }

    /**
     * مسح cache للمشاريع
     * يتم استدعاؤها عند تحديث ProjectProposal
     */
    private function clearProjectsCache(): void
    {
        try {
            // ✅ استخدام Cache tags إذا كان متاحاً (Redis/Memcached)
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['projects'])->flush();
            } else {
                // ✅ في حالة عدم دعم tags، نمسح فقط cache keys التي تبدأ بـ 'projects_'
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    // Redis - مسح keys محددة
                    $redis = $cacheDriver->getRedis();
                    $keys = $redis->keys('*projects_*');
                    if (!empty($keys)) {
                        $redis->del($keys);
                    }
                } else {
                    // Fallback: مسح جميع cache (للملفات/قاعدة البيانات)
                    Cache::flush();
                }
            }
        } catch (\Exception $e) {
            // ✅ في حالة فشل مسح cache، نستمر بدون خطأ
            Log::warning('Failed to clear projects cache', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * مسح cache للمشاريع المنفذة
     */
    private function clearExecutedProjectsCache(): void
    {
        try {
            // ✅ استخدام Cache tags إذا كان متاحاً (Redis/Memcached)
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['projects', 'executed_projects'])->flush();
            } else {
                // ✅ في حالة عدم دعم tags، نمسح cache keys المتعلقة
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    // Redis - مسح keys محددة
                    $redis = $cacheDriver->getRedis();
                    $patterns = ['*projects_*', '*executed*'];
                    foreach ($patterns as $pattern) {
                        $keys = $redis->keys($pattern);
                        if (!empty($keys)) {
                            $redis->del($keys);
                        }
                    }
                } else {
                    // Fallback: مسح جميع cache
                    Cache::flush();
                }
            }
        } catch (\Exception $e) {
            // ✅ في حالة فشل مسح cache، نستمر بدون خطأ
            Log::warning('Failed to clear executed projects cache', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Fetch projects with pagination and search
     */
    public function fetchProjects(Request $request)
    {
        $searchQuery = trim((string) $request->query('searchQuery', ''));

        // perPage & page with safe bounds
        $perPage = (int) $request->query('perPage', 10);
        $perPage = max(1, min($perPage, 100)); // حد أقصى 100 لكل صفحة
        $page = (int) $request->query('page', 1);

        // Optional filters
        $status = $request->query('status'); // يمكن أن تكون قيمة مثل "مكتمل" أو "غير مكتمل" أو "الكل"
        $executionDateFrom = $request->query('execution_date_from');
        $executionDateTo   = $request->query('execution_date_to');

        $searchFields = [
            'project_name',
            'aid_type',
            'status',
        ];

        $query = Project::with('shelter');

        // بحث نصّي بسيط في الحقول الأساسية + اسم المخيم
        if ($searchQuery !== '') {
            $query->where(function (Builder $query) use ($searchFields, $searchQuery) {
                foreach ($searchFields as $field) {
                    $query->orWhere($field, 'LIKE', "%{$searchQuery}%");
                }
                // Also search in shelter name
                $query->orWhereHas('shelter', function ($q) use ($searchQuery) {
                    $q->where('camp_name', 'LIKE', "%{$searchQuery}%");
                });
            });
        }

        // فلترة بالحالة (إذا أُرسلت وليست "الكل")
        if ($status !== null && $status !== '' && !in_array($status, ['all', 'الكل'], true)) {
            $query->where('status', $status);
        }

        // فلترة بتاريخ التنفيذ
        if (!empty($executionDateFrom)) {
            $query->whereDate('execution_date', '>=', $executionDateFrom);
        }
        if (!empty($executionDateTo)) {
            $query->whereDate('execution_date', '<=', $executionDateTo);
        }

        // استخدام paginate بدلاً من offset/limit لتحسين الأداء
        $projects = $query->orderBy('created_at', 'DESC')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'success'       => true,
            'projects'      => $projects->items(),
            'totalProjects' => $projects->total(),
            'perPage'       => $projects->perPage(),
            'currentPage'   => $projects->currentPage(),
            'totalPages'    => $projects->lastPage(),
        ], 200);
    }

    /**
     * Get a single project by ID
     */
    public function show($id)
    {
        $project = Project::with('shelter')->find($id);

        if (!$project) {
            return response()->json([
                'error' => 'المشروع غير موجود'
            ], 404);
        }

        return response()->json([
            'data' => $project
        ], 200);
    }

    /**
     * Update a project
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        
        // التحقق من الصلاحيات: Admin أو Executed Projects Coordinator فقط
        if (!$user) {
            return response()->json([
                'error' => 'غير مصرح',
                'message' => 'يجب تسجيل الدخول أولاً'
            ], 401);
        }
        
        // إعادة تحميل المستخدم من قاعدة البيانات
        $user->refresh();
        $userRole = strtolower($user->role ?? '');
        
        if (!in_array($userRole, ['admin', 'executed_projects_coordinator'])) {
            return response()->json([
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات لتعديل المشروع. الصلاحيات مقتصرة على الإدارة ومنسق المشاريع المنفذة فقط.'
            ], 403);
        }
        
        $project = Project::find($id);

        if (!$project) {
            return response()->json([
                'error' => 'المشروع غير موجود'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'project_name' => 'sometimes|required|string|min:3',
            'aid_type' => 'sometimes|required|string',
            'quantity' => 'sometimes|required|integer|min:1',
            'shelter_id' => 'sometimes|required|string|exists:shelters,manager_id_number',
            'execution_date' => 'sometimes|required|date',
            'status' => 'sometimes|nullable|in:مكتمل,غير مكتمل',
        ], [
            'project_name.required' => 'اسم المشروع مطلوب',
            'project_name.min' => 'اسم المشروع يجب أن يكون على الأقل 3 أحرف',
            'aid_type.required' => 'نوع المساعدة مطلوب',
            'quantity.required' => 'الكمية مطلوبة',
            'quantity.integer' => 'الكمية يجب أن تكون رقماً',
            'quantity.min' => 'الكمية يجب أن تكون أكبر من صفر',
            'shelter_id.required' => 'المخيم مطلوب',
            'shelter_id.exists' => 'المخيم المحدد غير موجود',
            'execution_date.required' => 'تاريخ التنفيذ مطلوب',
            'execution_date.date' => 'تاريخ التنفيذ يجب أن يكون تاريخاً صحيحاً',
            'status.in' => 'حالة المشروع يجب أن تكون إما "مكتمل" أو "غير مكتمل"',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            // تجهيز البيانات للتحديث (فقط الحقول المرسلة)
            $updateData = [];
            if ($request->has('project_name')) {
                $updateData['project_name'] = $request->project_name;
            }
            if ($request->has('aid_type')) {
                $updateData['aid_type'] = $request->aid_type;
            }
            if ($request->has('quantity')) {
                $updateData['quantity'] = $request->quantity;
            }
            if ($request->has('shelter_id')) {
                $updateData['shelter_id'] = $request->shelter_id;
            }
            if ($request->has('execution_date')) {
                $updateData['execution_date'] = $request->execution_date;
            }
            if ($request->has('status')) {
                $updateData['status'] = $request->status;
            }

            // تحديث المشروع
            if (!empty($updateData)) {
                $project->update($updateData);
                // إعادة تحميل المشروع من قاعدة البيانات لضمان الحصول على البيانات المحدثة
                $project->refresh();
            }

            // إذا تم تحديث حالة المشروع إلى "مكتمل"، نقوم بحساب رضا المخيم تلقائياً
            if ($request->has('status') && $request->status === 'مكتمل') {
                $this->calculateShelterSatisfaction($project, $request->user()->id ?? 1);
                // إعادة تحميل المشروع بعد حساب رضا المخيم
                $project->refresh();
            }

            // تحميل العلاقات
            $project->load('shelter');

            // ✅ مسح cache للمشاريع المنفذة بعد التحديث
            $this->clearExecutedProjectsCache();

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث المشروع بنجاح',
                'data' => $project
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate shelter satisfaction automatically
     */
    private function calculateShelterSatisfaction($project, $userId)
    {
        $shelter = Shelter::where('manager_id_number', $project->shelter_id)->first();
        
        if (!$shelter || !$shelter->number_of_families) {
            return;
        }

        $quantity = $project->quantity ?? 0;
        $numberOfFamilies = $shelter->number_of_families;

        if ($quantity >= $numberOfFamilies) {
            $project->shelter_satisfaction_status = 'مكتفي';
            $project->satisfaction_shortfall = 0;
        } else {
            $project->shelter_satisfaction_status = 'يحتاج المزيد';
            $project->satisfaction_shortfall = $numberOfFamilies - $quantity;
        }

        $project->satisfaction_recorded_by = $userId;
        $project->satisfaction_recorded_at = now();
        $project->save();
    }

    /**
     * Manually update shelter satisfaction status
     */
    public function updateShelterSatisfaction(Request $request, $id)
    {
        $user = $request->user();
        
        // التحقق من الصلاحيات: Admin أو Executed Projects Coordinator فقط
        if (!$user) {
            return response()->json([
                'error' => 'غير مصرح',
                'message' => 'يجب تسجيل الدخول أولاً'
            ], 401);
        }
        
        // إعادة تحميل المستخدم من قاعدة البيانات
        $user->refresh();
        $userRole = strtolower($user->role ?? '');
        
        if (!in_array($userRole, ['admin', 'executed_projects_coordinator'])) {
            return response()->json([
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات لتحديث حالة رضا المخيم. الصلاحيات مقتصرة على الإدارة ومنسق المشاريع المنفذة فقط.'
            ], 403);
        }
        
        $validator = Validator::make($request->all(), [
            'shelter_satisfaction_status' => 'required|in:مكتفي,يحتاج المزيد',
            'satisfaction_shortfall' => 'required_if:shelter_satisfaction_status,يحتاج المزيد|nullable|integer|min:0',
        ], [
            'shelter_satisfaction_status.required' => 'يرجى تحديد حالة رضا المخيم',
            'satisfaction_shortfall.required_if' => 'يرجى تحديد العجز عند اختيار "يحتاج المزيد"',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $project = Project::findOrFail($id);

            $project->shelter_satisfaction_status = $request->shelter_satisfaction_status;
            $project->satisfaction_shortfall = $request->shelter_satisfaction_status === 'يحتاج المزيد' 
                ? $request->satisfaction_shortfall 
                : 0;
            $project->satisfaction_recorded_by = $request->user()->id;
            $project->satisfaction_recorded_at = now();
            $project->save();

            $project->load('shelter');

            // ✅ مسح cache للمشاريع المنفذة بعد التحديث
            $this->clearExecutedProjectsCache();

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث حالة رضا المخيم بنجاح',
                'project' => $project
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث حالة رضا المخيم',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a project
     */
    public function destroy($id)
    {
        $project = Project::find($id);

        if (!$project) {
            return response()->json([
                'error' => 'المشروع غير موجود'
            ], 404);
        }

        $project->delete();

        // ✅ مسح cache للمشاريع المنفذة بعد الحذف
        $this->clearExecutedProjectsCache();

        return response()->json([
            'message' => 'تم حذف المشروع بنجاح'
        ], 200);
    }


    /**
     * Get shelters list for dropdown (with availability status)
     */
    public function getSheltersList(Request $request)
    {
        try {
            $searchQuery = $request->query('search');

            $query = Shelter::query();

            if ($searchQuery) {
                $query->where(function($q) use ($searchQuery) {
                    $q->where('camp_name', 'LIKE', "%{$searchQuery}%")
                      ->orWhere('manager_name', 'LIKE', "%{$searchQuery}%");
                });
            }

            // جلب جميع المخيمات أولاً
            $shelters = $query->select('manager_id_number', 'camp_name', 'governorate', 'district')
                ->orderBy('camp_name', 'ASC')
                ->get();

            // جلب عدد المشاريع غير المكتملة لكل مخيم في query واحد لتجنب N+1
            $shelterIds = $shelters->pluck('manager_id_number');
            $incompleteProjectsCounts = Project::whereIn('shelter_id', $shelterIds)
                ->where('status', 'غير مكتمل')
                ->selectRaw('shelter_id, COUNT(*) as count')
                ->groupBy('shelter_id')
                ->pluck('count', 'shelter_id');

            // تحويل البيانات مع استخدام البيانات المجمعة
            $shelters = $shelters->map(function ($shelter) use ($incompleteProjectsCounts) {
                return [
                    'id' => $shelter->manager_id_number,
                    'name' => $shelter->camp_name,
                    'governorate' => $shelter->governorate,
                    'district' => $shelter->district,
                    'can_add_project' => true, // Always allow adding projects regardless of incomplete projects
                    'incomplete_projects_count' => $incompleteProjectsCounts->get($shelter->manager_id_number, 0),
                ];
            });

            return response()->json([
                'success' => true,
                'shelters' => $shelters,
                'count' => $shelters->count()
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب قائمة المخيمات',
                'message' => $e->getMessage(),
                'shelters' => []
            ], 500);
        }
    }

    /**
     * Export projects to Excel with date and status filtering
     */
    public function exportProjectsToExcel(Request $request)
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $statuses = $request->query('statuses');

        // التحقق من صحة التواريخ إذا تم إرسالها
        if ($startDate && !strtotime($startDate)) {
            return response()->json([
                'success' => false,
                'error' => 'تاريخ البداية غير صحيح',
                'message' => 'يجب أن يكون تاريخ البداية بصيغة صحيحة (YYYY-MM-DD)'
            ], 400);
        }

        if ($endDate && !strtotime($endDate)) {
            return response()->json([
                'success' => false,
                'error' => 'تاريخ النهاية غير صحيح',
                'message' => 'يجب أن يكون تاريخ النهاية بصيغة صحيحة (YYYY-MM-DD)'
            ], 400);
        }

        // التحقق من أن تاريخ البداية قبل تاريخ النهاية
        if ($startDate && $endDate && strtotime($startDate) > strtotime($endDate)) {
            return response()->json([
                'success' => false,
                'error' => 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
                'message' => 'الرجاء التحقق من التواريخ المدخلة'
            ], 400);
        }

        // معالجة الحالات - دعم مصفوفة أو قيمة واحدة أو قيم مفصولة بفواصل
        $statusArray = null;
        if ($statuses) {
            if (is_array($statuses)) {
                $statusArray = $statuses;
            } elseif (is_string($statuses)) {
                // محاولة تحليل JSON إذا كان مرسلاً كسلسلة
                $decoded = json_decode($statuses, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $statusArray = $decoded;
                } elseif (strpos($statuses, ',') !== false) {
                    // إذا كانت القيمة مفصولة بفواصل، قم بتقسيمها
                    $statusArray = array_map('trim', explode(',', $statuses));
                } else {
                    // إذا لم يكن JSON أو مفصول بفواصل، استخدمه كقيمة واحدة
                    $statusArray = [$statuses];
                }
            }
        }
        
        // أيضاً دعم status (مفرد) للتوافق مع الكود القديم
        $singleStatus = $request->query('status');
        if ($singleStatus && !$statusArray) {
            if ($singleStatus !== 'all' && $singleStatus !== 'الكل') {
                $statusArray = [$singleStatus];
            }
        }

        // التحقق من وجود مشاريع قبل التصدير
        $query = Project::query();
        
        if ($startDate) {
            $query->where('execution_date', '>=', $startDate);
        }
        
        if ($endDate) {
            $query->where('execution_date', '<=', $endDate);
        }
        
        if ($statusArray && count($statusArray) > 0) {
            // إزالة القيم الفارغة
            $statusArray = array_filter($statusArray, function($status) {
                return !empty($status) && $status !== 'all' && $status !== 'الكل';
            });
            
            if (count($statusArray) > 0) {
                $query->whereIn('status', $statusArray);
            }
        }

        $projectsCount = $query->count();
        
        if ($projectsCount === 0) {
            return response()->json([
                'success' => false,
                'error' => 'لا يوجد مشاريع للتصدير',
                'message' => 'لا توجد مشاريع تطابق معايير الفلترة المحددة'
            ], 404);
        }

        // إنشاء اسم الملف بناءً على التواريخ والحالات
        $fileName = 'projects';
        if ($startDate && $endDate) {
            $fileName .= '_' . $startDate . '_to_' . $endDate;
        } elseif ($startDate) {
            $fileName .= '_from_' . $startDate;
        } elseif ($endDate) {
            $fileName .= '_until_' . $endDate;
        }
        
        if ($statusArray && count($statusArray) > 0) {
            $statusStr = implode('_', array_map(function($s) {
                return str_replace(' ', '_', $s);
            }, $statusArray));
            $fileName .= '_status_' . $statusStr;
        }
        
        $fileName .= '.xlsx';

        try {
            return Excel::download(new ProjectsExport($startDate, $endDate, $statusArray), $fileName);
        } catch (\Exception $e) {
            Log::error('Error exporting projects to Excel: ' . $e->getMessage(), [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'statuses' => $statusArray,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'فشل تصدير البيانات',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
