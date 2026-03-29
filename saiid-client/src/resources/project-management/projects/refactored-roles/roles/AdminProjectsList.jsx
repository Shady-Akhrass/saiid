import React from 'react';
import { Plus, Download, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../../context/AuthContext';
import { FilterBar, ProjectsTable, Pagination } from '../components/common';
import {
  renderProjectBadges,
  getDivisionTextColor,
  getProjectDescription,
  getSubProjectParentName,
  formatOriginalAmount,
  isLateForPM,
  getDisplayMonthNameForProject,
} from '../utils/projectUtils';

export const AdminProjectsList = ({
  projects,
  filters,
  pagination,
  onFilterChange,
  onClearFilters,
  onSearchSubmit,
  onSearchChange,
  searchInput,
  onPageChange,
  onPerPageChange,
  onSort,
  sortConfig,
  showFilters,
  onToggleFilters,
  loading,
  projectTypes,
  hasProjectImage,
  onDownloadImage,
  onEdit,
  onDelete,
  deletingProject,
  isFinishedProjectsPage,
  researchers = [],
  photographers = [],
  subcategories = [],
  parentProjectOptions = [],
  subcategoriesLoading = false,
  loadingFilterLists = false,
  projectTypesLoading = false,
}) => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/project-management/projects/new"
            className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <Plus className="w-5 h-5" />
            مشروع جديد
          </Link>
          <button
            onClick={() => {}}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <Download className="w-5 h-5" />
            تصدير Excel
          </button>
        </div>
        <div className="text-sm text-gray-600 flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          <Calendar className="w-4 h-4" />
          {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
        onSearchSubmit={onSearchSubmit}
        onSearchChange={onSearchChange}
        searchInput={searchInput}
        projectTypes={projectTypes}
        showFilters={showFilters}
        onToggleFilters={onToggleFilters}
        loading={loading}
        isAdmin={true}
        researchers={researchers}
        photographers={photographers}
        subcategories={subcategories}
        parentProjectOptions={parentProjectOptions}
        subcategoriesLoading={subcategoriesLoading}
        loadingFilterLists={loadingFilterLists}
        projectTypesLoading={projectTypesLoading}
      />

      <ProjectsTable
        projects={projects}
        sortConfig={sortConfig}
        onSort={onSort}
        user={user}
        isAdmin={true}
        isProjectManager={false}
        isOrphanSponsorCoordinator={false}
        isExecutedCoordinator={false}
        isMediaManager={false}
        isSponsorshipProject={() => false}
        hasProjectImage={hasProjectImage}
        onDownloadImage={onDownloadImage}
        onEdit={onEdit}
        onDelete={onDelete}
        deletingProject={deletingProject}
        renderProjectBadges={renderProjectBadges}
        getDivisionTextColor={getDivisionTextColor}
        getProjectDescription={getProjectDescription}
        getSubProjectParentName={getSubProjectParentName}
        formatOriginalAmount={formatOriginalAmount}
        isLateForPM={isLateForPM}
        getDisplayMonthNameForProject={getDisplayMonthNameForProject}
      />

      <Pagination
        filters={filters}
        pagination={pagination}
        onPageChange={onPageChange}
        onPerPageChange={onPerPageChange}
        isFinishedProjectsPage={isFinishedProjectsPage}
        totalItems={projects.length}
      />
    </div>
  );
};

export default AdminProjectsList;
