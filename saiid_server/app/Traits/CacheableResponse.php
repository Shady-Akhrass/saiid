<?php

namespace App\Traits;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

trait CacheableResponse
{
    /**
     * Build cache key from request parameters
     */
    protected function buildCacheKey(string $prefix, Request $request, ?int $userId = null, ?string $userRole = null): string
    {
        $params = [
            $prefix,
            $userId ?? $request->user()?->id ?? 'guest',
            $userRole ?? $request->user()?->role ?? 'guest',
        ];

        // Add key parameters (only important ones)
        $keyParams = [
            'status' => $request->get('status', 'all'),
            'type' => $request->get('type', $request->get('project_type', 'all')),
            'search' => substr(md5($request->get('searchQuery', '')), 0, 8),
            'page' => (int) $request->query('page', 1),
            'perPage' => min((int) $request->query('perPage', 15), 100),
            'sort' => $request->get('sort_by', $request->get('sort', 'default')),
            'filter' => substr(md5(json_encode($request->only(['unread_only', 'active_only', 'include_executed']))), 0, 8),
            // ✅ مفاتيح إضافية لدعم فلاتر المخيمات وغيرها بدون كسر الكاش القديم
            'gov' => $request->get('governorate', 'all'),
            'dist' => $request->get('district', 'all'),
            'mgr' => substr(md5($request->get('manager_name', '')), 0, 8),
            'mgrPhone' => substr(md5($request->get('manager_phone', '')), 0, 8),
            'famRange' => ($request->get('families_count_min', '') . '-' . $request->get('families_count_max', '')),
            'tentsRange' => ($request->get('tents_count_min', '') . '-' . $request->get('tents_count_max', '')),
            'excelFlag' => $request->get('has_excel', ''),
        ];

        $params = array_merge($params, array_values($keyParams));

        return implode('_', $params);
    }

    /**
     * Get cached response or execute callback
     */
    protected function getCachedResponse(string $cacheKey, callable $callback, int $ttl = 300): \Illuminate\Http\JsonResponse
    {
        try {
            // Try to get from cache
            $cachedData = Cache::get($cacheKey);
            
            if ($cachedData !== null) {
                $etag = md5($cacheKey . '_' . ($cachedData['cache_time'] ?? time()));
                $requestEtag = request()->header('If-None-Match');
                
                if ($requestEtag === $etag) {
                    return response()->json([], 304)
                        ->header('ETag', $etag)
                        ->header('Access-Control-Allow-Origin', request()->header('Origin', '*'))
                        ->header('Access-Control-Allow-Credentials', 'true');
                }
                
                return response()->json($cachedData, 200)
                    ->header('ETag', $etag)
                    ->header('Cache-Control', 'private, max-age=' . $ttl)
                    ->header('Last-Modified', gmdate('D, d M Y H:i:s', $cachedData['cache_time'] ?? time()) . ' GMT')
                    ->header('Access-Control-Allow-Origin', request()->header('Origin', '*'))
                    ->header('Access-Control-Allow-Credentials', 'true');
            }

            // Execute callback to get fresh data
            $responseData = $callback();
            
            // Add cache timestamp
            if (is_array($responseData)) {
                $responseData['cache_time'] = time();
            }

            // Store in cache
            Cache::put($cacheKey, $responseData, $ttl);

            // Generate ETag
            $etag = md5($cacheKey . '_' . $responseData['cache_time']);

            return response()->json($responseData, 200)
                ->header('ETag', $etag)
                ->header('Cache-Control', 'private, max-age=' . $ttl)
                ->header('Last-Modified', gmdate('D, d M Y H:i:s', $responseData['cache_time']) . ' GMT')
                ->header('Access-Control-Allow-Origin', request()->header('Origin', '*'))
                ->header('Access-Control-Allow-Credentials', 'true');
                
        } catch (\Exception $e) {
            // ✅ معالجة الأخطاء مع ضمان إرسال CORS headers
            \Log::error('Error in getCachedResponse', [
                'cache_key' => $cacheKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'خطأ في الخادم',
                'message' => $e->getMessage()
            ], 500)
                ->header('Access-Control-Allow-Origin', request()->header('Origin', '*'))
                ->header('Access-Control-Allow-Credentials', 'true')
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers', '*');
        }
    }

    /**
     * Clear cache by prefix
     */
    protected function clearCacheByPrefix(string $prefix): void
    {
        try {
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags([$prefix])->flush();
            } else {
                // For file cache, we'll flush all (can be improved with Redis/Memcached)
                Cache::flush();
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to clear cache', ['prefix' => $prefix, 'error' => $e->getMessage()]);
        }
    }
}

