import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from "../../../context/AuthContext";
import { useCache } from "../../../hooks/useCache";
import { useCacheInvalidation } from "../../../hooks/useCacheInvalidation";
import apiClient, { forceRefreshCache, invalidateCache, getImageBaseUrl } from '../../../utils/axiosConfig';
import { useDebounce } from '../../../hooks/useDebounce';
import { useUpdateExecutionStatus } from '../../../hooks/useUpdateExecutionStatus';
import PageLoader from '../../../components/PageLoader';
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
import { downloadWorkbookAsFile } from '../../../utils/excelDownload';
import { AssignProjectModal, SelectShelterModal } from '../components/ProjectModals';
import { AddOrphansModal } from '../components/AddOrphansModal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { getProjectCode } from '../../../utils/helpers';
import ProjectFilters from './components/ProjectFilters';
import ProjectPagination from './components/ProjectPagination';
import ShekelConversionModal from './components/ShekelConversionModal';
import BeneficiariesModal from './components/BeneficiariesModal';
import MediaAcceptReplyModals from './components/MediaAcceptReplyModals';
import SupplyModal from './components/SupplyModal';
import ExportFilterModal from './components/ExportFilterModal';
import PostponeModal from './components/PostponeModal';
import NoteImagesModal from './components/NoteImagesModal';
import ExecutionStatusModal from './components/ExecutionStatusModal';
import ExecutionAlerts from './components/ExecutionAlerts';
import EmptyState from './components/EmptyState';
import TableHeaders from './components/TableHeaders';
import ProjectTableRow from './components/ProjectTableRow';

import {
  normalizeProjectRecord,
  getNumericValue,
  calculateDailyAmount,
  calculateMonthlyAmount,
  getMonthNumber,
  getMonthName,
  parseLocalDate,
  getCalendarMonthNameForProjectMonth,
  getDisplayMonthNameForProject,
  getCurrentMonth,
  isTodayInPhaseMonth,
  getCurrentProjectMonthFromStartDate,
  isMonthlyPhaseProject,
  filterProjectsForCurrentMonth,
  summarizeDailyPhaseStatuses,
  summarizeMonthlyPhaseStatuses,
} from './utils/projectUtils';

/** تفعيل سجلات التصحيح المزعجة في الكونسول (مثلاً Filtered projects) — اتركه false للاستخدام العادي */
const DEBUG_PROJECTS_LIST_VERBOSE = false;

/** تفعيل سجل تصحيح فلترة المراحل (اليومية/الشهرية) — اتركه false للاستخدام العادي */
const DEBUG_PHASE_FILTERING = false;

const ProjectsList = () => {
  const { user } = useAuth();
  
  // 🐛 DEBUG: Component lifecycle
  console.log('🐛 ProjectsList: Component rendered', {
    timestamp: new Date().toISOString(),
    userRole: user?.role,
    userId: user?.id
  });
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ التحقق إذا كانت هذه صفحة المشاريع المنتهية
  const isFinishedProjectsPage = location.pathname === '/project-management/projects/finished';

  // ✅ استخدام useCache hook مثل نظام الأيتام للكفاءة
  const { getData, setCachedData, isCacheValid, initializeCache, clearCache } = useCache('projects', 300000); // 5 minutes like orphan system
  const { invalidateProjectsCache } = useCacheInvalidation();

  // State variables
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const fetchInProgressRef = useRef(false);

  // Filter state
  const [filters, setFilters] = useState({
    status: [],
    project_type: [],
    searchQuery: '',
    page: 1,
    perPage: 'all',
    phase_day: '',
    parent_project_id: '',
    subcategory_id: [],
    researcher_id: '',
    photographer_id: '',
    producer_id: '',
    month_number: '',
    show_delayed_only: false,
    show_divided_parents_only: false,
    show_urgent_only: false,
    show_sub_projects_only: false,
  });

  const [searchInput, setSearchInput] = useState('');
  const [searchTimeoutId, setSearchTimeoutId] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc',
  });
  const [showFilters, setShowFilters] = useState(true);

  // Export state
  const [isExportFilterModalOpen, setIsExportFilterModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    status: [],
    project_type: [],
    researcher_id: '',
    photographer_id: '',
    team_id: '',
    shelter_id: '',
    governorate_id: '',
    district_id: '',
  });
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [loadingFilterData, setLoadingFilterData] = useState(false);
  const [teams, setTeams] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [districts, setDistricts] = useState([]);

  // ✅ تهيئة الـ cache عند التحميل مثل نظام الأيتام
  useEffect(() => {
    initializeCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ الاستماع إلى أحداث إبطال الكاش مثل نظام الأيتام
  useEffect(() => {
    const handleCacheInvalidation = (event) => {
      const { cacheKey } = event.detail;

      // ✅ إذا كان cacheKey === 'all' أو يطابق 'projects'
      if (cacheKey === 'all' || cacheKey === 'projects') {
        clearCache();
        setRefreshTrigger(prev => prev + 1);

        if (import.meta.env.DEV) {
          console.log('✅ Projects cache invalidated, fetching fresh data');
        }
      }
    };

    window.addEventListener('cache-invalidated', handleCacheInvalidation);

    return () => {
      window.removeEventListener('cache-invalidated', handleCacheInvalidation);
    };
  }, [clearCache]);

  // Fetch teams, photographers, shelters, governorates, and districts for export modal
  useEffect(() => {
    const fetchFilterData = async () => {
      setLoadingFilterData(true);
      try {
        // Fetch teams
        const teamsResponse = await apiClient.get('/teams', {
          params: { per_page: 100, _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 45000 // Increased timeout for filter data
        });
        if (teamsResponse.data.success) {
          setTeams(teamsResponse.data.teams || []);
        }

        // Fetch photographers
        const photographersResponse = await apiClient.get('/photographers', {
          params: { per_page: 100, _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 45000 // Increased timeout for filter data
        });
        if (photographersResponse.data.success) {
          setPhotographers(photographersResponse.data.photographers || []);
        }

        // Fetch shelters
        const sheltersResponse = await apiClient.get('/shelters', {
          params: { per_page: 100, _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 45000 // Increased timeout for filter data
        });
        if (sheltersResponse.data.success) {
          const sheltersList = sheltersResponse.data.shelters || [];
          setShelters(sheltersList);

          // Extract governorates from shelters
          const uniqueGovernorates = [...new Set(sheltersList.map(s => s.governorate).filter(Boolean))].sort();
          setGovernorates(uniqueGovernorates);
        }

        // Fetch project types
        const projectTypesResponse = await apiClient.get('/project-types', {
          timeout: 45000 // Increased timeout for filter data
        });
        if (projectTypesResponse.data.success) {
          setProjectTypes(projectTypesResponse.data.project_types || []);
        }

      } catch (error) {
        console.error('Error fetching filter data:', error);
      } finally {
        setLoadingFilterData(false);
      }
    };

    fetchFilterData();
  }, [isExportFilterModalOpen]);

  // Update districts when governorate changes
  useEffect(() => {
    if (exportFilters.governorate && shelters.length > 0) {
      const filteredDistricts = [...new Set(
        shelters
          .filter(s => s.governorate === exportFilters.governorate)
          .map(s => s.district)
          .filter(Boolean)
      )].sort();
      setDistricts(filteredDistricts);
    } else if (!exportFilters.governorate && shelters.length > 0) {
      // If no governorate selected, show all districts
      const allDistricts = [...new Set(shelters.map(s => s.district).filter(Boolean))].sort();
      setDistricts(allDistricts);
    }
  }, [exportFilters.governorate, shelters]);

  const [imageBlobUrls, setImageBlobUrls] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [loadingImages, setLoadingImages] = useState(new Set());

  // Role determination
  const normalizedRole = typeof (user?.role || user?.role_name || user?.user_role || '') === 'string'
    ? (user?.role || user?.role_name || user?.user_role || '').toLowerCase()
    : '';

  const isAdmin = ['admin', 'administrator', 'مدير'].includes(normalizedRole);
  const isProjectManager = normalizedRole === 'project_manager' || normalizedRole === 'مدير مشاريع';
  const isMediaManager = normalizedRole === 'media_manager' || normalizedRole === 'مدير الإعلام' || normalizedRole === 'مسؤول الإعلام';
  const isExecutedCoordinator = normalizedRole === 'executed_projects_coordinator' || normalizedRole === 'منسق مشاريع منفذة';
  const isOrphanSponsorCoordinator = normalizedRole === 'orphan_sponsor_coordinator' ||
    normalizedRole === 'منسق مشاريع كفالة الأيتام' ||
    normalizedRole === 'منسق الكفالات';

  // Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectShelterModalOpen, setSelectShelterModalOpen] = useState(false);
  const [addOrphansModalOpen, setAddOrphansModalOpen] = useState(false);
  const [noteImagesModalOpen, setNoteImagesModalOpen] = useState(false);
  const [noteImagesModalProject, setNoteImagesModalProject] = useState(null);
  const [noteImagesModalImages, setNoteImagesModalImages] = useState([]);
  const [noteImagesModalLoading, setNoteImagesModalLoading] = useState(false);
  const [showExecutionStatusModal, setShowExecutionStatusModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [showBeneficiariesModal, setShowBeneficiariesModal] = useState(false);
  const [showShekelModal, setShowShekelModal] = useState(false);
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedProjectForStatusUpdate, setSelectedProjectForStatusUpdate] = useState(null);
  const [executionStatusAction, setExecutionStatusAction] = useState('');
  const [postponementReason, setPostponementReason] = useState('');
  const [isPostponing, setIsPostponing] = useState(null);
  const [isResuming, setIsResuming] = useState(null);
  const [postponingProjectId, setPostponingProjectId] = useState(null);
  const [clearingAssignmentId, setClearingAssignmentId] = useState(null);
  const [transferringToExecution, setTransferringToExecution] = useState(null);
  const [supplyProject, setSupplyProject] = useState(null);
  const [projectQuantity, setProjectQuantity] = useState(0);
  const [cartItems, setCartItems] = useState([]);
  const [warehouseItems, setWarehouseItems] = useState([]);
  const [loadingWarehouse, setLoadingWarehouse] = useState(false);
  const [confirmingSupply, setConfirmingSupply] = useState(false);
  const [addingItem, setAddingItem] = useState(null);
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState('');
  const [surplusCategories, setSurplusCategories] = useState([]);
  const [selectedSurplusCategoryId, setSelectedSurplusCategoryId] = useState(null);
  const [loadingSurplusCategories, setLoadingSurplusCategories] = useState(false);
  const [beneficiariesCount, setBeneficiariesCount] = useState(0);
  const [updatingBeneficiaries, setUpdatingBeneficiaries] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [transferDiscountPercentage, setTransferDiscountPercentage] = useState(0);
  const [convertingToShekel, setConvertingToShekel] = useState(false);
  const [isEditingShekel, setIsEditingShekel] = useState(false);

  // Supply data for projects
  const [projectsSupplyData, setProjectsSupplyData] = useState({});
  const [loadingSupplyData, setLoadingSupplyData] = useState(false);

  // Accept/Reply modal state
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [notificationToAccept, setNotificationToAccept] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [replyForm, setReplyForm] = useState({
    message: '',
    rejection_reason: '',
  });
  const [accepting, setAccepting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [projectNotification, setProjectNotification] = useState(null);

  // Project types and subcategories
  const DEFAULT_PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];
  const [projectTypes, setProjectTypes] = useState(DEFAULT_PROJECT_TYPES);
  const [projectTypesLoading, setProjectTypesLoading] = useState(false);
  
  // Ensure projectTypes always has default values as fallback
  const availableProjectTypes = useMemo(() => {
    return Array.isArray(projectTypes) && projectTypes.length > 0 ? projectTypes : DEFAULT_PROJECT_TYPES;
  }, [projectTypes]);
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);

  // Filter lists
  const [researchers, setResearchers] = useState([]);
  const [producers, setProducers] = useState([]);
  const [loadingFilterLists, setLoadingFilterLists] = useState(false);

  // Dropdown state
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProjectTypeDropdown, setShowProjectTypeDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [showExportStatusDropdown, setShowExportStatusDropdown] = useState(false);
  const [showExportProjectTypeDropdown, setShowExportProjectTypeDropdown] = useState(false);
  const [showMonthlyPhasesHelp, setShowMonthlyPhasesHelp] = useState(false);
  const exportStatusDropdownRef = useRef(null);
  const exportProjectTypeDropdownRef = useRef(null);

  // مدة الكاش: 1 دقيقة لـ Project Manager، دقيقتان للباقي
  const getCacheMaxAge = () => {
    if (isProjectManager) return 60000; // 1 دقيقة لـ PM
    if (isAdmin) return 30000; // 30 ثانية للإدارة (لتحديث أسرع)
    return 120000; // دقيقتان للباقي
  };

  const PROJECT_STATUSES = [
    'جديد',
    'قيد التوريد',
    'تم التوريد',
    'مسند لباحث',
    'جاهز للتنفيذ',
    'تم اختيار المخيم',
    'قيد التنفيذ',
    'تم التنفيذ',
    'في المونتاج',
    'تم المونتاج',
    'يجب إعادة المونتاج',
    'وصل للمتبرع',
    'منتهي',
    'ملغى',
    'مؤجل',
  ];

  // ✅ Helper functions
  // ✅ دالة للتحقق من أن المشروع هو مشروع كفالة أيتام
  // ✅ تدعم قراءة project_type و subcategory من parent_project للمشاريع الفرعية
  const isOrphanSponsorshipProject = useCallback((project) => {
    if (!project) return false;

    try {
      // ✅ للمشاريع الفرعية: قراءة project_type و subcategory من parent_project
      const parentProject = project.parent_project || project.parentProject || null;
      const hasParentProjectId = project.parent_project_id != null && project.parent_project_id !== undefined;
      const isSubProject = hasParentProjectId ||
        project.is_monthly_phase === true ||
        project.is_daily_phase === true ||
        project.month_number != null ||
        project.phase_day != null;

      // ✅ التحقق من project_type (من المشروع نفسه أو من parent_project)
      let projectType = '';
      if (typeof project.project_type === 'object' && project.project_type !== null) {
        projectType = project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '';
      } else if (project.project_type != null) {
        projectType = String(project.project_type);
      }

      // ✅ إذا كان المشروع فرعي ولم يكن له project_type، نقرأه من parent_project
      if ((!projectType || projectType.trim() === '') && isSubProject && parentProject) {
        if (typeof parentProject.project_type === 'object' && parentProject.project_type !== null) {
          projectType = parentProject.project_type.name_ar || parentProject.project_type.name || parentProject.project_type.name_en || '';
        } else if (parentProject.project_type != null) {
          projectType = String(parentProject.project_type);
        }
      }

      // ✅ التحقق من أن نوع المشروع هو "الكفالات" أو "كفالات" (أكثر مرونة)
      const projectTypeStr = (projectType || '').trim();
      const isSponsorshipType = projectTypeStr === 'الكفالات' ||
        projectTypeStr === 'كفالات' ||
        projectTypeStr.toLowerCase() === 'الكفالات' ||
        projectTypeStr.toLowerCase() === 'كفالات' ||
        projectTypeStr.includes('كفالات') ||
        projectTypeStr.includes('كفالة');

      // ✅ إذا كان المشروع شهري فرعي وله parent_project_id، نعتبره مشروع كفالة حتى لو لم نجد project_type
      // هذا لأن المشاريع الشهرية الفرعية قد لا تحتوي على project_type مباشرة
      if (!isSponsorshipType && isSubProject && (project.is_monthly_phase || project.month_number != null)) {
        // ✅ إذا كان المشروع شهري فرعي، نتحقق من parent_project فقط
        if (parentProject) {
          let parentProjectType = '';
          if (typeof parentProject.project_type === 'object' && parentProject.project_type !== null) {
            parentProjectType = parentProject.project_type.name_ar || parentProject.project_type.name || parentProject.project_type.name_en || '';
          } else if (parentProject.project_type != null) {
            parentProjectType = String(parentProject.project_type);
          }
          const parentProjectTypeStr = (parentProjectType || '').trim();
          const isParentSponsorshipType = parentProjectTypeStr === 'الكفالات' ||
            parentProjectTypeStr === 'كفالات' ||
            parentProjectTypeStr.toLowerCase() === 'الكفالات' ||
            parentProjectTypeStr.toLowerCase() === 'كفالات' ||
            parentProjectTypeStr.includes('كفالات') ||
            parentProjectTypeStr.includes('كفالة');

          // ✅ إذا كان parent_project من نوع كفالات، نعتبر المشروع الشهري فرعي مشروع كفالة
          if (isParentSponsorshipType) {
            return true;
          }
        }
        // ✅ إذا لم نجد parent_project، لكن المشروع شهري فرعي، نعتبره مشروع كفالة افتراضياً
        // (لأن منسق الكفالات يجب أن يرى جميع المشاريع الشهرية)
        return true;
      }

      if (!isSponsorshipType) {
        return false;
      }

      // ✅ التحقق من subcategory (من المشروع نفسه أو من parent_project)
      let subcategory = project.subcategory || {};

      // ✅ إذا كان المشروع فرعي ولم يكن له subcategory، نقرأه من parent_project
      if ((!subcategory || Object.keys(subcategory).length === 0) && isSubProject && parentProject) {
        subcategory = parentProject.subcategory || parentProject.sub_category || {};
      }

      let subcategoryNameAr = '';
      let subcategoryName = '';
      let subcategoryNameEn = '';

      if (subcategory.name_ar != null) {
        subcategoryNameAr = String(subcategory.name_ar).trim();
      }
      if (subcategory.name != null) {
        subcategoryName = String(subcategory.name).trim();
      }
      if (subcategory.name_en != null) {
        subcategoryNameEn = String(subcategory.name_en).trim();
      }

      const isOrphanSponsorship = subcategoryNameAr === 'كفالة أيتام' ||
        subcategoryName === 'Orphan Sponsorship' ||
        subcategoryNameEn === 'Orphan Sponsorship' ||
        subcategoryNameAr.includes('كفالة أيتام') ||
        subcategoryNameAr.includes('أيتام') ||
        (subcategoryName && subcategoryName.toLowerCase().includes('orphan sponsorship')) ||
        (subcategoryName && subcategoryName.toLowerCase().includes('orphan')) ||
        (subcategoryNameEn && subcategoryNameEn.toLowerCase().includes('orphan sponsorship')) ||
        (subcategoryNameEn && subcategoryNameEn.toLowerCase().includes('orphan'));

      // ✅ للمشاريع الشهرية الفرعية: إذا كان parent_project من نوع "كفالات" وتفريعته "كفالة أيتام"
      // نعتبر المشروع الشهري فرعي مشروع كفالة أيتام حتى لو لم نجد subcategory مباشرة
      if (isSubProject && (project.is_monthly_phase || project.month_number != null)) {
        if (isSponsorshipType && isOrphanSponsorship) {
          return true;
        }
        // ✅ إذا كان parent_project موجود وله project_type "كفالات"، نعتبر المشروع الشهري فرعي مشروع كفالة
        if (parentProject && isSponsorshipType) {
          // ✅ التحقق من subcategory في parent_project
          let parentSubcategory = parentProject.subcategory || parentProject.sub_category || {};
          let parentSubcategoryNameAr = '';
          if (parentSubcategory.name_ar != null) {
            parentSubcategoryNameAr = String(parentSubcategory.name_ar).trim();
          }
          const isParentOrphanSponsorship = parentSubcategoryNameAr === 'كفالة أيتام' ||
            parentSubcategoryNameAr.includes('كفالة أيتام') ||
            parentSubcategoryNameAr.includes('أيتام');

          if (isParentOrphanSponsorship) {
            return true;
          }
        }
        // ✅ إذا كان المشروع شهري فرعي وله parent_project_id ونوع parent_project "كفالات"، نعتبره مشروع كفالة
        if (hasParentProjectId && isSponsorshipType) {
          return true;
        }
      }

      // ✅ نعيد true فقط إذا كان نوع المشروع "كفالات" والتفريعة "كفالة أيتام"
      return isSponsorshipType && isOrphanSponsorship;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('❌ Error in isOrphanSponsorshipProject:', error, {
          project: project?.id,
          parentProject: project?.parent_project?.id || project?.parentProject?.id,
        });
      }
      return false;
    }
  }, []);

  const isSponsorshipProject = useCallback((project) => {
    if (!project) return false;
    try {
      const parentProject = project.parent_project || project.parentProject || null;
      const isSubProject = project.parent_project_id != null || project.is_monthly_phase === true ||
        project.is_daily_phase === true || project.month_number != null || project.phase_day != null;

      let projectType = '';
      if (typeof project.project_type === 'object' && project.project_type !== null) {
        projectType = project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '';
      } else if (project.project_type != null) {
        projectType = String(project.project_type);
      }
      if ((!projectType || projectType.trim() === '') && isSubProject && parentProject) {
        if (typeof parentProject.project_type === 'object' && parentProject.project_type !== null) {
          projectType = parentProject.project_type.name_ar || parentProject.project_type.name || parentProject.project_type.name_en || '';
        } else if (parentProject.project_type != null) {
          projectType = String(parentProject.project_type);
        }
      }

      const projectTypeStr = (projectType || '').trim();
      const isSponsorshipType = projectTypeStr === 'الكفالات' || projectTypeStr === 'كفالات' ||
        projectTypeStr.toLowerCase().includes('كفالات') || projectTypeStr.includes('كفالة');

      if (isSponsorshipType) return true;

      if (isSubProject && parentProject) {
        let parentType = '';
        if (typeof parentProject.project_type === 'object' && parentProject.project_type !== null) {
          parentType = parentProject.project_type.name_ar || parentProject.project_type.name || parentProject.project_type.name_en || '';
        } else if (parentProject.project_type != null) {
          parentType = String(parentProject.project_type);
        }
        const parentStr = (parentType || '').trim();
        if (parentStr === 'الكفالات' || parentStr === 'كفالات' || parentStr.includes('كفالات') || parentStr.includes('كفالة')) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // ✅ Sync searchInput with filters.searchQuery
  useEffect(() => {
    if (filters.searchQuery !== searchInput) {
      setSearchInput(filters.searchQuery);
    }
  }, [filters.searchQuery]);

  // ✅ Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutId) {
        clearTimeout(searchTimeoutId);
      }
    };
  }, [searchTimeoutId]);

  // ✅ Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.relative')) {
        setShowStatusDropdown(false);
        setShowProjectTypeDropdown(false);
        setShowSubcategoryDropdown(false);
        setShowExportProjectTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ Close export dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportStatusDropdownRef.current && !exportStatusDropdownRef.current.contains(event.target)) {
        setShowExportStatusDropdown(false);
      }
      if (exportProjectTypeDropdownRef.current && !exportProjectTypeDropdownRef.current.contains(event.target)) {
        setShowExportProjectTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ✅ Fetch project types and subcategories
  useEffect(() => {
    const fetchProjectTypes = async () => {
      setProjectTypesLoading(true);
      try {
        const response = await apiClient.get('/project-types');
        console.log('📡 Project types API response:', response.data);
        
        if (response.data.success) {
          const types = response.data.data || response.data.types || response.data.project_types || [];
          console.log('🎯 Extracted project types:', types);
          setProjectTypes(types.length > 0 ? types : DEFAULT_PROJECT_TYPES);
        } else {
          console.warn('⚠️ Project types API returned success=false, using defaults');
          setProjectTypes(DEFAULT_PROJECT_TYPES);
        }
      } catch (error) {
        console.error('❌ Error fetching project types:', error);
        setProjectTypes(DEFAULT_PROJECT_TYPES);
      } finally {
        setProjectTypesLoading(false);
      }
    };

    fetchProjectTypes();
  }, []);

  useEffect(() => {
    const fetchSubcategories = async () => {
      setSubcategoriesLoading(true);
      let retryCount = 0;
      const maxRetries = 3;
      let lastError = null;

      while (retryCount < maxRetries) {
        try {
          const response = await apiClient.get('/project-subcategories', {
            params: { _t: Date.now() },
            headers: { 'Cache-Control': 'no-cache' }
          });

          if (response.data.success) {
            const data = response.data.data || [];
            setSubcategories(data);
            setSubcategoriesLoading(false);
            return;
          }
        } catch (error) {
          lastError = error;
          // Don't retry on 404 - endpoint doesn't exist
          if (error.response?.status === 404) {
            break;
          }
          if ((error.code === 'ECONNABORTED' || error.isTimeoutError) && retryCount < maxRetries) {
            const waitTime = Math.min(1000 * Math.pow(2, retryCount), 5000);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retryCount++;
            continue;
          } else {
            break;
          }
        }
      }

      // Only log error if it's not a 404 (expected when endpoint doesn't exist)
      if (lastError && lastError.response?.status !== 404) {
        if (import.meta.env.DEV && !lastError.isConnectionError) {
          console.error('Error fetching subcategories:', lastError);
        }
      }
      setSubcategoriesLoading(false);
    };

    fetchSubcategories();
  }, []);

  // ✅ Clean subcategory selections when project type changes
  useEffect(() => {
    if (!Array.isArray(filters.subcategory_id) || filters.subcategory_id.length === 0) {
      return;
    }

    if (!Array.isArray(filters.project_type) || filters.project_type.length === 0) {
      return;
    }

    const validSubcategoryIds = subcategories
      .filter(subcat => filters.project_type.includes(subcat.project_type))
      .map(subcat => String(subcat.id));

    const cleanedSubcategoryIds = filters.subcategory_id.filter(id =>
      validSubcategoryIds.includes(id)
    );

    if (cleanedSubcategoryIds.length !== filters.subcategory_id.length) {
      setFilters(prev => ({
        ...prev,
        subcategory_id: cleanedSubcategoryIds,
      }));
    }
  }, [filters.project_type, subcategories, setFilters]);

  // ✅ Fetch filter lists (researchers, photographers, producers)
  useEffect(() => {
    const fetchFilterLists = async () => {
      if (!showFilters) return;

      setLoadingFilterLists(true);
      try {
        try {
          const researchersResponse = await apiClient.get('/team-personnel/available', {
            params: { _t: Date.now() },
            headers: { 'Cache-Control': 'no-cache' },
            timeout: 45000 // Increased timeout for filter data
          });
          if (researchersResponse.data.success) {
            const researchersData = researchersResponse.data.researchers || [];
            setResearchers(researchersData.filter((r) => r.is_active !== false));
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('Failed to fetch researchers:', error);
          }
        }

        try {
          const photographersResponse = await apiClient.get('/photographers', {
            params: { per_page: 100, _t: Date.now() },
            headers: { 'Cache-Control': 'no-cache' },
            timeout: 45000 // Increased timeout for filter data
          });
          if (photographersResponse.data.success) {
            setPhotographers(photographersResponse.data.photographers || photographersResponse.data.data || []);
          }
        } catch (error) {
          setPhotographers([]);
          if (import.meta.env.DEV && error?.response?.status !== 500) {
            console.warn('Failed to fetch photographers:', error);
          }
        }

        if (normalizedRole === 'media_manager' || normalizedRole === 'مدير الإعلام' || normalizedRole === 'مسؤول الإعلام') {
          try {
            const producersResponse = await apiClient.get('/montage-producers/list', {
              params: { _t: Date.now() },
              headers: { 'Cache-Control': 'no-cache' },
              timeout: 45000 // Increased timeout for filter data
            });
            if (producersResponse.data.success) {
              setProducers(producersResponse.data.producers || producersResponse.data.data || []);
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn('Failed to fetch montage producers:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching filter lists:', error);
      } finally {
        setLoadingFilterLists(false);
      }
    };

    fetchFilterLists();
  }, [showFilters, normalizedRole]);

  // ✅ Fetch projects supply data for coordinator
  useEffect(() => {
    const fetchProjectsSupplyData = async (readyProjects) => {
      if (loadingSupplyData) return;

      setLoadingSupplyData(true);
      const supplyDataMap = {};

      try {
        const REQUEST_DELAY = 300;
        const MAX_RETRIES = 2;

        for (const project of readyProjects) {
          let retryCount = 0;
          let success = false;

          while (retryCount <= MAX_RETRIES && !success) {
            try {
              const response = await apiClient.get(`/projects/${project.id}/warehouse`);
              if (response.data.success) {
                const data = response.data.data || response.data;
                supplyDataMap[project.id] = {
                  quantity: data.project?.quantity || project.quantity || 0,
                  items_count: data.items?.length || 0,
                  items: data.items || [],
                };
                success = true;
              }
            } catch (error) {
              if (error.response?.status === 429) {
                const retryAfter = error.response?.headers?.['retry-after'] ||
                  error.response?.headers?.['Retry-After'];
                const waitTime = retryAfter
                  ? parseInt(retryAfter) * 1000
                  : Math.min(1000 * Math.pow(2, retryCount), 5000);

                if (retryCount < MAX_RETRIES) {
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  retryCount++;
                  continue;
                } else {
                  supplyDataMap[project.id] = {
                    quantity: project.quantity || 0,
                    items_count: 0,
                    items: [],
                  };
                  success = true;
                }
              } else {
                supplyDataMap[project.id] = {
                  quantity: project.quantity || 0,
                  items_count: 0,
                  items: [],
                };
                success = true;
              }
            }
          }

          if (readyProjects.indexOf(project) < readyProjects.length - 1) {
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
          }
        }

        setProjectsSupplyData(prev => ({ ...prev, ...supplyDataMap }));
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching projects supply data:', error);
        }
      } finally {
        setLoadingSupplyData(false);
      }
    };

    if (isExecutedCoordinator && projects.length > 0) {
      const readyProjects = projects.filter((project) => {
        if (!project || Array.isArray(project)) return false;
        return project.status === 'جاهز للتنفيذ';
      });
      if (readyProjects.length > 0) {
        fetchProjectsSupplyData(readyProjects);
      }
    }

    if (isProjectManager && projects.length > 0 && !loadingSupplyData) {
      const projectsNeedingQuantity = projects.filter((project) => {
        if (!project || Array.isArray(project)) return false;
        const hasQuantity = project.quantity !== null &&
          project.quantity !== undefined &&
          project.quantity !== '' &&
          project.quantity !== 0;
        const alreadyFetched = projectsSupplyData[project.id];
        return !hasQuantity && !alreadyFetched;
      });

      if (projectsNeedingQuantity.length > 0) {
        const projectsToFetch = projectsNeedingQuantity.slice(0, 50);
        fetchProjectsSupplyData(projectsToFetch);
      }
    }
  }, [projects, isExecutedCoordinator, isProjectManager, loadingSupplyData]);

  // ✅ Filter and pagination logic
  const visibleProjects = useMemo(() => {
    let filteredProjects = Array.isArray(projects) ? [...projects] : [];

    // Apply filters based on role
    if (isAdmin) {
      // Admin: show all projects except finished on main page, only finished on finished page
      if (isFinishedProjectsPage) {
        filteredProjects = filteredProjects.filter((project) => project.status === 'منتهي');
      } else {
        filteredProjects = filteredProjects.filter((project) => project.status !== 'منتهي');
      }
    } else if (isProjectManager) {
      // Project Manager: show non-divided + daily phases in window
      filteredProjects = filteredProjects.filter((project) => {
        if (!project || Array.isArray(project)) return false;
        return !project.is_daily_phase && !project.is_monthly_phase;
      });
    } else if (isOrphanSponsorCoordinator) {
      // Coordinator: show all sponsorship projects
      filteredProjects = filteredProjects.filter((project) => {
        if (!project || Array.isArray(project)) return false;
        return isSponsorshipProject(project);
      });
    } else {
      // Default: show all projects for other roles
      // No filtering - show everything
    }

    // Apply search filter (only when search is explicitly triggered)
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const searchLower = filters.searchQuery.toLowerCase().trim();
      filteredProjects = filteredProjects.filter((project) => {
        const projectName = (project.project_name || '').toLowerCase();
        const description = (project.project_description || project.description || '').toLowerCase();
        const donorName = (project.donor_name || '').toLowerCase();
        const donorCode = (project.donor_code || '').toLowerCase();
        const internalCode = (project.internal_code || '').toLowerCase();

        return projectName.includes(searchLower) ||
          description.includes(searchLower) ||
          donorName.includes(searchLower) ||
          donorCode.includes(searchLower) ||
          internalCode.includes(searchLower);
      });
    }

    // Apply status filter
    if (Array.isArray(filters.status) && filters.status.length > 0) {
      filteredProjects = filteredProjects.filter((project) => filters.status.includes(project.status));
    }

    // Apply project type filter
    if (filters.project_type && Array.isArray(filters.project_type) && filters.project_type.length > 0) {
      filteredProjects = filteredProjects.filter((project) =>
        filters.project_type.includes(project.project_type)
      );
    }

    // Apply subcategory filter
    if (filters.subcategory_id && Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0) {
      const targetSubcategoryIds = filters.subcategory_id.map(id => parseInt(id, 10));
      filteredProjects = filteredProjects.filter((project) => {
        let projectSubcategoryId = null;

        if (project.subcategory_id !== null && project.subcategory_id !== undefined && project.subcategory_id !== '') {
          projectSubcategoryId = project.subcategory_id;
        } else if (project.subcategory) {
          if (typeof project.subcategory === 'object' && project.subcategory !== null) {
            projectSubcategoryId = project.subcategory.id || project.subcategory.subcategory_id;
          } else if (typeof project.subcategory === 'number' || typeof project.subcategory === 'string') {
            projectSubcategoryId = project.subcategory;
          }
        }

        if (projectSubcategoryId === null || projectSubcategoryId === undefined || projectSubcategoryId === '') {
          return false;
        }

        const projectIdNum = parseInt(String(projectSubcategoryId), 10);
        const matches = !isNaN(projectIdNum) && targetSubcategoryIds.includes(projectIdNum);

        return matches;
      });
    }

    // Apply delayed filter
    if (filters.show_delayed_only) {
      filteredProjects = filteredProjects.filter((project) => {
        const status = (project?.status || '').trim();
        if (status === 'منتهي' || status === 'وصل للمتبرع') return false;
        return project.is_delayed === true || project.isDelayed === true;
      });
    }

    // Apply urgent filter
    if (filters.show_urgent_only) {
      filteredProjects = filteredProjects.filter((project) => {
        return project.is_urgent === true;
      });
    }

    // Apply sorting
    if (sortConfig.key) {
      filteredProjects = [...filteredProjects].sort((a, b) => {
        const aIsUrgent = a.is_urgent && a.status !== 'منتهي';
        const bIsUrgent = b.is_urgent && b.status !== 'منتهي';
        if (aIsUrgent && !bIsUrgent) return -1;
        if (!aIsUrgent && bIsUrgent) return 1;

        let aValue, bValue;

        switch (sortConfig.key) {
          case 'created_at':
            aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
            bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
            break;
          case 'updated_at':
            aValue = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            bValue = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            break;
          case 'project_name':
            aValue = (a.project_name || a.beneficiary_name || a.donor_name || '').toLowerCase();
            bValue = (b.project_name || b.beneficiary_name || b.donor_name || '').toLowerCase();
            break;
          case 'status':
            aValue = (a.status || '').toLowerCase();
            bValue = (b.status || '').toLowerCase();
            break;
          case 'net_amount':
            aValue = a.net_amount_usd ?? a.net_amount ?? 0;
            bValue = b.net_amount_usd ?? b.net_amount ?? 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return Array.isArray(filteredProjects) ? filteredProjects : [];
  }, [projects, isAdmin, isProjectManager, isOrphanSponsorCoordinator, isFinishedProjectsPage, isSponsorshipProject, filters, sortConfig]);

  const paginatedProjects = useMemo(() => {
    if (isOrphanSponsorCoordinator) {
      return visibleProjects;
    }

    if (filters.perPage === 'all' || filters.perPage === 'الكل') {
      return visibleProjects;
    }

    const perPageNumber = typeof filters.perPage === 'number' ? filters.perPage : parseInt(filters.perPage) || 10;

    if (sortConfig?.key === 'created_at' || sortConfig?.key === 'updated_at') {
      const startIndex = (filters.page - 1) * perPageNumber;
      const endIndex = startIndex + perPageNumber;
      return visibleProjects.slice(startIndex, endIndex);
    }

    return visibleProjects;
  }, [visibleProjects, filters.page, filters.perPage, sortConfig, isOrphanSponsorCoordinator]);

  const parentProjectOptions = useMemo(() => {
    const optionsMap = new Map();

    projects.forEach((project) => {
      if (!project || Array.isArray(project)) return;
      
      if (project?.is_daily_phase || project?.is_monthly_phase) {
        const parentId = project?.parent_project_id ||
          project?.parentProjectId ||
          (project?.parent_project && project.parent_project.id) ||
          (project?.parentProject && project.parentProject.id) ||
          null;

        if (parentId) {
          const parentName =
            project?.parent_project?.project_name ||
            project?.parent_project?.name ||
            project?.parentProject?.project_name ||
            project?.parentProject?.name ||
            (parentId ? `المشروع رقم ${parentId}` : null);

          if (!optionsMap.has(parentId)) {
            optionsMap.set(parentId, {
              id: parentId,
              label: parentName || `#${parentId}`,
            });
          }
        }
      }

      if (project?.is_divided_into_phases) {
        const hasParentId = project?.parent_project_id != null ||
          project?.parentProjectId != null ||
          (project?.parent_project && project.parent_project.id != null) ||
          (project?.parentProject && project.parentProject.id != null);

        if (!hasParentId && project?.id && !optionsMap.has(project.id)) {
          optionsMap.set(project.id, {
            id: project.id,
            label: project.project_name || project.name || `#${project.id}`,
          });
        }
      }
    });

    return Array.from(optionsMap.values()).sort((a, b) => {
      const nameA = (a.label || '').toLowerCase();
      const nameB = (b.label || '').toLowerCase();
      return nameA.localeCompare(nameB, 'ar');
    });
  }, [projects]);

  const readyForExecutionProjects = useMemo(() => {
    return visibleProjects.filter(p => p.status === 'جاهز للتنفيذ');
  }, [visibleProjects]);

  // ✅ Helper functions
  const getProjectDescription = (project) => {
    return project.project_description || project.description || '';
  };

  const getSubProjectParentName = (project) => {
    if (!project) return null;
    const parent = project.parent_project || project.parentProject || project.__parentProject;
    const name = parent?.project_name || parent?.name;
    if (name) return name;
    const parentId = project.parent_project_id ?? project.parentProjectId ?? parent?.id;
    return parentId ? `المشروع الأصلي #${parentId}` : null;
  };

  const getDivisionTextColor = (project) => {
    if (!project?.is_divided_into_phases) return 'text-gray-800';

    const hasMonthlyFlag = project.phase_type === 'monthly' ||
      project.is_monthly_phase === true ||
      project.isMonthlyPhase === true;
    const hasDailyFlag = project.phase_type === 'daily' ||
      project.is_daily_phase === true ||
      project.isDailyPhase === true;
    const hasTotalMonths = !!(project.total_months || project.parent_project?.total_months);

    const isMonthly = hasMonthlyFlag || (!hasDailyFlag && hasTotalMonths);

    if (isMonthly) {
      return 'text-purple-600 font-semibold';
    } else if (hasDailyFlag || project.phase_duration_days || project.parent_project?.phase_duration_days) {
      return 'text-blue-600 font-semibold';
    }

    return 'text-gray-800';
  };

  const getStatusColor = (status) => {
    const colors = {
      'جديد': 'bg-blue-500',
      'قيد التوريد': 'bg-indigo-500',
      'تم التوريد': 'bg-teal-500',
      'مسند لباحث': 'bg-purple-500',
      'مؤجل': 'bg-amber-500',
      'جاهز للتنفيذ': 'bg-yellow-500',
      'تم اختيار المخيم': 'bg-yellow-600',
      'قيد التنفيذ': 'bg-purple-500',
      'تم التنفيذ': 'bg-gray-700',
      'في المونتاج': 'bg-purple-300',
      'تم المونتاج': 'bg-green-500',
      'يجب إعادة المونتاج': 'bg-red-500',
      'وصل للمتبرع': 'bg-green-700',
      'منتهي': 'bg-gray-600',
      'ملغى': 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const formatOriginalAmount = (amount, currency = 'USD') => {
    if (amount === null || amount === undefined || amount === '') return '0';
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatCurrency = (amount, currency = 'USD') => {
    const formatted = formatOriginalAmount(amount, currency);
    if (currency === 'USD') {
      return `$${formatted}`;
    } else if (currency === 'ILS' || currency === 'NIS') {
      return `₪${formatted}`;
    }
    return formatted;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  };

  const getRemainingDaysBadge = (project) => {
    const status = (project?.status || '').trim();

    if (status === 'منتهي') {
      return {
        element: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            ✓ منتهي
          </span>
        ),
        isOverdue: false,
        isFinished: true,
      };
    }

    if (status === 'وصل للمتبرع') {
      return {
        element: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            ✓ وصل للمتبرع
          </span>
        ),
        isOverdue: false,
        isFinished: true,
      };
    }

    if (project.remaining_days === null || project.remaining_days === undefined) {
      if (status === 'ملغى') {
        return {
          element: (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 border border-gray-300">
              ملغى
            </span>
          ),
          isOverdue: false,
          isFinished: true,
        };
      }
      return {
        element: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            مكتمل
          </span>
        ),
        isOverdue: false,
        isFinished: true,
      };
    }

    const remaining = Number(project.remaining_days);
    if (!Number.isNaN(remaining) && remaining < 2) {
      const fromApi = project.delayed_days ?? project.delayedDays;
      const computed = Math.max(0, 2 - remaining);
      const raw = (fromApi != null && fromApi > 0) ? fromApi : computed;
      const delayedDays = Math.max(1, raw);
      return {
        element: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
            ⚠️ متأخر بـ {delayedDays} يوم
          </span>
        ),
        isOverdue: true,
        isFinished: false,
      };
    }

    return {
      element: (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
          {project.remaining_days} يوم متبقي
        </span>
      ),
      isOverdue: false,
      isFinished: false,
    };
  };

  const renderProjectBadges = (project) => {
    const badges = [];

    if (project?.is_daily_phase || project?.isDailyPhase) {
      badges.push(
        <span key="daily" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100" title="مرحلة يومية">
          مرحلة يومية
        </span>
      );
      if (project?.phase_day != null || project?.phaseDay != null) {
        badges.push(
          <span key="phase-day" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
            اليوم {project.phase_day ?? project.phaseDay}
          </span>
        );
      }
      return badges.length > 0 ? <div className="flex flex-wrap gap-2 mt-2">{badges}</div> : null;
    }

    if (project?.is_monthly_phase || project?.isMonthlyPhase) {
      badges.push(
        <span key="monthly-phase" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100" title="مرحلة شهرية">
          مرحلة شهرية
        </span>
      );
      if (project?.month_number != null || project?.monthNumber != null) {
        badges.push(
          <span key="month-num" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            الشهر {project.month_number ?? project.monthNumber}
          </span>
        );
      }
      return badges.length > 0 ? <div className="flex flex-wrap gap-2 mt-2">{badges}</div> : null;
    }

    if (project?.is_divided_into_phases) {
      const isMonthly =
        project.phase_type === 'monthly' ||
        project.is_monthly_phase === true ||
        (project.total_months && !project.phase_duration_days);

      if (isMonthly) {
        badges.push(
          <span key="monthly" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
            {project.total_months || project.parent_project?.total_months || '--'} شهر
          </span>
        );
      } else if (project.phase_duration_days || project.parent_project?.phase_duration_days) {
        badges.push(
          <span key="days" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
            يوم {project.phase_duration_days || project.parent_project?.phase_duration_days}
          </span>
        );
      }
      return badges.length > 0 ? <div className="flex flex-wrap gap-2 mt-2">{badges}</div> : null;
    }

    return badges.length > 0 ? <div className="flex flex-wrap gap-2 mt-2">{badges}</div> : null;
  };

  const hasProjectImage = (projectId) => {
    return imageBlobUrls[projectId] !== undefined;
  };

  // ✅ Event handlers
  const handleOpenShelterModal = (project) => {
    setSelectedProject(project);
    setSelectShelterModalOpen(true);
  };

  const handleTransferToExecution = async (projectId) => {
    if (!window.confirm('هل أنت متأكد من نقل المشروع للتنفيذ؟ (مشاريع الكفالة لا تحتاج اختيار مخيم)')) {
      return;
    }

    setTransferringToExecution(projectId);
    try {
      const response = await apiClient.post(`/project-proposals/${projectId}/transfer-to-execution`);

      if (response.data.success) {
        toast.success(response.data.message || 'تم نقل المشروع للتنفيذ بنجاح');
        forceRefreshCache();
        invalidateCache('projects');
        invalidateCache('project-proposals');
        window.dispatchEvent(new CustomEvent('cache-invalidated', { detail: { cacheKey: 'project-proposals' } }));
        fetchProjects({ forceRefresh: true });
      } else {
        toast.error(response.data.message || 'فشل نقل المشروع');
      }
    } catch (error) {
      console.error('Error transferring to execution:', error);
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء نقل المشروع');
    } finally {
      setTransferringToExecution(null);
    }
  };

  const handleResumeProject = async (projectId) => {
    if (!window.confirm('هل أنت متأكد من استئناف المشروع؟ سيتم إعادة المشروع لحالته السابقة.')) {
      return;
    }

    try {
      setIsResuming(true);
      const response = await apiClient.post(`/project-proposals/${projectId}/resume`);

      if (response.data.success) {
        toast.success(response.data.message || 'تم استئناف المشروع بنجاح');
        // ✅ إبطال الكاش بعد التحديث
        fetchProjects({ forceRefresh: true }); // تحديث القائمة
      } else {
        toast.error(response.data.message || 'فشل استئناف المشروع');
      }
    } catch (error) {
      console.error('Error resuming project:', error);

      // معالجة خاصة لأخطاء الصلاحيات
      if (error.response?.status === 403) {
        const permissionMessage = error.response?.data?.message ||
          'ليس لديك صلاحيات لاستئناف هذا المشروع.';
        toast.error(permissionMessage);
      } else {
        toast.error(error.response?.data?.message || 'حدث خطأ أثناء استئناف المشروع');
      }
    } finally {
      setIsResuming(false);
    }
  };

  const handleOpenOrphansModal = (project) => {
    setSelectedProject(project);
    setAddOrphansModalOpen(true);
  };

  // ✅ دالة مساعدة للتحقق من أن المشروع في حالة توريد أو لاحقة
  const isInSupplyOrLaterStatus = (status) => {
    const supplyAndLaterStatuses = [
      'قيد التوريد',
      'تم التوريد',
      'قيد التوزيع',
      'مسند لباحث',
      'جاهز للتنفيذ',
      'تم اختيار المخيم',
      'قيد التنفيذ',
      'تم التنفيذ',
      'منفذ',
      'في المونتاج',
      'تم المونتاج',
      'يجب إعادة المونتاج',
      'وصل للمتبرع',
      'منتهي',
    ];
    return supplyAndLaterStatuses.includes(status);
  };

  // ✅ دالة لنقل المشروع إلى "قيد التوريد" مع تحويل للشيكل (لمنسق المشروع)
  const handleTransferToSupply = async (project) => {
    const isInSupplyOrLater = isInSupplyOrLaterStatus(project.status);

    // ✅ إذا كان المشروع في حالة توريد أو لاحقة، افتح صفحة التوريد مباشرة
    if (isInSupplyOrLater) {
      // ✅ تأكيد أن المشروع محول للشيكل قبل الدخول لمرحلة التوريد
      const needsShekelConversion = !project?.shekel_exchange_rate;
      if (needsShekelConversion) {
        toast.error('يجب تحويل المبلغ للشيكل أولاً قبل الدخول إلى مرحلة التوريد');
        setSupplyProject(project);
        setExchangeRate('');
        setTransferDiscountPercentage(0);
        setShowShekelModal(true);
        return;
      }

      navigate(`/project-management/projects/${project.id}/supply`);
      return;
    }

    // ✅ إذا كان المشروع في حالة "جديد"
    if (project.status === 'جديد') {
      // ✅ التحقق من أن المشروع محول للشيكل
      const needsShekelConversion = !project?.shekel_exchange_rate;

      if (needsShekelConversion) {
        // ✅ فتح modal التحويل للشيكل أولاً
        setSupplyProject(project);
        setExchangeRate('');
        setTransferDiscountPercentage(0);
        setShowShekelModal(true);

        // ✅ بعد التحويل، سننقل المشروع للتوريد تلقائياً
        // سنستخدم callback في handleConvertToShekel
        return;
      }

      // ✅ إذا كان محولاً للشيكل، نقل المشروع للتوريد مباشرة
      if (!window.confirm('هل أنت متأكد من نقل المشروع لمرحلة التوريد؟')) {
        return;
      }

      try {
        // ✅ نقل المشروع إلى "قيد التوريد"
        const response = await apiClient.post(`/project-proposals/${project.id}/move-to-supply`);

        if (response.data.success) {
          toast.success(response.data.message || 'تم نقل المشروع لمرحلة التوريد بنجاح');

          // ✅ تحديث حالة المشروع محلياً
          const updatedProject = {
            ...project,
            status: 'قيد التوريد',
          };

          // ✅ إبطال الكاش
          window.dispatchEvent(new CustomEvent('cache-invalidated', { detail: { cacheKey: 'project-proposals' } }));
          fetchProjects({ forceRefresh: true });

          // ✅ الانتقال إلى صفحة التوريد
          navigate(`/project-management/projects/${project.id}/supply`);
        } else {
          toast.error(response.data.message || 'فشل نقل المشروع');
        }
      } catch (error) {
        console.error('Error transferring to supply:', error);
        toast.error(error.response?.data?.message || 'حدث خطأ أثناء نقل المشروع');
      }
    }
  };

  const handleOpenSupplyModal = (project) => {
    setSupplyProject(project);
    setSupplyModalOpen(true);
  };

  const handleOpenBeneficiariesModal = (project) => {
    setSelectedProject(project);
    setShowBeneficiariesModal(true);
  };

  const handleProjectImagesClick = (project) => {
    setNoteImagesModalProject(project);
    setNoteImagesModalImages([]);
    setNoteImagesModalLoading(true);
    setNoteImagesModalOpen(true);

    // Fetch images
    const fetchImages = async () => {
      try {
        const response = await apiClient.get(`/project-proposals/${project.id}/note-images`);
        if (response.data.success) {
          setNoteImagesModalImages(response.data.images || []);
        }
      } catch (error) {
        console.error('Error fetching project images:', error);
        toast.error('حدث خطأ أثناء جلب الصور');
      } finally {
        setNoteImagesModalLoading(false);
      }
    };

    fetchImages();
  };

  const handleDownloadProjectImage = async (project) => {
    try {
      // Fetch the image from the API
      const response = await apiClient.get(`/project-proposals/${project.id}/image`, {
        responseType: 'blob'
      });

      // Check if response is an error (404 or other errors)
      if (response.status === 404) {
        toast.error('لا توجد صورة لهذا المشروع');
        return;
      }

      if (!response.data || response.data.size === 0) {
        toast.error('الصورة غير متاحة للتحميل');
        return;
      }

      // Create blob URL and download
      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'image/jpeg' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `project_${project.id}_image.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('تم تحميل الصورة بنجاح');
    } catch (error) {
      console.error('Error downloading image:', error);
      if (error.response?.status === 404) {
        toast.error('لا توجد صورة لهذا المشروع');
      } else {
        toast.error('حدث خطأ أثناء تحميل الصورة');
      }
    }
  };

  const handleDeleteClick = (project) => {
    setProjectToDelete(project);
  };

  const handleClearAssignedTeam = (projectId) => {
    if (!window.confirm('هل أنت متأكد من مسح تعيين الفريق؟')) {
      return;
    }

    setClearingAssignmentId(projectId);
    apiClient.delete(`/project-proposals/${projectId}/assignment`)
      .then(response => {
        if (response.data.success) {
          toast.success('تم مسح التعيين بنجاح');
          fetchProjects({ forceRefresh: true });
        } else {
          toast.error(response.data.message || 'فشل مسح التعيين');
        }
      })
      .catch(error => {
        console.error('Error clearing assignment:', error);
        toast.error('حدث خطأ أثناء مسح التعيين');
      })
      .finally(() => {
        setClearingAssignmentId(null);
      });
  };

  const canEditAssignment = (project) => {
    return isAdmin || isProjectManager;
  };

  const canPostponeProject = (project) => {
    return isAdmin || isProjectManager || isExecutedCoordinator;
  };

  const handleStatusClick = (project, action) => {
    setSelectedProjectForStatusUpdate(project);
    setExecutionStatusAction(action);
    setShowExecutionStatusModal(true);
  };

  // Filter handlers
  const handleFilterChange = (key, value) => {
    // Invalidate cache when filters change to ensure fresh data
    clearCache();
    
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to page 1 when filters change
    }));
  };

  const clearFilters = () => {
    // Clear cache when resetting filters
    clearCache();
    
    setFilters({
      status: [],
      project_type: [],
      searchQuery: '',
      page: 1,
      perPage: 'all',
      phase_day: '',
      parent_project_id: '',
      subcategory_id: [],
      researcher_id: '',
      photographer_id: '',
      producer_id: '',
      month_number: '',
      show_delayed_only: false,
      show_divided_parents_only: false,
      show_urgent_only: false,
      show_sub_projects_only: false,
    });
    setSearchInput('');
  };

  const handleSearchChange = (e) => {
    // Extract value from event object or handle direct string value
    const value = e && e.target ? e.target.value : e;
    
    // Ensure value is always a string
    const stringValue = (value || '').toString();
    setSearchInput(stringValue);
    
    // Clear any existing timeout
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId);
      setSearchTimeoutId(null);
    }
  };

  const handleSearchSubmit = (e) => {
    // Only prevent default and submit search when Enter key is pressed
    if (e && e.key === 'Enter') {
      e.preventDefault();
      setFilters(prev => ({
        ...prev,
        searchQuery: (searchInput || '').toString().trim(),
        page: 1,
      }));
    }
  };

  const handleSearchButtonClick = () => {
    setFilters(prev => ({
      ...prev,
      searchQuery: (searchInput || '').toString().trim(),
      page: 1,
    }));
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        key,
        direction: 'asc',
      };
    });
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage,
    }));
  };

  const handlePerPageChange = (newPerPage) => {
    setFilters(prev => ({
      ...prev,
      perPage: newPerPage,
      page: 1,
    }));
  };

  // Get today's label in Arabic
  const getTodayLabel = () => {
    const today = new Date();
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${days[today.getDay()]}, ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
  };

  // ✅ قائمة جميع الأعمدة المتاحة للتصدير
  const availableColumns = [
    { key: 'serial_number', label: 'كود المشروع', default: true },
    { key: 'project_name', label: 'اسم المشروع', default: true },
    { key: 'project_description', label: 'وصف المشروع', default: true },
    { key: 'project_type', label: 'نوع المشروع', default: true },
    { key: 'status', label: 'الحالة', default: true },
    { key: 'donor_name', label: 'اسم المتبرع', default: true },
    { key: 'donor_code', label: 'كود المتبرع', default: true },
    { key: 'quantity', label: 'العدد', default: true },
    { key: 'beneficiaries_count', label: 'عدد المستفيدين', default: false },
    { key: 'team_name', label: 'اسم الفريق', default: true },
    { key: 'shelter_name', label: 'اسم المخيم', default: false },
    { key: 'shelter_address', label: 'عنوان المخيم', default: false },
    { key: 'execution_date', label: 'تاريخ التنفيذ', default: false },
    { key: 'created_at', label: 'تاريخ الإنشاء', default: false },
    { key: 'updated_at', label: 'تاريخ التحديث', default: false },
    { key: 'notes', label: 'الملاحظات', default: false },
    { key: 'photographer_name', label: 'اسم المصور', default: true },
    { key: 'researcher_name', label: 'اسم الباحث', default: true },
    { key: 'cost', label: 'التكلفة', default: true },
    { key: 'supply_cost_shekel', label: 'تكلفة التوريد بالشيكل', default: true },
    { key: 'net_amount_usd', label: 'المبلغ الصافي بالدولار', default: false },
    { key: 'net_amount_shekel_after_supply', label: 'المبلغ بالشيكل بعد التوريد', default: false },
    { key: 'deficit_surplus_status', label: 'حالة العجز/الفائض', default: false },
    { key: 'deficit_surplus_amount', label: 'قيمة العجز/الفائض', default: false },
    { key: 'priority', label: 'الأولوية', default: false },
    { key: 'is_daily_phase', label: 'مشروع يومي', default: false },
    { key: 'is_divided_into_phases', label: 'مقسم إلى مراحل', default: false },
    { key: 'phase_duration_days', label: 'مدة المرحلة (أيام)', default: false },
    { key: 'phase_start_date', label: 'تاريخ بداية المرحلة', default: false },
  ];

  // Initialize selectedColumns with default columns after availableColumns is defined
  useEffect(() => {
    const defaultCols = availableColumns.filter(col => col.default).map(col => col.key);
    console.log('🎯 Default columns to select:', defaultCols);
    console.log('🎯 Available columns:', availableColumns);
    setSelectedColumns(defaultCols);
  }, []); // Remove dependency to prevent infinite loop

  // Export functions - backend exports all 29 columns fixed, so we don't need columns parameter
  const toggleColumn = (columnKey) => {
    setSelectedColumns(prev =>
      prev.includes(columnKey)
        ? prev.filter(key => key !== columnKey)
        : [...prev, columnKey]
    );
  };

  const toggleAllColumns = () => {
    const allKeys = availableColumns.map(col => col.key);
    setSelectedColumns(prev =>
      prev.length === allKeys.length ? [] : allKeys
    );
  };

  const resetExportFilters = () => {
    setExportFilters({
      status: [],
      project_type: [],
      researcher_id: '',
      photographer_id: '',
      team_id: '',
      shelter_id: '',
      governorate_id: '',
      district_id: '',
    });
    setSelectedColumns([]);
  };

  const handleConfirmExport = async () => {
    console.log(' Starting export with filters:', exportFilters);
    console.log(' Selected columns:', selectedColumns);
    
    // Check if any images are selected (assuming this is for image export)
    // If this is for Excel export, remove this check
    const hasSelectedImages = selectedColumns.length > 0; // or check specific image-related columns
    
    if (!hasSelectedImages) {
      toast.error('يرجى اختيار الصور للتصدير');
      return;
    }
    
    // Backend exports all 29 columns fixed, so no need to validate selected columns
    
    setIsDownloading(true);
    try {
      // محاولة استخدام API endpoint مخصص للتصدير أولاً (إذا كان متوفراً)
      // إذا لم يكن متوفراً، نستخدم الطريقة الحالية (جلب البيانات وإنشاء Excel في Frontend)
      let useExportEndpoint = true; // تفعيل استخدام endpoint للتصدير

      if (useExportEndpoint) {
        try {
          console.log('🚀 Starting export with filters:', exportFilters);
          console.log('📊 Selected columns:', selectedColumns);
          
          // ✅ استخدام API endpoint مخصص للتصدير
          const exportResponse = await apiClient.get('/project-proposals/export', {
            params: {
              statuses: exportFilters.status,
              project_type: exportFilters.project_type,
              start_date: exportFilters.startDate,
              end_date: exportFilters.endDate,
              team_id: exportFilters.team_id,
              photographer_id: exportFilters.photographer_id,
              shelter_id: exportFilters.shelter_id,
              governorate: exportFilters.governorate,
              district: exportFilters.district,
              donor_name: exportFilters.donor_name,
              donor_code: exportFilters.donor_code,
              quantity_min: exportFilters.quantity_min,
              quantity_max: exportFilters.quantity_max,
              cost_min: exportFilters.cost_min,
              cost_max: exportFilters.cost_max,
              created_at_start: exportFilters.created_at_start,
              created_at_end: exportFilters.created_at_end,
              updated_at_start: exportFilters.updated_at_start,
              updated_at_end: exportFilters.updated_at_end,
              _t: Date.now(),
            },
            paramsSerializer: paramsSerializer,
            responseType: 'blob', // ✅ مهم: يجب أن يكون blob لتحميل الملف
            headers: {
              'Cache-Control': 'no-cache',
              'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
          });

          console.log('📥 Export response status:', exportResponse.status);
          console.log('📥 Export response headers:', exportResponse.headers);
          console.log('📥 Export response data type:', typeof exportResponse.data);
          
          // ✅ تحميل الملف مباشرة من الـ API
          const blob = new Blob([exportResponse.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;

          // ✅ الحصول على اسم الملف من الـ headers
          const contentDisposition = exportResponse.headers['content-disposition'];
          let filename = 'project_proposals_export.xlsx';
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1].replace(/['"]/g, '');
            }
          }

          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(downloadUrl);

          toast.success('تم تحميل ملف Excel بنجاح!');
          setIsExportFilterModalOpen(false);
          return;
        } catch (exportError) {
          // ✅ إذا فشل استخدام API endpoint للتصدير، نستخدم الطريقة الحالية
          if (import.meta.env.DEV) {
            console.warn('⚠️ Export endpoint not available, using fallback method:', exportError);
          }
        }
      }

      // ✅ الطريقة الحالية: جلب البيانات وإنشاء Excel في Frontend
      let projectsToExport = [];

      // جلب المشاريع مع الفلاتر المحددة
      const params = {
        per_page: 1000, // Reduced from 10000 to prevent memory exhaustion
      };

      // Send individual filter parameters
      if (exportFilters.status && Array.isArray(exportFilters.status) && exportFilters.status.length > 0) {
        params.status = exportFilters.status;
      }
      if (exportFilters.project_type && Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0) {
        params.project_type = exportFilters.project_type;
      }
      if (exportFilters.startDate) {
        params.start_date = exportFilters.startDate;
      }
      if (exportFilters.endDate) {
        params.end_date = exportFilters.endDate;
      }
      if (exportFilters.team_id) {
        params.team_id = exportFilters.team_id;
      }
      if (exportFilters.photographer_id) {
        params.photographer_id = exportFilters.photographer_id;
      }
      if (exportFilters.shelter_id) {
        params.shelter_id = exportFilters.shelter_id;
      }
      if (exportFilters.governorate) {
        params.governorate = exportFilters.governorate;
      }
      if (exportFilters.district) {
        params.district = exportFilters.district;
      }
      if (exportFilters.donor_name) {
        params.donor_name = exportFilters.donor_name;
      }
      if (exportFilters.donor_code) {
        params.donor_code = exportFilters.donor_code;
      }
      if (exportFilters.quantity_min) {
        params.quantity_min = exportFilters.quantity_min;
      }
      if (exportFilters.quantity_max) {
        params.quantity_max = exportFilters.quantity_max;
      }
      if (exportFilters.cost_min) {
        params.cost_min = exportFilters.cost_min;
      }
      if (exportFilters.cost_max) {
        params.cost_max = exportFilters.cost_max;
      }
      if (exportFilters.created_at_start) {
        params.created_at_start = exportFilters.created_at_start;
      }
      if (exportFilters.created_at_end) {
        params.created_at_end = exportFilters.created_at_end;
      }
      if (exportFilters.updated_at_start) {
        params.updated_at_start = exportFilters.updated_at_start;
      }
      if (exportFilters.updated_at_end) {
        params.updated_at_end = exportFilters.updated_at_end;
      }

      // Add columns parameter
      params.columns = selectedColumns;

      // Handle multiple statuses with separate requests
      if (Array.isArray(params.status) && params.status.length > 0) {
        try {
          // Send separate requests for each status then merge results
          const statusPromises = params.status.map(status => {
            const { status: _, ...otherParams } = params;
            const singleStatusParams = {
              ...otherParams,
              status: status
            };

            return apiClient.get('/project-proposals', {
              params: {
                ...singleStatusParams,
                _t: Date.now(),
                include_all_statuses: true,
                include_finished: true,
              },
              headers: {
                'Cache-Control': 'no-cache',
              }
            }).catch(error => {
              if (import.meta.env.DEV) {
                console.warn(`⚠️ فشل جلب المشاريع للحالة "${status}":`, {
                  status,
                  error: error?.response?.data || error?.message || error,
                  statusCode: error?.response?.status,
                  responseData: error?.response?.data,
                });
              }
              return { data: { success: false, projects: [], data: [] } };
            });
          });

          const statusResponses = await Promise.all(statusPromises);

          // Merge all projects from all statuses
          const allProjects = [];
          const projectIds = new Set();

          statusResponses.forEach((statusResponse, index) => {
            const responseData = statusResponse?.data;
            let statusProjects = [];

            if (responseData) {
              if (responseData.success) {
                statusProjects = responseData.projects || responseData.data || [];
              } else if (responseData.projects) {
                statusProjects = Array.isArray(responseData.projects) ? responseData.projects : [];
              } else if (responseData.data) {
                statusProjects = Array.isArray(responseData.data) ? responseData.data : [];
              }
            }

            statusProjects.forEach(project => {
              if (!project) return;
              const projectId = project.id || project._id;
              if (projectId) {
                if (!projectIds.has(projectId)) {
                  projectIds.add(projectId);
                  allProjects.push(project);
                }
              } else {
                allProjects.push(project);
              }
            });
          });

          if (allProjects.length > 0) {
            projectsToExport = allProjects.map(project => normalizeProjectRecord(project));
          } else {
            const statusesText = params.status.join(' و ');
            toast.warning(`لا توجد مشاريع للتصدير تطابق المعايير المحددة (الحالات: ${statusesText})`);
            setIsDownloading(false);
            return;
          }
        } catch (separateRequestsError) {
          console.error('Error in separate requests method:', separateRequestsError);
          toast.error('حدث خطأ أثناء جلب البيانات للتصدير');
          setIsDownloading(false);
          return;
        }
      } else {
        // Single status or no status - use normal method
        const response = await apiClient.get('/project-proposals', {
          params: {
            ...params,
            _t: Date.now(),
            include_all_statuses: true,
            include_finished: true,
          },
          headers: {
            'Cache-Control': 'no-cache',
          }
        });

        let rawProjects = [];
        if (response.data) {
          if (response.data.success) {
            rawProjects = response.data.projects || response.data.data || [];
          } else if (response.data.projects) {
            rawProjects = Array.isArray(response.data.projects) ? response.data.projects : [];
          } else if (response.data.data) {
            rawProjects = Array.isArray(response.data.data) ? response.data.data : [];
          }
        }

        if (rawProjects.length === 0) {
          toast.warning('لا توجد مشاريع للتصدير تطابق المعايير المحددة');
          setIsDownloading(false);
          return;
        }

        projectsToExport = rawProjects.map(project => normalizeProjectRecord(project));
      }

      // Prepare Excel data
      const columnsToExport = selectedColumns.length > 0
        ? selectedColumns
        : availableColumns.filter(col => col.default).map(col => col.key);

      const excelData = projectsToExport.map(project => {
        const row = {};

        columnsToExport.forEach(columnKey => {
          const column = availableColumns.find(col => col.key === columnKey);
          if (!column) return;

          let value = '-';
          switch (columnKey) {
            case 'serial_number':
              value = project.serial_number || project.id?.toString() || '-';
              break;
            case 'project_name':
              value = project.project_name || '-';
              break;
            case 'project_description':
              const desc = project.project_description || '';
              value = desc ? (desc.length > 500 ? desc.substring(0, 500) + '...' : desc) : '-';
              break;
            case 'project_type':
              value = project.project_type || '-';
              break;
            case 'status':
              value = project.status || '-';
              break;
            case 'donor_name':
              value = project.donor_name || '-';
              break;
            case 'donor_code':
              value = project.donor_code || '-';
              break;
            case 'quantity':
              const quantityValue = project.quantity || project.total_quantity || null;
              if (quantityValue !== null && quantityValue !== undefined && quantityValue !== '') {
                const numValue = Number(quantityValue);
                value = Number.isFinite(numValue) ? numValue : '-';
              } else if (quantityValue === 0) {
                value = 0;
              } else {
                value = '-';
              }
              break;
            case 'beneficiaries_count':
              value = project.beneficiaries_count !== null && project.beneficiaries_count !== undefined && project.beneficiaries_count !== ''
                ? project.beneficiaries_count
                : project.calculated_beneficiaries || '-';
              break;
            case 'team_name':
              value = project.assigned_to_team?.team_name ||
                project.assigned_team?.team_name ||
                project.team?.team_name ||
                project.team_name || '-';
              break;
            case 'shelter_name':
              value = project.shelter?.camp_name ||
                project.shelter?.name ||
                project.shelter_name || '-';
              break;
            case 'execution_date':
              if (project.execution_date) {
                try {
                  const date = new Date(project.execution_date);
                  value = !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '-';
                } catch (e) {
                  value = '-';
                }
              } else {
                value = '-';
              }
              break;
            case 'created_at':
              if (project.created_at) {
                try {
                  const date = new Date(project.created_at);
                  value = !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '-';
                } catch (e) {
                  value = '-';
                }
              } else {
                value = '-';
              }
              break;
            case 'notes':
              const notes = project.notes || '';
              value = notes ? (notes.length > 1000 ? notes.substring(0, 1000) + '...' : notes) : '-';
              break;
            default:
              value = project[columnKey] || '-';
          }

          row[column.label] = value;
        });

        return row;
      });

      // Create Excel file
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('المشاريع');
      const keys = excelData.length ? Object.keys(excelData[0]) : [];
      worksheet.columns = keys.map((k, i) => ({ header: k, key: k, width: 15 }));
      worksheet.addRows(excelData);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const filename = `مشاريع_${year}${month}${day}`;

      try {
        await downloadWorkbookAsFile(workbook, `${filename}.xlsx`);
        toast.success(`تم تحميل ملف Excel بنجاح! (${projectsToExport.length} مشروع)`);
        setIsExportFilterModalOpen(false);
      } catch (downloadError) {
        console.error('Error downloading Excel file:', downloadError);
        
        // Fallback: Create blob and download directly
        try {
          const buffer = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          toast.success(`تم تحميل ملف Excel بنجاح! (${projectsToExport.length} مشروع)`);
          setIsExportFilterModalOpen(false);
        } catch (fallbackError) {
          console.error('Fallback download also failed:', fallbackError);
          toast.error('حدث خطأ أثناء تحميل الملف');
        }
      }
    } catch (error) {
      console.error('Error exporting projects:', error);
      toast.error('حدث خطأ أثناء التصدير');
    } finally {
      setIsDownloading(false);
    }
  };

  // Filtered subcategories based on selected project types
  const filteredSubcategories = useMemo(() => {
    // إذا لم يتم اختيار أي نوع مشروع، نعرض كل التفريعات
    if (!Array.isArray(filters.project_type) || filters.project_type.length === 0) {
      return subcategories;
    }

    // تصفية التفريعات لتظهر فقط التي تنتمي لأنواع المشاريع المختارة
    return subcategories.filter(subcategory =>
      filters.project_type.includes(subcategory.project_type)
    );
  }, [subcategories, filters.project_type]);

  // ✅ Efficient fetchProjects function like orphan system
  const fetchProjects = useCallback(async (options = {}) => {
    const { skipLoading = false, forceRefresh = false } = options;

    // ✅ التحقق من Cache أولاً مثل نظام الأيتام
    const filtersKey = JSON.stringify(filters);
    if (!forceRefresh && isCacheValid(filtersKey)) {
      const cachedData = getData();
      if (cachedData) {
        setProjects(cachedData.projects || []);
        if (!skipLoading) {
          setLoading(false);
        }
        if (import.meta.env.DEV) {
          console.log('✅ Using cached projects data like orphan system');
        }
        return;
      }
    }

    // ✅ إلغاء الطلب السابق فقط إذا كان موجوداً ومشتغلاً مثل نظام الأيتام
    if (abortControllerRef.current && fetchInProgressRef.current) {
      if (import.meta.env.DEV) {
        console.log('🚫 Canceling previous request');
      }
      abortControllerRef.current.abort();
    }

    // ✅ إنشاء AbortController جديد مثل نظام الأيتام
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // ✅ التحقق من أن المكون لا يزال mounted قبل المتابعة
    if (!isMountedRef.current) {
      return;
    }

    fetchInProgressRef.current = true;

    if (!skipLoading) {
      setLoading(true);
    }

    let loadingTimeout;
    
    // ✅ إيقاف حالة التحميل بعد timeout (30 ثانية) مثل نظام الأيتام
    loadingTimeout = setTimeout(() => {
      if (!skipLoading) {
        setLoading(false);
      }
      const cachedData = getData();
      if (!cachedData) {
        setProjects([]);
      }
      if (import.meta.env.DEV) {
        console.warn('⏱️ Request timeout after 30 seconds');
      }
    }, 30000);

    try {
      // ✅ إنشاء params من filters مثل نظام الأيتام
      const params = {};
      Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (value !== '' && value !== null && value !== undefined) {
          if (key === 'perPage' && (value === 'all' || value === 'الكل')) {
            params.per_page = 1000;
            params.perPage = 1000;
          } else if (key === 'perPage') {
            const perPageNum = typeof value === 'number' ? value : parseInt(value);
            if (!isNaN(perPageNum) && perPageNum > 0) {
              params.per_page = perPageNum;
              params.perPage = perPageNum;
            }
          } else if (key === 'status' && Array.isArray(value) && value.length > 0) {
            params.status = value.join(',');
          } else if (key === 'project_type' && Array.isArray(value) && value.length > 0) {
            params.project_type = value.join(',');
          } else {
            params[key] = value;
          }
        }
      });

      if (import.meta.env.DEV) {
        console.log('📡 Making API request to /project-proposals with params:', params);
      }

      const response = await apiClient.get('/project-proposals', {
        params: { ...params, _t: Date.now() },
        timeout: 30000,
        signal: abortController.signal
      });

      if (loadingTimeout) clearTimeout(loadingTimeout);

      // ✅ التحقق من أن المكون لا يزال mounted قبل تحديث الحالة
      if (!isMountedRef.current) {
        return;
      }

      if (response.data?.success && Array.isArray(response.data.projects)) {
        const normalizedProjects = response.data.projects.map((item) => normalizeProjectRecord(item));
        
        // ✅ حفظ البيانات في cache مثل نظام الأيتام
        setCachedData({
          projects: normalizedProjects
        }, filtersKey);

        setProjects(normalizedProjects);
        if (!skipLoading) {
          setLoading(false);
        }

        if (import.meta.env.DEV) {
          console.log('✅ Projects data received:', {
            count: normalizedProjects.length
          });
        }
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      
      // ✅ تجاهل خطأ الإلغاء بشكل أنيق مثل نظام الأيتام
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        if (import.meta.env.DEV) {
          console.log('🚫 Request was canceled - this is normal behavior');
        }
        // Don't set error state for canceled requests
        return;
      }
      
      console.error('❌ Error fetching projects:', error);
      if (!skipLoading) {
        setLoading(false);
      }
      setProjects([]);
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [filters, isCacheValid, getData, setCachedData]);

  // ✅ Fetch projects on component mount and when dependencies change
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ✅ Render
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 p-4 relative" style={{ fontFamily: 'Cairo, Tajawal, Arial, sans-serif', fontWeight: 400 }}>
      <PageLoader isLoading={loading} />
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 rounded-2xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-4 right-4 w-24 h-24 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-4 left-4 w-32 h-32 bg-white rounded-full blur-3xl"></div>
          </div>
          <div className="relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2 drop-shadow-lg" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                  {isFinishedProjectsPage ? 'المشاريع المنتهية' : 'إدارة المشاريع'}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sky-100">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg">
                    <FileText className="w-4 h-4" />
                    <span className="font-semibold text-sm" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>إجمالي: {visibleProjects.length} مشروع</span>
                  </div>
                  {isProjectManager && (
                    <div className="flex items-center gap-2 bg-purple-500/30 backdrop-blur-md px-3 py-1.5 rounded-lg border border-purple-300/30">
                      <span className="text-xs font-medium">
                        عرض: المشاريع غير المقسمة + اليوم الحالي و 3 أيام قادمة
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-sky-200 font-medium mt-2 flex items-center gap-1" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
                  <span>📅</span>
                  {getTodayLabel()}
                </p>
              </div>
              {!isOrphanSponsorCoordinator && (
                <div className="flex gap-2 flex-wrap">
                  <Link
                    to="/project-management/reports"
                    className="bg-white/20 backdrop-blur-md hover:bg-white/30 border-2 border-white/30 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}
                  >
                    <FileText className="w-4 h-4" />
                    التقارير
                  </Link>
                  <button
                    onClick={() => setIsExportFilterModalOpen(true)}
                    disabled={isDownloading || visibleProjects.length === 0}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                    style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}
                  >
                    <Download className="w-4 h-4" />
                    {isDownloading ? 'جاري التحميل...' : 'تصدير Excel'}
                  </button>
                  <Link
                    to="/project-management/projects/new"
                    className="bg-white text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}
                  >
                    <Plus className="w-4 h-4" />
                    إنشاء مشروع جديد
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <ProjectFilters
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          filters={filters}
          handleFilterChange={handleFilterChange}
          clearFilters={clearFilters}
          handleSearchChange={handleSearchChange}
          handleSearchSubmit={handleSearchSubmit}
          handleSearchButtonClick={handleSearchButtonClick}
          searchInput={searchInput}
          projectTypes={availableProjectTypes}
          projectTypesLoading={projectTypesLoading}
          filteredSubcategories={filteredSubcategories}
          subcategoriesLoading={subcategoriesLoading}
          researchers={researchers}
          photographers={photographers}
          producers={producers}
          loadingFilterLists={loadingFilterLists}
          parentProjectOptions={parentProjectOptions}
          isOrphanSponsorCoordinator={isOrphanSponsorCoordinator}
          isProjectManager={isProjectManager}
          isMediaManager={normalizedRole === 'media_manager' || normalizedRole === 'مدير الإعلام' || normalizedRole === 'مسؤول الإعلام'}
          isAdmin={isAdmin}
          showStatusDropdown={showStatusDropdown}
          setShowStatusDropdown={setShowStatusDropdown}
          showProjectTypeDropdown={showProjectTypeDropdown}
          setShowProjectTypeDropdown={setShowProjectTypeDropdown}
          showSubcategoryDropdown={showSubcategoryDropdown}
          setShowSubcategoryDropdown={setShowSubcategoryDropdown}
          showMonthlyPhasesHelp={showMonthlyPhasesHelp}
          setShowMonthlyPhasesHelp={setShowMonthlyPhasesHelp}
          PROJECT_STATUSES={PROJECT_STATUSES}
        />

        {/* Execution Alerts for Coordinators */}
        {isExecutedCoordinator && (
          <ExecutionAlerts
            readyForExecutionProjects={readyForExecutionProjects}
            projectsSupplyData={projectsSupplyData}
            handleOpenShelterModal={handleOpenShelterModal}
            handleTransferToExecution={handleTransferToExecution}
            getProjectCode={getProjectCode}
            getProjectDescription={getProjectDescription}
          />
        )}

        {/* Projects Table */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <EmptyState filters={filters} loading={loading} paginatedProjects={paginatedProjects} />
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <TableHeaders
                    isAdmin={isAdmin}
                    isMediaManager={normalizedRole === 'media_manager' || normalizedRole === 'مدير الإعلام' || normalizedRole === 'مسؤول الإعلام'}
                    isProjectManager={isProjectManager}
                    isExecutedCoordinator={isExecutedCoordinator}
                    isOrphanSponsorCoordinator={isOrphanSponsorCoordinator}
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                  />
                </thead>
                <tbody>
                  {paginatedProjects.map((project) => {
                    const netAmount = calculateDailyAmount(project) || 
                      getNumericValue(project?.net_amount) ||
                      getNumericValue(project?.net_amount_usd) ||
                      getNumericValue(project?.netAmount) ||
                      getNumericValue(project?.netAmountUsd) ||
                      0;
                    return (
                      <ProjectTableRow
                        key={project.id}
                        project={project}
                        isAdmin={isAdmin}
                        isMediaManager={normalizedRole === 'media_manager' || normalizedRole === 'مدير الإعلام' || normalizedRole === 'مسؤول الإعلام'}
                        isProjectManager={isProjectManager}
                        isExecutedCoordinator={isExecutedCoordinator}
                        isOrphanSponsorCoordinator={isOrphanSponsorCoordinator}
                        getProjectCode={getProjectCode}
                        getProjectDescription={getProjectDescription}
                        getDivisionTextColor={getDivisionTextColor}
                        getStatusColor={getStatusColor}
                        getRemainingDaysBadge={getRemainingDaysBadge}
                        renderProjectBadges={renderProjectBadges}
                        getSubProjectParentName={getSubProjectParentName}
                        getDisplayMonthNameForProject={getDisplayMonthNameForProject}
                        formatOriginalAmount={formatOriginalAmount}
                        formatCurrency={formatCurrency}
                        handleStatusClick={handleStatusClick}
                        handleProjectImagesClick={handleProjectImagesClick}
                        hasProjectImage={hasProjectImage}
                        handleDeleteClick={handleDeleteClick}
                        deletingProject={deletingProject}
                        handleOpenSupplyModal={handleOpenSupplyModal}
                        handleOpenBeneficiariesModal={handleOpenBeneficiariesModal}
                        handleOpenOrphansModal={handleOpenOrphansModal}
                        handleDownloadProjectImage={handleDownloadProjectImage}
                        canEditAssignment={canEditAssignment}
                        handleOpenShelterModal={handleOpenShelterModal}
                        handleClearAssignedTeam={handleClearAssignedTeam}
                        clearingAssignmentId={clearingAssignmentId}
                        canPostponeProject={canPostponeProject}
                        isPostponing={isPostponing}
                        setPostponingProjectId={setPostponingProjectId}
                        setShowPostponeModal={setShowPostponeModal}
                        handleResumeProject={handleResumeProject}
                        formatDate={formatDate}
                        calculateDailyAmount={calculateDailyAmount}
                        netAmount={netAmount}
                        setSelectedProject={setSelectedProject}
                        setAssignModalOpen={setAssignModalOpen}
                        handleTransferToExecution={handleTransferToExecution}
                        transferringToExecution={transferringToExecution}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <ProjectPagination
              visibleProjects={visibleProjects}
              filters={filters}
              sortConfig={sortConfig}
              handlePageChange={handlePageChange}
              handlePerPageChange={handlePerPageChange}
            />
          </>
        </div>
      </div>

      {/* Modals */}
      <NoteImagesModal
        noteImagesModalOpen={noteImagesModalOpen}
        setNoteImagesModalOpen={setNoteImagesModalOpen}
        noteImagesModalProject={noteImagesModalProject}
        setNoteImagesModalProject={setNoteImagesModalProject}
        noteImagesModalImages={noteImagesModalImages}
        setNoteImagesModalImages={setNoteImagesModalImages}
        noteImagesModalLoading={noteImagesModalLoading}
        getImageBaseUrl={getImageBaseUrl}
      />

      {selectedProject && assignModalOpen && (
        <AssignProjectModal
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedProject(null);
          }}
          projectId={selectedProject.id}
          project={selectedProject}
          onSuccess={() => {
            fetchProjects();
            setAssignModalOpen(false);
            setSelectedProject(null);
          }}
        />
      )}

      {selectedProject && selectShelterModalOpen && (
        <SelectShelterModal
          isOpen={selectShelterModalOpen}
          projectId={selectedProject.id}
          onClose={() => {
            setSelectShelterModalOpen(false);
            setSelectedProject(null);
          }}
          onSuccess={() => {
            fetchProjects();
            setSelectShelterModalOpen(false);
            setSelectedProject(null);
          }}
        />
      )}

      {selectedProject && addOrphansModalOpen && (
        <AddOrphansModal
          isOpen={addOrphansModalOpen}
          onClose={() => {
            setAddOrphansModalOpen(false);
            setSelectedProject(null);
          }}
          projectId={selectedProject.id}
          project={selectedProject}
          onSuccess={() => {
            fetchProjects();
            window.dispatchEvent(new CustomEvent('cache-invalidated', { detail: { cacheKey: 'project-proposals' } }));
          }}
        />
      )}

      <ExecutionStatusModal
        showExecutionStatusModal={showExecutionStatusModal}
        setShowExecutionStatusModal={setShowExecutionStatusModal}
        selectedProjectForStatusUpdate={selectedProjectForStatusUpdate}
        setSelectedProjectForStatusUpdate={setSelectedProjectForStatusUpdate}
        executionStatusAction={executionStatusAction}
        setExecutionStatusAction={setExecutionStatusAction}
        postponementReason={postponementReason}
        setPostponementReason={setPostponementReason}
        updatingStatus={false}
        isPostponing={isPostponing}
        isResuming={isResuming}
        setIsResuming={setIsResuming}
        setIsPostponing={setIsPostponing}
        postponingProjectId={postponingProjectId}
        setPostponingProjectId={setPostponingProjectId}
        fetchProjects={fetchProjects}
      />

      {isExportFilterModalOpen && (
        <ExportFilterModal
          isExportFilterModalOpen={isExportFilterModalOpen}
          setIsExportFilterModalOpen={setIsExportFilterModalOpen}
          exportFilters={exportFilters}
          setExportFilters={setExportFilters}
          selectedColumns={selectedColumns}
          setSelectedColumns={setSelectedColumns}
          availableColumns={availableColumns}
          loadingFilterData={loadingFilterData}
          teams={teams}
          photographers={photographers}
          shelters={shelters}
          governorates={governorates}
          districts={districts}
          projectTypes={availableProjectTypes}
          handleConfirmExport={handleConfirmExport}
          isDownloading={isDownloading}
          resetFilters={resetExportFilters}
          toggleColumn={toggleColumn}
          toggleAllColumns={toggleAllColumns}
          PROJECT_STATUSES={PROJECT_STATUSES}
          exportStatusDropdownRef={exportStatusDropdownRef}
          showExportStatusDropdown={showExportStatusDropdown}
          setShowExportStatusDropdown={setShowExportStatusDropdown}
          exportProjectTypeDropdownRef={exportProjectTypeDropdownRef}
          showExportProjectTypeDropdown={showExportProjectTypeDropdown}
          setShowExportProjectTypeDropdown={setShowExportProjectTypeDropdown}
        />
      )}

      <BeneficiariesModal
        isOpen={showBeneficiariesModal}
        onClose={() => setShowBeneficiariesModal(false)}
        project={selectedProject}
        beneficiariesCount={beneficiariesCount}
        setBeneficiariesCount={setBeneficiariesCount}
        updatingBeneficiaries={updatingBeneficiaries}
        setUpdatingBeneficiaries={setUpdatingBeneficiaries}
        onSuccess={() => {
          fetchProjects({ forceRefresh: true });
          setShowBeneficiariesModal(false);
        }}
      />

      <ShekelConversionModal
        isOpen={showShekelModal}
        onClose={() => setShowShekelModal(false)}
        project={supplyProject}
        exchangeRate={exchangeRate}
        setExchangeRate={setExchangeRate}
        transferDiscountPercentage={transferDiscountPercentage}
        setTransferDiscountPercentage={setTransferDiscountPercentage}
        convertingToShekel={convertingToShekel}
        setConvertingToShekel={setConvertingToShekel}
        isEditingShekel={isEditingShekel}
        setIsEditingShekel={setIsEditingShekel}
        onSuccess={() => {
          fetchProjects({ forceRefresh: true });
          setShowShekelModal(false);
        }}
      />

      <SupplyModal
        isOpen={supplyModalOpen}
        onClose={() => setSupplyModalOpen(false)}
        project={supplyProject}
        warehouseItems={warehouseItems}
        setWarehouseItems={setWarehouseItems}
        cartItems={cartItems}
        setCartItems={setCartItems}
        projectQuantity={projectQuantity}
        setProjectQuantity={setProjectQuantity}
        loadingWarehouse={loadingWarehouse}
        setLoadingWarehouse={setLoadingWarehouse}
        confirmingSupply={setConfirmingSupply}
        addingItem={setAddingItem}
        warehouseSearchQuery={warehouseSearchQuery}
        setWarehouseSearchQuery={setWarehouseSearchQuery}
        surplusCategories={surplusCategories}
        setSurplusCategories={setSurplusCategories}
        selectedSurplusCategoryId={selectedSurplusCategoryId}
        setSelectedSurplusCategoryId={setSelectedSurplusCategoryId}
        loadingSurplusCategories={loadingSurplusCategories}
        setLoadingSurplusCategories={setLoadingSurplusCategories}
        onSuccess={() => {
          fetchProjects({ forceRefresh: true });
          setSupplyModalOpen(false);
        }}
      />

      <PostponeModal
        isOpen={showPostponeModal}
        onClose={() => setShowPostponeModal(false)}
        project={selectedProject}
        postponementReason={postponementReason}
        setPostponementReason={setPostponementReason}
        isPostponing={isPostponing}
        setIsPostponing={setIsPostponing}
        postponingProjectId={postponingProjectId}
        setPostponingProjectId={setPostponingProjectId}
        onSuccess={() => {
          fetchProjects({ forceRefresh: true });
          setShowPostponeModal(false);
        }}
      />

      <MediaAcceptReplyModals
        acceptModalOpen={acceptModalOpen}
        setAcceptModalOpen={setAcceptModalOpen}
        replyModalOpen={replyModalOpen}
        setReplyModalOpen={setReplyModalOpen}
        notificationToAccept={notificationToAccept}
        setNotificationToAccept={setNotificationToAccept}
        selectedNotification={selectedNotification}
        setSelectedNotification={setSelectedNotification}
        replyForm={replyForm}
        setReplyForm={setReplyForm}
        accepting={accepting}
        setAccepting={setAccepting}
        replying={replying}
        setReplying={setReplying}
        projectNotification={projectNotification}
        setProjectNotification={setProjectNotification}
        onSuccess={() => {
          fetchProjects({ forceRefresh: true });
        }}
      />

      <ConfirmDialog
        isOpen={projectToDelete !== null}
        onClose={() => setProjectToDelete(null)}
        onConfirm={async () => {
          if (!projectToDelete) return;

          setDeletingProject(projectToDelete.id);
          try {
            const response = await apiClient.delete(`/project-proposals/${projectToDelete.id}`);
            if (response.data.success) {
              toast.success('تم حذف المشروع بنجاح');
              fetchProjects({ forceRefresh: true });
            } else {
              toast.error(response.data.message || 'فشل حذف المشروع');
            }
          } catch (error) {
            console.error('Error deleting project:', error);
            toast.error('حدث خطأ أثناء حذف المشروع');
          } finally {
            setDeletingProject(null);
            setProjectToDelete(null);
          }
        }}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف المشروع "${projectToDelete?.project_name}"؟`}
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />
    </div>
  );
};

export default ProjectsList;


