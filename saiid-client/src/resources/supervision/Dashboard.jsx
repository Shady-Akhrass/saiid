import React, { useState, useEffect } from 'react';
import supervisionAPI from '../../api/supervision';
import { useToast } from '../../hooks/useToast';
import { 
    RefreshCw, 
    FolderKanban, 
    Users, 
    Heart, 
    Home, 
    Stethoscope, 
    GraduationCap, 
    BookOpen, 
    Briefcase,
    TrendingUp,
    AlertCircle,
    CheckCircle,
    Clock
} from 'lucide-react';

const SupervisionDashboard = () => {
    const [dashboardData, setDashboardData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { success, error: showError } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await supervisionAPI.getSummaryDashboard();
            if (response.success) {
                setDashboardData(response.data);
            } else {
                // ✅ إذا كان هناك بيانات جزئية، نعرضها
                if (response.data && Object.keys(response.data).length > 0) {
                    setDashboardData(response.data);
                    showError('تم تحميل بعض البيانات، لكن حدث خطأ في جزء منها');
                } else {
                    setError(response.error || 'فشل تحميل البيانات');
                    showError(response.error || 'فشل تحميل البيانات');
                }
            }
        } catch (err) {
            // ✅ معالجة أخطاء قاعدة البيانات بشكل خاص
            const errorMessage = err.response?.data?.message || err.message || 'حدث خطأ أثناء تحميل البيانات';
            const isDatabaseError = errorMessage.includes('Column not found') ||
                errorMessage.includes('Unknown column') ||
                errorMessage.includes('sponsorship_status');

            if (isDatabaseError) {
                // ✅ إذا كان خطأ في قاعدة البيانات، نعرض رسالة واضحة
                const dbError = 'خطأ في قاعدة البيانات: العمود المطلوب غير موجود. يرجى التواصل مع المطور.';
                setError(dbError);
                showError(dbError);
                console.error('Database Schema Error:', err.response?.data || err);
            } else {
                setError(errorMessage);
                showError(errorMessage);
                console.error('Dashboard Error:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    const refreshData = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await supervisionAPI.getSummaryDashboard(true);
            if (response.success) {
                setDashboardData(response.data);
                success('تم تحديث البيانات بنجاح');
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'فشل تحديث البيانات';
            setError(errorMessage);
            showError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !dashboardData.projects) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
                <p className="ml-4 text-gray-600">جاري تحميل البيانات...</p>
            </div>
        );
    }

    if (error && !dashboardData.projects) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen">
                <div className="text-red-600 mb-4">
                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="text-lg mb-4 text-gray-700">{ error }</p>
                <button
                    onClick={ loadData }
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    إعادة المحاولة
                </button>
            </div>
        );
    }

    return (
        <div className="supervision-dashboard min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6" style={ { fontFamily: 'Cairo, Tajawal, Arial, sans-serif' } }>
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="dashboard-header bg-white rounded-2xl shadow-lg p-6 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl shadow-lg">
                            <TrendingUp className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                لوحة التحكم - الإدارة العليا
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">نظرة شاملة على جميع الأنشطة والإحصائيات</p>
                        </div>
                    </div>
                    <button
                        onClick={ refreshData }
                        disabled={ loading }
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                        <RefreshCw className={ `w-5 h-5 ${loading ? 'animate-spin' : ''}` } />
                        <span className="font-semibold">تحديث البيانات</span>
                    </button>
                </div>
            </div>

            {/* إحصائيات المشاريع - عرض كامل */}
            <div className="mb-8">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl">
                            <FolderKanban className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">المشاريع</h2>
                            <p className="text-sm text-gray-500">إحصائيات شاملة لجميع المشاريع</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* إجمالي المشاريع */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-600 font-medium">إجمالي المشاريع</span>
                                <CheckCircle className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="text-4xl font-bold text-blue-600">
                                { dashboardData.projects?.total?.toLocaleString() || 0 }
                            </div>
                        </div>

                        {/* حسب الحالة */}
                        { dashboardData.projects?.by_status && Object.keys(dashboardData.projects.by_status).length > 0 && (
                            <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                                <div className="flex items-center gap-2 mb-4">
                                    <Clock className="w-5 h-5 text-gray-600" />
                                    <h4 className="text-base font-bold text-gray-700">حسب الحالة</h4>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    { Object.entries(dashboardData.projects.by_status).map(([status, count]) => (
                                        <div key={ status } className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors">
                                            <span className="text-sm text-gray-700">{ status }</span>
                                            <span className="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                                { count.toLocaleString() }
                                            </span>
                                        </div>
                                    )) }
                                </div>
                            </div>
                        ) }

                        {/* حسب النوع */}
                        { dashboardData.projects?.by_type && Object.keys(dashboardData.projects.by_type).length > 0 && (
                            <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                                <div className="flex items-center gap-2 mb-4">
                                    <FolderKanban className="w-5 h-5 text-gray-600" />
                                    <h4 className="text-base font-bold text-gray-700">حسب النوع</h4>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    { Object.entries(dashboardData.projects.by_type).map(([type, count]) => (
                                        <div key={ type } className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors">
                                            <span className="text-sm text-gray-700">{ type }</span>
                                            <span className="text-sm font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                                                { count.toLocaleString() }
                                            </span>
                                        </div>
                                    )) }
                                </div>
                            </div>
                        ) }
                    </div>
                </div>
            </div>

            {/* باقي الإحصائيات */}
            <div className="dashboard-content grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                {/* الأيتام */ }
                <div className="stat-card bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                    <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-4">
                        <div className="flex items-center justify-between">
                            <Users className="w-8 h-8 text-white" />
                            <span className="text-3xl font-bold text-white">
                                { dashboardData.orphans?.total?.toLocaleString() || 0 }
                            </span>
                        </div>
                    </div>
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">الأيتام</h3>
                        { dashboardData.orphans?.sponsored !== undefined || dashboardData.orphans?.not_sponsored !== undefined ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                                    <span className="text-sm font-medium text-green-700">مكفول</span>
                                    <span className="text-lg font-bold text-green-600">
                                        { dashboardData.orphans?.sponsored?.toLocaleString() || 0 }
                                    </span>
                                </div>
                                <div className="flex items-center justify-between bg-orange-50 rounded-lg p-3">
                                    <span className="text-sm font-medium text-orange-700">غير مكفول</span>
                                    <span className="text-lg font-bold text-orange-600">
                                        { dashboardData.orphans?.not_sponsored?.toLocaleString() || 0 }
                                    </span>
                                </div>
                            </div>
                        ) : error && error.includes('sponsorship_status') ? (
                            <div className="bg-yellow-50 border-r-4 border-yellow-400 p-3 rounded">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                                    <span className="text-sm text-yellow-700">بيانات الكفالة غير متاحة</span>
                                </div>
                            </div>
                        ) : null }
                    </div>
                </div>

                {/* المساعدات */ }
                <div className="stat-card bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-violet-500 p-4">
                        <div className="flex items-center justify-between">
                            <Heart className="w-8 h-8 text-white" />
                            <span className="text-3xl font-bold text-white">
                                { dashboardData.aids?.total?.toLocaleString() || 0 }
                            </span>
                        </div>
                    </div>
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-800">المساعدات</h3>
                    </div>
                </div>

                {/* المخيمات */ }
                <div className="stat-card bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                    <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-4">
                        <div className="flex items-center justify-between">
                            <Home className="w-8 h-8 text-white" />
                            <span className="text-3xl font-bold text-white">
                                { dashboardData.shelters?.total?.toLocaleString() || 0 }
                            </span>
                        </div>
                    </div>
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-3">المخيمات</h3>
                        { dashboardData.shelters?.total_families !== undefined && (
                            <div className="bg-teal-50 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-teal-700">عدد العائلات</span>
                                    <span className="text-lg font-bold text-teal-600">
                                        { dashboardData.shelters.total_families?.toLocaleString() }
                                    </span>
                                </div>
                            </div>
                        ) }
                    </div>
                </div>

                {/* المرضى */ }
                <div className="stat-card bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                    <div className="bg-gradient-to-r from-red-500 to-pink-500 p-4">
                        <div className="flex items-center justify-between">
                            <Stethoscope className="w-8 h-8 text-white" />
                            <span className="text-3xl font-bold text-white">
                                { dashboardData.patients?.total?.toLocaleString() || 0 }
                            </span>
                        </div>
                    </div>
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-800">المرضى</h3>
                    </div>
                </div>

                {/* الطلاب */ }
                <div className="stat-card bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
                        <div className="flex items-center justify-between">
                            <GraduationCap className="w-8 h-8 text-white" />
                            <span className="text-3xl font-bold text-white">
                                { dashboardData.students?.total?.toLocaleString() || 0 }
                            </span>
                        </div>
                    </div>
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-800">الطلاب</h3>
                    </div>
                </div>

                {/* المعلمين */ }
                <div className="stat-card bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-green-500 p-4">
                        <div className="flex items-center justify-between">
                            <BookOpen className="w-8 h-8 text-white" />
                            <span className="text-3xl font-bold text-white">
                                { dashboardData.teachers?.total?.toLocaleString() || 0 }
                            </span>
                        </div>
                    </div>
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-800">المعلمين</h3>
                    </div>
                </div>

                {/* فرص العمل */ }
                <div className="stat-card bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                        <div className="flex items-center justify-between">
                            <Briefcase className="w-8 h-8 text-white" />
                            <span className="text-3xl font-bold text-white">
                                { dashboardData.employments?.total?.toLocaleString() || 0 }
                            </span>
                        </div>
                    </div>
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-800">فرص العمل</h3>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default SupervisionDashboard;
