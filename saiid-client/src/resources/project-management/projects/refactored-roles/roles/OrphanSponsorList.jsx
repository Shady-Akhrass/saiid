import React, { useState } from 'react';
import { FilterBar, ProjectsTable, Pagination } from '../components/common';
import {
  getDivisionTextColor,
  getProjectDescription,
  getDisplayMonthNameForProject,
} from '../utils/projectUtils';

export const OrphanSponsorList = ({
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
  hasProjectImage,
  onDownloadImage,
  onAssign,
  onOpenOrphansModal,
  onTransferToSupply,
  isSponsorshipProject,
  researchers = [],
  photographers = [],
  subcategories = [],
  parentProjectOptions = [],
  subcategoriesLoading = false,
  loadingFilterLists = false,
  projectTypesLoading = false,
}) => {
  const [showMonthlyPhasesHelp, setShowMonthlyPhasesHelp] = useState(false);

  return (
    <div className="space-y-6">
      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
        onSearchSubmit={onSearchSubmit}
        onSearchChange={onSearchChange}
        searchInput={searchInput}
        projectTypes={['الكفالات']}
        showFilters={showFilters}
        onToggleFilters={onToggleFilters}
        loading={loading}
        isOrphanSponsorCoordinator={true}
        researchers={researchers}
        photographers={photographers}
        subcategories={subcategories}
        parentProjectOptions={parentProjectOptions}
        subcategoriesLoading={subcategoriesLoading}
        loadingFilterLists={loadingFilterLists}
        projectTypesLoading={projectTypesLoading}
        showMonthlyPhasesHelp={showMonthlyPhasesHelp}
        onToggleMonthlyPhasesHelp={() => setShowMonthlyPhasesHelp(!showMonthlyPhasesHelp)}
      />

      <ProjectsTable
        projects={projects}
        sortConfig={sortConfig}
        onSort={onSort}
        user={{ role: 'orphan_sponsor_coordinator' }}
        isAdmin={false}
        isProjectManager={false}
        isOrphanSponsorCoordinator={true}
        isExecutedCoordinator={false}
        isMediaManager={false}
        isSponsorshipProject={isSponsorshipProject}
        hasProjectImage={hasProjectImage}
        onDownloadImage={onDownloadImage}
        onAssign={onAssign}
        onOpenOrphansModal={onOpenOrphansModal}
        onTransferToSupply={onTransferToSupply}
        getDivisionTextColor={getDivisionTextColor}
        getProjectDescription={getProjectDescription}
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

export default OrphanSponsorList;
