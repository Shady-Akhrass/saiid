import React, { useState, useEffect, useRef, useMemo } from "react";
import apiClient from "../../../utils/axiosConfig";
import { useToast } from "../../../hooks/useToast";
import { useAuth } from "../../../context/AuthContext";
import SectionPasswordProtection from "../../../components/SectionPasswordProtection";
import { useCache } from "../../../hooks/useCache";
import { useCacheInvalidation } from "../../../hooks/useCacheInvalidation";
import { useDebounce } from "../../../hooks/useDebounce";
import ExcelJS from 'exceljs';
import { downloadWorkbookAsFile } from '../../../utils/excelDownload';
import {
    Search,
    Download,
    ChevronLeft,
    ChevronRight,
    Users,
    Filter,
    ArrowUpDown,
    MapPin,
    Home,
    Phone,
    Edit,
    Trash2,
    X,
    RotateCcw,
    Calendar,
    Clock,
    Eye,
    Package,
    CheckCircle,
} from "lucide-react";
import EditShelterModal from "../../modals/EditShelterModal";

// Get API base URL for file downloads
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://forms-api.saiid.org/api';

const Shelters = () => {
    const { user } = useAuth();
    const { getData, setCachedData, isCacheValid, initializeCache, clearCache } = useCache('shelters', 120000); // دقيقتان
    const { invalidateSheltersCache } = useCacheInvalidation();
    const abortControllerRef = useRef(null);
    const [shelters, setShelters] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // ✅ التحقق من دور منسق المشاريع
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

    // ✅ State لمعاينة معلومات الاستفادة
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [selectedShelterForPreview, setSelectedShelterForPreview] = useState(null);
    const [shelterBenefits, setShelterBenefits] = useState([]);
    const [loadingBenefits, setLoadingBenefits] = useState(false);

    // ✅ State لحفظ معلومات الاستفادة لكل مخيم (cache)
    const [shelterBenefitsCache, setShelterBenefitsCache] = useState({});

    // ✅ State لفلترة استبعاد المخيمات المستفيدة
    const [excludeBenefitedShelters, setExcludeBenefitedShelters] = useState(false);

    // ✅ State لتخزين جميع المشاريع المنفذة (للاستخدام في الفلترة)
    const [allExecutedProjects, setAllExecutedProjects] = useState([]);
    const [isLoadingExecutedProjects, setIsLoadingExecutedProjects] = useState(false);

    // ✅ تهيئة الـ cache عند التحميل
    useEffect(() => {
        initializeCache();
    }, [initializeCache]);
    const [searchQuery, setSearchQuery] = useState("");
    // ✅ استخدام debounce للبحث لتجنب إرسال طلبات كثيرة
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [perPage, setPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalShelters, setTotalShelters] = useState(0); // العدد الإجمالي من API
    const [totalSheltersFromAPI, setTotalSheltersFromAPI] = useState(0); // العدد الإجمالي من API (بدون فلترة)
    const [totalPages, setTotalPages] = useState(0);
    const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
    const { success, error: showError } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [hoveredRow, setHoveredRow] = useState(null);
    const [selectedShelterId, setSelectedShelterId] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [shelterToDelete, setShelterToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Advanced Filter States
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [filters, setFilters] = useState({
        governorate: "",
        district: "",
        familiesCountMin: "",
        familiesCountMax: "",
        tentsCountMin: "",
        tentsCountMax: "",
        managerName: "",
        managerPhone: "",
        hasExcel: null, // null = all, true = has excel, false = no excel
    });
    const [activeFiltersCount, setActiveFiltersCount] = useState(0);

    // Calculate active filters count
    useEffect(() => {
        let count = 0;
        if (filters.governorate) count++;
        if (filters.district) count++;
        if (filters.familiesCountMin || filters.familiesCountMax) count++;
        if (filters.tentsCountMin || filters.tentsCountMax) count++;
        if (filters.managerName) count++;
        if (filters.managerPhone) count++;
        if (filters.hasExcel !== null) count++;
        setActiveFiltersCount(count);
    }, [filters]);

    const fetchShelters = async () => {
        // ✅ إلغاء أي طلب سابق (غير مُلغى) عند تغيير الصفحة/البحث/perPage
        const prev = abortControllerRef.current;
        if (prev && !prev.signal.aborted) {
            prev.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        try {
            // ✅ استخدام perPage من state (10، 30، 50، 100) - server-side pagination
            const serverPerPage = Math.min(perPage, 100); // ✅ لا نزيد عن 100
            // ✅ عند وجود فلاتر متقدمة أو بحث نصي: جلب مزيد من السجلات لتمكين الفلترة من جهة العميل إن لم يدعم الـ API الفلترة
            const hasAdvancedFilters = !!(
                (debouncedSearchQuery || '').trim() ||
                filters.governorate ||
                filters.district ||
                filters.managerName ||
                filters.managerPhone ||
                filters.familiesCountMin ||
                filters.familiesCountMax ||
                filters.tentsCountMin ||
                filters.tentsCountMax ||
                filters.hasExcel !== null
            );
            const effectivePerPage = hasAdvancedFilters ? Math.max(serverPerPage, 100) : serverPerPage;

            // ✅ بناء معاملات الطلب: بحث + ترقيم + فلاتر (لإرجاع نتائج مطابقة من الـ API عند دعمها)
            const params = {
                searchQuery: debouncedSearchQuery || undefined,
                perPage: effectivePerPage,
                page: currentPage,
            };
            if (filters.governorate?.trim()) params.governorate = filters.governorate.trim();
            if (filters.district?.trim()) params.district = filters.district.trim();
            if (filters.managerName?.trim()) params.manager_name = filters.managerName.trim();
            if (filters.managerPhone?.trim()) params.manager_phone = filters.managerPhone.trim();
            if (filters.familiesCountMin !== '' && filters.familiesCountMin != null) params.families_count_min = filters.familiesCountMin;
            if (filters.familiesCountMax !== '' && filters.familiesCountMax != null) params.families_count_max = filters.familiesCountMax;
            if (filters.tentsCountMin !== '' && filters.tentsCountMin != null) params.tents_count_min = filters.tentsCountMin;
            if (filters.tentsCountMax !== '' && filters.tentsCountMax != null) params.tents_count_max = filters.tentsCountMax;
            if (filters.hasExcel === true) params.has_excel = 1;
            if (filters.hasExcel === false) params.has_excel = 0;

            // ✅ جلب الصفحة الحالية مع الفلاتر (الـ Backend إن دعم المعاملات يرجّع النتائج المطابقة)
            const firstResponse = await apiClient.get("/shelters", {
                params,
                signal: controller.signal,
                skipDeduplication: true,
            });

            if (import.meta.env.DEV) {
                console.log('📥 First Page API Response:', firstResponse.data);
            }

            // ✅ استخراج العدد الإجمالي والصفحات
            let totalCount = 0;
            let totalPages = 1;
            let firstPageShelters = [];

            if (firstResponse.data) {
                const d = firstResponse.data;
                // استخراج البيانات من الصفحة الأولى (دعم صيغ متعددة من الـ API)
                if (Array.isArray(d.shelters)) {
                    firstPageShelters = d.shelters;
                    totalCount = d.totalShelters ?? d.total ?? d.shelters.length;
                    totalPages = d.totalPages ?? Math.ceil(totalCount / serverPerPage);
                } else if (Array.isArray(d)) {
                    firstPageShelters = d;
                    totalCount = d.length;
                    totalPages = Math.ceil(totalCount / serverPerPage);
                } else if (Array.isArray(d.data)) {
                    firstPageShelters = d.data;
                    totalCount = d.total ?? d.totalShelters ?? d.data.length;
                    totalPages = d.totalPages ?? d.last_page ?? Math.ceil(totalCount / serverPerPage);
                } else if (d.data && Array.isArray(d.data.shelters)) {
                    firstPageShelters = d.data.shelters;
                    totalCount = d.data.totalShelters ?? d.total ?? d.data.shelters.length;
                    totalPages = d.data.totalPages ?? d.last_page ?? Math.ceil(totalCount / serverPerPage);
                }
                if (import.meta.env.DEV && firstPageShelters.length === 0 && totalCount === 0 && d && typeof d === 'object') {
                    console.log('📥 Shelters API response (no data extracted):', Object.keys(d), d);
                }
            }

            // ✅ حفظ العدد الإجمالي من API مباشرة
            if (totalCount > 0) {
                setTotalSheltersFromAPI(totalCount);
                setTotalShelters(totalCount); // ✅ استخدام العدد من API مباشرة
            }

            // ✅ عرض الصفحة الحالية فوراً
            if (firstPageShelters.length > 0) {
                let allShelters = firstPageShelters;

                // ✅ عند تطبيق فلترة متقدمة: جلب كل الصفحات حتى نطبق الفلترة على كل المخيمات (وليس فقط أول 30/100)
                const pageSizeFromApi = firstPageShelters.length;
                const totalFromApi = totalCount;
                const maxSheltersWhenFiltering = 2000;
                if (hasAdvancedFilters && totalFromApi > pageSizeFromApi && totalFromApi <= maxSheltersWhenFiltering) {
                    const totalPagesToFetch = Math.ceil(totalFromApi / pageSizeFromApi);
                    for (let p = 2; p <= totalPagesToFetch; p++) {
                        if (controller.signal.aborted) break;
                        try {
                            const nextRes = await apiClient.get("/shelters", {
                                params: { ...params, page: p, perPage: pageSizeFromApi },
                                signal: controller.signal,
                                skipDeduplication: true,
                            });
                            const d2 = nextRes.data;
                            let nextList = [];
                            if (Array.isArray(d2?.shelters)) nextList = d2.shelters;
                            else if (Array.isArray(d2?.data)) nextList = d2.data;
                            else if (d2?.data && Array.isArray(d2.data.shelters)) nextList = d2.data.shelters;
                            allShelters = allShelters.concat(nextList);
                        } catch (e) {
                            if (e.name === 'AbortError' || e.code === 'ERR_CANCELED') break;
                            if (import.meta.env.DEV) console.warn('Failed to fetch shelters page', p, e);
                            break;
                        }
                    }
                    if (import.meta.env.DEV) {
                        console.log(`📥 Loaded ${allShelters.length} shelters for filtering (all pages).`);
                    }
                }

                setShelters(allShelters);
                setTotalPages(totalPages || Math.ceil(totalCount / serverPerPage));

                setCachedData({
                    shelters: allShelters,
                    totalShelters: totalCount,
                    totalPages: totalPages || Math.ceil(totalCount / serverPerPage),
                    currentPage: currentPage
                }, { searchQuery: debouncedSearchQuery, currentPage, perPage });
            } else if (totalCount === 0) {
                setShelters([]);
                setTotalShelters(0);
                setTotalSheltersFromAPI(0);
                setTotalPages(0);
            }

            if (import.meta.env.DEV) {
                console.log(`📥 Loaded. Total pages: ${totalPages}.`);
            }

            // ✅ تحديث العدد الإجمالي بعد جلب جميع الصفحات (إذا تم جلبها)
            // ✅ نستخدم totalCount من API كالمصدر الوحيد للعدد الإجمالي
        } catch (error) {
            // ✅ تجاهل أخطاء الإلغاء
            if (error.name === 'AbortError' ||
                error.code === 'ERR_CANCELED' ||
                error.message === 'canceled' ||
                abortControllerRef.current?.signal.aborted) {
                return;
            }

            // ✅ إذا كان هناك بيانات في cache، استخدمها
            const cachedData = getData();
            if (cachedData) {
                setShelters(cachedData.shelters || cachedData);
                const cachedTotal = cachedData.totalShelters || cachedData.length || 0;
                setTotalShelters(cachedTotal);
                setTotalSheltersFromAPI(cachedTotal);
                setTotalPages(cachedData.totalPages || Math.ceil(cachedTotal / perPage) || 0);
                setIsLoading(false);
                if (import.meta.env.DEV) {
                    console.log('⚠️ Error fetching shelters, using cached data');
                }
                return;
            }

            setShelters([]);
            setTotalShelters(0);
            setTotalSheltersFromAPI(0);
            setTotalPages(0);

            if (import.meta.env.DEV && !error.isConnectionError) {
                console.error("Error fetching shelters:", error);
            }

            if (!error.isConnectionError && !error.isTimeoutError) {
                showError(error.userMessage || "خطأ في جلب بيانات مراكز النزوح، يرجى المحاولة مرة أخرى.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ✅ الاستماع إلى أحداث إبطال الكاش
    useEffect(() => {
        const handleCacheInvalidation = (event) => {
            const { cacheKey } = event.detail;

            // ✅ إذا كان cacheKey === 'all' أو يطابق 'shelters'
            if (cacheKey === 'all' || cacheKey === 'shelters') {
                clearCache();
                setRefreshTrigger(prev => prev + 1);

                if (import.meta.env.DEV) {
                    console.log('✅ Shelters cache invalidated, fetching fresh data');
                }
            }
        };

        window.addEventListener('cache-invalidated', handleCacheInvalidation);

        return () => {
            window.removeEventListener('cache-invalidated', handleCacheInvalidation);
        };
    }, [clearCache]);

    useEffect(() => {
        // ✅ التحقق من cache أولاً قبل جلب البيانات
        // ✅ مفتاح الكاش يشمل البحث والصفحة وعدد العرض لتفادي عرض بيانات قديمة
        const filtersKey = JSON.stringify({ searchQuery: debouncedSearchQuery, currentPage, perPage });
        if (isCacheValid(filtersKey) && currentPage === 1) {
            const cachedData = getData();
            if (cachedData) {
                const cachedTotal = cachedData.totalShelters || cachedData.length || 0;
                setShelters(cachedData.shelters || cachedData);
                setTotalShelters(cachedTotal);
                setTotalSheltersFromAPI(cachedTotal);
                const cachedPerPage = Math.min(perPage, 100);
                setTotalPages(cachedData.totalPages || Math.ceil(cachedTotal / cachedPerPage) || 0);
                setIsLoading(false);
                if (import.meta.env.DEV) {
                    console.log('✅ Using cached shelters data (from useEffect)');
                }
                return;
            }
        }

        // ✅ جلب البيانات من API (server-side pagination)
        fetchShelters();

        // ✅ تنظيف: إلغاء الطلب عند unmount أو عند تغيير المعتمدات
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchQuery, currentPage, perPage, refreshTrigger]); // ✅ perPage: إعادة التحميل عند تغيير "عدد العرض"

    // ✅ جلب جميع المشاريع المنفذة عند تفعيل الفلترة
    useEffect(() => {
        if (excludeBenefitedShelters && allExecutedProjects.length === 0 && !isLoadingExecutedProjects) {
            fetchAllExecutedProjects();
        }
    }, [excludeBenefitedShelters]);

    const handleUpdateSuccess = () => {
        invalidateSheltersCache(); // ✅ إبطال كاش المخيمات عند التحديث
        fetchShelters();
        setIsEditModalOpen(false);
        setSelectedShelterId(null);
        success("تم تحديث بيانات المخيم بنجاح");
    };

    // ✅ دالة لجلب معلومات الاستفادة للمخيم - محسّنة مع معلومات تشخيصية
    const fetchShelterBenefits = async (shelterId) => {
        if (!shelterId) return;

        setLoadingBenefits(true);
        try {
            const shelterIdStr = String(shelterId);
            const shelterIdNum = Number(shelterId);

            // ✅ معلومات تشخيصية
            const debugInfo = {
                shelter_id_searched: shelterIdStr,
                all_projects_for_shelter: [],
                all_projects_for_shelter_count: 0,
                projects_from_proposals: [],
                projects_from_proposals_count: 0,
                projects_from_old_table: [],
                projects_from_old_table_count: 0,
                projects_via_old_table: [],
                projects_via_old_table_count: 0,
                executed_projects: [],
                executed_projects_count: 0,
            };

            // ✅ دالة مساعدة لاستخراج المشاريع من response
            const extractProjects = (responseData) => {
                if (!responseData) return [];

                if (responseData.success && responseData.data && Array.isArray(responseData.data)) {
                    return responseData.data;
                } else if (responseData.success && responseData.projects && Array.isArray(responseData.projects)) {
                    return responseData.projects;
                } else if (Array.isArray(responseData.data)) {
                    return responseData.data;
                } else if (Array.isArray(responseData.projects)) {
                    return responseData.projects;
                } else if (Array.isArray(responseData)) {
                    return responseData;
                }
                return [];
            };

            // ✅ دالة مساعدة للتحقق من مطابقة shelter_id
            const matchesShelter = (project) => {
                const projectShelterId =
                    project.selected_shelter_id ||
                    project.shelter_id ||
                    project.shelter?.id ||
                    project.shelter?.manager_id_number ||
                    project.shelter_id_number ||
                    project.manager_id_number;

                const selectedShelterId =
                    project.selected_shelter?.id ||
                    project.selected_shelter?.manager_id_number ||
                    project.shelter?.id ||
                    project.shelter?.manager_id_number;

                return projectShelterId == shelterId ||
                    projectShelterId == shelterIdStr ||
                    projectShelterId == shelterIdNum ||
                    String(projectShelterId) === shelterIdStr ||
                    Number(projectShelterId) === shelterIdNum ||
                    selectedShelterId == shelterId ||
                    selectedShelterId == shelterIdStr ||
                    selectedShelterId == shelterIdNum ||
                    String(selectedShelterId) === shelterIdStr ||
                    Number(selectedShelterId) === shelterIdNum;
            };

            // ✅ دالة مساعدة للتحقق من أن المشروع منفذ
            const isExecuted = (project) => {
                return project.status === 'منفذ' ||
                    project.status === 'مكتمل' ||
                    project.execution_completed_at ||
                    project.completed_at ||
                    project.execution_date;
            };

            let allProjectsFromProposals = [];
            let allProjectsFromOldTable = [];
            let allProjectsViaOldTable = [];

            // ✅ المحاولة 1: جلب من project-proposals مع include_executed
            try {
                const response1 = await apiClient.get('/project-proposals', {
                    params: {
                        include_executed: true,
                        perPage: 10000,
                    }
                });
                allProjectsFromProposals = extractProjects(response1.data);
                debugInfo.projects_from_proposals_count = allProjectsFromProposals.length;
            } catch (err) {
                console.warn('⚠️ Failed to fetch from project-proposals with include_executed:', err.message);
            }

            // ✅ المحاولة 2: جلب من project-proposals بدون فلترة
            if (allProjectsFromProposals.length === 0) {
                try {
                    const response2 = await apiClient.get('/project-proposals', {
                        params: {
                            perPage: 10000,
                        }
                    });
                    allProjectsFromProposals = extractProjects(response2.data);
                    debugInfo.projects_from_proposals_count = allProjectsFromProposals.length;
                } catch (err) {
                    console.warn('⚠️ Failed to fetch from project-proposals:', err.message);
                }
            }

            // ✅ المحاولة 3: جلب من جدول projects القديم
            try {
                const response3 = await apiClient.get('/projects', {
                    params: {
                        perPage: 10000,
                    }
                });
                allProjectsFromOldTable = extractProjects(response3.data);
                debugInfo.projects_from_old_table_count = allProjectsFromOldTable.length;
            } catch (err) {
                console.warn('⚠️ Failed to fetch from old projects table:', err.message);
            }

            // ✅ المحاولة 4: جلب المشاريع المرتبطة من خلال project_id في project_proposals
            // (إذا كان جدول projects يحتوي على project_id يشير إلى project_proposals)
            try {
                const response4 = await apiClient.get('/project-proposals', {
                    params: {
                        perPage: 10000,
                    }
                });
                const proposals = extractProjects(response4.data);

                // البحث عن مشاريع في جدول projects القديم مرتبطة بهذه project_proposals
                if (allProjectsFromOldTable.length > 0) {
                    const proposalIds = proposals.map(p => p.id);
                    allProjectsViaOldTable = allProjectsFromOldTable.filter(p =>
                        proposalIds.includes(p.project_id || p.project_proposal_id || p.source_project_id)
                    );
                    debugInfo.projects_via_old_table_count = allProjectsViaOldTable.length;
                }
            } catch (err) {
                console.warn('⚠️ Failed to fetch projects via old table:', err.message);
            }

            // ✅ دمج جميع المشاريع من جميع المصادر
            const allMergedProjects = [
                ...allProjectsFromProposals,
                ...allProjectsFromOldTable,
                ...allProjectsViaOldTable
            ];

            // ✅ إزالة التكرارات بناءً على id
            const uniqueProjects = allMergedProjects.filter((project, index, self) =>
                index === self.findIndex(p => p.id === project.id)
            );

            if (import.meta.env.DEV) {
                console.log('📊 Projects Summary:', {
                    from_proposals: allProjectsFromProposals.length,
                    from_old_table: allProjectsFromOldTable.length,
                    via_old_table: allProjectsViaOldTable.length,
                    total_merged: allMergedProjects.length,
                    unique: uniqueProjects.length
                });
            }

            // ✅ جلب جميع المشاريع المرتبطة بالمخيم (بغض النظر عن الحالة) للتشخيص
            const allProjectsForShelter = uniqueProjects.filter(matchesShelter);
            debugInfo.all_projects_for_shelter = allProjectsForShelter.map(p => ({
                id: p.id,
                serial_number: p.serial_number,
                project_name: p.project_name || p.project_description,
                status: p.status,
                shelter_id: p.selected_shelter_id || p.shelter_id,
                execution_date: p.execution_date || p.execution_completed_at,
                is_executed: isExecuted(p)
            }));
            debugInfo.all_projects_for_shelter_count = allProjectsForShelter.length;

            // ✅ فلترة: فقط المشاريع المنفذة
            const executedProjects = allProjectsForShelter.filter(isExecuted);
            debugInfo.executed_projects = executedProjects.map(p => ({
                id: p.id,
                serial_number: p.serial_number,
                project_name: p.project_name || p.project_description,
                status: p.status,
                execution_date: p.execution_date || p.execution_completed_at
            }));
            debugInfo.executed_projects_count = executedProjects.length;

            if (import.meta.env.DEV) {
                console.log('🔍 Debug Info:', debugInfo);
                console.log('📋 All projects for shelter (any status):', allProjectsForShelter);
                console.log('✅ Executed projects for shelter:', executedProjects);
            }

            // ✅ تحويل المشاريع المنفذة إلى معلومات الاستفادة
            const benefits = executedProjects.map(project => ({
                id: project.id,
                serial_number: project.serial_number,
                project_name: project.project_name || project.project_description || project.description,
                project_type: project.project_type,
                quantity: project.quantity || 0,
                execution_date: project.execution_date || project.execution_completed_at || project.completed_at,
                donor_name: project.donor_name,
            }));

            // ✅ حفظ معلومات التشخيص في state (للاستخدام المستقبلي)
            if (import.meta.env.DEV) {
                console.log('📊 Final benefits:', benefits);
                console.log('🔍 Debug information:', debugInfo);
            }

            // ✅ حفظ في cache
            setShelterBenefitsCache(prev => ({
                ...prev,
                [shelterId]: benefits
            }));

            setShelterBenefits(benefits);
        } catch (error) {
            console.error('Error fetching shelter benefits:', error);
            // ✅ حفظ array فارغ في cache في حالة الخطأ
            setShelterBenefitsCache(prev => ({
                ...prev,
                [shelterId]: []
            }));
            setShelterBenefits([]);
            if (!error.isConnectionError && !error.isTimeoutError) {
                showError(error.userMessage || 'فشل جلب معلومات الاستفادة');
            }
        } finally {
            setLoadingBenefits(false);
        }
    };

    // ✅ دالة لفتح modal المعاينة
    const handleOpenPreview = async (shelter) => {
        setSelectedShelterForPreview(shelter);
        setIsPreviewModalOpen(true);
        const shelterId = shelter.manager_id_number;

        // ✅ التحقق من cache أولاً
        if (shelterBenefitsCache[shelterId]) {
            setShelterBenefits(shelterBenefitsCache[shelterId]);
        } else {
            await fetchShelterBenefits(shelterId);
        }
    };

    // ✅ دالة للتحقق من أن المخيم مستفيد
    const isShelterBenefited = (shelterId) => {
        if (!shelterId) return false;

        // ✅ أولاً: التحقق من cache
        const benefits = shelterBenefitsCache[shelterId];
        if (benefits && benefits.length > 0) {
            return true;
        }

        // ✅ ثانياً: التحقق من allExecutedProjects (للفلترة السريعة)
        if (allExecutedProjects.length > 0) {
            const shelterIdStr = String(shelterId);
            const shelterIdNum = Number(shelterId);

            const hasExecutedProject = allExecutedProjects.some(project => {
                const projectShelterId =
                    project.selected_shelter_id ||
                    project.shelter_id ||
                    project.shelter?.id ||
                    project.shelter?.manager_id_number ||
                    project.shelter_id_number ||
                    project.manager_id_number;

                const selectedShelterId =
                    project.selected_shelter?.id ||
                    project.selected_shelter?.manager_id_number ||
                    project.shelter?.id ||
                    project.shelter?.manager_id_number;

                const isExecuted = project.status === 'منفذ' ||
                    project.status === 'مكتمل' ||
                    project.execution_completed_at ||
                    project.completed_at ||
                    project.execution_date;

                if (!isExecuted) return false;

                return projectShelterId == shelterId ||
                    projectShelterId == shelterIdStr ||
                    projectShelterId == shelterIdNum ||
                    String(projectShelterId) === shelterIdStr ||
                    Number(projectShelterId) === shelterIdNum ||
                    selectedShelterId == shelterId ||
                    selectedShelterId == shelterIdStr ||
                    selectedShelterId == shelterIdNum ||
                    String(selectedShelterId) === shelterIdStr ||
                    Number(selectedShelterId) === shelterIdNum;
            });

            return hasExecutedProject;
        }

        return false;
    };

    // ✅ دالة لجلب جميع المشاريع المنفذة (للاستخدام في الفلترة)
    const fetchAllExecutedProjects = async () => {
        if (allExecutedProjects.length > 0) {
            // البيانات موجودة بالفعل
            return;
        }

        setIsLoadingExecutedProjects(true);
        try {
            const shelterIdStr = '';
            const shelterIdNum = 0;

            // ✅ دالة مساعدة لاستخراج المشاريع من response
            const extractProjects = (responseData) => {
                if (!responseData) return [];

                if (responseData.success && responseData.data && Array.isArray(responseData.data)) {
                    return responseData.data;
                } else if (responseData.success && responseData.projects && Array.isArray(responseData.projects)) {
                    return responseData.projects;
                } else if (Array.isArray(responseData.data)) {
                    return responseData.data;
                } else if (Array.isArray(responseData.projects)) {
                    return responseData.projects;
                } else if (Array.isArray(responseData)) {
                    return responseData;
                }
                return [];
            };

            // ✅ دالة مساعدة للتحقق من أن المشروع منفذ
            const isExecuted = (project) => {
                return project.status === 'منفذ' ||
                    project.status === 'مكتمل' ||
                    project.execution_completed_at ||
                    project.completed_at ||
                    project.execution_date;
            };

            let allProjectsFromProposals = [];
            let allProjectsFromOldTable = [];
            let allProjectsViaOldTable = [];

            // ✅ مهلة أطول (60 ثانية) لأن الطلب قد يعيد آلاف السجلات
            const heavyRequestTimeout = 60000;

            // ✅ المحاولة 1: جلب من project-proposals مع include_executed
            try {
                const response1 = await apiClient.get('/project-proposals', {
                    params: {
                        include_executed: true,
                        perPage: 10000,
                    },
                    timeout: heavyRequestTimeout,
                });
                allProjectsFromProposals = extractProjects(response1.data);
            } catch (err) {
                console.warn('⚠️ Failed to fetch from project-proposals with include_executed:', err.message);
            }

            // ✅ المحاولة 2: جلب من project-proposals بدون فلترة
            if (allProjectsFromProposals.length === 0) {
                try {
                    const response2 = await apiClient.get('/project-proposals', {
                        params: {
                            perPage: 10000,
                        },
                        timeout: heavyRequestTimeout,
                    });
                    allProjectsFromProposals = extractProjects(response2.data);
                } catch (err) {
                    console.warn('⚠️ Failed to fetch from project-proposals:', err.message);
                }
            }

            // ✅ المحاولة 3: جلب من جدول projects القديم
            try {
                const response3 = await apiClient.get('/projects', {
                    params: {
                        perPage: 10000,
                    },
                    timeout: heavyRequestTimeout,
                });
                allProjectsFromOldTable = extractProjects(response3.data);
            } catch (err) {
                console.warn('⚠️ Failed to fetch from old projects table:', err.message);
            }

            // ✅ دمج جميع المشاريع من جميع المصادر
            const allMergedProjects = [
                ...allProjectsFromProposals,
                ...allProjectsFromOldTable,
                ...allProjectsViaOldTable
            ];

            // ✅ إزالة التكرارات بناءً على id
            const uniqueProjects = allMergedProjects.filter((project, index, self) =>
                index === self.findIndex(p => p.id === project.id)
            );

            // ✅ فلترة: فقط المشاريع المنفذة
            const executedProjects = uniqueProjects.filter(isExecuted);

            if (import.meta.env.DEV) {
                console.log('📊 Loaded executed projects for filtering:', executedProjects.length);
            }

            setAllExecutedProjects(executedProjects);
        } catch (error) {
            console.error('Error fetching executed projects:', error);
        } finally {
            setIsLoadingExecutedProjects(false);
        }
    };

    const handleDelete = async () => {
        if (!shelterToDelete) return;

        setIsDeleting(true);
        try {
            const response = await apiClient.delete(
                `/shelters/${shelterToDelete.manager_id_number}`
            );

            if (response.data && response.data.success) {
                success("تم حذف المخيم بنجاح");
                invalidateSheltersCache(); // ✅ إبطال كاش المخيمات
                setIsDeleteModalOpen(false);
                setShelterToDelete(null);
                fetchShelters();
            } else {
                showError("فشل في حذف المخيم");
            }
        } catch (error) {
            console.error("Error deleting shelter:", error);
            showError(error.userMessage || error.response?.data?.error || error.response?.data?.message || "فشل في حذف المخيم");
        } finally {
            setIsDeleting(false);
        }
    };

    const formatNumber = (num) => {
        if (num === null || num === undefined) return "-";
        return new Intl.NumberFormat("en-US").format(num);
    };

    const formatDate = (dateString) => {
        if (!dateString) return "-";
        try {
            const date = new Date(dateString);
            // تنسيق التاريخ بالأرقام: يوم/شهر/سنة
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (error) {
            return "-";
        }
    };

    // Get unique governorates from shelters for filter dropdown
    const governorates = React.useMemo(() => {
        const unique = [...new Set(shelters.map(s => s.governorate).filter(Boolean))];
        return unique.sort();
    }, [shelters]);

    // Reset filters
    const resetFilters = () => {
        setFilters({
            governorate: "",
            district: "",
            familiesCountMin: "",
            familiesCountMax: "",
            tentsCountMin: "",
            tentsCountMax: "",
            managerName: "",
            managerPhone: "",
            hasExcel: null,
        });
        setCurrentPage(1); // إعادة تعيين الصفحة
        // إعادة جلب البيانات بدون فلاتر
        setTimeout(() => {
            fetchShelters();
        }, 100);
    };

    // Apply filters
    const applyFilters = () => {
        setIsFilterModalOpen(false);
        setCurrentPage(1); // إعادة تعيين الصفحة إلى الأولى عند تطبيق الفلاتر

        // جلب البيانات مع الفلاتر
        fetchShelters();

        // Show success message with filter details
        if (filters.governorate || filters.district || filters.familiesCountMin ||
            filters.familiesCountMax || filters.tentsCountMin || filters.tentsCountMax ||
            filters.managerName || filters.managerPhone || filters.hasExcel !== null) {

            let message = "تم تطبيق الفلترة بنجاح";
            let details = [];

            if (filters.governorate) details.push(`المحافظة: ${filters.governorate}`);
            if (filters.district) details.push(`المنطقة: ${filters.district}`);
            if (filters.familiesCountMin || filters.familiesCountMax) {
                details.push(`عدد الأسر: ${filters.familiesCountMin || '0'} - ${filters.familiesCountMax || '∞'}`);
            }
            if (filters.tentsCountMin || filters.tentsCountMax) {
                details.push(`عدد الخيام: ${filters.tentsCountMin || '0'} - ${filters.tentsCountMax || '∞'}`);
            }
            if (filters.managerName) details.push(`المدير: ${filters.managerName}`);
            if (filters.managerPhone) details.push(`هاتف: ${filters.managerPhone}`);
            if (filters.hasExcel !== null) {
                details.push(filters.hasExcel ? 'يوجد ملف' : 'لا يوجد ملف');
            }

            if (details.length > 0) {
                message += ` - ${details.join(', ')}`;
            }

            success(message);
        } else {
            // إذا لم تكن هناك فلاتر، نجلب البيانات العادية
            fetchShelters();
        }
    };

    const handleDownloadExcel = async () => {
        if (isDownloading) {
            console.log('⏸️ التصدير قيد التنفيذ بالفعل، تم تجاهل الطلب');
            return;
        }

        console.log('🚀 بدء تصدير Excel - جلب جميع المخيمات...');
        setIsDownloading(true);
        try {
            // جلب جميع المخيمات من API بدون فلاتر أو pagination
            let allShelters = [];
            let currentPage = 1;
            let hasMorePages = true;
            const perPageForExport = 100; // نحاول استخدام 100، لكن API قد يعيد 10
            const maxPages = 1000; // حماية من الحلقات اللانهائية
            let totalPagesFromFirstRequest = null;
            let totalCountFromFirstRequest = 0;

            // إظهار رسالة التقدم
            success(`جاري جلب جميع المخيمات...`);

            // جلب جميع الصفحات
            while (hasMorePages && currentPage <= maxPages) {
                try {
                    const response = await apiClient.get("/shelters", {
                        params: {
                            perPage: perPageForExport,
                            page: currentPage,
                            // لا نرسل searchQuery أو أي فلاتر
                        }
                    });

                    let pageShelters = [];
                    let totalCount = 0;
                    let totalPages = 1;
                    let actualPerPage = perPageForExport;

                    if (response.data) {
                        // استخراج البيانات بنفس طريقة fetchShelters تماماً
                        if (Array.isArray(response.data.shelters)) {
                            pageShelters = response.data.shelters;
                            totalCount = response.data.totalShelters ?? response.data.total ?? response.data.shelters.length;
                            totalPages = response.data.totalPages ?? Math.ceil(totalCount / perPageForExport);
                            actualPerPage = response.data.perPage ?? (pageShelters.length || perPageForExport);
                        } else if (Array.isArray(response.data)) {
                            pageShelters = response.data;
                            totalCount = response.data.length;
                            totalPages = Math.ceil(totalCount / perPageForExport);
                            actualPerPage = pageShelters.length || perPageForExport;
                        } else if (Array.isArray(response.data.data)) {
                            pageShelters = response.data.data;
                            totalCount = response.data.total ?? response.data.totalShelters ?? response.data.data.length;
                            totalPages = response.data.totalPages ?? Math.ceil(totalCount / perPageForExport);
                            actualPerPage = response.data.perPage ?? (pageShelters.length || perPageForExport);
                        } else if (response.data.data && Array.isArray(response.data.data.shelters)) {
                            pageShelters = response.data.data.shelters;
                            totalCount = response.data.data.totalShelters ?? response.data.total ?? response.data.data.shelters.length;
                            totalPages = response.data.data.totalPages ?? Math.ceil(totalCount / perPageForExport);
                            actualPerPage = response.data.data.perPage ?? (pageShelters.length || perPageForExport);
                        }

                        // طباعة الاستجابة الكاملة للتشخيص (في الصفحة الأولى فقط)
                        if (currentPage === 1 && import.meta.env.DEV) {
                            console.log('📥 API Response for Export:', {
                                hasShelters: Array.isArray(response.data.shelters),
                                sheltersCount: Array.isArray(response.data.shelters) ? response.data.shelters.length : 0,
                                totalShelters: response.data.totalShelters,
                                totalPages: response.data.totalPages,
                                currentPage: response.data.currentPage,
                                perPage: response.data.perPage,
                                extractedTotalPages: totalPages,
                                extractedTotalCount: totalCount
                            });
                        }
                    }

                    // حفظ عدد الصفحات والعدد الإجمالي من الطلب الأول
                    if (totalPagesFromFirstRequest === null && totalCount > 0) {
                        totalCountFromFirstRequest = totalCount;
                        // استخدام totalPages من API مباشرة (هذا هو الأهم)
                        // نحاول استخراجه من response.data مباشرة أولاً
                        if (response.data?.totalPages) {
                            totalPagesFromFirstRequest = response.data.totalPages;
                            console.log(`✅ تم تعيين totalPagesFromFirstRequest من response.data.totalPages: ${totalPagesFromFirstRequest}`);
                        } else if (response.data?.data?.totalPages) {
                            totalPagesFromFirstRequest = response.data.data.totalPages;
                            console.log(`✅ تم تعيين totalPagesFromFirstRequest من response.data.data.totalPages: ${totalPagesFromFirstRequest}`);
                        } else {
                            // إذا لم يكن متاحاً، نستخدم totalPages المحسوب
                            totalPagesFromFirstRequest = totalPages;
                            console.log(`⚠️ استخدام totalPages المحسوب: ${totalPagesFromFirstRequest}`);
                        }
                        console.log(`📊 إجمالي السجلات: ${totalCount} | عدد الصفحات من API: ${totalPagesFromFirstRequest} | عدد السجلات في الصفحة: ${pageShelters.length} | perPage الفعلي: ${actualPerPage}`);
                        console.log(`📊 تفاصيل API Response:`, {
                            'response.data.totalPages': response.data?.totalPages,
                            'response.data.data?.totalPages': response.data?.data?.totalPages,
                            'totalPages المحسوب': totalPages
                        });
                    } else if (totalPagesFromFirstRequest === null) {
                        console.warn(`⚠️ لم يتم تعيين totalPagesFromFirstRequest! totalCount=${totalCount}, pageShelters.length=${pageShelters.length}`);
                    }

                    allShelters = [...allShelters, ...pageShelters];

                    // تحديث رسالة التقدم
                    if (totalCountFromFirstRequest > 0 && totalPagesFromFirstRequest !== null) {
                        const progress = Math.min(allShelters.length, totalCountFromFirstRequest);
                        console.log(`📥 جاري جلب باقي البيانات... (${progress}/${totalCountFromFirstRequest}) - الصفحة ${currentPage}/${totalPagesFromFirstRequest}`);
                    }

                    // التحقق إذا كانت هناك صفحات أخرى
                    // نستخدم totalPagesFromFirstRequest من API مباشرة
                    console.log(`🔍 فحص التوقف: pageShelters.length=${pageShelters.length}, currentPage=${currentPage}, totalPagesFromFirstRequest=${totalPagesFromFirstRequest}, totalPages=${totalPages}, hasMorePages=${hasMorePages}`);

                    if (pageShelters.length === 0) {
                        // إذا لم يتم إرجاع أي بيانات، نتوقف
                        console.log(`⏹️ توقف: لا توجد بيانات في الصفحة ${currentPage}`);
                        hasMorePages = false;
                    } else if (totalPagesFromFirstRequest !== null) {
                        // استخدام totalPages من الطلب الأول (من API)
                        if (currentPage >= totalPagesFromFirstRequest) {
                            console.log(`⏹️ توقف: وصلنا للصفحة الأخيرة (${currentPage} >= ${totalPagesFromFirstRequest})`);
                            hasMorePages = false;
                        } else {
                            console.log(`➡️ المتابعة: الانتقال للصفحة ${currentPage + 1}`);
                            currentPage++;
                        }
                    } else if (currentPage >= totalPages) {
                        // إذا لم يكن لدينا totalPages من الطلب الأول، نستخدم totalPages الحالي
                        console.log(`⏹️ توقف: وصلنا للصفحة الأخيرة (${currentPage} >= ${totalPages})`);
                        hasMorePages = false;
                    } else {
                        console.log(`➡️ المتابعة: الانتقال للصفحة ${currentPage + 1}`);
                        currentPage++;
                    }
                } catch (pageError) {
                    // إذا فشل جلب صفحة معينة، نتوقف ونستخدم ما تم جلبه
                    console.warn(`❌ خطأ في جلب الصفحة ${currentPage}:`, pageError);
                    if (allShelters.length === 0) {
                        // إذا لم نتمكن من جلب أي بيانات، نرمي الخطأ
                        throw pageError;
                    }
                    // إذا كان لدينا بيانات، نتوقف ونستخدمها
                    hasMorePages = false;
                }
            }

            console.log(`🏁 انتهت الحلقة. تم جلب ${allShelters.length} مخيم من ${totalCountFromFirstRequest} إجمالي`);

            // التحقق من وجود بيانات للتصدير
            if (allShelters.length === 0) {
                console.error('❌ لم يتم العثور على بيانات للتصدير');
                showError('لم يتم العثور على بيانات للتصدير');
                return;
            }

            console.log(`✅ تم جلب ${allShelters.length} مخيم للتصدير (من أصل ${totalCountFromFirstRequest})`);

            // استخدام جميع المخيمات المحملة للتصدير
            const dataToExport = allShelters.map((shelter, index) => ({
                'الرقم': index + 1,
                'اسم المخيم': shelter.camp_name || '-',
                'المحافظة': shelter.governorate || '-',
                'الحي': shelter.district || '-',
                'العنوان التفصيلي': shelter.detailed_address || '-',
                'عدد الخيام': shelter.tents_count || 0,
                'عدد العائلات': shelter.families_count || 0,
                'اسم المدير': shelter.manager_name || '-',
                'رقم هوية المدير': shelter.manager_id_number || '-',
                'هاتف المدير': shelter.manager_phone || '-',
                'هاتف بديل للمدير': shelter.manager_alternative_phone || '-',
                'وظيفة المدير': shelter.manager_job_description || '-',
                'اسم نائب المدير': shelter.deputy_manager_name || '-',
                'رقم هوية النائب': shelter.deputy_manager_id_number || '-',
                'هاتف النائب': shelter.deputy_manager_phone || '-',
                'هاتف بديل للنائب': shelter.deputy_manager_alternative_phone || '-',
                'وظيفة النائب': shelter.deputy_manager_job_description || '-',
                'ملف Excel': shelter.excel_sheet ? 'يوجد' : 'لا يوجد'
            }));

            const keys = dataToExport.length ? Object.keys(dataToExport[0]) : [];
            const columnWidths = [8, 25, 15, 15, 40, 12, 12, 20, 15, 15, 15, 25, 20, 15, 15, 15, 25, 12];
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('مراكز النزوح');
            worksheet.columns = keys.map((k, i) => ({ header: k, key: k, width: columnWidths[i] || 15 }));
            worksheet.addRows(dataToExport);

            const date = new Date().toISOString().split('T')[0];
            const filename = `مراكز_النزوح_${date}`;

            await downloadWorkbookAsFile(workbook, `${filename}.xlsx`);
            success(`تم تحميل ملف Excel بنجاح! (${dataToExport.length} مخيم)`);
        } catch (error) {
            console.error('خطأ في تصدير ملف Excel:', error);
            showError('حدث خطأ أثناء تصدير الملف');
        } finally {
            setIsDownloading(false);
        }
    };

    const requestSort = (key) => {
        let direction = "ascending";
        if (sortConfig.key === key && sortConfig.direction === "ascending") {
            direction = "descending";
        }
        setSortConfig({ key, direction });
    };

    // Apply frontend filters
    const filteredShelters = React.useMemo(() => {
        let filtered = [...shelters];

        // Filter by governorate - بحث مشابه (جزئي) وليس مطابقة 100%
        if (filters.governorate?.trim()) {
            const govLower = (filters.governorate || '').toLowerCase().trim();
            filtered = filtered.filter(shelter =>
                (shelter.governorate || '').toLowerCase().includes(govLower)
            );
        }

        // Filter by district/area - بحث مشابه في الحي والمنطقة والعنوان واسم المخيم
        if (filters.district?.trim()) {
            const districtLower = (filters.district || '').toLowerCase().trim();
            filtered = filtered.filter(shelter => {
                const districtMatch = (shelter.district || '').toLowerCase().includes(districtLower);
                const addressMatch = (shelter.detailed_address || '').toLowerCase().includes(districtLower);
                const campMatch = (shelter.camp_name || shelter.name || '').toLowerCase().includes(districtLower);
                const govMatch = (shelter.governorate || '').toLowerCase().includes(districtLower);
                return districtMatch || addressMatch || campMatch || govMatch;
            });
        }

        // Filter by families count range
        if (filters.familiesCountMin || filters.familiesCountMax) {
            filtered = filtered.filter(shelter => {
                const count = parseInt(shelter.families_count) || 0;
                const min = filters.familiesCountMin ? parseInt(filters.familiesCountMin) : 0;
                const max = filters.familiesCountMax ? parseInt(filters.familiesCountMax) : Infinity;
                return count >= min && count <= max;
            });
        }

        // Filter by tents count range
        if (filters.tentsCountMin || filters.tentsCountMax) {
            filtered = filtered.filter(shelter => {
                const count = parseInt(shelter.tents_count) || 0;
                const min = filters.tentsCountMin ? parseInt(filters.tentsCountMin) : 0;
                const max = filters.tentsCountMax ? parseInt(filters.tentsCountMax) : Infinity;
                return count >= min && count <= max;
            });
        }

        // Filter by manager name - بحث جزئي
        if (filters.managerName) {
            const managerNameLower = (filters.managerName || '').toLowerCase().trim();
            filtered = filtered.filter(shelter =>
                shelter.manager_name?.toLowerCase().includes(managerNameLower)
            );
        }

        // Filter by manager phone - بحث جزئي
        if (filters.managerPhone) {
            const phoneSearch = (filters.managerPhone || '').trim();
            filtered = filtered.filter(shelter => {
                const managerPhone = shelter.manager_phone?.toString() || '';
                const altPhone = shelter.manager_alternative_phone?.toString() || '';
                return managerPhone.includes(phoneSearch) || altPhone.includes(phoneSearch);
            });
        }

        // Filter by excel file existence
        if (filters.hasExcel !== null) {
            filtered = filtered.filter(shelter => {
                const hasExcel = !!shelter.excel_sheet;
                return filters.hasExcel === hasExcel;
            });
        }

        // ✅ Filter: استبعاد المخيمات المستفيدة
        if (excludeBenefitedShelters) {
            filtered = filtered.filter(shelter => {
                const shelterId = shelter.manager_id_number;
                return !isShelterBenefited(shelterId);
            });
        }

        return filtered;
    }, [shelters, filters, excludeBenefitedShelters, shelterBenefitsCache, allExecutedProjects]);

    const sortedShelters = React.useMemo(() => {
        if (!sortConfig.key) return filteredShelters;
        return [...filteredShelters].sort((a, b) => {
            const aValue = sortConfig.key.split(".").reduce((o, i) => (o ? o[i] : undefined), a);
            const bValue = sortConfig.key.split(".").reduce((o, i) => (o ? o[i] : undefined), b);
            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;
            if (aValue < bValue) return sortConfig.direction === "ascending" ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === "ascending" ? 1 : -1;
            return 0;
        });
    }, [filteredShelters, sortConfig]);

    // ✅ Server-side pagination - البيانات تأتي من API مباشرة
    // ✅ لا حاجة لـ client-side pagination لأن البيانات من API محدودة بـ perPage
    const paginatedShelters = sortedShelters; // ✅ استخدام البيانات مباشرة من API

    // ✅ حساب ما إذا كانت هناك فلترة نشطة
    const hasActiveFilters = React.useMemo(() => {
        const searchQuery = (debouncedSearchQuery || '').trim();
        return activeFiltersCount > 0 || excludeBenefitedShelters || searchQuery.length > 0;
    }, [activeFiltersCount, excludeBenefitedShelters, debouncedSearchQuery]);

    // ✅ تتبع القيم السابقة للفلاتر
    const prevFiltersRef = React.useRef({
        filteredLength: 0,
        perPage: 10,
        hasActiveFilters: false
    });

    // Update total pages based on filtered results (for pagination display)
    React.useEffect(() => {
        // ✅ حساب عدد الصفحات بناءً على النتائج المفلترة (للعرض)
        if (hasActiveFilters) {
            // ✅ عند وجود فلترة، نستخدم عدد النتائج المفلترة
            setTotalPages(Math.ceil(filteredShelters.length / perPage));
        } else {
            // ✅ بدون فلترة، نستخدم العدد الإجمالي من API
            setTotalPages(Math.ceil(totalShelters / perPage));
        }

        // ✅ إعادة تعيين الصفحة فقط عند تغيير الفلاتر أو perPage، وليس عند تغيير currentPage
        const filtersChanged =
            prevFiltersRef.current.filteredLength !== filteredShelters.length ||
            prevFiltersRef.current.perPage !== perPage ||
            prevFiltersRef.current.hasActiveFilters !== hasActiveFilters;

        if (filtersChanged) {
            setCurrentPage(1);
            // ✅ تحديث القيم السابقة
            prevFiltersRef.current = {
                filteredLength: filteredShelters.length,
                perPage: perPage,
                hasActiveFilters: hasActiveFilters
            };
        }
    }, [filteredShelters.length, perPage, totalShelters, hasActiveFilters]);

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
                <div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div>
            </td>
            <td className="p-4">
                <div className="flex items-center justify-center gap-3">
                    <div className="h-6 bg-gradient-to-r from-sky-100 to-sky-200 rounded-full w-20"></div>
                    <div className="h-6 bg-gradient-to-r from-orange-100 to-orange-200 rounded-full w-20"></div>
                </div>
            </td>
            <td className="p-4">
                <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-40 mx-auto"></div>
                    <div className="h-3 bg-gray-200 rounded w-44 mx-auto"></div>
                </div>
            </td>
            <td className="p-4">
                <div className="h-8 bg-gradient-to-r from-orange-100 to-orange-200 rounded-xl w-24 mx-auto"></div>
            </td>
            <td className="p-4">
                <div className="flex items-center justify-center gap-2">
                    <div className="h-8 w-8 bg-gray-200 rounded-xl"></div>
                    <div className="h-8 w-8 bg-gray-200 rounded-xl"></div>
                </div>
            </td>
        </tr>
    );

    return (
        <SectionPasswordProtection
            sectionName="shelters"
            displayName="قسم مراكز النزوح"
        >
            <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
                {/* Animated Background Elements */ }
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                    <div className="absolute top-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-40 right-40 w-80 h-80 bg-sky-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
                </div>

                <div className="relative max-w-7xl mx-auto">
                    {/* Header */ }
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 mb-6">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-gradient-to-br from-sky-400 to-sky-500 rounded-2xl shadow-lg shadow-sky-200">
                                    <Home className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
                                        بيانات مراكز النزوح
                                    </h1>
                                    <p className="text-gray-600 mt-1">
                                        إجمالي السجلات: { totalSheltersFromAPI > 0 ? totalSheltersFromAPI : totalShelters }
                                        { (activeFiltersCount > 0 || excludeBenefitedShelters || (debouncedSearchQuery || '').trim()) && filteredShelters.length !== totalSheltersFromAPI && (
                                            <span className="text-gray-500"> | المعروض بعد الفلترة: { filteredShelters.length }</span>
                                        ) }
                                    </p>
                                </div>
                            </div>

                            {/* زر تحميل Excel */ }
                            <button
                                onClick={ handleDownloadExcel }
                                disabled={ isDownloading || shelters.length === 0 }
                                className={ `flex items-center gap-3 px-6 py-3 rounded-2xl font-medium transition-all duration-300 shadow-lg ${isDownloading || shelters.length === 0
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-green-400 to-green-500 text-white hover:from-green-500 hover:to-green-600 hover:scale-105 shadow-green-200'
                                    }` }
                            >
                                { isDownloading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        <span>جاري التحميل...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-5 h-5" />
                                        <span>تحميل Excel</span>
                                    </>
                                ) }
                            </button>
                        </div>
                    </div>

                    {/* Search and Filter */ }
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 mb-6">
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="flex-1 relative group">
                                <input
                                    type="text"
                                    className="w-full px-12 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg focus:shadow-sky-100 hover:border-sky-300"
                                    placeholder="البحث عن مركز نزوح..."
                                    value={ searchQuery }
                                    onChange={ (e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    } }
                                />
                                <Search
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-sky-500 transition-colors duration-300"
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

                            {/* ✅ Checkbox لاستبعاد المخيمات المستفيدة */ }
                            { isProjectCoordinator && (
                                <div className="flex items-center gap-3 px-4 py-2 bg-green-50 border-2 border-green-200 rounded-2xl">
                                    <input
                                        type="checkbox"
                                        id="exclude-benefited"
                                        checked={ excludeBenefitedShelters }
                                        onChange={ (e) => {
                                            setExcludeBenefitedShelters(e.target.checked);
                                            setCurrentPage(1);
                                        } }
                                        disabled={ isLoadingExecutedProjects }
                                        className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2 cursor-pointer disabled:opacity-50"
                                    />
                                    <label
                                        htmlFor="exclude-benefited"
                                        className="text-sm font-medium text-green-700 cursor-pointer flex items-center gap-2"
                                    >
                                        { isLoadingExecutedProjects ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                                <span>جاري التحميل...</span>
                                            </>
                                        ) : (
                                            <span>استبعاد المخيمات المستفيدة</span>
                                        ) }
                                    </label>
                                </div>
                            ) }

                            <button
                                onClick={ () => setIsFilterModalOpen(true) }
                                className={ `flex items-center gap-2 px-6 py-4 rounded-2xl transition-all duration-300 font-medium relative ${activeFiltersCount > 0
                                    ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-200 hover:from-orange-500 hover:to-orange-600"
                                    : "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 hover:from-orange-200 hover:to-orange-300"
                                    }` }
                            >
                                <Filter className="w-5 h-5" />
                                <span>فلترة متقدمة</span>
                                { activeFiltersCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                                        { activeFiltersCount }
                                    </span>
                                ) }
                            </button>
                        </div>
                    </div>

                    {/* Table */ }
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-sky-50 to-orange-50 border-b border-sky-100">
                                        <th
                                            onClick={ () => requestSort("camp_name") }
                                            className="p-4 text-right font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>معلومات المركز</span>
                                                <ArrowUpDown className="w-4 h-4 text-gray-400 group-hover:text-sky-500 transition-colors duration-300" />
                                            </div>
                                        </th>
                                        <th
                                            onClick={ () => requestSort("governorate") }
                                            className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <MapPin className="w-4 h-4 text-orange-500" />
                                                <span>الموقع</span>
                                            </div>
                                        </th>
                                        <th
                                            onClick={ () => requestSort("families_count") }
                                            className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <Users className="w-4 h-4 text-sky-500" />
                                                <span>الأعداد</span>
                                            </div>
                                        </th>
                                        <th className="p-4 text-center font-semibold text-gray-700">
                                            <div className="flex items-center justify-center gap-2">
                                                <Phone className="w-4 h-4 text-sky-500" />
                                                <span>التواصل</span>
                                            </div>
                                        </th>
                                        <th className="p-4 text-center font-semibold text-gray-700">
                                            الملف
                                        </th>
                                        <th
                                            onClick={ () => requestSort("created_at") }
                                            className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <Calendar className="w-4 h-4 text-green-500" />
                                                <span>تاريخ التسجيل</span>
                                                <ArrowUpDown className="w-4 h-4 text-gray-400 group-hover:text-sky-500 transition-colors duration-300" />
                                            </div>
                                        </th>
                                        <th
                                            onClick={ () => requestSort("updated_at") }
                                            className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <Clock className="w-4 h-4 text-blue-500" />
                                                <span>تاريخ التحديث</span>
                                                <ArrowUpDown className="w-4 h-4 text-gray-400 group-hover:text-sky-500 transition-colors duration-300" />
                                            </div>
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
                                            .map((_, idx) => <SkeletonRow key={ idx } />)
                                    ) : paginatedShelters.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center p-12">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full">
                                                        <Home className="w-12 h-12 text-gray-400" />
                                                    </div>
                                                    <p className="text-gray-500 text-lg">لا توجد بيانات متاحة</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedShelters.map((shelter, index) => (
                                            <tr
                                                key={ shelter.manager_id_number || shelter._id || `${shelter.camp_name}-${index}` }
                                                className={ `border-b border-gray-100 transition-all duration-300 hover:bg-gradient-to-r hover:from-sky-50/50 hover:to-orange-50/50 ${hoveredRow === index ? "scale-[1.01] shadow-lg" : ""
                                                    }` }
                                                onMouseEnter={ () => setHoveredRow(index) }
                                                onMouseLeave={ () => setHoveredRow(null) }
                                            >
                                                {/* معلومات المركز */ }
                                                <td className="p-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative group">
                                                            <div className="absolute inset-0 bg-gradient-to-br from-sky-400 to-orange-400 rounded-2xl blur-sm opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                                                            <div className="relative h-14 w-14 flex items-center justify-center rounded-2xl border-2 border-white shadow-md bg-white">
                                                                <Home className="w-7 h-7 text-sky-500" />
                                                            </div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className={ `font-semibold ${isShelterBenefited(shelter.manager_id_number) ? 'text-green-600' : 'text-gray-800'}` }>
                                                                    { shelter.camp_name }
                                                                </p>
                                                                { isShelterBenefited(shelter.manager_id_number) && (
                                                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                                        <CheckCircle className="w-3 h-3" />
                                                                        <span>مستفيد</span>
                                                                    </div>
                                                                ) }
                                                            </div>
                                                            { shelter.manager_id_number && (
                                                                <p className="text-sm text-gray-500">هوية المدير: { shelter.manager_id_number }</p>
                                                            ) }
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* الموقع */ }
                                                <td className="p-4 text-center">
                                                    <span className="text-gray-700">{ shelter.detailed_address || "-" }</span>
                                                </td>

                                                {/* الأعداد */ }
                                                <td className="p-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-sky-100 to-sky-200 text-sky-700">
                                                            أسر: { formatNumber(shelter.families_count) }
                                                        </span>
                                                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700">
                                                            خيام: { formatNumber(shelter.tents_count) }
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* التواصل */ }
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col gap-1 text-sm text-gray-700">
                                                        <span>
                                                            <span className="font-medium">المدير:</span> { shelter.manager_name || "-" }{ " " }
                                                            { shelter.manager_phone && (
                                                                <span className="text-gray-500">- { shelter.manager_phone }</span>
                                                            ) }
                                                        </span>
                                                        <span>
                                                            <span className="font-medium">النائب:</span> { shelter.deputy_manager_name || "-" }{ " " }
                                                            { shelter.deputy_manager_phone && (
                                                                <span className="text-gray-500">- { shelter.deputy_manager_phone }</span>
                                                            ) }
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* الملف */ }
                                                <td className="p-4 text-center">
                                                    { shelter.excel_sheet ? (
                                                        <a
                                                            href={ `${API_BASE_URL}/excel/${shelter.manager_id_number}` }
                                                            download
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl hover:from-green-500 hover:to-green-600 transform hover:scale-105 transition-all duration-300 shadow-md shadow-green-200"
                                                            title="تحميل الملف"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                            تحميل
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    ) }
                                                </td>

                                                {/* تاريخ التسجيل */ }
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-sm text-gray-700 font-medium">
                                                            { formatDate(shelter.created_at) }
                                                        </span>
                                                        { shelter.created_at && (
                                                            <span className="text-xs text-gray-500">
                                                                { new Date(shelter.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) }
                                                            </span>
                                                        ) }
                                                    </div>
                                                </td>

                                                {/* تاريخ التحديث */ }
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-sm text-gray-700 font-medium">
                                                            { formatDate(shelter.updated_at) }
                                                        </span>
                                                        { shelter.updated_at && (
                                                            <span className="text-xs text-gray-500">
                                                                { new Date(shelter.updated_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) }
                                                            </span>
                                                        ) }
                                                    </div>
                                                </td>

                                                {/* الإجراءات */ }
                                                <td className="p-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        { isProjectCoordinator && (
                                                            <button
                                                                onClick={ () => handleOpenPreview(shelter) }
                                                                className="p-2 bg-gradient-to-r from-purple-400 to-purple-500 text-white rounded-xl hover:from-purple-500 hover:to-purple-600 transform hover:scale-110 transition-all duration-300 shadow-md shadow-purple-200"
                                                                title="معاينة معلومات الاستفادة"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        ) }
                                                        <button
                                                            onClick={ () => {
                                                                setSelectedShelterId(shelter.manager_id_number);
                                                                setIsEditModalOpen(true);
                                                            } }
                                                            className="p-2 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-xl hover:from-sky-500 hover:to-sky-600 transform hover:scale-110 transition-all duration-300 shadow-md shadow-sky-200"
                                                            title="تعديل"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={ () => {
                                                                setShelterToDelete(shelter);
                                                                setIsDeleteModalOpen(true);
                                                            } }
                                                            className="p-2 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-xl hover:from-red-500 hover:to-red-600 transform hover:scale-110 transition-all duration-300 shadow-md shadow-red-200"
                                                            title="حذف"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) }
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */ }
                        <div className="bg-gradient-to-r from-sky-50 to-orange-50 p-6 border-t border-sky-100">
                            <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-600">عرض</span>
                                    <select
                                        className="px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-medium focus:border-sky-400 focus:outline-none transition-colors duration-300 cursor-pointer hover:border-sky-300"
                                        value={ perPage }
                                        onChange={ (e) => {
                                            setPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        } }
                                    >
                                        <option value={ 10 }>10</option>
                                        <option value={ 20 }>20</option>
                                        <option value={ 30 }>30</option>
                                    </select>
                                    <span className="text-gray-600">سجلات</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        className={ `p-2 rounded-xl transition-all duration-300 ${currentPage === 1
                                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                            : "bg-white border-2 border-sky-200 text-sky-600 hover:bg-sky-50 hover:border-sky-400 hover:scale-110 shadow-md"
                                            }` }
                                        disabled={ currentPage === 1 }
                                        onClick={ () => setCurrentPage(currentPage - 1) }
                                    >
                                        <ChevronRight size={ 20 } />
                                    </button>

                                    <div className="flex items-center gap-2 px-4">
                                        { [...Array(Math.min(5, totalPages))].map((_, i) => {
                                            const pageNum = i + 1;
                                            return (
                                                <button
                                                    key={ pageNum }
                                                    onClick={ () => setCurrentPage(pageNum) }
                                                    className={ `w-10 h-10 rounded-xl font-medium transition-all duration-300 ${currentPage === pageNum
                                                        ? "bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-lg shadow-sky-200 scale-110"
                                                        : "bg-white border-2 border-gray-200 text-gray-600 hover:border-sky-300 hover:scale-105"
                                                        }` }
                                                >
                                                    { pageNum }
                                                </button>
                                            );
                                        }) }
                                        { totalPages > 5 && (
                                            <>
                                                <span className="text-gray-400">...</span>
                                                <button
                                                    onClick={ () => setCurrentPage(totalPages) }
                                                    className={ `w-10 h-10 rounded-xl font-medium transition-all duration-300 ${currentPage === totalPages
                                                        ? "bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-lg shadow-sky-200 scale-110"
                                                        : "bg-white border-2 border-gray-200 text-gray-600 hover:border-sky-300 hover:scale-105"
                                                        }` }
                                                >
                                                    { totalPages }
                                                </button>
                                            </>
                                        ) }
                                    </div>

                                    <button
                                        className={ `p-2 rounded-xl transition-all duration-300 ${currentPage === totalPages || totalPages === 0
                                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                            : "bg-white border-2 border-sky-200 text-sky-600 hover:bg-sky-50 hover:border-sky-400 hover:scale-110 shadow-md"
                                            }` }
                                        disabled={ currentPage === totalPages || totalPages === 0 }
                                        onClick={ () => setCurrentPage(currentPage + 1) }
                                    >
                                        <ChevronLeft size={ 20 } />
                                    </button>
                                </div>

                                <div className="text-gray-600">
                                    <span className="font-medium">صفحة { currentPage }</span> من{ " " }
                                    <span className="font-medium">{ totalPages }</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Modal */ }
                <EditShelterModal
                    isOpen={ isEditModalOpen }
                    onClose={ () => {
                        setIsEditModalOpen(false);
                        setSelectedShelterId(null);
                    } }
                    shelterId={ selectedShelterId }
                    onUpdateSuccess={ handleUpdateSuccess }
                />

                {/* Preview Benefits Modal - فقط لمنسق المشاريع */ }
                { isProjectCoordinator && isPreviewModalOpen && selectedShelterForPreview && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300"
                        dir="rtl"
                    >
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                            onClick={ () => {
                                setIsPreviewModalOpen(false);
                                setSelectedShelterForPreview(null);
                                setShelterBenefits([]);
                            } }
                        />
                        <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300">
                            {/* Header */ }
                            <div className="sticky top-0 bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200 p-6 flex items-center justify-between z-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gradient-to-br from-purple-400 to-purple-500 rounded-2xl">
                                        <Eye className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-800">معلومات الاستفادة</h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            { selectedShelterForPreview.camp_name || selectedShelterForPreview.name }
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={ () => {
                                        setIsPreviewModalOpen(false);
                                        setSelectedShelterForPreview(null);
                                        setShelterBenefits([]);
                                    } }
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Content */ }
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                                { loadingBenefits ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                                        <span className="mr-4 text-gray-600">جاري التحميل...</span>
                                    </div>
                                ) : shelterBenefits.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-xl font-semibold text-gray-600 mb-2">لم يستفد المخيم من أي مشروع</p>
                                        <p className="text-sm text-gray-500">لا توجد مشاريع منفذة لهذا المخيم</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                                            <div className="flex items-center gap-2 text-green-800">
                                                <Package className="w-5 h-5" />
                                                <span className="font-semibold">
                                                    عدد المشاريع المنفذة: { shelterBenefits.length }
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            { shelterBenefits.map((benefit, index) => (
                                                <div
                                                    key={ benefit.id || index }
                                                    className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 hover:shadow-md transition-all duration-300"
                                                >
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">كود المشروع</p>
                                                            <p className="font-semibold text-gray-800">{ benefit.serial_number || '-' }</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">اسم المشروع</p>
                                                            <p className="font-semibold text-gray-800">{ benefit.project_name || '-' }</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">نوع المشروع</p>
                                                            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm font-medium">
                                                                { benefit.project_type || '-' }
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">الكمية</p>
                                                            <p className="font-semibold text-gray-800">{ benefit.quantity || 0 }</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">المتبرع</p>
                                                            <p className="font-medium text-gray-700">{ benefit.donor_name || '-' }</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">تاريخ التنفيذ</p>
                                                            <div className="flex items-center gap-2 text-gray-700">
                                                                <Calendar className="w-4 h-4" />
                                                                <span className="font-medium">
                                                                    { benefit.execution_date
                                                                        ? formatDate(benefit.execution_date)
                                                                        : '-' }
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )) }
                                        </div>
                                    </div>
                                ) }
                            </div>
                        </div>
                    </div>
                ) }

                {/* Delete Confirmation Modal */ }
                { isDeleteModalOpen && shelterToDelete && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300"
                    >
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                            onClick={ () => {
                                setIsDeleteModalOpen(false);
                                setShelterToDelete(null);
                            } }
                        />
                        <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-md w-full transform transition-all duration-300">
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-red-100 rounded-full">
                                        <Trash2 className="w-6 h-6 text-red-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">تأكيد الحذف</h3>
                                </div>
                                <p className="text-gray-600 mb-6">
                                    هل أنت متأكد من حذف المخيم <span className="font-bold text-gray-800">{ shelterToDelete.camp_name }</span>؟
                                    <br />
                                    <span className="text-sm text-red-600">لا يمكن التراجع عن هذا الإجراء.</span>
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={ () => {
                                            setIsDeleteModalOpen(false);
                                            setShelterToDelete(null);
                                        } }
                                        disabled={ isDeleting }
                                        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300 font-medium disabled:opacity-50"
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        onClick={ handleDelete }
                                        disabled={ isDeleting }
                                        className="px-6 py-2 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-xl hover:from-red-500 hover:to-red-600 transition-all duration-300 font-medium shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        { isDeleting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                جاري الحذف...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 className="w-4 h-4" />
                                                حذف
                                            </>
                                        ) }
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) }

                {/* Advanced Filter Modal */ }
                { isFilterModalOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300"
                        dir="rtl"
                    >
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                            onClick={ () => setIsFilterModalOpen(false) }
                        />
                        <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300">
                            {/* Header */ }
                            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl">
                                        <Filter className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-800">فلترة متقدمة</h3>
                                        <p className="text-sm text-green-600 mt-1 flex items-center gap-2">
                                            ⚡ فلترة فورية وسريعة - النتائج تظهر مباشرة!
                                        </p>
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
                                {/* Governorate Filter */ }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <MapPin className="w-4 h-4 inline ml-1" />
                                        المحافظة
                                    </label>
                                    <select
                                        value={ filters.governorate }
                                        onChange={ (e) => setFilters({ ...filters, governorate: e.target.value }) }
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg"
                                    >
                                        <option value="">جميع المحافظات</option>
                                        { governorates.map((gov) => (
                                            <option key={ gov } value={ gov }>
                                                { gov }
                                            </option>
                                        )) }
                                    </select>
                                </div>

                                {/* District Filter */ }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <MapPin className="w-4 h-4 inline ml-1" />
                                        الحي / المنطقة
                                    </label>
                                    <input
                                        type="text"
                                        value={ filters.district }
                                        onChange={ (e) => setFilters({ ...filters, district: e.target.value }) }
                                        placeholder="ابحث عن حي أو منطقة..."
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg"
                                    />
                                </div>

                                {/* Families Count Range */ }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <Users className="w-4 h-4 inline ml-1" />
                                        عدد الأسر
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <input
                                                type="number"
                                                value={ filters.familiesCountMin }
                                                onChange={ (e) => setFilters({ ...filters, familiesCountMin: e.target.value }) }
                                                placeholder="الحد الأدنى"
                                                min="0"
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                value={ filters.familiesCountMax }
                                                onChange={ (e) => setFilters({ ...filters, familiesCountMax: e.target.value }) }
                                                placeholder="الحد الأقصى"
                                                min="0"
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Tents Count Range */ }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <Home className="w-4 h-4 inline ml-1" />
                                        عدد الخيام
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <input
                                                type="number"
                                                value={ filters.tentsCountMin }
                                                onChange={ (e) => setFilters({ ...filters, tentsCountMin: e.target.value }) }
                                                placeholder="الحد الأدنى"
                                                min="0"
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                value={ filters.tentsCountMax }
                                                onChange={ (e) => setFilters({ ...filters, tentsCountMax: e.target.value }) }
                                                placeholder="الحد الأقصى"
                                                min="0"
                                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Manager Name Filter */ }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <Phone className="w-4 h-4 inline ml-1" />
                                        اسم المدير
                                    </label>
                                    <input
                                        type="text"
                                        value={ filters.managerName }
                                        onChange={ (e) => setFilters({ ...filters, managerName: e.target.value }) }
                                        placeholder="ابحث عن اسم المدير..."
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg"
                                    />
                                </div>

                                {/* Manager Phone Filter */ }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <Phone className="w-4 h-4 inline ml-1" />
                                        رقم هاتف المدير
                                    </label>
                                    <input
                                        type="text"
                                        value={ filters.managerPhone }
                                        onChange={ (e) => setFilters({ ...filters, managerPhone: e.target.value }) }
                                        placeholder="ابحث عن رقم الهاتف..."
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg"
                                    />
                                </div>

                                {/* Excel File Filter */ }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <Download className="w-4 h-4 inline ml-1" />
                                        ملف Excel
                                    </label>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={ () => setFilters({ ...filters, hasExcel: null }) }
                                            className={ `flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300 ${filters.hasExcel === null
                                                ? "bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-lg"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }` }
                                        >
                                            الكل
                                        </button>
                                        <button
                                            onClick={ () => setFilters({ ...filters, hasExcel: true }) }
                                            className={ `flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300 ${filters.hasExcel === true
                                                ? "bg-gradient-to-r from-green-400 to-green-500 text-white shadow-lg"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }` }
                                        >
                                            يوجد ملف
                                        </button>
                                        <button
                                            onClick={ () => setFilters({ ...filters, hasExcel: false }) }
                                            className={ `flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-300 ${filters.hasExcel === false
                                                ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-lg"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }` }
                                        >
                                            لا يوجد ملف
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */ }
                            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex items-center justify-between gap-4">
                                <button
                                    onClick={ resetFilters }
                                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300 font-medium"
                                >
                                    <RotateCcw className="w-5 h-5" />
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
                                        className="px-6 py-3 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-xl hover:from-sky-500 hover:to-sky-600 transition-all duration-300 font-medium shadow-lg shadow-sky-200"
                                    >
                                        تطبيق الفلترة
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) }

                <style>{ `
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
            </div>
        </SectionPasswordProtection>
    );
};

export default Shelters;