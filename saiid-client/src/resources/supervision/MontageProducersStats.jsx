import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/axiosConfig';
import { useToast } from '../../hooks/useToast';
import {
  RefreshCw,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Award,
  Target,
  Zap,
  BarChart3,
  Calendar,
  Video
} from 'lucide-react';

const MontageProducersStats = () => {
  const [statsData, setStatsData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const { success, error: showError } = useToast();

  useEffect(() => {
    loadStats();
  }, [appliedStartDate, appliedEndDate]);

  const loadStats = async (refresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const params = refresh ? { _refresh: 1 } : {};
      if (appliedStartDate) params.start_date = appliedStartDate;
      if (appliedEndDate) params.end_date = appliedEndDate;
      const response = await apiClient.get('/supervision/montage-producers-statistics', { params });

      if (response.data.success) {
        setStatsData(response.data.data || {});
        if (refresh) {
          success('تم تحديث البيانات بنجاح');
        }
      } else {
        setError(response.data.error || 'فشل تحميل الإحصائيات');
        showError(response.data.error || 'فشل تحميل الإحصائيات');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'حدث خطأ أثناء تحميل الإحصائيات';
      setError(errorMessage);
      showError(errorMessage);
      console.error('Montage Producers Stats Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => loadStats(true);

  const applyDateFilter = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
  };

  const resetDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

  if (loading && !statsData.total_statistics) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="bg-white rounded-2xl shadow-lg p-12">
          <div className="flex flex-col justify-center items-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 absolute top-0"></div>
            </div>
            <p className="mt-6 text-gray-600 font-medium text-lg">جاري تحميل الإحصائيات...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !statsData.total_statistics) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-red-100 p-4 rounded-full">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
            <p className="text-red-600 text-lg font-medium">{ error }</p>
            <button
              onClick={ () => loadStats() }
              className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { total_statistics, averages, producers } = statsData;

  return (
    <div className="montage-producers-stats min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6" style={ { fontFamily: 'Cairo, Tajawal, Arial, sans-serif' } }>
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */ }
        <div className="page-header bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-violet-600 p-4 rounded-xl shadow-lg">
                  <Video className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                    إحصائيات الممنتجين
                  </h1>
                  <p className="text-gray-500 text-sm mt-1">
                    تحليل شامل لأداء وإنتاجية جميع الممنتجين (المشاريع المسندة فقط)
                  </p>
                </div>
              </div>
              <button
                onClick={ refreshData }
                disabled={ loading }
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <RefreshCw className={ `w-5 h-5 ${loading ? 'animate-spin' : ''}` } />
                <span className="font-semibold">تحديث البيانات</span>
              </button>
            </div>
            {/* التحكم في المدة (من - إلى) */ }
            <div className="flex flex-wrap items-end gap-3 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">من تاريخ:</label>
                <input
                  type="date"
                  value={ startDate }
                  onChange={ (e) => setStartDate(e.target.value) }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">إلى تاريخ:</label>
                <input
                  type="date"
                  value={ endDate }
                  onChange={ (e) => setEndDate(e.target.value) }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <button
                onClick={ applyDateFilter }
                disabled={ loading }
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
              >
                تطبيق المدة
              </button>
              <button
                onClick={ resetDateFilter }
                disabled={ loading }
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
              >
                إعادة تعيين
              </button>
              { (appliedStartDate || appliedEndDate) && (
                <span className="text-sm text-gray-500">
                  المعروض: { appliedStartDate || '—' } إلى { appliedEndDate || '—' }
                </span>
              ) }
            </div>
          </div>
        </div>

        {/* الإحصائيات الإجمالية */ }
        { total_statistics && (
          <div className="mb-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">الإحصائيات الإجمالية</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* إجمالي المنتجين */ }
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-5 border-2 border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <Users className="w-8 h-8 text-purple-600" />
                    <span className="text-3xl font-bold text-purple-600">
                      { total_statistics.total_producers || 0 }
                    </span>
                  </div>
                  <p className="text-gray-700 font-semibold">إجمالي المنتجين</p>
                </div>

                {/* إجمالي المشاريع المسندة */ }
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <Target className="w-8 h-8 text-blue-600" />
                    <span className="text-3xl font-bold text-blue-600">
                      { total_statistics.total_assigned_projects || 0 }
                    </span>
                  </div>
                  <p className="text-gray-700 font-semibold">المشاريع المسندة للممنتجين</p>
                  <p className="text-xs text-gray-500 mt-1">من إجمالي المشاريع في النظام</p>
                </div>

                {/* المشاريع المنجزة */ }
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                    <span className="text-3xl font-bold text-green-600">
                      { total_statistics.total_completed_projects || 0 }
                    </span>
                  </div>
                  <p className="text-gray-700 font-semibold">المشاريع المنجزة</p>
                </div>

                {/* المشاريع الحالية */ }
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border-2 border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <Clock className="w-8 h-8 text-amber-600" />
                    <span className="text-3xl font-bold text-amber-600">
                      { total_statistics.total_current_projects || 0 }
                    </span>
                  </div>
                  <p className="text-gray-700 font-semibold">المشاريع الحالية</p>
                </div>

                {/* المشاريع المتأخرة */ }
                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-5 border-2 border-red-200">
                  <div className="flex items-center justify-between mb-3">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                    <span className="text-3xl font-bold text-red-600">
                      { total_statistics.total_delayed_projects || 0 }
                    </span>
                  </div>
                  <p className="text-gray-700 font-semibold">المشاريع المتأخرة</p>
                </div>

                {/* المشاريع التي وصلت للمتبرع */ }
                <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-xl p-5 border-2 border-cyan-200">
                  <div className="flex items-center justify-between mb-3">
                    <Zap className="w-8 h-8 text-cyan-600" />
                    <span className="text-3xl font-bold text-cyan-600">
                      { total_statistics.total_delivered_projects || 0 }
                    </span>
                  </div>
                  <p className="text-gray-700 font-semibold">وصلت للمتبرع</p>
                </div>

                {/* المشاريع المعادة */ }
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-5 border-2 border-yellow-200">
                  <div className="flex items-center justify-between mb-3">
                    <RefreshCw className="w-8 h-8 text-yellow-600" />
                    <span className="text-3xl font-bold text-yellow-600">
                      { total_statistics.total_redone_projects || 0 }
                    </span>
                  </div>
                  <p className="text-gray-700 font-semibold">مشاريع معادة</p>
                </div>

                {/* المشاريع المنتهية */ }
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border-2 border-indigo-200">
                  <div className="flex items-center justify-between mb-3">
                    <CheckCircle className="w-8 h-8 text-indigo-600" />
                    <span className="text-3xl font-bold text-indigo-600">
                      { total_statistics.total_finished_projects || 0 }
                    </span>
                  </div>
                  <p className="text-gray-700 font-semibold">مشاريع منتهية</p>
                  <p className="text-xs text-gray-500 mt-1">المسندة للممنتجين فقط</p>
                </div>

                {/* نسبة الإنجاز الإجمالية */ }
                <div className="bg-gradient-to-br from-teal-50 to-green-50 rounded-xl p-5 border-2 border-teal-200">
                  <div className="flex items-center justify-between mb-3">
                    <TrendingUp className="w-8 h-8 text-teal-600" />
                    <span className="text-3xl font-bold text-teal-600">
                      { averages?.overall_completion_rate?.toFixed(1) || 0 }%
                    </span>
                  </div>
                  <p className="text-gray-700 font-semibold">نسبة الإنجاز العامة</p>
                </div>
              </div>
            </div>

            {/* المتوسطات */ }
            { averages && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">متوسط المشاريع لكل منتج</h3>
                  </div>
                  <p className="text-4xl font-bold text-indigo-600">
                    { averages.avg_projects_per_producer?.toFixed(1) || 0 }
                  </p>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">متوسط المشاريع المنجزة لكل منتج</h3>
                  </div>
                  <p className="text-4xl font-bold text-green-600">
                    { averages.avg_completed_per_producer?.toFixed(1) || 0 }
                  </p>
                </div>
              </div>
            ) }
          </div>
        ) }

        {/* قائمة المنتجين */ }
        { producers && producers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-purple-500 to-violet-600 p-2 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">أداء المنتجين (مرتبون حسب الإنتاجية)</h2>
            </div>

            <div className="space-y-4">
              { producers.map((producer, index) => {
                const stats = producer.statistics || {};
                const completionRate = stats.completion_rate || 0;
                const isTopPerformer = index < 3;

                return (
                  <div
                    key={ producer.id }
                    className={ `bg-gradient-to-r ${isTopPerformer ? 'from-yellow-50 to-amber-50 border-yellow-300' : 'from-gray-50 to-blue-50 border-gray-200'} rounded-xl p-6 border-2 hover:shadow-lg transition-all duration-300` }
                  >
                    {/* Header */ }
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        { isTopPerformer && (
                          <div className={ `bg-gradient-to-br ${index === 0 ? 'from-yellow-400 to-amber-500' :
                            index === 1 ? 'from-gray-300 to-gray-400' :
                              'from-orange-400 to-amber-600'
                            } p-2 rounded-full` }>
                            <Award className="w-6 h-6 text-white" />
                          </div>
                        ) }
                        <div>
                          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            { producer.name }
                            { isTopPerformer && (
                              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-semibold">
                                ⭐ الأفضل
                              </span>
                            ) }
                          </h3>
                          <p className="text-sm text-gray-500">{ producer.phone_number }</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className={ `inline-flex items-center gap-2 px-4 py-2 rounded-xl ${completionRate >= 80 ? 'bg-green-100 text-green-700' :
                          completionRate >= 60 ? 'bg-blue-100 text-blue-700' :
                            completionRate >= 40 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                          }` }>
                          <TrendingUp className="w-5 h-5" />
                          <span className="text-lg font-bold">{ completionRate.toFixed(1) }%</span>
                        </div>
                      </div>
                    </div>

                    {/* الإحصائيات */ }
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
                      <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
                        <p className="text-2xl font-bold text-blue-600">{ stats.total_projects || 0 }</p>
                        <p className="text-xs text-gray-600 mt-1">إجمالي المشاريع</p>
                      </div>

                      <div className="bg-white rounded-lg p-3 text-center border border-green-200">
                        <p className="text-2xl font-bold text-green-600">{ stats.completed_projects || 0 }</p>
                        <p className="text-xs text-gray-600 mt-1">منجزة</p>
                      </div>

                      <div className="bg-white rounded-lg p-3 text-center border border-amber-200">
                        <p className="text-2xl font-bold text-amber-600">{ stats.current_projects || 0 }</p>
                        <p className="text-xs text-gray-600 mt-1">حالية</p>
                      </div>

                      <div className="bg-white rounded-lg p-3 text-center border border-cyan-200">
                        <p className="text-2xl font-bold text-cyan-600">{ stats.delivered_projects || 0 }</p>
                        <p className="text-xs text-gray-600 mt-1">وصلت للمتبرع</p>
                      </div>

                      <div className="bg-white rounded-lg p-3 text-center border border-indigo-200">
                        <p className="text-2xl font-bold text-indigo-600">{ stats.finished_projects || 0 }</p>
                        <p className="text-xs text-gray-600 mt-1">منتهية</p>
                      </div>

                      <div className="bg-white rounded-lg p-3 text-center border border-red-200">
                        <p className="text-2xl font-bold text-red-600">{ stats.delayed_projects || 0 }</p>
                        <p className="text-xs text-gray-600 mt-1">متأخرة</p>
                      </div>

                      <div className="bg-white rounded-lg p-3 text-center border border-yellow-200">
                        <p className="text-2xl font-bold text-yellow-600">{ stats.redone_projects || 0 }</p>
                        <p className="text-xs text-gray-600 mt-1">معادة</p>
                      </div>

                      <div className="bg-white rounded-lg p-3 text-center border border-teal-200">
                        <p className="text-2xl font-bold text-teal-600">{ stats.recent_completed_30_days || 0 }</p>
                        <p className="text-xs text-gray-600 mt-1">آخر 30 يوم</p>
                      </div>

                      <div className="bg-white rounded-lg p-3 text-center border border-purple-200">
                        <p className="text-2xl font-bold text-purple-600">
                          { stats.average_completion_hours?.toFixed(1) || 0 }
                        </p>
                        <p className="text-xs text-gray-600 mt-1">ساعة (متوسط)</p>
                      </div>
                    </div>

                    {/* Progress Bar */ }
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600">نسبة الإنجاز</span>
                        <span className="text-sm font-bold text-gray-700">{ completionRate.toFixed(1) }%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={ `h-full rounded-full transition-all duration-500 ${completionRate >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                            completionRate >= 60 ? 'bg-gradient-to-r from-blue-500 to-indigo-600' :
                              completionRate >= 40 ? 'bg-gradient-to-r from-yellow-500 to-amber-600' :
                                'bg-gradient-to-r from-red-500 to-pink-600'
                            }` }
                          style={ { width: `${completionRate}%` } }
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              }) }
            </div>
          </div>
        ) }

        {/* رسالة في حالة عدم وجود بيانات */ }
        { (!producers || producers.length === 0) && !loading && !error && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">لا توجد بيانات لمنتجي المونتاج</p>
          </div>
        ) }
      </div>
    </div>
  );
};

export default MontageProducersStats;
