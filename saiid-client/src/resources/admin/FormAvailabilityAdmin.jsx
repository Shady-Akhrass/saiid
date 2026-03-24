import React, { useState, useEffect } from "react";
import { useToast } from "../../hooks/useToast";
import apiClient from "../../utils/axiosConfig";
import {
  Settings,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  FileText,
  Plus,
  Shield,
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  Heart,
  Users,
  Home,
  Briefcase,
  Package
} from "lucide-react";

const FormAvailabilityAdmin = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const { success, error: showError } = useToast();
  const [hoveredRow, setHoveredRow] = useState(null);

  // Form types that match the backend
  const formTypes = ['orphan', 'patient', 'shelter', 'aids', 'employment'];

  const fetchRecords = async (retryCount = 0) => {
    setLoading(true);
    try {
      // Use apiClient which automatically uses proxy in development
      const response = await apiClient.get('/form-availabilities');

      const data = response.data;
      console.log('Fetched data:', data); // Debug log
      setRecords(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      // Handle 429 (Too Many Requests) with retry
      if (err.response?.status === 429) {
        if (retryCount < 3) {
          const retryAfter = err.response.headers['retry-after'] || 2;
          const delay = parseInt(retryAfter) * 1000 * (retryCount + 1);
          console.log(`Rate limited. Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchRecords(retryCount + 1);
        } else {
          showError('تم تجاوز الحد الأقصى لعدد الطلبات. يرجى المحاولة لاحقاً');
          return;
        }
      }

      console.error("fetchRecords error", err);
      const errorMessage = err.userMessage || err.message || "فشل في جلب البيانات من الخادم";
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const toggleById = async (id, current) => {
    if (!id) {
      console.error('No ID provided for toggle');
      return;
    }

    setLoadingId(id);
    try {
      const newStatus = !current;

      console.log('Toggling:', { id, current, newStatus }); // Debug log

      // Use apiClient which automatically uses proxy in development
      const response = await apiClient.patch(`/form-availabilities/${id}`, {
        is_available: newStatus
      });

      const data = response.data;
      console.log('Updated data:', data); // Debug log

      // Update the local state with the returned data
      setRecords(prevRecords => {
        const newRecords = prevRecords.map(r =>
          r.id === id ? { ...r, ...data } : r
        );
        console.log('New records state:', newRecords); // Debug log
        return newRecords;
      });

      success(`تم ${newStatus ? 'تفعيل' : 'تعطيل'} نموذج ${getFormTypeLabel(data.type)}`);
    } catch (err) {
      // Handle 429 (Too Many Requests)
      if (err.response?.status === 429) {
        showError('تم تجاوز الحد الأقصى لعدد الطلبات. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى');
        return;
      }

      console.error('Toggle error:', err);
      const errorMessage = err.userMessage || err.message || "فشل في تحديث الحالة";
      showError(errorMessage);
      // Refresh data on error to ensure consistency
      fetchRecords();
    } finally {
      setLoadingId(null);
    }
  };

  const createFormAvailability = async (type) => {
    const existingRecord = records.find((r) => r.type === type);
    if (existingRecord) {
      showError(`النموذج ${getFormTypeLabel(type)} موجود بالفعل`);
      return;
    }

    setLoadingId(`type-${type}`);
    try {
      // Use apiClient which automatically uses proxy in development
      const response = await apiClient.post('/form-availabilities', {
          type,
          is_available: false,
          notes: `تم إنشاء نموذج ${getFormTypeLabel(type)} تلقائياً`
      });

      const data = response.data;
      console.log('Created data:', data); // Debug log

      setRecords(prev => [...prev, data]);
      success(`تم إنشاء نموذج ${getFormTypeLabel(type)} بنجاح`);
    } catch (err) {
      // Handle 429 (Too Many Requests)
      if (err.response?.status === 429) {
        showError('تم تجاوز الحد الأقصى لعدد الطلبات. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى');
        return;
      }

      console.error('Create error:', err);
      const errorMessage = err.userMessage || err.message || "فشل في إنشاء السجل";
      showError(errorMessage);
    } finally {
      setLoadingId(null);
    }
  };

  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="p-4">
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </td>
      <td className="p-4">
        <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full w-20 mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-4 bg-gray-200 rounded w-40"></div>
      </td>
      <td className="p-4">
        <div className="flex gap-2 justify-center">
          <div className="h-8 bg-gray-200 rounded-xl w-20"></div>
        </div>
      </td>
    </tr>
  );

  const getFormTypeLabel = (type) => {
    const labels = {
      'orphan': 'الأيتام',
      'patient': 'المرضى',
      'shelter': 'مراكز النزوح',
      'aids': 'المساعدات',
      'employment': 'التوظيف'
    };
    return labels[type] || type;
  };

  const getFormTypeIcon = (type) => {
    const icons = {
      'orphan': <Heart className="w-4 h-4" />,
      'patient': <Users className="w-4 h-4" />,
      'shelter': <Home className="w-4 h-4" />,
      'aids': <Package className="w-4 h-4" />,
      'employment': <Briefcase className="w-4 h-4" />
    };
    return icons[type] || <FileText className="w-4 h-4" />;
  };

  const getFormTypeColor = (type) => {
    const colors = {
      'orphan': 'from-purple-100 to-purple-200',
      'patient': 'from-red-100 to-red-200',
      'shelter': 'from-blue-100 to-blue-200',
      'aids': 'from-green-100 to-green-200',
      'employment': 'from-amber-100 to-amber-200'
    };
    return colors[type] || 'from-gray-100 to-gray-200';
  };

  // Get missing form types (not in records)
  const missingFormTypes = formTypes.filter(type => !records.find(r => r.type === type));

  // Debug logging
  useEffect(() => {
    console.log('Current records:', records);
  }, [records]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      {/* Animated Background Elements */ }
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 right-40 w-80 h-80 bg-sky-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */ }
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-sky-400 to-sky-500 rounded-2xl shadow-lg shadow-sky-200">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
                  لوحة التحكم - توفر النماذج
                </h1>
                <p className="text-gray-600 mt-1">إدارة حالة النماذج والخدمات</p>
              </div>
            </div>

            <button
              onClick={ fetchRecords }
              disabled={ loading }
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-2xl hover:from-sky-500 hover:to-sky-600 transform hover:scale-105 transition-all duration-300 shadow-lg shadow-sky-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              { loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              ) }
              <span>تحديث البيانات</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */ }
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">إجمالي النماذج</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{ records.length }</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-sky-100 to-sky-200 rounded-xl">
                <Database className="w-6 h-6 text-sky-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">النماذج المفعلة</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  { records.filter(r => r.is_available).length }
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">النماذج المعطلة</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  { records.filter(r => !r.is_available).length }
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl">
                <XCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - Add Missing Forms */ }
        { missingFormTypes.length > 0 && (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">إضافة نماذج جديدة</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              { missingFormTypes.map(type => (
                <button
                  key={ `add-${type}` }
                  onClick={ () => createFormAvailability(type) }
                  disabled={ loadingId === `type-${type}` }
                  className={ `flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 bg-gradient-to-r ${getFormTypeColor(type)} hover:shadow-lg disabled:opacity-50 disabled:transform-none` }
                >
                  { loadingId === `type-${type}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      { getFormTypeIcon(type) }
                      <span>{ getFormTypeLabel(type) }</span>
                    </>
                  ) }
                </button>
              )) }
            </div>
          </div>
        ) }

        {/* Table */ }
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-sky-50 to-orange-50 border-b border-sky-100">
                  <th className="p-4 text-right font-semibold text-gray-700">ID</th>
                  <th className="p-4 text-center font-semibold text-gray-700">نوع النموذج</th>
                  <th className="p-4 text-center font-semibold text-gray-700">الحالة</th>
                  <th className="p-4 text-right font-semibold text-gray-700">ملاحظات</th>
                  <th className="p-4 text-center font-semibold text-gray-700">الإجراءات</th>
                </tr>
              </thead>

              <tbody>
                { loading ? (
                  Array(5).fill().map((_, idx) => <SkeletonRow key={ `skeleton-${idx}` } />)
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center p-12">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full">
                          <Database className="w-12 h-12 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-lg">لا توجد بيانات متاحة</p>
                        <div className="flex gap-2">
                          { formTypes.slice(0, 3).map(type => (
                            <button
                              key={ `empty-add-${type}` }
                              onClick={ () => createFormAvailability(type) }
                              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-xl hover:from-sky-500 hover:to-sky-600 transform hover:scale-105 transition-all duration-300"
                            >
                              <Plus className="w-4 h-4" />
                              <span>إضافة { getFormTypeLabel(type) }</span>
                            </button>
                          )) }
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((rec, index) => (
                    <tr
                      key={ `record-${rec.id || index}` }
                      className={ `border-b border-gray-100 transition-all duration-300 hover:bg-gradient-to-r hover:from-sky-50/50 hover:to-orange-50/50 ${hoveredRow === index ? "scale-[1.01] shadow-lg" : ""
                        }` }
                      onMouseEnter={ () => setHoveredRow(index) }
                      onMouseLeave={ () => setHoveredRow(null) }
                    >
                      <td className="p-4">
                        <span className="text-sm text-gray-600 font-mono" title={ rec.id }>
                          #{ rec.id ? rec.id.slice(0, 8) : index }...
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center">
                          <div className="flex items-center gap-2 min-w-[160px]">
                            <div className={ `p-2 bg-gradient-to-br ${getFormTypeColor(rec.type)} rounded-lg flex-shrink-0` }>
                              { getFormTypeIcon(rec.type) }
                            </div>
                            <span className="font-medium text-gray-800">
                              { getFormTypeLabel(rec.type) }
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        { rec.is_available ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-green-100 to-green-200 text-green-700">
                            <CheckCircle className="w-4 h-4" />
                            مفعل
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700">
                            <XCircle className="w-4 h-4" />
                            معطل
                          </span>
                        ) }
                      </td>

                      <td className="p-4">
                        <span className="text-sm text-gray-600">
                          { rec.notes || "—" }
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={ () => toggleById(rec.id, rec.is_available) }
                            disabled={ loadingId === rec.id || !rec.id }
                            className={ `flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-md ${rec.is_available
                              ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white hover:from-orange-500 hover:to-orange-600 shadow-orange-200'
                              : 'bg-gradient-to-r from-green-400 to-green-500 text-white hover:from-green-500 hover:to-green-600 shadow-green-200'
                              } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none` }
                          >
                            { loadingId === rec.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : rec.is_available ? (
                              <ToggleRight className="w-4 h-4" />
                            ) : (
                              <ToggleLeft className="w-4 h-4" />
                            ) }
                            <span>{ rec.is_available ? 'تعطيل' : 'تفعيل' }</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) }
              </tbody>
            </table>
          </div>
        </div>
      </div>


      <style>{ `
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default FormAvailabilityAdmin;