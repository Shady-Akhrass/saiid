import React from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertCircle, Clock, CheckCircle2 
} from 'lucide-react';

// ✅ دالة لتنسيق المبلغ بالدولار
export const formatCurrency = (amount) => {
  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount === 0) return '---';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericAmount);
};

// ✅ دالة لتنسيق التاريخ بصيغة: 11/10/2025
export const formatDate = (date) => {
  if (!date) return 'غير محدد';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// ✅ دالة للحصول على وصق المشروع
export const getProjectDescription = (project) => {
  const description = project?.project_description || project?.description || project?.title;
  return description?.trim() || '----';
};

// ✅ دالة للحصول على لون الخط حسب نوع التقسيم
export const getDivisionTextColor = (project) => {
  if (!project?.is_divided_into_phases) return 'text-gray-800';

  const hasMonthlyFlag = project.phase_type === 'monthly' ||
    project.is_monthly_phase === true ||
    project.isMonthlyPhase === true;
  const hasDailyFlag = project.phase_type === 'daily' ||
    project.is_daily_phase === true ||
    project.isDailyPhase === true;
  const hasTotalMonths = !!(project.total_months || project.parent_project?.total_months);

  const isMonthly = hasMonthlyFlag || (!hasDailyFlag && hasTotalMonths);

  if (isMonthly) {
    return 'text-purple-600 font-semibold';
  } else if (hasDailyFlag || project.phase_duration_days || project.parent_project?.phase_duration_days) {
    return 'text-blue-600 font-semibold';
  }

  return 'text-gray-800';
};

// ✅ دالة لعرض الأوسمة (Badges) للمشروع
export const renderProjectBadges = (project) => {
  const badges = [];

  const isUrgentBadge = project?.is_urgent === true ||
    project?.is_urgent === 1 ||
    project?.is_urgent === '1' ||
    project?.is_urgent === 'true' ||
    String(project?.is_urgent || '').toLowerCase() === 'true' ||
    Boolean(project?.is_urgent);

  if (project?.is_daily_phase || project?.isDailyPhase) {
    badges.push(
      <span key="daily" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100" title="مرحلة يومية">
        مرحلة يومية
      </span>
    );
    if (project?.phase_day != null || project?.phaseDay != null) {
      badges.push(
        <span key="phase-day" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
          اليوم {project.phase_day ?? project.phaseDay}
        </span>
      );
    }
  } else if (project?.is_monthly_phase || project?.isMonthlyPhase) {
    badges.push(
      <span key="monthly-phase" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100" title="مرحلة شهرية">
        مرحلة شهرية
      </span>
    );
    if (project?.month_number != null || project?.monthNumber != null) {
      badges.push(
        <span key="month-num" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          الشهر {project.month_number ?? project.monthNumber}
        </span>
      );
    }
  } else if (project?.is_divided_into_phases) {
    const isMonthly =
      project.phase_type === 'monthly' ||
      project.is_monthly_phase === true ||
      (project.total_months && !project.phase_duration_days);

    if (isMonthly) {
      badges.push(
        <span key="monthly" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
          {project.total_months || project.parent_project?.total_months || '--'} شهر
        </span>
      );
    } else if (project.phase_duration_days || project.parent_project?.phase_duration_days) {
      badges.push(
        <span key="days" className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
          يوم {project.phase_duration_days || project.parent_project?.phase_duration_days}
        </span>
      );
    }
  }

  return badges.length > 0 ? <div className="flex flex-wrap gap-2 mt-2">{badges}</div> : null;
};

// ✅ اسم المشروع الأصلي للفرعية
export const getSubProjectParentName = (project) => {
  if (!project) return null;
  const parent = project.parent_project || project.parentProject || project.__parentProject;
  const name = parent?.project_name || parent?.name;
  if (name) return name;
  const parentId = project.parent_project_id ?? project.parentProjectId ?? parent?.id;
  return parentId ? `المشروع الأصلي #${parentId}` : null;
};

// ✅ اسم الفريق المكلف
export const getAssignedTeamName = (project) => {
  return (
    project?.assigned_team?.team_name ||
    project?.assignedTeam?.team_name ||
    project?.assigned_to_team?.team_name ||
    project?.team?.team_name ||
    project?.team_name ||
    project?.assigned_team_name ||
    project?.teamLabel ||
    project?.team_label ||
    '-'
  );
};

// ✅ دالة للحصول على Badge الأيام المتبقية
export const getRemainingDaysBadge = (project) => {
  const status = (project?.status || '').trim();

  if (status === 'منتهي' || status === 'وصل للمتبرع') {
    const label = status === 'منتهي' ? 'منتهي' : 'وصل للمتبرع';
    return {
      element: (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
          ✓ {label}
        </span>
      ),
      isOverdue: false,
      isFinished: true,
    };
  }

  if (project.remaining_days === null || project.remaining_days === undefined) {
    if (status === 'ملغى') {
      return {
        element: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 border border-gray-300">
            ملغى
          </span>
        ),
        isOverdue: false,
        isFinished: true,
      };
    }
    return {
      element: (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          مكتمل
        </span>
      ),
      isOverdue: false,
      isFinished: true,
    };
  }

  const remaining = Number(project.remaining_days);
  if (!Number.isNaN(remaining) && remaining < 2) {
    const fromApi = project.delayed_days ?? project.delayedDays;
    const computed = Math.max(0, 2 - remaining);
    const raw = (fromApi != null && fromApi > 0) ? fromApi : computed;
    const delayedDays = Math.max(1, raw);
    return {
      element: (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
          ⚠️ متأخر بـ {delayedDays} يوم
        </span>
      ),
      isOverdue: true,
      isFinished: false,
    };
  }

  return {
    element: (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
        {project.remaining_days} يوم متبقي
      </span>
    ),
    isOverdue: false,
    isFinished: false,
  };
};

// ✅ تنسيق المبلغ الأصلي
export const formatOriginalAmount = (project, currencyCode) => {
  const parentProject = project?.parent_project || project?.parentProject;
  const amount =
    project?.donation_amount ||
    project?.amount ||
    project?.original_amount ||
    project?.total_amount ||
    parentProject?.donation_amount ||
    parentProject?.amount ||
    parentProject?.original_amount ||
    parentProject?.total_amount ||
    null;

  if (amount === null || amount === undefined || amount === '' || Number.isNaN(Number(amount)) || Number(amount) === 0) {
    return '---';
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount));

  const currencySymbol =
    currencyCode ||
    project?.currency?.currency_symbol ||
    project?.currency?.currency_code ||
    project?.currency_code ||
    parentProject?.currency?.currency_symbol ||
    parentProject?.currency?.currency_code ||
    parentProject?.currency_code ||
    '';

  return `${formatted} ${currencySymbol}`.trim();
};

// ✅ إمكانية تعديل الإسناد
export const canEditAssignment = (project) => {
  const restrictedStatuses = ['منتهي'];
  return !restrictedStatuses.includes(project?.status);
};

// ✅ إمكانية تأجيل المشروع
export const canPostponeProject = (project) => {
  const status = project?.status;
  const postponedStatuses = ['مؤجل'];
  const executionStatuses = ['قيد التنفيذ', 'تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'وصل للمتبرع'];

  if (postponedStatuses.includes(status) || executionStatuses.includes(status)) {
    return false;
  }

  return true;
};

// ✅ التحقق من وجود صورة للمشروع
export const hasProjectImage = (project) => {
  if (project?.is_daily_phase || project?.isDailyPhase) {
    const parentProject = project.parent_project || project.parentProject;
    if (project.notes_image_url || project.notes_image) {
      return true;
    }
    if (parentProject) {
      return !!(parentProject.notes_image_url || parentProject.notes_image);
    }
  }
  return !!(project.notes_image_url || project.notes_image);
};

// ✅ دالة للتحقق من تأخر المشروع للإعلام (مرور 48 ساعة ولم يصل للمتبرع)
export const isLateForMedia = (project) => {
  if (!project) return false;
  const status = (project.status || '').trim();
  if (status === 'وصل للمتبرع' || status === 'منتهي' || status === 'ملغى') return false;
  
  const executionDate = project.execution_date || project.executionDate;
  if (!executionDate) return false;
  
  try {
    const execTime = new Date(executionDate).getTime();
    const fortyEightHoursInMs = 48 * 60 * 60 * 1000;
    return (Date.now() - execTime) > fortyEightHoursInMs;
  } catch (e) {
    return false;
  }
};

// ✅ دالة للتحقق من تأخر المشروع لمدير المشاريع (بقاء 2 يوم أو أقل)
export const isLateForPM = (project) => {
  if (!project) return false;
  const status = (project.status || '').trim();
  if (status === 'وصل للمتبرع' || status === 'منتهي' || status === 'ملغى') return false;

  const remaining = project.remaining_days ?? project.remainingDays;
  if (remaining === null || remaining === undefined || isNaN(Number(remaining))) return false;

  // Consider delayed only when remaining days is exactly 0
  return Number(remaining) === 0;
};
