import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import {
    calculateTotalSurplus,
    calculateTotalDeficit,
    filterProjectsForAdmin,
    hasSurplus,
    hasDeficit,
} from '../../../utils/surplusHelpers';
import {
    Plus,
    Edit,
    Trash2,
    Eye,
    Power,
    Search,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Package,
    ArrowRight,
    Filter,
    X,
} from 'lucide-react';

const SurplusCategories = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false); // ✅ تعطيل loading state افتراضياً
    const [categories, setCategories] = useState([]);
    const [filters, setFilters] = useState({
        is_active: '',
        search: '',
        sort_by: 'created_at',
        sort_order: 'desc',
    });
    const [showFilters, setShowFilters] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

    useEffect(() => {
        // ✅ التحقق من وجود flag يشير إلى أن هناك تحديثات جديدة
        const shouldForceRefresh = localStorage.getItem('surplus_categories_updated') === 'true';

        if (shouldForceRefresh) {
            // ✅ تحديث البيانات فوراً إذا كان هناك تحديثات جديدة
            fetchCategories(true);
            // ✅ مسح الـ flag بعد التحديث
            localStorage.removeItem('surplus_categories_updated');
        } else {
            // ✅ تحميل عادي بدون force refresh
            fetchCategories();
        }
    }, [filters]);

    const fetchCategories = async (forceRefresh = false) => {
        try {
            setLoading(true);
            const params = {};
            if (filters.is_active !== '') params.is_active = filters.is_active;
            if (filters.search) params.search = filters.search;
            if (filters.sort_by) params.sort_by = filters.sort_by;
            if (filters.sort_order) params.sort_order = filters.sort_order;

            // ✅ إضافة timestamp لإجبار التحديث الفوري عند forceRefresh
            if (forceRefresh) {
                params._t = Date.now();
            }

            // ✅ جلب الأقسام
            const categoriesResponse = await apiClient.get('/surplus-categories', {
                params,
                headers: forceRefresh ? {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                } : {}
            });

            if (categoriesResponse.data.success) {
                let categoriesData = categoriesResponse.data.data || [];

                // ✅ محاولة جلب جميع المشاريع من endpoint التقرير للحساب الصحيح (اختياري)
                let projectsData = [];
                try {
                    const reportResponse = await apiClient.get('/surplus/report', {
                        params: {
                            per_page: 10000,
                            page: 1,
                        }
                    });

                    if (reportResponse.data.success) {
                        const reportData = reportResponse.data.data || reportResponse.data;
                        projectsData = Array.isArray(reportData.projects) ? reportData.projects : Array.isArray(reportData) ? reportData : [];

                        // ✅ فلترة المشاريع للأدمن: استبعاد المشاريع المقسمة الأصلية (نفس منطق التقرير)
                        projectsData = filterProjectsForAdmin(projectsData, user);
                    }
                } catch (reportError) {
                    // ✅ إذا فشل جلب المشاريع، نستخدم الإحصائيات من Backend
                    console.warn('⚠️ Failed to fetch projects for calculation, using Backend statistics:', reportError);
                    if (import.meta.env.DEV) {
                        console.log('📊 Using Backend statistics as fallback');
                    }
                }

                // ✅ إذا تم جلب المشاريع بنجاح، نحسب الإحصائيات من المشاريع الفعلية
                if (projectsData.length > 0) {
                    // ✅ حساب الإحصائيات لكل قسم من المشاريع الفعلية (نفس منطق صفحة تفاصيل القسم)
                    categoriesData = categoriesData.map(category => {
                        // ✅ فلترة المشاريع المرتبطة بهذا القسم
                        const categoryProjects = projectsData.filter(p =>
                            p.surplus_category_id === category.id ||
                            p.surplus_category?.id === category.id
                        );

                        // ✅ حساب الفائض والعجز من المشاريع الفعلية بنفس منطق صفحة التقرير
                        const calculatedSurplus = calculateTotalSurplus(categoryProjects);
                        const calculatedDeficit = calculateTotalDeficit(categoryProjects);
                        const calculatedBalance = calculatedSurplus - calculatedDeficit;

                        // ✅ حساب عدد المشاريع
                        const surplusProjectsCount = categoryProjects.filter(hasSurplus).length;
                        const deficitProjectsCount = categoryProjects.filter(hasDeficit).length;

                        // ✅ استبدال الإحصائيات من Backend بالإحصائيات المحسوبة من المشاريع الفعلية
                        return {
                            ...category,
                            statistics: {
                                total_balance: calculatedBalance,
                                total_surplus: calculatedSurplus,
                                total_deficit: calculatedDeficit,
                                projects_count: categoryProjects.length,
                                surplus_projects_count: surplusProjectsCount,
                                deficit_projects_count: deficitProjectsCount,
                            }
                        };
                    });
                } else {
                    // ✅ إذا لم يتم جلب المشاريع، نستخدم الإحصائيات من Backend مع حساب الرصيد الإجمالي
                    categoriesData = categoriesData.map(category => {
                        if (category.statistics) {
                            return {
                                ...category,
                                statistics: {
                                    ...category.statistics,
                                    // ✅ حساب الرصيد الإجمالي: الفائض - العجز
                                    total_balance: (category.statistics.total_surplus || 0) - (category.statistics.total_deficit || 0),
                                }
                            };
                        }
                        return category;
                    });
                }

                // ✅ تسجيل بيانات الإحصائيات للتحقق
                if (import.meta.env.DEV) {
                    console.log('📊 Surplus Categories Statistics (Calculated from Projects):', categoriesData.map(cat => ({
                        id: cat.id,
                        name: cat.name,
                        statistics: cat.statistics,
                        total_balance: cat.statistics?.total_balance,
                        total_surplus: cat.statistics?.total_surplus,
                        total_deficit: cat.statistics?.total_deficit,
                    })));
                }

                setCategories(categoriesData);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);

            // ✅ معالجة خاصة لخطأ 403 (Forbidden)
            if (error.response?.status === 403) {
                const errorMessage = error.response?.data?.message || 
                    'ليس لديك صلاحيات للوصول إلى أقسام الفائض. يرجى التواصل مع الإدارة.';
                
                if (import.meta.env.DEV) {
                    console.error('📊 Categories Error Details (403 Forbidden):', {
                        status: error.response?.status,
                        message: errorMessage,
                        data: error.response?.data,
                        url: error.config?.url,
                        userRole: user?.role || user?.userRole || user?.user_role || 'غير محدد',
                        note: 'Backend يرفض الطلب. يجب تحديث Backend للسماح لدور الإشراف بالوصول إلى endpoints الفائض.'
                    });
                }

                toast.error(errorMessage);
                setCategories([]);
                return;
            }

            // ✅ عرض رسالة خطأ واضحة للأخطاء الأخرى
            const errorMessage = error.response?.data?.message ||
                error.userMessage ||
                'حدث خطأ في جلب أقسام الفائض';

            // ✅ عرض تفاصيل الخطأ في وضع التطوير
            if (import.meta.env.DEV) {
                console.error('📊 Categories Error Details:', {
                    status: error.response?.status,
                    message: errorMessage,
                    data: error.response?.data,
                    url: error.config?.url,
                });
            }

            // ✅ عرض رسالة خطأ للمستخدم
            if (!error.isConnectionError && !error.isTimeoutError) {
                if (error.response?.status === 500) {
                    toast.error('خطأ في الخادم (500) - يرجى التحقق من سجلات الأخطاء في Backend', {
                        autoClose: 5000,
                    });
                } else {
                    toast.error(errorMessage || 'فشل تحميل أقسام الفائض');
                }
            }

            // ✅ في حالة الخطأ، نعرض قائمة فارغة
            setCategories([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (categoryId, categoryName) => {
        if (!window.confirm(`هل أنت متأكد من حذف قسم "${categoryName}"؟`)) {
            return;
        }

        try {
            setDeletingId(categoryId);
            const response = await apiClient.delete(`/surplus-categories/${categoryId}`);
            if (response.data.success) {
                toast.success(response.data.message || 'تم حذف القسم بنجاح');
                fetchCategories(true); // ✅ تحديث البيانات فوراً بعد الحذف
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            const errorMsg = error.response?.data?.message || 'فشل حذف القسم';
            toast.error(errorMsg);
        } finally {
            setDeletingId(null);
        }
    };

    const handleToggleStatus = async (categoryId, currentStatus) => {
        try {
            setTogglingId(categoryId);
            const response = await apiClient.patch(`/surplus-categories/${categoryId}/toggle-status`);
            if (response.data.success) {
                toast.success(response.data.message || 'تم تحديث حالة القسم');
                fetchCategories(true); // ✅ تحديث البيانات فوراً بعد تغيير الحالة
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            toast.error('فشل تحديث حالة القسم');
        } finally {
            setTogglingId(null);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
    };

    const clearFilters = () => {
        setFilters({
            is_active: '',
            search: '',
            sort_by: 'created_at',
            sort_order: 'desc',
        });
    };

    const formatCurrency = (amount) => {
        if (!amount || isNaN(amount)) return '0.00';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    // ✅ إزالة علامة التحميل - عرض المحتوى مباشرة

    return (
        <div className="min-h-screen bg-gray-50" style={ { fontFamily: 'Cairo, sans-serif' } }>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */ }
                <div className="mb-6">
                    <Link
                        to="/surplus/dashboard"
                        className="inline-flex items-center text-sky-600 hover:text-sky-700 mb-4"
                    >
                        <ArrowRight className="w-4 h-4 ml-2" />
                        العودة للوحة التحكم
                    </Link>
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                            <DollarSign className="w-8 h-8 text-green-600" />
                            إدارة أقسام الفائض
                        </h1>
                        <div className="flex gap-3">
                            <button
                                onClick={ () => setShowFilters(!showFilters) }
                                className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-md transition-shadow"
                            >
                                <Filter className="w-4 h-4" />
                                { showFilters ? 'إخفاء الفلاتر' : 'إظهار الفلاتر' }
                            </button>
                            <Link
                                to="/surplus/categories/new"
                                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow"
                            >
                                <Plus className="w-5 h-5" />
                                إضافة قسم جديد
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Filters */ }
                { showFilters && (
                    <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Filter className="w-5 h-5 text-sky-600" />
                                الفلاتر
                            </h2>
                            <button
                                onClick={ clearFilters }
                                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                مسح الكل
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Search className="w-4 h-4 inline ml-1" />
                                    البحث
                                </label>
                                <input
                                    type="text"
                                    value={ filters.search }
                                    onChange={ (e) => handleFilterChange('search', e.target.value) }
                                    placeholder="ابحث في الاسم أو الوصف..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">الحالة</label>
                                <select
                                    value={ filters.is_active }
                                    onChange={ (e) => handleFilterChange('is_active', e.target.value) }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="">الكل</option>
                                    <option value="1">نشط</option>
                                    <option value="0">غير نشط</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">الترتيب</label>
                                <select
                                    value={ filters.sort_by }
                                    onChange={ (e) => handleFilterChange('sort_by', e.target.value) }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="created_at">تاريخ الإنشاء</option>
                                    <option value="name">الاسم</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ) }

                {/* Categories Grid */ }
                { categories.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">لا توجد أقسام فائض حالياً</p>
                        <Link
                            to="/surplus/categories/new"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2 rounded-xl font-medium hover:shadow-lg transition-shadow"
                        >
                            <Plus className="w-5 h-5" />
                            إضافة قسم جديد
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        { categories.map((category) => (
                            <div
                                key={ category.id }
                                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border-t-4 border-green-500"
                            >
                                {/* Header */ }
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-800 mb-2">{ category.name }</h3>
                                        { category.description && (
                                            <p className="text-sm text-gray-600 line-clamp-2">{ category.description }</p>
                                        ) }
                                    </div>
                                    <span
                                        className={ `px-3 py-1 rounded-full text-xs font-medium ${category.is_active
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-600'
                                            }` }
                                    >
                                        { category.is_active ? 'نشط' : 'غير نشط' }
                                    </span>
                                </div>

                                {/* Statistics */ }
                                { category.statistics && (
                                    <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-xl">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">الرصيد الإجمالي</span>
                                            <span className={ `font-bold ${(category.statistics.total_surplus - category.statistics.total_deficit) >= 0 ? 'text-emerald-600' : 'text-red-600'}` }>
                                                ₪{ formatCurrency(category.statistics.total_surplus - category.statistics.total_deficit) }
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 flex items-center gap-1">
                                                <TrendingUp className="w-4 h-4 text-green-500" />
                                                الفائض
                                            </span>
                                            <span className="font-semibold text-green-600">
                                                ₪{ formatCurrency(category.statistics.total_surplus) }
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 flex items-center gap-1">
                                                <TrendingDown className="w-4 h-4 text-red-500" />
                                                العجز
                                            </span>
                                            <span className="font-semibold text-red-600">
                                                ₪{ formatCurrency(category.statistics.total_deficit) }
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                                            <span className="text-gray-600 flex items-center gap-1">
                                                <Package className="w-4 h-4 text-sky-500" />
                                                عدد المشاريع
                                            </span>
                                            <span className="font-bold text-gray-800">
                                                { category.statistics.projects_count || 0 }
                                            </span>
                                        </div>
                                    </div>
                                ) }

                                {/* Creator Info */ }
                                { category.creator_name && (
                                    <p className="text-xs text-gray-500 mb-4">
                                        أنشئ بواسطة: { category.creator_name }
                                    </p>
                                ) }

                                {/* Actions */ }
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={ () => navigate(`/surplus/categories/${category.id}`) }
                                        className="flex-1 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Eye className="w-4 h-4" />
                                        عرض
                                    </button>
                                    <button
                                        onClick={ () => navigate(`/surplus/categories/${category.id}/edit`) }
                                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Edit className="w-4 h-4" />
                                        تعديل
                                    </button>
                                    <button
                                        onClick={ () => handleToggleStatus(category.id, category.is_active) }
                                        disabled={ togglingId === category.id }
                                        className={ `p-2 rounded-xl text-sm font-medium transition-colors ${category.is_active
                                            ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                            : 'bg-green-200 hover:bg-green-300 text-green-700'
                                            } disabled:opacity-50` }
                                        title={ category.is_active ? 'تعطيل' : 'تفعيل' }
                                    >
                                        <Power className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={ () => handleDelete(category.id, category.name) }
                                        disabled={ deletingId === category.id }
                                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                                        title="حذف"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )) }
                    </div>
                ) }
            </div>
        </div>
    );
};

export default SurplusCategories;

