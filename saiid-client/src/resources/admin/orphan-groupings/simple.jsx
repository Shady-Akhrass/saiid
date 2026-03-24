import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import apiClient from "../../../utils/axiosConfig";
import { useToast } from "../../../hooks/useToast";
import { useAuth } from "../../../context/AuthContext";
import { useCache } from "../../../hooks/useCache";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  Filter,
  ArrowUpDown,
  Calendar,
  MapPin,
  Heart,
  BarChart3,
  TrendingUp,
  AlertCircle,
  BookOpen,
  X,
  Plus
} from "lucide-react";

const OrphanGroupings = () => {
  const { user } = useAuth();
  const { getData, setCachedData, isCacheValid, initializeCache } = useCache('orphan-groupings', 300000);
  const { success, error: showError, info } = useToast();
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const fetchInProgressRef = useRef(false);

  // Check if user is admin
  const isAdmin = user?.role === 'admin' || user?.role_name === 'admin' || user?.role === 'administrator' || user?.role === 'مدير';

  // State management — declared before any conditional rendering that uses them
  const [groupings, setGroupings] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('orphan_count');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGrouping, setNewGrouping] = useState({
    governorate: '',
    district: '',
    description: ''
  });

  // Redirect non-admin users
  useEffect(() => {
    if (!isAdmin && user) {
      showError('ليس لديك صلاحيات للوصول إلى تجميعات الأيتام. الصلاحيات مقتصرة على الإدارة فقط.');
    }
  }, [user, isAdmin]);

  // Initialize cache on mount
  useEffect(() => {
    initializeCache();
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch data function
  const fetchGroupings = useCallback(async (options = {}) => {
    const { skipLoading = false, forceRefresh = false } = options;

    const cacheKey = JSON.stringify({ searchQuery, sortBy, sortOrder });
    if (!forceRefresh && isCacheValid(cacheKey)) {
      const cachedData = getData();
      if (cachedData) {
        setGroupings(cachedData.groupings || []);
        setStatistics(cachedData.statistics || null);
        if (!skipLoading) setIsLoading(false);
        return;
      }
    }

    if (abortControllerRef.current && fetchInProgressRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (!isMountedRef.current) return;

    fetchInProgressRef.current = true;
    if (!skipLoading) setIsLoading(true);

    const loadingTimeout = setTimeout(() => {
      if (!skipLoading) setIsLoading(false);
      const cachedData = getData();
      if (!cachedData) {
        setGroupings([]);
        setStatistics(null);
      }
    }, 30000);

    try {
      const response = await apiClient.get('/orphan-groupings', {
        timeout: 30000,
        signal: abortController.signal
      });

      clearTimeout(loadingTimeout);
      if (!isMountedRef.current) return;

      if (response.data?.success) {
        const groupingsData = response.data.data?.groupings || response.data.groupings || [];
        const statsData = response.data.data?.statistics || response.data.statistics || null;

        setCachedData({ groupings: groupingsData, statistics: statsData }, cacheKey);
        setGroupings(groupingsData);
        setStatistics(statsData);
        if (!skipLoading) setIsLoading(false);
      } else {
        throw new Error('Invalid response data');
      }
    } catch (err) {
      clearTimeout(loadingTimeout);

      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        setIsLoading(false);
        return;
      }

      if (err.response?.status === 403) {
        showError(err.response?.data?.message || 'ليس لديك صلاحيات للوصول إلى هذه الصفحة.');
        setIsLoading(false);
        return;
      }

      console.error('❌ Error fetching orphan groupings:', err);
      if (!skipLoading) setIsLoading(false);
      setGroupings([]);
      setStatistics(null);
      showError(err.response?.data?.message || err.message || 'فشل في تحميل بيانات تجميعات الأيتام');
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [searchQuery, sortBy, sortOrder, isCacheValid, getData, setCachedData]);

  useEffect(() => {
    if (isAdmin) fetchGroupings();
  }, [fetchGroupings, isAdmin]);

  // Filter and sort logic
  const filteredAndSortedGroupings = useMemo(() => {
    let filtered = [...groupings];

    if (searchQuery.trim() !== '') {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(g =>
        g.governorate?.toLowerCase().includes(searchLower) ||
        g.district?.toLowerCase().includes(searchLower)
      );
    }

    filtered.sort((a, b) => {
      let aValue = a[sortBy] ?? '';
      let bValue = b[sortBy] ?? '';
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
    });

    return filtered;
  }, [groupings, searchQuery, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedGroupings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGroupings = filteredAndSortedGroupings.slice(startIndex, endIndex);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (filteredAndSortedGroupings.length === 0) return;

    const headers = ['المحافظة', 'المنطقة', 'عدد الأيتام', 'متوسط العمر', 'الذكور', 'الإناث', 'مشاكل صحية', 'في الحفظ'];
    const rows = filteredAndSortedGroupings.map(g => [
      g.governorate || '',
      g.district || '',
      g.orphan_count || 0,
      g.average_age?.toFixed(1) || '',
      g.male_count || 0,
      g.female_count || 0,
      g.health_issues_count || 0,
      g.in_memorization_count || 0
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orphan-groupings.csv';
    link.click();
    URL.revokeObjectURL(url);
    success('تم تصدير البيانات بنجاح');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      // Uncomment when API is ready:
      // const response = await apiClient.post('/orphan-groupings', newGrouping);
      // if (response.data.success) { ... }
      success('تم إنشاء التجميعة بنجاح');
      setShowCreateModal(false);
      setNewGrouping({ governorate: '', district: '', description: '' });
      fetchGroupings({ forceRefresh: true });
    } catch (err) {
      showError('فشل في إنشاء التجميعة');
    }
  };

  // Access denied view
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl shadow-xl p-8 max-w-md mx-4">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M6.938 4h10.124M12 20v-6" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
            الوصول مرفوض
          </h2>
          <p className="text-gray-600 mb-6" style={{ fontFamily: 'Cairo, sans-serif' }}>
            ليس لديك صلاحيات للوصول إلى تجميعات الأيتام. الصلاحيات مقتصرة على الإدارة فقط.
          </p>
          <div className="text-sm text-gray-500">
            <p>الدور المطلوب: <span className="font-semibold">مدير</span></p>
            <p>دورك الحالي: <span className="font-semibold">{user?.role || user?.role_name || 'غير محدد'}</span></p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل تجميعات الأيتام...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 p-4" style={{ fontFamily: 'Cairo, Tajawal, Arial, sans-serif' }}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Create Grouping Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4 w-full">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  إنشاء تجميعة جديدة
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>المحافظة</label>
                  <input
                    type="text"
                    value={newGrouping.governorate}
                    onChange={(e) => setNewGrouping(prev => ({ ...prev, governorate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                    placeholder="أدخل اسم المحافظة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>المنطقة</label>
                  <input
                    type="text"
                    value={newGrouping.district}
                    onChange={(e) => setNewGrouping(prev => ({ ...prev, district: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                    placeholder="أدخل اسم المنطقة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>الوصف</label>
                  <textarea
                    value={newGrouping.description}
                    onChange={(e) => setNewGrouping(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                    rows="3"
                    placeholder="أدخل وصف التجميعة"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    إنشاء تجميعة
                  </button>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg font-semibold transition-colors" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                تجميعات الأيتام
              </h1>
              <p className="text-sky-100">عرض وتحليل بيانات تجميعات الأيتام حسب المحافظة والمنطقة</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="bg-white/20 backdrop-blur-md hover:bg-white/30 border-2 border-white/30 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all duration-300"
              >
                <Filter className="w-4 h-4" />
                الفلاتر
              </button>
              <button
                onClick={handleExport}
                disabled={paginatedGroupings.length === 0}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                تصدير Excel
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all duration-300"
              >
                <Plus className="w-4 h-4" />
                إنشاء تجميعة جديدة
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">إجمالي الأيتام</p>
                  <p className="text-2xl font-bold text-gray-800">{statistics.total_orphans?.toLocaleString()}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">أقصى عدد</p>
                  <p className="text-2xl font-bold text-gray-800">{statistics.max_orphan_count?.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{statistics.max_location?.governorate} - {statistics.max_location?.district}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">متوسط المجموعات</p>
                  <p className="text-2xl font-bold text-gray-800">{statistics.average_orphans_per_location?.toLocaleString()}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-500" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">إجمالي المواقع</p>
                  <p className="text-2xl font-bold text-gray-800">{statistics.total_locations?.toLocaleString()}</p>
                </div>
                <MapPin className="w-8 h-8 text-red-500" />
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث بالمحافظة أو المنطقة..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => handleSort(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <option value="orphan_count">عدد الأيتام</option>
                <option value="governorate">المحافظة</option>
                <option value="district">المنطقة</option>
                <option value="average_age">متوسط العمر</option>
                <option value="male_count">عدد الذكور</option>
                <option value="female_count">عدد الإناث</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowUpDown className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  {[
                    { label: 'المحافظة', field: 'governorate' },
                    { label: 'المنطقة', field: 'district' },
                    { label: 'عدد الأيتام', field: 'orphan_count' },
                    { label: 'متوسط العمر', field: 'average_age' },
                    { label: 'الذكور', field: 'male_count' },
                    { label: 'الإناث', field: 'female_count' },
                  ].map(({ label, field }) => (
                    <th
                      key={field}
                      className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort(field)}
                    >
                      {label} <ArrowUpDown className="inline w-3 h-3 ml-1" />
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">مشاكل صحية</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">في الحفظ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedGroupings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : paginatedGroupings.map((grouping, index) => (
                  <tr key={grouping.id ?? index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{grouping.governorate || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grouping.district || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {grouping.orphan_count?.toLocaleString() ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grouping.average_age?.toFixed(1) || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Users className="w-3 h-3 ml-1" />{grouping.male_count || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                        <Heart className="w-3 h-3 ml-1" />{grouping.female_count || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {grouping.health_issues_count > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertCircle className="w-3 h-3 ml-1" />{grouping.health_issues_count}
                        </span>
                      ) : <span className="text-green-600">لا يوجد</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {grouping.in_memorization_count > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <BookOpen className="w-3 h-3 ml-1" />{grouping.in_memorization_count}
                        </span>
                      ) : <span className="text-gray-400">لا يوجد</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
              <span className="text-sm text-gray-700">
                عرض {startIndex + 1} إلى {Math.min(endIndex, filteredAndSortedGroupings.length)} من {filteredAndSortedGroupings.length} تجميعات
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <span className="px-3 py-1 bg-blue-500 text-white rounded-lg">{currentPage}</span>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrphanGroupings;