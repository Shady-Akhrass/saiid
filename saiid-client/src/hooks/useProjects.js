import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../utils/axiosConfig';

/**
 * Custom hook محسّن لجلب المشاريع مع caching و debouncing
 * 
 * @param {Object} filters - فلاتر البحث
 * @param {Object} options - خيارات إضافية
 * @returns {Object} { projects, loading, error, refetch }
 */
export const useProjects = (filters = {}, options = {}) => {
    const {
        cacheTime = 30000, // 30 ثانية
        enabled = true,
    } = options;

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
    });

    // Cache للبيانات
    const cacheRef = useRef({
        data: null,
        timestamp: null,
        filters: null,
    });

    // AbortController لإلغاء الطلبات السابقة
    const abortControllerRef = useRef(null);

    const fetchProjects = useCallback(async () => {
        // إلغاء الطلب السابق إن وجد
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // إنشاء AbortController جديد
        abortControllerRef.current = new AbortController();

        // التحقق من الـ cache
        const cacheKey = JSON.stringify(filters);
        const cached = cacheRef.current;

        if (
            cached.data &&
            cached.filters === cacheKey &&
            cached.timestamp &&
            Date.now() - cached.timestamp < cacheTime
        ) {
            // استخدام البيانات من الـ cache
            setProjects(cached.data.projects || []);
            setPagination(cached.data.pagination || pagination);
            return;
        }

        if (!enabled) return;

        setLoading(true);
        setError(null);

        try {
            const response = await apiClient.get('/projects', {
                params: filters,
                signal: abortControllerRef.current.signal,
            });

            if (response.data.success) {
                const data = {
                    projects: response.data.projects || [],
                    pagination: {
                        current_page: response.data.currentPage || 1,
                        last_page: response.data.totalPages || 1,
                        per_page: response.data.perPage || 10,
                        total: response.data.total || 0,
                    },
                };

                // حفظ في الـ cache
                cacheRef.current = {
                    data,
                    timestamp: Date.now(),
                    filters: cacheKey,
                };

                setProjects(data.projects);
                setPagination(data.pagination);
            }
        } catch (err) {
            // تجاهل أخطاء الإلغاء
            if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                return;
            }

            setError(err);
            console.error('Error fetching projects:', err);
        } finally {
            setLoading(false);
        }
    }, [filters, cacheTime, enabled]);

    useEffect(() => {
        fetchProjects();

        // تنظيف عند unmount
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchProjects]);

    // دالة لإعادة جلب البيانات (تجاهل الـ cache)
    const refetch = useCallback(() => {
        cacheRef.current = {
            data: null,
            timestamp: null,
            filters: null,
        };
        fetchProjects();
    }, [fetchProjects]);

    // دالة لمسح الـ cache
    const clearCache = useCallback(() => {
        cacheRef.current = {
            data: null,
            timestamp: null,
            filters: null,
        };
    }, []);

    return {
        projects,
        loading,
        error,
        pagination,
        refetch,
        clearCache,
    };
};

export default useProjects;

