<?php

namespace App\Traits;

use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * ✅ Trait for controllers that need cached JSON responses with ETag support.
 *
 * ⚠️ IMPORTANT: This trait does NOT define errorResponse() to avoid
 *    collision with ApiResponse::errorResponse(). Instead it uses
 *    buildCacheErrorResponse() internally, and delegates to
 *    ApiResponse::errorResponse() when available.
 */
trait CacheableResponse
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Cache Key Building
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build a deterministic cache key from request parameters.
     */
    protected function buildCacheKey(
        string  $prefix,
        Request $request,
        ?int    $userId = null,
        ?string $userRole = null
    ): string {
        $resolvedUserId   = $userId ?? $request->user()?->id ?? 0;
        $resolvedUserRole = $userRole ?? strtolower($request->user()?->role ?? 'guest');

        $params = [
            'uid'  => $resolvedUserId,
            'role' => $resolvedUserRole,
            'status' => $request->get('status', 'all'),
            'type'   => $request->get('type', $request->get('project_type', 'all')),
            'page'   => (int) $request->query('page', 1),
            'pp'     => min((int) $request->query('perPage', $request->query('per_page', 15)), 5000),
            'sort'   => $request->get('sort_by', $request->get('sort', 'default')),
            'q'      => $request->get('searchQuery', '') ?: null,
            'flags'  => $request->only(['unread_only', 'active_only', 'include_executed']) ?: null,
            'gov'    => $request->get('governorate') ?: null,
            'dist'   => $request->get('district') ?: null,
            'mgr'    => $request->get('manager_name') ?: null,
            'mgrPh'  => $request->get('manager_phone') ?: null,
            'famR'   => self::buildRangeParam($request, 'families_count_min', 'families_count_max'),
            'tentR'  => self::buildRangeParam($request, 'tents_count_min', 'tents_count_max'),
            'excel'  => $request->get('has_excel') ?: null,
        ];

        return CacheService::buildKey($prefix, $params);
    }

    /**
     * Build a range parameter string (returns null if both sides are empty).
     */
    private static function buildRangeParam(Request $request, string $minKey, string $maxKey): ?string
    {
        $min = $request->get($minKey, '');
        $max = $request->get($maxKey, '');

        if ($min === '' && $max === '') {
            return null;
        }

        return "{$min}-{$max}";
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Cached Response
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get a cached JSON response, or execute the callback and cache the result.
     */
    protected function getCachedResponse(
        string   $cacheKey,
        callable $callback,
        int      $ttl = 300
    ): JsonResponse {
        try {
            // ── Try cache hit ───────────────────────────────────────────
            $cachedData = Cache::get($cacheKey);

            if ($cachedData !== null) {
                return $this->respondWithEtag($cachedData, $ttl);
            }

            // ── Cache miss: execute callback ────────────────────────────
            $responseData = $callback();

            if (is_array($responseData)) {
                $responseData['cache_time'] = time();
            }

            Cache::put($cacheKey, $responseData, $ttl);

            return $this->respondWithEtag($responseData, $ttl);

        } catch (\Throwable $e) {
            Log::error('CacheableResponse: error in getCachedResponse', [
                'cache_key' => $cacheKey,
                'error'     => $e->getMessage(),
                'file'      => $e->getFile() . ':' . $e->getLine(),
            ]);

            // ✅ FIX: Delegate to ApiResponse::errorResponse() if available,
            //    otherwise use our own internal builder
            return $this->buildCacheErrorResponse($e);
        }
    }

    /**
     * ✅ RENAMED from errorResponse() → buildCacheErrorResponse()
     *    to avoid collision with ApiResponse::errorResponse()
     *
     *    This method tries to use ApiResponse::errorResponse() first,
     *    and falls back to a standalone JSON response if not available.
     */
    private function buildCacheErrorResponse(\Throwable $e): JsonResponse
    {
        // ✅ Try delegating to ApiResponse::errorResponse() if the trait is used
        if (method_exists($this, 'errorResponse')) {
            $exception = $e instanceof \Exception ? $e : new \Exception($e->getMessage(), (int) $e->getCode(), $e);
            return $this->errorResponse(
                'خطأ في الخادم',
                'حدث خطأ أثناء معالجة الطلب',
                500,
                $exception
            );
        }

        // ✅ Fallback: standalone error response (no ApiResponse trait)
        $payload = [
            'success' => false,
            'error'   => 'خطأ في الخادم',
            'message' => 'حدث خطأ أثناء معالجة الطلب',
        ];

        if (config('app.debug')) {
            $payload['debug'] = [
                'message' => $e->getMessage(),
                'file'    => $e->getFile() . ':' . $e->getLine(),
            ];
        }

        return response()
            ->json($payload, 500)
            ->withHeaders($this->cacheCorsHeaders());
    }

    /**
     * Build a JSON response with ETag and conditional 304 support.
     */
    private function respondWithEtag(mixed $data, int $ttl): JsonResponse
    {
        $etag = '"' . md5(serialize($data)) . '"';
        $requestEtag = request()->header('If-None-Match');

        if ($requestEtag === $etag) {
            return response()
                ->json(null, 304)
                ->withHeaders($this->buildCacheResponseHeaders($etag, $ttl, $data));
        }

        return response()
            ->json($data, 200)
            ->withHeaders($this->buildCacheResponseHeaders($etag, $ttl, $data));
    }

    /**
     * Centralized response headers builder.
     */
    private function buildCacheResponseHeaders(string $etag, int $ttl, mixed $data = null): array
    {
        $cacheTime = is_array($data) ? ($data['cache_time'] ?? time()) : time();

        return array_merge(
            [
                'ETag'          => $etag,
                'Cache-Control' => "private, max-age={$ttl}",
                'Last-Modified' => gmdate('D, d M Y H:i:s', $cacheTime) . ' GMT',
            ],
            $this->cacheCorsHeaders()
        );
    }

    /**
     * ✅ RENAMED from corsHeaders() → cacheCorsHeaders()
     *    to avoid potential collision with ApiResponse::addCorsHeaders()
     *
     *    If ApiResponse is also used, its addCorsHeaders() takes precedence
     *    for normal responses. This is only used for cache-specific responses.
     */
    private function cacheCorsHeaders(): array
    {
        $origin = request()->header('Origin', '*');
        $allowedOrigins = config('cors.allowed_origins', []);

        $corsOrigin = '*';
        if ($origin && $origin !== '*' && in_array($origin, $allowedOrigins)) {
            $corsOrigin = $origin;
        }

        return [
            'Access-Control-Allow-Origin'      => $corsOrigin,
            'Access-Control-Allow-Credentials' => 'true',
            'Access-Control-Allow-Methods'     => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers'     => 'Content-Type, Authorization, X-Requested-With, Accept',
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Cache Clearing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Clear cache by prefix/type.
     */
    protected function clearCacheByPrefix(string $prefix): void
    {
        try {
            CacheService::clear($prefix);
        } catch (\Throwable $e) {
            Log::warning('CacheableResponse: clearCacheByPrefix failed', [
                'prefix' => $prefix,
                'error'  => $e->getMessage(),
            ]);
        }
    }

    /**
     * Check if caching should be skipped for this request.
     */
    protected function shouldSkipCache(Request $request): bool
    {
        if ($request->header('Cache-Control') === 'no-cache') {
            return true;
        }

        if ($request->boolean('no_cache', false)) {
            return true;
        }

        return false;
    }
}