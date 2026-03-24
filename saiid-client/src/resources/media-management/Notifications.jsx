import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../utils/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { Bell, CheckCircle2, AlertCircle, Clock, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

const MediaNotifications = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false); // ✅ تعطيل loading state افتراضياً
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  // تحديد دور المستخدم
  const userRole = useMemo(() => {
    if (!user) return '';
    return (
      user.role?.toLowerCase?.() ||
      user.userRole?.toLowerCase?.() ||
      user.user_role?.toLowerCase?.() ||
      user.role_name?.toLowerCase?.() ||
      user.role ||
      ''
    );
  }, [user]);

  const isMediaManager =
    userRole === 'media_manager' ||
    userRole === 'mediamanager' ||
    userRole === 'مدير إعلام' ||
    userRole === 'admin' ||
    userRole === 'administrator' ||
    userRole === 'مدير';

  // ✅ التحقق إذا كان المستخدم منتج مونتاج
  const isMontageProducer =
    userRole === 'montage_producer' ||
    userRole === 'montageproducer' ||
    userRole === 'ممنتج' ||
    userRole.includes('montage_producer') ||
    userRole.includes('montageproducer') ||
    userRole.includes('ممنتج');

  useEffect(() => {
    fetchNotifications();
  }, [unreadOnly]);

  // ✅ تحديث عنوان الصفحة (Tab Title) ديناميكياً
  useEffect(() => {
    document.title = 'الإشعارات - قسم الإعلام';
  }, []);

  const fetchNotifications = async () => {
    // ✅ التحقق من Cache أولاً: إذا كانت الإشعارات محملة مسبقاً، استخدمها
    const cacheKey = 'notifications_cache';
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        const cache = JSON.parse(cachedData);
        const now = Date.now();

        // إذا كانت البيانات موجودة وحديثة (أقل من 30 ثانية)
        if (cache.notifications && cache.timestamp && (now - cache.timestamp) < (cache.maxAge || 30000)) {
          // فلترة الإشعارات المتعلقة بقسم الإعلام
          const mediaNotifications = Array.isArray(cache.notifications) ? cache.notifications.filter(notif => {
            const type = notif.notification_type || notif.type || '';
            return type.includes('montage') ||
              type.includes('media') ||
              type === 'media_rejected' ||
              type === 'media_accepted' ||
              notif.title?.includes('مونتاج') ||
              notif.message?.includes('مونتاج') ||
              notif.title?.includes('رفض') ||
              notif.title?.includes('قبول');
          }) : [];

          setNotifications(mediaNotifications);

          // حساب الإحصائيات من الإشعارات
          if (mediaNotifications.length > 0) {
            const stats = {
              ready_for_montage: mediaNotifications.filter(n =>
                n.notification_type === 'ready_for_montage' || n.title?.includes('جاهز للمونتاج')
              ).length,
              delayed: mediaNotifications.filter(n =>
                n.notification_type === 'delay_montage' || n.title?.includes('متأخر')
              ).length,
              reminders: mediaNotifications.filter(n =>
                n.notification_type === 'montage_reminder' || n.title?.includes('تذكير')
              ).length,
              rejected: mediaNotifications.filter(n =>
                n.notification_type === 'media_rejected' || n.title?.includes('رفض')
              ).length,
              accepted: mediaNotifications.filter(n =>
                n.notification_type === 'media_accepted' || n.title?.includes('قبول')
              ).length,
              unread_count: mediaNotifications.filter(n => !n.read_at).length,
            };
            setStats(stats);
          }

          if (import.meta.env.DEV) {
            console.log('✅ Using preloaded media notifications from cache:', mediaNotifications.length);
          }

          // جلب البيانات من API في الخلفية لتحديث الـ cache
          fetchNotificationsFromAPI();
          return; // عرض البيانات المحملة مسبقاً مباشرة
        }
      } catch (cacheError) {
        // إذا فشل parsing الـ cache، نتابع لجلب البيانات من API
        if (import.meta.env.DEV) {
          console.warn('⚠️ Failed to parse notifications cache:', cacheError);
        }
      }
    }

    // إذا لم تكن هناك بيانات في cache، جلب من API
    await fetchNotificationsFromAPI();
  };

  const fetchNotificationsFromAPI = async () => {
    let loadingTimeout;

    try {
      // ✅ إزالة setLoading(true) لجعل الانتقال أسرع
      // setLoading(true);

      // ✅ تقليل timeout أو إزالته لجعل التحميل أسرع
      loadingTimeout = setTimeout(() => {
        setLoading(false);
        setNotifications([]);
        setStats({
          ready_for_montage: 0,
          delayed: 0,
          reminders: 0,
          rejected: 0,
          accepted: 0,
          unread_count: 0,
        });
      }, 2000); // timeout 2 ثانية بدلاً من 5

      // ✅ محاولة استخدام endpoint مخصص للإعلام فقط إذا كان المستخدم media_manager أو admin
      let response;
      if (isMediaManager) {
        try {
          const params = new URLSearchParams();
          if (unreadOnly) {
            params.append('unread_only', 'true');
          }
          params.append('perPage', '50');
          response = await apiClient.get(`/notifications/media?${params.toString()}`, {
            timeout: 3000 // تقليل timeout لجعل التحميل أسرع
          });

          // ✅ إذا نجح الطلب، استخدم البيانات
          if (response.data?.success) {
            // البيانات من endpoint الخاص
          }
        } catch (mediaError) {
          // ✅ معالجة خطأ 403 (Forbidden) - المستخدم ليس لديه صلاحيات
          if (mediaError.response?.status === 403) {
            if (import.meta.env.DEV) {
              console.log('Media notifications endpoint not accessible (403), using fallback');
            }
            // استخدم endpoint العام
          } else if (mediaError.response?.status === 404) {
            // ✅ إذا كان 404، استخدم endpoint العام
            if (import.meta.env.DEV) {
              console.log('Media notifications endpoint not found (404), using fallback');
            }
          } else {
            // ✅ إذا كان خطأ آخر، أعد رمي الخطأ
            throw mediaError;
          }
        }
      }

      // ✅ Fallback: استخدام endpoint العام إذا لم يكن media_manager أو فشل endpoint الخاص
      if (!response || !response.data?.success) {
        const params = new URLSearchParams();
        if (unreadOnly) {
          params.append('unread_only', 'true');
        }
        params.append('perPage', '50');
        response = await apiClient.get(`/notifications?${params.toString()}`, {
          timeout: 3000 // تقليل timeout لجعل التحميل أسرع
        });
      }

      if (loadingTimeout) clearTimeout(loadingTimeout);

      if (response.data.success) {
        let notifications = response.data.notifications || response.data.data || [];

        // ✅ إذا كان endpoint الخاص (media) وأعاد إحصائيات، استخدمها
        if (response.data.statistics) {
          setStats({
            ready_for_montage: response.data.statistics.ready_for_montage || 0,
            delayed: response.data.statistics.delayed || 0,
            reminders: response.data.statistics.reminders || 0,
            rejected: response.data.statistics.rejected || 0,
            accepted: response.data.statistics.accepted || 0,
            unread_count: response.data.unread_count || 0,
          });
        } else {
          // ✅ فلترة الإشعارات المتعلقة بقسم الإعلام (فقط عند استخدام endpoint العام)
          if (Array.isArray(notifications)) {
            notifications = notifications.filter(notif => {
              const type = notif.notification_type || notif.type || '';
              return type.includes('montage') ||
                type.includes('media') ||
                type === 'media_rejected' ||
                type === 'media_accepted' ||
                notif.title?.includes('مونتاج') ||
                notif.message?.includes('مونتاج') ||
                notif.title?.includes('رفض') ||
                notif.title?.includes('قبول');
            });
          }

          // حساب الإحصائيات من الإشعارات (عند استخدام endpoint العام)
          if (notifications.length > 0) {
            const stats = {
              ready_for_montage: notifications.filter(n =>
                n.notification_type === 'ready_for_montage' || n.title?.includes('جاهز للمونتاج')
              ).length,
              delayed: notifications.filter(n =>
                n.notification_type === 'delay_montage' || n.title?.includes('متأخر')
              ).length,
              reminders: notifications.filter(n =>
                n.notification_type === 'montage_reminder' || n.title?.includes('تذكير')
              ).length,
              rejected: notifications.filter(n =>
                n.notification_type === 'media_rejected' || n.title?.includes('رفض')
              ).length,
              accepted: notifications.filter(n =>
                n.notification_type === 'media_accepted' || n.title?.includes('قبول')
              ).length,
              unread_count: notifications.filter(n => !n.is_read).length,
            };
            setStats(stats);
          } else {
            setStats({
              ready_for_montage: 0,
              delayed: 0,
              reminders: 0,
              rejected: 0,
              accepted: 0,
              unread_count: 0,
            });
          }
        }

        setNotifications(notifications);

        // ✅ حفظ الإشعارات في cache لتحديثها
        try {
          const cacheKey = 'notifications_cache';
          const cacheData = {
            notifications: Array.isArray(notifications) ? notifications : [],
            timestamp: Date.now(),
            maxAge: 30000 // 30 ثانية
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (cacheError) {
          // تجاهل أخطاء حفظ الـ cache
          if (import.meta.env.DEV) {
            console.warn('⚠️ Failed to save notifications cache:', cacheError);
          }
        }
      } else {
        setNotifications([]);
        setStats({
          ready_for_montage: 0,
          delayed: 0,
          reminders: 0,
          rejected: 0,
          accepted: 0,
          unread_count: 0,
        });
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);

      setNotifications([]);
      setStats({
        ready_for_montage: 0,
        delayed: 0,
        reminders: 0,
        rejected: 0,
        accepted: 0,
        unread_count: 0,
      });

      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('Error fetching notifications:', error);
      }

      // ✅ معالجة الأخطاء بشكل أفضل
      if (error.response?.status === 403) {
        // المستخدم ليس لديه صلاحيات - لا نعرض رسالة خطأ، فقط استخدم endpoint العام
        if (import.meta.env.DEV) {
          console.log('User does not have permission for media notifications endpoint');
        }
        // لا نعرض toast للخطأ 403
      } else if (error.response?.status === 401) {
        // غير مصرح - توجيه للـ login (سيتم التعامل معه في axiosConfig)
        if (!error.isConnectionError) {
          toast.error('يرجى تسجيل الدخول مرة أخرى');
        }
      } else if (error.response?.status === 404) {
        // Endpoint غير موجود - لا نعرض رسالة خطأ
        if (import.meta.env.DEV) {
          console.log('Notifications endpoint not found (404)');
        }
      } else if (!error.isConnectionError) {
        // ✅ عدم عرض رسالة خطأ لـ timeout أو connection errors
        if (!error.isConnectionError && !error.isTimeoutError && error.userMessage) {
          toast.error(error.userMessage || error.response?.data?.message || 'فشل تحميل الإشعارات');
        }
      }
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiClient.patch(`/notifications/${notificationId}/read`);

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );

      // Update stats
      if (stats) {
        setStats((prev) => ({
          ...prev,
          unread_count: Math.max(0, (prev.unread_count || 0) - 1),
        }));
      }
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('فشل تحديث حالة الإشعار');
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.patch('/notifications/read-all');

      // Update local state
      setNotifications((prev) => prev.map((notif) => ({ ...notif, is_read: true })));

      // Update stats
      if (stats) {
        setStats((prev) => ({
          ...prev,
          unread_count: 0,
        }));
      }

      toast.success('تم تحديد جميع الإشعارات كمقروءة');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('فشل تحديث الإشعارات');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // ✅ استخدام locale إنجليزي لضمان عرض التاريخ الميلادي
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'ready_for_montage':
        return <Video className="w-5 h-5 text-blue-500" />;
      case 'delay_montage':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'montage_reminder':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'media_rejected':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'media_accepted':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationColor = (type, priority) => {
    if (type === 'media_rejected') {
      return 'border-red-300 bg-red-100';
    }
    if (type === 'media_accepted') {
      return 'border-green-300 bg-green-100';
    }
    if (priority === 'high') {
      return 'border-red-200 bg-red-50';
    }
    if (type === 'delay_montage') {
      return 'border-red-200 bg-red-50';
    }
    if (type === 'ready_for_montage') {
      return 'border-blue-200 bg-blue-50';
    }
    return 'border-gray-200 bg-white';
  };

  const parseMetadata = (notification) => {
    const metadata = notification?.metadata || notification?.data;
    if (!metadata) return {};
    if (typeof metadata === 'object') return metadata;
    try {
      return JSON.parse(metadata);
    } catch (error) {
      console.warn('Failed to parse notification metadata', error);
      return {};
    }
  };

  // ✅ إزالة علامة التحميل الكاملة - عرض المحتوى مباشرة
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */ }
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">إشعارات قسم الإعلام</h1>
            <p className="text-gray-600 mt-1">متابعة آخر التحديثات والمشاريع الجاهزة</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ unreadOnly }
                onChange={ (e) => setUnreadOnly(e.target.checked) }
                className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
              />
              <span className="text-sm text-gray-700">غير المقروءة فقط</span>
            </label>
            { stats && stats.unread_count > 0 && (
              <button
                onClick={ markAllAsRead }
                className="px-4 py-2 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors text-sm"
              >
                تحديد الكل كمقروء
              </button>
            ) }
          </div>
        </div>

        {/* Statistics */ }
        { stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-lg border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">جاهزة للمونتاج</p>
                  <p className="text-2xl font-bold text-gray-800">{ stats.ready_for_montage || 0 }</p>
                </div>
                <Video className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-lg border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">متأخرة</p>
                  <p className="text-2xl font-bold text-gray-800">{ stats.delayed || 0 }</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-lg border-l-4 border-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">تذكيرات</p>
                  <p className="text-2xl font-bold text-gray-800">{ stats.reminders || 0 }</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-lg border-l-4 border-red-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">مرفوضة</p>
                  <p className="text-2xl font-bold text-gray-800">{ stats.rejected || 0 }</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>
        ) }

        {/* Notifications List */ }
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          { notifications.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              { notifications.map((notification) => (
                <div
                  key={ notification.id }
                  className={ `p-6 border-r-4 transition-all hover:shadow-md ${notification.is_read
                    ? 'bg-white'
                    : getNotificationColor(notification.notification_type, notification.priority)
                    }` }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1">{ getNotificationIcon(notification.notification_type) }</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800">{ notification.title }</h3>
                          { !notification.is_read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          ) }
                        </div>
                        <p className="text-gray-600 text-sm mb-2">{ notification.message }</p>

                        {/* عرض تفاصيل الرفض لإشعارات media_rejected */ }
                        { (notification.notification_type === 'media_rejected' || notification.type === 'media_rejected') && (
                          <div className="mt-3 p-3 bg-red-50 border-r-4 border-red-500 rounded-lg">
                            { (() => {
                              const metadata = parseMetadata(notification);
                              return (
                                <>
                                  { metadata.rejection_message && (
                                    <div className="mb-2">
                                      <p className="text-xs font-semibold text-red-700 mb-1">الرسالة:</p>
                                      <p className="text-sm text-gray-700">{ metadata.rejection_message }</p>
                                    </div>
                                  ) }
                                  { metadata.rejection_reason && (
                                    <div>
                                      <p className="text-xs font-semibold text-red-700 mb-1">سبب الرفض:</p>
                                      <p className="text-sm text-gray-700">{ metadata.rejection_reason }</p>
                                    </div>
                                  ) }
                                </>
                              );
                            })() }
                          </div>
                        ) }

                        {/* عرض تفاصيل القبول لإشعارات media_accepted */ }
                        { (notification.notification_type === 'media_accepted' || notification.type === 'media_accepted') && (
                          <div className="mt-3 p-3 bg-green-50 border-r-4 border-green-500 rounded-lg">
                            <p className="text-sm text-green-700 font-semibold">
                              ✓ تم قبول المونتاج بنجاح وتم نقل المشروع إلى حالة "وصل للمتبرع"
                            </p>
                            { (() => {
                              const metadata = parseMetadata(notification);
                              return metadata.accepted_by_name && (
                                <p className="text-xs text-gray-600 mt-1">
                                  تم القبول بواسطة: { metadata.accepted_by_name }
                                </p>
                              );
                            })() }
                          </div>
                        ) }

                        {/* ✅ إخفاء معلومات المشروع للمنتج */ }
                        { notification.project && !isMontageProducer && (
                          <div className="text-xs text-gray-500 mb-2">
                            المشروع: { notification.project.project_name } (#{ notification.project.serial_number })
                          </div>
                        ) }
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{ formatDate(notification.created_at) }</span>
                          { notification.priority === 'high' && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">عاجل</span>
                          ) }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      { !notification.is_read && (
                        <button
                          onClick={ () => markAsRead(notification.id) }
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="تحديد كمقروء"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      ) }
                      {/* ✅ إخفاء زر عرض المشروع */ }
                    </div>
                  </div>
                </div>
              )) }
            </div>
          ) }
        </div>
      </div>
    </div>
  );
};

export default MediaNotifications;

