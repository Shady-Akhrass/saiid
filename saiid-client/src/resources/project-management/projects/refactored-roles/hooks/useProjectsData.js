import { useState, useCallback, useRef, useEffect } from 'react';
import apiClient, { forceRefreshCache, invalidateCache } from '../../../../utils/axiosConfig';
import { normalizeProjectRecord, filterProjectsForCurrentMonth, isMonthlyPhaseProject, getMonthNumber, getCurrentProjectMonthFromStartDate, getCalendarMonthNameForProjectMonth } from '../utils/projectUtils';

export const useProjectsData = ({
  user,
  isFinishedProjectsPage,
  filters,
  setFilters,
  setPagination,
  setProjects,
  setLoading,
  cacheRef,
  abortControllerRef,
  projectsSupplyData,
  setProjectsSupplyData,
  onSuccess,
}) => {
  const isProjectManager = user?.role === 'project_manager' || user?.role === 'مدير مشاريع';
  const isAdmin = ['admin', 'administrator', 'مدير'].includes(user?.role?.toLowerCase());
  const isExecutedCoordinator = user?.role === 'executed_projects_coordinator' || user?.role === 'منسق مشاريع منفذة';
  const isOrphanSponsorCoordinator = user?.role === 'orphan_sponsor_coordinator' || user?.role === 'منسق مشاريع كفالة الأيتام' || user?.role === 'منسق الكفالات';

  const getCacheMaxAge = useCallback(() => {
    if (isProjectManager) return 60000;
    if (isAdmin) return 30000;
    return 120000;
  }, [isProjectManager, isAdmin]);

  const fetchProjects = useCallback(async (options = {}) => {
    const { skipLoading = false, forceRefresh = false } = options;
    let shouldFetchAll = false;

    try {
      if (forceRefresh) {
        cacheRef.current = {
          data: null,
          timestamp: null,
          filters: null,
          maxAge: getCacheMaxAge(),
        };
      }

      const cache = cacheRef.current;
      const now = Date.now();
      const filtersKey = JSON.stringify(filters);

      const shouldUseCache = !forceRefresh && (!isAdmin || (cache.timestamp && (now - cache.timestamp) < 30000));

      if (shouldUseCache &&
        cache.data &&
        Array.isArray(cache.data) &&
        cache.data.length > 0 &&
        cache.filters === filtersKey &&
        cache.timestamp &&
        (now - cache.timestamp) < cache.maxAge) {
        setProjects(filteredCacheData);
        if (!skipLoading) setLoading(false);
        return;
      }

      if (isAdmin && cache.timestamp && (now - cache.timestamp) >= 30000) {
        cacheRef.current = { data: null, timestamp: null, filters: null, maxAge: getCacheMaxAge() };
        try { localStorage.removeItem('projects_cache'); } catch (e) {}
      }

      if (cache.data && (!Array.isArray(cache.data) || cache.data.length === 0)) {
        cacheRef.current = { data: null, timestamp: null, filters: null, maxAge: getCacheMaxAge() };
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      if (!skipLoading) setLoading(true);

      const params = {};

      Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (value !== '' && value !== null && value !== undefined) {
          if (key === 'perPage') {
            const perPageNum = value === 'all' || value === 'الكل' ? 500 : (typeof value === 'number' ? value : parseInt(value));
            if (!isNaN(perPageNum) && perPageNum > 0) {
              params.per_page = perPageNum;
              params.perPage = perPageNum;
            }
          } else if (key === 'status' && Array.isArray(value) && value.length > 0) {
            params.status = value.join(',');
          } else if (key === 'project_type' && Array.isArray(value) && value.length > 0) {
            params.project_type = value.join(',');
          } else if (key === 'subcategory_id' && Array.isArray(value) && value.length > 0) {
            params.subcategory_id = value.join(',');
          } else {
            params[key] = value;
          }
        }
      });

      if (isProjectManager) {
        params.include_non_divided = true;
        params.include_daily_phases_window_only = true;
        params.daily_phases_window_size = 4;
        params.include_monthly_phases = true;
      }

      if (isExecutedCoordinator) {
        params.per_page = 1000;
        params.perPage = 1000;
        shouldFetchAll = true;
        delete params.status;
        delete params.project_type;
        delete params.searchQuery;
      }

      if (isOrphanSponsorCoordinator) {
        params.per_page = 1000;
        params.perPage = 1000;
        shouldFetchAll = true;
        params.include_monthly_phases = true;
        params.hide_child_projects = false;
      }

      if (isAdmin) {
        if (isFinishedProjectsPage && !params.per_page) {
          params.per_page = 50;
          params.perPage = 50;
        }
        params.hide_child_projects = false;
        params.include_non_divided = true;
        params.include_divided_parents = true;
        params.include_daily_phases = true;
        params.include_monthly_phases = true;
      }

      const isLargeRequest = params.per_page >= 100 || params.perPage >= 100;
      const baseTimeout = import.meta.env.PROD ? 30000 : 20000;
      const timeoutDuration = isLargeRequest ? baseTimeout : Math.floor(baseTimeout * 0.7);

      const cacheBustTimestamp = Date.now();

      const apiEndpoint = isExecutedCoordinator
        ? '/projects'
        : isFinishedProjectsPage
          ? '/project-proposals/finished'
          : '/project-proposals';

      const response = await apiClient.get(apiEndpoint, {
        params: {
          ...params,
          _t: cacheBustTimestamp,
          ...(isAdmin && { _admin: cacheBustTimestamp }),
        },
        timeout: timeoutDuration,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        signal: abortController.signal
      });

      let projectsData = [];
      if (Array.isArray(response.data.projects)) {
        projectsData = response.data.projects;
      } else if (Array.isArray(response.data.data?.data)) {
        projectsData = response.data.data.data;
      } else if (Array.isArray(response.data.data)) {
        projectsData = response.data.data;
      }

      const normalizedProjects = Array.isArray(projectsData)
        ? projectsData.map((item) => normalizeProjectRecord(item))
        : [];

      let expandedProjects = [...normalizedProjects];
      if (!isOrphanSponsorCoordinator) {
        const monthlyPhasesFromParents = [];

        normalizedProjects.forEach((project) => {
          if (project.is_divided_into_phases && Array.isArray(project.monthly_phases) && project.monthly_phases.length > 0) {
            project.monthly_phases.forEach((phase) => {
              const phaseWithParent = {
                ...phase,
                parent_project_id: phase.parent_project_id ?? project.id,
                parent_project: phase.parent_project ?? project,
              };
              const normalizedPhase = normalizeProjectRecord(phaseWithParent);

              if (!normalizedPhase.month_number && normalizedPhase.is_monthly_phase) {
                const monthMatch = normalizedPhase.project_name?.match(/الشهر\s*(\d+)/i) ||
                  normalizedPhase.project_name?.match(/month\s*(\d+)/i);
                if (monthMatch && monthMatch[1]) {
                  normalizedPhase.month_number = parseInt(monthMatch[1], 10);
                }
              }

              const phaseMonthNumber = getMonthNumber(normalizedPhase);
              const phaseStart = project.phase_start_date ?? project.phaseStartDate;
              const currentProjectMonth = getCurrentProjectMonthFromStartDate(phaseStart);

              const shouldAdd = currentProjectMonth !== null
                ? phaseMonthNumber === currentProjectMonth
                : false;

              if (shouldAdd) {
                normalizedPhase.__display_month_name = getCalendarMonthNameForProjectMonth(phaseStart, phaseMonthNumber) || null;
                monthlyPhasesFromParents.push(normalizedPhase);
              }
            });
          }
        });

        if (monthlyPhasesFromParents.length > 0) {
          const existingProjectIds = new Set(expandedProjects.map(p => p.id));
          const uniqueMonthlyPhases = monthlyPhasesFromParents.filter(p => !existingProjectIds.has(p.id));
          if (uniqueMonthlyPhases.length > 0) {
            expandedProjects = [...expandedProjects, ...uniqueMonthlyPhases];
          }
        }
      }

      if (isOrphanSponsorCoordinator) {
        const toSet = Array.isArray(normalizedProjects) ? [...normalizedProjects] : [];
        setProjects(toSet);
        if (toSet.length > 0) {
          const cacheData = {
            data: toSet,
            timestamp: Date.now(),
            filters: JSON.stringify(filters),
            maxAge: 120000,
          };
          cacheRef.current = cacheData;
          try { localStorage.setItem('projects_cache', JSON.stringify(cacheData)); } catch (e) {}
        } else {
          cacheRef.current = { data: null, timestamp: null, filters: null, maxAge: 120000 };
        }
        const currentPage = filters.page || 1;
        setPagination({
          current_page: currentPage,
          last_page: response.data.totalPages || response.data.data?.last_page || response.data.last_page || 1,
          per_page: response.data.perPage || response.data.data?.per_page || response.data.per_page || 10,
          total: toSet.length,
        });
      } else {
        if (expandedProjects && Array.isArray(expandedProjects) && expandedProjects.length > 0) {
          setProjects(expandedProjects);
          const cacheData = {
            data: expandedProjects,
            timestamp: Date.now(),
            filters: JSON.stringify(filters),
            maxAge: 120000,
          };
          cacheRef.current = cacheData;
          try { localStorage.setItem('projects_cache', JSON.stringify(cacheData)); } catch (e) {}
        } else {
          setProjects([]);
        }

        const responseTotal = response.data.total || response.data.data?.total || 0;
        const metaInfo = response.data.meta || response.data.data?.meta || {};
        const actualTotal = metaInfo.actual_total_count || responseTotal;
        const currentPage = filters.page || 1;

        setPagination({
          current_page: currentPage,
          last_page: response.data.totalPages || response.data.data?.last_page || response.data.last_page || 1,
          per_page: response.data.perPage || response.data.data?.per_page || response.data.per_page || 10,
          total: actualTotal,
        });
      }

      if (onSuccess) onSuccess();

    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.message === 'canceled') {
        setLoading(false);
        return;
      }

      if (cacheRef.current.data && cacheRef.current.data.length > 0) {
        setProjects(cacheRef.current.data);
        setLoading(false);
        return;
      }

      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [user, isFinishedProjectsPage, filters, isProjectManager, isAdmin, isExecutedCoordinator, isOrphanSponsorCoordinator]);

  return { fetchProjects, getCacheMaxAge };
};

export default useProjectsData;
