import { useRef, useCallback, useEffect, useMemo } from 'react';

/**
 * ✅ Custom hook لإدارة Cache مع localStorage - Improved Version
 * 
 * @param {string} cacheKey - مفتاح فريد للـ cache (مثل: 'projects', 'orphans', etc.)
 * @param {number} maxAge - المدة القصوى للـ cache بالميلي ثانية (افتراضي: دقيقتان)
 * @param {Object} options - خيارات إضافية
 * @param {boolean} options.compress - ضغط البيانات قبل الحفظ (افتراضي: false)
 * @param {Function} options.serialize - دالة تخصيصية للتسلسل (افتراضي: JSON.stringify)
 * @param {Function} options.deserialize - دالة تخصيصية لإلغاء التسلسل (افتراضي: JSON.parse)
 * @returns {Object} { getCachedData, setCachedData, clearCache, isCacheValid, getData, initializeCache, cacheRef }
 */
export const useCache = (cacheKey, maxAge = 120000, options = {}) => {
  const { compress = false, serialize = JSON.stringify, deserialize = JSON.parse } = options;

  const cacheRef = useRef({
    data: null,
    timestamp: null,
    filters: null,
    maxAge,
  });

  // ✅ دالة ضغط بسيطة (يمكن استبدالها بـ compression library)
  const compressData = useCallback((data) => {
    if (!compress) return data;
    try {
      // Simple compression: remove whitespace from JSON
      return serialize(data).replace(/\s+/g, '');
    } catch {
      return data;
    }
  }, [compress, serialize]);

  // ✅ دالة إلغاء الضغط
  const decompressData = useCallback((data) => {
    if (!compress) return data;
    try {
      return deserialize(data);
    } catch {
      return data;
    }
  }, [compress, deserialize]);

  // ✅ جلب البيانات من localStorage
  const getCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(`cache_${cacheKey}`);
      if (cached) {
        const parsed = decompressData(cached);
        if (typeof parsed === 'string') {
          try {
            const parsedJson = deserialize(parsed);
            // التحقق من أن البيانات حديثة
            if (parsedJson && parsedJson.timestamp && (Date.now() - parsedJson.timestamp) < maxAge) {
              return parsedJson;
            } else {
              // البيانات قديمة - حذفها
              localStorage.removeItem(`cache_${cacheKey}`);
            }
          } catch (parseError) {
            // إذا فشل parsing، احذف الـ cache
            localStorage.removeItem(`cache_${cacheKey}`);
          }
        } else if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp) < maxAge) {
          return parsed;
        } else {
          localStorage.removeItem(`cache_${cacheKey}`);
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn(`Error reading cache for ${cacheKey}:`, e);
      }
      // في حالة الخطأ، احذف الـ cache
      try {
        localStorage.removeItem(`cache_${cacheKey}`);
      } catch (removeError) {
        // ignore
      }
    }
    return null;
  }, [cacheKey, maxAge, decompressData, deserialize]);

  // ✅ حفظ البيانات في cache (memory + localStorage)
  const setCachedData = useCallback((data, filters = null) => {
    const cacheData = {
      data,
      timestamp: Date.now(),
      filters: filters ? (typeof filters === 'string' ? filters : serialize(filters)) : null,
      maxAge,
    };

    cacheRef.current = cacheData;

    try {
      const serialized = serialize(cacheData);
      const compressed = compressData(serialized);
      localStorage.setItem(`cache_${cacheKey}`, compressed);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn(`Error saving cache for ${cacheKey}:`, e);
      }
    }
  }, [cacheKey, maxAge, serialize, compressData]);

  // ✅ التحقق من صحة الـ cache
  const isCacheValid = useCallback((filters = null) => {
    const cache = cacheRef.current;
    const now = Date.now();
    const filtersKey = filters ? (typeof filters === 'string' ? filters : serialize(filters)) : null;

    // ✅ محاولة جلب من localStorage إذا لم تكن في memory
    if (!cache.data || !cache.timestamp) {
      const cached = getCachedData();
      if (cached) {
        cacheRef.current = cached;
        return true;
      }
      return false;
    }

    return cache.data &&
      (filtersKey === null || cache.filters === filtersKey) &&
      cache.timestamp &&
      (now - cache.timestamp) < cache.maxAge;
  }, [getCachedData, serialize]);

  // ✅ جلب البيانات من cache
  const getData = useCallback(() => {
    // ✅ محاولة من memory أولاً
    if (cacheRef.current.data && cacheRef.current.timestamp) {
      return cacheRef.current.data;
    }

    // ✅ محاولة من localStorage
    const cached = getCachedData();
    if (cached) {
      cacheRef.current = cached;
      return cached.data;
    }

    return null;
  }, [getCachedData]);

  // ✅ مسح الـ cache
  const clearCache = useCallback(() => {
    cacheRef.current = {
      data: null,
      timestamp: null,
      filters: null,
      maxAge,
    };
    try {
      localStorage.removeItem(`cache_${cacheKey}`);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn(`Error clearing cache for ${cacheKey}:`, e);
      }
    }
  }, [cacheKey, maxAge]);

  // ✅ تهيئة الـ cache من localStorage عند التحميل
  const initializeCache = useCallback(() => {
    const cached = getCachedData();
    if (cached) {
      cacheRef.current = cached;
    }
  }, [getCachedData]);

  // ✅ تحديث maxAge
  const updateMaxAge = useCallback((newMaxAge) => {
    cacheRef.current.maxAge = newMaxAge;
    if (cacheRef.current.timestamp) {
      // إعادة حفظ مع maxAge الجديد
      setCachedData(cacheRef.current.data, cacheRef.current.filters);
    }
  }, [setCachedData]);

  // ✅ الاستماع إلى أحداث إبطال الكاش
  useEffect(() => {
    const handleCacheInvalidation = (event) => {
      const { cacheKey: invalidatedKey } = event.detail;

      // ✅ إذا كان invalidatedKey === 'all' أو يطابق cacheKey الحالي
      if (invalidatedKey === 'all' || invalidatedKey === cacheKey) {
        clearCache();
        if (import.meta.env.DEV) {
          console.log(`✅ Cache cleared due to invalidation event: ${invalidatedKey}`);
        }
      }
    };

    window.addEventListener('cache-invalidated', handleCacheInvalidation);

    return () => {
      window.removeEventListener('cache-invalidated', handleCacheInvalidation);
    };
  }, [cacheKey, clearCache]);

  // ✅ تهيئة الـ cache عند التحميل
  useEffect(() => {
    initializeCache();
  }, [initializeCache]);

  // ✅ إرجاع API محسّن
  return useMemo(() => ({
    getCachedData,
    setCachedData,
    clearCache,
    isCacheValid,
    getData,
    initializeCache,
    updateMaxAge,
    cacheRef,
  }), [
    getCachedData,
    setCachedData,
    clearCache,
    isCacheValid,
    getData,
    initializeCache,
    updateMaxAge,
  ]);
};

export default useCache;
