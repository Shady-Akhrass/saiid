import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../utils/axiosConfig';
import { getPhotographerName, getProjectCode } from '../../utils/helpers';
import { useCache } from '../../hooks/useCache';
import { useCacheInvalidation } from '../../hooks/useCacheInvalidation';
import { Search, Filter, Eye, ChevronLeft, ChevronRight, ChevronDown, X, Video, AlertCircle, UserPlus, ArrowRight, Download, CheckCircle, Pause } from 'lucide-react';
import { toast } from 'react-toastify';
import UpdateStatusModal from './components/UpdateStatusModal';
import BatchStatusUpdateForm from './components/BatchStatusUpdateForm';
import { useUpdateExecutionStatus } from '../../hooks/useUpdateExecutionStatus';
// ✅ remaining_days badge logic is implemented locally (same as PM list)

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj ?? {}, key);

const normalizeProjectRecord = (project = {}) => {
  const normalized = { ...project };
  normalized.is_daily_phase =
    project?.is_daily_phase ??
    project?.isDailyPhase ??
    project?.isDaily ??
    false;
  normalized.is_divided_into_phases =
    project?.is_divided_into_phases ??
    project?.isDividedIntoPhases ??
    false;
  normalized.phase_day = project?.phase_day ?? project?.phaseDay ?? null;
  normalized.parent_project_id =
    project?.parent_project_id ??
    project?.parentProjectId ??
    project?.parent_project?.id ??
    null;
  normalized.parent_project =
    project?.parent_project || project?.parentProject || null;
  normalized.__hasDailyPhaseFlag =
    hasOwn(project, 'is_daily_phase') ||
    hasOwn(project, 'isDailyPhase') ||
    hasOwn(project, 'isDaily');

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

const MediaProjectsList = () => {
  const { user } = useAuth();
  const { id: rawProducerId } = useParams(); // ✅ الحصول على id المنتج من الـ URL
  // ✅ harden: sometimes router provides "undefined"/"null" strings
  const producerId =
    rawProducerId && rawProducerId !== 'undefined' && rawProducerId !== 'null' && rawProducerId !== '' ? rawProducerId : null;
  const { getData, setCachedData, isCacheValid, initializeCache, clearCache } = useCache('media_projects', 60000); // ✅ تقليل مدة الـ cache إلى دقيقة واحدة لضمان ظهور البيانات الجديدة
  const { invalidateProjectsCache } = useCacheInvalidation();
  const abortControllerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [producerInfo, setProducerInfo] = useState(null); // ✅ معلومات المنتج إذا كان محدداً

  // ✅ تهيئة الـ cache عند التحميل
  useEffect(() => {
    initializeCache();
    // ✅ مسح الكاش القديم عند تحميل الصفحة لأول مرة
    clearCache();
  }, [initializeCache, clearCache]);

  // ✅ تحديث عنوان الصفحة (Tab Title) ديناميكياً
  useEffect(() => {
    if (producerId && producerInfo) {
      document.title = `مشاريع الممنتج: ${producerInfo.name || producerInfo.email || 'غير محدد'}`;
    } else {
      document.title = 'مشاريع قسم الإعلام';
    }
  }, [producerId, producerInfo]);

  // ✅ الاستماع إلى أحداث إبطال الكاش
  useEffect(() => {
    const handleCacheInvalidation = (event) => {
      const { cacheKey } = event.detail;

      if (cacheKey === 'all' || cacheKey === 'media_projects' || cacheKey === 'projects') {
        clearCache();
        setRefreshTrigger(prev => prev + 1);

        if (import.meta.env.DEV) {
          console.log('✅ Media projects cache invalidated, fetching fresh data');
        }
      }
    };

    window.addEventListener('cache-invalidated', handleCacheInvalidation);

    return () => {
      window.removeEventListener('cache-invalidated', handleCacheInvalidation);
    };
  }, [clearCache]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 200, // ✅ عرض 50 مشروع لكل صفحة لتحسين الأداء وتقسيم الصفحات
    total: 0,
  });

  // ✅ State منفصل للبحث (للمستخدم) - يتم تحديثه فوراً
  const [searchInput, setSearchInput] = useState('');

  // ✅ تحميل الإعدادات المحفوظة من localStorage
  const loadSavedFilters = () => {
    try {
      const saved = localStorage.getItem('media_filters');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          montage_status: parsed.montage_status || [],
          project_type: parsed.project_type || [],
          subcategory_id: parsed.subcategory_id || [],
          researcher_id: parsed.researcher_id || '',
          photographer_id: parsed.photographer_id || '',
          producer_id: parsed.producer_id || '', // ✅ فلتر الممنتج
          parent_project_id: parsed.parent_project_id || '',
          sort_by: parsed.sort_by || 'date',
          priority_only: parsed.priority_only || false,
          searchQuery: '',
          execution_date_from: '',
          execution_date_to: '',
          page: 1,
          perPage: 'all', // ✅ القيمة الافتراضية: عرض كل المشاريع
        };
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
    return {
      montage_status: [],
      project_type: [],
      subcategory_id: [],
      researcher_id: '',
      photographer_id: '',
      producer_id: '', // ✅ فلتر الممنتج
      parent_project_id: '',
      sort_by: 'date',
      priority_only: false,
      searchQuery: '',
      execution_date_from: '',
      execution_date_to: '',
      page: 1,
      perPage: 50, // ✅ عرض 50 مشروع لكل صفحة لتحسين الأداء
    };
  };

  const [filters, setFilters] = useState(loadSavedFilters());
  // ✅ الفلاتر المطبقة فعلياً (نبدأ بفلاتر فارغة لعرض جميع المشاريع)
  const [appliedFilters, setAppliedFilters] = useState({
    montage_status: [],
    project_type: [],
    subcategory_id: [],
    researcher_id: '',
    photographer_id: '',
    producer_id: '', // ✅ فلتر الممنتج
    sort_by: 'date',
    priority_only: false,
    searchQuery: '',
    execution_date_from: '',
    execution_date_to: '',
    page: 1,
    perPage: 50, // ✅ القيمة الافتراضية: عرض 50 مشروع لكل صفحة (تحسين الأداء)
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [producers, setProducers] = useState([]);
  const [selectedProducerId, setSelectedProducerId] = useState('');
  const [loadingProducers, setLoadingProducers] = useState(false);
  const [loadingAssign, setLoadingAssign] = useState(false); // ✅ حالة منفصلة لعملية الإسناد

  // ✅ State لـ Modal تحديث حالة التنفيذ (قيد التنفيذ -> تم التنفيذ / تأجيل)
  const [showExecutionStatusModal, setShowExecutionStatusModal] = useState(false);
  const [selectedProjectForStatusUpdate, setSelectedProjectForStatusUpdate] = useState(null);
  const [executionStatusAction, setExecutionStatusAction] = useState(null); // 'completed' أو 'postpone'
  const [postponementReason, setPostponementReason] = useState('');
  const [isPostponing, setIsPostponing] = useState(false);

  // ✅ State للتحديد الجماعي
  const [selectedProjects, setSelectedProjects] = useState(new Set());
  const [showBatchStatusModal, setShowBatchStatusModal] = useState(false);
  const [showBatchAssignModal, setShowBatchAssignModal] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  // ✅ Hook لتحديث حالة التنفيذ
  const { updateExecutionStatus, loading: updatingStatus } = useUpdateExecutionStatus();

  // ✅ State للقوائم المنسدلة
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProjectTypeDropdown, setShowProjectTypeDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);

  // ✅ Refs لإغلاق القوائم عند الضغط خارجها
  const statusDropdownRef = useRef(null);
  const projectTypeDropdownRef = useRef(null);
  const subcategoryDropdownRef = useRef(null);

  // ✅ State للقوائم المطلوبة للفلترة
  const [projectTypes, setProjectTypes] = useState(['إغاثي', 'تنموي', 'طبي', 'تعليمي']); // ✅ قائمة أنواع المشاريع من API
  const [projectTypesLoading, setProjectTypesLoading] = useState(false);
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);

  // ✅ جلب قائمة المشاريع الأصلية للفلترة
  useEffect(() => {
    const fetchParentProjects = async () => {
      if (!showFilters) return; // ✅ جلب البيانات فقط عند فتح الفلاتر

      setParentProjectsLoading(true);
      try {
        const response = await apiClient.get('/project-proposals', {
          params: {
            perPage: 100, // ✅ تقليل عدد المشاريع لتحسين الأداء
            is_divided_into_phases: true, // ✅ فقط المشاريع المقسمة
            _t: Date.now(),
          },
          headers: {
            'Cache-Control': 'no-cache',
          }
        });

        if (response.data.success) {
          const data = response.data.data || response.data.projects || [];
          // ✅ فلترة المشاريع الأصلية فقط (ليست مشاريع يومية)
          const parentProjectsList = data.filter(p => {
            const isDivided = p.is_divided_into_phases || p.isDividedIntoPhases || false;
            const isDailyPhase = p.is_daily_phase || p.isDailyPhase || false;
            return isDivided && !isDailyPhase;
          });
          setParentProjects(parentProjectsList);
          if (import.meta.env.DEV) {
            console.log('✅ Loaded parent projects for filtering:', parentProjectsList.length);
          }
        }
      } catch (error) {
        if (import.meta.env.DEV && !error.isConnectionError) {
          console.error('Error fetching parent projects:', error);
        }
      } finally {
        setParentProjectsLoading(false);
      }
    };

    fetchParentProjects();
  }, [showFilters]);
  const [researchers, setResearchers] = useState([]); // ✅ قائمة الباحثين
  const [photographers, setPhotographers] = useState([]); // ✅ قائمة المصورين
  const [parentProjects, setParentProjects] = useState([]); // ✅ قائمة المشاريع الأصلية
  const [parentProjectsLoading, setParentProjectsLoading] = useState(false); // ✅ حالة تحميل المشاريع الأصلية
  const [loadingFilterLists, setLoadingFilterLists] = useState(false); // ✅ حالة تحميل قوائم الفلترة

  // ✅ حالات المونتاج: من "جاهز للتنفيذ" حتى "وصل للمتبرع"
  const MONTAGE_STATUSES = ['جاهز للتنفيذ', 'تم اختيار المخيم', 'قيد التنفيذ', 'تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];
  const DEFAULT_PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];

  const renderProjectBadges = (project) => {
    if (project?.is_daily_phase) {
      return (
        <div className="flex flex-wrap gap-2 mt-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
            مشروع يومي
          </span>
          { project?.phase_day && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
              اليوم { project.phase_day }
            </span>
          ) }
        </div>
      );
    }
    return null;
  };

  // ✅ جلب معلومات المنتج إذا كان محدداً في الـ URL
  useEffect(() => {
    if (producerId) {
      const fetchProducerInfo = async () => {
        try {
          const response = await apiClient.get(`/montage-producers/${producerId}`);
          if (response.data.success) {
            const producer = response.data.producer || response.data.data || response.data;
            setProducerInfo(producer);
          }
        } catch (error) {
          console.error('Error fetching producer info:', error);
          // لا نعرض خطأ للمستخدم، فقط لا نعرض معلومات المنتج
        }
      };
      fetchProducerInfo();
    } else {
      setProducerInfo(null);
    }
  }, [producerId]);

  // ✅ حفظ الإعدادات في localStorage عند تطبيق الفلاتر
  useEffect(() => {
    try {
      const toSave = {
        montage_status: appliedFilters.montage_status,
        project_type: appliedFilters.project_type,
        subcategory_id: appliedFilters.subcategory_id,
        researcher_id: appliedFilters.researcher_id,
        photographer_id: appliedFilters.photographer_id,
        producer_id: appliedFilters.producer_id, // ✅ حفظ فلتر الممنتج
        parent_project_id: appliedFilters.parent_project_id,
        sort_by: appliedFilters.sort_by,
        priority_only: appliedFilters.priority_only,
      };
      localStorage.setItem('media_filters', JSON.stringify(toSave));
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  }, [appliedFilters.montage_status, appliedFilters.project_type, appliedFilters.subcategory_id, appliedFilters.researcher_id, appliedFilters.photographer_id, appliedFilters.producer_id, appliedFilters.parent_project_id, appliedFilters.sort_by, appliedFilters.priority_only]);

  // ✅ البحث يعمل فقط عند الضغط على Enter - لا يوجد تطبيق تلقائي

  // ✅ تحويل المصفوفات إلى strings للمقارنة الصحيحة
  const appliedStatusString = JSON.stringify(appliedFilters.montage_status || []);
  const appliedTypeString = JSON.stringify(appliedFilters.project_type || []);
  const appliedSubcategoryString = JSON.stringify(appliedFilters.subcategory_id || []);

  useEffect(() => {
    // ✅ تقليل الاعتماد على الـ cache - مسح الـ cache إذا كان قديماً
    const cachedData = getData();
    if (cachedData && cachedData.timestamp) {
      const cacheAge = Date.now() - cachedData.timestamp;
      if (cacheAge > 60000) { // ✅ إذا كان الـ cache أقدم من دقيقة واحدة، امسحه
        clearCache();
        if (import.meta.env.DEV) {
          console.log('🔄 Cache expired (older than 1 minute), fetching fresh data');
        }
      }
    }

    // ✅ جلب المشاريع عند تطبيق الفلاتر فقط
    if (import.meta.env.DEV) {
      console.log('🔍 Fetching projects with applied filters:', appliedFilters);
    }
    
    // ✅ إضافة timeout صغير لضمان تحديث state قبل الجلب
    const timeoutId = setTimeout(() => {
      fetchProjects();
    }, 50);

    // ✅ تنظيف: إلغاء الطلب عند unmount
    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [
    appliedStatusString,
    appliedTypeString,
    appliedSubcategoryString,
    appliedFilters.researcher_id,
    appliedFilters.photographer_id,
    appliedFilters.producer_id, // ✅ إضافة فلتر الممنتج إلى dependencies
    appliedFilters.parent_project_id,
    appliedFilters.sort_by,
    appliedFilters.priority_only,
    appliedFilters.execution_date_from,
    appliedFilters.execution_date_to,
    appliedFilters.perPage, // ✅ إضافة perPage إلى dependencies
    // ✅ إزالة searchQuery من dependencies - البحث يتم في Frontend فقط
    appliedFilters.page,
    producerId,
    refreshTrigger
  ]); // ✅ استخدام strings للمصفوفات لضمان اكتشاف التغييرات

  // ✅ جلب أنواع المشاريع من API
  useEffect(() => {
    const fetchProjectTypes = async () => {
      setProjectTypesLoading(true);
      try {
        const response = await apiClient.get('/project-types', {
          params: {
            _t: Date.now(),
          },
          timeout: 30000, // ✅ زيادة timeout إلى 30 ثانية
          headers: {
            'Cache-Control': 'no-cache',
          }
        });

        if (response.data.success) {
          const data = response.data.data || response.data.types || [];
          const types = data.map(type => {
            if (typeof type === 'string') return type;
            return type.name || type;
          });
          if (types.length > 0) {
            setProjectTypes(types);
            if (import.meta.env.DEV) {
              console.log('✅ Loaded project types from API:', types);
            }
          } else {
            setProjectTypes(DEFAULT_PROJECT_TYPES);
            if (import.meta.env.DEV) {
              console.warn('⚠️ No project types from API, using defaults');
            }
          }
        } else {
          setProjectTypes(DEFAULT_PROJECT_TYPES);
        }
      } catch (error) {
        // ✅ تجاهل timeout errors في production
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Timeout fetching project types, using defaults');
          }
        } else if (import.meta.env.DEV && !error.isConnectionError) {
          console.error('Error fetching project types:', error);
        }
        // ✅ استخدام القيم الافتراضية في حالة الخطأ
        setProjectTypes(DEFAULT_PROJECT_TYPES);
      } finally {
        setProjectTypesLoading(false);
      }
    };

    fetchProjectTypes();
  }, []);

  // ✅ جلب التفريعات من API (من جدول project_subcategories)
  // ✅ جلب جميع التفريعات عند التحميل الأولي
  useEffect(() => {
    const fetchSubcategories = async () => {
      setSubcategoriesLoading(true);
      try {
        const response = await apiClient.get('/project-subcategories', {
          params: {
            _t: Date.now(),
          },
          timeout: 30000, // ✅ زيادة timeout إلى 30 ثانية
          headers: {
            'Cache-Control': 'no-cache',
          }
        });

        if (response.data.success) {
          // ✅ معالجة البيانات من جدول project_subcategories
          let data = response.data.data || response.data.subcategories || [];

          // ✅ التأكد من أن البيانات هي array
          if (!Array.isArray(data)) {
            data = [];
          }

          // ✅ التأكد من أن كل عنصر له id و name
          const processedData = data.map(subcat => ({
            id: subcat.id || subcat.subcategory_id,
            name: subcat.name_ar || subcat.name || subcat.subcategory_name || `التفريعة ${subcat.id || ''}`,
            name_ar: subcat.name_ar || subcat.name || subcat.subcategory_name,
            project_type: subcat.project_type || subcat.type
          })).filter(subcat => subcat.id); // ✅ إزالة العناصر بدون id

          setSubcategories(processedData);

          if (import.meta.env.DEV) {
            console.log('✅ Loaded subcategories from API (project_subcategories table):', {
              total: processedData.length,
              sample: processedData.slice(0, 3),
              rawData: data.slice(0, 2)
            });
          }
        } else {
          if (import.meta.env.DEV) {
            console.warn('⚠️ API returned success: false for subcategories:', response.data);
          }
          setSubcategories([]);
        }
      } catch (error) {
        // ✅ تجاهل timeout errors في production
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Timeout fetching subcategories, using empty array');
          }
        } else if (import.meta.env.DEV && !error.isConnectionError) {
          console.error('Error fetching subcategories from project_subcategories table:', error);
          console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
          });
        }
        // ✅ استخدام array فارغ في حالة الخطأ
        setSubcategories([]);
      } finally {
        setSubcategoriesLoading(false);
      }
    };

    fetchSubcategories();
  }, []);

  // ✅ جلب التفريعات حسب نوع المشروع المختار (تحسين الفلترة)
  useEffect(() => {
    const fetchSubcategoriesByType = async () => {
      // ✅ إذا كان هناك نوع مشروع واحد فقط محدد، نستخدم endpoint محدد
      if (Array.isArray(appliedFilters.project_type) && appliedFilters.project_type.length === 1) {
        const selectedType = appliedFilters.project_type[0];

        if (!selectedType || selectedType === 'all') {
          return; // لا نحتاج لجلب التفريعات إذا لم يكن هناك نوع محدد
        }

        // ✅ Extract the actual value from selectedType (handle both object and string/number)
        let projectTypeValue = selectedType;
        if (typeof projectTypeValue === 'object' && projectTypeValue !== null) {
          // If it's an object, extract id or name
          projectTypeValue = projectTypeValue.id || projectTypeValue.name || projectTypeValue.name_ar || projectTypeValue.name_en;
        }

        // ✅ Ensure we have a valid value
        if (!projectTypeValue) {
          setSubcategories([]);
          return;
        }

        setSubcategoriesLoading(true);
        try {
          const response = await apiClient.get(`/project-subcategories/by-type/${projectTypeValue}`, {
            params: {
              _t: Date.now(),
            },
            timeout: 30000, // ✅ زيادة timeout إلى 30 ثانية
            headers: {
              'Cache-Control': 'no-cache',
            }
          });

          if (response.data.success) {
            const subcategoriesData = response.data.data || [];
            const processedData = subcategoriesData.map(subcat => ({
              id: subcat.id || subcat.subcategory_id,
              name: subcat.name_ar || subcat.name || subcat.subcategory_name || `التفريعة ${subcat.id || ''}`,
              name_ar: subcat.name_ar || subcat.name || subcat.subcategory_name,
              project_type: subcat.project_type || subcat.type || selectedType
            })).filter(subcat => subcat.id);

            setSubcategories(processedData);

            // ✅ إعادة تعيين التفرعية عند تغيير نوع المشروع
            if (Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0) {
              // ✅ التحقق من أن التفرعية المختارة لا تزال موجودة في القائمة الجديدة
              const validSubcategories = filters.subcategory_id.filter(subcatId =>
                processedData.some(sub => String(sub.id) === String(subcatId))
              );

              if (validSubcategories.length !== filters.subcategory_id.length) {
                // ✅ بعض التفرعات لم تعد صالحة، نحدث الفلاتر
                setFilters(prev => ({ ...prev, subcategory_id: validSubcategories }));
              }
            }

            if (import.meta.env.DEV) {
              console.log(`✅ Loaded subcategories for project type "${selectedType}":`, {
                total: processedData.length,
                sample: processedData.slice(0, 3)
              });
            }
          } else {
            setSubcategories([]);
          }
        } catch (error) {
          // ✅ تجاهل timeout errors في production
          if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            if (import.meta.env.DEV) {
              console.warn(`⚠️ Timeout fetching subcategories for type "${selectedType}", using empty array`);
            }
          } else if (import.meta.env.DEV && !error.isConnectionError) {
            console.error(`Error fetching subcategories for type "${selectedType}":`, error);
          }
          // ✅ في حالة الخطأ، نستخدم array فارغ
          setSubcategories([]);
        } finally {
          setSubcategoriesLoading(false);
        }
      }
      // ✅ إذا كان هناك أنواع متعددة أو لا يوجد نوع محدد، نستخدم جميع التفريعات المحملة مسبقاً
    };

    fetchSubcategoriesByType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters.project_type]);

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
              per_page: 1000,
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
          if (import.meta.env.DEV) {
            console.warn('Failed to fetch photographers:', error);
          }
        }

        // ✅ جلب الممنتجين (لفلتر الممنتج)
        if (!producerId) { // فقط إذا لم نكن في صفحة ممنتج محدد
          try {
            setLoadingProducers(true);
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
              console.warn('Failed to fetch producers:', error);
            }
          } finally {
            setLoadingProducers(false);
          }
        }
      } catch (error) {
        console.error('Error fetching filter lists:', error);
      } finally {
        setLoadingFilterLists(false);
      }
    };

    fetchFilterLists();
  }, [showFilters, producerId]);

  // ✅ إغلاق القوائم المنسدلة عند الضغط خارجها
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
      }
      if (projectTypeDropdownRef.current && !projectTypeDropdownRef.current.contains(event.target)) {
        setShowProjectTypeDropdown(false);
      }
      if (subcategoryDropdownRef.current && !subcategoryDropdownRef.current.contains(event.target)) {
        setShowSubcategoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchProjects = async (forceRefresh = false) => {
    let loadingTimeout;

    try {
      // ✅ التحقق من Cache أولاً (فقط إذا لم يكن force refresh)
      if (!forceRefresh) {
        const filtersKey = JSON.stringify({ ...appliedFilters, producerId }); // ✅ إضافة producerId للـ cache key
        if (isCacheValid(filtersKey)) {
          const cachedData = getData();
          if (cachedData && cachedData.projects && Array.isArray(cachedData.projects) && cachedData.projects.length > 0) {
            setProjects(cachedData.projects || cachedData);
            setPagination(cachedData.pagination || {
              current_page: 1,
              last_page: 1,
              per_page: 10000, // ✅ زيادة عدد المشاريع المعروضة لعرض جميع المشاريع
              total: 0,
            });
            setLoading(false);
            if (import.meta.env.DEV) {
              console.log('✅ Using cached media projects data');
            }
            // ✅ جلب البيانات في الخلفية للتأكد من التحديث
            setTimeout(() => {
              fetchProjects(true);
            }, 1000);
            return;
          }
        }
      }

      // ✅ إلغاء الطلب السابق إذا كان موجوداً
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // ✅ إنشاء AbortController جديد
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setLoading(true);

      // إيقاف حالة التحميل بعد timeout
      loadingTimeout = setTimeout(() => {
        setLoading(false);
        // ✅ لا نصفر البيانات هنا لتجنب "لا توجد مشاريع" إذا الطلب بيرجع بعد 5 ثواني
        // سنعتمد على نجاح الطلب لاحقاً لإظهار البيانات.
      }, 20000); // timeout 20 ثانية

      // ✅ استخدام endpoint مختلف إذا كان هناك producerId
      let endpoint = '/project-proposals';
      const params = new URLSearchParams();

      // إضافة pagination
      // ✅ إذا كان perPage هو 'all'، نستخدم قيمة كبيرة جداً لجلب جميع المشاريع
      let perPageValue = appliedFilters.perPage === 'all' ? 10000 : parseInt(appliedFilters.perPage) || 50;
      params.append('perPage', perPageValue.toString());
      params.append('page', appliedFilters.page.toString());

      // ✅ إذا كان هناك producerId في الـ URL، استخدم الـ endpoint الجديد
      if (producerId) {
        endpoint = `/montage-producers/${producerId}/projects`;

        if (appliedFilters.execution_date_from) {
          params.append('from_date', appliedFilters.execution_date_from);
        }
        if (appliedFilters.execution_date_to) {
          params.append('to_date', appliedFilters.execution_date_to);
        }
      } else {
        // ✅ فلاتر للـ endpoint العادي
        // لا نرسل الفلاتر كـ arrays إلى الـ API - سنطبقها في Frontend
        // ✅ إزالة searchQuery من API call - البحث يتم في Frontend فقط لتجنب إعادة التحميل

        // ✅ إرسال subcategory_id إلى Backend إذا كان هناك قيمة واحدة فقط
        if (Array.isArray(appliedFilters.subcategory_id) && appliedFilters.subcategory_id.length === 1) {
          const subcategoryId = appliedFilters.subcategory_id[0];
          // ✅ التأكد من أن القيمة ليست null أو empty أو 'all'
          if (subcategoryId !== null && subcategoryId !== undefined && subcategoryId !== '' && subcategoryId !== 'all') {
            params.append('subcategory_id', subcategoryId.toString());
            if (import.meta.env.DEV) {
              console.log('📤 Sending subcategory_id to API:', subcategoryId);
            }
          }
        }

        if (appliedFilters.execution_date_from) {
          params.append('execution_date_from', appliedFilters.execution_date_from);
        }
        if (appliedFilters.execution_date_to) {
          params.append('execution_date_to', appliedFilters.execution_date_to);
        }
      }

      // ✅ جلب جميع الصفحات تلقائياً إذا كان هناك أكثر من صفحة واحدة أو إذا كان perPage هو 'all'
      let allProjectsDataRaw = [];
      let firstResponseData = null;
      let totalPages = 1;
      // ✅ عند تفعيل المتأخر فقط، نحتاج نسحب عدد أكبر لتفادي "فلترة على بيانات غير مكتملة"
      const isAllMode = appliedFilters.perPage === 'all' || appliedFilters.priority_only;

      // جلب الصفحة الأولى
      const firstResponse = await apiClient.get(`${endpoint}?${params.toString()}`, {
        timeout: 3000,
        signal: abortController.signal
      });

      if (loadingTimeout) clearTimeout(loadingTimeout);

      if (firstResponse.data.success) {
        firstResponseData = firstResponse.data;

        // تحديد عدد الصفحات
        if (firstResponseData.projects && Array.isArray(firstResponseData.projects)) {
          if (firstResponseData.pagination) {
            totalPages = firstResponseData.pagination.last_page || 1;
            perPageValue = firstResponseData.pagination.per_page || perPageValue;
            } else if (firstResponseData.totalPages) {
              // ✅ ProjectProposalController@index returns: totalPages/currentPage/perPage
              totalPages = firstResponseData.totalPages || 1;
              perPageValue = firstResponseData.perPage || perPageValue;
          }
          allProjectsDataRaw = firstResponseData.projects || [];
        } else if (firstResponseData.data && firstResponseData.data.data) {
          totalPages = firstResponseData.data.last_page || 1;
          perPageValue = firstResponseData.data.per_page || perPageValue;
          allProjectsDataRaw = firstResponseData.data.data || [];
        } else if (Array.isArray(firstResponseData.data)) {
          allProjectsDataRaw = firstResponseData.data;
        }

        // ✅ جلب باقي الصفحات إذا كان هناك أكثر من صفحة واحدة أو إذا كان perPage هو 'all'
        if ((totalPages > 1 || isAllMode)) {
          const maxPages = isAllMode ? 50 : 10; // إذا كان 'all'، نجلب حتى 50 صفحة
          for (let page = 2; page <= totalPages && page <= maxPages; page++) {
            try {
              const pageParams = new URLSearchParams(params);
              pageParams.set('page', page.toString());

              const pageResponse = await apiClient.get(`${endpoint}?${pageParams.toString()}`, {
                timeout: 3000,
                signal: abortController.signal
              });

              if (pageResponse.data.success) {
                const pageData = pageResponse.data;
                let pageProjects = [];

                if (pageData.projects && Array.isArray(pageData.projects)) {
                  pageProjects = pageData.projects;
                } else if (pageData.data && pageData.data.data) {
                  pageProjects = pageData.data.data || [];
                } else if (Array.isArray(pageData.data)) {
                  pageProjects = pageData.data;
                }

                allProjectsDataRaw = allProjectsDataRaw.concat(pageProjects);
              }
            } catch (pageError) {
              // في حالة فشل جلب صفحة معينة، نتوقف ونستخدم ما تم جلبه
              if (import.meta.env.DEV) {
                console.warn(`⚠️ Failed to fetch page ${page}:`, pageError.message);
              }
              break;
            }
          }
        }
      }

      if (firstResponseData && firstResponseData.success) {
        // ✅ استخدام pagination من الباك إند مباشرة
        const responseData = firstResponseData;
        let projectsDataRaw = allProjectsDataRaw;
        let paginationData = {
          current_page: 1,
          last_page: totalPages,
          per_page: perPageValue,
          total: 0,
        };

        // ✅ معالجة البيانات حسب شكل الاستجابة (دعم الـ endpoint الجديد والقديم)
        if (responseData.projects && Array.isArray(responseData.projects)) {
          // ✅ الـ endpoint الجديد: /montage-producers/{id}/projects
          if (responseData.pagination) {
            paginationData = {
              current_page: responseData.pagination.current_page || 1,
              last_page: totalPages,
              per_page: perPageValue,
              total: responseData.pagination.total || allProjectsDataRaw.length,
            };
          } else if (responseData.totalPages) {
            // ✅ ProjectProposalController@index response shape
            paginationData = {
              current_page: responseData.currentPage || 1,
              last_page: responseData.totalPages || totalPages,
              per_page: responseData.perPage || perPageValue,
              total: responseData.total || allProjectsDataRaw.length,
            };
          }

          // ✅ إذا كان الـ endpoint الجديد يحتوي على معلومات المنتج، احفظها
          if (responseData.producer && producerId) {
            setProducerInfo(responseData.producer);
          }
        } else if (responseData.data && responseData.data.data) {
          // Laravel pagination format (الـ endpoint القديم)
          paginationData = {
            current_page: 1,
            last_page: totalPages,
            per_page: perPageValue,
            total: responseData.data.total || allProjectsDataRaw.length,
          };
        }

        let projectsData = Array.isArray(projectsDataRaw)
          ? projectsDataRaw.map(normalizeProjectRecord)
          : [];

          if (import.meta.env.DEV) {
            console.log('📥 MediaProjectsList fetch:', {
              endpoint,
              producerId,
              rawCount: Array.isArray(projectsDataRaw) ? projectsDataRaw.length : 0,
              normalizedCount: projectsData.length,
              priority_only: appliedFilters.priority_only,
            });
          }

        // ✅ Debug: التحقق من وجود subcategory_id في البيانات القادمة من Backend
        if (import.meta.env.DEV && projectsData.length > 0) {
          const sampleRawProject = allProjectsDataRaw[0];
          const sampleNormalizedProject = projectsData[0];

          console.log('🔍 Checking subcategory_id in API response:', {
            rawProjectHasSubcategoryId: sampleRawProject?.subcategory_id !== undefined,
            rawProjectSubcategoryId: sampleRawProject?.subcategory_id,
            rawProjectSubcategory: sampleRawProject?.subcategory,
            normalizedProjectHasSubcategoryId: sampleNormalizedProject?.subcategory_id !== undefined,
            normalizedProjectSubcategoryId: sampleNormalizedProject?.subcategory_id,
            normalizedProjectSubcategory: sampleNormalizedProject?.subcategory,
            rawProjectKeys: Object.keys(sampleRawProject || {}).filter(k =>
              k.toLowerCase().includes('subcategory') || k.toLowerCase().includes('sub_category')
            ),
            normalizedProjectKeys: Object.keys(sampleNormalizedProject || {}).filter(k =>
              k.toLowerCase().includes('subcategory') || k.toLowerCase().includes('sub_category')
            )
          });

          // ✅ إحصائيات عن subcategory_id في البيانات الخام (قبل normalize)
          const rawSubcategoryStats = {};
          allProjectsDataRaw.slice(0, 20).forEach(p => {
            const subcatId = p.subcategory_id;
            const key = subcatId !== null && subcatId !== undefined ? String(subcatId) : 'null_or_undefined';
            rawSubcategoryStats[key] = (rawSubcategoryStats[key] || 0) + 1;
          });
          console.log('🔍 Subcategory ID in RAW API response:', rawSubcategoryStats);
        }

        // ✅ Debug: عرض جميع الحالات القادمة من الباك إند (في وضع التطوير فقط)
        if (import.meta.env.DEV && projectsData.length > 0) {
          console.log('📊 Projects fetched:', {
            endpoint: endpoint,
            producerId: producerId,
            totalProjects: projectsData.length,
            pagination: paginationData
          });
          const allStatuses = [...new Set(projectsData.map(p => p.status).filter(Boolean))];
          console.log('🔍 جميع حالات المشاريع القادمة من الباك إند:', allStatuses);

          // ✅ فحص خاص لمشاريع "قيد التنفيذ"
          const inExecutionProjects = projectsData.filter(p => {
            const status = (p.status || '').trim();
            return status === 'قيد التنفيذ' || status.includes('قيد التنفيذ');
          });
          console.log('🔍 عدد المشاريع بحالة "قيد التنفيذ":', inExecutionProjects.length);
          if (inExecutionProjects.length > 0) {
            console.log('📦 أمثلة على مشاريع "قيد التنفيذ":', inExecutionProjects.slice(0, 5).map(p => ({
              id: p.id,
              name: p.project_name,
              status: p.status,
              normalizedStatus: (p.status || '').trim()
            })));
          }

          const remontageProjects = projectsData.filter(p => p.status === 'معاد مونتاجه');
          console.log('🔍 عدد المشاريع بحالة "معاد مونتاجه":', remontageProjects.length);
          if (remontageProjects.length > 0) {
            console.log('📦 أمثلة على مشاريع "معاد مونتاجه":', remontageProjects.slice(0, 3).map(p => ({
              id: p.id,
              name: p.project_name,
              status: p.status
            })));
          }

          // ✅ Debug: فحص بيانات الممنتج في أول مشروع
          const firstProject = projectsData[0];
          if (firstProject) {
            console.log('🔍 Montage Producer Debug (First Project):', {
              project_id: firstProject.id,
              project_name: firstProject.project_name,
              assigned_montage_producer_id: firstProject.assigned_montage_producer_id,
              assigned_montage_producer: firstProject.assigned_montage_producer,
              montage_producer: firstProject.montage_producer,
              montage_producer_name: firstProject.montage_producer_name,
              producer_name: firstProject.producer_name,
              allMontageKeys: Object.keys(firstProject).filter(k =>
                k.toLowerCase().includes('montage') ||
                k.toLowerCase().includes('producer')
              )
            });
          }
        }

        // ✅ فلترة حسب حالات المونتاج: من "جاهز للتنفيذ" حتى "وصل للمتبرع" (في جميع الحالات)
        // ✅ حالات المونتاج: جاهز للتنفيذ، تم اختيار المخيم، قيد التنفيذ، تم التنفيذ، في المونتاج، تم المونتاج، معاد مونتاجه، وصل للمتبرع
        const montageStatuses = ['جاهز للتنفيذ', 'تم اختيار المخيم', 'قيد التنفيذ', 'تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];

        // ✅ فلترة المشاريع لعرض فقط المشاريع من "جاهز للتنفيذ" حتى "وصل للمتبرع"
        projectsData = projectsData.filter(p => {
          if (!p.status) return false;

          // ✅ تطبيع الحالة (إزالة المسافات الزائدة والتأكد من المطابقة)
          const normalizedStatus = p.status.trim();

          // ✅ التحقق من الحالات المشابهة أولاً (مثل "معاد مونتاجه" قد تأتي بصيغ مختلفة)
          // معالجة جميع الصيغ المحتملة: "معاد مونتاجه", "يجب إعادة المونتاج", "لحب اعادة المونتاج", إلخ
          if (normalizedStatus.includes('معاد') && normalizedStatus.includes('مونتاج')) {
            // تحديث الحالة لتكون موحدة
            p.status = 'معاد مونتاجه';
            p.__isRemontage = true; // ✅ علامة خاصة للتمييز
            return true;
          }
          if (normalizedStatus.includes('إعادة') && normalizedStatus.includes('مونتاج')) {
            p.status = 'معاد مونتاجه';
            p.__isRemontage = true;
            return true;
          }
          if (normalizedStatus.includes('اعادة') && normalizedStatus.includes('مونتاج')) {
            p.status = 'معاد مونتاجه';
            p.__isRemontage = true;
            return true;
          }
          if (normalizedStatus.includes('يجب') && (normalizedStatus.includes('إعادة') || normalizedStatus.includes('اعادة'))) {
            p.status = 'معاد مونتاجه';
            p.__isRemontage = true;
            return true;
          }

          // ✅ التحقق من الحالات المطلوبة بشكل صريح (من "جاهز للتنفيذ" حتى "وصل للمتبرع")
          // ✅ 1. جاهز للتنفيذ
          if (normalizedStatus === 'جاهز للتنفيذ' || normalizedStatus.includes('جاهز للتنفيذ')) {
            return true;
          }

          // ✅ 2. تم اختيار المخيم
          if (normalizedStatus === 'تم اختيار المخيم' || normalizedStatus.includes('تم اختيار المخيم')) {
            return true;
          }

          // ✅ 3. قيد التنفيذ - فحص شامل لجميع الصيغ المحتملة
          if (normalizedStatus === 'قيد التنفيذ' ||
            normalizedStatus.includes('قيد التنفيذ') ||
            normalizedStatus === 'قيد التنفيذ' ||
            normalizedStatus.startsWith('قيد') && normalizedStatus.includes('تنفيذ')) {
            if (import.meta.env.DEV) {
              console.log('✅ Project with "قيد التنفيذ" status found:', {
                id: p.id,
                status: p.status,
                normalizedStatus: normalizedStatus
              });
            }
            return true;
          }

          // ✅ 4. تم التنفيذ
          if (normalizedStatus === 'تم التنفيذ' || normalizedStatus.includes('تم التنفيذ')) {
            return true;
          }

          // ✅ 5. في المونتاج
          if (normalizedStatus === 'في المونتاج' || normalizedStatus.includes('في المونتاج')) {
            return true;
          }

          // ✅ 6. تم المونتاج
          if (normalizedStatus === 'تم المونتاج' || normalizedStatus.includes('تم المونتاج')) {
            return true;
          }

          // ✅ 7. معاد مونتاجه (تم التحقق منه أعلاه)

          // ✅ 8. وصل للمتبرع
          if (normalizedStatus === 'وصل للمتبرع' || normalizedStatus.includes('وصل للمتبرع') || normalizedStatus.includes('وصل')) {
            return true;
          }

          // ✅ إذا كانت الحالة موجودة في القائمة، نعرضها
          if (montageStatuses.includes(normalizedStatus)) {
            if (normalizedStatus === 'معاد مونتاجه') {
              p.__isRemontage = true;
            }
            return true;
          }

          // ✅ إذا لم تكن الحالة موجودة في القائمة، نتحقق من أن المشروع له علاقة بالمونتاج أو التنفيذ
          // ✅ إظهار الحالات من "جاهز للتنفيذ" حتى "وصل للمتبرع"
          return normalizedStatus.includes('مونتاج') ||
            normalizedStatus.includes('تم التنفيذ') ||
            normalizedStatus.includes('قيد التنفيذ') ||
            normalizedStatus.includes('جاهز للتنفيذ') ||
            normalizedStatus.includes('تم اختيار المخيم') ||
            normalizedStatus.includes('وصل');
        });

        // ✅ Debug: التحقق من أن مشاريع "قيد التنفيذ" لم تُفلتر
        if (import.meta.env.DEV) {
          const inExecutionAfterFilter = projectsData.filter(p => {
            const status = (p.status || '').trim();
            return status === 'قيد التنفيذ' || status.includes('قيد التنفيذ');
          }).length;
          console.log('🔍 فلترة المشاريع - "قيد التنفيذ":', {
            بعد_الفلترة: inExecutionAfterFilter,
            'إجمالي المشاريع بعد الفلترة': projectsData.length
          });
          if (inExecutionAfterFilter === 0 && projectsData.length > 0) {
            const allStatusesAfter = [...new Set(projectsData.map(p => p.status).filter(Boolean))];
            console.log('⚠️ لا توجد مشاريع "قيد التنفيذ" بعد الفلترة. الحالات الموجودة:', allStatusesAfter);
          }
        }

        // ✅ فلترة حسب montage_status إذا كان محدداً (دعم اختيار متعدد)
        // فقط إذا كان هناك اختيارات، وإلا نعرض الكل
        if (!producerId && Array.isArray(appliedFilters.montage_status) && appliedFilters.montage_status.length > 0) {
          projectsData = projectsData.filter(p => appliedFilters.montage_status.includes(p.status));
        }

        // ✅ تطبيق فلترة نوع المشروع في Frontend (دعم اختيار متعدد)
        // فقط إذا كان هناك اختيارات، وإلا نعرض الكل
        if (Array.isArray(appliedFilters.project_type) && appliedFilters.project_type.length > 0) {
          projectsData = projectsData.filter((project) => appliedFilters.project_type.includes(project.project_type));
        }

        // ✅ تطبيق فلترة الباحث في Frontend إذا اختار المستخدم باحث معين
        if (appliedFilters.researcher_id && appliedFilters.researcher_id !== '') {
          const targetResearcherId = parseInt(appliedFilters.researcher_id, 10);
          projectsData = projectsData.filter((project) => {
            const researcherId = project.assigned_researcher_id ||
              project.assigned_researcher?.id ||
              project.researcher_id ||
              project.researcher?.id;
            return researcherId && parseInt(String(researcherId), 10) === targetResearcherId;
          });
        }

        // ✅ تطبيق فلترة المصور في Frontend إذا اختار المستخدم مصور معين
        if (appliedFilters.photographer_id && appliedFilters.photographer_id !== '') {
          const targetPhotographerId = parseInt(appliedFilters.photographer_id, 10);
          projectsData = projectsData.filter((project) => {
            const photographerId = project.assigned_photographer_id ||
              project.assigned_photographer?.id ||
              project.photographer_id ||
              project.photographer?.id;
            return photographerId && parseInt(String(photographerId), 10) === targetPhotographerId;
          });
        }

        // ✅ تطبيق فلترة الممنتج في Frontend إذا اختار المستخدم ممنتج معين
        if (!producerId && appliedFilters.producer_id && appliedFilters.producer_id !== '') {
          const targetProducerId = parseInt(appliedFilters.producer_id, 10);
          if (!isNaN(targetProducerId)) {
            projectsData = projectsData.filter((project) => {
              const montageProducerId = project.assigned_montage_producer_id ||
                project.assigned_montage_producer?.id ||
                project.montage_producer_id ||
                project.montage_producer?.id;
              if (!montageProducerId) return false;
              const producerIdNum = parseInt(String(montageProducerId), 10);
              return !isNaN(producerIdNum) && producerIdNum === targetProducerId;
            });
            if (import.meta.env.DEV) {
              console.log('🔍 Applied producer filter:', {
                targetProducerId,
                filteredProjects: projectsData.length
              });
            }
          }
        }

        // ✅ تطبيق فلترة التفريعة في Frontend
        // ملاحظة: حتى لو أرسلنا subcategory_id إلى Backend، نطبق الفلترة في Frontend أيضاً
        // كـ fallback للتأكد من أن الفلترة تعمل بشكل صحيح
        if (Array.isArray(appliedFilters.subcategory_id) && appliedFilters.subcategory_id.length > 0) {
          if (import.meta.env.DEV) {
            console.log('🔍 Starting subcategory filter:', {
              appliedFilters_subcategory_id: appliedFilters.subcategory_id,
              projectsDataLength: projectsData.length
            });
          }

          // ✅ تحويل جميع القيم إلى numbers للمقارنة الصحيحة (دعم strings و numbers)
          const targetSubcategoryIds = appliedFilters.subcategory_id
            .map(id => {
              const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
              return !isNaN(numId) ? numId : null;
            })
            .filter(id => id !== null);

          if (targetSubcategoryIds.length > 0) {
            const projectsBeforeFilter = projectsData.length;

            if (import.meta.env.DEV) {
              console.log('🔍 Target subcategory IDs:', targetSubcategoryIds);
            }

            projectsData = projectsData.filter((project) => {
              // ✅ أولوية: قراءة subcategory_id مباشرة من المشروع (العمود في جدول المشاريع)
              // هذا هو المصدر الأساسي لأن subcategory_id موجود كـ foreign key في جدول المشاريع
              let projectSubcategoryId = null;

              // ✅ المصدر الأول والأهم: project.subcategory_id (العمود في جدول المشاريع)
              if (project.subcategory_id !== null && project.subcategory_id !== undefined && project.subcategory_id !== '') {
                projectSubcategoryId = project.subcategory_id;
              }
              // ✅ المصدر الثاني: project.subcategory (إذا كان Backend يرسل relationship object)
              else if (project.subcategory) {
                if (typeof project.subcategory === 'object' && project.subcategory !== null) {
                  projectSubcategoryId = project.subcategory.id || project.subcategory.subcategory_id || project.subcategory.subcategoryId;
                } else if (typeof project.subcategory === 'number' || typeof project.subcategory === 'string') {
                  projectSubcategoryId = project.subcategory;
                }
              }
              // ✅ المصادر البديلة (للدعم فقط)
              else {
                projectSubcategoryId = project.subcategoryId || project.sub_category_id || null;
              }

              // ✅ إذا لم يكن للمشروع subcategory_id (null بسبب ON DELETE SET NULL)، لا نعرضه في حالة الفلترة
              if (projectSubcategoryId === null || projectSubcategoryId === undefined || projectSubcategoryId === '') {
                return false;
              }

              // ✅ تحويل إلى number للمقارنة (دعم strings و numbers)
              const projectIdNum = typeof projectSubcategoryId === 'string'
                ? parseInt(projectSubcategoryId, 10)
                : Number(projectSubcategoryId);

              // ✅ التحقق من أن القيمة صالحة
              if (isNaN(projectIdNum)) {
                if (import.meta.env.DEV) {
                  console.warn('⚠️ Invalid subcategory_id in project:', {
                    projectId: project.id,
                    projectName: project.project_name,
                    subcategory_id: projectSubcategoryId,
                    type: typeof projectSubcategoryId
                  });
                }
                return false;
              }

              // ✅ المقارنة المحسّنة - تحويل جميع القيم إلى numbers للمقارنة
              const isMatch = targetSubcategoryIds.some(targetId => {
                const targetIdNum = typeof targetId === 'string' ? parseInt(targetId, 10) : Number(targetId);
                if (isNaN(targetIdNum)) {
                  return false;
                }
                return targetIdNum === projectIdNum;
              });

              return isMatch;
            });

            if (import.meta.env.DEV) {
              // ✅ إحصائيات عن subcategory_id في المشاريع المفلترة
              const subcategoryStats = {};
              projectsData.slice(0, 10).forEach(p => {
                const subcatId = p.subcategory_id;
                const key = subcatId ? String(subcatId) : 'null';
                subcategoryStats[key] = (subcategoryStats[key] || 0) + 1;
              });

              console.log('✅ Applied subcategory filter successfully:', {
                appliedFilters: appliedFilters.subcategory_id,
                targetSubcategoryIds,
                projectsBeforeFilter,
                filteredProjects: projectsData.length,
                subcategoryStats,
                sampleProject: projectsData.length > 0 ? {
                  id: projectsData[0].id,
                  project_name: projectsData[0].project_name,
                  subcategory_id: projectsData[0].subcategory_id,
                  subcategory: projectsData[0].subcategory,
                  allSubcategoryKeys: Object.keys(projectsData[0] || {}).filter(k =>
                    k.toLowerCase().includes('subcategory') || k.toLowerCase().includes('sub_category')
                  )
                } : null
              });

              // ✅ إذا لم تظهر أي مشاريع، نعرض أمثلة على المشاريع التي تم استبعادها
              if (projectsData.length === 0 && projectsBeforeFilter > 0) {
                const sampleProjects = allProjectsDataRaw.slice(0, 10).map(p => {
                  // ✅ محاولة الحصول على subcategory_id من جميع المصادر
                  let subcatId = p.subcategory_id;
                  if (!subcatId && p.subcategory) {
                    if (typeof p.subcategory === 'object' && p.subcategory !== null) {
                      subcatId = p.subcategory.id || p.subcategory.subcategory_id || p.subcategory.subcategoryId;
                    } else {
                      subcatId = p.subcategory;
                    }
                  }
                  if (!subcatId) {
                    subcatId = p.subcategoryId || p.sub_category_id || null;
                  }

                  return {
                    id: p.id,
                    project_name: p.project_name,
                    subcategory_id: p.subcategory_id,
                    subcategory: p.subcategory,
                    subcategoryId: p.subcategoryId,
                    sub_category_id: p.sub_category_id,
                    extracted_subcategory_id: subcatId,
                    extracted_type: typeof subcatId,
                    extracted_number: subcatId ? (typeof subcatId === 'string' ? parseInt(subcatId, 10) : Number(subcatId)) : null,
                    allKeys: Object.keys(p).filter(k =>
                      k.toLowerCase().includes('subcategory') || k.toLowerCase().includes('sub_category')
                    )
                  };
                });
                console.warn('⚠️ No projects match subcategory filter.');
                console.warn('⚠️ Filter was looking for (as numbers):', targetSubcategoryIds);
                console.warn('⚠️ Filter was looking for (original):', appliedFilters.subcategory_id);
                console.warn('⚠️ Sample projects with subcategory info:', sampleProjects);

                // ✅ رسالة توضيحية للمطور
                console.error('❌ المشكلة: جميع المشاريع لديها subcategory_id = null');
                console.error('❌ الحلول المحتملة:');
                console.error('   1. تأكد من أن Backend يرسل subcategory_id في استجابة /project-proposals');
                console.error('   2. تأكد من أن المشاريع في قاعدة البيانات تحتوي على subcategory_id');
                console.error('   3. تحقق من أن عمود subcategory_id موجود في جدول المشاريع');

                // ✅ عرض إحصائيات عن subcategory_id في المشاريع
                const subcategoryStats = {};
                allProjectsDataRaw.slice(0, 50).forEach(p => {
                  let subcatId = p.subcategory_id;
                  if (!subcatId && p.subcategory) {
                    if (typeof p.subcategory === 'object' && p.subcategory !== null) {
                      subcatId = p.subcategory.id || p.subcategory.subcategory_id || p.subcategory.subcategoryId;
                    } else {
                      subcatId = p.subcategory;
                    }
                  }
                  if (!subcatId) {
                    subcatId = p.subcategoryId || p.sub_category_id || null;
                  }
                  const key = subcatId ? String(subcatId) : 'null';
                  subcategoryStats[key] = (subcategoryStats[key] || 0) + 1;
                });
                console.warn('⚠️ Subcategory ID distribution in projects:', subcategoryStats);
              }
            }
          }
        }

        // ✅ تطبيق فلترة المشروع الأصلي - يعرض المشروع الأصلي + جميع مشاريعه الفرعية
        if (appliedFilters.parent_project_id && appliedFilters.parent_project_id !== '') {
          const targetParentProjectId = parseInt(appliedFilters.parent_project_id, 10);

          if (import.meta.env.DEV) {
            console.log('🔍 Applying parent project filter:', {
              targetParentProjectId,
              totalProjectsBefore: projectsData.length,
            });
          }

          projectsData = projectsData.filter((project) => {
            // ✅ الحصول على معرف المشروع الأصلي
            const projectId = project.id ? parseInt(String(project.id), 10) : null;
            const parentProjectId = project.parent_project_id
              ? parseInt(String(project.parent_project_id), 10)
              : (project.parent_project?.id ? parseInt(String(project.parent_project.id), 10) : null);

            // ✅ إذا كان المشروع هو المشروع الأصلي نفسه
            if (projectId === targetParentProjectId) {
              if (import.meta.env.DEV) {
                console.log('✅ Project is parent itself:', projectId, project.project_name);
              }
              return true;
            }

            // ✅ إذا كان المشروع فرعي مرتبط بالمشروع الأصلي
            if (parentProjectId === targetParentProjectId) {
              if (import.meta.env.DEV) {
                console.log('✅ Project is child of parent:', projectId, project.project_name, 'parent:', parentProjectId);
              }
              return true;
            }

            return false;
          });

          if (import.meta.env.DEV) {
            console.log('🔍 After parent project filter:', {
              totalProjectsAfter: projectsData.length,
              filteredProjects: projectsData.map(p => ({
                id: p.id,
                name: p.project_name,
                parent_id: p.parent_project_id || p.parent_project?.id
              }))
            });
          }
        }

        // ✅ تطبيق فلترة البحث في Frontend (كود التبرع، كود المشروع الداخلي، اسم المشروع، اسم المتبرع)
        if (appliedFilters.searchQuery && appliedFilters.searchQuery.trim() !== '') {
          const searchTerm = appliedFilters.searchQuery.trim().toLowerCase();
          projectsData = projectsData.filter((project) => {
            // ✅ البحث في كود التبرع
            const donorCode = project.donor_code ? String(project.donor_code).toLowerCase() : '';
            if (donorCode.includes(searchTerm)) return true;

            // ✅ البحث في كود المشروع الداخلي
            const internalCode = project.internal_code ? String(project.internal_code).toLowerCase() : '';
            if (internalCode.includes(searchTerm)) return true;

            // ✅ البحث في اسم المشروع
            const projectName = project.project_name ? String(project.project_name).toLowerCase() : '';
            if (projectName.includes(searchTerm)) return true;

            // ✅ البحث في اسم المتبرع
            const donorName = project.donor_name ? String(project.donor_name).toLowerCase() : '';
            if (donorName.includes(searchTerm)) return true;

            // ✅ البحث في وصف المشروع (إضافي)
            const projectDescription = project.project_description ? String(project.project_description).toLowerCase() : '';
            if (projectDescription.includes(searchTerm)) return true;

            return false;
          });
        }

        // ✅ تطبيق فلترة تاريخ التنفيذ في Frontend
        if (appliedFilters.execution_date_from || appliedFilters.execution_date_to) {
          projectsData = projectsData.filter((project) => {
            // ✅ استخدام execution_date كتاريخ للفلترة
            const executionDate = project.execution_date || project.executionDate;
            if (!executionDate) {
              // إذا لم يكن هناك تاريخ تنفيذ، نعرض المشروع فقط إذا لم يكن هناك فلترة محددة
              return !appliedFilters.execution_date_from && !appliedFilters.execution_date_to;
            }

            const projectExecutionDate = new Date(executionDate);
            projectExecutionDate.setHours(0, 0, 0, 0); // ✅ إزالة الوقت للمقارنة

            // ✅ فلترة حسب تاريخ البداية
            if (appliedFilters.execution_date_from) {
              const fromDate = new Date(appliedFilters.execution_date_from);
              fromDate.setHours(0, 0, 0, 0);
              if (projectExecutionDate < fromDate) {
                return false;
              }
            }

            // ✅ فلترة حسب تاريخ النهاية
            if (appliedFilters.execution_date_to) {
              const toDate = new Date(appliedFilters.execution_date_to);
              toDate.setHours(23, 59, 59, 999); // ✅ إضافة نهاية اليوم
              if (projectExecutionDate > toDate) {
                return false;
              }
            }

            return true;
          });
        }

        // ✅ فلترة حسب priority_only
        if (appliedFilters.priority_only) {
          projectsData = projectsData.filter((p) => {
            const status = (p.status || '').trim();

            const remaining = Number(p?.remaining_days ?? p?.remainingDays);
            const notDelayedStatuses = ['وصل للمتبرع', 'منتهي', 'تم التنفيذ', 'منفذ', 'ملغى'];

            // ✅ متأخر فعلياً حسب طلبك: remaining_days <= 0 (وليس < 2)
            const derivedDelayed =
              !Number.isNaN(remaining) &&
              remaining <= 0 &&
              !notDelayedStatuses.includes(status);

            if (derivedDelayed) return true;

            // ✅ fallback from dates when computed fields are missing
            if (status === 'في المونتاج' && p?.montage_start_date) {
              const startTs = new Date(p.montage_start_date).getTime();
              if (!Number.isNaN(startTs)) {
                const hoursDiff = (Date.now() - startTs) / (1000 * 60 * 60);
                // Same concept: "overdue" if > 48 hours
                return hoursDiff >= 48;
              }
            }

            // fallback: for other in-progress statuses, use execution_date
            if (!notDelayedStatuses.includes(status) && p?.execution_date) {
              const execTs = new Date(p.execution_date).getTime();
              if (!Number.isNaN(execTs)) {
                const hoursDiff = (Date.now() - execTs) / (1000 * 60 * 60);
                return hoursDiff >= 48;
              }
            }

            return false;
          });
        }

        // ✅ إذا كنا في صفحة "ممنتج محدد" وفعّلنا فلتر المتأخر،
        // لأن الفلترة هنا تتم من الـ frontend، صحح pagination حتى لا يظهر عدد صفحات غير صحيح.
        if (appliedFilters.priority_only) {
          const totalFiltered = projectsData.length;
          paginationData = {
            ...paginationData,
            current_page: 1,
            last_page: 1,
            total: totalFiltered,
            per_page: Math.max(1, totalFiltered),
          };
        }

        // ✅ فلترة المشاريع المنتهية: إزالة المشاريع المنتهية للمستخدمين غير Admin
        const userRole = user?.role?.toLowerCase?.() ||
          user?.userRole?.toLowerCase?.() ||
          user?.user_role?.toLowerCase?.() ||
          user?.role_name?.toLowerCase?.() ||
          user?.role || '';
        const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

        if (!isAdmin) {
          projectsData = projectsData.filter((project) => {
            const status = (project.status || '').trim();
            return status !== 'منتهي';
          });
        }

        // ✅ ترتيب المشاريع (إذا لم يكن في الباك إند)
        // ✅ الأولوية: المشاريع المتأخرة للإعلام (في الأعلى) ثم إعادة المونتاج
        projectsData.sort((a, b) => {
          const getRemaining = (p) => Number(p?.remaining_days ?? p?.remainingDays);
          const getStatus = (p) => (p?.status || '').trim();
          const notDelayedStatuses = ['وصل للمتبرع', 'منتهي', 'تم التنفيذ', 'منفذ', 'ملغى'];
          const blockWarningStatuses = ['وصل للمتبرع', 'في المونتاج', 'منتهي', 'ملغى'];

          const isLateOrWarningProject = (p) => {
            const status = getStatus(p);
            const remaining = getRemaining(p);

            // ✅ late/warning: remaining_days <= 2 و ليست "في المونتاج"
            const derivedWarning =
              !Number.isNaN(remaining) &&
              remaining <= 2 &&
              !blockWarningStatuses.includes(status);

            if (derivedWarning) return true;

            // fallback from montage/execution dates
            if (status === 'في المونتاج' && p?.montage_start_date) {
              const startTs = new Date(p.montage_start_date).getTime();
              if (!Number.isNaN(startTs)) {
                const hoursDiff = (Date.now() - startTs) / (1000 * 60 * 60);
                return hoursDiff >= 48;
              }
            }

            if (!notDelayedStatuses.includes(status) && p?.execution_date) {
              const execTs = new Date(p.execution_date).getTime();
              if (!Number.isNaN(execTs)) {
                const hoursDiff = (Date.now() - execTs) / (1000 * 60 * 60);
                return hoursDiff >= 48;
              }
            }

            return false;
          };

          const getDelayedDaysForSort = (p) => {
            const fromApi = Number(p?.delayed_days ?? p?.delayedDays);
            if (!Number.isNaN(fromApi) && fromApi > 0) return fromApi;

            const remaining = getRemaining(p);
            if (!Number.isNaN(remaining)) {
              // when remaining < 2, delayed_days = 2 - remaining
              return Math.max(1, Math.max(0, 2 - remaining));
            }
            return 1;
          };

          const aIsLate = isLateOrWarningProject(a);
          const bIsLate = isLateOrWarningProject(b);
          if (aIsLate && !bIsLate) return -1;
          if (!aIsLate && bIsLate) return 1;

          const aIsRemontage = a.status === 'معاد مونتاجه';
          const bIsRemontage = b.status === 'معاد مونتاجه';

          // if both are late states, keep higher delayed_days first (when available)
          if (aIsLate && bIsLate) {
            const aDays = getDelayedDaysForSort(a);
            const bDays = getDelayedDaysForSort(b);
            if (aDays !== bDays) return bDays - aDays;
          }

          if (aIsRemontage && !bIsRemontage) return -1;
          if (!aIsRemontage && bIsRemontage) return 1;

          // إذا كانت نفس الفئة، نطبق الترتيب المطلوب
          if (appliedFilters.sort_by === 'priority') {
            const now = new Date();
            const aDays = getDaysSinceExecution(a, now);
            const bDays = getDaysSinceExecution(b, now);
            return bDays - aDays;
          } else if (appliedFilters.sort_by === 'date') {
            const aDate = new Date(a.execution_date || a.created_at);
            const bDate = new Date(b.execution_date || b.created_at);
            return bDate - aDate;
          } else if (appliedFilters.sort_by === 'name') {
            const aName = (a.project_name || a.project_description || '').toLowerCase();
            const bName = (b.project_name || b.project_description || '').toLowerCase();
            return aName.localeCompare(bName, 'ar');
          }

          return 0;
        });

        // ✅ حفظ في cache (فقط إذا كانت البيانات موجودة)
        if (projectsData && projectsData.length > 0) {
          const cacheData = {
            projects: projectsData,
            pagination: paginationData,
          };
          // ✅ إضافة timestamp للـ cache data
          const cacheDataWithTimestamp = {
            ...cacheData,
            timestamp: Date.now() // ✅ إضافة timestamp لتتبع عمر الـ cache
          };
          setCachedData(cacheDataWithTimestamp, { ...appliedFilters, producerId }); // ✅ استخدام appliedFilters بدلاً من filters
        }

        setProjects(projectsData);
        setPagination(paginationData);
        setLoading(false);
      } else {
        // ✅ إذا لم تكن هناك بيانات، نتحقق من الكاش أولاً
        const cachedData = getData();
        if (cachedData && cachedData.projects && Array.isArray(cachedData.projects) && cachedData.projects.length > 0) {
          setProjects(cachedData.projects);
          setPagination(cachedData.pagination || {
            current_page: 1,
            last_page: 1,
            per_page: 10000,
            total: cachedData.projects.length,
          });
        } else {
          setProjects([]);
          setPagination({
            current_page: 1,
            last_page: 1,
            per_page: 10000, // ✅ زيادة عدد المشاريع المعروضة لعرض جميع المشاريع
            total: 0,
          });
        }
        setLoading(false);
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);

      // ✅ تجاهل أخطاء الإلغاء (CanceledError) - هذه أخطاء طبيعية عند إلغاء الطلب
      if (error.name === 'CanceledError' ||
        error.code === 'ERR_CANCELED' ||
        error.message?.includes('canceled') ||
        (error.config?.signal?.aborted)) {
        if (import.meta.env.DEV) {
          console.log('ℹ️ Request was canceled (normal behavior)');
        }
        return; // لا نفعل شيء عند إلغاء الطلب
      }

      setProjects([]);
      setPagination({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
      });

      // ✅ تجاهل أخطاء الاتصال والـ timeout
      if (error.isConnectionError || error.isTimeoutError) {
        return;
      }

      if (import.meta.env.DEV && !error.isConnectionError && !error.isTimeoutError) {
        console.error('Error fetching projects:', error);
      }

      if (!error.isConnectionError && !error.isTimeoutError) {
        toast.error(error.userMessage || 'حدث خطأ أثناء تحميل المشاريع');
      }
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  // Helper function محسّنة لحساب الأيام منذ التنفيذ
  const getDaysSinceExecution = useCallback((project, now) => {
    const DAY_IN_MS = 1000 * 60 * 60 * 24;

    if (project.status === 'في المونتاج' && project.montage_start_date) {
      const startDate = new Date(project.montage_start_date);
      return Math.floor((now - startDate) / DAY_IN_MS);
    }
    if (project.execution_date) {
      const execDate = new Date(project.execution_date);
      return Math.floor((now - execDate) / DAY_IN_MS);
    }
    if (project.created_at) {
      const createdDate = new Date(project.created_at);
      return Math.floor((now - createdDate) / DAY_IN_MS);
    }
    return 0;
  }, []);

  const handleSearchChange = (e) => {
    // ✅ تحديث searchInput فوراً (للمستخدم) - لا يسبب re-render أو فقدان التركيز
    setSearchInput(e.target.value);
  };

  // ✅ معالج للضغط على Enter لتطبيق البحث فوراً
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // ✅ تطبيق البحث فوراً بدون انتظار debounce
      setAppliedFilters(prev => ({
        ...prev,
        searchQuery: searchInput.trim(),
        page: 1,
      }));
      setFilters(prev => ({
        ...prev,
        searchQuery: searchInput.trim(),
        page: 1,
      }));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  // ✅ دالة لتطبيق الفلاتر (بدون البحث - البحث يعمل فقط عند Enter)
  const handleApplyFilters = () => {
    if (import.meta.env.DEV) {
      console.log('🔍 Applying filters:', {
        filters,
        parent_project_id: filters.parent_project_id,
      });
    }
    // ✅ تطبيق الفلاتر فقط (بدون البحث - البحث منفصل)
    setAppliedFilters(prev => ({
      ...prev,
      ...filters,
      searchQuery: prev.searchQuery, // ✅ الحفاظ على قيمة البحث الحالية
    }));
    toast.success('تم تطبيق الفلترة بنجاح');
    // إغلاق القوائم المنسدلة
    setShowStatusDropdown(false);
    setShowProjectTypeDropdown(false);
    setShowSubcategoryDropdown(false);
  };

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage });
    setAppliedFilters({ ...appliedFilters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateStatus = (project) => {
    // ✅ إذا كانت الحالة "قيد التنفيذ"، نفتح Modal خاص (تم التنفيذ / تأجيل)
    if (project.status === 'قيد التنفيذ') {
      setSelectedProjectForStatusUpdate(project);
      setExecutionStatusAction(null);
      setPostponementReason('');
      setShowExecutionStatusModal(true);
    } else {
      // ✅ للحالات الأخرى، نستخدم Modal تحديث الحالة العادي
      setSelectedProject(project);
      setShowUpdateModal(true);
    }
  };

  // ✅ دالة لتحديث حالة التنفيذ إلى "تم التنفيذ"
  const handleCompleteExecution = async () => {
    if (!selectedProjectForStatusUpdate) return;

    try {
      const updatedProject = await updateExecutionStatus(selectedProjectForStatusUpdate.id, 'تم التنفيذ');

      // ✅ إبطال الكاش
      invalidateProjectsCache();

      // ✅ إغلاق Modal
      setShowExecutionStatusModal(false);
      setSelectedProjectForStatusUpdate(null);
      setExecutionStatusAction(null);

      // ✅ إعادة جلب المشاريع
      setRefreshTrigger(prev => prev + 1);
      fetchProjects();
    } catch (error) {
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

    try {
      setIsPostponing(true);
      const response = await apiClient.post(`/project-proposals/${selectedProjectForStatusUpdate.id}/postpone`, {
        postponement_reason: postponementReason.trim(),
      });

      if (response.data.success) {
        toast.success(response.data.message || 'تم تأجيل المشروع بنجاح');

        // ✅ إبطال الكاش
        invalidateProjectsCache();

        // ✅ إغلاق Modal
        setShowExecutionStatusModal(false);
        setSelectedProjectForStatusUpdate(null);
        setExecutionStatusAction(null);
        setPostponementReason('');

        // ✅ إعادة جلب المشاريع
        setRefreshTrigger(prev => prev + 1);
        fetchProjects();
      } else {
        toast.error(response.data.message || 'فشل تأجيل المشروع');
      }
    } catch (error) {
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

  // ✅ دالة لتحديث مشروع محلياً في القائمة (Optimistic Update)
  const updateProjectInList = useCallback((projectId, updates) => {
    setProjects((prevProjects) =>
      prevProjects.map((p) =>
        p.id === projectId ? { ...p, ...updates } : p
      )
    );
  }, []);

  const handleStatusUpdated = (updatedProject) => {
    // ✅ إذا كانت بيانات المشروع المحدثة متوفرة، نحدث القائمة فوراً
    if (updatedProject && updatedProject.id) {
      updateProjectInList(updatedProject.id, updatedProject);
    }

    // ✅ إبطال كاش المشاريع عند تحديث الحالة
    invalidateProjectsCache();

    // ✅ إغلاق Modal
    setShowUpdateModal(false);
    setSelectedProject(null);

    // ✅ إعادة جلب المشاريع في الخلفية للتأكد من التزامن
    // استخدام setTimeout لتأخير بسيط لضمان عدم تعارض مع التحديث الفوري
    setTimeout(() => {
      fetchProjects();
    }, 500);
  };

  // ✅ وظائف التحديد الجماعي
  const handleSelectProject = (projectId) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(projects.map(p => p.id)));
    }
  };

  const handleBatchStatusUpdate = () => {
    if (selectedProjects.size === 0) {
      toast.error('يرجى تحديد مشروع واحد على الأقل');
      return;
    }
    setShowBatchStatusModal(true);
  };

  // ✅ التحقق من وجود مشاريع بحالة "قيد التنفيذ" في المشاريع المحددة
  const hasInExecutionProjects = useMemo(() => {
    if (selectedProjects.size === 0) return false;
    return projects.some(project => 
      selectedProjects.has(project.id) && 
      (project.status === 'قيد التنفيذ' || project.status === 'جاهز للتنفيذ')
    );
  }, [selectedProjects, projects]);

  // ✅ التحقق من أن جميع المشاريع المحددة ليست بحالة "قيد التنفيذ" أو "جاهز للتنفيذ"
  const canAssignToProducer = useMemo(() => {
    if (selectedProjects.size === 0) return false;
    // ✅ يجب أن تكون جميع المشاريع المحددة في حالة تسمح بالإسناد (تم التنفيذ أو ما بعده)
    const allowedStatuses = ['تم التنفيذ', 'منفذ', 'في المونتاج', 'تم المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];
    return projects
      .filter(project => selectedProjects.has(project.id))
      .every(project => allowedStatuses.includes(project.status));
  }, [selectedProjects, projects]);

  const handleBatchAssign = () => {
    if (selectedProjects.size === 0) {
      toast.error('يرجى تحديد مشروع واحد على الأقل');
      return;
    }

    // ✅ التحقق من أن جميع المشاريع المحددة في حالة تسمح بالإسناد
    if (!canAssignToProducer) {
      toast.error('لا يمكن إسناد المشاريع بحالة "قيد التنفيذ" للممنتج. يجب أن تكون الحالة "تم التنفيذ" أو ما بعده.');
      return;
    }

    fetchProducersList();
    setShowBatchAssignModal(true);
  };

  const handleBatchStatusSubmit = async (newStatus, notes, rejectionReason) => {
    if (selectedProjects.size === 0) {
      toast.error('لم يتم تحديد أي مشاريع');
      return;
    }

    try {
      setBatchLoading(true);
      const projectIds = Array.from(selectedProjects);

      let response;

      // ✅ إذا كانت الحالة "تم التنفيذ"، استخدم endpoint مختلف
      if (newStatus === 'تم التنفيذ') {
        // ✅ تحديث كل مشروع على حدة باستخدام updateExecutionStatus
        const updatePromises = projectIds.map(projectId => 
          updateExecutionStatus(projectId, 'تم التنفيذ').catch(error => {
            console.error(`Error updating project ${projectId}:`, error);
            return null;
          })
        );

        const results = await Promise.all(updatePromises);
        const successfulUpdates = results.filter(r => r !== null);
        
        if (successfulUpdates.length > 0) {
          // ✅ تحديث المشاريع المحدثة في القائمة
          successfulUpdates.forEach(project => {
            if (project && project.id) {
              updateProjectInList(project.id, project);
            }
          });

          toast.success(`تم تحديث حالة ${successfulUpdates.length} مشروع إلى "تم التنفيذ" بنجاح`);
          
          // ✅ مسح التحديد
          setSelectedProjects(new Set());
          setShowBatchStatusModal(false);

          // ✅ إبطال الكاش وإعادة الجلب
          invalidateProjectsCache();
          setTimeout(() => {
            fetchProjects();
          }, 500);
        } else {
          toast.error('فشل تحديث جميع المشاريع');
        }
        setBatchLoading(false);
        return;
      }

      // ✅ للحالات الأخرى، استخدم batch-update-status
      response = await apiClient.post('/project-proposals/batch-update-status', {
        project_ids: projectIds,
        status: newStatus,
        notes: notes || null,
        rejection_reason: rejectionReason || null,
      });

      if (response.data.success) {
        const updatedCount = response.data.updated_count || projectIds.length;
        toast.success(`تم تحديث حالة ${updatedCount} مشروع بنجاح`);

        // ✅ تحديث المشاريع المحدثة في القائمة
        if (response.data.projects && Array.isArray(response.data.projects)) {
          response.data.projects.forEach(project => {
            if (project && project.id) {
              updateProjectInList(project.id, project);
            }
          });
        }

        // ✅ مسح التحديد
        setSelectedProjects(new Set());
        setShowBatchStatusModal(false);

        // ✅ إبطال الكاش وإعادة الجلب
        invalidateProjectsCache();
        setTimeout(() => {
          fetchProjects();
        }, 500);
      } else {
        toast.error(response.data.message || 'فشل تحديث الحالة');
      }
    } catch (error) {
      console.error('Error updating batch status:', error);
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء تحديث الحالة');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchAssignSubmit = async (producerId) => {
    if (selectedProjects.size === 0) {
      toast.error('لم يتم تحديد أي مشاريع');
      return;
    }

    if (!producerId) {
      toast.error('يرجى اختيار ممنتج');
      return;
    }

    try {
      setBatchLoading(true);
      const projectIds = Array.from(selectedProjects);

      const response = await apiClient.post('/project-proposals/batch-assign-producer', {
        project_ids: projectIds,
        montage_producer_id: parseInt(producerId),
      });

      if (response.data.success) {
        const assignedCount = response.data.assigned_count || projectIds.length;
        toast.success(`تم إسناد ${assignedCount} مشروع للممنتج بنجاح`);

        // ✅ تحديث المشاريع المحدثة في القائمة
        if (response.data.projects && Array.isArray(response.data.projects)) {
          response.data.projects.forEach(project => {
            if (project && project.id) {
              updateProjectInList(project.id, project);
            }
          });
        }

        // ✅ مسح التحديد
        setSelectedProjects(new Set());
        setShowBatchAssignModal(false);
        setSelectedProducerId('');

        // ✅ إبطال الكاش وإعادة الجلب
        invalidateProjectsCache();
        setTimeout(() => {
          fetchProjects();
        }, 500);
      } else {
        toast.error(response.data.message || 'فشل إسناد المشاريع');
      }
    } catch (error) {
      console.error('Error assigning batch projects:', error);
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء إسناد المشاريع');
    } finally {
      setBatchLoading(false);
    }
  };

  const fetchProducersList = async () => {
    try {
      setLoadingProducers(true);
      const response = await apiClient.get('/montage-producers/list');
      if (response.data.success) {
        setProducers(response.data.producers || []);
      }
    } catch (error) {
      console.error('Error fetching producers:', error);
      toast.error('فشل تحميل قائمة الممنتجين');
    } finally {
      setLoadingProducers(false);
    }
  };

  const handleAssignProducer = (project) => {
    setSelectedProject(project);
    // ✅ إذا كان المشروع مسنداً بالفعل، نعرض المنتج الحالي كقيمة افتراضية
    const currentProducerId = project.assigned_montage_producer_id ||
      project.montage_producer_id ||
      '';
    setSelectedProducerId(currentProducerId ? String(currentProducerId) : '');
    fetchProducersList();
    setShowAssignModal(true);
  };

  const handleSubmitAssign = async () => {
    if (!selectedProducerId) {
      toast.error('يرجى اختيار ممنتج');
      return;
    }

    try {
      setLoadingAssign(true); // ✅ استخدام حالة منفصلة
      const response = await apiClient.post(
        `/project-proposals/${selectedProject.id}/assign-montage-producer`,
        {
          montage_producer_id: parseInt(selectedProducerId),
        }
      );

      if (response.data.success) {
        const isReassign = selectedProject.assigned_montage_producer_id;
        toast.success(response.data.message || (isReassign ? 'تم إعادة إسناد المشروع للممنتج بنجاح' : 'تم إسناد المشروع للممنتج بنجاح'));
        setShowAssignModal(false);
        setSelectedProject(null);
        setSelectedProducerId('');
        invalidateProjectsCache();
        fetchProjects();
      }
    } catch (error) {
      console.error('Error assigning producer:', error);
      toast.error(error.response?.data?.message || 'فشل إسناد المشروع');
    } finally {
      setLoadingAssign(false); // ✅ إيقاف حالة الإسناد فقط
    }
  };

  // ✅ التحقق من وجود صورة حقيقية للمشروع (وليس الصورة الافتراضية)
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

  // ✅ دالة تنزيل صورة المشروع
  const handleDownloadImage = async (project) => {
    try {
      const projectId = project.id;

      // ✅ استخدام endpoint API للحصول على الصورة
      const apiEndpoint = `/project-note-image/${projectId}`;

      // ✅ استخدام apiClient للحصول على الصورة كـ blob
      const response = await apiClient.get(apiEndpoint, {
        responseType: 'blob', // ✅ مهم: الحصول على blob بدلاً من JSON
        timeout: 30000,
      });

      // ✅ response.data هو blob في حالة responseType: 'blob'
      const blob = response.data;

      if (!blob || !blob.type || !blob.type.startsWith('image/')) {
        toast.error('لا توجد صورة للمشروع أو الملف ليس صورة');
        return;
      }

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
      if (error.response?.status === 404) {
        toast.error('لا توجد صورة للمشروع');
      } else {
        toast.error(`فشل تنزيل الصورة: ${error.message || 'خطأ غير معروف'}`);
      }
    }
  };

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'غير محدد';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);


  const getStatusColor = (status) => {
    const colors = {
      'تم التنفيذ': 'bg-blue-100 text-blue-700',
      'جاهز للتنفيذ': 'bg-orange-100 text-orange-700', // ✅ لون برتقالي للحالة الجديدة
      'في المونتاج': 'bg-purple-100 text-purple-700',
      'تم المونتاج': 'bg-green-100 text-green-700',
      'معاد مونتاجه': 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-2 border-red-400 font-bold shadow-md', // ✅ لون أحمر مميز لإعادة المونتاج
      'وصل للمتبرع': 'bg-emerald-100 text-emerald-700',
      'منتهي': 'bg-gray-100 text-gray-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  // ✅ نفس منطق getRemainingDaysBadge الموجود في project-management/projects/ProjectsList.jsx
  const getRemainingDaysBadge = (project) => {
    const status = (project?.status || '').trim();
    const notDelayedStatuses = ['تم التنفيذ', 'منفذ', 'وصل للمتبرع', 'منتهي', 'ملغى'];
    const blockWarningStatuses = ['وصل للمتبرع', 'في المونتاج', 'منتهي', 'ملغى'];

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
    const isBlockedFromWarning = blockWarningStatuses.includes(status);

    // ✅ متأخر (أحمر): remaining_days <= 0
    if (!Number.isNaN(remaining) && remaining <= 0 && !notDelayedStatuses.includes(status)) {
      const fromApi = project?.delayed_days ?? project?.delayedDays;
      const computed = Math.max(0, 2 - remaining);
      const raw = (fromApi != null && Number(fromApi) > 0) ? Number(fromApi) : computed;
      const delayedDays = Math.max(1, raw);

      return {
        element: (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
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

    // ✅ تحذير (Late): remaining_days <= 2 و الحالة ليست "وصل للمتبرع" وليست "في المونتاج"
    if (!Number.isNaN(remaining) && remaining <= 2 && !isBlockedFromWarning) {
      const dayText = remaining === 2 ? 'يومين' : 'يوم';
      return {
        element: (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>تحذير</span>
            <span className="font-extrabold">{remaining}</span>
            <span>{dayText}</span>
          </span>
        ),
        isOverdue: true,
        isFinished: false,
      };
    }

    return {
      element: (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
          <span className="font-extrabold">{Number.isNaN(remaining) ? '—' : Math.abs(remaining)}</span>
          <span>يوم متبقي</span>
        </span>
      ),
      isOverdue: false,
      isFinished: false,
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */ }
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            { producerId && producerInfo ? (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <Link
                    to="/media-management/producers"
                    className="text-sky-600 hover:text-sky-700 flex items-center gap-2 transition-colors"
                  >
                    <ArrowRight className="w-5 h-5" />
                    <span className="text-sm font-medium">العودة إلى الممنتجين</span>
                  </Link>
                </div>
                <h1 className="text-3xl font-bold text-gray-800">
                  مشاريع الممنتج: { producerInfo.name || producerInfo.email || 'غير محدد' }
                </h1>
                <p className="text-gray-600 mt-1">المشاريع المسندة لهذا الممنتج فقط</p>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-800">مشاريع قسم الإعلام</h1>
                <p className="text-gray-600 mt-1">إدارة ومتابعة مشاريع المونتاج</p>
              </>
            ) }
          </div>
        </div>

        {/* Search and Filters */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg space-y-4">
          {/* Search */ }
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="بحث في كود التبرع، كود المشروع الداخلي، اسم المشروع، أو اسم المتبرع... (اضغط Enter للتطبيق)"
              value={ searchInput }
              onChange={ handleSearchChange }
              onKeyPress={ handleSearchKeyPress }
              className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Filter Toggle */ }
          <div className="flex items-center justify-between">
            <button
              onClick={ () => setShowFilters(!showFilters) }
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-sky-50 border-2 border-gray-300 hover:border-sky-400 transition-all shadow-sm"
            >
              <Filter className="w-5 h-5 text-sky-600" />
              <span className="font-semibold text-gray-800">الفلاتر</span>
              { (() => {
                const activeFiltersCount =
                  (Array.isArray(appliedFilters.montage_status) ? appliedFilters.montage_status.length : 0) +
                  (Array.isArray(appliedFilters.project_type) ? appliedFilters.project_type.length : 0) +
                  (Array.isArray(appliedFilters.subcategory_id) ? appliedFilters.subcategory_id.length : 0) +
                  (appliedFilters.researcher_id ? 1 : 0) +
                  (appliedFilters.photographer_id ? 1 : 0) +
                  (appliedFilters.producer_id ? 1 : 0) + // ✅ عداد فلتر الممنتج
                  (appliedFilters.parent_project_id ? 1 : 0) +
                  (appliedFilters.priority_only ? 1 : 0) +
                  (appliedFilters.execution_date_from ? 1 : 0) +
                  (appliedFilters.execution_date_to ? 1 : 0);

                return activeFiltersCount > 0 ? (
                  <span className="bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center">
                    { activeFiltersCount }
                  </span>
                ) : null;
              })() }
            </button>
          </div>

          {/* Filters Panel */ }
          { showFilters && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                {/* حالة المونتاج - Dropdown */ }
                <div className="relative" ref={ statusDropdownRef }>
                  <label className="block text-sm font-medium text-gray-700 mb-2">حالة المونتاج</label>
                  <button
                    type="button"
                    onClick={ () => setShowStatusDropdown(!showStatusDropdown) }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-right flex items-center justify-between bg-white hover:border-sky-400 transition-colors"
                  >
                    <span className="text-gray-700 font-medium">
                      { Array.isArray(filters.montage_status) && filters.montage_status.length > 0
                        ? `${filters.montage_status.length} حالة محددة`
                        : 'جميع الحالات'
                      }
                    </span>
                    <ChevronDown className={ `w-4 h-4 text-gray-500 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}` } />
                  </button>

                  { showStatusDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-white border-2 border-sky-300 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-sky-50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={ Array.isArray(filters.montage_status) && filters.montage_status.length === 0 }
                            onChange={ () => handleFilterChange('montage_status', []) }
                            className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                          />
                          <span className="text-sm text-gray-800 font-semibold">جميع الحالات</span>
                        </label>
                        <div className="border-t border-gray-200 my-1"></div>
                        { MONTAGE_STATUSES.map((status) => (
                          <label key={ status } className="flex items-center gap-2 px-3 py-2 hover:bg-sky-50 rounded-lg cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={ Array.isArray(filters.montage_status) && filters.montage_status.includes(status) }
                              onChange={ (e) => {
                                const current = Array.isArray(filters.montage_status) ? filters.montage_status : [];
                                const newValue = e.target.checked
                                  ? [...current, status]
                                  : current.filter(s => s !== status);
                                handleFilterChange('montage_status', newValue);
                              } }
                              className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                            />
                            <span className="text-sm text-gray-700">{ status }</span>
                          </label>
                        )) }
                      </div>
                    </div>
                  ) }
                </div>

                {/* نوع المشروع - Dropdown */ }
                <div className="relative" ref={ projectTypeDropdownRef }>
                  <label className="block text-sm font-medium text-gray-700 mb-2">نوع المشروع</label>
                  <button
                    type="button"
                    onClick={ () => setShowProjectTypeDropdown(!showProjectTypeDropdown) }
                    disabled={ projectTypesLoading }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-right flex items-center justify-between bg-white hover:border-purple-400 transition-colors disabled:opacity-50"
                  >
                    <span className="text-gray-700 font-medium">
                      { Array.isArray(filters.project_type) && filters.project_type.length > 0
                        ? `${filters.project_type.length} نوع محدد`
                        : 'جميع الأنواع'
                      }
                    </span>
                    <ChevronDown className={ `w-4 h-4 text-gray-500 transition-transform ${showProjectTypeDropdown ? 'rotate-180' : ''}` } />
                  </button>

                  { showProjectTypeDropdown && !projectTypesLoading && (
                    <div className="absolute z-50 mt-1 w-full bg-white border-2 border-purple-300 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={ Array.isArray(filters.project_type) && filters.project_type.length === 0 }
                            onChange={ () => handleFilterChange('project_type', []) }
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-800 font-semibold">جميع الأنواع</span>
                        </label>
                        <div className="border-t border-gray-200 my-1"></div>
                        { projectTypes.map((type) => (
                          <label key={ type } className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={ Array.isArray(filters.project_type) && filters.project_type.includes(type) }
                              onChange={ (e) => {
                                const current = Array.isArray(filters.project_type) ? filters.project_type : [];
                                const newValue = e.target.checked
                                  ? [...current, type]
                                  : current.filter(t => t !== type);
                                handleFilterChange('project_type', newValue);
                              } }
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700">{ type }</span>
                          </label>
                        )) }
                      </div>
                    </div>
                  ) }
                </div>

                {/* التفريعة - Dropdown */ }
                <div className="relative" ref={ subcategoryDropdownRef }>
                  <label className="block text-sm font-medium text-gray-700 mb-2">التفريعة</label>
                  <button
                    type="button"
                    onClick={ () => setShowSubcategoryDropdown(!showSubcategoryDropdown) }
                    disabled={ subcategoriesLoading }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-right flex items-center justify-between bg-white hover:border-green-400 transition-colors disabled:opacity-50"
                  >
                    <span className="text-gray-700 font-medium">
                      { Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0
                        ? `${filters.subcategory_id.length} تفريعة محددة`
                        : 'جميع التفريعات'
                      }
                    </span>
                    <ChevronDown className={ `w-4 h-4 text-gray-500 transition-transform ${showSubcategoryDropdown ? 'rotate-180' : ''}` } />
                  </button>

                  { showSubcategoryDropdown && !subcategoriesLoading && subcategories.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white border-2 border-green-300 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-green-50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={ Array.isArray(filters.subcategory_id) && filters.subcategory_id.length === 0 }
                            onChange={ () => handleFilterChange('subcategory_id', []) }
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-800 font-semibold">جميع التفريعات</span>
                        </label>
                        <div className="border-t border-gray-200 my-1"></div>
                        { subcategories.map((subcategory) => {
                          const subcatId = Number(subcategory.id); // ✅ تحويل إلى number
                          const subcatIdStr = String(subcatId);
                          const current = Array.isArray(filters.subcategory_id) ? filters.subcategory_id : [];
                          // ✅ التحقق من جميع الاحتمالات (string, number)
                          const isChecked = current.some(id =>
                            Number(id) === subcatId || String(id) === subcatIdStr
                          );

                          return (
                            <label key={ subcategory.id } className="flex items-center gap-2 px-3 py-2 hover:bg-green-50 rounded-lg cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={ isChecked }
                                onChange={ (e) => {
                                  if (e.target.checked) {
                                    // ✅ إضافة القيمة كـ number (أو string إذا كانت موجودة بالفعل)
                                    const exists = current.some(id =>
                                      Number(id) === subcatId || String(id) === subcatIdStr
                                    );
                                    if (!exists) {
                                      // ✅ حفظ كـ number لضمان المقارنة الصحيحة
                                      handleFilterChange('subcategory_id', [...current, subcatId]);
                                    }
                                  } else {
                                    // ✅ إزالة القيمة (دعم string و number)
                                    const newValue = current.filter(id =>
                                      Number(id) !== subcatId && String(id) !== subcatIdStr
                                    );
                                    handleFilterChange('subcategory_id', newValue);
                                  }
                                } }
                                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                              />
                              <span className="text-sm text-gray-700">{ subcategory.name_ar || subcategory.name || `التفريعة ${subcategory.id}` }</span>
                            </label>
                          );
                        }) }
                      </div>
                    </div>
                  ) }
                </div>

                {/* الباحث */ }
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الباحث</label>
                  <select
                    value={ filters.researcher_id }
                    onChange={ (e) => handleFilterChange('researcher_id', e.target.value) }
                    disabled={ loadingFilterLists }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  >
                    <option value="">الكل</option>
                    { researchers.map((researcher) => (
                      <option key={ researcher.id } value={ researcher.id }>
                        { researcher.name || researcher.email || `الباحث ${researcher.id}` }
                      </option>
                    )) }
                  </select>
                </div>

                {/* المصور */ }
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">المصور</label>
                  <select
                    value={ filters.photographer_id }
                    onChange={ (e) => handleFilterChange('photographer_id', e.target.value) }
                    disabled={ loadingFilterLists }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  >
                    <option value="">الكل</option>
                    { photographers.map((photographer) => (
                      <option key={ photographer.id } value={ photographer.id }>
                        { photographer.name || photographer.email || `المصور ${photographer.id}` }
                      </option>
                    )) }
                  </select>
                </div>

                {/* الممنتج - يظهر فقط إذا لم يكن هناك producerId في الـ URL */ }
                { !producerId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">الممنتج</label>
                    <select
                      value={ filters.producer_id }
                      onChange={ (e) => handleFilterChange('producer_id', e.target.value) }
                      disabled={ loadingProducers }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    >
                      <option value="">الكل</option>
                      { producers.map((producer) => (
                        <option key={ producer.id } value={ producer.id }>
                          { producer.name || producer.email || `الممنتج ${producer.id}` }
                        </option>
                      )) }
                    </select>
                  </div>
                ) }

                {/* المشروع الأصلي */ }
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">المشروع الأصلي</label>
                  <select
                    value={ filters.parent_project_id }
                    onChange={ (e) => handleFilterChange('parent_project_id', e.target.value) }
                    disabled={ parentProjectsLoading }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    <option value="">الكل</option>
                    { parentProjects.map((parentProject) => (
                      <option key={ parentProject.id } value={ parentProject.id }>
                        { getProjectCode(parentProject) } - { parentProject.project_name || parentProject.project_description || `المشروع ${parentProject.id}` }
                      </option>
                    )) }
                  </select>
                </div>

                {/* الترتيب */ }
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الترتيب</label>
                  <select
                    value={ filters.sort_by }
                    onChange={ (e) => handleFilterChange('sort_by', e.target.value) }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="date">حسب التاريخ (الأحدث أولاً)</option>
                    <option value="priority">حسب الأولوية</option>
                    <option value="name">حسب الاسم</option>
                  </select>
                </div>

                {/* تاريخ التنفيذ من */ }
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ التنفيذ من</label>
                  <input
                    type="date"
                    value={ filters.execution_date_from }
                    onChange={ (e) => handleFilterChange('execution_date_from', e.target.value) }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* تاريخ التنفيذ إلى */ }
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ التنفيذ إلى</label>
                  <input
                    type="date"
                    value={ filters.execution_date_to }
                    onChange={ (e) => handleFilterChange('execution_date_to', e.target.value) }
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* المشاريع المتأخرة فقط */ }
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ filters.priority_only }
                      onChange={ (e) => handleFilterChange('priority_only', e.target.checked) }
                      className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                    />
                    <span className="text-sm text-gray-700">المشاريع المتأخرة فقط</span>
                  </label>
                </div>
              </div>

              {/* Apply and Clear Filters Buttons */ }
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200 mt-6">
                {/* Apply Filters Button */ }
                <button
                  onClick={ handleApplyFilters }
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:from-sky-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 relative"
                >
                  <Filter className="w-5 h-5" />
                  تطبيق الفلترة
                  { (() => {
                    // ✅ التحقق من وجود تغييرات غير مطبقة
                    const hasChanges = JSON.stringify(filters) !== JSON.stringify(appliedFilters);
                    return hasChanges ? (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                        جديد
                      </span>
                    ) : null;
                  })() }
                </button>

                {/* Clear Filters Button */ }
                <button
                  onClick={ () => {
                    // مسح الفلاتر
                    const emptyFilters = {
                      montage_status: [],
                      project_type: [],
                      subcategory_id: [],
                      researcher_id: '',
                      photographer_id: '',
                      producer_id: '', // ✅ مسح فلتر الممنتج
                      parent_project_id: '',
                      sort_by: 'date',
                      priority_only: false,
                      searchQuery: '',
                      execution_date_from: '',
                      execution_date_to: '',
                      page: 1,
                      perPage: 'all', // ✅ القيمة الافتراضية: عرض كل المشاريع
                    };
                    setFilters(emptyFilters);
                    setAppliedFilters(emptyFilters);
                    setSearchInput('');
                    localStorage.removeItem('media_filters');
                    // ✅ مسح الكاش عند مسح الفلترة
                    clearCache();
                    invalidateProjectsCache();
                    // ✅ إعادة تحميل البيانات بدون فلاتر
                    setRefreshTrigger(prev => prev + 1);
                    // ✅ جلب البيانات مباشرة بدون الاعتماد على الكاش
                    setTimeout(() => {
                      fetchProjects();
                    }, 100);
                    toast.success('تم مسح جميع الفلاتر');
                  } }
                  className="flex-1 sm:flex-initial px-6 py-3 bg-gradient-to-r from-red-100 to-pink-100 text-red-700 font-bold rounded-xl hover:from-red-200 hover:to-pink-200 transition-all border-2 border-red-300 flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  مسح الفلاتر
                </button>
              </div>
            </>
          ) }
        </div>

        {/* Projects Table */ }
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* ✅ Toolbar للتحديد الجماعي */ }
          { projects.length > 0 && selectedProjects.size > 0 && (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b-2 border-purple-200 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-purple-700">
                  تم تحديد { selectedProjects.size } مشروع
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={ handleBatchStatusUpdate }
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  تحديث الحالة للمحدد
                </button>
                <button
                  onClick={ handleBatchAssign }
                  disabled={ !canAssignToProducer }
                  className={ `px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    canAssignToProducer
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                  }` }
                  title={ !canAssignToProducer ? 'لا يمكن إسناد المشاريع بحالة "قيد التنفيذ" للممنتج. يجب أن تكون الحالة "تم التنفيذ" أو ما بعده.' : '' }
                >
                  <UserPlus className="w-4 h-4" />
                  إسناد للممنتج للمحدد
                </button>
                <button
                  onClick={ () => setSelectedProjects(new Set()) }
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          ) }
          {/* ✅ قائمة اختيار عدد المشاريع المعروضة */ }
          { projects.length > 0 && (
            <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">عدد المشاريع المعروضة:</label>
                <select
                  value={ appliedFilters.perPage }
                  onChange={ (e) => {
                    const newPerPage = e.target.value;
                    setFilters({ ...filters, perPage: newPerPage, page: 1 });
                    setAppliedFilters({ ...appliedFilters, perPage: newPerPage, page: 1 });
                    setRefreshTrigger(prev => prev + 1); // ✅ إعادة تحميل البيانات
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } }
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
                >
                  <option value="25">25 مشروع</option>
                  <option value="50">50 مشروع</option>
                  <option value="100">100 مشروع</option>
                  <option value="200">200 مشروع</option>
                  <option value="500">500 مشروع</option>
                </select>
              </div>
              <div className="text-sm text-gray-600">
                إجمالي المشاريع: <span className="font-bold text-gray-800">{ pagination.total || projects.length }</span>
              </div>
            </div>
          ) }
          { projects.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Video className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>لا توجد مشاريع</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-sky-500 to-blue-600 text-white">
                    <tr>
                      <th className="text-center py-4 px-6 text-sm font-semibold w-12">
                        <input
                          type="checkbox"
                          checked={ selectedProjects.size === projects.length && projects.length > 0 }
                          onChange={ handleSelectAll }
                          className="w-5 h-5 rounded border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                          title="تحديد الكل"
                        />
                      </th>
                      <th className="text-right py-4 px-6 text-sm font-semibold">كود المشروع / المتبرع</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold">اسم المشروع</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold">اليوم</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold">اسم المتبرع</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold">الحالة</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold">تاريخ التنفيذ</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold">المصور</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold">الممنتج</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold">سبب الرفض</th>
                      <th className="text-center py-4 px-6 text-sm font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    { projects.map((project) => {
                      // ✅ التحقق من جميع الصيغ المحتملة للحالة
                      const status = project.status || '';
                      const statusLower = status.toLowerCase();

                      const isRemontage =
                        project.__isRemontage ||
                        status === 'معاد مونتاجه' ||
                        status.includes('معاد') && status.includes('مونتاج') ||
                        status.includes('إعادة') && status.includes('مونتاج') ||
                        status.includes('اعادة') && status.includes('مونتاج') ||
                        status.includes('أعادة') && status.includes('مونتاج') ||
                        status.includes('يجب') && (status.includes('إعادة') || status.includes('اعادة') || status.includes('أعادة')) ||
                        statusLower.includes('remontage') ||
                        statusLower.includes('re-montage') ||
                        statusLower.includes('re montage');

                      // ✅ التحقق من كون المشروع عاجل (بجميع الصيغ المحتملة) - ما عدا المنتهية
                      const isUrgent = (project.is_urgent === true ||
                        project.is_urgent === 1 ||
                        project.is_urgent === '1' ||
                        project.is_urgent === 'true' ||
                        String(project.is_urgent || '').toLowerCase() === 'true' ||
                        Boolean(project.is_urgent)) && project.status !== 'منتهي';

                      const remainingInfoForRow = getRemainingDaysBadge(project);
                      const isDelayedForMedia = remainingInfoForRow.isOverdue;

                      // ✅ Debug: في وضع التطوير، تسجيل الحالات المشبوهة
                      if (import.meta.env.DEV && isRemontage) {
                        console.log('🔍 Project with remontage status:', {
                          id: project.id,
                          status: project.status,
                          isRemontage: isRemontage,
                          normalized: 'معاد مونتاجه'
                        });
                      }

                      // ✅ تحديد className للصف بناءً على الحالة
                      let rowClassName = 'border-b transition-all duration-200 ';
                      if (isRemontage) {
                        rowClassName += 'bg-gradient-to-r from-red-100 via-red-50 to-red-100 border-l-8 border-red-600 shadow-lg hover:shadow-xl hover:from-red-200 hover:via-red-100 hover:to-red-200';
                      } else if (isUrgent) {
                        // ✅ تمييز المشاريع العاجلة بخلفية حمراء واضحة وحدود مميزة
                        rowClassName += 'bg-gradient-to-r from-red-100 via-red-50 to-red-100 border-l-8 border-red-600 shadow-lg hover:shadow-xl hover:from-red-200 hover:via-red-100 hover:to-red-200 ring-2 ring-red-300';
                      } else if (isDelayedForMedia) {
                        // ✅ تمييز المشاريع المتأخرة للإعلام
                        rowClassName += 'bg-red-50 border-l-8 border-red-500 hover:bg-red-100 shadow-sm';
                      } else {
                        rowClassName += 'border-gray-100 hover:bg-gray-50';
                      }

                      return (
                        <tr
                          key={ project.id }
                          className={ rowClassName }
                        >
                          <td className="py-4 px-6 text-center">
                            <input
                              type="checkbox"
                              checked={ selectedProjects.has(project.id) }
                              onChange={ () => handleSelectProject(project.id) }
                              className="w-5 h-5 rounded border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-4 px-6 text-sm font-medium text-gray-800">
                            { project.donor_code || getProjectCode(project) }
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-700">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{ project.project_name || project.project_description || '---' }</span>
                                { isUrgent && (
                                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white border-2 border-red-700 shadow-lg animate-pulse ring-2 ring-red-400" title="مشروع عاجل">
                                    <AlertCircle className="w-4 h-4" />
                                    عاجل
                                  </span>
                                ) }
                                { getRemainingDaysBadge(project).element }
                                { project.status === 'تم التنفيذ' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200 animate-pulse">
                                    جديد
                                  </span>
                                ) }
                                { isRemontage && (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-red-500 to-red-600 text-white border-2 border-red-700 shadow-lg animate-pulse">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    ⚠️ يجب إعادة المونتاج
                                  </span>
                                ) }
                              </div>
                              { renderProjectBadges(project) }
                              { project.parent_project?.project_name && (
                                <span className="text-xs text-gray-500">
                                  من: { project.parent_project.project_name }
                                </span>
                              ) }
                            </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-700">
                            { project.phase_day ? `اليوم ${project.phase_day}` : '---' }
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-700">{ project.donor_name || '---' }</td>
                        
                          <td className="py-4 px-6">
                            <span className={ `inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${isRemontage ? 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-2 border-red-400 font-bold shadow-md' : getStatusColor(project.status)}` }>
                              { isRemontage && (
                                <AlertCircle className="w-3.5 h-3.5" />
                              ) }
                              { isRemontage ? 'معاد مونتاجه' : project.status }
                            </span>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-700">{ formatDate(project.execution_date) }</td>
                          <td className="py-4 px-6 text-sm text-gray-700">
                            { getPhotographerName(project) || 'غير محدد' }
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-700">
                            { (() => {
                              // ✅ محاولة جلب اسم الممنتج من جميع المصادر المحتملة
                              const producerName =
                                project.assigned_montage_producer?.name ||
                                project.montage_producer_name ||
                                project.montage_producer?.name ||
                                project.assignedMontageProducer?.name ||
                                project.assigned_montage_producer_name ||
                                project.producer_name ||
                                project.montageProducer?.name ||
                                project.montageProducerName ||
                                null;

                              // ✅ Debug: عرض البيانات في وضع التطوير
                              if (import.meta.env.DEV && !producerName && project.assigned_montage_producer_id) {
                                console.log('🔍 Project montage producer debug:', {
                                  project_id: project.id,
                                  project_name: project.project_name,
                                  assigned_montage_producer_id: project.assigned_montage_producer_id,
                                  assigned_montage_producer: project.assigned_montage_producer,
                                  montage_producer: project.montage_producer,
                                  allKeys: Object.keys(project).filter(k => k.toLowerCase().includes('montage') || k.toLowerCase().includes('producer'))
                                });
                              }

                              return producerName || 'غير محدد';
                            })() }
                          </td>
                          {/* ✅ عمود سبب الرفض - يظهر للمشاريع المعادة للمونتاج */ }
                          <td className="py-4 px-6 text-sm text-gray-700">
                            { isRemontage ? (
                              <div className="max-w-xs">
                                { project.rejection_reason || project.media_rejection_reason || project.admin_rejection_reason ? (
                                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      سبب الرفض:
                                    </p>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                      { project.rejection_reason || project.media_rejection_reason || project.admin_rejection_reason }
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs italic">لا يوجد سبب محدد</span>
                                ) }
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">---</span>
                            ) }
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center gap-2">
                              {/* ✅ زر تنزيل الصورة - يظهر فقط إذا كانت هناك صورة حقيقية */ }
                              { hasProjectImage(project) && (
                                <button
                                  onClick={ () => handleDownloadImage(project) }
                                  className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors"
                                  title="تنزيل الصورة"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              ) }
                              {/* ✅ زر إعادة الإسناد - متاح لمدير الإعلام في جميع الحالات المناسبة */ }
                              { (['تم التنفيذ', 'منفذ', 'في المونتاج', 'تم المونتاج', 'معاد مونتاجه'].includes(project.status)) && (
                                <button
                                  onClick={ () => handleAssignProducer(project) }
                                  className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors"
                                  title={ project.assigned_montage_producer_id ? 'إعادة إسناد لممنتج' : 'إسناد لممنتج' }
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>
                              ) }
                              {/* ✅ زر تحديث الحالة - يظهر للمشاريع "قيد التنفيذ" و "تم التنفيذ" وما بعدها */ }
                              { (['قيد التنفيذ', 'تم التنفيذ', 'منفذ', 'في المونتاج', 'تم المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'].includes(project.status)) && (
                                <button
                                  onClick={ () => handleUpdateStatus(project) }
                                  className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors"
                                  title="تحديث الحالة"
                                >
                                  <Video className="w-4 h-4" />
                                </button>
                              ) }
                              <Link
                                to={ `/media-management/projects/${project.id}` }
                                className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-lg transition-colors"
                                title="عرض التفاصيل"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    }) }
                  </tbody>
                </table>
              </div>

              {/* Pagination */ }
              { pagination.last_page > 1 && (
                <div className="flex items-center justify-between p-6 border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    عرض { ((pagination.current_page - 1) * pagination.per_page) + 1 } إلى{ ' ' }
                    { Math.min(pagination.current_page * pagination.per_page, pagination.total) } من { pagination.total } مشروع
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={ () => handlePageChange(pagination.current_page - 1) }
                      disabled={ pagination.current_page === 1 }
                      className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="px-4 py-2 text-sm font-medium text-gray-700">
                      صفحة { pagination.current_page } من { pagination.last_page }
                    </span>
                    <button
                      onClick={ () => handlePageChange(pagination.current_page + 1) }
                      disabled={ pagination.current_page === pagination.last_page }
                      className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) }
            </>
          ) }
        </div>

        {/* Update Status Modal */ }
        {
          showUpdateModal && selectedProject && (
            <UpdateStatusModal
              project={ selectedProject }
              onClose={ () => {
                setShowUpdateModal(false);
                setSelectedProject(null);
              } }
              onSuccess={ handleStatusUpdated }
            />
          )
        }

        {/* ✅ Batch Status Update Modal */ }
        { showBatchStatusModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={ { fontFamily: 'Cairo, sans-serif' } }>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">
                  تحديث حالة { selectedProjects.size } مشروع
                </h2>
                <button
                  onClick={ () => setShowBatchStatusModal(false) }
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={ batchLoading }
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-800">
                    سيتم تحديث حالة <strong>{ selectedProjects.size }</strong> مشروع إلى الحالة المختارة
                  </p>
                </div>

                <BatchStatusUpdateForm
                  onSubmit={ handleBatchStatusSubmit }
                  onCancel={ () => setShowBatchStatusModal(false) }
                  loading={ batchLoading }
                  hasInExecutionProjects={ hasInExecutionProjects }
                />
              </div>
            </div>
          </div>
        ) }

        {/* ✅ Batch Assign Modal */ }
        { showBatchAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" style={ { fontFamily: 'Cairo, sans-serif' } }>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  إسناد { selectedProjects.size } مشروع لممنتج
                </h2>
                <button
                  onClick={ () => {
                    setShowBatchAssignModal(false);
                    setSelectedProducerId('');
                  } }
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={ batchLoading }
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-sm text-purple-800">
                    سيتم إسناد <strong>{ selectedProjects.size }</strong> مشروع للممنتج المختار
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اختر الممنتج <span className="text-red-500">*</span>
                  </label>
                  { loadingProducers ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                  ) : (
                    <select
                      value={ selectedProducerId }
                      onChange={ (e) => setSelectedProducerId(e.target.value) }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                      disabled={ batchLoading }
                    >
                      <option value="">اختر ممنتج</option>
                      { producers.map((producer) => (
                        <option key={ producer.id } value={ producer.id }>
                          { producer.name }
                        </option>
                      )) }
                    </select>
                  ) }
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={ () => handleBatchAssignSubmit(selectedProducerId) }
                    disabled={ batchLoading || !selectedProducerId }
                    className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                  >
                    { batchLoading ? 'جاري الإسناد...' : 'تأكيد الإسناد' }
                  </button>
                  <button
                    onClick={ () => {
                      setShowBatchAssignModal(false);
                      setSelectedProducerId('');
                    } }
                    disabled={ batchLoading }
                    className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) }

        {/* ✅ Modal تحديث حالة التنفيذ (تم التنفيذ / تأجيل) - للمشاريع في حالة "قيد التنفيذ" */ }
        { showExecutionStatusModal && selectedProjectForStatusUpdate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" style={ { fontFamily: 'Cairo, sans-serif' } }>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <CheckCircle className="w-5 h-5 ml-2 text-purple-500" />
                  تحديث حالة المشروع
                </h2>
                <button
                  onClick={ () => {
                    setShowExecutionStatusModal(false);
                    setSelectedProjectForStatusUpdate(null);
                    setExecutionStatusAction(null);
                    setPostponementReason('');
                  } }
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  المشروع: <span className="font-semibold text-gray-800">{ selectedProjectForStatusUpdate.project_name || selectedProjectForStatusUpdate.donor_name || 'غير محدد' }</span>
                </p>
                <p className="text-sm text-gray-600">
                  الحالة الحالية: <span className="font-semibold text-purple-600">{ selectedProjectForStatusUpdate.status }</span>
                </p>
              </div>

              { !executionStatusAction ? (
                <div className="space-y-3 mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-3">اختر الإجراء المطلوب:</p>
                  <button
                    onClick={ () => setExecutionStatusAction('completed') }
                    className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    تم التنفيذ
                  </button>
                  <button
                    onClick={ () => setExecutionStatusAction('postpone') }
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
                      onClick={ () => setExecutionStatusAction(null) }
                      disabled={ updatingStatus }
                      className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      رجوع
                    </button>
                    <button
                      onClick={ handleCompleteExecution }
                      disabled={ updatingStatus }
                      className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      { updatingStatus ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                          جاري التحديث...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 ml-2" />
                          تأكيد
                        </>
                      ) }
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
                      value={ postponementReason }
                      onChange={ (e) => setPostponementReason(e.target.value) }
                      placeholder="أدخل سبب تأجيل المشروع..."
                      rows={ 4 }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      يرجى إدخال سبب واضح لتأجيل المشروع
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={ () => {
                        setExecutionStatusAction(null);
                        setPostponementReason('');
                      } }
                      disabled={ isPostponing }
                      className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      رجوع
                    </button>
                    <button
                      onClick={ handlePostponeFromStatusModal }
                      disabled={ isPostponing || !postponementReason.trim() }
                      className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      { isPostponing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                          جاري التأجيل...
                        </>
                      ) : (
                        <>
                          <Pause className="w-4 h-4 ml-2" />
                          تأجيل المشروع
                        </>
                      ) }
                    </button>
                  </div>
                </div>
              ) }
            </div>
          </div>
        ) }

        {/* Assign Producer Modal */ }
        {
          showAssignModal && selectedProject && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-800">
                    { selectedProject.assigned_montage_producer_id ? 'إعادة إسناد مشروع لممنتج' : 'إسناد مشروع لممنتج' }
                  </h2>
                  <button
                    onClick={ () => {
                      setShowAssignModal(false);
                      setSelectedProject(null);
                      setSelectedProducerId('');
                    } }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      المشروع
                    </label>
                    <p className="text-gray-900 font-medium">{ selectedProject.project_name || selectedProject.project_description }</p>
                    <p className="text-sm text-gray-600">كود: { getProjectCode(selectedProject) }</p>
                    {/* ✅ عرض المنتج الحالي إذا كان المشروع مسنداً */ }
                    { selectedProject.assigned_montage_producer_id && (
                      <p className="text-sm text-orange-600 mt-2">
                        المنتج الحالي: {
                          selectedProject.assigned_montage_producer?.name ||
                          selectedProject.montage_producer_name ||
                          selectedProject.montage_producer?.name ||
                          'غير محدد'
                        }
                      </p>
                    ) }
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      { selectedProject.assigned_montage_producer_id ? 'اختر ممنتج جديد' : 'اختر ممنتج' } <span className="text-red-500">*</span>
                    </label>
                    { loadingProducers ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
                      </div>
                    ) : (
                      <select
                        value={ selectedProducerId }
                        onChange={ (e) => setSelectedProducerId(e.target.value) }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                      >
                        <option value="">اختر ممنتج</option>
                        { producers.map((producer) => (
                          <option key={ producer.id } value={ producer.id }>
                            { producer.name }
                          </option>
                        )) }
                      </select>
                    ) }
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={ handleSubmitAssign }
                      disabled={ loadingAssign || !selectedProducerId }
                      className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                    >
                      { loadingAssign ? (selectedProject.assigned_montage_producer_id ? 'جاري إعادة الإسناد...' : 'جاري الإسناد...') : (selectedProject.assigned_montage_producer_id ? 'تأكيد إعادة الإسناد' : 'تأكيد الإسناد') }
                    </button>
                    <button
                      onClick={ () => {
                        setShowAssignModal(false);
                        setSelectedProject(null);
                        setSelectedProducerId('');
                      } }
                      disabled={ loadingAssign }
                      className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
};

export default MediaProjectsList;