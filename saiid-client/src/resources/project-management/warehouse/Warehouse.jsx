import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { Search, Plus, AlertTriangle, Package, DollarSign, CheckCircle, X, ChevronLeft, ChevronRight, Edit, Trash2, Minus, RefreshCw } from 'lucide-react';

const Warehouse = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prevPathnameRef = useRef(location.pathname);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantityAction, setQuantityAction] = useState('add'); // 'add' or 'subtract'
  const [quantityValue, setQuantityValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    is_active: '',
    available: '',
    low_stock: '',
    page: 1,
    per_page: 15,
  });

  // للبحث مع debounce
  const [searchInput, setSearchInput] = useState('');
  const searchTimeoutRef = useRef(null);

  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });

  const userRole = useMemo(() => {
    if (!user) return '';
    return (
      user.role?.toLowerCase?.() ||
      user.userRole?.toLowerCase?.() ||
      user.user_role?.toLowerCase?.() ||
      user.role_name?.toLowerCase?.() ||
      user.role ||
      ''
    );
  }, [user]);

  const isAdmin =
    userRole === 'admin' ||
    userRole === 'administrator' ||
    userRole === 'مدير' ||
    userRole === 'مدير عام';

  const isWarehouseManager =
    userRole === 'warehouse_manager' ||
    userRole === 'warehousemanager' ||
    userRole === 'مدير مخزن' ||
    userRole === 'مدير المخزن';

  const canManageWarehouse = isAdmin || isWarehouseManager;

  // مزامنة searchInput مع filters.search
  useEffect(() => {
    if (filters.search === '') {
      setSearchInput('');
    }
  }, [filters.search]);

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.search, filters.is_active, filters.available, filters.low_stock]);

  // تحديث البيانات عند العودة للصفحة من صفحة التعديل
  useEffect(() => {
    // إذا كان المسار هو صفحة الأصناف وتغير من صفحة أخرى
    if (location.pathname === '/warehouse/list') {
      const wasOnEditPage = prevPathnameRef.current.includes('/warehouse/') &&
        prevPathnameRef.current.includes('/edit');

      // إذا كنا على صفحة التعديل سابقاً والآن عدنا لصفحة الأصناف
      if (wasOnEditPage && prevPathnameRef.current !== location.pathname) {
        // تحديث فوري عند العودة من صفحة التعديل
        fetchItems();
      }
    }

    // تحديث المرجع
    prevPathnameRef.current = location.pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.key]);

  // تحديث البيانات عند العودة للصفحة (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && location.pathname === '/warehouse/list') {
        // تحديث البيانات فوراً عند العودة للصفحة
        fetchItems();
      }
    };

    const handleFocus = () => {
      // تحديث البيانات عند التركيز على النافذة
      if (location.pathname === '/warehouse/list') {
        fetchItems();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const fetchItems = async () => {
    let loadingTimeout;
    try {
      setLoading(true);
      setError(null);

      // زيادة timeout للـ UI loading indicator
      loadingTimeout = setTimeout(() => {
        setLoading(false);
      }, 20000); // 20 ثانية

      // ✅ إنشاء params وإضافة القيم فقط إذا كانت موجودة
      const params = {
        page: filters.page,
        per_page: filters.per_page,
      };

      // إضافة الـ filters فقط إذا كانت لها قيمة
      if (filters.search) {
        params.search = filters.search;
      }

      if (filters.is_active !== '' && filters.is_active !== null && filters.is_active !== undefined) {
        params.is_active = filters.is_active;
      }

      // فلتر التوفر - إرسال القيمة كـ string '1' أو '0' أو true/false حسب ما يتوقعه الـ API
      if (filters.available !== '' && filters.available !== null && filters.available !== undefined) {
        // إرسال القيمة كما هي (string '1' أو '0')
        params.available = filters.available;
      }

      if (filters.low_stock) {
        params.low_stock = filters.low_stock;
      }

      // استخدام timeout أطول (20 ثانية) أو عدم تحديده لاستخدام الافتراضي من axiosConfig

      // Debug في development
      if (import.meta.env.DEV) {
        console.log('📊 Warehouse Filters:', filters);
        console.log('📊 Warehouse API Params:', params);
      }

      const response = await apiClient.get('/warehouse', {
        params,
        timeout: 20000, // 20 ثانية بدلاً من 8
      });

      if (loadingTimeout) clearTimeout(loadingTimeout);

      // تحسين معالجة الاستجابة
      let itemsData = [];
      let paginationData = {
        current_page: filters.page,
        last_page: 1,
        per_page: filters.per_page,
        total: 0,
      };

      // معالجة الاستجابة بطرق مختلفة
      if (response.data) {
        // الحالة 1: Laravel Pagination - { success: true, data: { data: [...], current_page, last_page, ... } }
        if (response.data.success === true && response.data.data) {
          const data = response.data.data;

          // ✅ Laravel paginate() يرجع البيانات في data.data
          if (Array.isArray(data.data)) {
            itemsData = data.data;
            paginationData = {
              current_page: data.current_page || filters.page,
              last_page: data.last_page || 1,
              per_page: data.per_page || filters.per_page,
              total: data.total || itemsData.length,
            };
          }
          // ✅ إذا كان data نفسه array
          else if (Array.isArray(data)) {
            itemsData = data;
            paginationData = {
              current_page: response.data.current_page || filters.page,
              last_page: response.data.last_page || 1,
              per_page: response.data.per_page || filters.per_page,
              total: response.data.total || itemsData.length,
            };
          }
          // ✅ إذا كان data object يحتوي على items
          else if (data.items && Array.isArray(data.items)) {
            itemsData = data.items;
            paginationData = {
              current_page: data.current_page || filters.page,
              last_page: data.last_page || 1,
              per_page: data.per_page || filters.per_page,
              total: data.total || itemsData.length,
            };
          }
        }
        // الحالة 2: success: true مع items مباشرة
        else if (response.data.success === true && response.data.items) {
          itemsData = Array.isArray(response.data.items) ? response.data.items : [];
          paginationData = {
            current_page: response.data.current_page || filters.page,
            last_page: response.data.last_page || 1,
            per_page: response.data.per_page || filters.per_page,
            total: response.data.total || itemsData.length,
          };
        }
        // الحالة 3: data مباشرة (بدون success)
        else if (response.data.data) {
          const data = response.data.data;
          if (Array.isArray(data.data)) {
            itemsData = data.data;
            paginationData = {
              current_page: data.current_page || filters.page,
              last_page: data.last_page || 1,
              per_page: data.per_page || filters.per_page,
              total: data.total || itemsData.length,
            };
          } else if (Array.isArray(data)) {
            itemsData = data;
            paginationData = {
              current_page: filters.page,
              last_page: 1,
              per_page: filters.per_page,
              total: itemsData.length,
            };
          }
        }
        // الحالة 4: array مباشر
        else if (Array.isArray(response.data)) {
          itemsData = response.data;
          paginationData = {
            current_page: filters.page,
            last_page: 1,
            per_page: filters.per_page,
            total: itemsData.length,
          };
        }
        // الحالة 5: items مباشرة
        else if (response.data.items && Array.isArray(response.data.items)) {
          itemsData = response.data.items;
          paginationData = {
            current_page: response.data.current_page || filters.page,
            last_page: response.data.last_page || 1,
            per_page: response.data.per_page || filters.per_page,
            total: response.data.total || itemsData.length,
          };
        }
        // الحالة 6: success: true لكن بدون data (قائمة فارغة)
        else if (response.data.success === true) {
          // ✅ الاستجابة ناجحة لكن لا توجد بيانات
          itemsData = [];
          paginationData = {
            current_page: filters.page,
            last_page: 1,
            per_page: filters.per_page,
            total: 0,
          };
        }
      }

      // ✅ الـ Backend يتولى الفلترة الآن، لا حاجة للفلترة على الـ Frontend

      // Debug في development - طباعة بنية الاستجابة الكاملة
      if (import.meta.env.DEV) {
        console.log('📦 Warehouse API Response:', {
          fullResponse: response.data,
          responseKeys: Object.keys(response.data || {}),
          responseSuccess: response.data?.success,
          responseData: response.data?.data,
          responseItems: response.data?.items,
          isArray: Array.isArray(response.data),
          isArrayData: Array.isArray(response.data?.data),
          itemsData,
          itemsDataLength: itemsData.length,
          paginationData,
        });

        // ✅ طباعة بنية response.data.data بالتفصيل
        if (response.data?.data) {
          console.log('📦 response.data.data structure:', {
            type: typeof response.data.data,
            isArray: Array.isArray(response.data.data),
            keys: typeof response.data.data === 'object' && !Array.isArray(response.data.data)
              ? Object.keys(response.data.data)
              : 'N/A',
            data: response.data.data,
          });
        }
      }

      setItems(itemsData);
      setPagination(paginationData);

      // إذا لم توجد بيانات
      if (itemsData.length === 0 && !error) {
        // ✅ لا نعرض رسالة خطأ إذا كان الاستجابة ناجحة لكن لا توجد بيانات
        // قد يكون المستخدم لا يملك أصنافاً في المخزن
        setError(null);
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setItems([]);
      setPagination((prev) => ({ ...prev, total: 0 }));

      // Debug في development
      if (import.meta.env.DEV) {
        console.error('❌ Warehouse API Error:', error);
        console.error('Error Response:', error.response?.data);
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
      }

      // معالجة timeout بشكل خاص
      if (error.isTimeoutError || error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        const timeoutMessage = error.userMessage || 'انتهت مهلة الاتصال. قد يكون الخادم بطيئاً أو هناك مشكلة في الاتصال.';
        toast.error(timeoutMessage);
        setError(timeoutMessage);
        return;
      }

      // معالجة أخطاء الاتصال
      if (error.isConnectionError || error.code === 'ERR_NETWORK') {
        const connectionMessage = 'فشل الاتصال بالخادم. تأكد من أن Backend يعمل.';
        toast.error(connectionMessage);
        setError(connectionMessage);
        return;
      }

      // معالجة الأخطاء الأخرى
      const message =
        error.response?.data?.message ||
        error.userMessage ||
        'فشل في تحميل بيانات المخزن';
      toast.error(message);
      setError(message);
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1, // إعادة تعيين الصفحة عند تغيير أي فلتر
    }));
  }, []);

  // معالجة البحث مع debounce (500ms)
  const handleSearchChange = useCallback((value) => {
    setSearchInput(value);

    // إلغاء timeout السابق
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // إضافة timeout جديد
    searchTimeoutRef.current = setTimeout(() => {
      handleFilterChange('search', value);
    }, 500); // انتظار 500ms بعد توقف الكتابة
  }, [handleFilterChange]);

  // تنظيف timeout عند unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.last_page) return;
    handleFilterChange('page', newPage);
  };

  const getStatusBadge = (item) => {
    const isActive = item.is_active ?? true;
    const isAvailable = (item.quantity_available ?? 0) > 0;
    if (!isActive) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          غير نشط
        </span>
      );
    }
    if (!isAvailable) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">
          غير متوفر
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        متوفر
      </span>
    );
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`هل أنت متأكد من حذف الصنف "${itemName}"؟`)) {
      return;
    }

    try {
      const response = await apiClient.delete(`/warehouse/${itemId}`);
      if (response.data.success) {
        toast.success('تم حذف الصنف بنجاح');
        fetchItems();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'فشل حذف الصنف');
    }
  };

  const handleQuantityAction = async () => {
    if (!quantityValue || parseFloat(quantityValue) <= 0) {
      toast.error('الرجاء إدخال كمية صحيحة');
      return;
    }

    try {
      setIsSubmitting(true);
      const endpoint = quantityAction === 'add'
        ? `/warehouse/${selectedItem.id}/add-quantity`
        : `/warehouse/${selectedItem.id}/subtract-quantity`;

      const response = await apiClient.post(endpoint, {
        quantity: parseFloat(quantityValue),
      });

      if (response.data.success) {
        toast.success(`تم ${quantityAction === 'add' ? 'إضافة' : 'خصم'} الكمية بنجاح`);
        setShowQuantityModal(false);
        setSelectedItem(null);
        setQuantityValue('');
        fetchItems();
      }
    } catch (error) {
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        if (errorData.error === 'الكمية غير كافية') {
          toast.error(`${errorData.message}\nالمتوفر: ${errorData.available_quantity}`);
        } else {
          toast.error(errorData.message || 'خطأ في البيانات');
        }
      } else {
        toast.error(`فشل ${quantityAction === 'add' ? 'إضافة' : 'خصم'} الكمية`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-sky-50 p-4 sm:p-6"
      style={ { fontFamily: 'Cairo, sans-serif' } }
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */ }
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-7 h-7 text-sky-600" />
              إدارة المخزن
            </h1>
            <p className="text-gray-600 mt-1 text-sm md:text-base">
              عرض أصناف المخزن مع إمكانية البحث والفلترة.
            </p>
          </div>
          { canManageWarehouse && (
            <Link
              to="/warehouse/create"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm md:text-base font-medium shadow-md hover:shadow-lg transition-shadow"
            >
              <Plus className="w-4 h-4" />
              إضافة صنف جديد
            </Link>
          ) }
        </div>

        {/* Filters */ }
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Search className="w-5 h-5 text-sky-600" />
              الفلاتر والبحث
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={ () => {
                  // تحديث البيانات والانتقال لصفحة الأصناف المتوفرة
                  setSearchInput('');
                  setFilters({
                    search: '',
                    is_active: '',
                    available: '1', // أصناف متوفرة فقط
                    low_stock: '',
                    page: 1,
                    per_page: 15,
                  });
                  // fetchItems سيتم استدعاؤه تلقائياً من useEffect عند تغيير filters
                } }
                className="inline-flex items-center gap-1 text-xs sm:text-sm text-sky-600 hover:text-sky-700 font-medium px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                تحديث
              </button>
              <button
                type="button"
                onClick={ () => {
                  setSearchInput('');
                  setFilters({
                    search: '',
                    is_active: '',
                    available: '',
                    low_stock: '',
                    page: 1,
                    per_page: 15,
                  });
                } }
                className="inline-flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4" />
                مسح الفلاتر
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                البحث في اسم الصنف
              </label>
              <input
                type="text"
                value={ searchInput }
                onChange={ (e) => handleSearchChange(e.target.value) }
                placeholder="اكتب جزءاً من اسم الصنف..."
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الحالة
              </label>
              <select
                value={ filters.is_active }
                onChange={ (e) => handleFilterChange('is_active', e.target.value) }
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">الكل</option>
                <option value="1">نشط</option>
                <option value="0">غير نشط</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                التوفر
              </label>
              <select
                value={ filters.available }
                onChange={ (e) => handleFilterChange('available', e.target.value) }
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">الكل</option>
                <option value="1">أصناف متوفرة فقط</option>
                <option value="0">أصناف غير متوفرة فقط</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                نقص الكمية
              </label>
              <select
                value={ filters.low_stock }
                onChange={ (e) => handleFilterChange('low_stock', e.target.value) }
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">الكل</option>
                <option value="1">فقط الأصناف ذات الكمية القليلة</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */ }
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                    اسم الصنف
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                    الوصف
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                    الكمية المتوفرة
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                    سعر الوحدة
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                    الحالة
                  </th>
                  { canManageWarehouse && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                      إجراءات
                    </th>
                  ) }
                </tr>
              </thead>
              <tbody>
                { loading ? (
                  <tr>
                    <td
                      colSpan={ canManageWarehouse ? 6 : 5 }
                      className="px-4 py-10 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
                        <p className="text-sm">جاري تحميل بيانات المخزن...</p>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={ canManageWarehouse ? 6 : 5 }
                      className="px-4 py-10 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertTriangle className="w-8 h-8 text-gray-300" />
                        <p className="text-sm font-medium">
                          { error || 'لا توجد أصناف مطابقة للبحث الحالي.' }
                        </p>
                        { !error && (
                          <p className="text-xs text-gray-400 mt-1">
                            جرب تغيير الفلاتر أو أضف أصنافاً جديدة للمخزن
                          </p>
                        ) }
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={ item.id }
                      className="border-t border-gray-100 hover:bg-sky-50/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        { item.item_name || '-' }
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                        { item.description
                          ? String(item.description).substring(0, 80) +
                          (String(item.description).length > 80 ? '...' : '')
                          : '-' }
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        { item.quantity_available ?? 0 }
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        <span className="inline-flex items-center gap-1 text-gray-800">
                          <span className="text-emerald-600 font-semibold">₪</span>
                          { Number(item.unit_price ?? 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) }
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{ getStatusBadge(item) }</td>
                      { canManageWarehouse && (
                        <td className="px-4 py-3 text-xs text-gray-500">
                          <div className="flex flex-wrap items-center gap-2 justify-start">
                            <Link
                              to={ `/warehouse/${item.id}/edit` }
                              className="px-3 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-medium flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" />
                              تعديل
                            </Link>
                            <button
                              type="button"
                              onClick={ () => {
                                setSelectedItem(item);
                                setQuantityAction('add');
                                setQuantityValue('');
                                setShowQuantityModal(true);
                              } }
                              className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" />
                              إدارة الكمية
                            </button>
                            <button
                              type="button"
                              onClick={ () => handleDeleteItem(item.id, item.item_name) }
                              className="px-3 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              حذف
                            </button>
                          </div>
                        </td>
                      ) }
                    </tr>
                  ))
                ) }
              </tbody>
            </table>
          </div>

          {/* Pagination */ }
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              عرض{ ' ' }
              <span className="font-semibold text-gray-700">
                { items.length }
              </span>{ ' ' }
              من أصل{ ' ' }
              <span className="font-semibold text-gray-700">
                { pagination.total }
              </span>{ ' ' }
              صنف
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={ () => handlePageChange(pagination.current_page - 1) }
                disabled={ pagination.current_page <= 1 }
                className="inline-flex items-center justify-center px-2 py-1 rounded-lg border border-gray-300 bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-600">
                صفحة { pagination.current_page } من { pagination.last_page }
              </span>
              <button
                type="button"
                onClick={ () => handlePageChange(pagination.current_page + 1) }
                disabled={ pagination.current_page >= pagination.last_page }
                className="inline-flex items-center justify-center px-2 py-1 rounded-lg border border-gray-300 bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quantity Management Modal */ }
      { showQuantityModal && selectedItem && (
        <QuantityModal
          isOpen={ showQuantityModal }
          onClose={ () => {
            setShowQuantityModal(false);
            setSelectedItem(null);
            setQuantityValue('');
          } }
          item={ selectedItem }
          action={ quantityAction }
          onActionChange={ setQuantityAction }
          quantityValue={ quantityValue }
          onQuantityChange={ setQuantityValue }
          onSubmit={ handleQuantityAction }
          isSubmitting={ isSubmitting }
        />
      ) }
    </div>
  );
};

// Quantity Management Modal Component
const QuantityModal = ({
  isOpen,
  onClose,
  item,
  action,
  onActionChange,
  quantityValue,
  onQuantityChange,
  onSubmit,
  isSubmitting,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">إدارة الكمية</h3>
          <button
            onClick={ onClose }
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">الصنف: <span className="font-semibold text-gray-800">{ item.item_name }</span></p>
            <p className="text-sm text-gray-600">الكمية الحالية: <span className="font-semibold text-gray-800">{ item.quantity_available }</span></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الإجراء</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={ () => onActionChange('add') }
                className={ `flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${action === 'add'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }` }
              >
                إضافة
              </button>
              <button
                type="button"
                onClick={ () => onActionChange('subtract') }
                className={ `flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${action === 'subtract'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }` }
              >
                خصم
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الكمية</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={ quantityValue }
              onChange={ (e) => onQuantityChange(e.target.value) }
              placeholder="أدخل الكمية"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          { action === 'subtract' && parseFloat(quantityValue) > (item.quantity_available || 0) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">
                ⚠️ الكمية المطلوب خصمها ({ quantityValue }) أكبر من الكمية المتوفرة ({ item.quantity_available })
              </p>
            </div>
          ) }

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={ onClose }
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={ onSubmit }
              disabled={ isSubmitting || !quantityValue || parseFloat(quantityValue) <= 0 || (action === 'subtract' && parseFloat(quantityValue) > (item.quantity_available || 0)) }
              className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              { isSubmitting ? 'جاري المعالجة...' : action === 'add' ? 'إضافة' : 'خصم' }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Warehouse;