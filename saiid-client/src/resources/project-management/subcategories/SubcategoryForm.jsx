import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { Save, ArrowRight, Tag, X } from 'lucide-react';
import Unauthorized from '../components/Unauthorized';

const SubcategoryForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditMode = !!id;
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  const [formData, setFormData] = useState({
    name_ar: '',
    name: '',
    project_type: '',
    description: '',
    is_active: true,
  });

  const [errors, setErrors] = useState({});

  // ✅ الأنواع المسموحة فقط (القيم التي يقبلها الـ Backend في validation)
  // ملاحظة: الـ Backend هو الذي يحدد الأنواع المسموحة في validation rules
  // هذه القيم يجب أن تطابق ما في الـ Backend: 'required|string|in:إغاثي,تنموي,طبي,تعليمي'
  const ALLOWED_PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];

  // الأنواع الافتراضية كـ fallback
  const DEFAULT_PROJECT_TYPES = ALLOWED_PROJECT_TYPES;

  const [projectTypes, setProjectTypes] = useState(DEFAULT_PROJECT_TYPES); // ✅ استخدام الافتراضية كقيمة أولية
  const [projectTypesLoading, setProjectTypesLoading] = useState(false);

  useEffect(() => {
    fetchProjectTypes();
    if (isEditMode) {
      fetchSubcategoryDetails();
    }
  }, [id]);

  const fetchProjectTypes = async () => {
    setProjectTypesLoading(true);
    try {
      const response = await apiClient.get('/project-types', {
        params: {
          _t: Date.now(),
        },
        timeout: 10000,
        headers: {
          'Cache-Control': 'no-cache',
        }
      });

      if (response.data.success) {
        const data = response.data.data || response.data.types || [];
        // استخراج الأسماء فقط
        const types = data.map(type => typeof type === 'string' ? type : (type.name || type));

        // ✅ عرض جميع الأنواع من الـ API
        if (types.length > 0) {
          setProjectTypes(types);
          if (import.meta.env.DEV) {
            console.log('✅ Loaded project types from API:', types);
          }
        } else {
          // إذا كانت القائمة فارغة، استخدم الافتراضية
          setProjectTypes(DEFAULT_PROJECT_TYPES);
          if (import.meta.env.DEV) {
            console.warn('⚠️ No project types from API, using defaults');
          }
        }
      } else {
        setProjectTypes(DEFAULT_PROJECT_TYPES);
        if (import.meta.env.DEV) {
          console.warn('⚠️ API response not successful, using defaults');
        }
      }
    } catch (error) {
      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('Error fetching project types:', error);
        console.error('Response:', error.response?.data);
      }
      // Fallback: استخدام الأنواع الافتراضية فقط إذا كان API غير موجود (404)
      if (error.response?.status === 404) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ Project types API not found (404), using defaults');
        }
      }
      setProjectTypes(DEFAULT_PROJECT_TYPES);
    } finally {
      setProjectTypesLoading(false);
    }
  };

  const fetchSubcategoryDetails = async () => {
    setInitialLoading(true);
    try {
      const response = await apiClient.get(`/project-subcategories/${id}`, {
        params: { _t: Date.now() },
        timeout: 20000,
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (response.data.success) {
        const data = response.data.data;
        setFormData({
          name_ar: data.name_ar || '',
          name: data.name || '',
          project_type: data.project_type || '',
          description: data.description || '',
          is_active: data.is_active !== undefined ? data.is_active : true,
        });
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
      setInitialLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });

    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name_ar.trim()) {
      newErrors.name_ar = 'اسم التفرعية بالعربية مطلوب';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'اسم التفرعية بالإنجليزية مطلوب';
    }
    if (!formData.project_type) {
      newErrors.project_type = 'نوع المشروع مطلوب';
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
        name_ar: formData.name_ar.trim(),
        name: formData.name.trim(),
        project_type: formData.project_type,
        description: formData.description?.trim() || '',
        is_active: formData.is_active,
      };

      let response;
      if (isEditMode) {
        response = await apiClient.patch(`/project-subcategories/${id}`, payload);
      } else {
        response = await apiClient.post('/project-subcategories', payload);
      }

      if (response.data.success) {
        toast.success(`تم ${isEditMode ? 'تحديث' : 'إنشاء'} التفرعية بنجاح`);
        navigate(`/project-management/subcategories/${isEditMode ? id : response.data.data?.id || ''}`);
      } else {
        toast.error(response.data.message || `فشل ${isEditMode ? 'تحديث' : 'إنشاء'} التفرعية`);
      }
    } catch (error) {
      console.error('Error saving subcategory:', error);

      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لإدارة التفريعات. الصلاحيات مقتصرة على الإدارة فقط.';
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

      toast.error(error.userMessage || `حدث خطأ أثناء ${isEditMode ? 'تحديث' : 'إنشاء'} التفرعية`);
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
    return <Unauthorized requiredRole="admin" pageName={ isEditMode ? 'تعديل التفرعية' : 'إضافة تفرعية' } />;
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 pt-4">
          <button
            onClick={ () => navigate(isEditMode ? `/project-management/subcategories/${id}` : '/project-management/subcategories') }
            className="flex items-center text-sky-600 hover:text-sky-700 font-medium mb-4"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            { isEditMode ? 'العودة إلى التفاصيل' : 'العودة إلى القائمة' }
          </button>
          <h1 className="text-3xl font-bold text-gray-800">
            { isEditMode ? 'تعديل التفرعية' : 'إضافة تفرعية جديدة' }
          </h1>
          <p className="text-gray-600 mt-2">
            { isEditMode ? 'قم بتحديث بيانات التفرعية' : 'أدخل تفاصيل التفرعية الجديدة' }
          </p>
        </div>

        <form onSubmit={ handleSubmit } className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-sky-600" />
              المعلومات الأساسية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم التفرعية (عربي) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name_ar"
                  value={ formData.name_ar }
                  onChange={ handleChange }
                  placeholder="مثال: إطعام"
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.name_ar ? 'border-red-500' : 'border-gray-300'
                    }` }
                />
                { errors.name_ar && (
                  <p className="text-red-500 text-sm mt-1">{ errors.name_ar }</p>
                ) }
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم التفرعية (إنجليزي) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={ formData.name }
                  onChange={ handleChange }
                  placeholder="Example: Food Distribution"
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
                    }` }
                />
                { errors.name && (
                  <p className="text-red-500 text-sm mt-1">{ errors.name }</p>
                ) }
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع المشروع <span className="text-red-500">*</span>
                </label>
                <select
                  name="project_type"
                  value={ formData.project_type }
                  onChange={ handleChange }
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.project_type ? 'border-red-500' : 'border-gray-300'
                    }` }
                >
                  <option value="">اختر النوع</option>
                  { projectTypesLoading ? (
                    <option value="" disabled>جاري تحميل الأنواع...</option>
                  ) : (
                    // ✅ عرض جميع الأنواع من الـ API
                    (projectTypes.length > 0 ? projectTypes : DEFAULT_PROJECT_TYPES).map((type) => (
                      <option key={ type } value={ type }>
                        { type }
                      </option>
                    ))
                  ) }
                </select>
                { errors.project_type && (
                  <p className="text-red-500 text-sm mt-1">{ errors.project_type }</p>
                ) }
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="is_active"
                  id="is_active"
                  checked={ formData.is_active }
                  onChange={ handleChange }
                  className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  التفرعية نشطة
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الوصف (اختياري)
                </label>
                <textarea
                  name="description"
                  value={ formData.description }
                  onChange={ handleChange }
                  placeholder="وصف تفصيلي للتفرعية..."
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */ }
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={ () => navigate(isEditMode ? `/project-management/subcategories/${id}` : '/project-management/subcategories') }
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
              { loading ? 'جاري الحفظ...' : (isEditMode ? 'تحديث التفرعية' : 'إنشاء التفرعية') }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubcategoryForm;

