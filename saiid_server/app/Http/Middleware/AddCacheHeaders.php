<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware لإضافة Cache Headers للـ API responses
 * 
 * يضيف ETags و Cache-Control headers لتحسين الأداء
 */
class AddCacheHeaders
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // ✅ إضافة Cache Headers للـ GET requests فقط
        if ($request->isMethod('GET') && $response->getStatusCode() === 200) {
            // ✅ تحديد مدة الـ cache حسب نوع البيانات
            $maxAge = $this->getCacheMaxAge($request);
            
            // ✅ إضافة Cache-Control header
            $response->headers->set('Cache-Control', "public, max-age={$maxAge}, must-revalidate");
            
            // ✅ إضافة ETag إذا كانت الاستجابة JSON
            if ($response->headers->get('Content-Type') === 'application/json' || 
                str_contains($response->headers->get('Content-Type', ''), 'application/json')) {
                $this->addETag($request, $response);
            }
            
            // ✅ إضافة Vary header
            $response->headers->set('Vary', 'Accept-Encoding, Authorization');
        }

        return $response;
    }

    /**
     * تحديد مدة الـ cache حسب نوع البيانات
     */
    private function getCacheMaxAge(Request $request): int
    {
        // ✅ بيانات ثابتة (مثل العملات، الفرق) - 5 دقائق
        if ($request->is('api/currencies') || 
            $request->is('api/teams')) {
            return 300; // 5 دقائق
        }

        // ✅ أقسام الوافر - 30 ثانية (لأنها قد تتغير عند الإنشاء/التحديث)
        if ($request->is('api/surplus-categories*')) {
            return 30; // 30 ثانية
        }

        // ✅ صفحات الفائض (dashboard, report) - 30 ثانية
        if ($request->is('api/surplus*')) {
            return 30; // 30 ثانية
        }

        // ✅ بيانات متغيرة (مثل المشاريع، الإشعارات) - 30 ثانية
        if ($request->is('api/project-proposals') || 
            $request->is('api/notifications') ||
            $request->is('api/projects')) {
            return 30; // 30 ثانية
        }

        // ✅ بيانات dashboard - 1 دقيقة
        if ($request->is('api/dashboard') || 
            $request->is('api/statistics')) {
            return 60; // 1 دقيقة
        }

        // ✅ افتراضي - 30 ثانية
        return 30;
    }

    /**
     * إضافة ETag للاستجابة
     */
    private function addETag(Request $request, Response $response): void
    {
        // ✅ إنشاء ETag بناءً على محتوى الاستجابة
        $content = $response->getContent();
        $etag = md5($content . $request->fullUrl());

        // ✅ إضافة ETag header
        $response->headers->set('ETag', '"' . $etag . '"');

        // ✅ التحقق من If-None-Match header
        $ifNoneMatch = $request->header('If-None-Match');
        if ($ifNoneMatch && trim($ifNoneMatch, '"') === $etag) {
            // ✅ البيانات لم تتغير - إرجاع 304 Not Modified
            $response->setStatusCode(304);
            $response->setContent(null);
        }
    }
}

