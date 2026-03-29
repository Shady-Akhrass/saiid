import React from 'react';
import { FilterBar, ProjectsTable, Pagination } from '../components/common';
import {
  renderProjectBadges,
  getDivisionTextColor,
  getProjectDescription,
  getSubProjectParentName,
  formatOriginalAmount,
  isLateForPM,
  isLateForMedia,
  getDisplayMonthNameForProject,
} from '../utils/projectUtils';

export const MediaManagerList = ({
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
  producers = [],
  researchers = [],
  photographers = [],
  subcategories = [],
  parentProjectOptions = [],
  subcategoriesLoading = false,
  loadingFilterLists = false,
  projectTypesLoading = false,
}) => {
  return (
    <div className="space-y-6">
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
        isMediaManager={true}
        producers={producers}
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
        user={{ role: 'media_manager' }}
        isAdmin={false}
        isProjectManager={false}
        isOrphanSponsorCoordinator={false}
        isExecutedCoordinator={false}
        isMediaManager={true}
        isSponsorshipProject={() => false}
        hasProjectImage={hasProjectImage}
        onDownloadImage={onDownloadImage}
        renderProjectBadges={renderProjectBadges}
        getDivisionTextColor={getDivisionTextColor}
        getProjectDescription={getProjectDescription}
        getSubProjectParentName={getSubProjectParentName}
        formatOriginalAmount={formatOriginalAmount}
        isLateForPM={isLateForPM}
        isLateForMedia={isLateForMedia}
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

export default MediaManagerList;
