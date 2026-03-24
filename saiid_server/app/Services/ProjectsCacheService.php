<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Service مركزي لإدارة cache المشاريع
 * ✅ يستخدم CacheService الموحد الآن
 * 
 * @deprecated يفضل استخدام CacheService مباشرة
 * لكن نبقيه للتوافق مع الكود الموجود
 */
class ProjectsCacheService
{
    /**
     * تحديث cache version للمشاريع
     * 
     * @param string|null $context
     * @param int|null $projectId
     * @return int
     */
    public static function updateCacheVersion(?string $context = null, ?int $projectId = null): int
    {
        Log::info('Projects cache version update requested', [
            'context' => $context,
            'project_id' => $projectId
        ]);
        
        return CacheService::updateVersion('projects');
    }

    /**
     * الحصول على cache version الحالي
     * 
     * @return int
     */
    public static function getCacheVersion(): int
    {
        return CacheService::getVersion('projects');
    }

    /**
     * مسح cache المشاريع بشكل كامل
     * ✅ محسّن للأداء - يمسح الكاش بشكل فوري
     * 
     * @param string|null $context
     * @param bool $clearOldVersions (مهمل - للتوافق)
     * @return void
     */
    public static function clearProjectsCache(?string $context = null, bool $clearOldVersions = false): void
    {
        // ✅ تحديث cache version فوراً لإجبار Frontend على إعادة الجلب
        CacheService::updateVersion('projects');
        
        // ✅ مسح الكاش بشكل كامل
        CacheService::clear('projects');
        
        Log::info('Projects cache cleared and version updated', [
            'context' => $context,
            'new_version' => CacheService::getVersion('projects')
        ]);
    }

    /**
     * مسح الإصدارات القديمة من cache باستخدام SCAN (آمن للإنتاج)
     * 
     * ⚠️ ملاحظة: هذه الطريقة اختيارية وليست ضرورية
     * الأفضل الاعتماد على TTL فقط، لكن إذا أردنا تنظيف يدوي، نستخدم SCAN
     * 
     * @param int $currentVersion الإصدار الحالي
     * @return void
     */
    private static function clearOldCacheVersionsWithScan(int $currentVersion): void
    {
        try {
            // استخدام Cache tags إذا كان متاحاً (Redis/Memcached)
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags([self::CACHE_TAG_PROJECTS])->flush();
                Log::info('Cleared projects cache using tags');
                return;
            }
            
            $cacheDriver = Cache::getStore();
            
            if (method_exists($cacheDriver, 'getRedis')) {
                // ✅ استخدام SCAN بدلاً من KEYS - آمن للإنتاج (non-blocking)
                $redis = $cacheDriver->getRedis();
                $cursor = 0;
                $keysToDelete = [];
                $maxIterations = 100; // حد أقصى للدورات لتجنب loop لا نهائي
                $iteration = 0;
                
                do {
                    // SCAN مع MATCH pattern - non-blocking
                    $result = $redis->scan($cursor, [
                        'MATCH' => '*projects_*_v*',
                        'COUNT' => 100 // عدد المفاتيح في كل دورة
                    ]);
                    
                    $cursor = $result[0]; // Cursor الجديد
                    $keys = $result[1]; // المفاتيح المطابقة
                    
                    // فلترة المفاتيح القديمة
                    foreach ($keys as $key) {
                        if (preg_match('/_v(\d+)$/', $key, $matches)) {
                            $keyVersion = (int)$matches[1];
                            // نحذف الإصدارات الأقدم من (currentVersion - OLD_VERSIONS_TO_KEEP)
                            if ($keyVersion < ($currentVersion - self::OLD_VERSIONS_TO_KEEP)) {
                                $keysToDelete[] = $key;
                            }
                        }
                    }
                    
                    $iteration++;
                    
                    // ✅ حماية من loop لا نهائي
                    if ($iteration >= $maxIterations) {
                        Log::warning('SCAN reached max iterations, stopping', [
                            'max_iterations' => $maxIterations,
                            'cursor' => $cursor
                        ]);
                        break;
                    }
                    
                } while ($cursor != 0); // 0 يعني انتهى SCAN
                
                // حذف المفاتيح القديمة (بحد أقصى 1000 في كل مرة)
                if (!empty($keysToDelete)) {
                    $chunks = array_chunk($keysToDelete, 1000); // حذف 1000 في كل مرة
                    foreach ($chunks as $chunk) {
                        $redis->del($chunk);
                    }
                    
                    Log::info('Cleared old projects cache from Redis using SCAN', [
                        'keys_count' => count($keysToDelete),
                        'current_version' => $currentVersion,
                        'iterations' => $iteration
                    ]);
                }
            } else {
                // Fallback: مسح جميع cache (للملفات/قاعدة البيانات)
                // لكن فقط إذا كان الإصدار قديم جداً (أكثر من 10 إصدارات)
                if ($currentVersion > 10) {
                    Cache::flush();
                    Cache::put(self::CACHE_VERSION_KEY, $currentVersion, self::CACHE_VERSION_TTL);
                    Log::info('Cleared all cache (file/database driver) and reset version', [
                        'version' => $currentVersion
                    ]);
                }
            }
        } catch (\Exception $e) {
            Log::warning('Failed to clear old cache versions with SCAN', [
                'error' => $e->getMessage(),
                'current_version' => $currentVersion
            ]);
        }
    }

    /**
     * بناء cache key مع version
     * 
     * @param string $baseKey
     * @return string
     */
    public static function buildCacheKey(string $baseKey): string
    {
        $version = self::getCacheVersion();
        return $baseKey . '_v' . $version;
    }

    /**
     * مسح cache لمشروع محدد
     * 
     * @param int $projectId
     * @return void
     */
    public static function clearProjectCache(int $projectId): void
    {
        self::clearProjectsCache("project_{$projectId}");
    }
}

