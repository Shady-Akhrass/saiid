import React from 'react';
import { AlertCircle, XCircle } from 'lucide-react';

/**
 * FormError Component - عرض رسائل الأخطاء في النماذج
 * 
 * @param {string|Array} errors - رسالة خطأ واحدة أو مصفوفة من الأخطاء
 * @param {string} type - نوع الخطأ (error, warning)
 * @param {string} className - classes إضافية
 */
const FormError = ({
    errors,
    type = 'error',
    className = '',
    showIcon = true
}) => {
    if (!errors) return null;

    // تحويل إلى مصفوفة إذا كانت string
    const errorArray = Array.isArray(errors) ? errors : [errors];

    // تصفية الأخطاء الفارغة
    const validErrors = errorArray.filter(error => error && error.trim() !== '');

    if (validErrors.length === 0) return null;

    const isError = type === 'error';
    const bgColor = isError ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200';
    const textColor = isError ? 'text-red-700' : 'text-orange-700';
    const iconColor = isError ? 'text-red-600' : 'text-orange-600';
    const Icon = isError ? XCircle : AlertCircle;

    return (
        <div
            className={ `
        ${bgColor} 
        ${textColor}
        border-2 rounded-xl p-4
        animate-fadeIn
        ${className}
      `}
            role="alert"
            aria-live="polite"
            dir="rtl"
        >
            <div className="flex items-start gap-3">
                { showIcon && (
                    <Icon className={ `w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5` } />
                ) }
                <div className="flex-1 space-y-1">
                    { validErrors.map((error, index) => (
                        <p key={ index } className="text-sm font-medium">
                            { error }
                        </p>
                    )) }
                </div>
            </div>
        </div>
    );
};

export default FormError;

