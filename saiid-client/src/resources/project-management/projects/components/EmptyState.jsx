import React from 'react';
import { FileText } from 'lucide-react';

const EmptyState = ({ filters, loading, paginatedProjects }) => {
  if (paginatedProjects.length > 0 || loading) return null;

  return (
    <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl m-4">
      <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
        <FileText className="w-12 h-12 text-gray-400" />
      </div>
      <p className="text-gray-600 text-xl font-bold mb-3" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
        لا توجد مشاريع
      </p>
      <div className="text-gray-500 text-sm space-y-1 max-w-2xl mx-auto" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 400 }}>
        {Array.isArray(filters.status) && filters.status.length > 0 && (
          <p className="bg-blue-50 text-blue-700 inline-block px-4 py-2 rounded-lg font-medium mx-1">
            الحالات: {filters.status.join(', ')}
          </p>
        )}
        {Array.isArray(filters.project_type) && filters.project_type.length > 0 && (
          <p className="bg-purple-50 text-purple-700 inline-block px-4 py-2 rounded-lg font-medium mx-1">
            الأنواع: {filters.project_type.join(', ')}
          </p>
        )}
        {Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0 && (
          <p className="bg-green-50 text-green-700 inline-block px-4 py-2 rounded-lg font-medium mx-1">
            التفريعات: {filters.subcategory_id.length}
          </p>
        )}
        {filters.show_delayed_only && (
          <p className="bg-red-50 text-red-700 inline-block px-4 py-2 rounded-lg font-medium mx-1">
            المشاريع المتأخرة فقط
          </p>
        )}
        {filters.searchQuery && (
          <p className="bg-orange-50 text-orange-700 inline-block px-4 py-2 rounded-lg font-medium mx-1">
            البحث: {filters.searchQuery}
          </p>
        )}
        {(!Array.isArray(filters.status) || filters.status.length === 0) &&
         (!Array.isArray(filters.project_type) || filters.project_type.length === 0) &&
         (!Array.isArray(filters.subcategory_id) || filters.subcategory_id.length === 0) &&
         !filters.searchQuery && (
          <p className="text-gray-400">لا توجد فلترة نشطة</p>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
