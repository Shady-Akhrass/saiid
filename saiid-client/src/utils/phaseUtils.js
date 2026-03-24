/**
 * أدوات حساب المراحل (اليومية/الشهرية)
 * - parseLocalDate: تحويل YYYY-MM-DD إلى Date محلي (تفادي انزياح timezone)
 * - getCurrentProjectMonthFromStartDate: شهر المشروع الحالي من phase_start_date
 *
 * تنبيه: في JS الشهر 0-based. استخدم new Date(year, month - 1, day) وليس new Date(year, month, day).
 */

export const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const s = String(dateStr);
    const datePart = s.split('T')[0];
    const [y, m, d] = datePart.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(dateStr);
    return new Date(y, m - 1, d); // month 1-12 → 0-indexed
  } catch (e) {
    return new Date(dateStr);
  }
};

/**
 * شهر المشروع الحالي من phase_start_date.
 * إذا اليوم قبل شهر البداية → null (لا يُعرض أي مرحلة).
 */
export const getCurrentProjectMonthFromStartDate = (phaseStartDate) => {
  if (!phaseStartDate) return null;
  try {
    const startDate = parseLocalDate(phaseStartDate) || new Date(phaseStartDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    const yearDiff = today.getFullYear() - startDate.getFullYear();
    const monthDiff = today.getMonth() - startDate.getMonth();
    const totalMonthsDiff = yearDiff * 12 + monthDiff;

    if (totalMonthsDiff < 0) return null;

    return totalMonthsDiff + 1;
  } catch (e) {
    return null;
  }
};
