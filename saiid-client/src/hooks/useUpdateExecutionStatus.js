import { useState } from 'react';
import apiClient from '../utils/axiosConfig';
import { useToast } from './useToast';

/**
 * مسح الكاش بعد تحديث الحالة
 */
const invalidateProjectsCache = () => {
  try {
    // ✅ مسح من localStorage
    localStorage.removeItem('cache_projects');
    localStorage.removeItem('projects_cache');
    localStorage.removeItem('cache_project-proposals');
    localStorage.removeItem('project-proposals_cache');
    localStorage.removeItem('cache_project_proposals');
    localStorage.removeItem('project_proposals_cache');

    // ✅ إرسال event لإعلام المكونات الأخرى
    window.dispatchEvent(new CustomEvent('cache-invalidated', {
      detail: { cacheKey: 'projects' }
    }));

    if (import.meta.env.DEV) {
      console.log('✅ Projects cache invalidated after status update');
    }
  } catch (error) {
    console.warn('Error invalidating projects cache:', error);
  }
};

/**
 * Hook لتحديث حالة التنفيذ للمشروع
 * 
 * @returns {Object} { updateExecutionStatus, loading }
 * 
 * @example
 * const { updateExecutionStatus, loading } = useUpdateExecutionStatus();
 * 
 * const handleUpdate = async () => {
 *   try {
 *     const updatedProject = await updateExecutionStatus(projectId, 'تم التنفيذ');
 *     console.log('تم التحديث:', updatedProject);
 *   } catch (error) {
 *     console.error('فشل التحديث:', error);
 *   }
 * };
 */
export const useUpdateExecutionStatus = () => {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const updateExecutionStatus = async (projectId, newStatus) => {
    // ✅ التحقق من صحة الحالة
    const validStatuses = ['قيد التنفيذ', 'تم التنفيذ'];
    if (!validStatuses.includes(newStatus)) {
      const errorMessage = 'الحالة يجب أن تكون "قيد التنفيذ" أو "تم التنفيذ"';
      showToast(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    setLoading(true);
    try {
      const response = await apiClient.post(
        `/project-proposals/${projectId}/update-execution-status`,
        { status: newStatus }
      );

      if (response.data.success) {
        showToast(response.data.message || 'تم تحديث حالة المشروع بنجاح', 'success');
        
        // ✅ مسح الكاش فوراً بعد تحديث الحالة بنجاح
        invalidateProjectsCache();
        
        // ✅ إضافة cache bust timestamp في response إذا كان متوفراً
        const cacheBust = response.headers?.['x-cache-bust'] || 
                         response.data?.cache_bust || 
                         Date.now();
        
        return {
          ...response.data.project,
          _cacheBust: cacheBust, // ✅ إضافة timestamp للاستخدام في إعادة الجلب
        };
      } else {
        const errorMessage = response.data.message || 'فشل تحديث حالة المشروع';
        showToast(errorMessage, 'error');
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = 
        error.response?.data?.message || 
        error.response?.data?.error || 
        'فشل تحديث حالة المشروع';
      
      showToast(errorMessage, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { updateExecutionStatus, loading };
};

export default useUpdateExecutionStatus;

