import React from 'react';
import { X, Pause } from 'lucide-react';

const PostponeModal = ({
  showPostponeModal,
  setShowPostponeModal,
  postponementReason,
  setPostponementReason,
  isPostponing,
  handlePostponeProject
}) => {
  if (!showPostponeModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Pause className="w-5 h-5 ml-2 text-amber-500" />
            تأجيل المشروع
          </h2>
          <button
            onClick={() => {
              setShowPostponeModal(false);
              setPostponementReason('');
              setPostponingProjectId(null);
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
              setShowPostponeModal(false);
              setPostponementReason('');
              setPostponingProjectId(null);
            }}
            disabled={isPostponing}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handlePostponeProject}
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
    </div>
  );
};

export default PostponeModal;
