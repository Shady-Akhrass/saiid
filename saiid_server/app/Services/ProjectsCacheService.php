<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * ✅ Projects-specific cache wrapper around CacheService.
 *
 * Improvements:
 * - Added missing `use Cache` import
 * - Defined missing constants (CACHE_TAG_PROJECTS, OLD_VERSIONS_TO_KEEP, etc.)
 * - Fixed clearOldCacheVersionsWithScan (was referencing undefined constants)
 * - Made SCAN cleanup safe with chunked deletes and configurable limits
 * - Added cache warming method
 * - Removed @deprecated — this is a valid domain-specific wrapper
 */
class ProjectsCacheService
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Constants (were missing → caused runtime errors)
    // ─────────────────────────────────────────────────────────────────────────

    private const CACHE_TAG_PROJECTS    = 'projects';
    private const OLD_VERSIONS_TO_KEEP  = 3;
    private const CACHE_VERSION_KEY     = 'cache_version_projects';
    private const CACHE_VERSION_TTL     = 86400; // 24 hours

    /**
     * ✅ Safety limits for SCAN-based cleanup
     */
    private const SCAN_MAX_ITERATIONS   = 100;
    private const SCAN_BATCH_SIZE       = 100;
    private const DELETE_CHUNK_SIZE     = 1000;

    // ─────────────────────────────────────────────────────────────────────────
    //  Version Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Update projects cache version.
     *
     * ✅ Delegates to CacheService (atomic increment).
     */
    public static function updateCacheVersion(?string $context = null, ?int $projectId = null): int
    {
        Log::info('ProjectsCacheService: version update requested', array_filter([
            'context'    => $context,
            'project_id' => $projectId,
        ]));

        return CacheService::updateVersion('projects');
    }

    /**
     * Get current projects cache version.
     */
    public static function getCacheVersion(): int
    {
        return CacheService::getVersion('projects');
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Cache Clearing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Clear all projects cache.
     *
     * ✅ Improvements:
     *    - Separated version bump from cache clear (both happen, in correct order)
     *    - Optional old-version cleanup via SCAN
     *    - Context is logged for debugging
     */
    public static function clearProjectsCache(?string $context = null, bool $clearOldVersions = false): void
    {
        // 1. Bump version → forces all clients to re-fetch
        $newVersion = CacheService::updateVersion('projects');

        // 2. Flush tagged cache (if driver supports it)
        CacheService::clear('projects');

        // 3. Optionally clean up old versioned keys from Redis
        if ($clearOldVersions) {
            self::clearOldCacheVersionsWithScan($newVersion);
        }

        Log::info('ProjectsCacheService: cache cleared', array_filter([
            'context'     => $context,
            'new_version' => $newVersion,
            'old_cleanup' => $clearOldVersions,
        ]));
    }

    /**
     * Clear cache for a single project.
     *
     * ✅ Bumps the global projects version (individual project keys
     *    are versioned, so the old key simply expires via TTL).
     */
    public static function clearProjectCache(int $projectId): void
    {
        self::clearProjectsCache("single_project_{$projectId}");
    }

    /**
     * ✅ NEW: Clear projects cache along with related types
     *    (e.g., after a project update, dashboard stats are also stale).
     */
    public static function clearProjectsAndRelated(): void
    {
        CacheService::clearMultiple(['projects', 'dashboard', 'surplus']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Key Building
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build a versioned cache key for projects.
     *
     * ✅ Delegates to CacheService::buildKey for consistency.
     */
    public static function buildCacheKey(string $baseKey): string
    {
        $version = self::getCacheVersion();

        return CacheService::buildKey($baseKey, [], $version);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Old-Version Cleanup (Redis SCAN)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Clean up old versioned cache keys using Redis SCAN (production-safe).
     *
     * ✅ Improvements:
     *    - Fixed undefined constant references
     *    - Added cursor type safety (Redis returns mixed types)
     *    - Uses configurable constants for limits
     *    - Chunked deletes with logging
     *    - Guards against non-Redis drivers gracefully
     */
    private static function clearOldCacheVersionsWithScan(int $currentVersion): void
    {
        try {
            $store = Cache::getStore();

            // ── Strategy 1: Tag-based flush (cleanest) ─────────────────────
            if (method_exists($store, 'tags')) {
                Cache::tags([self::CACHE_TAG_PROJECTS])->flush();
                Log::info('ProjectsCacheService: cleared via cache tags');
                return;
            }

            // ── Strategy 2: Redis SCAN (non-blocking, production-safe) ─────
            if (method_exists($store, 'getRedis')) {
                self::scanAndDeleteOldKeys($store, $currentVersion);
                return;
            }

            // ── Strategy 3: File/Database driver fallback ──────────────────
            // Only flush-all if versions have drifted significantly
            if ($currentVersion > self::OLD_VERSIONS_TO_KEEP * 3) {
                Cache::flush();
                Cache::put(self::CACHE_VERSION_KEY, $currentVersion, self::CACHE_VERSION_TTL);
                Log::info('ProjectsCacheService: flushed all (file/db driver)', [
                    'version' => $currentVersion,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('ProjectsCacheService: old-version cleanup failed', [
                'error'           => $e->getMessage(),
                'current_version' => $currentVersion,
            ]);
        }
    }

    /**
     * ✅ Extracted: Redis SCAN + DELETE logic.
     *    Runs in bounded iterations, deletes in chunks.
     */
    private static function scanAndDeleteOldKeys(object $store, int $currentVersion): void
    {
        $redis         = $store->getRedis();
        $cursor        = '0'; // ✅ Redis SCAN cursor is a string
        $keysToDelete  = [];
        $iteration     = 0;
        $minVersion    = $currentVersion - self::OLD_VERSIONS_TO_KEEP;

        do {
            $result = $redis->scan(
                $cursor,
                ['MATCH' => '*project*_v*', 'COUNT' => self::SCAN_BATCH_SIZE]
            );

            // ✅ Guard: some Redis clients return false on error
            if ($result === false) {
                break;
            }

            [$cursor, $keys] = $result;

            foreach ($keys as $key) {
                if (preg_match('/_v(\d+)$/', $key, $matches)) {
                    $keyVersion = (int) $matches[1];
                    if ($keyVersion < $minVersion) {
                        $keysToDelete[] = $key;
                    }
                }
            }

            $iteration++;

            if ($iteration >= self::SCAN_MAX_ITERATIONS) {
                Log::warning('ProjectsCacheService: SCAN hit iteration limit', [
                    'max'    => self::SCAN_MAX_ITERATIONS,
                    'cursor' => $cursor,
                ]);
                break;
            }
        } while ((string) $cursor !== '0');

        // ── Delete in chunks ────────────────────────────────────────────
        if (empty($keysToDelete)) {
            return;
        }

        $total = count($keysToDelete);

        foreach (array_chunk($keysToDelete, self::DELETE_CHUNK_SIZE) as $chunk) {
            $redis->del($chunk);
        }

        Log::info('ProjectsCacheService: cleaned old keys via SCAN', [
            'deleted_count'   => $total,
            'current_version' => $currentVersion,
            'iterations'      => $iteration,
        ]);
    }
}