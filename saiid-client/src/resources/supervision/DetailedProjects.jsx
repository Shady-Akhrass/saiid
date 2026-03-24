import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import supervisionAPI from '../../api/supervision';
import apiClient from '../../utils/axiosConfig';
import { useToast } from '../../hooks/useToast';
import { getProjectCode } from '../../utils/helpers';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
  Calendar,
  Eye,
  X
} from 'lucide-react';

// الأنواع الافتراضية (في حالة فشل جلبها من API)
const DEFAULT_PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];

const DetailedProjects = () => {
  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projectTypes, setProjectTypes] = useState(DEFAULT_PROJECT_TYPES);
  const [projectTypesLoading, setProjectTypesLoading] = useState(false);
  const [totalWithoutFilters, setTotalWithoutFilters] = useState(0); // ✅ العدد الكلي بدون فلاتر
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDates, setExportDates] = useState({ start_date: '', end_date: '' });
  const [exportLoading, setExportLoading] = useState(false);
  const { success, error: showError } = useToast();

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    project_type: '',
    start_date: '',
    end_date: '',
    search: '',
    sort_by: 'created_at',
    sort_order: 'desc',
    per_page: 15,
    page: 1
  });

  // ✅ جلب أنواع المشاريع من API
  useEffect(() => {
    const fetchProjectTypes = async () => {
      setProjectTypesLoading(true);
      try {
        const response = await apiClient.get('/project-types', {
          params: { _t: Date.now() },
          timeout: 10000,
          headers: { 'Cache-Control': 'no-cache' }
        });

        if (response.data.success) {
          const data = response.data.data || response.data.types || [];
          if (data.length > 0) {
            // استخراج الأسماء من البيانات
            const types = data.map(type => {
              if (typeof type === 'string') return type;
              return type.name || type;
            });
            setProjectTypes(types);
          }
        }
      } catch (error) {
        console.error('Error fetching project types:', error);
        // استخدام الأنواع الافتراضية في حالة الخطأ
        setProjectTypes(DEFAULT_PROJECT_TYPES);
      } finally {
        setProjectTypesLoading(false);
      }
    };

    fetchProjectTypes();
  }, []);

  // ✅ جلب العدد الكلي بدون فلاتر (يتم مرة واحدة فقط)
  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const response = await supervisionAPI.getDetailedProjects({
          per_page: 1,
          page: 1
        });
        if (response.success && response.pagination) {
          setTotalWithoutFilters(response.pagination.total || 0);
          console.log('✅ العدد الإجمالي بدون فلاتر:', response.pagination.total);
        }
      } catch (err) {
        console.error('Error fetching total count:', err);
      }
    };

    fetchTotalCount();
  }, []); // ✅ يتم مرة واحدة فقط عند تحميل الصفحة

  useEffect(() => {
    loadProjects();
  }, [filters]);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await supervisionAPI.getDetailedProjects(filters);
      if (response.success) {
        setProjects(response.data || []);
        // ✅ حفظ pagination مع الإحصائيات الإضافية من Backend
        const paginationData = {
          ...response.pagination,
          total_amount: response.total_amount || response.summary?.total_amount || 0,
          total_projects: response.total_projects || response.summary?.total_projects || response.pagination?.total || 0
        };
        setPagination(paginationData);

        // ✅ Debug: عرض البيانات في الكونسول
        console.log('📊 Pagination Data:', {
          total: response.pagination?.total,
          total_projects: response.total_projects,
          total_amount: response.total_amount,
          current_page: response.pagination?.current_page,
          per_page: response.pagination?.per_page
        });
      } else {
        // ✅ إذا كان هناك بيانات جزئية، نعرضها
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          setProjects(response.data);
          setPagination({
            ...response.pagination,
            total_amount: response.total_amount || response.summary?.total_amount || 0,
            total_projects: response.total_projects || response.summary?.total_projects || response.pagination?.total || 0
          });
          showError('تم تحميل بعض البيانات، لكن حدث خطأ في جزء منها');
        } else {
          setError(response.error || 'فشل تحميل المشاريع');
          showError(response.error || 'فشل تحميل المشاريع');
        }
      }
    } catch (err) {
      // ✅ معالجة أخطاء قاعدة البيانات بشكل خاص
      const errorMessage = err.response?.data?.message || err.message || 'حدث خطأ أثناء تحميل المشاريع';
      const isDatabaseError = errorMessage.includes('Column not found') ||
        errorMessage.includes('Unknown column') ||
        errorMessage.includes('shelters') ||
        errorMessage.includes('id') ||
        err.response?.status === 500;

      if (isDatabaseError) {
        // ✅ إذا كان خطأ في قاعدة البيانات، نعرض رسالة واضحة
        const dbError = 'خطأ في قاعدة البيانات: يرجى التواصل مع المطور لإصلاح المشكلة.';
        setError(dbError);
        showError(dbError);
        console.error('Database Schema Error:', err.response?.data || err);
      } else {
        setError(errorMessage);
        showError(errorMessage);
        console.error('Projects Error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: 1 // إعادة تعيين الصفحة عند تغيير الفلتر
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const openExportModal = () => {
    setExportDates({ start_date: '', end_date: '' });
    setExportModalOpen(true);
  };

  const handleExportConfirm = async () => {
    const { start_date, end_date } = exportDates;
    if (!start_date || !end_date) {
      showError('يرجى اختيار تاريخ البداية والنهاية');
      return;
    }
    if (new Date(start_date) > new Date(end_date)) {
      showError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }
    setExportLoading(true);
    try {
      await supervisionAPI.exportReport('projects', {
        ...filters,
        start_date,
        end_date
      });
      success('تم تحميل ملف Excel بنجاح!');
      setExportModalOpen(false);
    } catch (err) {
      showError(err?.userMessage || err?.response?.data?.message || 'فشل التصدير');
    } finally {
      setExportLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      project_type: '',
      start_date: '',
      end_date: '',
      search: '',
      sort_by: 'created_at',
      sort_order: 'desc',
      per_page: 15,
      page: 1
    });
  };

  const hasActiveFilters = filters.status || filters.project_type || filters.start_date || filters.end_date || filters.search;

  // ✅ دوال مساعدة مطابقة لعرض الأدمن (ProjectsList)
  const getProjectDescription = useCallback((project) => {
    const d = project?.project_description || project?.description || project?.title;
    return d?.trim() || '----';
  }, []);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  }, []);

  const formatOriginalAmount = useCallback((project, currencyCode) => {
    const parent = project?.parent_project || project?.parentProject;
    const amount =
      project?.donation_amount ||
      project?.amount ||
      project?.original_amount ||
      project?.total_amount ||
      parent?.donation_amount ||
      parent?.amount ||
      parent?.original_amount ||
      parent?.total_amount ||
      null;
    if (amount == null || amount === '' || Number.isNaN(Number(amount))) return '---';
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amount));
    const sym = currencyCode || project?.currency?.currency_symbol || project?.currency?.currency_code || project?.currency_code || parent?.currency_code || '';
    return `${formatted} ${sym}`.trim();
  }, []);

  const getStatusColor = useCallback((status) => {
    const m = {
      'جديد': 'bg-blue-500', 'قيد التوريد': 'bg-indigo-500', 'تم التوريد': 'bg-teal-500', 'مسند لباحث': 'bg-purple-500',
      'مؤجل': 'bg-amber-500', 'جاهز للتنفيذ': 'bg-yellow-500', 'تم اختيار المخيم': 'bg-yellow-600', 'قيد التنفيذ': 'bg-purple-500',
      'تم التنفيذ': 'bg-gray-700', 'في المونتاج': 'bg-purple-300', 'تم المونتاج': 'bg-green-500', 'يجب إعادة المونتاج': 'bg-red-500',
      'وصل للمتبرع': 'bg-green-700', 'منتهي': 'bg-gray-600', 'ملغى': 'bg-red-500',
    };
    return m[status] || 'bg-gray-500';
  }, []);

  const getRemainingDaysBadge = useCallback((project) => {
    if (project?.status === 'منتهي') {
      return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">✓ منتهي</span>;
    }
    if (project?.remaining_days == null && project?.remaining_days !== 0) {
      return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 border border-gray-300">-</span>;
    }
    if (project?.is_delayed) {
      return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">⚠️ متأخر بـ { project.delayed_days } يوم</span>;
    }
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">{ project.remaining_days } يوم متبقي</span>;
  }, []);

  const getTodayLabel = useCallback(() => {
    const now = new Date();
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(now);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 p-4 relative" style={ { fontFamily: 'Cairo, Tajawal, Arial, sans-serif', fontWeight: 400 } }>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header - نفس تنسيق الأدمن */ }
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 rounded-2xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-4 right-4 w-24 h-24 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-4 left-4 w-32 h-32 bg-white rounded-full blur-3xl"></div>
          </div>
          <div className="relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2 drop-shadow-lg" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>
                  تقرير المشاريع المفصل
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sky-100">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg">
                    <FileText className="w-4 h-4" />
                    <span className="font-semibold text-sm" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>
                      إجمالي: { (pagination.total || 0).toLocaleString() } مشروع
                      { hasActiveFilters && ` (الكلي: ${totalWithoutFilters?.toLocaleString() || 0})` }
                    </span>
                  </div>
                </div>
                <p className="text-xs text-sky-200 font-medium mt-2 flex items-center gap-1" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }>
                  <span>📅</span>
                  { getTodayLabel() }
                </p>
              </div>
              <button
                onClick={ openExportModal }
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }
              >
                <Download className="w-4 h-4" />
                تصدير Excel
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters - نفس تنسيق الأدمن */ }
        <div className="bg-white rounded-3xl p-5 shadow-xl border border-gray-100">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative group flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-sky-600 w-5 h-5 transition-colors" />
                <input
                  type="text"
                  placeholder="بحث في اسم المشروع، الوصف، اسم المتبرع، كود المتبرع، الكود الداخلي، الرقم التسلسلي..."
                  value={ filters.search }
                  onChange={ (e) => handleFilterChange('search', e.target.value) }
                  className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all duration-300 text-gray-800 font-medium placeholder-gray-400"
                  style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }
                />
                { filters.search && (
                  <button
                    onClick={ () => handleFilterChange('search', '') }
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) }
              </div>
            </div>
            { hasActiveFilters && (
              <button
                onClick={ clearFilters }
                className="px-6 py-4 bg-red-100 hover:bg-red-200 text-red-600 rounded-2xl font-semibold flex items-center gap-2 transition-all"
                style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }
              >
                <X className="w-5 h-5" />
                مسح الفلاتر
              </button>
            ) }
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 pt-4 border-t-2 border-gray-100">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>الحالة</label>
              <select
                value={ filters.status }
                onChange={ (e) => handleFilterChange('status', e.target.value) }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white hover:border-sky-300 transition-all"
                style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }
              >
                <option value="">الكل</option>
                <option value="جديد">جديد</option>
                <option value="قيد التوريد">قيد التوريد</option>
                <option value="قيد التنفيذ">قيد التنفيذ</option>
                <option value="تم التنفيذ">تم التنفيذ</option>
                <option value="في المونتاج">في المونتاج</option>
                <option value="تم المونتاج">تم المونتاج</option>
                <option value="وصل للمتبرع">وصل للمتبرع</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>نوع المشروع</label>
              <select
                value={ filters.project_type }
                onChange={ (e) => handleFilterChange('project_type', e.target.value) }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white hover:border-sky-300 transition-all disabled:opacity-50"
                disabled={ projectTypesLoading }
                style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }
              >
                <option value="">الكل</option>
                { projectTypes.map((type, index) => (
                  <option key={ index } value={ type }>{ type }</option>
                )) }
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-1" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>
                <Calendar className="w-4 h-4" /> من تاريخ
              </label>
              <input
                type="date"
                value={ filters.start_date }
                onChange={ (e) => handleFilterChange('start_date', e.target.value) }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-1" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>
                <Calendar className="w-4 h-4" /> إلى تاريخ
              </label>
              <input
                type="date"
                value={ filters.end_date }
                onChange={ (e) => handleFilterChange('end_date', e.target.value) }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>عدد النتائج</label>
              <select
                value={ filters.per_page }
                onChange={ (e) => handleFilterChange('per_page', parseInt(e.target.value)) }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }
              >
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading - نفس تنسيق الأدمن */ }
        { loading && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-12">
            <div className="flex flex-col justify-center items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-sky-200 border-t-sky-600"></div>
              <p className="mt-6 text-gray-600 font-medium" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>جاري تحميل المشاريع...</p>
            </div>
          </div>
        ) }

        {/* Error */ }
        { error && !loading && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="bg-red-100 p-4 rounded-full">
                <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-600 text-lg font-medium" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>{ error }</p>
              <button
                onClick={ loadProjects }
                className="px-8 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold transition-all shadow-lg"
                style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        ) }

        {/* Table - نفس تنسيق الأدمن */ }
        { !loading && !error && (
          <>
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                    <tr>
                      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 800 } }>كود المشروع</th>
                      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 800 } }>الاسم</th>
                      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 800 } }>اسم المتبرع</th>
                      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 800 } }>الوصف</th>
                      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 800 } }>المبلغ قبل الخصم</th>
                      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 800 } }>المبلغ بعد التحويل</th>
                      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 800 } }>المبلغ الصافي</th>
                      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 800 } }>حالة المشروع</th>
                      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 800 } }>الأيام المتبقية للتنفيذ</th>
                      <th className="text-center py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 800 } }>الخيارات</th>
                    </tr>
                  </thead>
                  <tbody>
                    { projects.length > 0 ? (
                      projects.map((project) => {
                        const parent = project?.parent_project || project?.parentProject;
                        const currencyCode = project?.currency_code || project?.currency?.currency_code;
                        const amountAfter = project?.amount_in_usd ?? project?.net_amount_usd ?? project?.net_amount ?? parent?.net_amount_usd ?? parent?.net_amount ?? 0;
                        const netAmount = project?.net_amount_usd ?? project?.net_amount ?? parent?.net_amount_usd ?? parent?.net_amount ?? 0;
                        const projectName = project?.project_name || project?.beneficiary_name || project?.donor_name || '---';
                        return (
                          <tr key={ project.id } className="border-b transition-all duration-200 group border-gray-100 hover:bg-gradient-to-r hover:from-sky-50 hover:to-blue-50">
                            <td className="py-2 px-3 text-sm font-medium text-gray-800" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }>
                              <Link to={ `/project-management/projects/${project.id}` } className="hover:underline text-sky-600 hover:text-sky-700" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>
                                { getProjectCode(project, project?.serial_number || '---') }
                              </Link>
                            </td>
                            <td className="py-2 px-3 text-sm text-gray-800" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }>{ projectName }</td>
                            <td className="py-2 px-3 text-sm text-gray-800 font-medium" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }>{ project.donor_name || project.donor?.name || '---' }</td>
                            <td className="py-2 px-3 text-sm text-gray-700 max-w-xs" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 400 } }>
                              <div className="line-clamp-2" title={ getProjectDescription(project) }>{ getProjectDescription(project) }</div>
                            </td>
                            <td className="py-2 px-3 text-sm font-medium text-gray-800" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>{ formatOriginalAmount(project, currencyCode) }</td>
                            <td className="py-2 px-3 text-sm font-medium text-gray-800" dir="ltr" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>{ formatCurrency(amountAfter || 0) }</td>
                            <td className="py-2 px-3 text-sm font-medium text-green-600" dir="ltr" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>{ formatCurrency(netAmount || 0) }</td>
                            <td className="py-2 px-3">
                              <span className={ `inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(project?.status)}` } style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>
                                { project.status || '-' }
                              </span>
                            </td>
                            <td className="py-2 px-3 text-sm font-medium" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>{ getRemainingDaysBadge(project) }</td>
                            <td className="py-2 px-3" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }>
                              <div className="flex items-center justify-center gap-2">
                                <Link
                                  to={ `/project-management/projects/${project.id}` }
                                  className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors"
                                  title="عرض التفاصيل"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="10" className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <FileText className="w-16 h-16 text-gray-300" />
                            <p className="text-gray-500 font-medium" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }>لا توجد مشاريع</p>
                          </div>
                        </td>
                      </tr>
                    ) }
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination - نفس تنسيق الأدمن */ }
            { pagination.total > 0 && (
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <button
                    onClick={ () => handlePageChange(pagination.current_page - 1) }
                    disabled={ pagination.current_page === 1 }
                    className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-all font-semibold"
                    style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }
                  >
                    <ChevronRight className="w-5 h-5" />
                    السابق
                  </button>
                  <div className="flex items-center gap-3 bg-gray-50 px-6 py-3 rounded-xl">
                    <span className="text-gray-600 font-medium" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }>صفحة</span>
                    <span className="text-2xl font-bold text-sky-600" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>{ pagination.current_page || 1 }</span>
                    <span className="text-gray-600 font-medium" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }>من</span>
                    <span className="text-2xl font-bold text-sky-600" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>{ pagination.last_page || 1 }</span>
                    <span className="mx-2 text-gray-400">|</span>
                    <span className="text-gray-600 font-medium" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }>المجموع:</span>
                    <span className="text-xl font-bold text-sky-700" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>{ pagination.total?.toLocaleString() || 0 }</span>
                    <span className="text-gray-600 font-medium" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }>مشروع</span>
                  </div>
                  <button
                    onClick={ () => handlePageChange(pagination.current_page + 1) }
                    disabled={ pagination.current_page === pagination.last_page }
                    className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-all font-semibold"
                    style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }
                  >
                    التالي
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) }
          </>
        ) }

        {/* نافذة تصدير Excel - اختيار التاريخ من وإلى */ }
        { exportModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={ () => !exportLoading && setExportModalOpen(false) }>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={ (e) => e.stopPropagation() }>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>
                  تصدير Excel — اختيار فترة التاريخ
                </h2>
                <button
                  onClick={ () => !exportLoading && setExportModalOpen(false) }
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-1" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>
                    <Calendar className="w-4 h-4" /> من تاريخ
                  </label>
                  <input
                    type="date"
                    value={ exportDates.start_date }
                    onChange={ (e) => setExportDates(prev => ({ ...prev, start_date: e.target.value })) }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                    style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-1" style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 700 } }>
                    <Calendar className="w-4 h-4" /> إلى تاريخ
                  </label>
                  <input
                    type="date"
                    value={ exportDates.end_date }
                    onChange={ (e) => setExportDates(prev => ({ ...prev, end_date: e.target.value })) }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                    style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 500 } }
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={ handleExportConfirm }
                  disabled={ exportLoading || !exportDates.start_date || !exportDates.end_date }
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                  style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }
                >
                  { exportLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      جاري التصدير...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      تصدير
                    </>
                  ) }
                </button>
                <button
                  onClick={ () => !exportLoading && setExportModalOpen(false) }
                  disabled={ exportLoading }
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all disabled:opacity-50"
                  style={ { fontFamily: 'Cairo, sans-serif', fontWeight: 600 } }
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        ) }
      </div>
    </div>
  );
};

export default DetailedProjects;
