import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import {
  calculateTotalSurplus,
  calculateTotalDeficit,
  filterProjectsForAdmin,
} from '../../../utils/surplusHelpers';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  FileText,
  ArrowRight,
  Package,
  Coins,
} from 'lucide-react';

const SurplusDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false); // ✅ تعطيل loading state افتراضياً
  const [stats, setStats] = useState({
    total_surplus: 0,
    total_deficit: 0,
    net_surplus: 0,
    projects_with_surplus_count: 0,
    projects_with_deficit_count: 0,
    recent_projects: [],
    categories_statistics: [],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // ✅ جلب بيانات Dashboard
      const dashboardResponse = await apiClient.get('/surplus/dashboard');

      // ✅ جلب جميع المشاريع من نفس endpoint المستخدم في التقرير للحساب الصحيح
      const reportResponse = await apiClient.get('/surplus/report', {
        params: {
          per_page: 10000,
          page: 1,
        }
      });

      if (dashboardResponse.data.success) {
        const dashboardData = dashboardResponse.data.data || dashboardResponse.data;

        // ✅ حساب الفائض والعجز من المشاريع الفعلية بنفس منطق صفحة التقرير
        let projectsData = [];
        if (reportResponse.data.success) {
          const reportData = reportResponse.data.data || reportResponse.data;
          projectsData = Array.isArray(reportData.projects) ? reportData.projects : Array.isArray(reportData) ? reportData : [];

          // ✅ فلترة المشاريع للأدمن: استبعاد المشاريع المقسمة الأصلية (نفس منطق التقرير)
          projectsData = filterProjectsForAdmin(projectsData, user);
        }

        // ✅ حساب الفائض والعجز بنفس منطق صفحة التقرير
        const totalSurplus = calculateTotalSurplus(projectsData);
        const totalDeficit = calculateTotalDeficit(projectsData);

        // ✅ حساب الفائض الصافي: الفائض - العجز
        const netSurplus = totalSurplus - totalDeficit;

        // ✅ حساب الرصيد الإجمالي للأقسام من المشاريع الفعلية
        const categoriesWithCalculatedBalance = (dashboardData.categories_statistics || []).map(category => {
          // ✅ حساب الفائض والعجز من المشاريع في هذا القسم
          const categoryProjects = projectsData.filter(p =>
            p.surplus_category_id === category.category_id ||
            p.surplus_category?.id === category.category_id
          );

          const categorySurplus = calculateTotalSurplus(categoryProjects);
          const categoryDeficit = calculateTotalDeficit(categoryProjects);

          return {
            ...category,
            total_surplus: categorySurplus,
            total_deficit: categoryDeficit,
            total_balance: categorySurplus - categoryDeficit,
            projects_count: categoryProjects.length,
          };
        });

        setStats({
          total_surplus: totalSurplus,
          total_deficit: totalDeficit,
          net_surplus: netSurplus,
          projects_with_surplus_count: dashboardData.projects_with_surplus_count || 0,
          projects_with_deficit_count: dashboardData.projects_with_deficit_count || 0,
          recent_projects: dashboardData.recent_projects || [],
          categories_statistics: categoriesWithCalculatedBalance,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);

      // ✅ معالجة خاصة لخطأ 403 (Forbidden)
      if (error.response?.status === 403) {
        const errorMessage = error.response?.data?.message || 
          'ليس لديك صلاحيات للوصول إلى لوحة التحكم لهذا القسم. يرجى التواصل مع الإدارة.';
        
        if (import.meta.env.DEV) {
          console.error('📊 Dashboard Error Details (403 Forbidden):', {
            status: error.response?.status,
            message: errorMessage,
            data: error.response?.data,
            url: error.config?.url,
            userRole: user?.role || user?.userRole || user?.user_role || 'غير محدد',
            note: 'Backend يرفض الطلب. يجب تحديث Backend للسماح لدور الإشراف بالوصول إلى endpoints الفائض.'
          });
        }

        toast.error(errorMessage);
        
        // ✅ إرجاع بيانات فارغة وعدم محاولة إعادة المحاولة
        setStats({
          total_surplus: 0,
          total_deficit: 0,
          net_surplus: 0,
          projects_with_surplus_count: 0,
          projects_with_deficit_count: 0,
          recent_projects: [],
          categories_statistics: [],
        });
        return;
      }

      // ✅ عرض رسالة خطأ واضحة للأخطاء الأخرى
      const errorMessage = error.response?.data?.message ||
        error.userMessage ||
        'حدث خطأ في جلب بيانات الوافر';

      // ✅ عرض تفاصيل الخطأ في وضع التطوير
      if (import.meta.env.DEV) {
        console.error('📊 Dashboard Error Details:', {
          status: error.response?.status,
          message: errorMessage,
          data: error.response?.data,
          url: error.config?.url,
        });
      }

      // ✅ عرض رسالة خطأ للمستخدم
      if (!error.isConnectionError && !error.isTimeoutError) {
        toast.error(errorMessage || 'فشل تحميل بيانات لوحة التحكم. يرجى المحاولة مرة أخرى.');
      }

      // ✅ في حالة الخطأ، نعرض بيانات افتراضية (قيم صفرية)
      // هذا يمنع كسر الواجهة ويسمح للمستخدم برؤية الصفحة
      setStats({
        total_surplus: 0,
        total_deficit: 0,
        net_surplus: 0,
        projects_with_surplus_count: 0,
        projects_with_deficit_count: 0,
        recent_projects: [],
        categories_statistics: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */ }
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <DollarSign className="w-8 h-8 text-green-600" />
              لوحة تحكم الفائض
            </h1>
            { loading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                جاري التحميل...
              </div>
            ) }
          </div>
        </div>

        {/* Error Message */ }
        { !loading && stats.total_surplus === 0 && stats.total_deficit === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <div className="flex-1">
                <p className="font-medium">تحذير: لا يمكن جلب بيانات الوافر</p>
                <div className="text-sm mt-1">
                  <p className="mb-2">يرجى التحقق من:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>أن الـ Backend يعمل بشكل صحيح</li>
                    <li>أن endpoint <code className="bg-red-100 px-1 rounded">/api/surplus/dashboard</code> موجود ويعمل</li>
                    <li>التحقق من سجلات الأخطاء في الـ Backend</li>
                  </ul>
                </div>
                <button
                  onClick={ fetchDashboardData }
                  className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          </div>
        ) }

        {/* Stats Cards */ }
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <StatCard
            title="إجمالي الفائض"
            value={ formatCurrency(stats.total_surplus) }
            icon={ <TrendingUp className="w-6 h-6" /> }
            gradient="from-green-500 to-green-600"
          />
          <StatCard
            title="إجمالي العجز"
            value={ formatCurrency(stats.total_deficit) }
            icon={ <TrendingDown className="w-6 h-6" /> }
            gradient="from-red-500 to-red-600"
          />
          <StatCard
            title="الفائض الصافي"
            value={ `₪${formatCurrency(stats.net_surplus)}` }
            icon={ <Coins className="w-6 h-6" /> }
            gradient={ stats.net_surplus >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-orange-500 to-orange-600' }
          />
        </div>

        {/* Currency Note */ }
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">
              <strong>ملاحظة:</strong> المبالغ الإجمالية قد تشمل مشاريع بعملات مختلفة (دولار وشيكل).
              راجع تفاصيل كل مشروع لمعرفة العملة المستخدمة.
            </p>
          </div>
        </div>

        {/* Project Counts */ }
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">مشاريع مع فائض</h3>
            <p className="text-3xl font-bold text-gray-800">{ stats.projects_with_surplus_count || 0 }</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">مشاريع مع عجز</h3>
            <p className="text-3xl font-bold text-gray-800">{ stats.projects_with_deficit_count || 0 }</p>
          </div>
        </div>

        {/* Recent Projects */ }
        { stats.recent_projects && stats.recent_projects.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-6 h-6 text-sky-600" />
                المشاريع الأخيرة
              </h2>
              <Link
                to="/surplus/report"
                className="text-sky-600 hover:text-sky-700 flex items-center gap-1 text-sm"
              >
                عرض التقرير الكامل
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">كود المشروع</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">اسم المشروع</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">المبلغ الصافي</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">تكلفة التوريد</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">الفائض/العجز</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  { stats.recent_projects.map((project) => {
                    const symbol = project.currency_symbol || (project.currency === 'ILS' ? '₪' : '$');
                    const amount = project.available_amount || project.net_amount_shekel || project.net_amount || 0;
                    // ✅ تحديد الكود: كود المتبرع أو الكود الداخلي
                    const donorCode = project.donor_code?.trim() || '';
                    const internalCode = project.internal_code?.trim() || '';
                    const projectCode = donorCode || internalCode;
                    const codeType = donorCode ? 'كود المتبرع' : (internalCode ? 'كود داخلي' : null);

                    return (
                      <tr key={ project.id } className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">
                          { projectCode ? (
                            <div className="flex flex-col">
                              <span className="text-gray-800 font-bold text-base">{ projectCode }</span>
                              <span className="text-xs text-gray-500 mt-1">
                                { codeType }
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">#{ project.id }</span>
                          ) }
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
                          { project.project_description || project.project_name || '-' }
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          <div className="flex flex-col">
                            <span>{ symbol }{ formatCurrency(amount) }</span>
                            { project.currency === 'ILS' && project.net_amount && (
                              <span className="text-xs text-gray-400">
                                (${ formatCurrency(project.net_amount) })
                              </span>
                            ) }
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          { symbol }{ formatCurrency(project.supply_cost || 0) }
                        </td>
                        <td className="py-3 px-4">
                          { project.has_deficit ? (
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              عجز: { symbol }{ formatCurrency(Math.abs(project.surplus_amount || 0)) }
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              فائض: { symbol }{ formatCurrency(project.surplus_amount || 0) }
                            </span>
                          ) }
                        </td>
                      </tr>
                    );
                  }) }
                </tbody>
              </table>
            </div>
          </div>
        ) }

        {/* Categories Statistics */ }
        { stats.categories_statistics && stats.categories_statistics.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-600" />
                إحصائيات الأقسام
              </h2>
              <Link
                to="/surplus/categories"
                className="text-sky-600 hover:text-sky-700 flex items-center gap-1 text-sm"
              >
                إدارة الأقسام
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              { stats.categories_statistics.map((category) => (
                <div
                  key={ category.category_id }
                  className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <h3 className="text-lg font-bold text-gray-800 mb-3">{ category.category_name }</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">الرصيد الإجمالي</span>
                      <span className={ `font-bold ${((category.total_surplus || 0) - (category.total_deficit || 0)) >= 0 ? 'text-emerald-600' : 'text-red-600'}` }>
                        ₪{ formatCurrency((category.total_surplus || 0) - (category.total_deficit || 0)) }
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        الفائض
                      </span>
                      <span className="font-semibold text-green-600">
                        ₪{ formatCurrency(category.total_surplus) }
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        العجز
                      </span>
                      <span className="font-semibold text-red-600">
                        ₪{ formatCurrency(category.total_deficit) }
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-300">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Package className="w-4 h-4 text-sky-500" />
                        عدد المشاريع
                      </span>
                      <span className="font-bold text-gray-800">
                        { category.projects_count || 0 }
                      </span>
                    </div>
                  </div>
                  <Link
                    to={ `/surplus/categories/${category.category_id}` }
                    className="mt-3 w-full bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    عرض التفاصيل
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )) }
            </div>
          </div>
        ) }

        {/* Quick Actions */ }
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/surplus/report"
            className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sky-600" />
                  تقرير الفائض المفصل
                </h3>
                <p className="text-sm text-gray-600">عرض تقرير شامل عن الفائض والعجز في جميع المشاريع</p>
              </div>
              <ArrowRight className="w-6 h-6 text-sky-600 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
          <Link
            to="/surplus/categories"
            className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  إدارة أقسام الفائض
                </h3>
                <p className="text-sm text-gray-600">إضافة وتعديل وحذف أقسام الفائض</p>
              </div>
              <ArrowRight className="w-6 h-6 text-green-600 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, gradient }) => (
  <div className={ `bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all hover:scale-105` }>
    <div className="flex items-center justify-between mb-3">
      <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl shadow-lg">{ icon }</div>
    </div>
    <p className="text-sm opacity-90 mb-2 font-medium">{ title }</p>
    <p className="text-4xl font-bold">{ value }</p>
  </div>
);

export default SurplusDashboard;

