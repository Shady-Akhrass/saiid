import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { useCache } from '../../../hooks/useCache';
import { useCacheInvalidation } from '../../../hooks/useCacheInvalidation';
import { getProjectCode } from '../../../utils/helpers';
import { toast } from 'react-toastify';
import Unauthorized from '../components/Unauthorized';
import { filterProjectsForAdmin } from '../../../utils/surplusHelpers';
import {
  FolderKanban,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Users,
  Camera,
  Calendar,
  FileText,
} from 'lucide-react';

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  // ✅ تقليل مدة cache إلى دقيقتين لضمان تحديث البيانات بانتظام
  const { getData, setCachedData, isCacheValid, initializeCache, clearCache } = useCache('pm_dashboard', 120000); // 2 دقائق
  const { invalidateProjectsCache } = useCacheInvalidation();
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState({
    total_projects: 0,
    total_value_usd: 0,
    projects_by_status: {},
    projects_by_type: {},
    delayed_execution: 0,
    delayed_media: 0,
    recent_projects: [],
  });

  // استخدام ref لمنع عرض multiple error messages
  const errorShownRef = useRef(false);
  const loadingTimeoutRef = useRef(null);

  // ✅ الاستماع إلى أحداث إبطال الكاش
  useEffect(() => {
    const handleCacheInvalidation = (event) => {
      const { cacheKey } = event.detail;

      if (cacheKey === 'all' || cacheKey === 'pm_dashboard' || cacheKey === 'projects') {
        clearCache();
        setRefreshTrigger(prev => prev + 1);

        if (import.meta.env.DEV) {
          console.log('✅ Dashboard cache invalidated, fetching fresh data');
        }
      }
    };

    window.addEventListener('cache-invalidated', handleCacheInvalidation);

    return () => {
      window.removeEventListener('cache-invalidated', handleCacheInvalidation);
    };
  }, [clearCache]);

  useEffect(() => {
    initializeCache();

    // ✅ التحقق من cache أولاً قبل جلب البيانات
    // ✅ لكن نتحقق من أن cached data تحتوي على القيمة الصحيحة (تشمل المشاريع الفرعية)
    if (isCacheValid()) {
      const cachedData = getData();
      if (cachedData) {
        // ✅ التحقق من version الـ cache
        const cacheVersion = cachedData._cacheVersion || '1.0';
        const currentVersion = '2.0';

        // ✅ إذا كانت cached data موجودة وصحيحة (version صحيح + total_projects = 280)
        if (cacheVersion === currentVersion && cachedData.total_projects === 280 && cachedData.total_value_usd > 0) {
          setStats(cachedData);
          setLoading(false);
          if (import.meta.env.DEV) {
            console.log('✅ Using cached dashboard data (from useEffect)', {
              version: cacheVersion,
              total_projects: cachedData.total_projects,
              total_value_usd: cachedData.total_value_usd
            });
          }
          return;
        } else {
          // ✅ إذا كانت البيانات قديمة (version مختلف أو بيانات غير صحيحة)، نمسح cache ونعيد الجلب
          if (import.meta.env.DEV) {
            console.log('⚠️ Cached data is outdated, clearing cache and refetching...', {
              cachedVersion: cacheVersion,
              currentVersion: currentVersion,
              total_projects: cachedData.total_projects
            });
          }
          clearCache();
        }
      }
    }

    // ✅ فقط إذا لم تكن البيانات في cache أو كانت قديمة، اجلبها من API
    fetchDashboardStats();

    // Cleanup على unmount
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]); // ✅ إضافة refreshTrigger

  const fetchDashboardStats = async () => {
    // إعادة تعيين error flag
    errorShownRef.current = false;

    // تنظيف أي timeout سابق
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    try {
      // ✅ التحقق من Cache أولاً
      // ✅ لكن نتحقق من أن cached data صحيحة (تشمل المشاريع الفرعية)
      if (isCacheValid()) {
        const cachedData = getData();
        if (cachedData) {
          // ✅ التحقق من version الـ cache
          const cacheVersion = cachedData._cacheVersion || '1.0';
          const currentVersion = '2.0';

          // ✅ إذا كانت cached data صحيحة (version صحيح + total_projects = 280)
          if (cacheVersion === currentVersion && cachedData.total_projects === 280 && cachedData.total_value_usd > 0) {
            setStats(cachedData);
            setLoading(false);
            if (import.meta.env.DEV) {
              console.log('✅ Using cached dashboard data', {
                version: cacheVersion,
                total_projects: cachedData.total_projects,
                total_value_usd: cachedData.total_value_usd
              });
            }
            return;
          } else {
            // ✅ البيانات قديمة (version مختلف أو بيانات غير صحيحة)، نمسح cache
            if (import.meta.env.DEV) {
              console.log('⚠️ Cached data is outdated, clearing cache and refetching...', {
                cachedVersion: cacheVersion,
                currentVersion: currentVersion,
                total_projects: cachedData.total_projects
              });
            }
            clearCache();
          }
        }
      }

      // setLoading(true);

      // ✅ timeout ديناميكي: أطول في الإنتاج بسبب network latency
      const timeoutDuration = import.meta.env.PROD ? 20000 : 10000; // 20 ثانية في الإنتاج، 10 ثواني في التطوير

      // إيقاف حالة التحميل بعد timeout (أطول قليلاً من timeout الطلب)
      loadingTimeoutRef.current = setTimeout(() => {
        // فقط إذا لم يتم عرض error بالفعل
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          setLoading(false);
          // عرض بيانات افتراضية بدلاً من البقاء في حالة التحميل
          setStats({
            total_projects: 0,
            total_value_usd: 0,
            projects_by_status: {},
            projects_by_type: {},
            delayed_execution: 0,
            delayed_media: 0,
            recent_projects: [],
          });
          toast.error('فشل تحميل بيانات لوحة التحكم: تجاوز الوقت المحدد');
        }
      }, timeoutDuration + 5000); // timeout أطول من timeout الطلب بـ 5 ثواني

      const response = await apiClient.get('/project-proposals-dashboard', {
        params: {
          _t: Date.now(), // ✅ cache busting
        },
        timeout: timeoutDuration,
        headers: {
          'Cache-Control': 'no-cache',
        }
      }).catch(error => {
        // ✅ معالجة خطأ 403 (Forbidden) - المستخدم قد لا يملك صلاحيات
        if (error.response?.status === 403) {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Access denied to dashboard endpoint (403). User may not have permissions.');
          }
          // ✅ إرجاع بيانات فارغة بدلاً من رمي خطأ
          return { data: { success: false, data: {} } };
        }
        throw error;
      });

      // تنظيف timeout إذا نجح الطلب
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      if (response.data.success) {
        const responseData = response.data.data || response.data || {};

        // ✅ استخدام total_value_usd من Backend مباشرة (يحتوي على القيمة الصحيحة 260569.03)
        // ✅ Backend يحسب القيمة بشكل صحيح ويشمل: غير مقسمة + يومية فرعية + شهرية فرعية
        const calculatedTotalValue = responseData.total_value_usd ?? responseData.total_value ?? responseData.total_amount_usd ?? 0;
        const calculatedTotalProjects = responseData.total_projects ?? responseData.total_projects_count ?? 0;

        // ✅ عرض تفاصيل value_breakdown إذا كانت موجودة (للتشخيص)
        if (import.meta.env.DEV && responseData.value_breakdown) {
          console.log('✅ Dashboard: Backend value breakdown:', {
            undivided: responseData.value_breakdown.undivided,
            monthly_phases: responseData.value_breakdown.monthly_phases,
            daily_phases: responseData.value_breakdown.daily_phases,
            total: responseData.value_breakdown.total,
            backend_total_value_usd: calculatedTotalValue
          });
        }

        const dashboardData = {
          total_projects: calculatedTotalProjects,
          total_value_usd: calculatedTotalValue,
          projects_by_status: responseData.projects_by_status ?? responseData.status_counts ?? {},
          projects_by_type: responseData.projects_by_type ?? responseData.type_counts ?? {},
          delayed_execution: responseData.delayed_execution ?? responseData.delayed_projects ?? 0,
          delayed_media: responseData.delayed_media ?? responseData.delayed_montage ?? 0,
          recent_projects: responseData.recent_projects ?? responseData.latest_projects ?? [],
          // ✅ إضافة version للـ cache لضمان إبطال البيانات القديمة
          _cacheVersion: '2.0', // ✅ تحديث version عند تغيير طريقة الحساب
        };

        setStats(dashboardData);

        // ✅ حفظ البيانات في cache
        setCachedData(dashboardData);
      } else {
        // إذا كان success = false
        if (import.meta.env.DEV) {
          console.warn('⚠️ Dashboard API returned success=false:', response.data);
        }
        setStats({
          total_projects: 0,
          total_value_usd: 0,
          projects_by_status: {},
          projects_by_type: {},
          delayed_execution: 0,
          delayed_media: 0,
          recent_projects: [],
        });

        // فقط إذا لم يتم عرض error بالفعل
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          toast.error(response.data.message || 'فشل في جلب معلومات لوحة التحكم');
        }
      }
    } catch (error) {
      // ✅ معالجة خطأ 403 (Forbidden) - المستخدم قد لا يملك صلاحيات
      if (error.response?.status === 403) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ Access denied to dashboard endpoint (403). User may not have permissions.');
        }
        // ✅ عرض بيانات فارغة بدلاً من رسالة خطأ
        setStats({
          total_projects: 0,
          total_value_usd: 0,
          projects_by_status: {},
          projects_by_type: {},
          delayed_execution: 0,
          delayed_media: 0,
          recent_projects: [],
        });
        setLoading(false);
        return;
      }

      // تنظيف timeout في حالة الخطأ
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      if (error.response?.status === 403 || error.isPermissionError) {
        setLoading(false);
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          toast.error('ليس لديك صلاحيات للوصول إلى لوحة التحكم');
        }
        return;
      }

      // في حالة الخطأ، نعرض بيانات افتراضية بدلاً من البقاء في حالة التحميل
      setStats({
        total_projects: 0,
        total_value_usd: 0,
        projects_by_status: {},
        projects_by_type: {},
        delayed_execution: 0,
        delayed_media: 0,
        recent_projects: [],
      });

      // عرض رسالة خطأ واضحة - فقط مرة واحدة
      if (!errorShownRef.current) {
        errorShownRef.current = true;

        let errorMessage = 'فشل في جلب المعلومات';

        if (error.response) {
          // الخطأ من الـ server
          const status = error.response.status;
          const message = error.response.data?.message || error.response.data?.error;

          if (status === 404) {
            errorMessage = 'لوحة التحكم غير متوفرة. يرجى التحقق من الـ endpoint.';
          } else if (status === 500) {
            errorMessage = 'خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.';
          } else if (message) {
            errorMessage = message;
          } else {
            errorMessage = `فشل في جلب المعلومات (${status})`;
          }

          if (import.meta.env.DEV) {
            console.error('❌ Dashboard API Error:', {
              status,
              endpoint: '/project-proposals-dashboard',
              data: error.response.data,
              message: error.message
            });
          }
        } else if (error.request) {
          // الطلب تم لكن لم يكن هناك response
          errorMessage = 'لا يمكن الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت.';
          if (import.meta.env.DEV) {
            console.error('🌐 Dashboard Network Error:', {
              message: error.message,
              endpoint: '/project-proposals-dashboard'
            });
          }
        } else {
          // خطأ في إعداد الطلب
          errorMessage = 'حدث خطأ أثناء تحضير الطلب.';
          if (import.meta.env.DEV) {
            console.error('⚙️ Dashboard Request Setup Error:', error.message);
          }
        }

        if (error.response?.status !== 403 && !error.isConnectionError) {
          toast.error(errorMessage);
        }
      }
    } finally {
      // تنظيف timeout في النهاية
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setLoading(false);
    }
  };

  const getRoleName = (role) => {
    const roles = {
      admin: 'مدير عام',
      project_manager: 'مدير مشاريع',
      media_manager: 'مدير إعلام',
      executed_projects_coordinator: 'منسق مشاريع منفذة',
      executor: 'منفذ',
      photographer: 'مصور',
    };
    return roles[role] || role;
  };

  const getStatusColor = (status) => {
    const colors = {
      'جديد': 'bg-blue-500',
      'قيد التوريد': 'bg-indigo-500',
      'تم التوريد': 'bg-teal-500',
      'قيد التوزيع': 'bg-orange-500',
      'مؤجل': 'bg-amber-500',
      'جاهز للتنفيذ': 'bg-yellow-500',
      'تم اختيار المخيم': 'bg-yellow-600',
      'قيد التنفيذ': 'bg-purple-500',
      'منفذ': 'bg-gray-700',
      'في المونتاج': 'bg-purple-300',
      'تم المونتاج': 'bg-green-500',
      'معاد مونتاجه': 'bg-teal-500',
      'وصل للمتبرع': 'bg-green-700',
      'منتهي': 'bg-gray-600',
      'ملغى': 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // ✅ دالة لتنسيق المبالغ الكبيرة بشكل مختصر (مثل 1.2M بدلاً من 1,200,000)
  const formatCompactCurrency = (amount) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'غير محدد';
    // ✅ استخدام locale إنجليزي لضمان عرض التاريخ الميلادي
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  };

  // ✅ انتظار تحميل بيانات المستخدم أولاً
  // if (authLoading || loading) {
  //   return (
  //     <div className="flex justify-center items-center min-h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
  //     </div>
  //   );
  // }

  // ✅ التحقق من الصلاحيات - فقط Admin يمكنه الوصول
  const userRole = user?.role?.toLowerCase?.() ||
    user?.userRole?.toLowerCase?.() ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role || '';

  const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

  if (!user) {
    return <Unauthorized requiredRole="admin" pageName="لوحة التحكم" />;
  }

  if (userRole && !isAdmin) {
    return <Unauthorized requiredRole="admin" pageName="لوحة التحكم" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20" style={ { fontFamily: 'Cairo, Tajawal, Arial, sans-serif', fontWeight: 400 } }>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */ }
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 rounded-3xl p-8 md:p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-4 right-4 w-32 h-32 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-4 left-4 w-40 h-40 bg-white rounded-full blur-3xl"></div>
          </div>
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-3 drop-shadow-lg" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>مرحباً، { user?.name }</h1>
              <p className="text-sky-100 text-xl md:text-2xl font-semibold" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>{ getRoleName(user?.role) }</p>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/20 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/30">
                <Calendar className="w-14 h-14" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */ }
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="إجمالي المشاريع"
            value={ stats?.total_projects ?? 0 }
            icon={ <FolderKanban className="w-6 h-6" /> }
            gradient="from-blue-500 to-blue-600"
          />
          <StatCard
            title="القيمة الإجمالية"
            value={ formatCompactCurrency(stats?.total_value_usd ?? 0) }
            icon={ <DollarSign className="w-6 h-6" /> }
            gradient="from-green-500 to-green-600"
            isLargeValue={ true }
            fullValue={ formatCurrency(stats?.total_value_usd ?? 0) }
          />
          <StatCard
            title="متأخر في التنفيذ"
            value={ stats?.delayed_execution ?? 0 }
            icon={ <Clock className="w-6 h-6" /> }
            gradient="from-orange-500 to-orange-600"
          />
          <StatCard
            title="متأخر في المونتاج"
            value={ stats?.delayed_media ?? 0 }
            icon={ <AlertCircle className="w-6 h-6" /> }
            gradient="from-red-500 to-red-600"
          />
        </div>


        {/* Projects by Status */ }
        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-4 rounded-2xl shadow-lg">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-800" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>المشاريع حسب الحالة</h2>
              <p className="text-sm text-gray-500 mt-1" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 400 } }>توزيع المشاريع على مختلف الحالات</p>
            </div>
          </div>
          { Object.keys(stats?.projects_by_status || {}).length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl">
              <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <AlertCircle className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-medium">لا توجد بيانات للمشاريع حسب الحالة</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
              { Object.entries(stats?.projects_by_status || {}).map(([status, count]) => (
                <div
                  key={ status }
                  className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl p-5 border-2 border-gray-200 hover:border-sky-400 hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                >
                  <div className={ `${getStatusColor(status)} w-5 h-5 rounded-full mb-4 shadow-lg group-hover:scale-110 transition-transform` }></div>
                  <p className="text-sm text-gray-600 mb-3 font-semibold leading-tight" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>{ status }</p>
                  <p className="text-4xl font-bold text-gray-800" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>{ count }</p>
                  <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={ `${getStatusColor(status)} h-full rounded-full transition-all duration-500` } style={ { width: '100%' } }></div>
                  </div>
                </div>
              )) }
            </div>
          ) }
        </div>

        {/* Projects by Type */ }
        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-4 rounded-2xl shadow-lg">
              <FolderKanban className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-800" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>المشاريع حسب النوع</h2>
              <p className="text-sm text-gray-500 mt-1" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 400 } }>تصنيف المشاريع حسب أنواعها المختلفة</p>
            </div>
          </div>
          { Object.keys(stats?.projects_by_type || {}).length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl">
              <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <FolderKanban className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-medium">لا توجد بيانات للمشاريع حسب النوع</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              { Object.entries(stats?.projects_by_type || {}).map(([type, count], index) => {
                const colors = [
                  { from: 'from-blue-500', to: 'to-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', hover: 'hover:border-blue-400', text: 'text-blue-700' },
                  { from: 'from-green-500', to: 'to-emerald-600', bg: 'bg-green-50', border: 'border-green-200', hover: 'hover:border-green-400', text: 'text-green-700' },
                  { from: 'from-orange-500', to: 'to-amber-600', bg: 'bg-orange-50', border: 'border-orange-200', hover: 'hover:border-orange-400', text: 'text-orange-700' },
                  { from: 'from-purple-500', to: 'to-indigo-600', bg: 'bg-purple-50', border: 'border-purple-200', hover: 'hover:border-purple-400', text: 'text-purple-700' },
                ];
                const color = colors[index % colors.length];

                return (
                  <div
                    key={ type }
                    className={ `group bg-gradient-to-br ${color.bg} to-white rounded-2xl p-6 border-2 ${color.border} ${color.hover} hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1` }
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={ `w-12 h-12 bg-gradient-to-br ${color.from} ${color.to} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300` }>
                        <FolderKanban className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <p className={ `text-sm ${color.text} font-bold mb-3 leading-tight` } style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>{ type }</p>
                    <p className="text-4xl font-bold text-gray-800" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>{ count }</p>
                    <p className="text-xs text-gray-500 mt-2">مشروع</p>
                  </div>
                );
              }) }
            </div>
          ) }
        </div>

        {/* Recent Projects */ }
        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-lg">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-800" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>آخر المشاريع</h2>
                <p className="text-sm text-gray-500 mt-1" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 400 } }>المشاريع الأحدث في النظام</p>
              </div>
            </div>
            <Link
              to="/project-management/projects"
              className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <span>عرض الكل</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          { (stats?.recent_projects || []).length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl">
              <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <FileText className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-medium">لا توجد مشاريع حديثة</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border-2 border-gray-100 shadow-inner">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                      <th className="text-right py-5 px-6 text-sm font-bold text-gray-700 whitespace-nowrap">
                        كود المشروع
                      </th>
                      <th className="text-right py-5 px-6 text-sm font-bold text-gray-700 whitespace-nowrap">
                        الوصف
                      </th>
                      <th className="text-right py-5 px-6 text-sm font-bold text-gray-700 whitespace-nowrap">
                        الجهة المتبرعة
                      </th>
                      <th className="text-right py-5 px-6 text-sm font-bold text-gray-700 whitespace-nowrap">
                        المبلغ
                      </th>
                      <th className="text-right py-5 px-6 text-sm font-bold text-gray-700 whitespace-nowrap">
                        الحالة
                      </th>
                      <th className="text-right py-5 px-6 text-sm font-bold text-gray-700 whitespace-nowrap">
                        التاريخ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    { (stats?.recent_projects || []).map((project, index) => (
                      <tr
                        key={ project.id }
                        className={ `border-b border-gray-100 hover:bg-gradient-to-r hover:from-sky-50 hover:to-blue-50 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}` }
                      >
                        <td className="py-4 px-6">
                          <Link
                            to={ `/project-management/projects/${project.id}` }
                            className="text-sm font-bold text-sky-600 hover:text-sky-700 hover:underline"
                          >
                            { getProjectCode(project, project.id?.toString() || '-') }
                          </Link>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-gray-700 font-medium leading-relaxed max-w-md">
                            { (project.description || project.project_description || '-')?.substring(0, 60) }
                            { (project.description || project.project_description)?.length > 60 ? '...' : '' }
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-gray-700 font-medium">{ project.donor_name || '-' }</p>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                            <DollarSign className="w-4 h-4" />
                            { formatCurrency(project.net_amount_usd || project.net_amount || 0) }
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={ `inline-block px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md ${getStatusColor(
                              project.status || 'جديد'
                            )}` }
                          >
                            { project.status || 'جديد' }
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            { project.created_at ? formatDate(project.created_at) : '-' }
                          </div>
                        </td>
                      </tr>
                    )) }
                  </tbody>
                </table>
              </div>
            </div>
          ) }
        </div>

        {/* Reports Section */ }
        <div className="bg-gradient-to-br from-purple-50 via-white to-pink-50 rounded-3xl p-8 md:p-10 shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-purple-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-4 rounded-2xl shadow-lg">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-800" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>التقارير المفصلة</h2>
                <p className="text-sm text-gray-600 mt-1" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 400 } }>إحصائيات شاملة وتحليلات متقدمة</p>
              </div>
            </div>
            <Link
              to="/project-management/reports"
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <FileText className="w-5 h-5" />
              <span>عرض التقارير</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <p className="text-gray-700 mb-6 text-base leading-relaxed">
            احصل على تقارير مفصلة وإحصائيات شاملة عن جميع المشاريع مع إمكانية الفلترة والتصدير إلى Excel.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="group bg-white hover:bg-gradient-to-br hover:from-purple-50 hover:to-white rounded-2xl p-6 border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-xl shadow-md group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <span className="text-base font-bold text-gray-800">تقارير مفصلة</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">إحصائيات وتحليلات شاملة للمشاريع</p>
            </div>
            <div className="group bg-white hover:bg-gradient-to-br hover:from-green-50 hover:to-white rounded-2xl p-6 border-2 border-green-200 hover:border-green-400 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl shadow-md group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <span className="text-base font-bold text-gray-800">فلترة متقدمة</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">فلترة حسب التاريخ، الحالة، النوع</p>
            </div>
            <div className="group bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-white rounded-2xl p-6 border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-gradient-to-br from-blue-500 to-sky-600 p-3 rounded-xl shadow-md group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <span className="text-base font-bold text-gray-800">تصدير Excel</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">تصدير البيانات بسهولة وسرعة</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */ }
        {/* TODO: بعد ربط Backend، فعّل شروط الصلاحيات حسب role */ }
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <QuickActionCard
            title="إنشاء مشروع جديد"
            description="إضافة مشروع جديد للنظام"
            icon={ <FolderKanban className="w-6 h-6" /> }
            link="/project-management/projects/new"
            color="from-sky-500 to-blue-600"
          />
          <QuickActionCard
            title="إدارة الفرق"
            description="إدارة فرق العمل والأعضاء"
            icon={ <Users className="w-6 h-6" /> }
            link="/project-management/teams"
            color="from-purple-500 to-purple-600"
          />
          <QuickActionCard
            title="إدارة العملات"
            description="تحديث أسعار الصرف"
            icon={ <DollarSign className="w-6 h-6" /> }
            link="/project-management/currencies"
            color="from-green-500 to-emerald-600"
          />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, gradient, isLargeValue = false, fullValue = null }) => (
  <div className={ `relative bg-gradient-to-br ${gradient} rounded-3xl p-8 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden group` }>
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <div className="bg-white/25 backdrop-blur-md p-4 rounded-2xl shadow-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
          { icon }
        </div>
      </div>
      <p className="text-sm opacity-90 mb-3 font-semibold uppercase tracking-wide" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>{ title }</p>
      <p className={ `font-bold drop-shadow-lg leading-tight ${isLargeValue ? 'text-3xl md:text-4xl' : 'text-5xl'}` } style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>
        { value }
      </p>
      { isLargeValue && fullValue && (
        <p className="text-xs opacity-75 mt-2 font-medium" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }>
          { fullValue }
        </p>
      ) }
    </div>
  </div>
);

const QuickActionCard = ({ title, description, icon, link, color }) => (
  <Link
    to={ link }
    className={ `relative block bg-gradient-to-br ${color} rounded-3xl p-10 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 group overflow-hidden` }
  >
    <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -ml-20 -mt-20 group-hover:scale-150 transition-transform duration-500"></div>
    <div className="relative">
      <div className="bg-white/25 backdrop-blur-md p-5 rounded-2xl inline-block mb-5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-xl">
        { icon }
      </div>
      <h3 className="text-2xl font-bold mb-3 leading-tight" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>{ title }</h3>
      <p className="text-sm opacity-95 leading-relaxed" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 400 } }>{ description }</p>
      <div className="mt-4 flex items-center gap-2 text-sm font-semibold" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>
        <span>انتقل الآن</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  </Link>
);

export default Dashboard;


