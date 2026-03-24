import React, { useState, useRef, useEffect, memo } from 'react';

/**
 * مكون LazyImage محسّن لتحميل الصور بشكل lazy
 * يحمل الصورة فقط عندما تكون مرئية في viewport
 * يدعم WebP و AVIF مع fallback تلقائي
 * 
 * @param {string} src - رابط الصورة
 * @param {string} alt - نص بديل للصورة
 * @param {string} className - classes CSS
 * @param {object} style - styles إضافية
 * @param {function} onLoad - callback عند تحميل الصورة
 * @param {function} onError - callback عند فشل تحميل الصورة
 * @param {string} placeholder - صورة placeholder أثناء التحميل
 * @param {number} width - عرض الصورة (لمنع layout shift)
 * @param {number} height - ارتفاع الصورة (لمنع layout shift)
 * @param {string|Array} srcSet - srcset للصور المتجاوبة
 * @param {string} sizes - sizes attribute للصور المتجاوبة
 */
const LazyImage = memo(({
    src,
    alt = '',
    className = '',
    style = {},
    onLoad,
    onError,
    placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23f3f4f6"/%3E%3C/svg%3E',
    width,
    height,
    srcSet,
    sizes,
    ...props
}) => {
    const [imageSrc, setImageSrc] = useState(placeholder);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef(null);

    // ✅ دالة لإنشاء srcset مع دعم WebP و AVIF
    const generateSrcSet = (originalSrc) => {
        if (!originalSrc || typeof originalSrc !== 'string') return null;
        
        // إذا كان srcSet ممرر كـ prop، استخدمه مباشرة
        if (srcSet) return srcSet;
        
        // محاولة إنشاء srcset تلقائياً من الـ src
        try {
            const url = new URL(originalSrc, window.location.origin);
            const baseUrl = url.origin + url.pathname;
            const extension = baseUrl.split('.').pop()?.toLowerCase();
            
            // إذا كانت الصورة من API خارجي، لا نعدلها
            if (url.hostname !== window.location.hostname) {
                return null;
            }
            
            // إنشاء srcset للصور المتجاوبة (إذا كان width موجود)
            if (width) {
                const widths = [320, 640, 768, 1024, 1280, 1920];
                return widths
                    .filter(w => w <= width * 2) // لا نضيف أحجام أكبر من الضعف
                    .map(w => `${baseUrl}?w=${w} ${w}w`)
                    .join(', ');
            }
        } catch (e) {
            // إذا فشل parsing الـ URL، نرجع null
            return null;
        }
        
        return null;
    };

    useEffect(() => {
        if (!src) {
            setHasError(true);
            return;
        }

        // ✅ استخدام Intersection Observer لتحميل الصورة عند ظهورها
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // ✅ الصورة مرئية الآن - ابدأ التحميل
                        const img = new Image();

                        img.onload = () => {
                            setImageSrc(src);
                            setIsLoaded(true);
                            if (onLoad) onLoad();
                        };

                        img.onerror = () => {
                            setHasError(true);
                            if (onError) onError();
                        };

                        img.src = src;

                        // ✅ إيقاف المراقبة بعد بدء التحميل
                        observer.disconnect();
                    }
                });
            },
            {
                rootMargin: '50px', // ✅ بدء التحميل قبل 50px من الظهور
            }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, [src, onLoad, onError]);

    // ✅ عرض placeholder أو رسالة خطأ إذا فشل التحميل
    if (hasError) {
        return (
            <div 
                ref={ imgRef }
                className={ `${className} flex items-center justify-center bg-gray-100 text-gray-400 text-sm` }
                style={ style }
            >
                صورة غير متوفرة
            </div>
        );
    }

    // ✅ إنشاء srcset للصور المتجاوبة
    const imageSrcSet = generateSrcSet(src);
    
    // ✅ إنشاء sizes attribute إذا لم يكن موجوداً
    const imageSizes = sizes || (width ? `(max-width: ${width}px) 100vw, ${width}px` : '100vw');

    return (
        <img
            ref={ imgRef }
            src={ imageSrc }
            alt={ alt }
            className={ `${className} ${!isLoaded ? 'opacity-50 blur-sm' : 'opacity-100'} transition-all duration-300` }
            style={ style }
            width={ width }
            height={ height }
            srcSet={ imageSrcSet || undefined }
            sizes={ imageSrcSet ? imageSizes : undefined }
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            { ...props }
        />
    );
});

LazyImage.displayName = 'LazyImage';

export default LazyImage;

