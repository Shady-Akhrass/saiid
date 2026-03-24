<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware لضغط الاستجابات (Gzip Compression)
 * 
 * يحسّن الأداء من خلال تقليل حجم البيانات المنقولة بنسبة 60-80%
 */
class CompressResponse
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // ✅ ضغط الاستجابات فقط إذا كان العميل يدعمها
        if ($this->shouldCompress($request, $response)) {
            $compressed = $this->compress($response->getContent());
            
            if ($compressed !== false && strlen($compressed) < strlen($response->getContent())) {
                $response->setContent($compressed);
                $response->headers->set('Content-Encoding', 'gzip');
                $response->headers->set('Content-Length', strlen($compressed));
                $response->headers->set('Vary', 'Accept-Encoding');
            }
        }

        return $response;
    }

    /**
     * التحقق من إمكانية ضغط الاستجابة
     */
    private function shouldCompress(Request $request, Response $response): bool
    {
        // ✅ التحقق من أن العميل يدعم Gzip
        $acceptEncoding = $request->header('Accept-Encoding', '');
        if (!str_contains($acceptEncoding, 'gzip')) {
            return false;
        }

        // ✅ ضغط فقط للاستجابات الناجحة
        if ($response->getStatusCode() !== 200) {
            return false;
        }

        // ✅ ضغط فقط للأنواع المحددة
        $contentType = $response->headers->get('Content-Type', '');
        $compressibleTypes = [
            'application/json',
            'application/javascript',
            'text/html',
            'text/css',
            'text/xml',
            'text/plain',
        ];

        $shouldCompress = false;
        foreach ($compressibleTypes as $type) {
            if (str_contains($contentType, $type)) {
                $shouldCompress = true;
                break;
            }
        }

        // ✅ ضغط فقط إذا كان حجم الاستجابة أكبر من 1KB
        if ($shouldCompress) {
            $contentLength = strlen($response->getContent());
            return $contentLength > 1024; // 1KB
        }

        return false;
    }

    /**
     * ضغط المحتوى باستخدام Gzip
     */
    private function compress(string $content): string|false
    {
        // ✅ استخدام gzencode للضغط
        $compressed = gzencode($content, 6); // Level 6 = توازن جيد بين السرعة والضغط
        
        return $compressed;
    }
}
