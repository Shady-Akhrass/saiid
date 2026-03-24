import React from 'react';
import { X, CheckCircle, MessageSquare } from 'lucide-react';

const MediaAcceptReplyModals = ({
  acceptModalOpen,
  notificationToAccept,
  handleCloseAcceptModal,
  accepting,
  handleAccept,
  handleOpenReplyModal,
  replyModalOpen,
  selectedNotification,
  handleCloseReplyModal,
  handleReplySubmit,
  replying,
  replyForm,
  setReplyForm,
  getProjectCode
}) => {
  return (
    <>
      {/* ✅ Accept Modal (نفس وظيفة الإشعارات) */}
      {acceptModalOpen && notificationToAccept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>قبول المونتاج</h2>
                    <p className="text-sm text-gray-500 mt-1">تأكيد قبول المونتاج</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseAcceptModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={accepting}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="mb-6">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 mb-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">⚠️ ملاحظة مهمة:</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    عند قبول المونتاج، سيتم نقل المشروع إلى حالة <span className="font-bold text-green-700">"منتهي"</span> تلقائياً.
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed mt-2">
                    عند رفض المونتاج، سيتم إرجاع المشروع إلى الإعلام بحالة <span className="font-bold text-red-700">"يجب إعادة المونتاج"</span>.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-2">المشروع:</p>
                  <p className="font-semibold text-gray-800">
                    {notificationToAccept.metadata?.project_name || notificationToAccept.metadata?.projectName || 'مشروع بدون اسم'}
                  </p>
                  {getProjectCode(notificationToAccept.metadata, null) && (
                    <p className="text-sm text-gray-500 mt-1">
                      كود المشروع: {getProjectCode(notificationToAccept.metadata)}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseAcceptModal}
                  className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                  disabled={accepting}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNotification(notificationToAccept);
                    handleCloseAcceptModal();
                    handleOpenReplyModal(notificationToAccept);
                  }}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                  disabled={accepting}
                >
                  <MessageSquare className="w-4 h-4" />
                  رفض المونتاج
                </button>
                <button
                  onClick={handleAccept}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={accepting}
                >
                  {accepting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>جاري القبول...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>قبول المونتاج</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Reply Modal (نفس وظيفة الإشعارات) */}
      {replyModalOpen && selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>رد على إشعار المونتاج</h2>
                <button
                  onClick={handleCloseReplyModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">الإشعار:</p>
                <p className="font-semibold text-gray-800">{selectedNotification.title}</p>
                <p className="text-sm text-gray-600 mt-2">{selectedNotification.message}</p>
              </div>

              <form onSubmit={handleReplySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الرسالة <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={replyForm.message}
                    onChange={(e) => setReplyForm({ ...replyForm, message: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="أدخل الرسالة التي تريد إرسالها لقسم الإعلام..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    سبب الرفض <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={replyForm.rejection_reason}
                    onChange={(e) => setReplyForm({ ...replyForm, rejection_reason: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="أدخل سبب رفض المونتاج..."
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseReplyModal}
                    className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    disabled={replying}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={replying}
                  >
                    {replying ? 'جاري الإرسال...' : 'إرسال الرد'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MediaAcceptReplyModals;
