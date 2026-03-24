import { CheckCircle, Clock, AlertCircle, Package, FileText, Pause, PlayCircle, Eye, Download, Edit, Trash2, ShoppingCart, Users, UserCheck, X } from 'lucide-react';

export const getStatusColor = (status) => {
  const statusColors = {
    'جديد': 'bg-blue-500',
    'قيد التوريد': 'bg-purple-500',
    'جاهز للتنفيذ': 'bg-green-500',
    'قيد التنفيذ': 'bg-yellow-500',
    'تم التنفيذ': 'bg-emerald-600',
    'في المونتاج': 'bg-indigo-500',
    'تم المونتاج': 'bg-teal-500',
    'يجب إعادة المونتاج': 'bg-orange-500',
    'وصل للمتبرع': 'bg-sky-500',
    'منتهي': 'bg-gray-500',
    'مؤجل': 'bg-amber-500',
    'ملغى': 'bg-red-500',
  };
  return statusColors[status] || 'bg-gray-500';
};

export const getRemainingDaysBadge = (project) => {
  const status = project.status;
  const executionDate = project.execution_date;

  // ✅ إذا كان المشروع منتهياً أو ملغياً → عرض "منتهي"
  if (status === 'منتهي' || status === 'ملغى') {
    return {
      element: (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
          ✓ منتهي
        </span>
      ),
      isOverdue: false,
      isFinished: true,
    };
  }

  // ✅ العداد يتوقف عند "وصل للمتبرع"
  if (status === 'وصل للمتبرع') {
    return {
      element: (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
          ✓ وصل للمتبرع
        </span>
      ),
      isOverdue: false,
      isFinished: true,
    };
  }

  // ✅ عندما remaining_days === null (العداد متوقف من الـ API) → عرض "مكتمل" أو حسب الحالة
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

  // ✅ عندما remaining_days < 2 (أو سالب): نعرض "متأخر بـ X يوم" بدلاً من رقم سالب
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

  // ✅ في الوقت المحدد (remaining_days >= 2): عرض الأيام المتبقية
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

export const getDivisionTextColor = (project) => {
  if (project.is_divided_into_phases || project.isDividedIntoPhases) {
    return 'text-purple-600 font-semibold';
  }
  return 'text-gray-700';
};

export const getProjectDescription = (project) => {
  return project.description || project.project_description || project.notes || '---';
};

export const formatOriginalAmount = (project, currencyCode) => {
  const amount = project.amount || project.original_amount || project.originalAmount || 0;
  if (!amount) return '---';
  return `${amount.toLocaleString()} ${currencyCode || ''}`;
};

export const formatCurrency = (amount) => {
  if (!amount) return '---';
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

export const formatDate = (date) => {
  if (!date) return '---';
  return new Date(date).toLocaleDateString('ar-EG');
};

export const hasProjectImage = (project) => {
  return !!(project.image_path || project.project_image || project.image);
};

export const getAssignedTeamName = (project) => {
  return project.team_name || project.assigned_team?.name || project.assignedTeam?.name || '---';
};

export const isOrphanSponsorshipProject = (project) => {
  return project.project_type?.name === 'كفالة أيتام' || project.project_type?.name === 'كفالة أيتام - شهرية';
};

export const canEditAssignment = (project) => {
  const finishedStatuses = ['منتهي', 'ملغى', 'تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'وصل للمتبرع'];
  return !finishedStatuses.includes(project.status);
};

export const canPostponeProject = (project) => {
  const postponeAllowedStatuses = ['جديد', 'قيد التوريد', 'جاهز للتنفيذ', 'قيد التنفيذ'];
  return postponeAllowedStatuses.includes(project.status);
};

export const renderProjectBadges = (project) => {
  const badges = [];

  if (project.is_urgent === true || project.is_urgent === 1 || project.is_urgent === '1' || project.is_urgent === 'true' || Boolean(project.is_urgent)) {
    badges.push(
      <span key="urgent" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white border-2 border-red-700 shadow-lg animate-pulse ring-2 ring-red-400" title="مشروع عاجل">
        <AlertCircle className="w-3 h-3" />
        عاجل
      </span>
    );
  }

  if (project.is_divided_into_phases || project.isDividedIntoPhases) {
    badges.push(
      <span key="divided" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-300" title="مشروع مقسم لمراحل">
        <Package className="w-3 h-3" />
        مقسم
      </span>
    );
  }

  if (project.is_daily_phase || project.isDailyPhase) {
    badges.push(
      <span key="daily" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300" title="مرحلة يومية">
        <FileText className="w-3 h-3" />
        يومي
      </span>
    );
  }

  if (project.is_monthly_phase || project.isMonthlyPhase) {
    badges.push(
      <span key="monthly" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-300" title="مرحلة شهرية">
        <Calendar className="w-3 h-3" />
        شهري
      </span>
    );
  }

  if (project.status === 'مؤجل' || !!(project.postponed_at || project.postponement_reason)) {
    badges.push(
      <span key="postponed" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-orange-400 to-amber-500 text-white border-2 border-orange-600 shadow-lg animate-pulse">
        <Clock className="w-3 h-3" />
        مؤجل
      </span>
    );
  }

  return badges;
};

export const getSubProjectParentName = (project) => {
  if (project.parent_project?.project_name) {
    return project.parent_project.project_name;
  }
  if (project.parentProject?.project_name) {
    return project.parentProject.project_name;
  }
  return null;
};
