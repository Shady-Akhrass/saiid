import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { Video, Clock, CheckCircle2, AlertCircle, Eye, Filter, Search, X, Settings, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getProjectCode } from '../../utils/helpers';
import UpdateStatusModal from './components/UpdateStatusModal';

const MyMontageProjects = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    perPage: 20,
    total: 0,
  });
  const [filter, setFilter] = useState('all'); // all, current, completed, delayed, redone
  const [searchQuery, setSearchQuery] = useState('');
  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
  const [selectedProjectForUpdate, setSelectedProjectForUpdate] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, [filter, pagination.currentPage, searchQuery]);

  // ✅ تحديث عنوان الصفحة (Tab Title) ديناميكياً
  useEffect(() => {
    document.title = 'مشاريعي - قسم الإعلام';
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = {
        perPage: pagination.perPage,
        page: pagination.currentPage,
      };

      if (filter === 'current') {
        params.current_only = true;
      } else if (filter === 'completed') {
        params.completed_only = true;
      } else if (filter === 'delayed') {
        params.delayed_only = true;
      } else if (filter === 'redone') {
        params.redone_only = true;
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await apiClient.get('/my-montage-projects', { params });

      if (response.data.success) {
        let projectsData = response.data.projects || [];

        // ✅ ترتيب المشاريع: المشاريع التي تحتاج إعادة مونتاج أولاً
        projectsData = projectsData.sort((a, b) => {
          if (a.status === 'يجب إعادة مونتاجه' && b.status !== 'يجب إعادة مونتاجه') {
            return -1; // a يأتي أولاً
          }
          if (a.status !== 'يجب إعادة مونتاجه' && b.status === 'يجب إعادة مونتاجه') {
            return 1; // b يأتي أولاً
          }
          return 0; // نفس الترتيب
        });

        setProjects(projectsData);
        setPagination({
          currentPage: response.data.currentPage || 1,
          totalPages: response.data.totalPages || 1,
          perPage: response.data.perPage || 20,
          total: response.data.total || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error(error.response?.data?.message || 'فشل تحميل المشاريع');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMontage = async (projectId, notes = '') => {
    if (!confirm('هل أنت متأكد من إكمال المونتاج؟')) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post(`/my-montage-projects/${projectId}/complete-montage`, {
        notes: notes || 'تم إكمال المونتاج',
      });

      if (response.data.success) {
        toast.success(response.data.message || 'تم إكمال المونتاج بنجاح');
        fetchProjects();
      }
    } catch (error) {
      console.error('Error completing montage:', error);
      toast.error(error.response?.data?.message || 'فشل إكمال المونتاج');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'غير محدد';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      'في المونتاج': 'bg-purple-100 text-purple-800',
      'تم المونتاج': 'bg-green-100 text-green-800',
      'يجب إعادة مونتاجه': 'bg-gradient-to-r from-red-500 to-red-600 text-white border-2 border-red-700 font-bold shadow-lg', // ✅ لون أحمر مميز لإعادة المونتاج
      'وصل للمتبرع': 'bg-blue-100 text-blue-800',
    };

    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-7xl mx-auto">
        {/* Header */ }
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">مشاريعي</h1>
          <p className="text-gray-600 mt-1">مشاريع المونتاج المسندة إليك</p>
        </div>

        {/* Filters */ }
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="بحث في المشاريع..."
                value={ searchQuery }
                onChange={ (e) => {
                  setSearchQuery(e.target.value);
                  setPagination({ ...pagination, currentPage: 1 });
                } }
                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={ () => setFilter('all') }
                className={ `px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'all'
                  ? 'bg-sky-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }` }
              >
                الكل
              </button>
              <button
                onClick={ () => setFilter('current') }
                className={ `px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${filter === 'current'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }` }
              >
                <Clock className="w-4 h-4" />
                الحالية
              </button>
              <button
                onClick={ () => setFilter('completed') }
                className={ `px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${filter === 'completed'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }` }
              >
                <CheckCircle2 className="w-4 h-4" />
                المنجزة
              </button>
              <button
                onClick={ () => setFilter('delayed') }
                className={ `px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${filter === 'delayed'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }` }
              >
                <AlertCircle className="w-4 h-4" />
                المتأخرة
              </button>
              <button
                onClick={ () => setFilter('redone') }
                className={ `px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${filter === 'redone'
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }` }
              >
                <Video className="w-4 h-4" />
                المعاد منتاجها
              </button>
            </div>
          </div>
        </div>

        {/* Projects List */ }
        { loading && projects.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">لا توجد مشاريع</p>
          </div>
        ) : (
          <div className="space-y-4">
            { projects.map((project) => {
              // ✅ التحقق من جميع الصيغ المحتملة للحالة
              const status = project.status || '';
              const isRemontage =

                status.includes('يجب') && (status.includes('إعادة') || status.includes('اعادة'));

              return (
                <div
                  key={ project.id }
                  className={ `bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow ${isRemontage
                    ? 'border-2 border-red-400 bg-gradient-to-br from-red-50 to-white'
                    : ''
                    }` }
                >
                  {/* ✅ تنبيه بسيط للمشاريع التي تحتاج إعادة مونتاج */ }
                  { isRemontage && (
                    <div className="mb-4 space-y-3">
                      <div className="p-3 bg-red-100 border-r-4 border-red-600 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          <p className="text-sm font-semibold text-red-800">
                            ⚠️ هذا المشروع يحتاج إعادة مونتاج
                          </p>
                        </div>
                      </div>

                      {/* ✅ عرض سبب الرفض */ }
                      { (project.rejection_reason || project.media_rejection_reason || project.admin_rejection_reason) && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            سبب الرفض / إعادة المونتاج:
                          </p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            { project.rejection_reason || project.media_rejection_reason || project.admin_rejection_reason }
                          </p>
                        </div>
                      ) }
                    </div>
                  ) }

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-xl font-bold text-gray-800">{ project.project_name }</h3>
                        <span className={ `inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${isRemontage ? 'bg-gradient-to-r from-red-500 to-red-600 text-white border-2 border-red-700 font-bold shadow-lg' : getStatusBadge(project.status)}` }>
                          { isRemontage && (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) }
                          { isRemontage ? 'يجب إعادة مونتاجه' : project.status }
                        </span>
                        { project.days_delayed > 0 && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <AlertCircle className="w-4 h-4 ml-1" />
                            متأخر { project.days_delayed } يوم
                          </span>
                        ) }
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium text-gray-700">كود المشروع:</span>
                          <p className="text-gray-900">{ getProjectCode(project, project.serial_number || '-') }</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">العدد:</span>
                          <p className="text-gray-900">
                            { (() => {
                              // ✅ محاولة جلب العدد من جميع المصادر المحتملة
                              const quantity =
                                project.quantity ??
                                project.total_quantity ??
                                project.supply_quantity ??
                                project.supply_data?.quantity ??
                                project.warehouse_quantity ??
                                project.warehouse_data?.quantity ??
                                null;

                              // ✅ إذا كانت القيمة 0، نعرضها كـ 0 وليس '-'
                              if (quantity !== null && quantity !== undefined && quantity !== '') {
                                const numValue = Number(quantity);
                                return Number.isFinite(numValue) ? numValue : '-';
                              } else if (quantity === 0) {
                                return 0;
                              }
                              return '-';
                            })() }
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">تاريخ الإسناد:</span>
                          <p className="text-gray-900">
                            { formatDate(project.montage_producer_assigned_at) }
                          </p>
                        </div>
                      </div>
                      { project.project_description && (
                        <p className="text-gray-600 mt-3 text-sm">{ project.project_description }</p>
                      ) }
                      { project.notes && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                          <p className="text-sm font-medium text-amber-800 mb-1">ملاحظات:</p>
                          <p className="text-sm text-amber-700 whitespace-pre-wrap break-words">{ project.notes }</p>
                        </div>
                      ) }
                      { project.notes_image_url && (
                        <div className="mt-3">
                          <div className="flex items-start gap-3">
                            <img
                              src={ project.notes_image_url }
                              alt="ملاحظات المشروع"
                              className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                              onClick={ async () => {
                                try {
                                  let blob;
                                  
                                  // ✅ إذا كان URL كامل (http/https)، استخدمه مباشرة مع fetch
                                  if (project.notes_image_url.startsWith('http://') || project.notes_image_url.startsWith('https://')) {
                                    const response = await fetch(project.notes_image_url, {
                                      method: 'GET',
                                      credentials: 'include',
                                      mode: 'cors',
                                    });
                                    if (!response.ok) throw new Error('Failed to fetch image');
                                    blob = await response.blob();
                                  } else {
                                    // ✅ استخدام apiClient للصور من API endpoint
                                    // ✅ استخراج endpoint من imageUrl
                                    let apiEndpoint = project.notes_image_url;
                                    if (apiEndpoint.includes('/api/')) {
                                      apiEndpoint = apiEndpoint.split('/api/')[1];
                                    } else if (apiEndpoint.startsWith('/')) {
                                      apiEndpoint = apiEndpoint.substring(1);
                                    }
                                    
                                    const response = await apiClient.get(apiEndpoint, {
                                      responseType: 'blob',
                                      skipDeduplication: true,
                                    });
                                    blob = response.data;
                                  }

                                  if (!blob || !blob.type || !blob.type.startsWith('image/')) {
                                    throw new Error('Invalid image type');
                                  }

                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `صورة_${project.project_name || 'مشروع'}_${Date.now()}.${blob.type.split('/')[1]}`;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);
                                  toast.success('تم تنزيل الصورة بنجاح');
                                } catch (error) {
                                  console.error('Error downloading image:', error);
                                  toast.error('فشل تنزيل الصورة');
                                }
                              } }
                              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              تحميل الصورة
                            </button>
                          </div>
                        </div>
                      ) }
                    </div>
                    <div className="flex flex-col gap-2">
                      <Link
                        to={ `/media-management/my-projects/${project.id}` }
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        عرض التفاصيل
                      </Link>
                      { isRemontage && (
                        <button
                          onClick={ () => {
                            setSelectedProjectForUpdate(project);
                            setUpdateStatusModalOpen(true);
                          } }
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          الإجراء
                        </button>
                      ) }
                      { project.status === 'في المونتاج' && (
                        <button
                          onClick={ () => handleCompleteMontage(project.id) }
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          إكمال المونتاج
                        </button>
                      ) }
                    </div>
                  </div>
                </div>
              );
            }) }
          </div>
        ) }

        {/* Pagination */ }
        { pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 bg-white rounded-2xl shadow-lg px-6 py-4">
            <div className="text-sm text-gray-700">
              عرض { ((pagination.currentPage - 1) * pagination.perPage) + 1 } إلى { Math.min(pagination.currentPage * pagination.perPage, pagination.total) } من { pagination.total }
            </div>
            <div className="flex gap-2">
              <button
                onClick={ () => setPagination({ ...pagination, currentPage: pagination.currentPage - 1 }) }
                disabled={ pagination.currentPage === 1 }
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                السابق
              </button>
              <span className="px-4 py-2 text-gray-700">
                صفحة { pagination.currentPage } من { pagination.totalPages }
              </span>
              <button
                onClick={ () => setPagination({ ...pagination, currentPage: pagination.currentPage + 1 }) }
                disabled={ pagination.currentPage === pagination.totalPages }
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                التالي
              </button>
            </div>
          </div>
        ) }
      </div>

      {/* Update Status Modal */ }
      { updateStatusModalOpen && selectedProjectForUpdate && (
        <UpdateStatusModal
          project={ selectedProjectForUpdate }
          onClose={ () => {
            setUpdateStatusModalOpen(false);
            setSelectedProjectForUpdate(null);
          } }
          onSuccess={ () => {
            setUpdateStatusModalOpen(false);
            setSelectedProjectForUpdate(null);
            fetchProjects();
          } }
        />
      ) }
    </div>
  );
};

export default MyMontageProjects;
