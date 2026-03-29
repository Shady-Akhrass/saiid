import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import apiClient from '../../../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { getProjectCode } from '../../../../../utils/helpers';

export const BeneficiariesModal = ({
  isOpen,
  onClose,
  project,
  onSuccess,
}) => {
  const [beneficiariesCount, setBeneficiariesCount] = useState(
    project?.beneficiaries_count?.toString() || 
    project?.calculated_beneficiaries?.toString() || 
    ''
  );
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    if (!beneficiariesCount || parseInt(beneficiariesCount) < 0) {
      toast.error('يرجى إدخال عدد صحيح للمستفيدين');
      return;
    }

    setUpdating(true);
    try {
      const response = await apiClient.patch(`/project-proposals/${project.id}`, {
        beneficiaries_count: parseInt(beneficiariesCount),
      });

      if (response.data.success) {
        toast.success('تم تحديث عدد المستفيدين بنجاح');
        onSuccess?.();
        onClose();
      } else {
        toast.error(response.data.message || 'فشل تحديث عدد المستفيدين');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء التحديث');
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" 
      style={{ fontFamily: 'Cairo, sans-serif' }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-green-600" />
            إضافة/تحديث عدد المستفيدين
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600 mb-1">اسم المشروع</p>
            <p className="text-lg font-semibold text-gray-800">
              {project?.project_name || project?.project_description || project?.donor_name || '---'}
            </p>
            {getProjectCode(project, null) && (
              <p className="text-xs text-gray-500 mt-1">
                الكود: {getProjectCode(project)}
              </p>
            )}
          </div>

          {(project?.beneficiaries_count || project?.calculated_beneficiaries) && (
            <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
              <p className="text-sm text-blue-600 mb-1">العدد الحالي للمستفيدين</p>
              <p className="text-2xl font-bold text-blue-700">
                {(project.beneficiaries_count || project.calculated_beneficiaries || 0).toLocaleString('en-US')}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              عدد المستفيدين <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={beneficiariesCount}
              onChange={(e) => setBeneficiariesCount(e.target.value)}
              placeholder="أدخل عدد المستفيدين"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
            />
            <p className="text-xs text-gray-500 mt-2">
              أدخل العدد الإجمالي للمستفيدين من هذا المشروع
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
            >
              إلغاء
            </button>
            <button
              onClick={handleUpdate}
              disabled={updating || !beneficiariesCount || parseInt(beneficiariesCount) < 0}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {updating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  حفظ
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
