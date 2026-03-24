<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * يعيد فوراً استجابة CORS لطلبات OPTIONS (preflight) على مسارات الـ API.
 * يعمل حتى لو كان config('cors') مخزناً قديماً أو غير محمّل.
 */
class CorsPreflightForApi
{
    /** هيدرات مسموحة في الطلبات (لتجنب أخطاء "header X is not allowed") من المتصفح/axios */
    private const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match';

    /** قائمة origins مسموحة ثابتة كشبكة أمان (بالإضافة لـ config/cors.php) */
    private const FALLBACK_ORIGINS = [
        'https://forms.saiid.org',
        'https://www.forms.saiid.org',
        'http://localhost:5174',
        'http://localhost:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5173',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        // طلبات OPTIONS فقط على مسارات الـ API (دعم مسار مثل api/* أو URI يحتوي /api/)
        $isApiPath = $request->is('api/*') || str_contains($request->getRequestUri(), '/api/');
        if ($request->isMethod('OPTIONS') && $isApiPath) {
            $origin = $request->header('Origin');
            $allowed = array_merge(
                config('cors.allowed_origins', []),
                self::FALLBACK_ORIGINS
            );
            $allowed = array_unique($allowed);
            // مع Credentials يجب أن يكون Origin دومين محدد (ليس *)
            $corsOrigin = null;
            if ($origin && (in_array($origin, $allowed) || str_contains($origin, 'forms.saiid.org') || str_contains($origin, 'saiid.org') || str_contains($origin, 'localhost') || str_contains($origin, '127.0.0.1'))) {
                $corsOrigin = $origin;
            }
            if (!$corsOrigin) {
                return $next($request); // نترك الطلب للـ HandleCors أو غيره
            }

            return response('', 204)
                ->header('Access-Control-Allow-Origin', $corsOrigin)
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers', self::ALLOWED_HEADERS)
                ->header('Access-Control-Allow-Credentials', 'true')
                ->header('Access-Control-Max-Age', '86400');
        }

        return $next($request);
    }
}
