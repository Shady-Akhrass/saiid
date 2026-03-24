import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getArchive, updateArchive } from '../../../services/mediaArchiveService';
import { ArrowRight, X, Archive, Save } from 'lucide-react';
import { toast } from 'react-toastify';

const EditArchive = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archive, setArchive] = useState(null);
  const [formData, setFormData] = useState({
    local_path: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});

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
      setFormData({
        local_path: data.local_path || '',
        notes: data.notes || '',
      });
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'فشل جلب الأرشيف';
      toast.error(errorMessage);
      navigate('/media-management/archives');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.local_path || formData.local_path.trim() === '') {
      newErrors.local_path = 'يرجى إدخال مسار الملفات';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setSaving(true);
      const data = {
        local_path: formData.local_path.trim(),
        notes: formData.notes.trim() || undefined,
      };

      await updateArchive(archive.id, data);
      toast.success('تم تحديث الأرشيف بنجاح');
      navigate(`/media-management/archives/${archive.id}`);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'فشل تحديث الأرشيف';
      toast.error(errorMessage);
      
      // Handle validation errors
      if (error.response?.status === 422 && error.response?.data?.errors) {
        const validationErrors = {};
        Object.keys(error.response.data.errors).forEach(key => {
          validationErrors[key] = error.response.data.errors[key][0];
        });
        setErrors(validationErrors);
      }
    } finally {
      setSaving(false);
    }
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
          <button
            onClick={() => navigate('/media-management/archives')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            العودة إلى قائمة الأرشيف
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Archive className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">تعديل الأرشيف</h1>
        </div>
        <button
          onClick={() => navigate(`/media-management/archives/${archive.id}`)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Archive Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm text-gray-600">المشروع</p>
            <p className="font-semibold text-gray-900">
              {archive.serial_number} - {archive.project_name}
            </p>
          </div>
          <div className="border-r border-blue-300 h-12"></div>
          <div>
            <p className="text-sm text-gray-600">نوع الأرشيف</p>
            <p className="font-semibold text-gray-900">
              {archive.archive_type === 'before_montage' ? 'قبل المونتاج' : 'بعد المونتاج'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Local Path */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              مسار الملفات على الهارد المحلي <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="local_path"
              value={formData.local_path}
              onChange={handleChange}
              placeholder="مثال: D:\Projects\Project_1001\Raw_Materials\"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                errors.local_path ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.local_path && (
              <p className="mt-1 text-sm text-red-600">{errors.local_path}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              أدخل المسار الكامل للملفات على الهارد المحلي
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ملاحظات (اختياري)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="أضف أي ملاحظات إضافية..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>حفظ التغييرات</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/media-management/archives/${archive.id}`)}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};

export default EditArchive;

