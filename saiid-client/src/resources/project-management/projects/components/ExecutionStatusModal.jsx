import React from 'react';
import { X, CheckCircle, Pause } from 'lucide-react';

const ExecutionStatusModal = ({
  showExecutionStatusModal,
  setShowExecutionStatusModal,
  selectedProjectForStatusUpdate,
  setSelectedProjectForStatusUpdate,
  executionStatusAction,
  setExecutionStatusAction,
  postponementReason,
  setPostponementReason,
  updatingStatus,
  isPostponing,
  handleCompleteExecution,
  handlePostponeFromStatusModal
}) => {
  if (!showExecutionStatusModal || !selectedProjectForStatusUpdate) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <CheckCircle className="w-5 h-5 ml-2 text-purple-500" />
            تحديث حالة المشروع
          </h2>
          <button
            onClick={() => {
              setShowExecutionStatusModal(false);
              setSelectedProjectForStatusUpdate(null);
              setExecutionStatusAction(null);
              setPostponementReason('');
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            المشروع: <span className="font-semibold text-gray-800">{selectedProjectForStatusUpdate.project_name || selectedProjectForStatusUpdate.donor_name || 'غير محدد'}</span>
          </p>
          <p className="text-sm text-gray-600">
            الحالة الحالية: <span className="font-semibold text-purple-600">{selectedProjectForStatusUpdate.status}</span>
          </p>
        </div>

        {!executionStatusAction ? (
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">اختر الإجراء المطلوب:</p>
            <button
              onClick={() => setExecutionStatusAction('completed')}
              className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <CheckCircle className="w-5 h-5" />
              تم التنفيذ
            </button>
            <button
              onClick={() => setExecutionStatusAction('postpone')}
              className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Pause className="w-5 h-5" />
              تأجيل المشروع
            </button>
          </div>
        ) : executionStatusAction === 'completed' ? (
          <div className="mb-6">
            <p className="text-sm text-gray-700 mb-4">
              هل أنت متأكد من تحديث حالة المشروع إلى <span className="font-semibold text-green-600">"تم التنفيذ"</span>؟
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExecutionStatusAction(null)}
                disabled={updatingStatus}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                رجوع
              </button>
              <button
                onClick={handleCompleteExecution}
                disabled={updatingStatus}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingStatus ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                    جاري التحديث...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 ml-2" />
                    تأكيد
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سبب التأجيل <span className="text-red-500">*</span>
              </label>
              <textarea
                value={postponementReason}
                onChange={(e) => setPostponementReason(e.target.value)}
                placeholder="أدخل سبب تأجيل المشروع..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                يرجى إدخال سبب واضح لتأجيل المشروع
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setExecutionStatusAction(null);
                  setPostponementReason('');
                }}
                disabled={isPostponing}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                رجوع
              </button>
              <button
                onClick={handlePostponeFromStatusModal}
                disabled={isPostponing || !postponementReason.trim()}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPostponing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                    جاري التأجيل...
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 ml-2" />
                    تأجيل المشروع
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutionStatusModal;
