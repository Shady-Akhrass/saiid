import React from 'react';
import { Plus } from 'lucide-react';
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

export const ProjectManagerList = ({
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
  onPostpone,
  onMoveToSupply,
  onResume,
  isPostponing,
  isResuming,
  canPostponeProject,
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
        <Link
          to="/project-management/projects/new"
          className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <Plus className="w-5 h-5" />
          مشروع جديد
        </Link>
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
        isProjectManager={true}
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
        isAdmin={false}
        isProjectManager={true}
        isOrphanSponsorCoordinator={false}
        isExecutedCoordinator={false}
        isMediaManager={false}
        isSponsorshipProject={() => false}
        hasProjectImage={hasProjectImage}
        onDownloadImage={onDownloadImage}
        onPostpone={onPostpone}
        onMoveToSupply={onMoveToSupply}
        onResume={onResume}
        isPostponing={isPostponing}
        isResuming={isResuming}
        canPostponeProject={canPostponeProject}
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
        isFinishedProjectsPage={false}
        totalItems={projects.length}
      />
    </div>
  );
};

export default ProjectManagerList;
