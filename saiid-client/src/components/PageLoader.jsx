import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * ✅ PageLoader Component - Improved Version
 * مكون تحميل محسّن مع خيارات متعددة
 * 
 * @param {boolean} isLoading - حالة التحميل
 * @param {string} message - رسالة التحميل (افتراضي: 'جاري التحميل...')
 * @param {string} size - حجم الـ spinner (small, medium, large)
 * @param {boolean} fullScreen - عرض ملء الشاشة (افتراضي: true)
 * @param {string} variant - نوع التحميل (spinner, dots, pulse)
 */
const PageLoaderComponent = (props) => {
  // ✅ Backward compatibility: إذا لم يتم تمرير props، نعرض الـ loader
  const isLoading = props?.isLoading !== undefined ? props.isLoading : true;
  const message = props?.message || 'جاري التحميل...';
  const size = props?.size || 'medium';
  const fullScreen = props?.fullScreen !== undefined ? props.fullScreen : true;
  const variant = props?.variant || 'spinner';

  if (!isLoading) return null;

  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16',
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        );
      case 'pulse':
        return (
          <div className={`${sizeClasses[size]} bg-blue-600 rounded-full animate-pulse`} />
        );
      default:
        return (
          <div className={`relative ${sizeClasses[size]}`}>
            <div className="absolute inset-0 border-3 border-blue-200 rounded-full" />
            <div className="absolute inset-0 border-3 border-blue-600 rounded-full border-t-transparent animate-spin" />
          </div>
        );
    }
  };

  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm'
    : 'absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-2xl';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-4">
        {renderSpinner()}
        {message && (
          <p className={`font-medium text-blue-600 animate-pulse ${textSizeClasses[size]}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

const PageLoader = memo(PageLoaderComponent);

PageLoader.displayName = 'PageLoader';

// ✅ Export both default and named export for backward compatibility
export default PageLoader;
export { PageLoaderComponent };
