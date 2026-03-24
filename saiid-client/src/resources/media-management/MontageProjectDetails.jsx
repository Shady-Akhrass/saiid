import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { ArrowRight, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getProjectCode } from '../../utils/helpers';

const MontageProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [adminRejectionReason, setAdminRejectionReason] = useState(null); // ✅ سبب الرفض من الإدارة

  useEffect(() => {
    if (id) {
      fetchProjectDetails();
    } else {
      setError('معرف المشروع غير موجود');
      setLoading(false);
      toast.error('معرف المشروع غير موجود');
    }
  }, [id]);

  // ✅ تحديث عنوان الصفحة (Tab Title) ديناميكياً بناءً على اسم المشروع
  useEffect(() => {
    if (project) {
      document.title = `${project.project_name || 'تفاصيل المشروع'} - قسم الإعلام`;
    } else {
      document.title = 'تفاصيل المشروع - قسم الإعلام';
    }
  }, [project]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ Debug: في وضع التطوير، عرض معلومات الطلب
      if (import.meta.env.DEV) {
        console.log('🔍 Fetching project details:', {
          id: id,
          endpoint: `/my-montage-projects/${id}`,
          user: user?.id,
          userRole: user?.role
        });
      }

      const response = await apiClient.get(`/my-montage-projects/${id}`);

      // ✅ معالجة أشكال الاستجابة المختلفة
      let projectData = null;

      if (response.data) {
        // إذا كانت الاستجابة تحتوي على success
        if (response.data.success !== undefined) {
          if (response.data.success) {
            projectData = response.data.project || response.data.data || response.data;
          } else {
            const errorMessage = response.data.message || response.data.error || 'فشل جلب تفاصيل المشروع';
            setError(errorMessage);
            toast.error(errorMessage);
            if (import.meta.env.DEV) {
              console.error('❌ API returned success: false:', response.data);
            }
            return;
          }
        } else {
          // إذا لم تكن هناك success field، نأخذ البيانات مباشرة
          projectData = response.data.project || response.data.data || response.data;
        }
      }

      if (!projectData) {
        const errorMessage = 'المشروع غير موجود أو لا يمكن الوصول إليه';
        setError(errorMessage);
        toast.error(errorMessage);
        if (import.meta.env.DEV) {
          console.error('❌ No project data found in response:', response.data);
        }
        return;
      }

      // ✅ Debug: عرض البيانات في Console (في وضع التطوير فقط)
      if (import.meta.env.DEV) {
        console.log('✅ Project Data loaded successfully:', {
          id: projectData.id,
          project_name: projectData.project_name,
          status: projectData.status,
          hasDonorName: !!projectData.donor_name,
          hasProjectDescription: !!projectData.project_description,
          hasParentProject: !!projectData.parent_project,
          allKeys: Object.keys(projectData)
        });
        console.log('📦 Full Project Data:', projectData);
      }

      setProject(projectData);

      // ✅ جلب سبب الرفض من الإدارة إذا كان موجوداً
      await fetchAdminRejectionReason(projectData.id, projectData);
    } catch (err) {
      console.error('❌ Error fetching project details:', err);

      // ✅ معالجة أفضل للأخطاء
      let errorMessage = 'فشل تحميل تفاصيل المشروع';

      if (err.response) {
        // خطأ من الـ server
        const status = err.response.status;
        const data = err.response.data;

        if (status === 404) {
          errorMessage = 'المشروع غير موجود';
        } else if (status === 403) {
          errorMessage = 'ليس لديك صلاحيات للوصول إلى هذا المشروع';
        } else if (status === 401) {
          errorMessage = 'يرجى تسجيل الدخول مرة أخرى';
        } else if (data?.message) {
          errorMessage = data.message;
        } else if (data?.error) {
          errorMessage = data.error;
        } else {
          errorMessage = `خطأ في الخادم (${status})`;
        }

        if (import.meta.env.DEV) {
          console.error('❌ API Error Response:', {
            status: status,
            data: data,
            headers: err.response.headers
          });
        }
      } else if (err.request) {
        // الطلب تم إرساله لكن لم تكن هناك استجابة
        errorMessage = 'لا يمكن الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت';
        if (import.meta.env.DEV) {
          console.error('❌ No response received:', err.request);
        }
      } else {
        // خطأ في إعداد الطلب
        errorMessage = `خطأ في الطلب: ${err.message}`;
        if (import.meta.env.DEV) {
          console.error('❌ Request setup error:', err.message);
        }
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ جلب سبب الرفض من الإدارة
  const fetchAdminRejectionReason = async (projectId, projectData = null) => {
    try {
      // ✅ استخدام projectData الممرر أو project من state
      const currentProject = projectData || project;

      // ✅ محاولة جلب سبب الرفض من بيانات المشروع مباشرة
      if (currentProject?.admin_rejection_reason || currentProject?.media_admin_rejection_reason) {
        setAdminRejectionReason(
          currentProject.admin_rejection_reason ||
          currentProject.media_admin_rejection_reason ||
          null
        );
        return;
      }

      // ✅ محاولة جلب سبب الرفض من الإشعارات
      try {
        const notificationsResponse = await apiClient.get('/notifications', {
          params: {
            project_id: projectId,
            type: 'media_rejected',
            limit: 10,
          },
        });

        if (notificationsResponse.data?.success && notificationsResponse.data?.notifications) {
          const notifications = Array.isArray(notificationsResponse.data.notifications)
            ? notificationsResponse.data.notifications
            : [];

          // ✅ البحث عن إشعار الرفض من الإدارة
          const rejectionNotification = notifications.find(
            (notif) =>
              (notif.notification_type === 'media_rejected' || notif.type === 'media_rejected') &&
              notif.metadata
          );

          if (rejectionNotification) {
            // ✅ محاولة استخراج سبب الرفض من metadata
            let metadata = {};
            try {
              metadata =
                typeof rejectionNotification.metadata === 'string'
                  ? JSON.parse(rejectionNotification.metadata)
                  : rejectionNotification.metadata || {};
            } catch (e) {
              // إذا فشل parsing، نستخدم metadata كما هو
              metadata = rejectionNotification.metadata || {};
            }

            const rejectionReason =
              metadata.rejection_reason ||
              metadata.rejection_message ||
              metadata.admin_rejection_reason ||
              null;

            if (rejectionReason) {
              setAdminRejectionReason(rejectionReason);
              return;
            }
          }
        }
      } catch (notifError) {
        // ✅ إذا فشل جلب الإشعارات، لا نعرض خطأ (هذا اختياري)
        if (import.meta.env.DEV) {
          console.warn('⚠️ Could not fetch rejection notifications:', notifError);
        }
      }

      // ✅ إذا لم نجد سبب رفض، نضبطه على null
      setAdminRejectionReason(null);
    } catch (error) {
      console.error('Error fetching admin rejection reason:', error);
      setAdminRejectionReason(null);
    }
  };

  const handleCompleteMontage = async () => {
    try {
      setLoading(true);
      const response = await apiClient.post(`/my-montage-projects/${id}/complete-montage`, {
        notes: notes || '',
      });

      if (response.data.success) {
        toast.success(response.data.message || 'تم إكمال المونتاج بنجاح');
        setShowCompleteModal(false);
        setNotes('');
        fetchProjectDetails(); // تحديث البيانات
      }
    } catch (err) {
      console.error('Error completing montage:', err);
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء إكمال المونتاج');
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{ error }</p>
          <button
            onClick={ () => navigate('/media-management/my-projects') }
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            العودة للخلف
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">المشروع غير موجود</p>
          <button
            onClick={ () => navigate('/media-management/my-projects') }
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            العودة للخلف
          </button>
        </div>
      </div>
    );
  }

  // ✅ تحديد القيم للعرض - البحث في جميع الأماكن المحتملة
  // معالجة null و undefined و empty string
  const getValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return value;
  };

  const donorName = getValue(project.donor_name) ||
    getValue(project.donorName) ||
    getValue(project.parent_project?.donor_name) ||
    getValue(project.parent_project?.donorName) ||
    getValue(project.parentProject?.donor_name) ||
    getValue(project.parentProject?.donorName) ||
    null;

  const projectDescription = getValue(project.project_description) ||
    getValue(project.description) ||
    null;

  // 🔍 Debug: عرض القيم النهائية (في وضع التطوير فقط)
  if (import.meta.env.DEV) {
    console.log('='.repeat(80));
    console.log('🔍 Final Values for Display:');
    console.log('  donorName:', donorName || 'null (غير متوفر)');
    console.log('  projectDescription:', projectDescription || 'null (غير متوفر)');
    console.log('='.repeat(80));
    console.log('⚠️ المشكلة: الـ Backend لا يرسل هذه الحقول في الاستجابة!');
    console.log('✅ الحل: يجب تطبيق BACKEND_COMPLETE_SHOW_FUNCTION.php في الـ Backend');
    console.log('='.repeat(80));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */ }
        <div className="mb-8">
          <button
            onClick={ () => navigate('/media-management/my-projects') }
            className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200 hover:gap-3"
          >
            <ArrowRight className="w-5 h-5" />
            <span>العودة للخلف</span>
          </button>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 border-blue-500">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{ project.project_name }</h1>
            <div className="flex items-center gap-3">
              <span className={ `inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold shadow-sm ${project.status === 'في المونتاج' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                project.status === 'تم المونتاج' ? 'bg-green-100 text-green-800 border border-green-300' :
                  project.status === 'وصل للمتبرع' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                    project.status === 'معاد مونتاجه' ? 'bg-red-100 text-red-800 border border-red-300' :
                      'bg-gray-100 text-gray-800 border border-gray-300'
                }` }>
                { project.status }
              </span>
              { project.days_delayed > 0 && (
                <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-700 border border-red-300">
                  ⚠️ تأخير { project.days_delayed } يوم
                </span>
              ) }
            </div>
          </div>
        </div>

        {/* Debug Info - تم إخفاؤه */ }

        {/* Main Content */ }
        <div className="space-y-6">

          {/* معلومات أساسية */ }
          <section className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b-2 border-blue-200 flex items-center gap-2">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              المعلومات الأساسية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  رقم المشروع
                </label>
                <p className="text-gray-900 text-base font-medium bg-gradient-to-r from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                  { project.serial_number }
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  كود المشروع
                </label>
                <p className="text-gray-900 text-base bg-gradient-to-r from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                  { getProjectCode(project, '-') }
                </p>
              </div>

              {/* ✅ الجهة المتبرعة */ }
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  الجهة المتبرعة
                </label>
                { donorName ? (
                  <p className="text-gray-900 text-base bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200 font-medium">
                    { donorName }
                  </p>
                ) : (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                    <p className="text-red-800 text-sm font-semibold">⚠️ البيانات غير متوفرة من الـ Backend</p>
                    <p className="text-red-600 text-xs mt-1">الـ API لا يرسل donor_name في الاستجابة</p>
                    { import.meta.env.DEV && (
                      <p className="text-red-500 text-xs mt-1 font-mono">يجب تطبيق BACKEND_COMPLETE_SHOW_FUNCTION.php</p>
                    ) }
                  </div>
                ) }
              </div>
            </div>
          </section>

          {/* وصف المشروع */ }
          <section className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b-2 border-green-200 flex items-center gap-2">
              <div className="w-1 h-6 bg-green-500 rounded-full"></div>
              وصف المشروع
            </h2>
            <div className="space-y-2">
              { projectDescription ? (
                <p className="text-gray-900 text-base leading-relaxed bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200 whitespace-pre-wrap">
                  { projectDescription }
                </p>
              ) : (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <p className="text-red-800 text-sm font-semibold">⚠️ البيانات غير متوفرة من الـ Backend</p>
                  <p className="text-red-600 text-xs mt-1">project_description = null في الاستجابة</p>
                  { import.meta.env.DEV && (
                    <p className="text-red-500 text-xs mt-1 font-mono">يجب تطبيق BACKEND_COMPLETE_SHOW_FUNCTION.php</p>
                  ) }
                </div>
              ) }
            </div>
          </section>

          {/* ملاحظات المشروع */ }
          <section className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b-2 border-amber-200 flex items-center gap-2">
              <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
              ملاحظات المشروع
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-900 text-base leading-relaxed bg-gradient-to-r from-amber-50 to-yellow-50 p-4 rounded-lg border border-amber-200 whitespace-pre-wrap min-h-[80px]">
                  { project.notes || 'لا توجد ملاحظات' }
                </p>
              </div>

              {/* صورة الملاحظات */ }
              { project.notes_image_url && (
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    صورة الملاحظات
                  </label>
                  <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-md bg-gray-50">
                    <img
                      src={ project.notes_image_url }
                      alt="صورة الملاحظات"
                      className="w-full h-auto max-h-96 object-contain"
                      onError={ (e) => {
                        e.target.src = '/placeholder-image.png';
                        e.target.alt = 'الصورة غير متوفرة';
                      } }
                    />
                  </div>
                </div>
              ) }
            </div>
          </section>

          {/* معلومات المونتاج */ }
          <section className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b-2 border-indigo-200 flex items-center gap-2">
              <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
              معلومات المونتاج
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  تاريخ الإسناد
                </label>
                <p className="text-gray-900 text-base bg-gradient-to-r from-indigo-50 to-blue-50 p-3 rounded-lg border border-indigo-200 font-medium">
                  { formatDate(project.montage_producer_assigned_at) }
                </p>
              </div>

              { project.montage_completed_at && (
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    تاريخ الإكمال
                  </label>
                  <p className="text-gray-900 text-base bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg border border-green-200 font-medium">
                    { formatDate(project.montage_completed_at) }
                  </p>
                </div>
              ) }
            </div>
          </section>

          {/* ✅ سبب الرفض من الممنتج - يظهر فقط إذا كانت الحالة "معاد مونتاجه" وكان هناك سبب رفض */ }
          { (project.status === 'معاد مونتاجه' || project.media_status === 'معاد مونتاجه') &&
            (project.rejection_reason || project.media_rejection_reason) && (
              <section className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200">
                <h2 className="text-xl font-bold text-red-800 mb-6 pb-3 border-b-2 border-red-300 flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  سبب الرفض / إعادة المونتاج (من الممنتج)
                </h2>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap">
                    { project.rejection_reason || project.media_rejection_reason || 'لا يوجد سبب محدد' }
                  </p>
                </div>
              </section>
            ) }

          {/* ✅ سبب الرفض من الإدارة - يظهر إذا كان هناك سبب رفض من الإدارة */ }
          { adminRejectionReason && (
            <section className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-300">
              <h2 className="text-xl font-bold text-orange-800 mb-6 pb-3 border-b-2 border-orange-400 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-orange-600" />
                سبب الرفض من الإدارة
              </h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap">
                  { adminRejectionReason }
                </p>
              </div>
            </section>
          ) }

          {/* معلومات المشروع الأصلي (إذا كان مشروع يومي) */ }
          { project.parent_project && (
            <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 border-2 border-blue-200">
              <h2 className="text-xl font-bold text-blue-900 mb-6 pb-3 border-b-2 border-blue-300 flex items-center gap-2">
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                معلومات المشروع الأصلي
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-blue-700 mb-2">
                    اسم المشروع الأصلي
                  </label>
                  <p className="text-blue-900 text-base font-medium bg-white/70 p-3 rounded-lg border border-blue-200">
                    { project.parent_project.project_name }
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-blue-700 mb-2">
                    الجهة المتبرعة (من المشروع الأصلي)
                  </label>
                  <p className="text-blue-900 text-base bg-white/70 p-3 rounded-lg border border-blue-200">
                    { project.parent_project.donor_name || '-' }
                  </p>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-sm font-semibold text-blue-700 mb-2">
                    وصف المشروع الأصلي
                  </label>
                  <p className="text-blue-900 text-base leading-relaxed bg-white/70 p-4 rounded-lg border border-blue-200 whitespace-pre-wrap">
                    { project.parent_project.project_description || '-' }
                  </p>
                </div>
              </div>
            </section>
          ) }

          {/* زر إكمال المونتاج */ }
          { project.status === 'في المونتاج' && (
            <section className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <button
                onClick={ () => setShowCompleteModal(true) }
                className="w-full px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>إكمال المونتاج</span>
              </button>
            </section>
          ) }
        </div>
      </div>

      {/* Complete Montage Modal */ }
      { showCompleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-slideUp border border-gray-200">
            <div className="flex items-center justify-between p-6 border-b-2 border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                إكمال المونتاج
              </h2>
              <button
                onClick={ () => {
                  setShowCompleteModal(false);
                  setNotes('');
                } }
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  value={ notes }
                  onChange={ (e) => setNotes(e.target.value) }
                  rows={ 4 }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all resize-none"
                  placeholder="أضف ملاحظات حول إكمال المونتاج..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={ handleCompleteMontage }
                  disabled={ loading }
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  { loading ? 'جاري الإكمال...' : 'تأكيد الإكمال' }
                </button>
                <button
                  onClick={ () => {
                    setShowCompleteModal(false);
                    setNotes('');
                  } }
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      ) }
    </div>
  );
};

export default MontageProjectDetails;
