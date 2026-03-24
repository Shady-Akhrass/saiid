<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        if (!$request->user()) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'يجب تسجيل الدخول أولاً'
            ], 401);
        }

        $user = $request->user();
        
        // إعادة تحميل المستخدم من قاعدة البيانات للتأكد من أحدث البيانات
        $user->refresh();
        
        $userRole = strtolower($user->role ?? '');
        
        // تحويل جميع الأدوار المطلوبة إلى lowercase للمقارنة
        $roles = array_map('strtolower', $roles);

        if (!in_array($userRole, $roles)) {
            // تحديد نوع الصلاحية المطلوبة بناءً على الـ route
            $route = $request->route();
            $routeName = $route ? ($route->getName() ?? $route->uri()) : $request->path();
            $action = $this->getActionDescription($routeName, $request->method());
            
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => "ليس لديك صلاحيات {$action} لهذا القسم. الصلاحيات مقتصرة على الإدارة فقط.",
                'required_roles' => $roles,
                'your_role' => $user->role ?? 'غير معرف',
                'action' => $action,
                'debug' => config('app.debug') ? [
                    'user_id' => $user->id,
                    'user_email' => $user->email,
                    'user_role_db' => $user->role,
                    'user_role_lowercase' => $userRole,
                    'required_roles' => $roles
                ] : null
            ], 403);
        }

        return $next($request);
    }

    /**
     * تحديد وصف الإجراء بناءً على الـ route
     */
    private function getActionDescription($routeName, $method)
    {
        $path = $routeName;
        
        // تحديد نوع الإجراء
        if (str_contains($path, 'dashboard')) {
            return 'للوصول إلى لوحة التحكم';
        }
        
        if ($method === 'POST' && str_contains($path, 'project-proposals')) {
            return 'لإضافة مشروع';
        }
        
        if ($method === 'PATCH' && str_contains($path, 'project-proposals')) {
            return 'لتعديل مشروع';
        }
        
        if ($method === 'DELETE' && str_contains($path, 'project-proposals')) {
            return 'لحذف مشروع';
        }
        
        if (str_contains($path, 'currencies') && ($method === 'PATCH' || $method === 'POST')) {
            return 'لتعديل العملات';
        }
        
        if (str_contains($path, 'users') && ($method === 'PATCH' || $method === 'POST')) {
            return 'لتعديل المستخدمين';
        }
        
        return 'للوصول إلى هذا القسم';
    }
}

