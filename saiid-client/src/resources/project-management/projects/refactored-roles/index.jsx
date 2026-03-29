import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import apiClient, { forceRefreshCache, invalidateCache } from '../../../../utils/axiosConfig';
import { useDebounce } from '../../../../hooks/useDebounce';
import { useUpdateExecutionStatus } from '../../../../hooks/useUpdateExecutionStatus';
import { useCacheInvalidation } from '../../../../hooks/useCacheInvalidation';
import PageLoader from '../../../../components/PageLoader';
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Users,
  UserCheck,
  Home,
  Camera,
  Pause,
  Play,
  PlayCircle,
  Download,
  Image as ImageIcon,
  FileText,
  ShoppingCart,
  Package,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  CheckCircle2,
  MessageSquare,
  Briefcase,
  Calendar,
  Clock,
  AlertCircle,
  DollarSign,
  Info,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'react-toastify';
import ExcelJS from 'exceljs';
import { downloadWorkbookAsFile } from '../../../../utils/excelDownload';
import { AssignProjectModal, SelectShelterModal } from '../../components/ProjectModals';
import { AddOrphansModal } from '../../components/AddOrphansModal';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import {
  getProjectCode,
  formatCurrency,
  getRemainingDays,
  getRemainingDaysBadge,
  getDivisionTextColor,
  getProjectDescription,
  getSubProjectParentName,
  formatOriginalAmount,
  isLateForPM,
  isLateForMedia,
  isOrphanSponsorshipProject,
  renderProjectBadges,
} from './utils/projectUtils';
import { FilterBar, ProjectsTable, Pagination } from './components/common';
import { AdminProjectsList } from './roles/AdminProjectsList';
import { ProjectManagerList } from './roles/ProjectManagerList';
import { ExecutedCoordinatorList } from './roles/ExecutedCoordinatorList';
import { OrphanSponsorList } from './roles/OrphanSponsorList';
import { MediaManagerList } from './roles/MediaManagerList';
import { ExecutionHeadList } from './roles/ExecutionHeadList';
import {
  normalizeProjectRecord,
  getStatusColor,
  isMonthlyPhaseProject,
  getMonthNumber,
  getDisplayMonthNameForProject,
  isTodayInPhaseMonth,
  calculateDailyAmount,
  calculateMonthlyAmount,
  summarizeDailyPhaseStatuses,
  summarizeMonthlyPhaseStatuses,
  parseLocalDate,
  getCurrentMonth,
  filterProjectsForCurrentMonth,
} from './utils/projectUtils';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj ?? {}, key);

const ProjectsList = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isFinishedProjectsPage = location.pathname === '/project-management/projects/finished';
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const abortControllerRef = useRef(null);

  const getCachedData = () => {
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
      try {
        localStorage.removeItem('projects_cache');
      } catch (e2) {}
    }
    return null;
  };

  const cacheRef = useRef({
    data: getCachedData()?.data || null,
    timestamp: getCachedData()?.timestamp || null,
    filters: getCachedData()?.filters || null,
    maxAge: 120000,
  });

  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
  });

  const [backendHideChildProjects, setBackendHideChildProjects] = useState(false);

  const [filters, setFilters] = useState({
    status: [],
    project_type: [],
    searchQuery: '',
    page: 1,
    perPage: isFinishedProjectsPage ? 50 : 1000,
  });

  const [sortConfig, setSortConfig] = useState({
    key: 'created_at',
    direction: 'desc',
  });

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectShelterModalOpen, setSelectShelterModalOpen] = useState(false);
  const [addOrphansModalOpen, setAddOrphansModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [transferringToExecution, setTransferringToExecution] = useState(null);
  const [clearingAssignmentId, setClearingAssignmentId] = useState(null);

  const [showFilters, setShowFilters] = useState(true);

  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponementReason, setPostponementReason] = useState('');
  const [isPostponing, setIsPostponing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [postponingProjectId, setPostponingProjectId] = useState(null);

  const [showExecutionStatusModal, setShowExecutionStatusModal] = useState(false);
  const [selectedProjectForStatusUpdate, setSelectedProjectForStatusUpdate] = useState(null);
  const [executionStatusAction, setExecutionStatusAction] = useState(null);

  const [showBeneficiariesModal, setShowBeneficiariesModal] = useState(false);
  const [beneficiariesCount, setBeneficiariesCount] = useState('');
  const [updatingBeneficiaries, setUpdatingBeneficiaries] = useState(false);

  const [imageBlobUrls, setImageBlobUrls] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [loadingImages, setLoadingImages] = useState(new Set());

  const [noteImagesModalOpen, setNoteImagesModalOpen] = useState(false);
  const [noteImagesModalProject, setNoteImagesModalProject] = useState(null);
  const [noteImagesModalImages, setNoteImagesModalImages] = useState([]);
  const [noteImagesModalLoading, setNoteImagesModalLoading] = useState(false);

  const invalidateCacheAndRefresh = useCallback(() => {
    forceRefreshCache();
    invalidateCache('projects');
    invalidateCache('project-proposals');
    fetchProjects({ forceRefresh: true });
  }, []);

  const [isExportFilterModalOpen, setIsExportFilterModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const debouncedSearch = useDebounce(searchInput, 500);

  useEffect(() => {
    if (debouncedSearch !== filters.searchQuery) {
      setFilters(prev => ({ ...prev, searchQuery: debouncedSearch, page: 1 }));
    }
  }, [debouncedSearch]);

  useUpdateExecutionStatus();
  useCacheInvalidation(() => {
    fetchProjects({ forceRefresh: true });
  });

  useEffect(() => {
    const handleCacheInvalidated = () => {
      fetchProjects({ forceRefresh: true });
    };
    window.addEventListener('cache-invalidated', handleCacheInvalidated);
    return () => window.removeEventListener('cache-invalidated', handleCacheInvalidated);
  }, []);

  const isAdmin = useMemo(() => {
    return user?.role === 'admin' || user?.role === 'administrator' || user?.role === 'مدير';
  }, [user]);

  const isProjectManager = useMemo(() => {
    return user?.role === 'project_manager' || user?.role === 'مدير مشاريع';
  }, [user]);

  const isExecutedCoordinator = useMemo(() => {
    return user?.role === 'executed_projects_coordinator' || user?.role === 'منسق مشاريع منفذة';
  }, [user]);

  const isOrphanSponsorCoordinator = useMemo(() => {
    return user?.role === 'orphan_sponsor_coordinator' || user?.role === 'منسق الكفالات';
  }, [user]);

  const isMediaManager = useMemo(() => {
    return user?.role === 'media_manager' || user?.role === 'مدير الإعلام';
  }, [user]);

  const isExecutionHead = useMemo(() => {
    return user?.role === 'execution_head' || user?.role === 'رئيس قسم التنفيذ';
  }, [user]);

  const fetchProjects = async ({ forceRefresh = false } = {}) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const cacheKey = isFinishedProjectsPage ? 'projects_cache_finished' : 'projects_cache';
      const cached = !forceRefresh ? getCachedData() : null;

      if (cached && cached.data) {
        setProjects(cached.data.map(normalizeProjectRecord));
        if (cached.filters) setFilters(cached.filters);
        setLoading(false);
        return;
      }

      const endpoint = isFinishedProjectsPage
        ? '/project-proposals/finished'
        : '/project-proposals';
      
      const params = {
        page: filters.page,
        per_page: filters.perPage,
        ...(filters.status.length > 0 && { status: filters.status.join(',') }),
        ...(filters.project_type.length > 0 && { project_type: filters.project_type.join(',') }),
        ...(filters.searchQuery && { search: filters.searchQuery }),
        sort_by: sortConfig.key,
        sort_order: sortConfig.direction,
        _t: Date.now(),
      };

      const response = await apiClient.get(endpoint, {
        params,
        signal: abortControllerRef.current.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.data.success) {
        const projectsData = response.data.data || response.data.projects || [];
        const normalized = projectsData.map(normalizeProjectRecord);
        // Ensure main page never shows finished projects
        const nonFinished = !isFinishedProjectsPage
          ? normalized.filter(p => p.status !== 'منتهي')
          : normalized;
        // Client-side sort fallback to guarantee latest first when using default sort
        let finalList = nonFinished;
        if (sortConfig?.key === 'created_at' && sortConfig?.direction === 'desc') {
          finalList = [...nonFinished].sort((a, b) => {
            const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
            const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
            return tb - ta; // descending
          });
        }
        setProjects(finalList);

        if (response.data.hide_child_projects !== undefined) {
          setBackendHideChildProjects(response.data.hide_child_projects);
        }

        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }

        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: projectsData,
            filters,
            timestamp: Date.now(),
          }));
        } catch (e) {}
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching projects:', error);
        toast.error('فشل تحميل المشاريع');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [filters.page, filters.perPage, filters.status, filters.project_type, filters.searchQuery, sortConfig, refreshTrigger]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      status: [],
      project_type: [],
      searchQuery: '',
      page: 1,
      perPage: isFinishedProjectsPage ? 50 : 1000,
    });
    setSearchInput('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, searchQuery: searchInput, page: 1 }));
  };

  const handleSearchChange = (value) => {
    setSearchInput(value);
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handlePerPageChange = (perPage) => {
    setFilters(prev => ({ ...prev, perPage, page: 1 }));
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleEdit = (project) => {
    window.location.href = `/project-management/projects/${project.id}/edit`;
  };

  const handleDelete = (project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    setDeletingProject(projectToDelete.id);
    try {
      await apiClient.delete(`/project-proposals/${projectToDelete.id}`);
      toast.success('تم حذف المشروع بنجاح');
      invalidateCacheAndRefresh();
    } catch (error) {
      toast.error('فشل حذف المشروع');
    } finally {
      setDeletingProject(null);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const projectTypes = useMemo(() => {
    const types = new Set();
    projects.forEach(p => {
      const type = p.project_type?.name_ar || p.project_type?.name || p.project_type;
      if (type) types.add(type);
    });
    return Array.from(types);
  }, [projects]);

  const hasProjectImage = (project) => {
    return !!(project?.project_image || project?.images?.length > 0);
  };

  const handleDownloadImage = async (project) => {
    if (!hasProjectImage(project)) {
      toast.info('لا توجد صورة للمشروع');
      return;
    }
    const imageUrl = project.project_image || project.images?.[0];
    if (!imageUrl) return;
    
    try {
      const response = await apiClient.get(imageUrl, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project-${project.id}-image.jpg`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('فشل تحميل الصورة');
    }
  };

  const renderRoleBasedView = () => {
    const commonProps = {
      projects,
      filters,
      pagination,
      onFilterChange: handleFilterChange,
      onClearFilters: handleClearFilters,
      onSearchSubmit: handleSearchSubmit,
      onSearchChange: handleSearchChange,
      searchInput,
      onPageChange: handlePageChange,
      onPerPageChange: handlePerPageChange,
      onSort: handleSort,
      sortConfig,
      showFilters,
      onToggleFilters: () => setShowFilters(!showFilters),
      loading,
      projectTypes,
      hasProjectImage,
      onDownloadImage: handleDownloadImage,
      onEdit: handleEdit,
      onDelete: handleDelete,
      deletingProject,
      isFinishedProjectsPage,
    };

    if (isAdmin) {
      return <AdminProjectsList {...commonProps} />;
    }

    if (isProjectManager) {
      return <ProjectManagerList {...commonProps} />;
    }

    if (isExecutedCoordinator) {
      return <ExecutedCoordinatorList {...commonProps} />;
    }

    if (isOrphanSponsorCoordinator) {
      return <OrphanSponsorList {...commonProps} />;
    }

    if (isMediaManager) {
      return <MediaManagerList {...commonProps} />;
    }

    if (isExecutionHead) {
      return <ExecutionHeadList {...commonProps} />;
    }

    return <AdminProjectsList {...commonProps} />;
  };

  if (loading && projects.length === 0) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {isFinishedProjectsPage ? 'المشاريع المنتهية' : 'إدارة المشاريع'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isFinishedProjectsPage 
              ? 'قائمة المشاريع المنتهية' 
              : `إجمالي: ${projects.length} مشروع`}
          </p>
        </div>

        {renderRoleBasedView()}

        <ConfirmDialog
          isOpen={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setProjectToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="تأكيد الحذف"
          message={`هل أنت متأكد من حذف المشروع "${projectToDelete?.project_name || projectToDelete?.donor_name}"؟`}
          confirmText="حذف"
          cancelText="إلغاء"
          type="danger"
        />
      </div>
    </div>
  );
};

export default ProjectsList;
