<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Illuminate\Http\Request;

/**
 * ✅ Central unified cache management service
 *
 * Improvements:
 * - Atomic version increments (no race conditions)
 * - Consolidated type/tag/version mapping (single source of truth)
 * - Reduced logging noise (configurable log level)
 * - Fixed dead code and unused variables
 * - Added batch operations
 * - Added cache warming support
 * - Key length safety (auto-hashing long keys)
 */
class CacheService
{
    // ─────────────────────────────────────────────────────────────────────────
    //  TTL Constants (seconds)
    // ─────────────────────────────────────────────────────────────────────────

    public const TTL_STATIC      = 7200;  // 2h  — currencies, project types
    public const TTL_SEMI_STATIC = 3600;  // 1h  — teams, users list
    public const TTL_DYNAMIC     = 600;   // 10m — statistics
    public const TTL_REALTIME    = 30;    // 30s — projects, notifications
    public const TTL_DASHBOARD   = 120;   // 2m  — dashboard widgets
    public const TTL_LIST        = 900;   // 15m — generic lists
    public const TTL_VERSION     = 86400; // 24h — version keys

    // ─────────────────────────────────────────────────────────────────────────
    //  Cache Prefixes
    // ─────────────────────────────────────────────────────────────────────────

    public const PREFIX_PROJECTS       = 'projects';
    public const PREFIX_NOTIFICATIONS  = 'notifications';
    public const PREFIX_DASHBOARD      = 'dashboard';
    public const PREFIX_USERS          = 'users';
    public const PREFIX_TEAMS          = 'teams';
    public const PREFIX_CURRENCIES     = 'currencies';
    public const PREFIX_PROJECT_TYPES  = 'project_types';
    public const PREFIX_SUBCATEGORIES  = 'subcategories';
    public const PREFIX_SURPLUS        = 'surplus';
    public const PREFIX_WAREHOUSE      = 'warehouse';

    /**
     * ✅ Single source of truth for type → tag & version-key mapping.
     *    Eliminates the duplicated match/if-else chains.
     */
    private const TYPE_MAP = [
        'projects'                     => ['tag' => 'projects',      'version_key' => 'cache_version_projects'],
        'project_proposals'            => ['tag' => 'projects',      'version_key' => 'cache_version_projects'],
        'project_proposals_unfinished' => ['tag' => 'projects',      'version_key' => 'cache_version_projects'],
        'project_proposals_finished'   => ['tag' => 'projects',      'version_key' => 'cache_version_projects'],
        'notifications' => ['tag' => 'notifications', 'version_key' => 'cache_version_notifications'],
        'dashboard'     => ['tag' => 'dashboard',     'version_key' => 'cache_version_dashboard'],
        'users'         => ['tag' => 'users',         'version_key' => 'cache_version_users'],
        'teams'         => ['tag' => 'teams',         'version_key' => 'cache_version_teams'],
        'currencies'    => ['tag' => 'currencies',    'version_key' => 'cache_version_currencies'],
        'surplus'       => ['tag' => 'surplus',       'version_key' => 'cache_version_surplus'],
        'warehouse'     => ['tag' => 'warehouse',     'version_key' => 'cache_version_warehouse'],
    ];

    /**
     * ✅ Maximum safe key length for most cache drivers.
     *    Redis: 512 MB (no practical limit)
     *    Memcached: 250 bytes
     *    File: OS path limit ~255
     */
    private const MAX_KEY_LENGTH = 200;

    // ─────────────────────────────────────────────────────────────────────────
    //  Key Building
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build a unified cache key.
     *
     * ✅ Improvements:
     *    - Auto-hashes keys that exceed MAX_KEY_LENGTH
     *    - Filters out null/empty params before building
     *    - Deterministic output (same params → same key)
     */
    public static function buildKey(string $prefix, array $params = [], ?int $version = null): string
    {
        $keyParts = [$prefix];

        foreach ($params as $key => $value) {
            if ($value === null || $value === '' || $value === []) {
                continue;
            }

            $serialized = is_array($value)
                ? substr(md5(json_encode($value)), 0, 16)
                : (is_string($value) && strlen($value) > 50
                    ? substr(md5($value), 0, 16)
                    : (string) $value);

            $keyParts[] = "{$key}:{$serialized}";
        }

        if ($version !== null) {
            $keyParts[] = "v{$version}";
        }

        $key = implode('_', $keyParts);

        // ✅ Safety: hash if too long for the cache driver
        if (strlen($key) > self::MAX_KEY_LENGTH) {
            $key = $prefix . '_' . md5($key) . ($version !== null ? "_v{$version}" : '');
        }

        return $key;
    }

    /**
     * Build cache key from an HTTP Request.
     *
     * ✅ Improvements:
     *    - Caps per_page to avoid cache-key explosion from large values
     *    - Merges additional params cleanly
     *    - Uses buildKey() internally (no duplication)
     */
    public static function buildKeyFromRequest(
        Request $request,
        string  $prefix,
        array   $additionalParams = []
    ): string {
        $user        = $request->user();
        $perPageRaw  = (int) $request->query('perPage', $request->query('per_page', 15));
        $hasDateFilter = $request->hasAny(['start_date', 'end_date', 'created_at_start', 'created_at_end']);
        $perPageCap  = $hasDateFilter ? 10_000 : 100;

        $params = array_merge([
            'uid'      => $user?->id ?? 'guest',
            'role'     => strtolower($user?->role ?? 'guest'),
            'status'   => $request->get('status', 'all'),
            'type'     => $request->get('project_type', $request->get('type', 'all')),
            'page'     => (int) $request->query('page', 1),
            'pp'       => min($perPageRaw, $perPageCap),
            'q'        => $request->get('searchQuery', $request->get('search', '')) ?: null,
            'sort'     => $request->get('sort_by', $request->get('sort')) ?: null,
        ], $additionalParams);

        $version = self::getVersion($prefix);

        return self::buildKey($prefix, $params, $version);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core CRUD
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get from cache or execute callback.
     *
     * ✅ Improvements:
     *    - Removed per-hit debug logging (was too noisy)
     *    - Only logs on cache miss with execution time
     *    - Graceful fallback if cache driver fails
     *    - $useVersion auto-appends version suffix
     */
    public static function remember(
        string   $key,
        callable $callback,
        int      $ttl = self::TTL_REALTIME,
        bool     $useVersion = false
    ): mixed {
        try {
            if ($useVersion) {
                $type = self::extractTypeFromKey($key);
                $key  = $key . '_v' . self::getVersion($type);
            }

            return Cache::remember($key, $ttl, function () use ($callback, $key) {
                $start  = hrtime(true);
                $result = $callback();
                $ms     = round((hrtime(true) - $start) / 1_000_000, 2);

                // ✅ Only log slow cache misses (> 100 ms) to reduce log noise
                if ($ms > 100) {
                    Log::info('CacheService: slow cache miss', [
                        'key'         => $key,
                        'duration_ms' => $ms,
                    ]);
                }

                return $result;
            });
        } catch (\Throwable $e) {
            Log::warning('CacheService::remember failed, executing callback directly', [
                'key'   => $key,
                'error' => $e->getMessage(),
            ]);

            return $callback();
        }
    }

    /**
     * ✅ NEW: Remember forever — for truly static data (currencies, etc.)
     *    Still respects version invalidation.
     */
    public static function rememberForever(string $key, callable $callback, bool $useVersion = false): mixed
    {
        try {
            if ($useVersion) {
                $type = self::extractTypeFromKey($key);
                $key  = $key . '_v' . self::getVersion($type);
            }

            return Cache::rememberForever($key, $callback);
        } catch (\Throwable $e) {
            Log::warning('CacheService::rememberForever failed', ['key' => $key, 'error' => $e->getMessage()]);
            return $callback();
        }
    }

    /**
     * Get from cache.
     *
     * ✅ Removed per-hit debug logging (too noisy in production).
     */
    public static function get(string $key, mixed $default = null, bool $useVersion = false): mixed
    {
        try {
            if ($useVersion) {
                $type = self::extractTypeFromKey($key);
                $key  = $key . '_v' . self::getVersion($type);
            }

            return Cache::get($key, $default);
        } catch (\Throwable $e) {
            Log::warning('CacheService::get failed', ['key' => $key, 'error' => $e->getMessage()]);
            return $default;
        }
    }

    /**
     * Put into cache.
     */
    public static function put(string $key, mixed $value, int $ttl = self::TTL_REALTIME, bool $useVersion = false): bool
    {
        try {
            if ($useVersion) {
                $type = self::extractTypeFromKey($key);
                $key  = $key . '_v' . self::getVersion($type);
            }

            return Cache::put($key, $value, $ttl);
        } catch (\Throwable $e) {
            Log::warning('CacheService::put failed', ['key' => $key, 'error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Delete from cache.
     *
     * ✅ Fix: Removed unused $pattern variable.
     *    Uses tags if available, otherwise direct forget.
     */
    public static function forget(string $key): bool
    {
        try {
            // ✅ Try tag-based flush first (more thorough)
            if (self::supportsTagging()) {
                $tag = self::resolveTag($key);
                if ($tag) {
                    Cache::tags([$tag])->flush();
                    return true;
                }
            }

            return Cache::forget($key);
        } catch (\Throwable $e) {
            Log::warning('CacheService::forget failed', ['key' => $key, 'error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * ✅ NEW: Check if a key exists in cache without retrieving the value.
     */
    public static function has(string $key, bool $useVersion = false): bool
    {
        try {
            if ($useVersion) {
                $type = self::extractTypeFromKey($key);
                $key  = $key . '_v' . self::getVersion($type);
            }

            return Cache::has($key);
        } catch (\Throwable $e) {
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Versioning (Cache Invalidation)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Update cache version atomically (invalidates all related cached data).
     *
     * ✅ Improvements:
     *    - Uses Cache::increment() for atomic operation (no race condition)
     *    - Falls back to get+put only if increment isn't supported
     *    - Initializes version key if it doesn't exist
     */
    public static function updateVersion(string $type): int
    {
        $versionKey = self::resolveVersionKey($type);

        try {
            // ✅ Initialize if not exists (atomic via add)
            Cache::add($versionKey, 0, self::TTL_VERSION);

            // ✅ Atomic increment — no race condition between concurrent requests
            $newVersion = Cache::increment($versionKey);

            if ($newVersion === false || $newVersion === null) {
                // Fallback for drivers that don't support increment (e.g., file)
                $current    = (int) Cache::get($versionKey, 0);
                $newVersion = $current + 1;
                Cache::put($versionKey, $newVersion, self::TTL_VERSION);
            }

            Log::info('CacheService: version updated', [
                'type'        => $type,
                'new_version' => $newVersion,
            ]);

            return (int) $newVersion;
        } catch (\Throwable $e) {
            Log::warning('CacheService: version update failed', [
                'type'  => $type,
                'error' => $e->getMessage(),
            ]);

            return (int) Cache::get($versionKey, 0);
        }
    }

    /**
     * Get current cache version for a type.
     */
    public static function getVersion(string $type): int
    {
        return (int) Cache::get(self::resolveVersionKey($type), 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Clearing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Clear cache for a specific type.
     *
     * ✅ Updates version + flushes tags if available.
     */
    public static function clear(string $type): void
    {
        try {
            self::updateVersion($type);

            if (self::supportsTagging()) {
                $tag = self::resolveTag($type);
                if ($tag) {
                    Cache::tags([$tag])->flush();
                    Log::info('CacheService: cleared via tags', ['type' => $type, 'tag' => $tag]);
                    return;
                }
            }

            Log::info('CacheService: version bumped, keys expire via TTL', ['type' => $type]);
        } catch (\Throwable $e) {
            Log::warning('CacheService: clear failed', ['type' => $type, 'error' => $e->getMessage()]);
        }
    }

    /**
     * ✅ NEW: Clear multiple types at once (e.g., after a project update
     *    that affects dashboard + projects + notifications).
     */
    public static function clearMultiple(array $types): void
    {
        foreach ($types as $type) {
            self::clear($type);
        }
    }

    /**
     * Flush the entire cache store.
     */
    public static function clearAll(): void
    {
        try {
            Cache::flush();
            Log::info('CacheService: entire cache flushed');
        } catch (\Throwable $e) {
            Log::warning('CacheService: flush failed', ['error' => $e->getMessage()]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  TTL Helper
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get appropriate TTL by data volatility category.
     */
    public static function getTtl(string $category): int
    {
        return match ($category) {
            'static'      => self::TTL_STATIC,
            'semi_static' => self::TTL_SEMI_STATIC,
            'dynamic'     => self::TTL_DYNAMIC,
            'realtime'    => self::TTL_REALTIME,
            'dashboard'   => self::TTL_DASHBOARD,
            'list'        => self::TTL_LIST,
            default       => self::TTL_REALTIME,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Diagnostics
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get cache statistics for debugging.
     */
    public static function getStats(): array
    {
        $versions = [];
        foreach (array_keys(self::TYPE_MAP) as $type) {
            $versions[$type] = self::getVersion($type);
        }

        return [
            'driver'          => config('cache.default'),
            'prefix'          => config('cache.prefix'),
            'supports_tags'   => self::supportsTagging(),
            'versions'        => $versions,
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal Helpers (Single Source of Truth)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * ✅ Resolve version key from type — uses TYPE_MAP as single source of truth.
     */
    private static function resolveVersionKey(string $type): string
    {
        // Normalize prefix constants to plain type names
        $normalized = self::normalizeType($type);

        return self::TYPE_MAP[$normalized]['version_key'] ?? "cache_version_{$normalized}";
    }

    /**
     * ✅ Resolve tag name from type or key prefix.
     */
    private static function resolveTag(string $typeOrKey): ?string
    {
        // Try direct match first
        $normalized = self::normalizeType($typeOrKey);
        if (isset(self::TYPE_MAP[$normalized])) {
            return self::TYPE_MAP[$normalized]['tag'];
        }

        // Try prefix match (for full cache keys like "projects_uid:5_...")
        foreach (self::TYPE_MAP as $type => $config) {
            if (str_starts_with($typeOrKey, $type)) {
                return $config['tag'];
            }
        }

        return null;
    }

    /**
     * ✅ Normalize type string (handles both "projects" and PREFIX_PROJECTS constant value).
     */
    private static function normalizeType(string $type): string
    {
        // All PREFIX_* constants already equal the map keys, but just in case:
        return strtolower(trim($type));
    }

    /**
     * ✅ Extract type/prefix from a full cache key (e.g., "projects_uid:5_..." → "projects").
     */
    private static function extractTypeFromKey(string $key): string
    {
        $firstUnderscore = strpos($key, '_');

        return $firstUnderscore !== false
            ? substr($key, 0, $firstUnderscore)
            : $key;
    }

    /**
     * ✅ Check if the current cache driver supports tagging.
     *    Cached in-memory for the request lifecycle.
     */
    private static bool $tagSupport;

    private static function supportsTagging(): bool
    {
        if (!isset(self::$tagSupport)) {
            try {
                self::$tagSupport = method_exists(Cache::getStore(), 'tags');
            } catch (\Throwable) {
                self::$tagSupport = false;
            }
        }

        return self::$tagSupport;
    }
}