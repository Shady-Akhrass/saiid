import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { Tag, Plus, Edit, Trash2, Eye, Search, Filter, RefreshCw, X, CheckCircle, XCircle } from 'lucide-react';
import Unauthorized from '../components/Unauthorized';

const SubcategoriesList = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [subcategories, setSubcategories] = useState([]);
    const [filteredSubcategories, setFilteredSubcategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [projectTypeFilter, setProjectTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

    const PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];

    useEffect(() => {
        fetchSubcategories();
    }, []);

    useEffect(() => {
        filterSubcategories();
    }, [searchTerm, projectTypeFilter, statusFilter, subcategories]);

    const fetchSubcategories = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/project-subcategories', {
                params: {
                    _t: Date.now(),
                },
                timeout: 20000,
                headers: {
                    'Cache-Control': 'no-cache',
                }
            });

            if (response.data.success) {
                const data = response.data.data || [];
                setSubcategories(data);
            } else {
                toast.error('فشل تحميل التفريعات');
            }
        } catch (error) {
            if (import.meta.env.DEV && !error.isConnectionError) {
                console.error('Error fetching subcategories:', error);
            }
            if (!error.isConnectionError) {
                toast.error('فشل تحميل التفريعات');
            }
        } finally {
            setLoading(false);
        }
    };

    const filterSubcategories = () => {
        let filtered = [...subcategories];

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(sub =>
                sub.name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by project type
        if (projectTypeFilter) {
            filtered = filtered.filter(sub => sub.project_type === projectTypeFilter);
        }

        // Filter by status
        if (statusFilter === 'active') {
            filtered = filtered.filter(sub => sub.is_active);
        } else if (statusFilter === 'inactive') {
            filtered = filtered.filter(sub => !sub.is_active);
        }

        setFilteredSubcategories(filtered);
    };

    const handleDelete = async (id) => {
        try {
            const response = await apiClient.delete(`/project-subcategories/${id}`);

            if (response.data.success) {
                toast.success('تم حذف التفرعية بنجاح');
                setShowDeleteConfirm(null);
                fetchSubcategories();
            } else {
                toast.error(response.data.message || 'فشل حذف التفرعية');
            }
        } catch (error) {
            if (error.response?.status === 400 || error.response?.status === 422) {
                const message = error.response?.data?.message || 'لا يمكن حذف التفرعية لأنها مرتبطة بمشاريع';
                toast.error(message);
            } else {
                toast.error('حدث خطأ أثناء حذف التفرعية');
            }
            setShowDeleteConfirm(null);
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        try {
            const response = await apiClient.patch(`/project-subcategories/${id}/toggle-status`);

            if (response.data.success) {
                toast.success(`تم ${currentStatus ? 'تعطيل' : 'تفعيل'} التفرعية بنجاح`);
                fetchSubcategories();
            } else {
                toast.error(response.data.message || 'فشل تحديث حالة التفرعية');
            }
        } catch (error) {
            toast.error('حدث خطأ أثناء تحديث حالة التفرعية');
        }
    };

    const userRole = user?.role?.toLowerCase?.() ||
        user?.userRole?.toLowerCase?.() ||
        user?.user_role?.toLowerCase?.() ||
        user?.role_name?.toLowerCase?.() ||
        user?.role || '';

    const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

    if (!user || (userRole && !isAdmin)) {
        return <Unauthorized requiredRole="admin" pageName="إدارة التفريعات" />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */ }
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">إدارة التفريعات</h1>
                        <p className="text-gray-600 mt-1">إدارة تفريعات المشاريع حسب النوع</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={ fetchSubcategories }
                            disabled={ loading }
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50"
                        >
                            <RefreshCw className={ `w-5 h-5 ${loading ? 'animate-spin' : ''}` } />
                            تحديث
                        </button>
                        <button
                            onClick={ () => navigate('/project-management/subcategories/new') }
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow"
                        >
                            <Plus className="w-5 h-5" />
                            إضافة تفرعية جديدة
                        </button>
                    </div>
                </div>

                {/* Filters */ }
                <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="بحث في التفريعات..."
                                value={ searchTerm }
                                onChange={ (e) => setSearchTerm(e.target.value) }
                                className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                        <div>
                            <select
                                value={ projectTypeFilter }
                                onChange={ (e) => setProjectTypeFilter(e.target.value) }
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="">جميع أنواع المشاريع</option>
                                { PROJECT_TYPES.map(type => (
                                    <option key={ type } value={ type }>{ type }</option>
                                )) }
                            </select>
                        </div>
                        <div>
                            <select
                                value={ statusFilter }
                                onChange={ (e) => setStatusFilter(e.target.value) }
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="">جميع الحالات</option>
                                <option value="active">نشطة فقط</option>
                                <option value="inactive">غير نشطة</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Subcategories List */ }
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center">
                                <Tag className="w-5 h-5 ml-2" />
                                قائمة التفريعات
                            </h2>
                            { !loading && (
                                <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                                    { filteredSubcategories.length } تفرعية
                                </span>
                            ) }
                        </div>
                    </div>
                    <div className="p-6">
                        { loading ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
                            </div>
                        ) : filteredSubcategories.length === 0 ? (
                            <div className="text-center py-12">
                                <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600 text-lg">لا توجد تفريعات</p>
                                <button
                                    onClick={ () => navigate('/project-management/subcategories/new') }
                                    className="mt-4 text-sky-600 hover:text-sky-700 font-medium"
                                >
                                    إضافة تفرعية جديدة
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                { filteredSubcategories.map((sub) => (
                                    <div
                                        key={ sub.id }
                                        className={ `p-4 border-2 rounded-xl transition-all hover:shadow-lg ${sub.is_active
                                                ? 'border-gray-200 hover:border-sky-300 bg-white'
                                                : 'border-gray-300 bg-gray-50 opacity-75'
                                            }` }
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-bold text-gray-800 text-lg mb-1">
                                                    { sub.name_ar || sub.name }
                                                </h3>
                                                { sub.name && sub.name !== sub.name_ar && (
                                                    <p className="text-sm text-gray-500 mb-2">{ sub.name }</p>
                                                ) }
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                        { sub.project_type }
                                                    </span>
                                                    { sub.is_active ? (
                                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                                                            <CheckCircle className="w-3 h-3" />
                                                            نشطة
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
                                                            <XCircle className="w-3 h-3" />
                                                            غير نشطة
                                                        </span>
                                                    ) }
                                                </div>
                                                { sub.description && (
                                                    <p className="text-sm text-gray-600 line-clamp-2">{ sub.description }</p>
                                                ) }
                                                { sub.statistics && (
                                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <span className="text-gray-500">المشاريع:</span>
                                                                <span className="font-bold text-gray-800 mr-1">
                                                                    { sub.statistics.total_projects || 0 }
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">المبلغ:</span>
                                                                <span className="font-bold text-gray-800 mr-1">
                                                                    ${ (sub.statistics.total_amount || 0).toLocaleString('en-US') }
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) }
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-4">
                                            <button
                                                onClick={ () => navigate(`/project-management/subcategories/${sub.id}`) }
                                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Eye className="w-4 h-4" />
                                                التفاصيل
                                            </button>
                                            <button
                                                onClick={ () => navigate(`/project-management/subcategories/${sub.id}/edit`) }
                                                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                                                title="تعديل"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={ () => handleToggleStatus(sub.id, sub.is_active) }
                                                className={ `px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors ${sub.is_active
                                                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                                        : 'bg-green-500 hover:bg-green-600 text-white'
                                                    }` }
                                                title={ sub.is_active ? 'تعطيل' : 'تفعيل' }
                                            >
                                                { sub.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" /> }
                                            </button>
                                            <button
                                                onClick={ () => setShowDeleteConfirm(sub.id) }
                                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
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
            </div>

            {/* Delete Confirmation Modal */ }
            { showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">تأكيد الحذف</h3>
                        <p className="text-gray-600 mb-6">
                            هل أنت متأكد من حذف هذه التفرعية؟ قد لا يمكن حذفها إذا كانت مرتبطة بمشاريع.
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

export default SubcategoriesList;

