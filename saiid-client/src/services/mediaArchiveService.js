import apiClient from '../utils/axiosConfig';

/**
 * Service for Media Archive API operations
 * خدمة عمليات API لأرشيف المواد
 */

/**
 * Get archives with filters and pagination
 * جلب الأرشيف مع البحث والفلترة
 * @param {Object} filters - Filter parameters
 * @returns {Promise<Object>} Response with archives and pagination
 */
export const getArchives = async (filters = {}) => {
  try {
    const response = await apiClient.get('/media-archives', {
      params: filters,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get available projects for archiving
 * جلب المشاريع المتاحة للأرشفة
 * @returns {Promise<Array>} Array of available projects
 */
export const getAvailableProjects = async () => {
  try {
    const response = await apiClient.get('/media-archives/available-projects');
    return response.data.data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Create a new archive
 * إضافة أرشيف جديد
 * @param {Object} data - Archive data
 * @returns {Promise<Object>} Created archive
 */
export const createArchive = async (data) => {
  try {
    const response = await apiClient.post('/media-archives', data);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get archive details by ID
 * جلب تفاصيل أرشيف
 * @param {number} id - Archive ID
 * @returns {Promise<Object>} Archive details
 */
export const getArchive = async (id) => {
  try {
    const response = await apiClient.get(`/media-archives/${id}`);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Update archive
 * تحديث أرشيف
 * @param {number} id - Archive ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated archive
 */
export const updateArchive = async (id, data) => {
  try {
    const response = await apiClient.put(`/media-archives/${id}`, data);
    return response.data.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete archive
 * حذف أرشيف
 * @param {number} id - Archive ID
 * @returns {Promise<void>}
 */
export const deleteArchive = async (id) => {
  try {
    await apiClient.delete(`/media-archives/${id}`);
  } catch (error) {
    throw error;
  }
};

