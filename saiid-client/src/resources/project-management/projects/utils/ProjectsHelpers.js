import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj ?? {}, key);

export const normalizeProjectRecord = (project = {}) => {
  const normalized = { ...project };
  const rawDaily =
    project?.is_daily_phase ??
    project?.isDailyPhase ??
    project?.isDaily ??
    false;
  const rawDivided =
    project?.is_divided_into_phases ??
    project?.isDividedIntoPhases ??
    false;

  normalized.is_daily_phase = Boolean(rawDaily);
  normalized.is_divided_into_phases = Boolean(rawDivided);
  normalized.phase_duration_days = project?.phase_duration_days ?? project?.phaseDurationDays ?? null;
  normalized.phase_start_date = project?.phase_start_date ?? project?.phaseStartDate ?? null;
  normalized.parent_project_id =
    project?.parent_project_id ??
    project?.parentProjectId ??
    project?.parent_project?.id ??
    null;
  normalized.parent_project = project?.parent_project || project?.parentProject || null;
  normalized.daily_phases = Array.isArray(project?.daily_phases)
    ? project.daily_phases
    : Array.isArray(project?.dailyPhases)
      ? project.dailyPhases
      : [];

  normalized.phase_type = project?.phase_type ?? project?.phaseType ?? null;
  normalized.is_monthly_phase = project?.is_monthly_phase ?? project?.isMonthlyPhase ?? false;
  normalized.total_months = project?.total_months ?? project?.totalMonths ?? project?.parent_project?.total_months ?? null;

  normalized.phase_day = project?.phase_day ?? project?.phaseDay ?? null;

  normalized.month_number = project?.month_number ??
    project?.monthNumber ??
    (project?.monthly_phase?.month_number) ??
    (project?.monthlyPhase?.month_number) ??
    (project?.parent_project?.month_number) ??
    (project?.parentProject?.month_number) ??
    null;
  normalized.month_start_date = project?.month_start_date ?? project?.monthStartDate ?? null;

  if (!normalized.phase_type && normalized.is_divided_into_phases) {
    if (normalized.total_months && !normalized.phase_duration_days) {
      normalized.phase_type = 'monthly';
    }
    else if (normalized.phase_duration_days && !normalized.total_months) {
      normalized.phase_type = 'daily';
    }
    else if (normalized.is_monthly_phase) {
      normalized.phase_type = 'monthly';
    }
    else {
      normalized.phase_type = 'daily';
    }
  }

  normalized.__hasDailyPhaseFlag =
    hasOwn(project, 'is_daily_phase') || hasOwn(project, 'isDailyPhase') || hasOwn(project, 'isDaily');
  normalized.__hasDivisionFlag =
    hasOwn(project, 'is_divided_into_phases') || hasOwn(project, 'isDividedIntoPhases');

  normalized.quantity = project?.quantity ?? project?.total_quantity ?? null;

  normalized.is_urgent = project?.is_urgent === true ||
    project?.is_urgent === 1 ||
    project?.is_urgent === '1' ||
    project?.is_urgent === 'true' ||
    String(project?.is_urgent || '').toLowerCase() === 'true' ||
    Boolean(project?.is_urgent) ||
    false;

  return normalized;
};

export const getNumericValue = (value) => {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
};

export const calculateDailyAmount = (project) => {
  if (!project?.is_divided_into_phases) return null;
  const days = project?.phase_duration_days || 0;
  if (!days) return null;
  const netAmount =
    getNumericValue(project?.net_amount) ||
    getNumericValue(project?.net_amount_usd) ||
    getNumericValue(project?.netAmount) ||
    getNumericValue(project?.netAmountUsd);
  if (!netAmount) return null;
  return netAmount / days;
};

export const calculateMonthlyAmount = (project) => {
  if (!project?.is_divided_into_phases) return null;

  const isMonthly =
    project.phase_type === 'monthly' ||
    project.is_monthly_phase === true ||
    (project.total_months && !project.phase_duration_days);

  if (!isMonthly) return null;

  const months = project?.total_months || project?.parent_project?.total_months || 0;
  if (!months) return null;
  const netAmount =
    getNumericValue(project?.net_amount) ||
    getNumericValue(project?.net_amount_usd) ||
    getNumericValue(project?.netAmount) ||
    getNumericValue(project?.netAmountUsd) ||
    getNumericValue(project?.parent_project?.net_amount) ||
    getNumericValue(project?.parent_project?.net_amount_usd);
  if (!netAmount) return null;
  return netAmount / months;
};

export const getMonthNumber = (project) => {
  if (!project) return null;

  let monthNumber =
    project.month_number ??
    project.monthNumber ??
    (project.monthly_phase?.month_number) ??
    (project.monthlyPhase?.month_number) ??
    (project.parent_project?.month_number) ??
    (project.parentProject?.month_number) ??
    null;

  if (!monthNumber && project.project_name) {
    const monthMatch = project.project_name.match(/الشهر\s*(\d+)/i) ||
      project.project_name.match(/month\s*(\d+)/i) ||
      project.project_name.match(/\s+(\d+)\s*$/);
    if (monthMatch && monthMatch[1]) {
      monthNumber = parseInt(monthMatch[1], 10);
    }
  }

  if (monthNumber !== null && monthNumber !== undefined && monthNumber !== '') {
    const monthNum = parseInt(monthNumber, 10);
    if (!isNaN(monthNum) && monthNum >= 1) {
      return monthNum;
    }
  }

  return null;
};

export const getMonthName = (monthNumber) => {
  if (!monthNumber || monthNumber < 1 || monthNumber > 12) {
    return '';
  }

  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  return months[monthNumber - 1];
};

export const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const s = String(dateStr);
    const datePart = s.split('T')[0];
    const [y, m, d] = datePart.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(dateStr);
    return new Date(y, m - 1, d);
  } catch (e) {
    return new Date(dateStr);
  }
};

export const getCalendarMonthNameForProjectMonth = (phaseStartDate, monthNumber) => {
  if (!phaseStartDate || monthNumber == null) return null;
  try {
    const d = parseLocalDate(phaseStartDate) || new Date(phaseStartDate);
    d.setMonth(d.getMonth() + (Number(monthNumber) - 1));
    return getMonthName(d.getMonth() + 1);
  } catch (e) {
    return null;
  }
};

export const getDisplayMonthNameForProject = (project) => {
  const monthNum = getMonthNumber(project);
  if (monthNum == null) return null;
  if (project?.__display_month_name) return project.__display_month_name;
  const monthStart = project?.month_start_date ?? project?.monthStartDate ?? null;
  if (monthStart) {
    try {
      const d = new Date(monthStart);
      return getMonthName(d.getMonth() + 1);
    } catch (e) { }
  }
  const execDate = project?.execution_date ?? project?.executionDate ?? null;
  if (execDate) {
    try {
      const d = new Date(execDate);
      return getMonthName(d.getMonth() + 1);
    } catch (e) { }
  }
  const parent = project.parent_project ?? project.parentProject;
  const phaseStart = parent?.phase_start_date ?? parent?.phaseStartDate ?? null;
  const nameFromStart = getCalendarMonthNameForProjectMonth(phaseStart, monthNum);
  if (nameFromStart) return nameFromStart;
  const projectPhaseStart = project?.phase_start_date ?? project?.phaseStartDate ?? null;
  const fromProjectStart = getCalendarMonthNameForProjectMonth(projectPhaseStart, monthNum);
  if (fromProjectStart) return fromProjectStart;
  return getMonthName(monthNum);
};

export const getCurrentMonth = () => {
  return new Date().getMonth() + 1;
};

export const isTodayInPhaseMonth = (project) => {
  const monthStart = project?.month_start_date ?? project?.monthStartDate ?? null;
  const execDate = project?.execution_date ?? project?.executionDate ?? null;
  const dateStr = monthStart || execDate;
  if (!dateStr) return false;
  try {
    const d = parseLocalDate(dateStr) || new Date(dateStr);
    const today = new Date();
    return today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth();
  } catch (e) {
    return false;
  }
};

export const getCurrentProjectMonthFromStartDate = (phaseStartDate) => {
  if (!phaseStartDate) return null;
  try {
    const startDate = parseLocalDate(phaseStartDate) || new Date(phaseStartDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    const yearsDiff = today.getFullYear() - startDate.getFullYear();
    const monthsDiff = today.getMonth() - startDate.getMonth();
    const totalMonthsDiff = yearsDiff * 12 + monthsDiff;
    return Math.max(1, totalMonthsDiff + 1);
  } catch (e) {
    return null;
  }
};

export const isMonthlyPhaseProject = (project) => {
  if (!project) return false;

  const isMonthly =
    project.is_monthly_phase === true ||
    project.isMonthlyPhase === true ||
    project.is_monthly_phase === 1 ||
    project.isMonthlyPhase === 1;

  const hasMonthNumber = getMonthNumber(project) !== null;
  const hasParentId =
    project.parent_project_id != null ||
    project.parentProjectId != null ||
    (project.parent_project && project.parent_project.id != null);

  const result = (isMonthly && hasParentId) || hasMonthNumber;

  return result;
};

export const filterProjectsForCurrentMonth = (projects, currentMonthOrCalendarFallback = null, allProjects = null) => {
  if (!Array.isArray(projects)) {
    return [];
  }

  const filtered = projects.filter((project) => {
    if (!isMonthlyPhaseProject(project)) {
      return true;
    }

    const monthNumber = getMonthNumber(project);
    if (monthNumber === null) return false;

    const parent = project.parent_project ?? project.parentProject ?? (Array.isArray(allProjects) && (project.parent_project_id ?? project.parentProjectId) != null
      ? allProjects.find((p) => (p.id ?? p.project_id) === (project.parent_project_id ?? project.parentProjectId))
      : null);
    const phaseStart = parent?.phase_start_date ?? parent?.phaseStartDate ?? null;
    const currentProjectMonth = getCurrentProjectMonthFromStartDate(phaseStart);

    if (currentProjectMonth !== null) {
      return monthNumber === currentProjectMonth;
    }

    const calendarMonth = currentMonthOrCalendarFallback ?? getCurrentMonth();
    return monthNumber === calendarMonth;
  });

  return filtered;
};

export const summarizeDailyPhaseStatuses = (project) => {
  const phases = Array.isArray(project?.daily_phases) ? project.daily_phases : [];
  if (!phases.length) return null;
  return phases.reduce((acc, phase) => {
    const status = phase?.status || 'غير محدد';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
};

export const summarizeMonthlyPhaseStatuses = (project) => {
  const phases = Array.isArray(project?.monthly_phases) ? project.monthly_phases : [];
  if (!phases.length) return null;
  return phases.reduce((acc, phase) => {
    const status = phase?.status || 'غير محدد';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'جديد':
      return 'bg-blue-500';
    case 'قيد التوريد':
      return 'bg-indigo-400';
    case 'تم التوريد':
      return 'bg-indigo-600';
    case 'مسند لباحث':
      return 'bg-purple-500';
    case 'جاهز للتنفيذ':
      return 'bg-yellow-500';
    case 'تم اختيار المخيم':
      return 'bg-orange-500';
    case 'قيد التنفيذ':
      return 'bg-amber-600 shadow-sm ring-1 ring-amber-300';
    case 'تم التنفيذ':
      return 'bg-teal-500';
    case 'في المونتاج':
      return 'bg-cyan-600';
    case 'تم المونتاج':
      return 'bg-emerald-600';
    case 'يجب إعادة المونتاج':
      return 'bg-rose-600';
    case 'وصل للمتبرع':
      return 'bg-green-600 ring-2 ring-green-300 animate-pulse';
    case 'منتهي':
      return 'bg-slate-500 opacity-80';
    case 'ملغى':
      return 'bg-red-500';
    case 'مؤجل':
      return 'bg-gradient-to-r from-orange-400 to-amber-500 font-bold';
    default:
      return 'bg-gray-400';
  }
};
