import { useMemo } from 'react';

export const useRoleDetection = (user) => {
  const normalizedRole = useMemo(() => {
    const role = user?.role || user?.role_name || user?.user_role || '';
    return typeof role === 'string' ? role.toLowerCase() : '';
  }, [user?.role, user?.role_name, user?.user_role]);

  const isAdmin = useMemo(() =>
    ['admin', 'administrator', 'مدير'].includes(normalizedRole),
    [normalizedRole]
  );

  const isProjectManager = useMemo(() =>
    normalizedRole === 'project_manager' || normalizedRole === 'مدير مشاريع',
    [normalizedRole]
  );

  const isExecutedCoordinator = useMemo(() =>
    normalizedRole === 'executed_projects_coordinator' || normalizedRole === 'منسق مشاريع منفذة',
    [normalizedRole]
  );

  const isMediaManager = useMemo(() =>
    normalizedRole === 'media_manager' ||
    normalizedRole === 'مدير الإعلام' ||
    normalizedRole === 'مسؤول الإعلام',
    [normalizedRole]
  );

  const isOrphanSponsorCoordinator = useMemo(() =>
    normalizedRole === 'orphan_sponsor_coordinator' ||
    normalizedRole === 'منسق مشاريع كفالة الأيتام' ||
    normalizedRole === 'منسق الكفالات',
    [normalizedRole]
  );

  const isExecutionHead = useMemo(() => {
    const rawRole = user?.role || user?.userRole || user?.user_role || user?.role_name || '';
    const rawRoleLower = String(rawRole).toLowerCase();
    const roleLower = String(normalizedRole).toLowerCase();

    return roleLower === 'execution_head' ||
      roleLower === 'execution_department_head' ||
      roleLower === 'executiondepartmenthead' ||
      roleLower === 'executionhead' ||
      roleLower === 'رئيس قسم التنفيذ' ||
      roleLower === 'رئيس قسم تنفيذ' ||
      roleLower === 'رئيسقسمالتنفيذ' ||
      roleLower.includes('execution_head') ||
      roleLower.includes('execution_department') ||
      roleLower.includes('executionhead') ||
      roleLower.includes('رئيس قسم التنفيذ') ||
      roleLower.includes('رئيس قسم تنفيذ') ||
      rawRoleLower === 'رئيس قسم التنفيذ' ||
      rawRoleLower === 'رئيس قسم تنفيذ' ||
      (rawRoleLower.includes('execution') && rawRoleLower.includes('head')) ||
      (rawRoleLower.includes('رئيس') && rawRoleLower.includes('تنفيذ'));
  }, [normalizedRole, user?.role, user?.userRole, user?.user_role, user?.role_name]);

  const currentRole = useMemo(() => {
    if (isAdmin) return 'admin';
    if (isProjectManager) return 'project_manager';
    if (isExecutedCoordinator) return 'executed_coordinator';
    if (isOrphanSponsorCoordinator) return 'orphan_sponsor';
    if (isMediaManager) return 'media_manager';
    if (isExecutionHead) return 'execution_head';
    return 'default';
  }, [isAdmin, isProjectManager, isExecutedCoordinator, isOrphanSponsorCoordinator, isMediaManager, isExecutionHead]);

  return {
    normalizedRole,
    isAdmin,
    isProjectManager,
    isExecutedCoordinator,
    isMediaManager,
    isOrphanSponsorCoordinator,
    isExecutionHead,
    currentRole,
  };
};

export default useRoleDetection;
