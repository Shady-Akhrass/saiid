import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { useCacheInvalidation } from '../../../hooks/useCacheInvalidation';
import { toast } from 'react-toastify';
import {
  ArrowRight,
  Save,
  X,
  DollarSign,
  FileText,
  CheckCircle2,
} from 'lucide-react';

const SurplusCategoryForm = () => {
  const { id: categoryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { invalidateCache } = useCacheInvalidation();
  const isEdit = !!categoryId;
  const [loading, setLoading] = useState(false); // ✅ تعطيل loading state افتراضياً
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    if (isEdit) {
      fetchCategory();
    }
  }, [categoryId]);

  const fetchCategory = async () => {
    try {
      // ✅ إزالة setLoading(true) لجعل الانتقال أسرع
      // setLoading(true);
      const response = await apiClient.get(`/surplus-categories/${categoryId}`);
      if (response.data.success) {
        const category = response.data.data;
        setFormData({
          name: category.name || '',
          description: category.description || '',
          is_active: category.is_active !== undefined ? category.is_active : true,
        });
      }
    } catch (error) {
      console.error('Error fetching category:', error);
      toast.error('فشل تحميل بيانات القسم');
      navigate('/surplus/categories');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    // مسح الخطأ عند التعديل
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'اسم القسم مطلوب';
    } else if (formData.name.length > 255) {
      newErrors.name = 'اسم القسم يجب ألا يزيد عن 255 حرف';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('يرجى تصحيح الأخطاء في النموذج');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        is_active: formData.is_active,
      };

      let response;
      if (isEdit) {
        response = await apiClient.patch(`/surplus-categories/${categoryId}`, payload);
      } else {
        response = await apiClient.post('/surplus-categories', payload);
      }

      if (response.data.success) {
        toast.success(response.data.message || (isEdit ? 'تم تحديث القسم بنجاح' : 'تم إضافة القسم بنجاح'));
        // ✅ وضع flag يشير إلى أن الأقسام تم تحديثها
        localStorage.setItem('surplus_categories_updated', 'true');
        // ✅ إبطال كاش الأقسام
        invalidateCache('surplus_categories');
        navigate('/surplus/categories');
      }
    } catch (error) {
      console.error('Error submitting form:', error);

      // معالجة أخطاء التحقق من البيانات
      if (error.response?.data?.errors) {
        const serverErrors = error.response.data.errors;
        const formattedErrors = {};
        Object.keys(serverErrors).forEach(key => {
          formattedErrors[key] = Array.isArray(serverErrors[key])
            ? serverErrors[key][0]
            : serverErrors[key];
        });
        setErrors(formattedErrors);
        toast.error('يرجى تصحيح الأخطاء في النموذج');
      } else {
        const errorMsg = error.response?.data?.message || (isEdit ? 'فشل تحديث القسم' : 'فشل إضافة القسم');
        toast.error(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('هل أنت متأكد من الإلغاء؟ سيتم فقدان التغييرات غير المحفوظة.')) {
      navigate('/surplus/categories');
    }
  };

  // ✅ إزالة علامة التحميل - عرض المحتوى مباشرة

  return (
    <div className="min-h-screen bg-gray-50" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */ }
        <div className="mb-6">
          <Link
            to="/surplus/categories"
            className="inline-flex items-center text-sky-600 hover:text-sky-700 mb-4"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة لقائمة الأقسام
          </Link>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-green-600" />
            { isEdit ? 'تعديل قسم الفائض' : 'إضافة قسم فائض جديد' }
          </h1>
        </div>

        {/* Form */ }
        <form onSubmit={ handleSubmit } className="bg-white rounded-2xl p-8 shadow-lg">
          {/* اسم القسم */ }
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              اسم القسم <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={ formData.name }
              onChange={ handleChange }
              placeholder="مثال: التكية الخيرية"
              maxLength={ 255 }
              className={ `w-full px-4 py-3 border ${errors.name ? 'border-red-500' : 'border-gray-300'
                } rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500` }
            />
            { errors.name && (
              <p className="text-red-500 text-sm mt-1">{ errors.name }</p>
            ) }
            <p className="text-gray-500 text-xs mt-1">
              { formData.name.length }/255 حرف
            </p>
          </div>

          {/* الوصف */ }
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <FileText className="w-4 h-4 text-sky-600" />
              الوصف (اختياري)
            </label>
            <textarea
              name="description"
              value={ formData.description }
              onChange={ handleChange }
              rows={ 4 }
              placeholder="وصف اختياري للقسم..."
              className={ `w-full px-4 py-3 border ${errors.description ? 'border-red-500' : 'border-gray-300'
                } rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none` }
            />
            { errors.description && (
              <p className="text-red-500 text-sm mt-1">{ errors.description }</p>
            ) }
          </div>

          {/* تفعيل القسم */ }
          <div className="mb-8">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                name="is_active"
                checked={ formData.is_active }
                onChange={ handleChange }
                className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500 cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  تفعيل القسم
                </span>
              </div>
            </label>
            <p className="text-gray-500 text-xs mt-1 mr-8">
              القسم المفعّل سيظهر في قائمة الأقسام عند تأكيد التوريد
            </p>
          </div>

          {/* Info Box */ }
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2">
              <FileText className="w-5 h-5 text-sky-600 mt-0.5" />
              <div className="text-sm text-sky-700">
                <p className="font-semibold mb-1">معلومة:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>اسم القسم يجب أن يكون فريداً</li>
                  <li>يمكن تصنيف المشاريع في هذا القسم عند التوريد</li>
                  <li>سيتم حساب رصيد تراكمي لكل قسم تلقائياً</li>
                  <li>لا يمكن حذف قسم يحتوي على مشاريع مرتبطة</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */ }
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={ submitting }
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              { submitting ? 'جاري الحفظ...' : (isEdit ? 'تحديث القسم' : 'إضافة القسم') }
            </button>
            <button
              type="button"
              onClick={ handleCancel }
              disabled={ submitting }
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SurplusCategoryForm;

