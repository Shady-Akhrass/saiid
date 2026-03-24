import { useToast as useToastContext } from '../context/ToastContext';

/**
 * Custom hook for showing toast notifications
 * @returns {Object} Toast methods (showToast, success, error, warning, info)
 * 
 * @example
 * const { success, error } = useToast();
 * success('تم الحفظ بنجاح');
 * error('حدث خطأ أثناء الحفظ');
 */
export const useToast = () => {
    return useToastContext();
};

export default useToast;

