import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { ArrowRight, Save, X, Package, RefreshCw } from 'lucide-react';

const WarehouseForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    item_name: '',
    description: '',
    quantity_available: 0,
    unit_price: 0,
    is_active: true,
  });

  useEffect(() => {
    if (isEdit) {
      fetchItem();
    }
  }, [id]);

  const fetchItem = async (showError = true) => {
    try {
      // setLoading(true);
      const response = await apiClient.get(`/warehouse/${id}`);
      if (response.data.success) {
        const item = response.data.data || response.data.item || response.data;
        setFormData({
          item_name: item.item_name || '',
          description: item.description || '',
          quantity_available: item.quantity_available || 0,
          unit_price: item.unit_price || 0,
          is_active: item.is_active !== false,
        });
        return true; // إرجاع true عند النجاح
      }
      return false;
    } catch (error) {
      console.error('Error fetching item:', error);
      if (showError) {
        toast.error('فشل تحميل بيانات الصنف');
        navigate('/warehouse/dashboard');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.item_name.trim()) {
      toast.error('اسم الصنف مطلوب');
      return;
    }

    if (formData.quantity_available < 0) {
      toast.error('الكمية المتوفرة يجب أن تكون أكبر من أو تساوي صفر');
      return;
    }

    if (formData.unit_price < 0) {
      toast.error('السعر يجب أن يكون أكبر من أو يساوي صفر');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        item_name: formData.item_name.trim(),
        description: formData.description?.trim() || '',
        quantity_available: parseFloat(formData.quantity_available) || 0,
        unit_price: parseFloat(formData.unit_price) || 0,
        is_active: formData.is_active,
      };

      let response;
      if (isEdit) {
        response = await apiClient.patch(`/warehouse/${id}`, payload);
      } else {
        response = await apiClient.post('/warehouse', payload);
      }

      if (response.data.success) {
        toast.success(isEdit ? 'تم تحديث الصنف بنجاح' : 'تم إضافة الصنف بنجاح');

        if (isEdit) {
          // عند التعديل: إعادة جلب البيانات ثم الانتقال لصفحة الأصناف
          // سيتم إعادة جلب البيانات تلقائياً في Warehouse.jsx عند العودة
          navigate('/warehouse/list');
        } else {
          // عند الإضافة: الانتقال للداش بورد
          navigate('/warehouse/dashboard');
        }
      }
    } catch (error) {
      if (error.response?.status === 422) {
        const errors = error.response.data.errors || {};
        const firstError = Object.values(errors)[0]?.[0] || error.response.data.message || 'خطأ في البيانات';
        toast.error(firstError);
      } else {
        toast.error(isEdit ? 'فشل تحديث الصنف' : 'فشل إضافة الصنف');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // if (loading) {
  //   return (
  //     <div className="flex justify-center items-center min-h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-gray-50" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */ }
        <div className="mb-6">
          <Link
            to="/warehouse/dashboard"
            className="inline-flex items-center text-sky-600 hover:text-sky-700 mb-4"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة لوحة تحكم المخزن
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-8 h-8 text-sky-600" />
              { isEdit ? 'تعديل صنف' : 'إضافة صنف جديد' }
            </h1>
            { isEdit && (
              <button
                type="button"
                onClick={ async () => {
                  try {
                    const success = await fetchItem(false);
                    if (success) {
                      toast.success('تم تحديث البيانات');
                      // الانتقال لصفحة الأصناف بعد التحديث
                      setTimeout(() => {
                        navigate('/warehouse/list');
                      }, 300); // تأخير بسيط لضمان عرض الرسالة
                    }
                  } catch (error) {
                    console.error('Error refreshing data:', error);
                    toast.error('فشل تحديث البيانات');
                  }
                } }
                className="inline-flex items-center gap-2 px-4 py-2 text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-colors"
                title="تحديث البيانات والانتقال لصفحة الأصناف"
              >
                <RefreshCw className="w-5 h-5" />
                <span className="text-sm font-medium">تحديث</span>
              </button>
            ) }
          </div>
        </div>

        {/* Form */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <form onSubmit={ handleSubmit } className="space-y-6">
            {/* Item Name */ }
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                اسم الصنف <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={ formData.item_name }
                onChange={ (e) => setFormData({ ...formData, item_name: e.target.value }) }
                required
                maxLength={ 255 }
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="أدخل اسم الصنف"
              />
            </div>

            {/* Description */ }
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
              <textarea
                value={ formData.description }
                onChange={ (e) => setFormData({ ...formData, description: e.target.value }) }
                rows={ 4 }
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="وصف اختياري للصنف"
              />
            </div>

            {/* Quantity Available */ }
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الكمية المتوفرة <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={ formData.quantity_available }
                onChange={ (e) => setFormData({ ...formData, quantity_available: parseFloat(e.target.value) || 0 }) }
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="0"
              />
            </div>

            {/* Unit Price */ }
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سعر الوحدة الواحدة (شيكل) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={ formData.unit_price }
                onChange={ (e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 }) }
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="0.00"
              />
              <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs font-semibold text-emerald-800 mb-1">
                  💱 ملاحظة مهمة: جميع الأسعار في المخزن بالشيكل الإسرائيلي (ILS)
                </p>
                <p className="text-xs text-emerald-700">
                  السعر للوحدة الواحدة من هذا الصنف بالشيكل (مثال: إذا كان الصنف "كيلو أرز" والسعر 18، فالسعر هو 18 شيكل للكيلو الواحد)
                </p>
              </div>
            </div>

            {/* Is Active */ }
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={ formData.is_active }
                onChange={ (e) => setFormData({ ...formData, is_active: e.target.checked }) }
                className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                نشط
              </label>
            </div>

            {/* Actions */ }
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
              <Link
                to="/warehouse/dashboard"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
              >
                إلغاء
              </Link>
              <button
                type="submit"
                disabled={ submitting }
                className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                { submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    { isEdit ? 'تحديث' : 'إضافة' }
                  </>
                ) }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WarehouseForm;

