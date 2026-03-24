import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import {
  Package,
  DollarSign,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Plus,
  Box,
} from 'lucide-react';

const WarehouseDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);
  const isFetchingRef = useRef(false); // منع الطلبات المتكررة
  const statsRef = useRef({
    total_items: 0,
    total_value: 0,
    available_items: 0,
    low_stock_count: 0,
    low_stock_items: [],
  });
  const [stats, setStats] = useState({
    total_items: 0,
    total_value: 0,
    available_items: 0,
    low_stock_count: 0,
    low_stock_items: [],
  });

  const fetchDashboardData = useCallback(async (isAutoRefresh = false) => {
    // منع الطلبات المتكررة
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    let loadingTimeout;
    const defaultStats = {
      total_items: 0,
      total_value: 0,
      available_items: 0,
      low_stock_count: 0,
      low_stock_items: [],
    };

    try {
      // إذا كان تحديث تلقائي، لا نعرض loading spinner
      if (!isAutoRefresh) {
        // setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      // إيقاف حالة التحميل بعد timeout
      loadingTimeout = setTimeout(() => {
        setLoading(false);
        // عرض بيانات افتراضية بدلاً من البقاء في حالة التحميل
        setStats(defaultStats);
      }, 3000); // timeout 3 ثواني

      // إضافة timestamp للتأكد من جلب البيانات الجديدة (cache busting)
      const timestamp = new Date().getTime();
      const response = await apiClient.get('/warehouse/dashboard', {
        params: { _t: timestamp }, // cache busting
        timeout: 3000 // timeout 3 ثواني للطلب
      });

      // تنظيف timeout إذا نجح الطلب
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }

      // ✅ معالجة الاستجابة بطرق مختلفة
      let dashboardData = null;

      if (response.data) {
        if (response.data.success && response.data.data) {
          dashboardData = response.data.data;
        } else if (response.data.success) {
          dashboardData = response.data;
        } else if (response.data.data) {
          dashboardData = response.data.data;
        } else {
          dashboardData = response.data;
        }
      }

      // ✅ حساب القيمة الإجمالية إذا لم تكن موجودة (محسّن للأداء)
      let totalValue = dashboardData?.total_value || 0;

      // ✅ إذا كانت القيمة 0 أو غير موجودة، نحسبها من الأصناف
      if (totalValue === 0 && dashboardData?.items && Array.isArray(dashboardData.items)) {
        // استخدام حلقة واحدة بدلاً من reduce متعدد
        let sum = 0;
        for (let i = 0; i < dashboardData.items.length; i++) {
          const item = dashboardData.items[i];
          const quantity = parseFloat(item.quantity_available || 0);
          const price = parseFloat(item.unit_price || 0);
          sum += quantity * price;
        }
        totalValue = sum;
      }

      // ✅ حساب الإحصائيات (محسّن للأداء)
      const items = dashboardData?.items;
      const totalItems = dashboardData?.total_items || (items ? items.length : 0);

      let availableItems = dashboardData?.available_items;
      let lowStockItems = dashboardData?.low_stock_items;
      let lowStockCount = dashboardData?.low_stock_count;

      // حساب الإحصائيات من items إذا لم تكن موجودة (حلقة واحدة فقط)
      if (items && Array.isArray(items)) {
        let availableCount = 0;
        const lowStock = [];

        // حساب availableItems إذا لم يكن موجوداً
        if (availableItems === undefined || availableItems === null) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const quantity = parseFloat(item.quantity_available || 0);
            if (quantity > 0) {
              availableCount++;
            }
          }
          availableItems = availableCount;
        }

        // حساب lowStockItems دائماً إذا لم تكن موجودة من API
        if (!lowStockItems || !Array.isArray(lowStockItems) || lowStockItems.length === 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const quantity = parseFloat(item.quantity_available || 0);

            // أصناف قليلة الكمية: أقل من 10 أو نفذت (0)
            if (quantity < 10) {
              lowStock.push(item);
            }
          }

          // ترتيب حسب الكمية (الأقل أولاً)
          lowStock.sort((a, b) => {
            const qtyA = parseFloat(a.quantity_available || 0);
            const qtyB = parseFloat(b.quantity_available || 0);
            return qtyA - qtyB;
          });

          lowStockItems = lowStock.slice(0, 10);
          lowStockCount = lowStock.length;
        }
      }

      // التأكد من أن lowStockCount موجود (حسابه من lowStockItems إذا لم يكن موجوداً)
      if ((!lowStockCount || lowStockCount === 0) && lowStockItems && Array.isArray(lowStockItems) && lowStockItems.length > 0) {
        lowStockCount = lowStockItems.length;
      }

      // إذا كان lowStockItems موجوداً من API لكن lowStockCount غير موجود، نحسبه
      if (lowStockItems && Array.isArray(lowStockItems) && lowStockItems.length > 0 && (!lowStockCount || lowStockCount === 0)) {
        lowStockCount = lowStockItems.length;
      }

      // التأكد من القيم الافتراضية
      if (availableItems === undefined || availableItems === null) availableItems = 0;
      if (lowStockCount === undefined || lowStockCount === null) lowStockCount = 0;
      if (!lowStockItems || !Array.isArray(lowStockItems)) {
        lowStockItems = [];
      }

      // التأكد من أن lowStockCount يطابق عدد lowStockItems
      if (lowStockItems && Array.isArray(lowStockItems) && lowStockItems.length > 0) {
        lowStockCount = Math.max(lowStockCount, lowStockItems.length);
      }

      const newStats = {
        total_items: totalItems,
        total_value: totalValue,
        available_items: availableItems,
        low_stock_count: lowStockCount,
        low_stock_items: Array.isArray(lowStockItems) ? lowStockItems : [],
      };

      // تحديث الـ ref للتحقق من التغييرات
      statsRef.current = newStats;
      setStats(newStats);

      // تحديث وقت آخر تحديث
      setLastUpdate(new Date());

      // ✅ Debug في development
      if (import.meta.env.DEV) {
        console.log('📊 Warehouse Dashboard Data:', {
          dashboardData,
          calculatedTotalValue: totalValue,
          totalItems,
          availableItems,
          lowStockCount,
          lowStockItems: lowStockItems?.length || 0,
          lowStockItemsArray: lowStockItems,
        });
      }
    } catch (error) {
      // تنظيف timeout في حالة الخطأ
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }

      console.error('Error fetching dashboard:', error);

      // عرض بيانات افتراضية في حالة الخطأ
      setStats(defaultStats);

      if (!error.isConnectionError && !error.isTimeoutError) {
        toast.error('فشل تحميل بيانات لوحة التحكم');
      }
    } finally {
      // تنظيف timeout في finally block
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      setLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false; // السماح بطلب جديد
    }
  }, []);

  // تحديث البيانات عند فتح الصفحة أو العودة إليها
  useEffect(() => {
    // تحديث فوري عند فتح الصفحة
    fetchDashboardData();

    // تحديث تلقائي كل 10 ثواني (أسرع)
    intervalRef.current = setInterval(() => {
      fetchDashboardData(true);
    }, 10000); // 10 ثواني

    // تنظيف الـ interval عند unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [location.pathname, fetchDashboardData]); // تحديث عند تغيير المسار

  // تحديث البيانات عند العودة للصفحة (Page Visibility API)
  useEffect(() => {
    let visibilityTimeout;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // تحديث البيانات فوراً عند العودة للصفحة (بدون تأخير)
        clearTimeout(visibilityTimeout);
        fetchDashboardData(true);
      }
    };

    const handleFocus = () => {
      // تحديث البيانات فوراً عند التركيز على النافذة
      clearTimeout(visibilityTimeout);
      fetchDashboardData(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(visibilityTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchDashboardData]);

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatILS = (amount) => {
    if (!amount || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const userRole = user?.role?.toLowerCase?.() ||
    user?.userRole?.toLowerCase?.() ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role || '';

  const canManageWarehouse = ['admin', 'warehouse_manager'].includes(userRole);

  // if (loading) {
  //   return (
  //     <div className="flex justify-center items-center min-h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-sky-50 to-blue-50" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */ }
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl shadow-lg">
                  <Package className="w-8 h-8 text-white" />
                </div>
                لوحة تحكم المخزن
                { isRefreshing && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-600 ml-2"></div>
                ) }
              </h1>
              <p className="text-gray-600 text-sm md:text-base mt-2">
                نظرة شاملة على حالة المخزن والإحصائيات المهمة
                { lastUpdate && (
                  <span className="text-xs text-gray-500 mr-2">
                    • آخر تحديث: { lastUpdate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) }
                  </span>
                ) }
              </p>
            </div>
            { canManageWarehouse && (
              <Link
                to="/warehouse/create"
                className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl hover:shadow-xl transition-all flex items-center gap-2 font-medium text-sm md:text-base"
              >
                <Plus className="w-5 h-5" />
                إضافة صنف جديد
              </Link>
            ) }
          </div>
        </div>

        {/* Stats Cards */ }
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="إجمالي الأصناف"
            value={ stats.total_items.toLocaleString('en-US') }
            subtitle="جميع الأصناف في المخزن"
            icon={ <Box className="w-6 h-6" /> }
            gradient="from-blue-500 to-blue-600"
            iconBg="bg-blue-500/20"
          />
          <StatCard
            title="القيمة الإجمالية"
            value={ `₪${formatILS(stats.total_value)}` }
            subtitle="قيمة المخزون بالشيكل"
            icon={ <DollarSign className="w-6 h-6" /> }
            gradient="from-emerald-500 to-green-600"
            iconBg="bg-emerald-500/20"
            highlight
          />
          <StatCard
            title="الأصناف المتوفرة"
            value={ stats.available_items.toLocaleString('en-US') }
            subtitle="أصناف متوفرة للاستخدام"
            icon={ <Package className="w-6 h-6" /> }
            gradient="from-purple-500 to-purple-600"
            iconBg="bg-purple-500/20"
          />
          <StatCard
            title="تنبيهات نقص الكمية"
            value={ stats.low_stock_count.toLocaleString('en-US') }
            subtitle="أصناف تحتاج إعادة توريد"
            icon={ <AlertCircle className="w-6 h-6" /> }
            gradient="from-orange-500 to-orange-600"
            iconBg="bg-orange-500/20"
            warning={ stats.low_stock_count > 0 }
          />
        </div>

        {/* Low Stock Items */ }
        { (stats.low_stock_count > 0 || (stats.low_stock_items && stats.low_stock_items.length > 0)) && (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-8 border-2 border-orange-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">الأصناف قليلة الكمية</h2>
                  <p className="text-sm text-gray-500">يحتاجون إعادة توريد فورية</p>
                </div>
              </div>
              <Link
                to="/warehouse/list?low_stock=1"
                className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors"
              >
                عرض الكل
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            { stats.low_stock_items && stats.low_stock_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-orange-50 to-red-50">
                    <tr>
                      <th className="text-right py-4 px-4 text-sm font-bold text-gray-700">اسم الصنف</th>
                      <th className="text-right py-4 px-4 text-sm font-bold text-gray-700">الكمية المتوفرة</th>
                      <th className="text-right py-4 px-4 text-sm font-bold text-gray-700">سعر الوحدة</th>
                      <th className="text-right py-4 px-4 text-sm font-bold text-gray-700">القيمة الإجمالية</th>
                      <th className="text-right py-4 px-4 text-sm font-bold text-gray-700">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    { stats.low_stock_items.slice(0, 10).map((item) => {
                      const quantity = parseFloat(item.quantity_available || 0);
                      const price = parseFloat(item.unit_price || 0);
                      const totalValue = quantity * price;

                      return (
                        <tr key={ item.id } className="hover:bg-orange-50/50 transition-colors">
                          <td className="py-4 px-4 text-sm text-gray-800 font-semibold">{ item.item_name || '-' }</td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-2">
                              <span className="text-sm font-bold text-orange-600">{ quantity.toLocaleString('en-US') }</span>
                              { quantity === 0 && (
                                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">نفذ</span>
                              ) }
                            </span>
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-700 font-medium">₪{ formatILS(price) }</td>
                          <td className="py-4 px-4 text-sm text-gray-800 font-bold">₪{ formatILS(totalValue) }</td>
                          <td className="py-4 px-4">
                            <span className={ `inline-block px-3 py-1 rounded-full text-xs font-medium ${quantity === 0
                              ? 'bg-red-100 text-red-700'
                              : quantity < 5
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-yellow-100 text-yellow-700'
                              }` }>
                              { quantity === 0 ? 'نفذ' : quantity < 5 ? 'قليل جداً' : 'قليل' }
                            </span>
                          </td>
                        </tr>
                      );
                    }) }
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <Package className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-gray-600 font-medium">لا توجد أصناف قليلة الكمية</p>
                <p className="text-sm text-gray-500 mt-1">جميع الأصناف متوفرة بكميات كافية</p>
              </div>
            ) }
          </div>
        ) }

        {/* Quick Actions */ }
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            to="/warehouse/list"
            className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all group border-2 border-transparent hover:border-sky-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-sky-100 to-blue-100 rounded-xl">
                <Box className="w-6 h-6 text-sky-600" />
              </div>
              <ArrowRight className="w-5 h-5 text-sky-600 group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">قائمة الأصناف</h3>
            <p className="text-sm text-gray-600">عرض وإدارة جميع أصناف المخزن مع إمكانية البحث والفلترة</p>
          </Link>

          { canManageWarehouse && (
            <>
              <Link
                to="/warehouse/create"
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all group border-2 border-transparent hover:border-emerald-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl">
                    <Plus className="w-6 h-6 text-emerald-600 group-hover:rotate-90 transition-transform" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">إضافة صنف جديد</h3>
                <p className="text-sm text-gray-600">إضافة صنف جديد للمخزن مع تحديد السعر والكمية</p>
              </Link>

              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 shadow-lg border-2 border-purple-100">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">إحصائيات المخزن</h3>
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">إجمالي الأصناف:</span>
                    <span className="text-sm font-bold text-gray-800">{ stats.total_items.toLocaleString('en-US') }</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">القيمة الإجمالية:</span>
                    <span className="text-sm font-bold text-emerald-600">₪{ formatILS(stats.total_value) }</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">الأصناف المتوفرة:</span>
                    <span className="text-sm font-bold text-gray-800">{ stats.available_items.toLocaleString('en-US') }</span>
                  </div>
                </div>
              </div>
            </>
          ) }
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, subtitle, icon, gradient, iconBg, highlight, warning }) => (
  <div className={ `bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all hover:scale-105 ${highlight ? 'ring-4 ring-emerald-200 ring-opacity-50' : ''} ${warning ? 'ring-4 ring-orange-200 ring-opacity-50' : ''}` }>
    <div className="flex items-center justify-between mb-4">
      <div className={ `${iconBg || 'bg-white/20'} backdrop-blur-sm p-4 rounded-xl shadow-lg` }>
        { icon }
      </div>
      { warning && (
        <div className="animate-pulse">
          <AlertCircle className="w-5 h-5 text-white/80" />
        </div>
      ) }
    </div>
    <p className="text-sm opacity-90 mb-1 font-medium">{ title }</p>
    { subtitle && (
      <p className="text-xs opacity-75 mb-3">{ subtitle }</p>
    ) }
    <p
      key={ value }
      className={ `text-4xl font-bold transition-all duration-300 ${highlight ? 'text-yellow-200' : ''}` }
      style={ {
        animation: 'fadeInUp 0.3s ease-out'
      } }
    >
      { value }
    </p>
    <style>{ `
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `}</style>
  </div>
);

export default WarehouseDashboard;

