import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';

const BatchStatusUpdateForm = ({ onSubmit, onCancel, loading, hasInExecutionProjects = false }) => {
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // ✅ قائمة الحالات الأساسية
  const MONTAGE_STATUSES = [
    { value: 'في المونتاج', label: 'في المونتاج' },
    { value: 'تم المونتاج', label: 'تم المونتاج' },
    { value: 'معاد مونتاجه', label: 'معاد مونتاجه' },
    { value: 'وصل للمتبرع', label: 'وصل للمتبرع' },
  ];

  // ✅ إضافة "تم التنفيذ" إذا كان هناك مشاريع بحالة "قيد التنفيذ"
  const AVAILABLE_STATUSES = hasInExecutionProjects 
    ? [
        { value: 'تم التنفيذ', label: 'تم التنفيذ' },
        ...MONTAGE_STATUSES
      ]
    : MONTAGE_STATUSES;

  // ✅ التحقق من صحة البيانات (يجب تعريفه قبل استخدامه)
  const isValid = useMemo(() => {
    return status && (status !== 'معاد مونتاجه' || rejectionReason.trim());
  }, [status, rejectionReason]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!status) {
      return;
    }

    // ✅ التحقق من إدخال سبب الرفض عند اختيار حالة "معاد مونتاجه"
    if (status === 'معاد مونتاجه' && !rejectionReason.trim()) {
      return;
    }

    onSubmit(status, notes.trim() || null, rejectionReason.trim() || null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Status Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          الحالة الجديدة <span className="text-red-500">*</span>
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          required
          disabled={loading}
        >
          <option value="">اختر الحالة</option>
          {AVAILABLE_STATUSES.map((statusOption) => (
            <option key={statusOption.value} value={statusOption.value}>
              {statusOption.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          ملاحظة: سيتم تعيين تاريخ البدء/الانتهاء تلقائياً حسب الحالة المختارة
        </p>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات (اختياري)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          placeholder="أضف أي ملاحظات حول حالة المونتاج..."
          disabled={loading}
        />
      </div>

      {/* ✅ حقل سبب الرفض - يظهر فقط عند اختيار حالة "معاد مونتاجه" */}
      {status === 'معاد مونتاجه' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            سبب الرفض <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-red-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50"
            placeholder="أدخل سبب رفض المونتاج أو إعادته..."
            required
            disabled={loading}
          />
          <p className="text-xs text-red-600 mt-1">
            هذا الحقل إلزامي عند اختيار حالة "معاد مونتاجه"
          </p>
        </div>
      )}

      {/* Status Info */}
      {status && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">معلومات الحالة:</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            {status === 'في المونتاج' && (
              <li>• سيتم تعيين تاريخ بدء المونتاج تلقائياً</li>
            )}
            {status === 'تم المونتاج' && (
              <li>• سيتم تعيين تاريخ اكتمال المونتاج تلقائياً</li>
            )}
            {status === 'معاد مونتاجه' && (
              <li>• سيتم إعادة تعيين تواريخ المونتاج</li>
            )}
            {status === 'وصل للمتبرع' && (
              <li>• سيتم تعيين تاريخ الإرسال للمتبرع تلقائياً</li>
            )}
            {status === 'تم التنفيذ' && (
              <li>• سيتم نقل المشاريع من "قيد التنفيذ" إلى "تم التنفيذ"</li>
            )}
          </ul>
        </div>
      )}

      {/* ✅ تنبيه للمشاريع بحالة "قيد التنفيذ" */}
      {hasInExecutionProjects && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-800">
            <strong>ملاحظة:</strong> من ضمن المشاريع المحددة مشاريع بحالة "قيد التنفيذ". يمكنك نقلهم إلى "تم التنفيذ" من القائمة أعلاه.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          إلغاء
        </button>
        <button
          type="submit"
          className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || !isValid}
        >
          {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>
    </form>
  );
};

export default BatchStatusUpdateForm;
