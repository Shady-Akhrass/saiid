import React, { useState, useEffect, useRef } from "react";
import apiClient from "../../../utils/axiosConfig";
import { useToast } from "../../../hooks/useToast";
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
  Calendar,
  Briefcase,
  MapPin,
  Phone,
  Heart,
} from "lucide-react";

const Aids = () => {
  const { getData, setCachedData, isCacheValid, initializeCache, clearCache } = useCache('aids', 300000); // 5 دقائق
  const { invalidateAidsCache } = useCacheInvalidation();
  const abortControllerRef = useRef(null);
  const [aidsList, setAidsList] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ✅ تهيئة الـ cache عند التحميل
  useEffect(() => {
    initializeCache();
  }, [initializeCache]);

  // ✅ الاستماع إلى أحداث إبطال الكاش
  useEffect(() => {
    const handleCacheInvalidation = (event) => {
      const { cacheKey } = event.detail;

      if (cacheKey === 'all' || cacheKey === 'aids') {
        clearCache();
        setRefreshTrigger(prev => prev + 1);

        if (import.meta.env.DEV) {
          console.log('✅ Aids cache invalidated, fetching fresh data');
        }
      }
    };

    window.addEventListener('cache-invalidated', handleCacheInvalidation);

    return () => {
      window.removeEventListener('cache-invalidated', handleCacheInvalidation);
    };
  }, [clearCache]);
  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAids, setTotalAids] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "" });
  const { success, error: showError, info } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  const fetchAids = async () => {
    let loadingTimeout;

    try {
      // ✅ التحقق من Cache أولاً
      const filtersKey = JSON.stringify({ searchQuery, perPage, currentPage });
      if (isCacheValid(filtersKey)) {
        const cachedData = getData();
        if (cachedData) {
          setAidsList(cachedData.aids || cachedData);
          setTotalAids(cachedData.totalAids || cachedData.length || 0);
          setTotalPages(cachedData.totalPages || Math.ceil((cachedData.totalAids || cachedData.length) / perPage) || 0);
          setIsLoading(false);
          if (import.meta.env.DEV) {
            console.log('✅ Using cached aids data');
          }
          return;
        }
      }

      // ✅ إلغاء الطلب السابق إذا كان موجوداً
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // ✅ إنشاء AbortController جديد
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);

      // إيقاف حالة التحميل بعد timeout
      loadingTimeout = setTimeout(() => {
        setIsLoading(false);
        setAidsList([]);
        setTotalAids(0);
        setTotalPages(0);
      }, 5000); // timeout 5 ثواني

      // ✅ إنشاء params مع إزالة القيم الفارغة
      const params = {};
      if (searchQuery && searchQuery.trim() !== '') {
        params.searchQuery = searchQuery;
      }
      if (perPage) {
        params.perPage = perPage;
      }
      if (currentPage) {
        params.page = currentPage;
      }

      const response = await apiClient.get("/aids", {
        params,
        timeout: 5000, // timeout 5 ثواني
        signal: abortController.signal
      });

      if (loadingTimeout) clearTimeout(loadingTimeout);

      if (Array.isArray(response.data.aids)) {
        setAidsList(response.data.aids);
        // API returns "totalaids" (lowercase a) in your example
        setTotalAids(response.data.totalaids || 0);
        setTotalPages(response.data.totalPages || 0);

        // ✅ حفظ البيانات في cache
        setCachedData({
          aids: response.data.aids,
          totalAids: response.data.totalaids || 0,
          totalPages: response.data.totalPages || 0
        }, { searchQuery, perPage, currentPage });
      } else {
        setAidsList([]);
        setTotalAids(0);
        setTotalPages(0);
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);

      // ✅ تجاهل أخطاء الإلغاء
      if (error.name === 'AbortError' ||
        error.code === 'ERR_CANCELED' ||
        error.message === 'canceled' ||
        abortControllerRef.current?.signal.aborted) {
        return;
      }

      // ✅ معالجة خاصة لأخطاء 401 (غير مصرح)
      if (error.response?.status === 401) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ 401 Unauthorized - User may not have permission to access /aids endpoint', {
            role: window.user?.role,
            error: error.response?.data,
          });
        }
        setAidsList([]);
        setTotalAids(0);
        setTotalPages(0);
        setIsLoading(false);
        showError('ليس لديك صلاحيات للوصول إلى هذا القسم.');
        return;
      }

      // ✅ معالجة خاصة لأخطاء 500 (خطأ في السيرفر)
      if (error.response?.status === 500) {
        if (import.meta.env.DEV) {
          console.error('⚠️ 500 Internal Server Error - Backend syntax error detected', {
            error: error.response?.data,
            message: error.response?.data?.message,
            sentParams: params,
          });
        }
        setAidsList([]);
        setTotalAids(0);
        setTotalPages(0);
        setIsLoading(false);
        showError('خطأ في السيرفر. يرجى الاتصال بالدعم الفني. (خطأ 500)');
        return;
      }

      // ✅ إذا كان هناك بيانات في cache، استخدمها
      const cachedData = getData();
      if (cachedData) {
        setAidsList(cachedData.aids || cachedData);
        setTotalAids(cachedData.totalAids || cachedData.length || 0);
        setTotalPages(cachedData.totalPages || Math.ceil((cachedData.totalAids || cachedData.length) / perPage) || 0);
        setIsLoading(false);
        if (import.meta.env.DEV) {
          console.log('⚠️ Error fetching aids, using cached data');
        }
        return;
      }

      setAidsList([]);
      setTotalAids(0);
      setTotalPages(0);

      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error("Error fetching aids:", {
          error,
          status: error.response?.status,
          data: error.response?.data,
          sentParams: params,
        });
      }

      if (!error.isConnectionError) {
        showError(error.userMessage || "خطأ في جلب البيانات، يرجى المحاولة مرة أخرى.");
      }
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // ✅ التحقق من cache أولاً قبل جلب البيانات
    const filtersKey = JSON.stringify({ searchQuery, perPage, currentPage });
    if (isCacheValid(filtersKey)) {
      const cachedData = getData();
      if (cachedData) {
        setAidsList(cachedData.aids || cachedData);
        setTotalAids(cachedData.totalAids || cachedData.length || 0);
        setTotalPages(cachedData.totalPages || Math.ceil((cachedData.totalAids || cachedData.length) / perPage) || 0);
        setIsLoading(false);
        if (import.meta.env.DEV) {
          console.log('✅ Using cached aids data (from useEffect)');
        }
        return;
      }
    }

    // ✅ فقط إذا لم تكن البيانات في cache، اجلبها من API
    fetchAids();

    // ✅ تنظيف: إلغاء الطلب عند unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, perPage, currentPage, refreshTrigger]); // ✅ إضافة refreshTrigger

  const handleDownloadExcel = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    info("جاري تحضير ملف Excel للتحميل... قد يستغرق دقائق إذا كان الملف كبيراً");

    try {
      const response = await apiClient.get("/aids/export", {
        responseType: "blob",
        timeout: 180000, // 3 دقائق لملفات Excel الكبيرة
        skipDeduplication: true,
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "aids.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();

      success("سيبدأ التحميل خلال لحظات...");
    } catch (error) {
      console.error("Error downloading Excel file:", error);
      const isTimeout = error.code === "ECONNABORTED" || error.message?.includes("timeout");
      const message = isTimeout
        ? "انتهت مهلة التحميل (الملف كبير). يرجى المحاولة مرة أخرى أو تقليل عدد السجلات."
        : (error.userMessage || "يرجى المحاولة مرة أخرى بعد قليل");
      showError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  const sortedAids = React.useMemo(() => {
    if (!sortConfig.key) return aidsList;
    return [...aidsList].sort((a, b) => {
      const aValue = sortConfig.key.split(".").reduce((o, i) => (o ? o[i] : undefined), a);
      const bValue = sortConfig.key.split(".").reduce((o, i) => (o ? o[i] : undefined), b);
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      if (aValue < bValue) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });
  }, [aidsList, sortConfig]);

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="p-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-gradient-to-br from-sky-100 to-orange-100 rounded-2xl"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-40"></div>
            <div className="h-3 bg-gray-100 rounded w-24"></div>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="h-4 bg-gray-200 rounded w-24 mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-6 bg-gradient-to-r from-sky-100 to-sky-200 rounded-full w-24 mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-4 bg-gray-200 rounded w-40 mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-6 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-full w-24 mx-auto"></div>
      </td>
      <td className="p-4">
        <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
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
                  بيانات المسجلين للمساعدات
                </h1>
                <p className="text-gray-600 mt-1">إجمالي السجلات: { totalAids }</p>
              </div>
            </div>

            <button
              onClick={ handleDownloadExcel }
              disabled={ isDownloading }
              className={ `group flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-2xl transition-all duration-300 shadow-lg shadow-green-200
                ${isDownloading
                  ? "opacity-75 cursor-not-allowed"
                  : "hover:from-green-500 hover:to-green-600 transform hover:scale-105"
                }` }
            >
              <Download className={ `w-5 h-5 ${isDownloading ? "animate-bounce" : "group-hover:animate-bounce"}` } />
              <span className="font-medium">{ isDownloading ? "جاري التحميل..." : "تحميل Excel" }</span>
            </button>
          </div>
        </div>

        {/* Search and Filter Section */ }
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative group">
              <input
                type="text"
                className="w-full px-12 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-right transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg focus:shadow-sky-100 hover:border-sky-300"
                placeholder="البحث عن شخص..."
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
                    onClick={ () => requestSort("name") }
                    className="p-4 text-right font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                  >
                    <div className="flex items-center gap-2">
                      <span>معلومات رب الأسرة</span>
                      <ArrowUpDown className="w-4 h-4 text-gray-400 group-hover:text-sky-500 transition-colors duration-300" />
                    </div>
                  </th>
                  <th
                    onClick={ () => requestSort("birth_date") }
                    className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Calendar className="w-4 h-4 text-sky-500" />
                      <span>تاريخ الميلاد</span>
                    </div>
                  </th>
                  <th
                    onClick={ () => requestSort("job") }
                    className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Briefcase className="w-4 h-4 text-sky-500" />
                      <span>العمل</span>
                    </div>
                  </th>
                  <th
                    onClick={ () => requestSort("original_address") }
                    className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-500" />
                      <span>العنوان الأصلي</span>
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
                  <th
                    onClick={ () => requestSort("guardian_phone_number") }
                    className="p-4 text-center font-semibold text-gray-700 cursor-pointer hover:bg-sky-100/50 transition-colors duration-300 group"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Phone className="w-4 h-4 text-sky-500" />
                      <span>رقم الهاتف</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                { isLoading ? (
                  Array(perPage)
                    .fill()
                    .map((_, index) => <SkeletonRow key={ index } />)
                ) : sortedAids.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center p-12">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full">
                          <Users className="w-12 h-12 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-lg">لا توجد بيانات متاحة</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedAids.map((aid, index) => (
                    <tr
                      key={ aid.aid_id_number || aid._id || `${aid.id_number}-${index}` }
                      className={ `border-b border-gray-100 transition-all duration-300 hover:bg-gradient-to-r hover:from-sky-50/50 hover:to-orange-50/50 ${hoveredRow === index ? "scale-[1.01] shadow-lg" : ""
                        }` }
                      onMouseEnter={ () => setHoveredRow(index) }
                      onMouseLeave={ () => setHoveredRow(null) }
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-sky-400 to-orange-400 rounded-2xl blur-sm opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative h-14 w-14 flex items-center justify-center rounded-2xl border-2 border-white shadow-md bg-white">
                              <Users className="w-7 h-7 text-sky-500" />
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{ aid.name }</p>
                            { aid.id_number && (
                              <p className="text-sm text-gray-500">الهوية: { aid.id_number }</p>
                            ) }
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-gray-700">{ formatDate(aid.birth_date) }</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-sky-100 to-sky-200 text-sky-700">
                          { aid.job || "-" }
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-gray-700">{ aid.original_address || "-" }</span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={ `px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1
                            ${aid.health_status === "جيدة"
                              ? "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-700"
                              : aid.health_status === "مريض"
                                ? "bg-gradient-to-r from-amber-100 to-amber-200 text-amber-700"
                                : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700"
                            }` }
                        >
                          <div
                            className={ `w-2 h-2 rounded-full ${aid.health_status === "جيدة"
                              ? "bg-emerald-500"
                              : aid.health_status === "مريض"
                                ? "bg-amber-500"
                                : "bg-gray-500"
                              }` }
                          ></div>
                          { aid.health_status || "-" }
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-gray-700">{ aid.guardian_phone_number || "-" }</span>
                      </td>
                    </tr>
                  ))
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
                  className={ `p-2 rounded-xl transition-all duration-300 ${currentPage === totalPages || totalPages === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white border-2 border-sky-200 text-sky-600 hover:bg-sky-50 hover:border-sky-400 hover:scale-110 shadow-md"
                    }` }
                  disabled={ currentPage === totalPages || totalPages === 0 }
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

export default Aids;