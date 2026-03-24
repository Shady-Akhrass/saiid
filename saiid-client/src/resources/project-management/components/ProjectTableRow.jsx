import React from 'react';
import {
  Eye,
  Edit,
  Trash2,
  Download,
  Users,
  Package,
  UserCheck,
  Play,
  Home,
  Camera,
  Film,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  DollarSign,
  FileText,
  UserPlus,
  UserMinus,
  CheckSquare,
  Square,
  Search,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { isOrphanSponsorshipProject } from '../projects/ProjectsList';

const ProjectTableRow = ({
  project,
  isAdmin,
  isMediaManager,
  isProjectManager,
  isExecutedCoordinator,
  isOrphanSponsorCoordinator,
  isSupplyCoordinator,
  isMontageCoordinator,
  isPhotographer,
  isResearcher,
  getProjectCode,
  getProjectDescription,
  getDivisionTextColor,
  getStatusColor,
  getRemainingDaysBadge,
  renderProjectBadges,
  getSubProjectParentName,
  getDisplayMonthNameForProject,
  formatOriginalAmount,
  formatCurrency,
  handleStatusClick,
  handleProjectImagesClick,
  hasProjectImage,
  handleDeleteClick,
  deletingProject,
  handleOpenSupplyModal,
  handleOpenBeneficiariesModal,
  handleOpenOrphansModal,
  handleDownloadProjectImage,
  canEditAssignment,
  handleOpenShelterModal,
  handleClearAssignedTeam,
  clearingAssignmentId,
  canPostponeProject,
  isPostponing,
  setPostponingProjectId,
  setShowPostponeModal,
  handleResumeProject,
  formatDate,
  calculateDailyAmount,
  netAmount,
  setSelectedProject,
  setAssignModalOpen,
  handleTransferToExecution,
  transferringToExecution,
}) => {
  // 🐛 DEBUG: Trace orphan coordinator actions
  console.log('🐛 ProjectTableRow: Rendering row', {
    projectId: project?.id,
    projectName: project?.project_name,
    projectType: project?.project_type,
    userRole: isOrphanSponsorCoordinator ? 'orphan_sponsor_coordinator' : 'other',
    isOrphanSponsorCoordinator,
    'isOrphanSponsorshipProject result': isOrphanSponsorshipProject(project),
    'project.parent_project': project?.parent_project?.id,
    'project.parent_project_id': project?.parent_project_id,
    'project.is_monthly_phase': project?.is_monthly_phase,
    'project.month_number': project?.month_number,
  });

  // 🐛 DEBUG: Check if actions should be visible
  const shouldShowActions = isOrphanSponsorship && isOrphanSponsorCoordinator;
  console.log('🐛 ProjectTableRow: Should show actions?', {
    projectId: project?.id,
    shouldShowActions,
    isOrphanSponsorship,
    isOrphanSponsorCoordinator,
    'AND condition': isOrphanSponsorship && isOrphanSponsorCoordinator,
  });
  // Check if project is orphan sponsorship
  const isOrphanSponsorship = isOrphanSponsorshipProject(project);

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-100 transition-colors">
      {/* Project Code */}
      <td className="py-4 px-4">
        <div className="text-sm font-medium text-gray-900">
          {getProjectCode(project)}
        </div>
        {project.is_monthly_phase && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
            شهر {project.month_number}
          </span>
        )}
      </td>

      {/* Project Name */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="font-medium text-gray-900 text-sm">
              {project.project_name || project.name || 'غير محدد'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {getProjectDescription(project)}
            </div>
            {renderProjectBadges(project)}
          </div>
        </div>
      </td>

      {/* Description */}
      <td className="py-4 px-4">
        <div className="text-sm text-gray-900">
          {project.description || '---'}
        </div>
      </td>

      {/* Donor */}
      <td className="py-4 px-4">
        <div className="text-sm text-gray-900">
          {project.donor_name || '---'}
        </div>
        {project.donor_code && (
          <div className="text-xs text-gray-500">
            {project.donor_code}
          </div>
        )}
      </td>

      {/* Month */}
      <td className="py-4 px-4">
        <div className="text-sm text-gray-900">
          {project.month_number ? getDisplayMonthNameForProject(project.month_number) : '---'}
        </div>
      </td>

      {/* Status */}
      <td className="py-4 px-4">
        <button
          onClick={() => handleStatusClick(project)}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${getStatusColor(project.status)}`}
        >
          {project.status || 'غير محدد'}
        </button>
        {getRemainingDaysBadge(project)}
      </td>

      {/* Photographer */}
      <td className="py-4 px-4">
        <div className="text-sm text-gray-900">
          {project.assigned_photographer?.name || '---'}
        </div>
      </td>

      {/* Actions */}
      <td className="py-4 px-4">
        <div className="flex items-center justify-center gap-2">
          {/* View Details */}
          <button
            onClick={() => handleStatusClick(project)}
            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
            title="التفاصيل"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Download Image */}
          <button
            onClick={() => handleDownloadProjectImage(project)}
            className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-50 transition-colors"
            title={hasProjectImage(project) ? 'تنزيل صورة المشروع' : 'لا توجد صورة للمشروع'}
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Project Images */}
          {handleProjectImagesClick && (
            <button
              onClick={() => handleProjectImagesClick(project)}
              className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-50 transition-colors"
              title="صور الملاحظات"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}

          {/* Orphan Sponsorship Actions */}
          {(() => {
            // 🐛 DEBUG: Final check before rendering actions
            const finalCheck = isOrphanSponsorship && isOrphanSponsorCoordinator;
            console.log('🐛 ProjectTableRow: Final check before rendering actions', {
              projectId: project?.id,
              projectName: project?.project_name,
              isOrphanSponsorship,
              isOrphanSponsorCoordinator,
              finalCheck,
              'will render?': finalCheck,
              'project_type details': {
                type: project?.project_type,
                typeString: typeof project?.project_type,
                parentType: project?.parent_project?.project_type,
              }
            });
            return finalCheck;
          })() && (
            <>
              {/* Add Beneficiaries */}
              <button
                onClick={() => {
                  console.log('🐛 Orphan Coordinator: Add Beneficiaries button clicked', {
                    projectId: project.id,
                    projectName: project.project_name,
                    currentBeneficiaries: project.beneficiaries_count,
                    isOrphanSponsorship,
                    isOrphanSponsorCoordinator,
                  });
                  handleOpenBeneficiariesModal(project);
                }}
                className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors"
                title="إضافة/تحديث عدد المستفيدين"
              >
                <Users className="w-4 h-4" />
              </button>

              {/* Transfer to Supply */}
              <button
                onClick={() => {
                  console.log('🐛 Orphan Coordinator: Transfer to Supply button clicked', {
                    projectId: project.id,
                    projectName: project.project_name,
                    projectStatus: project.status,
                    originalAmount: project.original_amount,
                    shekelAmount: project.shekel_amount,
                    isOrphanSponsorship,
                    isOrphanSponsorCoordinator,
                  });
                  handleOpenSupplyModal(project);
                }}
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
                title={project.status === 'جديد' ? 'إضافة كفالة' : 'تحديث الكفالة'}
              >
                <Package className="w-4 h-4" />
              </button>

              {/* Manage Orphans */}
              <button
                onClick={() => {
                  console.log('🐛 Orphan Coordinator: Manage Orphans button clicked', {
                    projectId: project.id,
                    projectName: project.project_name,
                    projectStatus: project.status,
                    currentOrphansCount: project.orphans?.length || 0,
                    isOrphanSponsorship,
                    isOrphanSponsorCoordinator,
                  });
                  handleOpenOrphansModal(project);
                }}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors"
                title="إضافة/إدارة الأيتام المكفولين"
              >
                <Users className="w-4 h-4" />
              </button>

              {/* Assign Researcher */}
              <button
                onClick={() => {
                  console.log('🐛 Orphan Coordinator: Assign Researcher button clicked', {
                    projectId: project.id,
                    projectName: project.project_name,
                    projectStatus: project.status,
                    currentResearcher: project.assigned_researcher?.name || 'None',
                    researcherId: project.assigned_researcher_id,
                    isOrphanSponsorship,
                    isOrphanSponsorCoordinator,
                  });
                  console.log('🐛 Orphan Coordinator: Setting project for assign modal', {
                    projectToSet: project,
                    assignModalOpenBefore: false,
                  });
                  setSelectedProject(project);
                  setAssignModalOpen(true);
                  console.log('🐛 Orphan Coordinator: Assign modal should now be open');
                }}
                className="bg-amber-100 hover:bg-amber-200 text-amber-700 p-2 rounded-lg transition-colors"
                title="إسناد باحث"
              >
                <UserCheck className="w-4 h-4" />
              </button>

              {/* Transfer to Execution */}
              {project.status === 'جاهز للتنفيذ' && (
                <button
                  onClick={() => {
                    console.log('🐛 Orphan Coordinator: Transfer to Execution button clicked', {
                      projectId: project.id,
                      projectName: project.project_name,
                      projectStatus: project.status,
                      isReadyForExecution: project.status === 'جاهز للتنفيذ',
                      transferringToExecution,
                      isOrphanSponsorship,
                      isOrphanSponsorCoordinator,
                    });
                    handleTransferToExecution(project.id);
                  }}
                  disabled={transferringToExecution === project.id}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-lg transition-colors disabled:opacity-50"
                  title="نقل للتنفيذ"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {/* Delete button */}
          {isAdmin && (
            <button
              onClick={() => handleDeleteClick(project)}
              disabled={deletingProject === project.id}
              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
              title="حذف المشروع"
            >
              {deletingProject === project.id ? (
                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// Helper function to check if project is orphan sponsorship
const isOrphanSponsorshipProject = (project) => {
  if (!project) return false;

  try {
    // Check project type
    const projectType = typeof project.project_type === 'object' && project.project_type !== null
      ? (project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '')
      : (project.project_type || '');

    if (projectType !== 'الكفالات') return false;

    // Check subcategory
    const subcategory = project.subcategory || {};
    const subcategoryNameAr = subcategory.name_ar || '';
    const subcategoryName = subcategory.name || '';

    return subcategoryNameAr === 'كفالة أيتام' || subcategoryName === 'Orphan Sponsorship';
  } catch (error) {
    console.error('Error checking orphan sponsorship project:', error);
    return false;
  }
};

export default ProjectTableRow;
