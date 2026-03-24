import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import apiClient from "../../../utils/axiosConfig";
import { useToast } from "../../../hooks/useToast";
import { useAuth } from "../../../context/AuthContext"; // Add this import
import { useCache } from "../../../hooks/useCache";
import { useCacheInvalidation } from "../../../hooks/useCacheInvalidation";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  Filter,
  ArrowUpDown,
  Eye,
  Calendar,
  MapPin,
  Heart,
  ToggleLeft,
  ToggleRight,
  FileText,
  X
} from "lucide-react";
import OrphanDetailsModal from "./OrphanDetailsModal";

// ✅ بناء API_BASE بشكل صحيح
// الـ Backend endpoint: https://forms-api.saiid.org/api/image/{orphan_id_number}
const getApiBase = () => {
  const base = import.meta.env.VITE_API_URL || "https://forms-api.saiid.org/api";
  // ✅ إزالة /api من النهاية إذا كان موجوداً
  const apiBase = base.replace(/\/api$/, '');

  // ✅ Debug: عرض API_BASE في development
  if (import.meta.env.DEV) {
    console.log('🔗 API_BASE for images:', apiBase);
  }

  return apiBase;
};

const API_BASE = getApiBase();

const Orphans = () => {
  const { isFormAvailable, toggleFormAvailability } = useAuth();
  const { getData, setCachedData, isCacheValid, initializeCache, clearCache } = useCache('orphans', 300000);
  const { invalidateOrphansCache } = useCacheInvalidation();
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const fetchInProgressRef = useRef(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // State management
  const [orphans, setOrphans] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrphans, setTotalOrphans] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [selectedOrphan, setSelectedOrphan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [imageBlobUrls, setImageBlobUrls] = useState({}); // ✅ حفظ blob URLs للصور
  const [loadingImages, setLoadingImages] = useState(new Set()); // ✅ تتبع الصور قيد التحميل
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingMedical, setIsDownloadingMedical] = useState(false);

  const { success, error: showError, info } = useToast();

  // ✅ تهيئة الـ cache عند التحميل
  useEffect(() => {
    initializeCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ الاستماع إلى أحداث إبطال الكاش
  useEffect(() => {
    const handleCacheInvalidation = (event) => {
      const { cacheKey } = event.detail;

      // ✅ إذا كان cacheKey === 'all' أو يطابق 'orphans'
      if (cacheKey === 'all' || cacheKey === 'orphans') {
        clearCache();
        setRefreshTrigger(prev => prev + 1);

        if (import.meta.env.DEV) {
          console.log('✅ Orphans cache invalidated, fetching fresh data');
        }
      }
    };

    window.addEventListener('cache-invalidated', handleCacheInvalidation);

    return () => {
      window.removeEventListener('cache-invalidated', handleCacheInvalidation);
    };
  }, [clearCache]);

  // ✅ دالة لتعيين البيانات من cache
  const setCachedDataToState = useCallback((cachedData) => {
    setOrphans(cachedData.orphans || cachedData);
    setTotalOrphans(cachedData.totalOrphans || cachedData.length || 0);
    setTotalPages(cachedData.totalPages || Math.ceil((cachedData.totalOrphans || cachedData.length) / perPage) || 0);
    setIsLoading(false);
  }, [perPage]);

  const handleToggleForm = () => {
    const newStatus = !isFormAvailable;
    toggleFormAvailability(newStatus);
    if (newStatus) {
      success("تم فتح النموذج بنجاح! المستخدمون يمكنهم الآن التسجيل.");
    } else {
      info("تم إغلاق النموذج بنجاح! لن يتمكن المستخدمون من التسجيل.");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return "";
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  };

  const openModal = (orphan) => {
    setSelectedOrphan(orphan);
    setIsModalOpen(true);
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedOrphan(null);
    }, 300);
    document.body.style.overflow = "unset";
  };

  const fetchOrphans = async () => {
    let loadingTimeout;

    try {
      // ✅ التحقق من Cache أولاً
      const filtersKey = JSON.stringify({ searchQuery, perPage, currentPage });
      if (isCacheValid(filtersKey)) {
        const cachedData = getData();
        if (cachedData) {
          setCachedDataToState(cachedData);
          if (import.meta.env.DEV) {
            console.log('✅ Using cached orphans data');
          }
          return;
        }
      }

      // ✅ إلغاء الطلب السابق فقط إذا كان موجوداً
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // ✅ إنشاء AbortController جديد
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // ✅ التحقق من أن المكون لا يزال mounted قبل المتابعة
      if (!isMountedRef.current) {
        return;
      }

      fetchInProgressRef.current = true;

      setIsLoading(true);

      if (import.meta.env.DEV) {
        console.log('📡 Making API request to /orphans with params:', {
          searchQuery,
          perPage,
          page: currentPage
        });
      }

      // ✅ إيقاف حالة التحميل بعد timeout (30 ثانية)
      loadingTimeout = setTimeout(() => {
        setIsLoading(false);
        // ✅ لا نمسح البيانات إذا كانت موجودة في cache
        const cachedData = getData();
        if (!cachedData) {
          setOrphans([]);
          setTotalOrphans(0);
          setTotalPages(0);
        }
        if (import.meta.env.DEV) {
          console.warn('⏱️ Request timeout after 30 seconds');
        }
      }, 30000); // timeout 30 ثانية

      const response = await apiClient.get("/orphans", {
        params: { searchQuery, perPage, page: currentPage },
        timeout: 30000, // ✅ زيادة timeout إلى 30 ثانية (لعدد كبير من الأيتام)
        signal: abortController.signal
      });

      if (loadingTimeout) clearTimeout(loadingTimeout);

      // ✅ التحقق من أن المكون لا يزال mounted قبل تحديث الحالة
      if (!isMountedRef.current) {
        return;
      }

      if (import.meta.env.DEV) {
        console.log('📦 API Response:', {
          hasData: !!response.data,
          dataKeys: response.data ? Object.keys(response.data) : [],
          hasOrphans: !!response.data?.orphans,
          orphansType: Array.isArray(response.data?.orphans) ? 'array' : typeof response.data?.orphans,
          orphansLength: Array.isArray(response.data?.orphans) ? response.data.orphans.length : 'N/A'
        });
      }

      if (Array.isArray(response.data.orphans)) {
        if (import.meta.env.DEV) {
          console.log('✅ Orphans data received:', {
            count: response.data.orphans.length,
            totalOrphans: response.data.totalOrphans,
            totalPages: response.data.totalPages
          });
        }
        setOrphans(response.data.orphans);
        setTotalOrphans(response.data.totalOrphans);
        setTotalPages(response.data.totalPages);

        // ✅ حفظ البيانات في cache
        setCachedData({
          orphans: response.data.orphans,
          totalOrphans: response.data.totalOrphans,
          totalPages: response.data.totalPages
        }, { searchQuery, perPage, currentPage });
      } else {
        if (import.meta.env.DEV) {
          console.warn('⚠️ Response data is not an array:', response.data);
        }
        setOrphans([]);
        setTotalOrphans(0);
        setTotalPages(0);
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);

      if (import.meta.env.DEV) {
        console.error('❌ Error fetching orphans:', {
          errorName: error.name,
          errorCode: error.code,
          errorMessage: error.message,
          responseStatus: error.response?.status,
          responseData: error.response?.data,
          isAborted: error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.message === 'canceled' || abortControllerRef.current?.signal.aborted
        });
      }

      // ✅ تجاهل أخطاء الإلغاء (خاصة في Strict Mode)
      if (error.name === 'AbortError' ||
        error.name === 'CanceledError' ||
        error.code === 'ERR_CANCELED' ||
        error.message === 'canceled' ||
        abortControllerRef.current?.signal.aborted) {
        // ✅ لا نعرض رسالة خطأ للأخطاء الملغاة (طبيعي في Strict Mode)
        // ✅ لا نعرض أي شيء في Console لتقليل الضوضاء
        return;
      }

      // ✅ معالجة timeout errors
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        // ✅ إذا كان هناك بيانات في cache، استخدمها
        const cachedData = getData();
        if (cachedData) {
          setCachedDataToState(cachedData);
          if (import.meta.env.DEV) {
            console.warn('⚠️ Request timeout, using cached data');
          }
          showError("انتهت مهلة الاتصال. تم عرض البيانات المحفوظة. يرجى المحاولة مرة أخرى.");
          return;
        }

        // ✅ إذا لم تكن هناك بيانات في cache
        setOrphans([]);
        setTotalOrphans(0);
        setTotalPages(0);
        showError("انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى أو تقليل عدد النتائج في الصفحة.");
        if (import.meta.env.DEV) {
          console.error("Error fetching orphans (timeout):", error);
        }
        return;
      }

      // ✅ إذا كان هناك بيانات في cache، استخدمها
      const cachedData = getData();
      if (cachedData) {
        setCachedDataToState(cachedData);
        if (import.meta.env.DEV) {
          console.log('⚠️ Error fetching orphans, using cached data');
        }
        return;
      }

      setOrphans([]);
      setTotalOrphans(0);
      setTotalPages(0);

      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error("Error fetching orphans:", error);
      }

      if (!error.isConnectionError) {
        showError(error.userMessage || "خطأ في جلب بيانات الأيتام، يرجى المحاولة مرة أخرى.");
      }
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      fetchInProgressRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    // ✅ تعيين isMountedRef إلى true عند mount
    isMountedRef.current = true;
    fetchInProgressRef.current = false;

    // ✅ التحقق من cache أولاً قبل جلب البيانات
    const filtersKey = JSON.stringify({ searchQuery, perPage, currentPage });
    if (isCacheValid(filtersKey)) {
      const cachedData = getData();
      if (cachedData) {
        setCachedDataToState(cachedData);
        if (import.meta.env.DEV) {
          console.log('✅ Using cached orphans data (from useEffect)', cachedData);
        }
        return;
      }
    }

    // ✅ فقط إذا لم تكن البيانات في cache، اجلبها من API
    if (import.meta.env.DEV) {
      console.log('🔄 Fetching orphans from API...');
    }

    // ✅ استخدام setTimeout لتأخير الطلب قليلاً لتجنب إلغاء الطلبات في Strict Mode
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        fetchOrphans();
      }
    }, 0);

    // ✅ تنظيف: إلغاء الطلب عند unmount فقط
    return () => {
      clearTimeout(timeoutId);
      isMountedRef.current = false;
      fetchInProgressRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, perPage, currentPage, refreshTrigger]); // ✅ إضافة refreshTrigger

  // ✅ تحميل الصور فقط للصفحة المرئية (Lazy Loading) لتجنب 1316+ طلب
  useEffect(() => {
    // ✅ تحميل الصور فقط للأيتام المرئيين في الصفحة الحالية
    const loadVisibleImages = async () => {
      if (orphans.length === 0) return;

      // ✅ تحميل الصور فقط للصفحة الحالية (perPage)
      const startIndex = (currentPage - 1) * perPage;
      const endIndex = Math.min(startIndex + perPage, orphans.length);
      const visibleOrphans = orphans.slice(startIndex, endIndex);

      if (visibleOrphans.length === 0) return;

      // ✅ تحميل الصور على دفعات صغيرة لتجنب rate limiting
      const batchSize = 3; // 3 صور في كل مرة
      const delayBetweenBatches = 1000; // ثانية واحدة بين كل batch

      for (let i = 0; i < visibleOrphans.length; i += batchSize) {
        const batch = visibleOrphans.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (orphan) => {
            const orphanId = orphan.orphan_id_number || orphan._id;
            if (!orphanId) return;

            // ✅ تخطي إذا كانت محملة بالفعل أو قيد التحميل أو فشلت
            if (imageBlobUrls[orphanId] || loadingImages.has(orphanId) || imageErrors[orphanId]) {
              return;
            }

            // ✅ وضع علامة على أنها قيد التحميل
            setLoadingImages(prev => new Set(prev).add(orphanId));

            // ✅ بناء URL الصورة - استخدام orphan_photo من البيانات إذا كان موجوداً
            let imageUrl;
            if (orphan.orphan_photo && orphan.orphan_photo.startsWith('http')) {
              // ✅ إذا كان URL كامل
              imageUrl = orphan.orphan_photo;
            } else if (orphan.orphan_photo && !orphan.orphan_photo.startsWith('/')) {
              // ✅ إذا كان مسار نسبي، أضف / في البداية
              imageUrl = `${API_BASE}/${orphan.orphan_photo}`;
            } else if (orphan.orphan_photo) {
              // ✅ إذا كان يبدأ بـ /، استخدمه مباشرة
              imageUrl = `${API_BASE}${orphan.orphan_photo}`;
            } else {
              // ✅ استخدام الـ endpoint الافتراضي
              imageUrl = `${API_BASE}/api/image/${orphanId}`;
            }

            // ✅ محاولة تحميل الصورة باستخدام apiClient
            try {
              // ✅ إذا كان URL كامل (http/https)، استخدمه مباشرة مع fetch
              if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                const response = await fetch(imageUrl, {
                  method: 'GET',
                  credentials: 'include',
                  mode: 'cors',
                });

                if (response.ok) {
                  const blob = await response.blob();
                  if (blob.type.startsWith('image/')) {
                    const blobUrl = URL.createObjectURL(blob);
                    setImageBlobUrls(prev => ({ ...prev, [orphanId]: blobUrl }));
                    setImageErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors[orphanId];
                      return newErrors;
                    });
                    return;
                  }
                }
              }

              // ✅ استخدام apiClient للصور من API endpoint
              // ✅ استخراج endpoint من imageUrl (مثل /api/image/{id})
              let apiEndpoint = imageUrl;
              if (imageUrl.includes('/api/')) {
                apiEndpoint = imageUrl.split('/api/')[1]; // ✅ إزالة baseURL
              } else if (imageUrl.startsWith('/')) {
                apiEndpoint = imageUrl.substring(1); // ✅ إزالة / الأولى
              }

              const response = await apiClient.get(apiEndpoint, {
                responseType: 'blob',
                skipDeduplication: true, // ✅ اختياري للصور
              });

              // ✅ التحقق من أن الـ blob هو صورة
              if (response.data && response.data.type && response.data.type.startsWith('image/')) {
                const blobUrl = URL.createObjectURL(response.data);
                setImageBlobUrls(prev => ({ ...prev, [orphanId]: blobUrl }));
                setImageErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors[orphanId];
                  return newErrors;
                });

                if (import.meta.env.DEV && i === 0) {
                  console.log('✅ Successfully loaded image using blob URL:', {
                    orphanId,
                    blobType: response.data.type,
                  });
                }
              } else {
                throw new Error(`Invalid content type: ${response.data?.type}`);
              }
            } catch (error) {
              // ✅ معالجة 404 بشكل صحيح (الصورة غير موجودة)
              if (error.response?.status === 404) {
                setImageErrors(prev => ({ ...prev, [orphanId]: true }));
                if (import.meta.env.DEV && i === 0) {
                  console.info('ℹ️ Image not found (404) - هذا طبيعي إذا كانت الصورة غير موجودة في الباك إند');
                }
              } else if (error.response?.status === 429) {
                // ✅ Handle 429 (Too Many Requests) - silently skip
                if (import.meta.env.DEV && i === 0) {
                  console.warn('Rate limited when loading image, skipping...');
                }
                setImageErrors(prev => ({ ...prev, [orphanId]: true }));
              } else {
                setImageErrors(prev => ({ ...prev, [orphanId]: true }));
                if (import.meta.env.DEV && i === 0) {
                  console.warn('⚠️ Failed to load image:', error);
                }
              }
            } finally {
              // ✅ إزالة علامة التحميل
              setLoadingImages(prev => {
                const newSet = new Set(prev);
                newSet.delete(orphanId);
                return newSet;
              });
            }
          })
        );

        // ✅ انتظار قبل تحميل الـ batch التالي
        if (i + batchSize < visibleOrphans.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
    };

    if (orphans.length > 0) {
      loadVisibleImages();
    }

    // ✅ تنظيف blob URLs عند unmount
    return () => {
      Object.values(imageBlobUrls).forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orphans, currentPage, perPage]);

  // ✅ تحميل الصور باستخدام blob URL إذا فشل التحميل المباشر
  useEffect(() => {
    // ✅ تحميل الصور التي فشلت في التحميل المباشر باستخدام fetch
    const loadFailedImages = async () => {
      const failedImageIds = Object.keys(imageErrors).filter(id => imageErrors[id]);

      for (const orphanId of failedImageIds) {
        const orphan = orphans.find(o => (o.orphan_id_number || o._id) === orphanId);
        if (!orphan) continue;

        // ✅ استخدام apiClient لتحميل الصورة
        try {
          const response = await apiClient.get(`/image/${orphanId}`, {
            responseType: 'blob',
            skipDeduplication: true, // ✅ اختياري للصور
          });

          if (response.data && response.data.type && response.data.type.startsWith('image/')) {
            const blobUrl = URL.createObjectURL(response.data);
            setImageBlobUrls(prev => ({ ...prev, [orphanId]: blobUrl }));
            setImageErrors(prev => ({ ...prev, [orphanId]: false }));

            if (import.meta.env.DEV) {
              console.log('✅ Successfully loaded image using blob URL:', {
                orphanId,
                blobType: response.data.type,
              });
            }
          }
        } catch (error) {
          // ✅ معالجة 404 بشكل صحيح (الصورة غير موجودة)
          if (error.response?.status === 404) {
            setImageErrors(prev => ({ ...prev, [orphanId]: true }));
            if (import.meta.env.DEV) {
              console.info('ℹ️ Image not found (404) for orphan:', orphanId);
            }
          } else if (error.response?.status === 429) {
            // ✅ Handle 429 (Too Many Requests) - silently skip
            if (import.meta.env.DEV) {
              console.warn('Rate limited when loading image, skipping...');
            }
            setImageErrors(prev => ({ ...prev, [orphanId]: true }));
          } else {
            if (import.meta.env.DEV) {
              console.warn('❌ Failed to load image:', {
                orphanId,
                error: error.message,
              });
            }
            setImageErrors(prev => ({ ...prev, [orphanId]: true }));
          }
        }
      }
    };

    if (orphans.length > 0 && Object.keys(imageErrors).length > 0) {
      loadFailedImages();
    }

    // ✅ تنظيف blob URLs عند unmount
    return () => {
      Object.values(imageBlobUrls).forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orphans, imageErrors]);

  const handleDownloadExcel = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    info("جاري تحضير ملف Excel للتحميل... قد تستغرق العملية بضع دقائق إذا كان عدد الأيتام كبيراً");

    try {
      const response = await apiClient.get("/orphans/export", {
        responseType: "blob",
        timeout: 180000, // ✅ زيادة timeout لملفات Excel الكبيرة (3 دقائق = 180 ثانية)
      });

      // ✅ التحقق من أن الاستجابة تحتوي على blob صحيح
      if (!response.data || !(response.data instanceof Blob)) {
        throw new Error('الاستجابة من السيرفر غير صحيحة');
      }

      // ✅ التحقق من نوع الملف
      const contentType = response.headers['content-type'] || response.headers['Content-Type'];
      if (contentType && !contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') &&
        !contentType.includes('application/octet-stream') &&
        !contentType.includes('application/excel')) {
        // ✅ إذا كانت الاستجابة JSON (خطأ)، نحاول قراءتها
        const text = await response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || 'خطأ في تحميل الملف');
        } catch (e) {
          // إذا لم تكن JSON، نتابع التحميل
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "orphans.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();

      // ✅ تنظيف URL بعد التحميل
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);

      success("تم تحميل ملف Excel بنجاح!");
    } catch (error) {
      console.error("Error downloading Excel file:", {
        error,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      // ✅ معالجة خاصة لأخطاء مختلفة
      let errorMessage = "يرجى المحاولة مرة أخرى بعد قليل";

      // ✅ معالجة خاصة لـ timeout errors
      if (error.code === 'ECONNABORTED' ||
        error.message?.includes('timeout') ||
        error.message?.includes('exceeded')) {
        errorMessage = "انتهت مهلة الاتصال. العملية تستغرق وقتاً طويلاً بسبب حجم البيانات الكبير. يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني لتحسين الأداء.";
      } else if (error.response?.status === 401) {
        errorMessage = "ليس لديك صلاحيات لتحميل ملف Excel";
      } else if (error.response?.status === 403) {
        errorMessage = "ليس لديك صلاحيات لتحميل ملف Excel";
      } else if (error.response?.status === 404) {
        errorMessage = "نقطة النهاية غير موجودة. يرجى التحقق من الـ Backend";
      } else if (error.response?.status === 500) {
        errorMessage = "خطأ في السيرفر. يرجى المحاولة لاحقاً أو الاتصال بالدعم الفني";
      } else if (error.response?.status === 504) {
        errorMessage = "انتهت مهلة الاتصال من السيرفر. العملية تستغرق وقتاً طويلاً. يرجى المحاولة مرة أخرى.";
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.userMessage) {
        errorMessage = error.userMessage;
      }

      showError(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadMedicalExcel = async () => {
    if (isDownloadingMedical) return;

    setIsDownloadingMedical(true);
    info("جاري تحضير ملف الأيتام المسجلين للعلاج الطبي... قد تستغرق العملية بضع دقائق");

    try {
      const response = await apiClient.get("/orphan-medical-treatments/export", {
        responseType: "blob",
        timeout: 180000, // ✅ زيادة timeout لملفات Excel الكبيرة (3 دقائق = 180 ثانية)
      });

      // ✅ التحقق من أن الاستجابة تحتوي على blob صحيح
      if (!response.data || !(response.data instanceof Blob)) {
        throw new Error('الاستجابة من السيرفر غير صحيحة');
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "orphan_medical_treatments.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();

      // ✅ تنظيف URL بعد التحميل
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);

      success("تم تحميل ملف الأيتام المسجلين للعلاج الطبي بنجاح!");
    } catch (error) {
      console.error("Error downloading medical treatments Excel file:", {
        error,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      // ✅ معالجة خاصة لأخطاء مختلفة
      let errorMessage = "فشل تحميل ملف الأيتام المرضى. يرجى المحاولة مرة أخرى";

      // ✅ معالجة خاصة لـ timeout errors
      if (error.code === 'ECONNABORTED' ||
        error.message?.includes('timeout') ||
        error.message?.includes('exceeded')) {
        errorMessage = "انتهت مهلة الاتصال. العملية تستغرق وقتاً طويلاً بسبب حجم البيانات الكبير. يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني لتحسين الأداء.";
      } else if (error.response?.status === 401) {
        errorMessage = "ليس لديك صلاحيات لتحميل ملف Excel";
      } else if (error.response?.status === 403) {
        errorMessage = "ليس لديك صلاحيات لتحميل ملف Excel";
      } else if (error.response?.status === 404) {
        errorMessage = "نقطة النهاية غير موجودة. يرجى التحقق من الـ Backend";
      } else if (error.response?.status === 500) {
        errorMessage = "خطأ في السيرفر. يرجى المحاولة لاحقاً أو الاتصال بالدعم الفني";
      } else if (error.response?.status === 504) {
        errorMessage = "انتهت مهلة الاتصال من السيرفر. العملية تستغرق وقتاً طويلاً. يرجى المحاولة مرة أخرى.";
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.userMessage) {
        errorMessage = error.userMessage;
      }

      showError(errorMessage);
    } finally {
      setIsDownloadingMedical(false);
    }
  };

  const sortedOrphans = React.useMemo(() => {
    return [...orphans].sort((a, b) => {
      if (!sortConfig.key) return 0;
      const aValue = sortConfig.key.split(".").reduce((o, i) => o[i], a);
      const bValue = sortConfig.key.split(".").reduce((o, i) => o[i], b);

      if (aValue < bValue) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  }, [orphans, sortConfig]);

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // Component to display mother death certificate
  const MotherDeathCertificateCell = ({ orphan }) => {
    const [imageError, setImageError] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);

    const isMotherDeceased = orphan.is_mother_deceased === 'نعم' || orphan.is_mother_deceased === 'yes';

    if (!isMotherDeceased) {
      return <span className="text-gray-400 text-sm">-</span>;
    }

    const imageUrl = `${API_BASE}/api/mother-death-certificate/${orphan.orphan_id_number}`;

    return (
      <>
        <div className="flex items-center justify-center">
          <div className="relative group">
            { !imageError ? (
              <img
                src={ imageUrl }
                alt="شهادة وفاة الأم"
                className="h-16 w-16 object-cover rounded-lg border-2 border-red-200 cursor-pointer hover:border-red-400 transition-all duration-300 shadow-md hover:shadow-lg"
                onError={ () => setImageError(true) }
                onClick={ () => setShowImageModal(true) }
              />
            ) : (
              <div className="h-16 w-16 flex items-center justify-center bg-gray-100 rounded-lg border-2 border-gray-200">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
            ) }
            { !imageError && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-all duration-300 flex items-center justify-center pointer-events-none">
                <FileText className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            ) }
          </div>
        </div>

        {/* Image Modal */ }
        { showImageModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={ () => setShowImageModal(false) }
          >
            <div className="relative max-w-4xl max-h-[90vh] p-4">
              <button
                onClick={ () => setShowImageModal(false) }
                className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all duration-300 z-10"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <img
                src={ imageUrl }
                alt="شهادة وفاة الأم"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={ (e) => e.stopPropagation() }
              />
            </div>
          </div>
        ) }
      </>
    );
  };

  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="p-4">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 bg-gradient-to-br from-sky-100 to-orange-100 rounded-2xl"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-4 bg-gray-200 rounded w-24 mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-6 bg-gradient-to-r from-sky-100 to-sky-200 rounded-full w-20 mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-16 w-16 bg-gray-200 rounded-lg mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-8 bg-gradient-to-r from-orange-100 to-orange-200 rounded-xl w-20 mx-auto"></div>
      </td>
    </tr>
  );

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 px-4 sm:px-6 lg:px-8 py-8"
      dir="rtl"
    >
      {/* Animated Background Elements */ }
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 right-40 w-80 h-80 bg-sky-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header Section */ }
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-sky-400 to-sky-500 rounded-2xl shadow-lg shadow-sky-200">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
                  بيانات الأيتام
                </h1>
                <p className="text-gray-600 mt-1">
                  إجمالي السجلات: { totalOrphans }
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <button
                onClick={ handleDownloadExcel }
                disabled={ isDownloading }
                className={ `group flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-2xl transition-all duration-300 shadow-lg shadow-green-200
                  ${isDownloading
                    ? 'opacity-75 cursor-not-allowed'
                    : 'hover:from-green-500 hover:to-green-600 transform hover:scale-105'
                  }` }
              >
                <Download className={ `w-5 h-5 ${isDownloading ? 'animate-bounce' : 'group-hover:animate-bounce'}` } />
                <span className="font-medium">{ isDownloading ? 'جاري التحميل...' : 'تحميل الأيتام' }</span>
              </button>

              <button
                onClick={ handleDownloadMedicalExcel }
                disabled={ isDownloadingMedical }
                className={ `group flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-400 to-blue-500 text-white rounded-2xl transition-all duration-300 shadow-lg shadow-blue-200
                  ${isDownloadingMedical
                    ? 'opacity-75 cursor-not-allowed'
                    : 'hover:from-blue-500 hover:to-blue-600 transform hover:scale-105'
                  }` }
                title="تحميل قائمة الأيتام المسجلين للعلاج الطبي"
              >
                <svg
                  className={ `w-5 h-5 ${isDownloadingMedical ? 'animate-pulse' : 'group-hover:animate-pulse'}` }
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={ 2 }
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="font-medium">
                  { isDownloadingMedical ? 'جاري التحميل...' : 'الأيتام المرضى' }
                </span>
              </button>

            </div>
          </div>
        </div>



        {/* Search and Filter Section */ }
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative group">
              <input
                type="text"
                className="w-full px-12 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg focus:shadow-sky-100 hover:border-sky-300"
                placeholder="البحث عن يتيم..."
                value={ searchQuery }
                onChange={ (e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                } }
              />
              <Search
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-sky-500 transition-colors duration-300"
                size={ 20 }
              />
              { searchQuery && (
                <button
                  onClick={ () => setSearchQuery("") }
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors duration-300"
                >
                  ✕
                </button>
              ) }
            </div>

            <button className="flex items-center gap-2 px-6 py-4 bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 rounded-2xl hover:from-orange-200 hover:to-orange-300 transition-all duration-300 font-medium">
              <Filter className="w-5 h-5" />
              <span>فلترة</span>
            </button>
          </div>
        </div>

        {/* Table Section */ }
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-sky-50 to-orange-50 border-b border-sky-100">
                  <th
                    onClick={ () => requestSort("orphan_full_name") }
                    className="p-4 text-right font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                  >
                    <div className="flex items-center gap-2">
                      <span>معلومات اليتيم</span>
                      <ArrowUpDown className="w-4 h-4 text-gray-400 group-hover:text-sky-500 transition-colors duration-300" />
                    </div>
                  </th>
                  <th
                    onClick={ () => requestSort("orphan_birth_date") }
                    className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Calendar className="w-4 h-4 text-sky-500" />
                      <span>تاريخ الميلاد</span>
                    </div>
                  </th>
                  <th
                    onClick={ () => requestSort("health_status") }
                    className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Heart className="w-4 h-4 text-red-400" />
                      <span>الحالة الصحية</span>
                    </div>
                  </th>
                  <th className="p-4 text-center font-semibold text-gray-700">
                    <div className="flex items-center justify-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-500" />
                      <span>العنوان</span>
                    </div>
                  </th>
                  <th className="p-4 text-center font-semibold text-gray-700">
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4 text-red-500" />
                      <span>شهادة وفاة الأم</span>
                    </div>
                  </th>
                  <th className="p-4 text-center font-semibold text-gray-700">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                { isLoading ? (
                  Array(perPage)
                    .fill()
                    .map((_, index) => <SkeletonRow key={ index } />)
                ) : sortedOrphans.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center p-12">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full">
                          <Users className="w-12 h-12 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-lg">
                          لا توجد بيانات متاحة
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedOrphans.map((orphan, index) => {
                    const orphanId = orphan.orphan_id_number || orphan._id;
                    // ✅ بناء URL الصورة - استخدام orphan_photo من البيانات إذا كان موجوداً
                    let imageUrl = null;
                    if (orphanId) {
                      if (orphan.orphan_photo && orphan.orphan_photo.startsWith('http')) {
                        // ✅ إذا كان URL كامل
                        imageUrl = orphan.orphan_photo;
                      } else if (orphan.orphan_photo && !orphan.orphan_photo.startsWith('/')) {
                        // ✅ إذا كان مسار نسبي (مثل: orphan_photos/123.jpg)، أضف / في البداية
                        imageUrl = `${API_BASE}/${orphan.orphan_photo}`;
                      } else if (orphan.orphan_photo) {
                        // ✅ إذا كان يبدأ بـ / (مثل: /orphan_photos/123.jpg)، استخدمه مباشرة
                        imageUrl = `${API_BASE}${orphan.orphan_photo}`;
                      } else {
                        // ✅ استخدام الـ endpoint الافتراضي
                        imageUrl = `${API_BASE}/api/image/${orphanId}`;
                      }
                    }
                    const imageError = imageErrors[orphanId] || false;

                    return (
                      <tr
                        key={ orphan.orphan_id_number || orphan._id }
                        className={ `border-b border-gray-100 transition-all duration-300 hover:bg-gradient-to-r hover:from-sky-50/50 hover:to-orange-50/50 ${hoveredRow === index ? "scale-[1.01] shadow-lg" : ""
                          }` }
                        onMouseEnter={ () => setHoveredRow(index) }
                        onMouseLeave={ () => setHoveredRow(null) }
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="relative group">
                              <div className="absolute inset-0 bg-gradient-to-br from-sky-400 to-orange-400 rounded-2xl blur-sm opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                              { !imageError && imageBlobUrls[orphanId] ? (
                                <img
                                  src={ imageBlobUrls[orphanId] }
                                  alt={ `صورة ${orphan.orphan_full_name || 'اليتيم'}` }
                                  className="relative h-14 w-14 object-cover rounded-2xl border-2 border-white shadow-md"
                                  onError={ (e) => {
                                    // ✅ إذا فشل blob URL، احذفه واعرض placeholder
                                    setImageBlobUrls(prev => {
                                      const newUrls = { ...prev };
                                      delete newUrls[orphanId];
                                      return newUrls;
                                    });
                                    setImageErrors(prev => ({ ...prev, [orphanId]: true }));

                                    // ✅ لا نعرض رسالة خطأ - الصورة ببساطة غير موجودة (404)
                                    // ✅ هذا طبيعي ولا يحتاج لرسالة خطأ
                                  } }
                                  onLoad={ () => {
                                    // ✅ تم إزالة السجل لتقليل الضوضاء في Console
                                  } }
                                  loading="lazy"
                                />
                              ) : (
                                <div
                                  className="relative h-14 w-14 flex items-center justify-center bg-gradient-to-br from-sky-100 to-orange-100 rounded-2xl border-2 border-white shadow-md"
                                  title={ imageError ? 'فشل تحميل الصورة' : loadingImages.has(orphanId) ? 'جاري تحميل الصورة...' : 'لا توجد صورة' }
                                >
                                  { loadingImages.has(orphanId) ? (
                                    <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <Users className="w-8 h-8 text-gray-400" />
                                  ) }
                                </div>
                              ) }
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">
                                { orphan.orphan_full_name }
                              </p>
                              <p className="text-sm text-gray-500">
                                الهوية: { orphan.orphan_id_number }
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-gray-700">
                            { formatDate(orphan.orphan_birth_date) }
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={ `px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1
                                                    ${orphan.health_status ===
                                "جيدة"
                                ? "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-700"
                                : orphan.health_status ===
                                  "مريض"
                                  ? "bg-gradient-to-r from-amber-100 to-amber-200 text-amber-700"
                                  : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700"
                              }` }
                          >
                            <div
                              className={ `w-2 h-2 rounded-full ${orphan.health_status === "جيدة"
                                ? "bg-emerald-500"
                                : orphan.health_status === "مريض"
                                  ? "bg-amber-500"
                                  : "bg-gray-500"
                                }` }
                            ></div>
                            { orphan.health_status }
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm text-gray-600">
                              <span className="font-medium">الأصلي:</span>{ " " }
                              { orphan.original_address }
                            </span>
                            <span className="text-sm text-gray-600">
                              <span className="font-medium">الحالي:</span>{ " " }
                              { orphan.current_address }
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <MotherDeathCertificateCell orphan={ orphan } />
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={ () => openModal(orphan) }
                            className="p-2 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-xl hover:from-sky-500 hover:to-sky-600 transform hover:scale-110 transition-all duration-300 shadow-md shadow-sky-200"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) }
              </tbody>
            </table>
          </div>

          {/* Pagination Section */ }
          <div className="bg-gradient-to-r from-sky-50 to-orange-50 p-6 border-t border-sky-100">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-gray-600">عرض</span>
                <select
                  className="px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-medium focus:border-sky-400 focus:outline-none transition-colors duration-300 cursor-pointer hover:border-sky-300"
                  value={ perPage }
                  onChange={ (e) => {
                    setPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  } }
                >
                  <option value={ 10 }>10</option>
                  <option value={ 20 }>20</option>
                  <option value={ 30 }>30</option>
                </select>
                <span className="text-gray-600">سجلات</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className={ `p-2 rounded-xl transition-all duration-300 ${currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white border-2 border-sky-200 text-sky-600 hover:bg-sky-50 hover:border-sky-400 hover:scale-110 shadow-md"
                    }` }
                  disabled={ currentPage === 1 }
                  onClick={ () => setCurrentPage(currentPage - 1) }
                >
                  <ChevronRight size={ 20 } />
                </button>

                <div className="flex items-center gap-2 px-4">
                  { [...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={ pageNum }
                        onClick={ () => setCurrentPage(pageNum) }
                        className={ `w-10 h-10 rounded-xl font-medium transition-all duration-300 ${currentPage === pageNum
                          ? "bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-lg shadow-sky-200 scale-110"
                          : "bg-white border-2 border-gray-200 text-gray-600 hover:border-sky-300 hover:scale-105"
                          }` }
                      >
                        { pageNum }
                      </button>
                    );
                  }) }
                  { totalPages > 5 && (
                    <>
                      <span className="text-gray-400">...</span>
                      <button
                        onClick={ () => setCurrentPage(totalPages) }
                        className={ `w-10 h-10 rounded-xl font-medium transition-all duration-300 ${currentPage === totalPages
                          ? "bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-lg shadow-sky-200 scale-110"
                          : "bg-white border-2 border-gray-200 text-gray-600 hover:border-sky-300 hover:scale-105"
                          }` }
                      >
                        { totalPages }
                      </button>
                    </>
                  ) }
                </div>

                <button
                  className={ `p-2 rounded-xl transition-all duration-300 ${currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white border-2 border-sky-200 text-sky-600 hover:bg-sky-50 hover:border-sky-400 hover:scale-110 shadow-md"
                    }` }
                  disabled={ currentPage === totalPages }
                  onClick={ () => setCurrentPage(currentPage + 1) }
                >
                  <ChevronLeft size={ 20 } />
                </button>
              </div>

              <div className="text-gray-600">
                <span className="font-medium">صفحة { currentPage }</span> من{ " " }
                <span className="font-medium">{ totalPages }</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */ }
      <OrphanDetailsModal
        isOpen={ isModalOpen }
        onClose={ closeModal }
        orphan={ selectedOrphan }
        formatDate={ formatDate }
        calculateAge={ calculateAge }
      />


      <style>{ `
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default Orphans;