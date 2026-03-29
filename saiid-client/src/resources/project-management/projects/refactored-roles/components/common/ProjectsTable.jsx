import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, AlertCircle, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ActionButtons from './ActionButtons';
import { formatDate, getRemainingDaysBadge, formatCurrency, getProjectCode } from '../../utils/projectUtils';

// Helper to render three-part creation info in the creation date column
const renderCreationThreePart = (project) => {
  const today = new Date();
  const todayStr = formatDate(today);
  const createdAt = project?.created_at || project?.createdAt;
  const createdAtStr = createdAt ? formatDate(createdAt) : '-';
  const estDays = project?.estimated_duration_days ?? project?.phase_duration_days ?? project?.phaseDurationDays;
  return (
    <div className="flex flex-col gap-1 text-sm text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <span className="text-xs text-gray-500">اليوم الحالي: {todayStr}</span>
      <span className="font-semibold">تاريخ الإنشاء: {createdAtStr}</span>
      <span className="text-xs text-gray-500">المدة المتوقعة: {estDays != null ? estDays : '-'}</span>
    </div>
  );
};

export const ProjectsTable = ({
  projects,
  sortConfig,
  onSort,
  user,
  isOrphanSponsorCoordinator = false,
  isAdmin = false,
  isProjectManager = false,
  isExecutedCoordinator = false,
  isMediaManager = false,
  isSponsorshipProject = false,
  hasProjectImage = () => false,
  onDownloadImage = () => {},
  onAssign = () => {},
  onOpenOrphansModal = () => {},
  onTransferToSupply = () => {},
  onPostpone = () => {},
  onMoveToSupply = () => {},
  onResume = () => {},
  onEdit = () => {},
  onDelete = () => {},
  onOpenBeneficiariesModal = () => {},
  onSelectShelter = () => {},
  isPostponing = false,
  isResuming = false,
  deletingProject = null,
  canPostponeProject = () => false,
  renderProjectBadges = () => null,
  getDivisionTextColor = () => '',
  getProjectDescription = () => '',
  getSubProjectParentName = () => '',
  formatOriginalAmount = () => '',
  isLateForPM = () => false,
  isLateForMedia = () => false,
  getDisplayMonthNameForProject = () => '',
}) => {
  const userRole = user?.role || user?.role_name || '';

  const renderSortIcon = (columnKey) => {
    if (sortConfig?.key !== columnKey) {
      return <ArrowDown className="w-4 h-4 opacity-30" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-4 h-4 text-sky-600" />
      : <ArrowDown className="w-4 h-4 text-sky-600" />;
  };

  const getAssignedTeamName = (project) => {
    return project.assigned_to_team?.team_name ||
      project.assigned_team?.team_name ||
      project.team?.team_name ||
      project.team_name ||
      '-';
  };

  const getProjectName = (project) => {
    return project?.project_name ||
      project?.beneficiary_name ||
      project?.donor_name ||
      project?.requester_name ||
      '---';
  };

  const getCurrencyCode = (project) => {
    return project?.currency_code || project?.currency?.currency_code || 'USD';
  };

  const getNetAmount = (project) => {
    const parentProject = project?.parent_project || project?.parentProject;
    return project?.net_amount_usd ??
      project?.net_amount ??
      parentProject?.net_amount_usd ??
      parentProject?.net_amount ??
      0;
  };

  const getAmountAfterTransfer = (project) => {
    const parentProject = project?.parent_project || project?.parentProject;
    return project?.amount_in_usd ??
      project?.net_amount_usd ??
      project?.net_amount ??
      parentProject?.net_amount_usd ??
      parentProject?.net_amount ??
      0;
  };

  const getProjectCodeFormatted = (project) => {
    return getProjectCode(project, '---');
  };

  const getRowClassName = (project) => {
    const isPostponed = project.status === 'مؤجل' || !!(project.postponed_at || project.postponement_reason);
    const isUrgent = (project.is_urgent === true ||
      project.is_urgent === 1 ||
      project.is_urgent === '1' ||
      project.is_urgent === 'true' ||
      String(project.is_urgent || '').toLowerCase() === 'true' ||
      Boolean(project.is_urgent)) && project.status !== 'منتهي';
    const isMonthlyPhase = project.is_monthly_phase || project.isMonthlyPhase || false;

    let rowClassName = 'border-b transition-all duration-200 group ';
    if (isPostponed) {
      rowClassName += 'bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border-l-8 border-orange-400 shadow-md hover:shadow-lg hover:from-orange-100 hover:via-amber-100 hover:to-orange-100';
    } else if (isUrgent) {
      rowClassName += 'bg-gradient-to-r from-red-100 via-red-50 to-red-100 border-l-8 border-red-600 shadow-lg hover:shadow-xl hover:from-red-200 hover:via-red-100 hover:to-red-200 ring-2 ring-red-300';
    } else if (isLateForPM && isLateForPM(project)) {
      rowClassName += 'bg-red-50 border-l-8 border-red-500 hover:bg-red-100 shadow-sm';
    } else if (isOrphanSponsorCoordinator && isMonthlyPhase) {
      rowClassName += 'bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border-l-8 border-purple-400 hover:from-purple-100 hover:via-indigo-100 hover:to-purple-100';
    } else {
      rowClassName += 'border-gray-100 hover:bg-gradient-to-r hover:from-sky-50 hover:to-blue-50';
    }
    return rowClassName;
  };

  const renderAdminMediaHeaders = () => (
    <tr>
      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>كود المشروع</th>
      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الاسم</th>
      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>اسم المتبرع</th>
      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الوصف</th>
      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>المبلغ قبل الخصم</th>
      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>المبلغ بعد التحويل</th>
      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>المبلغ الصافي</th>
      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>حالة المشروع</th>
      <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الأيام المتبقية للتنفيذ</th>
      <th className="text-center py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الخيارات</th>
    </tr>
  );

  const renderProjectManagerHeaders = () => (
    <tr>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>كود المشروع</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الاسم</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اليوم</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اسم المتبرع</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>التفاصيل</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>المبلغ الصافي للتنفيذ</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>حالة المشروع</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الأيام المتبقية للتنفيذ</th>
      <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الإجراءات</th>
    </tr>
  );

  const renderExecutedCoordinatorHeaders = () => (
    <tr>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الكود</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الوصف</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الفريق المكلف</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>المصور</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الحالة</th>
      <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الإجراءات</th>
    </tr>
  );

  const renderDefaultHeaders = () => (
    <tr>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الكود</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اسم المشروع</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الوصف</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اسم المتبرع</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>رقم الشهر</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الحالة</th>
      {!isOrphanSponsorCoordinator && (
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الفريق المكلف</th>
      )}
      <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>المصور</th>
      <th
        className="text-right py-4 px-6 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
        style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}
        onClick={() => onSort('created_at')}
      >
        <div className="flex items-center justify-end gap-2">
          <span>تاريخ التسجيل</span>
          {sortConfig?.key === 'created_at' && (
            sortConfig.direction === 'asc' ? (
              <ArrowUp className="w-4 h-4 text-sky-600" />
            ) : (
              <ArrowDown className="w-4 h-4 text-sky-600" />
            )
          )}
        </div>
      </th>
      {!isOrphanSponsorCoordinator && (
        <th
          className="text-right py-4 px-6 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
          onClick={() => onSort('updated_at')}
        >
          <div className="flex items-center justify-end gap-2">
            <span>تاريخ التحديث</span>
            {sortConfig?.key === 'updated_at' && (
              sortConfig.direction === 'asc' ? (
                <ArrowUp className="w-4 h-4 text-sky-600" />
              ) : (
                <ArrowDown className="w-4 h-4 text-sky-600" />
              )
            )}
          </div>
        </th>
      )}
      <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">الإجراءات</th>
    </tr>
  );

  const renderAdminMediaRow = (project) => {
    const projectName = getProjectName(project);
    const currencyCode = getCurrencyCode(project);
    const remainingInfo = getRemainingDaysBadge(project);
    const isUrgent = (project.is_urgent === true ||
      project.is_urgent === 1 ||
      project.is_urgent === '1' ||
      project.is_urgent === 'true' ||
      String(project.is_urgent || '').toLowerCase() === 'true' ||
      Boolean(project.is_urgent)) && project.status !== 'منتهي';
    const isPostponed = project.status === 'مؤجل' || !!(project.postponed_at || project.postponement_reason);

    return (
      <>
        <td className="py-2 px-3 text-sm font-medium text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
          <Link to={`/project-management/projects/${project.id}`} className="hover:underline text-sky-600 hover:text-sky-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
            {getProjectCodeFormatted(project)}
          </Link>
        </td>
        <td className="py-2 px-3 text-sm text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={getDivisionTextColor(project)} style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>{projectName}</span>
              {isUrgent && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white border-2 border-red-700 shadow-lg animate-pulse ring-2 ring-red-400" title="مشروع عاجل">
                  <AlertCircle className="w-4 h-4" />
                  عاجل
                </span>
              )}
              {isPostponed && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-orange-400 to-amber-500 text-white border-2 border-orange-600 shadow-lg animate-pulse">
                  <Clock className="w-3 h-3" />
                  مؤجل
                </span>
              )}
            </div>
            {renderProjectBadges && renderProjectBadges(project)}
          </div>
        </td>
        <td className="py-2 px-3 text-sm text-gray-800 font-medium" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
          {project.donor_name || project.donor?.name || '---'}
        </td>
        <td className="py-2 px-3 text-sm text-gray-700 max-w-xs" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 400 }}>
          <div className="line-clamp-2" title={getProjectDescription(project)}>
            {getProjectDescription(project)}
          </div>
          {renderProjectBadges && renderProjectBadges(project)}
          {(project.is_daily_phase || project.is_monthly_phase) && getSubProjectParentName(project) && (
            <span className="text-xs text-gray-500 mt-1 block">
              من: {getSubProjectParentName(project)}
              {(project.is_monthly_phase || project.isMonthlyPhase) && (project.month_number != null || project.monthNumber != null) && (
                <span className="text-purple-600 font-semibold">
                  {isOrphanSponsorCoordinator
                    ? ` - ${getDisplayMonthNameForProject(project) || `الشهر ${project.month_number ?? project.monthNumber}`}`
                    : ` - الشهر ${project.month_number ?? project.monthNumber}`
                  }
                </span>
              )}
              {(project.is_daily_phase || project.isDailyPhase) && (project.phase_day != null || project.phaseDay != null) && (
                <span className="text-blue-600 font-semibold"> - اليوم {project.phase_day ?? project.phaseDay}</span>
              )}
            </span>
          )}
        </td>
        <td className="py-2 px-3 text-sm font-medium text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
          {formatOriginalAmount ? formatOriginalAmount(project, currencyCode) : formatCurrency(project.original_amount || 0, currencyCode)}
        </td>
        <td className="py-2 px-3 text-sm font-medium text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
          {formatCurrency(getAmountAfterTransfer(project), currencyCode)}
        </td>
        <td className="py-2 px-3 text-sm font-bold text-sky-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
          {formatCurrency(getNetAmount(project), currencyCode)}
        </td>
        <td className="py-2 px-3">
          <StatusBadge status={project.status} isPostponed={isPostponed} />
        </td>
        <td className="py-2 px-3">
          {remainingInfo.badge}
        </td>
        <td className="py-2 px-3">
          <ActionButtons
            project={project}
            userRole={userRole}
            isAdmin={isAdmin}
            isProjectManager={isProjectManager}
            isOrphanSponsorCoordinator={isOrphanSponsorCoordinator}
            isSponsorshipProject={isSponsorshipProject}
            hasProjectImage={hasProjectImage}
            onDownloadImage={onDownloadImage}
            onAssign={onAssign}
            onOpenOrphansModal={onOpenOrphansModal}
            onTransferToSupply={onTransferToSupply}
            onPostpone={onPostpone}
            onMoveToSupply={onMoveToSupply}
            onResume={onResume}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenBeneficiariesModal={onOpenBeneficiariesModal}
            onSelectShelter={onSelectShelter}
            isPostponing={isPostponing}
            isResuming={isResuming}
            deletingProject={deletingProject}
            canPostponeProject={canPostponeProject}
            isExecutedCoordinator={isExecutedCoordinator}
          />
        </td>
      </>
    );
  };

  const renderProjectManagerRow = (project) => {
    const projectName = getProjectName(project);
    const currencyCode = getCurrencyCode(project);
    const remainingInfo = getRemainingDaysBadge(project);
    const isUrgent = (project.is_urgent === true ||
      project.is_urgent === 1 ||
      project.is_urgent === '1' ||
      project.is_urgent === 'true' ||
      String(project.is_urgent || '').toLowerCase() === 'true' ||
      Boolean(project.is_urgent)) && project.status !== 'منتهي';
    const isPostponed = project.status === 'مؤجل' || !!(project.postponed_at || project.postponement_reason);

    return (
      <>
        <td className="py-2 px-3 text-sm font-medium text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
          <Link to={`/project-management/projects/${project.id}`} className="hover:underline text-sky-600 hover:text-sky-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
            {getProjectCodeFormatted(project)}
          </Link>
        </td>
        <td className="py-2 px-3 text-sm text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={getDivisionTextColor(project)} style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>{projectName}</span>
              {isUrgent && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white border-2 border-red-700 shadow-lg animate-pulse">
                  <AlertCircle className="w-4 h-4" />
                  عاجل
                </span>
              )}
              {isPostponed && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-orange-400 to-amber-500 text-white border-2 border-orange-600 shadow-lg animate-pulse">
                  <Clock className="w-3 h-3" />
                  مؤجل
                </span>
              )}
            </div>
            {renderProjectBadges && renderProjectBadges(project)}
          </div>
        </td>
        <td className="py-2 px-3 text-sm text-gray-700">
          {(project.is_daily_phase || project.isDailyPhase) && (project.phase_day || project.phaseDay)
            ? `اليوم ${project.phase_day || project.phaseDay}`
            : '-'}
        </td>
        <td className="py-2 px-3 text-sm text-gray-800 font-medium">
          {project.donor_name || project.donor?.name || '---'}
        </td>
        <td className="py-2 px-3 text-sm text-gray-700 max-w-xs">
          <div className="line-clamp-2" title={getProjectDescription(project)}>
            {getProjectDescription(project)}
          </div>
          {(project.is_daily_phase || project.is_monthly_phase) && getSubProjectParentName(project) && (
            <span className="text-xs text-gray-500 mt-1 block">
              من: {getSubProjectParentName(project)}
            </span>
          )}
        </td>
        <td className="py-2 px-3 text-sm font-bold text-sky-700">
          {formatCurrency(getNetAmount(project), currencyCode)}
        </td>
        <td className="py-2 px-3">
          <StatusBadge status={project.status} isPostponed={isPostponed} />
        </td>
        <td className="py-2 px-3">
          {remainingInfo.badge}
        </td>
        <td className="py-2 px-3">
          <ActionButtons
            project={project}
            userRole={userRole}
            isAdmin={isAdmin}
            isProjectManager={isProjectManager}
            isOrphanSponsorCoordinator={isOrphanSponsorCoordinator}
            isSponsorshipProject={isSponsorshipProject}
            hasProjectImage={hasProjectImage}
            onDownloadImage={onDownloadImage}
            onAssign={onAssign}
            onOpenOrphansModal={onOpenOrphansModal}
            onTransferToSupply={onTransferToSupply}
            onPostpone={onPostpone}
            onMoveToSupply={onMoveToSupply}
            onResume={onResume}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenBeneficiariesModal={onOpenBeneficiariesModal}
            onSelectShelter={onSelectShelter}
            isPostponing={isPostponing}
            isResuming={isResuming}
            deletingProject={deletingProject}
            canPostponeProject={canPostponeProject}
            isExecutedCoordinator={isExecutedCoordinator}
          />
        </td>
      </>
    );
  };

  const renderExecutedCoordinatorRow = (project) => {
    const isPostponed = project.status === 'مؤجل' || !!(project.postponed_at || project.postponement_reason);

    return (
      <>
        <td className="py-2 px-3 text-sm font-medium text-gray-800">
          <Link to={`/project-management/projects/${project.id}`} className="hover:underline text-sky-600 hover:text-sky-700">
            #{project.id}
          </Link>
        </td>
        <td className="py-2 px-3 text-sm text-gray-700 max-w-xs">
          <div className="line-clamp-2" title={getProjectDescription(project)}>
            {getProjectDescription(project)}
          </div>
        </td>
        <td className="py-2 px-3 text-sm text-gray-700">
          {getAssignedTeamName(project)}
        </td>
        <td className="py-2 px-3 text-sm text-gray-700">
          {project.assigned_photographer?.name ||
            project.photographer_name ||
            project.photographer?.name ||
            '-'}
        </td>
        <td className="py-2 px-3">
          <StatusBadge status={project.status} isPostponed={isPostponed} />
        </td>
        <td className="py-2 px-3">
          <ActionButtons
            project={project}
            userRole={userRole}
            isAdmin={isAdmin}
            isProjectManager={isProjectManager}
            isOrphanSponsorCoordinator={isOrphanSponsorCoordinator}
            isSponsorshipProject={isSponsorshipProject}
            hasProjectImage={hasProjectImage}
            onDownloadImage={onDownloadImage}
            onAssign={onAssign}
            onOpenOrphansModal={onOpenOrphansModal}
            onTransferToSupply={onTransferToSupply}
            onPostpone={onPostpone}
            onMoveToSupply={onMoveToSupply}
            onResume={onResume}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenBeneficiariesModal={onOpenBeneficiariesModal}
            onSelectShelter={onSelectShelter}
            isPostponing={isPostponing}
            isResuming={isResuming}
            deletingProject={deletingProject}
            canPostponeProject={canPostponeProject}
            isExecutedCoordinator={isExecutedCoordinator}
          />
        </td>
      </>
    );
  };

  const renderDefaultRow = (project) => {
    const projectName = getProjectName(project);
    const isPostponed = project.status === 'مؤجل' || !!(project.postponed_at || project.postponement_reason);
    const isMonthlyPhase = project.is_monthly_phase || project.isMonthlyPhase || false;

    return (
      <>
        <td className="py-2 px-3 text-sm font-medium text-gray-800">
          <Link to={`/project-management/projects/${project.id}`} className="hover:underline text-sky-600 hover:text-sky-700">
            #{project.id}
          </Link>
        </td>
        <td className="py-2 px-3 text-sm text-gray-800">
          <div className="flex flex-col gap-1">
            <span className={getDivisionTextColor(project)}>{projectName}</span>
            {isMonthlyPhase && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                مرحلة شهرية
              </span>
            )}
          </div>
        </td>
        <td className="py-2 px-3 text-sm text-gray-700 max-w-xs">
          <div className="line-clamp-2" title={getProjectDescription(project)}>
            {getProjectDescription(project)}
          </div>
        </td>
        <td className="py-2 px-3 text-sm text-gray-800 font-medium">
          {project.donor_name || project.donor?.name || '---'}
        </td>
        <td className="py-2 px-3 text-sm text-gray-700">
          {project.month_number || project.monthNumber || '-'}
        </td>
        <td className="py-2 px-3">
          <StatusBadge status={project.status} isPostponed={isPostponed} />
        </td>
        {!isOrphanSponsorCoordinator && (
          <td className="py-2 px-3 text-sm text-gray-700">
            {getAssignedTeamName(project)}
          </td>
        )}
        <td className="py-4 px-6 text-sm text-gray-700">
          {project.assigned_photographer?.name ||
            project.photographer_name ||
            project.photographer?.name ||
            '-'}
        </td>
        <td className="py-4 px-6 text-sm text-gray-600">
          {renderCreationThreePart(project)}
        </td>
        {!isOrphanSponsorCoordinator && (
          <td className="py-4 px-6 text-sm text-gray-600">
            {formatDate(project.updated_at)}
          </td>
        )}
        <td className="py-4 px-6">
          <ActionButtons
            project={project}
            userRole={userRole}
            isAdmin={isAdmin}
            isProjectManager={isProjectManager}
            isOrphanSponsorCoordinator={isOrphanSponsorCoordinator}
            isSponsorshipProject={isSponsorshipProject}
            hasProjectImage={hasProjectImage}
            onDownloadImage={onDownloadImage}
            onAssign={onAssign}
            onOpenOrphansModal={onOpenOrphansModal}
            onTransferToSupply={onTransferToSupply}
            onPostpone={onPostpone}
            onMoveToSupply={onMoveToSupply}
            onResume={onResume}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenBeneficiariesModal={onOpenBeneficiariesModal}
            onSelectShelter={onSelectShelter}
            isPostponing={isPostponing}
            isResuming={isResuming}
            deletingProject={deletingProject}
            canPostponeProject={canPostponeProject}
            isExecutedCoordinator={isExecutedCoordinator}
          />
        </td>
      </>
    );
  };

  const renderHeaders = () => {
    if (isAdmin || isMediaManager) {
      return renderAdminMediaHeaders();
    }
    if (isProjectManager) {
      return renderProjectManagerHeaders();
    }
    if (isExecutedCoordinator) {
      return renderExecutedCoordinatorHeaders();
    }
    return renderDefaultHeaders();
  };

  const renderRow = (project) => {
    if (isAdmin || isMediaManager) {
      return renderAdminMediaRow(project);
    }
    if (isProjectManager) {
      return renderProjectManagerRow(project);
    }
    if (isExecutedCoordinator) {
      return renderExecutedCoordinatorRow(project);
    }
    return renderDefaultRow(project);
  };

  return (
    <div className="overflow-x-auto rounded-3xl border border-gray-200 shadow-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
          {renderHeaders()}
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {projects.map((project, index) => {
            if (!project || Array.isArray(project)) {
              return null;
            }
            return (
              <tr key={project.id || index} className={getRowClassName(project)}>
                {renderRow(project)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ProjectsTable;
