/**
 * Helper functions for surplus calculations and filtering
 */

/**
 * Calculate surplus/deficit for a single project
 * @param {Object} project - Project object
 * @returns {number} Calculated surplus (positive) or deficit (negative)
 */
export const calculateProjectSurplus = (project) => {
  const netAmountShekel = project.net_amount_shekel || project.available_amount || 0;
  const supplyCostShekel = project.supply_cost_shekel || project.supply_cost || 0;
  return netAmountShekel - supplyCostShekel;
};

/**
 * Calculate total surplus from an array of projects
 * @param {Array} projects - Array of project objects
 * @returns {number} Total surplus (sum of positive values)
 */
export const calculateTotalSurplus = (projects) => {
  return projects.reduce((sum, project) => {
    const calculatedSurplus = calculateProjectSurplus(project);
    return sum + (calculatedSurplus > 0 ? calculatedSurplus : 0);
  }, 0);
};

/**
 * Calculate total deficit from an array of projects
 * @param {Array} projects - Array of project objects
 * @returns {number} Total deficit (sum of absolute negative values)
 */
export const calculateTotalDeficit = (projects) => {
  return projects.reduce((sum, project) => {
    const calculatedSurplus = calculateProjectSurplus(project);
    return sum + (calculatedSurplus < 0 ? Math.abs(calculatedSurplus) : 0);
  }, 0);
};

/**
 * Calculate total balance (surplus - deficit) from an array of projects
 * @param {Array} projects - Array of project objects
 * @returns {number} Net balance
 */
export const calculateTotalBalance = (projects) => {
  return calculateTotalSurplus(projects) - calculateTotalDeficit(projects);
};

/**
 * Filter projects for admin role: exclude original divided parent projects
 * @param {Array} projects - Array of project objects
 * @param {Object} user - User object with role information
 * @returns {Array} Filtered projects
 */
export const filterProjectsForAdmin = (projects, user) => {
  const userRole = user?.role?.toLowerCase?.() ||
    user?.userRole?.toLowerCase?.() ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role || '';
  const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

  if (!isAdmin) {
    return projects;
  }

  return projects.filter((project) => {
    // Normalize project data
    const isDivided = Boolean(
      project.is_divided_into_phases ||
      project.isDividedIntoPhases ||
      false
    );
    const parentProjectId =
      project.parent_project_id ||
      project.parentProjectId ||
      project.parent_project?.id ||
      null;
    const phaseDay = project.phase_day || project.phaseDay || null;
    const monthNumber = project.month_number || project.monthNumber || null;
    const phaseType = project.phase_type || project.phaseType || null;

    // Exclude original divided parent projects
    // Original divided parent: is_divided_into_phases = true AND no parent_project_id AND no phase_day or month_number
    const isDividedParent = isDivided &&
      !parentProjectId &&
      !phaseDay &&
      !monthNumber &&
      phaseType !== 'daily' &&
      phaseType !== 'monthly';

    if (isDividedParent) {
      return false; // Exclude original divided parent projects
    }

    // Keep:
    // 1. Daily sub-projects (phase_day exists or phase_type = 'daily' with parent_project_id)
    // 2. Monthly sub-projects (month_number exists or phase_type = 'monthly' with parent_project_id)
    // 3. Undivided projects (is_divided_into_phases = false and no parent_project_id)
    return true;
  });
};

/**
 * Get project code (donor code or internal code)
 * @param {Object} project - Project object
 * @returns {Object} { projectCode, codeType }
 */
export const getProjectCode = (project) => {
  const donorCode = project.donor_code || project.project?.donor_code || '';
  const internalCode = project.internal_code || project.project?.internal_code || project.project_code || '';
  const projectCode = donorCode || internalCode || project.id?.toString() || '';
  const codeType = donorCode ? 'كود التبرع' : (internalCode ? 'كود داخلي' : 'رقم المشروع');
  return { projectCode, codeType };
};

/**
 * Check if project has surplus (positive balance)
 * @param {Object} project - Project object
 * @returns {boolean} True if project has surplus
 */
export const hasSurplus = (project) => {
  return calculateProjectSurplus(project) > 0;
};

/**
 * Check if project has deficit (negative balance)
 * @param {Object} project - Project object
 * @returns {boolean} True if project has deficit
 */
export const hasDeficit = (project) => {
  return calculateProjectSurplus(project) < 0;
};

