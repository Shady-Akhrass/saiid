import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // مسار مطلق من الجذر — يمنع خطأ MIME عند فتح أي رابط (مثل /media-management/archives/4)
  // مع './' المتصفح يطلب /media-management/archives/js/xxx.js (خطأ) والسيرفر يرجع index.html
  // مع '/' يطلب دائماً /js/xxx.js — تأكد أن .htaccess مرفوع مع dist وأن محتويات dist في جذر الدومين
  base: '/',
  plugins: [
    react({
      // ✅ إيقاف أخطاء Babel لملفات React الضخمة (>500KB)
      babel: {
        compact: false,
      },
      // ✅ تحسين production build
      // ملاحظة: esbuild يتعامل مع إزالة console.log (انظر السطور 265-273)
    })
  ],
  build: {
    // ✅ تحسين حجم الـ bundle مع code splitting محسّن
    // ✅ تحسين tree shaking
    treeshake: {
      moduleSideEffects: 'no-external',
      preset: 'recommended',
    },
    rollupOptions: {
      output: {
        // ✅ الحفاظ على أسماء التصديرات في production
        format: 'es',
        // ✅ تقسيم الـ bundle إلى chunks صغيرة ومحسّنة
        manualChunks: (id) => {
          // ✅ React core libraries (الأكثر استخداماً)
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }

          // ✅ React Router
          if (id.includes('node_modules/react-router')) {
            return 'router-vendor';
          }

          // ✅ Chart.js libraries (كبيرة الحجم)
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
            return 'chart-vendor';
          }

          // ✅ UI libraries
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/react-toastify') || id.includes('node_modules/react-loading-skeleton')) {
            return 'ui-vendor';
          }

          // ✅ Utility libraries
          if (id.includes('node_modules/axios')) {
            return 'axios-vendor';
          }

          // ✅ XLSX library (كبيرة جداً)
          if (id.includes('node_modules/xlsx')) {
            return 'xlsx-vendor';
          }

          // ✅ Lodash
          if (id.includes('node_modules/lodash')) {
            return 'lodash-vendor';
          }

          // ✅ PDF libraries (كبيرة جداً - تحميل فقط عند الحاجة)
          if (id.includes('node_modules/@react-pdf')) {
            return 'pdf-vendor';
          }

          // ✅ Image compression (تحميل فقط عند الحاجة)
          if (id.includes('node_modules/browser-image-compression')) {
            return 'image-vendor';
          }

          // ✅ Validator library
          if (id.includes('node_modules/validator')) {
            return 'validator-vendor';
          }

          // ✅ فصل الصفحات الكبيرة إلى chunks منفصلة
          // Project Management - الصفحة الأكبر
          if (id.includes('project-management/projects/ProjectsList')) {
            return 'pm-projects-list';
          }
          if (id.includes('project-management/projects/ProjectDetails')) {
            return 'pm-project-details';
          }
          // Media Management
          if (id.includes('media-management/ProjectsList')) {
            return 'media-projects-list';
          }
        },
        // ✅ تحسين أسماء الـ chunks
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // ✅ تنظيم الملفات حسب النوع
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(ext)) {
            return 'images/[name]-[hash].[ext]';
          }
          // ✅ الخطوط تحت assets/ لتجنب 500 على بعض السيرفرات عند /fonts/
          if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
            return 'assets/fonts/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
    // ✅ تحسين الأداء
    chunkSizeWarningLimit: 800, // تقليل الحد الأقصى لتحذيرات الحجم
    minify: 'esbuild', // استخدام esbuild بدلاً من terser (أسرع ومدمج في Vite)
    target: 'es2015', // استخدام ES2015 للحفاظ على التوافق
    sourcemap: false, // تعطيل source maps في production للأداء
    cssCodeSplit: true, // تقسيم CSS إلى ملفات منفصلة
    cssMinify: true, // ضغط CSS
    // ✅ تحسين الأداء - تقليل حجم inline assets
    assetsInlineLimit: 4096, // 4kb - الصور الصغيرة يتم تضمينها كـ base64
    // ✅ تحسين الأداء - تفعيل module preload
    modulePreload: {
      polyfill: true,
    },
    // ✅ تحسين compression
    reportCompressedSize: true, // عرض حجم الملفات المضغوطة
    // ✅ تحسين minification
    terserOptions: process.env.NODE_ENV === 'production' ? {
      compress: {
        drop_console: false, // نحتفظ بـ console.error و console.warn
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    } : undefined,
  },
  // ✅ تحسين الأداء في التطوير
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'lucide-react',
      'react-toastify',
      'chart.js',
      'react-chartjs-2',
      'lodash',
      'validator',
      'react-loading-skeleton',
    ],
    // ✅ استبعاد المكتبات الكبيرة من pre-bundling لتسريع بدء التطوير
    exclude: ['@react-pdf/renderer', 'xlsx'],
    // ✅ تحسين الأداء في dev mode
    esbuildOptions: {
      target: 'es2015',
    },
  },
  // ✅ حل مشكلة stream module في xlsx-js-style
  resolve: {
    alias: {
      // ✅ استبدال stream module بـ polyfill للمتصفح
      stream: './src/utils/stream-polyfill.js',
    },
  },
  // ✅ تحسين سرعة التحميل
  server: {
    hmr: {
      overlay: false, // إخفاء overlay للأخطاء في التطوير
    },
    // ✅ تحسين الأداء في التطوير
    fs: {
      strict: false, // السماح بالوصول للملفات خارج المشروع
    },
    // ✅ إعدادات CORS للتطوير
    cors: true,
    // ✅ إعدادات port و host
    port: 5174,
    strictPort: false, // السماح باستخدام port آخر إذا كان 5174 مشغول
    host: true, // السماح بالوصول من أي IP
    // ✅ تحسين الأداء - تفعيل pre-transform
    warmup: {
      clientFiles: [
        './src/App.jsx',
        './src/main.jsx',
        './src/resources/layout/base.jsx',
        './src/context/AuthContext.jsx',
      ],
    },
    // ✅ Proxy للطلبات في وضع التطوير - يحل مشكلة CORS
    // ملاحظة: هذا يتطلب تحديث VITE_API_URL في .env لاستخدام proxy
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            // ✅ إضافة CORS headers إذا لم تكن موجودة
            if (!proxyRes.headers['access-control-allow-origin']) {
              proxyRes.headers['access-control-allow-origin'] = '*';
            }
            if (!proxyRes.headers['access-control-allow-methods']) {
              proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
            }
            if (!proxyRes.headers['access-control-allow-headers']) {
              proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, Accept';
            }
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      // ✅ Proxy للصور (project_notes_images, orphan_photos, etc.)
      '/project_notes_images': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path, // لا نعيد كتابة المسار
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('⚠️ Proxy error for project_notes_images:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('📸 Proxying image request:', req.method, req.url, '→', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            // ✅ إضافة CORS headers للصور
            if (!proxyRes.headers['access-control-allow-origin']) {
              proxyRes.headers['access-control-allow-origin'] = '*';
            }
            if (!proxyRes.headers['access-control-allow-methods']) {
              proxyRes.headers['access-control-allow-methods'] = 'GET, OPTIONS';
            }
            if (!proxyRes.headers['access-control-allow-headers']) {
              proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, Accept';
            }
            // ✅ إضافة headers للصور
            if (!proxyRes.headers['content-type']) {
              proxyRes.headers['content-type'] = 'image/jpeg';
            }
            console.log('📸 Image proxy response:', proxyRes.statusCode, req.url);
          });
        },
      },
      // ✅ Proxy للمسارات الأخرى (storage, public/storage)
      '/storage': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('⚠️ Proxy error for storage:', err.message);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            if (!proxyRes.headers['access-control-allow-origin']) {
              proxyRes.headers['access-control-allow-origin'] = '*';
            }
            if (!proxyRes.headers['access-control-allow-methods']) {
              proxyRes.headers['access-control-allow-methods'] = 'GET, OPTIONS';
            }
          });
        },
      },
      '/public': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('⚠️ Proxy error for public:', err.message);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            if (!proxyRes.headers['access-control-allow-origin']) {
              proxyRes.headers['access-control-allow-origin'] = '*';
            }
            if (!proxyRes.headers['access-control-allow-methods']) {
              proxyRes.headers['access-control-allow-methods'] = 'GET, OPTIONS';
            }
          });
        },
      },
    },
  },
  // ✅ تحسين الأداء العام
  esbuild: {
    // ✅ إزالة debugger في production
    // ملاحظة: لا نحذف console لأننا نريد الاحتفاظ بـ console.error و console.warn
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
    // ✅ الحفاظ على أسماء التصديرات لتجنب مشاكل minification
    keepNames: true,
    // ✅ إزالة console.log فقط (ليس console.error أو console.warn)
    pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.info', 'console.debug'] : [],
  },
})
