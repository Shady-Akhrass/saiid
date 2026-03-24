import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { TrendingUp, Calendar, BarChart3, CheckCircle2, AlertCircle } from 'lucide-react';

const MediaReports = () => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [filters, setFilters] = useState({
    month: '',
    year: '',
    project_type: '',
  });

  useEffect(() => {
    fetchReport();
  }, [filters]);

  // ✅ تحديث عنوان الصفحة (Tab Title) ديناميكياً
  useEffect(() => {
    document.title = 'التقارير - قسم الإعلام';
  }, []);

  const fetchReport = async () => {
    let loadingTimeout;

    try {
      setLoading(true);

      // إيقاف حالة التحميل بعد timeout
      loadingTimeout = setTimeout(() => {
        setLoading(false);
        setReport({
          month: filters.month || null,
          year: filters.year || null,
          project_type: filters.project_type || null,
          completed_count: 0,
          average_duration: 0,
          delay_percentage: 0,
          by_type: {},
          monthly_trend: [],
        });
      }, 30000); // timeout 30 ثانية (مطابق لـ axios timeout)

      // استخدام endpoint عام بدلاً من /media-reports لتجنب تفسيره كـ ID
      // جلب جميع المشاريع ذات الصلة بقسم الإعلام
      const params = new URLSearchParams();
      params.append('perPage', '200'); // ✅ تقليل من 1000 إلى 200 لتحسين الأداء
      params.append('status', 'منفذ,في المونتاج,تم المونتاج,معاد مونتاجه,وصل للمتبرع');

      if (filters.project_type) {
        params.append('project_type', filters.project_type);
      }

      const response = await apiClient.get(`/project-proposals?${params.toString()}`, {
        timeout: 30000 // timeout 30 ثانية (مطابق للإعداد الافتراضي)
      });

      if (loadingTimeout) clearTimeout(loadingTimeout);

      if (response.data.success) {
        const projects = response.data.projects || response.data.data?.data || response.data.data || [];
        // حساب التقارير من البيانات المستلمة
        const reportData = calculateReportFromProjects(projects, filters);
        setReport(reportData);
      } else {
        setReport({
          month: filters.month || null,
          year: filters.year || null,
          project_type: filters.project_type || null,
          completed_count: 0,
          average_duration: 0,
          delay_percentage: 0,
          by_type: {},
          monthly_trend: [],
        });
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);

      setReport({
        month: filters.month || null,
        year: filters.year || null,
        project_type: filters.project_type || null,
        completed_count: 0,
        average_duration: 0,
        delay_percentage: 0,
        by_type: {},
        monthly_trend: [],
      });

      // تسجيل الأخطاء فقط في development (تجاهل timeout و connection errors)
      if (import.meta.env.DEV && !error.isConnectionError && !error.isTimeoutError) {
        console.error('Error fetching report:', error);
      }

      // لا نعرض رسالة خطأ إذا كان 404 فقط (endpoint غير موجود بعد)
      if (error.response?.status !== 404 && !error.isConnectionError) {
        toast.error(error.userMessage || 'فشل تحميل التقرير');
      }
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const calculateReportFromProjects = (projects, filters) => {
    if (!Array.isArray(projects)) {
      return {
        month: filters.month || null,
        year: filters.year || null,
        project_type: filters.project_type || null,
        completed_count: 0,
        average_duration: 0,
        delay_percentage: 0,
        by_type: {},
        monthly_trend: [],
      };
    }

    // فلترة حسب الشهر/السنة
    let filteredProjects = projects;

    if (filters.month) {
      const [year, month] = filters.month.split('-');
      filteredProjects = filteredProjects.filter(p => {
        const projectDate = p.montage_completed_date || p.execution_date || p.created_at;
        if (!projectDate) return false;
        const date = new Date(projectDate);
        return date.getFullYear() === parseInt(year) && date.getMonth() + 1 === parseInt(month);
      });
    } else if (filters.year) {
      filteredProjects = filteredProjects.filter(p => {
        const projectDate = p.montage_completed_date || p.execution_date || p.created_at;
        if (!projectDate) return false;
        const date = new Date(projectDate);
        return date.getFullYear() === parseInt(filters.year);
      });
    }

    // فلترة حسب نوع المشروع
    if (filters.project_type) {
      filteredProjects = filteredProjects.filter(p => p.project_type === filters.project_type);
    }

    // المشاريع المكتملة (تم المونتاج أو وصل للمتبرع)
    const completedProjects = filteredProjects.filter(p =>
      p.status === 'تم المونتاج' || p.status === 'وصل للمتبرع'
    );

    // حساب متوسط وقت المونتاج
    const projectsWithDuration = completedProjects.filter(p =>
      p.montage_start_date && p.montage_completed_date
    );

    let averageDuration = 0;
    if (projectsWithDuration.length > 0) {
      const totalDays = projectsWithDuration.reduce((sum, p) => {
        const start = new Date(p.montage_start_date);
        const end = new Date(p.montage_completed_date);
        const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      averageDuration = totalDays / projectsWithDuration.length;
    }

    // حساب نسبة التأخير (المشاريع المتأخرة / إجمالي المشاريع النشطة)
    const activeProjects = filteredProjects.filter(p =>
      p.status === 'في المونتاج' || p.status === 'منفذ'
    );
    const now = new Date();
    const delayedProjects = activeProjects.filter(p => {
      if (!p.montage_start_date && p.status === 'في المونتاج') {
        const execDate = p.execution_date ? new Date(p.execution_date) : new Date(p.created_at);
        const daysDiff = Math.floor((now - execDate) / (1000 * 60 * 60 * 24));
        return daysDiff > 5;
      }
      if (p.montage_start_date) {
        const startDate = new Date(p.montage_start_date);
        const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        return daysDiff > 5;
      }
      return false;
    });

    const delayPercentage = activeProjects.length > 0
      ? (delayedProjects.length / activeProjects.length) * 100
      : 0;

    // المشاريع حسب النوع
    const byType = {};
    completedProjects.forEach(p => {
      const type = p.project_type || 'غير محدد';
      byType[type] = (byType[type] || 0) + 1;
    });

    // الاتجاه الشهري (آخر 6 أشهر)
    const monthlyTrend = [];
    const nowDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      const monthProjects = completedProjects.filter(p => {
        const projectDate = p.montage_completed_date || p.execution_date || p.created_at;
        if (!projectDate) return false;
        const date = new Date(projectDate);
        return date.getFullYear() === monthDate.getFullYear() &&
          date.getMonth() === monthDate.getMonth();
      });

      const monthCompleted = monthProjects.filter(p =>
        p.montage_start_date && p.montage_completed_date
      );

      let monthAvgDuration = 0;
      if (monthCompleted.length > 0) {
        const monthTotalDays = monthCompleted.reduce((sum, p) => {
          const start = new Date(p.montage_start_date);
          const end = new Date(p.montage_completed_date);
          const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        monthAvgDuration = monthTotalDays / monthCompleted.length;
      }

      monthlyTrend.push({
        month: monthStr,
        completed_count: monthProjects.length,
        average_duration: monthAvgDuration,
      });
    }

    return {
      month: filters.month || null,
      year: filters.year || null,
      project_type: filters.project_type || null,
      completed_count: completedProjects.length,
      average_duration: averageDuration,
      delay_percentage: delayPercentage,
      by_type: byType,
      monthly_trend: monthlyTrend,
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */ }
        <div>
          <h1 className="text-3xl font-bold text-gray-800">تقارير قسم الإعلام</h1>
          <p className="text-gray-600 mt-1">إحصائيات وتحليلات أداء المونتاج</p>
        </div>

        {/* Filters */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">الشهر</label>
              <input
                type="month"
                value={ filters.month }
                onChange={ (e) => setFilters({ ...filters, month: e.target.value, year: '' }) }
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">السنة</label>
              <input
                type="number"
                value={ filters.year }
                onChange={ (e) => setFilters({ ...filters, year: e.target.value, month: '' }) }
                placeholder="2025"
                min="2020"
                max="2030"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع المشروع</label>
              <select
                value={ filters.project_type }
                onChange={ (e) => setFilters({ ...filters, project_type: e.target.value }) }
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

        { report && (
          <>
            {/* Summary Cards */ }
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">المشاريع المكتملة</h3>
                <p className="text-3xl font-bold text-gray-800">{ report.completed_count || 0 }</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">متوسط وقت المونتاج</h3>
                <p className="text-3xl font-bold text-gray-800">{ report.average_duration?.toFixed(1) || 0 }</p>
                <p className="text-xs text-gray-500 mt-1">يوم</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">نسبة التأخير</h3>
                <p className="text-3xl font-bold text-gray-800">{ report.delay_percentage?.toFixed(1) || 0 }%</p>
              </div>
            </div>

            {/* Projects by Type */ }
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4">المشاريع حسب النوع</h2>
              <div className="space-y-3">
                { Object.entries(report.by_type || {}).map(([type, count]) => (
                  <div key={ type } className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-700 font-medium">{ type }</span>
                    <span className="text-lg font-bold text-gray-800">{ count }</span>
                  </div>
                )) }
                { (!report.by_type || Object.keys(report.by_type).length === 0) && (
                  <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>
                ) }
              </div>
            </div>

            {/* Monthly Trend */ }
            { report.monthly_trend && report.monthly_trend.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-xl font-bold text-gray-800 mb-4">الاتجاه الشهري</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">الشهر</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">عدد المكتملة</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">متوسط المدة</th>
                      </tr>
                    </thead>
                    <tbody>
                      { report.monthly_trend.map((item, index) => (
                        <tr key={ index } className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-700">{ item.month }</td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-800">{ item.completed_count }</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{ item.average_duration?.toFixed(1) } يوم</td>
                        </tr>
                      )) }
                    </tbody>
                  </table>
                </div>
              </div>
            ) }
          </>
        ) }

        { !report && (
          <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">لا توجد بيانات متاحة</p>
          </div>
        ) }
      </div>
    </div>
  );
};

export default MediaReports;

