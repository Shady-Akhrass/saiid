import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

const TableHeaders = ({
  isAdmin,
  isMediaManager,
  isProjectManager,
  isExecutedCoordinator,
  isOrphanSponsorCoordinator,
  sortConfig,
  handleSort
}) => {
  if (isAdmin || isMediaManager) {
    return (
      <tr>
        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>كود المشروع</th>
        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الاسم</th>
        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>اسم المتبرع</th>
        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الوصف</th>
        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>المبلغ قبل الخصم</th>
        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>المبلغ بعد التحويل</th>
        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>المبلغ الصافي</th>
        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>حالة المشروع</th>
        <th className="text-right py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الأيام المتبقية للتنفيذ</th>
        <th className="text-center py-3 px-3 text-sm font-bold text-gray-800 whitespace-nowrap" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>الخيارات</th>
      </tr>
    );
  }

  if (isProjectManager) {
    return (
      <tr>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>كود المشروع</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الاسم</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اليوم</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اسم المتبرع</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>التفاصيل</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>المبلغ الصافي للتنفيذ</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>حالة المشروع</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الأيام المتبقية للتنفيذ</th>
        <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الإجراءات</th>
      </tr>
    );
  }

  if (isExecutedCoordinator) {
    return (
      <tr>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الكود</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الوصف</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الفريق المكلف</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>المصور</th>
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الحالة</th>
        <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الإجراءات</th>
      </tr>
    );
  }

  return (
    <tr>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الكود</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اسم المشروع</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الوصف</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>اسم المتبرع</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>رقم الشهر</th>
      <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الحالة</th>
      {!isOrphanSponsorCoordinator && (
        <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>الفريق المكلف</th>
      )}
      <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}>المصور</th>
      <th
        className="text-right py-4 px-6 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
        style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}
        onClick={() => handleSort('created_at')}
      >
        <div className="flex items-center justify-end gap-2">
          <span>تاريخ التسجيل</span>
          {sortConfig.key === 'created_at' && (
            sortConfig.direction === 'asc' ? (
              <ArrowUp className="w-4 h-4 text-sky-600" />
            ) : (
              <ArrowDown className="w-4 h-4 text-sky-600" />
            )
          )}
        </div>
      </th>
      {!isOrphanSponsorCoordinator && (
        <th
          className="text-right py-4 px-6 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
          onClick={() => handleSort('updated_at')}
        >
          <div className="flex items-center justify-end gap-2">
            <span>تاريخ التحديث</span>
            {sortConfig.key === 'updated_at' && (
              sortConfig.direction === 'asc' ? (
                <ArrowUp className="w-4 h-4 text-sky-600" />
              ) : (
                <ArrowDown className="w-4 h-4 text-sky-600" />
              )
            )}
          </div>
        </th>
      )}
      <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">الإجراءات</th>
    </tr>
  );
};

export default TableHeaders;
