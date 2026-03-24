/**
 * تحميل مصنف Excel في المتصفح (بديل آمن عن xlsx/SheetJS)
 * @param {import('exceljs').Workbook} workbook - مصنف ExcelJS
 * @param {string} filename - اسم الملف (بدون أو مع .xlsx)
 */
export async function downloadWorkbookAsFile(workbook, filename) {
  const name = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
