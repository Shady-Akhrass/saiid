import { useState, useEffect, useRef } from 'react';

/**
 * ✅ Custom hook للـ debouncing - Improved Version
 * ينتظر حتى يتوقف المستخدم عن الكتابة قبل تنفيذ العملية
 * 
 * @param {any} value - القيمة المراد debounce
 * @param {number} delay - الوقت بالمللي ثانية (افتراضي: 500ms)
 * @param {Object} options - خيارات إضافية
 * @param {boolean} options.immediate - تنفيذ فوري للقيمة الأولى (افتراضي: false)
 * @param {Function} options.onChange - دالة يتم استدعاؤها عند تغيير القيمة
 * @returns {any} القيمة بعد debounce
 */
export const useDebounce = (value, delay = 500, options = {}) => {
  const { immediate = false, onChange } = options || {};
  // ✅ التأكد من أن القيمة الابتدائية آمنة - استخدام value الحالية أو string فارغ
  const safeInitialValue = value !== undefined && value !== null ? value : '';
  const initialValue = immediate ? safeInitialValue : '';
  const [debouncedValue, setDebouncedValue] = useState(initialValue);
  const isFirstRender = useRef(true);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // ✅ التأكد من أن value آمنة (string فارغ بدلاً من undefined/null)
    const safeValue = value !== undefined && value !== null ? value : '';

    // ✅ في أول render، إذا كان immediate = true، نستخدم القيمة مباشرة
    if (isFirstRender.current && immediate) {
      isFirstRender.current = false;
      setDebouncedValue(safeValue);
      if (onChange) onChange(safeValue);
      return;
    }

    // ✅ تنظيف timer السابق
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // ✅ إنشاء timer جديد
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(safeValue);
      if (onChange) onChange(safeValue);
    }, delay);

    // ✅ تنظيف timer عند unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay, immediate, onChange]);

  // ✅ تنظيف timer عند unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // ✅ إرجاع قيمة آمنة (string فارغ بدلاً من undefined)
  return debouncedValue !== undefined && debouncedValue !== null ? debouncedValue : '';
};

/**
 * ✅ Custom hook للـ debounce مع callback
 * @param {Function} callback - الدالة المراد debounce
 * @param {number} delay - الوقت بالمللي ثانية
 * @returns {Function} الدالة المdebounced
 */
export const useDebouncedCallback = (callback, delay = 500) => {
  const timeoutRef = useRef(null);

  const debouncedCallback = (...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };

  // ✅ تنظيف timer عند unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

export default useDebounce;
