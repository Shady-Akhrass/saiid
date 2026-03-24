import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { Tag, ArrowRight, Edit, DollarSign, Users, FolderKanban, Calendar, TrendingUp, Package } from 'lucide-react';
import Unauthorized from '../components/Unauthorized';

const SubcategoryDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [subcategory, setSubcategory] = useState(null);
    const [statistics, setStatistics] = useState(null);
    const [projects, setProjects] = useState([]);

    // ✅ دالة مساعدة لتنظيف البيانات المعقدة
    const normalizeSubcategoryData = useCallback((data) => {
        if (!data || typeof data !== 'object') return data;
        
        const normalized = { ...data };
        
        // ✅ تحويل الحقول المعقدة إلى strings
        if (normalized.name && typeof normalized.name === 'object') {
            normalized.name = normalized.name.name_ar || normalized.name.name || String(normalized.name);
        }
        if (normalized.name_ar && typeof normalized.name_ar === 'object') {
            normalized.name_ar = normalized.name_ar.name_ar || normalized.name_ar.name || String(normalized.name_ar);
        }
        if (normalized.project_type && typeof normalized.project_type === 'object') {
            normalized.project_type = normalized.project_type.name || normalized.project_type.name_ar || String(normalized.project_type);
        }
        if (normalized.description && typeof normalized.description === 'object') {
            normalized.description = normalized.description.description || normalized.description.text || String(normalized.description);
        }
        
        return normalized;
    }, []);

    const fetchSubcategoryDetails = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/project-subcategories/${id}`, {
                params: { _t: Date.now() },
                timeout: 20000,
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (response.data.success !== false) {
                const subcategoryData = response.data.data || response.data.subcategory || response.data;
                
                if (subcategoryData && typeof subcategoryData === 'object') {
                    const normalized = normalizeSubcategoryData(subcategoryData);
                    setSubcategory(normalized);
                } else {
                    toast.error('فشل تحميل بيانات التفرعية');
                    navigate('/project-management/subcategories');
                }
            } else {
                toast.error('فشل تحميل بيانات التفرعية');
                navigate('/project-management/subcategories');
            }
        } catch (error) {
            if (import.meta.env.DEV && !error.isConnectionError) {
                console.error('Error fetching subcategory:', error);
            }
            if (!error.isConnectionError) {
                toast.error('فشل تحميل بيانات التفرعية');
            }
            navigate('/project-management/subcategories');
        } finally {
            setLoading(false);
        }
    }, [id, navigate, normalizeSubcategoryData]);

    // ✅ دالة مساعدة لتنظيف statistics
    const normalizeStatistics = useCallback((statsData) => {
        if (!statsData || typeof statsData !== 'object') return statsData;
        
        const normalized = { ...statsData };
        
        // ✅ تحويل projects_by_status إذا كان object معقد
        if (normalized.projects_by_status && typeof normalized.projects_by_status === 'object') {
            const projectsByStatus = {};
            Object.entries(normalized.projects_by_status).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    projectsByStatus[String(key)] = Number(value.count || value.total || value || 0);
                } else {
                    projectsByStatus[String(key)] = Number(value || 0);
                }
            });
            normalized.projects_by_status = projectsByStatus;
        }
        
        return normalized;
    }, []);

    const fetchStatistics = useCallback(async () => {
        try {
            const response = await apiClient.get(`/project-subcategories/${id}/statistics`, {
                params: { _t: Date.now() },
                timeout: 20000,
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (response.data.success !== false) {
                const statsData = response.data.data?.statistics || response.data.statistics || response.data.data;
                
                if (statsData && typeof statsData === 'object') {
                    const normalized = normalizeStatistics(statsData);
                    setStatistics(normalized);
                }
            }
        } catch (error) {
            if (import.meta.env.DEV && !error.isConnectionError) {
                console.error('Error fetching statistics:', error);
            }
        }
    }, [id, normalizeStatistics]);

    // ✅ دوال مساعدة محسّنة (خارج Component لتجنب إعادة الإنشاء)
    const getProjectSubcategoryId = useCallback((project) => {
        if (!project) return null;
        
        // ✅ محاولة 1: من subcategory_id مباشرة
        if (project.subcategory_id !== null && project.subcategory_id !== undefined && project.subcategory_id !== '') {
            return project.subcategory_id;
        }
        
        // ✅ محاولة 2: من subcategory object
        if (project.subcategory) {
            if (typeof project.subcategory === 'object' && project.subcategory !== null) {
                return project.subcategory.id || project.subcategory.subcategory_id || null;
            } else if (typeof project.subcategory === 'number' || typeof project.subcategory === 'string') {
                return project.subcategory;
            }
        }
        
        return null;
    }, []);

    // ✅ دالة مساعدة للمقارنة
    const compareSubcategoryIds = useCallback((projectId, targetId) => {
        const projectIdNum = Number(projectId);
        const targetIdNum = Number(targetId);
        
        return (
            projectIdNum === targetIdNum ||
            String(projectIdNum) === String(targetIdNum) ||
            parseInt(String(projectId)) === parseInt(String(targetId))
        );
    }, []);

    const fetchProjects = useCallback(async () => {
        try {
            // ✅ جلب جميع المشاريع ثم فلترتها في Frontend
            const response = await apiClient.get('/project-proposals', {
                params: {
                    per_page: 1000, // ✅ جلب عدد كبير من المشاريع
                    _t: Date.now()
                },
                timeout: 20000,
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (response.data.success !== false) {
                let projectsData = response.data.projects || response.data.data || response.data.result || [];

                // ✅ تحويل id إلى number للمقارنة
                const targetSubcategoryId = parseInt(id) || Number(id) || id;

                // ✅ فلترة المشاريع بشكل محسّن
                const filteredProjects = projectsData.filter(project => {
                    // ✅ استخراج subcategory_id
                    const projectSubcategoryId = getProjectSubcategoryId(project);

                    // ✅ إذا لم نجد subcategory_id، نتخطى هذا المشروع
                    if (projectSubcategoryId === null || projectSubcategoryId === undefined || projectSubcategoryId === '') {
                        return false;
                    }

                    // ✅ المقارنة
                    return compareSubcategoryIds(projectSubcategoryId, targetSubcategoryId);
                });

                setProjects(filteredProjects);

                // ✅ Debug logs فقط في وضع التطوير
                if (import.meta.env.DEV) {
                    const projectsWithoutSubcategory = projectsData.filter(p => !getProjectSubcategoryId(p));
                    console.log('📊 Projects filtered for subcategory:', {
                        subcategoryId: id,
                        targetSubcategoryId: targetSubcategoryId,
                        totalFromAPI: projectsData.length,
                        filtered: filteredProjects.length,
                        missingSubcategory: projectsWithoutSubcategory.length,
                        sampleFiltered: filteredProjects.slice(0, 3).map(p => ({
                            id: p.id,
                            name: p.project_name || p.donor_name,
                            subcategory_id: getProjectSubcategoryId(p)
                        }))
                    });
                    
                    if (projectsWithoutSubcategory.length > 0) {
                        console.warn('⚠️ Some projects are missing subcategory_id (filtered out):', {
                            count: projectsWithoutSubcategory.length,
                            sampleIds: projectsWithoutSubcategory.slice(0, 5).map(p => p.id)
                        });
                    }
                }
            } else {
                if (import.meta.env.DEV) {
                    console.warn('⚠️ API returned success: false', response.data);
                }
                setProjects([]);
            }
        } catch (error) {
            if (import.meta.env.DEV && !error.isConnectionError) {
                console.error('Error fetching projects:', error);
            }
            setProjects([]);
        }
    }, [id, getProjectSubcategoryId, compareSubcategoryIds]);

    // ✅ استدعاء الدوال عند تغيير id
    useEffect(() => {
        fetchSubcategoryDetails();
        fetchStatistics();
        fetchProjects();
    }, [id, fetchSubcategoryDetails, fetchStatistics, fetchProjects]);

    // ✅ دوال مساعدة محسّنة
    const formatDate = React.useCallback((dateString) => {
        if (!dateString) return '---';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ar-SA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    }, []);

    const formatCurrency = React.useCallback((amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(amount || 0);
    }, []);

    // ✅ حساب دور المستخدم بشكل محسّن
    const userRole = React.useMemo(() => {
        const role = user?.role || user?.userRole || user?.user_role || user?.role_name || '';
        return typeof role === 'string' ? role.toLowerCase() : '';
    }, [user]);

    const isAdmin = React.useMemo(() => {
        return userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';
    }, [userRole]);

    if (!user || (userRole && !isAdmin)) {
        return <Unauthorized requiredRole="admin" pageName="تفاصيل التفرعية" />;
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
            </div>
        );
    }

    if (!subcategory) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */ }
                <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <button
                        onClick={ () => navigate('/project-management/subcategories') }
                        className="flex items-center text-sky-600 hover:text-sky-700 font-medium mb-4"
                    >
                        <ArrowRight className="w-5 h-5 ml-2" />
                        العودة إلى القائمة
                    </button>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800 mb-2">
                                { String(subcategory.name_ar || subcategory.name || '---') }
                            </h1>
                            { subcategory.name && String(subcategory.name) !== String(subcategory.name_ar) && (
                                <p className="text-gray-600 text-lg">{ String(subcategory.name) }</p>
                            ) }
                            <div className="flex items-center gap-3 mt-3">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                    { String(subcategory.project_type || '---') }
                                </span>
                                <span className={ `px-3 py-1 rounded-full text-sm font-medium ${subcategory.is_active
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                    }` }>
                                    { subcategory.is_active ? 'نشطة' : 'غير نشطة' }
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={ () => navigate(`/project-management/subcategories/${id}/edit`) }
                            className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow"
                        >
                            <Edit className="w-5 h-5" />
                            تعديل التفرعية
                        </button>
                    </div>
                    { subcategory.description && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-gray-700">{ String(subcategory.description) }</p>
                        </div>
                    ) }
                </div>

                {/* Statistics Cards */ }
                { statistics && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white rounded-2xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <FolderKanban className="w-8 h-8 text-blue-600" />
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                            <p className="text-gray-600 text-sm mb-1">عدد المشاريع</p>
                            <p className="text-3xl font-bold text-gray-800">
                                { statistics.total_projects || 0 }
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <DollarSign className="w-8 h-8 text-green-600" />
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                            <p className="text-gray-600 text-sm mb-1">المبلغ الإجمالي</p>
                            <p className="text-3xl font-bold text-gray-800">
                                { formatCurrency(statistics.total_amount || 0) }
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <Users className="w-8 h-8 text-purple-600" />
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                            <p className="text-gray-600 text-sm mb-1">عدد المستفيدين</p>
                            <p className="text-3xl font-bold text-gray-800">
                                { (statistics.total_beneficiaries || 0).toLocaleString('en-US') }
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <Package className="w-8 h-8 text-orange-600" />
                            </div>
                            <p className="text-gray-600 text-sm mb-1">المشاريع حسب الحالة</p>
                            <div className="mt-2 space-y-1">
                                { statistics.projects_by_status && Object.entries(statistics.projects_by_status).map(([status, count]) => {
                                    // ✅ التأكد من أن count هو number أو string وليس object
                                    const countValue = typeof count === 'object' && count !== null
                                        ? (count.count || count.total || count.value || 0)
                                        : (Number(count) || 0);
                                    return (
                                        <div key={ String(status) } className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">{ String(status) }:</span>
                                            <span className="font-bold text-gray-800">{ countValue }</span>
                                        </div>
                                    );
                                }) }
                            </div>
                        </div>
                    </div>
                ) }

                {/* Projects List */ }
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white">
                        <h2 className="text-xl font-bold flex items-center">
                            <FolderKanban className="w-5 h-5 ml-2" />
                            المشاريع المرتبطة ({ projects.length })
                        </h2>
                    </div>
                    <div className="p-6">
                        { projects.length === 0 ? (
                            <div className="text-center py-12">
                                <FolderKanban className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600 text-lg">لا توجد مشاريع مرتبطة بهذه التفرعية</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                { projects.map((project) => (
                                    <div
                                        key={ project.id }
                                        className="p-4 border-2 border-gray-200 rounded-xl hover:border-sky-300 transition-colors cursor-pointer"
                                        onClick={ () => navigate(`/project-management/projects/${project.id}`) }
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-bold text-gray-800 text-lg mb-2">
                                                    { project.project_name || project.donor_name || 'مشروع بدون اسم' }
                                                </h3>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-gray-500">كود المشروع:</span>
                                                        <span className="font-bold text-gray-800 mr-1">
                                                            { project.donor_code || project.internal_code || '---' }
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">المبلغ:</span>
                                                        <span className="font-bold text-gray-800 mr-1">
                                                            { formatCurrency(project.amount_in_usd || project.net_amount_usd || 0) }
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">المستفيدون:</span>
                                                        <span className="font-bold text-gray-800 mr-1">
                                                            { (project.calculated_beneficiaries || project.beneficiaries_count || 0).toLocaleString('en-US') }
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">الحالة:</span>
                                                        <span className="font-bold text-gray-800 mr-1">
                                                            { project.status || '---' }
                                                        </span>
                                                    </div>
                                                </div>
                                                { project.created_at && (
                                                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                                                        <Calendar className="w-4 h-4" />
                                                        { formatDate(project.created_at) }
                                                    </div>
                                                ) }
                                            </div>
                                            <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mr-2" />
                                        </div>
                                    </div>
                                )) }
                            </div>
                        ) }
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubcategoryDetails;

