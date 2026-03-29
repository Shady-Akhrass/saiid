import { useCallback, useRef, useEffect } from 'react';

export const useProjectsCache = ({ isFinishedProjectsPage }) => {
  const getCachedData = useCallback(() => {
    try {
      const cacheKey = isFinishedProjectsPage ? 'projects_cache_finished' : 'projects_cache';
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp &&
          (Date.now() - parsed.timestamp) < 120000 &&
          parsed.data &&
          Array.isArray(parsed.data) &&
          parsed.data.length > 0) {
          return parsed;
        } else {
          localStorage.removeItem('projects_cache');
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('Error reading cache from localStorage:', e);
      }
      try { localStorage.removeItem('projects_cache'); } catch (e2) {}
    }
    return null;
  }, [isFinishedProjectsPage]);

  const initializeCache = useCallback((getCacheMaxAge) => {
    const cachedData = getCachedData();
    return {
      data: cachedData?.data || null,
      timestamp: cachedData?.timestamp || null,
      filters: cachedData?.filters || null,
      maxAge: getCacheMaxAge ? getCacheMaxAge() : 120000,
    };
  }, [getCachedData]);

  const clearCache = useCallback(() => {
    cacheRef.current = {
      data: null,
      timestamp: null,
      filters: null,
    };
    try { localStorage.removeItem('projects_cache'); } catch (e) {}
  }, []);

  const useCacheInvalidation = useCallback((onRefresh) => {
    useEffect(() => {
      const handleCacheInvalidation = (event) => {
        const { cacheKey } = event.detail;

        if (cacheKey === 'all' ||
          cacheKey === 'projects' ||
          cacheKey === 'project-proposals' ||
          cacheKey === 'project_proposals') {
          cacheRef.current = {
            data: null,
            timestamp: null,
            filters: null,
          };
          try { localStorage.removeItem('projects_cache'); } catch (e) {}
          if (onRefresh) onRefresh();
        }
      };

      window.addEventListener('cache-invalidated', handleCacheInvalidation);
      return () => window.removeEventListener('cache-invalidated', handleCacheInvalidation);
    }, []);
  }, []);

  return { getCachedData, initializeCache, clearCache };
};

export default useProjectsCache;
