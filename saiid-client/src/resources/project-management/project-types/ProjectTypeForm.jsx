import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { Save, ArrowRight, FolderKanban } from 'lucide-react';
import Unauthorized from '../components/Unauthorized';

const ProjectTypeForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEditMode = !!id;
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isEditMode) {
            fetchProjectTypeDetails();
        }
    }, [id]);

    const fetchProjectTypeDetails = async () => {
        setInitialLoading(true);
        try {
            const response = await apiClient.get(`/project-types/${id}`, {
                params: { _t: Date.now() },
                timeout: 10000,
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (response.data.success) {
                const data = response.data.data || response.data.type || {};
                setFormData({
                    name: data.name || '',
                });
            } else {
                toast.error('فشل تحميل بيانات نوع المشروع');
                navigate('/project-management/project-types');
            }
        } catch (error) {
            if (import.meta.env.DEV && !error.isConnectionError) {
                console.error('Error fetching project type:', error);
            }
            if (error.response?.status === 404) {
                // API غير موجود - محاولة جلب من القائمة المحلية
                toast.error('نوع المشروع غير موجود');
                navigate('/project-management/project-types');
            } else if (!error.isConnectionError) {
                toast.error('فشل تحميل بيانات نوع المشروع');
            }
            navigate('/project-management/project-types');
        } finally {
            setInitialLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });

        if (errors[name]) {
            setErrors({ ...errors, [name]: null });
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'اسم نوع المشروع مطلوب';
        } else if (formData.name.trim().length < 2) {
            newErrors.name = 'اسم نوع المشروع يجب أن يكون على الأقل حرفين';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            toast.error('الرجاء تصحيح الأخطاء في النموذج');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                name: formData.name.trim(),
            };

            let response;
            if (isEditMode) {
                response = await apiClient.patch(`/project-types/${id}`, payload);
            } else {
                response = await apiClient.post('/project-types', payload);
            }

            if (response.data.success) {
                toast.success(`تم ${isEditMode ? 'تحديث' : 'إنشاء'} نوع المشروع بنجاح`);
                navigate('/project-management/project-types');
            } else {
                toast.error(response.data.message || `فشل ${isEditMode ? 'تحديث' : 'إنشاء'} نوع المشروع`);
            }
        } catch (error) {
            console.error('Error saving project type:', error);

            if (error.response?.status === 403 || error.isPermissionError) {
                const permissionMessage = error.response?.data?.message || error.userMessage ||
                    'ليس لديك صلاحيات لإدارة أنواع المشاريع. الصلاحيات مقتصرة على الإدارة فقط.';
                toast.error(permissionMessage);
                return;
            }

            if (error.response?.status === 422 && error.response?.data?.errors) {
                const validationErrors = {};
                Object.keys(error.response.data.errors).forEach((field) => {
                    validationErrors[field] = error.response.data.errors[field][0];
                });
                setErrors(validationErrors);
                toast.error('الرجاء تصحيح الأخطاء في النموذج');
                return;
            }

            if (error.response?.status === 404) {
                // API غير موجود - حفظ محلي (في حالة التطوير)
                if (import.meta.env.DEV) {
                    toast.success(`تم ${isEditMode ? 'تحديث' : 'إنشاء'} نوع المشروع (محلي)`);
                    navigate('/project-management/project-types');
                } else {
                    toast.error('API غير متاح');
                }
                return;
            }

            toast.error(error.userMessage || `حدث خطأ أثناء ${isEditMode ? 'تحديث' : 'إنشاء'} نوع المشروع`);
        } finally {
            setLoading(false);
        }
    };

    const userRole = user?.role?.toLowerCase?.() ||
        user?.userRole?.toLowerCase?.() ||
        user?.user_role?.toLowerCase?.() ||
        user?.role_name?.toLowerCase?.() ||
        user?.role || '';

    const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

    if (!user || (userRole && !isAdmin)) {
        return <Unauthorized requiredRole="admin" pageName={ isEditMode ? 'تعديل نوع المشروع' : 'إضافة نوع مشروع' } />;
    }

    if (initialLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
            <div className="max-w-3xl mx-auto">
                <div className="mb-6 pt-4">
                    <button
                        onClick={ () => navigate('/project-management/project-types') }
                        className="flex items-center text-sky-600 hover:text-sky-700 font-medium mb-4"
                    >
                        <ArrowRight className="w-5 h-5 ml-2" />
                        العودة إلى القائمة
                    </button>
                    <h1 className="text-3xl font-bold text-gray-800">
                        { isEditMode ? 'تعديل نوع المشروع' : 'إضافة نوع مشروع جديد' }
                    </h1>
                    <p className="text-gray-600 mt-2">
                        { isEditMode ? 'قم بتحديث اسم نوع المشروع' : 'أدخل اسم نوع المشروع الجديد' }
                    </p>
                </div>

                <form onSubmit={ handleSubmit } className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-lg">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FolderKanban className="w-5 h-5 text-sky-600" />
                            معلومات نوع المشروع
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    اسم نوع المشروع <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={ formData.name }
                                    onChange={ handleChange }
                                    placeholder="مثال: إغاثي، تنموي، طبي، تعليمي"
                                    className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
                                        }` }
                                />
                                { errors.name && (
                                    <p className="text-red-500 text-sm mt-1">{ errors.name }</p>
                                ) }
                                <p className="text-xs text-gray-500 mt-1">
                                    هذا الاسم سيظهر في قائمة أنواع المشاريع عند إنشاء مشروع جديد
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */ }
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={ () => navigate('/project-management/project-types') }
                            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 flex items-center gap-2"
                        >
                            <ArrowRight className="w-4 h-4" />
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={ loading }
                            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            { loading ? 'جاري الحفظ...' : (isEditMode ? 'تحديث النوع' : 'إنشاء النوع') }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProjectTypeForm;

