import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import {
  calculateTotalSurplus,
  calculateTotalDeficit,
  hasSurplus,
  hasDeficit,
} from '../../../utils/surplusHelpers';
import {
  ArrowRight,
  Edit,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  FileText,
  User,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from 'lucide-react';

const SurplusCategoryDetails = () => {
  const { id: categoryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false); // ✅ تعطيل loading state افتراضياً
  const [category, setCategory] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (categoryId) {
      fetchCategoryDetails();
    }
  }, [categoryId]);

  const fetchCategoryDetails = async () => {
    try {
      setLoading(true);
      
      // ✅ جلب تفاصيل القسم
      const categoryResponse = await apiClient.get(`/surplus-categories/${categoryId}`);
      
      // ✅ جلب جميع المشاريع المرتبطة بهذا القسم من endpoint التقرير
      const reportResponse = await apiClient.get('/surplus/report', {
        params: {
          per_page: 10000,
          page: 1,
          surplus_category_id: categoryId,
        }
      });
      
      if (categoryResponse.data.success) {
        const categoryData = categoryResponse.data.data;
        setCategory(categoryData);
        
        // ✅ جلب المشاريع من endpoint التقرير
        let projectsData = [];
        if (reportResponse.data.success) {
          const reportData = reportResponse.data.data || reportResponse.data;
          projectsData = Array.isArray(reportData.projects) ? reportData.projects : Array.isArray(reportData) ? reportData : [];
          
          // ✅ فلترة المشاريع للأدمن: استبعاد المشاريع المقسمة الأصلية (نفس منطق التقرير)
          const userRole = user?.role?.toLowerCase?.() ||
            user?.userRole?.toLowerCase?.() ||
            user?.user_role?.toLowerCase?.() ||
            user?.role_name?.toLowerCase?.() ||
            user?.role || '';
          const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';
          
          if (isAdmin) {
            projectsData = projectsData.filter((project) => {
              const isDivided = Boolean(
                project.is_divided_into_phases ||
                project.isDividedIntoPhases ||
                false
              );
              const parentProjectId =
                project.parent_project_id ||
                project.parentProjectId ||
                project.parent_project?.id ||
                null;
              const phaseDay = project.phase_day || project.phaseDay || null;
              const monthNumber = project.month_number || project.monthNumber || null;
              const phaseType = project.phase_type || project.phaseType || null;
              
              const isDividedParent = isDivided &&
                !parentProjectId &&
                !phaseDay &&
                !monthNumber &&
                phaseType !== 'daily' &&
                phaseType !== 'monthly';
              
              if (isDividedParent) {
                return false;
              }
              return true;
            });
          }
        }
        
        setProjects(projectsData);
        
        // ✅ حساب الإحصائيات من المشاريع الفعلية بنفس منطق صفحة التقرير
        const calculatedSurplus = calculateTotalSurplus(projectsData);
        const calculatedDeficit = calculateTotalDeficit(projectsData);
        const calculatedBalance = calculatedSurplus - calculatedDeficit;
        
        // ✅ حساب عدد المشاريع
        const surplusProjectsCount = projectsData.filter(hasSurplus).length;
        const deficitProjectsCount = projectsData.filter(hasDeficit).length;
        
        // ✅ استخدام الإحصائيات المحسوبة من المشاريع الفعلية
        setStatistics({
          total_balance: calculatedBalance,
          total_surplus: calculatedSurplus,
          total_deficit: calculatedDeficit,
          projects_count: projectsData.length,
          surplus_projects_count: surplusProjectsCount,
          deficit_projects_count: deficitProjectsCount,
        });
      }
    } catch (error) {
      console.error('Error fetching category details:', error);
      toast.error('فشل تحميل تفاصيل القسم');
      navigate('/surplus/categories');
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

  const formatDate = (date) => {
    if (!date) return 'غير محدد';
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  };

  // ✅ إزالة علامة التحميل - عرض المحتوى مباشرة

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">لم يتم العثور على القسم</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */ }
        <div className="mb-6">
          <Link
            to="/surplus/categories"
            className="inline-flex items-center text-sky-600 hover:text-sky-700 mb-4"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة لقائمة الأقسام
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                <DollarSign className="w-8 h-8 text-green-600" />
                { category.name }
              </h1>
              { category.description && (
                <p className="text-gray-600 mt-2">{ category.description }</p>
              ) }
            </div>
            <div className="flex items-center gap-3">
              <span
                className={ `px-4 py-2 rounded-full text-sm font-medium ${category.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
                  }` }
              >
                { category.is_active ? 'نشط' : 'غير نشط' }
              </span>
              <Link
                to={ `/surplus/categories/${categoryId}/edit` }
                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors"
              >
                <Edit className="w-5 h-5" />
                تعديل
              </Link>
            </div>
          </div>
        </div>

        {/* Category Info */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">معلومات القسم</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-sky-100 rounded-xl">
                <User className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">أنشئ بواسطة</p>
                <p className="text-lg font-semibold text-gray-800">
                  { category.creator_name || category.creator?.name || '-' }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">تاريخ الإنشاء</p>
                <p className="text-lg font-semibold text-gray-800">
                  { formatDate(category.created_at) }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */ }
        { statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg border-t-4 border-emerald-500">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">الرصيد الإجمالي</h3>
              <p className={ `text-3xl font-bold ${statistics.total_balance >= 0 ? 'text-emerald-700' : 'text-red-700'}` }>
                ₪{ formatCurrency(statistics.total_balance) }
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border-t-4 border-green-500">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">إجمالي الفائض</h3>
              <p className="text-3xl font-bold text-green-700">
                ₪{ formatCurrency(statistics.total_surplus) }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                { statistics.surplus_projects_count || 0 } مشروع
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border-t-4 border-red-500">
              <div className="flex items-center justify-between mb-2">
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">إجمالي العجز</h3>
              <p className="text-3xl font-bold text-red-700">
                ₪{ formatCurrency(statistics.total_deficit) }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                { statistics.deficit_projects_count || 0 } مشروع
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border-t-4 border-sky-500">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 text-sky-500" />
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">عدد المشاريع</h3>
              <p className="text-3xl font-bold text-gray-800">
                { statistics.projects_count || 0 }
              </p>
            </div>
          </div>
        ) }

        {/* Projects Table */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-sky-600" />
            المشاريع المرتبطة بهذا القسم
          </h2>
          { projects.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد مشاريع مرتبطة بهذا القسم</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">كود المشروع</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">اسم المشروع</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">الفائض/العجز</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">العملة</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">تاريخ التسجيل</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  { projects.map((project) => {
                    // ✅ حساب الفائض/العجز من المبلغ الصافي وتكلفة التوريد (بالشيكل)
                    const netAmountShekel = project.net_amount_shekel || project.available_amount || 0;
                    const supplyCostShekel = project.supply_cost_shekel || project.supply_cost || 0;
                    const calculatedSurplus = netAmountShekel - supplyCostShekel;
                    const isDeficit = calculatedSurplus < 0;
                    const surplusAmount = Math.abs(calculatedSurplus);
                    // ✅ العملة دائماً شيكل في هذا الجدول
                    const symbol = '₪';
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
                          { project.project_name || project.project_description || '-' }
                        </td>
                        <td className="py-3 px-4">
                          { isDeficit ? (
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              عجز: { symbol }{ formatCurrency(surplusAmount) }
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              فائض: { symbol }{ formatCurrency(surplusAmount) }
                            </span>
                          ) }
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          شيكل
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          { project.surplus_recorded_at ? formatDate(project.surplus_recorded_at) : '-' }
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={ () => navigate(`/project-management/projects/${project.id}`) }
                            className="text-sky-600 hover:text-sky-700 text-sm font-medium"
                          >
                            عرض التفاصيل
                          </button>
                        </td>
                      </tr>
                    );
                  }) }
                </tbody>
              </table>
            </div>
          ) }
        </div>
      </div>
    </div>
  );
};

export default SurplusCategoryDetails;

