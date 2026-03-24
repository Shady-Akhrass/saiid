import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../../utils/axiosConfig';
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

const Dashboard = () => {
    const [data, setData] = useState({
        motherStatusData: [],
        deathCauseData: [],
        addressData: [],
        ageGroupData: [],
        motherDeceasedData: [],
        genderData: [],
        totalOrphans: 0,
        totalVisitors: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [selectedChart, setSelectedChart] = useState(null);
    const [viewMode, setViewMode] = useState('grid'); // grid or list
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [expandedCard, setExpandedCard] = useState(null);
    const [animatedValues, setAnimatedValues] = useState({
        totalOrphans: 0,
        totalVisitors: 0
    });
    const [notifications, setNotifications] = useState([]);
    const [chartType, setChartType] = useState({});
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30000);

    const chartRef = useRef(null);

    // Auto-refresh functionality
    useEffect(() => {
        let interval;
        if (autoRefresh) {
            interval = setInterval(() => {
                fetchDashboardData(true);
                showNotification('تم تحديث البيانات تلقائياً', 'success');
            }, refreshInterval);
        }
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval]);

    // Animated counter effect
    useEffect(() => {
        const animateValue = (start, end, duration, key) => {
            const startTime = Date.now();
            const updateValue = () => {
                const currentTime = Date.now();
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const currentValue = Math.floor(start + (end - start) * progress);
                
                setAnimatedValues(prev => ({
                    ...prev,
                    [key]: currentValue
                }));

                if (progress < 1) {
                    requestAnimationFrame(updateValue);
                }
            };
            updateValue();
        };

        animateValue(0, data.totalOrphans, 2000, 'totalOrphans');
        animateValue(0, data.totalVisitors, 2000, 'totalVisitors');
    }, [data.totalOrphans, data.totalVisitors]);

    const fetchDashboardData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        setIsRefreshing(true);
        try {
            const response = await apiClient.get('/orphans/dashboard');

            const {
                motherStatusCounts,
                deathCauseCounts,
                originalAddressCounts,
                ageGroups,
                motherDeceasedCounts,
                genderCounts,
                totalOrphans,
                totalVisitors
            } = response.data || {};

            setData({
                motherStatusData: Object.entries(motherStatusCounts || {}),
                deathCauseData: Object.entries(deathCauseCounts || {}),
                addressData: Object.entries(originalAddressCounts || {}),
                ageGroupData: Object.entries(ageGroups || {}),
                motherDeceasedData: Object.entries(motherDeceasedCounts || {}),
                genderData: Object.entries(genderCounts || {}),
                totalOrphans: totalOrphans || 0,
                totalVisitors: totalVisitors || 0,
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            
            // Handle database schema errors
            if (error.isDatabaseError || 
                error.response?.data?.message?.includes('api_token') ||
                error.response?.data?.message?.includes('Column not found')) {
                console.error('Database schema error: api_token column not found. Please check backend configuration.');
                // Don't show notification for database schema errors
                return;
            }
            
            // Handle different error types
            if (error.response) {
                // Server responded with error status
                const status = error.response.status;
                if (status === 401) {
                    // Unauthorized - don't show notification to avoid spam
                    console.warn('Unauthorized access - token may be invalid');
                } else if (status === 500) {
                    const errorMessage = error.response.data?.message || '';
                    if (!errorMessage.includes('api_token') && !errorMessage.includes('Column not found')) {
                        showNotification('خطأ في الخادم. يرجى المحاولة لاحقاً', 'error');
                    }
                } else {
                    showNotification('خطأ في تحميل البيانات', 'error');
                }
            } else if (error.request) {
                // Request was made but no response received
                showNotification('لا يمكن الاتصال بالخادم', 'error');
            } else {
                // Something else happened
                showNotification('حدث خطأ غير متوقع', 'error');
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const showNotification = (message, type = 'info') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 3000);
    };

    const handleExportData = (chartData, filename) => {
        const csvContent = "data:text/csv;charset=utf-8," 
            + chartData.labels.map((label, index) => 
                `${label},${chartData.datasets[0].data[index]}`
            ).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('تم تصدير البيانات بنجاح', 'success');
    };

    const handleChartClick = (chartName, chartData) => {
        setSelectedChart({ name: chartName, data: chartData });
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
        if (!chartArea) {
            return color1;
        }
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    };

    // Color schemes
    const primaryColors = {
        lightBlue: ['#60A5FA', '#93C5FD', '#DBEAFE'],
        darkBlue: ['#3B82F6', '#2563EB', '#1D4ED8'],
        orange: ['#FB923C', '#FDBA74', '#FED7AA'],
        darkOrange: ['#F97316', '#EA580C', '#DC2626'],
        neutral: ['#E5E7EB', '#D1D5DB', '#9CA3AF'],
        success: ['#34D399', '#10B981', '#059669'],
        purple: ['#A78BFA', '#8B5CF6', '#7C3AED']
    };

    const genderColors = {
        'أنثى': ['#FB923C', '#FDBA74'],
        'ذكر': ['#60A5FA', '#93C5FD']
    };

    const generateChartData = (label, data, colorFunction, chartType = 'bar') => ({
        labels: data.map(([key]) => key.toString()),
        datasets: [{
            label,
            data: data.map(([, count]) => Number(count) || 0),
            backgroundColor: (context) => {
                const chart = context.chart;
                const { ctx, data, chartArea } = chart;
                if (!chartArea) {
                    return null;
                }
                if (chartType === 'pie' || chartType === 'doughnut') {
                    return data.labels.map((label, i) => {
                        if (typeof colorFunction === 'object' && colorFunction[label]) {
                            return colorFunction[label][0];
                        }
                        return colorFunction(i)[0];
                    });
                }
                if (typeof colorFunction === 'object') {
                    return data.labels.map(label => createGradient(context, colorFunction[label][0], colorFunction[label][1]));
                }
                return data.datasets[0].data.map((_, i) =>
                    createGradient(context, colorFunction(i)[0], colorFunction(i)[1])
                );
            },
            borderColor: chartType === 'pie' || chartType === 'doughnut' ? '#ffffff' : 'transparent',
            borderWidth: chartType === 'pie' || chartType === 'doughnut' ? 3 : 0,
            borderRadius: chartType === 'bar' ? 8 : 0,
            borderSkipped: false,
            hoverBackgroundColor: (context) => {
                if (typeof colorFunction === 'object') {
                    return data.labels.map(label => colorFunction[label] ? colorFunction[label][1] : '#60A5FA');
                }
                return data.data.map((_, i) => colorFunction(i)[1]);
            },
            hoverBorderColor: '#ffffff',
            hoverBorderWidth: 3,
            tension: 0.4,
            fill: chartType === 'line'
        }],
    });

    const pieChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                showNotification(`تم النقر على: ${event.chart.data.labels[index]}`, 'info');
            }
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 15,
                    font: {
                        size: 12,
                        family: 'Segoe UI, Tahoma, sans-serif'
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
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: ${value} (${percentage}%)`;
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
        onClick: (event, elements) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                showNotification(`تم النقر على: ${event.chart.data.labels[index]}`, 'info');
            }
        },
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
                    label: function(context) {
                        return `العدد: ${context.parsed.y}`;
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
                        family: 'Segoe UI, Tahoma, sans-serif'
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
                        family: 'Segoe UI, Tahoma, sans-serif'
                    },
                    color: '#6B7280',
                    padding: 8
                }
            }
        },
        animation: {
            duration: 1500,
            easing: 'easeInOutQuart'
        }
    };

    // Color functions
    const motherStatusColors = (i) => {
        const colors = [primaryColors.lightBlue, primaryColors.orange, primaryColors.purple, primaryColors.success];
        return colors[i % colors.length];
    };
    
    const deathCauseColors = (i) => {
        const colors = [primaryColors.darkBlue, primaryColors.darkOrange, primaryColors.purple];
        return colors[i % colors.length];
    };
    
    const addressColors = (i) => [`#60A5FA`, `#93C5FD`];
    const ageGroupColors = (i) => {
        const colors = [primaryColors.orange, primaryColors.lightBlue, primaryColors.success, primaryColors.purple];
        return colors[i % colors.length];
    };
    const motherDeceasedColors = (i) => i === 0 ? primaryColors.orange : primaryColors.lightBlue;

    const motherStatusChartData = generateChartData('عدد الأيتام حسب حالة الأم', data.motherStatusData, motherStatusColors, 'doughnut');
    const deathCauseChartData = generateChartData('عدد الأيتام حسب سبب وفاة الأب', data.deathCauseData, deathCauseColors, chartType['death'] || 'bar');
    const addressChartData = generateChartData('عدد الأيتام حسب العنوان الأصلي', data.addressData, addressColors, chartType['address'] || 'bar');
    const ageGroupChartData = generateChartData('عدد الأيتام حسب الفئة العمرية', data.ageGroupData, ageGroupColors, chartType['age'] || 'bar');
    const motherDeceasedChartData = generateChartData('عدد الأيتام حسب حالة الأم المتوفاة', data.motherDeceasedData, motherDeceasedColors, 'doughnut');
    const genderChartData = generateChartData('عدد الأيتام حسب جنس اليتيم', data.genderData, genderColors, chartType['gender'] || 'bar');

    // Components
    const SkeletonLoader = () => (
        <div className="animate-pulse">
            <div className="h-64 bg-gradient-to-br from-gray-200 to-gray-100 rounded-xl"></div>
        </div>
    );

    const StatCard = ({ title, value, icon, gradient, isLoading, onClick }) => {
        const [isHovered, setIsHovered] = useState(false);
        
        return (
            <div 
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`relative overflow-hidden bg-gradient-to-br ${gradient} rounded-2xl shadow-xl p-8 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer`}
            >
                <div className={`absolute top-0 right-0 -mt-4 -mr-4 transition-all duration-500 ${isHovered ? 'rotate-12 scale-110' : ''} opacity-10`}>
                    <div className="text-9xl">{icon}</div>
                </div>
                <div className="relative z-10">
                    <h2 className="text-white text-lg font-medium mb-3 opacity-90">{title}</h2>
                    {isLoading ? (
                        <div className="h-12 w-32 bg-white/30 animate-pulse rounded-lg"></div>
                    ) : (
                        <div className="flex items-baseline gap-2">
                            <p className="text-5xl font-bold text-white animate-fadeIn">
                                {value.toLocaleString('en-US')}
                            </p>
                            {isHovered && (
                                <span className="text-white/70 text-sm animate-slideIn">
                                    نقرة للتفاصيل
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-white/20 transition-all duration-300 ${isHovered ? 'h-2' : ''}`}></div>
            </div>
        );
    };

    const ChartCard = ({ title, children, isLoading, className = "", chartId, chartData, canToggleType = false }) => {
        const [isHovered, setIsHovered] = useState(false);
        const [isExpanded, setIsExpanded] = useState(false);

        return (
            <div 
                className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 ${className} ${isExpanded ? 'col-span-full row-span-2' : ''}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                    <div className="flex items-center gap-2">
                        {canToggleType && (
                            <button
                                onClick={() => toggleChartType(chartId)}
                                className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                                title="تبديل نوع الرسم البياني"
                            >
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </button>
                        )}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
                            title={isExpanded ? "تصغير" : "توسيع"}
                        >
                            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M6 18L18 6M6 6l12 12" : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"} />
                            </svg>
                        </button>
                        <button
                            onClick={() => handleExportData(chartData, title)}
                            className="p-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
                            title="تصدير البيانات"
                        >
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className={`${isExpanded ? 'h-96' : 'h-80'} transition-all duration-300`}>
                    {isLoading ? <SkeletonLoader /> : children}
                </div>
                {isHovered && !isLoading && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg animate-fadeIn">
                        <p className="text-xs text-gray-600">
                            💡 نصيحة: انقر على العناصر للحصول على تفاصيل أكثر
                        </p>
                    </div>
                )}
            </div>
        );
    };

    const NotificationContainer = () => (
        <div className="fixed top-4 left-4 z-50 space-y-2">
            {notifications.map(notification => (
                <div
                    key={notification.id}
                    className={`
                        animate-slideIn p-4 rounded-lg shadow-lg text-white
                        ${notification.type === 'success' ? 'bg-green-500' : ''}
                        ${notification.type === 'error' ? 'bg-red-500' : ''}
                        ${notification.type === 'info' ? 'bg-blue-500' : ''}
                    `}
                >
                    {notification.message}
                </div>
            ))}
        </div>
    );

    const FilterBar = () => (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                    <input
                        type="text"
                        placeholder="🔍 البحث في البيانات..."
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <select 
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                >
                    <option value="all">كل الفترات</option>
                    <option value="month">آخر شهر</option>
                    <option value="quarter">آخر 3 أشهر</option>
                    <option value="year">آخر سنة</option>
                </select>

                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">التحديث التلقائي</label>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${autoRefresh ? 'bg-blue-500' : 'bg-gray-300'}`}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${autoRefresh ? 'translate-x-6' : ''}`}></div>
                    </button>
                </div>

                <button
                    onClick={() => fetchDashboardData()}
                    disabled={isRefreshing}
                    className={`px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isRefreshing ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            جاري التحديث...
                        </span>
                    ) : (
                        'تحديث البيانات'
                    )}
                </button>

                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 ${isDarkMode ? 'dark' : ''}`} dir="rtl">
            <NotificationContainer />
            
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Header */}
                <div className="text-center mb-12 animate-fadeIn">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent mb-4">
                        لوحة معلومات الأيتام
                    </h1>
                    <p className="text-gray-600 text-lg">نظرة شاملة على إحصائيات وبيانات الأيتام</p>
                </div>

                {/* Filter Bar */}
                <FilterBar />

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    <StatCard
                        title="إجمالي الأيتام"
                        value={animatedValues.totalOrphans}
                        icon="👦"
                        gradient="from-blue-400 to-blue-600"
                        isLoading={isLoading}
                        onClick={() => showNotification(`إجمالي الأيتام: ${data.totalOrphans}`, 'info')}
                    />
                    <StatCard
                        title="إجمالي الزوار"
                        value={animatedValues.totalVisitors}
                        icon="👥"
                        gradient="from-orange-400 to-orange-600"
                        isLoading={isLoading}
                        onClick={() => showNotification(`إجمالي الزوار: ${data.totalVisitors}`, 'info')}
                    />
                </div>

                {/* Charts Grid */}
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'} gap-6`}>
                    <ChartCard 
                        title="توزيع حسب الجنس" 
                        isLoading={isLoading}
                        chartId="gender"
                        chartData={genderChartData}
                        canToggleType={true}
                    >
                        {chartType['gender'] === 'line' ? (
                            <Line data={genderChartData} options={barChartOptions} />
                        ) : (
                            <Bar data={genderChartData} options={barChartOptions} />
                        )}
                    </ChartCard>

                    <ChartCard 
                        title="توزيع حسب العنوان الأصلي" 
                        isLoading={isLoading}
                        chartId="address"
                        chartData={addressChartData}
                        canToggleType={true}
                    >
                        {chartType['address'] === 'line' ? (
                            <Line data={addressChartData} options={barChartOptions} />
                        ) : (
                            <Bar data={addressChartData} options={barChartOptions} />
                        )}
                    </ChartCard>

                    <ChartCard 
                        title="توزيع حسب الفئة العمرية" 
                        isLoading={isLoading}
                        chartId="age"
                        chartData={ageGroupChartData}
                        canToggleType={true}
                    >
                        {chartType['age'] === 'line' ? (
                            <Line data={ageGroupChartData} options={barChartOptions} />
                        ) : (
                            <Bar data={ageGroupChartData} options={barChartOptions} />
                        )}
                    </ChartCard>

                    <ChartCard 
                        title="أسباب وفاة الأب" 
                        isLoading={isLoading}
                        chartId="death"
                        chartData={deathCauseChartData}
                        canToggleType={true}
                    >
                        {chartType['death'] === 'line' ? (
                            <Line data={deathCauseChartData} options={barChartOptions} />
                        ) : (
                            <Bar data={deathCauseChartData} options={barChartOptions} />
                        )}
                    </ChartCard>

                    <ChartCard 
                        title="حالة الأم المتوفاة" 
                        isLoading={isLoading}
                        chartData={motherDeceasedChartData}
                    >
                        <Doughnut data={motherDeceasedChartData} options={pieChartOptions} />
                    </ChartCard>

                    <ChartCard 
                        title="حالة الأم" 
                        isLoading={isLoading}
                        chartData={motherStatusChartData}
                    >
                        <Doughnut data={motherStatusChartData} options={pieChartOptions} />
                    </ChartCard>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center text-gray-500 text-sm">
                    <p>آخر تحديث: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}</p>
                    {autoRefresh && (
                        <p className="mt-2 text-blue-500">التحديث التلقائي مفعل (كل {refreshInterval / 1000} ثانية)</p>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideIn {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }
                
                .animate-fadeIn {
                    animation: fadeIn 0.5s ease-in;
                }
                
                .animate-slideIn {
                    animation: slideIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default Dashboard;