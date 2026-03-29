const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj ?? {}, key);

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
    } else if (normalized.phase_duration_days && !normalized.total_months) {
      normalized.phase_type = 'daily';
    } else if (normalized.is_monthly_phase) {
      normalized.phase_type = 'monthly';
    } else {
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
  if (!monthNumber || monthNumber < 1 || monthNumber > 12) return '';
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return months[monthNumber - 1];
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
    } catch (e) {}
  }
  const execDate = project?.execution_date ?? project?.executionDate ?? null;
  if (execDate) {
    try {
      const d = new Date(execDate);
      return getMonthName(d.getMonth() + 1);
    } catch (e) {}
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

  return (isMonthly && hasParentId) || hasMonthNumber;
};

export const filterProjectsForCurrentMonth = (projects, currentMonthOrCalendarFallback = null, allProjects = null) => {
  if (!Array.isArray(projects)) return [];

  return projects.filter((project) => {
    if (!isMonthlyPhaseProject(project)) return true;

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

export const PROJECT_STATUSES = [
  'جديد',
  'قيد التوريد',
  'تم التوريد',
  'مسند لباحث',
  'جاهز للتنفيذ',
  'تم اختيار المخيم',
  'قيد التنفيذ',
  'تم التنفيذ',
  'في المونتاج',
  'تم المونتاج',
  'يجب إعادة المونتاج',
  'وصل للمتبرع',
  'منتهي',
  'ملغى',
  'مؤجل',
];

export const getStatusColor = (status) => {
  const statusColors = {
    'جديد': 'bg-blue-500',
    'قيد التوريد': 'bg-amber-500',
    'تم التوريد': 'bg-orange-500',
    'مسند لباحث': 'bg-cyan-500',
    'جاهز للتنفيذ': 'bg-emerald-500',
    'تم اختيار المخيم': 'bg-teal-500',
    'قيد التنفيذ': 'bg-purple-500',
    'تم التنفيذ': 'bg-green-500',
    'في المونتاج': 'bg-pink-500',
    'تم المونتاج': 'bg-rose-500',
    'يجب إعادة المونتاج': 'bg-red-500',
    'وصل للمتبرع': 'bg-indigo-500',
    'منتهي': 'bg-gray-500',
    'ملغى': 'bg-red-700',
    'مؤجل': 'bg-yellow-500',
  };
  return statusColors[status] || 'bg-gray-500';
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return '-';
  }
};

export const DEFAULT_PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];

export const getProjectCode = (project, defaultValue = '-') => {
  if (!project) return defaultValue;
  return project.donor_code || project.internal_code || project.serial_number || project.id || defaultValue;
};

export const formatCurrency = (amount, currencyCode = 'USD') => {
  if (amount === null || amount === undefined || amount === '') return '-';
  const num = parseFloat(amount);
  if (isNaN(num)) return '-';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return `${formatted} ${currencyCode}`;
};

export const getRemainingDays = (project) => {
  if (!project) return null;

  // Prefer backend-provided value for single source of truth
  const backendDays = project?.remaining_days ?? project?.remainingDays;
  if (backendDays !== undefined && backendDays !== null && !isNaN(parseInt(backendDays))) {
    return parseInt(backendDays, 10);
  }

  // Fallback to local calculation if backend didn't provide it
  const executionDate = project.execution_date || project.executionDate || project.execution_end_date || null;
  if (!executionDate) return null;
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const execDate = new Date(executionDate);
    execDate.setHours(0, 0, 0, 0);
    const diffTime = execDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch (e) {
    return null;
  }
};

export const getRemainingDaysBadge = (project) => {
  const days = getRemainingDays(project);
  if (days === null) {
    return { days: null, badge: null, color: 'gray' };
  }
  
  let bgColor, textColor, badgeText;
  
  if (days < 0) {
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
    badgeText = `متأخر ${Math.abs(days)} يوم`;
  } else if (days === 0) {
    bgColor = 'bg-orange-100';
    textColor = 'text-orange-700';
    badgeText = 'ينتهي اليوم';
  } else if (days <= 3) {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-700';
    badgeText = `${days} يوم متبقي`;
  } else if (days <= 7) {
    bgColor = 'bg-blue-100';
    textColor = 'text-blue-700';
    badgeText = `${days} أيام متبقية`;
  } else {
    bgColor = 'bg-green-100';
    textColor = 'text-green-700';
    badgeText = `${days} يوم`;
  }
  
  const badge = (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold ${bgColor} ${textColor}`}>
      {badgeText}
    </span>
  );
  
  return { days, badge, color: days < 0 ? 'red' : days <= 3 ? 'yellow' : 'green' };
};

export const getDivisionTextColor = (project) => {
  if (project.is_daily_phase || project.isDailyPhase) {
    return 'text-blue-600';
  }
  if (project.is_monthly_phase || project.isMonthlyPhase) {
    return 'text-purple-600';
  }
  if (project.is_divided_into_phases || project.isDividedIntoPhases) {
    return 'text-indigo-600';
  }
  return 'text-gray-800';
};

export const getProjectDescription = (project) => {
  if (!project) return '';
  return project.project_description || project.description || project.notes || '';
};

export const getSubProjectParentName = (project) => {
  if (!project) return '';
  const parent = project.parent_project || project.parentProject || null;
  if (parent) {
    return parent.project_name || parent.donor_name || `مشروع #${parent.id}`;
  }
  if (project.parent_project_id || project.parentProjectId) {
    return `مشروع #${project.parent_project_id || project.parentProjectId}`;
  }
  return '';
};

export const formatOriginalAmount = (project, currencyCode = 'USD') => {
  if (!project) return '-';
  const amount = project.original_amount || project.originalAmount || project.amount_before_discount || null;
  if (amount === null || amount === undefined) return '-';
  return formatCurrency(amount, currencyCode);
};

export const isLateForPM = (project) => {
  if (!project) return false;
  if (project.status === 'منتهي' || project.status === 'ملغى' || project.status === 'مؤجل') return false;
  
  const days = getRemainingDays(project);
  if (days === null) return false;
  
  return days < 0;
};

export const isLateForMedia = (project) => {
  if (!project) return false;
  if (project.status === 'منتهي' || project.status === 'ملغى' || project.status === 'مؤجل') return false;
  if (!project.execution_date && !project.executionDate) return false;
  
  const days = getRemainingDays(project);
  if (days === null) return false;
  
  return days < 0;
};

export const isOrphanSponsorshipProject = (project) => {
  if (!project) return false;
  const type = project.project_type?.name_ar || project.project_type?.name || project.project_type || '';
  return type.includes('كافل') || type.includes('كفالة') || type.includes('orphan') || project.is_orphan_sponsorship;
};

export const renderProjectBadges = (project) => {
  if (!project) return null;
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

export const AVAILABLE_COLUMNS = [
  { key: 'serial_number', label: 'كود المشروع', default: true },
  { key: 'project_name', label: 'اسم المشروع', default: true },
  { key: 'project_description', label: 'وصف المشروع', default: true },
  { key: 'project_type', label: 'نوع المشروع', default: true },
  { key: 'status', label: 'الحالة', default: true },
  { key: 'donor_name', label: 'اسم المتبرع', default: true },
  { key: 'donor_code', label: 'كود المتبرع', default: true },
  { key: 'quantity', label: 'العدد', default: true },
  { key: 'beneficiaries_count', label: 'عدد المستفيدين', default: false },
  { key: 'team_name', label: 'اسم الفريق', default: true },
  { key: 'shelter_name', label: 'اسم المخيم', default: false },
  { key: 'shelter_address', label: 'عنوان المخيم', default: false },
  { key: 'execution_date', label: 'تاريخ التنفيذ', default: false },
  { key: 'created_at', label: 'تاريخ الإنشاء', default: false },
  { key: 'updated_at', label: 'تاريخ التحديث', default: false },
  { key: 'notes', label: 'الملاحظات', default: false },
  { key: 'photographer_name', label: 'اسم المصور', default: true },
  { key: 'researcher_name', label: 'اسم الباحث', default: true },
  { key: 'cost', label: 'التكلفة', default: true },
  { key: 'supply_cost_shekel', label: 'تكلفة التوريد بالشيكل', default: true },
  { key: 'net_amount_usd', label: 'المبلغ الصافي بالدولار', default: false },
  { key: 'net_amount_shekel_after_supply', label: 'المبلغ بالشيكل بعد التوريد', default: false },
  { key: 'deficit_surplus_status', label: 'حالة العجز/الفائض', default: false },
  { key: 'deficit_surplus_amount', label: 'قيمة العجز/الفائض', default: false },
  { key: 'priority', label: 'الأولوية', default: false },
  { key: 'is_daily_phase', label: 'مشروع يومي', default: false },
  { key: 'is_divided_into_phases', label: 'مقسم إلى مراحل', default: false },
  { key: 'phase_duration_days', label: 'مدة المرحلة (أيام)', default: false },
  { key: 'phase_start_date', label: 'تاريخ بداية المرحلة', default: false },
];
