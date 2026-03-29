import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Pagination = ({
  filters,
  pagination,
  onPageChange,
  onPerPageChange,
  isFinishedProjectsPage = false,
  totalItems,
}) => {
  const isShowingAll = filters.perPage === 'all' || filters.perPage === 'الكل';
  const perPageNumber = typeof filters.perPage === 'number' ? filters.perPage : parseInt(filters.perPage) || 10;
  const itemsPerPage = isShowingAll ? (totalItems || 0) : perPageNumber;
  const currentPage = isShowingAll ? 1 : filters.page;
  const lastPage = isShowingAll ? 1 : (isFinishedProjectsPage && pagination?.last_page ? pagination.last_page : Math.ceil((totalItems || 0) / itemsPerPage));
  const startIndex = isShowingAll ? 1 : ((currentPage - 1) * itemsPerPage + 1);
  const endIndex = isShowingAll ? (totalItems || 0) : Math.min(currentPage * itemsPerPage, totalItems || 0);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm font-semibold text-gray-700 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
          عرض {startIndex} - {endIndex} من {totalItems || 0} نتيجة
        </p>

        <div className="flex items-center gap-2">
          <label htmlFor="perPageSelect" className="text-sm font-semibold text-gray-700 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>
            عدد العناصر:
          </label>
          <select
            id="perPageSelect"
            value={filters.perPage === 'all' ? 'all' : filters.perPage}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'all') {
                onPerPageChange('all');
              } else {
                onPerPageChange(Number(value));
              }
            }}
            className="px-4 py-2 text-sm border-2 border-gray-200 rounded-xl bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 cursor-pointer shadow-sm hover:shadow-md transition-all"
            style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            {!isFinishedProjectsPage && <option value="all">الكل (500)</option>}
          </select>
        </div>
      </div>

      {lastPage > 1 && !isShowingAll && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-3 rounded-xl bg-white hover:bg-sky-50 border-2 border-gray-200 hover:border-sky-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
          <span className="text-sm font-bold text-gray-800 bg-white px-5 py-3 rounded-xl shadow-sm border-2 border-gray-200 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
            صفحة {currentPage} من {lastPage}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === lastPage}
            className="p-3 rounded-xl bg-white hover:bg-sky-50 border-2 border-gray-200 hover:border-sky-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
