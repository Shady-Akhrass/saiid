import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import apiClient from '../utils/axiosConfig';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    // ✅ Track if preloadNotifications is already running to prevent duplicate calls
    const preloadNotificationsRef = useRef(false);

    // Form availability states for all 4 forms
    const [formsAvailability, setFormsAvailability] = useState({
        orphan: true,
        aid: true,
        patient: true,
        shelter: true
    });

    useEffect(() => {
        const localStorageUser = localStorage.getItem('user');
        const sessionStorageUser = sessionStorage.getItem('user');
        const localStorageToken = localStorage.getItem('token');
        const sessionStorageToken = sessionStorage.getItem('token');

        // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
        // يمكن إعادة تفعيله عند الحاجة للتطوير

        let storedUser = null;

        // ✅ محاولة تحميل المستخدم من localStorage أولاً
        if (localStorageUser) {
            try {
                storedUser = JSON.parse(localStorageUser);
                // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
            } catch (error) {
                console.error('❌ Error parsing localStorage user:', error);
                localStorage.removeItem('user'); // حذف البيانات التالفة
            }
        }

        // ✅ إذا لم يوجد في localStorage، جرب sessionStorage
        if (!storedUser && sessionStorageUser) {
            try {
                storedUser = JSON.parse(sessionStorageUser);
                // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
            } catch (error) {
                console.error('❌ Error parsing sessionStorage user:', error);
                sessionStorage.removeItem('user'); // حذف البيانات التالفة
            }
        }

        // ✅ التحقق من وجود بيانات المستخدم الأساسية
        if (storedUser) {
            // ✅ التحقق من وجود id على الأقل
            if (storedUser.id || storedUser.user_id) {
                setUser(storedUser);
                setIsAuthenticated(true);

                // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول

                // ✅ تحميل الإشعارات مباشرة بعد تحميل المستخدم
                preloadNotifications();
            } else {
                console.warn('⚠️ Stored user missing id, clearing storage');
                localStorage.removeItem('user');
                sessionStorage.removeItem('user');
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
            }
        } else {
            if (import.meta.env.DEV) {
                console.log('ℹ️ No user found in storage');
            }
        }

        // Load form availability states from localStorage
        const storedFormsAvailability = localStorage.getItem('formsAvailability');
        if (storedFormsAvailability) {
            try {
                setFormsAvailability(JSON.parse(storedFormsAvailability));
            } catch (error) {
                console.error('Error parsing formsAvailability:', error);
            }
        }

        setLoading(false);
    }, []);

    const login = (data, remember) => {
        const { user, token } = data;

        // ✅ التأكد من حفظ user بشكل كامل
        // ⚠️ مهم: التأكد من أن user object يحتوي على role
        if (!user) {
            console.error('❌ ERROR: User object is missing!');
            return;
        }

        if (!token) {
            console.error('❌ ERROR: Token is missing!');
            return;
        }

        // ✅ التأكد من وجود id في user object
        if (!user.id && !user.user_id) {
            console.error('❌ ERROR: User object missing id!', user);
            return;
        }

        setUser(user);

        // ✅ حفظ user في Storage بشكل كامل
        try {
            if (remember) {
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('token', token);
            } else {
                sessionStorage.setItem('user', JSON.stringify(user));
                sessionStorage.setItem('token', token);
            }
        } catch (error) {
            console.error('❌ Error saving user to storage:', error);
        }

        setIsAuthenticated(true);

        // ✅ تحميل الإشعارات مباشرة بعد تسجيل الدخول
        preloadNotifications();
    };

    // ✅ دالة تحميل الإشعارات مسبقاً
    const preloadNotifications = async () => {
        // ✅ Prevent duplicate calls
        if (preloadNotificationsRef.current) {
            return;
        }

        try {
            preloadNotificationsRef.current = true;

            // التحقق من وجود token
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) {
                preloadNotificationsRef.current = false;
                return;
            }

            // التحقق من وجود cache حديث (أقل من 30 ثانية)
            const cacheKey = 'notifications_cache';
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
                try {
                    const cache = JSON.parse(cachedData);
                    const now = Date.now();
                    if (cache.notifications && cache.timestamp && (now - cache.timestamp) < (cache.maxAge || 30000)) {
                        preloadNotificationsRef.current = false;
                        return; // البيانات موجودة وحديثة، لا حاجة لإعادة التحميل
                    }
                } catch (cacheError) {
                    // إذا فشل parsing الـ cache، نتابع لجلب البيانات من API
                }
            }

            // جلب جميع الإشعارات وحفظها في localStorage
            const response = await apiClient.get('/notifications', {
                params: { perPage: 100 },
                timeout: 5000
            });

            if (response.data.success) {
                const notifications =
                    response.data.data ||
                    response.data.notifications ||
                    response.data ||
                    [];

                // حفظ الإشعارات في localStorage مع timestamp
                const cacheData = {
                    notifications: Array.isArray(notifications) ? notifications : [],
                    timestamp: Date.now(),
                    maxAge: 30000 // 30 ثانية
                };

                localStorage.setItem(cacheKey, JSON.stringify(cacheData));

                if (import.meta.env.DEV) {
                    console.log('✅ Preloaded notifications in AuthContext:', notifications.length);
                }
            }
        } catch (error) {
            // ✅ Handle 429 errors gracefully - don't retry immediately
            if (error.response?.status === 429) {
                // Rate limited - wait before allowing next call
                setTimeout(() => {
                    preloadNotificationsRef.current = false;
                }, 5000); // Wait 5 seconds before allowing next call
                return;
            }

            // ✅ تجاهل جميع أخطاء الاتصال والـ timeout في preloading - لا نريد أن تؤثر على تجربة المستخدم
            // ✅ لا نطبع أي شيء لأخطاء الاتصال لأنها طبيعية عندما يكون الـ Backend غير متاح
            if (import.meta.env.DEV && !error.isConnectionError && !error.isTimeoutError && !error.isCorsError) {
                console.warn('⚠️ Failed to preload notifications in AuthContext:', error);
            }
        } finally {
            // ✅ Reset flag after a delay to prevent immediate retries
            setTimeout(() => {
                preloadNotificationsRef.current = false;
            }, 1000);
        }
    };

    const logout = async () => {
        try {
            // ✅ إرسال طلب logout قبل حذف الـ Token
            await apiClient.post('/logout').catch(() => {
                // تجاهل أي خطأ من طلب logout بصمت تام
                // الـ 401 طبيعي عندما يكون Token منتهي
            });
        } catch (error) {
            // تجاهل جميع أخطاء logout بصمت
        } finally {
            // ✅ حذف البيانات بعد إرسال الطلب
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('token');
            setIsAuthenticated(false);
        }
    };

    const updateUser = (newUserData) => {
        setUser(prevUser => {
            const updatedUser = { ...prevUser, ...newUserData };
            const storage = localStorage.getItem('user') ? localStorage : sessionStorage;
            storage.setItem('user', JSON.stringify(updatedUser));
            return updatedUser;
        });
    };

    // Toggle individual form availability
    const toggleFormAvailability = (formName, available) => {
        setFormsAvailability(prev => {
            const updated = { ...prev, [formName]: available };
            localStorage.setItem('formsAvailability', JSON.stringify(updated));
            return updated;
        });
    };

    // Toggle all forms at once
    const toggleAllForms = (available) => {
        const allForms = {
            orphan: available,
            aid: available,
            patient: available,
            shelter: available
        };
        setFormsAvailability(allForms);
        localStorage.setItem('formsAvailability', JSON.stringify(allForms));
    };

    return (
        <AuthContext.Provider value={ {
            user,
            isAuthenticated,
            login,
            logout,
            loading,
            updateUser,
            formsAvailability,
            toggleFormAvailability,
            toggleAllForms
        } }>
            { children }
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    // ✅ في حالة عدم وجود AuthProvider، نرجع قيمة افتراضية بدلاً من undefined
    if (!context) {
        if (import.meta.env.DEV) {
            console.warn('⚠️ useAuth called outside AuthProvider. Make sure AuthProvider wraps the app.');
        }
        // ✅ إرجاع قيمة افتراضية لتجنب errors
        return {
            user: null,
            isAuthenticated: false,
            loading: true,
            login: () => { },
            logout: () => { },
            updateUser: () => { },
            formsAvailability: {
                orphan: true,
                aid: true,
                patient: true,
                shelter: true
            },
            toggleFormAvailability: () => { },
            toggleAllForms: () => { }
        };
    }

    return context;
};