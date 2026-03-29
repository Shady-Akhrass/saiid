import React from 'react';
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
import { getProjectCode } from '../../../../utils/helpers';
import { isLateForMedia, isLateForPM, getRemainingDaysBadge } from './utils/projectUtils.jsx';
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
  const [loading, setLoading] = React.useState(true);
  const [projects, setProjects] = React.useState([]);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const abortControllerRef = React.useRef(null);

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

  const cacheRef = React.useRef({
    data: getCachedData()?.data || null,
    timestamp: getCachedData()?.timestamp || null,
    filters: getCachedData()?.filters || null,
    maxAge: 120000,
  });

  const [pagination, setPagination] = React.useState({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
  });

  const [backendHideChildProjects, setBackendHideChildProjects] = React.useState(false);

  const [filters, setFilters] = React.useState({
    status: [],
    project_type: [],
    searchQuery: '',
    page: 1,
    perPage: isFinishedProjectsPage ? 50 : 1000,
  });

  const [sortConfig, setSortConfig] = React.useState({
    key: 'created_at',
    direction: 'desc',
  });

  const [assignModalOpen, setAssignModalOpen] = React.useState(false);
  const [selectShelterModalOpen, setSelectShelterModalOpen] = React.useState(false);
  const [addOrphansModalOpen, setAddOrphansModalOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState(null);
  const [transferringToExecution, setTransferringToExecution] = React.useState(null);
  const [clearingAssignmentId, setClearingAssignmentId] = React.useState(null);

  const [showFilters, setShowFilters] = React.useState(true);

  const [showPostponeModal, setShowPostponeModal] = React.useState(false);
  const [postponementReason, setPostponementReason] = React.useState('');
  const [isPostponing, setIsPostponing] = React.useState(false);
  const [isResuming, setIsResuming] = React.useState(false);
  const [postponingProjectId, setPostponingProjectId] = React.useState(null);

  const [showExecutionStatusModal, setShowExecutionStatusModal] = React.useState(false);
  const [selectedProjectForStatusUpdate, setSelectedProjectForStatusUpdate] = React.useState(null);
  const [executionStatusAction, setExecutionStatusAction] = React.useState(null);

  const [showBeneficiariesModal, setShowBeneficiariesModal] = React.useState(false);
  const [beneficiariesCount, setBeneficiariesCount] = React.useState('');
  const [updatingBeneficiaries, setUpdatingBeneficiaries] = React.useState(false);

  const [imageBlobUrls, setImageBlobUrls] = React.useState({});
  const [imageErrors, setImageErrors] = React.useState({});
  const [loadingImages, setLoadingImages] = React.useState(new Set());

  const [noteImagesModalOpen, setNoteImagesModalOpen] = React.useState(false);
  const [noteImagesModalProject, setNoteImagesModalProject] = React.useState(null);
  const [noteImagesModalImages, setNoteImagesModalImages] = React.useState([]);
  const [noteImagesModalLoading, setNoteImagesModalLoading] = React.useState(false);

  const invalidateCacheAndRefresh = React.useCallback(() => {
    forceRefreshCache();
    invalidateCache('projects');
    invalidateCache('project-proposals');
    fetchProjects({ forceRefresh: true });
  }, []);

  const [isExportFilterModalOpen, setIsExportFilterModalOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [projectToDelete, setProjectToDelete] = React.useState(null);
  const [deletingProject, setDeletingProject] = React.useState(null);
  const [searchInput, setSearchInput] = React.useState('');

  const debouncedSearch = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== filters.searchQuery) {
      setFilters(prev => ({ ...prev, searchQuery: debouncedSearch, page: 1 }));
    }
  }, [debouncedSearch]);

  useUpdateExecutionStatus();
  useCacheInvalidation(() => {
    fetchProjects({ forceRefresh: true });
  });

  React.useEffect(() => {
    const handleCacheInvalidated = () => {
      fetchProjects({ forceRefresh: true });
    };
    window.addEventListener('cache-invalidated', handleCacheInvalidated);
    return () => window.removeEventListener('cache-invalidated', handleCacheInvalidated);
  }, []);

  const isAdmin = React.useMemo(() => {
    return user?.role === 'admin' || user?.role === 'administrator' || user?.role === 'مدير';
  }, [user]);

  const isProjectManager = React.useMemo(() => {
    return user?.role === 'project_manager' || user?.role === 'مدير مشاريع';
  }, [user]);

  const isExecutedCoordinator = React.useMemo(() => {
    return user?.role === 'executed_projects_coordinator' || user?.role === 'منسق مشاريع منفذة';
  }, [user]);

  const isOrphanSponsorCoordinator = React.useMemo(() => {
    return user?.role === 'orphan_sponsor_coordinator' || user?.role === 'منسق الكفالات';
  }, [user]);

  const isMediaManager = React.useMemo(() => {
    return user?.role === 'media_manager' || user?.role === 'مدير الإعلام';
  }, [user]);

  const isExecutionHead = React.useMemo(() => {
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
        setProjects(normalized);
        
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
  
  React.useEffect(() => {
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
  
  const projectTypes = React.useMemo(() => {
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
  
  // Minimal render to preserve original structure in this snapshot file
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
