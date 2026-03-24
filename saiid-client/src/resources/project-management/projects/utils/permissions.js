/**
 * Permission checking utilities for project management
 */

export const hasRole = (user, roles) => {
  if (!user) return false;
  const userRole = user.role || user.role_name || '';
  if (Array.isArray(roles)) {
    return roles.includes(userRole);
  }
  return userRole === roles;
};

export const isAdmin = (user) => hasRole(user, 'admin');

export const isProjectManager = (user) => hasRole(user, 'project_manager');

export const isMediaManager = (user) => hasRole(user, 'media_manager');

export const isExecutedCoordinator = (user) => {
  const role = user?.role || user?.role_name || '';
  return role === 'executed_coordinator' || role === 'execution_coordinator';
};

export const isExecutionHead = (user) => {
  const role = user?.role || user?.role_name || '';
  return role === 'execution_head' || role === 'executed_head';
};

export const isOrphanSponsorCoordinator = (user) => {
  const role = user?.role || user?.role_name || '';
  return role === 'orphan_sponsor_coordinator';
};

export const canEditAssignment = (project) => {
  const restrictedStatuses = ['منتهي'];
  return !restrictedStatuses.includes(project?.status);
};

export const canAssignResearcherAfterSupply = (project) => {
  const status = project?.status;
  const allowedStatuses = [
    'تم التوريد',
    'مسند لباحث',
    'جاهز للتنفيذ',
    'قيد التنفيذ',
    'تم التنفيذ',
    'في المونتاج',
    'تم المونتاج',
    'يجب إعادة المونتاج'
  ];
  return allowedStatuses.includes(status);
};

export const canPostponeProject = (project) => {
  const status = project?.status;
  const allowedStatuses = [
    'جديد',
    'قيد التوريد',
    'تم التوريد',
    'مسند لباحث',
    'جاهز للتنفيذ',
    'قيد التنفيذ'
  ];
  return allowedStatuses.includes(status) && status !== 'منتهي';
};

export const canEditProject = (user, project) => {
  if (!user || !project) return false;
  return isAdmin(user) || isProjectManager(user);
};

export const canDeleteProject = (user, project) => {
  if (!user || !project) return false;
  return isAdmin(user);
};

export const canViewProjectDetails = (user, project) => {
  if (!user || !project) return false;
  return isAdmin(user) || isProjectManager(user) || isMediaManager(user) || isExecutedCoordinator(user);
};

export const canManageSupply = (user, project) => {
  if (!user || !project) return false;
  return isProjectManager(user);
};

export const canManageBeneficiaries = (user, project) => {
  if (!user || !project) return false;
  return isExecutionHead(user) || isProjectManager(user) || isAdmin(user);
};

export const canManageMedia = (user, project) => {
  if (!user || !project) return false;
  return isMediaManager(user);
};

export const canExecuteProject = (user, project) => {
  if (!user || !project) return false;
  return isExecutedCoordinator(user);
};
