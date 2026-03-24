import React from 'react';
import { Home, Users, Camera, ShoppingCart, Eye, Play } from 'lucide-react';

const ExecutionAlerts = ({
  readyForExecutionProjects,
  projectsSupplyData,
  handleOpenShelterModal,
  handleTransferToExecution,
  getProjectCode,
  getProjectDescription
}) => {
  if (readyForExecutionProjects.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-2xl p-6 shadow-xl border-2 border-amber-200 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="bg-amber-500 rounded-full p-3 shadow-lg">
            <Home className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white">
                تنبيه مهم
              </span>
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">
                {readyForExecutionProjects.length}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1 flex items-center gap-3" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
              <span>مشاريع جاهزة للتنفيذ</span>
              <span className="inline-flex items-center justify-center min-w-[2.5rem] h-10 px-3 rounded-full bg-red-500 text-white text-lg font-bold shadow-lg">
                {readyForExecutionProjects.length}
              </span>
            </h2>
            <p className="text-gray-600 text-sm">
              تم توزيع {readyForExecutionProjects.length} مشروع من قبل مدير المشاريع على الفرق وهي بانتظار اختيار المخيم والبدء بالتنفيذ.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-amber-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-600" />
          قائمة المشاريع الموزعة
        </h3>
        <div className="space-y-3">
          {readyForExecutionProjects.map((project) => {
            const teamName = project?.assigned_to_team?.team_name ||
              project?.assigned_team?.team_name ||
              project?.team_name ||
              'غير محدد';
            const photographerName = project?.assigned_photographer?.name ||
              project?.photographer?.name ||
              'غير محدد';

            return (
              <div
                key={project.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border-2 border-amber-200 bg-gradient-to-r from-white to-amber-50 hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {(project?.donor_code || project?.internal_code) ? (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-amber-100 text-amber-700 border border-amber-300">
                        كود المشروع: {getProjectCode(project, '---')}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-sky-100 text-sky-700">
                      {(() => {
                        if (!project.project_type) return '---';
                        if (typeof project.project_type === 'object' && project.project_type !== null) {
                          return project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '---';
                        }
                        return project.project_type;
                      })()}
                    </span>
                  </div>
                  <p className="text-gray-800 font-bold text-lg mb-1">
                    {project.project_name || project.donor_name || 'مشروع بدون اسم'}
                  </p>
                  <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                    {getProjectDescription(project)}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      الفريق: <span className="font-semibold text-gray-700">{teamName}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      المصور: <span className="font-semibold text-gray-700">{photographerName}</span>
                    </span>
                  </div>
                  {projectsSupplyData[project.id]?.items_count > 0 && (
                    <div className="mt-3 pt-3 border-t border-amber-200 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 text-sm font-medium">
                        <ShoppingCart className="w-4 h-4" />
                        <span className="font-bold">{projectsSupplyData[project.id].items_count}</span>
                        <span>صنف</span>
                      </span>
                      {projectsSupplyData[project.id].items && projectsSupplyData[project.id].items.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {projectsSupplyData[project.id].items.slice(0, 3).map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs"
                            >
                              <span>{item.warehouse_item?.name || item.name || 'صنف'}</span>
                              {item.quantity_per_unit && (
                                <span className="text-gray-500">({item.quantity_per_unit}/طرد)</span>
                              )}
                            </span>
                          ))}
                          {projectsSupplyData[project.id].items.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs">
                              +{projectsSupplyData[project.id].items.length - 3} أكثر
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!(project.shelter_id || project.shelter?.id) ? (
                    <button
                      onClick={() => handleOpenShelterModal(project)}
                      className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                      <Home className="w-4 h-4" />
                      اختيار المخيم
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTransferToExecution(project.id)}
                      className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      نقل للتنفيذ
                    </button>
                  )}
                  <button
                    onClick={() => window.location.href = `/project-management/projects/${project.id}`}
                    className="px-4 py-2.5 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    التفاصيل
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExecutionAlerts;
