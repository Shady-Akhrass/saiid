<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\ProjectProposal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class MontageProducerController extends Controller
{
    /**
     * Get all montage producers (Media Manager only)
     */
    public function index(Request $request)
    {
        try {
            $query = User::byRole('montage_producer');
            
            // فلترة حسب الحالة (اختياري)
            if ($request->has('is_active')) {
                $isActive = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN);
                if ($isActive) {
                    $query->active();
                } else {
                    $query->where('is_active', false);
                }
            }
            
            // بحث
            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                      ->orWhere('email', 'LIKE', "%{$search}%")
                      ->orWhere('phone_number', 'LIKE', "%{$search}%");
                });
            }
            
            // Pagination
            $perPage = $request->query('perPage', 10);
            $producers = $query->select('id', 'name', 'email', 'phone_number', 'role', 'department', 'is_active', 'created_at', 'updated_at')
                          ->orderBy('name')
                          ->paginate($perPage);
            
            // إزالة email و password من الـ response
            $producers->getCollection()->transform(function ($producer) {
                return $producer->makeHidden(['email', 'password']);
            });
            
            return response()->json([
                'success' => true,
                'producers' => $producers->items(),
                'total' => $producers->total(),
                'currentPage' => $producers->currentPage(),
                'totalPages' => $producers->lastPage(),
                'perPage' => $producers->perPage()
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error fetching montage producers', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب ممنتجي المونتاج',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a new montage producer (Media Manager only)
     */
    public function store(Request $request)
    {
        // ✅ Logging البيانات المرسلة للتشخيص
        Log::info('Creating montage producer', [
            'request_data' => $request->all(),
            'user_id' => $request->user()?->id,
        ]);

        // ✅ تنظيف البيانات - إزالة القيم الفارغة
        $data = $request->all();
        
        // تنظيف name
        if (isset($data['name'])) {
            $data['name'] = trim($data['name']);
            if (empty($data['name'])) {
                unset($data['name']);
            }
        }
        
        // تنظيف email
        if (isset($data['email'])) {
            $data['email'] = trim($data['email']);
            if (empty($data['email'])) {
                unset($data['email']);
            }
        }
        
        // تنظيف code
        if (isset($data['code'])) {
            $data['code'] = trim($data['code']);
            if (empty($data['code'])) {
                unset($data['code']);
            }
        }
        
        // تنظيف phone_number
        if (isset($data['phone_number'])) {
            $data['phone_number'] = trim($data['phone_number']);
            if (empty($data['phone_number'])) {
                unset($data['phone_number']);
            }
        }
        
        // تنظيف password
        if (isset($data['password'])) {
            $data['password'] = trim($data['password']);
            if (empty($data['password'])) {
                unset($data['password']);
            }
        }

        // ✅ التحقق من أن email أو code موجود (واحد على الأقل)
        $validator = Validator::make($data, [
            'name' => 'required|string|min:3|max:255',
            'email' => 'nullable|string|max:255',
            'phone_number' => 'nullable|string|max:20',
            'password' => 'nullable|string|min:8|max:255',
            'code' => 'nullable|string|min:1|max:100', // كود بديل للبريد الإلكتروني
        ], [
            'name.required' => 'يرجى إدخال الاسم',
            'name.min' => 'الاسم يجب أن يكون 3 أحرف على الأقل',
            'name.max' => 'الاسم يجب أن يكون أقل من 255 حرف',
            'name.string' => 'الاسم يجب أن يكون نص',
            'email.max' => 'البريد الإلكتروني يجب أن يكون أقل من 255 حرف',
            'phone_number.max' => 'رقم الجوال يجب أن يكون أقل من 20 حرف',
            'password.min' => 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
            'password.max' => 'كلمة المرور يجب أن تكون أقل من 255 حرف',
            'code.min' => 'الكود يجب أن يكون حرف واحد على الأقل',
            'code.max' => 'الكود يجب أن يكون أقل من 100 حرف',
        ]);

        // ✅ التحقق من أن email أو code موجود (واحد على الأقل)
        $validator->after(function ($validator) use ($data) {
            // التحقق من أن email أو code موجود (واحد على الأقل)
            $hasEmail = isset($data['email']) && !empty(trim($data['email'] ?? ''));
            $hasCode = isset($data['code']) && !empty(trim($data['code'] ?? ''));
            
            if (!$hasEmail && !$hasCode) {
                $validator->errors()->add('email', 'يرجى إدخال البريد الإلكتروني أو الكود');
                $validator->errors()->add('code', 'يرجى إدخال البريد الإلكتروني أو الكود');
            }

            // ✅ التحقق من email إذا كان موجوداً
            if ($hasEmail) {
                $email = trim($data['email']);
                // التحقق من صيغة البريد الإلكتروني
                if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $validator->errors()->add('email', 'البريد الإلكتروني غير صحيح');
                }
                // التحقق من التكرار
                if (User::where('email', $email)->exists()) {
                    $validator->errors()->add('email', 'البريد الإلكتروني موجود مسبقاً');
                }
            }

            // ✅ التحقق من أن code + '@montage.local' غير موجود في email إذا تم إرسال code فقط
            if ($hasCode && !$hasEmail) {
                $codeEmail = trim($data['code']) . '@montage.local';
                $exists = User::where('email', $codeEmail)->exists();
                if ($exists) {
                    $validator->errors()->add('code', 'الكود موجود مسبقاً');
                }
            }

            // ✅ التحقق من phone_number بشكل منفصل (إذا كان موجوداً)
            if (isset($data['phone_number']) && !empty(trim($data['phone_number'] ?? ''))) {
                $phoneNumber = trim($data['phone_number']);
                // التحقق من التنسيق
                if (!preg_match('/^05\d{8}$/', $phoneNumber)) {
                    $validator->errors()->add('phone_number', 'رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام');
                }
                // التحقق من التكرار
                if (User::where('phone_number', $phoneNumber)->exists()) {
                    $validator->errors()->add('phone_number', 'رقم الجوال موجود مسبقاً');
                }
            }
        });

        if ($validator->fails()) {
            $errors = $validator->errors();
            
            Log::warning('Montage producer validation failed', [
                'errors' => $errors->toArray(),
                'request_data' => $data,
                'original_request' => $request->all(),
            ]);
            
            // ✅ إرجاع رسالة خطأ مفصلة
            $errorMessages = [];
            foreach ($errors->all() as $error) {
                $errorMessages[] = $error;
            }
            
            return response()->json([
                'success' => false,
                'message' => 'البيانات غير صحيحة',
                'errors' => $errors,
                'error_messages' => $errorMessages, // ✅ إضافة قائمة بجميع رسائل الخطأ
            ], 422);
        }

        try {
            $userData = [
                'name' => trim($data['name']),
                'role' => 'montage_producer',
                'department' => 'إعلام',
                'is_active' => true,
                'added_by' => $request->user()->id,
            ];
            
            // إضافة email أو code
            if (isset($data['email']) && !empty(trim($data['email']))) {
                $userData['email'] = trim($data['email']);
            } elseif (isset($data['code']) && !empty(trim($data['code']))) {
                // استخدام الكود كـ email
                $userData['email'] = trim($data['code']) . '@montage.local';
            }
            
            // إضافة phone_number إذا تم إدخاله
            if (isset($data['phone_number']) && !empty(trim($data['phone_number']))) {
                $userData['phone_number'] = trim($data['phone_number']);
            }
            
            // إضافة password إذا تم إدخاله
            if (isset($data['password']) && !empty(trim($data['password']))) {
                $userData['password'] = Hash::make(trim($data['password']));
            } else {
                // كلمة مرور افتراضية إذا لم يتم إدخالها
                $userData['password'] = Hash::make('montage123');
            }
            
            $producer = User::create($userData);
            
            // مسح cache
            $this->clearMontageProducersCache();
            
            // إزالة email و password من الـ response
            $producer->makeHidden(['email', 'password']);
            
            return response()->json([
                'success' => true,
                'message' => 'تم إضافة ممنتج المونتاج بنجاح',
                'producer' => $producer->only(['id', 'name', 'phone_number', 'role', 'department', 'is_active'])
            ], 201);
            
        } catch (\Exception $e) {
            Log::error('Error creating montage producer', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل إضافة ممنتج المونتاج',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Show montage producer details with statistics
     */
    public function show($id)
    {
        try {
            $user = auth()->user();
            
            // التحقق من الصلاحيات
            if (!$user || ($user->role !== 'admin' && $user->role !== 'media_manager')) {
                return response()->json([
                    'success' => false,
                    'message' => 'غير مصرح'
                ], 403);
            }

            $producer = User::byRole('montage_producer')->findOrFail($id);
            
            // ✅ استخدام Query Builder لجميع الإحصائيات (وليس Collection)
            // حساب التاريخ قبل 5 أيام
            $fiveDaysAgo = Carbon::now()->subDays(5)->format('Y-m-d');
            
            // بناء Query Builder أساسي لتجنب التكرار
            $baseQuery = ProjectProposal::where('assigned_montage_producer_id', $producer->id);
            
            $statistics = [
                'total_projects' => (clone $baseQuery)->count(),
                
                'current_projects' => (clone $baseQuery)
                    ->where('status', 'في المونتاج')
                    ->count(),
                
                'completed_projects' => (clone $baseQuery)
                    ->where('status', 'تم المونتاج')
                    ->count(),
                
                'delivered_projects' => (clone $baseQuery)
                    ->where('status', 'وصل للمتبرع')
                    ->count(),
                
                'redone_projects' => (clone $baseQuery)
                    ->where('status', 'يجب إعادة المونتاج')
                    ->count(),
                
                // ✅ استخدام where() مع Carbon بدلاً من whereRaw - يعمل على Query Builder فقط
                'delayed_projects' => (clone $baseQuery)
                    ->where('status', 'في المونتاج')
                    ->whereNotNull('montage_producer_assigned_at')
                    ->where('montage_producer_assigned_at', '<', Carbon::now()->subDays(5))
                    ->count(),
            ];
            
            // إزالة email و password من الـ response
            $producer->makeHidden(['email', 'password']);
            
            return response()->json([
                'success' => true,
                'producer' => [
                    'id' => $producer->id,
                    'name' => $producer->name,
                    'email' => $producer->email,
                    'code' => $producer->code ?? null,
                    'phone_number' => $producer->phone_number,
                    'is_active' => $producer->is_active ?? true,
                    'created_at' => $producer->created_at,
                    'updated_at' => $producer->updated_at,
                ],
                'statistics' => $statistics
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error fetching montage producer details', [
                'producer_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب تفاصيل ممنتج المونتاج',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update montage producer
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|min:3',
            'email' => 'sometimes|email|unique:users,email,' . $id,
            'phone_number' => 'sometimes|string|regex:/^05\d{8}$/|unique:users,phone_number,' . $id,
            'password' => 'sometimes|string|min:8',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $producer = User::byRole('montage_producer')->findOrFail($id);
            
            $updateData = $request->except('password');
            
            if ($request->has('password')) {
                $updateData['password'] = Hash::make($request->password);
            }
            
            $producer->update($updateData);
            
            // مسح cache
            $this->clearMontageProducersCache();
            
            // إزالة email و password من الـ response
            $producer->makeHidden(['email', 'password']);
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث ممنتج المونتاج بنجاح',
                'producer' => $producer
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error updating montage producer', [
                'producer_id' => $id,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث ممنتج المونتاج',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete montage producer
     */
    public function destroy($id)
    {
        try {
            $producer = User::byRole('montage_producer')->findOrFail($id);
            
            // ✅ التحقق من وجود مشاريع مسندة - استخدام query مباشر
            try {
                $assignedProjects = ProjectProposal::where('assigned_montage_producer_id', $producer->id)
                    ->where('status', 'في المونتاج')
                    ->count();
            } catch (\Exception $e) {
                Log::warning('Error checking assigned projects', [
                    'producer_id' => $producer->id,
                    'error' => $e->getMessage()
                ]);
                // إذا فشل التحقق، نعتبر أنه لا توجد مشاريع مسندة
                $assignedProjects = 0;
            }
            
            if ($assignedProjects > 0) {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن حذف ممنتج المونتاج',
                    'message' => "يوجد {$assignedProjects} مشروع مسند لممنتج المونتاج. يرجى إعادة توزيع المشاريع أولاً."
                ], 422);
            }
            
            $producer->delete();
            
            // مسح cache
            $this->clearMontageProducersCache();
            
            return response()->json([
                'success' => true,
                'message' => 'تم حذف ممنتج المونتاج بنجاح'
            ], 200);
            
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'ممنتج المونتاج غير موجود',
                'message' => 'الممنتج المطلوب غير موجود في قاعدة البيانات'
            ], 404);
            
        } catch (\Exception $e) {
            Log::error('Error deleting montage producer', [
                'producer_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل حذف ممنتج المونتاج',
                'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ أثناء حذف ممنتج المونتاج'
            ], 500);
        }
    }

    /**
     * Get projects assigned to a specific montage producer
     * يعرض فقط المشاريع المسندة للممنتج المحدد
     */
    public function getMontageProducerProjects(Request $request, $producerId)
    {
        try {
            $user = auth()->user();
            
            // التحقق من الصلاحيات
            if (!$user || ($user->role !== 'admin' && $user->role !== 'media_manager')) {
                return response()->json([
                    'success' => false,
                    'message' => 'غير مصرح'
                ], 403);
            }

            // ✅ التحقق من وجود الممنتج
            $producer = User::byRole('montage_producer')->findOrFail($producerId);
            
            // ✅ بناء Query - فقط المشاريع المسندة لهذا الممنتج
            $query = ProjectProposal::where('assigned_montage_producer_id', $producerId);
            
            // فلترة حسب الحالة
            if ($request->has('status') && $request->status) {
                $query->where('status', $request->status);
            }
            
            // فلترة حسب نوع المشروع (حالي، منجز، متأخر، معاد منتاجه)
            if ($request->has('filter_type') && $request->filter_type) {
                switch ($request->filter_type) {
                    case 'current':
                        $query->where('status', 'في المونتاج');
                        break;
                    case 'completed':
                        $query->where('status', 'تم المونتاج');
                        break;
                    case 'delivered':
                        $query->where('status', 'وصل للمتبرع');
                        break;
                    case 'delayed':
                        $query->where('status', 'في المونتاج')
                              ->whereNotNull('montage_producer_assigned_at')
                              ->where('montage_producer_assigned_at', '<', Carbon::now()->subDays(5));
                        break;
                    case 'redone':
                        $query->where('status', 'يجب إعادة المونتاج');
                        break;
                }
            }
            
            // فلترة حسب التاريخ
            if ($request->has('from_date') && $request->from_date) {
                $query->whereDate('montage_producer_assigned_at', '>=', $request->from_date);
            }
            
            if ($request->has('to_date') && $request->to_date) {
                $query->whereDate('montage_producer_assigned_at', '<=', $request->to_date);
            }
            
            // تحميل العلاقات المطلوبة
            $query->with([
                'currency' => function($q) {
                    $q->select('id', 'currency_code', 'currency_name_ar', 'currency_name_en');
                },
                'parentProject' => function($q) {
                    $q->select('id', 'project_name', 'donor_name', 'project_description');
                }
            ]);
            
            // ترتيب حسب تاريخ الإسناد (الأحدث أولاً)
            $query->orderBy('montage_producer_assigned_at', 'DESC');
            
            $perPage = min((int) $request->query('perPage', 20), 100);
            $projects = $query->paginate($perPage);
            
            // إضافة معلومات إضافية لكل مشروع
            $projectsData = $projects->getCollection()->map(function ($project) {
                // حساب أيام التأخير
                $daysDelayed = 0;
                if ($project->status === 'في المونتاج' && $project->montage_producer_assigned_at) {
                    $assignedAt = Carbon::parse($project->montage_producer_assigned_at);
                    $daysDelayed = max(0, $assignedAt->diffInDays(now()) - 5);
                }
                
                return [
                    'id' => $project->id,
                    'serial_number' => $project->serial_number,
                    'donor_code' => $project->donor_code,
                    'internal_code' => $project->internal_code,
                    'project_name' => $project->project_name,
                    'project_description' => $project->project_description,
                    'donor_name' => $project->donor_name,
                    'status' => $project->status,
                    'montage_producer_assigned_at' => $project->montage_producer_assigned_at,
                    'montage_completed_at' => $project->montage_completed_at,
                    'days_delayed' => $daysDelayed,
                    'net_amount' => $project->net_amount,
                    'currency' => $project->currency ? [
                        'id' => $project->currency->id,
                        'currency_code' => $project->currency->currency_code,
                        'currency_name' => $project->currency->currency_name_ar,
                        'currency_name_ar' => $project->currency->currency_name_ar,
                        'currency_name_en' => $project->currency->currency_name_en,
                    ] : null,
                    'parent_project' => $project->parentProject ? [
                        'id' => $project->parentProject->id,
                        'project_name' => $project->parentProject->project_name,
                        'donor_name' => $project->parentProject->donor_name,
                    ] : null,
                ];
            });
            
            return response()->json([
                'success' => true,
                'producer' => [
                    'id' => $producer->id,
                    'name' => $producer->name,
                    'email' => $producer->email,
                    'phone_number' => $producer->phone_number,
                ],
                'projects' => $projectsData,
                'pagination' => [
                    'total' => $projects->total(),
                    'current_page' => $projects->currentPage(),
                    'last_page' => $projects->lastPage(),
                    'per_page' => $projects->perPage(),
                    'from' => $projects->firstItem(),
                    'to' => $projects->lastItem(),
                ]
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error fetching montage producer projects', [
                'producer_id' => $producerId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب مشاريع ممنتج المونتاج',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get daily report for all montage producers
     */
    public function getDailyReport(Request $request)
    {
        try {
            $date = $request->has('date') ? Carbon::parse($request->date) : Carbon::today();
            
            $producers = User::byRole('montage_producer')->active()->get();
            
            $report = [];
            
            foreach ($producers as $producer) {
                $projects = ProjectProposal::assignedToMontageProducer($producer->id)
                    ->whereDate('montage_producer_assigned_at', '<=', $date)
                    ->get();
                
                // المشاريع المنجزة في اليوم
                $completedToday = $projects->filter(function ($project) use ($date) {
                    return $project->montage_completed_at && 
                           Carbon::parse($project->montage_completed_at)->isSameDay($date);
                })->count();
                
                // المشاريع المكتملة (وصل للمتبرع)
                $delivered = $projects->where('status', 'وصل للمتبرع')->count();
                
                // حساب متوسط الوقت لكل مشروع
                $completedProjects = $projects->whereNotNull('montage_completed_at')
                    ->whereNotNull('montage_producer_assigned_at');
                
                $totalTime = 0;
                $count = 0;
                foreach ($completedProjects as $project) {
                    $assignedAt = Carbon::parse($project->montage_producer_assigned_at);
                    $completedAt = Carbon::parse($project->montage_completed_at);
                    $totalTime += $assignedAt->diffInHours($completedAt);
                    $count++;
                }
                
                $averageTime = $count > 0 ? round($totalTime / $count, 2) : 0;
                
                // المشاريع المتأخرة (أكثر من 5 أيام)
                $delayed = $projects->where('status', 'في المونتاج')
                    ->whereNotNull('montage_producer_assigned_at')
                    ->filter(function ($project) {
                        return Carbon::parse($project->montage_producer_assigned_at)->diffInDays(now()) > 5;
                    })->count();
                
                // المشاريع الحالية
                $current = $projects->where('status', 'في المونتاج')->count();
                
                $report[] = [
                    'producer_id' => $producer->id,
                    'producer_name' => $producer->name,
                    'completed_today' => $completedToday,
                    'delivered' => $delivered,
                    'average_time_hours' => $averageTime,
                    'delayed' => $delayed,
                    'current' => $current,
                ];
            }
            
            return response()->json([
                'success' => true,
                'date' => $date->format('Y-m-d'),
                'report' => $report,
                'total_producers' => count($report)
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error generating daily report', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل إنشاء التقرير اليومي',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get list of montage producers for dropdown (simple list)
     */
    public function list(Request $request)
    {
        try {
            $producers = User::byRole('montage_producer')
                ->active()
                ->select('id', 'name')
                ->orderBy('name')
                ->get();
            
            return response()->json([
                'success' => true,
                'producers' => $producers,
                'count' => $producers->count()
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error fetching montage producers list', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب قائمة ممنتجي المونتاج',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * مسح cache ممنتجي المونتاج
     */
    private function clearMontageProducersCache(): void
    {
        try {
            $cacheDriver = Cache::getStore();
            if (method_exists($cacheDriver, 'getRedis')) {
                $redis = $cacheDriver->getRedis();
                $keys = $redis->keys('*montage_producers*');
                if (!empty($keys)) {
                    $redis->del($keys);
                }
            }
        } catch (\Exception $e) {
            Log::warning('Failed to clear montage producers cache', [
                'error' => $e->getMessage()
            ]);
        }
    }
}
