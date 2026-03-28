// section one start here //******************** 
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient, { forceRefreshCache, invalidateCache, getImageBaseUrl } from '../../../utils/axiosConfig';
import { useDebounce } from '../../../hooks/useDebounce';
import { useUpdateExecutionStatus } from '../../../hooks/useUpdateExecutionStatus';
import { useCacheInvalidation } from '../../../hooks/useCacheInvalidation';
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
import { isLateForMedia, isLateForPM } from './utils/ProjectUIHelpers';

/** تفعيل سجلات التصحيح المزعجة في الكونسول (مثلاً Filtered projects) — اتركه false للاستخدام العادي */
const DEBUG_PROJECTS_LIST_VERBOSE = false;

/** تفعيل سجل تصحيح فلترة المراحل (اليومية/الشهرية) — اتركه false للاستخدام العادي */
const DEBUG_PHASE_FILTERING = false;

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj ?? {}, key);

const normalizeProjectRecord = (project = {}) => {
  const normalized = { ...project };
  const rawDaily =
    project?.is_daily_phase ??
    project?.isDailyPhase ??
    project?.isDaily ??
    false;
  const rawDivided =
    project?.is_divided_into_phases ??
    project?.isDividedIntoPhases ??
    false;

  normalized.is_daily_phase = Boolean(rawDaily);
  normalized.is_divided_into_phases = Boolean(rawDivided);
  normalized.phase_duration_days = project?.phase_duration_days ?? project?.phaseDurationDays ?? null;
  normalized.phase_start_date = project?.phase_start_date ?? project?.phaseStartDate ?? null;
  normalized.parent_project_id =
    project?.parent_project_id ??
    project?.parentProjectId ??
    project?.parent_project?.id ??
    null;
  normalized.parent_project = project?.parent_project || project?.parentProject || null;
  normalized.daily_phases = Array.isArray(project?.daily_phases)
    ? project.daily_phases
    : Array.isArray(project?.dailyPhases)
      ? project.dailyPhases
      : [];

  // ✅ تطبيع نوع التقسيم والحقول المرتبطة
  normalized.phase_type = project?.phase_type ?? project?.phaseType ?? null;
  normalized.is_monthly_phase = project?.is_monthly_phase ?? project?.isMonthlyPhase ?? false;
  normalized.total_months = project?.total_months ?? project?.totalMonths ?? project?.parent_project?.total_months ?? null;

  // ✅ تطبيع phase_day للمشاريع اليومية
  normalized.phase_day = project?.phase_day ?? project?.phaseDay ?? null;

  // ✅ تطبيع month_number و month_start_date للمشاريع الشهرية
  // ✅ قراءة month_number من جميع المصادر المحتملة
  normalized.month_number = project?.month_number ??
    project?.monthNumber ??
    (project?.monthly_phase?.month_number) ??
    (project?.monthlyPhase?.month_number) ??
    (project?.parent_project?.month_number) ??
    (project?.parentProject?.month_number) ??
    null;
  normalized.month_start_date = project?.month_start_date ?? project?.monthStartDate ?? null;


  // ✅ تحديد نوع التقسيم تلقائياً إذا لم يكن محدداً
  if (!normalized.phase_type && normalized.is_divided_into_phases) {
    // إذا كان هناك total_months وليس phase_duration_days، فهو شهري
    if (normalized.total_months && !normalized.phase_duration_days) {
      normalized.phase_type = 'monthly';
    }
    // إذا كان هناك phase_duration_days وليس total_months، فهو يومي
    else if (normalized.phase_duration_days && !normalized.total_months) {
      normalized.phase_type = 'daily';
    }
    // إذا كان is_monthly_phase = true، فهو شهري
    else if (normalized.is_monthly_phase) {
      normalized.phase_type = 'monthly';
    }
    // افتراضياً: يومي
    else {
      normalized.phase_type = 'daily';
    }
  }

  normalized.__hasDailyPhaseFlag =
    hasOwn(project, 'is_daily_phase') || hasOwn(project, 'isDailyPhase') || hasOwn(project, 'isDaily');
  normalized.__hasDivisionFlag =
    hasOwn(project, 'is_divided_into_phases') || hasOwn(project, 'isDividedIntoPhases');

  // ✅ تطبيع quantity للتأكد من الحفاظ عليه
  normalized.quantity = project?.quantity ?? project?.total_quantity ?? null;

  // ✅ تطبيع is_urgent للتأكد من الحفاظ عليه (بجميع الصيغ المحتملة)
  normalized.is_urgent = project?.is_urgent === true ||
    project?.is_urgent === 1 ||
    project?.is_urgent === '1' ||
    project?.is_urgent === 'true' ||
    String(project?.is_urgent || '').toLowerCase() === 'true' ||
    Boolean(project?.is_urgent) ||
    false;

  return normalized;
};

const getNumericValue = (value) => {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
};

const calculateDailyAmount = (project) => {
  if (!project?.is_divided_into_phases) return null;
  const days = project?.phase_duration_days || 0;
  if (!days) return null;
  const netAmount =
    getNumericValue(project?.net_amount) ||
    getNumericValue(project?.net_amount_usd) ||
    getNumericValue(project?.netAmount) ||
    getNumericValue(project?.netAmountUsd);
  if (!netAmount) return null;
  return netAmount / days;
};

// ✅ دالة لحساب المبلغ الشهري
const calculateMonthlyAmount = (project) => {
  if (!project?.is_divided_into_phases) return null;

  // ✅ تحديد إذا كان التقسيم شهرياً باستخدام عدة مؤشرات
  const isMonthly =
    project.phase_type === 'monthly' ||
    project.is_monthly_phase === true ||
    (project.total_months && !project.phase_duration_days);

  if (!isMonthly) return null;

  const months = project?.total_months || project?.parent_project?.total_months || 0;
  if (!months) return null;
  const netAmount =
    getNumericValue(project?.net_amount) ||
    getNumericValue(project?.net_amount_usd) ||
    getNumericValue(project?.netAmount) ||
    getNumericValue(project?.netAmountUsd) ||
    getNumericValue(project?.parent_project?.net_amount) ||
    getNumericValue(project?.parent_project?.net_amount_usd);
  if (!netAmount) return null;
  return netAmount / months;
};

// ✅ دالة مساعدة لاستخراج رقم الشهر من المشروع (يدعم جميع الصيغ المحتملة)
const getMonthNumber = (project) => {
  if (!project) return null;

  // ✅ قراءة month_number من جميع المصادر المحتملة
  let monthNumber =
    project.month_number ??
    project.monthNumber ??
    (project.monthly_phase?.month_number) ??
    (project.monthlyPhase?.month_number) ??
    (project.parent_project?.month_number) ??
    (project.parentProject?.month_number) ??
    null;



  // ✅ إذا لم يكن month_number موجوداً مباشرة، نحاول استخراجه من اسم المشروع
  if (!monthNumber && project.project_name) {
    const monthMatch = project.project_name.match(/الشهر\s*(\d+)/i) ||
      project.project_name.match(/month\s*(\d+)/i) ||
      project.project_name.match(/\s+(\d+)\s*$/);
    if (monthMatch && monthMatch[1]) {
      monthNumber = parseInt(monthMatch[1], 10);
    }
  }

  // ✅ التحقق من أن القيمة صحيحة (رقم موجب)
  if (monthNumber !== null && monthNumber !== undefined && monthNumber !== '') {
    const monthNum = parseInt(monthNumber, 10);
    if (!isNaN(monthNum) && monthNum >= 1) {
      return monthNum;
    }
  }


  return null;
};

// ✅ دالة لتحويل رقم الشهر إلى اسم الشهر بالعربية (رقم الشهر التقويمي 1-12)
const getMonthName = (monthNumber) => {
  if (!monthNumber || monthNumber < 1 || monthNumber > 12) {
    return '';
  }

  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  return months[monthNumber - 1];
};

// ✅ اسم الشهر التقويمي لشهر معين من المشروع (من تاريخ البداية): الشهر 1 = شهر البداية، الشهر 2 = الشهر التالي، إلخ.
// مثال: البداية 1/2/2026 (فبراير)، الشهر 2 → مارس
const getCalendarMonthNameForProjectMonth = (phaseStartDate, monthNumber) => {
  if (!phaseStartDate || monthNumber == null) return null;
  try {
    const d = parseLocalDate(phaseStartDate) || new Date(phaseStartDate);
    d.setMonth(d.getMonth() + (Number(monthNumber) - 1));
    return getMonthName(d.getMonth() + 1);
  } catch (e) {
    return null;
  }
};

// ✅ اسم الشهر للعرض في واجهة المشروع الشهري (الشهر 2 = مارس إذا البداية فبراير)
// الأولوية: 1) __display_month_name (محسوب عند بناء القائمة)  2) month_start_date  3) execution_date  4) phase_start_date على الأب  5) تراجع
const getDisplayMonthNameForProject = (project) => {
  const monthNum = getMonthNumber(project);
  if (monthNum == null) return null;
  // 1) اسم شهر محسوب مسبقاً عند إضافة المشروع للقائمة (لمنسق الأيتام)
  if (project?.__display_month_name) return project.__display_month_name;
  // 2) تاريخ بداية الشهر على المشروع الشهري
  const monthStart = project?.month_start_date ?? project?.monthStartDate ?? null;
  if (monthStart) {
    try {
      const d = new Date(monthStart);
      return getMonthName(d.getMonth() + 1);
    } catch (e) { }
  }
  // 3) تاريخ التنفيذ (غالباً يحمل شهر الدفعة)
  const execDate = project?.execution_date ?? project?.executionDate ?? null;
  if (execDate) {
    try {
      const d = new Date(execDate);
      return getMonthName(d.getMonth() + 1);
    } catch (e) { }
  }
  // 4) من المشروع الأصلي: phase_start_date + رقم الشهر
  const parent = project.parent_project ?? project.parentProject;
  const phaseStart = parent?.phase_start_date ?? parent?.phaseStartDate ?? null;
  const nameFromStart = getCalendarMonthNameForProjectMonth(phaseStart, monthNum);
  if (nameFromStart) return nameFromStart;
  // 5) تراجع: حساب من شهر البداية إن وُجد على المشروع
  const projectPhaseStart = project?.phase_start_date ?? project?.phaseStartDate ?? null;
  const fromProjectStart = getCalendarMonthNameForProjectMonth(projectPhaseStart, monthNum);
  if (fromProjectStart) return fromProjectStart;
  return getMonthName(monthNum);
};

// ✅ دالة لاستخراج الشهر الحالي (1-12) - الشهر التقويمي
const getCurrentMonth = () => {
  return new Date().getMonth() + 1; // getMonth() يعطي 0-11، نضيف 1 للحصول على 1-12
};

/** ✅ تحويل تاريخ YYYY-MM-DD أو ISO string إلى Date بتوقيت محلي (تجنب انزياح timezone)
 * execution_date = phase_start_date + (phase_day - 1) أيام
 */
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const s = String(dateStr);
    const datePart = s.split('T')[0];
    const [y, m, d] = datePart.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(dateStr);
    return new Date(y, m - 1, d); // month 0-indexed
  } catch (e) {
    return new Date(dateStr);
  }
};

// ✅ هل اليوم يقع ضمن شهر هذه المرحلة؟ (من month_start_date أو execution_date)
const isTodayInPhaseMonth = (project) => {
  const monthStart = project?.month_start_date ?? project?.monthStartDate ?? null;
  const execDate = project?.execution_date ?? project?.executionDate ?? null;
  const dateStr = monthStart || execDate;
  if (!dateStr) return false;
  try {
    const d = parseLocalDate(dateStr) || new Date(dateStr);
    const today = new Date();
    return today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth();
  } catch (e) {
    return false;
  }
};

// ✅ دالة لحساب "شهر المشروع الحالي" من تاريخ بداية المرحلة (وليس الشهر التقويمي)
// مثال: إذا بدأ المشروع في فبراير، ففي فبراير = الشهر 1، في مارس = الشهر 2، إلخ.
// معادلة: currentProjectMonth = 1 + (عدد الأشهر التقويمية من phase_start_date حتى اليوم)
const getCurrentProjectMonthFromStartDate = (phaseStartDate) => {
  if (!phaseStartDate) return null;
  try {
    const startDate = parseLocalDate(phaseStartDate) || new Date(phaseStartDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    const yearsDiff = today.getFullYear() - startDate.getFullYear();
    const monthsDiff = today.getMonth() - startDate.getMonth();
    const totalMonthsDiff = yearsDiff * 12 + monthsDiff;
    // totalMonthsDiff=0 → أول شهر = 1، totalMonthsDiff=1 → ثاني شهر = 2
    return Math.max(1, totalMonthsDiff + 1);
  } catch (e) {
    return null;
  }
};

// ✅ دالة للتحقق من أن المشروع شهري فرعي
const isMonthlyPhaseProject = (project) => {
  if (!project) return false;

  const isMonthly =
    project.is_monthly_phase === true ||
    project.isMonthlyPhase === true ||
    project.is_monthly_phase === 1 ||
    project.isMonthlyPhase === 1;

  const hasMonthNumber = getMonthNumber(project) !== null;
  const hasParentId =
    project.parent_project_id != null ||
    project.parentProjectId != null ||
    (project.parent_project && project.parent_project.id != null);

  // ✅ المشروع شهري إذا:
  // 1. is_monthly_phase = true وله parent_project_id
  // 2. أو month_number موجود (حتى لو لم يكن parent_project_id موجود - قد يكون في الاسم)
  const result = (isMonthly && hasParentId) || hasMonthNumber;

  return result;
};

// ✅ دالة لفلترة المشاريع الشهرية: عرض فقط المشروع الذي شهره = "شهر المشروع الحالي" (من تاريخ البداية)
// allProjects: القائمة الكاملة لاستخراج المشروع الأصلي و phase_start_date عند الحاجة
const filterProjectsForCurrentMonth = (projects, currentMonthOrCalendarFallback = null, allProjects = null) => {
  if (!Array.isArray(projects)) {
    return [];
  }

  const filtered = projects.filter((project) => {
    if (!isMonthlyPhaseProject(project)) {
      return true; // المشاريع غير الشهرية تظهر دائماً
    }

    const monthNumber = getMonthNumber(project);
    if (monthNumber === null) return false;

    // ✅ استخراج المشروع الأصلي للحصول على phase_start_date
    const parent = project.parent_project ?? project.parentProject ?? (Array.isArray(allProjects) && (project.parent_project_id ?? project.parentProjectId) != null
      ? allProjects.find((p) => (p.id ?? p.project_id) === (project.parent_project_id ?? project.parentProjectId))
      : null);
    const phaseStart = parent?.phase_start_date ?? parent?.phaseStartDate ?? null;
    const currentProjectMonth = getCurrentProjectMonthFromStartDate(phaseStart);

    // ✅ إذا توفر تاريخ البداية (الأب): نعرض فقط المشروع الذي رقم شهره = شهر المشروع الحالي (شهر واحد فقط - لا الشهر القادم)
    if (currentProjectMonth !== null) {
      return monthNumber === currentProjectMonth;
    }

    // ✅ عند عدم توفر تاريخ البداية: نعرض فقط إن كان شهر المرحلة يطابق الشهر التقويمي الحالي (شهر واحد فقط)
    const calendarMonth = currentMonthOrCalendarFallback ?? getCurrentMonth();
    return monthNumber === calendarMonth;
  });

  return filtered;
};

const summarizeDailyPhaseStatuses = (project) => {
  const phases = Array.isArray(project?.daily_phases) ? project.daily_phases : [];
  if (!phases.length) return null;
  return phases.reduce((acc, phase) => {
    const status = phase?.status || 'غير محدد';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
};

// ✅ دالة لتلخيص حالات المشاريع الشهرية
const summarizeMonthlyPhaseStatuses = (project) => {
  const phases = Array.isArray(project?.monthly_phases) ? project.monthly_phases : [];
  if (!phases.length) return null;
  return phases.reduce((acc, phase) => {
    const status = phase?.status || 'غير محدد';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
};

const ProjectsList = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ التحقق إذا كانت هذه صفحة المشاريع المنتهية
  const isFinishedProjectsPage = location.pathname === '/project-management/projects/finished';
  const [loading, setLoading] = useState(true); // ✅ تفعيل loading state عند التحميل الأولي
  const [projects, setProjects] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // ✅ trigger لإعادة التحميل عند إبطال الكاش

  // ✅ استخدام useRef لحفظ AbortController لإلغاء الطلبات السابقة
  const abortControllerRef = useRef(null);

  // ✅ Cache: حفظ آخر بيانات تم جلبها و timestamp
  // ✅ استخدام localStorage للاحتفاظ بالبيانات عند العودة للصفحة
  const getCachedData = () => {
    try {
      const cacheKey = isFinishedProjectsPage ? 'projects_cache_finished' : 'projects_cache';
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        // ✅ التحقق من أن البيانات حديثة وليست فارغة (استخدام مدة افتراضية 2 دقيقة للتحقق الأولي)
        if (parsed.timestamp &&
          (Date.now() - parsed.timestamp) < 120000 && // دقيقتان كحد أدنى
          parsed.data &&
          Array.isArray(parsed.data) &&
          parsed.data.length > 0) {
          return parsed;
        } else {
          // ✅ البيانات قديمة أو فارغة - حذفها
          localStorage.removeItem('projects_cache');
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('Error reading cache from localStorage:', e);
      }
      // ✅ في حالة الخطأ، امسح الـ cache
      try {
        localStorage.removeItem('projects_cache');
      } catch (e2) {
        // ignore
      }
    }
    return null;
  };

  const cacheRef = useRef({
    data: getCachedData()?.data || null,
    timestamp: getCachedData()?.timestamp || null,
    filters: getCachedData()?.filters || null,
    maxAge: 120000, // مدة افتراضية - سيتم تحديثها بعد تعريف الأدوار
  });
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
  });

  // ✅ حفظ حالة hide_child_projects من Backend Response
  // ✅ إذا كان true، Backend قد فعل الفلترة بالفعل ولا نحتاج فلترة إضافية في Frontend
  const [backendHideChildProjects, setBackendHideChildProjects] = useState(false);

  const [filters, setFilters] = useState({
    status: [], // ✅ تغيير إلى مصفوفة لدعم الاختيار المتعدد
    project_type: [], // ✅ تغيير إلى مصفوفة لدعم الاختيار المتعدد
    searchQuery: '',
    page: 1,
    perPage: isFinishedProjectsPage ? 50 : 1000, // ✅ افتراضي 50 للمنتهية (paginated)، 1000 للبقية (جلب الكل)
    phase_day: '', // فلترة حسب اليوم (للمشاريع اليومية)
    parent_project_id: '', // فلترة حسب المشروع الأصلي
    subcategory_id: [], // ✅ تغيير إلى مصفوفة لدعم الاختيار المتعدد
    researcher_id: '', // ✅ فلترة حسب الباحث
    photographer_id: '', // ✅ فلترة حسب المصور
    producer_id: '', // ✅ فلترة حسب ممنتج المونتاج (لدور الإعلام)
    month_number: '', // ✅ فلترة حسب الشهر (لمنسق الكفالات)
    show_delayed_only: false, // ✅ فلترة المشاريع المتأخرة فقط
    show_divided_parents_only: false, // ✅ فلترة المشاريع الأصلية المقسمة فقط (للإدارة)
    show_urgent_only: false, // ✅ فلترة المشاريع العاجلة فقط
    show_sub_projects_only: false, // ✅ فلترة المشاريع الفرعية فقط (لمدير المشاريع)
  });

  // ✅ إضافة مستمع لتغير مسار الصفحة بين (المشاريع المنتهية / جميع المشاريع) لإعادة تعيين الفلاتر ومسح الكاش فوراً
  useEffect(() => {
    // تصفير الكاش حتى يتم جلب البيانات الصحيحة للمسار الجديد
    cacheRef.current = {
      data: null,
      timestamp: null,
      filters: null,
      maxAge: getCacheMaxAge ? getCacheMaxAge() : 120000,
    };
    try {
      localStorage.removeItem('projects_cache');
    } catch (e) { }

    setFilters(prev => ({
      ...prev,
      page: 1,
      perPage: isFinishedProjectsPage ? 50 : 5000,
    }));
  }, [isFinishedProjectsPage]);

  // ✅ State منفصل لقيمة البحث المكتوبة (بدون تطبيق البحث مباشرة)
  const [searchInput, setSearchInput] = useState('');

  // State للترتيب
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc', // 'asc' أو 'desc'
  });

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectShelterModalOpen, setSelectShelterModalOpen] = useState(false);
  const [addOrphansModalOpen, setAddOrphansModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [transferringToExecution, setTransferringToExecution] = useState(null);
  const [clearingAssignmentId, setClearingAssignmentId] = useState(null);

  const [showFilters, setShowFilters] = useState(true);

  // State للتأجيل
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponementReason, setPostponementReason] = useState('');
  const [isPostponing, setIsPostponing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [postponingProjectId, setPostponingProjectId] = useState(null);

  // ✅ State لـ Modal تحديث حالة التنفيذ
  const [showExecutionStatusModal, setShowExecutionStatusModal] = useState(false);
  const [selectedProjectForStatusUpdate, setSelectedProjectForStatusUpdate] = useState(null);
  const [executionStatusAction, setExecutionStatusAction] = useState(null); // 'completed' أو 'postpone'

  // State لإضافة عدد المستفيدين
  const [showBeneficiariesModal, setShowBeneficiariesModal] = useState(false);
  const [beneficiariesCount, setBeneficiariesCount] = useState('');
  const [updatingBeneficiaries, setUpdatingBeneficiaries] = useState(false);

  // ✅ State management لصور المشاريع (نفس منطق صور الأيتام)
  const [imageBlobUrls, setImageBlobUrls] = useState({}); // ✅ حفظ blob URLs للصور
  const [imageErrors, setImageErrors] = useState({}); // ✅ تتبع أخطاء الصور
  const [loadingImages, setLoadingImages] = useState(new Set()); // ✅ تتبع الصور قيد التحميل

  // ✅ Modal لعرض صور الملاحظات المتعددة وتنزيلها من القائمة الرئيسية
  const [noteImagesModalOpen, setNoteImagesModalOpen] = useState(false);
  const [noteImagesModalProject, setNoteImagesModalProject] = useState(null);
  const [noteImagesModalImages, setNoteImagesModalImages] = useState([]);
  const [noteImagesModalLoading, setNoteImagesModalLoading] = useState(false);

  // ✅ Helper function لإبطال الكاش بعد أي عملية تحديث
  const invalidateCacheAndRefresh = useCallback(() => {
    forceRefreshCache();
    invalidateCache('projects');
    invalidateCache('project-proposals');
    fetchProjects({ forceRefresh: true });
  }, []);

  // State للـ Export
  const [isExportFilterModalOpen, setIsExportFilterModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null); // ✅ المشروع المراد حذفه
  const [deletingProject, setDeletingProject] = useState(null); // ✅ ID المشروع قيد الحذف

  // ✅ State للقوائم المنسدلة متعددة الاختيار
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProjectTypeDropdown, setShowProjectTypeDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [showExportProjectTypeDropdown, setShowExportProjectTypeDropdown] = useState(false);
  const [showExportStatusDropdown, setShowExportStatusDropdown] = useState(false);
  const [showMonthlyPhasesHelp, setShowMonthlyPhasesHelp] = useState(false); // ✅ مساعدة عرض الدفعات الشهرية (لمنسق الكفالات)
  const exportStatusDropdownRef = useRef(null);
  const exportProjectTypeDropdownRef = useRef(null);
  const [exportFilters, setExportFilters] = useState({
    status: [], // ✅ مصفوفة لدعم الاختيار المتعدد
    project_type: [], // ✅ مصفوفة لدعم الاختيار المتعدد
    startDate: '',
    endDate: '',
    researcher_id: '',
    photographer_id: '',
    shelter_id: '',
    governorate: '',
    district: '',
    donor_name: '',
    donor_code: '',
    quantity_min: '',
    quantity_max: '',
    cost_min: '',
    cost_max: '',
    created_at_start: '',
    created_at_end: '',
    updated_at_start: '',
    updated_at_end: '',
  });

  // ✅ State للقوائم المطلوبة للفلترة المتقدمة
  const [teams, setTeams] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [researchers, setResearchers] = useState([]); // ✅ قائمة الباحثين
  const [producers, setProducers] = useState([]); // ✅ قائمة ممنتجي المونتاج (لدور الإعلام)
  const [shelters, setShelters] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loadingFilterData, setLoadingFilterData] = useState(false);
  const [loadingFilterLists, setLoadingFilterLists] = useState(false); // ✅ حالة تحميل قوائم الفلترة

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

  // ✅ State لاختيار الأعمدة
  const [selectedColumns, setSelectedColumns] = useState(() => {
    // افتراضياً: جميع الأعمدة الافتراضية مفعلة
    return availableColumns.filter(col => col.default).map(col => col.key);
  });

  // 🛒 Supply Modal (التسوق من المخزن)
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [supplyProject, setSupplyProject] = useState(null);
  const [warehouseItems, setWarehouseItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [projectQuantity, setProjectQuantity] = useState(1);
  const [loadingWarehouse, setLoadingWarehouse] = useState(false);
  const [confirmingSupply, setConfirmingSupply] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState('');
  const [surplusCategories, setSurplusCategories] = useState([]);
  const [selectedSurplusCategoryId, setSelectedSurplusCategoryId] = useState('');
  const [loadingSurplusCategories, setLoadingSurplusCategories] = useState(false);

  // 💱 Shekel Conversion State
  const [showShekelModal, setShowShekelModal] = useState(false);
  const [exchangeRate, setExchangeRate] = useState('');
  const [transferDiscountPercentage, setTransferDiscountPercentage] = useState(0);
  const [convertingToShekel, setConvertingToShekel] = useState(false);
  const [isEditingShekel, setIsEditingShekel] = useState(false);

  // بيانات التوريد للمشاريع الجاهزة للتنفيذ
  const [projectsSupplyData, setProjectsSupplyData] = useState({});
  const [loadingSupplyData, setLoadingSupplyData] = useState(false);
  // ✅ Track which projects have been fetched to prevent duplicate API calls
  const fetchedProjectsRef = useRef(new Set());

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

  // ✅ State للقبول/الرفض (نفس وظيفة الإشعارات)
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
  const [projectNotification, setProjectNotification] = useState(null); // إشعار المشروع الحالي

  // ✅ الأنواع الافتراضية كـ fallback
  const DEFAULT_PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];
  const [projectTypes, setProjectTypes] = useState(DEFAULT_PROJECT_TYPES); // ✅ قائمة أنواع المشاريع من API
  const [projectTypesLoading, setProjectTypesLoading] = useState(false);

  // ✅ State للتفريعات
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);

  // ✅ التفريعات المصفاة بناءً على نوع المشروع المختار
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

  // ✅ تعريف الأدوار قبل استخدامها
  const normalizedRole =
    (typeof (user?.role || user?.role_name || user?.user_role || '') === 'string'
      ? (user?.role || user?.role_name || user?.user_role || '').toLowerCase()
      : '') || '';

  const isAdmin = ['admin', 'administrator', 'مدير'].includes(normalizedRole);
  const isProjectManager =
    normalizedRole === 'project_manager' || normalizedRole === 'مدير مشاريع';
  const isExecutedCoordinator =
    normalizedRole === 'executed_projects_coordinator' || normalizedRole === 'منسق مشاريع منفذة';
  const isMediaManager =
    normalizedRole === 'media_manager' || normalizedRole === 'مدير الإعلام' || normalizedRole === 'مسؤول الإعلام';
  const isOrphanSponsorCoordinator =
    normalizedRole === 'orphan_sponsor_coordinator' ||
    normalizedRole === 'منسق مشاريع كفالة الأيتام' ||
    normalizedRole === 'منسق الكفالات';

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

  // ✅ للحراسة لمنسق الكفالة: عرض كل مشاريع "نوع الكفالات" (كفالة أيتام + كفالة الأسر + أي تفريعة) — بدون تقييد بالتفريعة
  // ✅ للحراسة لمنسق الكفالة: عرض كل مشاريع "نوع الكفالات" (كفالة أيتام + كفالة الأسر + أي تفريعة) — بدون تقييد بالتفريعة
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

      // ✅ محاولة استخراج النوع من الأب إذا كان مشروعاً فرعياً ونوعه غير محدد
      if ((!projectType || projectType.trim() === '' || projectType === 'undefined') && isSubProject && parentProject) {
        if (typeof parentProject.project_type === 'object' && parentProject.project_type !== null) {
          projectType = parentProject.project_type.name_ar || parentProject.project_type.name || parentProject.project_type.name_en || '';
        } else if (parentProject.project_type != null) {
          projectType = String(parentProject.project_type);
        }
      }

      const projectTypeStr = (projectType || '').trim();

      // ✅ تحقق مرن من مسميات الكفالة
      const isSponsorshipType = projectTypeStr === 'الكفالات' ||
        projectTypeStr === 'كفالات' ||
        projectTypeStr === 'الكفالة' ||
        projectTypeStr.includes('الكفالات') ||
        projectTypeStr.includes('كفالة أيتام');

      if (isSponsorshipType) return true;

      // المشاريع الفرعية الشهرية/اليومية: إذا الـ parent من نوع كفالات نعرضها
      if (isSubProject && parentProject) {
        let parentType = '';
        if (typeof parentProject.project_type === 'object' && parentProject.project_type !== null) {
          parentType = parentProject.project_type.name_ar || parentProject.project_type.name || parentProject.project_type.name_en || '';
        } else if (parentProject.project_type != null) {
          parentType = String(parentProject.project_type);
        }
        const parentStr = (parentType || '').trim();
        if (parentStr === 'الكفالات' || parentStr === 'كفالات' || parentStr.includes('كفالة')) {
          return true;
        }
      }

      // ✅ حالة خاصة: إذا كان منسق كفالات والـ backend أرجع المشروع، نعتبره كفالة افتراضياً إذا كان النوع غير محدد
      if (normalizedRole === 'orphan_sponsor_coordinator' && (!projectType || projectType === 'undefined')) {
        return true;
      }

      return false;
    } catch (e) {
      console.error('Error in isSponsorshipProject:', e);
      return false;
    }
  }, [normalizedRole]);

  // ✅ مدة الكاش: 1 دقيقة لـ Project Manager، دقيقتان للباقي
  const getCacheMaxAge = () => {
    if (isProjectManager) return 60000; // 1 دقيقة لـ PM
    if (isAdmin) return 30000; // ✅ 30 ثانية للإدارة (لتحديث أسرع)
    return 120000; // دقيقتان للباقي
  };

  // ✅ تحديث maxAge في cacheRef بعد تعريف الأدوار
  useEffect(() => {
    if (cacheRef.current && cacheRef.current.maxAge === 120000 && isProjectManager) {
      cacheRef.current.maxAge = 60000;
    }
  }, [isProjectManager]);

  // ✅ البحث يتم فقط عند الضغط على Enter أو زر البحث - لا يوجد debounce تلقائي

  // ✅ التحقق من دور رئيس قسم التنفيذ (جميع الصيغ المحتملة)
  const isExecutionHead = useMemo(() => {
    const role = normalizedRole;
    const rawRole = user?.role || user?.userRole || user?.user_role || user?.role_name || user?.role || '';
    const rawRoleLower = String(rawRole).toLowerCase();
    const roleLower = String(role).toLowerCase();

    // التحقق من جميع الصيغ المحتملة
    const check =
      roleLower === 'execution_head' ||
      roleLower === 'execution_department_head' ||
      roleLower === 'executiondepartmenthead' ||
      roleLower === 'executionhead' ||
      roleLower === 'رئيس قسم التنفيذ' ||
      roleLower === 'رئيس قسم تنفيذ' ||
      roleLower === 'رئيسقسمالتنفيذ' ||
      roleLower.includes('execution_head') ||
      roleLower.includes('execution_department') ||
      roleLower.includes('executionhead') ||
      roleLower.includes('رئيس قسم التنفيذ') ||
      roleLower.includes('رئيس قسم تنفيذ') ||
      rawRoleLower === 'رئيس قسم التنفيذ' ||
      rawRoleLower === 'رئيس قسم تنفيذ' ||
      (rawRoleLower.includes('execution') && rawRoleLower.includes('head')) ||
      (rawRoleLower.includes('رئيس') && rawRoleLower.includes('تنفيذ'));

    // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
    // يمكن إعادة تفعيله عند الحاجة للتطوير
    // if (import.meta.env.DEV) {
    //   console.log('🔍 Execution Head Role Check:', {...});
    // }

    return check;
  }, [normalizedRole, user?.role, user?.userRole, user?.user_role, user?.role_name]);

  // ✅ إزالة التحديث التلقائي - البحث يحدث فقط عند الضغط على Enter

  // ✅ مزامنة searchInput مع filters.searchQuery (في حالة تم تغييره من مكان آخر)
  useEffect(() => {
    if (filters.searchQuery !== searchInput) {
      setSearchInput(filters.searchQuery);
    }
  }, [filters.searchQuery]);

  // ✅ إغلاق القوائم المنسدلة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event) => {
      // إذا كان الضغط خارج القوائم المنسدلة، أغلقها
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

  // ✅ الاستماع إلى أحداث إبطال الكاش
  useEffect(() => {
    const handleCacheInvalidation = (event) => {
      const { cacheKey } = event.detail;

      // ✅ إذا كان cacheKey === 'all' أو يطابق 'projects' أو 'project-proposals'
      if (cacheKey === 'all' ||
        cacheKey === 'projects' ||
        cacheKey === 'project-proposals' ||
        cacheKey === 'project_proposals') {
        // ✅ مسح cache
        cacheRef.current = {
          data: null,
          timestamp: null,
          filters: null,
          maxAge: getCacheMaxAge(), // مدة ديناميكية حسب الدور
        };
        try {
          localStorage.removeItem('projects_cache');
        } catch (e) {
          console.warn('Error clearing cache from localStorage:', e);
        }

        // ✅ إطلاق trigger لإعادة التحميل
        setRefreshTrigger(prev => prev + 1);

      }
    };

    window.addEventListener('cache-invalidated', handleCacheInvalidation);

    return () => {
      window.removeEventListener('cache-invalidated', handleCacheInvalidation);
    };
  }, []); // ✅ مرة واحدة فقط عند التحميل

  useEffect(() => {
    // ✅ التحقق من refresh parameter في URL - إذا كان موجوداً، امسح cache
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has('refresh')) {
      // ✅ مسح cache عند وجود refresh parameter
      cacheRef.current = {
        data: null,
        timestamp: null,
        filters: null,
        maxAge: 120000, // دقيقتان
      };
      try {
        localStorage.removeItem('projects_cache');
      } catch (e) {
        console.warn('Error clearing cache from localStorage:', e);
      }
      // ✅ إزالة refresh parameter من URL
      searchParams.delete('refresh');
      navigate(location.pathname + (searchParams.toString() ? '?' + searchParams.toString() : ''), { replace: true });
    }

    // ✅ التحقق من cache أولاً قبل جلب البيانات
    const cache = cacheRef.current;
    const now = Date.now();
    const filtersKey = JSON.stringify(filters);

    // ✅ إذا كانت البيانات موجودة في cache وحديثة ونفس الفلاتر، استخدمها مباشرة
    // ✅ التحقق من أن البيانات ليست فارغة
    // ✅ لكن إذا تغيرت الفلاتر، جلب بيانات جديدة دائماً
    const filtersChanged = cache.filters !== filtersKey;
    if (cache.data &&
      Array.isArray(cache.data) &&
      cache.data.length > 0 &&
      cache.filters === filtersKey &&
      cache.timestamp &&
      (now - cache.timestamp) < cache.maxAge &&
      !filtersChanged) {
      // ✅ عرض المشاريع كما يرسلها الـ API: أصلية + فرعية (اليومية/الشهرية) عند بدء إجراء أو تم التوريد وما بعد
      // ✅ لا نستبعد المشاريع الفرعية؛ الـ API يرسل فقط الفرعية المسموح بعرضها حسب الحالة
      let filteredCacheData = cache.data;
      setProjects(filteredCacheData);
      setLoading(false); // ✅ تعطيل loading عند استخدام cache
      return; // لا نحتاج لجلب البيانات من جديد
    }

    // ✅ إذا كانت البيانات في cache لكنها فارغة أو قديمة، امسحها
    if (cache.data && (!Array.isArray(cache.data) || cache.data.length === 0)) {
      if (import.meta.env.DEV) {
      }
      cacheRef.current = {
        data: null,
        timestamp: null,
        filters: null,
        maxAge: 120000, // دقيقتان
      };
      try {
        localStorage.removeItem('projects_cache');
      } catch (e) {
        console.warn('Error clearing cache from localStorage:', e);
      }
    }

    // ✅ جلب البيانات دائماً عند تحميل الصفحة أو تغيير الفلاتر
    // ✅ لا نعتمد على cache فقط - نجلب دائماً لضمان البيانات المحدثة
    fetchProjects();

    // ✅ تنظيف: إلغاء الطلب عند unmount أو تغيير filters
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filters, location.search, refreshTrigger]); // ✅ إضافة refreshTrigger

  // ✅ Cleanup: إلغاء timeout عند unmount
  useEffect(() => {
    return () => {
      if (refetchProjectsInBackground.current) {
        clearTimeout(refetchProjectsInBackground.current);
      }
    };
  }, []);

  // جلب بيانات التوريد للمشاريع الجاهزة للتنفيذ (للمنسق المنفذ)
  useEffect(() => {
    if (isExecutedCoordinator && projects.length > 0) {
      const readyProjects = projects.filter((project) => {
        // ✅ التحقق من أن project هو object وليس array
        if (!project || Array.isArray(project)) return false;
        return project.status === 'جاهز للتنفيذ';
      });
      if (readyProjects.length > 0) {
        fetchProjectsSupplyData(readyProjects);
      }
    }
  }, [projects, isExecutedCoordinator]);

  // ✅ جلب بيانات التوريد لجميع المشاريع لمدير المشاريع (لعرض العدد)
  useEffect(() => {
    if (isProjectManager && projects.length > 0 && !loadingSupplyData) {
      // ✅ جلب بيانات التوريد للمشاريع التي لا تحتوي على quantity في البيانات الأساسية
      const projectsNeedingQuantity = projects.filter((project) => {
        // ✅ التحقق من أن project هو object وليس array
        if (!project || Array.isArray(project)) return false;
        // ✅ جلب البيانات للمشاريع التي لا تحتوي على quantity أو quantity = 0
        const hasQuantity = project.quantity !== null &&
          project.quantity !== undefined &&
          project.quantity !== '' &&
          project.quantity !== 0;
        // ✅ جلب البيانات فقط إذا لم تكن موجودة في projectsSupplyData
        const alreadyFetched = projectsSupplyData[project.id];
        return !hasQuantity && !alreadyFetched;
      });

      if (projectsNeedingQuantity.length > 0) {
        // ✅ جلب بيانات التوريد للمشاريع التي تحتاجها (حد أقصى 50 مشروع في كل مرة لتجنب الحمل الزائد)
        const projectsToFetch = projectsNeedingQuantity.slice(0, 50);
        fetchProjectsSupplyData(projectsToFetch);
      }
    }
  }, [projects, isProjectManager, loadingSupplyData]);

  // ✅ إغلاق القوائم المنسدلة عند النقر خارجها
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

  // ✅ تم تعطيل التحميل التلقائي للصور - الصور تُحمَّل فقط عند النقر على "تنزيل صور المشروع"
  // هذا يقلل عشرات الطلبات غير الضرورية لـ /api/project-note-image/{id} عند تحميل الصفحة
  // الصور تُحمَّل عند الطلب عبر handleDownloadProjectImage أو handleProjectImagesClick

  // ✅ تنظيف blob URLs عند unmount
  useEffect(() => {
    return () => {
      Object.values(imageBlobUrls).forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProjectsSupplyData = async (readyProjects) => {
    if (loadingSupplyData) return;

    setLoadingSupplyData(true);
    const supplyDataMap = {};

    try {
      // ✅ Process requests sequentially with delays to avoid rate limiting
      const REQUEST_DELAY = 300; // milliseconds between requests
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
            // ✅ Handle 429 errors with Retry-After header support
            if (error.response?.status === 429) {
              const retryAfter = error.response?.headers?.['retry-after'] ||
                error.response?.headers?.['Retry-After'];
              const waitTime = retryAfter
                ? parseInt(retryAfter) * 1000
                : Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s

              if (retryCount < MAX_RETRIES) {
                if (import.meta.env.DEV) {
                  console.warn(`⚠️ Rate limited for project ${project.id}, waiting ${waitTime}ms before retry ${retryCount + 1}/${MAX_RETRIES}`);
                }
                await new Promise(resolve => setTimeout(resolve, waitTime));
                retryCount++;
                continue;
              } else {
                // Max retries reached, use default values
                if (import.meta.env.DEV) {
                  console.warn(`⚠️ Max retries reached for project ${project.id}, using default values`);
                }
                supplyDataMap[project.id] = {
                  quantity: project.quantity || 0,
                  items_count: 0,
                  items: [],
                };
                success = true; // Exit loop
              }
            } else {
              // Other errors - use default values
              supplyDataMap[project.id] = {
                quantity: project.quantity || 0,
                items_count: 0,
                items: [],
              };
              success = true; // Exit loop
            }
          }
        }

        // ✅ Delay between requests to avoid rate limiting
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

  const fetchProjects = async (options = {}) => {
    const { skipLoading = false, forceRefresh = false } = options;
    let shouldFetchAll = false;

    try {
      // ✅ إذا كان forceRefresh = true، امسح الكاش المحلي
      if (forceRefresh) {
        cacheRef.current = {
          data: null,
          timestamp: null,
          filters: null,
          maxAge: getCacheMaxAge(),
        };
      }

      // ✅ التحقق من Cache: إذا كانت البيانات موجودة وحديثة، استخدمها
      const cache = cacheRef.current;
      const now = Date.now();
      const filtersKey = JSON.stringify(filters);

      // ✅ للإدارة: تقليل مدة الـ cache أو تعطيله مؤقتاً لضمان جلب أحدث البيانات
      // ✅ هذا يحل مشكلة عدم ظهور المشاريع الجديدة مباشرة
      // ✅ إذا كان forceRefresh = true، لا نستخدم الكاش
      const shouldUseCache = !forceRefresh && (!isAdmin || (cache.timestamp && (now - cache.timestamp) < 30000)); // ✅ 30 ثانية فقط للإدارة

      // ✅ التحقق من أن البيانات في cache صالحة وليست فارغة
      if (shouldUseCache &&
        cache.data &&
        Array.isArray(cache.data) &&
        cache.data.length > 0 &&
        cache.filters === filtersKey &&
        cache.timestamp &&
        (now - cache.timestamp) < cache.maxAge) {
        // ✅ البيانات موجودة في cache وحديثة - استخدمها مباشرة
        // ✅ عرض المشاريع كما يرسلها الـ API: أصلية + فرعية (اليومية/الشهرية) عند بدء إجراء أو تم التوريد وما بعد
        let filteredCacheData = cache.data;
        setProjects(filteredCacheData);
        if (!skipLoading) {
          setLoading(false); // ✅ تعطيل loading عند استخدام cache
        }
        return; // لا نحتاج لجلب البيانات من جديد
      }

      // ✅ للإدارة: إذا كان الـ cache قديم، امسحه وأجلب بيانات جديدة
      if (isAdmin && cache.timestamp && (now - cache.timestamp) >= 30000) {
        cacheRef.current = {
          data: null,
          timestamp: null,
          filters: null,
          maxAge: getCacheMaxAge(),
        };
        try {
          localStorage.removeItem('projects_cache');
        } catch (e) {
          console.warn('Error clearing cache from localStorage:', e);
        }
      }

      // ✅ إذا كانت البيانات في cache لكنها فارغة، امسحها
      if (cache.data && (!Array.isArray(cache.data) || cache.data.length === 0)) {
        cacheRef.current = {
          data: null,
          timestamp: null,
          filters: null,
          maxAge: getCacheMaxAge(), // مدة ديناميكية حسب الدور
        };
      }

      // ✅ إلغاء الطلب السابق إذا كان موجوداً
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // ✅ إنشاء AbortController جديد
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // ✅ تفعيل loading فقط إذا لم يتم تخطيه
      if (!skipLoading) {
        setLoading(true);
      }

      // ✅ إنشاء params من filters مع إزالة القيم الفارغة
      const params = {};

      Object.keys(filters).forEach(key => {
        const value = filters[key];
        // ✅ إرسال فقط القيم غير الفارغة (ليس '' أو null أو undefined)
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

      // ✅ إذا كان المستخدم مدير مشاريع، نطلب المشاريع مع مراعاة النافذة الزمنية
      if (isProjectManager) {
        // ✅ لمدير المشاريع: نستخدم pagination العادي (25 أو 50... إلخ)
        // إضافة معاملات لجلب جميع المشاريع بما فيها المنفذة و"وصل للمتبرع"
        params.include_non_divided = true;
        // ✅ لـ Project Manager: نطلب فقط المشاريع اليومية من النافذة (اليوم + 3 أيام قادمة)
        params.include_daily_phases_window_only = true;
        params.daily_phases_window_size = 4;
        params.include_monthly_phases = true;
      }

      // ✅ إذا كان المستخدم منسق المشاريع المنفذة، نطلب جميع المشاريع من /projects
      if (isExecutedCoordinator) {
        // ✅ طلب جميع المشاريع بدون أي فلترة من الـ Backend
        // ✅ دائماً نطلب جميع المشاريع (100000) لمنسق المشاريع المنفذة
        params.per_page = 1000; // ✅ قيمة كبيرة جداً لجلب جميع المشاريع
        params.perPage = 1000;
        shouldFetchAll = true; // ✅ تعيين shouldFetchAll لضمان جلب جميع المشاريع
        // ✅ لا نضيف أي فلترة - نطلب جميع المشاريع
        // ✅ إزالة جميع الفلاتر لضمان جلب جميع المشاريع
        delete params.status;
        delete params.project_type;
        delete params.searchQuery;
      }

      // ✅ إذا كان المستخدم منسق كفالة الأيتام، نطلب جميع المشاريع مع المراحل الشهرية
      // ✅ الـ Frontend سيقوم بالفلترة حسب project_type و subcategory
      if (isOrphanSponsorCoordinator) {
        // ✅ طلب جميع المشاريع بدون أي فلترة من الـ Backend
        // ✅ حد أقصى 1000 لتجنب تجاوز حد الذاكرة في Backend
        params.per_page = 1000;
        params.perPage = 1000;
        shouldFetchAll = true;
        // ✅ طلب المشاريع الأصلية المقسمة مع علاقة monthly_phases حتى يظهر الشهر 1 (فبراير) وغيره
        params.include_monthly_phases = true;
        params.hide_child_projects = false; // ✅ إرجاع المشاريع الفرعية أو الأب مع monthly_phases
      }

      // ✅ إذا كان المستخدم إدارة (Admin)، نطلب المشاريع مع pagination معقول
      // 📚 حسب التوثيق: FRONTEND_PROJECTS_FILTERING.md
      // ✅ للإدارة: المشاريع غير المقسمة + المشاريع الأصلية المقسمة فقط
      // ❌ لا نطلب المشاريع الفرعية (اليومية والشهرية)
      if (isAdmin) {
        // ✅ للمشاريع المنتهية: pagination عادي (50 لكل صفحة)
        // ✅ للمشاريع غير المنتهية: لا نرسل per_page — Backend يجلب الكل افتراضياً
        if (isFinishedProjectsPage && !params.per_page) {
          params.per_page = 50;
          params.perPage = 50;
        }

        // ✅ إضافة معاملات لجلب جميع المشاريع (غير المقسمة والمقسمة الأصلية)
        // ❌ لا نطلب المشاريع الفرعية (اليومية والشهرية) - سنفلترها في Frontend
        // ✅ ملاحظة: إزالة include_executed و include_all_statuses لأنها قد لا تكون مدعومة في Backend

        // ✅ للأدمن: طلب المشاريع الأصلية + الفرعية (اليومية/الشهرية) التي بدأ عليها إجراء أو تم التوريد وما بعد - الـ API يفلتر الفرعية حسب الحالة
        params.hide_child_projects = false; // ✅ دائماً نجلب الأصلية + الفرعية المسموح بعرضها
        params.include_non_divided = true;
        params.include_divided_parents = true;
        params.include_daily_phases = true;
        params.include_monthly_phases = true;

        if (filters.show_divided_parents_only) {
          params.include_non_divided = false; // ✅ عند الفلتر: استبعاد غير المقسمة من الطلب
        }

        if (import.meta.env.DEV) {
          console.log('✅ ProjectsList (Admin): Requesting parents + sub-projects (hide_child_projects=false):', {
            hide_child_projects: params.hide_child_projects,
            show_divided_parents_only: filters.show_divided_parents_only,
            per_page: params.per_page,
          });
        }
        // ❌ إزالة المعاملات التي قد تسبب مشاكل في Backend
        // params.include_executed = true; // ❌ تم إزالته - قد لا يكون مدعوم في Backend
        // params.include_all_statuses = true; // ❌ تم إزالته - قد لا يكون مدعوم في Backend

      }
      // section two start here //***** 
      // ✅ timeout أعلى لطلبات المشاريع الكبيرة لتجنب ECONNABORTED
      // - في الإنتاج: حتى 30 ثانية للطلبات الكبيرة
      // - في التطوير: حتى 20 ثانية (يمكنك تقليلها إذا أصبح البطء مزعجاً)
      const isLargeRequest = params.per_page >= 100 || params.perPage >= 100;
      const baseTimeout = import.meta.env.PROD ? 30000 : 20000;
      const timeoutDuration = isLargeRequest ? baseTimeout : Math.floor(baseTimeout * 0.7);


      // ✅ إضافة cache busting قوي - استخدام timestamp فريد لكل طلب
      const cacheBustTimestamp = Date.now();

      // ✅ لمنسق المشاريع المنفذة: استخدام /projects
      // ✅ للمشاريع المنتهية: استخدام /project-proposals/finished (paginated)
      // ✅ للمشاريع غير المنتهية: استخدام /project-proposals (يجلب الكل افتراضياً)
      const apiEndpoint = isExecutedCoordinator
        ? '/projects'
        : isFinishedProjectsPage
          ? '/project-proposals/finished'
          : '/project-proposals';

      const response = await apiClient.get(apiEndpoint, {
        params: {
          ...params,
          _t: cacheBustTimestamp, // ✅ cache busting
          // ✅ للإدارة: إضافة timestamp إضافي لضمان جلب أحدث البيانات
          ...(isAdmin && { _admin: cacheBustTimestamp }),
        },
        timeout: timeoutDuration,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        signal: abortController.signal // ✅ إضافة signal لإلغاء الطلب
      });
      // ************************************************************************************************************************
      // 🔍 Debug: عرض الاستجابة الكاملة
      if (isProjectManager) {
        const projectsData = response.data?.projects || response.data?.data?.data || response.data?.data || [];
        const statusCounts = {};
        if (Array.isArray(projectsData)) {
          projectsData.forEach(project => {
            const status = project.status || 'غير محدد';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });
        }


        if (response.data.success) {
          // ✅ الـ Backend يرجع البيانات في "projects" وليس "data.data"
          // ✅ التحقق من أن projects هو array قبل استخدامه
          let projectsData = [];
          if (Array.isArray(response.data.projects)) {
            projectsData = response.data.projects;
          } else if (Array.isArray(response.data.data?.data)) {
            projectsData = response.data.data.data;
          } else if (Array.isArray(response.data.data)) {
            projectsData = response.data.data;
          } else if (response.data.projects && !Array.isArray(response.data.projects)) {
            // ⚠️ إذا كان projects موجود لكن ليس array، سجل تحذير
            if (import.meta.env.DEV) {
              console.warn('⚠️ response.data.projects exists but is not an array:', {
                type: typeof response.data.projects,
                value: response.data.projects,
              });
            }
            projectsData = [];
          }



          // ⚠️ تحذير إذا كانت البيانات فارغة
          if ((!projectsData || !Array.isArray(projectsData) || projectsData.length === 0) && import.meta.env.DEV) {
            console.warn('⚠️ API returned empty projects array!', {
              responseData: response.data,
              projectsData,
              projectsDataType: typeof projectsData,
              projectsDataIsArray: Array.isArray(projectsData),
              responseStructure: {
                hasProjects: !!response.data.projects,
                projectsType: typeof response.data.projects,
                projectsIsArray: Array.isArray(response.data.projects),
                hasDataData: !!response.data.data?.data,
                hasData: !!response.data.data,
                allKeys: Object.keys(response.data || {}),
              },
            });
          }

          // ⚠️ تحذير فقط في development
          if (import.meta.env.DEV) {
            if (response.data.total > 0 && projectsData.length === 0) {
              console.warn('⚠️ تحذير: الـ API يقول أن هناك', response.data.total, 'مشروع لكن لم يتم إرجاع أي مشروع!', {
                response: response.data,
              });
            }
            if (isProjectManager && projectsData.length === 0) {
              console.warn('⚠️ Project Manager - No projects returned from API!', {
                total: response.data.total,
                responseKeys: Object.keys(response.data),
                sentParams: params,
                responseStructure: {
                  projects: response.data.projects,
                  data: response.data.data,
                  dataData: response.data.data?.data,
                },
              });
            }
          }

          let normalizedProjects = Array.isArray(projectsData)
            ? projectsData.map((item) => normalizeProjectRecord(item))
            : [];

          // ✅ الفلترة تتم في الـ Backend عبر endpoints منفصلة
          // /project-proposals → غير المنتهية فقط
          // /project-proposals/finished → المنتهية فقط

          // ✅ فلترة مشاريع الكفالة لمنسق الكفالة
          if (isOrphanSponsorCoordinator) {
            const originalCount = normalizedProjects.length;


            // ✅ لمنسق الكفالات: لا نفلتر المشاريع هنا، سنفلترها في visibleProjects
            // ✅ هذا يضمن أن المشاريع الشهرية الفرعية التي لها parent_project_id تظهر
            // ✅ لا نفلتر المشاريع هنا، سنفلترها في visibleProjects
          }

          // ✅ للإدارة: نعرض كل ما يرسله الـ API (أصلية + فرعية عند بدء إجراء أو تم التوريد) دون فلترة استبعاد
          // ✅ الفلترة حسب الحالة تتم في الـ Backend

          // ✅ حفظ البيانات في cache (حتى لو كانت فارغة مؤقتاً)
          if (normalizedProjects && Array.isArray(normalizedProjects)) {
            // ✅ تحديث المشاريع دائماً لتعكس الواقع من البايك إند
            setProjects(normalizedProjects);

            // ✅ حفظ البيانات في cache
            const cacheMaxAge = isProjectManager ? 60000 : (isAdmin ? 30000 : 120000);
            const cacheData = {
              data: normalizedProjects,
              timestamp: Date.now(),
              filters: JSON.stringify(filters),
              maxAge: cacheMaxAge,
            };
            cacheRef.current = cacheData;

            // ✅ حفظ في localStorage بمفتاح منفصل للمشاريع المنتهية
            try {
              const storageKey = isFinishedProjectsPage ? 'projects_cache_finished' : 'projects_cache';
              localStorage.setItem(storageKey, JSON.stringify(cacheData));
            } catch (e) {
              console.warn('Error saving cache to localStorage:', e);
            }
          } else {
            // ✅ إذا كانت البيانات غير صالحة، لا نمسح المشاريع القديمة
            if (import.meta.env.DEV) {
              console.warn('⚠️ Invalid data returned from API, keeping existing projects:', {
                existingProjectsCount: projects.length,
                normalizedProjects: normalizedProjects,
              });
            }
          }

          // ✅ نحافظ دائماً على الصفحة الحالية من filters بدلاً من استخدام current_page من API
          // هذا يضمن عدم إعادة تعيين الصفحة عند جلب البيانات
          const currentPage = filters.page || 1;

          // ✅ للأدمن: إذا كان hide_child_projects=true، total في Response = 280 (للحسابات)
          // ✅ لكن المشاريع المعروضة = 247 (بدون فرعية)
          // ✅ نستخدم total من Response للحسابات الصحيحة
          const responseTotal = response.data.total || response.data.data?.total || 0;
          const metaInfo = response.data.meta || response.data.data?.meta || {};

          // ✅ حفظ حالة hide_child_projects من Backend
          const hideChildProjectsFromBackend = metaInfo.hide_child_projects === true || metaInfo.hide_child_projects === 'true';
          if (isAdmin) {
            setBackendHideChildProjects(hideChildProjectsFromBackend);
          }

          // ✅ إذا كان هناك actual_total_count في meta (من hide_child_projects)، نستخدمه للحسابات
          const actualTotal = metaInfo.actual_total_count || responseTotal;
          const displayedCount = metaInfo.displayed_projects_count || projectsData.length;

          if (import.meta.env.DEV && isAdmin && hideChildProjectsFromBackend) {
            console.log('✅ ProjectsList (Admin): Pagination info:', {
              actual_total_count: actualTotal, // 280 (للحسابات)
              displayed_projects_count: displayedCount, // 247 (المعروضة)
              projects_returned: projectsData.length,
              hide_child_projects: hideChildProjectsFromBackend,
              message: 'Backend already filtered projects. Total (280) is for calculations, displayed projects (247) exclude sub-projects. No additional Frontend filtering needed.'
            });
          }

          setPagination({
            current_page: currentPage,
            last_page: response.data.totalPages || response.data.data?.last_page || response.data.last_page || 1,
            per_page: response.data.perPage || response.data.data?.per_page || response.data.per_page || 10,
            total: actualTotal,
          });
        } else {
          if (import.meta.env.DEV) {
            console.warn('⚠️ API returned success: false', response.data);
          }
          setProjects([]);
        }
      } else {
        // Handle response for non-project managers
        if (response.data.success) {
          let projectsData = [];
          if (Array.isArray(response.data.projects)) {
            projectsData = response.data.projects;
          } else if (Array.isArray(response.data.data?.data)) {
            projectsData = response.data.data.data;
          } else if (Array.isArray(response.data.data)) {
            projectsData = response.data.data;
          }

          // ✅ سجل للمنسق الأيتام
          if (isOrphanSponsorCoordinator) {

          }

          const normalizedProjects = Array.isArray(projectsData)
            ? projectsData.map((item) => normalizeProjectRecord(item))
            : [];

          // ✅ استخراج المشاريع الشهرية من monthly_phases (لا يُطبَّق لمنسق الكفالة — الـ Backend مصدر الحقيقة)
          let expandedProjects = [...normalizedProjects];
          if (!isOrphanSponsorCoordinator) {
            const monthlyPhasesFromParents = [];
            const parentProjectIds = new Set();

            normalizedProjects.forEach((project) => {
              // ✅ إذا كان المشروع مقسم شهرياً وله monthly_phases
              if (project.is_divided_into_phases && Array.isArray(project.monthly_phases) && project.monthly_phases.length > 0) {
                parentProjectIds.add(project.id);
                project.monthly_phases.forEach((phase) => {
                  // ✅ تطبيع المشروع الشهري وإضافته للقائمة
                  // ✅ ضمان أن parent_project_id و month_number موجودان
                  const phaseWithParent = {
                    ...phase,
                    parent_project_id: phase.parent_project_id ?? project.id,
                    parent_project: phase.parent_project ?? project,
                  };
                  const normalizedPhase = normalizeProjectRecord(phaseWithParent);

                  // ✅ التأكد من أن month_number موجود (إذا لم يكن موجوداً، نحاول استخراجه من اسم المشروع أو من البيانات الأخرى)
                  if (!normalizedPhase.month_number && normalizedPhase.is_monthly_phase) {
                    // ✅ محاولة استخراج رقم الشهر من اسم المشروع (مثل "مشروع - الشهر 1")
                    const monthMatch = normalizedPhase.project_name?.match(/الشهر\s*(\d+)/i) ||
                      normalizedPhase.project_name?.match(/month\s*(\d+)/i);
                    if (monthMatch && monthMatch[1]) {
                      normalizedPhase.month_number = parseInt(monthMatch[1], 10);
                    }
                  }

                  // ✅ التأكد من أن المشروع الشهري يطابق معايير كفالة الأيتام
                  if (isOrphanSponsorshipProject(normalizedPhase)) {
                    const phaseMonthNumber = getMonthNumber(normalizedPhase);
                    const phaseStart = project.phase_start_date ?? project.phaseStartDate;
                    const currentProjectMonth = getCurrentProjectMonthFromStartDate(phaseStart);

                    // ✅ عند توفر تاريخ البداية: نضيف فقط مرحلة شهر المشروع الحالي (فبراير → الشهر 1، مارس → الشهر 2)
                    // ✅ عند عدم توفر تاريخ البداية: نضيف المرحلة إذا اليوم ضمن شهرها (من month_start_date أو execution_date)
                    const shouldAdd = currentProjectMonth !== null
                      ? phaseMonthNumber === currentProjectMonth
                      : isTodayInPhaseMonth(normalizedPhase);

                    if (shouldAdd) {
                      normalizedPhase.__display_month_name = getCalendarMonthNameForProjectMonth(phaseStart, phaseMonthNumber) || null;
                      monthlyPhasesFromParents.push(normalizedPhase);
                    }
                  }
                });
              }
            });

            // ✅ 2. البحث عن المشاريع الشهرية المرتبطة بالمشاريع الأصلية المقسمة في القائمة
            normalizedProjects.forEach((project) => {
              // ✅ إذا كان المشروع شهرياً وله parent_project_id
              if (project.is_monthly_phase && project.parent_project_id) {
                // ✅ التحقق من أن المشروع الأصلي موجود في القائمة ومقسم
                const parentProject = normalizedProjects.find(p => p.id === project.parent_project_id);
                if (parentProject && parentProject.is_divided_into_phases && isOrphanSponsorshipProject(parentProject)) {
                  // ✅ التأكد من أن المشروع الشهري يطابق معايير كفالة الأيتام
                  if (isOrphanSponsorshipProject(project) && !monthlyPhasesFromParents.find(p => p.id === project.id)) {
                    const projectMonthNumber = getMonthNumber(project);
                    const phaseStart = parentProject.phase_start_date ?? parentProject.phaseStartDate;
                    const currentProjectMonth = getCurrentProjectMonthFromStartDate(phaseStart);

                    // ✅ عند توفر تاريخ البداية: نضيف فقط مرحلة شهر المشروع الحالي
                    // ✅ عند عدم توفر تاريخ البداية: نضيف المرحلة إذا اليوم ضمن شهرها (من month_start_date أو execution_date)
                    const shouldAdd = currentProjectMonth !== null
                      ? projectMonthNumber === currentProjectMonth
                      : isTodayInPhaseMonth(project);

                    if (shouldAdd) {
                      project.__display_month_name = getCalendarMonthNameForProjectMonth(phaseStart, projectMonthNumber) || null;
                      monthlyPhasesFromParents.push(project);
                    }
                  }
                }
              }
            });

            if (monthlyPhasesFromParents.length > 0) {
              // ✅ منع التكرار: إضافة فقط المشاريع الشهرية التي ليست موجودة بالفعل في القائمة
              const existingProjectIds = new Set(expandedProjects.map(p => p.id));
              const uniqueMonthlyPhases = monthlyPhasesFromParents.filter(p => !existingProjectIds.has(p.id));

              if (uniqueMonthlyPhases.length > 0) {
                expandedProjects = [...expandedProjects, ...uniqueMonthlyPhases];
              }
            }
          }

          // ✅ منسق الكفالة: لا expansion — نعرض فقط ما يرجعه الـ API (normalizedProjects فقط، بدون monthlyPhasesFromParents)
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
              try {
                localStorage.setItem('projects_cache', JSON.stringify(cacheData));
              } catch (e) {
                console.warn('Error saving cache to localStorage:', e);
              }
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
            // ✅ غير منسق الكفالة: نستخدم expandedProjects (مع المراحل الشهرية إن وُجدت)
            if (expandedProjects && Array.isArray(expandedProjects) && expandedProjects.length > 0) {
              setProjects(expandedProjects);
              const cacheData = {
                data: expandedProjects,
                timestamp: Date.now(),
                filters: JSON.stringify(filters),
                maxAge: 120000,
              };
              cacheRef.current = cacheData;
              try {
                localStorage.setItem('projects_cache', JSON.stringify(cacheData));
              } catch (e) {
                console.warn('Error saving cache to localStorage:', e);
              }
            } else {
              setProjects([]);
              cacheRef.current = {
                data: null,
                timestamp: null,
                filters: null,
                maxAge: 120000,
              };
            }

            const currentPage = filters.page || 1;

            // ✅ للأدمن: إذا كان hide_child_projects=true، total في Response = 280 (للحسابات)
            const responseTotal = response.data.total || response.data.data?.total || 0;
            const metaInfo = response.data.meta || response.data.data?.meta || {};

            // ✅ حفظ حالة hide_child_projects من Backend
            const hideChildProjectsFromBackend = metaInfo.hide_child_projects === true || metaInfo.hide_child_projects === 'true';
            if (isAdmin) {
              setBackendHideChildProjects(hideChildProjectsFromBackend);
            }

            const actualTotal = metaInfo.actual_total_count || responseTotal;

            if (import.meta.env.DEV && isAdmin && hideChildProjectsFromBackend) {
              console.log('✅ ProjectsList (Admin): Pagination info (non-project-manager):', {
                actual_total_count: actualTotal, // 280 (للحسابات)
                displayed_projects_count: metaInfo.displayed_projects_count || normalizedProjects?.length || 0,
                projects_returned: normalizedProjects?.length || 0,
                hide_child_projects: hideChildProjectsFromBackend,
                message: 'Backend already filtered projects. Total (280) is for calculations, displayed projects exclude sub-projects. No additional Frontend filtering needed.'
              });
            }

            setPagination({
              current_page: currentPage,
              last_page: response.data.totalPages || response.data.data?.last_page || response.data.last_page || 1,
              per_page: response.data.perPage || response.data.data?.per_page || response.data.per_page || 10,
              total: actualTotal, // ✅ استخدام actualTotal (280) للحسابات الصحيحة
            });
          }
        } else {
          if (import.meta.env.DEV) {
            console.warn('⚠️ API returned success: false', response.data);
          }
          setProjects([]);
        }
      }
    } catch (error) {
      // ✅ تجاهل الأخطاء من الطلبات الملغاة (هذه أخطاء متوقعة وليست مشاكل)
      if (error.name === 'AbortError' ||
        error.code === 'ERR_CANCELED' ||
        error.message === 'canceled' ||
        abortControllerRef.current?.signal.aborted) {
        setLoading(false); // ✅ تعطيل loading عند إلغاء الطلب
        return; // لا نفعل شيء إذا تم إلغاء الطلب
      }

      // ✅ سجل الخطأ لمنسق الأيتام (فقط للأخطاء الحقيقية)
      if (isOrphanSponsorCoordinator && import.meta.env.DEV) {
        console.error('❌ Orphan Sponsor Coordinator - Error fetching projects:', {
          errorName: error.name,
          errorCode: error.code,
          errorMessage: error.message,
          responseStatus: error.response?.status,
          responseData: error.response?.data,
          isAborted: error.name === 'AbortError' || error.code === 'ERR_CANCELED',
        });
      }

      // ✅ إذا كان هناك بيانات في cache، استخدمها بدلاً من عرض خطأ
      if (cacheRef.current.data && cacheRef.current.data.length > 0) {
        setProjects(cacheRef.current.data);
        setLoading(false); // ✅ تعطيل loading عند استخدام cache
        return;
      }

      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('Error fetching projects:', error);
      }

      setProjects([]);

      // ✅ عدم عرض رسالة خطأ لـ timeout أو connection errors
      if (!error.isConnectionError && !error.isTimeoutError && error.userMessage) {
        toast.error(error.userMessage || 'حدث خطأ أثناء تحميل المشاريع');
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ تحديث قيمة البحث المكتوبة فقط (بدون تطبيق البحث)
  const handleSearchChange = useCallback((e) => {
    setSearchInput(e.target.value);
  }, []);

  // ✅ تطبيق البحث عند الضغط على Enter
  const handleSearchSubmit = useCallback((e) => {
    if (e.key === 'Enter') {
      setFilters(prev => ({ ...prev, searchQuery: searchInput, page: 1 }));
    }
  }, [searchInput]);

  // ✅ تطبيق البحث عند النقر على زر البحث
  const handleSearchButtonClick = useCallback(() => {
    setFilters(prev => ({ ...prev, searchQuery: searchInput, page: 1 }));
  }, [searchInput]);

  const handleFilterChange = useCallback((key, value) => {
    if (import.meta.env.DEV && key === 'show_divided_parents_only') {
    }
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchInput(''); // ✅ مسح حقل البحث المكتوب
    setFilters({
      status: [], // ✅ مصفوفة فارغة
      project_type: [], // ✅ مصفوفة فارغة
      searchQuery: '',
      page: 1,
      perPage: 'all', // ✅ القيمة الافتراضية: الكل
      phase_day: '',
      parent_project_id: '',
      subcategory_id: [], // ✅ مصفوفة فارغة
      researcher_id: '', // ✅ إعادة تعيين فلترة الباحث
      photographer_id: '', // ✅ إعادة تعيين فلترة المصور
      producer_id: '', // ✅ إعادة تعيين فلترة الممنتج
      show_delayed_only: false, // ✅ إعادة تعيين فلتر المشاريع المتأخرة
      show_divided_parents_only: false, // ✅ إعادة تعيين فلتر المشاريع الأصلية المقسمة
      show_urgent_only: false, // ✅ إعادة تعيين فلتر المشاريع العاجلة
      show_sub_projects_only: false, // ✅ إعادة تعيين فلتر المشاريع الفرعية
    });
  }, []);

  const handlePageChange = useCallback((newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  }, []);

  // ✅ ملاحظة: تمت إزالة useEffect التي كانت تفرض perPage = 'all' لدعم pagination السيرفر

  // دالة لتغيير عدد المشاريع المعروضة في الصفحة
  const handlePerPageChange = useCallback((newPerPage) => {
    setFilters(prev => ({ ...prev, perPage: newPerPage, page: 1 })); // إعادة تعيين الصفحة إلى 1 عند تغيير عدد العناصر
  }, []);

  // دالة للترتيب عند النقر على رأس العمود
  const handleSort = useCallback((key) => {
    setSortConfig(prev => {
      let direction = 'asc';

      // إذا كان نفس العمود، نغير الاتجاه
      if (prev.key === key && prev.direction === 'asc') {
        direction = 'desc';
      }

      // ✅ إعادة تعيين الصفحة إلى 1 عند تغيير الترتيب لضمان اتساق البيانات
      setFilters(prevFilters => ({ ...prevFilters, page: 1 }));

      return { key, direction };
    });
  }, []);

  // ✅ جلب أنواع المشاريع من API
  useEffect(() => {
    const fetchProjectTypes = async () => {
      setProjectTypesLoading(true);
      const maxRetries = 2; // ✅ محاولة إعادة الطلب مرتين إضافيتين
      let lastError = null;

      for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
        try {
          const response = await apiClient.get('/project-types', {
            params: {
              _t: Date.now(),
            },
            timeout: 30000, // ✅ زيادة timeout إلى 30 ثانية لتجنب timeout errors
            headers: {
              'Cache-Control': 'no-cache',
            }
          });

          if (response.data.success) {
            const data = response.data.data || response.data.types || [];
            if (data.length > 0) {
              // ✅ استخراج الأسماء من البيانات
              const types = data.map(type => {
                if (typeof type === 'string') return type;
                return type.name || type;
              });
              setProjectTypes(types);
              if (import.meta.env.DEV) {
              }
              setProjectTypesLoading(false);
              return; // ✅ نجح الطلب، اخرج من الدالة
            } else {
              // إذا كانت القائمة فارغة، استخدم الافتراضية
              setProjectTypes(DEFAULT_PROJECT_TYPES);
              if (import.meta.env.DEV) {
                console.warn('⚠️ No project types from API, using defaults');
              }
              setProjectTypesLoading(false);
              return;
            }
          } else {
            setProjectTypes(DEFAULT_PROJECT_TYPES);
            if (import.meta.env.DEV) {
              console.warn('⚠️ API response not successful, using defaults');
            }
            setProjectTypesLoading(false);
            return;
          }
        } catch (error) {
          lastError = error;
          // ✅ إعادة المحاولة في حالة timeout
          if ((error.code === 'ECONNABORTED' || error.isTimeoutError) && retryCount < maxRetries) {
            const waitTime = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff
            if (import.meta.env.DEV) {
              console.warn(`⚠️ Project types request timeout, retrying in ${waitTime}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            }
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // ✅ حاول مرة أخرى
          } else {
            // ✅ فشلت جميع المحاولات
            break;
          }
        }
      }

      // ✅ إذا وصلنا هنا، فشلت جميع المحاولات
      if (lastError) {
        if (import.meta.env.DEV && !lastError.isConnectionError) {
          console.error('Error fetching project types:', lastError);
        }
        // Fallback: استخدام الأنواع الافتراضية
        setProjectTypes(DEFAULT_PROJECT_TYPES);
        if (import.meta.env.DEV) {
          console.warn('⚠️ Failed to fetch project types, using defaults');
        }
      }
      setProjectTypesLoading(false);
    };

    fetchProjectTypes();
  }, []);

  // ✅ جلب التفريعات من API
  useEffect(() => {
    const fetchSubcategories = async () => {
      setSubcategoriesLoading(true);
      const maxRetries = 2; // ✅ محاولة إعادة الطلب مرتين إضافيتين
      let lastError = null;

      for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
        try {
          const response = await apiClient.get('/project-subcategories', {
            params: {
              _t: Date.now(),
            },
            timeout: 30000, // ✅ زيادة timeout إلى 30 ثانية لتجنب timeout errors
            headers: {
              'Cache-Control': 'no-cache',
            }
          });

          if (response.data.success) {
            const data = response.data.data || [];
            setSubcategories(data);
            setSubcategoriesLoading(false);
            return; // ✅ نجح الطلب، اخرج من الدالة
          }
        } catch (error) {
          lastError = error;
          // ✅ إعادة المحاولة في حالة timeout
          if ((error.code === 'ECONNABORTED' || error.isTimeoutError) && retryCount < maxRetries) {
            const waitTime = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff
            if (import.meta.env.DEV) {
              console.warn(`⚠️ Subcategories request timeout, retrying in ${waitTime}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            }
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // ✅ حاول مرة أخرى
          } else {
            // ✅ فشلت جميع المحاولات
            break;
          }
        }
      }

      // ✅ إذا وصلنا هنا، فشلت جميع المحاولات
      if (lastError) {
        if (import.meta.env.DEV && !lastError.isConnectionError) {
          console.error('Error fetching subcategories:', lastError);
        }
      }
      setSubcategoriesLoading(false);
    };

    fetchSubcategories();
  }, []);

  // ✅ تنظيف اختيارات التفريعات عند تغيير نوع المشروع
  useEffect(() => {
    // تجاهل التنظيف إذا لم يتم اختيار أي تفريعة
    if (!Array.isArray(filters.subcategory_id) || filters.subcategory_id.length === 0) {
      return;
    }

    // إذا لم يتم اختيار أي نوع مشروع، نحافظ على كل التفريعات المختارة
    if (!Array.isArray(filters.project_type) || filters.project_type.length === 0) {
      return;
    }

    // تصفية التفريعات المختارة لتبقي فقط تلك التي تنتمي للأنواع المختارة
    const validSubcategoryIds = subcategories
      .filter(subcat => filters.project_type.includes(subcat.project_type))
      .map(subcat => String(subcat.id));

    const cleanedSubcategoryIds = filters.subcategory_id.filter(id =>
      validSubcategoryIds.includes(id)
    );

    // إذا تغيرت القائمة، نحدث الفلتر
    if (cleanedSubcategoryIds.length !== filters.subcategory_id.length) {
      setFilters(prev => ({
        ...prev,
        subcategory_id: cleanedSubcategoryIds,
      }));
    }
  }, [filters.project_type, subcategories]);

  // ✅ جلب قوائم الباحثين والمصورين للفلترة
  useEffect(() => {
    const fetchFilterLists = async () => {
      if (!showFilters) return; // ✅ جلب البيانات فقط عند فتح الفلاتر

      setLoadingFilterLists(true);
      try {
        // جلب الباحثين
        try {
          const researchersResponse = await apiClient.get('/team-personnel/available', {
            params: {
              _t: Date.now(),
            },
            headers: {
              'Cache-Control': 'no-cache',
            }
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

        // جلب المصورين
        try {
          const photographersResponse = await apiClient.get('/photographers', {
            params: {
              per_page: 100, // ✅ تقليل من 1000 إلى 100
              _t: Date.now(),
            },
            headers: {
              'Cache-Control': 'no-cache',
            }
          });
          if (photographersResponse.data.success) {
            setPhotographers(photographersResponse.data.photographers || photographersResponse.data.data || []);
          }
        } catch (error) {
          setPhotographers([]); // ✅ عند فشل الطلب (مثلاً 500) نترك القائمة فارغة
          if (import.meta.env.DEV && error?.response?.status !== 500) {
            console.warn('Failed to fetch photographers:', error);
          }
        }

        // جلب ممنتجي المونتاج (لدور الإعلام فقط)
        if (isMediaManager) {
          try {
            const producersResponse = await apiClient.get('/montage-producers/list', {
              params: {
                _t: Date.now(),
              },
              headers: {
                'Cache-Control': 'no-cache',
              }
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
  }, [showFilters, isMediaManager]);

  // ✅ جلب القوائم المطلوبة للفلترة المتقدمة
  useEffect(() => {
    const fetchFilterData = async () => {
      if (!isExportFilterModalOpen) return; // ✅ جلب البيانات فقط عند فتح modal التصدير

      setLoadingFilterData(true);
      try {
        // جلب الفرق
        try {
          const teamsResponse = await apiClient.get('/teams', {
            params: {
              per_page: 100, // ✅ تقليل من 1000 إلى 100
              _t: Date.now(), // ✅ cache busting
            },
            headers: {
              'Cache-Control': 'no-cache',
            }
          });
          if (teamsResponse.data.success) {
            setTeams(teamsResponse.data.teams || teamsResponse.data.data || []);
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('Failed to fetch teams:', error);
          }
        }

        // جلب المصورين
        try {
          const photographersResponse = await apiClient.get('/photographers', {
            params: {
              per_page: 100, // ✅ تقليل من 1000 إلى 100
              _t: Date.now(), // ✅ cache busting
            },
            headers: {
              'Cache-Control': 'no-cache',
            }
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

        // جلب المخيمات
        try {
          const sheltersResponse = await apiClient.get('/shelters', { params: { per_page: 200 } }); // ✅ تقليل من 1000 إلى 200
          if (sheltersResponse.data.success) {
            const sheltersList = sheltersResponse.data.shelters || sheltersResponse.data.data || [];
            setShelters(sheltersList);

            // استخراج المحافظات والمناطق الفريدة
            const uniqueGovernorates = [...new Set(sheltersList.map(s => s.governorate).filter(Boolean))].sort();
            setGovernorates(uniqueGovernorates);

            // استخراج المناطق بناءً على المحافظة المختارة
            if (exportFilters.governorate) {
              const filteredDistricts = [...new Set(
                sheltersList
                  .filter(s => s.governorate === exportFilters.governorate)
                  .map(s => s.district)
                  .filter(Boolean)
              )].sort();
              setDistricts(filteredDistricts);
            } else {
              const allDistricts = [...new Set(sheltersList.map(s => s.district).filter(Boolean))].sort();
              setDistricts(allDistricts);
            }
          }
        } catch (error) {
          console.warn('Failed to fetch shelters:', error);
        }
      } catch (error) {
        console.error('Error fetching filter data:', error);
      } finally {
        setLoadingFilterData(false);
      }
    };

    fetchFilterData();
  }, [isExportFilterModalOpen, exportFilters.governorate]);

  // ✅ تحديث المناطق عند تغيير المحافظة
  useEffect(() => {
    if (exportFilters.governorate && shelters.length > 0) {
      const filteredDistricts = [...new Set(
        shelters
          .filter(s => s.governorate === exportFilters.governorate)
          .map(s => s.district)
          .filter(Boolean)
      )].sort();
      setDistricts(filteredDistricts);
      // ✅ إعادة تعيين المنطقة إذا كانت المحافظة تغيرت
      if (exportFilters.district && !filteredDistricts.includes(exportFilters.district)) {
        setExportFilters(prev => ({ ...prev, district: '' }));
      }
    } else if (shelters.length > 0) {
      const allDistricts = [...new Set(shelters.map(s => s.district).filter(Boolean))].sort();
      setDistricts(allDistricts);
    }
  }, [exportFilters.governorate, shelters]);

  // إعادة تعيين فلاتر التصدير
  const resetExportFilters = () => {
    setExportFilters({
      status: [], // ✅ مصفوفة فارغة
      project_type: [], // ✅ مصفوفة فارغة
      startDate: '',
      endDate: '',
      team_id: '',
      photographer_id: '',
      shelter_id: '',
      governorate: '',
      district: '',
      donor_name: '',
      donor_code: '',
      quantity_min: '',
      quantity_max: '',
      cost_min: '',
      cost_max: '',
      created_at_start: '',
      created_at_end: '',
      updated_at_start: '',
      updated_at_end: '',
    });
    // ✅ إعادة تعيين الأعمدة المختارة إلى الافتراضية (للمديرين)
    if (isAdmin) {
      setSelectedColumns(availableColumns.filter(col => col.default).map(col => col.key));
    }
  };

  // ✅ تبديل اختيار عمود
  const toggleColumn = (columnKey) => {
    setSelectedColumns(prev => {
      if (prev.includes(columnKey)) {
        return prev.filter(key => key !== columnKey);
      } else {
        return [...prev, columnKey];
      }
    });
  };

  // ✅ تحديد/إلغاء تحديد جميع الأعمدة
  const toggleAllColumns = (selectAll) => {
    if (selectAll) {
      setSelectedColumns(availableColumns.map(col => col.key));
    } else {
      setSelectedColumns([]);
    }
  };

  // تأكيد التصدير
  const handleConfirmExport = async () => {
    if (isDownloading) return;

    // ✅ التحقق من التواريخ قبل البدء
    if (exportFilters.startDate && exportFilters.endDate) {
      const startDate = new Date(exportFilters.startDate);
      const endDate = new Date(exportFilters.endDate);

      if (startDate > endDate) {
        toast.error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
        return;
      }
    }

    // ✅ التحقق من صيغة التاريخ (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (exportFilters.startDate && !dateRegex.test(exportFilters.startDate)) {
      toast.error('صيغة تاريخ البداية غير صحيحة. يجب أن تكون بصيغة YYYY-MM-DD');
      return;
    }
    if (exportFilters.endDate && !dateRegex.test(exportFilters.endDate)) {
      toast.error('صيغة تاريخ النهاية غير صحيحة. يجب أن تكون بصيغة YYYY-MM-DD');
      return;
    }

    setIsDownloading(true);
    try {
      // ✅ تعريف المتغير الذي سيحتوي على المشاريع المراد تصديرها
      let projectsToExport = [];

      // جلب المشاريع مع الفلاتر المحددة
      const params = {
        per_page: 500, // ✅ تقليل من 10000 إلى 500 لتحسين الأداء
      };

      if (exportFilters.status && Array.isArray(exportFilters.status) && exportFilters.status.length > 0) {
        // ✅ إرسال المصفوفة مباشرة - axios سيقوم بتحويلها تلقائياً إلى status[]=value1&status[]=value2
        params.status = exportFilters.status;
      }
      if (exportFilters.project_type && Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0) {
        // ✅ إرسال المصفوفة مباشرة - axios سيقوم بتحويلها تلقائياً إلى project_type[]=value1&project_type[]=value2
        params.project_type = exportFilters.project_type;
      }
      if (exportFilters.startDate) {
        params.start_date = exportFilters.startDate;
      }
      if (exportFilters.endDate) {
        params.end_date = exportFilters.endDate;
      }
      if (exportFilters.researcher_id) {
        params.researcher_id = exportFilters.researcher_id;
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

      // ✅ محاولة استخدام API endpoint مخصص للتصدير أولاً (إذا كان متوفراً)
      // إذا لم يكن متوفراً، نستخدم الطريقة الحالية (جلب البيانات وإنشاء Excel في Frontend)
      let useExportEndpoint = false; // ✅ يمكن تفعيله إذا كان الـ Backend يدعم /project-proposals/export/excel

      if (useExportEndpoint) {
        try {
          // ✅ استخدام API endpoint مخصص للتصدير
          const exportResponse = await apiClient.get('/project-proposals/export/excel', {
            params: {
              ...params,
              _t: Date.now(),
            },
            paramsSerializer: paramsSerializer,
            responseType: 'blob', // ✅ مهم: يجب أن يكون blob لتحميل الملف
            headers: {
              'Cache-Control': 'no-cache',
              'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
          });

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
      // ✅ إعداد params مع معالجة خاصة للحالات المتعددة
      const requestParams = { ...params };


      // ✅ إذا كانت هناك حالات محددة (واحدة أو أكثر)، نستخدم طريقة الطلبات المنفصلة مباشرة
      // لأنها تعمل مع أي Backend حتى لو لم يدعم حالات متعددة
      if (Array.isArray(requestParams.status) && requestParams.status.length > 0) {

        try {
          // ✅ إرسال طلبات منفصلة لكل حالة ثم دمج النتائج
          const statusPromises = requestParams.status.map(status => {
            // ✅ إنشاء نسخة جديدة من المعاملات بدون status
            const { status: _, ...otherParams } = requestParams;
            // ✅ إضافة status كقيمة واحدة فقط
            const singleStatusParams = {
              ...otherParams,
              status: status // ✅ حالة واحدة فقط
            };


            return apiClient.get('/project-proposals', {
              params: {
                ...singleStatusParams,
                _t: Date.now(),
                // ✅ إضافة معاملات لجلب جميع المشاريع بما فيها المنتهية
                include_all_statuses: true,
                include_finished: true,
              },
              headers: {
                'Cache-Control': 'no-cache',
              }
            }).catch(error => {
              // ✅ معالجة الأخطاء لكل طلب على حدة - لا نريد أن يفشل الطلب بالكامل إذا فشل أحد الطلبات
              if (import.meta.env.DEV) {
                console.warn(`⚠️ فشل جلب المشاريع للحالة "${status}":`, {
                  status,
                  error: error?.response?.data || error?.message || error,
                  statusCode: error?.response?.status,
                  responseData: error?.response?.data,
                });
              }
              // ✅ إرجاع كائن فارغ بدلاً من رمي خطأ
              return { data: { success: false, projects: [], data: [] } };
            });
          });

          const statusResponses = await Promise.all(statusPromises);

          // ✅ دمج جميع المشاريع من جميع الحالات
          const allProjects = [];
          const projectIds = new Set(); // ✅ لتجنب التكرار

          statusResponses.forEach((statusResponse, index) => {
            // ✅ معالجة أفضل للاستجابة - التحقق من وجود البيانات حتى لو لم يكن success: true
            const responseData = statusResponse?.data;

            // ✅ محاولة جلب المشاريع من أماكن مختلفة في الاستجابة
            let statusProjects = [];

            if (responseData) {
              // ✅ إذا كانت الاستجابة تحتوي على success: true
              if (responseData.success) {
                statusProjects = responseData.projects || responseData.data || [];
              }
              // ✅ إذا كانت الاستجابة تحتوي على projects مباشرة (حتى بدون success)
              else if (responseData.projects) {
                statusProjects = Array.isArray(responseData.projects) ? responseData.projects : [];
              }
              // ✅ إذا كانت الاستجابة تحتوي على data مباشرة
              else if (responseData.data) {
                statusProjects = Array.isArray(responseData.data) ? responseData.data : [];
              }
            }

            // ✅ إضافة المشاريع مع التحقق من وجود id
            statusProjects.forEach(project => {
              if (!project) return; // ✅ تخطي المشاريع الفارغة

              // ✅ استخدام id أو _id حسب ما هو متوفر
              const projectId = project.id || project._id;

              if (projectId) {
                // ✅ إضافة المشروع فقط إذا لم يكن موجوداً من قبل (تجنب التكرار)
                if (!projectIds.has(projectId)) {
                  projectIds.add(projectId);
                  allProjects.push(project);
                }
              } else {
                // ✅ إذا لم يكن هناك id، نضيف المشروع مباشرة (قد يكون هناك مشاريع بدون id)
                allProjects.push(project);
              }
            });

          });


          if (allProjects.length > 0) {

            // ✅ تطبيع المشاريع قبل التصدير لضمان توفر جميع الحقول
            projectsToExport = allProjects.map(project => {
              const normalized = normalizeProjectRecord(project);
              // ✅ التأكد من وجود quantity في البيانات المطبعة
              // ✅ محاولة جلب quantity من عدة مصادر
              if (!normalized.quantity && (normalized.total_quantity !== null && normalized.total_quantity !== undefined)) {
                normalized.quantity = normalized.total_quantity;
              }
              return normalized;
            });
          } else {
            // ✅ رسالة أكثر تفصيلاً للمستخدم
            const statusesText = requestParams.status.join(' و ');
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
        // ✅ إذا كانت هناك حالة واحدة فقط أو لا توجد حالات، نستخدم الطريقة العادية
        const response = await apiClient.get('/project-proposals', {
          params: {
            ...requestParams,
            _t: Date.now(), // ✅ cache busting
            // ✅ إضافة معاملات لجلب جميع المشاريع بما فيها المنتهية
            include_all_statuses: true,
            include_finished: true,
          },
          headers: {
            'Cache-Control': 'no-cache',
          }
        });


        // ✅ معالجة أفضل للاستجابة - التحقق من وجود البيانات حتى لو لم يكن success: true
        let rawProjects = [];

        if (response.data) {
          // ✅ إذا كانت الاستجابة تحتوي على success: true
          if (response.data.success) {
            rawProjects = response.data.projects || response.data.data || [];
          }
          // ✅ إذا كانت الاستجابة تحتوي على projects مباشرة (حتى بدون success)
          else if (response.data.projects) {
            rawProjects = Array.isArray(response.data.projects) ? response.data.projects : [];
          }
          // ✅ إذا كانت الاستجابة تحتوي على data مباشرة
          else if (response.data.data) {
            rawProjects = Array.isArray(response.data.data) ? response.data.data : [];
          }

          // ✅ إذا لم نجد مشاريع وكان هناك رسالة خطأ، نعرضها
          if (rawProjects.length === 0 && response.data.message && !response.data.success) {
            const errorMessage = response.data.message || 'فشل جلب البيانات للتصدير';
            toast.error(errorMessage);
            setIsDownloading(false);
            return;
          }
        }

        // ✅ إذا لم نجد مشاريع على الإطلاق
        if (rawProjects.length === 0) {
          const statusText = Array.isArray(requestParams.status)
            ? requestParams.status.join(' و ')
            : requestParams.status || 'المحددة';
          toast.warning(`لا توجد مشاريع للتصدير تطابق المعايير المحددة (الحالات: ${statusText})`);
          setIsDownloading(false);
          return;
        }
        // ✅ تطبيع المشاريع قبل التصدير لضمان توفر جميع الحقول
        projectsToExport = rawProjects.map(project => {
          const normalized = normalizeProjectRecord(project);
          // ✅ التأكد من وجود quantity في البيانات المطبعة
          // ✅ محاولة جلب quantity من عدة مصادر
          if (!normalized.quantity && (normalized.total_quantity !== null && normalized.total_quantity !== undefined)) {
            normalized.quantity = normalized.total_quantity;
          }
          return normalized;
        });
      }

      // ✅ تصفية على العميل حسب نوع المشروع (في حال الـ API لم يطبق الفلتر)
      if (exportFilters.project_type && Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0) {
        projectsToExport = projectsToExport.filter((project) => {
          const typeName = project.project_type == null ? ''
            : (typeof project.project_type === 'object' && project.project_type !== null)
              ? (project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '')
              : String(project.project_type);
          return typeName && exportFilters.project_type.includes(typeName);
        });
      }

      // ✅ معالجة حالة عدم وجود مشاريع (404 أو قائمة فارغة)
      if (!projectsToExport || projectsToExport.length === 0) {
        toast.warning('لا توجد مشاريع للتصدير تطابق المعايير المحددة');
        return;
      }

      // ✅ جلب بيانات التوريد للمشاريع إذا كان عمود quantity مطلوباً
      const columnsToExport = selectedColumns.length > 0
        ? selectedColumns
        : availableColumns.filter(col => col.default).map(col => col.key);

      const needsQuantity = columnsToExport.includes('quantity');
      if (needsQuantity && projectsToExport.length > 0) {
        // ✅ جلب بيانات التوريد للمشاريع التي لا تحتوي على quantity
        const projectsNeedingQuantity = projectsToExport.filter(p =>
          !p.quantity && p.quantity !== 0
        );

        if (projectsNeedingQuantity.length > 0) {
          try {
            // ✅ Process requests sequentially with delays to avoid rate limiting
            const REQUEST_DELAY = 300; // milliseconds between requests
            const MAX_RETRIES = 2;

            for (const project of projectsNeedingQuantity) {
              let retryCount = 0;
              let success = false;

              while (retryCount <= MAX_RETRIES && !success) {
                try {
                  const response = await apiClient.get(`/projects/${project.id}/warehouse`);
                  if (response.data.success) {
                    const data = response.data.data || response.data;
                    const quantity = data.project?.quantity || data.quantity || null;
                    if (quantity !== null && quantity !== undefined) {
                      project.quantity = quantity;
                    }
                    success = true;
                  }
                } catch (error) {
                  // ✅ Handle 429 errors with Retry-After header support
                  if (error.response?.status === 429) {
                    const retryAfter = error.response?.headers?.['retry-after'] ||
                      error.response?.headers?.['Retry-After'];
                    const waitTime = retryAfter
                      ? parseInt(retryAfter) * 1000
                      : Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s

                    if (retryCount < MAX_RETRIES) {
                      if (import.meta.env.DEV) {
                        console.warn(`⚠️ Rate limited for project ${project.id} (export), waiting ${waitTime}ms before retry ${retryCount + 1}/${MAX_RETRIES}`);
                      }
                      await new Promise(resolve => setTimeout(resolve, waitTime));
                      retryCount++;
                      continue;
                    } else {
                      // Max retries reached, skip this project
                      if (import.meta.env.DEV) {
                        console.warn(`⚠️ Max retries reached for project ${project.id} (export), skipping`);
                      }
                      success = true; // Exit loop
                    }
                  } else {
                    // Other errors - skip this project
                    if (import.meta.env.DEV) {
                      console.warn(`⚠️ Failed to fetch quantity for project ${project.id}:`, error);
                    }
                    success = true; // Exit loop
                  }
                }
              }

              // ✅ Delay between requests to avoid rate limiting
              if (projectsNeedingQuantity.indexOf(project) < projectsNeedingQuantity.length - 1) {
                await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
              }
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn('⚠️ Error fetching supply data for export:', error);
            }
          }
        }
      }

      // ✅ إعداد البيانات للتصدير
      const excelData = projectsToExport.map(project => {
        const row = {};


        columnsToExport.forEach(columnKey => {
          const column = availableColumns.find(col => col.key === columnKey);
          if (!column) return;

          let value = '-';
          switch (columnKey) {
            case 'serial_number':
              value = getProjectCode(project, project.id?.toString() || '-');
              break;
            case 'project_name':
              value = project.project_name || '-';
              break;
            case 'project_description':
              // ✅ قص الوصف إذا كان طويل جداً (أكثر من 500 حرف)
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
              // ✅ استخدام quantity مباشرة من project object (من الجدول)
              // ✅ محاولة جلب القيمة من عدة مصادر محتملة
              let quantityValue = project.quantity ??
                project.total_quantity ??
                project.warehouse_quantity ??
                project.supply_quantity ??
                null;

              // ✅ محاولة جلبها من بيانات التوريد إذا كانت متوفرة
              if ((quantityValue === null || quantityValue === undefined || quantityValue === '') &&
                projectsSupplyData && projectsSupplyData[project.id]) {
                quantityValue = projectsSupplyData[project.id].quantity;
              }

              // ✅ محاولة جلبها من supply_data إذا كانت متوفرة
              if ((quantityValue === null || quantityValue === undefined || quantityValue === '') &&
                project.supply_data && project.supply_data.quantity) {
                quantityValue = project.supply_data.quantity;
              }

              // ✅ محاولة جلبها من warehouse_data إذا كانت متوفرة
              if ((quantityValue === null || quantityValue === undefined || quantityValue === '') &&
                project.warehouse_data && project.warehouse_data.quantity) {
                quantityValue = project.warehouse_data.quantity;
              }

              // ✅ Debug: تسجيل إذا لم نجد quantity
              if (import.meta.env.DEV && (quantityValue === null || quantityValue === undefined || quantityValue === '')) {
                console.warn('⚠️ Quantity not found for project:', {
                  projectId: project.id,
                  projectName: project.project_name,
                  availableFields: Object.keys(project).filter(key =>
                    key.toLowerCase().includes('quantity') ||
                    key.toLowerCase().includes('supply') ||
                    key.toLowerCase().includes('warehouse')
                  ),
                });
              }

              // ✅ إذا كانت القيمة 0، نعرضها كـ 0 وليس '-'
              if (quantityValue !== null && quantityValue !== undefined && quantityValue !== '') {
                // ✅ تحويل إلى رقم للتأكد من التنسيق الصحيح
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
            case 'shelter_address':
              const shelter = project.shelter;
              if (shelter?.governorate && shelter?.district) {
                value = `${shelter.governorate} - ${shelter.district}`;
              } else if (shelter?.detailed_address) {
                value = shelter.detailed_address;
              } else {
                value = '-';
              }
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
            case 'updated_at':
              if (project.updated_at) {
                try {
                  const date = new Date(project.updated_at);
                  value = !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '-';
                } catch (e) {
                  value = '-';
                }
              } else {
                value = '-';
              }
              break;
            case 'notes':
              // ✅ قص الملاحظات إذا كانت طويلة جداً (أكثر من 1000 حرف)
              const notes = project.notes || '';
              value = notes ? (notes.length > 1000 ? notes.substring(0, 1000) + '...' : notes) : '-';
              break;
            case 'photographer_name':
              value = project.assigned_photographer?.name ||
                project.photographer?.name ||
                project.photographer_name || '-';
              break;
            case 'researcher_name':
              value = project.assigned_researcher?.name ||
                project.researcher?.name ||
                project.researcher_name || '-';
              break;
            case 'cost':
              const costValue = project.cost || project.total_cost || project.total_supply_cost;
              value = (costValue !== null && costValue !== undefined && costValue !== '')
                ? parseFloat(costValue).toFixed(2)
                : '-';
              break;
            case 'supply_cost_shekel':
              // ✅ محاولة الحصول على تكلفة التوريد بالشيكل من عدة مصادر
              let supplyCostShekel = project.supply_cost_shekel || project.total_supply_cost_shekel;

              // ✅ إذا لم يكن موجوداً مباشرة، حاول حسابه من total_supply_cost مع سعر الصرف
              if (!supplyCostShekel && project.total_supply_cost) {
                const supplyCostUSD = parseFloat(project.total_supply_cost || 0);
                if (supplyCostUSD > 0 && project.shekel_exchange_rate) {
                  const exchangeRate = parseFloat(project.shekel_exchange_rate);
                  supplyCostShekel = supplyCostUSD * exchangeRate;
                }
              }

              // ✅ إذا لم يكن موجوداً، حاول من cost مع سعر الصرف
              if (!supplyCostShekel && project.cost && project.shekel_exchange_rate) {
                const costUSD = parseFloat(project.cost || 0);
                if (costUSD > 0) {
                  const exchangeRate = parseFloat(project.shekel_exchange_rate);
                  supplyCostShekel = costUSD * exchangeRate;
                }
              }

              if (supplyCostShekel !== null && supplyCostShekel !== undefined && supplyCostShekel !== '') {
                const numValue = parseFloat(supplyCostShekel);
                value = Number.isFinite(numValue) ? `₪${numValue.toFixed(2)}` : '-';
              } else {
                value = '-';
              }
              break;
            case 'net_amount_usd':
              const netValue = project.net_amount_usd || project.net_amount;
              value = (netValue !== null && netValue !== undefined && netValue !== '')
                ? `$${parseFloat(netValue).toFixed(2)}`
                : '-';
              break;
            case 'net_amount_shekel_after_supply':
              // ✅ محاولة الحصول على المبلغ بالشيكل من عدة مصادر
              let shekelAmount = project.net_amount_shekel || project.netAmountShekel;

              // إذا لم يكن موجوداً، حاول حسابه من سعر الصرف
              if (!shekelAmount && project.shekel_exchange_rate && (project.net_amount || project.net_amount_usd)) {
                const netAmt = parseFloat(project.net_amount || project.net_amount_usd || 0);
                const exchangeRate = parseFloat(project.shekel_exchange_rate);
                shekelAmount = netAmt * exchangeRate;
              }

              if (shekelAmount && shekelAmount > 0) {
                value = `₪${parseFloat(shekelAmount).toFixed(2)}`;
              } else {
                value = '-';
              }
              break;
            case 'deficit_surplus_status':
              // حساب العجز/الفائض
              const netAmt = parseFloat(project.net_amount || project.net_amount_usd || 0);
              const totalCost = parseFloat(project.cost || project.total_cost || project.total_supply_cost || 0);
              if (totalCost > 0 && netAmt > 0) {
                const surplus = netAmt - totalCost;
                value = surplus >= 0 ? 'فائض' : 'عجز';
              } else {
                value = '-';
              }
              break;
            case 'deficit_surplus_amount':
              // حساب قيمة العجز/الفائض
              const netAmount = parseFloat(project.net_amount || project.net_amount_usd || 0);
              const cost = parseFloat(project.cost || project.total_cost || project.total_supply_cost || 0);
              if (cost > 0 && netAmount > 0) {
                const surplusAmount = netAmount - cost;
                value = Math.abs(surplusAmount).toFixed(2);
              } else {
                value = '-';
              }
              break;
            case 'priority':
              value = project.priority || '-';
              break;
            case 'is_daily_phase':
              value = (project.is_daily_phase || project.isDailyPhase) ? 'نعم' : 'لا';
              break;
            case 'is_divided_into_phases':
              value = (project.is_divided_into_phases || project.isDividedIntoPhases) ? 'نعم' : 'لا';
              break;
            case 'phase_duration_days':
              value = project.phase_duration_days || project.phaseDurationDays || '-';
              break;
            case 'phase_start_date':
              if (project.phase_start_date) {
                try {
                  const date = new Date(project.phase_start_date);
                  value = !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '-';
                } catch (e) {
                  value = '-';
                }
              } else {
                value = '-';
              }
              break;
            default:
              value = project[columnKey] || '-';
          }

          row[column.label] = value;
        });

        return row;
      });
      // this is the section three **************************
      // ✅ إزالة الأعمدة الفارغة تماماً
      const cleanedData = excelData.map(row => {
        const cleanRow = {};
        Object.keys(row).forEach(key => {
          // التأكد من أن القيمة ليست null أو undefined
          const value = row[key];
          cleanRow[key] = (value === null || value === undefined || value === '') ? '-' : value;
        });
        return cleanRow;
      });

      // ✅ فحص الأعمدة وإزالة الأعمدة الفارغة تماماً
      // ✅ لكن نحتفظ بالأعمدة المهمة (default: true) حتى لو كانت فارغة
      const columnsToKeep = {};
      if (cleanedData.length > 0) {
        Object.keys(cleanedData[0]).forEach(columnName => {
          // ✅ التحقق من أن هذا العمود مهم (default: true) أو موجود في columnsToExport
          const column = availableColumns.find(col => col.label === columnName);
          const isImportantColumn = column && (column.default || columnsToExport.includes(column.key));

          // التحقق من وجود قيمة في أي صف (بما في ذلك القيمة 0)
          const hasValue = cleanedData.some(row => {
            const val = row[columnName];
            // ✅ القيمة 0 تعتبر قيمة صحيحة
            return val !== '-' && val !== '' && val !== null && val !== undefined;
          });

          // ✅ نحتفظ بالعمود إذا كان له قيمة أو كان عموداً مهماً
          if (hasValue || isImportantColumn) {
            columnsToKeep[columnName] = true;
          }
        });
      }

      // ✅ إنشاء البيانات النهائية بدون الأعمدة الفارغة
      const finalData = cleanedData.map(row => {
        const finalRow = {};
        Object.keys(row).forEach(key => {
          if (columnsToKeep[key]) {
            finalRow[key] = row[key];
          }
        });
        return finalRow;
      });

      // 📊 عرض معلومات التصدير
      const originalColumns = cleanedData.length > 0 ? Object.keys(cleanedData[0]).length : 0;
      const finalColumns = Object.keys(columnsToKeep).length;
      const removedColumns = originalColumns - finalColumns;


      const columnWidths = columnsToExport
        .filter(columnKey => {
          const column = availableColumns.find(col => col.key === columnKey);
          return column && columnsToKeep[column.label];
        })
        .map(columnKey => {
          const column = availableColumns.find(col => col.key === columnKey);
          if (!column) return 15;
          const widthMap = {
            'serial_number': 12,
            'project_name': 25,
            'project_description': 30,
            'project_type': 12,
            'status': 15,
            'donor_name': 20,
            'donor_code': 12,
            'quantity': 10,
            'beneficiaries_count': 15,
            'team_name': 20,
            'shelter_name': 25,
            'shelter_address': 35,
            'execution_date': 20,
            'created_at': 20,
            'updated_at': 20,
            'notes': 40,
            'photographer_name': 20,
            'researcher_name': 20,
            'cost': 15,
            'supply_cost_shekel': 20,
            'net_amount_usd': 18,
            'net_amount_shekel_after_supply': 25,
            'deficit_surplus_status': 15,
            'deficit_surplus_amount': 18,
            'priority': 12,
            'is_daily_phase': 12,
            'is_divided_into_phases': 15,
            'phase_duration_days': 15,
            'phase_start_date': 20,
          };
          return widthMap[columnKey] || 15;
        });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('المشاريع');
      const keys = finalData.length ? Object.keys(finalData[0]) : [];
      worksheet.columns = keys.map((k, i) => ({ header: k, key: k, width: columnWidths[i] || 15 }));
      worksheet.addRows(finalData);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const filename = `مشاريع_${year}${month}${day}`;

      await downloadWorkbookAsFile(workbook, `${filename}.xlsx`);

      const columnCount = columnsToExport.length;
      toast.success(`تم تحميل ملف Excel بنجاح! (${projectsToExport.length} مشروع، ${columnCount} عمود)`);

      // إغلاق الـ Modal
      setIsExportFilterModalOpen(false);
    } catch (error) {
      console.error('Error exporting projects:', error);

      // ✅ معالجة الأخطاء المختلفة حسب التوثيق
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        switch (status) {
          case 404:
            // ✅ لا توجد مشاريع تطابق المعايير
            toast.warning(errorData?.message || 'لا توجد مشاريع للتصدير تطابق المعايير المحددة');
            break;
          case 400:
            // ✅ خطأ في البيانات المرسلة
            toast.error(errorData?.message || 'خطأ في البيانات المرسلة. يرجى التحقق من الفلاتر المحددة');
            break;
          case 500:
            // ✅ خطأ في الخادم
            toast.error('حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً');
            break;
          default:
            // ✅ خطأ عام
            toast.error(errorData?.message || 'حدث خطأ أثناء التصدير');
        }
      } else if (error.request) {
        // ✅ خطأ في الاتصال
        toast.error('لا يمكن الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت');
      } else {
        // ✅ خطأ عام
        toast.error(error.message || 'حدث خطأ أثناء التصدير');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClearAssignedTeam = async (project) => {
    if (!project?.id) return;
    if (!window.confirm('هل أنت متأكد من إزالة الفريق المكلف والمصور من هذا المشروع؟')) {
      return;
    }

    setClearingAssignmentId(project.id);
    try {
      const response = await apiClient.post(`/project-proposals/${project.id}/assign`, {
        assigned_to_team_id: null,
        assigned_photographer_id: null,
      });

      if (response.data.success) {
        toast.success(response.data.message || 'تم إزالة الفريق المكلف بنجاح');
        // ✅ إبطال الكاش بعد التحديث
        forceRefreshCache();
        invalidateCache('projects');
        fetchProjects({ forceRefresh: true });
      } else {
        toast.error(response.data.message || 'فشل إزالة الفريق المكلف');
      }
    } catch (error) {
      console.error('Error clearing assigned team:', error);
      toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء إزالة الفريق المكلف');
    } finally {
      setClearingAssignmentId(null);
    }
  };

  const getStatusColor = useCallback((status) => {
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
  }, []);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  }, []);

  const formatDate = useCallback((date) => {
    if (!date) return 'غير محدد';
    // ✅ تنسيق التاريخ بصيغة الأرقام: 11/10/2025
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  const getTodayLabel = useCallback(() => {
    const now = new Date();
    // ✅ استخدام locale إنجليزي لضمان عرض التاريخ الميلادي
    const dayName = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(now);
    const dayMonth = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit' }).format(now);
    return `${dayName} ${dayMonth}`;
  }, []);

  const getProjectDescription = useCallback((project) => {
    const description = project?.project_description || project?.description || project?.title;
    // ✅ إذا كان الوصف فارغاً أو null، نعرض "----"
    return description?.trim() || '----';
  }, []);

  const getAssignedTeamName = (project) => {
    return (
      project?.assigned_team?.team_name ||
      project?.assignedTeam?.team_name ||
      project?.assigned_to_team?.team_name ||
      project?.team?.team_name ||
      project?.team_name ||
      project?.assigned_team_name ||
      project?.teamLabel ||
      project?.team_label ||
      '-'
    );
  };

  const canEditAssignment = (project) => {
    // ✅ السماح بإعادة تعديل الفريق المكلف في:
    // - جميع الحالات ما بعد التوريد (تم التوريد، مسند لباحث، جاهز للتنفيذ، قيد التنفيذ، تم التنفيذ)
    // - حالات المونتاج (في المونتاج، تم المونتاج، معاد مونتاجه)
    // - وصل للمتبرع
    // - جميع الحالات ما عدا المنتهي
    // ❌ منع التعديل فقط في حالة: منتهي
    const restrictedStatuses = ['منتهي'];
    return !restrictedStatuses.includes(project?.status);
  };

  // ✅ السماح بإسناد الباحث بعد مرحلة "تم التوريد" (وللمراحل اللاحقة)
  const canAssignResearcherAfterSupply = (project) => {
    const status = project?.status;
    if (!status) return false;

    const allowedStatuses = [
      'تم التوريد',
      'مسند لباحث',
      'جاهز للتنفيذ',
      'قيد التنفيذ',
      'تم التنفيذ',
      'في المونتاج',
      'تم المونتاج',
      'يجب إعادة المونتاج',
      'وصل للمتبرع',
    ];

    return allowedStatuses.includes(status);
  };

  // ✅ التحقق من إمكانية تأجيل المشروع (قبل التنفيذ)
  const canPostponeProject = (project) => {
    const status = project?.status;
    const postponedStatuses = ['مؤجل'];
    const executionStatuses = ['قيد التنفيذ', 'تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'وصل للمتبرع'];

    // لا يمكن تأجيل المشروع إذا كان مؤجلاً بالفعل أو في مرحلة التنفيذ
    if (postponedStatuses.includes(status) || executionStatuses.includes(status)) {
      return false;
    }

    return true;
  };


  // ✅ فتح نافذة صور الملاحظات إن وُجدت عدة صور، وإلا تنزيل الصورة مباشرة
  const handleProjectImagesClick = async (project) => {
    try {
      const projectId = project.id;
      // جلب بيانات المشروع لمعرفة note_images
      setNoteImagesModalLoading(true);
      setNoteImagesModalProject(project);
      setNoteImagesModalImages([]);

      const response = await apiClient.get(`/project-proposals/${projectId}`, {
        timeout: 15000,
      });

      const payload = response.data?.project || response.data?.data || response.data?.result || response.data;
      const noteImages = payload?.note_images || payload?.noteImages || [];

      if (Array.isArray(noteImages) && noteImages.length > 1) {
        setNoteImagesModalImages(noteImages);
        setNoteImagesModalOpen(true);
        setNoteImagesModalLoading(false);
        return;
      }

      // صورة واحدة أو لا توجد note_images → نستخدم منطق التنزيل الحالي
      setNoteImagesModalLoading(false);
      setNoteImagesModalProject(null);
      await handleDownloadProjectImage(project);
    } catch (error) {
      console.error('Error loading note images for project:', error);
      setNoteImagesModalLoading(false);
      setNoteImagesModalProject(null);
      // في حالة الفشل، نحاول على الأقل تنزيل الصورة الرئيسية إن وُجدت
      await handleDownloadProjectImage(project);
    }
  };

  // ✅ دالة تنزيل صورة المشروع (نفس منطق جدول الأيتام - استخدام blob URL)
  const handleDownloadProjectImage = async (project) => {
    try {
      const projectId = project.id;

      // ✅ استخدام blob URL إذا كان محملاً بالفعل (نفس منطق الأيتام)
      if (imageBlobUrls[projectId]) {
        const response = await fetch(imageBlobUrls[projectId]);
        const blob = await response.blob();

        // إنشاء رابط للتنزيل
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // اسم الملف
        const projectName = project.project_name || project.project_description || 'project';
        const sanitizedProjectName = projectName.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_').toLowerCase();
        const fileExtension = blob.type?.split('/')[1] || 'jpg';
        const fileName = `project_${projectId}_${sanitizedProjectName}_${Date.now()}.${fileExtension}`;

        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('تم تنزيل الصورة بنجاح');
        return;
      }

      // ✅ إذا لم يكن blob URL محملاً، نحمله أولاً (نفس منطق الأيتام)
      const baseURL = getImageBaseUrl();
      const API_BASE = baseURL.replace(/\/api\/?$/, '');

      // ✅ للمشاريع اليومية: محاولة الحصول على الصورة من المشروع الأصلي إذا لم تكن موجودة
      let projectToUse = project;
      if ((project?.is_daily_phase || project?.isDailyPhase) && !project.notes_image_url && !project.notes_image) {
        const parentProject = project.parent_project || project.parentProject;
        if (parentProject && (parentProject.notes_image_url || parentProject.notes_image)) {
          projectToUse = parentProject;
        }
      }

      // ✅ بناء URL الصورة (نفس منطق الأيتام)
      let imageUrl = null;
      if (projectToUse.notes_image_url) {
        if (projectToUse.notes_image_url.startsWith('http://') || projectToUse.notes_image_url.startsWith('https://')) {
          imageUrl = projectToUse.notes_image_url;
        } else if (!projectToUse.notes_image_url.startsWith('/')) {
          imageUrl = `${API_BASE}/${projectToUse.notes_image_url}`;
        } else {
          imageUrl = `${API_BASE}${projectToUse.notes_image_url}`;
        }
      } else if (projectToUse.notes_image) {
        if (projectToUse.notes_image.startsWith('http://') || projectToUse.notes_image.startsWith('https://')) {
          imageUrl = projectToUse.notes_image;
        } else if (projectToUse.notes_image.includes('project_notes_images')) {
          // ✅ إذا كان المسار يحتوي على project_notes_images، استخدم Route الجديد بدون CORS
          if (projectToUse.id) {
            imageUrl = `${baseURL}/project-note-image/${projectToUse.id}`;
          } else {
            // ✅ Fallback: استخدام endpoint بديل
            imageUrl = `${baseURL}/project-proposals/${projectToUse.id || project.id}/notes-image`;
          }
        } else if (!projectToUse.notes_image.startsWith('/')) {
          imageUrl = `${API_BASE}/${projectToUse.notes_image}`;
        } else {
          imageUrl = `${API_BASE}${projectToUse.notes_image}`;
        }
      } else if (projectToUse.id) {
        // ✅ استخدام Route الجديد بدون CORS
        imageUrl = `${baseURL}/project-note-image/${projectToUse.id}`;
      }

      if (!imageUrl) {
        toast.error('لا توجد صورة للمشروع');
        return;
      }

      // ✅ استخدام apiClient بدلاً من fetch لتجنب مشاكل CORS
      let apiEndpoint = null;

      // ✅ إذا كان URL يحتوي على project_notes_images، استخدم endpoint API بدلاً منه
      if (imageUrl.includes('project_notes_images')) {
        // ✅ استخدام endpoint API الصحيح
        apiEndpoint = `/project-note-image/${projectToUse.id || project.id}`;
      } else if (imageUrl.includes('/project-note-image/')) {
        // ✅ استخراج ID من URL
        const match = imageUrl.match(/\/project-note-image\/(\d+)/);
        if (match) {
          apiEndpoint = `/project-note-image/${match[1]}`;
        }
      } else if (imageUrl.includes('/api/project-note-image/')) {
        // ✅ استخراج ID من URL الكامل
        const match = imageUrl.match(/\/project-note-image\/(\d+)/);
        if (match) {
          apiEndpoint = `/project-note-image/${match[1]}`;
        }
      } else if (projectToUse.id) {
        // ✅ استخدام endpoint API الافتراضي
        apiEndpoint = `/project-note-image/${projectToUse.id}`;
      }

      if (!apiEndpoint) {
        toast.error('لا يمكن تحديد endpoint الصورة');
        return;
      }

      // ✅ استخدام apiClient للحصول على الصورة كـ blob
      const response = await apiClient.get(apiEndpoint, {
        responseType: 'blob', // ✅ مهم: الحصول على blob بدلاً من JSON
        timeout: 30000,
      });

      // ✅ response.data هو blob في حالة responseType: 'blob'
      const blob = response.data;

      if (!blob || !blob.type || !blob.type.startsWith('image/')) {
        throw new Error(`Invalid content type: ${blob?.type || 'unknown'}`);
      }

      // ✅ حفظ blob URL للاستخدام المستقبلي
      const blobUrl = URL.createObjectURL(blob);
      setImageBlobUrls(prev => ({ ...prev, [projectId]: blobUrl }));

      // إنشاء رابط للتنزيل
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // اسم الملف
      const projectName = project.project_name || project.project_description || 'project';
      const sanitizedProjectName = projectName.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_').toLowerCase();
      const fileExtension = blob.type?.split('/')[1] || 'jpg';
      const fileName = `project_${projectId}_${sanitizedProjectName}_${Date.now()}.${fileExtension}`;

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('تم تنزيل الصورة بنجاح');
    } catch (error) {
      console.error('❌ Error downloading project image:', error);
      toast.error(`فشل تنزيل الصورة: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  // ✅ التحقق من وجود صورة للمشروع
  const hasProjectImage = (project) => {
    // ✅ للمشاريع اليومية: التحقق من الصورة في المشروع الأصلي أيضاً
    if (project?.is_daily_phase || project?.isDailyPhase) {
      const parentProject = project.parent_project || project.parentProject;

      // التحقق من الصورة في المشروع اليومي نفسه
      if (project.notes_image_url || project.notes_image) {
        return true;
      }

      // ✅ التحقق من الصورة في المشروع الأصلي
      if (parentProject) {
        return !!(parentProject.notes_image_url || parentProject.notes_image);
      }
    }

    // للمشاريع العادية: التحقق من الصورة مباشرة
    return !!(project.notes_image_url || project.notes_image);
  };

  // ✅ حذف المشروع
  const handleDeleteClick = (project) => {
    // ✅ فتح modal التأكيد
    setProjectToDelete(project);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;

    const projectId = projectToDelete.id || projectToDelete._id;
    setDeletingProject(projectId);

    try {
      const response = await apiClient.delete(`/project-proposals/${projectId}`);

      if (response.data.success) {
        toast.success('تم حذف المشروع بنجاح');

        // ✅ إبطال كاش المشاريع (axios cache + local cache)
        forceRefreshCache();
        invalidateCache('projects');
        invalidateCache('project-proposals');
        window.dispatchEvent(new CustomEvent('cache-invalidated', {
          detail: { cacheKey: 'projects' }
        }));

        // ✅ إزالة المشروع المحذوف من القائمة مباشرة (تحسين UX)
        setProjects(prevProjects =>
          prevProjects.filter(p => (p.id || p._id) !== projectId)
        );

        // ✅ تحديث pagination
        if (pagination.total > 0) {
          setPagination(prev => ({
            ...prev,
            total: Math.max(0, prev.total - 1)
          }));
        }

        // ✅ إعادة جلب البيانات من API للتأكد من التزامن (مع force refresh)
        fetchProjects({ forceRefresh: true });

        // ✅ إغلاق modal التأكيد
        setProjectToDelete(null);
      } else {
        toast.error(response.data.message || 'فشل حذف المشروع');
      }
    } catch (error) {
      console.error('Error deleting project:', error);

      // ✅ معالجة الأخطاء المختلفة
      if (error.response?.status === 403) {
        toast.error('ليس لديك صلاحيات لحذف هذا المشروع');
      } else if (error.response?.status === 404) {
        toast.error('المشروع غير موجود');
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error(error.userMessage || 'حدث خطأ أثناء حذف المشروع');
      }
    } finally {
      setDeletingProject(null);
    }
  };

  const handleDeleteCancel = () => {
    setProjectToDelete(null);
  };

  // ✅ تأجيل المشروع
  const handlePostponeProject = async () => {
    if (!postponementReason.trim()) {
      toast.error('يرجى إدخال سبب التأجيل');
      return;
    }

    if (!postponingProjectId) {
      toast.error('خطأ: لم يتم تحديد المشروع');
      return;
    }

    try {
      setIsPostponing(true);
      const response = await apiClient.post(`/project-proposals/${postponingProjectId}/postpone`, {
        postponement_reason: postponementReason.trim(),
      });

      if (response.data.success) {
        toast.success(response.data.message || 'تم تأجيل المشروع بنجاح');
        setShowPostponeModal(false);
        setPostponementReason('');
        setPostponingProjectId(null);
        // ✅ إبطال الكاش بعد التحديث
        forceRefreshCache();
        invalidateCache('projects');
        fetchProjects({ forceRefresh: true }); // تحديث القائمة
      } else {
        toast.error(response.data.message || 'فشل تأجيل المشروع');
      }
    } catch (error) {
      console.error('Error postponing project:', error);

      // معالجة خاصة لأخطاء الصلاحيات
      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لتأجيل هذا المشروع.';
        toast.error(permissionMessage);
      } else {
        toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء تأجيل المشروع');
      }
    } finally {
      setIsPostponing(false);
    }
  };

  // ✅ نقل المشروع للتوريد (بدون confirm - يتم من داخل الـ Modal)
  const handleMoveToSupply = async (projectId) => {
    try {
      const response = await apiClient.post(`/project-proposals/${projectId}/move-to-supply`);

      if (response.data.success) {
        toast.success(response.data.message || 'تم نقل المشروع لمرحلة التوريد بنجاح');
        // ✅ إبطال الكاش بعد التحديث
        forceRefreshCache();
        invalidateCache('projects');
        // لا نستدعي fetchProjects() هنا - سيتم تحديث القائمة المحلية في handleOpenSupplyModal
        return true; // نجاح
      } else {
        toast.error(response.data.message || 'فشل نقل المشروع لمرحلة التوريد');
        return false;
      }
    } catch (error) {
      console.error('Error moving to supply:', error);
      if (error.response?.status === 422) {
        toast.error(error.response.data.message || 'لا يمكن نقل المشروع لمرحلة التوريد');
      } else {
        toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء نقل المشروع للتوريد');
      }
      return false;
    }
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

  // 🛒 فتح نافذة التسوق من المخزن مباشرة
  const handleOpenSupplyModal = async (project) => {
    const currentProject = { ...project };

    // ✅ منع الدخول لمرحلة التوريد إذا لم يتم التحويل للشيكل بعد
    const needsShekelConversion = !currentProject?.shekel_exchange_rate;
    if (needsShekelConversion) {
      toast.error('يجب تحويل المبلغ للشيكل أولاً قبل الدخول إلى مرحلة التوريد');
      setSupplyProject(currentProject);
      setIsEditingShekel(false);
      setExchangeRate('');
      setTransferDiscountPercentage(0);
      setShowShekelModal(true);
      return;
    }

    setSupplyProject(currentProject);
    setProjectQuantity(currentProject.quantity || 1);
    setCartItems([]);
    setWarehouseSearchQuery(''); // ✅ مسح البحث عند فتح modal
    setSupplyModalOpen(true);
    setLoadingWarehouse(true);

    // ✅ جلب قائمة أقسام الفائض
    fetchSurplusCategories();

    // ✅ إذا كان المشروع في حالة توريد أو لاحقة، جلب بيانات التوريد الحالية
    const isInSupplyOrLater = isInSupplyOrLaterStatus(currentProject.status);
    if (isInSupplyOrLater) {
      try {
        const cartResponse = await apiClient.get(`/projects/${currentProject.id}/warehouse`);
        if (cartResponse.data.success) {
          const cartData = cartResponse.data.data || cartResponse.data;
          const existingItems = cartData.items || [];


          // ✅ تحديث السلة بالأصناف الموجودة
          setCartItems(existingItems);

          // ✅ تحديث كمية المشروع من بيانات التوريد
          if (cartData.project?.quantity) {
            setProjectQuantity(cartData.project.quantity);
          }

          // ✅ تحديث بيانات المشروع (مثل surplus_category_id)
          if (cartData.project) {
            setSupplyProject(prev => ({
              ...prev,
              ...cartData.project,
            }));

            // ✅ تحديث قسم الفائض إذا كان موجوداً
            if (cartData.project.surplus_category_id !== null && cartData.project.surplus_category_id !== undefined) {
              setSelectedSurplusCategoryId(cartData.project.surplus_category_id.toString());
            }
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ Could not load existing cart items:', error);
        }
        // ✅ لا نعرض خطأ هنا - قد يكون المشروع جديداً في التوريد
      }
    }

    // جلب أصناف المخزن
    try {
      let response;
      let items = [];

      // ✅ محاولة استخدام endpoint مختلف حسب الدور
      if (isOrphanSponsorCoordinator) {
        // ✅ لمنسق الكفالة: محاولة استخدام /warehouse/available أولاً
        try {
          response = await apiClient.get('/warehouse/available', {
            params: { per_page: 10000 }
          });
        } catch (availableError) {
          // ✅ إذا فشل /warehouse/available، جرب /warehouse
          response = await apiClient.get('/warehouse', {
            params: { per_page: 10000 }
          });
        }
      } else {
        // ✅ للأدوار الأخرى: استخدام /warehouse مباشرة
        response = await apiClient.get('/warehouse', {
          params: { per_page: 10000 }
        });
      }

      // ✅ التحقق من الاستجابة بطرق مختلفة
      if (response.data) {
        // ✅ محاولة استخراج البيانات من عدة أماكن محتملة
        if (Array.isArray(response.data.data?.data)) {
          items = response.data.data.data;
        } else if (Array.isArray(response.data.data)) {
          items = response.data.data;
        } else if (Array.isArray(response.data.items)) {
          items = response.data.items;
        } else if (Array.isArray(response.data.warehouse_items)) {
          items = response.data.warehouse_items;
        } else if (Array.isArray(response.data)) {
          items = response.data;
        } else if (response.data.success && Array.isArray(response.data.data)) {
          items = response.data.data;
        }
      }

      // ✅ لمنسق الكفالة: فلترة الأصناف لإظهار فقط صنف "شيكل"
      if (isOrphanSponsorCoordinator) {
        items = items.filter(item => {
          const itemName = (item.item_name || '').toLowerCase().trim();
          return itemName === 'شيكل' || itemName === 'shekel' || itemName === 'sheqel';
        });
      }

      // ✅ حفظ الأصناف في الحالة
      setWarehouseItems(items);

      if (items.length === 0) {
        const errorMsg = 'لا توجد أصناف في المخزن';
        if (import.meta.env.DEV) {
          console.warn('⚠️ No warehouse items found in API response:', {
            responseData: response.data,
            responseStructure: JSON.stringify(response.data, null, 2),
          });
        }
        toast.warning(errorMsg);
      } else {
        toast.success(`تم جلب ${items.length} صنف من المخزن`);
      }
    } catch (error) {
      console.error('❌ Error fetching warehouse items:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });

      // ✅ معالجة خاصة لخطأ 403 (Forbidden)
      if (error.response?.status === 403) {
        const errorMsg = 'ليس لديك صلاحيات للوصول إلى أصناف المخزن. يرجى التواصل مع الإدارة.';
        toast.error(errorMsg);
        if (import.meta.env.DEV) {
          console.error('🚫 403 Forbidden - User does not have permission to access warehouse items');
        }
      } else {
        toast.error(error.response?.data?.message || 'فشل جلب أصناف المخزن. يرجى المحاولة مرة أخرى.');
      }

      setWarehouseItems([]); // ✅ تعيين مصفوفة فارغة في حالة الخطأ
    } finally {
      setLoadingWarehouse(false);
    }
  };

  // 💱 Get available amount and currency helper
  const getAvailableAmountInfo = (project) => {
    if (!project) return { amount: 0, currency: 'USD', symbol: '$' };

    if (project.shekel_exchange_rate && project.net_amount_shekel) {
      return {
        amount: project.net_amount_shekel,
        currency: 'ILS',
        symbol: '₪',
        originalAmount: project.net_amount_usd || project.net_amount || 0,
        exchangeRate: project.shekel_exchange_rate,
      };
    }
    return {
      amount: project.net_amount_usd || project.net_amount || 0,
      currency: 'USD',
      symbol: '$',
      originalAmount: null,
      exchangeRate: null,
    };
  };

  // 💱 Handle Shekel Conversion
  const handleConvertToShekel = async () => {
    if (!supplyProject) return;

    const rate = parseFloat(exchangeRate);
    if (!rate || rate <= 0) {
      toast.error('يرجى إدخال سعر صرف صحيح');
      return;
    }

    const transferDiscount = parseFloat(transferDiscountPercentage) || 0;
    if (transferDiscount <= 0) {
      toast.error('نسبة خصم النقل يجب أن تكون أكبر من صفر');
      return;
    }
    if (transferDiscount > 100) {
      toast.error('نسبة خصم النقل يجب أن تكون أقل من أو تساوي 100');
      return;
    }

    try {
      setConvertingToShekel(true);
      const response = await apiClient.post(`/project-proposals/${supplyProject.id}/convert-to-shekel`, {
        shekel_exchange_rate: rate,
        transfer_discount_percentage: transferDiscount
      });

      if (response.data.success) {
        toast.success(response.data.message || 'تم التحويل إلى شيكل بنجاح');
        setShowShekelModal(false);
        setIsEditingShekel(false);
        setExchangeRate('');
        setTransferDiscountPercentage(0);

        // ✅ إبطال الكاش بعد التحديث
        forceRefreshCache();
        invalidateCache('projects');

        // ✅ تحديث بيانات المشروع
        const updatedProject = {
          ...supplyProject,
          shekel_exchange_rate: rate,
          transfer_discount_percentage: transferDiscount,
          net_amount_shekel: response.data.project?.net_amount_shekel || supplyProject.net_amount_shekel,
        };
        setSupplyProject(updatedProject);

        // ✅ إذا كان المشروع في حالة "جديد"، نقل المشروع للتوريد تلقائياً بعد التحويل
        if (supplyProject.status === 'جديد') {
          try {
            const moveResponse = await apiClient.post(`/project-proposals/${supplyProject.id}/move-to-supply`);

            if (moveResponse.data.success) {
              toast.success('تم نقل المشروع لمرحلة التوريد بنجاح');

              // ✅ إبطال الكاش
              window.dispatchEvent(new CustomEvent('cache-invalidated', { detail: { cacheKey: 'project-proposals' } }));
              fetchProjects({ forceRefresh: true });

              // ✅ الانتقال إلى صفحة التوريد
              navigate(`/project-management/projects/${supplyProject.id}/supply`);
            } else {
              toast.error(moveResponse.data.message || 'فشل نقل المشروع لمرحلة التوريد');
            }
          } catch (moveError) {
            console.error('Error moving to supply after conversion:', moveError);
            toast.error(moveError.response?.data?.message || 'حدث خطأ أثناء نقل المشروع للتوريد');
          }
        } else {
          // ✅ إذا لم يكن في حالة "جديد"، فقط إبطال الكاش
          window.dispatchEvent(new CustomEvent('cache-invalidated', { detail: { cacheKey: 'project-proposals' } }));
          fetchProjects();
        }
      }
    } catch (error) {
      console.error('Error converting to shekel:', error);
      toast.error(error.response?.data?.message || 'فشل التحويل إلى شيكل');
    } finally {
      setConvertingToShekel(false);
    }
  };

  // 📦 جلب قائمة أقسام الفائض
  const fetchSurplusCategories = async () => {
    try {
      setLoadingSurplusCategories(true);
      const response = await apiClient.get('/surplus-categories', {
        params: { is_active: 1 }
      });

      if (response.data.success) {
        const categories = response.data.data || [];
        setSurplusCategories(categories);

        // ✅ لمنسق الأيتام: البحث عن صندوق "كفالة الأيتام" تلقائياً
        if (isOrphanSponsorCoordinator) {
          const orphanCategory = categories.find(cat => {
            const name = (cat.name || '').toLowerCase();
            return name.includes('كفالة') && name.includes('أيتام') ||
              name.includes('كفالة') && name.includes('ايتام') ||
              name.includes('orphan') && name.includes('sponsorship');
          });

          if (orphanCategory) {
            setSelectedSurplusCategoryId(orphanCategory.id.toString());
          } else if (import.meta.env.DEV) {
            console.warn('⚠️ Could not find "كفالة الأيتام" surplus category');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching surplus categories:', error);
      // لا نعرض خطأ هنا لأن الأقسام اختيارية
    } finally {
      setLoadingSurplusCategories(false);
    }
  };

  // 🛒 إضافة صنف للسلة (محلياً بدون API)
  const handleAddToCart = (warehouseItem, quantityPerUnit) => {
    if (!supplyProject) return;

    // ✅ التحقق من أن المشروع محول للشيكل قبل إضافة الأصناف
    const needsShekelConversion = !supplyProject?.shekel_exchange_rate;
    if (needsShekelConversion) {
      toast.error('يجب تحويل المبلغ للشيكل أولاً قبل إضافة الأصناف');
      setIsEditingShekel(false);
      setExchangeRate('');
      setTransferDiscountPercentage(0);
      setShowShekelModal(true);
      return;
    }

    const qty = parseFloat(quantityPerUnit);
    if (!qty || qty <= 0) {
      toast.error('يرجى إدخال كمية صحيحة');
      return;
    }

    // التحقق من الكمية المتوفرة
    const totalNeeded = qty * projectQuantity;
    if (totalNeeded > warehouseItem.quantity_available) {
      toast.error(`الكمية غير كافية! المتوفر: ${warehouseItem.quantity_available}`);
      return;
    }

    // التحقق إذا كان الصنف موجود بالفعل في السلة
    const existingItem = cartItems.find(item => item.warehouse_item_id === warehouseItem.id);
    if (existingItem) {
      toast.warning('الصنف موجود بالفعل في السلة');
      return;
    }

    // إضافة للسلة محلياً
    const newCartItem = {
      id: Date.now(), // ID مؤقت
      warehouse_item_id: warehouseItem.id,
      warehouse_item: warehouseItem,
      item_name: warehouseItem.item_name,
      quantity_per_unit: qty,
      unit_price: parseFloat(warehouseItem.unit_price),
      total_price_per_unit: qty * parseFloat(warehouseItem.unit_price),
    };

    setCartItems(prev => [...prev, newCartItem]);
    toast.success('تم إضافة الصنف للسلة');

    // مسح حقل الكمية
    const inputEl = document.getElementById(`qty-${warehouseItem.id}`);
    if (inputEl) inputEl.value = '';
  };

  // 🛒 حذف صنف من السلة (محلياً)
  const handleRemoveFromCart = (itemId) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
    toast.success('تم حذف الصنف من السلة');
  };

  // 🛒 تحديث العدد (محلياً)
  const handleUpdateQuantity = (newQuantity) => {
    if (newQuantity < 1) return;
    setProjectQuantity(parseInt(newQuantity));
  };

  // 🛒 تأكيد التوريد - نقل المشروع + حفظ السلة
  const handleConfirmSupply = async () => {
    if (!supplyProject) return;

    if (cartItems.length === 0) {
      toast.error('السلة فارغة! يرجى إضافة أصناف أولاً');
      return;
    }

    // ✅ التحقق من أن المشروع محول للشيكل
    const needsShekelConversion = !supplyProject?.shekel_exchange_rate;
    if (needsShekelConversion) {
      toast.error('يجب تحويل المبلغ للشيكل أولاً قبل تأكيد التوريد');
      setIsEditingShekel(false);
      setExchangeRate('');
      setTransferDiscountPercentage(0);
      setShowShekelModal(true);
      return;
    }

    // حساب الملخص
    const unitCost = cartItems.reduce((sum, item) => sum + parseFloat(item.total_price_per_unit || 0), 0);
    const totalCost = unitCost * projectQuantity;
    const amountInfo = getAvailableAmountInfo(supplyProject);
    const availableAmount = parseFloat(amountInfo.amount || 0); // ✅ تحويل صريح إلى رقم
    const calculatedSurplus = availableAmount - totalCost; // ✅ حساب الفائض/العجز

    let confirmMsg = `هل أنت متأكد من تأكيد التوريد؟\n\nتكلفة الطرد: ${unitCost.toFixed(2)}\nالعدد: ${projectQuantity}\nالتكلفة الإجمالية: ${totalCost.toFixed(2)}\nالمبلغ المتاح للتوريد: ${amountInfo.symbol}${availableAmount.toFixed(2)}\n`;

    if (calculatedSurplus < 0) {
      confirmMsg += `\n⚠️ تنبيه: يوجد عجز قدره ${amountInfo.symbol}${Math.abs(calculatedSurplus).toFixed(2)}`;
    } else {
      confirmMsg += `\nالفائض: ${amountInfo.symbol}${calculatedSurplus.toFixed(2)}`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      setConfirmingSupply(true);

      // 1. نقل المشروع لحالة التوريد (إذا كان جديد)
      if (supplyProject.status === 'جديد') {
        const moveSuccess = await handleMoveToSupply(supplyProject.id);
        if (!moveSuccess) {
          toast.error('فشل نقل المشروع لمرحلة التوريد');
          setConfirmingSupply(false);
          return;
        }
      }

      // 2. إضافة الأصناف للسلة في الـ Backend
      for (const item of cartItems) {
        try {
          await apiClient.post(`/projects/${supplyProject.id}/warehouse/items`, {
            warehouse_item_id: item.warehouse_item_id,
            quantity_per_unit: item.quantity_per_unit
          });
        } catch (error) {
          console.error('Error adding item:', error);
          // نستمر حتى لو فشل صنف واحد
        }
      }

      // 3. تحديث العدد
      try {
        await apiClient.patch(`/projects/${supplyProject.id}/warehouse/quantity`, {
          quantity: projectQuantity
        });
      } catch (error) {
        console.error('Error updating quantity:', error);
      }

      // 4. تأكيد التوريد
      const confirmPayload = {
        notes: '', // ✅ إضافة notes كحقل افتراضي
      };

      // ✅ إضافة الصندوق (surplus category) - إجباري لمنسق الأيتام
      if (!selectedSurplusCategoryId || selectedSurplusCategoryId === '') {
        toast.error('يرجى اختيار قسم الفائض قبل تأكيد التوريد');
        setConfirmingSupply(false);
        return;
      }

      const categoryId = parseInt(selectedSurplusCategoryId);
      if (isNaN(categoryId)) {
        toast.error('قسم الفائض المحدد غير صحيح');
        setConfirmingSupply(false);
        return;
      }

      confirmPayload.surplus_category_id = categoryId;

      // ✅ إضافة مبلغ الفائض إذا كان هناك فائض (استخدام calculatedSurplus المحسوب سابقاً)
      if (calculatedSurplus > 0) {
        confirmPayload.surplus_amount = parseFloat(calculatedSurplus.toFixed(2));
      }


      const response = await apiClient.post(`/projects/${supplyProject.id}/warehouse/confirm`, confirmPayload);

      if (response.data.success) {
        toast.success(response.data.message || 'تم تأكيد التوريد بنجاح');
        setSupplyModalOpen(false);
        setSupplyProject(null);
        setCartItems([]);
        setSelectedSurplusCategoryId(''); // ✅ مسح الصندوق المحدد
        // ✅ إبطال الكاش بعد التحديث
        forceRefreshCache();
        invalidateCache('projects');
        fetchProjects({ forceRefresh: true });
      } else {
        toast.error(response.data.message || 'فشل تأكيد التوريد');
      }
    } catch (error) {
      console.error('Error confirming supply:', error);
      toast.error(error.response?.data?.message || 'فشل تأكيد التوريد');
    } finally {
      setConfirmingSupply(false);
    }
  };

  // ✅ استئناف المشروع المؤجل
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
        forceRefreshCache();
        invalidateCache('projects');
        fetchProjects({ forceRefresh: true }); // تحديث القائمة
      } else {
        toast.error(response.data.message || 'فشل استئناف المشروع');
      }
    } catch (error) {
      console.error('Error resuming project:', error);

      // معالجة خاصة لأخطاء الصلاحيات
      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لاستئناف هذا المشروع.';
        toast.error(permissionMessage);
      } else {
        toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء استئناف المشروع');
      }
    } finally {
      setIsResuming(false);
    }
  };

  // ✅ فتح Modal لإضافة عدد المستفيدين
  const handleOpenBeneficiariesModal = (project) => {
    setSelectedProject(project);
    setBeneficiariesCount(project.beneficiaries_count || project.calculated_beneficiaries || '');
    setShowBeneficiariesModal(true);
  };

  // ✅ تحديث عدد المستفيدين
  const handleUpdateBeneficiaries = async () => {
    if (!selectedProject) return;

    const count = parseInt(beneficiariesCount);
    if (isNaN(count) || count < 0) {
      toast.error('يرجى إدخال عدد صحيح أكبر من أو يساوي صفر');
      return;
    }

    try {
      setUpdatingBeneficiaries(true);
      const response = await apiClient.patch(`/project-proposals/${selectedProject.id}`, {
        beneficiaries_count: count
      });

      if (response.data.success) {
        toast.success('تم تحديث عدد المستفيدين بنجاح');
        setShowBeneficiariesModal(false);
        setBeneficiariesCount('');
        setSelectedProject(null);
        // ✅ إبطال الكاش بعد التحديث
        forceRefreshCache();
        invalidateCache('projects');
        fetchProjects({ forceRefresh: true }); // تحديث القائمة
      } else {
        toast.error(response.data.message || 'فشل تحديث عدد المستفيدين');
      }
    } catch (error) {
      console.error('Error updating beneficiaries:', error);

      // معالجة خاصة لأخطاء 401 (Unauthorized) - انتهت صلاحية الجلسة
      if (error.response?.status === 401) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
          toast.error('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.');
        } else {
          toast.error('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.');
        }
        return;
      }

      // معالجة خاصة لأخطاء الصلاحيات 403
      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لتحديث عدد المستفيدين.';
        toast.error(permissionMessage);
      } else {
        toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء تحديث عدد المستفيدين');
      }
    } finally {
      setUpdatingBeneficiaries(false);
    }
  };

  // ✅ جلب إشعار media_completed المرتبط بمشروع معين
  const fetchProjectNotification = async (projectId) => {
    try {
      const response = await apiClient.get('/notifications', {
        params: {
          related_project_id: projectId,
          notification_type: 'media_completed',
        }
      });

      if (response.data.success) {
        const notifications = response.data.data || response.data.notifications || [];
        // جلب أول إشعار غير معالج (لم يتم قبوله أو رفضه)
        const notification = notifications.find(n =>
          n.type === 'media_completed' || n.notification_type === 'media_completed'
        );
        return notification || null;
      }
      return null;
    } catch (error) {
      console.error('Error fetching project notification:', error);
      return null;
    }
  };

  // ✅ Hook لتحديث حالة التنفيذ
  const { updateExecutionStatus, loading: updatingStatus } = useUpdateExecutionStatus();

  // ✅ دالة مساعدة لتحديث مشروع محلياً في القائمة (Optimistic Update)
  const updateProjectInList = (projectId, updates) => {
    setProjects((prevProjects) =>
      prevProjects.map((p) =>
        p.id === projectId ? { ...p, ...updates } : p
      )
    );
    // ✅ تحديث الكاش أيضاً
    if (cacheRef.current?.data) {
      cacheRef.current.data = cacheRef.current.data.map((p) =>
        p.id === projectId ? { ...p, ...updates } : p
      );
    }
  };

  // ✅ دالة لإعادة جلب البيانات في الخلفية (بدون loading)
  const refetchProjectsInBackground = useRef(null);
  const scheduleBackgroundRefetch = () => {
    // ✅ إلغاء أي إعادة جلب مجدولة سابقاً
    if (refetchProjectsInBackground.current) {
      clearTimeout(refetchProjectsInBackground.current);
    }
    // ✅ جدولة إعادة الجلب بعد 2 ثانية (debounce)
    refetchProjectsInBackground.current = setTimeout(async () => {
      try {
        // ✅ إبطال الكاش فقط
        cacheRef.current = {
          data: null,
          timestamp: null,
          filters: null,
          maxAge: getCacheMaxAge(),
        };
        try {
          localStorage.removeItem('projects_cache');
        } catch (e) {
          console.warn('Error clearing cache from localStorage:', e);
        }
        window.dispatchEvent(new CustomEvent('cache-invalidated', {
          detail: { cacheKey: 'projects' }
        }));
        // ✅ إعادة الجلب بدون إظهار loading
        await fetchProjects({ skipLoading: true });
      } catch (error) {
        console.error('Error refetching projects in background:', error);
      }
    }, 4000);
  };

  // ✅ دالة لفتح Modal تحديث حالة التنفيذ
  const handleExecutionStatusClick = (project) => {
    // ✅ لدور الإعلام: السماح فقط للمشاريع من "تم التنفيذ" وما بعدها
    const postExecutionStatuses = ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'وصل للمتبرع'];

    if (isMediaManager) {
      // دور الإعلام: يمكن تحديث الحالة فقط للمشاريع من "تم التنفيذ" وما بعدها
      if (postExecutionStatuses.includes(project.status)) {
        setSelectedProjectForStatusUpdate(project);
        setExecutionStatusAction(null);
        setShowExecutionStatusModal(true);
      }
    } else {
      // الأدوار الأخرى: المنطق القديم
      if (project.status === 'قيد التنفيذ') {
        setSelectedProjectForStatusUpdate(project);
        setExecutionStatusAction(null);
        setShowExecutionStatusModal(true);
      }
    }
  };
  // here the section four is start *********************************
  // ✅ دالة لتحديث حالة التنفيذ إلى "تم التنفيذ"
  const handleCompleteExecution = async () => {
    if (!selectedProjectForStatusUpdate) return;

    const projectId = selectedProjectForStatusUpdate.id;
    const oldStatus = selectedProjectForStatusUpdate.status;

    try {
      // ✅ تحديث محلي فوري (Optimistic Update)
      updateProjectInList(projectId, {
        status: 'تم التنفيذ',
        updated_at: new Date().toISOString(),
      });

      // ✅ إغلاق Modal فوراً
      setShowExecutionStatusModal(false);
      const tempProject = selectedProjectForStatusUpdate;
      setSelectedProjectForStatusUpdate(null);
      setExecutionStatusAction(null);

      // ✅ تحديث في الـ Backend
      const updatedProject = await updateExecutionStatus(projectId, 'تم التنفيذ');

      // ✅ تحديث محلي بالبيانات الكاملة من الـ Backend
      updateProjectInList(projectId, updatedProject);

      // ✅ جدولة إعادة جلب في الخلفية
      scheduleBackgroundRefetch();
    } catch (error) {
      // ✅ في حالة الخطأ، نعيد الحالة القديمة
      updateProjectInList(projectId, {
        status: oldStatus,
      });
      // الخطأ تم معالجته في الـ hook
      console.error('Error updating execution status:', error);
    }
  };

  // ✅ دالة لتأجيل المشروع من Modal تحديث الحالة
  const handlePostponeFromStatusModal = async () => {
    if (!selectedProjectForStatusUpdate) return;
    if (!postponementReason.trim()) {
      toast.error('يرجى إدخال سبب التأجيل');
      return;
    }

    const projectId = selectedProjectForStatusUpdate.id;
    const oldStatus = selectedProjectForStatusUpdate.status;
    const reason = postponementReason.trim();

    try {
      setIsPostponing(true);

      // ✅ تحديث محلي فوري (Optimistic Update)
      updateProjectInList(projectId, {
        status: 'مؤجل',
        postponement_reason: reason,
        updated_at: new Date().toISOString(),
      });

      // ✅ إغلاق Modal فوراً
      setShowExecutionStatusModal(false);
      setPostponementReason('');
      setSelectedProjectForStatusUpdate(null);
      setExecutionStatusAction(null);

      const response = await apiClient.post(`/project-proposals/${projectId}/postpone`, {
        postponement_reason: reason,
      });

      if (response.data.success) {
        toast.success(response.data.message || 'تم تأجيل المشروع بنجاح');

        // ✅ تحديث محلي بالبيانات الكاملة من الـ Backend
        if (response.data.project) {
          updateProjectInList(projectId, response.data.project);
        }

        // ✅ جدولة إعادة جلب في الخلفية
        scheduleBackgroundRefetch();
      } else {
        // ✅ في حالة الخطأ، نعيد الحالة القديمة
        updateProjectInList(projectId, {
          status: oldStatus,
          postponement_reason: selectedProjectForStatusUpdate.postponement_reason,
        });
        toast.error(response.data.message || 'فشل تأجيل المشروع');
      }
    } catch (error) {
      // ✅ في حالة الخطأ، نعيد الحالة القديمة
      updateProjectInList(projectId, {
        status: oldStatus,
        postponement_reason: selectedProjectForStatusUpdate.postponement_reason,
      });
      console.error('Error postponing project:', error);
      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لتأجيل هذا المشروع.';
        toast.error(permissionMessage);
      } else {
        toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء تأجيل المشروع');
      }
    } finally {
      setIsPostponing(false);
    }
  };

  // ✅ فتح Modal للقبول/الرفض عند النقر على حالة "وصل للمتبرع"
  // ✅ لدور منسق الكفالات فقط: نقل مباشر من "جاهز للتنفيذ" إلى "تم التنفيذ"
  const handleStatusClick = async (project) => {
    // ✅ لدور منسق الكفالات فقط: نقل مباشر من "جاهز للتنفيذ" إلى "تم التنفيذ"
    if (isOrphanSponsorCoordinator && project.status === 'جاهز للتنفيذ') {
      if (!window.confirm('هل أنت متأكد من نقل المشروع إلى "تم التنفيذ"؟')) {
        return;
      }

      const projectId = project.id;
      const oldStatus = project.status;

      try {
        // ✅ تحديث محلي فوري (Optimistic Update)
        updateProjectInList(projectId, {
          status: 'تم التنفيذ',
          updated_at: new Date().toISOString(),
        });

        // ✅ تحديث في الـ Backend
        const updatedProject = await updateExecutionStatus(projectId, 'تم التنفيذ');

        // ✅ تحديث محلي بالبيانات الكاملة من الـ Backend
        updateProjectInList(projectId, updatedProject);

        toast.success('تم نقل المشروع إلى "تم التنفيذ" بنجاح');

        // ✅ إبطال الكاش
        window.dispatchEvent(new CustomEvent('cache-invalidated', { detail: { cacheKey: 'project-proposals' } }));
        scheduleBackgroundRefetch();
      } catch (error) {
        // ✅ في حالة الخطأ، نعيد الحالة القديمة
        updateProjectInList(projectId, {
          status: oldStatus,
        });
        console.error('Error updating execution status:', error);
        toast.error(error.response?.data?.message || 'حدث خطأ أثناء نقل المشروع');
      }
      return;
    }
    // this is section 4 ******************************************************************
    // ✅ فتح Modal للقبول/الرفض عند النقر على حالة "وصل للمتبرع"
    if (project.status !== 'وصل للمتبرع') return;

    // ✅ فتح Modal مباشرة مع بيانات المشروع
    // إنشاء كائن مؤقت يحتوي على بيانات المشروع
    const tempNotification = {
      id: null, // لا يوجد إشعار فعلي
      project_id: project.id,
      related_project_id: project.id,
      metadata: {
        project_id: project.id,
        project_name: project.project_name,
        donor_code: project.donor_code,
        internal_code: project.internal_code,
      },
      type: 'media_completed',
      notification_type: 'media_completed',
    };

    // حفظ المشروع الحالي والإشعار المؤقت
    setProjectNotification(tempNotification);
    setNotificationToAccept(tempNotification);
    setAcceptModalOpen(true);
  };

  // ✅ وظائف القبول/الرفض (نفس الكود من Notifications.jsx)
  const handleOpenAcceptModal = (notification) => {
    setNotificationToAccept(notification);
    setAcceptModalOpen(true);
  };

  const handleCloseAcceptModal = () => {
    setAcceptModalOpen(false);
    setNotificationToAccept(null);
    setProjectNotification(null);
  };

  const handleAccept = async () => {
    if (!notificationToAccept) return;

    let successHandled = false; // ✅ متغير لتتبع ما إذا تم عرض رسالة النجاح

    try {
      setAccepting(true);

      // ✅ التحقق من دور المستخدم
      const userRole = user?.role?.toLowerCase?.() ||
        user?.userRole?.toLowerCase?.() ||
        user?.user_role?.toLowerCase?.() ||
        user?.role_name?.toLowerCase?.() ||
        user?.role || '';

      const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

      // ✅ للـ Admin: ننقل المشروع مباشرة إلى "منتهي" دائماً
      if (isAdmin) {
        const projectId = notificationToAccept.project_id || notificationToAccept.related_project_id;

        // ✅ أولاً: نقبل الإشعار إذا كان موجوداً
        if (notificationToAccept.id) {
          try {
            await apiClient.post(`/notifications/${notificationToAccept.id}/accept`);
          } catch (error) {
            console.warn('⚠️ Error accepting notification (continuing):', error);
            // نستمر في تحديث حالة المشروع حتى لو فشل قبول الإشعار
          }
        }

        // ✅ ثانياً: نحدث حالة المشروع إلى "منتهي" مباشرة
        const updatePayload = {
          status: 'منتهي',
          completed_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
        };

        let response;
        try {
          response = await apiClient.put(`/project-proposals/${projectId}`, updatePayload);
        } catch (error) {
          // ✅ Better error handling for 400 errors
          if (error.response?.status === 400) {
            console.error('❌ Validation error:', error.response.data);
            const errorMessage = error.response.data?.message ||
              error.response.data?.errors ||
              'حدث خطأ في التحقق من البيانات';
            toast.error(`خطأ في التحقق: ${typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)}`);
            throw error;
          }
          throw error;
        }
        if (response.data.success) {
          successHandled = true;

          // ✅ إبطال الكاش بعد التحديث
          forceRefreshCache();
          invalidateCache('projects');
          invalidateCache('project-proposals');

          // ✅ تحديث محلي فوري
          const updatedProject = response.data.project || response.data.data;
          if (updatedProject) {
            updateProjectInList(projectId, {
              status: 'منتهي',
              completed_date: updatePayload.completed_date,
              ...updatedProject,
            });
          } else {
            // ✅ إذا لم تأت البيانات، نحدث الحالة فقط
            updateProjectInList(projectId, {
              status: 'منتهي',
              completed_date: updatePayload.completed_date,
            });
          }

          // ✅ إبطال الكاش بعد التحديث
          forceRefreshCache();
          invalidateCache('projects');
          invalidateCache('project-proposals');

          toast.success('تم قبول المونتاج والمشروع أصبح في حالة "منتهي"');
          handleCloseAcceptModal();

          // ✅ جدولة إعادة جلب في الخلفية
          scheduleBackgroundRefetch();
        } else {
          toast.error(response.data.message || 'حدث خطأ أثناء قبول المونتاج');
        }
      }
      // ✅ لغير الـ Admin: نستخدم API الإشعارات (الطريقة القديمة)
      else if (notificationToAccept.id) {
        const projectId = notificationToAccept.project_id || notificationToAccept.related_project_id;
        const oldProject = projects.find(p => p.id === projectId);
        const oldStatus = oldProject?.status;

        // ✅ تحديث محلي فوري
        if (oldProject) {
          updateProjectInList(projectId, {
            status: 'منتهي',
            updated_at: new Date().toISOString(),
          });
        }

        const response = await apiClient.post(`/notifications/${notificationToAccept.id}/accept`);

        if (response.data.success) {
          successHandled = true;
          const newStatus = response.data.project?.status;
          const updatedProject = response.data.project;

          // ✅ إبطال الكاش بعد التحديث
          forceRefreshCache();
          invalidateCache('projects');
          invalidateCache('project-proposals');

          // ✅ تحديث محلي بالبيانات الكاملة
          if (updatedProject) {
            updateProjectInList(projectId, updatedProject);
          } else if (newStatus) {
            updateProjectInList(projectId, { status: newStatus });
          }

          // ✅ التحقق من الحالة الجديدة
          if (newStatus === 'منتهي') {
            toast.success(response.data.message || 'تم قبول المونتاج والمشروع أصبح في حالة "منتهي"');
          } else {
            toast.success(response.data.message || 'تم قبول المونتاج بنجاح');
          }

          handleCloseAcceptModal();
          // ✅ جدولة إعادة جلب في الخلفية
          scheduleBackgroundRefetch();
        } else {
          // ✅ في حالة الخطأ، نعيد الحالة القديمة
          if (oldProject && oldStatus) {
            updateProjectInList(projectId, { status: oldStatus });
          }
          toast.error(response.data.message || 'حدث خطأ أثناء قبول المونتاج');
        }
      } else {
        // ✅ إذا لم يكن هناك إشعار ولست admin، قم بتحويل المشروع مباشرة إلى "منتهي"
        const projectId = notificationToAccept.project_id || notificationToAccept.related_project_id;
        const oldProject = projects.find(p => p.id === projectId);
        const oldStatus = oldProject?.status;

        // ✅ تحديث محلي فوري
        if (oldProject) {
          updateProjectInList(projectId, {
            status: 'منتهي',
            updated_at: new Date().toISOString(),
          });
        }

        let response;
        try {
          response = await apiClient.put(`/project-proposals/${projectId}`, {
            status: 'منتهي'
          });
        } catch (error) {
          // ✅ Better error handling for 400 errors
          if (error.response?.status === 400) {
            console.error('❌ Validation error:', error.response.data);
            const errorMessage = error.response.data?.message ||
              error.response.data?.errors ||
              'حدث خطأ في التحقق من البيانات';
            toast.error(`خطأ في التحقق: ${typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)}`);
            // ✅ في حالة الخطأ، نعيد الحالة القديمة
            if (oldProject && oldStatus) {
              updateProjectInList(projectId, { status: oldStatus });
            }
            throw error;
          }
          throw error;
        }

        if (response.data.success) {
          successHandled = true;

          // ✅ تحديث محلي بالبيانات الكاملة
          const updatedProject = response.data.project || response.data.data;
          if (updatedProject) {
            updateProjectInList(projectId, updatedProject);
          }

          // ✅ إبطال الكاش بعد التحديث
          forceRefreshCache();
          invalidateCache('projects');
          invalidateCache('project-proposals');

          // ✅ إبطال الكاش بعد التحديث
          forceRefreshCache();
          invalidateCache('projects');
          invalidateCache('project-proposals');

          toast.success('تم قبول المونتاج والمشروع أصبح في حالة "منتهي"');
          handleCloseAcceptModal();

          // ✅ جدولة إعادة جلب في الخلفية
          scheduleBackgroundRefetch();
        } else {
          // ✅ في حالة الخطأ، نعيد الحالة القديمة
          if (oldProject && oldStatus) {
            updateProjectInList(projectId, { status: oldStatus });
          }
          toast.error(response.data.message || 'حدث خطأ أثناء قبول المونتاج');
        }
      }
    } catch (error) {
      console.error('Error accepting notification:', error);
      // ✅ فقط عرض رسالة خطأ إذا لم يتم عرض رسالة نجاح
      if (!successHandled) {
        const errorMessage = error.response?.data?.message || 'حدث خطأ أثناء قبول المونتاج';
        toast.error(errorMessage);
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleOpenReplyModal = (notification) => {
    setSelectedNotification(notification);
    setReplyForm({ message: '', rejection_reason: '' });
    setReplyModalOpen(true);
  };

  const handleCloseReplyModal = () => {
    setReplyModalOpen(false);
    setSelectedNotification(null);
    setReplyForm({ message: '', rejection_reason: '' });
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();

    if (!replyForm.message.trim() || !replyForm.rejection_reason.trim()) {
      toast.error('الرجاء ملء جميع الحقول');
      return;
    }

    let successHandled = false; // ✅ متغير لتتبع ما إذا تم عرض رسالة النجاح

    try {
      setReplying(true);

      // ✅ إذا كان هناك إشعار فعلي، استخدم API الإشعارات
      if (selectedNotification.id) {
        const response = await apiClient.post(
          `/notifications/${selectedNotification.id}/reply`,
          replyForm
        );

        if (response.data.success) {
          successHandled = true; // ✅ تم معالجة النجاح
          toast.success('تم إرسال الرد بنجاح');
          handleCloseReplyModal();
          fetchProjects(); // تحديث قائمة المشاريع
        } else {
          toast.error(response.data.message || 'حدث خطأ أثناء إرسال الرد');
        }
      } else {
        // ✅ إذا لم يكن هناك إشعار، قم بتحويل المشروع إلى "يجب إعادة المونتاج"
        const projectId = selectedNotification.project_id || selectedNotification.related_project_id;

        let response;
        try {
          response = await apiClient.put(`/project-proposals/${projectId}`, {
            status: 'يجب إعادة المونتاج',
            rejection_reason: replyForm.rejection_reason,
            rejection_message: replyForm.message,
            admin_rejection_reason: replyForm.rejection_reason, // ✅ إضافة الحقل البديل
            media_rejection_reason: replyForm.rejection_reason  // ✅ إضافة الحقل البديل
          });
        } catch (error) {
          // ✅ Better error handling for 400 errors
          if (error.response?.status === 400) {
            console.error('❌ Validation error:', error.response.data);
            const errorMessage = error.response.data?.message ||
              error.response.data?.errors ||
              'حدث خطأ في التحقق من البيانات';
            toast.error(`خطأ في التحقق: ${typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)}`);
            throw error;
          }
          throw error;
        }


        if (response.data.success) {
          successHandled = true; // ✅ تم معالجة النجاح
          toast.success('تم رفض المونتاج وإرجاع المشروع لإعادة المونتاج');
          handleCloseReplyModal();

          // ✅ إبطال الكاش وإعادة جلب المشاريع
          cacheRef.current = {
            data: null,
            timestamp: null,
            filters: null,
            maxAge: getCacheMaxAge(),
          };
          try {
            localStorage.removeItem('projects_cache');
          } catch (e) {
            console.warn('Error clearing cache from localStorage:', e);
          }
          window.dispatchEvent(new CustomEvent('cache-invalidated', {
            detail: { cacheKey: 'projects' }
          }));

          await fetchProjects();
        } else {
          toast.error(response.data.message || 'حدث خطأ أثناء رفض المونتاج');
        }
      }
    } catch (error) {
      console.error('Error replying to notification:', error);
      // ✅ فقط عرض رسالة خطأ إذا لم يتم عرض رسالة نجاح
      if (!successHandled) {
        toast.error(error.response?.data?.message || 'حدث خطأ أثناء إرسال الرد');
      }
    } finally {
      setReplying(false);
    }
  };

  const formatOriginalAmount = (project, currencyCode) => {
    // ✅ محاولة الحصول على المبلغ من عدة مصادر
    const parentProject = project?.parent_project || project?.parentProject;
    const amount =
      project?.donation_amount ||
      project?.amount ||
      project?.original_amount ||
      project?.total_amount ||
      parentProject?.donation_amount ||
      parentProject?.amount ||
      parentProject?.original_amount ||
      parentProject?.total_amount ||
      null;

    if (amount === null || amount === undefined || amount === '' || Number.isNaN(Number(amount)) || Number(amount) === 0) {
      return '---';
    }

    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount));

    // ✅ الحصول على رمز العملة من عدة مصادر
    const currencySymbol =
      currencyCode ||
      project?.currency?.currency_symbol ||
      project?.currency?.currency_code ||
      project?.currency_code ||
      parentProject?.currency?.currency_symbol ||
      parentProject?.currency?.currency_code ||
      parentProject?.currency_code ||
      '';

    return `${formatted} ${currencySymbol}`.trim();
  };

  const readyForExecutionProjects = projects.filter((project) => {
    // ✅ التحقق من أن project هو object وليس array
    if (!project || Array.isArray(project)) return false;
    return project.status === 'جاهز للتنفيذ';
  });

  // ✅ المشاريع قيد التنفيذ (للعرض في قسم منفصل)
  const inExecutionProjects = projects.filter((project) => {
    // ✅ التحقق من أن project هو object وليس array
    if (!project || Array.isArray(project)) return false;
    return project.status === 'قيد التنفيذ';
  });

  const hasDailyPhaseFlag = useMemo(
    () => projects.some((project) => project?.__hasDailyPhaseFlag),
    [projects]
  );

  // ✅ دالة لحساب اليوم الحالي بناءً على phase_start_date
  // execution_date = phase_start_date + (phase_day - 1) أيام
  const calculateCurrentDay = (project) => {
    if (!project?.is_divided_into_phases || !project?.phase_start_date) {
      return null;
    }

    try {
      const startDate = parseLocalDate(project.phase_start_date) || new Date(project.phase_start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);

      const diffInMs = today.getTime() - startDate.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      // اليوم الحالي: يوم 1 = أول يوم (phase_start_date)، يوم 2 = اليوم التالي، إلخ
      const currentDay = Math.max(1, diffInDays + 1);
      return currentDay;
    } catch (error) {
      console.error('Error calculating current day:', error);
      return null;
    }
  };

  // ✅ دالة لحساب الشهر الحالي بناءً على phase_start_date
  const calculateCurrentMonth = (project) => {
    if (!project?.is_divided_into_phases || !project?.phase_start_date) {
      return null;
    }

    try {
      const startDate = parseLocalDate(project.phase_start_date) || new Date(project.phase_start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);

      const yearsDiff = today.getFullYear() - startDate.getFullYear();
      const monthsDiff = today.getMonth() - startDate.getMonth();
      const totalMonthsDiff = yearsDiff * 12 + monthsDiff;
      const currentMonth = Math.max(1, totalMonthsDiff + 1);
      return currentMonth;
    } catch (error) {
      console.error('Error calculating current month:', error);
      return null;
    }
  };

  // دالة للحصول على نافذة الأيام (اليوم الحالي + 3 أيام قادمة)
  const getDailyPhasesWindow = (project) => {
    if (!project?.is_divided_into_phases) {
      return [];
    }

    const currentDay = calculateCurrentDay(project);
    if (!currentDay) {
      return [];
    }

    const totalDays = project?.phase_duration_days || 0;
    if (totalDays === 0) {
      return [];
    }

    // ✅ نطاق تراكمي: من اليوم 1 حتى اليوم الحالي + 3 أيام
    const startDay = 1;
    const endDay = Math.min(currentDay + 3, totalDays);

    // الحصول على المشاريع اليومية من daily_phases
    const dailyPhases = Array.isArray(project?.daily_phases) ? project.daily_phases : [];

    // فلترة حسب النافذة واستبعاد المراحل المنتهية
    const windowPhases = dailyPhases.filter((phase) => {
      if ((phase?.status || phase?.Status) === 'منتهي') return false;
      const phaseDay = phase?.phase_day ?? phase?.phaseDay ?? null;
      return phaseDay !== null && phaseDay >= startDay && phaseDay <= endDay;
    });

    // البحث في قائمة المشاريع الكاملة عن المشاريع اليومية المرتبطة بهذا المشروع
    // (حتى لو وجدنا مشاريع في daily_phases، قد تكون هناك مشاريع إضافية في projects)
    const allDailyPhases = projects.filter((p) => {
      // ✅ التحقق من أن p هو object وليس array
      if (!p || Array.isArray(p)) return false;
      return p.is_daily_phase &&
        !p.is_divided_into_phases && // ✅ استبعاد المشاريع المقسمة الأساسية
        (p.parent_project_id === project.id || p.parent_project?.id === project.id);
    });


    const foundPhases = allDailyPhases.filter((phase) => {
      if ((phase?.status || phase?.Status) === 'منتهي') return false;
      const phaseDay = phase?.phase_day ?? phase?.phaseDay ?? null;
      return phaseDay !== null && phaseDay >= startDay && phaseDay <= endDay;
    });

    // دمج المشاريع من daily_phases والمشاريع من projects (تجنب التكرار)
    const allWindowPhases = [...windowPhases];
    const existingPhaseIds = new Set(windowPhases.map(p => p.id || `temp-${project.id}-${p.phase_day || p.phaseDay}`));

    foundPhases.forEach((phase) => {
      const phaseId = phase.id || `temp-${project.id}-${phase.phase_day || phase.phaseDay}`;
      if (!existingPhaseIds.has(phaseId)) {
        existingPhaseIds.add(phaseId);
        allWindowPhases.push(phase);
      }
    });

    if (allWindowPhases.length === 0) {
      const defaultPhases = [];
      for (let day = startDay; day <= endDay; day++) {
        defaultPhases.push({
          id: `temp-${project.id}-${day}`,
          phase_day: day,
          project_name: `${project.project_name} - اليوم ${day}`,
          status: 'جديد',
          parent_project_id: project.id,
          is_daily_phase: true,
          net_amount: calculateDailyAmount(project) || 0,
          donor_name: project.donor_name,
          donor_code: project.donor_code,
          project_type: project.project_type,
          currency: project.currency,
        });
      }
      return defaultPhases;
    }

    const filteredPhases = allWindowPhases.filter((phase) => {
      if ((phase?.status || phase?.Status) === 'منتهي') return false;
      const phaseDay = phase?.phase_day ?? phase?.phaseDay ?? null;
      return phaseDay !== null && phaseDay >= startDay && phaseDay <= endDay;
    });

    return filteredPhases.sort((a, b) => {
      const dayA = a?.phase_day ?? a?.phaseDay ?? 0;
      const dayB = b?.phase_day ?? b?.phaseDay ?? 0;
      return dayA - dayB;
    });
  };

  // دالة للحصول على نافذة الأشهر (الشهر الحالي + 3 أشهر قادمة)
  const getMonthlyPhasesWindow = (project) => {
    if (!project?.is_divided_into_phases) {
      return [];
    }

    const currentMonth = calculateCurrentMonth(project);
    if (!currentMonth) {
      return [];
    }

    const totalMonths = project?.total_months || project?.parent_project?.total_months || 0;
    if (totalMonths === 0) {
      return [];
    }

    // حساب نطاق الأشهر: الشهر الحالي + 3 أشهر قادمة
    const startMonth = currentMonth;
    const endMonth = Math.min(currentMonth + 3, totalMonths);


    // الحصول على المشاريع الشهرية من monthly_phases (إن وجدت) أو من قائمة المشاريع
    const monthlyPhases = Array.isArray(project?.monthly_phases) ? project.monthly_phases : [];


    // فلترة المشاريع الشهرية حسب نطاق الأشهر (الشهر الحالي + 3 أشهر فقط)
    const windowPhases = monthlyPhases.filter((phase) => {
      const monthNumber = phase?.month_number ?? phase?.monthNumber ?? null;
      const inWindow = monthNumber !== null && monthNumber >= startMonth && monthNumber <= endMonth;

      if (isProjectManager && !inWindow && monthNumber !== null) {
      }

      return inWindow;
    });

    // إذا لم تكن المشاريع الشهرية موجودة في monthly_phases، نبحث عنها في قائمة المشاريع الكاملة
    if (windowPhases.length === 0) {
      // البحث في قائمة المشاريع الكاملة عن المشاريع الشهرية المرتبطة بهذا المشروع
      const allMonthlyPhases = projects.filter((p) => {
        // ✅ التحقق من أن p هو object وليس array
        if (!p || Array.isArray(p)) return false;
        return p.is_monthly_phase &&
          (p.parent_project_id === project.id || p.parent_project?.id === project.id);
      });


      const foundPhases = allMonthlyPhases.filter((phase) => {
        const monthNumber = phase?.month_number ?? phase?.monthNumber ?? null;
        const inWindow = monthNumber !== null && monthNumber >= startMonth && monthNumber <= endMonth;
        return inWindow;
      });

      if (foundPhases.length > 0) {
        return foundPhases.sort((a, b) => {
          const monthA = a?.month_number ?? a?.monthNumber ?? 0;
          const monthB = b?.month_number ?? b?.monthNumber ?? 0;
          return monthA - monthB;
        });
      }

      // إذا لم نجد مشاريع شهرية موجودة، ننشئها افتراضياً
      const defaultPhases = [];
      for (let month = startMonth; month <= endMonth; month++) {
        defaultPhases.push({
          id: `temp-${project.id}-month-${month}`,
          month_number: month,
          project_name: `${project.project_name} - الشهر ${month}`,
          status: 'جديد',
          parent_project_id: project.id,
          is_monthly_phase: true,
          net_amount: calculateMonthlyAmount(project) || 0,
          donor_name: project.donor_name,
          donor_code: project.donor_code,
          project_type: project.project_type,
          currency: project.currency,
        });
      }
      return defaultPhases;
    }

    // ترتيب المشاريع الشهرية حسب month_number
    return windowPhases.sort((a, b) => {
      const monthA = a?.month_number ?? a?.monthNumber ?? 0;
      const monthB = b?.month_number ?? b?.monthNumber ?? 0;
      return monthA - monthB;
    });
  };

  // دالة للحصول على الشهر الحالي فقط (لرئيس قسم التنفيذ)
  const getMonthlyPhasesCurrentMonth = (project) => {
    if (!project?.is_divided_into_phases) {
      return [];
    }

    const currentMonth = calculateCurrentMonth(project);
    if (!currentMonth) {
      return [];
    }

    const totalMonths = project?.total_months || project?.parent_project?.total_months || 0;
    if (totalMonths === 0) {
      return [];
    }


    // الحصول على المشاريع الشهرية من monthly_phases (إن وجدت) أو من قائمة المشاريع
    const monthlyPhases = Array.isArray(project?.monthly_phases) ? project.monthly_phases : [];

    // فلترة المشاريع الشهرية للشهر الحالي فقط
    const currentMonthPhases = monthlyPhases.filter((phase) => {
      const monthNumber = phase?.month_number ?? phase?.monthNumber ?? null;
      return monthNumber === currentMonth;
    });

    // إذا لم تكن المشاريع الشهرية موجودة في monthly_phases، نبحث عنها في قائمة المشاريع الكاملة
    if (currentMonthPhases.length === 0) {
      // البحث في قائمة المشاريع الكاملة عن المشاريع الشهرية المرتبطة بهذا المشروع
      const allMonthlyPhases = projects.filter((p) => {
        // ✅ التحقق من أن p هو object وليس array
        if (!p || Array.isArray(p)) return false;
        return p.is_monthly_phase &&
          (p.parent_project_id === project.id || p.parent_project?.id === project.id);
      });

      const foundPhases = allMonthlyPhases.filter((phase) => {
        const monthNumber = phase?.month_number ?? phase?.monthNumber ?? null;
        return monthNumber === currentMonth;
      });

      if (foundPhases.length > 0) {
        return foundPhases.sort((a, b) => {
          const monthA = a?.month_number ?? a?.monthNumber ?? 0;
          const monthB = b?.month_number ?? b?.monthNumber ?? 0;
          return monthA - monthB;
        });
      }

      // إذا لم نجد مشروع شهري موجود، ننشئه افتراضياً للشهر الحالي فقط
      return [{
        id: `temp-${project.id}-month-${currentMonth}`,
        month_number: currentMonth,
        project_name: `${project.project_name} - الشهر ${currentMonth}`,
        status: 'جديد',
        parent_project_id: project.id,
        is_monthly_phase: true,
        net_amount: calculateMonthlyAmount(project) || 0,
        donor_name: project.donor_name,
        donor_code: project.donor_code,
        project_type: project.project_type,
        currency: project.currency,
      }];
    }

    // ترتيب المشاريع الشهرية حسب month_number
    return currentMonthPhases.sort((a, b) => {
      const monthA = a?.month_number ?? a?.monthNumber ?? 0;
      const monthB = b?.month_number ?? b?.monthNumber ?? 0;
      return monthA - monthB;
    });
  };

  const visibleProjects = useMemo(() => {
    // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
    // يمكن إعادة تفعيله عند الحاجة للتطوير
    // if (import.meta.env.DEV && !isProjectManager) {
    //   console.log('🔍 visibleProjects - Initial state:', {...});
    // }

    // ✅ التحقق من أن projects موجود وليس فارغاً
    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      return [];
    }

    let filteredProjects = [];

    // ✅ لصفحة المشاريع المنتهية: نثق في فلترة السيرفر ونعرض المشاريع المجلوبة كما هي (Paginated)
    // السيرفر يقوم بفلترة الحالة (منتهي) والدور والصلاحيات والبحث والترتيب
    if (isFinishedProjectsPage) {
      return projects;
    }

    // ✅ لمدير المشاريع: عرض المشاريع غير المقسمة + المشاريع المقسمة اليومية (اليوم + 3 أيام قادمة) + المشاريع المقسمة الشهرية (الشهر الحالي)
    if (isProjectManager) {
      // ✅ 1. المشاريع غير المقسمة (جميعها)
      const nonDividedProjects = projects.filter((project) => {
        // ✅ التحقق من أن project هو object وليس array
        if (!project || Array.isArray(project)) return false;
        const isDivided = project.is_divided_into_phases || project.isDividedIntoPhases || false;
        const isDailyPhase = project.is_daily_phase || project.isDailyPhase || false;
        const isMonthlyPhase = project.is_monthly_phase || project.isMonthlyPhase || false;

        // ✅ المشاريع غير المقسمة: ليست مقسمة وليست يومية وليست شهرية
        return !isDivided && !isDailyPhase && !isMonthlyPhase;
      });

      // ✅ 2. المشاريع المقسمة اليومية (نافذة تراكمية: من phase_start_date حتى اليوم+3، مع إخفاء المنتهي)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const windowEndDate = new Date(today);
      windowEndDate.setDate(windowEndDate.getDate() + 3);
      windowEndDate.setHours(23, 59, 59, 999);

      const dailyPhasesFromWindow = projects.filter((project) => {
        if (!project || Array.isArray(project)) return false;

        const isDailyPhase = project.is_daily_phase || project.isDailyPhase || false;
        if (!isDailyPhase) return false;

        if ((project.status || project.Status) === 'منتهي') return false;

        const executionDate = project.execution_date || project.executionDate;
        const phaseDay = project.phase_day || project.phaseDay;
        const parentProject = project.parentProject || project.parent_project;
        const phaseStartDate = parentProject?.phase_start_date || parentProject?.['phase_start_date'];

        let projectDate = null;

        if (executionDate) {
          projectDate = parseLocalDate(executionDate) || new Date(executionDate);
        } else if (phaseDay != null && phaseStartDate) {
          const startDate = parseLocalDate(phaseStartDate) || new Date(phaseStartDate);
          startDate.setDate(startDate.getDate() + (phaseDay - 1));
          projectDate = startDate;
        }

        if (!projectDate) return true;

        projectDate.setHours(0, 0, 0, 0);
        const projectTime = projectDate.getTime();
        const windowEnd = windowEndDate.getTime();

        let windowStart;
        if (phaseStartDate) {
          windowStart = parseLocalDate(phaseStartDate) || new Date(phaseStartDate);
          windowStart.setHours(0, 0, 0, 0);
        } else {
          windowStart = today;
        }
        return projectTime >= windowStart.getTime() && projectTime <= windowEnd;
      });

      // ✅ 3. المشاريع المقسمة الشهرية (شهر المشروع الحالي من phase_start_date)
      const monthlyPhasesCurrentMonth = projects.filter((project) => {
        if (!project || Array.isArray(project)) return false;

        const isMonthlyPhase = project.is_monthly_phase || project.isMonthlyPhase || false;
        if (!isMonthlyPhase) return false;

        const parentProject = project.parentProject || project.parent_project;
        const phaseStart = parentProject?.phase_start_date || parentProject?.['phase_start_date'];
        const currentProjectMonth = getCurrentProjectMonthFromStartDate(phaseStart);

        if (currentProjectMonth !== null) {
          const monthNum = getMonthNumber(project);
          return monthNum !== null && monthNum === currentProjectMonth;
        }

        // fallback: month_start_date أو execution_date ضمن الشهر التقويمي الحالي
        const monthStartDate = project.month_start_date || project.monthStartDate;
        const executionDate = project.execution_date || project.executionDate;
        let projectDate = null;
        if (monthStartDate) {
          projectDate = parseLocalDate(monthStartDate) || new Date(monthStartDate);
        } else if (executionDate) {
          projectDate = parseLocalDate(executionDate) || new Date(executionDate);
        }
        if (!projectDate) return true;

        // ✅ في صفحة المنتهية، لا نفلتر حسب الشهر التقويمي الحالي
        if (isFinishedProjectsPage) return true;

        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        return projectDate.getMonth() === currentMonth && projectDate.getFullYear() === currentYear;
      });

      // ✅ دمج جميع المشاريع
      filteredProjects = [...nonDividedProjects, ...dailyPhasesFromWindow, ...monthlyPhasesCurrentMonth];


      // ✅ تطبيق فلترة الحالة في Frontend - دعم الاختيار المتعدد
      if (Array.isArray(filters.status) && filters.status.length > 0) {
        filteredProjects = filteredProjects.filter((project) => filters.status.includes(project.status));
      }

      // ✅ تطبيق فلترة نوع المشروع في Frontend - دعم الاختيار المتعدد
      if (filters.project_type && Array.isArray(filters.project_type) && filters.project_type.length > 0) {
        filteredProjects = filteredProjects.filter((project) =>
          filters.project_type.includes(project.project_type)
        );
      }

      // ✅ تطبيق فلترة التفريعة في Frontend - دعم الاختيار المتعدد
      if (filters.subcategory_id && Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0) {
        const targetSubcategoryIds = filters.subcategory_id.map(id => parseInt(id, 10));
        const beforeFilterCount = filteredProjects.length;


        filteredProjects = filteredProjects.filter((project) => {
          // ✅ استخراج subcategory_id من عدة أماكن محتملة
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

          // ✅ إذا لم نجد subcategory_id، نتخطى هذا المشروع
          if (projectSubcategoryId === null || projectSubcategoryId === undefined || projectSubcategoryId === '') {
            return false;
          }

          // ✅ المقارنة بعد تحويل القيم إلى أرقام - دعم الاختيار المتعدد
          const projectIdNum = parseInt(String(projectSubcategoryId), 10);
          const matches = !isNaN(projectIdNum) && targetSubcategoryIds.includes(projectIdNum);

          return matches;
        });

      }

      // ✅ تطبيق فلترة البحث في Frontend إذا كان هناك نص بحث
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

      // ✅ تطبيق فلترة الباحث في Frontend إذا اختار المستخدم باحث معين
      if (filters.researcher_id && filters.researcher_id !== '') {
        const targetResearcherId = parseInt(filters.researcher_id, 10);
        filteredProjects = filteredProjects.filter((project) => {
          const researcherId = project.assigned_researcher_id ||
            project.assigned_researcher?.id ||
            project.researcher_id ||
            project.researcher?.id;
          return researcherId && parseInt(String(researcherId), 10) === targetResearcherId;
        });
      }

      // ✅ تطبيق فلترة المصور في Frontend إذا اختار المستخدم مصور معين
      if (filters.photographer_id && filters.photographer_id !== '') {
        const targetPhotographerId = parseInt(filters.photographer_id, 10);
        filteredProjects = filteredProjects.filter((project) => {
          const photographerId = project.assigned_photographer_id ||
            project.assigned_photographer?.id ||
            project.photographer_id ||
            project.photographer?.id;
          return photographerId && parseInt(String(photographerId), 10) === targetPhotographerId;
        });
      }

      // ✅ فلتر: المشاريع الفرعية فقط (Project Manager)
      if (filters.show_sub_projects_only) {
        filteredProjects = filteredProjects.filter((project) => {
          if (!project || Array.isArray(project)) return false;

          const parentProjectId =
            project.parent_project_id != null
              ? project.parent_project_id
              : project.parentProjectId;

          const isDailyPhase = project.is_daily_phase || project.isDailyPhase || false;
          const isMonthlyPhase = project.is_monthly_phase || project.isMonthlyPhase || false;
          const hasMonthNumber = project.month_number != null;
          const hasPhaseDay = project.phase_day != null;

          // ✅ تعريف موحّد للمشروع الفرعي:
          // - له مشروع أصل (parent_project_id)
          // - أو مشروع مرحلة شهرية/يومية أو مرتبط برقم شهر/يوم
          return (
            parentProjectId != null ||
            isDailyPhase ||
            isMonthlyPhase ||
            hasMonthNumber ||
            hasPhaseDay
          );
        });
      }

      // ✅ ترتيب افتراضي لمدير المشاريع: المتأخر أولاً، ثم العاجل، ثم التاريخ
      if (!sortConfig.key) {
        filteredProjects = [...filteredProjects].sort((a, b) => {
          // 1. المتأخر لمدير المشاريع (بقاء 2 يوم أو أقل)
          const aLate = isLateForPM(a);
          const bLate = isLateForPM(b);
          if (aLate && !bLate) return -1;
          if (!aLate && bLate) return 1;

          // 2. المشاريع العاجلة أولاً (ما عدا المنتهية)
          const aIsUrgent = a.is_urgent && a.status !== 'منتهي';
          const bIsUrgent = b.is_urgent && b.status !== 'منتهي';
          if (aIsUrgent && !bIsUrgent) return -1;
          if (!aIsUrgent && bIsUrgent) return 1;
          // ثم الترتيب حسب التاريخ (أحدث أولاً)
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bDate - aDate;
        });
      }
    } else if (isExecutionHead) {
      // ✅ لرئيس قسم التنفيذ: نفس منطق Project Manager مع دعم الاختيار المتعدد
      // ✅ 1. المشاريع غير المقسمة (جميعها)
      const nonDividedProjects = projects.filter((project) => {
        // ✅ التحقق من أن project هو object وليس array
        if (!project || Array.isArray(project)) return false;
        const isDivided = project.is_divided_into_phases || project.isDividedIntoPhases || false;
        const isDailyPhase = project.is_daily_phase || project.isDailyPhase || false;
        const isMonthlyPhase = project.is_monthly_phase || project.isMonthlyPhase || false;

        // ✅ المشاريع غير المقسمة: ليست مقسمة وليست يومية وليست شهرية
        return !isDivided && !isDailyPhase && !isMonthlyPhase;
      });

      // ✅ 2. المشاريع المقسمة اليومية (نافذة تراكمية: من phase_start_date حتى اليوم+3، مع إخفاء المنتهي)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const windowEndDate = new Date(today);
      windowEndDate.setDate(windowEndDate.getDate() + 3);
      windowEndDate.setHours(23, 59, 59, 999);

      const dailyPhasesFromWindow = projects.filter((project) => {
        if (!project || Array.isArray(project)) return false;

        const isDailyPhase = project.is_daily_phase || project.isDailyPhase || false;
        if (!isDailyPhase) return false;

        if ((project.status || project.Status) === 'منتهي') return false;

        const executionDate = project.execution_date || project.executionDate;
        const phaseDay = project.phase_day || project.phaseDay;
        const parentProject = project.parentProject || project.parent_project;
        const phaseStartDate = parentProject?.phase_start_date || parentProject?.['phase_start_date'];

        let projectDate = null;

        if (executionDate) {
          projectDate = parseLocalDate(executionDate) || new Date(executionDate);
        } else if (phaseDay != null && phaseStartDate) {
          const startDate = parseLocalDate(phaseStartDate) || new Date(phaseStartDate);
          startDate.setDate(startDate.getDate() + (phaseDay - 1));
          projectDate = startDate;
        }

        if (!projectDate) return true;

        projectDate.setHours(0, 0, 0, 0);
        const projectTime = projectDate.getTime();
        const windowEnd = windowEndDate.getTime();

        let windowStart;
        if (phaseStartDate) {
          windowStart = parseLocalDate(phaseStartDate) || new Date(phaseStartDate);
          windowStart.setHours(0, 0, 0, 0);
        } else {
          windowStart = today;
        }
        return projectTime >= windowStart.getTime() && projectTime <= windowEnd;
      });

      // ✅ 3. المشاريع المقسمة الشهرية (شهر المشروع الحالي من phase_start_date)
      const monthlyPhasesCurrentMonth = projects.filter((project) => {
        if (!project || Array.isArray(project)) return false;

        const isMonthlyPhase = project.is_monthly_phase || project.isMonthlyPhase || false;
        if (!isMonthlyPhase) return false;

        const parentProject = project.parentProject || project.parent_project;
        const phaseStart = parentProject?.phase_start_date || parentProject?.['phase_start_date'];
        const currentProjectMonth = getCurrentProjectMonthFromStartDate(phaseStart);

        if (currentProjectMonth !== null) {
          const monthNum = getMonthNumber(project);
          return monthNum !== null && monthNum === currentProjectMonth;
        }

        // fallback: month_start_date أو execution_date ضمن الشهر التقويمي الحالي
        const monthStartDate = project.month_start_date || project.monthStartDate;
        const executionDate = project.execution_date || project.executionDate;
        let projectDate = null;
        if (monthStartDate) {
          projectDate = parseLocalDate(monthStartDate) || new Date(monthStartDate);
        } else if (executionDate) {
          projectDate = parseLocalDate(executionDate) || new Date(executionDate);
        }
        if (!projectDate) return true;
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        return projectDate.getMonth() === currentMonth && projectDate.getFullYear() === currentYear;
      });

      // ✅ دمج جميع المشاريع
      filteredProjects = [...nonDividedProjects, ...dailyPhasesFromWindow, ...monthlyPhasesCurrentMonth];


      // ✅ تطبيق فلترة الحالة في Frontend - دعم الاختيار المتعدد
      if (Array.isArray(filters.status) && filters.status.length > 0) {
        filteredProjects = filteredProjects.filter((project) => filters.status.includes(project.status));
      }

      // ✅ تطبيق فلترة نوع المشروع في Frontend - دعم الاختيار المتعدد
      if (filters.project_type && Array.isArray(filters.project_type) && filters.project_type.length > 0) {
        filteredProjects = filteredProjects.filter((project) =>
          filters.project_type.includes(project.project_type)
        );
      }

      // ✅ تطبيق فلترة الباحث في Frontend إذا اختار المستخدم باحث معين
      if (filters.researcher_id && filters.researcher_id !== '') {
        const targetResearcherId = parseInt(filters.researcher_id, 10);
        filteredProjects = filteredProjects.filter((project) => {
          const researcherId = project.assigned_researcher_id ||
            project.assigned_researcher?.id ||
            project.researcher_id ||
            project.researcher?.id;
          return researcherId && parseInt(String(researcherId), 10) === targetResearcherId;
        });
      }

      // ✅ تطبيق فلترة المصور في Frontend إذا اختار المستخدم مصور معين
      if (filters.photographer_id && filters.photographer_id !== '') {
        const targetPhotographerId = parseInt(filters.photographer_id, 10);
        filteredProjects = filteredProjects.filter((project) => {
          const photographerId = project.assigned_photographer_id ||
            project.assigned_photographer?.id ||
            project.photographer_id ||
            project.photographer?.id;
          return photographerId && parseInt(String(photographerId), 10) === targetPhotographerId;
        });
      }

      // ✅ تطبيق فلترة الممنتج في Frontend إذا اختار المستخدم ممنتج معين (لدور الإعلام)
      if (isMediaManager && filters.producer_id && filters.producer_id !== '') {
        const targetProducerId = parseInt(filters.producer_id, 10);
        if (!isNaN(targetProducerId)) {
          filteredProjects = filteredProjects.filter((project) => {
            // ✅ البحث عن producer_id في جميع الحقول المحتملة
            let producerId = null;

            // ✅ الحقول المباشرة
            if (project.assigned_montage_producer_id != null && project.assigned_montage_producer_id !== '') {
              producerId = project.assigned_montage_producer_id;
            } else if (project.montage_producer_id != null && project.montage_producer_id !== '') {
              producerId = project.montage_producer_id;
            }
            // ✅ من الكائنات
            else if (project.assigned_montage_producer) {
              if (typeof project.assigned_montage_producer === 'object' && project.assigned_montage_producer !== null) {
                producerId = project.assigned_montage_producer.id || project.assigned_montage_producer.producer_id;
              } else if (typeof project.assigned_montage_producer === 'number' || typeof project.assigned_montage_producer === 'string') {
                producerId = project.assigned_montage_producer;
              }
            } else if (project.montage_producer) {
              if (typeof project.montage_producer === 'object' && project.montage_producer !== null) {
                producerId = project.montage_producer.id || project.montage_producer.producer_id;
              } else if (typeof project.montage_producer === 'number' || typeof project.montage_producer === 'string') {
                producerId = project.montage_producer;
              }
            }

            // ✅ المقارنة بعد تحويل القيم إلى أرقام
            if (producerId != null && producerId !== '' && producerId !== undefined) {
              const producerIdNum = parseInt(String(producerId), 10);
              return !isNaN(producerIdNum) && producerIdNum === targetProducerId;
            }

            return false;
          });
        }
      }

      // ✅ تطبيق فلترة التفريعة في Frontend - دعم الاختيار المتعدد
      if (filters.subcategory_id && Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0) {
        const targetSubcategoryIds = filters.subcategory_id.map(id => parseInt(id, 10));
        const beforeFilterCount = filteredProjects.length;

        filteredProjects = filteredProjects.filter((project) => {
          // ✅ استخراج subcategory_id من عدة أماكن محتملة
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

          // ✅ إذا لم نجد subcategory_id، نتخطى هذا المشروع
          if (projectSubcategoryId === null || projectSubcategoryId === undefined || projectSubcategoryId === '') {
            return false;
          }

          // ✅ المقارنة بعد تحويل القيم إلى أرقام - التحقق من وجودها في المصفوفة
          const projectIdNum = parseInt(String(projectSubcategoryId), 10);
          const matches = !isNaN(projectIdNum) && targetSubcategoryIds.includes(projectIdNum);

          return matches;
        });

      }

      // ✅ تطبيق فلترة البحث في Frontend إذا كان هناك نص بحث
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

      // ✅ لمدير المشاريع: إخفاء مشاريع الكفالة تماماً من القائمة العامة
      if (isProjectManager) {
        const countBeforePMFilter = filteredProjects.length;
        filteredProjects = filteredProjects.filter(project => !isSponsorshipProject(project));
        if (import.meta.env.DEV && countBeforePMFilter !== filteredProjects.length) {
          console.debug(`[ProjectManager] Filtered out ${countBeforePMFilter - filteredProjects.length} sponsorship projects`);
        }
      }
    } else if (isOrphanSponsorCoordinator) {
      // ✅ لمنسق الكفالة: الـ Backend مصدر الحقيقة للشهور/المراحل. فلترة حراسة: عرض كل مشاريع نوع "الكفالات" (كفالة أيتام + كفالة الأسر + أي تفريعة)، ثم فلترة واجهة: الحالة + البحث.
      filteredProjects = Array.isArray(projects) ? [...projects] : [];
      const countFromApi = filteredProjects.length;

      // ✅ حراسة: عرض فقط مشاريع الكفالات (نوع = الكفالات، يشمل كفالة أيتام وكفالة الأسر وإلخ)
      // 🔍 DEBUG: تشخيص project_type قبل الفلترة
      if (import.meta.env.DEV && filteredProjects.length > 0) {
        const sample = filteredProjects.slice(0, 3);
        sample.forEach((p, i) => {
          console.debug(`[DEBUG] project[${i}] id=${p?.id} project_type=`, p?.project_type, 'type:', typeof p?.project_type, 'JSON:', JSON.stringify(p?.project_type));
        });
      }
      filteredProjects = filteredProjects.filter(isSponsorshipProject);
      const countAfterGuard = filteredProjects.length;

      if (import.meta.env.DEV) {
        console.debug('[orphan_sponsor_coordinator] countFromApi:', countFromApi, 'countAfterGuard:', countAfterGuard, 'ids (first 20):', (filteredProjects || []).slice(0, 20).map((p) => p?.id).filter((id) => id != null));
      }

      // ✅ فلترة الشهر الحالي للمشاريع الشهرية فقط
      filteredProjects = filteredProjects.filter((project) => {
        // المشاريع غير الشهرية تظهر دائماً
        if (!isMonthlyPhaseProject(project)) return true;

        const monthNum = getMonthNumber(project);
        if (monthNum === null) return false;

        // استخراج phase_start_date من الأب
        const parent = project.parent_project ?? project.parentProject ?? null;
        const phaseStart = parent?.phase_start_date ?? parent?.phaseStartDate ?? null;

        // ✅ في صفحة المنتهية، لا نفلتر حسب الشهر الحالي
        if (isFinishedProjectsPage) return true;

        const currentProjectMonth = getCurrentProjectMonthFromStartDate(phaseStart);

        if (currentProjectMonth !== null) {
          return monthNum === currentProjectMonth;
        }

        // fallback: التحقق من month_start_date أو execution_date
        return isTodayInPhaseMonth(project);
      });

      if (Array.isArray(filters.status) && filters.status.length > 0) {
        filteredProjects = filteredProjects.filter((p) => filters.status.includes(p.status));
      }
      if (filters.searchQuery && filters.searchQuery.trim() !== '') {
        const s = filters.searchQuery.toLowerCase().trim();
        filteredProjects = filteredProjects.filter((p) => {
          const name = (p.project_name || p.project_name_ar || '').toLowerCase();
          const desc = (p.project_description || p.description || '').toLowerCase();
          const donor = (p.donor_name || '').toLowerCase();
          const donorCode = (p.donor_code || '').toLowerCase();
          const internal = (p.internal_code || '').toLowerCase();
          return name.includes(s) || desc.includes(s) || donor.includes(s) || donorCode.includes(s) || internal.includes(s);
        });
      }
      const countAfterStatusSearch = filteredProjects.length;
      if (import.meta.env.DEV) {
        console.debug('[orphan_sponsor_coordinator] countAfterStatusSearch:', countAfterStatusSearch);
      }
    } else if (isMediaManager) {
      // ✅ لدور الإعلام: عرض جميع المشاريع (مثل المدير)
      const mediaProjects = projects.filter((project) => {
        // ✅ التحقق من أن project هو object وليس array
        if (!project || Array.isArray(project)) return false;

        // ✅ استبعاد المشاريع الفرعية (اليومية والشهرية)
        const isDailyPhase = project.is_daily_phase || project.isDailyPhase || project.isDaily || false;
        const isMonthlyPhase = project.is_monthly_phase || project.isMonthlyPhase || project.isMonthly || false;
        const hasParentProject = project.parent_project_id != null ||
          project.parentProjectId != null ||
          (project.parent_project && project.parent_project.id != null) ||
          (project.parentProject && project.parentProject.id != null);
        const hasPhaseDay = project.phase_day != null || project.phaseDay != null;

        // ✅ التحقق من month_number بجميع الصيغ
        const monthNum = project.month_number ?? project.monthNumber ?? null;
        const hasMonthNumber = monthNum != null && monthNum !== '' && monthNum !== undefined && !isNaN(parseInt(monthNum));

        // ❌ استبعاد المشاريع الفرعية (اليومية والشهرية)
        if (isDailyPhase || isMonthlyPhase) {
          return false;
        }

        // ❌ استبعاد المشاريع التي لها parent_project_id (مشاريع فرعية)
        if (hasParentProject) {
          return false;
        }

        // ❌ استبعاد المشاريع التي لها month_number (مشاريع شهرية فرعية)
        if (hasMonthNumber) {
          return false;
        }

        // ❌ استبعاد المشاريع التي لها phase_day (مشاريع يومية فرعية)
        if (hasPhaseDay) {
          return false;
        }

        // ✅ عرض المشاريع غير المقسمة والمقسمة الأصلية فقط
        return true;
      });

      // ✅ التأكد من أن mediaProjects ليس فارغاً
      filteredProjects = Array.isArray(mediaProjects) ? mediaProjects : [];

      // ✅ تطبيق فلترة الحالة في Frontend - دعم الاختيار المتعدد
      if (Array.isArray(filters.status) && filters.status.length > 0) {
        filteredProjects = filteredProjects.filter((project) => filters.status.includes(project.status));
      }

      // ✅ تطبيق فلترة نوع المشروع في Frontend - دعم الاختيار المتعدد
      if (filters.project_type && Array.isArray(filters.project_type) && filters.project_type.length > 0) {
        filteredProjects = filteredProjects.filter((project) => {
          // ✅ استخراج project_type من المشروع (يدعم الكائن والنص)
          let projectType = '';
          if (typeof project.project_type === 'object' && project.project_type !== null) {
            projectType = project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '';
          } else if (project.project_type != null) {
            projectType = String(project.project_type);
          }

          // ✅ المقارنة مع الفلاتر (يدعم النص والكائن)
          return filters.project_type.includes(projectType) || filters.project_type.includes(project.project_type);
        });
      }

      // ✅ تطبيق فلترة الباحث في Frontend إذا اختار المستخدم باحث معين
      if (filters.researcher_id && filters.researcher_id !== '') {
        const targetResearcherId = parseInt(filters.researcher_id, 10);
        filteredProjects = filteredProjects.filter((project) => {
          const researcherId = project.assigned_researcher_id ||
            project.assigned_researcher?.id ||
            project.researcher_id ||
            project.researcher?.id;
          return researcherId && parseInt(String(researcherId), 10) === targetResearcherId;
        });
      }

      // ✅ تطبيق فلترة المصور في Frontend إذا اختار المستخدم مصور معين
      if (filters.photographer_id && filters.photographer_id !== '') {
        const targetPhotographerId = parseInt(filters.photographer_id, 10);
        filteredProjects = filteredProjects.filter((project) => {
          const photographerId = project.assigned_photographer_id ||
            project.assigned_photographer?.id ||
            project.photographer_id ||
            project.photographer?.id;
          return photographerId && parseInt(String(photographerId), 10) === targetPhotographerId;
        });
      }

      // ✅ تطبيق فلترة الممنتج في Frontend إذا اختار المستخدم ممنتج معين (لدور الإعلام)
      if (filters.producer_id && filters.producer_id !== '') {
        const targetProducerId = parseInt(String(filters.producer_id).trim(), 10);
        if (!isNaN(targetProducerId) && targetProducerId > 0) {
          filteredProjects = filteredProjects.filter((project) => {
            // ✅ البحث عن producer_id في جميع الحقول المحتملة
            let producerId = null;

            // ✅ الحقول المباشرة (التحقق من null و undefined و '' و 0)
            if (project.assigned_montage_producer_id != null &&
              project.assigned_montage_producer_id !== '' &&
              project.assigned_montage_producer_id !== undefined &&
              project.assigned_montage_producer_id !== 0) {
              producerId = project.assigned_montage_producer_id;
            } else if (project.montage_producer_id != null &&
              project.montage_producer_id !== '' &&
              project.montage_producer_id !== undefined &&
              project.montage_producer_id !== 0) {
              producerId = project.montage_producer_id;
            }
            // ✅ من الكائنات
            else if (project.assigned_montage_producer) {
              if (typeof project.assigned_montage_producer === 'object' && project.assigned_montage_producer !== null) {
                producerId = project.assigned_montage_producer.id ||
                  project.assigned_montage_producer.producer_id ||
                  project.assigned_montage_producer.montage_producer_id;
              } else if (typeof project.assigned_montage_producer === 'number' || typeof project.assigned_montage_producer === 'string') {
                producerId = project.assigned_montage_producer;
              }
            } else if (project.montage_producer) {
              if (typeof project.montage_producer === 'object' && project.montage_producer !== null) {
                producerId = project.montage_producer.id ||
                  project.montage_producer.producer_id ||
                  project.montage_producer.montage_producer_id;
              } else if (typeof project.montage_producer === 'number' || typeof project.montage_producer === 'string') {
                producerId = project.montage_producer;
              }
            }

            // ✅ المقارنة بعد تحويل القيم إلى أرقام (مع دعم المقارنة كنص أيضاً)
            if (producerId != null && producerId !== '' && producerId !== undefined && producerId !== 0) {
              const producerIdNum = parseInt(String(producerId).trim(), 10);
              const producerIdStr = String(producerId).trim();
              const targetProducerIdStr = String(targetProducerId).trim();

              // ✅ المقارنة كرقم أو كنص
              return (!isNaN(producerIdNum) && producerIdNum === targetProducerId) ||
                (producerIdStr === targetProducerIdStr);
            }

            return false;
          });
        }
      }

      // ✅ تطبيق فلترة التفريعة في Frontend - دعم الاختيار المتعدد
      if (filters.subcategory_id && Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0) {
        const targetSubcategoryIds = filters.subcategory_id.map(id => parseInt(id, 10));

        filteredProjects = filteredProjects.filter((project) => {
          // ✅ استخراج subcategory_id من عدة أماكن محتملة
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

          // ✅ إذا لم نجد subcategory_id، نتخطى هذا المشروع
          if (projectSubcategoryId === null || projectSubcategoryId === undefined || projectSubcategoryId === '') {
            return false;
          }

          // ✅ المقارنة بعد تحويل القيم إلى أرقام - التحقق من وجودها في المصفوفة
          const projectIdNum = parseInt(String(projectSubcategoryId), 10);
          const matches = !isNaN(projectIdNum) && targetSubcategoryIds.includes(projectIdNum);

          return matches;
        });
      }

      // ✅ تطبيق فلترة البحث في Frontend إذا كان هناك نص بحث
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

      // ✅ تطبيق فلترة المشروع الأصلي في Frontend إذا اختار المستخدم مشروع أصلي معين
      if (filters.parent_project_id && filters.parent_project_id !== '') {
        const targetParentId = parseInt(filters.parent_project_id, 10);
        filteredProjects = filteredProjects.filter((project) => {
          // ✅ قراءة parent_project_id من عدة أماكن محتملة
          const projectParentId = project.parent_project_id ||
            project.parentProjectId ||
            (project.parent_project && project.parent_project.id) ||
            (project.parentProject && project.parentProject.id) ||
            null;

          // ✅ إذا كان المشروع هو المشروع الأصلي نفسه (id = parent_project_id)
          if (project.id === targetParentId) {
            return true;
          }

          // ✅ إذا كان المشروع فرعي (له parent_project_id)
          if (projectParentId !== null && projectParentId !== undefined) {
            return parseInt(String(projectParentId), 10) === targetParentId;
          }

          return false;
        });
      }

      // ✅ تطبيق فلترة رقم اليوم (phase_day) في Frontend إذا اختار المستخدم يوم معين
      if (filters.phase_day && filters.phase_day !== '') {
        const targetPhaseDay = parseInt(filters.phase_day, 10);
        filteredProjects = filteredProjects.filter((project) => {
          const projectPhaseDay = project.phase_day || project.phaseDay || null;
          if (projectPhaseDay !== null && projectPhaseDay !== undefined) {
            return parseInt(String(projectPhaseDay), 10) === targetPhaseDay;
          }
          return false;
        });
      }
    } else if (isAdmin) {
      // ✅ للإدارة: عرض كل ما يرسله الـ API (أصلية + فرعية يومية/شهرية عند بدء إجراء أو تم التوريد وما بعد) دون استبعاد
      filteredProjects = Array.isArray(projects) ? projects : [];

      if (import.meta.env.DEV) {
        const subCount = (projects || []).filter(p => (p?.parent_project_id != null || p?.parentProjectId != null) && (p?.is_daily_phase || p?.is_monthly_phase)).length;
        console.log('✅ ProjectsList (Admin): showing all from API (parents + sub-projects):', { total: filteredProjects.length, sub_projects: subCount });
      }

      // ✅ إخفاء المشاريع الشهرية واليومية الفرعية التي لا تزال في حالة "جديد" (لم يتم عليها أي إجراء بعد)
      filteredProjects = filteredProjects.filter((project) => {
        if (!project || Array.isArray(project)) return false;

        const isMonthlyPhase = project.is_monthly_phase || project.isMonthlyPhase || false;
        const isDailyPhase = project.is_daily_phase || project.isDailyPhase || false;
        const hasParentId =
          project.parent_project_id != null ||
          project.parentProjectId != null ||
          (project.parent_project && project.parent_project.id != null);

        // إذا كان مشروعاً شهرياً أو يومياً فرعياً → أخفه إذا كان في حالة "جديد"
        if ((isMonthlyPhase || isDailyPhase) && hasParentId) {
          return project.status !== 'جديد';
        }

        return true;
      });

      if (import.meta.env.DEV) {
        const totalBefore = projects.length;
        const totalAfter = filteredProjects.length;
        const excluded = totalBefore - totalAfter;

        // ✅ إذا كان Backend قد فعل الفلترة، لا نحتاج إلى حساب excluded
        if (backendHideChildProjects) {
          console.log('✅ ProjectsList (Admin): Backend filtered projects (hide_child_projects=true):', {
            total_before: totalBefore,
            total_after: totalAfter,
            backend_filtered: true,
            message: 'Backend already filtered projects. No Frontend filtering applied.',
            expected_count: 247,
            status: totalAfter === 247
              ? '✅ CORRECT - Matches expected count (242 undivided + 5 divided parents)'
              : `⚠️ CHECK - Expected 247 but got ${totalAfter} (difference: ${totalAfter - 247})`
          });
        } else {
          // ✅ حساب تفصيلي لكل نوع (فقط إذا كان Frontend يفلتر)
          const undivided = filteredProjects.filter(p => {
            const isDivided = p.is_divided_into_phases || p.isDividedIntoPhases || false;
            const hasParent = p.parent_project_id != null || p.parentProjectId != null;
            return !isDivided && !hasParent;
          }).length;

          const dividedParents = filteredProjects.filter(p => {
            const isDivided = p.is_divided_into_phases || p.isDividedIntoPhases || false;
            const hasParent = p.parent_project_id != null || p.parentProjectId != null;
            const hasPhaseDay = p.phase_day != null || p.phaseDay != null;
            const monthNum = p.month_number ?? p.monthNumber ?? null;
            const hasMonthNumber = monthNum != null && monthNum !== '' && monthNum !== undefined && !isNaN(parseInt(monthNum));
            const isDaily = p.is_daily_phase || p.isDailyPhase || false;
            const isMonthly = p.is_monthly_phase || p.isMonthlyPhase || false;
            return isDivided && !hasParent && !hasPhaseDay && !hasMonthNumber && !isDaily && !isMonthly;
          }).length;

          // ✅ حساب المشاريع المستبعدة بالتفصيل
          const excludedDaily = projects.filter(p => {
            const isDaily = p.is_daily_phase || p.isDailyPhase || p.phase_day != null || p.phase_type === 'daily';
            return isDaily;
          }).length;

          const excludedMonthly = projects.filter(p => {
            const isMonthly = p.is_monthly_phase || p.isMonthlyPhase || (p.month_number != null && p.month_number !== '') || p.phase_type === 'monthly';
            return isMonthly;
          }).length;

          const excludedWithParent = projects.filter(p => {
            const hasParent = p.parent_project_id != null || p.parentProjectId != null;
            const isDaily = p.is_daily_phase || p.isDailyPhase || false;
            const isMonthly = p.is_monthly_phase || p.isMonthlyPhase || false;
            return hasParent && (isDaily || isMonthly);
          }).length;

          if (DEBUG_PROJECTS_LIST_VERBOSE) {
            console.log('✅ ProjectsList (Admin): Filtered projects:', {
              total_before: totalBefore,
              total_after: totalAfter,
              excluded_sub_projects: excluded,
              breakdown: { undivided, divided_parents: dividedParents, actual_total: totalAfter },
              excluded_details: { daily_phases: excludedDaily, monthly_phases: excludedMonthly, with_parent: excludedWithParent },
              backend_filtered: backendHideChildProjects
            });
          }
        }
      }
      // this is section five **********************************************************************
      // ✅ تطبيق فلترة الحالة في Frontend - دعم الاختيار المتعدد
      if (Array.isArray(filters.status) && filters.status.length > 0) {
        filteredProjects = filteredProjects.filter((project) => filters.status.includes(project.status));
      }

      // ✅ تطبيق فلترة نوع المشروع في Frontend - دعم الاختيار المتعدد
      if (filters.project_type && Array.isArray(filters.project_type) && filters.project_type.length > 0) {
        filteredProjects = filteredProjects.filter((project) =>
          filters.project_type.includes(project.project_type)
        );
      }

      // ✅ تطبيق فلترة الباحث في Frontend إذا اختار المستخدم باحث معين
      if (filters.researcher_id && filters.researcher_id !== '') {
        const targetResearcherId = parseInt(filters.researcher_id, 10);
        filteredProjects = filteredProjects.filter((project) => {
          const researcherId = project.assigned_researcher_id ||
            project.assigned_researcher?.id ||
            project.researcher_id ||
            project.researcher?.id;
          return researcherId && parseInt(String(researcherId), 10) === targetResearcherId;
        });
      }

      // ✅ تطبيق فلترة المصور في Frontend إذا اختار المستخدم مصور معين
      if (filters.photographer_id && filters.photographer_id !== '') {
        const targetPhotographerId = parseInt(filters.photographer_id, 10);
        filteredProjects = filteredProjects.filter((project) => {
          const photographerId = project.assigned_photographer_id ||
            project.assigned_photographer?.id ||
            project.photographer_id ||
            project.photographer?.id;
          return photographerId && parseInt(String(photographerId), 10) === targetPhotographerId;
        });
      }

      // ✅ تطبيق فلترة الممنتج في Frontend إذا اختار المستخدم ممنتج معين (لدور الإعلام)
      if (isMediaManager && filters.producer_id && filters.producer_id !== '') {
        const targetProducerId = parseInt(filters.producer_id, 10);
        if (!isNaN(targetProducerId)) {
          filteredProjects = filteredProjects.filter((project) => {
            // ✅ البحث عن producer_id في جميع الحقول المحتملة
            let producerId = null;

            // ✅ الحقول المباشرة
            if (project.assigned_montage_producer_id != null && project.assigned_montage_producer_id !== '') {
              producerId = project.assigned_montage_producer_id;
            } else if (project.montage_producer_id != null && project.montage_producer_id !== '') {
              producerId = project.montage_producer_id;
            }
            // ✅ من الكائنات
            else if (project.assigned_montage_producer) {
              if (typeof project.assigned_montage_producer === 'object' && project.assigned_montage_producer !== null) {
                producerId = project.assigned_montage_producer.id || project.assigned_montage_producer.producer_id;
              } else if (typeof project.assigned_montage_producer === 'number' || typeof project.assigned_montage_producer === 'string') {
                producerId = project.assigned_montage_producer;
              }
            } else if (project.montage_producer) {
              if (typeof project.montage_producer === 'object' && project.montage_producer !== null) {
                producerId = project.montage_producer.id || project.montage_producer.producer_id;
              } else if (typeof project.montage_producer === 'number' || typeof project.montage_producer === 'string') {
                producerId = project.montage_producer;
              }
            }

            // ✅ المقارنة بعد تحويل القيم إلى أرقام
            if (producerId != null && producerId !== '' && producerId !== undefined) {
              const producerIdNum = parseInt(String(producerId), 10);
              return !isNaN(producerIdNum) && producerIdNum === targetProducerId;
            }

            return false;
          });
        }
      }

      // ✅ تطبيق فلترة التفريعة في Frontend - دعم الاختيار المتعدد
      if (filters.subcategory_id && Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0) {
        const targetSubcategoryIds = filters.subcategory_id.map(id => parseInt(id, 10));
        const beforeFilterCount = filteredProjects.length;

        filteredProjects = filteredProjects.filter((project) => {
          // ✅ استخراج subcategory_id من عدة أماكن محتملة
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

          // ✅ إذا لم نجد subcategory_id، نتخطى هذا المشروع
          if (projectSubcategoryId === null || projectSubcategoryId === undefined || projectSubcategoryId === '') {
            return false;
          }

          // ✅ المقارنة بعد تحويل القيم إلى أرقام - التحقق من وجودها في المصفوفة
          const projectIdNum = parseInt(String(projectSubcategoryId), 10);
          const matches = !isNaN(projectIdNum) && targetSubcategoryIds.includes(projectIdNum);

          return matches;
        });

      }

      // ✅ تطبيق فلترة البحث في Frontend إذا كان هناك نص بحث
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

      // ✅ تطبيق فلترة المشروع الأصلي في Frontend إذا اختار المستخدم مشروع أصلي معين
      if (filters.parent_project_id && filters.parent_project_id !== '') {
        const targetParentId = parseInt(filters.parent_project_id, 10);
        filteredProjects = filteredProjects.filter((project) => {
          // ✅ قراءة parent_project_id من عدة أماكن محتملة
          const projectParentId = project.parent_project_id ||
            project.parentProjectId ||
            (project.parent_project && project.parent_project.id) ||
            (project.parentProject && project.parentProject.id) ||
            null;

          // ✅ إذا كان المشروع هو المشروع الأصلي نفسه (id = parent_project_id)
          if (project.id === targetParentId) {
            return true;
          }

          // ✅ إذا كان المشروع فرعي (له parent_project_id)
          if (projectParentId !== null && projectParentId !== undefined) {
            return parseInt(String(projectParentId), 10) === targetParentId;
          }

          return false;
        });

      }

      // ✅ تطبيق فلترة رقم اليوم (phase_day) في Frontend إذا اختار المستخدم يوم معين
      if (filters.phase_day && filters.phase_day !== '') {
        const targetPhaseDay = parseInt(filters.phase_day, 10);
        filteredProjects = filteredProjects.filter((project) => {
          const projectPhaseDay = project.phase_day || project.phaseDay || null;
          if (projectPhaseDay !== null && projectPhaseDay !== undefined) {
            return parseInt(String(projectPhaseDay), 10) === targetPhaseDay;
          }
          return false;
        });

      }

      // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
      // يمكن إعادة تفعيله عند الحاجة للتطوير
      // if (import.meta.env.DEV && isAdmin) {
      //   console.log('📊 Admin filtered projects:', {...});
      // }
    } else if (!hasDailyPhaseFlag) {
      // ✅ إذا لم يكن هناك مشاريع يومية، نعرض جميع المشاريع
      filteredProjects = Array.isArray(projects) ? [...projects] : [];
    } else {
      // ✅ للأدوار الأخرى: عرض المشاريع اليومية والشهرية
      filteredProjects = Array.isArray(projects) ? projects.filter((project) => {
        // ✅ التحقق من أن project هو object وليس array
        if (!project || Array.isArray(project)) return false;
        return project.is_daily_phase || project.is_monthly_phase;
      }) : [];
    }

    // ✅ فلترة المشاريع المنتهية: إزالة المشاريع المنتهية للمستخدمين غير Admin و MediaManager
    // ✅ للأدمن: الفلترة تتم في fetchProjects بناءً على isFinishedProjectsPage
    if (!isAdmin && !isMediaManager) {
      filteredProjects = filteredProjects.filter((project) => {
        const status = (project.status || '').trim();
        return status !== 'منتهي';
      });
    } else if (isAdmin) {
      // ✅ للأدمن: تطبيق الفلترة بناءً على الصفحة
      if (isFinishedProjectsPage) {
        // ✅ في صفحة المشاريع المنتهية: عرض المشاريع المنتهية فقط
        filteredProjects = filteredProjects.filter((project) => {
          return project.status === 'منتهي';
        });
      } else {
        // ✅ في القائمة الرئيسية: استبعاد المشاريع المنتهية
        filteredProjects = filteredProjects.filter((project) => {
          return project.status !== 'منتهي';
        });
      }
    }

    // ✅ تطبيق فلترة المشروع الأصلي في Frontend لجميع الأدوار (ما عدا الأدوار التي طبقتها بالفعل)
    if (!isAdmin && !isMediaManager && !isProjectManager && !isOrphanSponsorCoordinator && filters.parent_project_id && filters.parent_project_id !== '') {
      const targetParentId = parseInt(filters.parent_project_id, 10);
      filteredProjects = filteredProjects.filter((project) => {
        // ✅ قراءة parent_project_id من عدة أماكن محتملة
        const projectParentId = project.parent_project_id ||
          project.parentProjectId ||
          (project.parent_project && project.parent_project.id) ||
          (project.parentProject && project.parentProject.id) ||
          null;

        // ✅ إذا كان المشروع هو المشروع الأصلي نفسه (id = parent_project_id)
        if (project.id === targetParentId) {
          return true;
        }

        // ✅ إذا كان المشروع فرعي (له parent_project_id)
        if (projectParentId !== null && projectParentId !== undefined) {
          return parseInt(String(projectParentId), 10) === targetParentId;
        }

        return false;
      });
    }

    // ✅ تطبيق فلترة رقم اليوم (phase_day) في Frontend لجميع الأدوار (ما عدا الأدوار التي طبقتها بالفعل)
    if (!isAdmin && !isMediaManager && !isProjectManager && !isOrphanSponsorCoordinator && filters.phase_day && filters.phase_day !== '') {
      const targetPhaseDay = parseInt(filters.phase_day, 10);
      filteredProjects = filteredProjects.filter((project) => {
        const projectPhaseDay = project.phase_day || project.phaseDay || null;
        if (projectPhaseDay !== null && projectPhaseDay !== undefined) {
          return parseInt(String(projectPhaseDay), 10) === targetPhaseDay;
        }
        return false;
      });

    }

    // ✅ فلترة المشاريع المتأخرة فقط (الأحمر) — تعتمد على isLateForPM (remaining_days <= 0)
    if (filters.show_delayed_only) {
      filteredProjects = filteredProjects.filter((project) => isLateForPM(project));
    }

    // ✅ فلترة المشاريع العاجلة فقط
    if (filters.show_urgent_only) {
      filteredProjects = filteredProjects.filter((project) => {
        return project.is_urgent === true;
      });
    }

    // ✅ تطبيق الترتيب إذا كان موجوداً (مع إعطاء الأولوية للمشاريع العاجلة ما عدا المنتهية)
    if (sortConfig.key) {
      filteredProjects = [...filteredProjects].sort((a, b) => {
        // المشاريع العاجلة أولاً دائماً (ما عدا المنتهية)
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

    // ✅ لمنسق الكفالة: visibleProjects = filteredProjects (حالة + بحث فقط، بدون فلترة شهر/مرحلة)
    if (isOrphanSponsorCoordinator) {
      return Array.isArray(filteredProjects) ? filteredProjects : [];
    }

    // ✅ التأكد من إرجاع مصفوفة صحيحة
    return Array.isArray(filteredProjects) ? filteredProjects : [];
  }, [projects, hasDailyPhaseFlag, isAdmin, isProjectManager, isMediaManager, isOrphanSponsorCoordinator, normalizedRole, user?.role, sortConfig, filters.status, filters.project_type, filters.subcategory_id, filters.producer_id, filters.month_number, filters.show_delayed_only, filters.show_urgent_only, filters.searchQuery, filters.perPage, filters.page, filters.researcher_id, filters.photographer_id, filters.parent_project_id, filters.phase_day, isFinishedProjectsPage]);

  // تطبيق pagination في Frontend عند الترتيب حسب التاريخ
  const paginatedProjects = useMemo(() => {
    // ✅ دائماً نستخدم البيانات كما هي من Backend لأننا نطبق pagination هناك
    return visibleProjects;
  }, [visibleProjects]);


  const parentProjectOptions = useMemo(() => {
    const optionsMap = new Map();

    projects.forEach((project) => {
      // ✅ التحقق من أن project هو object وليس array
      if (!project || Array.isArray(project)) return;

      // ✅ إضافة المشاريع الفرعية (اليومية والشهرية) مع مشاريعها الأصلية
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

      // ✅ إضافة المشاريع الأصلية المقسمة
      if (project?.is_divided_into_phases) {
        // ✅ التحقق من أن المشروع ليس فرعي (ليس له parent_project_id)
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

    // ✅ ترتيب القائمة حسب الاسم
    return Array.from(optionsMap.values()).sort((a, b) => {
      const nameA = (a.label || '').toLowerCase();
      const nameB = (b.label || '').toLowerCase();
      return nameA.localeCompare(nameB, 'ar');
    });
  }, [projects]);

  // ✅ اسم المشروع الأصلي للفرعية (من parent_project أو parentProject من الـ API)
  const getSubProjectParentName = (project) => {
    if (!project) return null;
    const parent = project.parent_project || project.parentProject || project.__parentProject;
    const name = parent?.project_name || parent?.name;
    if (name) return name;
    const parentId = project.parent_project_id ?? project.parentProjectId ?? parent?.id;
    return parentId ? `المشروع الأصلي #${parentId}` : null;
  };

  // ✅ دالة لتحديد لون الخط حسب نوع التقسيم
  const getDivisionTextColor = (project) => {
    if (!project?.is_divided_into_phases) return 'text-gray-800'; // لون افتراضي للمشاريع غير المقسمة

    // ✅ تحديد نوع التقسيم
    const hasMonthlyFlag = project.phase_type === 'monthly' ||
      project.is_monthly_phase === true ||
      project.isMonthlyPhase === true;
    const hasDailyFlag = project.phase_type === 'daily' ||
      project.is_daily_phase === true ||
      project.isDailyPhase === true;
    const hasTotalMonths = !!(project.total_months || project.parent_project?.total_months);

    const isMonthly = hasMonthlyFlag || (!hasDailyFlag && hasTotalMonths);

    if (isMonthly) {
      return 'text-purple-600 font-semibold'; // لون بنفسجي للمشاريع الشهرية
    } else if (hasDailyFlag || project.phase_duration_days || project.parent_project?.phase_duration_days) {
      return 'text-blue-600 font-semibold'; // لون أزرق للمشاريع اليومية
    }

    return 'text-gray-800'; // لون افتراضي
  };

  const renderProjectBadges = (project) => {
    const badges = [];

    // ✅ Badge للمشروع العاجل (بجميع الصيغ المحتملة)
    const isUrgentBadge = project?.is_urgent === true ||
      project?.is_urgent === 1 ||
      project?.is_urgent === '1' ||
      project?.is_urgent === 'true' ||
      String(project?.is_urgent || '').toLowerCase() === 'true' ||
      Boolean(project?.is_urgent);

    // if (isUrgentBadge) {
    //   badges.push(
    //     <span key="urgent" className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-900 border-2 border-amber-500 shadow-md animate-pulse" title="مشروع عاجل">
    //       <AlertCircle className="w-4 h-4" />
    //       عاجل
    //     </span>
    //   );
    // }

    // ✅ مشروع فرعي يومي (مرحلة يومية)
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

    // ✅ مشروع فرعي شهري (مرحلة شهرية) - يظهر في قائمة الإدارة عند بدء إجراء أو تم التوريد
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
      // ✅ تحديد نوع التقسيم باستخدام عدة مؤشرات
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

  const handleOpenShelterModal = (project) => {
    setSelectedProject(project);
    setSelectShelterModalOpen(true);
  };

  // ✅ دالة لنقل مشروع كفالة للتنفيذ بدون مخيم
  const handleTransferToExecution = async (projectId) => {
    if (!window.confirm('هل أنت متأكد من نقل المشروع للتنفيذ؟ (مشاريع الكفالة لا تحتاج اختيار مخيم)')) {
      return;
    }

    setTransferringToExecution(projectId);
    try {
      const response = await apiClient.post(`/project-proposals/${projectId}/transfer-to-execution`);

      if (response.data.success) {
        toast.success(response.data.message || 'تم نقل المشروع للتنفيذ بنجاح');
        // ✅ إبطال الكاش بعد التحديث
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

  // ✅ دالة لفتح نافذة إدارة الأيتام
  const handleOpenOrphansModal = (project) => {
    setSelectedProject(project);
    setAddOrphansModalOpen(true);
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
        setIsEditingShekel(false);
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
        setIsEditingShekel(false);
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

  // ✅ دالة للحصول على Badge الأيام المتبقية - منطق موحد مع Backend
  // العداد يتوقف عند "وصل للمتبرع" أو "منتهي". عند "تم التنفيذ" يستمر الحساب حتى "وصل للمتبرع".
  // Backend يرجع: remaining_days (null عند التوقف), is_delayed, delayed_days (0 عند التوقف).
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

    const remainingRaw = project?.remaining_days ?? project?.remainingDays;
    if (remainingRaw === null || remainingRaw === undefined) {
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

    const remaining = Number(remainingRaw);
    const notDelayedStatuses = ['وصل للمتبرع', 'منتهي', 'ملغى'];
    const isOverdue = !Number.isNaN(remaining) && remaining <= 2 && !notDelayedStatuses.includes(status);

    if (!Number.isNaN(remaining) && remaining <= 0 && !notDelayedStatuses.includes(status)) {
      const fromApi = project?.delayed_days ?? project?.delayedDays;
      const computed = Math.abs(remaining);
      const raw = (fromApi != null && Number(fromApi) > 0) ? Number(fromApi) : computed;
      let delayedDays = Math.max(1, raw);

      return {
        element: (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 shadow-sm">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>متأخر</span>
            <span className="font-extrabold">{delayedDays}</span>
            <span>يوم</span>
          </span>
        ),
        isOverdue: true,
        isFinished: false,
      };
    }

    if (!Number.isNaN(remaining) && remaining > 0) {
      let dayText = 'يوم';
      if (remaining > 2 && remaining <= 10) dayText = 'أيام';
      else if (remaining > 10) dayText = 'يوما';

      return {
        element: (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300 shadow-sm">
            <span>متبقي</span>
            <span className="font-extrabold">{remaining}</span>
            <span>{dayText}</span>
          </span>
        ),
        isOverdue: isOverdue,
        isFinished: false,
      };
    }

    return {
      element: (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300 shadow-sm">
          <span>متبقي</span>
          <span className="font-extrabold">{Number.isNaN(remaining) ? '—' : Math.abs(remaining)}</span>
          <span>يوم</span>
        </span>
      ),
      isOverdue: false,
      isFinished: false,
    };
  };

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
                    <span className="font-semibold text-sm" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>إجمالي: {isFinishedProjectsPage && pagination && pagination.total > 0 ? pagination.total : visibleProjects.length} مشروع</span>
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
        <div className="bg-white rounded-3xl p-5 shadow-xl border border-gray-100">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative group flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-sky-600 w-5 h-5 transition-colors" />
                <input
                  type="text"
                  placeholder="بحث في اسم المشروع، الوصف، اسم المتبرع، كود المتبرع، الكود الداخلي... (اضغط Enter)"
                  value={searchInput}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchSubmit}
                  className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all duration-300 text-gray-800 font-medium placeholder-gray-400"
                  style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}
                />
              </div>
              <button
                onClick={handleSearchButtonClick}
                className="px-6 py-4 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
                style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}
                title="بحث"
              >
                <Search className="w-5 h-5" />
                بحث
              </button>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`bg-gradient-to-r ${showFilters ? 'from-sky-500 to-blue-600 text-white' : 'from-gray-100 to-gray-200 text-gray-700'} hover:shadow-lg px-8 py-4 rounded-2xl font-semibold flex items-center gap-2 transition-all duration-300 transform hover:-translate-y-0.5`}
              style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}
            >
              <Filter className="w-5 h-5" />
              {showFilters ? 'إخفاء الفلاتر' : 'فلترة'}
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="pt-5 mt-5 border-t-2 border-gray-200">
              {/* ✅ آلية عرض الدفعات الشهرية (لمنسق الكفالات فقط) */}
              {isOrphanSponsorCoordinator && (
                <div className="mb-4 rounded-2xl border-2 border-sky-100 bg-sky-50/80 p-4">
                  <button
                    type="button"
                    onClick={() => setShowMonthlyPhasesHelp(!showMonthlyPhasesHelp)}
                    className="w-full flex items-center justify-between gap-2 text-right hover:bg-sky-100/50 rounded-xl py-2 px-3 -mx-1 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sky-800 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      <Info className="w-5 h-5 text-sky-600 shrink-0" />
                      آلية عرض الدفعات الشهرية
                    </span>
                    {showMonthlyPhasesHelp ? <ChevronUp className="w-5 h-5 text-sky-600" /> : <ChevronDown className="w-5 h-5 text-sky-600" />}
                  </button>
                  {showMonthlyPhasesHelp && (
                    <div className="mt-3 pt-3 border-t border-sky-200 text-sm text-gray-700 space-y-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      <p className="font-semibold text-sky-900">
                        يعتمد عرض الدفعات على <strong>تاريخ بداية المراحل</strong> للمشروع، وليس على تاريخ إدخال المشروع فقط.
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        <li><strong>الشهر 1</strong> = شهر بداية المراحل (أول دفعة)</li>
                        <li><strong>الشهر 2</strong> = الشهر التالي (ثاني دفعة)، وهكذا.</li>
                        <li>لا تظهر أي دفعة قبل شهر الانطلاق الفعلي للمشروع.</li>
                      </ul>
                      <p className="text-gray-600">
                        مثال: إذا كانت بداية المراحل في <strong>فبراير</strong>، ففي فبراير تظهر <strong>الدفعة الأولى</strong>، وفي مارس <strong>الدفعة الثانية</strong>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* ✅ حالة المشروع - اختيار متعدد */}
                <div className="relative">
                  <label className="block text-sm font-bold text-gray-800 mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                    الحالة
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-right flex items-center justify-between bg-white hover:border-sky-300 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                    >
                      <span className={`${Array.isArray(filters.status) && filters.status.length > 0 ? 'text-sky-600 font-bold' : 'text-gray-600'}`}>
                        {Array.isArray(filters.status) && filters.status.length > 0
                          ? `${filters.status.length} محددة`
                          : 'الكل'
                        }
                      </span>
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    </button>

                    {showStatusDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2">
                          <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Array.isArray(filters.status) && filters.status.length === 0}
                              onChange={() => handleFilterChange('status', [])}
                              className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                            />
                            <span className="text-sm text-gray-800 font-semibold">جميع الحالات</span>
                          </label>
                          {PROJECT_STATUSES.map((status) => (
                            <label key={status} className="flex items-center gap-2 px-3 py-2 hover:bg-sky-50 rounded-lg cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={Array.isArray(filters.status) && filters.status.includes(status)}
                                onChange={(e) => {
                                  const currentStatus = Array.isArray(filters.status) ? filters.status : [];
                                  if (e.target.checked) {
                                    handleFilterChange('status', [...currentStatus, status]);
                                  } else {
                                    handleFilterChange('status', currentStatus.filter(s => s !== status));
                                  }
                                }}
                                className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                              />
                              <span className="text-sm text-gray-700">{status}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ✅ نوع المشروع - اختيار متعدد */}
                {!isOrphanSponsorCoordinator && (
                  <div className="relative">
                    <label className="block text-sm font-bold text-gray-800 mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                      نوع المشروع
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowProjectTypeDropdown(!showProjectTypeDropdown)}
                        disabled={projectTypesLoading}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 text-right flex items-center justify-between bg-white hover:border-sky-300 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                      >
                        <span className={`${Array.isArray(filters.project_type) && filters.project_type.length > 0 ? 'text-sky-600 font-bold' : 'text-gray-600'}`}>
                          {Array.isArray(filters.project_type) && filters.project_type.length > 0
                            ? `${filters.project_type.length} محدد`
                            : 'الكل'
                          }
                        </span>
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      </button>

                      {showProjectTypeDropdown && !projectTypesLoading && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          <div className="p-2">
                            <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Array.isArray(filters.project_type) && filters.project_type.length === 0}
                                onChange={() => handleFilterChange('project_type', [])}
                                className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                              />
                              <span className="text-sm text-gray-700 font-medium">الكل</span>
                            </label>
                            {projectTypes.map((type) => (
                              <label key={type} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Array.isArray(filters.project_type) && filters.project_type.includes(type)}
                                  onChange={(e) => {
                                    const currentTypes = Array.isArray(filters.project_type) ? filters.project_type : [];
                                    const newTypes = e.target.checked
                                      ? [...currentTypes, type]
                                      : currentTypes.filter(t => t !== type);
                                    handleFilterChange('project_type', newTypes);
                                  }}
                                  className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                                />
                                <span className="text-sm text-gray-700">{type}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ✅ التفريعة - اختيار متعدد */}
                {!isOrphanSponsorCoordinator && (
                  <div className="relative">
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      التفريعة
                      {filters.project_type.length > 0 && (
                        <span className="text-xs font-normal text-gray-500 mr-2">
                          ({filteredSubcategories.length} متاحة)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowSubcategoryDropdown(!showSubcategoryDropdown)}
                        disabled={subcategoriesLoading}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 text-right flex items-center justify-between bg-white hover:border-sky-300 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                      >
                        <span className={`${Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0 ? 'text-sky-600 font-bold' : 'text-gray-600'}`}>
                          {Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0
                            ? `${filters.subcategory_id.length} محدد`
                            : 'الكل'
                          }
                        </span>
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      </button>

                      {showSubcategoryDropdown && !subcategoriesLoading && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          <div className="p-2">
                            <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Array.isArray(filters.subcategory_id) && filters.subcategory_id.length === 0}
                                onChange={() => handleFilterChange('subcategory_id', [])}
                                className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                              />
                              <span className="text-sm text-gray-700 font-medium">الكل</span>
                            </label>
                            {filteredSubcategories.length === 0 && filters.project_type.length > 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                لا توجد تفريعات لنوع المشروع المختار
                              </div>
                            ) : (
                              filteredSubcategories.map((subcategory) => (
                                <label key={subcategory.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Array.isArray(filters.subcategory_id) && filters.subcategory_id.includes(String(subcategory.id))}
                                    onChange={(e) => {
                                      const currentIds = Array.isArray(filters.subcategory_id) ? filters.subcategory_id : [];
                                      const subcatId = String(subcategory.id);
                                      const newIds = e.target.checked
                                        ? [...currentIds, subcatId]
                                        : currentIds.filter(id => id !== subcatId);
                                      handleFilterChange('subcategory_id', newIds);
                                    }}
                                    className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                                  />
                                  <span className="text-sm text-gray-700">
                                    {subcategory.name_ar || subcategory.name || `التفريعة ${subcategory.id}`}
                                    {subcategory.project_type && (
                                      <span className="text-xs text-gray-400 mr-1">({subcategory.project_type})</span>
                                    )}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isOrphanSponsorCoordinator && (
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                      الباحث
                    </label>
                    <select
                      value={filters.researcher_id}
                      onChange={(e) => handleFilterChange('researcher_id', e.target.value)}
                      disabled={loadingFilterLists}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                      style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}
                    >
                      <option value="">الكل</option>
                      {researchers.map((researcher) => (
                        <option key={researcher.id} value={researcher.id}>
                          {researcher.name || researcher.email || `الباحث ${researcher.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                    المصور
                  </label>
                  <select
                    value={filters.photographer_id}
                    onChange={(e) => handleFilterChange('photographer_id', e.target.value)}
                    disabled={loadingFilterLists}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                    style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}
                  >
                    <option value="">الكل</option>
                    {photographers.map((photographer) => (
                      <option key={photographer.id} value={photographer.id}>
                        {photographer.name || photographer.email || `المصور ${photographer.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ✅ فلتر الممنتج (لدور الإعلام فقط) */}
                {isMediaManager && (
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                      الممنتج
                    </label>
                    <select
                      value={filters.producer_id}
                      onChange={(e) => handleFilterChange('producer_id', e.target.value)}
                      disabled={loadingFilterLists}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                    >
                      <option value="">الكل</option>
                      {producers.map((producer) => (
                        <option key={producer.id} value={producer.id}>
                          {producer.name || producer.email || `الممنتج ${producer.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* ✅ فلتر الشهر: لا يُعرض لمنسق الكفالة — الـ Backend مصدر الحقيقة، ولا نطبّق فلترة شهر في الفرونت */}
                {!isOrphanSponsorCoordinator && (
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      الشهر
                    </label>
                    <select
                      value={filters.month_number}
                      onChange={(e) => handleFilterChange('month_number', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                    >
                      <option value="">الكل</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <option key={month} value={month}>
                          الشهر {month}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!isOrphanSponsorCoordinator && (
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      رقم اليوم (للمشاريع اليومية)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={filters.phase_day}
                      onChange={(e) => handleFilterChange('phase_day', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                      placeholder="مثال: 5"
                    />
                  </div>
                )}

                {!isOrphanSponsorCoordinator && (
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      المشروع الأصلي
                    </label>
                    <select
                      value={filters.parent_project_id}
                      onChange={(e) => handleFilterChange('parent_project_id', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                    >
                      <option value="">الكل</option>
                      {parentProjectOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* ✅ فلتر المشاريع المتأخرة - مخفي عن منسق الكفالات */}
                {!isOrphanSponsorCoordinator && (
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={filters.show_delayed_only}
                          onChange={(e) => handleFilterChange('show_delayed_only', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-300 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-red-500 peer-checked:to-orange-500 transition-all duration-300 shadow-inner"></div>
                        <div className="absolute right-0.5 top-0.5 bg-white w-6 h-6 rounded-full transition-transform duration-300 peer-checked:translate-x-[-28px] shadow-md"></div>
                      </div>
                      <span className="text-sm font-bold text-gray-800 group-hover:text-red-600 transition-colors" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                        المشاريع المتأخرة فقط
                      </span>
                    </label>
                  </div>
                )}

                {/* ✅ فلتر المشاريع العاجلة */}
                <div className="flex items-center">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={filters.show_urgent_only}
                        onChange={(e) => handleFilterChange('show_urgent_only', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-14 h-7 bg-gray-300 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-amber-500 peer-checked:to-yellow-500 transition-all duration-300 shadow-inner"></div>
                      <div className="absolute right-0.5 top-0.5 bg-white w-6 h-6 rounded-full transition-transform duration-300 peer-checked:translate-x-[-28px] shadow-md"></div>
                    </div>
                    <span className="text-sm font-bold text-gray-800 group-hover:text-amber-600 transition-colors" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                      المشاريع العاجلة فقط
                    </span>
                  </label>
                </div>

                {/* ✅ فلتر: المشاريع الفرعية فقط (لمدير المشاريع) */}
                {isProjectManager && (
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={filters.show_sub_projects_only}
                          onChange={(e) => handleFilterChange('show_sub_projects_only', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-300 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600 transition-all duration-300 shadow-inner"></div>
                        <div className="absolute right-0.5 top-0.5 bg-white w-6 h-6 rounded-full transition-transform duration-300 peer-checked:translate-x-[-28px] shadow-md"></div>
                      </div>
                      <span className="text-sm font-bold text-gray-800 group-hover:text-purple-600 transition-colors" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                        المشاريع الفرعية فقط
                      </span>
                    </label>
                  </div>
                )}

                {/* ✅ فلتر المشاريع الأصلية المقسمة فقط (للإدارة) */}
                {isAdmin && (
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={filters.show_divided_parents_only}
                          onChange={(e) => handleFilterChange('show_divided_parents_only', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-300 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-sky-500 peer-checked:to-blue-600 transition-all duration-300 shadow-inner"></div>
                        <div className="absolute right-0.5 top-0.5 bg-white w-6 h-6 rounded-full transition-transform duration-300 peer-checked:translate-x-[-28px] shadow-md"></div>
                      </div>
                      <span className="text-sm font-bold text-gray-800 group-hover:text-sky-600 transition-colors" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                        المشاريع الأصلية المقسمة فقط
                      </span>
                    </label>
                  </div>
                )}

                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                  >
                    <X className="w-5 h-5" />
                    مسح الفلاتر
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Execution Alerts for Coordinators */}
        {isExecutedCoordinator && (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-2xl p-6 shadow-xl border-2 border-amber-200 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-amber-500 rounded-full p-3 shadow-lg">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white">
                      تنبيه مهم
                    </span>
                    {readyForExecutionProjects.length > 0 && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">
                        {readyForExecutionProjects.length}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-1 flex items-center gap-3" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                    <span>مشاريع جاهزة للتنفيذ</span>
                    {readyForExecutionProjects.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] h-10 px-3 rounded-full bg-red-500 text-white text-lg font-bold shadow-lg">
                        {readyForExecutionProjects.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-gray-600 text-sm">
                    {readyForExecutionProjects.length > 0
                      ? `تم توزيع ${readyForExecutionProjects.length} مشروع من قبل مدير المشاريع على الفرق وهي بانتظار اختيار المخيم والبدء بالتنفيذ.`
                      : 'لا توجد مشاريع جاهزة للتنفيذ حالياً. سيتم إشعارك عند توزيع مشاريع جديدة من قبل مدير المشاريع.'}
                  </p>
                </div>
              </div>
            </div>

            {readyForExecutionProjects.length > 0 && (
              <>
                <div className="bg-white rounded-xl p-4 border border-amber-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-600" />
                    قائمة المشاريع الموزعة
                  </h3>
                  <div className="space-y-3">
                    {readyForExecutionProjects.map((project) => {
                      const teamName = project?.assigned_to_team?.team_name ||
                        project?.assigned_team?.team_name ||
                        project?.team_name ||
                        'غير محدد';
                      const photographerName = project?.assigned_photographer?.name ||
                        project?.photographer?.name ||
                        'غير محدد';

                      return (
                        <div
                          key={project.id}
                          className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border-2 border-amber-200 bg-gradient-to-r from-white to-amber-50 hover:shadow-md transition-shadow"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {(project?.donor_code || project?.internal_code) ? (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-amber-100 text-amber-700 border border-amber-300">
                                  كود المشروع: {getProjectCode(project, '---')}
                                </span>
                              ) : null}
                              <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-sky-100 text-sky-700">
                                {(() => {
                                  if (!project.project_type) return '---';
                                  if (typeof project.project_type === 'object' && project.project_type !== null) {
                                    return project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '---';
                                  }
                                  return project.project_type;
                                })()}
                              </span>
                            </div>
                            <p className="text-gray-800 font-bold text-lg mb-1">
                              {project.project_name || project.donor_name || 'مشروع بدون اسم'}
                            </p>
                            <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                              {getProjectDescription(project)}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                الفريق: <span className="font-semibold text-gray-700">{teamName}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Camera className="w-3 h-3" />
                                المصور: <span className="font-semibold text-gray-700">{photographerName}</span>
                              </span>
                            </div>
                            {/* تفاصيل الأصناف */}
                            {projectsSupplyData[project.id]?.items_count > 0 && (
                              <div className="mt-3 pt-3 border-t border-amber-200 flex flex-wrap items-center gap-3">
                                {projectsSupplyData[project.id]?.items_count > 0 && (
                                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 text-sm font-medium">
                                    <ShoppingCart className="w-4 h-4" />
                                    <span className="font-bold">{projectsSupplyData[project.id].items_count}</span>
                                    <span>صنف</span>
                                  </span>
                                )}
                                {projectsSupplyData[project.id]?.items && projectsSupplyData[project.id].items.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {projectsSupplyData[project.id].items.slice(0, 3).map((item, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs"
                                      >
                                        <span>{item.warehouse_item?.name || item.name || 'صنف'}</span>
                                        {item.quantity_per_unit && (
                                          <span className="text-gray-500">({item.quantity_per_unit}/طرد)</span>
                                        )}
                                      </span>
                                    ))}
                                    {projectsSupplyData[project.id].items.length > 3 && (
                                      <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs">
                                        +{projectsSupplyData[project.id].items.length - 3} أكثر
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!(project.shelter_id || project.shelter?.id) ? (
                              <button
                                onClick={() => handleOpenShelterModal(project)}
                                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                              >
                                <Home className="w-4 h-4" />
                                اختيار المخيم
                              </button>
                            ) : (
                              <button
                                onClick={() => handleTransferToExecution(project.id)}
                                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                              >
                                <Play className="w-4 h-4" />
                                نقل للتنفيذ
                              </button>
                            )}
                            <Link
                              to={`/project-management/projects/${project.id}`}
                              className="px-4 py-2.5 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              التفاصيل
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {/* this is section 6 */}
        {/* ✅ قسم المشاريع قيد التنفيذ - للمنسق المنفذ */}
        {isExecutedCoordinator && inExecutionProjects.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 rounded-2xl p-6 shadow-xl border-2 border-blue-200 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-blue-500 rounded-full p-3 shadow-lg">
                  <Play className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white">
                      قيد التنفيذ
                    </span>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                      {inExecutionProjects.length}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-1 flex items-center gap-3" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                    <span>مشاريع قيد التنفيذ</span>
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] h-10 px-3 rounded-full bg-blue-600 text-white text-lg font-bold shadow-lg">
                      {inExecutionProjects.length}
                    </span>
                  </h2>
                  <p className="text-gray-600 text-sm">
                    هذه المشاريع تم نقلها للتنفيذ وهي قيد العمل حالياً.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-blue-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                <Briefcase className="w-5 h-5 text-blue-600" />
                قائمة المشاريع قيد التنفيذ
              </h3>
              <div className="space-y-3">
                {inExecutionProjects.map((project) => {
                  return (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl hover:from-blue-100 hover:to-indigo-100 transition-all border border-blue-200 hover:border-blue-300 hover:shadow-md"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-gray-500 text-sm font-medium">
                            #{project.id}
                          </span>
                          <h4 className="font-bold text-gray-800 text-base">
                            {project.project_name || project.donor_name || 'مشروع بدون اسم'}
                          </h4>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {project.team_name && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-100 text-purple-800 font-medium">
                              <Users className="w-4 h-4" />
                              {project.team_name}
                            </span>
                          )}
                          {project.shelter?.camp_name && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-100 text-green-800 font-medium">
                              <Home className="w-4 h-4" />
                              {project.shelter.camp_name}
                            </span>
                          )}
                          {project.execution_date && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-100 text-orange-800 font-medium">
                              <Calendar className="w-4 h-4" />
                              {new Date(project.execution_date).toLocaleDateString('ar-EG')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/project-management/projects/${project.id}`}
                          className="px-4 py-2.5 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          التفاصيل
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Projects Table */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          {paginatedProjects.length === 0 && !loading ? (
            <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl m-4">
              <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <FileText className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-gray-600 text-xl font-bold mb-3" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>لا توجد مشاريع</p>
              <div className="text-gray-500 text-sm space-y-1 max-w-2xl mx-auto" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 400 }}>
                {Array.isArray(filters.status) && filters.status.length > 0 && (
                  <p className="bg-blue-50 text-blue-700 inline-block px-4 py-2 rounded-lg font-medium mx-1">
                    الحالات: {filters.status.join(', ')}
                  </p>
                )}
                {Array.isArray(filters.project_type) && filters.project_type.length > 0 && (
                  <p className="bg-purple-50 text-purple-700 inline-block px-4 py-2 rounded-lg font-medium mx-1">
                    الأنواع: {filters.project_type.join(', ')}
                  </p>
                )}
                {Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0 && (
                  <p className="bg-green-50 text-green-700 inline-block px-4 py-2 rounded-lg font-medium mx-1">
                    التفريعات: {filters.subcategory_id.length}
                  </p>
                )}
                {filters.show_delayed_only && (
                  <p className="bg-red-50 text-red-700 inline-block px-4 py-2 rounded-lg font-medium mx-1">
                    المشاريع المتأخرة فقط
                  </p>
                )}
                {filters.searchQuery && (
                  <p className="bg-orange-50 text-orange-700 inline-block px-4 py-2 rounded-lg font-medium mx-1">
                    البحث: {filters.searchQuery}
                  </p>
                )}
                {(!Array.isArray(filters.status) || filters.status.length === 0) && (!Array.isArray(filters.project_type) || filters.project_type.length === 0) && (!Array.isArray(filters.subcategory_id) || filters.subcategory_id.length === 0) && !filters.searchQuery && (
                  <p className="text-gray-400">لا توجد فلترة نشطة</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                    {(isAdmin || isMediaManager) ? (
                      <tr>
                        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>كود المشروع</th>
                        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الاسم</th>
                        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>اسم المتبرع</th>
                        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الوصف</th>
                        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>المبلغ قبل الخصم</th>
                        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>المبلغ بعد التحويل</th>
                        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>المبلغ الصافي</th>
                        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>حالة المشروع</th>
                        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الأيام المتبقية للتنفيذ</th>
                        <th className="text-center py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الخيارات</th>
                      </tr>
                    ) : isProjectManager ? (
                      <tr>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>كود المشروع</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الاسم</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اليوم</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اسم المتبرع</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>التفاصيل</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>المبلغ الصافي للتنفيذ</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>حالة المشروع</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الأيام المتبقية للتنفيذ</th>
                        <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الإجراءات</th>
                      </tr>
                    ) : isExecutedCoordinator ? (
                      <tr>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الكود</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الوصف</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الفريق المكلف</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>المصور</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الحالة</th>
                        <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الإجراءات</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الكود</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اسم المشروع</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الوصف</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اسم المتبرع</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>رقم الشهر</th>
                        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الحالة</th>
                        {!isOrphanSponsorCoordinator && (
                          <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الفريق المكلف</th>
                        )}
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>المصور</th>
                        <th
                          className="text-right py-4 px-6 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                          style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}
                          onClick={() => handleSort('created_at')}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <span>تاريخ التسجيل</span>
                            {sortConfig.key === 'created_at' && (
                              sortConfig.direction === 'asc' ? (
                                <ArrowUp className="w-4 h-4 text-sky-600" />
                              ) : (
                                <ArrowDown className="w-4 h-4 text-sky-600" />
                              )
                            )}
                          </div>
                        </th>
                        {!isOrphanSponsorCoordinator && (
                          <th
                            className="text-right py-4 px-6 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('updated_at')}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <span>تاريخ التحديث</span>
                              {sortConfig.key === 'updated_at' && (
                                sortConfig.direction === 'asc' ? (
                                  <ArrowUp className="w-4 h-4 text-sky-600" />
                                ) : (
                                  <ArrowDown className="w-4 h-4 text-sky-600" />
                                )
                              )}
                            </div>
                          </th>
                        )}
                        <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">الإجراءات</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {paginatedProjects.map((project) => {
                      // ✅ التحقق من أن project هو object وليس array
                      if (!project || Array.isArray(project)) {
                        if (import.meta.env.DEV) {
                          console.warn('⚠️ Invalid project in paginatedProjects:', project);
                        }
                        return null;
                      }

                      const remainingInfo = getRemainingDaysBadge(project);
                      // ✅ استخدام الدالة الموحدة من helpers
                      const projectCode = getProjectCode(project, '---');
                      const projectName =
                        project?.project_name ||
                        project?.beneficiary_name ||
                        project?.donor_name ||
                        project?.requester_name ||
                        '---';
                      const currencyCode = project?.currency_code || project?.currency?.currency_code;

                      // ✅ محاولة جلب البيانات من المشروع نفسه أو من parent_project للمشاريع المقسمة
                      const parentProject = project?.parent_project || project?.parentProject;
                      const amountAfter = project?.amount_in_usd ??
                        project?.net_amount_usd ??
                        project?.net_amount ??
                        parentProject?.net_amount_usd ??
                        parentProject?.net_amount ??
                        0;
                      const netAmount = project?.net_amount_usd ??
                        project?.net_amount ??
                        parentProject?.net_amount_usd ??
                        parentProject?.net_amount ??
                        0;

                      // ✅ التحقق من كون المشروع مؤجل
                      const isPostponed = project.status === 'مؤجل' || !!(project.postponed_at || project.postponement_reason);
                      // ✅ التحقق من كون المشروع عاجل (بجميع الصيغ المحتملة) - ما عدا المنتهية
                      const isUrgent = (project.is_urgent === true ||
                        project.is_urgent === 1 ||
                        project.is_urgent === '1' ||
                        project.is_urgent === 'true' ||
                        String(project.is_urgent || '').toLowerCase() === 'true' ||
                        Boolean(project.is_urgent)) && project.status !== 'منتهي';
                      // ✅ التحقق من كون المشروع مرحلة شهرية
                      const isMonthlyPhase = project.is_monthly_phase || project.isMonthlyPhase || false;

                      // ✅ تحديد className للصف بناءً على الحالة
                      let rowClassName = 'border-b transition-all duration-200 group ';
                      if (isPostponed) {
                        rowClassName += 'bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-l-8 border-orange-400 shadow-md hover:shadow-lg hover:from-orange-100 hover:via-amber-100 hover:to-orange-100';
                      } else if (isUrgent) {
                        // ✅ تمييز المشاريع العاجلة بخلفية حمراء واضحة وحدود مميزة
                        rowClassName += 'bg-gradient-to-r from-red-100 via-red-50 to-red-100 border-l-8 border-red-600 shadow-lg hover:shadow-xl hover:from-red-200 hover:via-red-100 hover:to-red-200 ring-2 ring-red-300';
                      } else if (isLateForPM(project)) {
                        // ✅ تمييز المشاريع المتأخرة لمدير المشاريع (أحمر)
                        rowClassName += 'bg-red-50 border-l-8 border-red-500 hover:bg-red-100 shadow-sm';
                      } else if (isOrphanSponsorCoordinator && isMonthlyPhase) {
                        // ✅ (منسق الكفالة فقط): تمييز المشاريع الشهرية بلون مختلف عن المشاريع العادية
                        rowClassName += 'bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border-l-8 border-purple-400 hover:from-purple-100 hover:via-indigo-100 hover:to-purple-100';
                      } else {
                        rowClassName += 'border-gray-100 hover:bg-gradient-to-r hover:from-sky-50 hover:to-blue-50';
                      }

                      return (
                        <tr key={project.id} className={rowClassName}>
                          {(isAdmin || isMediaManager) ? (
                            <>
                              <td className="py-2 px-3 text-sm font-medium text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
                                <Link to={`/project-management/projects/${project.id}`} className="hover:underline text-sky-600 hover:text-sky-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
                                  {projectCode}
                                </Link>
                              </td>

                              <td className="py-2 px-3 text-sm text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={getDivisionTextColor(project)} style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>{projectName}</span>
                                    {isUrgent && (
                                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white border-2 border-red-700 shadow-lg animate-pulse ring-2 ring-red-400" title="مشروع عاجل">
                                        <AlertCircle className="w-4 h-4" />
                                        عاجل
                                      </span>
                                    )}
                                    {isPostponed && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-orange-400 to-amber-500 text-white border-2 border-orange-600 shadow-lg animate-pulse">
                                        <Clock className="w-3 h-3" />
                                        مؤجل
                                      </span>
                                    )}
                                  </div>
                                  {renderProjectBadges(project)}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-sm text-gray-800 font-medium" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
                                {project.donor_name || project.donor?.name || '---'}
                              </td>
                              <td className="py-2 px-3 text-sm text-gray-700 max-w-xs" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 400 }}>
                                <div className="line-clamp-2" title={getProjectDescription(project)}>
                                  {getProjectDescription(project)}
                                </div>
                                {renderProjectBadges(project)}
                                {(project.is_daily_phase || project.is_monthly_phase) && getSubProjectParentName(project) && (
                                  <span className="text-xs text-gray-500 mt-1 block">
                                    من: {getSubProjectParentName(project)}
                                    {(project.is_monthly_phase || project.isMonthlyPhase) && (project.month_number != null || project.monthNumber != null) && (
                                      <span className="text-purple-600 font-semibold">
                                        {isOrphanSponsorCoordinator
                                          ? ` - ${getDisplayMonthNameForProject(project) || `الشهر ${project.month_number ?? project.monthNumber}`}`
                                          : ` - الشهر ${project.month_number ?? project.monthNumber}`
                                        }
                                      </span>
                                    )}
                                    {(project.is_daily_phase || project.isDailyPhase) && (project.phase_day != null || project.phaseDay != null) && (
                                      <span className="text-blue-600 font-semibold"> - اليوم {project.phase_day ?? project.phaseDay}</span>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-sm font-medium text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
                                {formatOriginalAmount(project, currencyCode)}
                              </td>
                              <td className="py-2 px-3 text-sm font-medium text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
                                {formatCurrency(amountAfter || 0)}
                              </td>
                              <td className="py-2 px-3 text-sm font-medium text-green-600" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                                {formatCurrency(netAmount || 0)}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  onClick={() => handleStatusClick(project)}
                                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${isPostponed ? 'bg-gradient-to-r from-orange-100 to-amber-200 text-orange-800 border-2 border-orange-400 font-bold shadow-md' : `${getStatusColor(project.status)} text-white`} ${project.status === 'وصل للمتبرع' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                  style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}
                                  title={project.status === 'وصل للمتبرع' ? 'انقر للموافقة/الرفض' : ''}
                                >
                                  {isPostponed && (
                                    <Clock className="w-3.5 h-3.5" />
                                  )}
                                  {project.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-sm font-medium" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
                                {remainingInfo.element}
                              </td>
                              <td className="py-2 px-3" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
                                <div className="flex items-center justify-center gap-2">
                                  <Link
                                    to={`/project-management/projects/${project.id}`}
                                    className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors"
                                    title="عرض التفاصيل"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Link>
                                  <button
                                    onClick={() => handleProjectImagesClick(project)}
                                    className={`p-2 rounded-lg transition-colors ${hasProjectImage(project)
                                      ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'
                                      }`}
                                    title={hasProjectImage(project) ? 'تنزيل صورة المشروع' : 'لا توجد صورة للمشروع'}
                                    disabled={!hasProjectImage(project)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  {isAdmin && (
                                    <Link
                                      to={`/project-management/projects/${project.id}/edit`}
                                      className="bg-orange-100 hover:bg-orange-200 text-orange-700 p-2 rounded-lg transition-colors"
                                      title="تعديل"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Link>
                                  )}
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDeleteClick(project)}
                                      disabled={deletingProject === (project.id || project._id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                      title="حذف المشروع"
                                    >
                                      {deletingProject === (project.id || project._id) ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  {/* ✅ زر التوريد - متاح في أي مرحلة */}
                                  {isProjectManager && (
                                    <button
                                      onClick={() => handleOpenSupplyModal(project)}
                                      className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
                                      title={project.status === 'جديد' ? 'التسوق من المخزن' : 'تحديث التوريد'}
                                    >
                                      <ShoppingCart className="w-4 h-4" />
                                    </button>
                                  )}
                                  {/* زر إضافة عدد المستفيدين - لرئيس قسم التنفيذ و Project Manager */}
                                  {(isExecutionHead || isProjectManager || normalizedRole.includes('رئيس') || String(user?.role || '').includes('رئيس') || String(user?.role_name || '').includes('رئيس')) && (
                                    <button
                                      onClick={() => handleOpenBeneficiariesModal(project)}
                                      className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors"
                                      title="إضافة/تحديث عدد المستفيدين"
                                    >
                                      <Users className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </>
                          ) : isProjectManager ? (
                            <>
                              <td className="py-4 px-6 text-sm font-medium text-gray-800">
                                {project.__isFromWindow && project.__parentProject ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-500">
                                      {getProjectCode(project.__parentProject)}
                                    </span>
                                    {/* ✅ عرض "اليوم" فقط للمشاريع اليومية، واسم الشهر التقويمي للمشاريع الشهرية (من تاريخ البداية) */}
                                    {project.is_monthly_phase ? (
                                      <span className="text-xs font-semibold text-purple-600">
                                        {isOrphanSponsorCoordinator
                                          ? (project.month_number ? getDisplayMonthNameForProject(project) || `الشهر ${project.month_number}` : '---')
                                          : `الشهر ${project.month_number || '---'}`
                                        }
                                      </span>
                                    ) : (
                                      <span className="text-xs font-semibold text-purple-600">
                                        اليوم {project.phase_day || project.phaseDay || '---'}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  projectCode
                                )}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-800">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={getDivisionTextColor(project)}>{projectName}</span>
                                    {(project.is_urgent === true || project.is_urgent === 1 || project.is_urgent === '1' || project.is_urgent === 'true' || Boolean(project.is_urgent)) && project.status !== 'منتهي' && (
                                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white border-2 border-red-700 shadow-lg animate-pulse ring-2 ring-red-400" title="مشروع عاجل">
                                        <AlertCircle className="w-4 h-4" />
                                        عاجل
                                      </span>
                                    )}
                                  </div>
                                  {renderProjectBadges(project)}
                                  {(project.is_daily_phase || project.is_monthly_phase) && getSubProjectParentName(project) && (
                                    <span className="text-xs text-gray-500">
                                      من: {getSubProjectParentName(project)}
                                    </span>
                                  )}
                                  {project.__isFromWindow && project.__parentProject && (
                                    <span className="text-xs text-purple-600 font-semibold mt-1">
                                      نافذة: اليوم الحالي + 3 أيام قادمة
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6 text-sm font-medium text-gray-800">
                                {project.is_daily_phase || project.__isFromWindow ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                                      اليوم {project.phase_day || project.phaseDay || '---'}
                                    </span>
                                    {project.__isFromWindow && project.__parentProject && (
                                      <span className="text-xs text-purple-600">
                                        من {project.__parentProject.phase_duration_days || '---'} يوم
                                      </span>
                                    )}
                                  </div>
                                ) : project.is_monthly_phase ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                                      {isOrphanSponsorCoordinator
                                        ? (project.month_number ? getDisplayMonthNameForProject(project) || `الشهر ${project.month_number}` : '---')
                                        : `الشهر ${project.month_number || '---'}`
                                      }
                                    </span>
                                    {project.parent_project?.total_months && (
                                      <span className="text-xs text-purple-600">
                                        من {project.parent_project.total_months} شهر
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">---</span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-700">
                                {project.__isFromWindow && project.__parentProject
                                  ? (project.__parentProject.donor_name || project.__parentProject.donor?.name || '---')
                                  : (project.donor_name || project.donor?.name || '---')}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-700 max-w-xs">
                                <div className="line-clamp-2" title={getProjectDescription(project)}>
                                  {getProjectDescription(project)}
                                </div>
                                {renderProjectBadges(project)}
                                {(project.is_daily_phase || project.is_monthly_phase) && getSubProjectParentName(project) && (
                                  <span className="text-xs text-gray-500 mt-1 block">
                                    من: {getSubProjectParentName(project)}
                                    {(project.is_monthly_phase || project.isMonthlyPhase) && (project.month_number != null || project.monthNumber != null) && (
                                      <span className="text-purple-600 font-semibold">
                                        {isOrphanSponsorCoordinator
                                          ? ` - ${getDisplayMonthNameForProject(project) || `الشهر ${project.month_number ?? project.monthNumber}`}`
                                          : ` - الشهر ${project.month_number ?? project.monthNumber}`
                                        }
                                      </span>
                                    )}
                                    {(project.is_daily_phase || project.isDailyPhase) && (project.phase_day != null || project.phaseDay != null) && (
                                      <span className="text-blue-600 font-semibold"> - اليوم {project.phase_day ?? project.phaseDay}</span>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-sm font-bold text-green-600">
                                {project.__isFromWindow && project.__parentProject
                                  ? formatCurrency(calculateDailyAmount(project.__parentProject) || netAmount || 0)
                                  : formatCurrency(netAmount || 0)}
                                {project.__isFromWindow && project.__parentProject && (
                                  <span className="block text-xs text-gray-500 font-normal mt-1">
                                    (المبلغ اليومي)
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                { /* ✅ عرض حالة قابلة للنقر حسب الدور */}
                                {(() => {
                                  const postExecutionStatuses = ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'وصل للمتبرع'];
                                  const canClickStatus = isMediaManager
                                    ? postExecutionStatuses.includes(project.status)
                                    : project.status === 'قيد التنفيذ';

                                  // ✅ لدور منسق الكفالات فقط: السماح بالنقر على "جاهز للتنفيذ" لنقل مباشر إلى "تم التنفيذ"
                                  const canClickReadyForExecution = isOrphanSponsorCoordinator && project.status === 'جاهز للتنفيذ';

                                  return canClickStatus ? (
                                    <span
                                      onClick={() => handleExecutionStatusClick(project)}
                                      className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(
                                        project.status
                                      )} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1`}
                                      title="انقر لتحديث الحالة"
                                    >
                                      {project.status}
                                      <span className="text-xs">▼</span>
                                    </span>
                                  ) : canClickReadyForExecution ? (
                                    <span
                                      onClick={() => handleStatusClick(project)}
                                      className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(
                                        project.status
                                      )} cursor-pointer hover:opacity-80 transition-opacity`}
                                      title="انقر لنقل المشروع إلى 'تم التنفيذ'"
                                    >
                                      {project.status}
                                    </span>
                                  ) : project.status === 'وصل للمتبرع' ? (
                                    <span
                                      onClick={() => handleStatusClick(project)}
                                      className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(
                                        project.status
                                      )} cursor-pointer hover:opacity-80 transition-opacity`}
                                      title="انقر للقبول/الرفض"
                                    >
                                      {project.status}
                                    </span>
                                  ) : (
                                    <span
                                      className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(
                                        project.status
                                      )}`}
                                    >
                                      {project.status}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="py-4 px-6 text-sm font-medium">
                                {remainingInfo.element}
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center justify-center gap-2">
                                  <Link
                                    to={`/project-management/projects/${project.id}`}
                                    className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors"
                                    title="عرض التفاصيل"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Link>
                                  <button
                                    onClick={() => handleDownloadProjectImage(project)}
                                    className={`p-2 rounded-lg transition-colors ${hasProjectImage(project)
                                      ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'
                                      }`}
                                    title={hasProjectImage(project) ? 'تنزيل صورة المشروع' : 'لا توجد صورة للمشروع'}
                                    disabled={!hasProjectImage(project)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedProject(project);
                                      setAssignModalOpen(true);
                                    }}
                                    disabled={!canEditAssignment(project)}
                                    className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={canEditAssignment(project) ? 'تعديل الفريق المكلف' : 'لا يمكن التعديل - المشروع منتهي'}
                                  >
                                    <Users className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleClearAssignedTeam(project)}
                                    disabled={
                                      clearingAssignmentId === project.id ||
                                      (!project.assigned_team && !project.assigned_photographer && !project.team_name) ||
                                      !canEditAssignment(project)
                                    }
                                    className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={
                                      canEditAssignment(project)
                                        ? 'حذف الفريق المكلف'
                                        : 'لا يمكن الحذف - المشروع منتهي'
                                    }
                                  >
                                    {clearingAssignmentId === project.id ? (
                                      <span className="inline-flex h-4 w-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin"></span>
                                    ) : (
                                      <X className="w-4 h-4" />
                                    )}
                                  </button>


                                  {/* زر تأجيل المشروع */}
                                  {canPostponeProject(project) && (
                                    <button
                                      onClick={() => {
                                        setPostponingProjectId(project.id);
                                        setShowPostponeModal(true);
                                      }}
                                      disabled={isPostponing}
                                      className="bg-amber-100 hover:bg-amber-200 text-amber-700 p-2 rounded-lg transition-colors disabled:opacity-50"
                                      title="تأجيل المشروع"
                                    >
                                      <Pause className="w-4 h-4" />
                                    </button>
                                  )}

                                  {/* ✅ زر التوريد - متاح في أي مرحلة */}
                                  {user?.role === 'project_manager' && (
                                    <Link
                                      to={`/project-management/projects/${project.id}/supply`}
                                      onClick={async (e) => {
                                        // ✅ إذا كان المشروع في حالة "جديد"، نحاول نقله للتوريد أولاً
                                        if (project.status === 'جديد') {
                                          e.preventDefault();
                                          await handleMoveToSupply(project.id);
                                        }
                                        // ✅ في الحالات الأخرى، نذهب مباشرة لصفحة التوريد
                                      }}
                                      className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
                                      title={project.status === 'جديد' ? 'نقل للتوريد' : 'تحديث التوريد'}
                                    >
                                      <ShoppingCart className="w-4 h-4" />
                                    </Link>
                                  )}

                                  {/* زر استئناف المشروع */}
                                  {project.status === 'مؤجل' && (
                                    <button
                                      onClick={() => handleResumeProject(project.id)}
                                      disabled={isResuming}
                                      className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors disabled:opacity-50"
                                      title="استئناف المشروع"
                                    >
                                      {isResuming ? (
                                        <span className="inline-flex h-4 w-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></span>
                                      ) : (
                                        <PlayCircle className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  {/* زر إضافة عدد المستفيدين - لرئيس قسم التنفيذ و Project Manager */}
                                  {(isExecutionHead || isProjectManager || normalizedRole.includes('رئيس') || String(user?.role || '').includes('رئيس') || String(user?.role_name || '').includes('رئيس')) && (
                                    <button
                                      onClick={() => handleOpenBeneficiariesModal(project)}
                                      className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors"
                                      title="إضافة/تحديث عدد المستفيدين"
                                    >
                                      <Users className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </>
                          ) : isExecutedCoordinator ? (
                            <>
                              <td className="py-4 px-6 text-sm font-medium text-gray-800">
                                {(project?.donor_code || project?.internal_code) ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
                                    {getProjectCode(project, '---')}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">---</span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-700 max-w-xs">
                                <div className="flex flex-col gap-2">
                                  <div className="line-clamp-2" title={getProjectDescription(project)}>
                                    {getProjectDescription(project)}
                                  </div>
                                  {/* ✅ عرض عدد الأيتام المكفولين لمشاريع الكفالة */}
                                  {isOrphanSponsorshipProject(project) && (project.sponsored_orphans_count > 0 || project.has_sponsored_orphans) && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-300 w-fit">
                                      <Users className="w-3 h-3" />
                                      {project.sponsored_orphans_count || 0} يتيم مكفول
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-700">
                                {getAssignedTeamName(project)}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-700">
                                {project.assigned_photographer?.name ||
                                  project.photographer_name ||
                                  project.photographer?.name ||
                                  '-'}
                              </td>
                              <td className="py-4 px-6">
                                {(() => {
                                  // ✅ لدور منسق الكفالات فقط: السماح بالنقر على "جاهز للتنفيذ" لنقل مباشر إلى "تم التنفيذ"
                                  const canClickReadyForExecution = isOrphanSponsorCoordinator && project.status === 'جاهز للتنفيذ';
                                  const canClickDonorReceived = project.status === 'وصل للمتبرع';

                                  return canClickReadyForExecution ? (
                                    <span
                                      onClick={() => handleStatusClick(project)}
                                      className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(
                                        project.status
                                      )} cursor-pointer hover:opacity-80 transition-opacity`}
                                      title="انقر لنقل المشروع إلى 'تم التنفيذ'"
                                    >
                                      {project.status}
                                    </span>
                                  ) : canClickDonorReceived ? (
                                    <span
                                      onClick={() => handleStatusClick(project)}
                                      className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(
                                        project.status
                                      )} cursor-pointer hover:opacity-80 transition-opacity`}
                                      title="انقر للموافقة/الرفض"
                                    >
                                      {project.status}
                                    </span>
                                  ) : (
                                    <span
                                      className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(
                                        project.status
                                      )}`}
                                    >
                                      {project.status}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center justify-center gap-2">
                                  <Link
                                    to={`/project-management/projects/${project.id}`}
                                    className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors"
                                    title="عرض التفاصيل"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Link>
                                  <button
                                    onClick={() => handleDownloadProjectImage(project)}
                                    className={`p-2 rounded-lg transition-colors ${hasProjectImage(project)
                                      ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'
                                      }`}
                                    title={hasProjectImage(project) ? 'تنزيل صورة المشروع' : 'لا توجد صورة للمشروع'}
                                    disabled={!hasProjectImage(project)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenShelterModal(project)}
                                    disabled={project.status !== 'جاهز للتنفيذ' || !!(project.shelter_id || project.shelter?.id)}
                                    className="bg-orange-100 hover:bg-orange-200 text-orange-700 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={
                                      project.status === 'جاهز للتنفيذ' && !(project.shelter_id || project.shelter?.id)
                                        ? 'اختيار المخيم'
                                        : project.shelter_id || project.shelter?.id
                                          ? 'تم اختيار المخيم - يمكنك الضغط على "نقل للتنفيذ"'
                                          : 'لا يمكن اختيار المخيم بعد تغيير الحالة'
                                    }
                                  >
                                    <Home className="w-4 h-4" />
                                  </button>
                                  {/* زر إضافة عدد المستفيدين - لرئيس قسم التنفيذ و Project Manager */}
                                  {(isExecutionHead || isProjectManager || normalizedRole.includes('رئيس') || String(user?.role || '').includes('رئيس') || String(user?.role_name || '').includes('رئيس')) && (
                                    <button
                                      onClick={() => handleOpenBeneficiariesModal(project)}
                                      className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors"
                                      title="إضافة/تحديث عدد المستفيدين"
                                    >
                                      <Users className="w-4 h-4" />
                                    </button>
                                  )}
                                  {/* ✅ زر نقل للتوريد - لمشاريع الكفالة (منسق الأيتام) */}
                                  {isSponsorshipProject(project) &&
                                    isOrphanSponsorCoordinator && (
                                      <button
                                        onClick={() => handleTransferToSupply(project)}
                                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
                                        title={project.status === 'جديد' ? 'نقل للتوريد' : 'تحديث التوريد'}
                                      >
                                        <Package className="w-4 h-4" />
                                      </button>
                                    )}
                                  {/* ✅ زر إسناد باحث - لمشاريع الكفالة (منسق الأيتام) - متاح في كل المراحل */}
                                  {isSponsorshipProject(project) &&
                                    isOrphanSponsorCoordinator && (
                                      <button
                                        onClick={() => {
                                          setSelectedProject(project);
                                          setAssignModalOpen(true);
                                        }}
                                        className="bg-amber-100 hover:bg-amber-200 text-amber-700 p-2 rounded-lg transition-colors"
                                        title="إسناد/تعديل باحث"
                                      >
                                        <UserCheck className="w-4 h-4" />
                                      </button>
                                    )}
                                  {/* ✅ زر إدارة الأيتام - لمشاريع الكفالة (متاح في كل المراحل) */}
                                  {isSponsorshipProject(project) &&
                                    (isOrphanSponsorCoordinator || isAdmin) && (
                                      <button
                                        onClick={() => handleOpenOrphansModal(project)}
                                        className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors"
                                        title="إضافة/إدارة الأيتام المكفولين"
                                      >
                                        <Users className="w-4 h-4" />
                                      </button>
                                    )}
                                  {/* ✅ زر نقل للتنفيذ بدون مخيم - لمشاريع الكفالة */}
                                  {isSponsorshipProject(project) &&
                                    project.status === 'جاهز للتنفيذ' &&
                                    (isOrphanSponsorCoordinator || isExecutedCoordinator || isAdmin) && (
                                      <button
                                        onClick={() => handleTransferToExecution(project.id)}
                                        disabled={transferringToExecution === project.id}
                                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-lg transition-colors disabled:opacity-50"
                                        title="نقل للتنفيذ (مشاريع الكفالة لا تحتاج مخيم)"
                                      >
                                        {transferringToExecution === project.id ? (
                                          <span className="inline-flex h-4 w-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></span>
                                        ) : (
                                          <PlayCircle className="w-4 h-4" />
                                        )}
                                      </button>
                                    )}
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-4 px-6 text-sm font-medium text-gray-800">{project.donor_code}</td>
                              <td className="py-4 px-6 text-sm text-gray-800 font-medium">
                                <div className="flex flex-col gap-1">
                                  <span className="font-semibold">{projectName}</span>
                                  {(project.is_daily_phase || project.is_monthly_phase) && getSubProjectParentName(project) && (
                                    <span className="text-xs text-gray-500">
                                      من: {getSubProjectParentName(project)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-700 max-w-xs">
                                <div className="flex flex-col gap-2">
                                  <div className="line-clamp-2" title={getProjectDescription(project)}>
                                    {getProjectDescription(project)}
                                  </div>
                                  {/* ✅ عرض عدد الأيتام المكفولين لمشاريع الكفالة */}
                                  {isOrphanSponsorshipProject(project) && (project.sponsored_orphans_count > 0 || project.has_sponsored_orphans) && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-300 w-fit">
                                      <Users className="w-3 h-3" />
                                      {project.sponsored_orphans_count || 0} يتيم مكفول
                                    </span>
                                  )}
                                  {isPostponed && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-orange-400 to-amber-500 text-white border-2 border-orange-600 shadow-lg animate-pulse w-fit">
                                      <Clock className="w-3 h-3" />
                                      مؤجل
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-800">{project.donor_name}</td>
                              <td className="py-4 px-6 text-sm text-gray-800">
                                {(() => {
                                  // ✅ استخدام الدالة المساعدة لاستخراج رقم الشهر واسم الشهر (من تاريخ البداية: الشهر 2 = مارس إذا البداية فبراير)
                                  const monthNum = getMonthNumber(project);

                                  if (monthNum !== null && monthNum >= 1) {
                                    const monthName = getDisplayMonthNameForProject(project);

                                    // ✅ لمنسق الكفالة: عرض اسم الشهر التقويمي فقط (مارس للشهر 2 إذا البداية فبراير)
                                    if (isOrphanSponsorCoordinator) {
                                      return (
                                        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                          {monthName || `الشهر ${monthNum}`}
                                        </span>
                                      );
                                    }

                                    // ✅ للأدوار الأخرى: عرض الرقم مع اسم الشهر
                                    return (
                                      <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                        {monthNum}{monthName ? ` (${monthName})` : ''}
                                      </span>
                                    );
                                  }

                                  return <span className="text-gray-400">---</span>;
                                })()}
                              </td>
                              <td className="py-4 px-6">
                                {(() => {
                                  // ✅ لدور منسق الكفالات فقط: السماح بالنقر على "جاهز للتنفيذ" لنقل مباشر إلى "تم التنفيذ"
                                  const canClickReadyForExecution = isOrphanSponsorCoordinator && project.status === 'جاهز للتنفيذ';
                                  const canClickDonorReceived = project.status === 'وصل للمتبرع';

                                  return canClickReadyForExecution || canClickDonorReceived ? (
                                    <span
                                      onClick={() => handleStatusClick(project)}
                                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${isPostponed ? 'bg-gradient-to-r from-orange-100 to-amber-200 text-orange-800 border-2 border-orange-400 font-bold shadow-md' : `${getStatusColor(project.status)} text-white`} cursor-pointer hover:opacity-80 transition-opacity`}
                                      title={canClickReadyForExecution ? 'انقر لنقل المشروع إلى \'تم التنفيذ\'' : 'انقر للموافقة/الرفض'}
                                    >
                                      {isPostponed && (
                                        <Clock className="w-3.5 h-3.5" />
                                      )}
                                      {project.status}
                                    </span>
                                  ) : (
                                    <span
                                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${isPostponed ? 'bg-gradient-to-r from-orange-100 to-amber-200 text-orange-800 border-2 border-orange-400 font-bold shadow-md' : `${getStatusColor(project.status)} text-white`}`}
                                    >
                                      {isPostponed && (
                                        <Clock className="w-3.5 h-3.5" />
                                      )}
                                      {project.status}
                                    </span>
                                  );
                                })()}
                              </td>
                              {!isOrphanSponsorCoordinator && (
                                <td className="py-4 px-6 text-sm text-gray-700">
                                  {getAssignedTeamName(project)}
                                </td>
                              )}
                              <td className="py-4 px-6 text-sm text-gray-700">
                                {project.assigned_photographer?.name ||
                                  project.photographer_name ||
                                  project.photographer?.name ||
                                  '-'}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-600">{formatDate(project.created_at)}</td>
                              {!isOrphanSponsorCoordinator && (
                                <td className="py-4 px-6 text-sm text-gray-600">{formatDate(project.updated_at)}</td>
                              )}
                              <td className="py-4 px-6">
                                <div className="flex items-center justify-center gap-2">
                                  <Link
                                    to={`/project-management/projects/${project.id}`}
                                    className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors"
                                    title="عرض التفاصيل"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Link>
                                  <button
                                    onClick={() => handleDownloadProjectImage(project)}
                                    className={`p-2 rounded-lg transition-colors ${hasProjectImage(project)
                                      ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'
                                      }`}
                                    title={hasProjectImage(project) ? 'تنزيل صورة المشروع' : 'لا توجد صورة للمشروع'}
                                    disabled={!hasProjectImage(project)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  {/* زر إضافة عدد المستفيدين - لرئيس قسم التنفيذ و Project Manager */}
                                  {(isExecutionHead || isProjectManager || normalizedRole.includes('رئيس') || String(user?.role || '').includes('رئيس') || String(user?.role_name || '').includes('رئيس')) && (
                                    <button
                                      onClick={() => handleOpenBeneficiariesModal(project)}
                                      className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors"
                                      title="إضافة/تحديث عدد المستفيدين"
                                    >
                                      <Users className="w-4 h-4" />
                                    </button>
                                  )}
                                  {/* ✅ زر نقل للتوريد - لمشاريع الكفالة (منسق الأيتام) */}
                                  {isSponsorshipProject(project) &&
                                    isOrphanSponsorCoordinator && (
                                      <button
                                        onClick={() => handleTransferToSupply(project)}
                                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
                                        title={project.status === 'جديد' ? 'إضافة كفالة' : 'تحديث الكفالة'}
                                      >
                                        <Package className="w-4 h-4" />
                                      </button>
                                    )}
                                  {/* ✅ زر إسناد باحث - لمشاريع الكفالة (منسق الأيتام) - متاح في كل المراحل */}
                                  {isSponsorshipProject(project) &&
                                    isOrphanSponsorCoordinator && (
                                      <button
                                        onClick={() => {
                                          setSelectedProject(project);
                                          setAssignModalOpen(true);
                                        }}
                                        className="bg-amber-100 hover:bg-amber-200 text-amber-700 p-2 rounded-lg transition-colors"
                                        title="إسناد/تعديل باحث"
                                      >
                                        <UserCheck className="w-4 h-4" />
                                      </button>
                                    )}
                                  {/* ✅ زر إدارة الأيتام - لمشاريع الكفالة (متاح في كل المراحل) */}
                                  {isSponsorshipProject(project) &&
                                    (isOrphanSponsorCoordinator || isAdmin) && (
                                      <button
                                        onClick={() => handleOpenOrphansModal(project)}
                                        className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors"
                                        title="إضافة/إدارة الأيتام المكفولين"
                                      >
                                        <Users className="w-4 h-4" />
                                      </button>
                                    )}

                                  {/* زر تأجيل المشروع */}
                                  {user?.role === 'project_manager' && canPostponeProject(project) && (
                                    <button
                                      onClick={() => {
                                        setPostponingProjectId(project.id);
                                        setShowPostponeModal(true);
                                      }}
                                      disabled={isPostponing}
                                      className="bg-amber-100 hover:bg-amber-200 text-amber-700 p-2 rounded-lg transition-colors disabled:opacity-50"
                                      title="تأجيل المشروع"
                                    >
                                      <Pause className="w-4 h-4" />
                                    </button>
                                  )}

                                  {/* زر نقل للتوريد */}
                                  {user?.role === 'project_manager' && project.status === 'جديد' && (
                                    <Link
                                      to={`/project-management/projects/${project.id}/supply`}
                                      onClick={async (e) => {
                                        // إذا كان المشروع في حالة "جديد"، نحاول نقله للتوريد أولاً
                                        if (project.status === 'جديد') {
                                          e.preventDefault();
                                          await handleMoveToSupply(project.id);
                                        }
                                      }}
                                      className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
                                      title="نقل للتوريد"
                                    >
                                      <ShoppingCart className="w-4 h-4" />
                                    </Link>
                                  )}

                                  {/* زر عرض سلة التوريد (إذا كان المشروع في مرحلة التوريد) */}
                                  {user?.role === 'project_manager' && project.status === 'قيد التوريد' && (
                                    <Link
                                      to={`/project-management/projects/${project.id}/supply`}
                                      className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
                                      title="عرض سلة التوريد"
                                    >
                                      <ShoppingCart className="w-4 h-4" />
                                    </Link>
                                  )}

                                  {/* زر استئناف المشروع */}
                                  {user?.role === 'project_manager' && project.status === 'مؤجل' && (
                                    <button
                                      onClick={() => handleResumeProject(project.id)}
                                      disabled={isResuming}
                                      className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors disabled:opacity-50"
                                      title="استئناف المشروع"
                                    >
                                      {isResuming ? (
                                        <span className="inline-flex h-4 w-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></span>
                                      ) : (
                                        <PlayCircle className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}

                                  {user?.role === 'admin' && (
                                    <>
                                      <Link
                                        to={`/project-management/projects/${project.id}/edit`}
                                        className="bg-orange-100 hover:bg-orange-200 text-orange-700 p-2 rounded-lg transition-colors"
                                        title="تعديل"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Link>
                                      <button
                                        onClick={() => handleDeleteClick(project)}
                                        disabled={deletingProject === (project.id || project._id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        title="حذف المشروع"
                                      >
                                        {deletingProject === (project.id || project._id) ? (
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                        ) : (
                                          <Trash2 className="w-4 h-4" />
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {(() => {
                // حساب pagination info بناءً على ما إذا كان الترتيب حسب التاريخ أم لا
                const isDateSort = sortConfig?.key === 'created_at' || sortConfig?.key === 'updated_at';
                // ✅ استخدام pagination.total بدلاً من visibleProjects.length للمشاريع المجلوبة بنظام الصفحات من السيرفر
                const totalItems = isFinishedProjectsPage && pagination && pagination.total > 0 ? pagination.total : visibleProjects.length;
                // ✅ إذا كان perPage = 'all'، نعرض جميع المشاريع بدون pagination
                const isShowingAll = filters.perPage === 'all' || filters.perPage === 'الكل';
                // ✅ تحويل perPage إلى رقم للتأكد من أنه رقم صحيح
                const perPageNumber = typeof filters.perPage === 'number' ? filters.perPage : parseInt(filters.perPage) || 10;
                // ✅ استخدام perPageNumber دائماً عند حساب itemsPerPage
                const itemsPerPage = isShowingAll ? totalItems : perPageNumber;
                const currentPage = isShowingAll ? 1 : filters.page;
                // ✅ حساب lastPage بناءً على إجمالي العناصر الحقيقي من السيرفر
                const lastPage = isShowingAll ? 1 : (isFinishedProjectsPage && pagination && pagination.last_page ? pagination.last_page : Math.ceil(totalItems / itemsPerPage));
                const startIndex = isShowingAll ? 1 : ((currentPage - 1) * itemsPerPage + 1);
                const endIndex = isShowingAll ? totalItems : Math.min(currentPage * itemsPerPage, totalItems);

                return (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                    <div className="flex flex-wrap items-center gap-4">
                      <p className="text-sm font-semibold text-gray-700 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
                        عرض {startIndex} - {endIndex} من {totalItems} نتيجة
                      </p>
                      {/* خيار اختيار عدد المشاريع المعروضة */}
                      <div className="flex items-center gap-2">
                        <label htmlFor="perPageSelect" className="text-sm font-semibold text-gray-700 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
                          عدد العناصر:
                        </label>
                        <select
                          id="perPageSelect"
                          value={filters.perPage === 'all' ? 'all' : filters.perPage}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'all') {
                              handlePerPageChange('all');
                            } else {
                              handlePerPageChange(Number(value));
                            }
                          }}
                          className="px-4 py-2 text-sm border-2 border-gray-200 rounded-xl bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 cursor-pointer shadow-sm hover:shadow-md transition-all"
                          style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={250}>250</option>
                          {!isFinishedProjectsPage && <option value="all">الكل (500)</option>}
                        </select>
                      </div>
                    </div>
                    {lastPage > 1 && !isShowingAll && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="p-3 rounded-xl bg-white hover:bg-sky-50 border-2 border-gray-200 hover:border-sky-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                        >
                          <ChevronRight className="w-5 h-5 text-gray-700" />
                        </button>
                        <span className="text-sm font-bold text-gray-800 bg-white px-5 py-3 rounded-xl shadow-sm border-2 border-gray-200 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                          صفحة {currentPage} من {lastPage}
                        </span>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === lastPage}
                          className="p-3 rounded-xl bg-white hover:bg-sky-50 border-2 border-gray-200 hover:border-sky-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-700" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Modal عرض صور الملاحظات المتعددة من القائمة الرئيسية */}
      {noteImagesModalOpen && noteImagesModalProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3 px-4 pt-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                صور الملاحظات - {noteImagesModalProject.project_name || noteImagesModalProject.donor_name || `#${noteImagesModalProject.id}`}
              </h2>
              <button
                onClick={() => {
                  setNoteImagesModalOpen(false);
                  setNoteImagesModalProject(null);
                  setNoteImagesModalImages([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 pb-4">
              {noteImagesModalLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
              ) : noteImagesModalImages.length === 0 ? (
                <p className="text-center text-gray-500 py-8">لا توجد صور ملاحظات لهذا المشروع.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {noteImagesModalImages.map((img, index) => {
                    const path = img.image_url || img.image_path;
                    if (!path) return null;

                    let finalUrl = path;
                    const baseURL = getImageBaseUrl();
                    const API_BASE = baseURL.replace(/\/api\/?$/, '');

                    if (!path.startsWith('http://') && !path.startsWith('https://')) {
                      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
                      if (normalizedPath.includes('/project_notes_images')) {
                        finalUrl = `${baseURL.replace(/\/$/, '')}${normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath}`;
                      } else {
                        finalUrl = `${API_BASE}${normalizedPath}`;
                      }
                    }

                    return (
                      <div
                        key={img.id || `${noteImagesModalProject.id}-${index}`}
                        className="relative rounded-2xl border border-gray-200 overflow-hidden bg-gray-50"
                      >
                        <img
                          src={finalUrl}
                          alt={`صورة ملاحظة #${index + 1}`}
                          className="w-full h-40 object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2 py-1 bg-black/40 text-white text-xs">
                          <span className="px-2 py-0.5 bg-black/40 rounded-full">
                            صورة ملاحظة #{index + 1}
                          </span>
                          <a
                            href={finalUrl}
                            download
                            className="px-2 py-0.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium"
                            title="تنزيل الصورة"
                          >
                            تنزيل
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Project Modal */}
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

      {/* Select Shelter Modal for Executed Coordinators */}
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

      {/* Add Orphans Modal for Orphan Sponsorship Projects */}
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
            // ✅ إبطال الكاش
            window.dispatchEvent(new CustomEvent('cache-invalidated', { detail: { cacheKey: 'project-proposals' } }));
          }}
        />
      )}

      {/* ✅ Modal تحديث حالة التنفيذ (تم التنفيذ / تأجيل) */}
      {showExecutionStatusModal && selectedProjectForStatusUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <CheckCircle className="w-5 h-5 ml-2 text-purple-500" />
                تحديث حالة المشروع
              </h2>
              <button
                onClick={() => {
                  setShowExecutionStatusModal(false);
                  setSelectedProjectForStatusUpdate(null);
                  setExecutionStatusAction(null);
                  setPostponementReason('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                المشروع: <span className="font-semibold text-gray-800">{selectedProjectForStatusUpdate.project_name || selectedProjectForStatusUpdate.donor_name || 'غير محدد'}</span>
              </p>
              <p className="text-sm text-gray-600">
                الحالة الحالية: <span className="font-semibold text-purple-600">{selectedProjectForStatusUpdate.status}</span>
              </p>
            </div>

            {!executionStatusAction ? (
              <div className="space-y-3 mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">اختر الإجراء المطلوب:</p>
                <button
                  onClick={() => setExecutionStatusAction('completed')}
                  className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  تم التنفيذ
                </button>
                <button
                  onClick={() => setExecutionStatusAction('postpone')}
                  className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Pause className="w-5 h-5" />
                  تأجيل المشروع
                </button>
              </div>
            ) : executionStatusAction === 'completed' ? (
              <div className="mb-6">
                <p className="text-sm text-gray-700 mb-4">
                  هل أنت متأكد من تحديث حالة المشروع إلى <span className="font-semibold text-green-600">"تم التنفيذ"</span>؟
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExecutionStatusAction(null)}
                    disabled={updatingStatus}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    رجوع
                  </button>
                  <button
                    onClick={handleCompleteExecution}
                    disabled={updatingStatus}
                    className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingStatus ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                        جاري التحديث...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 ml-2" />
                        تأكيد
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    سبب التأجيل <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={postponementReason}
                    onChange={(e) => setPostponementReason(e.target.value)}
                    placeholder="أدخل سبب تأجيل المشروع..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    يرجى إدخال سبب واضح لتأجيل المشروع
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setExecutionStatusAction(null);
                      setPostponementReason('');
                    }}
                    disabled={isPostponing}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    رجوع
                  </button>
                  <button
                    onClick={handlePostponeFromStatusModal}
                    disabled={isPostponing || !postponementReason.trim()}
                    className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPostponing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                        جاري التأجيل...
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4 ml-2" />
                        تأجيل المشروع
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* thsi is the the last section section 7  */}
      {/* Modal تأجيل المشروع (القديم - للاستخدام من أماكن أخرى) */}
      {showPostponeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <Pause className="w-5 h-5 ml-2 text-amber-500" />
                تأجيل المشروع
              </h2>
              <button
                onClick={() => {
                  setShowPostponeModal(false);
                  setPostponementReason('');
                  setPostponingProjectId(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سبب التأجيل <span className="text-red-500">*</span>
              </label>
              <textarea
                value={postponementReason}
                onChange={(e) => setPostponementReason(e.target.value)}
                placeholder="أدخل سبب تأجيل المشروع..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                يرجى إدخال سبب واضح لتأجيل المشروع
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowPostponeModal(false);
                  setPostponementReason('');
                  setPostponingProjectId(null);
                }}
                disabled={isPostponing}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handlePostponeProject}
                disabled={isPostponing || !postponementReason.trim()}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPostponing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                    جاري التأجيل...
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 ml-2" />
                    تأجيل المشروع
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Filter Modal */}
      {isExportFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isDownloading && setIsExportFilterModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Download className="w-6 h-6 text-green-600" />
                تصدير ملف Excel
              </h3>
              <button
                onClick={() => !isDownloading && setIsExportFilterModalOpen(false)}
                disabled={isDownloading}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* ✅ حالة المشروع - اختيار متعدد في Export */}
              <div className="relative" ref={exportStatusDropdownRef}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  حالة المشروع
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExportStatusDropdown(!showExportStatusDropdown)}
                    disabled={isDownloading}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50 flex items-center justify-between"
                  >
                    <span className="text-gray-700">
                      {Array.isArray(exportFilters.status) && exportFilters.status.length > 0
                        ? `${exportFilters.status.length} محدد`
                        : 'جميع الحالات'
                      }
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {showExportStatusDropdown && !isDownloading && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Array.isArray(exportFilters.status) && exportFilters.status.length === 0}
                            onChange={() => setExportFilters({ ...exportFilters, status: [] })}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700 font-medium">جميع الحالات</span>
                        </label>
                        {PROJECT_STATUSES.map((status) => (
                          <label key={status} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Array.isArray(exportFilters.status) && exportFilters.status.includes(status)}
                              onChange={(e) => {
                                const currentStatuses = Array.isArray(exportFilters.status) ? exportFilters.status : [];
                                const newStatuses = e.target.checked
                                  ? [...currentStatuses, status]
                                  : currentStatuses.filter(s => s !== status);
                                setExportFilters({ ...exportFilters, status: newStatuses });
                              }}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700">{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ نوع المشروع - اختيار متعدد في Export */}
              <div className="relative" ref={exportProjectTypeDropdownRef}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  نوع المشروع
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExportProjectTypeDropdown(!showExportProjectTypeDropdown)}
                    disabled={isDownloading}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50 flex items-center justify-between"
                  >
                    <span className="text-gray-700">
                      {Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0
                        ? `${exportFilters.project_type.length} محدد`
                        : 'جميع الأنواع'
                      }
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {showExportProjectTypeDropdown && !isDownloading && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Array.isArray(exportFilters.project_type) && exportFilters.project_type.length === 0}
                            onChange={() => setExportFilters({ ...exportFilters, project_type: [] })}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700 font-medium">جميع الأنواع</span>
                        </label>
                        {projectTypes.map((type) => (
                          <label key={type} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Array.isArray(exportFilters.project_type) && exportFilters.project_type.includes(type)}
                              onChange={(e) => {
                                const currentTypes = Array.isArray(exportFilters.project_type) ? exportFilters.project_type : [];
                                const newTypes = e.target.checked
                                  ? [...currentTypes, type]
                                  : currentTypes.filter(t => t !== type);
                                setExportFilters({ ...exportFilters, project_type: newTypes });
                              }}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  تاريخ التنفيذ
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">من تاريخ</label>
                    <input
                      type="date"
                      value={exportFilters.startDate}
                      onChange={(e) => setExportFilters({ ...exportFilters, startDate: e.target.value })}
                      disabled={isDownloading}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">إلى تاريخ</label>
                    <input
                      type="date"
                      value={exportFilters.endDate}
                      onChange={(e) => setExportFilters({ ...exportFilters, endDate: e.target.value })}
                      disabled={isDownloading}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* ✅ الفلاتر المتقدمة */}
              <div className="border-t-2 border-gray-200 pt-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-purple-600" />
                  فلترة متقدمة
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* الباحث */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      الباحث
                    </label>
                    <select
                      value={exportFilters.researcher_id}
                      onChange={(e) => setExportFilters({ ...exportFilters, researcher_id: e.target.value })}
                      disabled={isDownloading || loadingFilterData}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                    >
                      <option value="">جميع الباحثين</option>
                      {researchers.map(researcher => (
                        <option key={researcher.id || researcher._id} value={researcher.id || researcher._id}>
                          {researcher.name || researcher.full_name || '-'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* المصور */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      المصور
                    </label>
                    <select
                      value={exportFilters.photographer_id}
                      onChange={(e) => setExportFilters({ ...exportFilters, photographer_id: e.target.value })}
                      disabled={isDownloading || loadingFilterData}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                    >
                      <option value="">جميع المصورين</option>
                      {photographers.map(photographer => (
                        <option key={photographer.id || photographer._id} value={photographer.id || photographer._id}>
                          {photographer.name || photographer.full_name || '-'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* المخيم */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      المخيم
                    </label>
                    <select
                      value={exportFilters.shelter_id}
                      onChange={(e) => setExportFilters({ ...exportFilters, shelter_id: e.target.value })}
                      disabled={isDownloading || loadingFilterData}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                    >
                      <option value="">جميع المخيمات</option>
                      {shelters.map(shelter => (
                        <option key={shelter.id || shelter._id} value={shelter.id || shelter._id}>
                          {shelter.camp_name || shelter.name || shelter.manager_id_number || '-'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* المحافظة */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      المحافظة
                    </label>
                    <select
                      value={exportFilters.governorate}
                      onChange={(e) => setExportFilters({ ...exportFilters, governorate: e.target.value, district: '' })}
                      disabled={isDownloading || loadingFilterData}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                    >
                      <option value="">جميع المحافظات</option>
                      {governorates.map(gov => (
                        <option key={gov} value={gov}>{gov}</option>
                      ))}
                    </select>
                  </div>

                  {/* المنطقة */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      المنطقة
                    </label>
                    <select
                      value={exportFilters.district}
                      onChange={(e) => setExportFilters({ ...exportFilters, district: e.target.value })}
                      disabled={isDownloading || loadingFilterData || !exportFilters.governorate}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                    >
                      <option value="">جميع المناطق</option>
                      {districts.map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>

                  {/* اسم المتبرع */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      اسم المتبرع
                    </label>
                    <input
                      type="text"
                      value={exportFilters.donor_name}
                      onChange={(e) => setExportFilters({ ...exportFilters, donor_name: e.target.value })}
                      disabled={isDownloading}
                      placeholder="ابحث عن اسم المتبرع..."
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                    />
                  </div>

                  {/* كود المتبرع */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      كود المتبرع
                    </label>
                    <input
                      type="text"
                      value={exportFilters.donor_code}
                      onChange={(e) => setExportFilters({ ...exportFilters, donor_code: e.target.value })}
                      disabled={isDownloading}
                      placeholder="ابحث عن كود المتبرع..."
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                    />
                  </div>

                  {/* نطاق الكمية */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      نطاق الكمية
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        value={exportFilters.quantity_min}
                        onChange={(e) => setExportFilters({ ...exportFilters, quantity_min: e.target.value })}
                        disabled={isDownloading}
                        placeholder="الحد الأدنى"
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                      />
                      <input
                        type="number"
                        min="0"
                        value={exportFilters.quantity_max}
                        onChange={(e) => setExportFilters({ ...exportFilters, quantity_max: e.target.value })}
                        disabled={isDownloading}
                        placeholder="الحد الأقصى"
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* نطاق التكلفة */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      نطاق التكلفة
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={exportFilters.cost_min}
                        onChange={(e) => setExportFilters({ ...exportFilters, cost_min: e.target.value })}
                        disabled={isDownloading}
                        placeholder="الحد الأدنى"
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={exportFilters.cost_max}
                        onChange={(e) => setExportFilters({ ...exportFilters, cost_max: e.target.value })}
                        disabled={isDownloading}
                        placeholder="الحد الأقصى"
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* تاريخ الإنشاء */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      تاريخ الإنشاء
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={exportFilters.created_at_start}
                        onChange={(e) => setExportFilters({ ...exportFilters, created_at_start: e.target.value })}
                        disabled={isDownloading}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                      />
                      <input
                        type="date"
                        value={exportFilters.created_at_end}
                        onChange={(e) => setExportFilters({ ...exportFilters, created_at_end: e.target.value })}
                        disabled={isDownloading}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* تاريخ التحديث */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      تاريخ التحديث
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={exportFilters.updated_at_start}
                        onChange={(e) => setExportFilters({ ...exportFilters, updated_at_start: e.target.value })}
                        disabled={isDownloading}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                      />
                      <input
                        type="date"
                        value={exportFilters.updated_at_end}
                        onChange={(e) => setExportFilters({ ...exportFilters, updated_at_end: e.target.value })}
                        disabled={isDownloading}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ✅ اختيار الأعمدة */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-blue-800">
                    اختيار الأعمدة للتصدير:
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAllColumns(true)}
                      disabled={isDownloading}
                      className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAllColumns(false)}
                      disabled={isDownloading}
                      className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {availableColumns.map(column => (
                    <label
                      key={column.key}
                      className="flex items-center gap-2 p-2 bg-white rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={(e) => {
                        // ✅ منع propagation إذا تم النقر على الـ checkbox مباشرة
                        if (e.target.type === 'checkbox') {
                          e.stopPropagation();
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(column.key)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleColumn(column.key);
                        }}
                        disabled={isDownloading}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs text-gray-700">{column.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  تم اختيار {selectedColumns.length} من {availableColumns.length} عمود
                </p>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-green-800 mb-2">
                  الفلاتر المحددة:
                </p>
                <div className="flex flex-wrap gap-2">
                  {exportFilters.status && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      الحالة: {exportFilters.status}
                    </span>
                  )}
                  {Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0 && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      الأنواع: {exportFilters.project_type.join(', ')}
                    </span>
                  )}
                  {exportFilters.startDate && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      تنفيذ من: {exportFilters.startDate}
                    </span>
                  )}
                  {exportFilters.endDate && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      تنفيذ إلى: {exportFilters.endDate}
                    </span>
                  )}
                  {exportFilters.researcher_id && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      الباحث: {researchers.find(r => (r.id || r._id) == exportFilters.researcher_id)?.name || researchers.find(r => (r.id || r._id) == exportFilters.researcher_id)?.full_name || exportFilters.researcher_id}
                    </span>
                  )}
                  {exportFilters.photographer_id && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      المصور: {photographers.find(p => (p.id || p._id) == exportFilters.photographer_id)?.name || exportFilters.photographer_id}
                    </span>
                  )}
                  {exportFilters.shelter_id && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      المخيم: {shelters.find(s => (s.id || s._id) == exportFilters.shelter_id)?.camp_name || exportFilters.shelter_id}
                    </span>
                  )}
                  {exportFilters.governorate && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      المحافظة: {exportFilters.governorate}
                    </span>
                  )}
                  {exportFilters.district && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      المنطقة: {exportFilters.district}
                    </span>
                  )}
                  {exportFilters.donor_name && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      المتبرع: {exportFilters.donor_name}
                    </span>
                  )}
                  {exportFilters.donor_code && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      كود المتبرع: {exportFilters.donor_code}
                    </span>
                  )}
                  {(exportFilters.quantity_min || exportFilters.quantity_max) && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      الكمية: {exportFilters.quantity_min || '0'} - {exportFilters.quantity_max || '∞'}
                    </span>
                  )}
                  {(exportFilters.cost_min || exportFilters.cost_max) && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      التكلفة: {exportFilters.cost_min || '0'} - {exportFilters.cost_max || '∞'}
                    </span>
                  )}
                  {exportFilters.created_at_start && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      إنشاء من: {exportFilters.created_at_start}
                    </span>
                  )}
                  {exportFilters.created_at_end && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      إنشاء إلى: {exportFilters.created_at_end}
                    </span>
                  )}
                  {exportFilters.updated_at_start && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      تحديث من: {exportFilters.updated_at_start}
                    </span>
                  )}
                  {exportFilters.updated_at_end && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      تحديث إلى: {exportFilters.updated_at_end}
                    </span>
                  )}
                  {!exportFilters.status && (!Array.isArray(exportFilters.project_type) || exportFilters.project_type.length === 0) && !exportFilters.startDate && !exportFilters.endDate &&
                    !exportFilters.researcher_id && !exportFilters.photographer_id && !exportFilters.shelter_id &&
                    !exportFilters.governorate && !exportFilters.district && !exportFilters.donor_name &&
                    !exportFilters.donor_code && !exportFilters.quantity_min && !exportFilters.quantity_max &&
                    !exportFilters.cost_min && !exportFilters.cost_max && !exportFilters.created_at_start &&
                    !exportFilters.created_at_end && !exportFilters.updated_at_start && !exportFilters.updated_at_end && (
                      <span className="text-xs text-gray-500">لا توجد فلاتر محددة - سيتم تصدير جميع المشاريع</span>
                    )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={resetExportFilters}
                  disabled={isDownloading}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  مسح الفلاتر
                </button>
                <button
                  onClick={() => setIsExportFilterModalOpen(false)}
                  disabled={isDownloading}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmExport}
                  disabled={isDownloading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      جاري التصدير...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      تصدير
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛒 Supply Modal - نافذة التسوق من المخزن */}
      {supplyModalOpen && supplyProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <ShoppingCart className="w-6 h-6" />
                    {isOrphanSponsorCoordinator ? 'قيمة الكفالة' : 'التسوق من المخزن'}
                  </h3>
                  <p className="text-indigo-100 text-sm mt-1">
                    المشروع: {getProjectCode(supplyProject, supplyProject.id?.toString() || '---')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSupplyModalOpen(false);
                    setSupplyProject(null);
                    setCartItems([]);
                    setWarehouseSearchQuery('');
                    setSelectedSurplusCategoryId(''); // ✅ مسح الصندوق المحدد
                    setShowShekelModal(false);
                    setExchangeRate('');
                    setTransferDiscountPercentage(0);
                  }}
                  className="text-white hover:text-indigo-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* معلومات المشروع */}
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                {(() => {
                  const amountInfo = getAvailableAmountInfo(supplyProject);
                  const needsConversion = !supplyProject?.shekel_exchange_rate;

                  return (
                    <div className="bg-white/10 rounded-lg p-3">
                      <span className="text-indigo-200">المبلغ المتاح للتوريد {amountInfo.currency === 'ILS' ? '(شيكل)' : '(دولار)'}:</span>
                      {needsConversion ? (
                        <div className="mt-1">
                          <span className="block font-bold text-lg text-red-300">غير محول</span>
                          <button
                            onClick={() => {
                              setIsEditingShekel(false);
                              setExchangeRate('');
                              setTransferDiscountPercentage(0);
                              setShowShekelModal(true);
                            }}
                            className="mt-2 text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                          >
                            تحويل للشيكل
                          </button>
                        </div>
                      ) : (
                        <span className="block font-bold text-lg">
                          {amountInfo.symbol}{parseFloat(String(amountInfo.amount || 0)).toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })()}
                <div className="bg-white/10 rounded-lg p-3">
                  <span className="text-indigo-200">الحالة:</span>
                  <span className="block font-bold">{supplyProject.status}</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* أصناف المخزن */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    📦 {isOrphanSponsorCoordinator ? 'قيمة الكفالة' : 'أصناف المخزن المتوفرة'}
                  </h4>

                  {/* حقل البحث - مخفي لمنسق الكفالة */}
                  {!isOrphanSponsorCoordinator && (
                    <div className="mb-3">
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          value={warehouseSearchQuery}
                          onChange={(e) => setWarehouseSearchQuery(e.target.value)}
                          placeholder="ابحث عن صنف..."
                          className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  {loadingWarehouse ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                      <p className="text-gray-500 mt-2">جاري التحميل...</p>
                    </div>
                  ) : (() => {
                    // ✅ فلترة الأصناف حسب البحث (للمنسق الكفالة: إظهار جميع الأصناف لأنها مفلترة مسبقاً)
                    const filteredItems = isOrphanSponsorCoordinator
                      ? warehouseItems // ✅ لمنسق الكفالة: إظهار جميع الأصناف (شيكل فقط)
                      : warehouseItems.filter(item => {
                        if (!warehouseSearchQuery.trim()) return true;
                        const searchLower = warehouseSearchQuery.toLowerCase().trim();
                        const itemName = (item.item_name || '').toLowerCase();
                        return itemName.includes(searchLower);
                      });

                    if (filteredItems.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          {warehouseSearchQuery.trim()
                            ? `لا توجد أصناف تطابق "${warehouseSearchQuery}"`
                            : 'لا توجد أصناف في المخزن'
                          }
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredItems.map(item => (
                          <div key={item.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-800">{item.item_name}</p>
                              <p className="text-xs text-gray-500">
                                متوفر: {item.quantity_available} | السعر: {(() => {
                                  const amountInfo = getAvailableAmountInfo(supplyProject);
                                  return `${amountInfo.symbol}${parseFloat(item.unit_price || 0).toFixed(2)}`;
                                })()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="الكمية"
                                className="w-20 px-2 py-1 border rounded text-sm"
                                id={`qty-${item.id}`}
                              />
                              <button
                                onClick={() => {
                                  const qty = document.getElementById(`qty-${item.id}`).value;
                                  handleAddToCart(item, qty);
                                }}
                                disabled={addingItem}
                                className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* السلة */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    {isOrphanSponsorCoordinator ? 'قيمة الكفالة' : '  '}
                  </h4>
                  {cartItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      السلة فارغة
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {cartItems.map(item => (
                        <div key={item.id} className="bg-green-50 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-800">{item.warehouse_item?.item_name || item.item_name}</p>
                            <p className="text-xs text-gray-500">
                              الكمية: {item.quantity_per_unit} × {item.unit_price} = {(() => {
                                const amountInfo = getAvailableAmountInfo(supplyProject);
                                return `${amountInfo.symbol}${parseFloat(item.total_price_per_unit || 0).toFixed(2)}`;
                              })()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ملخص */}
                  {cartItems.length > 0 && (
                    <div className="mt-4 bg-indigo-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>تكلفة الطرد الواحد:</span>
                        <span className="font-bold">
                          {(() => {
                            const amountInfo = getAvailableAmountInfo(supplyProject);
                            const unitCost = parseFloat(cartItems.reduce((sum, item) => sum + parseFloat(item.total_price_per_unit || 0), 0));
                            return `${amountInfo.symbol}${unitCost.toFixed(2)}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span>التكلفة الإجمالية:</span>
                        <span className="font-bold text-indigo-600">
                          {(() => {
                            const amountInfo = getAvailableAmountInfo(supplyProject);
                            const unitCost = parseFloat(cartItems.reduce((sum, item) => sum + parseFloat(item.total_price_per_unit || 0), 0));
                            const totalCost = unitCost * projectQuantity;
                            return `${amountInfo.symbol}${totalCost.toFixed(2)}`;
                          })()}
                        </span>
                      </div>
                      {(() => {
                        const amountInfo = getAvailableAmountInfo(supplyProject);
                        const availableAmount = parseFloat(amountInfo.amount || 0); // ✅ تحويل صريح إلى رقم
                        return (
                          <div className="flex justify-between text-sm">
                            <span>المبلغ المتاح للتوريد {amountInfo.currency === 'ILS' ? '(شيكل)' : '(دولار)'}:</span>
                            <span className="font-bold text-green-600">
                              {amountInfo.symbol}{availableAmount.toFixed(2)}
                            </span>
                          </div>
                        );
                      })()}
                      {(() => {
                        const amountInfo = getAvailableAmountInfo(supplyProject);
                        const totalCost = cartItems.reduce((sum, item) => sum + parseFloat(item.total_price_per_unit || 0), 0);
                        const availableAmount = parseFloat(amountInfo.amount || 0); // ✅ تحويل صريح إلى رقم

                        // ✅ إذا كان المشروع محولاً للشيكل، تأكد من أن totalCost بالشيكل أيضاً
                        // ✅ (الأصناف يجب أن تكون بالشيكل إذا كان المشروع محولاً للشيكل)
                        const surplus = availableAmount - totalCost;
                        return (
                          <div className={`flex justify-between text-sm font-bold ${surplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <span>{surplus >= 0 ? 'الفائض:' : 'العجز:'}</span>
                            <span>{amountInfo.symbol}{Math.abs(surplus).toFixed(2)}</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* 📦 قسم الفائض - إجباري لتأكيد التوريد */}
                  {surplusCategories.length > 0 && (
                    <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        📦 قسم الفائض <span className="text-red-500">*</span>
                        {isOrphanSponsorCoordinator && selectedSurplusCategoryId && (
                          <span className="text-green-600 text-xs mr-2">(تلقائي: كفالة الأيتام)</span>
                        )}
                      </label>
                      <select
                        value={selectedSurplusCategoryId}
                        onChange={(e) => setSelectedSurplusCategoryId(e.target.value)}
                        disabled={isOrphanSponsorCoordinator && selectedSurplusCategoryId !== ''}
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${!selectedSurplusCategoryId || selectedSurplusCategoryId === ''
                          ? 'border-red-300 bg-red-50'
                          : isOrphanSponsorCoordinator && selectedSurplusCategoryId !== ''
                            ? 'bg-green-50 border-green-300 text-green-700 cursor-not-allowed'
                            : 'border-gray-300'
                          }`}
                        required
                      >
                        <option value="">-- اختر قسم الفائض (مطلوب) --</option>
                        {surplusCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      {(!selectedSurplusCategoryId || selectedSurplusCategoryId === '') && (
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ اختيار قسم الفائض إجباري لتأكيد التوريد
                        </p>
                      )}
                      {isOrphanSponsorCoordinator && selectedSurplusCategoryId && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ تم اختيار "كفالة الأيتام" تلقائياً
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t p-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex gap-3">
                <button
                  onClick={() => {
                    setSupplyModalOpen(false);
                    setSupplyProject(null);
                    setCartItems([]);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  إغلاق
                </button>
                {cartItems.length > 0 && (
                  <button
                    onClick={handleConfirmSupply}
                    disabled={confirmingSupply || !selectedSurplusCategoryId || selectedSurplusCategoryId === ''}
                    className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title={!selectedSurplusCategoryId || selectedSurplusCategoryId === '' ? 'يرجى اختيار قسم الفائض أولاً' : ''}
                  >
                    {confirmingSupply ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        جاري التأكيد...
                      </>
                    ) : (
                      'تأكيد التوريد'
                    )}
                  </button>
                )}
              </div>

              {/* ✅ زر إسناد باحث (مدير المشاريع فقط) بعد مرحلة "تم التوريد" */}
              {isProjectManager && supplyProject && canAssignResearcherAfterSupply(supplyProject) && (
                <button
                  onClick={() => {
                    setSupplyModalOpen(false);
                    setSelectedProject(supplyProject);
                    setAssignModalOpen(true);
                  }}
                  className="w-full md:w-auto px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md transition-colors"
                  title="إسناد/تعديل باحث بعد التوريد"
                >
                  <UserCheck className="w-4 h-4" />
                  إسناد باحث
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal إضافة/تحديث عدد المستفيدين */}
      {showBeneficiariesModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-6 h-6 text-green-600" />
                إضافة/تحديث عدد المستفيدين
              </h3>
              <button
                onClick={() => {
                  setShowBeneficiariesModal(false);
                  setBeneficiariesCount('');
                  setSelectedProject(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* معلومات المشروع */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-1">اسم المشروع</p>
                <p className="text-lg font-semibold text-gray-800">
                  {selectedProject.project_name || selectedProject.project_description || selectedProject.donor_name || '---'}
                </p>
                {getProjectCode(selectedProject, null) && (
                  <p className="text-xs text-gray-500 mt-1">
                    الكود: {getProjectCode(selectedProject)}
                  </p>
                )}
              </div>

              {/* العدد الحالي للمستفيدين */}
              {(selectedProject.beneficiaries_count || selectedProject.calculated_beneficiaries) && (
                <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                  <p className="text-sm text-blue-600 mb-1">العدد الحالي للمستفيدين</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {(selectedProject.beneficiaries_count || selectedProject.calculated_beneficiaries || 0).toLocaleString('en-US')}
                  </p>
                </div>
              )}

              {/* حقل إدخال العدد */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  عدد المستفيدين <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={beneficiariesCount}
                  onChange={(e) => setBeneficiariesCount(e.target.value)}
                  placeholder="أدخل عدد المستفيدين"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                />
                <p className="text-xs text-gray-500 mt-2">
                  أدخل العدد الإجمالي للمستفيدين من هذا المشروع
                </p>
              </div>

              {/* الأزرار */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-200">
                <button
                  onClick={() => {
                    setShowBeneficiariesModal(false);
                    setBeneficiariesCount('');
                    setSelectedProject(null);
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleUpdateBeneficiaries}
                  disabled={updatingBeneficiaries || !beneficiariesCount || parseInt(beneficiariesCount) < 0}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                >
                  {updatingBeneficiaries ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Users className="w-5 h-5" />
                      حفظ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!projectToDelete}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="تأكيد حذف المشروع"
        message={
          projectToDelete
            ? `هل أنت متأكد من حذف المشروع "${projectToDelete.project_name || projectToDelete.description || projectToDelete.donor_name || 'هذا المشروع'}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : ''
        }
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
        isLoading={!!deletingProject}
      />

      {/* ✅ Accept Modal (نفس وظيفة الإشعارات) */}
      {acceptModalOpen && notificationToAccept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>قبول المونتاج</h2>
                    <p className="text-sm text-gray-500 mt-1">تأكيد قبول المونتاج</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseAcceptModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={accepting}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="mb-6">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 mb-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">⚠️ ملاحظة مهمة:</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    عند قبول المونتاج، سيتم نقل المشروع إلى حالة <span className="font-bold text-green-700">"منتهي"</span> تلقائياً.
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed mt-2">
                    عند رفض المونتاج، سيتم إرجاع المشروع إلى الإعلام بحالة <span className="font-bold text-red-700">"يجب إعادة المونتاج"</span>.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-2">المشروع:</p>
                  <p className="font-semibold text-gray-800">
                    {notificationToAccept.metadata?.project_name || notificationToAccept.metadata?.projectName || 'مشروع بدون اسم'}
                  </p>
                  {getProjectCode(notificationToAccept.metadata, null) && (
                    <p className="text-sm text-gray-500 mt-1">
                      كود المشروع: {getProjectCode(notificationToAccept.metadata)}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseAcceptModal}
                  className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                  disabled={accepting}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNotification(notificationToAccept);
                    handleCloseAcceptModal();
                    handleOpenReplyModal(notificationToAccept);
                  }}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                  disabled={accepting}
                >
                  <MessageSquare className="w-4 h-4" />
                  رفض المونتاج
                </button>
                <button
                  onClick={handleAccept}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={accepting}
                >
                  {accepting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>جاري القبول...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>قبول المونتاج</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Reply Modal (نفس وظيفة الإشعارات) */}
      {replyModalOpen && selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>رد على إشعار المونتاج</h2>
                <button
                  onClick={handleCloseReplyModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">الإشعار:</p>
                <p className="font-semibold text-gray-800">{selectedNotification.title}</p>
                <p className="text-sm text-gray-600 mt-2">{selectedNotification.message}</p>
              </div>

              <form onSubmit={handleReplySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الرسالة <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={replyForm.message}
                    onChange={(e) => setReplyForm({ ...replyForm, message: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="أدخل الرسالة التي تريد إرسالها لقسم الإعلام..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    سبب الرفض <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={replyForm.rejection_reason}
                    onChange={(e) => setReplyForm({ ...replyForm, rejection_reason: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="أدخل سبب رفض المونتاج..."
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseReplyModal}
                    className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    disabled={replying}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={replying}
                  >
                    {replying ? 'جاري الإرسال...' : 'إرسال الرد'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 💱 Shekel Conversion Modal */}
      {showShekelModal && supplyProject && (
        <ShekelConversionModal
          isOpen={showShekelModal}
          onClose={() => {
            setShowShekelModal(false);
            setIsEditingShekel(false);
            setExchangeRate('');
            setTransferDiscountPercentage(0);
          }}
          project={supplyProject}
          exchangeRate={exchangeRate}
          setExchangeRate={setExchangeRate}
          transferDiscountPercentage={transferDiscountPercentage}
          setTransferDiscountPercentage={setTransferDiscountPercentage}
          onConvert={handleConvertToShekel}
          isConverting={convertingToShekel}
          formatCurrency={(amount) => parseFloat(amount || 0).toFixed(2)}
          isEditing={isEditingShekel}
        />
      )}
    </div>
  );
};

// 💱 Shekel Conversion Modal Component
const ShekelConversionModal = ({ isOpen, onClose, project, exchangeRate, setExchangeRate, transferDiscountPercentage, setTransferDiscountPercentage, onConvert, isConverting, formatCurrency, isEditing = false }) => {
  if (!isOpen) return null;

  const netAmount = project?.net_amount_usd || project?.net_amount || 0;
  const rate = parseFloat(exchangeRate) || 0;
  const transferDiscount = parseFloat(transferDiscountPercentage) || 0;

  // ✅ حساب المبلغ بعد تطبيق نسبة خصم النقل (هي نفسها نسبة الخصم للتحويل)
  const transferDiscountAmount = (netAmount * transferDiscount) / 100;
  const amountAfterTransferDiscount = netAmount - transferDiscountAmount;

  // ✅ حساب المبلغ بالشيكل بعد الخصم
  const convertedAmount = amountAfterTransferDiscount * rate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-amber-600" />
            {isEditing ? 'تعديل التحويل للشيكل' : 'تحويل المبلغ إلى شيكل'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Current Amount */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600 mb-1">المبلغ الحالي (دولار)</p>
            <p className="text-2xl font-bold text-gray-800">${formatCurrency(netAmount)}</p>
          </div>

          {/* Exchange Rate Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              سعر الصرف (1 دولار = ؟ شيكل) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="مثال: 3.65"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg"
            />
          </div>

          {/* Transfer Discount Percentage Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              نسبة خصم النقل (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              value={transferDiscountPercentage}
              onChange={(e) => setTransferDiscountPercentage(e.target.value)}
              placeholder="مثال: 5 (مطلوب)"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              نسبة خصم النقل مطلوبة ويجب أن تكون أكبر من صفر (مثال: 5%) - هذه النسبة تُخصم من المبلغ قبل التحويل للشيكل
            </p>
          </div>

          {/* Calculation Preview */}
          {rate > 0 && (
            <div className="space-y-3">
              {transferDiscount > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-blue-600">المبلغ الأصلي:</p>
                    <p className="text-lg font-bold text-blue-700">${formatCurrency(netAmount)}</p>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-blue-600">نسبة خصم النقل ({transferDiscount}%):</p>
                    <p className="text-lg font-bold text-red-600">-${formatCurrency(transferDiscountAmount)}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t-2 border-blue-300">
                    <p className="text-sm font-medium text-blue-700">المبلغ بعد الخصم:</p>
                    <p className="text-xl font-bold text-blue-800">${formatCurrency(amountAfterTransferDiscount)}</p>
                  </div>
                </div>
              )}

              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-600 mb-1">المبلغ بعد التحويل (شيكل)</p>
                <p className="text-2xl font-bold text-green-700">₪{formatCurrency(convertedAmount)}</p>
                <p className="text-xs text-green-600 mt-1">
                  {transferDiscount > 0 ? (
                    <>المبلغ بعد الخصم ({formatCurrency(amountAfterTransferDiscount)} دولار) × {rate} = {formatCurrency(convertedAmount)} شيكل</>
                  ) : (
                    <>سعر الصرف: 1 دولار = {rate} شيكل</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            <p className="font-medium mb-1">⚠️ تنبيه مهم:</p>
            <p>
              {isEditing
                ? 'سيتم تحديث سعر الصرف ونسبة الخصم، وسيتم إعادة حساب المبلغ بالشيكل بناءً على القيم الجديدة.'
                : 'بعد التحويل، سيتم حساب جميع تكاليف التوريد والفائض بالشيكل. هذه العملية لا يمكن التراجع عنها.'
              }
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={onConvert}
              disabled={isConverting || !rate || rate <= 0 || !transferDiscountPercentage || parseFloat(transferDiscountPercentage) <= 0}
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isConverting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  {isEditing ? 'جاري التحديث...' : 'جاري التحويل...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isEditing ? 'تأكيد التعديل' : 'تأكيد التحويل'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsList;