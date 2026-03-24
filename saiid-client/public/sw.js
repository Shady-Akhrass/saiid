// Service Worker للتخزين المؤقت وتحسين الأداء
// ✅ تحسين Cache Versioning: استخدام timestamp للإصدار
const APP_VERSION = '3.0.2';
const CACHE_NAME = `saiid-client-v${APP_VERSION}`;
const STATIC_CACHE_NAME = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE_NAME = `${CACHE_NAME}-dynamic`;
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 أيام

// ✅ Cache API يدعم فقط http و https — لا تخزن chrome-extension: أو blob: أو غيرها
const isCacheableRequest = (request) => {
  try {
    const url = new URL(request.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// ✅ التحقق من أن استجابة ملف ثابت (js/css) ليست HTML (يمنع خطأ MIME بعد إعادة التوجيه)
const isValidStaticResponse = (requestUrl, response) => {
  if (!response || !response.headers) return false;
  const ct = (response.headers.get('Content-Type') || '').toLowerCase();
  if (ct.includes('text/html')) {
    if (requestUrl.match(/\.(js|m?js)$/)) return false;
    if (requestUrl.match(/\.css$/)) return false;
  }
  return true;
};

const CACHE_URLS = [
  '/',
  '/index.html',
  '/assets/logo.jpg',
];

// ✅ دالة لتنظيف الـ cache القديم
const cleanOldCaches = async () => {
  try {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter(name =>
      name.startsWith('saiid-client-') && name !== CACHE_NAME && name !== STATIC_CACHE_NAME && name !== DYNAMIC_CACHE_NAME
    );
    await Promise.all(oldCaches.map(name => {
      console.log(`Deleting old cache: ${name}`);
      return caches.delete(name);
    }));
  } catch (error) {
    console.warn('Error cleaning old caches:', error);
  }
};

// ✅ دالة للتحقق من عمر الـ cache
const isCacheExpired = async (cacheName, maxAge = MAX_CACHE_AGE) => {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length === 0) return true;

    // التحقق من أول مفتاح
    const firstRequest = keys[0];
    const response = await cache.match(firstRequest);
    if (!response) return true;

    const dateHeader = response.headers.get('date');
    if (!dateHeader) return false;

    const cacheDate = new Date(dateHeader);
    const now = new Date();
    return (now - cacheDate) > maxAge;
  } catch (error) {
    console.warn('Error checking cache expiration:', error);
    return false;
  }
};

// التثبيت - تخزين الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        // ✅ استخدام Promise.allSettled لتخزين الملفات المتاحة فقط
        // حتى لو فشل أحد الملفات، سيتم تخزين البقية
        return Promise.allSettled(
          CACHE_URLS.map((url) => {
            return fetch(url)
              .then((response) => {
                // ✅ التحقق من أن الاستجابة ناجحة قبل التخزين
                if (response && response.status === 200 && response.type === 'basic') {
                  // ✅ إضافة headers للتحكم في عمر الـ cache
                  const headers = new Headers(response.headers);
                  headers.set('sw-cache-date', new Date().toISOString());
                  headers.set('sw-cache-version', APP_VERSION);

                  return cache.put(url, new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: headers
                  }));
                } else {
                  console.warn(`Skipping cache for ${url}: Invalid response`, response?.status);
                  return null;
                }
              })
              .catch((error) => {
                console.warn(`Failed to cache ${url}:`, error);
                // لا نرمي الخطأ، فقط نسجله
                return null;
              });
          })
        );
      })
      .then(() => cleanOldCaches())
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
        // حتى لو فشل التثبيت، نستمر في العمل
        return self.skipWaiting();
      })
  );
});

// التفعيل - حذف الـ caches القديمة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      cleanOldCaches(),
      // ✅ تنظيف الـ dynamic cache القديم
      caches.open(DYNAMIC_CACHE_NAME)
        .then(async (cache) => {
          const keys = await cache.keys();
          const now = Date.now();
          const expiredKeys = [];

          for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
              const cacheDate = response.headers.get('sw-cache-date');
              if (cacheDate) {
                const age = now - new Date(cacheDate).getTime();
                if (age > MAX_CACHE_AGE) {
                  expiredKeys.push(request);
                }
              }
            }
          }

          await Promise.all(expiredKeys.map(key => cache.delete(key)));
          if (expiredKeys.length > 0) {
            console.log(`Cleaned ${expiredKeys.length} expired cache entries`);
          }
        })
        .catch(error => console.warn('Error cleaning dynamic cache:', error))
    ])
      .then(() => self.clients.claim())
  );
});

// الاستماع للطلبات - استخدام استراتيجية Cache First للملفات الثابتة و Network First للصفحات
self.addEventListener('fetch', (event) => {
  // تخطي الطلبات غير GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // ✅ لا نعترض طلبات JS و CSS — المتصفح يجلبها مباشرة (يمنع خطأ MIME وعدم ظهور التنسيق)
  if (url.pathname.startsWith('/js/') || (url.pathname.startsWith('/assets/') && event.request.url.match(/\.(js|css)(\?|$)/)) || event.request.url.match(/\.(js|css)(\?|$)/)) {
    return;
  }

  // ✅ تخطي طلبات API - نريد أن تكون دائماً حديثة (Network Only)
  if (url.pathname.includes('/api/') || url.hostname.includes('forms-api.saiid.org')) {
    return fetch(event.request).catch(() => {
      // في حالة فشل الطلب، نعيد استجابة offline
      return new Response(JSON.stringify({
        error: 'Offline',
        message: 'لا يوجد اتصال بالإنترنت'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  }

  // ✅ استراتيجية Cache First للصور والخطوط فقط (JS و CSS لا نعترضهم أعلاه)
  if (event.request.url.match(/\.(png|jpg|jpeg|gif|svg|webp|avif|woff|woff2|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          // ✅ إذا الـ cache يحتوي HTML لطلب js/css (خطأ MIME) — احذفه ولا تستخدمه
          if (cachedResponse && !isValidStaticResponse(event.request.url, cachedResponse)) {
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.delete(event.request)).catch(() => { });
            return null;
          }
          if (cachedResponse) {
            // ✅ إضافة If-None-Match header إذا كان ETag موجوداً في الـ cache
            const cachedEtag = cachedResponse.headers.get('ETag') || cachedResponse.headers.get('etag');
            if (cachedEtag) {
              const fetchOptions = {
                headers: {
                  'If-None-Match': cachedEtag
                }
              };

              return fetch(event.request, fetchOptions)
                .then((networkResponse) => {
                  // ✅ إذا كانت الاستجابة 304 Not Modified، نستخدم الـ cache
                  if (networkResponse.status === 304) {
                    return cachedResponse;
                  }

                  // ✅ إذا تغيرت البيانات ونوعها صحيح، نحدث الـ cache (فقط لـ http(s))
                  if (isCacheableRequest(event.request) && networkResponse.status === 200 && networkResponse.type === 'basic' && isValidStaticResponse(event.request.url, networkResponse)) {
                    const responseToCache = networkResponse.clone();
                    const headers = new Headers(responseToCache.headers);
                    headers.set('sw-cache-date', new Date().toISOString());
                    headers.set('sw-cache-version', APP_VERSION);

                    caches.open(STATIC_CACHE_NAME)
                      .then((cache) => {
                        cache.put(event.request, new Response(responseToCache.body, {
                          status: responseToCache.status,
                          statusText: responseToCache.statusText,
                          headers: headers
                        }));
                      })
                      .catch((error) => {
                        console.warn(`Failed to cache ${event.request.url}:`, error);
                      });
                  }

                  return networkResponse;
                })
                .catch(() => {
                  return cachedResponse;
                });
            }

            return cachedResponse;
          }

          // ✅ لا يوجد cache — جلب من الشبكة
          return fetch(event.request)
            .then((response) => {
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              // ✅ لا نخزن استجابة HTML لطلب js/css (يمنع خطأ MIME بعد إضافة مشروع)
              if (!isValidStaticResponse(event.request.url, response)) {
                return response;
              }
              if (isCacheableRequest(event.request)) {
                const responseToCache = response.clone();
                const headers = new Headers(responseToCache.headers);
                headers.set('sw-cache-date', new Date().toISOString());
                headers.set('sw-cache-version', APP_VERSION);

                caches.open(STATIC_CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, new Response(responseToCache.body, {
                      status: responseToCache.status,
                      statusText: responseToCache.statusText,
                      headers: headers
                    }));
                  })
                  .catch((error) => {
                    console.warn(`Failed to cache ${event.request.url}:`, error);
                  });
              }

              return response;
            });
        })
        .then((result) => {
          if (result) return result;
          return fetch(event.request).then((response) => {
            if (!response || response.status !== 200 || !isValidStaticResponse(event.request.url, response)) {
              return response;
            }
            return response;
          });
        })
        .catch(() => {
          if (event.request.url.match(/\.(png|jpg|jpeg|gif|svg|webp|avif)$/)) {
            return new Response('', { status: 404 });
          }
          return fetch(event.request);
        })
    );
    return;
  }

  // ✅ استراتيجية Network First للصفحات HTML
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200) {
          throw new Error('Network response not ok');
        }

        const responseToCache = response.clone();
        if (isCacheableRequest(event.request)) {
          const headers = new Headers(responseToCache.headers);
          headers.set('sw-cache-date', new Date().toISOString());
          headers.set('sw-cache-version', APP_VERSION);

          caches.open(DYNAMIC_CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
              }));
            })
            .catch((error) => {
              console.warn(`Failed to cache ${event.request.url}:`, error);
            });
        }

        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // ✅ Fallback إلى index.html للصفحات
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }

            return new Response('Offline - No cached content available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// ✅ Background Sync للطلبات الفاشلة (اختياري - يحتاج دعم من المتصفح)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // يمكن إضافة منطق لإعادة محاولة الطلبات الفاشلة هنا
      console.log('Background sync triggered')
    );
  }
});

