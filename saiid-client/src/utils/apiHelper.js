/**
 * ✅ API Helper Functions - Improved Version
 * دوال مساعدة لـ API مع معالجة محسّنة للأخطاء
 */

/**
 * ✅ Helper function to safely parse JSON responses
 * Handles cases where server returns HTML error pages instead of JSON
 * 
 * @param {Response} response - Response object
 * @returns {Promise<Object>} Parsed JSON data
 * @throws {Error} If parsing fails
 */
export const safeJsonParse = async (response) => {
  if (!response || !response.headers) {
    throw new Error('Invalid response object');
  }

  const contentType = response.headers.get('content-type');

  // If response is not JSON, throw error without cloning unnecessarily
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Expected JSON but received ${contentType}. Response: ${text.substring(0, 100)}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse JSON. Response: ${text.substring(0, 100)}`);
  }
};

/**
 * ✅ Safe fetch wrapper that handles errors properly
 * 
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
 * @param {number} options.retries - Number of retries on failure (default: 0)
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If request fails
 */
export const safeFetch = async (url, options = {}) => {
  const { timeout = 30000, retries = 0, ...fetchOptions } = options;

  const fetchWithTimeout = async (url, options) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout');
        timeoutError.status = 408;
        timeoutError.isTimeout = true;
        throw timeoutError;
      }
      throw error;
    }
  };

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      // Handle non-OK responses
      if (!response.ok) {
        // Handle 429 (Too Many Requests)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
          
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          const error = new Error('تم تجاوز الحد الأقصى لعدد الطلبات. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى');
          error.status = 429;
          throw error;
        }

        // Clone response to read it multiple times if needed
        const responseClone = response.clone();
        const contentType = response.headers.get('content-type');
        let errorMessage = `HTTP ${response.status}`;

        try {
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } else {
            const text = await responseClone.text();
            errorMessage = text || errorMessage;
          }
        } catch (parseError) {
          // If parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }

        const error = new Error(`Server error (${response.status}): ${errorMessage.substring(0, 100)}`);
        error.status = response.status;
        throw error;
      }

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseClone = response.clone();
        const text = await responseClone.text();
        throw new Error(`Expected JSON but received ${contentType}. Response: ${text.substring(0, 100)}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      
      // Retry on network errors or 5xx errors
      if (attempt < retries && (
        error.isTimeout ||
        (!error.status || (error.status >= 500 && error.status < 600))
      )) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Re-throw if it's already our custom error
      if (error.status) {
        throw error;
      }
      
      // Network or other errors
      throw new Error(`Network error: ${error.message}`);
    }
  }

  throw lastError;
};

/**
 * ✅ Get authentication token from storage
 * 
 * @returns {string} Authentication token or empty string
 */
export const getAuthToken = () => {
  try {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  } catch (error) {
    console.warn('Error reading auth token:', error);
    return '';
  }
};

/**
 * ✅ Create headers with authentication
 * 
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} Headers object with authentication
 */
export const createAuthHeaders = (additionalHeaders = {}) => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...additionalHeaders,
  };
};

/**
 * ✅ Create FormData headers (without Content-Type to let browser set it)
 * 
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} Headers object for FormData
 */
export const createFormDataHeaders = (additionalHeaders = {}) => {
  const token = getAuthToken();
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...additionalHeaders,
  };
};

/**
 * ✅ Check if response is successful
 * 
 * @param {Object} response - API response
 * @returns {boolean} True if response is successful
 */
export const isSuccessResponse = (response) => {
  return response?.success === true || response?.status === 'success';
};

/**
 * ✅ Extract data from response (handles different response structures)
 * 
 * @param {Object} response - API response
 * @returns {any} Extracted data
 */
export const extractResponseData = (response) => {
  if (!response) return null;
  
  if (response.data !== undefined) {
    return response.data;
  }
  
  if (response.result !== undefined) {
    return response.result;
  }
  
  if (response.content !== undefined) {
    return response.content;
  }
  
  return response;
};

/**
 * ✅ Extract error message from error object
 * 
 * @param {Error|Object} error - Error object
 * @returns {string} Error message
 */
export const extractErrorMessage = (error) => {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.response?.data?.error) {
    return error.response.data.error;
  }

  // ✅ Safe access to statusText with defensive check
  if (error?.response?.statusText && typeof error.response.statusText === 'string') {
    return error.response.statusText;
  }

  return 'حدث خطأ غير متوقع';
};

/**
 * ✅ Create API request config
 * 
 * @param {Object} config - Request configuration
 * @param {string} config.method - HTTP method (GET, POST, etc.)
 * @param {string} config.url - Request URL
 * @param {Object} config.data - Request data
 * @param {Object} config.headers - Additional headers
 * @param {number} config.timeout - Request timeout
 * @returns {Object} Request configuration
 */
export const createApiConfig = (config) => {
  const { method = 'GET', url, data, headers = {}, timeout = 30000 } = config;

  const isFormData = data instanceof FormData;
  const requestHeaders = isFormData
    ? createFormDataHeaders(headers)
    : createAuthHeaders(headers);

  return {
    method,
    url,
    data,
    headers: requestHeaders,
    timeout,
  };
};

// ✅ Export all helpers
export default {
  safeJsonParse,
  safeFetch,
  getAuthToken,
  createAuthHeaders,
  createFormDataHeaders,
  isSuccessResponse,
  extractResponseData,
  extractErrorMessage,
  createApiConfig,
};
