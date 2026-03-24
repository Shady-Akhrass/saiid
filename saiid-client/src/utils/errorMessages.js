/**
 * قاموس رسائل الأخطاء الموحدة بالعربية
 * يوفر رسائل واضحة ومفيدة للمستخدمين عند حدوث أخطاء
 */

export const errorMessages = {
    // Network Errors
    network: {
        noConnection: 'لا يوجد اتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى.',
        timeout: 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.',
        failed: 'فشل الاتصال بالخادم. يرجى المحاولة لاحقاً.',
        connectionRefused: 'لا يمكن الاتصال بالخادم. تأكد من أن Backend يعمل على localhost:8000',
        default: 'حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.',
    },

    // Authentication Errors
    auth: {
        401: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.',
        403: 'ليس لديك صلاحيات للوصول إلى هذا القسم. الصلاحيات مقتصرة على الإدارة فقط.',
        invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
        sessionExpired: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.',
        unauthorized: 'غير مصرح لك. يرجى تسجيل الدخول.',
        permissionDenied: 'ليس لديك صلاحيات للتعديل والإضافة لهذا القسم. الصلاحيات مقتصرة على الإدارة فقط.',
    },

    // Server Errors
    server: {
        500: 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً أو الاتصال بالدعم الفني.',
        502: 'الخادم غير متاح حالياً. يرجى المحاولة لاحقاً.',
        503: 'الخدمة غير متاحة حالياً. يرجى المحاولة لاحقاً.',
        504: 'انتهت مهلة الاتصال بالخادم. يرجى المحاولة مرة أخرى.',
        database: 'خطأ في قاعدة البيانات. يرجى الاتصال بالدعم الفني.',
        default: 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً.',
    },

    // Validation Errors
    validation: {
        required: 'هذا الحقل مطلوب.',
        email: 'يرجى إدخال بريد إلكتروني صحيح.',
        minLength: (min) => `يجب أن يكون طول النص على الأقل ${min} أحرف.`,
        maxLength: (max) => `يجب أن يكون طول النص على الأكثر ${max} حرف.`,
        phone: 'يرجى إدخال رقم هاتف صحيح.',
        number: 'يرجى إدخال رقم صحيح.',
        date: 'يرجى إدخال تاريخ صحيح.',
        fileSize: (maxMB) => `حجم الملف يجب أن يكون أقل من ${maxMB} ميجابايت.`,
        fileType: 'نوع الملف غير مدعوم.',
        passwordMatch: 'كلمات المرور غير متطابقة.',
        passwordWeak: 'كلمة المرور ضعيفة. يرجى استخدام كلمة مرور أقوى.',
    },

    // Form Errors
    form: {
        submitFailed: 'فشل في إرسال النموذج. يرجى التحقق من البيانات والمحاولة مرة أخرى.',
        invalidData: 'البيانات المدخلة غير صحيحة. يرجى التحقق والمحاولة مرة أخرى.',
        saveFailed: 'فشل في حفظ البيانات. يرجى المحاولة مرة أخرى.',
        updateFailed: 'فشل في تحديث البيانات. يرجى المحاولة مرة أخرى.',
        deleteFailed: 'فشل في حذف البيانات. يرجى المحاولة مرة أخرى.',
    },

    // Data Errors
    data: {
        notFound: 'البيانات المطلوبة غير موجودة.',
        fetchFailed: 'فشل في جلب البيانات من الخادم.',
        loadFailed: 'فشل في تحميل البيانات. يرجى تحديث الصفحة.',
        empty: 'لا توجد بيانات متاحة.',
    },

    // File Errors
    file: {
        uploadFailed: 'فشل في رفع الملف. يرجى المحاولة مرة أخرى.',
        downloadFailed: 'فشل في تحميل الملف. يرجى المحاولة مرة أخرى.',
        invalidFormat: 'نوع الملف غير مدعوم.',
        tooLarge: 'حجم الملف كبير جداً.',
        corrupted: 'الملف تالف أو غير صحيح.',
    },

    // General Errors
    general: {
        unexpected: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
        tryAgain: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
        contactSupport: 'إذا استمرت المشكلة، يرجى الاتصال بالدعم الفني.',
    },
};

/**
 * الحصول على رسالة خطأ مناسبة حسب نوع الخطأ
 * @param {Error|Object} error - كائن الخطأ
 * @returns {string} رسالة الخطأ بالعربية
 */
export const getErrorMessage = (error) => {
    // ✅ التحقق من أن error موجود
    if (!error) {
        return errorMessages.general.unexpected;
    }

    // إذا كانت الرسالة موجودة بالفعل
    if (typeof error === 'string') {
        return error;
    }

    // إذا كان الخطأ يحتوي على رسالة عربية
    if (error?.message && typeof error.message === 'string') {
        // تحقق إذا كانت الرسالة بالعربية
        if (/[\u0600-\u06FF]/.test(error.message)) {
            return error.message;
        }
    }

    // معالجة أخطاء axios
    if (error?.response) {
        const status = error.response?.status;
        const data = error.response?.data;
        
        // ✅ التحقق من أن status موجود
        if (status === undefined || status === null) {
            return errorMessages.general.unexpected;
        }

        // رسالة من السيرفر
        if (data?.message) {
            return data.message;
        }

        if (data?.error) {
            return data.error;
        }

        // رسائل حسب status code
        if (status === 401) {
            return errorMessages.auth[401] || errorMessages.auth.unauthorized;
        }

        if (status === 403) {
            // ✅ استخدام الرسالة من الـ Backend إذا كانت موجودة
            if (data?.message && /[\u0600-\u06FF]/.test(data.message)) {
                return data.message;
            }
            return errorMessages.auth[403] || errorMessages.auth.permissionDenied;
        }

        if (status >= 500) {
            return errorMessages.server[status] || errorMessages.server.default;
        }

        if (status === 404) {
            return errorMessages.data.notFound;
        }

        if (status === 422) {
            // Validation errors
            if (data?.errors) {
                const firstError = Object.values(data.errors)[0];
                if (Array.isArray(firstError)) {
                    return firstError[0];
                }
                return firstError || errorMessages.validation.required;
            }
            return errorMessages.form.invalidData;
        }
    }

    // معالجة أخطاء الشبكة
    if (error?.request && !error?.response) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return errorMessages.network.timeout;
        }
        if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED' || 
            error.message?.includes('ERR_CONNECTION_REFUSED') || error.message?.includes('Network Error')) {
            return errorMessages.network.connectionRefused;
        }
        return errorMessages.network.noConnection;
    }

    // معالجة أخطاء قاعدة البيانات
    if (error?.message?.includes('api_token') ||
        error?.message?.includes('Column not found') ||
        error?.message?.includes('SQLSTATE')) {
        return errorMessages.server.database;
    }

    // رسالة افتراضية
    return errorMessages.general.unexpected;
};

/**
 * الحصول على اقتراحات للحلول عند حدوث خطأ
 * @param {Error|Object} error - كائن الخطأ
 * @returns {string|null} اقتراح الحل أو null
 */
export const getErrorSuggestion = (error) => {
    // ✅ التحقق من أن error موجود
    if (!error) {
        return null;
    }

    if (error?.response) {
        const status = error.response?.status;
        
        // ✅ التحقق من أن status موجود
        if (status === undefined || status === null) {
            return null;
        }

        if (status === 401 || status === 403) {
            return 'يرجى تسجيل الدخول مرة أخرى.';
        }

        if (status >= 500) {
            return 'إذا استمرت المشكلة، يرجى الاتصال بالدعم الفني.';
        }

        if (status === 404) {
            return 'تأكد من أن الرابط صحيح.';
        }

        if (status === 422) {
            return 'يرجى التحقق من جميع الحقول المطلوبة وإعادة المحاولة.';
        }
    }

    if (error?.request && !error?.response) {
        return 'تأكد من اتصالك بالإنترنت.';
    }

    return null;
};

export default errorMessages;

