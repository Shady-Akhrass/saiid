import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../utils/axiosConfig';
import { getPhotographerName } from '../../utils/helpers';
import { toast } from 'react-toastify';
import {
  Video,
  Clock,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Camera,
  ArrowRight,
  AlertTriangle,
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  Bell,
  Eye,
} from 'lucide-react';

const MediaDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ready_for_montage: 0,
    in_montage: 0,
    delayed_montage: 0,
    approaching_delay: 0,
    completed: 0,
    average_montage_duration: 0,
    delay_percentage: 0,
    projects_by_type: {},
    recent_ready_projects: [],
    delayed_projects: [],
    approaching_delay_projects: [],
    remontage_projects: [], // ✅ المشاريع التي تحتاج إعادة مونتاج
    remontage_count: 0, // ✅ عدد المشاريع التي تحتاج إعادة مونتاج
  });

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);

      // ✅ استخدام الطريقة المباشرة: جلب المشاريع من API العادي
      // الباك إند يفلتر حسب role المستخدم تلقائياً (media_manager يرى حالات المونتاج فقط)
      // جلب عدد أكبر من المشاريع لضمان حساب دقيق للإحصائيات
      const response = await apiClient.get('/project-proposals', {
        params: {
          perPage: 100, // زيادة العدد لضمان جلب جميع المشاريع ذات الصلة
          page: 1
        },
        timeout: 30000 // timeout 30 ثانية (مطابق للإعداد الافتراضي)
      });

      // ✅ معالجة الاستجابة
      if (response && response.data) {
        // معالجة أشكال الاستجابة المختلفة
        let projects = [];

        if (response.data.projects && Array.isArray(response.data.projects)) {
          projects = response.data.projects;
        } else if (response.data.data && response.data.data.data && Array.isArray(response.data.data.data)) {
          projects = response.data.data.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          projects = response.data.data;
        } else if (Array.isArray(response.data)) {
          projects = response.data;
        }

        if (import.meta.env.DEV) {
          console.log('📊 Dashboard - Projects fetched:', {
            total: projects.length,
            responseKeys: Object.keys(response.data),
            hasProjects: !!response.data.projects,
            hasData: !!response.data.data,
            projectsIsArray: Array.isArray(projects)
          });
        }

        // ✅ فلترة حسب حالات المونتاج (بما في ذلك جميع الصيغ المحتملة لإعادة المونتاج)
        // ✅ الحالات: من "جاهز للتنفيذ" حتى "وصل للمتبرع"
        const montageStatuses = ['جاهز للتنفيذ', 'تم اختيار المخيم', 'قيد التنفيذ', 'منفذ', 'تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];
        projects = projects.filter(p => {
          if (!p || !p.status) return false;

          const normalizedStatus = p.status.trim();

          // ✅ التحقق من جميع الصيغ المحتملة للمشاريع التي تحتاج إعادة مونتاج
          if (normalizedStatus.includes('معاد') && normalizedStatus.includes('مونتاج')) return true;
          if (normalizedStatus.includes('إعادة') && normalizedStatus.includes('مونتاج')) return true;
          if (normalizedStatus.includes('اعادة') && normalizedStatus.includes('مونتاج')) return true;
          if (normalizedStatus.includes('يجب') && (normalizedStatus.includes('إعادة') || normalizedStatus.includes('اعادة') || normalizedStatus.includes('أعادة'))) return true;

          // التحقق من الحالات العادية
          if (montageStatuses.includes(normalizedStatus)) return true;

          // التحقق من الحالات التي تحتوي على كلمات مفتاحية
          // ✅ إظهار الحالات من "جاهز للتنفيذ" حتى "وصل للمتبرع"
          return normalizedStatus.includes('مونتاج') ||
            normalizedStatus.includes('منفذ') ||
            normalizedStatus.includes('تم التنفيذ') ||
            normalizedStatus.includes('قيد التنفيذ') ||
            normalizedStatus.includes('جاهز للتنفيذ') ||
            normalizedStatus.includes('تم اختيار المخيم') ||
            normalizedStatus.includes('وصل');
        });

        // ✅ Debug: في وضع التطوير، عرض عدد المشاريع التي تحتاج إعادة مونتاج
        if (import.meta.env.DEV) {
          const remontageCount = projects.filter(p => {
            const status = p.status?.trim() || '';
            return (status.includes('معاد') && status.includes('مونتاج')) ||
              (status.includes('إعادة') && status.includes('مونتاج')) ||
              (status.includes('اعادة') && status.includes('مونتاج')) ||
              (status.includes('يجب') && (status.includes('إعادة') || status.includes('اعادة') || status.includes('أعادة'))) ||
              status === 'معاد مونتاجه';
          }).length;
          console.log('📊 Dashboard - After filtering:', {
            totalProjects: projects.length,
            remontageCount: remontageCount,
            allStatuses: [...new Set(projects.map(p => p.status).filter(Boolean))]
          });
        }

        if (projects.length > 0) {
          calculateStatsFromProjects(projects);
        } else {
          // لا توجد مشاريع - عرض بيانات افتراضية
          if (import.meta.env.DEV) {
            console.log('⚠️ Dashboard - No projects found after filtering');
          }
          setStats({
            ready_for_montage: 0,
            in_montage: 0,
            delayed_montage: 0,
            approaching_delay: 0,
            completed: 0,
            average_montage_duration: 0,
            delay_percentage: 0,
            projects_by_type: {},
            recent_ready_projects: [],
            delayed_projects: [],
            approaching_delay_projects: [],
            remontage_projects: [],
            remontage_count: 0,
          });
        }
      } else {
        throw new Error('استجابة غير صحيحة من الخادم');
      }
    } catch (error) {
      // عرض بيانات افتراضية في حالة الخطأ
      setStats({
        ready_for_montage: 0,
        in_montage: 0,
        delayed_montage: 0,
        approaching_delay: 0,
        completed: 0,
        average_montage_duration: 0,
        delay_percentage: 0,
        projects_by_type: {},
        recent_ready_projects: [],
        delayed_projects: [],
        approaching_delay_projects: [],
        remontage_projects: [],
        remontage_count: 0,
      });

      // تسجيل الخطأ للتشخيص
      if (import.meta.env.DEV) {
        console.error('Dashboard fetch error:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          isConnectionError: error.isConnectionError,
          isTimeoutError: error.isTimeoutError
        });
      }

      // عرض رسالة خطأ فقط للأخطاء غير المتوقعة
      // لا نعرض رسالة عند timeout (سيتم إعادة المحاولة تلقائياً)
      if (!error.isConnectionError &&
        !error.isTimeoutError &&
        error.response?.status !== 404 &&
        error.response?.status !== 403) {
        toast.error(error.userMessage || 'فشل تحميل بيانات لوحة التحكم');
      } else if (error.isTimeoutError) {
        // عند timeout، نعرض رسالة خفيفة
        if (import.meta.env.DEV) {
          console.warn('⏱️ Dashboard request timeout - سيتم إعادة المحاولة عند تحديث الصفحة');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ✅ تحديث عنوان الصفحة (Tab Title) ديناميكياً
  useEffect(() => {
    document.title = 'لوحة التحكم - قسم الإعلام';
  }, []);


  const calculateStatsFromProjects = useCallback((projects) => {
    if (!Array.isArray(projects) || projects.length === 0) {
      return;
    }

    const now = new Date();
    const DAY_IN_MS = 1000 * 60 * 60 * 24;

    // فلترة المشاريع حسب حالة المونتاج (استخدام useMemo لتحسين الأداء)
    const readyForMontage = [];
    const inMontage = [];
    const completed = [];
    const delayedMontage = [];
    const approachingDelay = [];
    const remontageProjects = []; // ✅ المشاريع التي تحتاج إعادة مونتاج
    const projectsByType = {};

    // حلقة واحدة لفلترة وتجميع البيانات
    for (const p of projects) {
      let status = p.status;
      if (!status) continue;

      // ✅ تطبيع الحالة (إزالة المسافات الزائدة والتأكد من المطابقة)
      const normalizedStatus = status.trim();

      // ✅ التحقق من جميع الصيغ المحتملة للمشاريع التي تحتاج إعادة مونتاج
      // معالجة جميع الصيغ: "معاد مونتاجه", "يجب إعادة المونتاج", "لحب اعادة المونتاج", إلخ
      let isRemontage = false;
      if (normalizedStatus.includes('معاد') && normalizedStatus.includes('مونتاج')) {
        isRemontage = true;
        status = 'معاد مونتاجه'; // توحيد الحالة
      } else if (normalizedStatus.includes('إعادة') && normalizedStatus.includes('مونتاج')) {
        isRemontage = true;
        status = 'معاد مونتاجه';
      } else if (normalizedStatus.includes('اعادة') && normalizedStatus.includes('مونتاج')) {
        isRemontage = true;
        status = 'معاد مونتاجه';
      } else if (normalizedStatus.includes('يجب') && (normalizedStatus.includes('إعادة') || normalizedStatus.includes('اعادة') || normalizedStatus.includes('أعادة'))) {
        isRemontage = true;
        status = 'معاد مونتاجه';
      } else if (normalizedStatus === 'معاد مونتاجه') {
        isRemontage = true;
      }

      // ✅ Debug: في وضع التطوير، تسجيل المشاريع التي تحتاج إعادة مونتاج
      if (import.meta.env.DEV && isRemontage) {
        console.log('🔍 Dashboard - Project with remontage status:', {
          id: p.id,
          originalStatus: p.status,
          normalizedStatus: normalizedStatus,
          isRemontage: isRemontage
        });
      }

      // تجميع حسب النوع
      const type = p.project_type || 'غير محدد';
      projectsByType[type] = (projectsByType[type] || 0) + 1;

      // فلترة حسب الحالة
      if (isRemontage) {
        // ✅ إضافة المشاريع التي تحتاج إعادة مونتاج
        remontageProjects.push(p);
      } else if (normalizedStatus === 'تم التنفيذ' || normalizedStatus.includes('تم التنفيذ')) {
        readyForMontage.push(p);
      } else if (normalizedStatus === 'في المونتاج' || normalizedStatus.includes('في المونتاج')) {
        inMontage.push(p);
      }

      // ✅ حساب التأخير بناءً على نفس منطق لوحة الإدارة
      // نستخدم فقط البيانات من Backend (is_delayed) - نفس منطق لوحة الإدارة تماماً
      const isFinished = normalizedStatus === 'منتهي';

      if (!isFinished) {
        // ✅ استخدام فقط is_delayed من Backend (نفس منطق لوحة الإدارة)
        // Backend يحسب is_delayed بناءً على execution_date و remaining_days
        if (p.is_delayed === true) {
          // ✅ المشروع متأخر حسب Backend
          delayedMontage.push(p);
        }

        // ✅ حساب المشاريع التي تقترب من التأخير (للعرض فقط، لا تُحسب كمتأخرة)
        if (p.execution_date && !p.is_delayed) {
          const executionDate = new Date(p.execution_date);
          executionDate.setHours(0, 0, 0, 0);
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);

          const daysDiff = Math.floor((executionDate - today) / DAY_IN_MS);

          // ✅ المشاريع التي تقترب من التأخير (في الأيام الثلاثة القادمة أو اليوم)
          if (daysDiff >= 0 && daysDiff <= 3) {
            approachingDelay.push(p);
          }
        }
      }

      // ✅ إضافة المشاريع المكتملة
      if (normalizedStatus === 'تم المونتاج' ||
        normalizedStatus === 'وصل للمتبرع' ||
        normalizedStatus.includes('تم المونتاج') ||
        normalizedStatus.includes('وصل للمتبرع')) {
        completed.push(p);
      }
    }

    // حساب متوسط وقت المونتاج
    let averageDuration = 0;
    const completedWithDates = completed.filter(p => p.montage_start_date && p.montage_completed_date);
    if (completedWithDates.length > 0) {
      const totalDays = completedWithDates.reduce((sum, p) => {
        const start = new Date(p.montage_start_date);
        const end = new Date(p.montage_completed_date);
        return sum + Math.floor((end - start) / DAY_IN_MS);
      }, 0);
      averageDuration = totalDays / completedWithDates.length;
    }

    // حساب نسبة التأخير
    // ✅ قسم الإعلام مهمته تبدأ من "تم التنفيذ" فقط
    // ✅ نحسب فقط تأخير المونتاج (وليس تأخير التنفيذ) للمشاريع التي حالتها "تم التنفيذ"
    // ✅ منطق تأخير المونتاج: الأيام منذ استلام الميديا (execution_date) > 5 أيام
    const delayedFromReady = readyForMontage.filter(p => {
      // ✅ استثناء المشاريع المتأخرة قبل "تم التنفيذ" (تأخير التنفيذ)
      // ✅ نحسب فقط تأخير المونتاج بناءً على execution_date
      if (!p.execution_date) return false;

      const executionDate = new Date(p.execution_date);
      executionDate.setHours(0, 0, 0, 0);
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const daysSinceReceived = Math.floor((today - executionDate) / DAY_IN_MS);

      // ✅ المشروع متأخر في المونتاج إذا: الأيام منذ استلام الميديا > 5 أيام
      return daysSinceReceived > 5;
    });

    const totalActive = readyForMontage.length; // ✅ فقط المشاريع "تم التنفيذ"
    // ✅ نسبة التأخير = (عدد المشاريع المتأخرة في المونتاج من "تم التنفيذ" / إجمالي المشاريع "تم التنفيذ") × 100
    const delayPercentage = totalActive > 0 ? (delayedFromReady.length / totalActive) * 100 : 0;

    // آخر المشاريع الجاهزة للمونتاج (آخر 5)
    const sortedReady = readyForMontage
      .sort((a, b) => {
        const aDate = new Date(a.execution_date || a.created_at);
        const bDate = new Date(b.execution_date || b.created_at);
        return bDate - aDate;
      })
      .slice(0, 5);

    const recentReady = sortedReady.map(p => ({
      ...p,
      photographer_name: getPhotographerName(p) || null
    }));

    // المشاريع المتأخرة مع تفاصيل (نفس منطق لوحة الإدارة - استخدام Backend فقط)
    const delayedProjects = delayedMontage.map(p => {
      let daysLate = 0;

      // ✅ استخدام فقط delayed_days من Backend (نفس منطق لوحة الإدارة)
      if (p.delayed_days !== undefined && p.delayed_days !== null && p.delayed_days > 0) {
        daysLate = p.delayed_days;
      } else if (p.remaining_days !== undefined && p.remaining_days !== null && p.remaining_days < 0) {
        // ✅ إذا كان remaining_days سالب، المشروع متأخر
        daysLate = Math.abs(p.remaining_days);
      } else if (p.execution_date) {
        // ✅ Fallback: حساب محلياً فقط إذا لم تكن البيانات من Backend متاحة
        const executionDate = new Date(p.execution_date);
        executionDate.setHours(0, 0, 0, 0);
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today - executionDate) / DAY_IN_MS);
        daysLate = daysDiff > 0 ? daysDiff : 0;
      }

      return {
        id: p.id,
        serial_number: p.serial_number,
        project_name: p.project_name || p.project_description,
        donor_name: p.donor_name,
        days_late: daysLate,
        media_received_date: p.execution_date || p.created_at,
      };
    });

    // المشاريع التي تقترب من التأخير
    const approachingDelayProjects = approachingDelay.map(p => {
      let daysRemaining = 0;
      if (p.execution_date) {
        const executionDate = new Date(p.execution_date);
        executionDate.setHours(0, 0, 0, 0);
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((executionDate - today) / DAY_IN_MS);
        daysRemaining = daysDiff >= 0 ? daysDiff : 0;
      } else if (p.remaining_days !== undefined && p.remaining_days !== null) {
        // ✅ استخدام البيانات من Backend إذا كانت متاحة
        daysRemaining = p.remaining_days >= 0 ? p.remaining_days : 0;
      }
      return {
        id: p.id,
        serial_number: p.serial_number,
        project_name: p.project_name || p.project_description,
        donor_name: p.donor_name,
        days_remaining: daysRemaining,
        media_received_date: p.execution_date || p.created_at,
      };
    });

    // ✅ المشاريع التي تحتاج إعادة مونتاج مع تفاصيل
    const remontageProjectsList = remontageProjects.map(p => ({
      id: p.id,
      serial_number: p.serial_number || p.internal_code,
      project_name: p.project_name || p.project_description,
      donor_name: p.donor_name,
      donor_code: p.donor_code,
      internal_code: p.internal_code,
      execution_date: p.execution_date || p.created_at,
      assigned_producer: p.assigned_montage_producer?.name || p.montage_producer_name || 'غير محدد',
      rejection_reason: p.rejection_reason || p.media_rejection_reason || p.admin_rejection_reason || null,
    }));

    // ✅ Debug: في وضع التطوير، عرض الإحصائيات النهائية
    if (import.meta.env.DEV) {
      console.log('📊 Dashboard - Final stats calculated:', {
        remontage_count: remontageProjects.length,
        remontage_projects: remontageProjectsList.length,
        ready_for_montage: readyForMontage.length,
        in_montage: inMontage.length,
        completed: completed.length
      });
    }

    setStats({
      ready_for_montage: readyForMontage.length,
      in_montage: inMontage.length,
      delayed_montage: delayedMontage.length,
      approaching_delay: approachingDelay.length,
      completed: completed.length,
      average_montage_duration: averageDuration,
      delay_percentage: delayPercentage,
      projects_by_type: projectsByType,
      recent_ready_projects: recentReady,
      delayed_projects: delayedProjects,
      approaching_delay_projects: approachingDelayProjects,
      remontage_projects: remontageProjectsList, // ✅ إضافة المشاريع التي تحتاج إعادة مونتاج
      remontage_count: remontageProjects.length, // ✅ عدد المشاريع التي تحتاج إعادة مونتاج
    });
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'غير محدد';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">لوحة تحكم قسم الإعلام</h1>
            <p className="text-gray-600 mt-1">نظرة شاملة على مشاريع المونتاج</p>
          </div>
          <Link
            to="/media-management/projects"
            className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-6 py-3 rounded-xl font-medium flex items-center hover:shadow-lg transition-shadow"
          >
            عرض جميع المشاريع
            <ArrowRight className="w-5 h-5 mr-2" />
          </Link>
        </div>

        {/* Media Sections Cards */ }
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">أقسام الإعلام</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* لوحة التحكم */ }
            <Link
              to="/media-management/dashboard"
              className="group bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-6 border-2 border-sky-200 hover:border-sky-400 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="bg-sky-500 p-3 rounded-lg group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">لوحة التحكم</h3>
              </div>
              <p className="text-sm text-gray-600">نظرة شاملة على إحصائيات المونتاج</p>
            </Link>

            {/* المشاريع الجديدة */ }
            <Link
              to="/media-management/new-projects"
              className="group bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-200 hover:border-orange-400 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="bg-orange-500 p-3 rounded-lg group-hover:scale-110 transition-transform">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">المشاريع الجديدة</h3>
              </div>
              <p className="text-sm text-gray-600">المشاريع المسندة للباحث والتي تحتاج إسناد مصور</p>
            </Link>

            {/* المشاريع */ }
            <Link
              to="/media-management/projects"
              className="group bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="bg-purple-500 p-3 rounded-lg group-hover:scale-110 transition-transform">
                  <FolderKanban className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">المشاريع</h3>
              </div>
              <p className="text-sm text-gray-600">إدارة ومتابعة مشاريع المونتاج</p>
            </Link>

            {/* التقارير */ }
            <Link
              to="/media-management/reports"
              className="group bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200 hover:border-green-400 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="bg-green-500 p-3 rounded-lg group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">التقارير</h3>
              </div>
              <p className="text-sm text-gray-600">تقارير مفصلة عن أداء المونتاج</p>
            </Link>

            {/* الإشعارات */ }
            <Link
              to="/media-management/notifications"
              className="group bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border-2 border-amber-200 hover:border-amber-400 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="bg-amber-500 p-3 rounded-lg group-hover:scale-110 transition-transform">
                  <Bell className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">الإشعارات</h3>
              </div>
              <p className="text-sm text-gray-600">متابعة الإشعارات والتحديثات</p>
            </Link>
          </div>
        </div>

        {/* Stats Cards */ }
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* جاهزة للمونتاج */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <Video className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">جاهزة للمونتاج</h3>
            <p className="text-3xl font-bold text-gray-800">{ stats.ready_for_montage }</p>
          </div>

          {/* قيد المونتاج */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">قيد المونتاج</h3>
            <p className="text-3xl font-bold text-gray-800">{ stats.in_montage }</p>
          </div>

          {/* متأخرة */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">متأخرة</h3>
            <p className="text-3xl font-bold text-gray-800">{ stats.delayed_montage }</p>
          </div>

          {/* تقترب من التأخير */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">تقترب من التأخير</h3>
            <p className="text-3xl font-bold text-gray-800">{ stats.approaching_delay }</p>
          </div>

          {/* مكتملة */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">مكتملة</h3>
            <p className="text-3xl font-bold text-gray-800">{ stats.completed }</p>
          </div>

          {/* متوسط وقت المونتاج */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-indigo-500">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-indigo-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">متوسط وقت المونتاج</h3>
            <p className="text-3xl font-bold text-gray-800">{ isNaN(stats.average_montage_duration) ? 0 : stats.average_montage_duration.toFixed(1) }</p>
            <p className="text-xs text-gray-500 mt-1">يوم</p>
          </div>

          {/* المشاريع التي تحتاج إعادة مونتاج */ }
          <div className="bg-gradient-to-br from-red-50 to-white rounded-2xl p-6 shadow-lg border-l-4 border-red-600">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">يجب إعادة المونتاج</h3>
            <p className="text-3xl font-bold text-red-700">{ stats.remontage_count || 0 }</p>
            <p className="text-xs text-red-600 mt-1 font-semibold">مشروع</p>
          </div>
        </div>

        {/* Additional Stats */ }
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* نسبة التأخير */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">نسبة التأخير</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={ `h-4 rounded-full ${stats.delay_percentage > 20
                      ? 'bg-red-500'
                      : stats.delay_percentage > 10
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                      }` }
                    style={ { width: `${Math.min(isNaN(stats.delay_percentage) ? 0 : stats.delay_percentage, 100)}%` } }
                  ></div>
                </div>
              </div>
              <span className="text-2xl font-bold text-gray-800">{ isNaN(stats.delay_percentage) ? '0.0' : stats.delay_percentage.toFixed(1) }%</span>
            </div>
          </div>

          {/* المشاريع حسب النوع */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">المشاريع حسب النوع</h3>
            <div className="space-y-3">
              { Object.entries(stats.projects_by_type).map(([type, count]) => (
                <div key={ type } className="flex items-center justify-between">
                  <span className="text-gray-700">{ type }</span>
                  <span className="text-lg font-bold text-gray-800">{ count }</span>
                </div>
              )) }
              { Object.keys(stats.projects_by_type).length === 0 && (
                <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>
              ) }
            </div>
          </div>
        </div>

        {/* Recent Ready Projects */ }
        { stats.recent_ready_projects.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">آخر المشاريع الجاهزة للمونتاج</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">كود المشروع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">كود المتبرع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">اسم المشروع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">المتبرع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">تاريخ التنفيذ</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">المصور</th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  { stats.recent_ready_projects.map((project) => (
                    <tr
                      key={ project.id }
                      className={ `border-b border-gray-100 hover:bg-gray-50 transition-colors ${project.status === 'معاد مونتاجه'
                        ? 'bg-gradient-to-r from-red-50 to-white border-l-4 border-red-500'
                        : ''
                        }` }
                    >
                      <td className="py-4 px-6 text-sm font-medium text-gray-800">{ project.internal_code }</td>
                      <td className="py-4 px-6 text-sm font-medium text-gray-800">{ project.donor_code }</td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{ project.project_name }</span>
                          { project.status === 'معاد مونتاجه' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white border border-red-700 animate-pulse">
                              <AlertCircle className="w-3 h-3" />
                              يجب إعادة المونتاج
                            </span>
                          ) }
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ project.donor_name }</td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ formatDate(project.execution_date) }</td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        { project.photographer_name || getPhotographerName(project) || 'غير محدد' }
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Link
                          to={ `/media-management/projects/${project.id}` }
                          className="text-sky-600 hover:text-sky-700 font-medium"
                        >
                          عرض التفاصيل
                        </Link>
                      </td>
                    </tr>
                  )) }
                </tbody>
              </table>
            </div>
          </div>
        ) }

        {/* Delayed Projects */ }
        { stats.delayed_projects.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-red-200">
            <div className="p-6 border-b border-red-200 bg-red-50">
              <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
                <AlertCircle className="w-6 h-6" />
                المشاريع المتأخرة
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-red-50">
                  <tr>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-700">رقم التسلسل</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-700">اسم المشروع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-700">المتبرع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-700">أيام التأخير</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-700">تاريخ استلام الميديا</th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-red-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  { stats.delayed_projects.map((project) => (
                    <tr key={ project.id } className="border-b border-red-100 hover:bg-red-50">
                      <td className="py-4 px-6 text-sm font-medium text-gray-800">{ project.serial_number }</td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ project.project_name }</td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ project.donor_name }</td>
                      <td className="py-4 px-6 text-sm font-bold text-red-600">{ project.days_late } يوم</td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ formatDate(project.media_received_date) }</td>
                      <td className="py-4 px-6 text-center">
                        <Link
                          to={ `/media-management/projects/${project.id}` }
                          className="text-red-600 hover:text-red-700 font-medium"
                        >
                          تحديث الحالة
                        </Link>
                      </td>
                    </tr>
                  )) }
                </tbody>
              </table>
            </div>
          </div>
        ) }

        {/* Approaching Delay Projects */ }
        { stats.approaching_delay_projects.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-amber-200">
            <div className="p-6 border-b border-amber-200 bg-amber-50">
              <h2 className="text-xl font-bold text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                المشاريع التي تقترب من التأخير
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-amber-50">
                  <tr>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-amber-700">رقم التسلسل</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-amber-700">اسم المشروع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-amber-700">المتبرع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-amber-700">الأيام المتبقية</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-amber-700">تاريخ استلام الميديا</th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-amber-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  { stats.approaching_delay_projects.map((project) => (
                    <tr key={ project.id } className="border-b border-amber-100 hover:bg-amber-50">
                      <td className="py-4 px-6 text-sm font-medium text-gray-800">{ project.serial_number }</td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ project.project_name }</td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ project.donor_name }</td>
                      <td className="py-4 px-6 text-sm font-medium">
                        { project.status === 'منتهي' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                            ✓ منتهي
                          </span>
                        ) : project.remaining_days !== null && project.remaining_days !== undefined ? (
                          project.is_delayed ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                              ⚠️ متأخر بـ { project.delayed_days } يوم
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                              { project.remaining_days } يوم متبقي
                            </span>
                          )
                        ) : project.days_remaining !== undefined ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                            { project.days_remaining } يوم
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        ) }
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ formatDate(project.media_received_date) }</td>
                      <td className="py-4 px-6 text-center">
                        <Link
                          to={ `/media-management/projects/${project.id}` }
                          className="text-amber-600 hover:text-amber-700 font-medium"
                        >
                          تحديث الحالة
                        </Link>
                      </td>
                    </tr>
                  )) }
                </tbody>
              </table>
            </div>
          </div>
        ) }

        {/* ✅ المشاريع التي تحتاج إعادة مونتاج */ }
        { stats.remontage_projects && stats.remontage_projects.length > 0 && (
          <div className="bg-gradient-to-br from-red-50 to-white rounded-2xl shadow-lg overflow-hidden border-2 border-red-500">
            <div className="p-6 border-b border-red-300 bg-gradient-to-r from-red-100 to-red-50">
              <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-600" />
                ⚠️ المشاريع التي يجب إعادة المونتاج
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-600 text-white border-2 border-red-700 shadow-md">
                  { stats.remontage_count }
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-red-100 to-red-50">
                  <tr>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-800">كود المشروع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-800">كود المتبرع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-800">اسم المشروع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-800">المتبرع</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-800">ممنتج</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-800">سبب الرفض</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-red-800">تاريخ التنفيذ</th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-red-800">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  { stats.remontage_projects.map((project) => (
                    <tr
                      key={ project.id }
                      className="border-b border-red-100 hover:bg-red-50 bg-gradient-to-r from-red-50/50 to-white transition-colors"
                    >
                      <td className="py-4 px-6 text-sm font-bold text-gray-800">{ project.serial_number || project.internal_code || '---' }</td>
                      <td className="py-4 px-6 text-sm font-medium text-gray-800">{ project.donor_code || '---' }</td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <span>{ project.project_name || '---' }</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white border border-red-700 animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            يجب إعادة المونتاج
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ project.donor_name || '---' }</td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ project.assigned_producer || '---' }</td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        { project.rejection_reason ? (
                          <div className="max-w-md">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                { project.rejection_reason }
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">لا يوجد سبب محدد</span>
                        ) }
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">{ formatDate(project.execution_date) }</td>
                      <td className="py-4 px-6 text-center">
                        <Link
                          to={ `/media-management/projects/${project.id}` }
                          className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-md hover:shadow-lg"
                        >
                          <Eye className="w-4 h-4" />
                          عرض التفاصيل
                        </Link>
                      </td>
                    </tr>
                  )) }
                </tbody>
              </table>
            </div>
          </div>
        ) }
      </div>
    </div>
  );
};

export default MediaDashboard;

