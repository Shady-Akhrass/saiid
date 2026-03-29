import React from 'react';
import { FilterBar, ProjectsTable, Pagination } from '../components/common';
import {
  getDivisionTextColor,
  getProjectDescription,
} from '../utils/projectUtils';

export const ExecutionHeadList = ({
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
  onOpenBeneficiariesModal,
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
        user={{ role: 'execution_head' }}
        isAdmin={false}
        isProjectManager={false}
        isOrphanSponsorCoordinator={false}
        isExecutedCoordinator={false}
        isMediaManager={false}
        isExecutionHead={true}
        isSponsorshipProject={() => false}
        hasProjectImage={hasProjectImage}
        onDownloadImage={onDownloadImage}
        onOpenBeneficiariesModal={onOpenBeneficiariesModal}
        getDivisionTextColor={getDivisionTextColor}
        getProjectDescription={getProjectDescription}
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

export default ExecutionHeadList;
