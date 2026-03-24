import { useCallback, useEffect } from 'react';

/**
 * Hook لإدارة إبطال الكاش (Cache Invalidation) بشكل مركزي
 * عند أي عملية تعديل/حذف/إضافة، يتم إبطال الكاش تلقائياً
 */
export const useCacheInvalidation = () => {
  /**
   * إبطال كاش معين
   * @param {string} cacheKey - مفتاح الكاش (مثل: 'projects', 'admin_projects', 'orphans', etc.)
   */
  const invalidateCache = useCallback((cacheKey) => {
    try {
      // ✅ مسح من localStorage
      localStorage.removeItem(`cache_${cacheKey}`);
      localStorage.removeItem(`${cacheKey}_cache`);

      // ✅ إرسال event لإعلام المكونات الأخرى
      window.dispatchEvent(new CustomEvent('cache-invalidated', {
        detail: { cacheKey }
      }));

      if (import.meta.env.DEV) {
        console.log(`✅ Cache invalidated: ${cacheKey}`);
      }
    } catch (error) {
      console.warn(`Error invalidating cache ${cacheKey}:`, error);
    }
  }, []);

  /**
   * إبطال عدة كاشات في نفس الوقت
   * @param {string[]} cacheKeys - مصفوفة من مفاتيح الكاش
   */
  const invalidateMultipleCaches = useCallback((cacheKeys) => {
    cacheKeys.forEach(key => invalidateCache(key));
  }, [invalidateCache]);

  /**
   * إبطال جميع كاشات المشاريع
   */
  const invalidateProjectsCache = useCallback(() => {
    invalidateMultipleCaches([
      'projects',
      'admin_projects',
      'project-proposals',
      'project_proposals'
    ]);
  }, [invalidateMultipleCaches]);

  /**
   * إبطال جميع كاشات الأيتام
   */
  const invalidateOrphansCache = useCallback(() => {
    invalidateMultipleCaches([
      'orphans',
      'admin_orphans'
    ]);
  }, [invalidateMultipleCaches]);

  /**
   * إبطال جميع كاشات المساعدات
   */
  const invalidateAidsCache = useCallback(() => {
    invalidateMultipleCaches([
      'aids',
      'admin_aids'
    ]);
  }, [invalidateMultipleCaches]);

  /**
   * إبطال جميع كاشات المرضى
   */
  const invalidatePatientsCache = useCallback(() => {
    invalidateMultipleCaches([
      'patients',
      'admin_patients'
    ]);
  }, [invalidateMultipleCaches]);

  /**
   * إبطال جميع كاشات المخيمات
   */
  const invalidateSheltersCache = useCallback(() => {
    invalidateMultipleCaches([
      'shelters',
      'admin_shelters'
    ]);
  }, [invalidateMultipleCaches]);

  /**
   * إبطال جميع الكاشات
   */
  const invalidateAllCaches = useCallback(() => {
    try {
      // ✅ مسح جميع مفاتيح الكاش من localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_') || key.endsWith('_cache')) {
          localStorage.removeItem(key);
        }
      });

      // ✅ إرسال event عام
      window.dispatchEvent(new CustomEvent('cache-invalidated', {
        detail: { cacheKey: 'all' }
      }));

      if (import.meta.env.DEV) {
        console.log('✅ All caches invalidated');
      }
    } catch (error) {
      console.warn('Error invalidating all caches:', error);
    }
  }, []);

  return {
    invalidateCache,
    invalidateMultipleCaches,
    invalidateProjectsCache,
    invalidateOrphansCache,
    invalidateAidsCache,
    invalidatePatientsCache,
    invalidateSheltersCache,
    invalidateAllCaches,
  };
};

/**
 * Hook للاستماع إلى أحداث إبطال الكاش
 * @param {string|string[]} cacheKeys - مفاتيح الكاش للاستماع إليها
 * @param {Function} callback - دالة يتم استدعاؤها عند إبطال الكاش
 */
export const useCacheInvalidationListener = (cacheKeys, callback) => {
  useEffect(() => {
    const handleCacheInvalidation = (event) => {
      const { cacheKey } = event.detail;

      // ✅ إذا كان cacheKey === 'all' أو موجود في المصفوفة
      if (cacheKey === 'all' ||
        (Array.isArray(cacheKeys) && cacheKeys.includes(cacheKey)) ||
        cacheKeys === cacheKey) {
        callback(cacheKey);
      }
    };

    window.addEventListener('cache-invalidated', handleCacheInvalidation);

    return () => {
      window.removeEventListener('cache-invalidated', handleCacheInvalidation);
    };
  }, [cacheKeys, callback]);
};
