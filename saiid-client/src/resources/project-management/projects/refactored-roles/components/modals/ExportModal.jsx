import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, Filter } from 'lucide-react';
import ExcelJS from 'exceljs';
import { downloadWorkbookAsFile } from '../../../../../utils/excelDownload';

export const ExportModal = ({
  isOpen,
  onClose,
  projects,
  filters,
  projectTypes,
}) => {
  const [exportFilters, setExportFilters] = useState({
    includeImages: false,
    includeNotes: true,
    selectedStatuses: [],
    selectedTypes: [],
  });
  const [exporting, setExporting] = useState(false);

  const statuses = [
    'جديد',
    'قيد التوريد',
    'تم التوريد',
    'قيد التنفيذ',
    'تم التنفيذ',
    'مؤجل',
    'ملغى',
    'منتهي',
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'SAIID System';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('المشاريع', {
        properties: { tabColor: { argb: 'FF2563EB' } },
      });

      const headers = ['#', 'كود المشروع', 'اسم المشروع', 'الجهة المتبرعة', 'النوع', 'الحالة', 'تاريخ الإنشاء'];
      if (exportFilters.includeNotes) {
        headers.push('ملاحظات');
      }

      worksheet.addRow(headers);
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2563EB' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      let filteredProjects = [...projects];

      if (exportFilters.selectedStatuses.length > 0) {
        filteredProjects = filteredProjects.filter(p =>
          exportFilters.selectedStatuses.includes(p.status)
        );
      }

      if (exportFilters.selectedTypes.length > 0) {
        filteredProjects = filteredProjects.filter(p => {
          const type = p.project_type?.name_ar || p.project_type?.name || p.project_type;
          return exportFilters.selectedTypes.includes(type);
        });
      }

      filteredProjects.forEach((project, index) => {
        const row = [
          index + 1,
          project.project_code || project.code || '',
          project.project_name || project.description || '',
          project.donor_name || '',
          project.project_type?.name_ar || project.project_type?.name || project.project_type || '',
          project.status || '',
          project.created_at ? new Date(project.created_at).toLocaleDateString('ar-EG') : '',
        ];

        if (exportFilters.includeNotes) {
          row.push(project.notes || '');
        }

        worksheet.addRow(row);
      });

      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const length = cell.value?.toString()?.length || 0;
          if (length > maxLength) maxLength = length;
        });
        column.width = Math.min(Math.max(maxLength + 2, 15), 50);
      });

      const fileName = `projects-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadWorkbookAsFile(workbook, fileName);

      toast.success(`تم تصدير ${filteredProjects.length} مشروع بنجاح`);
      onClose();
    } catch (error) {
      console.error('Error exporting projects:', error);
      toast.error('فشل تصدير المشاريع');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            تصدير المشاريع
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline ml-1" />
              تصفية حسب الحالة
            </label>
            <div className="grid grid-cols-2 gap-2">
              {statuses.map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportFilters.selectedStatuses.includes(status)}
                    onChange={(e) => {
                      setExportFilters(prev => ({
                        ...prev,
                        selectedStatuses: e.target.checked
                          ? [...prev.selectedStatuses, status]
                          : prev.selectedStatuses.filter(s => s !== status),
                      }));
                    }}
                    className="rounded text-blue-500"
                  />
                  <span className="text-sm text-gray-600">{status}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline ml-1" />
              تصفية حسب النوع
            </label>
            <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2">
              {projectTypes.map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={exportFilters.selectedTypes.includes(type)}
                    onChange={(e) => {
                      setExportFilters(prev => ({
                        ...prev,
                        selectedTypes: e.target.checked
                          ? [...prev.selectedTypes, type]
                          : prev.selectedTypes.filter(t => t !== type),
                      }));
                    }}
                    className="rounded text-blue-500"
                  />
                  <span className="text-sm text-gray-600">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={exportFilters.includeNotes}
              onChange={(e) => setExportFilters(prev => ({ ...prev, includeNotes: e.target.checked }))}
              className="rounded text-blue-500"
            />
            <span className="text-sm text-gray-700">تضمين الملاحظات</span>
          </label>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-4">
              سيتم تصدير {projects.length} مشروع
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
              >
                إلغاء
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {exporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    جاري التصدير...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    تصدير Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
