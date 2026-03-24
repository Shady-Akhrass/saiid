/**
 * Advanced Projects Management Component
 * 
 * هذا المكون يستخدم ملف التكوين project-proposals-fields-config.js لضمان:
 * - إرسال فقط الحقول الحقيقية من قاعدة البيانات
 * - استخراج التغييرات فقط (وليس جميع الحقول)
 * - إزالة الحقول المحسوبة والعلاقات تلقائياً
 * 
 * @see ../../../utils/project-proposals-fields-config.js
 * @see md/PROJECT_PROPOSALS_FIELDS_DOCUMENTATION.md
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import PageLoader from '../../../components/PageLoader';
import Unauthorized from '../components/Unauthorized';
import {
    Search,
    Filter,
    Eye,
    Edit,
    ChevronLeft,
    ChevronRight,
    X,
    Users,
    Camera,
    Film,
    Calendar,
    Clock,
    Settings,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Sparkles,
    MapPin,
    Heart,
    Activity,
    BookOpen,
    UserCheck,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { getProjectCode } from '../../../utils/helpers';
// ✅ استيراد دوال وثوابت من ملف التكوين
import {
    PROJECT_STATUSES,
    filterRealFields,
    extractChanges,
    isRealDatabaseField,
    isComputedField,
    isRelationshipField,
    FIELD_LABELS_AR
} from '../../../utils/project-proposals-fields-config';
// ✅ استيراد مكون اختيار المخيم مع البحث
import ShelterSelect from '../../admin/projects/ShelterSelect';

// ترتيب الحالات للتحقق من الرجوع للخلف
const STATUS_ORDER = {
    'جديد': 1,
    'قيد التوريد': 2,
    'تم التوريد': 3,
    'قيد التوزيع': 4,
    'مسند لباحث': 5,
    'جاهز للتنفيذ': 6,
    'تم اختيار المخيم': 7,
    'قيد التنفيذ': 8,
    'تم التنفيذ': 9,
    'في المونتاج': 10,
    'تم المونتاج': 11,
    'يجب إعادة المونتاج': 11,
    'وصل للمتبرع': 12,
    'منتهي': 13,
    'ملغى': 0, // حالات خاصة - لا يتم حذف البيانات
    'مؤجل': 0, // حالات خاصة - لا يتم حذف البيانات
};

const AdvancedProjectsManagement = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 20,
        total: 0,
    });

    // Filters state
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        project_type: '',
        project_type_id: '',
        subcategory_id: '',
        shelter_id: '',
        team_id: '',
        researcher_id: '',
        photographer_id: '',
        montage_producer_id: '',
        created_from: '',
        created_to: '',
        execution_from: '',
        execution_to: '',
        montage_from: '',
        montage_to: '',
        sort_by: 'created_at',
        sort_order: 'desc',
        page: 1,
        per_page: 20,
        is_urgent: '', // فلتر المشاريع العاجلة
    });

    const [showFilters, setShowFilters] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [updateFormData, setUpdateFormData] = useState({});
    const [statusFormData, setStatusFormData] = useState({ status: '', note: '' });
    const [updating, setUpdating] = useState(false);
    const [statusChangeNote, setStatusChangeNote] = useState(''); // ملاحظة لتسجيل تغيير الحالة في التحديث المتقدم

    // ✅ Orphan selection state
    const [showOrphanModal, setShowOrphanModal] = useState(false);
    const [selectedOrphans, setSelectedOrphans] = useState([]);
    const [orphanModalType, setOrphanModalType] = useState('update'); // 'filter' or 'update'
    const [isLoadingOrphans, setIsLoadingOrphans] = useState(false);
    const [eligibleOrphans, setEligibleOrphans] = useState([]);
    const [orphanFilters, setOrphanFilters] = useState({
        search: '',
        governorate: '',
        gender: '',
        min_age: '',
        max_age: '',
        mother_status: '',
        health_status: '',
    });

    // Dropdown lists
    const [projectTypes, setProjectTypes] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [teams, setTeams] = useState([]);
    const [researchers, setResearchers] = useState([]);
    const [orphanGroups, setOrphanGroups] = useState([]); // Add orphan groups state
    const [photographers, setPhotographers] = useState([]);
    const [producers, setProducers] = useState([]);
    const [shelters, setShelters] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [surplusCategories, setSurplusCategories] = useState([]);
    const [loadingLists, setLoadingLists] = useState(false);

    // Check permissions
    const userRole = useMemo(() => {
        if (!user) return '';
        return (
            user.role?.toLowerCase?.() ||
            user.userRole?.toLowerCase?.() ||
            user.user_role?.toLowerCase?.() ||
            user.role_name?.toLowerCase?.() ||
            user.role ||
            ''
        );
    }, [user]);

    const isAuthorized = useMemo(() => {
        return (
            userRole === 'admin' ||
            userRole === 'administrator' ||
            userRole === 'مدير' ||
            userRole === 'project_manager' ||
            userRole === 'مدير مشاريع'
        );
    }, [userRole]);

    // Fetch dropdown lists
    useEffect(() => {
        if (!isAuthorized) return;

        const fetchLists = async () => {
            setLoadingLists(true);
            try {
                // Project types
                try {
                    const typesRes = await apiClient.get('/project-types', {
                        params: { _t: Date.now() },
                    });
                    if (typesRes.data.success) {
                        setProjectTypes(typesRes.data.data || typesRes.data.types || []);
                    }
                } catch (error) {
                    console.warn('Failed to fetch project types:', error);
                }

                // Teams
                try {
                    const teamsRes = await apiClient.get('/teams', {
                        params: { per_page: 100, _t: Date.now() },
                    });
                    if (teamsRes.data.success) {
                        setTeams(teamsRes.data.teams || teamsRes.data.data || []);
                    }
                } catch (error) {
                    console.warn('Failed to fetch teams:', error);
                }

                // Researchers
                try {
                    const researchersRes = await apiClient.get('/team-personnel/available', {
                        params: { _t: Date.now() },
                    });
                    if (researchersRes.data.success) {
                        setResearchers(researchersRes.data.researchers || []);
                    }
                } catch (error) {
                    console.warn('Failed to fetch researchers:', error);
                }

                // Orphan Groups
                try {
                    const orphanGroupsRes = await apiClient.get('/orphan-groupings', {
                        params: { _t: Date.now() },
                    });
                    if (orphanGroupsRes.data.success) {
                        const groupings = orphanGroupsRes.data.groupings || orphanGroupsRes.data.data?.groupings || orphanGroupsRes.data.data || [];
                        setOrphanGroups(groupings);
                        if (import.meta.env.DEV) {
                            console.log('✅ Orphan groups loaded:', groupings.length);
                        }
                    }
                } catch (error) {
                    console.warn('Failed to fetch orphan groups:', error);
                }

                // Photographers
                try {
                    const photographersRes = await apiClient.get('/photographers', {
                        params: { per_page: 100, _t: Date.now() },
                    });
                    if (photographersRes.data.success) {
                        setPhotographers(photographersRes.data.photographers || photographersRes.data.data || []);
                    }
                } catch (error) {
                    console.warn('Failed to fetch photographers:', error);
                }

                // Montage producers (optional - may require special permissions)
                try {
                    const producersRes = await apiClient.get('/montage-producers', {
                        params: { per_page: 100, _t: Date.now() },
                        silent: true, // ✅ جعل الطلب صامتاً لتجنب عرض رسائل الخطأ
                    });
                    if (producersRes.data.success) {
                        setProducers(producersRes.data.producers || producersRes.data.data || []);
                    }
                } catch (error) {
                    // Silently fail - montage producers may not be accessible to all users
                    // لا نعرض أي رسائل خطأ لأن الطلب صامت
                }

                // Subcategories (will be filtered by project type)
                try {
                    const subcatsRes = await apiClient.get('/project-subcategories', {
                        params: { _t: Date.now() },
                        timeout: 30000,
                        headers: {
                            'Cache-Control': 'no-cache',
                        }
                    });
                    if (subcatsRes.data.success) {
                        const data = subcatsRes.data.data || [];
                        setSubcategories(data);
                    }
                } catch (error) {
                    if (import.meta.env.DEV) {
                        console.warn('Failed to fetch subcategories:', error);
                    }
                }

                // Shelters
                try {
                    const sheltersRes = await apiClient.get('/shelters', {
                        params: {
                            per_page: 1000,
                            page: 1,
                            all: true,
                            _t: Date.now()
                        },
                        headers: {
                            'Cache-Control': 'no-cache',
                        },
                        timeout: 30000,
                    });

                    // ✅ معالجة أفضل للـ response من السيرفر
                    let sheltersArray = [];

                    if (sheltersRes.data) {
                        // محاولة استخراج المخيمات من أماكن مختلفة في الـ response
                        if (Array.isArray(sheltersRes.data.shelters)) {
                            sheltersArray = sheltersRes.data.shelters;
                        } else if (Array.isArray(sheltersRes.data.data)) {
                            sheltersArray = sheltersRes.data.data;
                        } else if (Array.isArray(sheltersRes.data)) {
                            sheltersArray = sheltersRes.data;
                        } else if (sheltersRes.data.success && Array.isArray(sheltersRes.data.shelters)) {
                            sheltersArray = sheltersRes.data.shelters;
                        } else if (sheltersRes.data.success && Array.isArray(sheltersRes.data.data)) {
                            sheltersArray = sheltersRes.data.data;
                        }
                    }

                    // ✅ جلب الصفحات الإضافية إذا كانت موجودة
                    if (sheltersRes.data?.currentPage && sheltersRes.data?.lastPage && sheltersRes.data.lastPage > 1) {
                        const allShelters = [...sheltersArray];

                        for (let page = 2; page <= sheltersRes.data.lastPage; page++) {
                            try {
                                const pageResponse = await apiClient.get('/shelters', {
                                    params: {
                                        per_page: 1000,
                                        page: page,
                                        _t: Date.now(),
                                    },
                                    headers: {
                                        'Cache-Control': 'no-cache',
                                    },
                                    timeout: 30000,
                                });

                                let pageShelters = [];
                                if (pageResponse.data) {
                                    if (Array.isArray(pageResponse.data.shelters)) {
                                        pageShelters = pageResponse.data.shelters;
                                    } else if (Array.isArray(pageResponse.data.data)) {
                                        pageShelters = pageResponse.data.data;
                                    } else if (Array.isArray(pageResponse.data)) {
                                        pageShelters = pageResponse.data;
                                    }
                                }

                                allShelters.push(...pageShelters);
                            } catch (pageError) {
                                console.warn(`⚠️ Failed to fetch shelters page ${page}:`, pageError);
                            }
                        }

                        setShelters(allShelters);
                    } else {
                        setShelters(sheltersArray);
                    }

                    if (import.meta.env.DEV) {
                        console.log('✅ Fetched shelters:', {
                            count: sheltersArray.length,
                            hasData: sheltersArray.length > 0,
                        });
                    }
                } catch (error) {
                    console.error('❌ Failed to fetch shelters:', error);
                    console.error('Error details:', {
                        message: error.message,
                        response: error.response?.data,
                        status: error.response?.status,
                    });
                    setShelters([]);
                }

                // Currencies
                try {
                    const currenciesRes = await apiClient.get('/currencies', {
                        params: { _t: Date.now() },
                    });
                    if (currenciesRes.data.success) {
                        setCurrencies(currenciesRes.data.currencies || currenciesRes.data.data || []);
                    }
                } catch (error) {
                    console.warn('Failed to fetch currencies:', error);
                }

                // Surplus Categories
                try {
                    const surplusRes = await apiClient.get('/surplus-categories', {
                        params: { is_active: 1, _t: Date.now() },
                    });
                    if (surplusRes.data.success) {
                        setSurplusCategories(surplusRes.data.data || []);
                    }
                } catch (error) {
                    console.warn('Failed to fetch surplus categories:', error);
                }
            } catch (error) {
                console.error('Error fetching lists:', error);
            } finally {
                setLoadingLists(false);
            }
        };

        fetchLists();
    }, [isAuthorized]);

    // Fetch projects with advanced search
    const fetchProjects = async () => {
        if (!isAuthorized) return;

        setLoading(true);
        try {
            const params = new URLSearchParams();

            Object.keys(filters).forEach((key) => {
                const value = filters[key];
                if (value !== '' && value !== null && value !== undefined) {
                    if (Array.isArray(value)) {
                        value.forEach((v) => params.append(`${key}[]`, v));
                    } else {
                        // ✅ تحويل is_urgent من string إلى boolean
                        if (key === 'is_urgent') {
                            params.append(key, value === '1' ? '1' : '0');
                        } else {
                            params.append(key, value);
                        }
                    }
                }
            });

            const response = await apiClient.get(`/admin/project-proposals/advanced-search?${params}`);

            if (response.data.success) {
                // ✅ ترتيب المشاريع: العاجلة أولاً (ما عدا المنتهية)
                const fetchedProjects = response.data.data.projects || [];
                const sortedProjects = [...fetchedProjects].sort((a, b) => {
                    // المشاريع العاجلة أولاً (ما عدا المنتهية)
                    const aIsUrgent = a.is_urgent && a.status !== 'منتهي';
                    const bIsUrgent = b.is_urgent && b.status !== 'منتهي';
                    if (aIsUrgent && !bIsUrgent) return -1;
                    if (!aIsUrgent && bIsUrgent) return 1;
                    // ثم الترتيب حسب التاريخ (أحدث أولاً)
                    const dateA = new Date(a.created_at || a.updated_at || 0);
                    const dateB = new Date(b.created_at || b.updated_at || 0);
                    return dateB - dateA;
                });
                setProjects(sortedProjects);
                setPagination(response.data.data.pagination || {
                    current_page: 1,
                    last_page: 1,
                    per_page: 20,
                    total: 0,
                });
            } else {
                toast.error(response.data.message || 'فشل جلب المشاريع');
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || 'حدث خطأ أثناء جلب المشاريع';
            toast.error(errorMessage);

            if (error.response?.status === 403) {
                // Permission denied - will be handled by authorization check
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) {
            fetchProjects();
        }
    }, [filters.page, filters.per_page, isAuthorized]);

    // Fetch full project details
    const fetchProjectDetails = async (projectId) => {
        try {
            const response = await apiClient.get(`/admin/project-proposals/${projectId}/full-details`);
            if (response.data.success) {
                return response.data.data.project;
            }
            // إذا كان success: false
            const errorMessage = response.data.message || 'فشل جلب تفاصيل المشروع';
            toast.error(errorMessage);
            console.error('API returned success: false', response.data);
            return null;
        } catch (error) {
            console.error('Error fetching project details:', error);

            // عرض رسالة خطأ أكثر تفصيلاً
            let errorMessage = error.response?.data?.message
                || error.response?.data?.error
                || error.message
                || 'فشل جلب تفاصيل المشروع';

            // ✅ معالجة خاصة لأخطاء العلاقات في warehouse items
            if (errorMessage.includes('undefined relationship') && errorMessage.includes('item')) {
                errorMessage = 'خطأ في تحميل أصناف المستودع. يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني.';
                console.warn('⚠️ Backend relationship error detected. This is a backend issue, not frontend.');
                console.warn('The backend model ProjectWarehouseItem is missing the "item" relationship definition.');
            }

            toast.error(`خطأ في جلب تفاصيل المشروع: ${errorMessage}`);

            // عرض تفاصيل الخطأ في console للمطورين
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }

            return null;
        }
    };

    // Handle advanced update
    const handleUpdate = async () => {
        if (!selectedProject) return;

        // ⚠️ تحذير عند الرجوع إلى حالة سابقة
        const oldStatus = selectedProject.status;
        const newStatus = updateFormData.status;

        if (oldStatus && newStatus && oldStatus !== newStatus) {
            const oldOrder = STATUS_ORDER[oldStatus] || 0;
            const newOrder = STATUS_ORDER[newStatus] || 0;

            // التحقق من الرجوع للخلف (حالات خاصة مستثناة)
            if (newOrder > 0 && oldOrder > 0 && newOrder < oldOrder && newStatus !== 'ملغى' && newStatus !== 'مؤجل') {
                const confirmed = window.confirm(
                    `⚠️ تحذير: عند الرجوع إلى "${newStatus}"، سيتم حذف البيانات المرتبطة بالحالات المتقدمة تلقائياً.\n\n` +
                    `هل أنت متأكد من تغيير الحالة؟`
                );
                if (!confirmed) {
                    return; // إلغاء العملية
                }
            }
        }

        setUpdating(true);
        try {
            // ✅ استخدام ملف التكوين: استخراج التغييرات فقط بين المشروع الأصلي والمحدّث
            // هذا يضمن إرسال فقط الحقول التي تغيرت فعلياً
            const changes = extractChanges(selectedProject, updateFormData);

            // ✅ استخدام ملف التكوين: تصفية الحقول الحقيقية فقط
            // إزالة الحقول المحسوبة (مثل remaining_days, amount_in_usd) والعلاقات (مثل currency object)
            let dataToSend = filterRealFields(changes);

            // إضافة ملاحظة تغيير الحالة إذا تم تغيير الحالة
            if (statusChangeNote && oldStatus && newStatus && oldStatus !== newStatus) {
                dataToSend.status_change_note = statusChangeNote;
            }

            // تحويل الحقول الفارغة إلى null
            Object.keys(dataToSend).forEach(key => {
                if (dataToSend[key] === '' || dataToSend[key] === 'null') {
                    dataToSend[key] = null;
                }
            });

            // ✅ التحقق من وجود تغييرات قبل الإرسال
            if (Object.keys(dataToSend).length === 0 && !dataToSend.status_change_note && !updateFormData.selected_orphan_ids) {
                toast.info('لا توجد تغييرات للحفظ');
                setUpdating(false);
                return;
            }

            // ✅ Validation for Sponsorship End Date
            const subcategory = subcategories.find(sub => sub.id === parseInt(updateFormData.subcategory_id || selectedProject.subcategory_id));
            const isOrphanSponsorship = subcategory?.name?.includes('كفالة أيتام') || subcategory?.name_ar?.includes('كفالة أيتام');
            
            if (isOrphanSponsorship && newStatus === 'تم التنفيذ') {
                if (!updateFormData.sponsorship_end_date) {
                    toast.error('تاريخ نهاية الكفالة مطلوب للمشاريع المنفذة');
                    setUpdating(false);
                    return;
                }
                // Include orphan data if not already in changes
                dataToSend.selected_orphan_ids = updateFormData.selected_orphan_ids || selectedProject.selected_orphan_ids;
                dataToSend.sponsorship_start_date = updateFormData.sponsorship_start_date || selectedProject.sponsorship_start_date;
                dataToSend.sponsorship_end_date = updateFormData.sponsorship_end_date || selectedProject.sponsorship_end_date;
                dataToSend.sponsorship_amount = updateFormData.sponsorship_amount || selectedProject.sponsorship_amount;
            }

            // 🔍 Debug: عرض البيانات المرسلة (يمكن إزالته في الإنتاج)
            console.log('📤 Sending update data:', {
                totalFields: Object.keys(dataToSend).length,
                fields: Object.keys(dataToSend),
                data: dataToSend
            });

            const response = await apiClient.patch(
                `/admin/project-proposals/${selectedProject.id}/advanced-update`,
                dataToSend
            );

            if (response.data.success) {
                toast.success('تم تحديث المشروع بنجاح');
                setShowUpdateModal(false);
                setSelectedProject(null);
                setUpdateFormData({});
                setStatusChangeNote('');
                fetchProjects();
            } else {
                toast.error(response.data.message || 'فشل تحديث المشروع');
            }
        } catch (error) {
            console.error('Error updating project:', error);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || 'حدث خطأ أثناء تحديث المشروع';
            toast.error(errorMessage);
        } finally {
            setUpdating(false);
        }
    };

    // ✅ Orphan Selection Logic
    const handleOrphanFilterChange = (key, value) => {
        setOrphanFilters(prev => ({ ...prev, [key]: value }));
    };

    const fetchEligibleOrphans = async (groupId) => {
        if (!groupId) return;
        setIsLoadingOrphans(true);
        try {
            const params = new URLSearchParams();
            Object.keys(orphanFilters).forEach(key => {
                if (orphanFilters[key]) params.append(key, orphanFilters[key]);
            });

            const response = await apiClient.get(`/orphan-groupings/${groupId}/orphans?${params}`);
            if (response.data.success) {
                setEligibleOrphans(response.data.orphans || []);
            }
        } catch (error) {
            console.error('Error fetching eligible orphans:', error);
            toast.error('حدث خطأ أثناء جلب الأيتام المؤهلين');
        } finally {
            setIsLoadingOrphans(false);
        }
    };

    const handleSmartSelect = async (groupId) => {
        if (!groupId) return;
        setIsLoadingOrphans(true);
        try {
            // Find current group to get capacity
            const group = orphanGroups.find(g => g.id === parseInt(groupId));
            
            // ✅ Always select exactly 20 orphans as requested by user
            const targetCount = 20;

            const response = await apiClient.post(`/orphan-groupings/${groupId}/smart-select`, {
                count: targetCount > 0 ? targetCount : 50,
                ...orphanFilters
            });

            if (response.data.success) {
                const selected = response.data.selected_orphans || [];
                setSelectedOrphans(selected);
                toast.success(`تم اختيار ${selected.length} يتيم ذكياً بنجاح (المطلوب: ${targetCount})`);
            }
        } catch (error) {
            console.error('Error in smart select:', error);
            toast.error('حدث خطأ أثناء الاختيار الذكي');
        } finally {
            setIsLoadingOrphans(false);
        }
    };

    const handleConfirmOrphanSelection = () => {
        if (orphanModalType === 'update') {
            setUpdateFormData(prev => ({
                ...prev,
                selected_orphan_ids: selectedOrphans.map(o => o.orphan_id_number || o.id)
            }));
        } else {
            setFilters(prev => ({
                ...prev,
                selected_orphan_ids: selectedOrphans.map(o => o.orphan_id_number || o.id)
            }));
        }
        setShowOrphanModal(false);
    };

    useEffect(() => {
        if (showOrphanModal) {
            const groupId = orphanModalType === 'update' 
                ? updateFormData.orphan_group_id 
                : filters.orphan_group_id;
            if (groupId) {
                fetchEligibleOrphans(groupId);
            }
        }
    }, [showOrphanModal, orphanFilters, orphanModalType, updateFormData.orphan_group_id, filters.orphan_group_id]);

    // Handle status change
    const handleStatusChange = async () => {
        if (!selectedProject || !statusFormData.status) return;

        // ⚠️ تحذير عند الرجوع إلى حالة سابقة
        const oldStatus = selectedProject.status;
        const newStatus = statusFormData.status;

        if (oldStatus && newStatus) {
            const oldOrder = STATUS_ORDER[oldStatus] || 0;
            const newOrder = STATUS_ORDER[newStatus] || 0;

            // التحقق من الرجوع للخلف (حالات خاصة مستثناة)
            if (newOrder > 0 && oldOrder > 0 && newOrder < oldOrder && newStatus !== 'ملغى' && newStatus !== 'مؤجل') {
                const confirmed = window.confirm(
                    `⚠️ تحذير: عند الرجوع إلى "${newStatus}"، سيتم حذف البيانات المرتبطة بالحالات المتقدمة تلقائياً.\n\n` +
                    `هل أنت متأكد من تغيير الحالة؟`
                );
                if (!confirmed) {
                    return; // إلغاء العملية
                }
            }
        }

        setUpdating(true);
        try {
            const payload = {
                status: statusFormData.status,
                note: statusFormData.note || 'تم تغيير الحالة من لوحة الإدارة المتقدمة',
            };

            // ✅ Add sponsorship data if executing
            const subcategory = selectedProject.subcategory || subcategories.find(sub => sub.id === parseInt(selectedProject.subcategory_id));
            const isOrphanSponsorship = subcategory?.name?.includes('كفالة أيتام') || subcategory?.name_ar?.includes('كفالة أيتام');

            if (isOrphanSponsorship && newStatus === 'تم التنفيذ') {
                if (!selectedProject.sponsorship_end_date && !updateFormData.sponsorship_end_date) {
                    toast.error('يرجى تحديد تاريخ نهاية الكفالة في التحديث المتقدم أولاً');
                    setUpdating(false);
                    return;
                }
                payload.selected_orphan_ids = selectedProject.selected_orphan_ids || updateFormData.selected_orphan_ids;
                payload.sponsorship_start_date = selectedProject.sponsorship_start_date || updateFormData.sponsorship_start_date;
                payload.sponsorship_end_date = selectedProject.sponsorship_end_date || updateFormData.sponsorship_end_date;
                payload.sponsorship_amount = selectedProject.sponsorship_amount || updateFormData.sponsorship_amount;
            }

            const response = await apiClient.post(
                `/admin/project-proposals/${selectedProject.id}/change-status`,
                payload
            );

            if (response.data.success) {
                toast.success(
                    `تم تغيير الحالة من "${response.data.data.old_status}" إلى "${response.data.data.new_status}"`
                );
                setShowStatusModal(false);
                setSelectedProject(null);
                setStatusFormData({ status: '', note: '' });
                // ⚠️ مهم: إعادة جلب بيانات المشروع لعرض التحديثات
                fetchProjects();
            } else {
                toast.error(response.data.message || 'فشل تغيير الحالة');
            }
        } catch (error) {
            console.error('Error changing status:', error);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || 'حدث خطأ أثناء تغيير الحالة';
            toast.error(errorMessage);
        } finally {
            setUpdating(false);
        }
    };

    // Open update modal
    const openUpdateModal = async (project) => {
        if (!project || !project.id) {
            toast.error('مشروع غير صالح');
            return;
        }

        try {
            const details = await fetchProjectDetails(project.id);
            if (details) {
                setSelectedProject(details);
                // ✅ تصفية البيانات لإزالة الحقول المحسوبة والعلاقات قبل العرض
                // (يمكن الاحتفاظ بها للعرض فقط، لكن عند الإرسال سيتم تصفيتها)
                setUpdateFormData(details);
                setStatusChangeNote(''); // إعادة تعيين ملاحظة تغيير الحالة
                setShowUpdateModal(true);
            } else {
                // إذا فشل جلب التفاصيل، لا نفتح المودال
                console.warn('Failed to fetch project details, modal not opened');
            }
        } catch (error) {
            console.error('Error in openUpdateModal:', error);
            toast.error('حدث خطأ أثناء فتح نموذج التحديث');
        }
    };

    // Handle clear field (nullify)
    const handleClearField = (fieldName) => {
        setUpdateFormData({ ...updateFormData, [fieldName]: null });
    };

    // Open status change modal
    const openStatusModal = (project) => {
        setSelectedProject(project);
        setStatusFormData({ status: project.status || '', note: '' });
        setShowStatusModal(true);
    };

    // Handle filter change
    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
            // ✅ لا نعيد تعيين page إلى 1 إذا كان المفتاح هو page نفسه (للتنقل بين الصفحات)
            ...(key !== 'page' ? { page: 1 } : {}), // Reset to first page on filter change (except when changing page)
        }));
    };

    // Reset filters
    const resetFilters = () => {
        setFilters({
            search: '',
            status: '',
            project_type: '',
            project_type_id: '',
            subcategory_id: '',
            shelter_id: '',
            team_id: '',
            researcher_id: '',
            photographer_id: '',
            montage_producer_id: '',
            created_from: '',
            created_to: '',
            execution_from: '',
            execution_to: '',
            montage_from: '',
            montage_to: '',
            sort_by: 'created_at',
            sort_order: 'desc',
            page: 1,
            per_page: 20,
            is_urgent: '',
        });
    };

    // Filtered subcategories based on project type
    const filteredSubcategories = useMemo(() => {
        if (!filters.project_type_id) return subcategories;
        return subcategories.filter(
            (sub) => sub.project_type_id === parseInt(filters.project_type_id)
        );
    }, [subcategories, filters.project_type_id]);

    if (!user) {
        return <Unauthorized requiredRole="admin" pageName="الإدارة المتقدمة للمشاريع" />;
    }

    if (!isAuthorized) {
        return <Unauthorized requiredRole="admin" pageName="الإدارة المتقدمة للمشاريع" />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800 mb-2">الإدارة المتقدمة للمشاريع</h1>
                            <p className="text-gray-600">بحث متقدم وتحديث شامل للمشاريع</p>
                        </div>
                        <Link
                            to="/project-management/projects"
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                        >
                            العودة إلى قائمة المشاريع
                        </Link>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
                        >
                            <Filter className="w-5 h-5" />
                            {showFilters ? 'إخفاء الفلاتر' : 'عرض الفلاتر'}
                        </button>
                        <button
                            onClick={() => {
                                resetFilters();
                                fetchProjects();
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            إعادة تعيين
                        </button>
                    </div>

                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                            {/* Search */}
                            <div className="lg:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">بحث نصي</label>
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange('search', e.target.value)}
                                        placeholder="اسم المشروع، كود المتبرع، الكود الداخلي..."
                                        className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => handleFilterChange('status', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                >
                                    <option value="">جميع الحالات</option>
                                    {PROJECT_STATUSES.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Urgent Projects Filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">المشاريع العاجلة</label>
                                <select
                                    value={filters.is_urgent}
                                    onChange={(e) => handleFilterChange('is_urgent', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                >
                                    <option value="">جميع المشاريع</option>
                                    <option value="1">المشاريع العاجلة فقط</option>
                                    <option value="0">المشاريع غير العاجلة</option>
                                </select>
                            </div>

                            {/* Project Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المشروع</label>
                                <select
                                    value={filters.project_type_id}
                                    onChange={(e) => {
                                        handleFilterChange('project_type_id', e.target.value);
                                        handleFilterChange('subcategory_id', ''); // Reset subcategory
                                    }}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                >
                                    <option value="">جميع الأنواع</option>
                                    {projectTypes.map((type) => (
                                        <option key={type.id || type} value={typeof type === 'object' ? type.id : type}>
                                            {typeof type === 'object' ? type.name : type}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Subcategory */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">التفريعة</label>
                                <select
                                    value={filters.subcategory_id}
                                    onChange={(e) => handleFilterChange('subcategory_id', e.target.value)}
                                    disabled={!filters.project_type_id}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:bg-gray-100"
                                >
                                    <option value="">جميع التفريعات</option>
                                    {filteredSubcategories.map((sub) => (
                                        <option key={sub.id} value={sub.id}>
                                            {sub.name_ar || sub.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Team */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الفريق</label>
                                <select
                                    value={filters.team_id}
                                    onChange={(e) => handleFilterChange('team_id', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                >
                                    <option value="">جميع الفرق</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.team_name || team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Researcher */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الباحث</label>
                                <select
                                    value={filters.researcher_id}
                                    onChange={(e) => handleFilterChange('researcher_id', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                >
                                    <option value="">جميع الباحثين</option>
                                    {researchers.map((researcher) => (
                                        <option key={researcher.id} value={researcher.id}>
                                            {researcher.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Photographer */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">المصور</label>
                                <select
                                    value={filters.photographer_id}
                                    onChange={(e) => handleFilterChange('photographer_id', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                >
                                    <option value="">جميع المصورين</option>
                                    {photographers.map((photographer) => (
                                        <option key={photographer.id} value={photographer.id}>
                                            {photographer.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Montage Producer */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">منتج المونتاج</label>
                                <select
                                    value={filters.montage_producer_id}
                                    onChange={(e) => handleFilterChange('montage_producer_id', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                >
                                    <option value="">جميع المنتجين</option>
                                    {producers.map((producer) => (
                                        <option key={producer.id} value={producer.id}>
                                            {producer.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Shelter or Orphan Group */}
                            <div>
                                {(() => {
                                    const subcategory = subcategories.find(sub => sub.id === parseInt(filters.subcategory_id));
                                    const isOrphanSponsorship = filters.subcategory_id && 
                                        (subcategory?.name?.includes('كفالة أيتام') || 
                                         subcategory?.name_ar?.includes('كفالة أيتام') ||
                                         subcategory?.name?.includes('كفالة الأيتام') || 
                                         subcategory?.name_ar?.includes('كفالة الأيتام'));
                                    
                                    if (isOrphanSponsorship) {
                                        return (
                                            <>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">مجموعة الأيتام</label>
                                                <select
                                                    value={filters.orphan_group_id || ''}
                                                    onChange={(e) => handleFilterChange('orphan_group_id', e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                                >
                                                    <option value="">جميع المجموعات</option>
                                                    {orphanGroups.map((group) => (
                                                        <option key={group.id} value={group.id}>
                                                            {group.name} ({group.current_count}/{group.max_capacity})
                                                        </option>
                                                    ))}
                                                </select>
                                            </>
                                        );
                                    }

                                    return (
                                        <>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">المخيم</label>
                                            <select
                                                value={filters.shelter_id}
                                                onChange={(e) => handleFilterChange('shelter_id', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                            >
                                                <option value="">جميع المخيمات</option>
                                                {shelters.map((shelter) => (
                                                    <option key={shelter.manager_id_number || shelter.id} value={shelter.manager_id_number || shelter.id}>
                                                        {shelter.camp_name || shelter.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Date Filters */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإنشاء من</label>
                                <input
                                    type="date"
                                    value={filters.created_from}
                                    onChange={(e) => handleFilterChange('created_from', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإنشاء إلى</label>
                                <input
                                    type="date"
                                    value={filters.created_to}
                                    onChange={(e) => handleFilterChange('created_to', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التنفيذ من</label>
                                <input
                                    type="date"
                                    value={filters.execution_from}
                                    onChange={(e) => handleFilterChange('execution_from', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التنفيذ إلى</label>
                                <input
                                    type="date"
                                    value={filters.execution_to}
                                    onChange={(e) => handleFilterChange('execution_to', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                />
                            </div>

                            {/* Sort */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ترتيب حسب</label>
                                <select
                                    value={filters.sort_by}
                                    onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                >
                                    <option value="created_at">تاريخ الإنشاء</option>
                                    <option value="updated_at">تاريخ التحديث</option>
                                    <option value="project_name">اسم المشروع</option>
                                    <option value="status">الحالة</option>
                                    <option value="execution_date">تاريخ التنفيذ</option>
                                    <option value="montage_completed_date">تاريخ المونتاج</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">اتجاه الترتيب</label>
                                <select
                                    value={filters.sort_order}
                                    onChange={(e) => handleFilterChange('sort_order', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                >
                                    <option value="asc">تصاعدي</option>
                                    <option value="desc">تنازلي</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">عدد النتائج</label>
                                <select
                                    value={filters.per_page}
                                    onChange={(e) => handleFilterChange('per_page', parseInt(e.target.value))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                >
                                    <option value="15">15</option>
                                    <option value="20">20</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                    <option value="200">200</option>
                                </select>
                            </div>

                            {/* فلتر المشاريع العاجلة */}
                            <div className="lg:col-span-2">
                                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 block mb-1 cursor-pointer">
                                            عرض المشاريع العاجلة فقط
                                        </label>
                                        <p className="text-xs text-gray-500">
                                            حدد هذا الخيار لعرض المشاريع العاجلة فقط
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filters.is_urgent === 'true' || filters.is_urgent === true}
                                            onChange={(e) => handleFilterChange('is_urgent', e.target.checked ? 'true' : '')}
                                            className="sr-only peer"
                                        />
                                        <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Search Button */}
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={fetchProjects}
                            className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
                        >
                            بحث
                        </button>
                    </div>
                </div>

                {/* Results */}
                {loading ? (
                    <PageLoader />
                ) : (
                    <>
                        {/* Projects Table */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                الكود
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                اسم المشروع
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                الحالة
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                النوع
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                تاريخ التنفيذ
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                الإجراءات
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {projects.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                    لا توجد مشاريع
                                                </td>
                                            </tr>
                                        ) : (
                                            projects.map((project) => (
                                                <tr key={project.id} className={`hover:bg-gray-50 ${project.is_urgent && project.status !== 'منتهي' ? 'bg-amber-50/30 border-r-4 border-amber-400' : ''}`}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {getProjectCode(project)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900">
                                                        <div className="flex items-center gap-2">
                                                            {project.is_urgent && project.status !== 'منتهي' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border-2 border-amber-400 shadow-sm" title="مشروع عاجل">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    عاجل
                                                                </span>
                                                            )}
                                                            <span>{project.project_name || 'غير محدد'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                                            {project.status || 'غير محدد'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {(() => {
                                                            if (!project.project_type && !project.projectType) return 'غير محدد';
                                                            if (typeof project.project_type === 'object' && project.project_type !== null) {
                                                                return project.project_type.name_ar || project.project_type.name || project.project_type.name_en || 'غير محدد';
                                                            }
                                                            if (typeof project.projectType === 'object' && project.projectType !== null) {
                                                                return project.projectType.name_ar || project.projectType.name || project.projectType.name_en || 'غير محدد';
                                                            }
                                                            return project.project_type || project.projectType?.name || 'غير محدد';
                                                        })()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {project.execution_date || 'غير محدد'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <Link
                                                                to={`/project-management/projects/${project.id}`}
                                                                className="text-sky-600 hover:text-sky-800"
                                                                title="عرض التفاصيل"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Link>
                                                            <button
                                                                onClick={() => openUpdateModal(project)}
                                                                className="text-green-600 hover:text-green-800"
                                                                title="تحديث متقدم"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => openStatusModal(project)}
                                                                className="text-purple-600 hover:text-purple-800"
                                                                title="تغيير الحالة"
                                                            >
                                                                <Settings className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {pagination.last_page > 1 && (
                                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
                                    <div className="text-sm text-gray-700">
                                        عرض {pagination.from || 0} إلى {pagination.to || 0} من {pagination.total || 0} نتيجة
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleFilterChange('page', pagination.current_page - 1)}
                                            disabled={pagination.current_page === 1}
                                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                        <span className="px-4 py-2 text-sm text-gray-700">
                                            صفحة {pagination.current_page} من {pagination.last_page}
                                        </span>
                                        <button
                                            onClick={() => handleFilterChange('page', pagination.current_page + 1)}
                                            disabled={pagination.current_page === pagination.last_page}
                                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Update Modal */}
                {showUpdateModal && selectedProject && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-800">تحديث متقدم للمشروع</h2>
                                <button
                                    onClick={() => {
                                        setShowUpdateModal(false);
                                        setSelectedProject(null);
                                        setUpdateFormData({});
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Basic Info */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">اسم المشروع</label>
                                        <input
                                            type="text"
                                            value={updateFormData.project_name || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, project_name: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                                        <select
                                            value={updateFormData.status || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, status: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        >
                                            {PROJECT_STATUSES.map((status) => (
                                                <option key={status} value={status}>
                                                    {status}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            وصف المشروع
                                            {updateFormData.project_description && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleClearField('project_description')}
                                                    className="mr-2 text-xs text-red-600 hover:text-red-800"
                                                    title="إفراغ الحقل"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </label>
                                        <textarea
                                            value={updateFormData.project_description || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, project_description: e.target.value })}
                                            rows="3"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="وصف المشروع..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">نوع المشروع</label>
                                        <select
                                            value={updateFormData.project_type_id || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, project_type_id: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="">-- اختر نوع المشروع --</option>
                                            {projectTypes.map((type) => (
                                                <option key={type.id || type} value={typeof type === 'object' ? type.id : type}>
                                                    {typeof type === 'object' ? type.name : type}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        {/* Conditional field: Orphan Groups or التفريعة */}
                                        {(() => {
                                            const subcategory = subcategories.find(sub => sub.id === parseInt(updateFormData.subcategory_id));
                                            const showOrphanGroups = updateFormData.subcategory_id && 
                                                (subcategory?.name?.includes('كفالة أيتام') || 
                                                 subcategory?.name_ar?.includes('كفالة أيتام') ||
                                                 subcategory?.name?.includes('كفالة الأيتام') || 
                                                 subcategory?.name_ar?.includes('كفالة الأيتام'));
                                            console.log('Debug - Subcategory ID:', updateFormData.subcategory_id);
                                            console.log('Debug - Subcategory:', subcategory);
                                            console.log('Debug - Show orphan groups:', showOrphanGroups);
                                            console.log('Debug - Available orphan groups:', orphanGroups);
                                            return showOrphanGroups;
                                        })() ? (
                                            <>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">مجموعة الأيتام</label>
                                                <select
                                                    value={updateFormData.orphan_group_id || ''}
                                                    onChange={(e) => setUpdateFormData({ ...updateFormData, orphan_group_id: e.target.value || null })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                >
                                                    <option value="">-- اختر مجموعة الأيتام --</option>
                                                    {orphanGroups.map((group) => (
                                                        <option key={group.id} value={group.id}>
                                                            {group.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </>
                                        ) : (
                                            <>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">التفريعة</label>
                                                <select
                                                    value={updateFormData.subcategory_id || ''}
                                                    onChange={(e) => setUpdateFormData({ ...updateFormData, subcategory_id: e.target.value || null })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                >
                                                    <option value="">-- اختر التفريعة --</option>
                                                    {filteredSubcategories.map((sub) => (
                                                        <option key={sub.id} value={sub.id}>
                                                            {sub.name_ar || sub.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">كود المتبرع</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={updateFormData.donor_code || ''}
                                                onChange={(e) => setUpdateFormData({ ...updateFormData, donor_code: e.target.value })}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            />
                                            {updateFormData.donor_code && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleClearField('donor_code')}
                                                    className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-lg"
                                                    title="إفراغ الحقل"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">الكود الداخلي</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={updateFormData.internal_code || ''}
                                                onChange={(e) => setUpdateFormData({ ...updateFormData, internal_code: e.target.value })}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            />
                                            {updateFormData.internal_code && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleClearField('internal_code')}
                                                    className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-lg"
                                                    title="إفراغ الحقل"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">اسم المتبرع</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={updateFormData.donor_name || ''}
                                                onChange={(e) => setUpdateFormData({ ...updateFormData, donor_name: e.target.value })}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            />
                                            {updateFormData.donor_name && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleClearField('donor_name')}
                                                    className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-lg"
                                                    title="إفراغ الحقل"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.quantity}</label>
                                        <input
                                            type="number"
                                            value={updateFormData.quantity || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, quantity: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.beneficiaries_count}</label>
                                        <input
                                            type="number"
                                            value={updateFormData.beneficiaries_count || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, beneficiaries_count: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.beneficiaries_per_unit}</label>
                                        <input
                                            type="number"
                                            value={updateFormData.beneficiaries_per_unit || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, beneficiaries_per_unit: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.estimated_duration_days}</label>
                                        <input
                                            type="number"
                                            value={updateFormData.estimated_duration_days || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, estimated_duration_days: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div>
                                        {/* Conditional field: Orphan Groups or Shelter */}
                                        {(() => {
                                            const subcategory = subcategories.find(sub => sub.id === parseInt(updateFormData.subcategory_id));
                                            const isOrphanSponsorship = subcategory?.name?.includes('كفالة أيتام') || subcategory?.name_ar?.includes('كفالة أيتام');
                                            
                                            if (isOrphanSponsorship) {
                                                return (
                                                    <>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between items-center">
                                                            <span>مجموعة الأيتام</span>
                                                            {updateFormData.orphan_group_id && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setOrphanModalType('update');
                                                                        setShowOrphanModal(true);
                                                                    }}
                                                                    className="text-xs flex items-center gap-1 text-sky-600 hover:text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200"
                                                                >
                                                                    <Sparkles className="w-3 h-3" />
                                                                    اختيار الأيتام
                                                                </button>
                                                            )}
                                                        </label>
                                                        <select
                                                            value={updateFormData.orphan_group_id || ''}
                                                            onChange={(e) => setUpdateFormData({ ...updateFormData, orphan_group_id: e.target.value || null })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                        >
                                                            <option value="">-- اختر مجموعة الأيتام --</option>
                                                            {orphanGroups.map((group) => (
                                                                <option key={group.id} value={group.id}>
                                                                    {group.name} ({group.current_count}/{group.max_capacity})
                                                                </option>
                                                            ))}
                                                                </select>
                                                                {selectedOrphans.length > 0 && (
                                                                    <p className="mt-1 text-xs text-green-600 font-medium">
                                                                        تم اختيار {selectedOrphans.length} يتيم
                                                                    </p>
                                                                )}

                                                                {/* Sponsorship Dates */}
                                                                <div className="mt-4 grid grid-cols-2 gap-4 col-span-2">
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                                            تاريخ بداية الكفالة
                                                                        </label>
                                                                        <input
                                                                            type="date"
                                                                            value={updateFormData.sponsorship_start_date || ''}
                                                                            onChange={(e) => setUpdateFormData({ ...updateFormData, sponsorship_start_date: e.target.value })}
                                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                                            تاريخ نهاية الكفالة <span className="text-red-500">*</span>
                                                                        </label>
                                                                        <input
                                                                            type="date"
                                                                            value={updateFormData.sponsorship_end_date || ''}
                                                                            onChange={(e) => setUpdateFormData({ ...updateFormData, sponsorship_end_date: e.target.value })}
                                                                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sky-500 ${!updateFormData.sponsorship_end_date ? 'border-amber-300 bg-amber-50' : 'border-gray-300'}`}
                                                                            required
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </>
                                                        );
                                                    }

                                            return (
                                                <ShelterSelect
                                                    value={updateFormData.shelter_id || ''}
                                                    onChange={(e) => setUpdateFormData({ ...updateFormData, shelter_id: e.target.value || null })}
                                                    error={null}
                                                    disabled={false}
                                                />
                                            );
                                        })()}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">الفريق</label>
                                        <select
                                            value={updateFormData.assigned_to_team_id || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, assigned_to_team_id: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="">-- اختر الفريق --</option>
                                            {teams.map((team) => (
                                                <option key={team.id} value={team.id}>
                                                    {team.team_name || team.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">الباحث</label>
                                        <select
                                            value={updateFormData.assigned_researcher_id || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, assigned_researcher_id: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="">-- اختر الباحث --</option>
                                            {researchers.map((researcher) => (
                                                <option key={researcher.id} value={researcher.id}>
                                                    {researcher.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">المصور</label>
                                        <select
                                            value={updateFormData.assigned_photographer_id || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, assigned_photographer_id: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="">-- اختر المصور --</option>
                                            {photographers.map((photographer) => (
                                                <option key={photographer.id} value={photographer.id}>
                                                    {photographer.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">منتج المونتاج</label>
                                        <select
                                            value={updateFormData.assigned_montage_producer_id || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, assigned_montage_producer_id: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="">-- اختر منتج المونتاج --</option>
                                            {producers.map((producer) => (
                                                <option key={producer.id} value={producer.id}>
                                                    {producer.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">المستخدم الذي قام بالإسناد</label>
                                        <input
                                            type="number"
                                            value={updateFormData.assigned_by || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, assigned_by: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="معرف المستخدم"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.execution_date}</label>
                                        <input
                                            type="date"
                                            value={updateFormData.execution_date || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, execution_date: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.media_received_date}</label>
                                        <input
                                            type="date"
                                            value={updateFormData.media_received_date || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, media_received_date: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.assignment_date}</label>
                                        <input
                                            type="date"
                                            value={updateFormData.assignment_date || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, assignment_date: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ملاحظات
                                            {updateFormData.notes && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleClearField('notes')}
                                                    className="mr-2 text-xs text-red-600 hover:text-red-800"
                                                    title="إفراغ الحقل"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </label>
                                        <textarea
                                            value={updateFormData.notes || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, notes: e.target.value })}
                                            rows="3"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="ملاحظات..."
                                        />
                                    </div>
                                    {/* Status Change Note - only show if status is being changed */}
                                    {updateFormData.status && selectedProject?.status && updateFormData.status !== selectedProject.status && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ملاحظة تغيير الحالة (اختياري)
                                            </label>
                                            <textarea
                                                value={statusChangeNote}
                                                onChange={(e) => setStatusChangeNote(e.target.value)}
                                                rows="2"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                placeholder="ملاحظة لتسجيل تغيير الحالة في Timeline..."
                                            />
                                        </div>
                                    )}
                                    <div className="md:col-span-2">
                                        <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
                                            <div>
                                                <label className="text-sm font-medium text-gray-700 block mb-1 cursor-pointer">
                                                    مشروع عاجل
                                                </label>
                                                <p className="text-xs text-gray-500">
                                                    حدد هذا الخيار إذا كان المشروع يحتاج إلى متابعة عاجلة
                                                </p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={updateFormData.is_urgent || false}
                                                    onChange={(e) => setUpdateFormData({ ...updateFormData, is_urgent: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                    {/* ===== المعلومات المالية ===== */}
                                    <div className="md:col-span-2">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-green-200">المعلومات المالية</h3>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">العملة</label>
                                        <select
                                            value={updateFormData.currency_id || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, currency_id: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="">-- اختر العملة --</option>
                                            {currencies.map((currency) => (
                                                <option key={currency.id} value={currency.id}>
                                                    {currency.currency_name_ar || currency.currency_name || currency.name_ar || currency.name} ({currency.currency_code || currency.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.donation_amount}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={updateFormData.donation_amount || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, donation_amount: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.exchange_rate}</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={updateFormData.exchange_rate || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, exchange_rate: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="3.7500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.admin_discount_percentage}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={updateFormData.admin_discount_percentage || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, admin_discount_percentage: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    {/* حقول محسوبة - للعرض فقط */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.amount_in_usd} (محسوب)</label>
                                        <input
                                            type="text"
                                            value={selectedProject?.amount_in_usd || updateFormData.amount_in_usd || ''}
                                            disabled
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.discount_amount} (محسوب)</label>
                                        <input
                                            type="text"
                                            value={selectedProject?.discount_amount || updateFormData.discount_amount || ''}
                                            disabled
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.net_amount} (محسوب)</label>
                                        <input
                                            type="text"
                                            value={selectedProject?.net_amount || updateFormData.net_amount || ''}
                                            disabled
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.shekel_exchange_rate}</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={updateFormData.shekel_exchange_rate || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, shekel_exchange_rate: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="3.70"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.net_amount_shekel}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={updateFormData.net_amount_shekel || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, net_amount_shekel: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ تحويل الشيكل</label>
                                        <input
                                            type="datetime-local"
                                            value={updateFormData.shekel_converted_at ? new Date(updateFormData.shekel_converted_at).toISOString().slice(0, 16) : ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, shekel_converted_at: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">المستخدم الذي قام بتحويل الشيكل</label>
                                        <input
                                            type="number"
                                            value={updateFormData.shekel_converted_by || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, shekel_converted_by: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="معرف المستخدم"
                                        />
                                    </div>

                                    {/* ===== التوريد والوافر ===== */}
                                    <div className="md:col-span-2">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-orange-200">التوريد والوافر</h3>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.unit_cost} (محسوب)</label>
                                        <input
                                            type="text"
                                            value={selectedProject?.unit_cost || updateFormData.unit_cost || ''}
                                            disabled
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.supply_cost} (محسوب)</label>
                                        <input
                                            type="text"
                                            value={selectedProject?.supply_cost || updateFormData.supply_cost || ''}
                                            disabled
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.surplus_amount}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={updateFormData.surplus_amount || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, surplus_amount: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.has_deficit}</label>
                                        <label className="relative inline-flex items-center cursor-pointer w-full">
                                            <input
                                                type="checkbox"
                                                checked={updateFormData.has_deficit || false}
                                                onChange={(e) => setUpdateFormData({ ...updateFormData, has_deficit: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                                            <span className="mr-3 text-sm text-gray-700">{updateFormData.has_deficit ? 'يوجد عجز' : 'لا يوجد عجز'}</span>
                                        </label>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.surplus_notes}</label>
                                        <textarea
                                            value={updateFormData.surplus_notes || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, surplus_notes: e.target.value || null })}
                                            rows="2"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="ملاحظات الوافر..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.surplus_category_id}</label>
                                        <select
                                            value={updateFormData.surplus_category_id || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, surplus_category_id: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="">-- اختر فئة الوافر --</option>
                                            {surplusCategories.map((category) => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name_ar || category.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ تسجيل الوافر</label>
                                        <input
                                            type="datetime-local"
                                            value={updateFormData.surplus_recorded_at ? new Date(updateFormData.surplus_recorded_at).toISOString().slice(0, 16) : ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, surplus_recorded_at: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">المستخدم الذي سجل الوافر</label>
                                        <input
                                            type="number"
                                            value={updateFormData.surplus_recorded_by || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, surplus_recorded_by: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="معرف المستخدم"
                                        />
                                    </div>

                                    {/* ===== التقسيم (Phasing) ===== */}
                                    <div className="md:col-span-2">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-teal-200">تقسيم المشروع</h3>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="relative inline-flex items-center cursor-pointer w-full">
                                            <input
                                                type="checkbox"
                                                checked={updateFormData.is_divided_into_phases || false}
                                                onChange={(e) => setUpdateFormData({ ...updateFormData, is_divided_into_phases: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-teal-600"></div>
                                            <span className="mr-3 text-sm font-medium text-gray-700">{FIELD_LABELS_AR.is_divided_into_phases}</span>
                                        </label>
                                    </div>

                                    {updateFormData.is_divided_into_phases && (
                                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="relative inline-flex items-center cursor-pointer w-full">
                                                    <input
                                                        type="checkbox"
                                                        checked={updateFormData.is_daily_phase || false}
                                                        onChange={(e) => setUpdateFormData({ ...updateFormData, is_daily_phase: e.target.checked })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                                                    <span className="mr-3 text-sm text-gray-700">مشروع يومي فرعي</span>
                                                </label>
                                            </div>

                                            <div>
                                                <label className="relative inline-flex items-center cursor-pointer w-full">
                                                    <input
                                                        type="checkbox"
                                                        checked={updateFormData.is_monthly_phase || false}
                                                        onChange={(e) => setUpdateFormData({ ...updateFormData, is_monthly_phase: e.target.checked })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                                                    <span className="mr-3 text-sm text-gray-700">مشروع شهري فرعي</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {updateFormData.is_divided_into_phases && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.phase_type}</label>
                                                <select
                                                    value={updateFormData.phase_type || ''}
                                                    onChange={(e) => setUpdateFormData({ ...updateFormData, phase_type: e.target.value || null })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                >
                                                    <option value="">-- اختر نوع التقسيم --</option>
                                                    <option value="daily">يومي</option>
                                                    <option value="monthly">شهري</option>
                                                </select>
                                            </div>

                                            {updateFormData.phase_type === 'daily' && (
                                                <>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم اليوم</label>
                                                        <input
                                                            type="number"
                                                            value={updateFormData.phase_day || ''}
                                                            onChange={(e) => setUpdateFormData({ ...updateFormData, phase_day: e.target.value ? parseInt(e.target.value) : null })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.phase_duration_days}</label>
                                                        <input
                                                            type="number"
                                                            value={updateFormData.phase_duration_days || ''}
                                                            onChange={(e) => setUpdateFormData({ ...updateFormData, phase_duration_days: e.target.value ? parseInt(e.target.value) : null })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.phase_start_date}</label>
                                                        <input
                                                            type="date"
                                                            value={updateFormData.phase_start_date || ''}
                                                            onChange={(e) => setUpdateFormData({ ...updateFormData, phase_start_date: e.target.value || null })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {updateFormData.phase_type === 'monthly' && (
                                                <>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.month_number}</label>
                                                        <input
                                                            type="number"
                                                            value={updateFormData.month_number || ''}
                                                            onChange={(e) => setUpdateFormData({ ...updateFormData, month_number: e.target.value ? parseInt(e.target.value) : null })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.total_months}</label>
                                                        <input
                                                            type="number"
                                                            value={updateFormData.total_months || ''}
                                                            onChange={(e) => setUpdateFormData({ ...updateFormData, total_months: e.target.value ? parseInt(e.target.value) : null })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ بداية الشهر</label>
                                                        <input
                                                            type="date"
                                                            value={updateFormData.month_start_date || ''}
                                                            onChange={(e) => setUpdateFormData({ ...updateFormData, month_start_date: e.target.value || null })}
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">المشروع الأب (Parent Project ID)</label>
                                                <input
                                                    type="number"
                                                    value={updateFormData.parent_project_id || ''}
                                                    onChange={(e) => setUpdateFormData({ ...updateFormData, parent_project_id: e.target.value ? parseInt(e.target.value) : null })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                                    placeholder="معرف المشروع الأب"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* ===== أسباب الرفض ===== */}
                                    <div className="md:col-span-2">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-red-200">أسباب الرفض</h3>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.rejection_reason}</label>
                                        <textarea
                                            value={updateFormData.rejection_reason || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, rejection_reason: e.target.value || null })}
                                            rows="2"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="سبب رفض المونتاج من منتج المونتاج..."
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">رسالة رفض المونتاج التفصيلية</label>
                                        <textarea
                                            value={updateFormData.rejection_message || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, rejection_message: e.target.value || null })}
                                            rows="2"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="رسالة رفض المونتاج التفصيلية..."
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.admin_rejection_reason}</label>
                                        <textarea
                                            value={updateFormData.admin_rejection_reason || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, admin_rejection_reason: e.target.value || null })}
                                            rows="2"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="سبب رفض الإدارة للمونتاج..."
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.media_rejection_reason}</label>
                                        <textarea
                                            value={updateFormData.media_rejection_reason || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, media_rejection_reason: e.target.value || null })}
                                            rows="2"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="سبب رفض مدير الإعلام للمونتاج..."
                                        />
                                    </div>

                                    {/* ===== التواريخ المهمة ===== */}
                                    <div className="md:col-span-2">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-purple-200">التواريخ المهمة</h3>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.execution_date}</label>
                                        <input
                                            type="date"
                                            value={updateFormData.execution_date || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, execution_date: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.media_received_date}</label>
                                        <input
                                            type="date"
                                            value={updateFormData.media_received_date || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, media_received_date: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.assignment_date}</label>
                                        <input
                                            type="date"
                                            value={updateFormData.assignment_date || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, assignment_date: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.montage_start_date}</label>
                                        <input
                                            type="date"
                                            value={updateFormData.montage_start_date || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, montage_start_date: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.montage_completed_date}</label>
                                        <input
                                            type="date"
                                            value={updateFormData.montage_completed_date || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, montage_completed_date: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ ووقت إتمام المونتاج</label>
                                        <input
                                            type="datetime-local"
                                            value={updateFormData.montage_completed_at ? new Date(updateFormData.montage_completed_at).toISOString().slice(0, 16) : ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, montage_completed_at: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ ووقت إسناد منتج المونتاج</label>
                                        <input
                                            type="datetime-local"
                                            value={updateFormData.montage_producer_assigned_at ? new Date(updateFormData.montage_producer_assigned_at).toISOString().slice(0, 16) : ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, montage_producer_assigned_at: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.sent_to_donor_date}</label>
                                        <input
                                            type="date"
                                            value={updateFormData.sent_to_donor_date || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, sent_to_donor_date: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.completed_date}</label>
                                        <input
                                            type="date"
                                            value={updateFormData.completed_date || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, completed_date: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>

                                    {/* ===== معلومات إضافية ===== */}
                                    <div className="md:col-span-2">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">معلومات إضافية</h3>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">المعرف</label>
                                        <input
                                            type="text"
                                            value={selectedProject?.id || updateFormData.id || ''}
                                            disabled
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.serial_number}</label>
                                        <input
                                            type="text"
                                            value={selectedProject?.serial_number || updateFormData.serial_number || ''}
                                            disabled
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.created_at}</label>
                                        <input
                                            type="text"
                                            value={selectedProject?.created_at ? new Date(selectedProject.created_at).toLocaleString('ar-SA') : ''}
                                            disabled
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.updated_at}</label>
                                        <input
                                            type="text"
                                            value={selectedProject?.updated_at ? new Date(selectedProject.updated_at).toLocaleString('ar-SA') : ''}
                                            disabled
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">المستخدم الذي أنشأ المشروع</label>
                                        <input
                                            type="number"
                                            value={updateFormData.created_by || selectedProject?.created_by || ''}
                                            disabled
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">تم النقل للمشاريع القديمة</label>
                                        <label className="relative inline-flex items-center cursor-pointer w-full">
                                            <input
                                                type="checkbox"
                                                checked={updateFormData.transferred_to_projects || false}
                                                onChange={(e) => setUpdateFormData({ ...updateFormData, transferred_to_projects: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                                            <span className="mr-3 text-sm text-gray-700">{updateFormData.transferred_to_projects ? 'تم النقل' : 'لم يتم النقل'}</span>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">معرف المشروع في الجدول القديم</label>
                                        <input
                                            type="number"
                                            value={updateFormData.project_id || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, project_id: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="معرف المشروع القديم"
                                        />
                                    </div>

                                    {/* ===== روابط وملفات ===== */}
                                    <div className="md:col-span-2">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-indigo-200">روابط وملفات المشروع</h3>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.project_image}</label>
                                        <input
                                            type="text"
                                            value={updateFormData.project_image || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, project_image: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="مسار صورة المشروع..."
                                        />
                                        {selectedProject?.project_image_url && (
                                            <a href={selectedProject.project_image_url} target="_blank" rel="noopener noreferrer" className="mt-2 text-sm text-sky-600 hover:text-sky-800 block">
                                                عرض الصورة الحالية
                                            </a>
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.notes_image}</label>
                                        <input
                                            type="text"
                                            value={updateFormData.notes_image || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, notes_image: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="مسار صورة الملاحظات..."
                                        />
                                        {selectedProject?.notes_image_url && (
                                            <a href={selectedProject.notes_image_url} target="_blank" rel="noopener noreferrer" className="mt-2 text-sm text-sky-600 hover:text-sky-800 block">
                                                عرض الصورة الحالية
                                            </a>
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{FIELD_LABELS_AR.beneficiaries_excel_file}</label>
                                        <input
                                            type="text"
                                            value={updateFormData.beneficiaries_excel_file || ''}
                                            onChange={(e) => setUpdateFormData({ ...updateFormData, beneficiaries_excel_file: e.target.value || null })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                            placeholder="مسار ملف Excel للمستفيدين..."
                                        />
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end gap-4">
                                    <button
                                        onClick={() => {
                                            setShowUpdateModal(false);
                                            setSelectedProject(null);
                                            setUpdateFormData({});
                                            setStatusChangeNote('');
                                        }}
                                        className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        onClick={handleUpdate}
                                        disabled={updating}
                                        className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg disabled:opacity-50"
                                    >
                                        {updating ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Change Modal */}
                {showStatusModal && selectedProject && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-800">تغيير حالة المشروع</h2>
                                <button
                                    onClick={() => {
                                        setShowStatusModal(false);
                                        setSelectedProject(null);
                                        setStatusFormData({ status: '', note: '' });
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="mb-4">
                                    <p className="text-sm text-gray-600 mb-2">
                                        الحالة الحالية: <span className="font-medium">{selectedProject.status}</span>
                                    </p>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">الحالة الجديدة</label>
                                    <select
                                        value={statusFormData.status}
                                        onChange={(e) => {
                                            const newStatus = e.target.value;
                                            setStatusFormData({ ...statusFormData, status: newStatus });

                                            // عرض تحذير تلقائي عند اختيار حالة سابقة
                                            if (selectedProject.status && newStatus) {
                                                const oldOrder = STATUS_ORDER[selectedProject.status] || 0;
                                                const newOrder = STATUS_ORDER[newStatus] || 0;

                                                if (newOrder > 0 && oldOrder > 0 && newOrder < oldOrder && newStatus !== 'ملغى' && newStatus !== 'مؤجل') {
                                                    // سيتم عرض تحذير في handleStatusChange
                                                }
                                            }
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                    >
                                        <option value="">اختر حالة جديدة</option>
                                        {PROJECT_STATUSES.map((status) => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                    {statusFormData.status && selectedProject.status && (() => {
                                        const oldOrder = STATUS_ORDER[selectedProject.status] || 0;
                                        const newOrder = STATUS_ORDER[statusFormData.status] || 0;
                                        const isGoingBack = newOrder > 0 && oldOrder > 0 && newOrder < oldOrder && statusFormData.status !== 'ملغى' && statusFormData.status !== 'مؤجل';

                                        return isGoingBack ? (
                                            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                                <p className="text-xs text-amber-800">
                                                    ⚠️ <strong>تحذير:</strong> الرجوع إلى حالة سابقة سيؤدي إلى حذف البيانات المرتبطة بالحالات المتقدمة تلقائياً.
                                                </p>
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظة (اختياري)</label>
                                    <textarea
                                        value={statusFormData.note}
                                        onChange={(e) => setStatusFormData({ ...statusFormData, note: e.target.value })}
                                        rows="3"
                                        placeholder="ملاحظة لتسجيل تغيير الحالة"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>
                                <div className="flex justify-end gap-4">
                                    <button
                                        onClick={() => {
                                            setShowStatusModal(false);
                                            setSelectedProject(null);
                                            setStatusFormData({ status: '', note: '' });
                                        }}
                                        className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        onClick={handleStatusChange}
                                        disabled={updating || !statusFormData.status}
                                        className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg disabled:opacity-50"
                                    >
                                        {updating ? 'جاري التغيير...' : 'تغيير الحالة'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Orphan Selection Modal */}
                {showOrphanModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
                            {/* Header - Indigo Gradient */}
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md shadow-inner">
                                        <Users className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">اختيار الأيتام للتجميعة</h2>
                                        <p className="text-blue-100 text-sm mt-0.5 opacity-90">
                                            {orphanModalType === 'update' ? 'تحديد الأيتام المستفيدين من هذا المشروع' : 'فلترة واختيار الأيتام للبحث'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowOrphanModal(false)} 
                                    className="bg-white/10 p-2.5 rounded-xl hover:bg-white/20 transition-all text-white border border-white/20"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Filters & Actions Bar */}
                            <div className="p-5 bg-white border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="بحث بالاسم أو رقم الهوية..."
                                        value={orphanFilters.search}
                                        onChange={(e) => handleOrphanFilterChange('search', e.target.value)}
                                        className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-sm"
                                    />
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <select
                                        value={orphanFilters.gender}
                                        onChange={(e) => handleOrphanFilterChange('gender', e.target.value)}
                                        className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none flex-1 md:flex-none"
                                    >
                                        <option value="">جميع الأجناس</option>
                                        <option value="male">ذكر</option>
                                        <option value="female">أنثى</option>
                                    </select>
                                    <button
                                        onClick={() => handleSmartSelect(orphanModalType === 'update' ? updateFormData.orphan_group_id : filters.orphan_group_id)}
                                        disabled={isLoadingOrphans}
                                        className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-200 active:scale-95"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        {isLoadingOrphans ? 'جاري التحضير...' : 'اختيار ذكي'}
                                    </button>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                                {isLoadingOrphans ? (
                                    <div className="flex flex-col items-center justify-center h-80">
                                        <div className="relative">
                                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                            <Users className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                        </div>
                                        <p className="text-gray-500 mt-6 font-semibold text-lg animate-pulse">جاري جلب قائمة الأيتام المؤهلين...</p>
                                    </div>
                                ) : eligibleOrphans.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {eligibleOrphans.map(orphan => {
                                            const isSelected = selectedOrphans.some(o => (o.orphan_id_number || o.id) === (orphan.orphan_id_number || orphan.id));
                                            const limit = orphanModalType === 'update' ? (updateFormData.beneficiaries_count || selectedProject?.beneficiaries_count || 0) : 999;
                                            
                                            return (
                                                <div 
                                                    key={orphan.id}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedOrphans(selectedOrphans.filter(o => (o.orphan_id_number || o.id) !== (orphan.orphan_id_number || orphan.id)));
                                                        } else {
                                                            if (selectedOrphans.length >= limit && limit > 0) {
                                                                toast.warning(`لا يمكن اختيار أكثر من ${limit} يتيم لهذا المشروع`);
                                                                return;
                                                            }
                                                            setSelectedOrphans([...selectedOrphans, orphan]);
                                                        }
                                                    }}
                                                    className={`relative p-5 rounded-2xl border-2 transition-all cursor-pointer group bg-white flex flex-col gap-4 ${
                                                        isSelected 
                                                            ? 'border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-50 shadow-md' 
                                                            : 'border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:-translate-y-0.5'
                                                    }`}
                                                >
                                                    {/* Selection Badge */}
                                                    <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center transition-all shadow-md ${
                                                        isSelected ? 'bg-indigo-600 scale-110' : 'bg-gray-200 group-hover:bg-indigo-100'
                                                    }`}>
                                                        {isSelected ? <CheckCircle className="w-5 h-5 text-white" /> : <div className="w-2 h-2 rounded-full bg-white" />}
                                                    </div>

                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0 shadow-sm ${
                                                            orphan.gender === 'female' ? 'bg-pink-100 text-pink-600' : 'bg-indigo-100 text-indigo-600'
                                                        }`}>
                                                            {orphan.orphan_full_name?.charAt(0) || 'Y'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="font-bold text-gray-900 text-base mb-0.5 truncate group-hover:text-indigo-700 transition-colors">
                                                                {orphan.orphan_full_name}
                                                            </h3>
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                                                <Activity className="w-3 h-3" />
                                                                الهوية: {orphan.orphan_id_number}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200/50">
                                                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                            <span className="truncate">{orphan.current_governorate}</span>
                                                        </div>
                                                        <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
                                                            orphan.gender === 'female' ? 'bg-pink-50 text-pink-700 border-pink-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                                                        }`}>
                                                            <Heart className="w-3.5 h-3.5" />
                                                            {orphan.gender === 'male' ? 'ذكر' : 'أنثى'}
                                                        </div>
                                                    </div>

                                                    {/* Badges Overlay */}
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {orphan.is_mother_deceased === 'نعم' && (
                                                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold border border-red-200">الأم متوفاة</span>
                                                        )}
                                                        {orphan.health_status === 'مريض' && (
                                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200">حالة خاصة</span>
                                                        )}
                                                        {orphan.is_enrolled_in_memorization_center === 'نعم' && (
                                                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
                                                                <BookOpen className="w-2.5 h-2.5" />
                                                                تحفيظ
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-80 bg-white rounded-3xl border-2 border-dashed border-gray-100 shadow-inner group">
                                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 border border-gray-100 group-hover:scale-110 transition-transform duration-300">
                                            <AlertCircle className="w-12 h-12 text-gray-200 group-hover:text-indigo-200 transition-colors" />
                                        </div>
                                        <p className="text-gray-400 font-bold text-xl">لا يوجد أيتام متاحون</p>
                                        <p className="text-gray-300 text-sm mt-2 max-w-xs text-center">جرّب تغيير معايير البحث أو اختيار مجموعة أيتام أخرى</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer - Premium Styling */}
                            <div className="p-6 border-t border-gray-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-6">
                                    <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 shadow-inner flex items-center gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">تم اختيار</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-2xl font-black ${selectedOrphans.length === (orphanModalType === 'update' ? (updateFormData.beneficiaries_count || selectedProject?.beneficiaries_count || 0) : 999) ? 'text-green-600' : 'text-indigo-600'}`}>
                                                    {selectedOrphans.length}
                                                </span>
                                                <span className="text-gray-400 font-bold text-sm">/ {orphanModalType === 'update' ? (updateFormData.beneficiaries_count || selectedProject?.beneficiaries_count || 0) : '∞'}</span>
                                            </div>
                                        </div>
                                        {orphanModalType === 'update' && (
                                            <div className="h-10 w-[2px] bg-gray-200"></div>
                                        )}
                                        {orphanModalType === 'update' && (
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">الحالة</span>
                                                <span className={`text-xs font-bold ${
                                                    selectedOrphans.length === (updateFormData.beneficiaries_count || selectedProject?.beneficiaries_count || 0) 
                                                        ? 'text-green-600' 
                                                        : 'text-amber-500'
                                                }`}>
                                                    {selectedOrphans.length === (updateFormData.beneficiaries_count || selectedProject?.beneficiaries_count || 0) ? 'مكتمل' : 'قيد الاختيار'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => setSelectedOrphans([])}
                                        className="text-sm text-red-500 hover:text-red-700 font-bold flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-xl transition-all"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        إلغاء الكل
                                    </button>
                                </div>
                                <div className="flex gap-4 w-full sm:w-auto">
                                    <button
                                        onClick={() => setShowOrphanModal(false)}
                                        className="flex-1 sm:flex-none px-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-all border border-gray-200/50"
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        onClick={handleConfirmOrphanSelection}
                                        className="flex-1 sm:flex-none px-12 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <UserCheck className="w-5 h-5" />
                                        تأكيد الاختيار
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdvancedProjectsManagement;

