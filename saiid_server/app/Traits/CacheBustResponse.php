<?php
// app/Traits/CacheBustResponse.php

namespace App\Traits;

use App\Services\CacheService;
use Illuminate\Http\JsonResponse;

trait CacheBustResponse
{
    /**
     * Wrap response with cache-busting headers for frontend.
     */
    protected function cacheBustResponse(array $data, int $status = 200): JsonResponse
    {
        $data['cache_bust'] = time();

        $response = response()->json($data, $status);

        $response->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0')
            ->header('X-Cache-Bust', (string) time());

        // Add version header if CacheService available
        try {
            $response->header('X-Cache-Version', CacheService::getVersion('projects'));
        } catch (\Exception) {
            // CacheService may not be available
        }

        // CORS
        if (method_exists($this, 'addCorsHeaders')) {
            return $this->addCorsHeaders($response);
        }

        return $response;
    }
}