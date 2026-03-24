import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

/**
 * FormField Component - حقل نموذج موحد مع validation feedback
 * 
 * @param {string} label - تسمية الحقل
 * @param {string} name - اسم الحقل
 * @param {string} type - نوع الحقل (text, email, password, etc.)
 * @param {any} value - قيمة الحقل
 * @param {function} onChange - دالة التغيير
 * @param {string} error - رسالة الخطأ
 * @param {boolean} touched - هل تم لمس الحقل
 * @param {boolean} required - هل الحقل مطلوب
 * @param {string} placeholder - نص توضيحي
 * @param {object} validation - كائن validation
 * @param {boolean} showSuccessIcon - عرض أيقونة النجاح
 * @param {object} rest - خصائص إضافية
 */
const FormField = ({
    label,
    name,
    type = 'text',
    value,
    onChange,
    onBlur,
    error,
    touched,
    required = false,
    placeholder,
    validation,
    showSuccessIcon = true,
    icon: Icon,
    dir = 'rtl',
    className = '',
    ...rest
}) => {
    const [focused, setFocused] = useState(false);
    const hasError = touched && error;
    const isValid = touched && !error && value;

    const handleFocus = () => {
        setFocused(true);
    };

    const handleBlur = (e) => {
        setFocused(false);
        if (onBlur) {
            onBlur(e);
        }
    };

    const inputClasses = `
    w-full px-4 py-3 
    border-2 rounded-xl
    transition-all duration-300
    outline-none
    ${hasError
            ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200'
            : isValid
                ? 'border-green-400 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                : focused
                    ? 'border-sky-400 bg-white shadow-lg shadow-sky-100 focus:border-sky-500 focus:ring-2 focus:ring-sky-200'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        }
    ${Icon ? 'pr-12' : ''}
    ${className}
  `.trim();

    return (
        <div className="space-y-2" dir={ dir }>
            { label && (
                <label
                    htmlFor={ name }
                    className="block text-sm font-semibold text-gray-700"
                >
                    { label }
                    { required && <span className="text-red-500 text-lg mr-1">*</span> }
                </label>
            ) }

            <div className="relative">
                { Icon && (
                    <div className={ `
            absolute right-4 top-1/2 transform -translate-y-1/2
            transition-colors duration-300
            ${focused ? 'text-sky-500' : hasError ? 'text-red-400' : isValid ? 'text-green-500' : 'text-gray-400'}
          `}>
                        <Icon className="w-5 h-5" />
                    </div>
                ) }

                <input
                    id={ name }
                    name={ name }
                    type={ type }
                    value={ value }
                    onChange={ onChange }
                    onFocus={ handleFocus }
                    onBlur={ handleBlur }
                    placeholder={ placeholder }
                    className={ inputClasses }
                    aria-invalid={ hasError }
                    aria-describedby={ hasError ? `${name}-error` : undefined }
                    { ...rest }
                />

                {/* Success Icon */ }
                { isValid && showSuccessIcon && (
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                ) }

                {/* Error Icon */ }
                { hasError && (
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                ) }
            </div>

            {/* Error Message */ }
            { hasError && (
                <div
                    id={ `${name}-error` }
                    className="flex items-center gap-2 text-sm text-red-600 animate-fadeIn"
                    role="alert"
                >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{ error }</span>
                </div>
            ) }

            {/* Helper Text */ }
            { !hasError && validation?.helperText && (
                <p className="text-xs text-gray-500">{ validation.helperText }</p>
            ) }
        </div>
    );
};

export default FormField;

