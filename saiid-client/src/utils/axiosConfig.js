import axios from 'axios';
import { getErrorMessage, getErrorSuggestion, errorMessages } from './errorMessages.js';

// ✅ Request Deduplication: منع الطلبات المكررة
const pendingRequests = new Map();
const CACHE_DURATION = 30000; // 30 ثانية للطلبات العادية
// ✅ Cache أطول للطلبات المتكررة (notifications, warehouse)
const LONG_CACHE_DURATION = 60000; // 60 ثانية للطلبات المتكررة
const responseCache = new Map();

// ✅ ETag Storage: حفظ ETags للطلبات
const etagStorage = new Map();

/**
 * إنشاء مفتاح فريد للطلب
 */
const getRequestKey = (config) => {
  const { method, url, params, data } = config;
  const paramsStr = params ? JSON.stringify(params) : '';
  const dataStr = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : '';
  return `${method}:${url}:${paramsStr}:${dataStr}`;
};

/**
 * تنظيف الـ cache القديم
 */
const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    // ✅ تحديد مدة الـ cache بناءً على نوع الطلب
    const isFrequentEndpoint = key.includes('/notifications/unread-count') ||
      key.includes('/warehouse') ||
      key.includes('/user/');
    const cacheDuration = isFrequentEndpoint ? LONG_CACHE_DURATION : CACHE_DURATION;

    if (now - value.timestamp > cacheDuration) {
      responseCache.delete(key);
    }
  }
};

/**
 * ✅ بناء axios response object بشكل موحد من البيانات المحفوظة في الـ cache
 * يضمن أن الشكل ثابت ولا يوجد data متداخلة
 */
const buildAxiosResponse = (config, cached) => ({
  data: cached.data, // ✅ استخدام cached.data مباشرة
  status: cached.status || 200,
  statusText: cached.statusText || 'OK',
  headers: cached.headers || {},
  config: {
    ...config,
    method: config.method || 'get',
    url: config.url || '',
    headers: cleanHeaders(config.headers || {}),
  },
  request: {},
  fromCache: true,
});

/**
 * ✅ تنظيف headers من القيم غير الصحيحة
 * يزيل جميع القيم undefined/null/empty ويضمن أن جميع header names و values صحيحة
 */
const cleanHeaders = (headers) => {
  try {
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
      return {};
    }

    const cleaned = {};
    const keys = Object.keys(headers);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      // ✅ تخطي إذا كان key undefined/null
      if (key === undefined || key === null) {
        continue;
      }

      // ✅ التأكد من أن key صحيح (string وليس empty)
      const keyStr = String(key).trim();
      if (!keyStr) {
        continue;
      }

      // ✅ منع تعيين Accept-Encoding - المتصفح يديره تلقائياً
      // Browsers automatically manage Accept-Encoding header, we cannot set it manually
      if (keyStr.toLowerCase() === 'accept-encoding') {
        continue;
      }

      // ✅ الحصول على value بشكل آمن
      let value;
      try {
        value = headers[key];
      } catch (e) {
        continue;
      }

      // ✅ تخطي القيم undefined/null
      if (value === undefined || value === null) {
        continue;
      }

      // ✅ تحويل value إلى string بشكل آمن
      let stringValue;
      try {
        if (typeof value === 'string') {
          stringValue = value.trim();
          // ✅ تخطي empty strings
          if (!stringValue) {
            continue;
          }
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          stringValue = String(value);
        } else if (typeof value === 'object') {
          // ✅ تخطي objects (مثل FormData)
          continue;
        } else {
          // ✅ تخطي القيم غير المدعومة
          continue;
        }
      } catch (e) {
        continue;
      }

      // ✅ إضافة header فقط إذا كان key و value صحيحين
      if (keyStr && stringValue) {
        cleaned[keyStr] = stringValue;
      }
    }

    return cleaned;
  } catch (e) {
    // ✅ في حالة أي خطأ، إرجاع headers فارغة
    if (import.meta.env.DEV) {
      console.warn('Error in cleanHeaders:', e);
    }
    return {};
  }
};

// ✅ تنظيف الـ cache كل دقيقة
setInterval(cleanExpiredCache, 60000);

// ✅ تحديد API URL بناءً على إعدادات .env فقط (بدون إجبار proxy في dev)
const getApiUrl = () => {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  const useProxy = import.meta.env.VITE_API_USE_PROXY === 'true' || import.meta.env.VITE_API_USE_PROXY === '1';

  // إذا كان VITE_API_USE_PROXY=true استخدم proxy محلي
  if (useProxy) {
    return '/api';
  }

  // استخدم VITE_API_URL مباشرة (سواء في dev أو production)
  return envUrl || 'https://forms-api.saiid.org/api';
};

const API_URL = getApiUrl();
// ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
// يمكن إعادة تفعيله عند الحاجة للتطوير: console.log('🔗 API Configuration:', {...});

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // ✅ إضافة headers لمنع browser caching
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    // ✅ ملاحظة: Accept-Encoding يتم إضافته تلقائياً من المتصفح
    // لا يمكن تعيينه يدوياً لأنه header محمي
  },
  timeout: 30000, // 30 seconds timeout (زيادة لتقليل timeout errors)
  withCredentials: false, // ✅ تعطيل credentials عند استخدام proxy (يتم التعامل معها في Vite proxy)
  // ✅ دعم ETag و 304 Not Modified
  validateStatus: (status) => {
    // قبول 304 Not Modified كاستجابة صالحة
    return (status >= 200 && status < 300) || status === 304;
  },
  // ✅ تحسين معالجة headers - تنظيف القيم undefined/null/empty
  transformRequest: [
    (data, headers) => {
      // ✅ تنظيف headers بشكل شامل
      if (headers && typeof headers === 'object') {
        try {
          const cleaned = cleanHeaders(headers);
          // ✅ استبدال headers بالنسخة النظيفة بشكل آمن
          const keysToDelete = Object.keys(headers);
          keysToDelete.forEach(key => {
            try {
              delete headers[key];
            } catch (e) {
              // تجاهل الأخطاء في الحذف
            }
          });
          // ✅ إضافة headers النظيفة
          Object.keys(cleaned).forEach(key => {
            try {
              headers[key] = cleaned[key];
            } catch (e) {
              // تجاهل الأخطاء في الإضافة
            }
          });
        } catch (e) {
          // ✅ في حالة الخطأ، إنشاء headers جديدة نظيفة
          if (import.meta.env.DEV) {
            console.warn('Error cleaning headers in transformRequest:', e);
          }
          const cleaned = cleanHeaders(headers);
          Object.keys(headers).forEach(key => {
            try {
              delete headers[key];
            } catch (e) { }
          });
          Object.assign(headers, cleaned);
        }
      } else if (!headers) {
        // ✅ إذا كان headers undefined/null، إنشاء object جديد
        headers = {};
      }

      // ✅ إزالة Accept-Encoding بشكل صريح - المتصفح يديره تلقائياً
      // Browsers automatically manage Accept-Encoding header, we cannot set it manually
      if (headers) {
        delete headers['Accept-Encoding'];
        delete headers['accept-encoding'];
      }

      // ✅ التأكد من أن Content-Type موجود للطلبات التي تحتاج JSON
      if (headers && !headers['Content-Type'] && !headers['content-type']) {
        // ✅ إذا كانت البيانات FormData، لا نضيف Content-Type (سيتم إضافته تلقائياً)
        if (!(data instanceof FormData)) {
          headers['Content-Type'] = 'application/json';
        }
      }

      // ✅ تحويل البيانات إلى JSON string إذا كانت object وليست FormData أو string
      if (data !== null && data !== undefined) {
        if (data instanceof FormData) {
          // ✅ FormData - نعيدها كما هي
          return data;
        } else if (typeof data === 'string') {
          // ✅ String - نعيدها كما هي
          return data;
        } else if (typeof data === 'object') {
          // ✅ Object - نحولها إلى JSON string
          try {
            return JSON.stringify(data);
          } catch (e) {
            if (import.meta.env.DEV) {
              console.error('Error stringifying data in transformRequest:', e);
            }
            return data;
          }
        }
      }

      return data;
    }
  ],
});

// Request interceptor to add auth token and handle deduplication
apiClient.interceptors.request.use(
  (config) => {
    // ✅ التأكد من وجود headers object
    if (!config.headers || typeof config.headers !== 'object') {
      config.headers = {};
    }

    // ✅ تنظيف headers بشكل شامل قبل أي معالجة
    config.headers = cleanHeaders(config.headers);

    // ✅ إزالة Accept-Encoding بشكل صريح - المتصفح يديره تلقائياً
    // Browsers automatically manage Accept-Encoding header, we cannot set it manually
    if (config.headers) {
      delete config.headers['Accept-Encoding'];
      delete config.headers['accept-encoding'];
    }

    // ✅ إضافة Authorization header إذا كان token موجوداً
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token && typeof token === 'string' && token.trim()) {
      config.headers.Authorization = `Bearer ${token.trim()}`;
    }

    // ✅ إضافة Cache-Control headers لمنع browser caching
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';

    // ✅ إضافة timestamp لـ GET requests لكسر الكاش (إلا إذا كان skipCacheTimestamp = true)
    // ✅ تحسين: استخدام timestamp مشترك للطلبات المتشابهة في نفس الثانية لتقليل الطلبات
    if (config.method === 'get' && !config.skipCacheTimestamp) {
      if (!config.params) {
        config.params = {};
      }
      // ✅ استخدام timestamp مشترك للطلبات في نفس الثانية (تقليل الطلبات المكررة)
      // إذا كان الطلب يحتوي على _t مسبقاً (من force refresh)، نستخدمه
      if (!config.params._t) {
        // ✅ تقريب timestamp إلى أقرب ثانية لتجميع الطلبات المتشابهة
        const roundedTimestamp = Math.floor(Date.now() / 1000) * 1000;
        config.params._t = roundedTimestamp;
      }
    }

    // ✅ إذا كانت البيانات FormData، إزالة Content-Type للسماح لـ axios بإضافته تلقائياً مع boundary
    // ✅ ملاحظة: transformRequest يتعامل مع Content-Type أيضاً، لكن نضيفه هنا كإجراء احتياطي
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }

    // ✅ Debug: عرض معلومات الطلب في وضع التطوير (خاصة لطلبات login)
    if (import.meta.env.DEV && config.url?.includes('/login')) {
      console.log('🔍 Request Config:', {
        url: config.url,
        method: config.method,
        data: config.data,
        dataType: typeof config.data,
        isFormData: config.data instanceof FormData,
        headers: {
          'Content-Type': config.headers['Content-Type'] || config.headers['content-type'],
          'Accept': config.headers['Accept'] || config.headers['accept'],
        },
      });
    }

    // ✅ حفظ silent flag في config للوصول إليه في response interceptor
    if (config.silent !== undefined) {
      config._silent = config.silent;
    }

    // ✅ Request Deduplication: منع الطلبات المكررة (GET فقط)
    if (config.method === 'get' && !config.skipDeduplication) {
      const requestKey = getRequestKey(config);

      // ✅ التحقق من الـ cache أولاً (قبل التحقق من الطلبات الجارية)
      const cached = responseCache.get(requestKey);

      // ✅ تحديد مدة الـ cache بناءً على نوع الطلب
      const isFrequentEndpoint = config.url?.includes('/notifications/unread-count') ||
        config.url?.includes('/warehouse') ||
        config.url?.includes('/user/');
      const cacheDuration = isFrequentEndpoint ? LONG_CACHE_DURATION : CACHE_DURATION;

      if (cached && (Date.now() - cached.timestamp) < cacheDuration) {
        // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
        // ✅ استخدام helper function لبناء response موحد
        const responseObj = buildAxiosResponse(
          {
            ...config,
            method: config.method || 'get',
            url: config.url || '',
            headers: cleanHeaders(config.headers || {}),
          },
          cached
        );

        // ✅ بدل ما نرجّع response من interceptor: نخلي axios يعتقد أنه request طبيعي لكن adapter يرجّع الكاش
        config.adapter = async () => responseObj;

        return config;
      }

      // ✅ التحقق من وجود طلب جاري بنفس المفتاح
      // إذا كان هناك طلب جاري، ننتظر استجابته بدلاً من إلغاء الطلب
      if (pendingRequests.has(requestKey)) {
        // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
        // ✅ انتظار استجابة الطلب الجاري
        const pendingRequest = pendingRequests.get(requestKey);
        if (!pendingRequest.waiting) {
          pendingRequest.waiting = [];
        }

        // ✅ التأكد من أن config يحتوي على method قبل إرجاع promise
        const configWithMethod = {
          ...config,
          method: config.method || 'get',
          url: config.url || '',
          headers: cleanHeaders(config.headers || {}),
        };

        // ✅ بدل ما نرجّع promise من interceptor: نخلي axios يستخدم adapter خاص يرجع promise
        config.adapter = () =>
          new Promise((resolve, reject) => {
            pendingRequest.waiting.push({ resolve, reject, config: configWithMethod });
          });

        return config;
      }

      // ✅ إضافة If-None-Match header إذا كان ETag موجوداً
      const storedEtag = etagStorage.get(requestKey);
      if (storedEtag && typeof storedEtag === 'string' && storedEtag.trim()) {
        // ✅ التأكد من أن headers موجود وليس undefined
        if (!config.headers || typeof config.headers !== 'object') {
          config.headers = {};
        }
        const trimmedEtag = storedEtag.trim();
        if (trimmedEtag) {
          // ✅ تنظيف headers مرة أخرى قبل إضافة If-None-Match
          config.headers = cleanHeaders(config.headers);
          config.headers['If-None-Match'] = trimmedEtag;
          // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
        }
      }

      // ✅ إضافة الطلب إلى قائمة الطلبات الجارية
      // ✅ إنشاء pendingRequest object مع قائمة المنتظرين
      const pendingRequest = {
        config: config,
        waiting: [], // قائمة الطلبات المنتظرة
      };

      pendingRequests.set(requestKey, pendingRequest);

      // ✅ إضافة requestKey إلى config للوصول إليه في response interceptor
      config._requestKey = requestKey;
    }

    // ✅ التأكد من أن config يحتوي على جميع الخصائص المطلوبة
    if (!config.method) {
      config.method = 'get';
    }

    // ✅ التأكد من أن method هو string
    if (typeof config.method !== 'string') {
      config.method = String(config.method).toLowerCase();
    }

    // ✅ تنظيف headers نهائياً قبل إرجاع config (لضمان عدم وجود undefined/null)
    if (config.headers) {
      config.headers = cleanHeaders(config.headers);
    } else {
      config.headers = {};
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors and caching
apiClient.interceptors.response.use(
  (response) => {
    // ✅ إبطال الكاش بعد أي عملية تحديث (POST/PUT/PATCH/DELETE)
    const method = response.config?.method?.toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      // ✅ مسح response cache بعد التحديث
      responseCache.clear();

      // ✅ مسح ETag storage
      etagStorage.clear();

      // ✅ إرسال event لإعلام المكونات الأخرى
      window.dispatchEvent(new CustomEvent('cache-invalidated', {
        detail: {
          cacheKey: 'all',
          method: method,
          url: response.config?.url
        }
      }));

      if (import.meta.env.DEV) {
        console.log(`✅ Cache invalidated after ${method.toUpperCase()} request: ${response.config?.url}`);
      }
    }

    // ✅ Request Deduplication: معالجة الطلبات المكررة
    if (response.config?._requestKey) {
      const requestKey = response.config._requestKey;
      const pendingRequest = pendingRequests.get(requestKey);

      if (pendingRequest) {
        // ✅ معالجة 304 Not Modified
        if (response.status === 304) {
          // ✅ تم إزالة console.log لتقليل الضوضاء في الكونسول
          // استخدام البيانات من الـ cache
          const cached = responseCache.get(requestKey);
          if (cached) {
            // ✅ التأكد من أن config يحتوي على جميع الخصائص المطلوبة
            const responseConfig = response.config || {};
            const fullConfig = {
              ...responseConfig,
              method: responseConfig.method || 'get',
              url: responseConfig.url || '',
              headers: cleanHeaders(responseConfig.headers || {}),
            };

            // ✅ استخدام helper function لبناء response موحد مع status 304
            const cachedResponseObj = buildAxiosResponse(fullConfig, {
              ...cached,
              status: 304,
              statusText: 'Not Modified',
              headers: cached.headers || response.headers || {},
            });

            // ✅ حل جميع الطلبات المنتظرة
            if (pendingRequest.waiting && pendingRequest.waiting.length > 0) {
              pendingRequest.waiting.forEach(waiter => {
                waiter.resolve(cachedResponseObj);
              });
            }

            // ✅ إزالة الطلب من قائمة الطلبات الجارية
            pendingRequests.delete(requestKey);

            return cachedResponseObj;
          }
        }

        // ✅ حفظ ETag من الاستجابة
        const etag = response.headers?.etag || response.headers?.ETag || response.headers?.get?.('etag');
        if (etag && response.config?.method === 'get') {
          etagStorage.set(requestKey, etag);
        }

        // ✅ حفظ الاستجابة في الـ cache (GET فقط)
        // ✅ خزن payload موحّد مباشرة بدون response wrapper
        if (response.config?.method === 'get' && response.status === 200 && !response.fromCache) {
          // ✅ تحديد مدة الـ cache بناءً على نوع الطلب
          const isFrequentEndpoint = response.config?.url?.includes('/notifications/unread-count') ||
            response.config?.url?.includes('/warehouse') ||
            response.config?.url?.includes('/user/');

          responseCache.set(requestKey, {
            data: response.data, // ✅ مهم: خزن data مباشرة
            status: response.status,
            statusText: response.statusText,
            headers: response.headers || {},
            timestamp: Date.now(),
            etag: etag,
            cacheDuration: isFrequentEndpoint ? LONG_CACHE_DURATION : CACHE_DURATION, // ✅ حفظ مدة الـ cache
          });
        }

        // ✅ حل جميع الطلبات المنتظرة بنفس الاستجابة
        if (pendingRequest.waiting && pendingRequest.waiting.length > 0) {
          pendingRequest.waiting.forEach(waiter => {
            // ✅ إنشاء نسخة من الاستجابة لكل waiter
            const waiterConfig = waiter.config || response.config || {};
            const fullConfig = {
              ...waiterConfig,
              method: waiterConfig.method || response.config?.method || 'get',
              url: waiterConfig.url || response.config?.url || '',
              headers: cleanHeaders(waiterConfig.headers || response.config?.headers || {}),
            };
            waiter.resolve({
              ...response,
              config: fullConfig,
            });
          });
          // ✅ مسح قائمة المنتظرين
          pendingRequest.waiting = [];
        }

        // ✅ إزالة الطلب من قائمة الطلبات الجارية
        pendingRequests.delete(requestKey);
      }
    }

    return response;
  },
  (error) => {
    // ✅ Request Deduplication: معالجة الأخطاء في الطلبات المكررة
    if (error.config?._requestKey) {
      const requestKey = error.config._requestKey;
      const pendingRequest = pendingRequests.get(requestKey);

      if (pendingRequest) {
        // ✅ حل جميع الطلبات المنتظرة بنفس الخطأ
        if (pendingRequest.waiting && pendingRequest.waiting.length > 0) {
          pendingRequest.waiting.forEach(waiter => {
            waiter.reject(error);
          });
          // ✅ مسح قائمة المنتظرين
          pendingRequest.waiting = [];
        }

        // ✅ إزالة الطلب من قائمة الطلبات الجارية
        pendingRequests.delete(requestKey);
      }
    }

    // ✅ معالجة CanceledError - لا نعرضه كخطأ (يتم التعامل معه في الكود الذي يستدعي API)
    if (axios.isCancel(error)) {
      // ✅ محاولة استخدام الـ cache إذا كان متاحاً
      if (error.config?._requestKey) {
        const requestKey = error.config._requestKey;
        const cached = responseCache.get(requestKey);
        if (cached) {
          if (import.meta.env.DEV) {
            console.log(`💾 Using cached response for canceled request: ${error.config?.url}`);
          }
          // ✅ استخدام helper function لبناء response موحد
          const errorConfig = error.config || {};
          const responseConfig = {
            ...errorConfig,
            method: errorConfig.method || 'get',
            url: errorConfig.url || '',
            headers: cleanHeaders(errorConfig.headers || {}),
          };
          const cachedResponseObj = buildAxiosResponse(responseConfig, cached);
          return Promise.resolve(cachedResponseObj);
        }
      }
      // ✅ إذا لم يكن هناك cache، نرمي الخطأ بصمت (لا نعرضه للمستخدم)
      error.silent = true;
      error.userMessage = '';
      error.isCanceled = true;
      return Promise.reject(error);
    }

    // ✅ تجاهل أخطاء 401 في طلب logout (طبيعي عند تسجيل الخروج)
    if (error.response?.status === 401) {
      const isLogoutRequest = error.config?.url?.includes('/logout') ||
        error.config?.url?.endsWith('/logout') ||
        error.config?.url === '/logout' ||
        error.config?.url === '/api/logout';

      if (isLogoutRequest) {
        error.isLogoutError = true;
        error.userMessage = '';
        error.suggestion = '';
        error.silent = true; // علامة لإخفاء الخطأ من console
        error.isConnectionError = true; // ✅ إخفاء الخطأ من Network tab
        // إرجاع promise مرفوض بصمت (بدون عرض رسالة خطأ)
        return Promise.reject(error);
      }

      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      // إذا لم يكن هناك token، يعني أن المستخدم سجل خروجاً بالفعل
      if (!token) {
        error.isLogoutError = true;
        error.userMessage = '';
        error.suggestion = '';
        error.silent = true;
        error.isConnectionError = true; // ✅ إخفاء الخطأ من Network tab
        // إرجاع promise مرفوض بصمت (بدون عرض رسالة خطأ)
        return Promise.reject(error);
      }
    }

    // Handle CORS errors specifically (يجب أن يكون قبل connection errors)
    // CORS errors عادة لا تحتوي على response وتأتي مع error.request.status === 0
    // أو تأتي مع error.code === 'ERR_FAILED' و error.message يحتوي على CORS
    const isCorsError = (
      error.message?.includes('CORS') ||
      error.message?.includes('Access-Control-Allow-Origin') ||
      error.message?.includes('blocked by CORS policy') ||
      (!error.response && error.code === 'ERR_FAILED' && error.request?.status === 0) ||
      (!error.response && error.message?.includes('Failed to fetch'))
    );

    if (isCorsError) {
      error.isCorsError = true;
      error.isConnectionError = true; // نعاملها كـ connection error
      error.userMessage = 'خطأ CORS: الخادم لا يسمح بالطلبات من هذا المصدر.';
      error.suggestion = `تأكد من إعدادات CORS في Backend Laravel:
1. افتح ملف config/cors.php
2. أضف 'http://localhost:5173' في allowed_origins
3. تأكد من أن supports_credentials = true
4. أعد تشغيل Backend: php artisan serve`;
      error.errorType = 'cors';
    }
    // Handle timeout errors specifically
    else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.isTimeoutError = true;
      // ✅ إزالة رسالة timeout لتجنب إزعاج المستخدم
      error.userMessage = ''; // رسالة فارغة - لا نعرض رسالة timeout
      error.suggestion = 'يرجى المحاولة مرة أخرى أو التحقق من سرعة الاتصال بالإنترنت.';
      error.errorType = 'timeout';
      error.silent = true; // علامة لإخفاء الخطأ من toast
    }
    // Handle connection refused errors specifically
    else if (error.code === 'ERR_NETWORK' || error.message?.includes('ERR_CONNECTION_REFUSED') ||
      (error.request && !error.response && error.message?.includes('Network Error'))) {
      error.isConnectionError = true;
      error.userMessage = 'لا يمكن الاتصال بالخادم. يرجى التأكد من أن Backend يعمل على ' + API_URL;
      error.suggestion = 'تأكد من تشغيل Laravel Backend: php artisan serve';
      error.errorType = 'connection';
    } else {
      // ✅ Get user-friendly error message مع معالجة الأخطاء
      try {
        const userMessage = getErrorMessage(error);
        const suggestion = getErrorSuggestion(error);
        error.userMessage = userMessage || errorMessages.general.unexpected;
        error.suggestion = suggestion;
        error.errorType = getErrorType(error);
      } catch (err) {
        // ✅ في حالة فشل getErrorMessage، نستخدم رسالة افتراضية
        console.warn('Error in getErrorMessage:', err);
        error.userMessage = errorMessages.general.unexpected;
        error.suggestion = null;
        error.errorType = 'unknown';
      }
    }

    // Handle 422 Unprocessable Entity (Validation errors)
    if (error.response?.status === 422) {
      const errorData = error.response.data;

      // ✅ في وضع التطوير، عرض تفاصيل أخطاء التحقق
      if (import.meta.env.DEV) {
        console.error('🔴 Validation Error (422):', {
          url: error.config?.url,
          method: error.config?.method || 'UNKNOWN',
          data: error.config?.data,
          errors: errorData?.errors,
          message: errorData?.message,
        });
      }

      // ✅ إذا كان هناك أخطاء تحقق مفصلة، نضيفها للخطأ
      if (errorData?.errors) {
        error.validationErrors = errorData.errors;
      }

      // ✅ استخدام رسالة الخطأ من Backend إذا كانت موجودة
      if (errorData?.message) {
        error.userMessage = errorData.message;
      } else if (errorData?.errors) {
        // ✅ بناء رسالة من أخطاء التحقق
        const errorFields = Object.keys(errorData.errors);
        const errorMessages = errorFields.map(field => {
          const fieldErrors = errorData.errors[field];
          if (Array.isArray(fieldErrors)) {
            return fieldErrors[0];
          }
          return fieldErrors;
        });

        if (errorMessages.length > 0) {
          error.userMessage = errorMessages.join('، ');
        }
      }

      error.isValidationError = true;
    }

    // Handle 403 Forbidden errors (Permission denied)
    if (error.response?.status === 403) {
      const errorData = error.response.data;

      // ✅ تجاهل أخطاء 403 من warehouse API بصمت (متوقع - المستخدم قد لا يكون لديه صلاحيات)
      const isWarehouseEndpoint = error.config?.url?.includes('/warehouse') ||
        error.config?.url?.includes('/projects/') && error.config?.url?.includes('/warehouse');

      // ✅ تجاهل أخطاء 403 من dashboard API بصمت (متوقع - المستخدم قد لا يكون لديه صلاحيات)
      const isDashboardEndpoint = error.config?.url?.includes('/dashboard') ||
        error.config?.url?.includes('project-proposals-dashboard');

      // ✅ تجاهل أخطاء 403 من montage-producers API بصمت (متوقع - قد يتطلب صلاحيات خاصة)
      const isMontageProducersEndpoint = error.config?.url?.includes('/montage-producers');

      if (isWarehouseEndpoint || isDashboardEndpoint || isMontageProducersEndpoint || error.config?._silent || error.config?.silent) {
        error.silent = true; // ✅ إخفاء الخطأ من console
        error.userMessage = ''; // ✅ لا نعرض رسالة للمستخدم
        error.isPermissionError = true;
        error.shouldIgnore = true; // ✅ علامة إضافية لتجاهل الخطأ
        if (import.meta.env.DEV && !isDashboardEndpoint && !isMontageProducersEndpoint) {
          console.log('ℹ️ API 403 (expected) - User may not have required permissions');
        }
        return Promise.reject(error);
      }

      // ✅ استخدام الرسالة من الـ Backend إذا كانت موجودة
      if (errorData?.message) {
        error.userMessage = errorData.message;
      } else {
        error.userMessage = 'ليس لديك صلاحيات للوصول إلى هذا القسم. الصلاحيات مقتصرة على الإدارة فقط.';
      }
      error.isPermissionError = true;
      error.requiredRoles = errorData?.required_roles || [];
      error.userRole = errorData?.your_role;
    }

    // Handle database schema errors specifically
    if (error.response?.data?.message) {
      const errorMessage = error.response.data.message;

      if (errorMessage.includes('api_token') ||
        errorMessage.includes('Column not found') ||
        errorMessage.includes('SQLSTATE[42S22]')) {
        console.error('Database schema error detected:', errorMessage);
        error.isDatabaseError = true;
        error.userMessage = 'خطأ في إعدادات قاعدة البيانات. يرجى الاتصال بالدعم الفني.';
      }
    }

    // Log error for debugging (only in development)
    // ✅ تقليل الرسائل المكررة - لا نعرض أخطاء الاتصال و timeout بشكل متكرر
    if (import.meta.env.DEV) {
      // ✅ تجاهل أخطاء الاتصال و timeout و 404 و 401 بعد تسجيل الخروج و 403 من warehouse لتجنب spam
      const shouldLog = !error.isConnectionError &&
        !error.isTimeoutError &&
        !error.isLogoutError &&
        !error.silent &&
        !error.shouldIgnore && // ✅ تجاهل الأخطاء المحددة للـ ignore
        error.code !== 'ECONNABORTED' &&
        error.code !== 'ERR_CANCELED' &&
        error.message !== 'canceled' &&
        error.name !== 'AbortError' &&
        error.response?.status !== 404 &&
        error.response?.status !== 500; // ✅ عدم تسجيل 500 في الكونسول (مشكلة في Backend)

      if (shouldLog) {
        // ✅ Safe access to method and statusText with defensive checks
        const method = error.config?.method ? String(error.config.method).toUpperCase() : 'UNKNOWN';
        const statusText = error.response?.statusText ? String(error.response.statusText) : 'UNKNOWN';

        console.error('API Error:', {
          message: error.message,
          userMessage: error.userMessage,
          status: error.response?.status,
          statusText: statusText,
          method: method,
          url: error.config?.url || 'UNKNOWN',
          data: error.response?.data,
          suggestion: error.suggestion,
          code: error.code,
          isConnectionError: error.isConnectionError,
          isLogoutError: error.isLogoutError,
          apiUrl: API_URL,
        });
      }

      // Show helpful message for connection errors (مرة واحدة فقط)
      if (error.isConnectionError && !window.__connectionErrorShown) {
        window.__connectionErrorShown = true;

        if (error.isCorsError) {
          const frontendUrl = window.location.origin;
          console.error('🚫 CORS Error Detected!');
          console.error('📌 المشكلة: Backend لا يسمح بالطلبات من Frontend');
          console.error('📌 الحل في Backend Laravel:');
          console.error('   1. افتح ملف: config/cors.php');
          console.error('   2. أضف Frontend URL في allowed_origins:');
          console.error(`      "allowed_origins" => ["${frontendUrl}", "http://localhost:5173", "http://localhost:5174"],`);
          console.error('   3. تأكد من:');
          console.error('      "supports_credentials" => true,');
          console.error('      "allowed_methods" => ["*"],');
          console.error('      "allowed_headers" => ["*"],');
          console.error('   4. أعد تشغيل Backend: php artisan serve');
          console.error('📌 Current API URL:', API_URL);
          console.error('📌 Frontend URL:', frontendUrl);
        } else {
          console.warn('⚠️ Connection Error Detected!');
          console.warn('📌 Make sure Backend is running:');
          console.warn('   1. Navigate to your Laravel backend directory');
          console.warn('   2. Run: php artisan serve');
          console.warn('   3. Or set VITE_API_URL in .env file');
          console.warn('📌 Current API URL:', API_URL);
        }

        // إعادة تعيين بعد 5 ثوان
        setTimeout(() => {
          window.__connectionErrorShown = false;
        }, 5000);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * تحديد نوع الخطأ
 * @param {Error} error - كائن الخطأ
 * @returns {string} نوع الخطأ
 */
function getErrorType(error) {
  if (error.response) {
    const status = error.response.status;

    if (status === 401 || status === 403) {
      return 'authentication';
    }

    if (status >= 500) {
      return 'server';
    }

    if (status === 404) {
      return 'notFound';
    }

    if (status === 422) {
      return 'validation';
    }

    if (status >= 400) {
      return 'client';
    }
  }

  if (error.request && !error.response) {
    return 'network';
  }

  if (error.message?.includes('timeout')) {
    return 'timeout';
  }

  return 'unknown';
}

/**
 * ✅ دالة لإجبار التحديث (مسح جميع الكاشات)
 * يمكن استدعاؤها بعد أي عملية تحديث لضمان جلب أحدث البيانات
 */
export const forceRefreshCache = () => {
  // ✅ مسح response cache
  responseCache.clear();

  // ✅ مسح ETag storage
  etagStorage.clear();

  // ✅ مسح pending requests
  pendingRequests.clear();

  // ✅ إرسال event لإعلام المكونات الأخرى
  window.dispatchEvent(new CustomEvent('cache-invalidated', {
    detail: { cacheKey: 'all', force: true }
  }));

  if (import.meta.env.DEV) {
    console.log('✅ All caches cleared - force refresh');
  }
};

/**
 * ✅ دالة لإبطال كاش معين
 * @param {string} cacheKey - مفتاح الكاش (مثل: 'projects', 'admin_projects')
 */
export const invalidateCache = (cacheKey) => {
  // ✅ مسح من response cache (البحث عن جميع المفاتيح التي تحتوي على cacheKey)
  const keysToDelete = [];
  for (const key of responseCache.keys()) {
    if (key.includes(cacheKey) || key.includes(cacheKey.replace('_', '-'))) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => responseCache.delete(key));

  // ✅ إرسال event لإعلام المكونات الأخرى
  window.dispatchEvent(new CustomEvent('cache-invalidated', {
    detail: { cacheKey }
  }));

  if (import.meta.env.DEV) {
    console.log(`✅ Cache invalidated: ${cacheKey}`);
  }
};

/**
 * ✅ قاعدة URL لتحميل الصور (مثل صور الملاحظات).
 * في الإنتاج تُستخدم دائماً عنوان الـ API الكامل حتى تعمل الصور من دومين الـ Backend وليس من دومين الواجهة.
 */
export const getImageBaseUrl = () => {
  const base = apiClient.defaults.baseURL || import.meta.env.VITE_API_URL || 'https://forms-api.saiid.org/api';
  const baseStr = typeof base === 'string' ? base.trim() : '';
  if (import.meta.env.PROD && (baseStr.startsWith('/') || !baseStr.startsWith('http'))) {
    const full = (import.meta.env.VITE_API_URL || 'https://forms-api.saiid.org/api').trim().replace(/\/$/, '');
    return full.startsWith('http') ? full : 'https://forms-api.saiid.org/api';
  }
  return baseStr || 'https://forms-api.saiid.org/api';
};

export default apiClient;