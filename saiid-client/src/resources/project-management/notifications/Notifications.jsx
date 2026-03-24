import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { getProjectCode } from '../../../utils/helpers';
import { Bell, Check, CheckCheck, Eye, ArrowRight, Calendar as CalendarIcon, AlertTriangle, MessageSquare, X, CheckCircle, AlertCircle } from 'lucide-react';

const Notifications = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false); // ✅ تعطيل loading state افتراضياً
  const [allNotifications, setAllNotifications] = useState([]); // جميع الإشعارات

  // ✅ استخدام useRef لحفظ AbortController لإلغاء الطلبات السابقة
  const abortControllerRef = useRef(null);
  const [filter, setFilter] = useState('all'); // all, unread
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [replyForm, setReplyForm] = useState({
    message: '',
    rejection_reason: '',
  });
  const [replying, setReplying] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [notificationToAccept, setNotificationToAccept] = useState(null);

  // جلب جميع الإشعارات مرة واحدة عند تحميل الصفحة
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    let loadingTimeout;

    try {
      // ✅ التحقق من Cache أولاً: إذا كانت الإشعارات محملة مسبقاً، استخدمها
      const cacheKey = 'notifications_cache';
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        try {
          const cache = JSON.parse(cachedData);
          const now = Date.now();

          // إذا كانت البيانات موجودة وحديثة (أقل من 30 ثانية)
          if (cache.notifications && cache.timestamp && (now - cache.timestamp) < (cache.maxAge || 30000)) {
            setAllNotifications(Array.isArray(cache.notifications) ? cache.notifications : []);

            if (import.meta.env.DEV) {
              console.log('✅ Using preloaded notifications from cache:', cache.notifications.length);
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
    } catch (error) {
      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('❌ Error in fetchNotifications:', error);
      }
    }
  };

  const fetchNotificationsFromAPI = async () => {
    let loadingTimeout;

    try {
      // ✅ إلغاء الطلب السابق إذا كان موجوداً
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // ✅ إنشاء AbortController جديد
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // ✅ إزالة setLoading(true) لجعل الانتقال أسرع
      // setLoading(true);

      // ✅ تقليل timeout لجعل التحميل أسرع
      loadingTimeout = setTimeout(() => {
        setLoading(false);
        setAllNotifications([]);
      }, 2000); // timeout 2 ثانية بدلاً من 5

      // جلب جميع الإشعارات دائماً (بدون فلترة من الـ API)
      const response = await apiClient.get('/notifications', {
        timeout: 3000, // timeout 3 ثواني (تقليل لجعل التحميل أسرع)
        signal: abortController.signal // ✅ إضافة signal لإلغاء الطلب
      });

      if (loadingTimeout) clearTimeout(loadingTimeout);

      if (response.data.success) {
        // ✅ دعم بنيات مختلفة للـ response
        const notifications =
          response.data.data ||
          response.data.notifications ||
          response.data ||
          [];

        const normalizedNotifications = Array.isArray(notifications) ? notifications : [];
        setAllNotifications(normalizedNotifications);

        // ✅ حفظ الإشعارات في cache لتحديث البيانات المحملة مسبقاً
        const cacheData = {
          notifications: normalizedNotifications,
          timestamp: Date.now(),
          maxAge: 30000 // 30 ثانية
        };
        localStorage.setItem('notifications_cache', JSON.stringify(cacheData));
      } else {
        setAllNotifications([]);
        if (import.meta.env.DEV) {
          console.warn('⚠️ API returned success: false', response.data);
        }
        setAllNotifications([]);
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);

      // ✅ تجاهل الأخطاء من الطلبات الملغاة
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || abortControllerRef.current?.signal.aborted) {
        return; // لا نفعل شيء إذا تم إلغاء الطلب
      }

      // ✅ تجاهل أخطاء 401 (Unauthorized) و 403 (Forbidden) - المستخدم غير مسموح له
      if (error.response?.status === 401 || error.response?.status === 403) {
        setAllNotifications([]);
        if (import.meta.env.DEV) {
          console.warn('⚠️ Unauthorized to fetch notifications (401/403)');
        }
        return;
      }

      // ✅ إذا كان هناك بيانات في cache، استخدمها
      const cacheKey = 'notifications_cache';
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const cache = JSON.parse(cachedData);
          if (cache.notifications && Array.isArray(cache.notifications)) {
            setAllNotifications(cache.notifications);
            if (import.meta.env.DEV) {
              console.warn('⚠️ Error fetching notifications, using cached data');
            }
            return;
          }
        } catch (cacheError) {
          // ignore
        }
      }

      setAllNotifications([]);

      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('❌ Error fetching notifications:', error);
      }

      // ✅ عدم عرض رسالة خطأ لـ timeout أو connection errors أو 401/403
      if (!error.isConnectionError &&
        !error.isTimeoutError &&
        error.response?.status !== 401 &&
        error.response?.status !== 403 &&
        error.userMessage) {
        toast.error(error.userMessage || error.response?.data?.message || 'فشل تحميل الإشعارات');
      }
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const response = await apiClient.patch(`/notifications/${notificationId}/read`);
      if (response.data.success) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await apiClient.patch('/notifications/read-all');
      if (response.data.success) {
        toast.success('تم تحديد جميع الإشعارات كمقروءة');
        fetchNotifications();
      } else {
        toast.error(response.data.message || 'حدث خطأ');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error(error.userMessage || 'حدث خطأ');
    }
  };

  const getNotificationType = (notification) =>
    notification?.notification_type || notification?.type || '';

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

  const formatCurrency = (value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return value || '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(numeric);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'project_created':
        return '📋';
      case 'project_assigned':
        return '👥';
      case 'project_status_changed':
        return '🔄';
      case 'shelter_selected':
        return '🏠';
      case 'media_updated':
        return '🎬';
      case 'media_completed':
        return '✅';
      case 'media_rejected':
        return '❌';
      case 'daily_phase':
        return '📅';
      case 'warehouse_supply_started':
        return '📦';
      case 'warehouse_supply_confirmed':
        return '✅';
      case 'project_has_deficit':
        return '⚠️';
      case 'warehouse_low_stock':
        return '🔔';
      default:
        return '🔔';
    }
  };

  const handleOpenReplyModal = (notification) => {
    setSelectedNotification(notification);
    setReplyForm({ message: '', rejection_reason: '' });
    setReplyModalOpen(true);
  };

  const handleCloseReplyModal = () => {
    setReplyModalOpen(false);
    setSelectedNotification(null);
    setReplyForm({ message: '', rejection_reason: '' });
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();

    if (!replyForm.message.trim() || !replyForm.rejection_reason.trim()) {
      toast.error('الرجاء ملء جميع الحقول');
      return;
    }

    try {
      setReplying(true);
      const response = await apiClient.post(
        `/notifications/${selectedNotification.id}/reply`,
        replyForm
      );

      if (response.data.success) {
        toast.success('تم إرسال الرد بنجاح');
        handleCloseReplyModal();
        fetchNotifications();
      } else {
        toast.error(response.data.message || 'حدث خطأ أثناء إرسال الرد');
      }
    } catch (error) {
      console.error('Error replying to notification:', error);
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء إرسال الرد');
    } finally {
      setReplying(false);
    }
  };

  const handleOpenAcceptModal = (notification) => {
    setNotificationToAccept(notification);
    setAcceptModalOpen(true);
  };

  const handleCloseAcceptModal = () => {
    setAcceptModalOpen(false);
    setNotificationToAccept(null);
  };

  const handleAccept = async () => {
    if (!notificationToAccept) return;

    try {
      setAccepting(true);
      const response = await apiClient.post(`/notifications/${notificationToAccept.id}/accept`);

      if (response.data.success) {
        const newStatus = response.data.project?.status;
        
        // ✅ التحقق من الحالة الجديدة
        if (newStatus === 'منتهي') {
          // إظهار رسالة خاصة للمشاريع المنتهية
          toast.success(response.data.message || 'تم قبول المونتاج والمشروع أصبح في حالة "منتهي"');
        } else {
          toast.success(response.data.message || 'تم قبول المونتاج بنجاح');
        }

        // تحديث الإشعار في القائمة مباشرة
        if (response.data.notification) {
          setAllNotifications(prev => prev.map(notif =>
            notif.id === notificationToAccept.id
              ? { ...notif, ...response.data.notification }
              : notif
          ));
        } else {
          // إذا لم يكن notification في response، نحدث يدوياً
          setAllNotifications(prev => prev.map(notif =>
            notif.id === notificationToAccept.id
              ? { ...notif, is_accepted: true, is_replied: true, reply_status: 'accepted' }
              : notif
          ));
        }

        handleCloseAcceptModal();
        fetchNotifications();
      } else {
        toast.error(response.data.message || 'حدث خطأ أثناء قبول المونتاج');
        if (import.meta.env.DEV) {
          console.error('❌ Accept failed:', response.data);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('❌ Error accepting notification:', error);
      }

      const errorMessage = error.response?.data?.message || 'حدث خطأ أثناء قبول المونتاج';
      const debugInfo = error.response?.data?.debug;

      if (debugInfo) {
        toast.error(`${errorMessage} (${JSON.stringify(debugInfo)})`);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setAccepting(false);
    }
  };

  const formatDate = (date) => {
    const dateObj = new Date(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'منذ لحظات';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `منذ ${diffInMinutes} دقيقة`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `منذ ${diffInHours} ساعة`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `منذ ${diffInDays} يوم`;
    }

    // ✅ استخدام locale إنجليزي لضمان عرض التاريخ الميلادي
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(dateObj);
  };

  // فلترة الإشعارات محلياً بناءً على الفلتر المحدد (بدون إعادة جلب من API)
  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return allNotifications.filter((n) => !n.is_read);
    }
    return allNotifications;
  }, [allNotifications, filter]);

  const unreadCount = allNotifications.filter((n) => !n.is_read).length;

  // التحقق من دور المستخدم
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

  // ✅ التحقق إذا كان المستخدم منتج مونتاج
  const isMontageProducer =
    userRole === 'montage_producer' ||
    userRole === 'montageproducer' ||
    userRole === 'ممنتج المونتاج' ||
    userRole === 'ممنتج مونتاج' ||
    userRole.includes('montage_producer') ||
    userRole.includes('montageproducer') ||
    userRole.includes('ممنتج');

  const isWarehouseManager =
    userRole === 'warehouse_manager' ||
    userRole === 'warehousemanager' ||
    userRole === 'مدير مخزن' ||
    userRole === 'مدير المخزن';

  const normalizedNotifications = useMemo(
    () =>
      filteredNotifications.map((notification) => {
        const type = getNotificationType(notification);
        const metadata = parseMetadata(notification);
        return { ...notification, type, metadata };
      }),
    [filteredNotifications]
  );

  // دالة لاستخراج الروابط من النص
  const extractLinks = (text) => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  // دالة لعرض النص مع الروابط
  const renderTextWithLinks = (text) => {
    if (!text) return null;

    const links = extractLinks(text);
    if (links.length === 0) {
      return <span>{ text }</span>;
    }

    // تقسيم النص حسب الروابط
    const parts = [];
    let lastIndex = 0;

    links.forEach((link) => {
      const linkIndex = text.indexOf(link, lastIndex);
      if (linkIndex > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, linkIndex) });
      }
      parts.push({ type: 'link', content: link, url: link });
      lastIndex = linkIndex + link.length;
    });

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return (
      <span>
        { parts.map((part, index) => {
          if (part.type === 'link') {
            return (
              <a
                key={ index }
                href={ part.url }
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:text-sky-700 underline font-medium break-all"
              >
                { part.content }
              </a>
            );
          }
          return <span key={ index }>{ part.content }</span>;
        }) }
      </span>
    );
  };

  const renderNotificationBody = (notification, isWarehouseManager) => {
    if (notification.type === 'daily_phase') {
      const {
        phase_day,
        total_days,
        project_name,
        parent_project_name,
        parent_project_id,
        daily_amount,
        total_amount,
        daily_net_amount,
        net_amount,
      } = notification.metadata;

      return (
        <div className="space-y-2">
          <p className="text-gray-700">
            { project_name || 'مشروع يومي' } - اليوم { phase_day ?? '--' }
            { total_days ? ` من ${total_days}` : '' }
          </p>
          <div className="text-sm text-gray-600 space-y-1">
            { (daily_amount || daily_net_amount) && (
              <p>
                المبلغ اليومي:{ ' ' }
                <span className="font-semibold text-green-600">
                  { formatCurrency(daily_amount || daily_net_amount) }
                </span>
              </p>
            ) }
            { (total_amount || net_amount) && (
              <p>
                المبلغ الإجمالي للمشروع:{ ' ' }
                <span className="font-semibold text-sky-600">
                  { formatCurrency(total_amount || net_amount) }
                </span>
              </p>
            ) }
            { parent_project_name && (
              <p>المشروع الأصلي: { parent_project_name }</p>
            ) }
            { parent_project_id && !isWarehouseManager && (
              <Link
                to={ `/project-management/projects/${parent_project_id}` }
                className="inline-flex items-center text-xs font-semibold text-purple-600 hover:text-purple-700"
              >
                عرض المشروع الأصلي
                <ArrowRight className="w-3 h-3 mr-1" />
              </Link>
            ) }
          </div>
        </div>
      );
    }

    // عرض خاص لإشعارات media_completed مع الملاحظات
    if (notification.type === 'media_completed') {
      const { media_notes } = notification.metadata;

      return (
        <div className="space-y-3">
          <p className="text-gray-600 text-sm">{ notification.message }</p>
          { media_notes && (
            <div className="mt-3 p-3 bg-sky-50 border-r-4 border-sky-500 rounded-lg">
              <p className="text-xs font-semibold text-sky-700 mb-2">ملاحظات المونتاج:</p>
              <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                { renderTextWithLinks(media_notes) }
              </div>
            </div>
          ) }
        </div>
      );
    }

    // معالجة إشعارات المخزن والفائض
    if (notification.type === 'warehouse_supply_started') {
      const { project_id, project_serial_number, project_donor_code, project_internal_code } = notification.metadata;
      return (
        <div className="space-y-2">
          <p className="text-gray-600 text-sm">{ notification.message }</p>
          { getProjectCode({ donor_code: project_donor_code, internal_code: project_internal_code, serial_number: project_serial_number }, null) && (
            <p className="text-xs text-gray-500">كود المشروع: { getProjectCode({ donor_code: project_donor_code, internal_code: project_internal_code, serial_number: project_serial_number }) }</p>
          ) }
        </div>
      );
    }

    if (notification.type === 'warehouse_supply_confirmed') {
      const { project_id, project_serial_number, project_donor_code, project_internal_code } = notification.metadata;
      return (
        <div className="space-y-2">
          <p className="text-gray-600 text-sm">{ notification.message }</p>
          { getProjectCode({ donor_code: project_donor_code, internal_code: project_internal_code, serial_number: project_serial_number }, null) && (
            <p className="text-xs text-gray-500">كود المشروع: { getProjectCode({ donor_code: project_donor_code, internal_code: project_internal_code, serial_number: project_serial_number }) }</p>
          ) }
        </div>
      );
    }

    if (notification.type === 'project_has_deficit') {
      const { project_id, project_serial_number, project_donor_code, project_internal_code, deficit_amount } = notification.metadata;
      return (
        <div className="space-y-2">
          <p className="text-gray-600 text-sm">{ notification.message }</p>
          { deficit_amount !== undefined && (
            <div className="mt-2 p-3 bg-red-50 border-r-4 border-red-500 rounded-lg">
              <p className="text-xs font-semibold text-red-700 mb-1">مبلغ العجز:</p>
              <p className="text-sm font-bold text-red-600">{ formatCurrency(Math.abs(deficit_amount)) }</p>
            </div>
          ) }
          { getProjectCode({ donor_code: project_donor_code, internal_code: project_internal_code, serial_number: project_serial_number }, null) && (
            <p className="text-xs text-gray-500">كود المشروع: { getProjectCode({ donor_code: project_donor_code, internal_code: project_internal_code, serial_number: project_serial_number }) }</p>
          ) }
        </div>
      );
    }

    if (notification.type === 'warehouse_low_stock') {
      const { item_name, available_quantity } = notification.metadata;
      return (
        <div className="space-y-2">
          <p className="text-gray-600 text-sm">{ notification.message }</p>
          { item_name && (
            <div className="mt-2 p-3 bg-orange-50 border-r-4 border-orange-500 rounded-lg">
              <p className="text-xs font-semibold text-orange-700 mb-1">الصنف:</p>
              <p className="text-sm font-bold text-orange-600">{ item_name }</p>
              { available_quantity !== undefined && (
                <p className="text-xs text-orange-600 mt-1">الكمية المتوفرة: { available_quantity }</p>
              ) }
            </div>
          ) }
        </div>
      );
    }

    return <p className="text-gray-600 text-sm mb-3">{ notification.message }</p>;
  };

  const renderPriorityBadge = (priority) => {
    if (!priority) return null;
    const normalized = priority.toLowerCase();
    const colors = {
      high: 'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-amber-100 text-amber-700 border-amber-200',
      low: 'bg-green-100 text-green-700 border-green-200',
    };
    const labelMap = {
      high: 'أولوية عالية',
      medium: 'أولوية متوسطة',
      low: 'أولوية منخفضة',
    };
    return (
      <span className={ `inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${colors[normalized] || 'bg-gray-100 text-gray-700 border-gray-200'}` }>
        <AlertTriangle className="w-3 h-3 ml-1" />
        { labelMap[normalized] || priority }
      </span>
    );
  };

  // ✅ إزالة علامة التحميل الكاملة - عرض المحتوى مباشرة
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="space-y-6">
        {/* Header */ }
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Bell className="w-8 h-8 text-sky-600" />
              الإشعارات
            </h1>
            <p className="text-gray-600 mt-2 text-lg">
              { unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : 'لا توجد إشعارات جديدة' }
            </p>
          </div>
          { unreadCount > 0 && (
            <button
              onClick={ handleMarkAllAsRead }
              className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
            >
              <CheckCheck className="w-5 h-5" />
              تحديد الكل كمقروء
            </button>
          ) }
        </div>

        {/* Filters */ }
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
          <div className="flex gap-3">
            <button
              onClick={ () => setFilter('all') }
              className={ `px-6 py-3 rounded-xl font-medium transition-all ${filter === 'all'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }` }
            >
              الكل ({ allNotifications.length })
            </button>
            <button
              onClick={ () => setFilter('unread') }
              className={ `px-6 py-3 rounded-xl font-medium transition-all ${filter === 'unread'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }` }
            >
              غير المقروءة ({ unreadCount })
            </button>
          </div>
        </div>

        {/* Notifications List */ }
        <div className="space-y-4">
          { normalizedNotifications.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 shadow-lg text-center border border-gray-100">
              <div className="flex justify-center mb-6">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-full p-8">
                  <Bell className="w-16 h-16 text-gray-400" />
                </div>
              </div>
              <p className="text-gray-500 text-xl font-medium">لا توجد إشعارات</p>
              <p className="text-gray-400 text-sm mt-2">سيتم إشعارك عند وجود تحديثات جديدة</p>
            </div>
          ) : (
            normalizedNotifications.map((notification) => {
              // ✅ التحقق من كون المشروع عاجل من metadata (بجميع الصيغ المحتملة)
              const isUrgent = (notification.metadata?.is_urgent === true ||
                notification.metadata?.is_urgent === 1 ||
                notification.metadata?.is_urgent === '1' ||
                notification.metadata?.is_urgent === 'true' ||
                String(notification.metadata?.is_urgent || '').toLowerCase() === 'true' ||
                Boolean(notification.metadata?.is_urgent)) && 
                notification.metadata?.project_status !== 'منتهي';

              // ✅ تحديد className للكارت بناءً على حالة العاجل
              let cardClassName = 'bg-white rounded-2xl p-6 shadow-md transition-all hover:shadow-xl border border-gray-100 ';
              if (isUrgent) {
                cardClassName += 'bg-gradient-to-r from-red-100 via-red-50 to-red-100 border-l-8 border-red-600 shadow-lg hover:shadow-xl hover:from-red-200 hover:via-red-100 hover:to-red-200 ring-2 ring-red-300 ';
              }
              if (!notification.is_read) {
                cardClassName += isUrgent ? 'border-r-4 border-red-500 ' : 'border-r-4 border-sky-500 bg-sky-50/30 ';
              }

              return (
              <div
                key={ notification.id }
                className={ cardClassName.trim() }
              >
                <div className="flex items-start gap-4">
                  {/* Icon */ }
                  <div className="flex-shrink-0">
                    <div
                      className={ `w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${notification.is_read ? 'bg-gray-100' : 'bg-gradient-to-br from-sky-100 to-blue-100'
                        }` }
                    >
                      { getNotificationIcon(notification.type) }
                    </div>
                  </div>

                  {/* Content */ }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className={ `text-lg ${notification.is_read ? 'text-gray-700' : 'text-gray-900 font-bold'
                            }` }
                        >
                          { notification.title }
                        </h3>
                        { isUrgent && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white border-2 border-red-700 shadow-lg animate-pulse ring-2 ring-red-400" title="مشروع عاجل">
                            <AlertCircle className="w-4 h-4" />
                            عاجل
                          </span>
                        ) }
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        { !notification.is_read && (
                          <span className="flex-shrink-0 inline-block w-3 h-3 bg-sky-500 rounded-full animate-pulse"></span>
                        ) }
                        { renderPriorityBadge(notification.priority) }
                      </div>
                    </div>
                    { renderNotificationBody(notification, isWarehouseManager) }
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-500">{ formatDate(notification.created_at) }</p>
                      </div>
                      <div className="flex items-center gap-3">
                        { notification.type === 'media_completed' && (
                          <>
                            { notification.is_accepted || notification.reply_status === 'accepted' ? (
                              <button
                                disabled
                                className="bg-green-600 text-white text-sm font-medium flex items-center gap-1 px-4 py-2 rounded-lg opacity-70 cursor-not-allowed"
                                title="تم قبول المونتاج"
                              >
                                <CheckCircle className="w-4 h-4" />
                                تم القبول
                              </button>
                            ) : notification.is_replied || notification.reply_status === 'rejected' ? (
                              <button
                                disabled
                                className="bg-red-600 text-white text-sm font-medium flex items-center gap-1 px-4 py-2 rounded-lg opacity-70 cursor-not-allowed"
                                title="تم الرد على الإشعار"
                              >
                                <MessageSquare className="w-4 h-4" />
                                تم الرد
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={ () => handleOpenAcceptModal(notification) }
                                  disabled={ accepting }
                                  className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center gap-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="قبول المونتاج"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  قبول
                                </button>
                                <button
                                  onClick={ () => handleOpenReplyModal(notification) }
                                  className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium flex items-center gap-1 px-4 py-2 rounded-lg transition-colors"
                                  title="رد على الإشعار"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  رد
                                </button>
                              </>
                            ) }
                          </>
                        ) }
                        {/* ✅ إخفاء زر عرض المشروع للمنتج */ }
                        { (notification.related_project_id || notification.metadata?.project_id) && !isWarehouseManager && !isMontageProducer && (
                          <Link
                            to={
                              notification.type === 'warehouse_supply_started' || notification.type === 'warehouse_supply_confirmed' || notification.type === 'project_has_deficit'
                                ? `/project-management/projects/${notification.related_project_id || notification.metadata?.project_id}/supply`
                                : `/project-management/projects/${notification.related_project_id || notification.metadata?.project_id}`
                            }
                            onClick={ () => handleMarkAsRead(notification.id) }
                            className="text-sky-600 hover:text-sky-700 text-sm font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors"
                          >
                            { notification.type === 'warehouse_supply_started' || notification.type === 'warehouse_supply_confirmed' || notification.type === 'project_has_deficit'
                              ? 'عرض التوريد'
                              : 'عرض المشروع' }
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        ) }
                        { notification.type === 'warehouse_low_stock' && (
                          <Link
                            to="/warehouse"
                            onClick={ () => handleMarkAsRead(notification.id) }
                            className="text-sky-600 hover:text-sky-700 text-sm font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors"
                          >
                            عرض المخزن
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        ) }
                        { !notification.is_read && (
                          <button
                            onClick={ () => handleMarkAsRead(notification.id) }
                            className="text-gray-600 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="تحديد كمقروء"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })
          ) }
        </div>
      </div>

      {/* Load More (if pagination is implemented) */ }
      {/* <div className="flex justify-center mt-6">
        <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-8 py-3 rounded-xl font-medium transition-colors">
          تحميل المزيد
        </button>
      </div> */}

      {/* Reply Modal */ }
      { replyModalOpen && selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">رد على إشعار المونتاج</h2>
                <button
                  onClick={ handleCloseReplyModal }
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">الإشعار:</p>
                <p className="font-semibold text-gray-800">{ selectedNotification.title }</p>
                <p className="text-sm text-gray-600 mt-2">{ selectedNotification.message }</p>
              </div>

              <form onSubmit={ handleReplySubmit } className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الرسالة <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={ replyForm.message }
                    onChange={ (e) => setReplyForm({ ...replyForm, message: e.target.value }) }
                    rows={ 4 }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="أدخل الرسالة التي تريد إرسالها لقسم الإعلام..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    سبب الرفض <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={ replyForm.rejection_reason }
                    onChange={ (e) => setReplyForm({ ...replyForm, rejection_reason: e.target.value }) }
                    rows={ 4 }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="أدخل سبب رفض المونتاج..."
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={ handleCloseReplyModal }
                    className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    disabled={ replying }
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={ replying }
                  >
                    { replying ? 'جاري الإرسال...' : 'إرسال الرد' }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) }

      {/* Accept Modal */ }
      { acceptModalOpen && notificationToAccept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              {/* Header */ }
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">قبول المونتاج</h2>
                    <p className="text-sm text-gray-500 mt-1">تأكيد قبول المونتاج</p>
                  </div>
                </div>
                <button
                  onClick={ handleCloseAcceptModal }
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={ accepting }
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */ }
              <div className="mb-6">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 mb-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">⚠️ ملاحظة مهمة:</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    سيتم نقل المشروع إلى حالة <span className="font-bold text-green-700">"وصل للمتبرع"</span> تلقائياً بعد قبول المونتاج.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-2">المشروع:</p>
                  <p className="font-semibold text-gray-800">
                    { notificationToAccept.metadata?.project_name || 'مشروع بدون اسم' }
                  </p>
                  { getProjectCode(notificationToAccept.metadata, null) && (
                    <p className="text-sm text-gray-500 mt-1">
                      كود المشروع: { getProjectCode(notificationToAccept.metadata) }
                    </p>
                  ) }
                </div>
              </div>

              {/* Actions */ }
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={ handleCloseAcceptModal }
                  className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                  disabled={ accepting }
                >
                  إلغاء
                </button>
                <button
                  onClick={ handleAccept }
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={ accepting }
                >
                  { accepting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>جاري القبول...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>تأكيد القبول</span>
                    </>
                  ) }
                </button>
              </div>
            </div>
          </div>
        </div>
      ) }
    </div>
  );
};

export default Notifications;

