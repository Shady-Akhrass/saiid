<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;

class UserManagementController extends Controller
{
    /**
     * Get all users (Admin only)
     */
    public function index(Request $request)
    {
        try {
            $query = User::query();
            
            // فلترة حسب الدور (اختياري)
            if ($request->has('role') && $request->role) {
                $query->byRole($request->role);
            }
            
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
                      ->orWhere('phone_number', 'LIKE', "%{$search}%")
                      ->orWhere('role', 'LIKE', "%{$search}%")
                      ->orWhere('department', 'LIKE', "%{$search}%");
                });
            }
            
            // Pagination
            $perPage = $request->query('perPage', 10);
            $users = $query->select('id', 'name', 'email', 'phone_number', 'role', 'department', 'is_active', 'created_at', 'updated_at')
                          ->orderBy('name')
                          ->paginate($perPage);
            
            // إزالة email و password من الـ response
            $users->getCollection()->transform(function ($user) {
                return $user->makeHidden(['email', 'password']);
            });
            
            return response()->json([
                'success' => true,
                'users' => $users->items(),
                'total' => $users->total(),
                'currentPage' => $users->currentPage(),
                'totalPages' => $users->lastPage(),
                'perPage' => $users->perPage()
            ], 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب المستخدمين',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get executors (for team assignment)
     * ✅ مع كاش لمدة 5 دقائق لتحسين الأداء
     */
    public function getExecutors(Request $request)
    {
        try {
            // ✅ دعم cache busting parameter من Frontend
            $useCache = !$request->has('_t');
            $cacheKey = 'executors_list_' . ($request->user()?->id ?? 'guest');
            
            if ($useCache) {
                $cachedData = Cache::get($cacheKey);
                if ($cachedData !== null) {
                    return response()->json($cachedData, 200)
                        ->header('Cache-Control', 'private, max-age=300')
                        ->header('ETag', md5($cacheKey . '_' . ($cachedData['cache_time'] ?? time())));
                }
            }
            
            $executors = User::byRole('executor')
                            ->active()
                            ->select('id', 'name', 'phone_number', 'department', 'role')
                            ->orderBy('name')
                            ->get();
            
            $responseData = [
                'success' => true,
                'executors' => $executors,
                'count' => $executors->count(),
                'cache_time' => time()
            ];
            
            // ✅ حفظ في cache لمدة 5 دقائق
            if ($useCache) {
                Cache::put($cacheKey, $responseData, 300);
            }
            
            return response()->json($responseData, 200)
                ->header('Cache-Control', $useCache ? 'private, max-age=300' : 'no-cache, must-revalidate')
                ->header('ETag', md5($cacheKey . '_' . $responseData['cache_time']));
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب المنفذين',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get photographers
     * ✅ مع كاش لمدة 5 دقائق لتحسين الأداء
     */
    public function getPhotographers(Request $request)
    {
        try {
            // ✅ دعم cache busting parameter من Frontend
            $useCache = !$request->has('_t');
            $cacheKey = 'photographers_list_' . ($request->user()?->id ?? 'guest');
            
            if ($useCache) {
                $cachedData = Cache::get($cacheKey);
                if ($cachedData !== null) {
                    return response()->json($cachedData, 200)
                        ->header('Cache-Control', 'private, max-age=300')
                        ->header('ETag', md5($cacheKey . '_' . ($cachedData['cache_time'] ?? time())));
                }
            }
            
            $photographers = User::byRole('photographer')
                                ->active()
                                ->select('id', 'name', 'phone_number', 'department', 'role')
                                ->orderBy('name')
                                ->get();
            
            $responseData = [
                'success' => true,
                'photographers' => $photographers,
                'count' => $photographers->count(),
                'cache_time' => time()
            ];
            
            // ✅ حفظ في cache لمدة 5 دقائق
            if ($useCache) {
                Cache::put($cacheKey, $responseData, 300);
            }
            
            return response()->json($responseData, 200)
                ->header('Cache-Control', $useCache ? 'private, max-age=300' : 'no-cache, must-revalidate')
                ->header('ETag', md5($cacheKey . '_' . $responseData['cache_time']));
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب المصورين',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add new executor (Project Manager only)
     */
    public function addExecutor(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:3',
            'email' => 'nullable|email|unique:users,email', // ✅ جعل email اختياري
            'phone_number' => 'required|string|regex:/^05\d{8}$/|unique:users,phone_number',
            'password' => 'nullable|string|min:8', // ✅ جعل password اختياري
            'department' => 'nullable|string',
        ], [
            'name.required' => 'يرجى إدخال الاسم',
            'email.email' => 'البريد الإلكتروني غير صحيح',
            'email.unique' => 'البريد الإلكتروني موجود مسبقاً',
            'phone_number.required' => 'يرجى إدخال رقم الجوال',
            'phone_number.regex' => 'رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام',
            'phone_number.unique' => 'رقم الجوال موجود مسبقاً',
            'password.min' => 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $userData = [
                'name' => $request->name,
                'phone_number' => $request->phone_number,
                'role' => 'executor',
                'department' => $request->department ?? 'مشاريع',
                'is_active' => true,
            ];
            
            // إضافة email إذا تم إدخاله
            if ($request->has('email') && $request->email) {
                $userData['email'] = $request->email;
            }
            
            // إضافة password إذا تم إدخاله
            if ($request->has('password') && $request->password) {
                $userData['password'] = Hash::make($request->password);
            }
            
            $user = User::create($userData);
            
            // ✅ مسح cache المنفذين بعد الإضافة
            $this->clearExecutorsCache();
            
            // إزالة email و password من الـ response
            $user->makeHidden(['email', 'password']);
            
            return response()->json([
                'success' => true,
                'message' => 'تم إضافة المنفذ بنجاح',
                'user' => $user->only(['id', 'name', 'phone_number', 'role', 'department', 'is_active'])
            ], 201);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إضافة المنفذ',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add new photographer (Media Manager only)
     */
    public function addPhotographer(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:3',
            'email' => 'nullable|email|unique:users,email', // ✅ جعل email اختياري
            'phone_number' => 'required|string|regex:/^05\d{8}$/|unique:users,phone_number',
            'password' => 'nullable|string|min:8', // ✅ جعل password اختياري
            'department' => 'nullable|string',
        ], [
            'name.required' => 'يرجى إدخال الاسم',
            'email.email' => 'البريد الإلكتروني غير صحيح',
            'email.unique' => 'البريد الإلكتروني موجود مسبقاً',
            'phone_number.required' => 'يرجى إدخال رقم الجوال',
            'phone_number.regex' => 'رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام',
            'phone_number.unique' => 'رقم الجوال موجود مسبقاً',
            'password.min' => 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $userData = [
                'name' => $request->name,
                'phone_number' => $request->phone_number,
                'role' => 'photographer',
                'department' => $request->department ?? 'إعلام',
                'is_active' => true,
            ];
            
            // إضافة email إذا تم إدخاله
            if ($request->has('email') && $request->email) {
                $userData['email'] = $request->email;
            }
            
            // إضافة password إذا تم إدخاله
            if ($request->has('password') && $request->password) {
                $userData['password'] = Hash::make($request->password);
            }
            
            $user = User::create($userData);
            
            // ✅ مسح cache المصورين بعد الإضافة
            $this->clearPhotographersCache();
            
            // إزالة email و password من الـ response
            $user->makeHidden(['email', 'password']);
            
            return response()->json([
                'success' => true,
                'message' => 'تم إضافة المصور بنجاح',
                'user' => $user->only(['id', 'name', 'phone_number', 'role', 'department', 'is_active'])
            ], 201);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إضافة المصور',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update user
     */
    public function updateUser(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|min:3',
            'email' => 'sometimes|email|unique:users,email,' . $id,
            'phone_number' => 'sometimes|string|regex:/^05\d{8}$/|unique:users,phone_number,' . $id,
            'password' => 'sometimes|string|min:8',
            'department' => 'sometimes|nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $user = User::findOrFail($id);
            
            $updateData = $request->except('password');
            
            if ($request->has('password')) {
                $updateData['password'] = Hash::make($request->password);
            }
            
            $user->update($updateData);
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث المستخدم بنجاح',
                'user' => $user
            ], 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث المستخدم',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle user active status
     */
    public function toggleUserStatus($id)
    {
        try {
            $user = User::findOrFail($id);
            
            $user->is_active = !$user->is_active;
            $user->save();
            
            $status = $user->is_active ? 'مفعّل' : 'معطّل';
            
            // إزالة email و password من الـ response
            $user->makeHidden(['email', 'password']);
            
            return response()->json([
                'success' => true,
                'message' => "تم تغيير حالة المستخدم إلى: {$status}",
                'user' => $user->only(['id', 'name', 'phone_number', 'role', 'department', 'is_active'])
            ], 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تغيير الحالة',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all users by role
     */
    public function getUsersByRole($role)
    {
        try {
            $users = User::byRole($role)
                        ->select('id', 'name', 'phone_number', 'department', 'role', 'is_active')
                        ->orderBy('name')
                        ->get();
            
            return response()->json([
                'success' => true,
                'users' => $users,
                'role' => $role,
                'count' => $users->count()
            ], 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب المستخدمين',
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * مسح cache المنفذين
     */
    private function clearExecutorsCache(): void
    {
        try {
            $cacheDriver = Cache::getStore();
            if (method_exists($cacheDriver, 'getRedis')) {
                $redis = $cacheDriver->getRedis();
                $keys = $redis->keys('*executors_list_*');
                if (!empty($keys)) {
                    $redis->del($keys);
                }
            } else {
                // Fallback: مسح جميع cache keys للمنفذين
                Cache::forget('executors_list_' . (request()->user()?->id ?? 'guest'));
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to clear executors cache', [
                'error' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * مسح cache المصورين
     */
    private function clearPhotographersCache(): void
    {
        try {
            $cacheDriver = Cache::getStore();
            if (method_exists($cacheDriver, 'getRedis')) {
                $redis = $cacheDriver->getRedis();
                $keys = $redis->keys('*photographers_list_*');
                if (!empty($keys)) {
                    $redis->del($keys);
                }
            } else {
                // Fallback: مسح جميع cache keys للمصورين
                Cache::forget('photographers_list_' . (request()->user()?->id ?? 'guest'));
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to clear photographers cache', [
                'error' => $e->getMessage()
            ]);
        }
    }
}

