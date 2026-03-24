<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;

/**
 * ✅ Service مركزي شامل لإدارة الكاش في كل البرنامج
 * يوحد منطق الكاش ويحسّن الأداء
 */
class CacheService
{
    // Cache TTL Constants (بالثواني) - ✅ محسّنة للأداء
    public const TTL_STATIC = 7200;        // 2 ساعة - بيانات ثابتة (عملات، أنواع المشاريع) - زادت من 1 ساعة
    public const TTL_SEMI_STATIC = 3600;   // 1 ساعة - بيانات شبه ثابتة (فرق، مستخدمين) - زادت من 30 دقيقة
    public const TTL_DYNAMIC = 600;        // 10 دقائق - بيانات متغيرة (إحصائيات) - زادت من 5 دقائق
    public const TTL_REALTIME = 30;        // 30 ثانية - بيانات فورية (مشاريع، إشعارات) - زادت من 10 ثواني
    public const TTL_DASHBOARD = 120;       // 2 دقيقة - Dashboard - زادت من 1 دقيقة
    public const TTL_LIST = 900;           // 15 دقيقة - قوائم (مستخدمين، فرق) - زادت من 10 دقائق

    // Cache Prefixes
    public const PREFIX_PROJECTS = 'projects';
    public const PREFIX_NOTIFICATIONS = 'notifications';
    public const PREFIX_DASHBOARD = 'dashboard';
    public const PREFIX_USERS = 'users';
    public const PREFIX_TEAMS = 'teams';
    public const PREFIX_CURRENCIES = 'currencies';
    public const PREFIX_PROJECT_TYPES = 'project_types';
    public const PREFIX_SUBCATEGORIES = 'subcategories';
    public const PREFIX_SURPLUS = 'surplus';
    public const PREFIX_WAREHOUSE = 'warehouse';

    // Cache Version Keys
    private const VERSION_PROJECTS = 'cache_version_projects';
    private const VERSION_NOTIFICATIONS = 'cache_version_notifications';
    private const VERSION_DASHBOARD = 'cache_version_dashboard';
    private const VERSION_USERS = 'cache_version_users';
    private const VERSION_TEAMS = 'cache_version_teams';

    /**
     * بناء cache key موحد
     *
     * @param string $prefix البادئة
     * @param array $params المعاملات
     * @param int|null $version إصدار الكاش (اختياري)
     * @return string
     */
    public static function buildKey(string $prefix, array $params = [], ?int $version = null): string
    {
        $keyParts = [$prefix];
        
        // إضافة المعاملات
        foreach ($params as $key => $value) {
            if ($value !== null && $value !== '') {
                // تقصير القيم الطويلة
                if (is_string($value) && strlen($value) > 50) {
                    $value = substr(md5($value), 0, 16);
                }
                $keyParts[] = "{$key}:" . (is_array($value) ? md5(json_encode($value)) : $value);
            }
        }
        
        $key = implode('_', $keyParts);
        
        // إضافة الإصدار إذا كان موجوداً
        if ($version !== null) {
            $key .= '_v' . $version;
        }
        
        return $key;
    }

    /**
     * جلب من الكاش أو تنفيذ callback
     *
     * @param string $key
     * @param callable $callback
     * @param int $ttl
     * @param bool $useVersion استخدام versioning
     * @return mixed
     */
    public static function remember(string $key, callable $callback, int $ttl = self::TTL_REALTIME, bool $useVersion = false)
    {
        try {
            // إضافة version إذا كان مطلوباً
            if ($useVersion) {
                $version = self::getVersion($key);
                $key = $key . '_v' . $version;
            }
            
            return Cache::remember($key, $ttl, function () use ($callback, $key) {
                $startTime = microtime(true);
                $result = $callback();
                $duration = round((microtime(true) - $startTime) * 1000, 2);
                
                Log::debug('Cache miss - executed callback', [
                    'key' => $key,
                    'duration_ms' => $duration
                ]);
                
                return $result;
            });
        } catch (\Exception $e) {
            Log::warning('Cache error, executing callback directly', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return $callback();
        }
    }

    /**
     * جلب من الكاش
     *
     * @param string $key
     * @param mixed $default
     * @param bool $useVersion
     * @return mixed
     */
    public static function get(string $key, $default = null, bool $useVersion = false)
    {
        try {
            if ($useVersion) {
                $version = self::getVersion($key);
                $key = $key . '_v' . $version;
            }
            
            $value = Cache::get($key, $default);
            
            if ($value !== null && $value !== $default) {
                Log::debug('Cache hit', ['key' => $key]);
            }
            
            return $value;
        } catch (\Exception $e) {
            Log::warning('Cache get error', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return $default;
        }
    }

    /**
     * حفظ في الكاش
     *
     * @param string $key
     * @param mixed $value
     * @param int $ttl
     * @param bool $useVersion
     * @return bool
     */
    public static function put(string $key, $value, int $ttl = self::TTL_REALTIME, bool $useVersion = false): bool
    {
        try {
            if ($useVersion) {
                $version = self::getVersion($key);
                $key = $key . '_v' . $version;
            }
            
            return Cache::put($key, $value, $ttl);
        } catch (\Exception $e) {
            Log::warning('Cache put error', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * حذف من الكاش
     *
     * @param string $key
     * @return bool
     */
    public static function forget(string $key): bool
    {
        try {
            // حذف جميع الإصدارات المحتملة
            $pattern = $key . '_v*';
            
            // استخدام tags إذا كان متاحاً
            if (method_exists(Cache::getStore(), 'tags')) {
                $tag = self::getTagFromKey($key);
                if ($tag) {
                    Cache::tags([$tag])->flush();
                    return true;
                }
            }
            
            // حذف مباشر
            return Cache::forget($key);
        } catch (\Exception $e) {
            Log::warning('Cache forget error', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * تحديث cache version (لإبطال جميع الكاشات المرتبطة)
     *
     * @param string $type نوع الكاش (projects, notifications, etc.)
     * @return int الإصدار الجديد
     */
    public static function updateVersion(string $type): int
    {
        try {
            $versionKey = self::getVersionKey($type);
            $currentVersion = Cache::get($versionKey, 0);
            $newVersion = $currentVersion + 1;
            
            Cache::put($versionKey, $newVersion, 86400); // 24 ساعة
            
            Log::info('Cache version updated', [
                'type' => $type,
                'old_version' => $currentVersion,
                'new_version' => $newVersion
            ]);
            
            return $newVersion;
        } catch (\Exception $e) {
            Log::warning('Failed to update cache version', [
                'type' => $type,
                'error' => $e->getMessage()
            ]);
            return Cache::get(self::getVersionKey($type), 0);
        }
    }

    /**
     * الحصول على cache version
     *
     * @param string $type
     * @return int
     */
    public static function getVersion(string $type): int
    {
        return Cache::get(self::getVersionKey($type), 0);
    }

    /**
     * مسح كاش نوع معين
     *
     * @param string $type
     * @return void
     */
    public static function clear(string $type): void
    {
        try {
            // تحديث الإصدار (أسرع وأكثر أماناً)
            self::updateVersion($type);
            
            // استخدام tags إذا كان متاحاً
            if (method_exists(Cache::getStore(), 'tags')) {
                $tag = self::getTagFromType($type);
                if ($tag) {
                    Cache::tags([$tag])->flush();
                    Log::info('Cache cleared using tags', ['type' => $type, 'tag' => $tag]);
                    return;
                }
            }
            
            Log::info('Cache version updated (keys will expire via TTL)', ['type' => $type]);
        } catch (\Exception $e) {
            Log::warning('Failed to clear cache', [
                'type' => $type,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * مسح جميع الكاشات
     *
     * @return void
     */
    public static function clearAll(): void
    {
        try {
            Cache::flush();
            Log::info('All cache cleared');
        } catch (\Exception $e) {
            Log::warning('Failed to clear all cache', ['error' => $e->getMessage()]);
        }
    }

    /**
     * بناء cache key من Request
     *
     * @param Request $request
     * @param string $prefix
     * @param array $additionalParams
     * @return string
     */
    public static function buildKeyFromRequest(Request $request, string $prefix, array $additionalParams = []): string
    {
        $user = $request->user();
        $perPageRaw = (int) $request->query('perPage', $request->query('per_page', 15));
        $hasDateFilter = $request->filled('start_date') || $request->filled('end_date')
            || $request->filled('created_at_start') || $request->filled('created_at_end');
        $perPageCap = $hasDateFilter ? 10000 : 100;
        $params = array_merge([
            'user_id' => $user?->id ?? 'guest',
            'role' => strtolower($user?->role ?? 'guest'),
            'status' => $request->get('status', 'all'),
            'type' => $request->get('project_type', $request->get('type', 'all')),
            'page' => (int) $request->query('page', 1),
            'per_page' => min($perPageRaw, $perPageCap),
            'search' => substr(md5($request->get('searchQuery', $request->get('search', ''))), 0, 8),
        ], $additionalParams);

        return self::buildKey($prefix, $params);
    }

    /**
     * الحصول على TTL حسب نوع البيانات
     *
     * @param string $type
     * @return int
     */
    public static function getTtl(string $type): int
    {
        return match($type) {
            'static' => self::TTL_STATIC,
            'semi_static' => self::TTL_SEMI_STATIC,
            'dynamic' => self::TTL_DYNAMIC,
            'realtime' => self::TTL_REALTIME,
            'dashboard' => self::TTL_DASHBOARD,
            'list' => self::TTL_LIST,
            default => self::TTL_REALTIME,
        };
    }

    /**
     * الحصول على version key
     *
     * @param string $type
     * @return string
     */
    private static function getVersionKey(string $type): string
    {
        return match($type) {
            'projects', self::PREFIX_PROJECTS => self::VERSION_PROJECTS,
            'notifications', self::PREFIX_NOTIFICATIONS => self::VERSION_NOTIFICATIONS,
            'dashboard', self::PREFIX_DASHBOARD => self::VERSION_DASHBOARD,
            'users', self::PREFIX_USERS => self::VERSION_USERS,
            'teams', self::PREFIX_TEAMS => self::VERSION_TEAMS,
            default => 'cache_version_' . $type,
        };
    }

    /**
     * الحصول على tag من key
     *
     * @param string $key
     * @return string|null
     */
    private static function getTagFromKey(string $key): ?string
    {
        if (str_starts_with($key, self::PREFIX_PROJECTS)) {
            return 'projects';
        }
        if (str_starts_with($key, self::PREFIX_NOTIFICATIONS)) {
            return 'notifications';
        }
        if (str_starts_with($key, self::PREFIX_DASHBOARD)) {
            return 'dashboard';
        }
        if (str_starts_with($key, self::PREFIX_USERS)) {
            return 'users';
        }
        if (str_starts_with($key, self::PREFIX_TEAMS)) {
            return 'teams';
        }
        return null;
    }

    /**
     * الحصول على tag من type
     *
     * @param string $type
     * @return string|null
     */
    private static function getTagFromType(string $type): ?string
    {
        return match($type) {
            'projects', self::PREFIX_PROJECTS => 'projects',
            'notifications', self::PREFIX_NOTIFICATIONS => 'notifications',
            'dashboard', self::PREFIX_DASHBOARD => 'dashboard',
            'users', self::PREFIX_USERS => 'users',
            'teams', self::PREFIX_TEAMS => 'teams',
            default => null,
        };
    }

    /**
     * إحصائيات الكاش (للتشخيص)
     *
     * @return array
     */
    public static function getStats(): array
    {
        return [
            'driver' => config('cache.default'),
            'prefix' => config('cache.prefix'),
            'versions' => [
                'projects' => self::getVersion('projects'),
                'notifications' => self::getVersion('notifications'),
                'dashboard' => self::getVersion('dashboard'),
                'users' => self::getVersion('users'),
                'teams' => self::getVersion('teams'),
            ],
        ];
    }
}

