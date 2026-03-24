import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { FolderKanban, Plus, Edit, Trash2, Search, RefreshCw, X } from 'lucide-react';
import Unauthorized from '../components/Unauthorized';

const ProjectTypesList = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [projectTypes, setProjectTypes] = useState([]);
    const [filteredTypes, setFilteredTypes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

    useEffect(() => {
        fetchProjectTypes();
    }, []);

    useEffect(() => {
        filterTypes();
    }, [searchTerm, projectTypes]);

    const fetchProjectTypes = async () => {
        setLoading(true);
        try {
            // محاولة جلب أنواع المشاريع من API
            // إذا لم يكن موجوداً، نستخدم الأنواع الافتراضية
            try {
                const response = await apiClient.get('/project-types', {
                    params: { _t: Date.now() },
                    timeout: 10000,
                    headers: { 'Cache-Control': 'no-cache' }
                });

                if (response.data.success) {
                    const data = response.data.data || response.data.types || [];
                    setProjectTypes(data);
                } else {
                    // Fallback: استخدام الأنواع الافتراضية
                    setProjectTypes(getDefaultTypes());
                }
            } catch (apiError) {
                // إذا فشل API، نستخدم الأنواع الافتراضية
                if (apiError.response?.status === 404) {
                    // API غير موجود - نستخدم الأنواع الافتراضية
                    setProjectTypes(getDefaultTypes());
                } else {
                    throw apiError;
                }
            }
        } catch (error) {
            if (import.meta.env.DEV && !error.isConnectionError) {
                console.error('Error fetching project types:', error);
            }
            // Fallback: استخدام الأنواع الافتراضية
            setProjectTypes(getDefaultTypes());
            if (!error.isConnectionError && error.response?.status !== 404) {
                toast.error('فشل تحميل أنواع المشاريع - استخدام الأنواع الافتراضية');
            }
        } finally {
            setLoading(false);
        }
    };

    const getDefaultTypes = () => {
        // الأنواع الافتراضية
        return [
            { id: 1, name: 'إغاثي', created_at: null, updated_at: null },
            { id: 2, name: 'تنموي', created_at: null, updated_at: null },
            { id: 3, name: 'طبي', created_at: null, updated_at: null },
            { id: 4, name: 'تعليمي', created_at: null, updated_at: null },
        ];
    };

    const filterTypes = () => {
        let filtered = [...projectTypes];

        if (searchTerm) {
            filtered = filtered.filter(type =>
                type.name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredTypes(filtered);
    };

    const handleDelete = async (id) => {
        try {
            const response = await apiClient.delete(`/project-types/${id}`);

            if (response.data.success) {
                toast.success('تم حذف نوع المشروع بنجاح');
                setShowDeleteConfirm(null);
                fetchProjectTypes();
            } else {
                toast.error(response.data.message || 'فشل حذف نوع المشروع');
            }
        } catch (error) {
            if (error.response?.status === 400 || error.response?.status === 422) {
                const message = error.response?.data?.message || 'لا يمكن حذف نوع المشروع لأنه مستخدم في مشاريع';
                toast.error(message);
            } else if (error.response?.status === 404) {
                // API غير موجود - حذف محلي
                setProjectTypes(prev => prev.filter(type => type.id !== id));
                toast.success('تم حذف نوع المشروع');
                setShowDeleteConfirm(null);
            } else {
                toast.error('حدث خطأ أثناء حذف نوع المشروع');
            }
            setShowDeleteConfirm(null);
        }
    };

    const userRole = user?.role?.toLowerCase?.() ||
        user?.userRole?.toLowerCase?.() ||
        user?.user_role?.toLowerCase?.() ||
        user?.role_name?.toLowerCase?.() ||
        user?.role || '';

    const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

    if (!user || (userRole && !isAdmin)) {
        return <Unauthorized requiredRole="admin" pageName="إدارة أنواع المشاريع" />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */ }
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">إدارة أنواع المشاريع</h1>
                        <p className="text-gray-600 mt-1">إدارة أنواع المشاريع المتاحة</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={ fetchProjectTypes }
                            disabled={ loading }
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50"
                        >
                            <RefreshCw className={ `w-5 h-5 ${loading ? 'animate-spin' : ''}` } />
                            تحديث
                        </button>
                        <button
                            onClick={ () => navigate('/project-management/project-types/new') }
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow"
                        >
                            <Plus className="w-5 h-5" />
                            إضافة نوع جديد
                        </button>
                    </div>
                </div>

                {/* Search */ }
                <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="بحث في أنواع المشاريع..."
                            value={ searchTerm }
                            onChange={ (e) => setSearchTerm(e.target.value) }
                            className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                </div>

                {/* Project Types List */ }
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center">
                                <FolderKanban className="w-5 h-5 ml-2" />
                                قائمة أنواع المشاريع
                            </h2>
                            { !loading && (
                                <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                                    { filteredTypes.length } نوع
                                </span>
                            ) }
                        </div>
                    </div>
                    <div className="p-6">
                        { loading ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
                            </div>
                        ) : filteredTypes.length === 0 ? (
                            <div className="text-center py-12">
                                <FolderKanban className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600 text-lg">لا توجد أنواع مشاريع</p>
                                <button
                                    onClick={ () => navigate('/project-management/project-types/new') }
                                    className="mt-4 text-sky-600 hover:text-sky-700 font-medium"
                                >
                                    إضافة نوع جديد
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                { filteredTypes.map((type) => (
                                    <div
                                        key={ type.id }
                                        className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-sky-300 transition-colors bg-white"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                                                { type.name.charAt(0) }
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-lg">
                                                    { type.name }
                                                </h3>
                                                { type.created_at && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        تم الإنشاء: { new Date(type.created_at).toLocaleDateString('ar-SA') }
                                                    </p>
                                                ) }
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={ () => navigate(`/project-management/project-types/${type.id}/edit`) }
                                                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                                                title="تعديل"
                                            >
                                                <Edit className="w-4 h-4" />
                                                تعديل
                                            </button>
                                            <button
                                                onClick={ () => setShowDeleteConfirm(type.id) }
                                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                                                title="حذف"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                حذف
                                            </button>
                                        </div>
                                    </div>
                                )) }
                            </div>
                        ) }
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */ }
            { showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">تأكيد الحذف</h3>
                        <p className="text-gray-600 mb-6">
                            هل أنت متأكد من حذف هذا النوع؟ قد لا يمكن حذفه إذا كان مستخدماً في مشاريع.
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={ () => setShowDeleteConfirm(null) }
                                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={ () => handleDelete(showDeleteConfirm) }
                                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                            >
                                حذف
                            </button>
                        </div>
                    </div>
                </div>
            ) }
        </div>
    );
};

export default ProjectTypesList;

