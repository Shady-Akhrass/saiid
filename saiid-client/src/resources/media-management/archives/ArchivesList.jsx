import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { getArchives, deleteArchive } from '../../../services/mediaArchiveService';
import { Search, Filter, Eye, Edit, Trash2, Plus, X, Archive } from 'lucide-react';
import { toast } from 'react-toastify';

const ArchivesList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const abortControllerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [archives, setArchives] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });

  const [filters, setFilters] = useState({
    search: '',
    archive_type: '',
    project_type: '',
    date_from: '',
    date_to: '',
    page: 1,
    perPage: 15,
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchArchives();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filters]);

  const fetchArchives = async () => {
    try {
      setLoading(true);
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const params = {
        ...filters,
        archive_type: filters.archive_type || undefined,
        project_type: filters.project_type || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        search: filters.search || undefined,
      };

      // Remove undefined values
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === '') {
          delete params[key];
        }
      });

      const response = await getArchives(params);
      
      if (response.success) {
        setArchives(response.data || []);
        setPagination(response.pagination || {
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 0,
        });
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }
      
      const errorMessage = error.response?.data?.message || error.message || 'فشل جلب الأرشيف';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الأرشيف؟')) {
      return;
    }

    try {
      await deleteArchive(id);
      toast.success('تم حذف الأرشيف بنجاح');
      fetchArchives();
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'فشل حذف الأرشيف';
      toast.error(errorMessage);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filter changes
    }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      archive_type: '',
      project_type: '',
      date_from: '',
      date_to: '',
      page: 1,
      perPage: 15,
    });
  };

  const getArchiveTypeLabel = (type) => {
    return type === 'before_montage' ? 'قبل المونتاج' : 'بعد المونتاج';
  };

  const getArchiveTypeBadgeClass = (type) => {
    return type === 'before_montage'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-green-100 text-green-800 border-green-200';
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Archive className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">أرشيف المواد</h1>
        </div>
        <Link
          to="/media-management/archives/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة أرشيف جديد</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Filter className="w-5 h-5" />
            <span>فلترة</span>
          </button>
          {(filters.search || filters.archive_type || filters.project_type || filters.date_from || filters.date_to) && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <X className="w-5 h-5" />
              <span>إعادة تعيين</span>
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="بحث في (اسم المشروع، الكود، المتبرع، كود المتبرع، الكود الداخلي، الفريق، المصور، الممنتج)..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Archive Type */}
            <select
              value={filters.archive_type}
              onChange={(e) => handleFilterChange('archive_type', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">جميع أنواع الأرشيف</option>
              <option value="before_montage">قبل المونتاج</option>
              <option value="after_montage">بعد المونتاج</option>
            </select>

            {/* Project Type */}
            <select
              value={filters.project_type}
              onChange={(e) => handleFilterChange('project_type', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">جميع أنواع المشاريع</option>
              <option value="إغاثي">إغاثي</option>
              <option value="تنموي">تنموي</option>
              <option value="طبي">طبي</option>
              <option value="تعليمي">تعليمي</option>
            </select>

            {/* Date From */}
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              placeholder="تاريخ من"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Date To */}
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              placeholder="تاريخ إلى"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Archives Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الكود
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم المشروع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  نوع الأرشيف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المتبرع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  كود المتبرع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الكود الداخلي
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الممنتج
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  مسار الملفات
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  تاريخ الأرشفة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : archives.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                    لا توجد نتائج
                  </td>
                </tr>
              ) : (
                archives.map((archive) => (
                  <tr key={archive.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {archive.serial_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {archive.project_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getArchiveTypeBadgeClass(
                          archive.archive_type
                        )}`}
                      >
                        {getArchiveTypeLabel(archive.archive_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {archive.donor_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {archive.donor_code || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {archive.internal_code || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {archive.producer_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={archive.local_path}>
                      {archive.local_path}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(archive.archived_at).toLocaleDateString('ar-SA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/media-management/archives/${archive.id}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                        <Link
                          to={`/media-management/archives/${archive.id}/edit`}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Edit className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(archive.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={() => handleFilterChange('page', pagination.current_page - 1)}
            disabled={pagination.current_page === 1}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            السابق
          </button>
          <span className="text-sm text-gray-700">
            صفحة {pagination.current_page} من {pagination.last_page} ({pagination.total} نتيجة)
          </span>
          <button
            onClick={() => handleFilterChange('page', pagination.current_page + 1)}
            disabled={pagination.current_page === pagination.last_page}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            التالي
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default ArchivesList;

