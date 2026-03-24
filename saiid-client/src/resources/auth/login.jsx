import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ViteLogo from '../../assets/images/logo.jpg';
import apiClient from '../../utils/axiosConfig';

function Login() {
    const navigate = useNavigate();
    const { login, isAuthenticated, user } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [errors, setErrors] = useState({ email: '', password: '', general: '' });
    const [touched, setTouched] = useState({ email: false, password: false });

    // دالة لتحديد المسار بناءً على دور المستخدم
    const getRedirectPath = (userData) => {
        if (!userData) return '/statistics/orphans-statistics';

        const userRole = userData?.role?.toLowerCase?.() ||
            userData?.userRole?.toLowerCase?.() ||
            userData?.user_role?.toLowerCase?.() ||
            userData?.role_name?.toLowerCase?.() ||
            userData?.role || '';

        const isAdmin = userRole === 'admin' ||
            userRole === 'administrator' ||
            userRole === 'مدير' ||
            userRole === 'مدير عام';

        const isProjectManager = userRole === 'project_manager' ||
            userRole === 'projectmanager' ||
            userRole === 'مدير مشاريع';

        const isMediaManager = userRole === 'media_manager' ||
            userRole === 'mediamanager' ||
            userRole === 'مدير إعلام';

        const isMontageProducer = userRole === 'montage_producer' ||
            userRole === 'montageproducer' ||
            userRole === 'ممنتج مونتاج';

        const isWarehouseManager = userRole === 'warehouse_manager' ||
            userRole === 'warehousemanager' ||
            userRole === 'مدير مخزن' ||
            userRole === 'مدير المخزن';

        const isSupervision = userRole === 'supervision' ||
            userRole === 'إشراف' ||
            userRole === 'supervision_manager';

        // توجيه الإدارة العليا (supervision) إلى لوحة التحكم
        if (isSupervision) {
            return '/supervision/dashboard';
        }

        // توجيه مدير المخزن إلى لوحة تحكم المخزن
        if (isWarehouseManager) {
            return '/warehouse/dashboard';
        }

        // توجيه ممنتج المونتاج إلى صفحة مشاريعه
        if (isMontageProducer) {
            return '/media-management/my-projects';
        }

        // توجيه مدير الإعلام إلى لوحة تحكم قسم الإعلام
        if (isMediaManager) {
            return '/media-management/dashboard';
        }

        // توجيه المدير ومدير المشاريع إلى صفحة المشاريع
        if (isAdmin || isProjectManager) {
            return '/project-management/projects';
        }

        // باقي المستخدمين إلى الصفحة الافتراضية
        return '/statistics/orphans-statistics';
    };

    useEffect(() => {
        document.title = 'صفحة تسجيل الدخول';
    }, []);

    if (isAuthenticated) {
        const redirectPath = getRedirectPath(user);
        return <Navigate to={ redirectPath } />;
    }

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleEmailChange = (e) => {
        const value = e.target.value;
        setEmail(value);
        if (touched.email) {
            if (!value) {
                setErrors(prev => ({ ...prev, email: 'البريد الإلكتروني مطلوب' }));
            } else if (!validateEmail(value)) {
                setErrors(prev => ({ ...prev, email: 'البريد الإلكتروني غير صحيح' }));
            } else {
                setErrors(prev => ({ ...prev, email: '' }));
            }
        }
    };

    const handlePasswordChange = (e) => {
        const value = e.target.value;
        setPassword(value);
        if (touched.password) {
            if (!value) {
                setErrors(prev => ({ ...prev, password: 'كلمة المرور مطلوبة' }));
            } else if (value.length < 6) {
                setErrors(prev => ({ ...prev, password: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }));
            } else {
                setErrors(prev => ({ ...prev, password: '' }));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // ✅ منع إعادة التقديم المتعددة
        if (isLoading) {
            return;
        }

        setErrors(prev => ({ ...prev, general: '' }));

        // Validate before submitting
        if (!validateEmail(email) || password.length < 6) {
            setTouched({ email: true, password: true });
            return;
        }

        setIsLoading(true);

        try {
            // ✅ التأكد من أن البيانات في التنسيق الصحيح
            const loginData = {
                email: email.trim(),
                password: password,
                // ✅ تحويل remember إلى boolean إذا لزم الأمر
                remember: Boolean(remember)
            };

            const response = await apiClient.post('/login', loginData);

            const data = response.data;

            if (data.user && data.token) {
                // ✅ حفظ Token و User بشكل صريح في Storage
                if (remember) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                } else {
                    sessionStorage.setItem('token', data.token);
                    sessionStorage.setItem('user', JSON.stringify(data.user));
                }

                // ✅ استدعاء login من AuthContext (يحتوي على منطق إضافي)
                login(data, remember);

                // ✅ تحديد المسار بناءً على دور المستخدم
                const redirectPath = getRedirectPath(data.user);
                navigate(redirectPath);
            } else {
                setErrors(prev => ({
                    ...prev,
                    general: 'استجابة غير صحيحة من الخادم'
                }));
            }
        } catch (error) {
            // ✅ تجاهل أخطاء الإلغاء (CanceledError) - هذه أخطاء طبيعية
            if (error.name === 'CanceledError' ||
                error.code === 'ERR_CANCELED' ||
                error.message?.includes('canceled')) {
                if (import.meta.env.DEV) {
                    console.log('ℹ️ Login request was canceled (normal behavior)');
                }
                return; // لا نفعل شيء عند إلغاء الطلب
            }

            // ✅ تسجيل الخطأ بشكل مفصل في Development Mode
            if (import.meta.env.DEV) {
                console.error('🔴 Login error:', {
                    message: error.message,
                    code: error.code,
                    status: error.response?.status,
                    data: error.response?.data,
                    isConnectionError: error.isConnectionError,
                    isCorsError: error.isCorsError,
                    isTimeoutError: error.isTimeoutError,
                    userMessage: error.userMessage,
                });
            }

            // Handle error response from server
            if (error.response) {
                const status = error.response.status;
                const errorData = error.response.data;
                const errorMessage = errorData?.message || error.userMessage;
                
                // ✅ معالجة خطأ 422 (Validation Error) بشكل خاص
                if (status === 422) {
                    let validationMessage = errorMessage || 'البيانات المدخلة غير صحيحة';
                    
                    // ✅ إذا كان هناك أخطاء تحقق مفصلة من Backend، نعرضها
                    if (errorData?.errors) {
                        const errorFields = Object.keys(errorData.errors);
                        const errorMessages = errorFields.map(field => {
                            const fieldErrors = errorData.errors[field];
                            if (Array.isArray(fieldErrors)) {
                                return fieldErrors[0];
                            }
                            return fieldErrors;
                        });
                        
                        if (errorMessages.length > 0) {
                            validationMessage = errorMessages.join('، ');
                        }
                    }
                    
                    setErrors(prev => ({
                        ...prev,
                        general: validationMessage,
                        // ✅ عرض أخطاء الحقول المحددة إذا كانت موجودة
                        email: errorData?.errors?.email?.[0] || prev.email,
                        password: errorData?.errors?.password?.[0] || prev.password,
                    }));
                } else if (status === 401) {
                    // ✅ عرض رسالة خطأ واحدة فقط (لا نعرض رسائل متعددة)
                    setErrors(prev => {
                        // إذا كانت هناك رسالة خطأ موجودة بالفعل، لا نستبدلها
                        if (prev.general && prev.general.includes('البريد الإلكتروني أو كلمة المرور')) {
                            return prev;
                        }
                        return {
                            ...prev,
                            general: errorMessage || 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
                        };
                    });
                } else if (status === 405) {
                    // ✅ 405 = السيرفر يرفض POST على /api/login — إعداد Backend أو Nginx
                    setErrors(prev => ({
                        ...prev,
                        general: 'الخادم لا يقبل طلب تسجيل الدخول (405). تأكد من أن الـ Backend يسمح بـ POST على مسار تسجيل الدخول (مثلاً POST /api/login أو POST /login).'
                    }));
                } else {
                    setErrors(prev => ({
                        ...prev,
                        general: errorMessage || `حدث خطأ في الخادم (${status}). يرجى المحاولة مرة أخرى`
                    }));
                }
            } else if (error.request) {
                // ✅ معالجة أخطاء الاتصال و CORS
                if (error.isCorsError) {
                    setErrors(prev => ({
                        ...prev,
                        general: 'خطأ CORS: لا يمكن الاتصال بالخادم. يرجى التحقق من إعدادات proxy أو CORS في Backend.'
                    }));
                } else if (error.isConnectionError) {
                    setErrors(prev => ({
                        ...prev,
                        general: 'لا يمكن الاتصال بالخادم. يرجى التأكد من أن Backend يعمل.'
                    }));
                } else if (error.isTimeoutError) {
                    setErrors(prev => ({
                        ...prev,
                        general: 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.'
                    }));
                } else {
                    setErrors(prev => ({
                        ...prev,
                        general: 'حدث خطأ في الاتصال. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى'
                    }));
                }
            } else {
                setErrors(prev => ({
                    ...prev,
                    general: error.userMessage || error.message || 'حدث خطأ غير متوقع'
                }));
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 overflow-hidden" dir="rtl">
            {/* Animated Background Elements */ }
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-sky-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
            </div>

            <div className="relative w-full max-w-md mx-4">
                {/* Glass Card Container */ }
                <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
                    {/* Logo Section */ }
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-orange-300 rounded-full blur-lg opacity-75 group-hover:opacity-100 transition duration-300"></div>
                            <div className="relative w-24 h-24 bg-white rounded-full p-1 shadow-xl">
                                <img src={ ViteLogo } alt="Logo" className="w-full h-full rounded-full object-cover" />
                            </div>
                        </div>
                        <h1 className="mt-6 text-3xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
                            مرحباً بعودتك
                        </h1>
                        <p className="mt-2 text-gray-600">سجل الدخول للمتابعة</p>
                    </div>

                    {/* Error Message */ }
                    { errors.general && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-shake">
                            { errors.general }
                        </div>
                    ) }

                    {/* Login Form */ }
                    <form onSubmit={ handleSubmit } className="space-y-5">
                        {/* Email Input */ }
                        <div className="relative">
                            <div className={ `relative transition-all duration-300 ${emailFocused ? 'transform scale-105' : ''}` }>
                                <input
                                    type="email"
                                    id="email"
                                    value={ email }
                                    onChange={ handleEmailChange }
                                    onFocus={ () => setEmailFocused(true) }
                                    onBlur={ () => {
                                        setEmailFocused(false);
                                        setTouched(prev => ({ ...prev, email: true }));
                                    } }
                                    className={ `w-full px-12 py-4 bg-gray-50 border-2 rounded-2xl transition-all duration-300 outline-none
                                        ${emailFocused ? 'border-sky-400 bg-white shadow-lg shadow-sky-100' : 'border-gray-200 hover:border-sky-300'}
                                        ${errors.email && touched.email ? 'border-red-400' : ''}` }
                                    placeholder="أدخل بريدك الإلكتروني"
                                    autoComplete="email"
                                />
                                <div className={ `absolute right-4 top-1/2 transform -translate-y-1/2 transition-colors duration-300
                                    ${emailFocused ? 'text-sky-500' : 'text-gray-400'}` }>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            </div>
                            { errors.email && touched.email && (
                                <p className="mt-1 text-xs text-red-500 mr-2">{ errors.email }</p>
                            ) }
                        </div>

                        {/* Password Input */ }
                        <div className="relative">
                            <div className={ `relative transition-all duration-300 ${passwordFocused ? 'transform scale-105' : ''}` }>
                                <input
                                    type={ showPassword ? 'text' : 'password' }
                                    id="password"
                                    value={ password }
                                    onChange={ handlePasswordChange }
                                    onFocus={ () => setPasswordFocused(true) }
                                    onBlur={ () => {
                                        setPasswordFocused(false);
                                        setTouched(prev => ({ ...prev, password: true }));
                                    } }
                                    className={ `w-full px-12 py-4 bg-gray-50 border-2 rounded-2xl transition-all duration-300 outline-none
                                        ${passwordFocused ? 'border-sky-400 bg-white shadow-lg shadow-sky-100' : 'border-gray-200 hover:border-sky-300'}
                                        ${errors.password && touched.password ? 'border-red-400' : ''}` }
                                    placeholder="أدخل كلمة المرور"
                                    autoComplete="current-password"
                                />
                                <div className={ `absolute right-4 top-1/2 transform -translate-y-1/2 transition-colors duration-300
                                    ${passwordFocused ? 'text-sky-500' : 'text-gray-400'}` }>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <button
                                    type="button"
                                    onClick={ () => setShowPassword(!showPassword) }
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-sky-500 transition-colors duration-300"
                                >
                                    { showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    ) }
                                </button>
                            </div>
                            { errors.password && touched.password && (
                                <p className="mt-1 text-xs text-red-500 mr-2">{ errors.password }</p>
                            ) }
                        </div>

                        {/* Remember Me & Forgot Password */ }
                        <div className="flex items-center justify-between">
                            <label className="flex items-center group cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={ remember }
                                    onChange={ (e) => setRemember(e.target.checked) }
                                    className="sr-only"
                                />
                                <div className={ `relative w-5 h-5 border-2 rounded transition-all duration-300
                                    ${remember ? 'bg-sky-400 border-sky-400' : 'bg-white border-gray-300 group-hover:border-sky-300'}` }>
                                    { remember && (
                                        <svg className="absolute inset-0 w-3 h-3 m-auto text-white animate-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) }
                                </div>
                                <span className="mr-2 text-sm text-gray-700 group-hover:text-sky-600 transition-colors duration-300">
                                    تذكرني
                                </span>
                            </label>
                            <a
                                href="/forgot-password"
                                className="text-sm text-orange-500 hover:text-orange-600 transition-colors duration-300 hover:underline"
                            >
                                نسيت كلمة المرور؟
                            </a>
                        </div>

                        {/* Submit Button */ }
                        <button
                            type="submit"
                            disabled={ isLoading }
                            className={ `relative w-full py-4 rounded-2xl font-bold text-white transition-all duration-300 transform
                                ${isLoading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-600 hover:scale-105 hover:shadow-xl active:scale-100'}` }
                        >
                            { isLoading ? (
                                <div className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    جاري تسجيل الدخول...
                                </div>
                            ) : (
                                'تسجيل الدخول'
                            ) }
                        </button>
                    </form>


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
                @keyframes checkmark {
                    0% {
                        stroke-dashoffset: 100;
                    }
                    100% {
                        stroke-dashoffset: 0;
                    }
                }
                .animate-checkmark {
                    stroke-dasharray: 100;
                    animation: checkmark 0.3s ease-in-out;
                }
                @keyframes shake {
                    0%, 100% {
                        transform: translateX(0);
                    }
                    10%, 30%, 50%, 70%, 90% {
                        transform: translateX(-2px);
                    }
                    20%, 40%, 60%, 80% {
                        transform: translateX(2px);
                    }
                }
                .animate-shake {
                    animation: shake 0.5s;
                }
            `}</style>
        </div>
    );
}

export default Login;