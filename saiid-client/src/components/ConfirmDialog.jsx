import React, { memo, useCallback, useEffect } from 'react';
import { AlertTriangle, X, CheckCircle, XCircle, Info } from 'lucide-react';

/**
 * ✅ ConfirmDialog Component - Improved Version
 * Dialog موحد للتأكيد قبل الإجراءات المهمة مع تحسينات في الأداء والتصميم
 * 
 * @param {boolean} isOpen - حالة فتح/إغلاق الـ dialog
 * @param {function} onClose - دالة الإغلاق
 * @param {function} onConfirm - دالة التأكيد
 * @param {string} title - عنوان الـ dialog
 * @param {string|ReactNode} message - رسالة التأكيد
 * @param {string} confirmText - نص زر التأكيد
 * @param {string} cancelText - نص زر الإلغاء
 * @param {string} type - نوع الـ dialog (danger, warning, info, success)
 * @param {boolean} isLoading - حالة التحميل
 * @param {string} confirmButtonClass - CSS classes إضافية لزر التأكيد
 * @param {boolean} closeOnBackdrop - إغلاق عند النقر على الخلفية (افتراضي: true)
 */
const ConfirmDialog = memo(({
  isOpen,
  onClose,
  onConfirm,
  title = 'تأكيد الإجراء',
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  type = 'warning',
  isLoading = false,
  confirmButtonClass = '',
  closeOnBackdrop = true,
}) => {
  // ✅ إغلاق عند الضغط على ESC
  useEffect(() => {
    if (!isOpen || isLoading) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  // ✅ منع scroll عند فتح الـ dialog
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback((e) => {
    if (closeOnBackdrop && e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  }, [closeOnBackdrop, isLoading, onClose]);

  const handleConfirm = useCallback(() => {
    if (!isLoading) {
      onConfirm();
    }
  }, [isLoading, onConfirm]);

  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
    }
  }, [isLoading, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <XCircle className="w-8 h-8 text-red-600" />,
          iconBg: 'bg-red-100',
          button: confirmButtonClass || 'bg-red-500 hover:bg-red-600',
          border: 'border-red-200',
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-8 h-8 text-green-600" />,
          iconBg: 'bg-green-100',
          button: confirmButtonClass || 'bg-green-500 hover:bg-green-600',
          border: 'border-green-200',
        };
      case 'info':
        return {
          icon: <Info className="w-8 h-8 text-blue-600" />,
          iconBg: 'bg-blue-100',
          button: confirmButtonClass || 'bg-blue-500 hover:bg-blue-600',
          border: 'border-blue-200',
        };
      case 'warning':
      default:
        return {
          icon: <AlertTriangle className="w-8 h-8 text-orange-600" />,
          iconBg: 'bg-orange-100',
          button: confirmButtonClass || 'bg-orange-500 hover:bg-orange-600',
          border: 'border-orange-200',
        };
    }
  };

  if (!isOpen) return null;

  const styles = getTypeStyles();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-message"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />

      {/* Dialog */}
      <div
        className={`
          relative bg-white rounded-2xl shadow-2xl
          max-w-md w-full
          transform transition-all duration-300
          ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
          border-2 ${styles.border}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${styles.iconBg}`}>
              {styles.icon}
            </div>
            <h3 id="dialog-title" className="text-xl font-bold text-gray-800">
              {title}
            </h3>
          </div>
          {!isLoading && (
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="إغلاق"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          <p id="dialog-message" className="text-gray-700 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`
              flex-1 px-6 py-3 text-white rounded-xl
              transition-all duration-300 font-medium
              shadow-lg hover:shadow-xl
              transform hover:scale-105 active:scale-100
              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
              ${styles.button}
            `}
            type="button"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري المعالجة...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';

export default ConfirmDialog;
