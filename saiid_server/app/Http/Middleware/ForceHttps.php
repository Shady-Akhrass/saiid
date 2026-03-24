<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForceHttps
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // ✅ فقط في بيئة الإنتاج (production)
        if (config('app.env') === 'production') {
            // ✅ التحقق من أن الطلب ليس HTTPS
            if (!$request->secure()) {
                // ✅ إعادة توجيه إلى HTTPS
                return redirect()->secure($request->getRequestUri(), 301);
            }
            
            // ✅ إضافة Security Headers للحماية
            $response = $next($request);
            
            // ✅ HSTS (HTTP Strict Transport Security)
            // يفرض على المتصفح استخدام HTTPS فقط لمدة سنة
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
            
            // ✅ حماية من XSS (Cross-Site Scripting)
            $response->headers->set('X-XSS-Protection', '1; mode=block');
            
            // ✅ حماية من MIME type sniffing
            $response->headers->set('X-Content-Type-Options', 'nosniff');
            
            // ✅ حماية من Clickjacking
            $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
            
            // ✅ Referrer Policy - التحكم في إرسال معلومات المرجع
            $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
            
            // ✅ Permissions Policy - التحكم في صلاحيات المتصفح
            $response->headers->set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
            
            return $response;
        }
        
        // ✅ في بيئة التطوير، لا نفرض HTTPS
        return $next($request);
    }
}
