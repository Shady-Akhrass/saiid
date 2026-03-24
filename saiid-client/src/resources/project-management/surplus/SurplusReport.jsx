import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import {
  calculateProjectSurplus,
  calculateTotalSurplus,
  calculateTotalDeficit,
  filterProjectsForAdmin,
  getProjectCode as getSurplusProjectCode,
} from '../../../utils/surplusHelpers';
import {
  DollarSign,
  Filter,
  Search,
  X,
  Calendar,
  FileText,
  ArrowRight,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { downloadWorkbookAsFile } from '../../../utils/excelDownload';

const SurplusReport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false); // ✅ تعطيل loading state افتراضياً
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState({
    total_surplus: 0,
    total_deficit: 0,
    net_surplus: 0,
  });
  const [showFilters, setShowFilters] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [filters, setFilters] = useState({
    type: '', // 'surplus' or 'deficit'
    from_date: '',
    to_date: '',
    project_type: '',
    search: '',
    surplus_category_id: '', // فلتر قسم الفائض
    page: 1,
    per_page: 15,
  });
  const [surplusCategories, setSurplusCategories] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });

  useEffect(() => {
    fetchReport();
  }, [filters.type, filters.from_date, filters.to_date, filters.project_type, filters.search, filters.surplus_category_id]); // ✅ إزالة filters.page - جلب جميع المشاريع

  useEffect(() => {
    fetchSurplusCategories();
  }, []);

  const fetchReport = async () => {
    try {
      // ✅ إزالة setLoading(true) لجعل الانتقال أسرع
      // setLoading(true);
      const params = {
        per_page: 10000, // ✅ جلب جميع المشاريع (عدد كبير)
        page: 1, // ✅ دائماً الصفحة الأولى
      };

      if (filters.type) params.type = filters.type;
      if (filters.from_date) params.from_date = filters.from_date;
      if (filters.to_date) params.to_date = filters.to_date;
      if (filters.project_type) params.project_type = filters.project_type;
      if (filters.search) params.search = filters.search;
      if (filters.surplus_category_id) params.surplus_category_id = filters.surplus_category_id;

      const response = await apiClient.get('/surplus/report', { params });
      if (response.data.success) {
        const data = response.data.data || response.data;
        let projectsData = Array.isArray(data.projects) ? data.projects : Array.isArray(data) ? data : [];

        // ✅ فلترة المشاريع للأدمن: استبعاد المشاريع المقسمة الأصلية
        projectsData = filterProjectsForAdmin(projectsData, user);

        setProjects(projectsData);

        // ✅ استخدام الإحصائيات الشاملة من Backend (لجميع المشاريع) إذا كانت موجودة
        // إذا لم تكن موجودة، نحسبها من الصفحة الحالية كبديل
        const totalSurplus = data.total_surplus !== undefined ? data.total_surplus : calculateTotalSurplus(projectsData);
        const totalDeficit = data.total_deficit !== undefined ? data.total_deficit : calculateTotalDeficit(projectsData);

        setSummary({
          total_surplus: totalSurplus,
          total_deficit: totalDeficit,
          net_surplus: totalSurplus - totalDeficit,
        });

        setPagination({
          current_page: data.current_page || response.data.current_page || filters.page,
          last_page: data.last_page || response.data.last_page || 1,
          per_page: data.per_page || response.data.per_page || filters.per_page,
          total: data.total || response.data.total || projectsData.length,
        });
      }
    } catch (error) {
      console.error('Error fetching report:', error);

      // ✅ معالجة خاصة لخطأ 403 (Forbidden)
      if (error.response?.status === 403) {
        const errorMessage = error.response?.data?.message || 
          'ليس لديك صلاحيات للوصول إلى تقرير الفائض. يرجى التواصل مع الإدارة.';
        
        if (import.meta.env.DEV) {
          console.error('📊 Report Error Details (403 Forbidden):', {
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
        setProjects([]);
        setSummary({
          total_surplus: 0,
          total_deficit: 0,
          net_surplus: 0,
        });
        return;
      }

      // ✅ عرض رسالة خطأ واضحة للأخطاء الأخرى
      const errorMessage = error.response?.data?.message ||
        error.userMessage ||
        'حدث خطأ في جلب بيانات الوافر';

      // ✅ عرض تفاصيل الخطأ في وضع التطوير
      if (import.meta.env.DEV) {
        console.error('📊 Report Error Details:', {
          status: error.response?.status,
          message: errorMessage,
          data: error.response?.data,
          url: error.config?.url,
        });
      }

      // ✅ عرض رسالة خطأ للمستخدم
      if (!error.isConnectionError && !error.isTimeoutError) {
        toast.error(errorMessage || 'فشل تحميل التقرير. يرجى المحاولة مرة أخرى.');
      }

      // ✅ في حالة الخطأ، نعرض بيانات فارغة
      setProjects([]);
      setSummary({
        total_surplus: 0,
        total_deficit: 0,
        net_surplus: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    // ✅ عند تغيير أي فلتر، نعيد الصفحة إلى 1 (لكن لا نستخدم pagination - جلب جميع المشاريع)
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const fetchSurplusCategories = async () => {
    try {
      const response = await apiClient.get('/surplus-categories', {
        params: { is_active: 1 }
      });
      if (response.data.success) {
        setSurplusCategories(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching surplus categories:', error);
    }
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      from_date: '',
      to_date: '',
      project_type: '',
      search: '',
      surplus_category_id: '',
      page: 1,
      per_page: 15,
    });
  };

  const handleDownloadExcel = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      const excelData = projects.map(project => {
        // ✅ حساب الفائض/العجز من المبلغ الصافي وتكلفة التوريد (بالشيكل)
        const calculatedSurplus = calculateProjectSurplus(project);

        // ✅ تحديد الكود: كود التبرع أولاً، ثم الكود الداخلي
        const { projectCode, codeType } = getSurplusProjectCode(project);

        const netAmountShekel = project.net_amount_shekel || project.available_amount || 0;
        const supplyCostShekel = project.supply_cost_shekel || project.supply_cost || 0;

        return {
          'كود المشروع': projectCode,
          'نوع الكود': codeType,
          'اسم المشروع': project.project_name || project.project_description || '-',
          'نوع المشروع': project.project_type || '-',
          'قسم الفائض': project.surplus_category?.name || '-',
          'المبلغ الصافي (USD)': project.net_amount_usd || project.net_amount || 0,
          'المبلغ الصافي (ILS)': netAmountShekel,
          'تكلفة التوريد (ILS)': supplyCostShekel,
          'الفائض/العجز (ILS)': calculatedSurplus,
          'نوع': calculatedSurplus < 0 ? 'عجز' : 'فائض',
          'تاريخ الإدخال': project.created_at
            ? new Date(project.created_at).toISOString().split('T')[0]
            : '-',
        };
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('تقرير الفائض');
      const keys = excelData.length ? Object.keys(excelData[0]) : [];
      worksheet.columns = keys.map((k) => ({ header: k, key: k, width: 18 }));
      worksheet.addRows(excelData);

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      let filename = `تقرير_الفائض_${dateStr}`;

      if (filters.type) filename += `_${filters.type}`;
      if (filters.from_date && filters.to_date) {
        filename += `_${filters.from_date}_الى_${filters.to_date}`;
      }

      await downloadWorkbookAsFile(workbook, `${filename}.xlsx`);
      toast.success(`تم تحميل ملف Excel بنجاح! (${projects.length} مشروع)`);
    } catch (error) {
      console.error('خطأ في تصدير ملف Excel:', error);
      toast.error('حدث خطأ أثناء تصدير الملف');
    } finally {
      setIsDownloading(false);
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
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  };

  // ✅ إزالة علامة التحميل - عرض المحتوى مباشرة

  return (
    <div className="min-h-screen bg-gray-50" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */ }
        <div className="mb-6">
          <Link
            to="/surplus/dashboard"
            className="inline-flex items-center text-sky-600 hover:text-sky-700 mb-4"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة للوحة التحكم
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-8 h-8 text-sky-600" />
              تقرير الفائض المفصل
            </h1>
            <div className="flex gap-3">
              <button
                onClick={ () => setShowFilters(!showFilters) }
                className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-md transition-shadow"
              >
                <Filter className="w-4 h-4" />
                { showFilters ? 'إخفاء الفلاتر' : 'إظهار الفلاتر' }
              </button>
              <button
                onClick={ handleDownloadExcel }
                disabled={ isDownloading || projects.length === 0 }
                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                { isDownloading ? 'جاري التحميل...' : 'تصدير Excel' }
              </button>
            </div>
          </div>
        </div>

        {/* Filters */ }
        { showFilters && (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Filter className="w-5 h-5 text-sky-600" />
                الفلاتر
              </h2>
              <button
                onClick={ clearFilters }
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
                مسح الكل
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">البحث</label>
                <input
                  type="text"
                  value={ filters.search }
                  onChange={ (e) => handleFilterChange('search', e.target.value) }
                  placeholder="ابحث في المشاريع..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">النوع</label>
                <select
                  value={ filters.type }
                  onChange={ (e) => handleFilterChange('type', e.target.value) }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">الكل</option>
                  <option value="surplus">فائض فقط</option>
                  <option value="deficit">عجز فقط</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  قسم الفائض
                </label>
                <select
                  value={ filters.surplus_category_id }
                  onChange={ (e) => handleFilterChange('surplus_category_id', e.target.value) }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">جميع الأقسام</option>
                  { surplusCategories.map((category) => (
                    <option key={ category.id } value={ category.id }>
                      { category.name }
                    </option>
                  )) }
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={ filters.from_date }
                  onChange={ (e) => handleFilterChange('from_date', e.target.value) }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={ filters.to_date }
                  onChange={ (e) => handleFilterChange('to_date', e.target.value) }
                  min={ filters.from_date || undefined }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نوع المشروع</label>
                <select
                  value={ filters.project_type }
                  onChange={ (e) => handleFilterChange('project_type', e.target.value) }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">جميع الأنواع</option>
                  <option value="إغاثي">إغاثي</option>
                  <option value="تنموي">تنموي</option>
                  <option value="طبي">طبي</option>
                  <option value="تعليمي">تعليمي</option>
                </select>
              </div>
            </div>
          </div>
        ) }

        {/* Summary */ }
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">إجمالي الفائض</h3>
            <p className="text-3xl font-bold text-green-700">₪{ formatCurrency(summary.total_surplus) }</p>
            <p className="text-xs text-gray-500 mt-1">جميع المبالغ بالشيكل - لجميع المشاريع</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">إجمالي العجز</h3>
            <p className="text-3xl font-bold text-red-700">₪{ formatCurrency(summary.total_deficit) }</p>
            <p className="text-xs text-gray-500 mt-1">جميع المبالغ بالشيكل</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">الصافي</h3>
            <p className={ `text-3xl font-bold ${summary.net_surplus >= 0 ? 'text-emerald-700' : 'text-orange-700'}` }>
              ₪{ formatCurrency(summary.net_surplus) }
            </p>
            <p className="text-xs text-gray-500 mt-1">جميع المبالغ بالشيكل</p>
          </div>
        </div>

        {/* Projects Table */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">جدول المشاريع</h2>
            <div className="text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
              <span className="font-medium text-blue-700">ملاحظة:</span> جميع المبالغ معروضة بالشيكل (₪)
            </div>
          </div>
          { projects.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">لا توجد مشاريع مطابقة للفلاتر</p>
              { loading && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-600"></div>
                  جاري التحميل...
                </div>
              ) }
              { !loading && (
                <button
                  onClick={ fetchReport }
                  className="mt-4 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  إعادة المحاولة
                </button>
              ) }
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">كود المشروع</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">اسم المشروع</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">نوع المشروع</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">قسم الفائض</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">المبلغ الصافي</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">تكلفة التوريد</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">الفائض/العجز</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">التاريخ</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    { projects.map((project) => {
                      // ✅ جميع المبالغ بالشيكل دائماً
                      const symbol = '₪';
                      const amount = project.net_amount_shekel || project.available_amount || 0;
                      // ✅ تحديد الكود: كود التبرع أولاً، ثم الكود الداخلي
                      const { projectCode, codeType } = getSurplusProjectCode(project);

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
                          <td className="py-3 px-4 text-sm text-gray-700">
                            { (() => {
                              if (!project.project_type) return '-';
                              if (typeof project.project_type === 'object' && project.project_type !== null) {
                                return project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '-';
                              }
                              return project.project_type;
                            })() }
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            { project.surplus_category ? (
                              <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                { project.surplus_category.name }
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            ) }
                          </td>
                          <td className="py-3 px-4 text-sm font-semibold text-green-600">
                            <div className="flex flex-col">
                              <span>{ symbol }{ formatCurrency(amount) }</span>
                              { project.net_amount_usd && (
                                <span className="text-xs text-gray-400">
                                  (${ formatCurrency(project.net_amount_usd) } USD)
                                </span>
                              ) }
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            { symbol }{ formatCurrency(project.supply_cost_shekel || project.supply_cost || 0) }
                          </td>
                          <td className="py-3 px-4">
                            { (() => {
                              // ✅ حساب الفائض/العجز من المبلغ الصافي وتكلفة التوريد (بالشيكل)
                              const calculatedSurplus = calculateProjectSurplus(project);
                              const isDeficit = calculatedSurplus < 0;
                              const surplusAmount = Math.abs(calculatedSurplus);

                              return isDeficit ? (
                                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  عجز: { symbol }{ formatCurrency(surplusAmount) }
                                </span>
                              ) : (
                                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  فائض: { symbol }{ formatCurrency(surplusAmount) }
                                </span>
                              );
                            })() }
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            { project.created_at ? formatDate(project.created_at) : '-' }
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

              {/* Projects Count */ }
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  إجمالي المشاريع المعروضة: <span className="font-semibold text-gray-800">{ projects.length }</span> مشروع
                </p>
              </div>
            </>
          ) }
        </div>
      </div>
    </div>
  );
};

export default SurplusReport;

