import React from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  Download,
  Edit,
  Trash2,
  UserCheck,
  Users,
  Package,
  Pause,
  PlayCircle,
  ShoppingCart,
} from 'lucide-react';

export const ActionButtons = ({
  project,
  userRole,
  isAdmin,
  isProjectManager,
  isOrphanSponsorCoordinator,
  isSponsorshipProject,
  hasProjectImage,
  onDownloadImage,
  onAssign,
  onOpenOrphansModal,
  onTransferToSupply,
  onPostpone,
  onMoveToSupply,
  onResume,
  onEdit,
  onDelete,
  onOpenBeneficiariesModal,
  onSelectShelter,
  isPostponing,
  isResuming,
  deletingProject,
  canPostponeProject,
  isExecutedCoordinator,
  isExecutionHead,
}) => {
  const getUserRole = () => {
    if (typeof userRole === 'string') return userRole;
    return '';
  };

  const role = getUserRole();
  const isPM = role === 'project_manager' || isProjectManager;
  const isCoordinator = role === 'orphan_sponsor_coordinator' || isOrphanSponsorCoordinator;

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      <Link
        to={`/project-management/projects/${project.id}`}
        className="bg-sky-100 hover:bg-sky-200 text-sky-700 p-2 rounded-lg transition-colors"
        title="عرض التفاصيل"
      >
        <Eye className="w-4 h-4" />
      </Link>

      <button
        onClick={() => onDownloadImage(project)}
        className={`p-2 rounded-lg transition-colors ${hasProjectImage(project)
            ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'
          }`}
        title={hasProjectImage(project) ? 'تنزيل صورة المشروع' : 'لا توجد صورة للمشروع'}
        disabled={!hasProjectImage(project)}
      >
        <Download className="w-4 h-4" />
      </button>

      {(isExecutionHead || isProjectManager || role.includes('رئيس') || String(role).includes('رئيس')) && (
        <button
          onClick={() => onOpenBeneficiariesModal(project)}
          className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors"
          title="إضافة/تحديث عدد المستفيدين"
        >
          <Users className="w-4 h-4" />
        </button>
      )}

      {isSponsorshipProject && isCoordinator && (
        <>
          <button
            onClick={() => onTransferToSupply(project)}
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
            title={project.status === 'جديد' ? 'إضافة كفالة' : 'تحديث الكفالة'}
          >
            <Package className="w-4 h-4" />
          </button>

          <button
            onClick={() => onAssign(project)}
            className="bg-amber-100 hover:bg-amber-200 text-amber-700 p-2 rounded-lg transition-colors"
            title="إسناد/تعديل باحث"
          >
            <UserCheck className="w-4 h-4" />
          </button>

          {(isCoordinator || isAdmin) && (
            <button
              onClick={() => onOpenOrphansModal(project)}
              className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-2 rounded-lg transition-colors"
              title="إضافة/إدارة الأيتام المكفولين"
            >
              <Users className="w-4 h-4" />
            </button>
          )}
        </>
      )}

      {isPM && canPostponeProject(project) && (
        <button
          onClick={() => onPostpone(project.id)}
          disabled={isPostponing}
          className="bg-amber-100 hover:bg-amber-200 text-amber-700 p-2 rounded-lg transition-colors disabled:opacity-50"
          title="تأجيل المشروع"
        >
          <Pause className="w-4 h-4" />
        </button>
      )}

      {isPM && project.status === 'جديد' && (
        <Link
          to={`/project-management/projects/${project.id}/supply`}
          onClick={async (e) => {
            if (project.status === 'جديد') {
              e.preventDefault();
              await onMoveToSupply(project.id);
            }
          }}
          className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
          title="نقل للتوريد"
        >
          <ShoppingCart className="w-4 h-4" />
        </Link>
      )}

      {isPM && project.status === 'قيد التوريد' && (
        <Link
          to={`/project-management/projects/${project.id}/supply`}
          className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg transition-colors"
          title="عرض سلة التوريد"
        >
          <ShoppingCart className="w-4 h-4" />
        </Link>
      )}

      {isPM && project.status === 'مؤجل' && (
        <button
          onClick={() => onResume(project.id)}
          disabled={isResuming}
          className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors disabled:opacity-50"
          title="استئناف المشروع"
        >
          {isResuming ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-700 border-t-transparent"></div>
          ) : (
            <PlayCircle className="w-4 h-4" />
          )}
        </button>
      )}

      {isExecutedCoordinator && project.status === 'جاهز للتنفيذ' && (
        <button
          onClick={() => onSelectShelter(project)}
          className="bg-teal-100 hover:bg-teal-200 text-teal-700 p-2 rounded-lg transition-colors"
          title="اختيار المخيم"
        >
          <Users className="w-4 h-4" />
        </button>
      )}

      {isAdmin && (
        <>
          <Link
            to={`/project-management/projects/${project.id}/edit`}
            className="bg-orange-100 hover:bg-orange-200 text-orange-700 p-2 rounded-lg transition-colors"
            title="تعديل"
          >
            <Edit className="w-4 h-4" />
          </Link>
          <button
            onClick={() => onDelete(project)}
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
        </>
      )}
    </div>
  );
};

export default ActionButtons;
