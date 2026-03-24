<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6',
            'confirmPassword' => 'required|string|same:password',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        $token = $user->createToken('authToken')->plainTextToken;

        return response()->json(['token' => $token], 201);
    }

    public function login(Request $request)
    {
        // ✅ الحصول على البيانات من request (يدعم JSON و Form Data)
        $jsonData = json_decode($request->getContent(), true) ?? [];
        
        // ✅ أولوية: jsonData > request->input()
        if (!empty($jsonData)) {
            $email = $jsonData['email'] ?? null;
            $password = $jsonData['password'] ?? null;
        } else {
            $email = $request->input('email');
            $password = $request->input('password');
        }

        // ✅ تنظيف البيانات (null-safe)
        $email = ($email !== null && $email !== '') ? strtolower(trim((string)$email)) : null;
        $password = ($password !== null && $password !== '') ? trim((string)$password) : null;

        // ✅ التحقق من وجود البيانات الأساسية (null أو empty string)
        $emailMissing = ($email === null || $email === '');
        $passwordMissing = ($password === null || $password === '');

        if ($emailMissing || $passwordMissing) {
            return response()->json([
                'error' => 'البريد الإلكتروني وكلمة المرور مطلوبان',
                'errors' => array_filter([
                    'email' => $emailMissing ? ['البريد الإلكتروني مطلوب'] : null,
                    'password' => $passwordMissing ? ['كلمة المرور مطلوبة'] : null,
                ])
            ], 422);
        }

        // ✅ التحقق من صيغة البريد الإلكتروني
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'error' => 'البريد الإلكتروني غير صحيح',
                'errors' => [
                    'email' => ['البريد الإلكتروني غير صحيح']
                ]
            ], 422);
        }

        // ✅ البحث عن المستخدم (case-insensitive)
        // ✅ تحسين الأداء: البحث مباشرة على email (يجب أن يكون email محفوظ lowercase في قاعدة البيانات)
        // ✅ إذا لم يكن lowercase، نستخدم whereRaw كـ fallback
        $user = User::where('email', $email)->first();
        
        // ✅ Fallback: البحث case-insensitive إذا لم يتم العثور عليه
        if (!$user) {
            $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
        }

        // التحقق من وجود المستخدم و email و password
        if (!$user || !$user->email || !$user->password) {
            return response()->json([
                'error' => 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
            ], 401);
        }

        // ✅ التحقق من أن المستخدم نشط
        if (isset($user->is_active) && !$user->is_active) {
            return response()->json([
                'error' => 'حسابك غير نشط. يرجى الاتصال بالإدارة'
            ], 403);
        }

        // ✅ التحقق من كلمة المرور
        if (!Hash::check($password, $user->password)) {
            return response()->json([
                'error' => 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
            ], 401);
        }

        $token = $user->createToken('authToken')->plainTextToken;

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role ?? 'executor', // ✅ إضافة role
                'department' => $user->department ?? null, // ✅ إضافة department
            ],
            'token' => $token
        ], 200);
    }

    public function fetchData($id)
    {
        try {
            $user = User::find($id);

            if (!$user) {
                return response()->json(['error' => 'User not found'], 404);
            }

            return response()->json([
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role ?? 'executor', // ✅ إضافة role
                    'department' => $user->department ?? null, // ✅ إضافة department
                ]
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching user: ' . $e->getMessage());
            return response()->json(['error' => 'Internal Server Error'], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $user = User::find($id);
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'المستخدم غير موجود'
                ], 404);
            }

            // بناء قواعد التحقق
            $rules = [
                'name' => 'nullable|string|max:255',
                'password' => 'nullable|string|min:6',
            ];

            // التحقق من البريد الإلكتروني إذا كان موجوداً في الطلب
            if ($request->has('email')) {
                $newEmail = trim($request->email) ?: null;
                
                // إذا كان البريد الإلكتروني فارغاً، نسمح بذلك
                if (empty($newEmail)) {
                    // لا حاجة للتحقق من البريد الإلكتروني الفارغ
                } else {
                    // التحقق من صحة البريد الإلكتروني
                    if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
                        return response()->json([
                            'success' => false,
                            'error' => 'البريد الإلكتروني غير صحيح',
                            'errors' => ['email' => ['البريد الإلكتروني غير صحيح']]
                        ], 422);
                    }
                    
                    // التحقق من أن البريد الإلكتروني غير مستخدم عند مستخدم آخر
                    $existingUser = User::where('email', $newEmail)->where('id', '!=', $id)->first();
                    if ($existingUser) {
                        return response()->json([
                            'success' => false,
                            'error' => 'البريد الإلكتروني مستخدم بالفعل',
                            'errors' => ['email' => ['البريد الإلكتروني مستخدم بالفعل']]
                        ], 422);
                    }
                }
            }

            // التحقق من باقي الحقول
            $validator = Validator::make($request->all(), $rules, [
                'password.min' => 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'error' => 'فشل التحقق من البيانات',
                    'errors' => $validator->errors()
                ], 422);
            }

            $updated = false;

            if ($request->has('name') && $request->name !== $user->name) {
                $user->name = $request->name;
                $updated = true;
            }

            if ($request->has('email')) {
                $newEmail = trim($request->email) ?: null;
                if ($newEmail !== $user->email) {
                    $user->email = $newEmail;
                    $updated = true;
                }
            }

            if ($request->has('password') && !empty($request->password)) {
                $user->password = Hash::make($request->password);
                $updated = true;
            }

            // حفظ التغييرات
            if ($updated) {
                $user->save();
            }
            
            // إرجاع الاستجابة دائماً بشكل متوافق مع الفرونت إند
            return response()->json([
                'success' => true,
                'message' => $updated ? 'تم التحديث بنجاح' : 'لم يتم اكتشاف أي تغييرات',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role ?? 'executor',
                    'department' => $user->department ?? null,
                ]
            ], 200);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // معالجة أخطاء التحقق بشكل صحيح
            return response()->json([
                'error' => 'فشل التحقق من البيانات',
                'errors' => $e->errors(),
                'message' => 'البيانات المرسلة غير صحيحة'
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error updating user: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'error' => 'فشل تحديث البيانات',
                'message' => $e->getMessage(),
                'success' => false
            ], 500);
        }
    }

    public function logout(Request $request)
    {
        try {
            // ✅ محاولة حذف الـ token الحالي (حتى لو كان منتهي الصلاحية)
            $user = $request->user();
            
            if ($user) {
                try {
                    $token = $user->currentAccessToken();
                    if ($token) {
                        $token->delete();
                    }
                } catch (\Exception $e) {
                    // ✅ Token غير صالح أو منتهي - لا مشكلة، نتابع
                }
            } else {
                // ✅ محاولة حذف الـ token من الـ header مباشرة
                $token = $request->bearerToken();
                if ($token) {
                    try {
                        // ✅ البحث عن الـ token في قاعدة البيانات وحذفه
                        $personalAccessToken = \Laravel\Sanctum\PersonalAccessToken::findToken($token);
                        if ($personalAccessToken) {
                            $personalAccessToken->delete();
                        }
                    } catch (\Exception $e) {
                        // ✅ Token غير موجود - لا مشكلة
                    }
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Logged out successfully'
            ], 200);
        } catch (\Exception $e) {
            // ✅ حتى لو فشل كل شيء، نعيد success لأن الـ logout يجب أن ينجح دائماً
            return response()->json([
                'success' => true,
                'message' => 'Logged out successfully',
                'note' => 'Token was already invalid or expired'
            ], 200);
        }
    }
}
