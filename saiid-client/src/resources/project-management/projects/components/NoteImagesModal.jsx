import React from 'react';
import { X, ImageIcon } from 'lucide-react';

const NoteImagesModal = ({
  noteImagesModalOpen,
  setNoteImagesModalOpen,
  noteImagesModalProject,
  setNoteImagesModalProject,
  noteImagesModalImages,
  setNoteImagesModalImages,
  noteImagesModalLoading,
  getImageBaseUrl
}) => {
  if (!noteImagesModalOpen || !noteImagesModalProject) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3 px-4 pt-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-600" />
            صور الملاحظات - كود المتبرع (اختياري)
          </h2>
          <button
            onClick={() => {
              setNoteImagesModalOpen(false);
              setNoteImagesModalProject(null);
              setNoteImagesModalImages([]);
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pb-4">
          {noteImagesModalLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
          ) : noteImagesModalImages.length === 0 ? (
            <p className="text-center text-gray-500 py-8">لا توجد صور ملاحظات لهذا المشروع.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {noteImagesModalImages.map((img, index) => {
                const path = img.image_url || img.image_path;
                if (!path) return null;

                let finalUrl = path;
                const baseURL = getImageBaseUrl();
                const API_BASE = baseURL.replace(/\/api\/?$/, '');

                if (!path.startsWith('http://') && !path.startsWith('https://')) {
                  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
                  if (normalizedPath.includes('/project_notes_images')) {
                    finalUrl = `${baseURL.replace(/\/$/, '')}${normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath}`;
                  } else {
                    finalUrl = `${API_BASE}${normalizedPath}`;
                  }
                }

                return (
                  <div
                    key={img.id || `${noteImagesModalProject.id}-${index}`}
                    className="relative rounded-2xl border border-gray-200 overflow-hidden bg-gray-50"
                  >
                    <img
                      src={finalUrl}
                      alt={`صورة ملاحظة #${index + 1}`}
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2 py-1 bg-black/40 text-white text-xs">
                      <span className="px-2 py-0.5 bg-black/40 rounded-full">
                        صورة ملاحظة #{index + 1}
                      </span>
                      <a
                        href={finalUrl}
                        download
                        className="px-2 py-0.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium"
                        title="تنزيل الصورة"
                      >
                        تنزيل
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteImagesModal;
