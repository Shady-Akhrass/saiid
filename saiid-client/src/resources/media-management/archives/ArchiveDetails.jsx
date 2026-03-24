import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getArchive, deleteArchive } from '../../../services/mediaArchiveService';
import { ArrowRight, Edit, Trash2, Archive, Calendar, Folder, User, FileText } from 'lucide-react';
import { toast } from 'react-toastify';

const ArchiveDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [archive, setArchive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchArchive(Number(id));
    }
  }, [id]);

  const fetchArchive = async (archiveId) => {
    try {
      setLoading(true);
      const data = await getArchive(archiveId);
      setArchive(data);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'فشل جلب الأرشيف';
      toast.error(errorMessage);
      navigate('/media-management/archives');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الأرشيف؟')) {
      return;
    }

    try {
      await deleteArchive(archive.id);
      toast.success('تم حذف الأرشيف بنجاح');
      navigate('/media-management/archives');
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'فشل حذف الأرشيف';
      toast.error(errorMessage);
    }
  };

  const getArchiveTypeLabel = (type) => {
    return type === 'before_montage' ? 'قبل المونتاج' : 'بعد المونتاج';
  };

  const getArchiveTypeBadgeClass = (type) => {
    return type === 'before_montage'
      ? 'bg-blue-500 text-white'
      : 'bg-green-500 text-white';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!archive) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">الأرشيف غير موجود</p>
          <Link
            to="/media-management/archives"
            className="mt-4 inline-block text-blue-600 hover:text-blue-700"
          >
            العودة إلى قائمة الأرشيف
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/media-management/archives')}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
          <Archive className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">تفاصيل الأرشيف</h1>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/media-management/archives/${archive.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Edit className="w-5 h-5" />
            <span>تعديل</span>
          </Link>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            <span>حذف</span>
          </button>
        </div>
      </div>

      {/* Archive Info Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`px-4 py-2 rounded-lg ${getArchiveTypeBadgeClass(archive.archive_type)}`}>
            <span className="font-semibold">{getArchiveTypeLabel(archive.archive_type)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-5 h-5" />
            <span className="text-sm">
              {new Date(archive.archived_at).toLocaleDateString('ar-SA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Project Information */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">معلومات المشروع</h2>
            
            <div>
              <p className="text-sm text-gray-500 mb-1">الكود التسلسلي</p>
              <p className="font-semibold text-gray-900">{archive.serial_number}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">اسم المشروع</p>
              <p className="font-semibold text-gray-900">{archive.project_name}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">المتبرع</p>
              <p className="font-semibold text-gray-900">{archive.donor_name}</p>
            </div>

            {archive.donor_code && (
              <div>
                <p className="text-sm text-gray-500 mb-1">كود المتبرع</p>
                <p className="font-semibold text-gray-900">{archive.donor_code}</p>
              </div>
            )}

            {archive.internal_code && (
              <div>
                <p className="text-sm text-gray-500 mb-1">الكود الداخلي</p>
                <p className="font-semibold text-gray-900">{archive.internal_code}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-500 mb-1">نوع المشروع</p>
              <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium">
                {archive.project_type}
              </span>
            </div>

            {archive.execution_date && (
              <div>
                <p className="text-sm text-gray-500 mb-1">تاريخ التنفيذ</p>
                <p className="font-semibold text-gray-900">
                  {new Date(archive.execution_date).toLocaleDateString('ar-SA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Archive Information */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">معلومات الأرشيف</h2>
            
            <div>
              <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
                <Folder className="w-4 h-4" />
                مسار الملفات
              </p>
              <p className="font-mono text-sm break-all bg-gray-50 p-3 rounded-lg border border-gray-200">
                {archive.local_path}
              </p>
            </div>

            {archive.notes && (
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  ملاحظات
                </p>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap">
                  {archive.notes}
                </p>
              </div>
            )}

            {archive.archived_by_user && (
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  أرشف بواسطة
                </p>
                <p className="font-semibold text-gray-900">{archive.archived_by_user.name}</p>
                {archive.archived_by_user.email && (
                  <p className="text-sm text-gray-600">{archive.archived_by_user.email}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Team Information (if available) */}
        {(archive.team_name || archive.photographer_name || archive.producer_name) && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">معلومات الفريق</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {archive.team_name && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">الفريق</p>
                  <p className="font-semibold text-gray-900">{archive.team_name}</p>
                </div>
              )}
              {archive.photographer_name && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">المصور</p>
                  <p className="font-semibold text-gray-900">{archive.photographer_name}</p>
                </div>
              )}
              {archive.producer_name && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">ممنتج</p>
                  <p className="font-semibold text-gray-900">{archive.producer_name}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default ArchiveDetails;

