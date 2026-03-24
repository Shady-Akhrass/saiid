// Nav.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Link } from 'react-router-dom';
import useFetchUserData from '../../hooks/fetchUser.jsx';
import { Menu, User, LogOut, Settings, Bell, X, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import apiClient from '../../utils/axiosConfig';
import axios from 'axios';

const Nav = ({ toggleSidebar }) => {
    const { user, logout } = useAuth();
    const { name, loading, fetchData } = useFetchUserData();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    const [hasNewNotification, setHasNewNotification] = useState(false);
    const [isBellAnimating, setIsBellAnimating] = useState(false);
    const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState(false);
    const [recentNotifications, setRecentNotifications] = useState([]);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const dropdownRef = useRef(null);
    const notificationsDropdownRef = useRef(null);
    const previousCountRef = useRef(0);
    const audioRef = useRef(null);
    // ✅ Track if fetchUnreadCount is already running to prevent duplicate calls
    const fetchingUnreadCountRef = useRef(false);

    const toggleDropdown = () => {
        if (!isDropdownOpen) {
            setIsDropdownOpen(true);
            setTimeout(() => setIsAnimating(true), 10);
        } else {
            setIsAnimating(false);
            setTimeout(() => setIsDropdownOpen(false), 300);
        }
    };

    const handleLogout = () => {
        logout();
        setIsDropdownOpen(false);
    };

    useEffect(() => {
        if (user?.id) {
            fetchData(user.id);
        }
    }, [user?.id, fetchData]);

    // جلب عدد الإشعارات غير المقروءة وتشغيل الصوت عند وصول إشعار جديد
    useEffect(() => {
        // ✅ التأكد من وجود مستخدم مسجل دخول قبل جلب الإشعارات
        if (!user || !user.id) {
            setUnreadNotificationsCount(0);
            return;
        }

        const fetchUnreadCount = async () => {
            // ✅ التحقق مرة أخرى من وجود المستخدم
            if (!user || !user.id) {
                return;
            }

            // ✅ Prevent duplicate calls
            if (fetchingUnreadCountRef.current) {
                return;
            }

            try {
                fetchingUnreadCountRef.current = true;

                const response = await apiClient.get('/notifications/unread-count', {
                    timeout: 5000 // timeout 5 ثواني
                });

                if (response.data && response.data.success) {
                    // ✅ دعم بنيات مختلفة للـ response
                    // استخدام ?? بدلاً من || لأن 0 هو falsy value
                    const newCount =
                        response.data.unread_count ??
                        response.data.count ??
                        response.data.data?.count ??
                        0;

                    const previousCount = previousCountRef.current;

                    // إذا كان هناك إشعار جديد (العدد زاد)
                    if (newCount > previousCount && previousCount > 0) {
                        setHasNewNotification(true);
                        setIsBellAnimating(true);

                        // تشغيل الصوت باستخدام Web Audio API
                        try {
                            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                            const oscillator = audioContext.createOscillator();
                            const gainNode = audioContext.createGain();

                            oscillator.connect(gainNode);
                            gainNode.connect(audioContext.destination);

                            oscillator.frequency.value = 800;
                            oscillator.type = 'sine';

                            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

                            oscillator.start(audioContext.currentTime);
                            oscillator.stop(audioContext.currentTime + 0.3);
                        } catch (audioError) {
                            // تجاهل أخطاء الصوت بصمت
                            if (import.meta.env.DEV) {
                                console.log('Audio error:', audioError);
                            }
                        }

                        // إزالة التأثير بعد 3 ثوان
                        setTimeout(() => {
                            setHasNewNotification(false);
                            setIsBellAnimating(false);
                        }, 3000);
                    }

                    setUnreadNotificationsCount(newCount);
                    previousCountRef.current = newCount;
                } else {
                    // إذا كان success: false، نعرض 0
                    setUnreadNotificationsCount(0);
                    if (import.meta.env.DEV) {
                        console.warn('⚠️ API returned success: false', response.data);
                    }
                }
            } catch (error) {
                // ✅ تجاهل CanceledError من Request Deduplication
                if (axios.isCancel && axios.isCancel(error) || error.isCanceled || error.code === 'ERR_CANCELED') {
                    // لا نعرض أي شيء للطلبات الملغاة
                    return;
                }
                
                // ✅ تحسين معالجة الأخطاء
                // تجاهل أخطاء الاتصال و timeout لتجنب spam في Console
                if (error.isConnectionError || error.isTimeoutError || error.code === 'ECONNABORTED') {
                    // لا نعرض أي شيء في حالة أخطاء الاتصال
                    setUnreadNotificationsCount(0);
                    return;
                }

                // ✅ معالجة أخطاء المصادقة (401, 403)
                if (error.response?.status === 401 || error.response?.status === 403) {
                    // المستخدم غير مصرح له - لا نعرض أي شيء
                    setUnreadNotificationsCount(0);
                    if (import.meta.env.DEV) {
                        console.warn('⚠️ Unauthorized to fetch notifications');
                    }
                    return;
                }

                // ✅ معالجة أخطاء أخرى (404, 500, etc.)
                // تجاهل 404 و 500 بصمت (مشكلة في Backend)
                if (error.response?.status === 404 || error.response?.status === 500) {
                    // لا نعرض 404 أو 500 (مشكلة في Backend) لتجنب spam
                    setUnreadNotificationsCount(0);
                    return;
                }

                // ✅ تسجيل الأخطاء الأخرى فقط في development
                if (import.meta.env.DEV && error.response?.status !== 404 && error.response?.status !== 500) {
                    console.warn('⚠️ Error fetching unread notifications count:', {
                        status: error.response?.status,
                        message: error.response?.data?.message || error.message,
                    });
                }

                setUnreadNotificationsCount(0);
            } finally {
                // ✅ Reset flag after a delay to prevent immediate retries
                setTimeout(() => {
                    fetchingUnreadCountRef.current = false;
                }, 1000);
            }
        };

        // جلب العدد عند تحميل الصفحة (مع debounce)
        const timeoutId = setTimeout(() => {
            fetchUnreadCount();
        }, 500); // ✅ Delay initial call to avoid race conditions

        // ✅ تحديث العدد كل 60 ثانية (تقليل عدد الطلبات لتجنب 429 errors)
        const interval = setInterval(() => {
            if (!fetchingUnreadCountRef.current) {
                fetchUnreadCount();
            }
        }, 60000); // ✅ زيادة من 30 إلى 60 ثانية

        return () => {
            clearTimeout(timeoutId);
            clearInterval(interval);
        };
    }, [user]); // ✅ إضافة user كـ dependency

    // جلب آخر 3 إشعارات
    const fetchRecentNotifications = async () => {
        let loadingTimeout;

        try {
            setLoadingNotifications(true);

            // إيقاف حالة التحميل بعد timeout قصير حتى لو فشل الطلب
            loadingTimeout = setTimeout(() => {
                setLoadingNotifications(false);
                setRecentNotifications([]);
            }, 3000); // timeout 3 ثواني كحد أقصى للتحميل

            const response = await apiClient.get('/notifications', {
                params: { perPage: 3, page: 1 },
                timeout: 3000 // timeout 3 ثواني للطلب
            });

            clearTimeout(loadingTimeout);

            if (response.data.success) {
                const notifications = response.data.data || response.data.notifications || response.data || [];
                setRecentNotifications(Array.isArray(notifications) ? notifications.slice(0, 3) : []);
            } else {
                setRecentNotifications([]);
            }
        } catch (error) {
            if (loadingTimeout) clearTimeout(loadingTimeout);
            // في حالة الخطأ أو Timeout، نعرض قائمة فارغة بدلاً من البقاء في حالة التحميل
            setRecentNotifications([]);

            // ✅ تجاهل أخطاء الاتصال و timeout و 500 بصمت
            if (error.isConnectionError || error.isTimeoutError || error.code === 'ECONNABORTED') {
                return;
            }

            // ✅ تجاهل خطأ 500 (مشكلة في Backend) بصمت
            if (error.response?.status === 500) {
                return;
            }

            // ✅ تسجيل الأخطاء الأخرى فقط في development
            if (import.meta.env.DEV && error.response?.status !== 404 && error.response?.status !== 500) {
                console.error('Error fetching recent notifications:', error);
            }
        } finally {
            // التأكد من إيقاف حالة التحميل
            if (loadingTimeout) clearTimeout(loadingTimeout);
            setLoadingNotifications(false);
        }
    };

    // فتح/إغلاق نافذة الإشعارات
    const toggleNotificationsDropdown = () => {
        if (!isNotificationsDropdownOpen) {
            setIsNotificationsDropdownOpen(true);
            // إذا كانت الإشعارات موجودة بالفعل، لا نعيد جلبها
            if (recentNotifications.length === 0) {
                fetchRecentNotifications();
            }
        } else {
            setIsNotificationsDropdownOpen(false);
        }
    };

    // تنسيق التاريخ
    const formatDate = (date) => {
        if (!date) return '';
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

        return new Intl.DateTimeFormat('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(dateObj);
    };

    // الحصول على أيقونة الإشعار
    const getNotificationIcon = (type) => {
        const icons = {
            'project_created': '📋',
            'project_assigned': '👥',
            'project_status_changed': '🔄',
            'shelter_selected': '🏠',
            'media_updated': '🎬',
            'media_completed': '✅',
            'media_rejected': '❌',
            'daily_phase': '📅',
        };
        return icons[type] || '🔔';
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsAnimating(false);
                setTimeout(() => setIsDropdownOpen(false), 300);
            }
            if (notificationsDropdownRef.current && !notificationsDropdownRef.current.contains(event.target)) {
                setIsNotificationsDropdownOpen(false);
            }
        };

        if (isDropdownOpen || isNotificationsDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen, isNotificationsDropdownOpen]);

    return (
        <nav className="fixed left-0 top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-sky-100 shadow-sm">
            <div className="relative">
                <div className="px-4 lg:px-6 py-3">
                    <div className="flex items-center justify-between">
                        {/* Left side - Menu button */ }
                        <div className="flex items-center gap-4">
                            <button
                                onClick={ toggleSidebar }
                                className="group relative p-2.5 rounded-xl bg-gradient-to-br from-sky-50 to-orange-50 hover:from-sky-100 hover:to-orange-100 transition-all duration-300 hover:scale-105 active:scale-95"
                                dir="rtl"
                            >
                                <Menu className="w-5 h-5 text-sky-600 group-hover:rotate-180 transition-transform duration-500" />
                                <span className="sr-only">تبديل الشريط الجانبي</span>
                            </button>

                            {/* Logo or Brand Name */ }
                            <div className="hidden lg:flex items-center">
                                <h1 className="text-xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
                                    لوحة التحكم
                                </h1>
                            </div>
                        </div>

                        {/* Right side - Notifications Bell and User menu */ }
                        <div className="flex items-center gap-3">
                            {/* Notifications Bell with Dropdown */ }
                            <div className="relative" ref={ notificationsDropdownRef }>
                                <button
                                    onClick={ toggleNotificationsDropdown }
                                    className="relative p-2.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group"
                                >
                                    <div className={ `relative ${isBellAnimating ? 'animate-bounce' : ''} ${hasNewNotification ? 'text-red-500' : 'text-gray-600 group-hover:text-sky-600'}` }>
                                        <Bell className={ `w-6 h-6 transition-all duration-300 ${hasNewNotification ? 'animate-pulse' : ''}` } />
                                        { unreadNotificationsCount > 0 && (
                                            <span className={ `absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1 ${hasNewNotification ? 'animate-ping' : ''}` }>
                                                { unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount }
                                            </span>
                                        ) }
                                    </div>
                                </button>

                                {/* Notifications Dropdown */ }
                                { isNotificationsDropdownOpen && (
                                    <div className="absolute left-0 mt-2 w-80 origin-top-left transition-all duration-300 opacity-100 transform translate-y-0 scale-100 z-50">
                                        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-sky-100 overflow-hidden">
                                            {/* Header */ }
                                            <div className="bg-gradient-to-br from-sky-50 to-orange-50 px-4 py-3 border-b border-sky-100 flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-gray-800">آخر الإشعارات</h3>
                                                <button
                                                    onClick={ () => setIsNotificationsDropdownOpen(false) }
                                                    className="p-1 rounded-lg hover:bg-white/50 transition-colors"
                                                >
                                                    <X className="w-4 h-4 text-gray-500" />
                                                </button>
                                            </div>

                                            {/* Notifications List */ }
                                            <div className="max-h-96 overflow-y-auto">
                                                { loadingNotifications ? (
                                                    <div className="p-6 text-center">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600 mx-auto"></div>
                                                        <p className="text-xs text-gray-500 mt-2">جاري التحميل...</p>
                                                    </div>
                                                ) : recentNotifications.length === 0 ? (
                                                    <div className="p-6 text-center">
                                                        <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                                        <p className="text-xs text-gray-500">لا توجد إشعارات</p>
                                                    </div>
                                                ) : (
                                                    <div className="divide-y divide-gray-100">
                                                        { recentNotifications.map((notification) => {
                                                            const type = notification?.notification_type || notification?.type || '';
                                                            return (
                                                                <Link
                                                                    key={ notification.id }
                                                                    to="/project-management/notifications"
                                                                    onClick={ () => setIsNotificationsDropdownOpen(false) }
                                                                    className={ `block p-4 hover:bg-sky-50 transition-colors ${!notification.is_read ? 'bg-sky-50/50' : ''}` }
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <div className={ `flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${notification.is_read ? 'bg-gray-100' : 'bg-gradient-to-br from-sky-100 to-blue-100'}` }>
                                                                            { getNotificationIcon(type) }
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                                                <h4 className={ `text-sm font-semibold truncate ${notification.is_read ? 'text-gray-700' : 'text-gray-900'}` }>
                                                                                    { notification.title }
                                                                                </h4>
                                                                                { !notification.is_read && (
                                                                                    <span className="flex-shrink-0 w-2 h-2 bg-sky-500 rounded-full mt-1.5"></span>
                                                                                ) }
                                                                            </div>
                                                                            <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                                                                { notification.message }
                                                                            </p>
                                                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                                                <CalendarIcon className="w-3 h-3" />
                                                                                <span>{ formatDate(notification.created_at) }</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </Link>
                                                            );
                                                        }) }
                                                    </div>
                                                ) }
                                            </div>

                                            {/* Footer */ }
                                            <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                                                <Link
                                                    to="/project-management/notifications"
                                                    onClick={ () => setIsNotificationsDropdownOpen(false) }
                                                    className="flex items-center justify-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
                                                >
                                                    <span>عرض جميع الإشعارات</span>
                                                    <ArrowRight className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ) }
                            </div>

                            {/* User menu */ }
                            <div className="relative" ref={ dropdownRef }>
                                <button
                                    type="button"
                                    className={ `group flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-300
                                        ${isDropdownOpen
                                            ? 'bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-lg shadow-sky-200 scale-105'
                                            : 'bg-gradient-to-br from-sky-50 to-orange-50 hover:from-sky-100 hover:to-orange-100 text-gray-700 hover:scale-105'
                                        }` }
                                    onClick={ toggleDropdown }
                                >
                                    {/* User Avatar */ }
                                    <div className={ `p-2 rounded-xl transition-all duration-300
                                        ${isDropdownOpen
                                            ? 'bg-white/20'
                                            : 'bg-gradient-to-br from-sky-200 to-orange-200'
                                        }` }>
                                        <User className="w-4 h-4" />
                                    </div>

                                    {/* User Name */ }
                                    <span className="font-medium">
                                        { loading ? (
                                            <div className="w-20 h-4 bg-sky-200 animate-pulse rounded-md"></div>
                                        ) : (
                                            name || 'المستخدم'
                                        ) }
                                    </span>

                                    {/* Dropdown Arrow */ }
                                    <svg
                                        className={ `w-4 h-4 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}` }
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Dropdown Menu */ }
                                { isDropdownOpen && (
                                    <div
                                        className={ `absolute left-0 mt-2 w-56 origin-top-left transition-all duration-300
                                            ${isAnimating
                                                ? 'opacity-100 transform translate-y-0 scale-100'
                                                : 'opacity-0 transform -translate-y-2 scale-95'
                                            }` }
                                    >
                                        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-sky-100 overflow-hidden">
                                            {/* User info header */ }
                                            <div className="bg-gradient-to-br from-sky-50 to-orange-50 px-4 py-3 border-b border-sky-100">
                                                <p className="text-xs text-gray-500">مسجل الدخول كـ</p>
                                                <p className="text-sm font-medium text-gray-800 truncate">{ name || 'المستخدم' }</p>
                                            </div>

                                            {/* Menu Items */ }
                                            <div className="p-2">
                                                <Link
                                                    to={ `/edit/${user?.id}` }
                                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-sky-50 hover:text-sky-600 transition-all duration-300 group"
                                                >
                                                    <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
                                                    <span className="font-medium">الملف الشخصي</span>
                                                </Link>

                                                <div className="my-1 border-t border-gray-100"></div>

                                                <Link
                                                    to="/logout"
                                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-300 group"
                                                >
                                                    <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                                                    <span className="font-medium">تسجيل الخروج</span>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ) }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default React.memo(Nav);