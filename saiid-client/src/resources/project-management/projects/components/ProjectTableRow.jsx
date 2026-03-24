import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Eye, Download, Edit, Trash2, ShoppingCart, Users, Pause, X, 
  AlertCircle, Clock, UserCheck, Package, PlayCircle, Home
} from 'lucide-react';
import * as Helpers from '../utils/ProjectsHelpers';
import * as UIHelpers from '../utils/ProjectUIHelpers';

const ProjectTableRow = ({
  project = {},
  user,
  isAdmin,
  isProjectManager,
  isMediaManager,
  isExecutedCoordinator,
  isOrphanSponsorCoordinator,
  isExecutionHead,
  normalizedRole,
  handleStatusClick,
  handleExecutionStatusClick,
  handleDownloadProjectImage,
  handleProjectImagesClick,
  handleDeleteClick,
  handleOpenSupplyModal,
  handleOpenBeneficiariesModal,
  handleOpenShelterModal,
  handleOpenOrphansModal,
  handleClearAssignedTeam,
  handleMoveToSupply,
  handleTransferToSupply,
  handleTransferToExecution,
  handleResumeProject,
  clearingAssignmentId,
  deletingProject,
  transferringToExecution,
  isPostponing,
  isResuming,
  setSelectedProject,
  setAssignModalOpen,
  setPostponingProjectId,
  setShowPostponeModal,
  isOrphanSponsorshipProject
}) => {
  // Use imported helpers instead of props where possible
  const projectCode = project?.internal_code || project?.donor_code || '---';
  const projectName =
    project?.project_name ||
    project?.beneficiary_name ||
    project?.donor_name ||
    project?.requester_name ||
    '---';

  const currencyCode = project?.currency_code || project?.currency?.currency_code;
  const parentProject = project?.parent_project || project?.parentProject;
  
  const amountAfter = project?.amount_in_usd ??
    project?.net_amount_usd ??
    project?.net_amount ??
    parentProject?.net_amount_usd ??
    parentProject?.net_amount ??
    0;
    
  const netAmount = project?.net_amount_usd ??
    project?.net_amount ??
    parentProject?.net_amount_usd ??
    parentProject?.net_amount ??
    0;

  const isPostponed = project.status === 'مؤجل' || !!(project.postponed_at || project.postponed_reason || project.postponement_reason);
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
  } else if (isOrphanSponsorCoordinator && isMonthlyPhase) {
    rowClassName += 'bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border-l-8 border-purple-400 hover:from-purple-100 hover:via-indigo-100 hover:to-purple-100';
  } else {
    rowClassName += 'border-gray-100 hover:bg-gradient-to-r hover:from-sky-50 hover:to-blue-50';
  }

  const remainingInfo = UIHelpers.getRemainingDaysBadge(project);

  // Common render for Status Span
  const renderStatusSpan = (canClick, onClickHandler, titleText) => (
    <span
      onClick={canClick ? onClickHandler : undefined}
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
        isPostponed ? 'bg-gradient-to-r from-orange-100 to-amber-200 text-orange-800 border-2 border-orange-400 font-bold shadow-md' : `${Helpers.getStatusColor(project.status)} text-white`
      } ${canClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}
      title={canClick ? titleText : ''}
    >
      {isPostponed && <Clock className="w-3.5 h-3.5" />}
      {project.status}
      {canClick && isMediaManager && ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'وصل للمتبرع'].includes(project.status) && <span className="text-xs">▼</span>}
    </span>
  );

  if (isAdmin || isMediaManager) {
    return (
      <tr className={rowClassName}>
        <td className="py-2 px-3 text-sm font-medium text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
          <Link to={`/project-management/projects/${project.id}`} className="hover:underline text-sky-600 hover:text-sky-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
            {projectCode}
          </Link>
        </td>
        <td className="py-2 px-3 text-sm text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={UIHelpers.getDivisionTextColor(project)} style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>{projectName}</span>
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
            {UIHelpers.renderProjectBadges(project)}
          </div>
        </td>
        <td className="py-2 px-3 text-sm text-gray-800 font-medium" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
          {project.donor_name || project.donor?.name || '---'}
        </td>
        <td className="py-2 px-3 text-sm text-gray-700 max-w-xs" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 400 }}>
          <div className="line-clamp-2" title={UIHelpers.getProjectDescription(project)}>
            {UIHelpers.getProjectDescription(project)}
          </div>
          {UIHelpers.renderProjectBadges(project)}
          {(project.is_daily_phase || project.is_monthly_phase) && UIHelpers.getSubProjectParentName(project) && (
            <span className="text-xs text-gray-500 mt-1 block">
              من: {UIHelpers.getSubProjectParentName(project)}
              {(project.is_monthly_phase || project.isMonthlyPhase) && (project.month_number != null || project.monthNumber != null) && (
                <span className="text-purple-600 font-semibold">
                  {isOrphanSponsorCoordinator
                    ? ` - ${Helpers.getDisplayMonthNameForProject(project) || `الشهر ${project.month_number ?? project.monthNumber}`}`
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
          {UIHelpers.formatOriginalAmount(project, currencyCode)}
        </td>
        <td className="py-2 px-3 text-sm font-medium text-gray-800" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
          {UIHelpers.formatCurrency(amountAfter || 0)}
        </td>
        <td className="py-2 px-3 text-sm font-medium text-green-600" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
          {UIHelpers.formatCurrency(netAmount || 0)}
        </td>
        <td className="py-2 px-3">
          {(() => {
            const canClickStatus = project.status === 'وصل للمتبرع';
            return renderStatusSpan(canClickStatus, () => handleStatusClick(project), 'انقر للموافقة/الرفض');
          })()}
        </td>
        <td className="py-2 px-3 text-sm font-medium" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
          {remainingInfo.element}
        </td>
        <td className="py-2 px-3" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}>
          <div className="flex items-center justify-center gap-2">
            <Link
              to={`/project-management/projects/${project.id}`}
              className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors"
              title="عرض التفاصيل"
            >
              <Eye className="w-4 h-4" />
            </Link>
            <button
              onClick={() => handleProjectImagesClick(project)}
              className={`p-2 rounded-lg transition-colors ${UIHelpers.hasProjectImage(project)
                ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'
                }`}
              title={UIHelpers.hasProjectImage(project) ? 'تنزيل صورة المشروع' : 'لا توجد صورة للمشروع'}
              disabled={!UIHelpers.hasProjectImage(project)}
            >
              <Download className="w-4 h-4" />
            </button>
            {isAdmin && (
              <Link
                to={`/project-management/projects/${project.id}/edit`}
                className="bg-orange-100 hover:bg-orange-200 text-orange-700 p-2 rounded-lg transition-colors"
                title="تعديل"
              >
                <Edit className="w-4 h-4" />
              </Link>
            )}
            {isAdmin && (
              <button
                onClick={() => handleDeleteClick(project)}
                disabled={deletingProject === (project.id || project._id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="حذف المشروع"
              >
                {deletingProject === (project.id || project._id) ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
            {isProjectManager && (
              <button
                onClick={() => handleOpenSupplyModal(project)}
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
                title={project.status === 'جديد' ? 'التسوق من المخزن' : 'تحديث التوريد'}
              >
                <ShoppingCart className="w-4 h-4" />
              </button>
            )}
            {(isExecutionHead || isProjectManager || normalizedRole.includes('رئيس') || String(user?.role || '').includes('رئيس')) && (
              <button
                onClick={() => handleOpenBeneficiariesModal(project)}
                className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors"
                title="إضافة/تحديث عدد المستفيدين"
              >
                <Users className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  if (isProjectManager) {
    return (
      <tr className={rowClassName}>
        <td className="py-4 px-6 text-sm font-medium text-gray-800">
          {project.__isFromWindow && project.__parentProject ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">
                {project.__parentProject?.internal_code || project.__parentProject?.donor_code || '---'}
              </span>
              {project.is_monthly_phase ? (
                <span className="text-xs font-semibold text-purple-600">
                  {isOrphanSponsorCoordinator
                    ? (project.month_number ? Helpers.getDisplayMonthNameForProject(project) || `الشهر ${project.month_number}` : '---')
                    : `الشهر ${project.month_number || '---'}`
                  }
                </span>
              ) : (
                <span className="text-xs font-semibold text-purple-600">
                  اليوم {project.phase_day || project.phaseDay || '---'}
                </span>
              )}
            </div>
          ) : (
            projectCode
          )}
        </td>
        <td className="py-4 px-6 text-sm text-gray-800">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={UIHelpers.getDivisionTextColor(project)}>{projectName}</span>
              {isUrgent && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white border-2 border-red-700 shadow-lg animate-pulse ring-2 ring-red-400" title="مشروع عاجل">
                  <AlertCircle className="w-4 h-4" />
                  عاجل
                </span>
              )}
            </div>
            {UIHelpers.renderProjectBadges(project)}
            {(project.is_daily_phase || project.is_monthly_phase) && UIHelpers.getSubProjectParentName(project) && (
              <span className="text-xs text-gray-500">
                من: {UIHelpers.getSubProjectParentName(project)}
              </span>
            )}
            {project.__isFromWindow && project.__parentProject && (
              <span className="text-xs text-purple-600 font-semibold mt-1">
                نافذة: اليوم الحالي + 3 أيام قادمة
              </span>
            )}
          </div>
        </td>
        <td className="py-4 px-6 text-sm font-medium text-gray-800">
          {project.is_daily_phase || project.__isFromWindow ? (
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                اليوم {project.phase_day || project.phaseDay || '---'}
              </span>
              {project.__isFromWindow && project.__parentProject && (
                <span className="text-xs text-purple-600">
                  من {project.__parentProject.phase_duration_days || '---'} يوم
                </span>
              )}
            </div>
          ) : project.is_monthly_phase ? (
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                {isOrphanSponsorCoordinator
                  ? (project.month_number ? Helpers.getDisplayMonthNameForProject(project) || `الشهر ${project.month_number}` : '---')
                  : `الشهر ${project.month_number || '---'}`
                }
              </span>
              {project.parent_project?.total_months && (
                <span className="text-xs text-purple-600">
                  من {project.parent_project.total_months} شهر
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-400">---</span>
          )}
        </td>
        <td className="py-4 px-6 text-sm text-gray-700">
          {project.__isFromWindow && project.__parentProject
            ? (project.__parentProject.donor_name || project.__parentProject.donor?.name || '---')
            : (project.donor_name || project.donor?.name || '---')}
        </td>
        <td className="py-4 px-6 text-sm text-gray-700 max-w-xs">
          <div className="line-clamp-2" title={UIHelpers.getProjectDescription(project)}>
            {UIHelpers.getProjectDescription(project)}
          </div>
          {UIHelpers.renderProjectBadges(project)}
          {(project.is_daily_phase || project.is_monthly_phase) && UIHelpers.getSubProjectParentName(project) && (
            <span className="text-xs text-gray-500 mt-1 block">
              من: {UIHelpers.getSubProjectParentName(project)}
              {(project.is_monthly_phase || project.isMonthlyPhase) && (project.month_number != null || project.monthNumber != null) && (
                <span className="text-purple-600 font-semibold">
                  {isOrphanSponsorCoordinator
                    ? ` - ${Helpers.getDisplayMonthNameForProject(project) || `الشهر ${project.month_number ?? project.monthNumber}`}`
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
        <td className="py-4 px-6 text-sm font-bold text-green-600">
          {project.__isFromWindow && project.__parentProject
            ? UIHelpers.formatCurrency(Helpers.calculateDailyAmount(project.__parentProject) || netAmount || 0)
            : UIHelpers.formatCurrency(netAmount || 0)}
          {project.__isFromWindow && project.__parentProject && (
            <span className="block text-xs text-gray-500 font-normal mt-1">
              (المبلغ اليومي)
            </span>
          )}
        </td>
        <td className="py-4 px-6">
          {(() => {
            const postExecutionStatuses = ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'وصل للمتبرع'];
            const canClickStatus = isMediaManager ? postExecutionStatuses.includes(project.status) : project.status === 'قيد التنفيذ';
            const canClickReadyForExecution = isOrphanSponsorCoordinator && project.status === 'جاهز للتنفيذ';
            const canClickDonorReceived = project.status === 'وصل للمتبرع';

            if (canClickStatus) return renderStatusSpan(true, () => handleExecutionStatusClick(project), 'انقر لتحديث الحالة');
            if (canClickReadyForExecution || canClickDonorReceived) return renderStatusSpan(true, () => handleStatusClick(project), canClickReadyForExecution ? "انقر لنقل المشروع إلى 'تم التنفيذ'" : "انقر للقبول/الرفض");
            return renderStatusSpan(false);
          })()}
        </td>
        <td className="py-4 px-6 text-sm font-medium">
          {remainingInfo.element}
        </td>
        <td className="py-4 px-6">
          <div className="flex items-center justify-center gap-2">
            <Link to={`/project-management/projects/${project.id}`} className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors" title="عرض التفاصيل">
              <Eye className="w-4 h-4" />
            </Link>
            <button
              onClick={() => handleDownloadProjectImage(project)}
              className={`p-2 rounded-lg transition-colors ${UIHelpers.hasProjectImage(project) ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'}`}
              title={UIHelpers.hasProjectImage(project) ? 'تنزيل صورة المشروع' : 'لا توجد صورة للمشروع'}
              disabled={!UIHelpers.hasProjectImage(project)}
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setSelectedProject(project); setAssignModalOpen(true); }}
              disabled={!UIHelpers.canEditAssignment(project)}
              className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={UIHelpers.canEditAssignment(project) ? 'تعديل الفريق المكلف' : 'لا يمكن التعديل - المشروع منتهي'}
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleClearAssignedTeam(project)}
              disabled={clearingAssignmentId === project.id || (!project.assigned_team && !project.assigned_photographer && !project.team_name) || !UIHelpers.canEditAssignment(project)}
              className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={UIHelpers.canEditAssignment(project) ? 'حذف الفريق المكلف' : 'لا يمكن الحذف - المشروع منتهي'}
            >
              {clearingAssignmentId === project.id ? <span className="inline-flex h-4 w-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin"></span> : <X className="w-4 h-4" />}
            </button>
            {UIHelpers.canPostponeProject(project) && (
              <button
                onClick={() => { setPostponingProjectId(project.id); setShowPostponeModal(true); }}
                disabled={isPostponing}
                className="bg-amber-100 hover:bg-amber-200 text-amber-700 p-2 rounded-lg transition-colors disabled:opacity-50"
                title="تأجيل المشروع"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            {user?.role === 'project_manager' && (
              <Link
                to={`/project-management/projects/${project.id}/supply`}
                onClick={async (e) => {
                  if (project.status === 'جديد') {
                    e.preventDefault();
                    await handleMoveToSupply(project.id);
                  }
                }}
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
                title={project.status === 'جديد' ? 'نقل للتوريد' : 'تحديث التوريد'}
              >
                <ShoppingCart className="w-4 h-4" />
              </Link>
            )}
            {project.status === 'مؤجل' && (
              <button
                onClick={() => handleResumeProject(project.id)}
                disabled={isResuming}
                className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors disabled:opacity-50"
                title="استئناف المشروع"
              >
                {isResuming ? <span className="inline-flex h-4 w-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></span> : <PlayCircle className="w-4 h-4" />}
              </button>
            )}
            {(isExecutionHead || isProjectManager || normalizedRole.includes('رئيس') || String(user?.role || '').includes('رئيس')) && (
              <button onClick={() => handleOpenBeneficiariesModal(project)} className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors" title="إضافة/تحديث عدد المستفيدين">
                <Users className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  if (isExecutedCoordinator) {
    return (
      <tr className={rowClassName}>
        <td className="py-4 px-6 text-sm font-medium text-gray-800">
          {(project?.donor_code || project?.internal_code) ? (
            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
              {projectCode}
            </span>
          ) : <span className="text-gray-400">---</span>}
        </td>
        <td className="py-4 px-6 text-sm text-gray-700 max-w-xs">
          <div className="flex flex-col gap-2">
            <div className="line-clamp-2" title={UIHelpers.getProjectDescription(project)}>{UIHelpers.getProjectDescription(project)}</div>
            {isOrphanSponsorshipProject(project) && (project.sponsored_orphans_count > 0 || project.has_sponsored_orphans) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-300 w-fit">
                <Users className="w-3 h-3" />
                {project.sponsored_orphans_count || 0} يتيم مكفول
              </span>
            )}
          </div>
        </td>
        <td className="py-4 px-6 text-sm text-gray-700">{UIHelpers.getAssignedTeamName(project)}</td>
        <td className="py-4 px-6 text-sm text-gray-700">{project.assigned_photographer?.name || project.photographer_name || project.photographer?.name || '-'}</td>
        <td className="py-4 px-6">
          {(() => {
            const canClickReadyForExecution = isOrphanSponsorCoordinator && project.status === 'جاهز للتنفيذ';
            const canClickDonorReceived = project.status === 'وصل للمتبرع';
            return renderStatusSpan(canClickReadyForExecution || canClickDonorReceived, () => handleStatusClick(project), canClickReadyForExecution ? "انقر لنقل المشروع إلى 'تم التنفيذ'" : "انقر للموافقة/الرفض");
          })()}
        </td>
        <td className="py-4 px-6">
          <div className="flex items-center justify-center gap-2">
            <Link to={`/project-management/projects/${project.id}`} className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors" title="عرض التفاصيل">
              <Eye className="w-4 h-4" />
            </Link>
            <button
                onClick={() => handleDownloadProjectImage(project)}
                className={`p-2 rounded-lg transition-colors ${UIHelpers.hasProjectImage(project) ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'}`}
                title={UIHelpers.hasProjectImage(project) ? 'تنزيل صورة المشروع' : 'لا توجد صورة للمشروع'}
                disabled={!UIHelpers.hasProjectImage(project)}
            >
                <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleOpenShelterModal(project)}
              disabled={project.status !== 'جاهز للتنفيذ' || !!(project.shelter_id || project.shelter?.id)}
              className="bg-orange-100 hover:bg-orange-200 text-orange-700 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={project.status === 'جاهز للتنفيذ' && !(project.shelter_id || project.shelter?.id) ? 'اختيار المخيم' : (project.shelter_id || project.shelter?.id ? 'تم اختيار المخيم - يمكنك الضغط على "نقل للتنفيذ"' : 'لا يمكن اختيار المخيم')}
            >
              <Home className="w-4 h-4" />
            </button>
            {(isExecutionHead || isProjectManager || normalizedRole.includes('رئيس') || String(user?.role || '').includes('رئيس')) && (
              <button onClick={() => handleOpenBeneficiariesModal(project)} className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors" title="إضافة/تحديث عدد المستفيدين">
                <Users className="w-4 h-4" />
              </button>
            )}
            {isOrphanSponsorshipProject(project) && isOrphanSponsorCoordinator && (
              <button onClick={() => handleTransferToSupply(project)} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors" title={project.status === 'جديد' ? 'نقل للتوريد' : 'تحديث التوريد'}>
                <Package className="w-4 h-4" />
              </button>
            )}
            {isOrphanSponsorshipProject(project) && isOrphanSponsorCoordinator && (
              <button onClick={() => { setSelectedProject(project); setAssignModalOpen(true); }} className="bg-amber-100 hover:bg-amber-200 text-amber-700 p-2 rounded-lg transition-colors" title="إسناد/تعديل باحث">
                <UserCheck className="w-4 h-4" />
              </button>
            )}
            {isOrphanSponsorshipProject(project) && (isOrphanSponsorCoordinator || isAdmin) && (
              <button onClick={() => handleOpenOrphansModal(project)} className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors" title="إضافة/إدارة الأيتام المكفولين">
                <Users className="w-4 h-4" />
              </button>
            )}
            {isOrphanSponsorshipProject(project) && project.status === 'جاهز للتنفيذ' && (isOrphanSponsorCoordinator || isExecutedCoordinator || isAdmin) && (
              <button
                onClick={() => handleTransferToExecution(project.id)}
                disabled={transferringToExecution === project.id}
                className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-lg transition-colors disabled:opacity-50"
                title="نقل للتنفيذ"
              >
                {transferringToExecution === project.id ? <span className="inline-flex h-4 w-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></span> : <PlayCircle className="w-4 h-4" />}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // Default View
  return (
    <tr className={rowClassName}>
      <td className="py-4 px-6 text-sm font-medium text-gray-800">{project.donor_code}</td>
      <td className="py-4 px-6 text-sm text-gray-800 font-medium">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{projectName}</span>
          {(project.is_daily_phase || project.is_monthly_phase) && UIHelpers.getSubProjectParentName(project) && (
            <span className="text-xs text-gray-500">من: {UIHelpers.getSubProjectParentName(project)}</span>
          )}
        </div>
      </td>
      <td className="py-4 px-6 text-sm text-gray-700 max-w-xs">
        <div className="flex flex-col gap-2">
          <div className="line-clamp-2" title={UIHelpers.getProjectDescription(project)}>{UIHelpers.getProjectDescription(project)}</div>
          {isOrphanSponsorshipProject(project) && (project.sponsored_orphans_count > 0 || project.has_sponsored_orphans) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-300 w-fit">
              <Users className="w-3 h-3" />
              {project.sponsored_orphans_count || 0} يتيم مكفول
            </span>
          )}
          {isPostponed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-orange-400 to-amber-500 text-white border-2 border-orange-600 shadow-lg animate-pulse w-fit">
              <Clock className="w-3 h-3" />
              مؤجل
            </span>
          )}
        </div>
      </td>
      <td className="py-4 px-6 text-sm text-gray-800">{project.donor_name}</td>
      <td className="py-4 px-6 text-sm text-gray-800">
        {(() => {
          const monthNum = Helpers.getMonthNumber(project);
          if (monthNum !== null && monthNum >= 1) {
            const monthName = Helpers.getDisplayMonthNameForProject(project);
            if (isOrphanSponsorCoordinator) {
              return <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{monthName || `الشهر ${monthNum}`}</span>;
            }
            return <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{monthNum}{monthName ? ` (${monthName})` : ''}</span>;
          }
          return <span className="text-gray-400">---</span>;
        })()}
      </td>
      <td className="py-4 px-6">
        {(() => {
          const canClickReadyForExecution = isOrphanSponsorCoordinator && project.status === 'جاهز للتنفيذ';
          const canClickDonorReceived = project.status === 'وصل للمتبرع';
          return renderStatusSpan(canClickReadyForExecution || canClickDonorReceived, () => handleStatusClick(project), canClickReadyForExecution ? "انقر لنقل المشروع إلى 'تم التنفيذ'" : "انقر للموافقة/الرفض");
        })()}
      </td>
      {!isOrphanSponsorCoordinator && <td className="py-4 px-6 text-sm text-gray-700">{UIHelpers.getAssignedTeamName(project)}</td>}
      <td className="py-4 px-6 text-sm text-gray-700">{project.assigned_photographer?.name || project.photographer_name || project.photographer?.name || '-'}</td>
      <td className="py-4 px-6 text-sm text-gray-600">{UIHelpers.formatDate(project.created_at)}</td>
      {!isOrphanSponsorCoordinator && <td className="py-4 px-6 text-sm text-gray-600">{UIHelpers.formatDate(project.updated_at)}</td>}
      <td className="py-4 px-6">
        <div className="flex items-center justify-center gap-2">
          <Link to={`/project-management/projects/${project.id}`} className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors" title="عرض التفاصيل">
            <Eye className="w-4 h-4" />
          </Link>
          <button
              onClick={() => handleDownloadProjectImage(project)}
              className={`p-2 rounded-lg transition-colors ${UIHelpers.hasProjectImage(project) ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'}`}
              title={UIHelpers.hasProjectImage(project) ? 'تنزيل صورة المشروع' : 'لا توجد صورة للمشروع'}
              disabled={!UIHelpers.hasProjectImage(project)}
          >
              <Download className="w-4 h-4" />
          </button>
          {(isExecutionHead || isProjectManager || normalizedRole.includes('رئيس') || String(user?.role || '').includes('رئيس')) && (
            <button onClick={() => handleOpenBeneficiariesModal(project)} className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors" title="إضافة/تحديث عدد المستفيدين">
              <Users className="w-4 h-4" />
            </button>
          )}
          {isOrphanSponsorshipProject(project) && isOrphanSponsorCoordinator && (
            <button
                onClick={() => handleOpenOrphansModal(project)}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors"
                title="إضافة/إدارة الأيتام المكفولين"
            >
                <Users className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default ProjectTableRow;
