import React, { useState, useEffect } from 'react';
import supervisionAPI from '../../api/supervision';
import apiClient from '../../utils/axiosConfig';
import { useToast } from '../../hooks/useToast';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
    Filler
} from 'chart.js';
import {
    Download,
    RefreshCw,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Calendar,
    Filter,
    X,
    BarChart3,
    PieChart,
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    Coins,
    CheckCircle
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
    Filler
);

// الأنواع الافتراضية (في حالة فشل جلبها من API)
const DEFAULT_PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];

const FinancialReports = () => {
    const [financialData, setFinancialData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [projectTypes, setProjectTypes] = useState(DEFAULT_PROJECT_TYPES);
    const [projectTypesLoading, setProjectTypesLoading] = useState(false);
    const { success, error: showError } = useToast();
    const [chartType, setChartType] = useState({});
    const [viewMode, setViewMode] = useState('grid');

    // Filters
    const [filters, setFilters] = useState({
        start_date: '',
        end_date: '',
        currency: '',
        project_type: ''
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

    useEffect(() => {
        loadFinancialData();
    }, [filters]);

    const loadFinancialData = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await supervisionAPI.getDetailedFinancial(filters);
            if (response.success) {
                setFinancialData(response.data || {});
            } else {
                if (response.data && Object.keys(response.data).length > 0) {
                    setFinancialData(response.data);
                    showError('تم تحميل بعض البيانات، لكن حدث خطأ في جزء منها');
                } else {
                    setError(response.error || 'فشل تحميل البيانات المالية');
                    showError(response.error || 'فشل تحميل البيانات المالية');
                }
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'حدث خطأ أثناء تحميل البيانات';
            setError(errorMessage);
            showError(errorMessage);
            console.error('Financial Reports Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshData = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await supervisionAPI.getFinancialSummary(true);
            if (response.success) {
                setFinancialData(response.data);
                success('تم تحديث البيانات بنجاح');
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'فشل تحديث البيانات';
            setError(errorMessage);
            showError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const clearFilters = () => {
        setFilters({
            start_date: '',
            end_date: '',
            currency: '',
            project_type: ''
        });
    };

    const handleExport = async () => {
        try {
            await supervisionAPI.exportReport('financial', filters);
            success('تم تحميل ملف Excel بنجاح!');
        } catch (err) {
            showError(err?.userMessage || err?.response?.data?.message || 'فشل التصدير');
        }
    };

    const hasActiveFilters = filters.start_date || filters.end_date || filters.currency || filters.project_type;

    // Color schemas
    const primaryColors = {
        lightBlue: ['#60A5FA', '#93C5FD', '#DBEAFE'],
        darkBlue: ['#3B82F6', '#2563EB', '#1D4ED8'],
        blue: ['#3B82F6', '#2563EB', '#1D4ED8'],
        orange: ['#FB923C', '#FDBA74', '#FED7AA'],
        darkOrange: ['#F97316', '#EA580C', '#DC2626'],
        green: ['#10B981', '#059669', '#047857'],
        purple: ['#A78BFA', '#8B5CF6', '#7C3AED'],
        cyan: ['#06B6D4', '#0891B2', '#0E7490'],
        teal: ['#14B8A6', '#0D9488', '#0F766E'],
        emerald: ['#10B981', '#059669', '#047857'],
        gray: ['#6B7280', '#9CA3AF', '#D1D5DB'],
    };

    const toggleChartType = (chartId) => {
        setChartType(prev => ({
            ...prev,
            [chartId]: prev[chartId] === 'bar' ? 'line' : 'bar'
        }));
    };

    const createGradient = (context, color1, color2) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return color1;
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    };

    // Chart Options
    const pieChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 15,
                    font: {
                        size: 12,
                        family: 'Cairo, Tajawal, Arial, sans-serif'
                    },
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1F2937',
                bodyColor: '#4B5563',
                borderColor: '#E5E7EB',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                usePointStyle: true,
                callbacks: {
                    label: function (context) {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: $${value.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${percentage}%)`;
                    }
                }
            }
        },
        animation: {
            animateRotate: true,
            animateScale: true
        }
    };

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1F2937',
                bodyColor: '#4B5563',
                borderColor: '#E5E7EB',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                displayColors: false,
                callbacks: {
                    label: function (context) {
                        const datasetLabel = context.dataset.label || '';
                        if (datasetLabel.includes('المبلغ') || datasetLabel.includes('USD')) {
                            return `المبلغ: $${context.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                        } else if (datasetLabel.includes('عدد') || datasetLabel.includes('المشاريع')) {
                            return `عدد المشاريع: ${context.parsed.y.toLocaleString('en-US')}`;
                        }
                        return `${datasetLabel}: ${context.parsed.y.toLocaleString('en-US')}`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 11,
                        family: 'Cairo, Tajawal, Arial, sans-serif'
                    },
                    color: '#6B7280'
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: '#F3F4F6',
                    drawBorder: false
                },
                ticks: {
                    font: {
                        size: 11,
                        family: 'Cairo, Tajawal, Arial, sans-serif'
                    },
                    color: '#6B7280',
                    padding: 8,
                    callback: function (value, index, ticks) {
                        // Check if this chart is for currency (has $ in dataset label) or count
                        const chart = this.chart;
                        if (chart && chart.data && chart.data.datasets && chart.data.datasets[0]) {
                            const label = chart.data.datasets[0].label || '';
                            if (label.includes('المبلغ') || label.includes('USD')) {
                                return '$' + value.toLocaleString('en-US');
                            }
                        }
                        // Default for counts (numbers only)
                        return value.toLocaleString('en-US');
                    }
                }
            }
        },
        animation: {
            duration: 1500,
            easing: 'easeInOutQuart'
        }
    };

    const lineChartOptions = {
        ...barChartOptions,
        plugins: {
            ...barChartOptions.plugins,
            legend: {
                display: true,
                position: 'top',
                labels: {
                    font: {
                        size: 12,
                        family: 'Cairo, Tajawal, Arial, sans-serif'
                    }
                }
            }
        },
        elements: {
            line: {
                tension: 0.4,
                fill: true
            },
            point: {
                radius: 4,
                hoverRadius: 6
            }
        }
    };

    // Prepare Chart Data
    const currencyChartData = financialData.by_currency ? {
        labels: Object.keys(financialData.by_currency),
        datasets: [{
            label: 'المبلغ بالدولار',
            data: Object.values(financialData.by_currency).map(item => item.in_usd || item.total || 0),
            backgroundColor: [
                primaryColors.blue[0],
                primaryColors.green[0],
                primaryColors.orange[0],
                primaryColors.purple[0],
                primaryColors.cyan[0],
                primaryColors.teal[0]
            ],
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverBorderWidth: 4
        }]
    } : null;

    const typeChartData = financialData.by_type ? {
        labels: Object.keys(financialData.by_type),
        datasets: [{
            label: 'المبلغ (USD)',
            data: Object.values(financialData.by_type).map(item => item.total_usd || 0),
            backgroundColor: (context) => {
                const chart = context.chart;
                const { data: chartData, chartArea } = chart;
                if (!chartArea) return null;
                return chartData.labels.map((_, i) => {
                    const colors = [
                        primaryColors.darkBlue,
                        primaryColors.green,
                        primaryColors.purple,
                        primaryColors.orange,
                        primaryColors.cyan
                    ];
                    const colorSet = colors[i % colors.length];
                    return createGradient(context, colorSet[0], colorSet[1]);
                });
            },
            borderColor: 'transparent',
            borderRadius: 8,
            borderSkipped: false
        }]
    } : null;

    const typeProjectsCountChartData = financialData.by_type ? {
        labels: Object.keys(financialData.by_type),
        datasets: [{
            label: 'عدد المشاريع',
            data: Object.values(financialData.by_type).map(item => item.count || 0),
            backgroundColor: (context) => {
                const chart = context.chart;
                const { data: chartData, chartArea } = chart;
                if (!chartArea) return null;
                return chartData.labels.map((_, i) => {
                    const colors = [
                        primaryColors.darkBlue,
                        primaryColors.green,
                        primaryColors.purple,
                        primaryColors.orange,
                        primaryColors.cyan,
                        primaryColors.teal
                    ];
                    const colorSet = colors[i % colors.length];
                    return createGradient(context, colorSet[0], colorSet[1]);
                });
            },
            borderColor: 'transparent',
            borderRadius: 8,
            borderSkipped: false
        }]
    } : null;

    const statusChartData = financialData.by_status ? {
        labels: Object.keys(financialData.by_status),
        datasets: [{
            label: 'المبلغ (USD)',
            data: Object.values(financialData.by_status).map(item => item.total_usd || 0),
            backgroundColor: (context) => {
                const chart = context.chart;
                const { data: chartData, chartArea } = chart;
                if (!chartArea) return null;
                return chartData.labels.map((_, i) => {
                    const colors = [
                        primaryColors.green,
                        primaryColors.darkBlue,
                        primaryColors.gray || ['#6B7280', '#9CA3AF'],
                        primaryColors.purple,
                        primaryColors.orange
                    ];
                    const colorSet = colors[i % colors.length];
                    return createGradient(context, colorSet[0], colorSet[1]);
                });
            },
            borderColor: 'transparent',
            borderRadius: 8,
            borderSkipped: false
        }]
    } : null;

    const monthlyTrendChartData = financialData.monthly_trend && financialData.monthly_trend.length > 0 ? {
        labels: financialData.monthly_trend.map(month => month.month_name),
        datasets: [{
            label: 'المبلغ الشهري (USD)',
            data: financialData.monthly_trend.map(month => month.total_usd || 0),
            borderColor: primaryColors.darkBlue[0],
            backgroundColor: (context) => {
                const chart = context.chart;
                const { chartArea } = chart;
                if (!chartArea) return null;
                const gradient = chart.ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
                gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
                return gradient;
            },
            fill: true,
            tension: 0.4,
            pointBackgroundColor: primaryColors.darkBlue[0],
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    } : null;

    // التوزيع حسب التفريعات - المبالغ
    const subcategoryAmountChartData = financialData.by_subcategory ? {
        labels: Object.keys(financialData.by_subcategory),
        datasets: [{
            label: 'المبلغ (USD)',
            data: Object.values(financialData.by_subcategory).map(item => item.total_usd || 0),
            backgroundColor: (context) => {
                const chart = context.chart;
                const { data: chartData, chartArea } = chart;
                if (!chartArea) return null;
                return chartData.labels.map((_, i) => {
                    const colors = [
                        primaryColors.darkBlue,
                        primaryColors.green,
                        primaryColors.purple,
                        primaryColors.orange,
                        primaryColors.cyan,
                        primaryColors.teal,
                        primaryColors.emerald,
                        primaryColors.darkOrange
                    ];
                    const colorSet = colors[i % colors.length];
                    return createGradient(context, colorSet[0], colorSet[1]);
                });
            },
            borderColor: 'transparent',
            borderRadius: 8,
            borderSkipped: false
        }]
    } : null;

    // التوزيع حسب التفريعات - عدد المشاريع
    const subcategoryCountChartData = financialData.by_subcategory ? {
        labels: Object.keys(financialData.by_subcategory),
        datasets: [{
            label: 'عدد المشاريع',
            data: Object.values(financialData.by_subcategory).map(item => item.count || 0),
            backgroundColor: (context) => {
                const chart = context.chart;
                const { data: chartData, chartArea } = chart;
                if (!chartArea) return null;
                return chartData.labels.map((_, i) => {
                    const colors = [
                        primaryColors.darkBlue,
                        primaryColors.green,
                        primaryColors.purple,
                        primaryColors.orange,
                        primaryColors.cyan,
                        primaryColors.teal,
                        primaryColors.emerald,
                        primaryColors.darkOrange
                    ];
                    const colorSet = colors[i % colors.length];
                    return createGradient(context, colorSet[0], colorSet[1]);
                });
            },
            borderColor: 'transparent',
            borderRadius: 8,
            borderSkipped: false
        }]
    } : null;

    // Components
    const SkeletonLoader = () => (
        <div className="animate-pulse">
            <div className="h-80 bg-gradient-to-br from-gray-200 to-gray-100 rounded-xl"></div>
        </div>
    );

    const ChartCard = ({ title, children, isLoading, className = "", chartId, chartData, canToggleType = false }) => {
        const [isHovered, setIsHovered] = useState(false);
        const [isExpanded, setIsExpanded] = useState(false);

        return (
            <div
                className={ `bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 ${className} ${isExpanded ? 'col-span-full row-span-2' : ''}` }
                onMouseEnter={ () => setIsHovered(true) }
                onMouseLeave={ () => setIsHovered(false) }
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-800">{ title }</h3>
                    <div className="flex items-center gap-2">
                        { canToggleType && (
                            <button
                                onClick={ () => toggleChartType(chartId) }
                                className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                                title="تبديل نوع الرسم البياني"
                            >
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </button>
                        ) }
                        <button
                            onClick={ () => setIsExpanded(!isExpanded) }
                            className="p-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
                            title={ isExpanded ? "تصغير" : "توسيع" }
                        >
                            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d={ isExpanded ? "M6 18L18 6M6 6l12 12" : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" } />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className={ `${isExpanded ? 'h-96' : 'h-80'} transition-all duration-300` }>
                    { isLoading ? <SkeletonLoader /> : children }
                </div>
                { isHovered && !isLoading && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg animate-fadeIn">
                        <p className="text-xs text-gray-600">
                            💡 نصيحة: انقر على العناصر للحصول على تفاصيل أكثر
                        </p>
                    </div>
                ) }
            </div>
        );
    };

    if (loading && !financialData.total_in_usd) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
                <div className="bg-white rounded-2xl shadow-lg p-12">
                    <div className="flex flex-col justify-center items-center">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
                            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 absolute top-0"></div>
                        </div>
                        <p className="mt-6 text-gray-600 font-medium text-lg">جاري تحميل البيانات المالية...</p>
                        <p className="text-gray-400 text-sm mt-2">يرجى الانتظار</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !financialData.total_in_usd) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                    <div className="flex flex-col items-center gap-4">
                        <div className="bg-red-100 p-4 rounded-full">
                            <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-red-600 text-lg font-medium">{ error }</p>
                        <button
                            onClick={ loadFinancialData }
                            className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
                        >
                            إعادة المحاولة
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="financial-reports min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6" style={ { fontFamily: 'Cairo, Tajawal, Arial, sans-serif' } }>
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */ }
                <div className="page-header bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-xl shadow-lg">
                                <Wallet className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                    التقارير المالية الشاملة
                                </h1>
                                <p className="text-gray-500 text-sm mt-1">تحليل مالي شامل لجميع المشاريع والأنشطة</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={ refreshData }
                                disabled={ loading }
                                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                <RefreshCw className={ `w-5 h-5 ${loading ? 'animate-spin' : ''}` } />
                                <span className="font-semibold">تحديث</span>
                            </button>
                            <button
                                onClick={ handleExport }
                                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                <Download className="w-5 h-5" />
                                <span className="font-semibold">تصدير Excel</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */ }
                <div className="filters-panel bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg">
                                <Filter className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800">خيارات التصفية</h2>
                        </div>
                        { hasActiveFilters && (
                            <button
                                onClick={ clearFilters }
                                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center gap-2 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                مسح الفلاتر
                            </button>
                        ) }
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="filter-group">
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                من تاريخ
                            </label>
                            <input
                                type="date"
                                value={ filters.start_date }
                                onChange={ (e) => handleFilterChange('start_date', e.target.value) }
                                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition-colors"
                            />
                        </div>

                        <div className="filter-group">
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                إلى تاريخ
                            </label>
                            <input
                                type="date"
                                value={ filters.end_date }
                                onChange={ (e) => handleFilterChange('end_date', e.target.value) }
                                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition-colors"
                            />
                        </div>

                        <div className="filter-group">
                            <label className="block text-sm font-bold text-gray-700 mb-2">العملة</label>
                            <select
                                value={ filters.currency }
                                onChange={ (e) => handleFilterChange('currency', e.target.value) }
                                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition-colors"
                            >
                                <option value="">الكل</option>
                                <option value="USD">دولار أمريكي (USD)</option>
                                <option value="TRY">ليرة تركية (TRY)</option>
                                <option value="EUR">يورو (EUR)</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <label className="block text-sm font-bold text-gray-700 mb-2">نوع المشروع</label>
                            <select
                                value={ filters.project_type }
                                onChange={ (e) => handleFilterChange('project_type', e.target.value) }
                                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition-colors"
                                disabled={ projectTypesLoading }
                            >
                                <option value="">الكل</option>
                                { projectTypes.map((type, index) => (
                                    <option key={ index } value={ type }>{ type }</option>
                                )) }
                            </select>
                        </div>
                    </div>
                </div>

                {/* الإحصائيات المالية الرئيسية */ }
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                    {/* إجمالي المبالغ بالدولار */ }
                    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
                            <div className="flex items-center justify-between">
                                <DollarSign className="w-8 h-8 text-white" />
                                <ArrowUpRight className="w-6 h-6 text-white opacity-70" />
                            </div>
                        </div>
                        <div className="p-6">
                            <h3 className="text-sm font-medium text-gray-500 mb-2">إجمالي المبالغ (USD)</h3>
                            <p className="text-3xl font-bold text-blue-600" dir="ltr">
                                ${ (financialData.total_in_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
                            </p>
                            <p className="text-xs text-gray-400 mt-2">المبلغ الإجمالي قبل الخصم</p>
                        </div>
                    </div>

                    {/* الخصم الإداري */ }
                    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-red-600 p-4">
                            <div className="flex items-center justify-between">
                                <ArrowDownRight className="w-8 h-8 text-white" />
                                <span className="text-2xl font-bold text-white">
                                    { (financialData.admin_discount_percentage || 0).toFixed(1) }%
                                </span>
                            </div>
                        </div>
                        <div className="p-6">
                            <h3 className="text-sm font-medium text-gray-500 mb-2">الخصم الإداري</h3>
                            <p className="text-3xl font-bold text-orange-600" dir="ltr">
                                ${ (financialData.admin_discount_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                                نسبة الخصم: { (financialData.admin_discount_percentage || 0).toFixed(1) }%
                            </p>
                        </div>
                    </div>

                    {/* الصافي بعد الخصم */ }
                    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4">
                            <div className="flex items-center justify-between">
                                <Wallet className="w-8 h-8 text-white" />
                                <CheckCircle className="w-6 h-6 text-white opacity-70" />
                            </div>
                        </div>
                        <div className="p-6">
                            <h3 className="text-sm font-medium text-gray-500 mb-2">الصافي بعد الخصم (USD)</h3>
                            <p className="text-3xl font-bold text-green-600" dir="ltr">
                                ${ (financialData.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
                            </p>
                            <p className="text-xs text-gray-400 mt-2">المبلغ النهائي للمشاريع</p>
                        </div>
                    </div>
                </div>

                {/* إحصائيات إضافية */ }
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">

                    {/* عدد المشاريع */ }
                    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
                            <div className="flex items-center justify-between">
                                <BarChart3 className="w-8 h-8 text-white" />
                                <span className="text-2xl font-bold text-white">
                                    { (financialData.total_projects || 0).toLocaleString() }
                                </span>
                            </div>
                        </div>
                        <div className="p-6">
                            <h3 className="text-sm font-medium text-gray-500 mb-2">عدد المشاريع</h3>
                            <p className="text-3xl font-bold text-blue-600">
                                { (financialData.total_projects || 0).toLocaleString() }
                            </p>
                        </div>
                    </div>

                    {/* متوسط قيمة المشروع */ }
                    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-violet-600 p-4">
                            <div className="flex items-center justify-between">
                                <TrendingUp className="w-8 h-8 text-white" />
                                <Coins className="w-6 h-6 text-white opacity-70" />
                            </div>
                        </div>
                        <div className="p-6">
                            <h3 className="text-sm font-medium text-gray-500 mb-2">متوسط قيمة المشروع</h3>
                            <p className="text-3xl font-bold text-purple-600" dir="ltr">
                                ${ (financialData.average_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
                            </p>
                        </div>
                    </div>

                    {/* أعلى مبلغ */ }
                    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4">
                            <div className="flex items-center justify-between">
                                <ArrowUpRight className="w-8 h-8 text-white" />
                                <TrendingUp className="w-6 h-6 text-white opacity-70" />
                            </div>
                        </div>
                        <div className="p-6">
                            <h3 className="text-sm font-medium text-gray-500 mb-2">أعلى مبلغ</h3>
                            <p className="text-3xl font-bold text-amber-600" dir="ltr">
                                ${ (financialData.max_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
                            </p>
                        </div>
                    </div>
                </div>

                {/* الرسومات البيانية - Charts Grid */ }
                <div className={ `grid ${viewMode === 'grid' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-6 mb-6` }>
                    {/* التوزيع حسب العملة - Pie Chart */ }
                    { currencyChartData && (
                        <ChartCard
                            title="توزيع المبالغ حسب العملة"
                            isLoading={ loading }
                            chartData={ currencyChartData }
                        >
                            <Doughnut data={ currencyChartData } options={ pieChartOptions } />
                        </ChartCard>
                    ) }

                    {/* التوزيع حسب نوع المشروع - Bar/Line Chart */ }
                    { typeChartData && (
                        <ChartCard
                            title="توزيع المبالغ حسب نوع المشروع"
                            isLoading={ loading }
                            chartId="type"
                            chartData={ typeChartData }
                            canToggleType={ true }
                        >
                            { chartType['type'] === 'line' ? (
                                <Line data={ typeChartData } options={ lineChartOptions } />
                            ) : (
                                <Bar data={ typeChartData } options={ barChartOptions } />
                            ) }
                        </ChartCard>
                    ) }

                    {/* عدد المشاريع حسب النوع - Bar/Line Chart */ }
                    { typeProjectsCountChartData && (
                        <ChartCard
                            title="عدد المشاريع حسب النوع"
                            isLoading={ loading }
                            chartId="typeProjects"
                            chartData={ typeProjectsCountChartData }
                            canToggleType={ true }
                        >
                            { chartType['typeProjects'] === 'line' ? (
                                <Line data={ typeProjectsCountChartData } options={ lineChartOptions } />
                            ) : (
                                <Bar data={ typeProjectsCountChartData } options={ barChartOptions } />
                            ) }
                        </ChartCard>
                    ) }

                    {/* التوزيع حسب الحالة - Bar Chart */ }
                    { statusChartData && (
                        <ChartCard
                            title="توزيع المبالغ حسب حالة المشروع"
                            isLoading={ loading }
                            chartId="status"
                            chartData={ statusChartData }
                            canToggleType={ true }
                        >
                            { chartType['status'] === 'line' ? (
                                <Line data={ statusChartData } options={ lineChartOptions } />
                            ) : (
                                <Bar data={ statusChartData } options={ barChartOptions } />
                            ) }
                        </ChartCard>
                    ) }

                    {/* الاتجاه المالي الشهري - Line Chart */ }
                    { monthlyTrendChartData && (
                        <ChartCard
                            title="الاتجاه المالي الشهري - آخر 6 أشهر"
                            isLoading={ loading }
                            chartData={ monthlyTrendChartData }
                        >
                            <Line data={ monthlyTrendChartData } options={ lineChartOptions } />
                        </ChartCard>
                    ) }

                    {/* التوزيع حسب التفريعات - المبالغ */ }
                    { subcategoryAmountChartData && (
                        <ChartCard
                            title="توزيع المبالغ حسب التفريعات"
                            isLoading={ loading }
                            chartId="subcategoryAmount"
                            chartData={ subcategoryAmountChartData }
                            canToggleType={ true }
                        >
                            { chartType['subcategoryAmount'] === 'line' ? (
                                <Line data={ subcategoryAmountChartData } options={ lineChartOptions } />
                            ) : (
                                <Bar data={ subcategoryAmountChartData } options={ barChartOptions } />
                            ) }
                        </ChartCard>
                    ) }

                    {/* التوزيع حسب التفريعات - عدد المشاريع */ }
                    { subcategoryCountChartData && (
                        <ChartCard
                            title="عدد المشاريع حسب التفريعات"
                            isLoading={ loading }
                            chartId="subcategoryCount"
                            chartData={ subcategoryCountChartData }
                            canToggleType={ true }
                        >
                            { chartType['subcategoryCount'] === 'line' ? (
                                <Line data={ subcategoryCountChartData } options={ lineChartOptions } />
                            ) : (
                                <Bar data={ subcategoryCountChartData } options={ barChartOptions } />
                            ) }
                        </ChartCard>
                    ) }
                </div>
            </div>
        </div>
    );
};

export default FinancialReports;
