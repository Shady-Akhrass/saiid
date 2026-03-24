import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';

const UpdateStatusModal = ({ project, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState(project.status || '');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState(''); // ✅ حقل سبب الرفض
  const [loading, setLoading] = useState(false);
  const [projectQuantity, setProjectQuantity] = useState(project.quantity || null);

  const MONTAGE_STATUSES = [
    { value: 'في المونتاج', label: 'في المونتاج' },
    { value: 'تم المونتاج', label: 'تم المونتاج' },
    { value: 'معاد مونتاجه', label: 'معاد مونتاجه' },
    { value: 'وصل للمتبرع', label: 'وصل للمتبرع' },
  ];

  // جلب العدد من API إذا لم يكن موجوداً في المشروع
  useEffect(() => {
    const fetchQuantity = async () => {
      // إذا كان quantity موجوداً في المشروع، لا نحتاج لجلب البيانات
      if (project.quantity && project.quantity > 0) {
        setProjectQuantity(project.quantity);
        return;
      }

      // محاولة جلب quantity من API
      try {
        const response = await apiClient.get(`/projects/${project.id}/warehouse`);
        if (response.data.success) {
          const data = response.data.data || response.data;
          const quantity = data.project?.quantity || data.quantity || null;
          if (quantity && quantity > 0) {
            setProjectQuantity(quantity);
          }
        }
      } catch (error) {
        // إذا لم تكن بيانات التوريد متوفرة، نستخدم quantity من المشروع أو null
        setProjectQuantity(project.quantity || null);
      }
    };

    if (project.id) {
      fetchQuantity();
    }
  }, [project.id, project.quantity]);

  // تحديد نوع الوحدة حسب نوع المشروع
  const getQuantityUnit = () => {
    const projectType = project.project_type;
    if (projectType === 'إغاثي') return 'طرد';
    if (projectType === 'طبي') return 'منتج';
    if (projectType === 'تنموي') return 'قدر';
    return 'قطعة';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!status) {
      toast.error('الرجاء اختيار الحالة');
      return;
    }

    // ✅ التحقق من إدخال سبب الرفض عند اختيار حالة "معاد مونتاجه"
    if (status === 'معاد مونتاجه' && !rejectionReason.trim()) {
      toast.error('الرجاء إدخال سبب الرفض');
      return;
    }

    try {
      setLoading(true);

      // ✅ تحديد الـ endpoint حسب الدور
      const normalizedRole = user?.role || user?.role_name || user?.user_role || '';
      const roleLower = String(normalizedRole).toLowerCase();

      // التحقق إذا كان المستخدم منتج مونتاج
      const isMontageProducer =
        roleLower === 'montage_producer' ||
        roleLower === 'montageproducer' ||
        roleLower === 'ممنتج' ||
        roleLower.includes('montage_producer') ||
        roleLower.includes('montageproducer') ||
        roleLower.includes('ممنتج');

      let response;

      // ✅ إعداد البيانات للطلب
      const requestData = {
        status,
        notes: notes.trim() || null,
      };

      // ✅ إضافة سبب الرفض إذا كانت الحالة "معاد مونتاجه"
      if (status === 'معاد مونتاجه' && rejectionReason.trim()) {
        requestData.rejection_reason = rejectionReason.trim();
      }

      if (isMontageProducer) {
        // ✅ محاولة استخدام endpoint خاص بالمنتج أولاً
        try {
          response = await apiClient.post(`/my-montage-projects/${project.id}/update-status`, requestData);
        } catch (producerError) {
          // ✅ إذا فشل endpoint المنتج، جرب endpoint مدير الإعلام كـ fallback
          console.warn('Producer endpoint failed, trying media manager endpoint:', producerError);
          response = await apiClient.post(`/project-proposals/${project.id}/update-media-status`, requestData);
        }
      } else {
        // ✅ استخدام endpoint لمدير الإعلام
        response = await apiClient.post(`/project-proposals/${project.id}/update-media-status`, requestData);
      }

      if (response.data.success) {
        toast.success('تم تحديث حالة المشروع بنجاح');
        // ✅ تمرير بيانات المشروع المحدثة إلى onSuccess
        onSuccess(response.data.project || project);
      } else {
        toast.error(response.data.message || 'فشل تحديث الحالة');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      const errorMessage = error.response?.data?.message || error.userMessage || 'حدث خطأ أثناء تحديث الحالة';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={ { fontFamily: 'Cairo, sans-serif' } }>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">تحديث حالة المشروع #{ project.serial_number }</h2>
          <button
            onClick={ onClose }
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={ handleSubmit } className="p-6 space-y-6">
          {/* Project Info */ }
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">اسم المشروع:</span>
              <span className="text-sm font-medium text-gray-800">{ project.project_name || project.project_description }</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">المتبرع:</span>
              <span className="text-sm font-medium text-gray-800">{ project.donor_name || '---' }</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">الحالة الحالية:</span>
              <span className="text-sm font-medium text-gray-800">{ project.status }</span>
            </div>
            { projectQuantity && projectQuantity > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">العدد:</span>
                <span className="text-sm font-bold text-sky-700">
                  { projectQuantity } { getQuantityUnit() }
                </span>
              </div>
            ) }
          </div>

          {/* Status Selection */ }
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الحالة الجديدة <span className="text-red-500">*</span>
            </label>
            <select
              value={ status }
              onChange={ (e) => setStatus(e.target.value) }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              <option value="">اختر الحالة</option>
              { MONTAGE_STATUSES.map((statusOption) => (
                <option key={ statusOption.value } value={ statusOption.value }>
                  { statusOption.label }
                </option>
              )) }
            </select>
            <p className="text-xs text-gray-500 mt-1">
              ملاحظة: سيتم تعيين تاريخ البدء/الانتهاء تلقائياً حسب الحالة المختارة
            </p>
          </div>

          {/* Notes */ }
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات (اختياري)</label>
            <textarea
              value={ notes }
              onChange={ (e) => setNotes(e.target.value) }
              rows={ 4 }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="أضف أي ملاحظات حول حالة المونتاج..."
            />
          </div>

          {/* ✅ حقل سبب الرفض - يظهر فقط عند اختيار حالة "معاد مونتاجه" */ }
          { status === 'معاد مونتاجه' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سبب الرفض <span className="text-red-500">*</span>
              </label>
              <textarea
                value={ rejectionReason }
                onChange={ (e) => setRejectionReason(e.target.value) }
                rows={ 4 }
                className="w-full px-4 py-3 border border-red-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50"
                placeholder="أدخل سبب رفض المونتاج أو إعادته..."
                required
              />
              <p className="text-xs text-red-600 mt-1">
                هذا الحقل إلزامي عند اختيار حالة "معاد مونتاجه"
              </p>
            </div>
          ) }

          {/* Status Info */ }
          { status && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">معلومات الحالة:</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                { status === 'في المونتاج' && (
                  <li>• سيتم تعيين تاريخ بدء المونتاج تلقائياً</li>
                ) }
                { status === 'تم المونتاج' && (
                  <li>• سيتم تعيين تاريخ اكتمال المونتاج تلقائياً</li>
                ) }
                { status === 'معاد مونتاجه' && (
                  <li>• سيتم إعادة تعيين تواريخ المونتاج</li>
                ) }
                { status === 'وصل للمتبرع' && (
                  <li>• سيتم تعيين تاريخ الإرسال للمتبرع تلقائياً</li>
                ) }
              </ul>
            </div>
          ) }

          {/* Actions */ }
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={ onClose }
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              disabled={ loading }
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={ loading || !status }
            >
              { loading ? 'جاري الحفظ...' : 'حفظ التغييرات' }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateStatusModal;

