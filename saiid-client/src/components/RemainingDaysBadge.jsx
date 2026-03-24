import React from 'react';

/**
 * Component to display remaining days or delay status for projects
 * يستخدم البيانات من Backend: remaining_days, is_delayed, delayed_days
 */
const RemainingDaysBadge = ({ project }) => {
  // ✅ إذا كان المشروع منتهي، إيقاف العداد
  if (project.status === 'منتهي') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
        ✓ منتهي
      </span>
    );
  }

  // إذا لم تكن البيانات متاحة من Backend
  if (project.remaining_days === null || project.remaining_days === undefined) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 border border-gray-300">
        -
      </span>
    );
  }

  // إذا كان المشروع متأخراً
  if (project.is_delayed) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
        ⚠️ متأخر بـ {project.delayed_days} يوم
      </span>
    );
  }

  // إذا كان المشروع في الوقت المحدد
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
      {project.remaining_days} يوم متبقي
    </span>
  );
};

export default RemainingDaysBadge;

