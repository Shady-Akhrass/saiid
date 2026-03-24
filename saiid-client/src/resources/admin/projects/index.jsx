import React, { useState, useEffect, useMemo, useRef } from "react";
import apiClient from "../../../utils/axiosConfig";
import { useToast } from "../../../hooks/useToast";
import { useAuth } from "../../../context/AuthContext";
import { useCache } from "../../../hooks/useCache";
import { useCacheInvalidation } from "../../../hooks/useCacheInvalidation";
import SectionPasswordProtection from "../../../components/SectionPasswordProtection";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import * as XLSX from 'xlsx-js-style';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Filter,
    ArrowUpDown,
    Calendar,
    Package,
    Home,
    Edit,
    Trash2,
    Plus,
    CheckCircle,
    XCircle,
    Download,
    X,
    AlertTriangle,
    Users,
    Camera,
    Eye,
    Clock,
} from "lucide-react";
import ProjectsForm from "./ProjectsForm";
import ProjectEditModal from "./ProjectEditModal";
import ProjectDetailsModal from "./ProjectDetailsModal";
import { SelectShelterModal } from "../../project-management/components/ProjectModals";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { getProjectCode } from "../../../utils/helpers";

const Projects = () => {
    const { user } = useAuth();
    const { getData, setCachedData, isCacheValid, initializeCache, clearCache } = useCache('admin_projects', 180000); // 3 دقائق - تحسين الأداء
    const { getData: getReadyProjectsCache, setCachedData: setReadyProjectsCache, isCacheValid: isReadyProjectsCacheValid } = useCache('admin_ready_projects', 60000); // دقيقة واحدة للمشاريع الجاهزة
    const { invalidateProjectsCache } = useCacheInvalidation();
    const abortControllerRef = useRef(null);
    const exportStatusDropdownRef = useRef(null);
    const exportProjectTypeDropdownRef = useRef(null);
    const isMountedRef = useRef(true);

    // ✅ تهيئة الـ cache عند التحميل
    useEffect(() => {
        try {
            if (initializeCache && typeof initializeCache === 'function') {
                initializeCache();
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.warn('⚠️ Error initializing cache:', error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // ✅ تهيئة مرة واحدة فقط عند التحميل

    // ✅ الاستماع إلى أحداث إبطال الكاش
    useEffect(() => {
        const handleCacheInvalidation = (event) => {
            const { cacheKey } = event.detail;

            // ✅ إذا كان cacheKey === 'all' أو يطابق 'admin_projects' أو 'projects'
            if (cacheKey === 'all' ||
                cacheKey === 'admin_projects' ||
                cacheKey === 'projects' ||
                cacheKey === 'project-proposals' ||
                cacheKey === 'project_proposals') {
                // ✅ مسح cache فقط (لا نمسح البيانات من state - ننتظر نجاح الطلب الجديد)
                clearCache();

                // ✅ إطلاق trigger لإعادة التحميل
                // ✅ مهم: البيانات الموجودة في state ستبقى حتى نجاح الطلب الجديد
                setRefreshTrigger(prev => prev + 1);

                if (import.meta.env.DEV) {
                    console.log('✅ Admin projects cache invalidated, fetching fresh data');
                }
            }
        };

        window.addEventListener('cache-invalidated', handleCacheInvalidation);

        return () => {
            window.removeEventListener('cache-invalidated', handleCacheInvalidation);
        };
    }, [clearCache]); // ✅ clearCache فقط في dependencies

    // ✅ إغلاق القوائم المنسدلة للتصدير عند النقر خارجها
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

    // ✅ تحديد دور المستخدم
    const userRole = user?.role?.toLowerCase?.() ||
        user?.userRole?.toLowerCase?.() ||
        user?.user_role?.toLowerCase?.() ||
        user?.role_name?.toLowerCase?.() ||
        user?.role || '';

    // ✅ التحقق من دور منسق المشاريع (جميع الصيغ المحتملة) - استخدام useMemo
    const isProjectCoordinator = useMemo(() => {
        const role = user?.role?.toLowerCase?.() ||
            user?.userRole?.toLowerCase?.() ||
            user?.user_role?.toLowerCase?.() ||
            user?.role_name?.toLowerCase?.() ||
            user?.role || '';

        const isCoordinator =
            role === 'project_coordinator' ||
            role === 'projectcoordinator' ||
            role === 'منسق المشاريع' ||
            role === 'منسق مشاريع' ||
            role === 'executed_projects_coordinator' ||
            role === 'executedprojectscoordinator' ||
            role === 'منسق مشاريع منفذة' ||
            role.includes('coordinator') ||
            role.includes('منسق');


        return isCoordinator;
    }, [user?.role, user?.userRole, user?.user_role, user?.role_name]);
    const [projects, setProjects] = useState([]);
    const [readyForExecutionProjects, setReadyForExecutionProjects] = useState([]);
    const [loadingReadyProjects, setLoadingReadyProjects] = useState(false);
    const [isAlertsCollapsed, setIsAlertsCollapsed] = useState(false); // ✅ حالة تصغير/تكبير قائمة التنبيهات
    const [searchQuery, setSearchQuery] = useState("");
    const [perPage, setPerPage] = useState(10); // ✅ عدد السجلات في كل صفحة في الجدول (يمكن تغييره من القائمة أسفل الجدول)
    const [currentPage, setCurrentPage] = useState(1);
    const [totalProjects, setTotalProjects] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // ✅ trigger لإعادة التحميل عند إبطال الكاش
    const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
    const { success, error: showError } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [hoveredRow, setHoveredRow] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [viewingProject, setViewingProject] = useState(null);
    const [deletingProject, setDeletingProject] = useState(null);
    const [projectToDelete, setProjectToDelete] = useState(null); // ✅ المشروع المراد حذفه
    const [isDownloading, setIsDownloading] = useState(false);
    const [selectShelterModalOpen, setSelectShelterModalOpen] = useState(false);
    const [selectedProjectForShelter, setSelectedProjectForShelter] = useState(null);

    // Filter states for table
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [filters, setFilters] = useState({
        status: "",
        startDate: "",
        endDate: "",
        subProjectsOnly: false, // ✅ إظهار المشاريع الفرعية فقط (لـ مدير المشاريع)
    });

    // Export filter states
    const [isExportFilterModalOpen, setIsExportFilterModalOpen] = useState(false);
    const [showExportStatusDropdown, setShowExportStatusDropdown] = useState(false);
    const [showExportProjectTypeDropdown, setShowExportProjectTypeDropdown] = useState(false);
    const [exportFilters, setExportFilters] = useState({
        status: [], // ✅ مصفوفة لدعم الاختيار المتعدد
        project_type: [], // ✅ مصفوفة لفلترة نوع المشروع عند التصدير
        startDate: "",
        endDate: "",
    });

    // يتم استخدام VITE_API_URL من ملف .env.local للتطوير المحلي
    const API_BASE = import.meta.env.VITE_API_URL || "https://forms-api.saiid.org/api";

    // وضع الاختبار - اضبط هذا إلى false عندما يكون Backend جاهز
    const TEST_MODE = false; // ضع true للاختبار بدون Backend

    const formatDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toISOString().split("T")[0];
    };

    // ✅ دالة لحساب الأيام المتبقية للتنفيذ
    const calculateRemainingDays = (project) => {
        // ✅ إذا كان المشروع منتهي، إيقاف العداد
        if (project?.status === 'منتهي') {
            return { label: '✓ منتهي', isOverdue: false, isFinished: true };
        }

        // ✅ في جدول المشاريع المنفذة، نحسب الأيام المتبقية بناءً على execution_date
        if (!project?.execution_date) {
            return { label: 'غير محدد', isOverdue: false, isFinished: false };
        }

        // ✅ حساب الأيام المتبقية من اليوم حتى تاريخ التنفيذ
        const executionDate = new Date(project.execution_date);
        if (Number.isNaN(executionDate.getTime())) {
            return { label: 'غير محدد', isOverdue: false, isFinished: false };
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0); // ✅ إزالة الوقت من اليوم الحالي
        executionDate.setHours(0, 0, 0, 0); // ✅ إزالة الوقت من تاريخ التنفيذ

        const diffInMs = executionDate.getTime() - now.getTime();
        const remaining = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

        // ✅ إذا كانت الأيام المتبقية سالبة، المشروع متجاوز
        if (remaining < 0) {
            return { label: `متجاوز بـ ${Math.abs(remaining)} يوم`, isOverdue: true, isFinished: false };
        }

        // ✅ إذا كانت الأيام المتبقية صفر، المشروع اليوم
        if (remaining === 0) {
            return { label: 'اليوم', isOverdue: false, isFinished: false };
        }

        return { label: `${remaining} يوم`, isOverdue: false, isFinished: false };
    };

    // ✅ دالة مساعدة: تحديد ما إذا كان المشروع من نوع \"كفالة أيتام\"
    const isKafalaProject = (project) => {
        if (!project) return false;

        // نفس منطق isOrphanSponsorshipProject في ProjectModals
        const projectType = typeof project.project_type === 'object' && project.project_type !== null
            ? (project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '')
            : (project.project_type || '');

        if (projectType !== 'الكفالات') return false;

        const subcategory = project.subcategory || {};
        const subcategoryNameAr = subcategory.name_ar || '';
        const subcategoryName = subcategory.name || '';

        return subcategoryNameAr === 'كفالة أيتام' || subcategoryName === 'Orphan Sponsorship';
    };

    const fetchProjects = async () => {
        let loadingTimeout;

        try {
            // ✅ التحقق من Cache أولاً
            const filtersKey = JSON.stringify({ searchQuery });
            if (isCacheValid(filtersKey)) {
                const cachedData = getData();
                if (cachedData) {
                    setProjects(cachedData.projects || cachedData);
                    setTotalProjects(cachedData.totalProjects || cachedData.length || 0);
                    setTotalPages(cachedData.totalPages || Math.ceil((cachedData.totalProjects || cachedData.length) / perPage) || 0);
                    setIsLoading(false);
                    if (import.meta.env.DEV) {
                        console.log('✅ Using cached admin projects data:', {
                            projects_count: (cachedData.projects || cachedData).length || 0
                        });
                    }
                    return;
                }
            }

            // ✅ عدم إلغاء الطلب السابق يدوياً هنا لتجنّب إلغاء جميع الطلبات في وضع التطوير (React Strict Mode)
            // ✅ نكتفي بأن آخر استجابة هي التي تحدّث الحالة

            // ✅ إنشاء AbortController جديد (للاستخدام عند إلغاء المكوّن تماماً فقط)
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            // ✅ Debug: تأكيد بدء الطلب
            if (import.meta.env.DEV) {
                console.log('🟢 Starting new request to /projects');
            }

            setIsLoading(true);

            // ✅ timeout ديناميكي: أطول في الإنتاج بسبب network latency
            const timeoutDuration = import.meta.env.PROD ? 30000 : 15000; // 30 ثانية في الإنتاج، 15 ثانية في التطوير

            // ✅ جلب المشاريع من جدول projects (بما في ذلك "مكتمل" و "غير مكتمل")
            // ❗ مهم: لا نحمّل أكثر من 200 سجل في الطلب الواحد لتقليل الضغط على الشبكة والـ Backend
            const params = {
                searchQuery,
                perPage: 200,
                page: 1,
            };

            // ✅ Debug: قبل الطلب
            if (import.meta.env.DEV) {
                console.log('📡 Fetching from /projects with params:', params);
            }

            let response;
            try {
                if (import.meta.env.DEV) {
                    console.log('⏳ Awaiting API response...');
                }
                response = await apiClient.get('/projects', {
                    params,
                    timeout: timeoutDuration,
                    signal: abortController.signal
                });
                if (import.meta.env.DEV) {
                    console.log('✅ API response received');
                }
            } catch (requestError) {
                // ✅ عدم طباعة خطأ عند الإلغاء (متوقع في dev مع Strict Mode)
                const isAborted = requestError.name === 'AbortError' || requestError.code === 'ERR_CANCELED' || requestError.isAborted;
                if (import.meta.env.DEV && !isAborted) {
                    console.error('❌ fetchProjects - Request error:', {
                        name: requestError.name,
                        message: requestError.message,
                        code: requestError.code,
                        signalAborted: abortController.signal.aborted
                    });
                }
                throw requestError; // إعادة رمي الخطأ للمعالجة في catch block
            }

            // ✅ إلغاء timeout بعد نجاح الطلب
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }

            // ✅ Debug: عرض الاستجابة
            if (import.meta.env.DEV) {
                console.log('📥 fetchProjects - API Response:', {
                    hasData: !!response?.data,
                    hasSuccess: !!response?.data?.success,
                    hasProjects: !!response?.data?.projects,
                    projectsIsArray: Array.isArray(response?.data?.projects),
                    projectsLength: response?.data?.projects?.length || 0,
                    totalProjects: response?.data?.totalProjects,
                    total: response?.data?.total,
                    responseKeys: response?.data ? Object.keys(response.data) : [],
                    status: response?.status
                });
            }

            if (response.data) {
                let projectsData = [];
                let total = 0;
                let totalPages = 0;

                // ✅ دعم جميع أشكال الاستجابة المحتملة
                if (response.data.success && Array.isArray(response.data.projects)) {
                    // ✅ شكل الاستجابة: {success: true, projects: [...], totalProjects: ...}
                    projectsData = response.data.projects;
                    total = response.data.totalProjects || response.data.total || response.data.projects.length || 0;
                    totalPages = response.data.totalPages || Math.ceil((total || response.data.projects.length) / perPage) || 0;
                } else if (Array.isArray(response.data.projects)) {
                    // ✅ شكل الاستجابة: {projects: [...], totalProjects: ...}
                    projectsData = response.data.projects;
                    total = response.data.totalProjects || response.data.total || response.data.projects.length || 0;
                    totalPages = response.data.totalPages || Math.ceil((total || response.data.projects.length) / perPage) || 0;
                } else if (Array.isArray(response.data.data?.data)) {
                    // ✅ شكل الاستجابة: {data: {data: [...], total: ...}}
                    projectsData = response.data.data.data;
                    total = response.data.data.total || response.data.data.totalProjects || projectsData.length || 0;
                    totalPages = response.data.data.totalPages || Math.ceil((total || projectsData.length) / perPage) || 0;
                } else if (Array.isArray(response.data.data)) {
                    // ✅ شكل الاستجابة: {data: [...], total: ...}
                    projectsData = response.data.data;
                    total = response.data.total || response.data.totalProjects || projectsData.length || 0;
                    totalPages = response.data.totalPages || Math.ceil((total || projectsData.length) / perPage) || 0;
                } else if (Array.isArray(response.data)) {
                    // ✅ شكل الاستجابة: [...] مباشرة
                    projectsData = response.data;
                    total = response.data.length;
                    totalPages = Math.ceil(response.data.length / perPage);
                } else {
                    // ✅ إذا لم تكن البيانات على الشكل المتوقع
                    if (import.meta.env.DEV) {
                        console.warn('⚠️ استجابة غير متوقعة من API:', {
                            responseData: response.data,
                            message: 'البيانات ليست على الشكل المتوقع (projects array أو data array)'
                        });
                    }
                }

                // ✅ Debug: التأكد من وجود بيانات قبل الحفظ
                if (import.meta.env.DEV && projectsData.length === 0) {
                    console.warn('⚠️ fetchProjects - No projects in response data:', {
                        responseData: response.data,
                        projectsDataLength: projectsData.length
                    });
                }

                setProjects(projectsData);
                setTotalProjects(total);
                setTotalPages(totalPages);

                // ✅ حفظ البيانات في cache
                setCachedData({
                    projects: projectsData,
                    totalProjects: total,
                    totalPages: totalPages
                }, { searchQuery });

                // ✅ Debug: تأكيد حفظ البيانات
                if (import.meta.env.DEV) {
                    console.log('✅ fetchProjects - Data saved:', {
                        projects_count: projectsData.length,
                        total: total,
                        cached: true
                    });
                }
            } else {
                if (import.meta.env.DEV) {
                    console.warn('⚠️ fetchProjects - No data in response');
                }
                setProjects([]);
                setTotalProjects(0);
                setTotalPages(0);
            }
        } catch (error) {
            if (loadingTimeout) clearTimeout(loadingTimeout);

            // ✅ تجاهل أخطاء الإلغاء (صامت - لا نطبع أي شيء)
            // ✅ مهم: لا نمسح البيانات عند إلغاء الطلب - نترك البيانات الموجودة
            if (error.name === 'AbortError' ||
                error.code === 'ERR_CANCELED' ||
                error.message === 'canceled' ||
                abortControllerRef.current?.signal.aborted) {
                // ✅ Debug: طلب تم إلغاؤه
                if (import.meta.env.DEV) {
                    console.log('⚠️ fetchProjects - Request aborted, checking cache...');
                }

                // ✅ إذا كانت هناك بيانات في cache، نستخدمها
                const cachedData = getData();
                if (cachedData && (cachedData.projects || cachedData).length > 0) {
                    if (import.meta.env.DEV) {
                        console.log('✅ Using cached data after abort:', {
                            projects_count: (cachedData.projects || cachedData).length || 0
                        });
                    }
                    setProjects(cachedData.projects || cachedData);
                    setTotalProjects(cachedData.totalProjects || cachedData.length || 0);
                    setTotalPages(cachedData.totalPages || Math.ceil((cachedData.totalProjects || cachedData.length) / perPage) || 0);
                } else {
                    // ✅ إذا لم تكن هناك بيانات في cache، نترك البيانات الموجودة في state
                    if (import.meta.env.DEV) {
                        console.log('⚠️ No cached data, keeping existing state');
                    }
                }
                setIsLoading(false);
                return;
            }

            // ✅ عرض الأخطاء الحقيقية فقط
            if (import.meta.env.DEV) {
                console.error('❌ fetchProjects - Error:', {
                    name: error.name,
                    message: error.message,
                    code: error.code,
                    status: error.response?.status,
                    statusText: error.response?.statusText
                });
            }

            // ✅ إذا كان هناك بيانات في cache، استخدمها
            const cachedData = getData();
            if (cachedData) {
                setProjects(cachedData.projects || cachedData);
                setTotalProjects(cachedData.totalProjects || cachedData.length || 0);
                setTotalPages(cachedData.totalPages || Math.ceil((cachedData.totalProjects || cachedData.length) / perPage) || 0);
                setIsLoading(false);
                if (import.meta.env.DEV) {
                    console.log('⚠️ Error fetching projects, using cached data');
                }
                return;
            }

            setProjects([]);
            setTotalProjects(0);
            setTotalPages(0);

            // إذا كان الخطأ 404 أو route not found، لا نعرض toast مزعج
            // لأن الـ Backend قد لا يكون جاهزاً بعد
            if (error.response?.status === 404 ||
                error.message?.includes("could not be found") ||
                error.message?.includes("not found")) {
                // فقط نضبط البيانات الفارغة بدون إشعار مزعج
                setProjects([]);
                setTotalProjects(0);
                setTotalPages(0);
                // نعرض رسالة واحدة فقط في console للتنبيه
                console.warn("API endpoint /projects not found. Backend may not be ready yet.");
            } else {
                // للأخطاء الأخرى (مثل 401, 500, etc) نعرض toast
                showError(error.response?.data?.message || error.userMessage || "خطأ في جلب البيانات، يرجى المحاولة مرة أخرى.");
                setProjects([]);
                setTotalProjects(0);
                setTotalPages(0);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // ✅ تعيين isMountedRef عند mount
        isMountedRef.current = true;

        // ✅ التحقق من cache أولاً قبل جلب البيانات
        const filtersKey = JSON.stringify({ searchQuery });
        if (isCacheValid(filtersKey)) {
            const cachedData = getData();
            if (cachedData) {
                setProjects(cachedData.projects || cachedData);
                setTotalProjects(cachedData.totalProjects || cachedData.length || 0);
                setTotalPages(cachedData.totalPages || Math.ceil((cachedData.totalProjects || cachedData.length) / perPage) || 0);
                setIsLoading(false);
                return;
            }
        }

        // ✅ فقط إذا لم تكن البيانات في cache، اجلبها من API
        fetchProjects().catch((error) => {
            // ✅ تجاهل الأخطاء إذا تم unmount المكون أو تم إلغاء الطلب
            if (!isMountedRef.current) return;
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') return;
            // ✅ معالجة الأخطاء الأخرى
            if (import.meta.env.DEV) {
                console.error('❌ fetchProjects error in useEffect:', error);
            }
        });

        // ✅ تنظيف: تعيين isMountedRef إلى false عند unmount
        // ✅ ملاحظة: لا نلغي الطلب هنا لأن axiosConfig يتعامل مع الطلبات المكررة
        // ✅ والطلب سيتم إلغاؤه تلقائياً عند unmount الحقيقي
        return () => {
            isMountedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, refreshTrigger]); // ✅ إضافة refreshTrigger لإعادة التحميل عند إبطال الكاش

    // جلب المشاريع الجاهزة للتنفيذ من نظام إدارة المشاريع
    const fetchReadyForExecutionProjects = async () => {
        const userRole = user?.role?.toLowerCase?.() ||
            user?.userRole?.toLowerCase?.() ||
            user?.user_role?.toLowerCase?.() ||
            user?.role_name?.toLowerCase?.() ||
            user?.role || '';

        const isExecutedCoordinator = userRole === 'executed_projects_coordinator' ||
            userRole === 'executedprojectscoordinator' ||
            userRole === 'منسق مشاريع منفذة';

        // جلب المشاريع الجاهزة للتنفيذ فقط للمنسق
        if (!isExecutedCoordinator) {
            setReadyForExecutionProjects([]);
            return;
        }

        try {
            // ✅ التحقق من Cache أولاً
            if (isReadyProjectsCacheValid()) {
                const cachedData = getReadyProjectsCache();
                if (cachedData && Array.isArray(cachedData)) {
                    setReadyForExecutionProjects(cachedData);
                    setLoadingReadyProjects(false);
                    return;
                }
            }

            setLoadingReadyProjects(true);
            const requestParams = {
                status: 'جاهز للتنفيذ',
                perPage: 100,
                page: 1,
                include_non_divided: true, // ✅ تضمين المشاريع غير المقسمة
                include_daily_phases: true, // ✅ تضمين المشاريع اليومية
            };

            const response = await apiClient.get('/project-proposals', {
                params: requestParams,
            });

            if (response.data.success) {
                const projectsData = response.data.projects || response.data.data?.data || response.data.data || [];

                // ✅ جلب المشاريع المنفذة للتحقق من source_project_id
                let executedProjectsSourceIds = [];
                try {
                    const executedResponse = await apiClient.get('/projects', {
                        params: {
                            perPage: 100, // ✅ تقليل من 1000 إلى 100 لتحسين الأداء
                            page: 1,
                        },
                    });

                    if (executedResponse.data.success) {
                        const executedProjects =
                            executedResponse.data.projects ||
                            executedResponse.data.data?.data ||
                            executedResponse.data.data ||
                            [];

                        // ✅ استخراج source_project_id من المشاريع المنفذة
                        executedProjectsSourceIds = executedProjects
                            .map(p => p.source_project_id)
                            .filter(id => id !== null && id !== undefined && id !== '');

                        if (import.meta.env.DEV) {
                            console.log('📋 Executed projects source IDs:', executedProjectsSourceIds);
                        }
                    }
                } catch (error) {
                    // تجاهل الأخطاء في جلب المشاريع المنفذة
                    if (import.meta.env.DEV) {
                        console.warn('⚠️ Failed to fetch executed projects for filtering:', error.message);
                    }
                }

                // ✅ عرض جميع المشاريع: غير المقسمة + المقسمة + اليومية
                // ✅ إظهار جميع المشاريع بحالة "جاهز للتنفيذ" حتى لو تم تنفيذها سابقاً (للسماح بإضافة مشروع منفذ جديد)
                const filteredProjects = projectsData.map((project) => {
                    const projectId = project.id || project._id;
                    const status = project.status || '';

                    // ✅ تحديد إذا كان المشروع تم تنفيذه سابقاً
                    const isAlreadyExecuted = executedProjectsSourceIds.includes(projectId) ||
                        executedProjectsSourceIds.includes(String(projectId)) ||
                        executedProjectsSourceIds.includes(Number(projectId));

                    // ✅ إضافة علامة للمشاريع التي تم تنفيذها سابقاً
                    return {
                        ...project,
                        __isAlreadyExecuted: isAlreadyExecuted
                    };
                }).filter((project) => {
                    const status = project.status || '';

                    // ✅ القائمة تحتوي فقط على المشاريع في حالة "جاهز للتنفيذ"
                    // ✅ استبعاد جميع الحالات الأخرى
                    if (status !== 'جاهز للتنفيذ') {
                        return false;
                    }

                    // ✅ منسق المشاريع: إخفاء جميع مشاريع الكفالات من هذه القائمة
                    if (isProjectCoordinator && isKafalaProject(project)) {
                        return false;
                    }

                    return true;
                });

                setReadyForExecutionProjects(filteredProjects);

                // ✅ حفظ البيانات في cache
                setReadyProjectsCache(filteredProjects);
            } else {
                console.warn('⚠️ API returned success: false', response.data);
                setReadyForExecutionProjects([]);
            }
        } catch (error) {
            console.error('Error fetching ready for execution projects:', error);
            // لا نعرض خطأ إذا كان الـ endpoint غير موجود
            if (error.response?.status !== 404) {
                console.warn('Could not fetch ready for execution projects');
            }
            setReadyForExecutionProjects([]);
        } finally {
            setLoadingReadyProjects(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchReadyForExecutionProjects();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const requestSort = (key) => {
        let direction = "ascending";
        if (sortConfig.key === key && sortConfig.direction === "ascending") {
            direction = "descending";
        }
        setSortConfig({ key, direction });
    };

    // Apply frontend filters
    const filteredProjects = useMemo(() => {
        let filtered = [...projects];

        // ✅ إخفاء الكفالات لمنسق المشاريع يكون فقط في قائمة "المشاريع الجاهزة للتنفيذ" وليس في الجدول الرئيسي

        // ✅ Debug: عرض معلومات الفلترة
        if (import.meta.env.DEV) {
            console.log('🔍 Frontend filtering:', {
                total_projects: projects.length,
                filters: filters,
                before_filtering: filtered.length
            });
        }

        // Filter by status
        if (filters.status && filters.status !== 'الكل') {
            filtered = filtered.filter(project => project.status === filters.status);
        }

        // Filter only sub-projects (phases) - for project manager
        if (filters.subProjectsOnly) {
            filtered = filtered.filter(project => {
                const isDailyPhase = project.is_daily_phase || project.isDailyPhase || false;
                const hasParent =
                    !!project.parent_project ||
                    !!project.parentProject ||
                    !!project.parent_project_id ||
                    !!project.parentProjectId;
                return isDailyPhase || hasParent;
            });
        }

        // Filter by date range
        if (filters.startDate || filters.endDate) {
            filtered = filtered.filter(project => {
                if (!project.execution_date) return false;

                const projectDate = new Date(project.execution_date);

                if (filters.startDate && filters.endDate) {
                    const start = new Date(filters.startDate);
                    const end = new Date(filters.endDate);
                    return projectDate >= start && projectDate <= end;
                } else if (filters.startDate) {
                    const start = new Date(filters.startDate);
                    return projectDate >= start;
                } else if (filters.endDate) {
                    const end = new Date(filters.endDate);
                    return projectDate <= end;
                }

                return true;
            });
        }

        // ✅ Debug: عرض نتائج الفلترة
        if (import.meta.env.DEV) {
            console.log('🔍 Frontend filtering result:', {
                after_filtering: filtered.length,
                status_filter_applied: !!filters.status && filters.status !== 'الكل',
                date_filter_applied: !!(filters.startDate || filters.endDate)
            });
        }

        return filtered;
    }, [projects, filters]);

    const sortedProjects = useMemo(() => {
        if (!sortConfig.key) return filteredProjects;
        return [...filteredProjects].sort((a, b) => {
            const aValue = sortConfig.key.split(".").reduce((o, i) => (o ? o[i] : undefined), a);
            const bValue = sortConfig.key.split(".").reduce((o, i) => (o ? o[i] : undefined), b);
            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;
            if (aValue < bValue) return sortConfig.direction === "ascending" ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === "ascending" ? 1 : -1;
            return 0;
        });
    }, [filteredProjects, sortConfig]);

    // Client-side pagination
    const paginatedProjects = useMemo(() => {
        const startIndex = (currentPage - 1) * perPage;
        const endIndex = startIndex + perPage;
        return sortedProjects.slice(startIndex, endIndex);
    }, [sortedProjects, currentPage, perPage]);

    // ✅ Reset to first page when filters change (لا نحدث totalProjects - نستخدم القيمة من API)
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredProjects.length]); // ✅ فقط عند تغيير عدد المشاريع المفلترة

    const markSourceProjectAsExecuting = async (projectId) => {
        if (!projectId) return;

        try {
            // حاول نقل المشروع إلى مرحلة التنفيذ عبر الـ Backend
            const transferResponse = await apiClient.post(`/project-proposals/${projectId}/transfer-to-execution`);

            if (transferResponse?.data?.success === false) {
                throw new Error(transferResponse.data.message || 'فشل في تحديث حالة المشروع');
            }

            console.log('✅ تم تحديث حالة المشروع المصدر إلى "قيد التنفيذ" بنجاح');
        } catch (transferError) {
            console.warn('⚠️ transfer-to-execution failed, fallback to patch', transferError);

            // التحقق من نوع الخطأ
            if (transferError.response?.status === 403 || transferError.isPermissionError) {
                console.info('ℹ️ ليس لديك صلاحيات لتحديث المشروع من الـ Frontend.');
                console.info('ℹ️ تم إرسال source_project_id للـ Backend. سيتم تحديث الحالة تلقائياً عند معالجة الطلب.');
                // لا نحاول تحديث الحالة يدوياً إذا كانت المشكلة في الصلاحيات
                return;
            }

            // معالجة خطأ 422 (Unprocessable Content)
            if (transferError.response?.status === 422) {
                console.info('ℹ️ endpoint transfer-to-execution غير متاح أو يحتاج معاملات إضافية.');
                console.info('ℹ️ سيتم محاولة تحديث الحالة مباشرة عبر PATCH.');
            }

            try {
                // في حال فشل endpoint السابق، نسقط إلى تحديث الحالة يدوياً إلى "قيد التنفيذ"
                const patchResponse = await apiClient.patch(`/project-proposals/${projectId}`, {
                    status: 'قيد التنفيذ',
                });

                if (patchResponse?.data?.success === false) {
                    throw new Error(patchResponse.data.message || 'فشل في تحديث حالة المشروع');
                }

                console.log('✅ تم تحديث حالة المشروع المصدر إلى "قيد التنفيذ" بنجاح');
            } catch (patchError) {
                console.error('❌ Error updating source project status:', patchError);

                // التحقق من نوع الخطأ
                if (patchError.response?.status === 403 || patchError.isPermissionError) {
                    console.info('ℹ️ ليس لديك صلاحيات لتحديث المشروع من الـ Frontend.');
                    console.info('ℹ️ تم إرسال source_project_id للـ Backend مع بيانات المشروع المنفذ.');
                    console.info('ℹ️ يجب على الـ Backend تحديث حالة المشروع المصدر تلقائياً عند استلام source_project_id.');
                    // لا نعرض خطأ للمستخدم لأن المشروع تم إضافته بنجاح
                    return;
                }

                // لا نعرض خطأ للمستخدم لأن المشروع تم إضافته بنجاح
                // فقط نطبع تحذير في console
                console.warn('⚠️ تم إضافة المشروع للمشاريع المنفذة لكن فشل تحديث حالة المشروع المصدر:', patchError.response?.data?.message || patchError.message);
            }
        } finally {
            // تأكد من إعادة جلب القائمة من الـ Backend لمزامنة الحالات
            fetchReadyForExecutionProjects();
        }
    };

    const handleCreateProject = async (formData) => {
        setIsSubmitting(true);

        // وضع الاختبار - للاختبار بدون Backend
        if (TEST_MODE) {
            const mockProject = {
                id: Date.now(),
                ...formData,
                shelter: {
                    name: "مخيم تجريبي",
                    governorate: formData.shelter_id ? "غزة" : "غير محدد",
                    district: formData.shelter_id ? "حي الشجاعية" : "غير محدد"
                },
                created_at: new Date().toISOString()
            };

            invalidateProjectsCache(); // ✅ إبطال كاش المشاريع
            setProjects(prev => [mockProject, ...prev]);
            setTotalProjects(prev => prev + 1);
            setTotalPages(prev => Math.ceil((totalProjects + 1) / perPage));
            setToast({
                message: "تم إضافة المشروع (وضع الاختبار - البيانات غير محفوظة في الخادم)",
                type: "success",
                isVisible: true,
            });
            setShowForm(false);
            setIsSubmitting(false);
            return;
        }

        try {
            // ✅ التحقق من البيانات المطلوبة قبل الإرسال
            if (!formData.project_name || !formData.aid_type || !formData.quantity || !formData.shelter_id || !formData.execution_date) {
                const missingFields = [];
                if (!formData.project_name) missingFields.push('اسم المشروع');
                if (!formData.aid_type) missingFields.push('نوع المساعدة');
                if (!formData.quantity) missingFields.push('الكمية');
                if (!formData.shelter_id) missingFields.push('المخيم');
                if (!formData.execution_date) missingFields.push('تاريخ التنفيذ');

                showError(`الرجاء إكمال جميع الحقول المطلوبة: ${missingFields.join(', ')}`);
                setIsSubmitting(false);
                return;
            }

            // ✅ تحويل البيانات إلى الأنواع الصحيحة
            const projectData = {
                project_name: String(formData.project_name).trim(),
                aid_type: String(formData.aid_type).trim(),
                quantity: parseInt(formData.quantity, 10) || 0,
                shelter_id: parseInt(formData.shelter_id, 10) || null,
                execution_date: String(formData.execution_date).trim(),
                status: String(formData.status || 'غير مكتمل').trim(),
                source_project_id: formData.source_project_id ? parseInt(formData.source_project_id, 10) : null,
            };

            // ✅ التحقق من صحة البيانات بعد التحويل
            if (projectData.quantity <= 0) {
                showError('الكمية يجب أن تكون أكبر من صفر');
                setIsSubmitting(false);
                return;
            }

            if (!projectData.shelter_id) {
                showError('الرجاء اختيار المخيم');
                setIsSubmitting(false);
                return;
            }

            // 🔍 Debug: عرض البيانات المرسلة
            if (import.meta.env.DEV) {
                console.log('📤 إرسال بيانات المشروع:', {
                    source_project_id: projectData.source_project_id,
                    project_name: projectData.project_name,
                    aid_type: projectData.aid_type,
                    quantity: projectData.quantity,
                    shelter_id: projectData.shelter_id,
                    execution_date: projectData.execution_date,
                    status: projectData.status,
                });
                console.log('📦 Payload الكامل المرسل للـ Backend:', JSON.stringify(projectData, null, 2));
            }

            const response = await apiClient.post('/projects', projectData);

            // ✅ التحقق من أن source_project_id تم إرساله بنجاح
            if (formData.source_project_id && response.data) {
                console.log('✅ تم إرسال source_project_id بنجاح. الـ Backend يجب أن يقوم بتحديث حالة المشروع المصدر تلقائياً.');
            }

            // ✅ إبطال كاش المشاريع عند إنشاء مشروع جديد
            invalidateProjectsCache();

            // ✅ رسالة نجاح مع معلومات إضافية إذا كان المشروع مستورداً
            if (formData.source_project_id) {
                success("تم إنشاء المشروع بنجاح. سيتم تحديث حالة المشروع المصدر تلقائياً.");
            } else {
                success("تم إنشاء المشروع بنجاح");
            }

            // إذا كان المشروع مستورداً من مشروع جاهز للتنفيذ، تحديث حالته وإزالته من التنبيه
            if (formData.source_project_id) {
                // ✅ إزالة المشروع من قائمة التنبيهات فوراً (قبل محاولة التحديث)
                setReadyForExecutionProjects(prev =>
                    prev.filter(project => {
                        const projectId = project.id || project._id;
                        const sourceId = formData.source_project_id;
                        return projectId !== sourceId && String(projectId) !== String(sourceId);
                    })
                );

                // ✅ إعادة جلب قائمة المشاريع الجاهزة للتنفيذ من الـ API للتأكد من التحديث
                // ننتظر قليلاً لضمان أن الـ Backend قام بتحديث الحالة
                setTimeout(() => {
                    fetchReadyForExecutionProjects();
                }, 1000);

                // محاولة تحديث الحالة (حتى لو فشل، المشروع تم إضافته بنجاح)
                // ملاحظة: تحديث الحالة يجب أن يتم في الـ Backend عند استلام source_project_id
                markSourceProjectAsExecuting(formData.source_project_id).catch(error => {
                    console.warn('⚠️ فشل تحديث حالة المشروع المصدر من الـ Frontend:', error);
                    console.info('ℹ️ سيتم تحديث الحالة تلقائياً في الـ Backend عند استلام source_project_id');
                });
            }

            setShowForm(false);
            fetchProjects();
        } catch (error) {
            console.error("Error creating project:", error);

            let errorMessage = "حدث خطأ أثناء إنشاء المشروع";

            // ✅ معالجة الأخطاء المختلفة مع تفاصيل أكثر
            if (error.response?.status === 404 ||
                error.message?.includes("could not be found") ||
                error.message?.includes("not found")) {
                errorMessage = "الـ API endpoint غير متاح حالياً. يرجى التأكد من أن الـ Backend جاهز وأن endpoint /api/projects موجود.";
            } else if (error.response?.status === 422) {
                // ✅ خطأ في التحقق من البيانات - عرض تفاصيل الأخطاء
                const validationErrors = error.response.data?.errors || {};
                const errorMessages = Object.values(validationErrors).flat();
                errorMessage = errorMessages.length > 0
                    ? errorMessages.join(', ')
                    : error.response.data?.message || error.response.data?.error || "البيانات المدخلة غير صحيحة";
            } else if (error.response?.status === 401) {
                errorMessage = "غير مصرح لك. يرجى تسجيل الدخول مرة أخرى.";
            } else if (error.response?.status === 400) {
                // ✅ خطأ 400 - عرض رسالة الخطأ من Backend مع تفاصيل
                const backendMessage = error.response.data?.message || error.response.data?.error;
                const validationErrors = error.response.data?.errors || {};
                const errorMessages = Object.values(validationErrors).flat();

                if (errorMessages.length > 0) {
                    errorMessage = errorMessages.join(', ');
                } else if (backendMessage) {
                    errorMessage = backendMessage;
                } else {
                    errorMessage = "البيانات المدخلة غير صحيحة. يرجى التحقق من جميع الحقول المطلوبة.";
                }

                // ✅ عرض تفاصيل الخطأ في console للتحقق
                if (import.meta.env.DEV) {
                    console.error('❌ Error 400 Details:', {
                        message: error.response.data?.message,
                        error: error.response.data?.error,
                        errors: error.response.data?.errors,
                        fullResponse: error.response.data,
                        sentData: projectData,
                    });
                }
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            showError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateProject = (updatedProjectData) => {
        // ✅ إغلاق نافذة التعديل فوراً
        setEditingProject(null);

        // ✅ إبطال كاش المشاريع عند التعديل
        invalidateProjectsCache();

        // ✅ تحديث المشروع في القائمة مباشرة إذا كانت البيانات متوفرة
        if (updatedProjectData?.project || updatedProjectData?.data) {
            const updatedProject = updatedProjectData.project || updatedProjectData.data;
            setProjects(prevProjects =>
                prevProjects.map(p =>
                    (p.id === updatedProject.id || p._id === updatedProject.id)
                        ? { ...p, ...updatedProject }
                        : p
                )
            );
        }

        // ✅ إعادة جلب المشاريع بشكل غير متزامن في الخلفية (بعد إغلاق النافذة)
        setTimeout(() => {
            fetchProjects();
        }, 300);
    };

    const handleDeleteClick = (project) => {
        // ✅ فتح modal التأكيد
        setProjectToDelete(project);
    };

    const handleDeleteConfirm = async () => {
        if (!projectToDelete) return;

        const projectId = projectToDelete.id || projectToDelete._id;
        setDeletingProject(projectId);

        try {
            await apiClient.delete(`/projects/${projectId}`);

            success("تم حذف المشروع بنجاح");

            // ✅ إبطال كاش المشاريع (سيتم إعلام جميع المكونات تلقائياً)
            invalidateProjectsCache();

            // ✅ إزالة المشروع المحذوف من القائمة مباشرة (تحسين UX)
            setProjects(prevProjects =>
                prevProjects.filter(p => (p.id || p._id) !== projectId)
            );

            // ✅ تحديث العدد الإجمالي
            setTotalProjects(prev => Math.max(0, prev - 1));

            // ✅ إعادة جلب البيانات من API للتأكد من التزامن
            fetchProjects();

            // ✅ إغلاق modal التأكيد
            setProjectToDelete(null);
        } catch (error) {
            console.error("Error deleting project:", error);

            // ✅ معالجة الأخطاء المختلفة
            if (error.response?.status === 403) {
                showError("ليس لديك صلاحيات لحذف هذا المشروع");
            } else if (error.response?.status === 404) {
                showError("المشروع غير موجود");
            } else if (error.response?.data?.message) {
                showError(error.response.data.message);
            } else {
                showError("حدث خطأ أثناء حذف المشروع");
            }
        } finally {
            setDeletingProject(null);
        }
    };

    const handleDeleteCancel = () => {
        setProjectToDelete(null);
    };

    const handleDownloadExcel = () => {
        // Open export filter modal instead of downloading directly
        setIsExportFilterModalOpen(true);
    };

    const handleConfirmExport = async () => {
        if (isDownloading) return;

        setIsDownloading(true);

        try {
            // ✅ 1) جلب كل المشاريع من الـ API (ليس فقط الصفحة الحالية)
            let allProjects = [];

            const expectedTotal = totalProjects || projects.length || 0;
            const perPageForExport = 200; // حجم الصفحة أثناء التصدير
            const maxPages = 500; // حد أمان

            let currentPage = 1;
            let totalPagesFromApi = null;

            while (currentPage <= (totalPagesFromApi || maxPages)) {
                const response = await apiClient.get('/projects', {
                    params: {
                        searchQuery,
                        perPage: perPageForExport,
                        page: currentPage,
                    },
                    timeout: 30000,
                    skipDeduplication: true,
                });

                let pageProjects = [];
                const d = response.data;

                if (Array.isArray(d?.projects)) {
                    pageProjects = d.projects;
                } else if (Array.isArray(d?.data?.data)) {
                    pageProjects = d.data.data;
                } else if (Array.isArray(d?.data)) {
                    pageProjects = d.data;
                } else if (Array.isArray(d)) {
                    pageProjects = d;
                }

                if (!pageProjects.length) break;

                allProjects = allProjects.concat(pageProjects);

                const totalFromApi =
                    d.totalProjects ||
                    d.total ||
                    d?.data?.total ||
                    expectedTotal ||
                    allProjects.length;

                if (!totalPagesFromApi) {
                    const pageSize = pageProjects.length || perPageForExport;
                    totalPagesFromApi = Math.ceil(totalFromApi / pageSize);
                }

                if (allProjects.length >= totalFromApi) break;

                currentPage += 1;
            }

            if (import.meta.env.DEV) {
                console.log('📥 Export - loaded projects count:', {
                    expectedTotal,
                    loaded: allProjects.length,
                });
            }

            // ✅ 2) تطبيق فلاتر التصدير على كل المشاريع
            let dataToExport = [...allProjects];

            // Filter by status (multiple)
            if (exportFilters.status && Array.isArray(exportFilters.status) && exportFilters.status.length > 0) {
                dataToExport = dataToExport.filter(project => exportFilters.status.includes(project.status));
            }

            // Filter by project type (نوع المشروع)
            if (exportFilters.project_type && Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0) {
                dataToExport = dataToExport.filter(project => {
                    const typeName = !project.project_type ? ''
                        : (typeof project.project_type === 'object' && project.project_type !== null)
                            ? (project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '')
                            : String(project.project_type);
                    return typeName && exportFilters.project_type.includes(typeName);
                });
            }

            // Filter by date range
            if (exportFilters.startDate || exportFilters.endDate) {
                dataToExport = dataToExport.filter(project => {
                    if (!project.execution_date) return false;

                    const projectDate = new Date(project.execution_date);

                    if (exportFilters.startDate && exportFilters.endDate) {
                        const start = new Date(exportFilters.startDate);
                        const end = new Date(exportFilters.endDate);
                        return projectDate >= start && projectDate <= end;
                    } else if (exportFilters.startDate) {
                        const start = new Date(exportFilters.startDate);
                        return projectDate >= start;
                    } else if (exportFilters.endDate) {
                        const end = new Date(exportFilters.endDate);
                        return projectDate <= end;
                    }

                    return true;
                });
            }

            // Log the filters being applied
            console.log("🔍 فلاتر التصدير:", {
                status: Array.isArray(exportFilters.status) && exportFilters.status.length > 0 ? exportFilters.status.join(', ') : 'الكل',
                project_type: Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0 ? exportFilters.project_type.join(', ') : 'الكل',
                startDate: exportFilters.startDate || 'غير محدد',
                endDate: exportFilters.endDate || 'غير محدد',
                عدد_المشاريع_المصدرة: dataToExport.length
            });

            // Show message about which filters are applied
            const hasExportFilters = (exportFilters.status && Array.isArray(exportFilters.status) && exportFilters.status.length > 0)
                || (exportFilters.project_type && Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0)
                || exportFilters.startDate || exportFilters.endDate;
            if (hasExportFilters) {
                toast.info(`جاري تصدير ${dataToExport.length} مشروع مع الفلاتر المحددة...`, { autoClose: 2000 });
            } else {
                toast.info(`جاري تصدير جميع المشاريع (${dataToExport.length} مشروع)...`, { autoClose: 2000 });
            }

            // Prepare data for Excel
            const excelData = dataToExport.map(project => ({
                'اسم المشروع': project.project_name || '-',
                'نوع المساعدة': project.aid_type || '-',
                'الكمية': project.quantity || '-',
                'اسم المخيم': project.shelter?.camp_name || project.shelter?.name || '-',
                'العنوان': project.shelter?.governorate && project.shelter?.district
                    ? `${project.shelter.governorate} - ${project.shelter.district}`
                    : project.shelter?.detailed_address || '-',
                'تاريخ التنفيذ': project.execution_date
                    ? new Date(project.execution_date).toISOString().split('T')[0]
                    : '-',
                'الحالة': project.status || '-'
            }));

            // Create worksheet
            const worksheet = XLSX.utils.json_to_sheet(excelData);

            // Get the range of the worksheet
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

            // Define header style (colored background, bold text, white text)
            const headerStyle = {
                fill: {
                    fgColor: { rgb: "4472C4" }, // Blue color
                    patternType: "solid"
                },
                font: {
                    bold: true,
                    color: { rgb: "FFFFFF" }, // White text
                    sz: 12,
                    name: "Cairo" // استخدام خط Cairo
                },
                alignment: {
                    horizontal: "right", // RTL alignment
                    vertical: "center",
                    wrapText: true,
                    readingOrder: 2 // RTL reading order (2 = right-to-left)
                },
                border: {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } }
                }
            };

            // Apply header style to first row
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                if (!worksheet[cellAddress]) {
                    // Create cell if it doesn't exist
                    worksheet[cellAddress] = { t: 's', v: '' };
                }
                worksheet[cellAddress].s = headerStyle;
            }

            // Apply alternating row colors to data rows
            for (let row = range.s.r + 1; row <= range.e.r; row++) {
                const isEvenRow = row % 2 === 0;
                const rowStyle = {
                    fill: {
                        fgColor: { rgb: isEvenRow ? "E7E6F2" : "FFFFFF" }, // Light blue for even rows, white for odd
                        patternType: "solid"
                    },
                    alignment: {
                        horizontal: "right", // RTL alignment
                        vertical: "center",
                        wrapText: true,
                        readingOrder: 2 // RTL reading order (2 = right-to-left)
                    },
                    font: {
                        name: "Cairo" // استخدام خط Cairo
                    },
                    border: {
                        top: { style: "thin", color: { rgb: "D0D0D0" } },
                        bottom: { style: "thin", color: { rgb: "D0D0D0" } },
                        left: { style: "thin", color: { rgb: "D0D0D0" } },
                        right: { style: "thin", color: { rgb: "D0D0D0" } }
                    }
                };

                for (let col = range.s.c; col <= range.e.c; col++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                    if (!worksheet[cellAddress]) continue;
                    // Apply style directly
                    worksheet[cellAddress].s = rowStyle;
                }
            }

            // Set column widths
            worksheet['!cols'] = [
                { wch: 30 }, // اسم المشروع
                { wch: 25 }, // نوع المساعدة
                { wch: 15 }, // الكمية
                { wch: 30 }, // اسم المخيم
                { wch: 35 }, // العنوان
                { wch: 20 }, // تاريخ التنفيذ
                { wch: 15 }  // الحالة
            ];

            // Set RTL direction for the sheet
            if (!worksheet['!views']) {
                worksheet['!views'] = [];
            }
            worksheet['!views'][0] = {
                rightToLeft: true, // RTL direction
                showGridLines: true
            };

            // Create workbook
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'المشاريع المنفذة');

            // Create filename with filters info
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            let filename = `المشاريع_المنفذة_${dateStr}`;

            if (exportFilters.status && Array.isArray(exportFilters.status) && exportFilters.status.length > 0) {
                filename += `_${exportFilters.status.join('_')}`;
            }
            if (exportFilters.project_type && Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0) {
                filename += `_نوع_${exportFilters.project_type.join('_')}`;
            }
            if (exportFilters.startDate && exportFilters.endDate) {
                filename += `_${exportFilters.startDate}_الى_${exportFilters.endDate}`;
            }

            // Download file with styles (xlsx-js-style automatically applies styles)
            XLSX.writeFile(workbook, `${filename}.xlsx`);

            let successMessage = `تم تحميل ملف Excel بنجاح! (${dataToExport.length} مشروع)`;
            if (exportFilters.status || (exportFilters.project_type && exportFilters.project_type.length > 0) || exportFilters.startDate || exportFilters.endDate) {
                successMessage += " (مع تطبيق الفلاتر المحددة)";
            }

            success(successMessage);
            setIsExportFilterModalOpen(false);
        } catch (error) {
            console.error("❌ خطأ في تصدير ملف Excel:", error);
            showError("حدث خطأ أثناء تصدير الملف");
        } finally {
            setIsDownloading(false);
        }
    };

    const resetExportFilters = () => {
        setExportFilters({
            status: [], // ✅ مصفوفة فارغة
            project_type: [],
            startDate: "",
            endDate: "",
        });
    };

    const resetFilters = () => {
        setFilters({
            status: "",
            startDate: "",
            endDate: "",
        });
    };

    const applyFilters = () => {
        setIsFilterModalOpen(false);
        // Show success message with filter details
        if (filters.status || filters.startDate || filters.endDate) {
            let message = "تم تطبيق الفلترة بنجاح";
            if (filters.status) message += ` - الحالة: ${filters.status}`;
            if (filters.startDate || filters.endDate) {
                message += ` - التاريخ: ${filters.startDate || '...'} إلى ${filters.endDate || '...'}`;
            }
            success(message);
        }
    };

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (filters.status) count++;
        if (filters.startDate) count++;
        if (filters.endDate) count++;
        if (filters.subProjectsOnly) count++;
        return count;
    }, [filters]);

    const activeExportFiltersCount = useMemo(() => {
        let count = 0;
        if (exportFilters.status && Array.isArray(exportFilters.status) && exportFilters.status.length > 0) count++;
        if (exportFilters.project_type && Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0) count++;
        if (exportFilters.startDate) count++;
        if (exportFilters.endDate) count++;
        return count;
    }, [exportFilters]);

    // Get unique statuses from projects for export filter
    const availableStatuses = useMemo(() => {
        const statusSet = new Set();
        projects.forEach(project => {
            if (project.status) {
                statusSet.add(project.status);
            }
        });
        // Always include the common statuses even if not in current projects
        statusSet.add('مكتمل');
        statusSet.add('غير مكتمل');
        return Array.from(statusSet).sort();
    }, [projects]);

    // Get unique project types from projects for export filter (نوع المشروع)
    const availableProjectTypes = useMemo(() => {
        const typeSet = new Set();
        projects.forEach(project => {
            const typeName = !project.project_type ? null
                : (typeof project.project_type === 'object' && project.project_type !== null)
                    ? (project.project_type.name_ar || project.project_type.name || project.project_type.name_en || null)
                    : String(project.project_type);
            if (typeName) typeSet.add(typeName);
        });
        return Array.from(typeSet).sort();
    }, [projects]);

    const SkeletonRow = () => (
        <tr className="animate-pulse">
            <td className="p-4">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 bg-gradient-to-br from-sky-100 to-orange-100 rounded-2xl"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-40"></div>
                        <div className="h-3 bg-gray-100 rounded w-24"></div>
                    </div>
                </div>
            </td>
            <td className="p-4">
                <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
            </td>
            <td className="p-4">
                <div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div>
            </td>
            <td className="p-4">
                <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
            </td>
            <td className="p-4">
                <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
            </td>
            <td className="p-4">
                <div className="h-4 bg-gray-200 rounded w-24 mx-auto"></div>
            </td>
            <td className="p-4">
                <div className="h-8 bg-gray-200 rounded-full w-20 mx-auto"></div>
            </td>
            <td className="p-4">
                <div className="h-8 bg-gray-200 rounded-lg w-16 mx-auto"></div>
            </td>
        </tr>
    );

    return (
        <SectionPasswordProtection
            sectionName="projects"
            displayName="قسم المشاريع المنفذة"
        >
            <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 px-4 sm:px-6 lg:px-8 py-8" dir="rtl">

                {/* Animated Background Elements */ }
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                    <div className="absolute top-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-40 right-40 w-80 h-80 bg-sky-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
                </div>

                <div className="relative max-w-7xl mx-auto">
                    {/* Header Section */ }
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 mb-6">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl shadow-lg shadow-orange-200">
                                    <Package className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-400 bg-clip-text text-transparent">
                                        المشاريع المنفذة
                                    </h1>
                                    <p className="text-gray-600 mt-1">إجمالي المشاريع: { filteredProjects.length }</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={ handleDownloadExcel }
                                    disabled={ isDownloading }
                                    className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-2xl transition-all duration-300 shadow-lg shadow-green-200 hover:from-green-500 hover:to-green-600 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    { isDownloading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                            <span className="font-medium">جاري التحميل...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5" />
                                            <span className="font-medium">تصدير Excel</span>
                                        </>
                                    ) }
                                </button>
                                <button
                                    onClick={ () => setShowForm(!showForm) }
                                    className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-2xl transition-all duration-300 shadow-lg shadow-orange-200 hover:from-orange-500 hover:to-orange-600 transform hover:scale-105"
                                >
                                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                                    <span className="font-medium">{ showForm ? "إخفاء النموذج" : "إضافة مشروع جديد" }</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Add Project Form */ }
                    { showForm && (
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 mb-6">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">إضافة مشروع جديد</h2>
                            <ProjectsForm onSubmit={ handleCreateProject } isLoading={ isSubmitting } />
                        </div>
                    ) }

                    {/* Execution Alerts for Coordinatorsشض ضذذ     1ذذ */ }
                    { (readyForExecutionProjects.length > 0 || loadingReadyProjects) && (
                        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-2xl p-6 shadow-xl border-2 border-amber-200 mb-6 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="bg-amber-500 rounded-full p-3 shadow-lg">
                                        <Home className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white">
                                                تنبيه مهم
                                            </span>
                                            { !loadingReadyProjects && (
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">
                                                    { readyForExecutionProjects.length }
                                                </span>
                                            ) }
                                            { loadingReadyProjects && (
                                                <span className="inline-flex items-center justify-center w-6 h-6">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></div>
                                                </span>
                                            ) }
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-1">
                                            مشاريع جاهزة للتنفيذ
                                        </h2>
                                        <p className="text-gray-600 text-sm">
                                            { loadingReadyProjects
                                                ? 'جاري تحميل المشاريع...'
                                                : readyForExecutionProjects.length > 0
                                                    ? `تم توزيع ${readyForExecutionProjects.length} مشروع من قبل مدير المشاريع على الفرق وهي بانتظار اختيار المخيم والبدء بالتنفيذ.`
                                                    : 'لا توجد مشاريع جاهزة للتنفيذ حالياً.'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={ () => setIsAlertsCollapsed(!isAlertsCollapsed) }
                                        className="px-3 py-2 bg-amber-400 hover:bg-amber-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                                        title={ isAlertsCollapsed ? 'تكبير القائمة' : 'تصغير القائمة' }
                                    >
                                        <ChevronDown className={ `w-4 h-4 transition-transform duration-300 ${isAlertsCollapsed ? 'rotate-180' : ''}` } />
                                        { isAlertsCollapsed ? 'تكبير' : 'تصغير' }
                                    </button>
                                    <button
                                        onClick={ fetchReadyForExecutionProjects }
                                        disabled={ loadingReadyProjects }
                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                        title="تحديث القائمة"
                                    >
                                        <ArrowUpDown className={ `w-4 h-4 ${loadingReadyProjects ? 'animate-spin' : ''}` } />
                                        تحديث
                                    </button>
                                </div>
                            </div>

                            { !isAlertsCollapsed && (
                                <div className="bg-white rounded-xl p-4 border border-amber-200">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-amber-600" />
                                        قائمة المشاريع الموزعة
                                    </h3>
                                    <div className="space-y-3">
                                        { readyForExecutionProjects.map((project) => {
                                            const teamName = project?.assigned_to_team?.team_name ||
                                                project?.assigned_team?.team_name ||
                                                project?.team_name ||
                                                'غير محدد';
                                            const photographerName = project?.assigned_photographer?.name ||
                                                project?.photographer?.name ||
                                                'غير محدد';
                                            // ✅ استخدام getProjectCode للحصول على الكود (donor_code أو internal_code)
                                            const projectCode = getProjectCode(project, '---');
                                            const projectName = project.project_name || project.donor_name || 'مشروع بدون اسم';
                                            const projectDescription = project.project_description || project.description || '---';

                                            // ✅ تحديد نوع المشروع
                                            const isDailyPhase = project.is_daily_phase || project.isDailyPhase || false;
                                            const isDivided = project.is_divided_into_phases || project.isDividedIntoPhases || false;
                                            const phaseDay = project.phase_day || project.phaseDay || null;
                                            const parentProjectName = project.parent_project?.project_name || project.parentProject?.project_name || null;

                                            return (
                                                <div
                                                    key={ project.id }
                                                    onClick={ () => {
                                                        setSelectedProjectForShelter(project);
                                                        setSelectShelterModalOpen(true);
                                                    } }
                                                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border-2 border-amber-200 bg-gradient-to-r from-white to-amber-50 hover:shadow-md transition-shadow cursor-pointer"
                                                >
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">
                                                                { projectCode }
                                                            </span>
                                                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-sky-100 text-sky-700">
                                                                { (() => {
                                                                    if (!project.project_type) return '---';
                                                                    if (typeof project.project_type === 'object' && project.project_type !== null) {
                                                                        return project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '---';
                                                                    }
                                                                    return project.project_type;
                                                                })() }
                                                            </span>
                                                            {/* ✅ Badge نوع المشروع */ }
                                                            { isDailyPhase ? (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                                                    📅 يومي { phaseDay ? `- اليوم ${phaseDay}` : '' }
                                                                </span>
                                                            ) : isDivided ? (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                                                    📦 مقسم
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                                                    ✅ غير مقسم
                                                                </span>
                                                            ) }
                                                            {/* ✅ Badge للمشاريع التي تم تنفيذها سابقاً */ }
                                                            { project.__isAlreadyExecuted && (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                                                                    ⚠️ تم تنفيذه سابقاً
                                                                </span>
                                                            ) }
                                                        </div>
                                                        <p className="text-gray-800 font-bold text-lg mb-1">
                                                            { projectName }
                                                            { isDailyPhase && parentProjectName && (
                                                                <span className="text-sm font-normal text-gray-500 mr-2">
                                                                    (من: { parentProjectName })
                                                                </span>
                                                            ) }
                                                        </p>
                                                        <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                                                            { projectDescription }
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">

                                                            <span className="flex items-center gap-1">
                                                                <Package className="w-3 h-3" />
                                                                الكمية/العدد: <span className="font-semibold text-gray-700">{ project?.quantity ?? project?.project_quantity ?? project?.total_quantity ?? '—' }</span>
                                                            </span>

                                                            <span className="flex items-center gap-1">
                                                                <Camera className="w-3 h-3" />
                                                                المصور: <span className="font-semibold text-gray-700">{ photographerName }</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }) }
                                    </div>
                                </div>
                            ) }
                        </div>
                    ) }

                    {/* Search and Filter Section */ }
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 mb-6">
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="flex-1 relative group">
                                <input
                                    type="text"
                                    className="w-full px-12 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-right transition-all duration-300 outline-none focus:border-orange-400 focus:bg-white focus:shadow-lg focus:shadow-orange-100 hover:border-orange-300"
                                    placeholder="البحث عن مشروع..."
                                    value={ searchQuery }
                                    onChange={ (e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    } }
                                />
                                <Search
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors duration-300"
                                    size={ 20 }
                                />
                                { searchQuery && (
                                    <button
                                        onClick={ () => setSearchQuery("") }
                                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors duration-300"
                                    >
                                        ✕
                                    </button>
                                ) }
                            </div>

                            <button
                                onClick={ () => setIsFilterModalOpen(true) }
                                className={ `flex items-center gap-2 px-6 py-4 rounded-2xl transition-all duration-300 font-medium relative ${activeFiltersCount > 0
                                    ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-200 hover:from-orange-500 hover:to-orange-600"
                                    : "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 hover:from-orange-200 hover:to-orange-300"
                                    }` }
                            >
                                <Filter className="w-5 h-5" />
                                <span>فلترة</span>
                                { activeFiltersCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                                        { activeFiltersCount }
                                    </span>
                                ) }
                            </button>
                        </div>
                    </div>

                    {/* Table Section */ }
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-orange-50 to-orange-50 border-b border-orange-100">
                                        <th
                                            onClick={ () => requestSort("project_name") }
                                            className="p-4 text-right font-semibold text-gray-700 cursor-pointer hover:bg-orange-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>اسم المشروع</span>
                                                <ArrowUpDown className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors duration-300" />
                                            </div>
                                        </th>
                                        <th
                                            onClick={ () => requestSort("aid_type") }
                                            className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-orange-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <Package className="w-4 h-4 text-orange-500" />
                                                <span>نوع المساعدة</span>
                                            </div>
                                        </th>
                                        <th
                                            onClick={ () => requestSort("quantity") }
                                            className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-orange-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <span>الكمية</span>
                                                <ArrowUpDown className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors duration-300" />
                                            </div>
                                        </th>
                                        <th
                                            onClick={ () => requestSort("shelter.name") }
                                            className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-orange-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <Home className="w-4 h-4 text-sky-500" />
                                                <span>اسم المخيم</span>
                                            </div>
                                        </th>
                                        <th
                                            onClick={ () => requestSort("shelter.governorate") }
                                            className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-orange-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <span>العنوان</span>
                                            </div>
                                        </th>
                                        <th
                                            onClick={ () => requestSort("execution_date") }
                                            className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-orange-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <Calendar className="w-4 h-4 text-orange-500" />
                                                <span>تاريخ التنفيذ</span>
                                            </div>
                                        </th>
                                        <th className="p-4 text-center font-semibold text-gray-700">
                                            الحالة
                                        </th>
                                        <th className="p-4 text-center font-semibold text-gray-700">
                                            الإجراءات
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    { isLoading ? (
                                        Array(perPage)
                                            .fill()
                                            .map((_, index) => <SkeletonRow key={ index } />)
                                    ) : paginatedProjects.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center p-12">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full">
                                                        <Package className="w-12 h-12 text-gray-400" />
                                                    </div>
                                                    <p className="text-gray-500 text-lg">لا توجد بيانات متاحة</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedProjects.map((project, index) => {
                                            const remainingInfo = calculateRemainingDays(project);
                                            return (
                                                <tr
                                                    key={ project.id || project._id || index }
                                                    className={ `border-b border-gray-100 transition-all duration-300 hover:bg-gradient-to-r hover:from-orange-50/50 hover:to-sky-50/50 ${hoveredRow === index ? "scale-[1.01] shadow-lg" : ""
                                                        }` }
                                                    onMouseEnter={ () => setHoveredRow(index) }
                                                    onMouseLeave={ () => setHoveredRow(null) }
                                                >
                                                    <td className="p-4">
                                                        <p className="font-semibold text-gray-800">{ project.project_name }</p>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className="text-gray-700">{ project.aid_type || "-" }</span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className="text-gray-700 font-medium">{ project.quantity || "-" }</span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        { project.shelter ? (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <p className="font-medium text-gray-800">
                                                                    { project.shelter.camp_name || project.shelter.name || "-" }
                                                                </p>
                                                                { project.shelter.manager_phone && (
                                                                    <p className="text-xs text-gray-500 text-right w-full" dir="rtl">
                                                                        جوال المدير: { project.shelter.manager_phone }
                                                                    </p>
                                                                ) }
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-500">-</span>
                                                        ) }
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        { project.shelter ? (
                                                            <p className="text-gray-700">{ project.shelter.governorate && project.shelter.district ? `${project.shelter.governorate} - ${project.shelter.district}` : project.shelter.detailed_address || "-" }</p>
                                                        ) : (
                                                            <span className="text-gray-500">-</span>
                                                        ) }
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className="text-gray-700">{ formatDate(project.execution_date) }</span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span
                                                            className={ `px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1
                                                        ${project.status === "مكتمل"
                                                                    ? "bg-gradient-to-r from-green-100 to-green-200 text-green-700"
                                                                    : "bg-gradient-to-r from-red-100 to-red-200 text-red-700"
                                                                }` }
                                                        >
                                                            { project.status === "مكتمل" ? (
                                                                <CheckCircle className="w-4 h-4" />
                                                            ) : (
                                                                <XCircle className="w-4 h-4" />
                                                            ) }
                                                            { project.status || "غير مكتمل" }
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={ () => setViewingProject(project) }
                                                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all duration-300 hover:scale-110"
                                                                title="عرض التفاصيل"
                                                            >
                                                                <Eye className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={ () => setEditingProject(project) }
                                                                className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg transition-all duration-300 hover:scale-110"
                                                                title="تعديل"
                                                            >
                                                                <Edit className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={ () => handleDeleteClick(project) }
                                                                disabled={ deletingProject === (project.id || project._id) }
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300 hover:scale-110 disabled:opacity-50"
                                                                title="حذف المشروع"
                                                            >
                                                                { deletingProject === (project.id || project._id) ? (
                                                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                                                                ) : (
                                                                    <Trash2 className="w-5 h-5" />
                                                                ) }
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) }
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Section */ }
                        <div className="bg-gradient-to-r from-orange-50 to-orange-50 p-6 border-t border-orange-100">
                            <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-600">عرض</span>
                                    <select
                                        className="px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-medium focus:border-orange-400 focus:outline-none transition-colors duration-300 cursor-pointer hover:border-orange-300"
                                        value={ perPage }
                                        onChange={ (e) => {
                                            setPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        } }
                                    >
                                        <option value={ 10 }>10</option>
                                        <option value={ 20 }>20</option>
                                        <option value={ 50 }>50</option>
                                        <option value={ 100 }>100</option>
                                        <option value={ 500 }>500</option>
                                        <option value={ 1000 }>1000</option>
                                        <option value={ 10000 }>الكل</option>
                                    </select>
                                    <span className="text-gray-600">سجلات</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={ () => setCurrentPage((prev) => Math.max(prev - 1, 1)) }
                                        disabled={ currentPage === 1 }
                                        className="p-2 bg-white border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-orange-50 hover:border-orange-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>

                                    <div className="flex items-center gap-2">
                                        { Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }

                                            return (
                                                <button
                                                    key={ pageNum }
                                                    onClick={ () => setCurrentPage(pageNum) }
                                                    className={ `px-4 py-2 rounded-xl font-medium transition-all duration-300 ${currentPage === pageNum
                                                        ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-200"
                                                        : "bg-white border-2 border-gray-200 text-gray-700 hover:bg-orange-50 hover:border-orange-300"
                                                        }` }
                                                >
                                                    { pageNum }
                                                </button>
                                            );
                                        }) }
                                    </div>

                                    <button
                                        onClick={ () => setCurrentPage((prev) => Math.min(prev + 1, totalPages)) }
                                        disabled={ currentPage === totalPages }
                                        className="p-2 bg-white border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-orange-50 hover:border-orange-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="text-gray-600">
                                    صفحة { currentPage } من { totalPages || 1 }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Modal */ }
                {/* View Details Modal */ }
                { viewingProject && (
                    <ProjectDetailsModal
                        isOpen={ !!viewingProject }
                        onClose={ () => setViewingProject(null) }
                        project={ viewingProject }
                    />
                ) }

                {/* Edit Modal */ }
                { editingProject && (
                    <ProjectEditModal
                        isOpen={ !!editingProject }
                        onClose={ () => setEditingProject(null) }
                        projectData={ editingProject }
                        onUpdateSuccess={ handleUpdateProject }
                    />
                ) }

                {/* Filter Modal */ }
                { isFilterModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300" dir="rtl">
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                            onClick={ () => setIsFilterModalOpen(false) }
                        />
                        <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-2xl w-full transform transition-all duration-300">
                            {/* Header */ }
                            <div className="bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-3xl">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl">
                                        <Filter className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-800">فلترة المشاريع</h3>
                                        <p className="text-sm text-gray-500 mt-1">استخدم الفلاتر للبحث بدقة أكبر</p>
                                    </div>
                                </div>
                                <button
                                    onClick={ () => setIsFilterModalOpen(false) }
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Filter Content */ }
                            <div className="p-6 space-y-6">
                                {/* Status Filter */ }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <CheckCircle className="w-4 h-4 inline ml-1" />
                                        حالة المشروع
                                    </label>
                                    <select
                                        value={ filters.status }
                                        onChange={ (e) => setFilters({ ...filters, status: e.target.value }) }
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-orange-400 focus:bg-white focus:shadow-lg"
                                    >
                                        <option value="">جميع المشاريع</option>
                                        <option value="مكتمل">مكتمل</option>
                                        <option value="غير مكتمل">غير مكتمل</option>
                                    </select>
                                </div>

                                {/* Date Range Filter */ }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <Calendar className="w-4 h-4 inline ml-1" />
                                        فترة التنفيذ
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">من تاريخ</label>
                                            <input
                                                type="date"
                                                value={ filters.startDate }
                                                onChange={ (e) => setFilters({ ...filters, startDate: e.target.value }) }
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-orange-400 focus:bg-white focus:shadow-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">إلى تاريخ</label>
                                            <input
                                                type="date"
                                                value={ filters.endDate }
                                                onChange={ (e) => setFilters({ ...filters, endDate: e.target.value }) }
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-orange-400 focus:bg-white focus:shadow-lg"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Active Filters Summary */ }
                                { activeFiltersCount > 0 && (
                                    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                                        <p className="text-sm font-semibold text-orange-800 mb-2">
                                            الفلاتر النشطة: { activeFiltersCount }
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            { filters.status && (
                                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs">
                                                    الحالة: { filters.status }
                                                </span>
                                            ) }
                                            { filters.startDate && (
                                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs">
                                                    من: { filters.startDate }
                                                </span>
                                            ) }
                                            { filters.endDate && (
                                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs">
                                                    إلى: { filters.endDate }
                                                </span>
                                            ) }
                                        </div>
                                    </div>
                                ) }
                            </div>

                            {/* Footer */ }
                            <div className="bg-white border-t border-gray-200 p-6 flex items-center justify-between gap-4 rounded-b-3xl">
                                <button
                                    onClick={ resetFilters }
                                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300 font-medium"
                                >
                                    <X className="w-5 h-5" />
                                    إعادة تعيين
                                </button>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={ () => setIsFilterModalOpen(false) }
                                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300 font-medium"
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        onClick={ applyFilters }
                                        className="px-6 py-3 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl hover:from-orange-500 hover:to-orange-600 transition-all duration-300 font-medium shadow-lg shadow-orange-200"
                                    >
                                        تطبيق الفلترة
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) }

                {/* Export Filter Modal */ }
                { isExportFilterModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300" dir="rtl">
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                            onClick={ () => !isDownloading && setIsExportFilterModalOpen(false) }
                        />
                        <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-2xl w-full transform transition-all duration-300">
                            {/* Header */ }
                            <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 flex items-center justify-between rounded-t-3xl">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                                        <Download className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">تصدير ملف Excel</h3>
                                        <p className="text-sm text-green-50 mt-1">اختر الفلاتر لتحديد البيانات المراد تصديرها</p>
                                    </div>
                                </div>
                                <button
                                    onClick={ () => !isDownloading && setIsExportFilterModalOpen(false) }
                                    disabled={ isDownloading }
                                    className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Filter Content */ }
                            <div className="p-6 space-y-6">
                                {/* Info Box */ }
                                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-start gap-3">
                                    <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-blue-800">
                                            ✨ تصدير فوري وسريع
                                        </p>
                                        <p className="text-xs text-blue-700 mt-1">
                                            سيتم تصدير المشاريع مباشرة من المتصفح حسب الفلاتر المحددة. إذا لم تختر أي فلتر، سيتم تصدير جميع المشاريع.
                                        </p>
                                    </div>
                                </div>

                                {/* Status Filter - Multiple Selection */ }
                                <div className="relative" ref={ exportStatusDropdownRef }>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <CheckCircle className="w-4 h-4 inline ml-1" />
                                        حالة المشروع
                                    </label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={ () => setShowExportStatusDropdown(!showExportStatusDropdown) }
                                            disabled={ isDownloading }
                                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50 flex items-center justify-between"
                                        >
                                            <span className="text-gray-700">
                                                { Array.isArray(exportFilters.status) && exportFilters.status.length > 0
                                                    ? `${exportFilters.status.length} محدد`
                                                    : 'جميع الحالات'
                                                }
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-gray-500" />
                                        </button>

                                        { showExportStatusDropdown && !isDownloading && (
                                            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                                <div className="p-2">
                                                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={ Array.isArray(exportFilters.status) && exportFilters.status.length === 0 }
                                                            onChange={ () => setExportFilters({ ...exportFilters, status: [] }) }
                                                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                                        />
                                                        <span className="text-sm text-gray-700 font-medium">جميع الحالات</span>
                                                    </label>
                                                    { availableStatuses.map((status) => (
                                                        <label key={ status } className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={ Array.isArray(exportFilters.status) && exportFilters.status.includes(status) }
                                                                onChange={ (e) => {
                                                                    const currentStatuses = Array.isArray(exportFilters.status) ? exportFilters.status : [];
                                                                    const newStatuses = e.target.checked
                                                                        ? [...currentStatuses, status]
                                                                        : currentStatuses.filter(s => s !== status);
                                                                    setExportFilters({ ...exportFilters, status: newStatuses });
                                                                } }
                                                                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                                            />
                                                            <span className="text-sm text-gray-700">{ status }</span>
                                                        </label>
                                                    )) }
                                                </div>
                                            </div>
                                        ) }
                                    </div>
                                </div>

                                {/* Project Type Filter - نوع المشروع */ }
                                { availableProjectTypes.length > 0 && (
                                    <div className="relative" ref={ exportProjectTypeDropdownRef }>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            <Package className="w-4 h-4 inline ml-1" />
                                            نوع المشروع
                                        </label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={ () => setShowExportProjectTypeDropdown(!showExportProjectTypeDropdown) }
                                                disabled={ isDownloading }
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50 flex items-center justify-between"
                                            >
                                                <span className="text-gray-700">
                                                    { Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0
                                                        ? `${exportFilters.project_type.length} محدد`
                                                        : 'جميع الأنواع'
                                                    }
                                                </span>
                                                <ChevronDown className="w-4 h-4 text-gray-500" />
                                            </button>

                                            { showExportProjectTypeDropdown && !isDownloading && (
                                                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                                    <div className="p-2">
                                                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={ !Array.isArray(exportFilters.project_type) || exportFilters.project_type.length === 0 }
                                                                onChange={ () => setExportFilters({ ...exportFilters, project_type: [] }) }
                                                                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                                            />
                                                            <span className="text-sm text-gray-700 font-medium">جميع الأنواع</span>
                                                        </label>
                                                        { availableProjectTypes.map((typeName) => (
                                                            <label key={ typeName } className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={ Array.isArray(exportFilters.project_type) && exportFilters.project_type.includes(typeName) }
                                                                    onChange={ (e) => {
                                                                        const current = Array.isArray(exportFilters.project_type) ? exportFilters.project_type : [];
                                                                        const next = e.target.checked
                                                                            ? [...current, typeName]
                                                                            : current.filter(t => t !== typeName);
                                                                        setExportFilters({ ...exportFilters, project_type: next });
                                                                    } }
                                                                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                                                />
                                                                <span className="text-sm text-gray-700">{ typeName }</span>
                                                            </label>
                                                        )) }
                                                    </div>
                                                </div>
                                            ) }
                                        </div>
                                    </div>
                                ) }

                                {/* Date Range Filter */ }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <Calendar className="w-4 h-4 inline ml-1" />
                                        فترة التنفيذ
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">من تاريخ</label>
                                            <input
                                                type="date"
                                                value={ exportFilters.startDate }
                                                onChange={ (e) => setExportFilters({ ...exportFilters, startDate: e.target.value }) }
                                                disabled={ isDownloading }
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">إلى تاريخ</label>
                                            <input
                                                type="date"
                                                value={ exportFilters.endDate }
                                                onChange={ (e) => setExportFilters({ ...exportFilters, endDate: e.target.value }) }
                                                disabled={ isDownloading }
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Active Export Filters Summary */ }
                                { activeExportFiltersCount > 0 && (
                                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                                        <p className="text-sm font-semibold text-green-800 mb-2">
                                            الفلاتر المحددة: { activeExportFiltersCount }
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            { exportFilters.status && Array.isArray(exportFilters.status) && exportFilters.status.length > 0 && (
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                                    الحالة: { exportFilters.status.join(', ') }
                                                </span>
                                            ) }
                                            { exportFilters.project_type && Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0 && (
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                                    نوع المشروع: { exportFilters.project_type.join(', ') }
                                                </span>
                                            ) }
                                            { exportFilters.startDate && (
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                                    من: { exportFilters.startDate }
                                                </span>
                                            ) }
                                            { exportFilters.endDate && (
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                                    إلى: { exportFilters.endDate }
                                                </span>
                                            ) }
                                        </div>
                                    </div>
                                ) }

                                {/* No Filters Warning */ }
                                { activeExportFiltersCount === 0 && (
                                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3">
                                        <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-amber-800">
                                                لم يتم اختيار أي فلاتر
                                            </p>
                                            <p className="text-xs text-amber-700 mt-1">
                                                سيتم تصدير جميع المشاريع الموجودة في النظام
                                            </p>
                                        </div>
                                    </div>
                                ) }
                            </div>

                            {/* Footer */ }
                            <div className="bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-between gap-4 rounded-b-3xl">
                                <button
                                    onClick={ resetExportFilters }
                                    disabled={ isDownloading }
                                    className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 font-medium disabled:opacity-50"
                                >
                                    <X className="w-5 h-5" />
                                    مسح الفلاتر
                                </button>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={ () => setIsExportFilterModalOpen(false) }
                                        disabled={ isDownloading }
                                        className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 font-medium disabled:opacity-50"
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        onClick={ handleConfirmExport }
                                        disabled={ isDownloading }
                                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 font-medium shadow-lg shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        { isDownloading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                                <span>جاري التصدير...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-5 h-5" />
                                                <span>تطبيق الفلترة والتصدير</span>
                                            </>
                                        ) }
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) }
            </div>

            {/* Select Shelter Modal for Ready Projects */ }
            { selectedProjectForShelter && selectShelterModalOpen && (
                <SelectShelterModal
                    isOpen={ selectShelterModalOpen }
                    projectId={ selectedProjectForShelter.id }
                    onClose={ () => {
                        setSelectShelterModalOpen(false);
                        setSelectedProjectForShelter(null);
                    } }
                    onSuccess={ () => {
                        fetchReadyForExecutionProjects();
                        setSelectShelterModalOpen(false);
                        setSelectedProjectForShelter(null);
                        toast.success('تم اختيار المخيم بنجاح');
                    } }
                />
            ) }

            {/* Delete Confirmation Dialog */ }
            <ConfirmDialog
                isOpen={ !!projectToDelete }
                onClose={ handleDeleteCancel }
                onConfirm={ handleDeleteConfirm }
                title="تأكيد حذف المشروع"
                message={
                    projectToDelete
                        ? `هل أنت متأكد من حذف المشروع "${projectToDelete.project_name || projectToDelete.description || 'هذا المشروع'}"؟ لا يمكن التراجع عن هذا الإجراء.`
                        : ''
                }
                confirmText="حذف"
                cancelText="إلغاء"
                type="danger"
                isLoading={ !!deletingProject }
            />
        </SectionPasswordProtection>
    );
};

export default Projects;

