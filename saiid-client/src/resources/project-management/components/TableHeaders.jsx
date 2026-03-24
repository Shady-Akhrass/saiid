import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const TableHeaders = ({
  isAdmin,
  isMediaManager,
  isProjectManager,
  isExecutedCoordinator,
  isOrphanSponsorCoordinator,
  isSupplyCoordinator,
  isMontageCoordinator,
  isPhotographer,
  isResearcher,
  sortConfig,
  handleSort,
}) => {
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const handleHeaderClick = (key) => {
    handleSort(key);
  };

  // Define columns based on the actual table structure
  const columns = [
    { key: 'project_code', label: 'الكود', sortable: true },
    { key: 'project_name', label: 'اسم المشروع', sortable: true },
    { key: 'description', label: 'الوصف', sortable: true },
    { key: 'donor_name', label: 'اسم المتبرع', sortable: true },
    { key: 'month_number', label: 'رقم الشهر', sortable: true },
    { key: 'status', label: 'الحالة', sortable: true },
    { key: 'assigned_photographer', label: 'المصور', sortable: true },
    { key: 'actions', label: 'الإجراءات', sortable: false },
  ];

  return (
    <tr>
      {columns.map((column) => (
        <th
          key={column.key}
          className={`text-center py-3 px-3 text-sm font-semibold text-gray-700 ${
            column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
          }`}
          style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}
          onClick={() => column.sortable && handleHeaderClick(column.key)}
        >
          <div className="flex items-center justify-center gap-2">
            {column.label}
            {column.sortable && getSortIcon(column.key)}
          </div>
        </th>
      ))}
    </tr>
  );
};

export default TableHeaders;
