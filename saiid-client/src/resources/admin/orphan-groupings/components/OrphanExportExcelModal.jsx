import React, { useState } from 'react';
import { X, FileSpreadsheet, Check, CheckSquare, Square, Download, Filter } from 'lucide-react';

const OrphanExportExcelModal = ({ isOpen, onClose, onExport }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedColumns, setSelectedColumns] = useState([
    'group_name', 'orphan_id', 'orphan_name', 'gender', 'birth_date', 'health', 'current_address', 'sponsorship_status'
  ]);

  const columnGroups = [
    {
      title: "البيانات الأساسية",
      columns: [
        { id: 'group_name', label: "اسم المجموعة" },
        { id: 'orphan_id', label: "رقم الهوية" },
        { id: 'orphan_name', label: "الاسم الكامل" },
        { id: 'gender', label: "الجنس" },
        { id: 'birth_date', label: "تاريخ الميلاد" },
        { id: 'num_brothers', label: "عدد الإخوة" },
        { id: 'num_sisters', label: "عدد الأخوات" },
        { id: 'in_memorization', label: "ملتحق بمركز تحفيظ" },
      ]
    },
    {
      title: "الموقع والحالة الصحية",
      columns: [
        { id: 'current_address', label: "العنوان الحالي" },
        { id: 'original_address', label: "العنوان الأصلي" },
        { id: 'address_details', label: "تفاصيل العنوان" },
        { id: 'governorate', label: "المحافظة (فلتر)" },
        { id: 'district', label: "المنطقة (فلتر)" },
        { id: 'health', label: "الحالة الصحية" },
        { id: 'disease_description', label: "وصف المرض" },
      ]
    },
    {
      title: "بيانات العائلة والوصي",
      columns: [
        { id: 'mother_name', label: "اسم الأم" },
        { id: 'mother_id', label: "رقم هوية الأم" },
        { id: 'mother_deceased', label: "هل الأم متوفاة" },
        { id: 'mother_birth', label: "تاريخ ميلاد الأم" },
        { id: 'mother_death', label: "تاريخ وفاة الأم" },
        { id: 'mother_job', label: "عمل الأم" },
        { id: 'father_name', label: "اسم الأب المتوفى" },
        { id: 'father_birth', label: "تاريخ ميلاد الأب" },
        { id: 'father_death', label: "تاريخ وفاة الأب" },
        { id: 'father_cause', label: "سبب الوفاة" },
        { id: 'father_job', label: "عمل الأب السابق" },
        { id: 'guardian_name', label: "اسم الوصي" },
        { id: 'guardian_id', label: "رقم هوية الوصي" },
        { id: 'guardian_relation', label: "صلة القرابة" },
        { id: 'phone', label: "رقم هاتف الوصي" },
        { id: 'alt_phone', label: "رقم هاتف بديل" },
        { id: 'approval_name', label: "معتمد البيانات" },
      ]
    },
    {
      title: "حالة الكفالة",
      columns: [
        { id: 'sponsorship_status', label: "حالة الكفالة (مكفول/غير مكفول)" },
      ]
    }
  ];

  if (!isOpen) return null;

  const toggleColumn = (id) => {
    if (selectedColumns.includes(id)) {
      setSelectedColumns(selectedColumns.filter(c => c !== id));
    } else {
      setSelectedColumns([...selectedColumns, id]);
    }
  };

  const selectAll = () => {
    const allIds = columnGroups.flatMap(g => g.columns.map(c => c.id));
    setSelectedColumns(allIds);
  };

  const selectNone = () => {
    setSelectedColumns([]);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">تخصيص تصدير Excel</h3>
              <p className="text-emerald-50/80 text-sm mt-0.5">حدد البيانات التي تريد تضمينها في الملف</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar">
          {/* Status Filter Section */}
          <div className="mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
            <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-5">
              <Download size={18} className="text-emerald-600" />
              فلترة حسب حالة الكفالة
            </h4>
            <div className="flex flex-wrap gap-4">
              {[
                { id: 'all', label: 'جميع الأيتام', icon: <CheckSquare size={16} /> },
                { id: 'sponsored', label: 'المكفولين فقط', icon: <Check size={16} /> },
                { id: 'not_sponsored', label: 'غير المكفولين فقط', icon: <X size={16} /> }
              ].map(option => (
                <button
                  key={option.id}
                  onClick={() => setStatusFilter(option.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold transition-all border ${
                    statusFilter === option.id 
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100 scale-[1.02]' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-emerald-200'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center mb-6 pb-4 border-bottom border-slate-100">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Filter size={18} className="text-emerald-600" />
              أعمدة البيانات
            </h4>
            <div className="flex gap-4 text-sm font-medium">
              <button 
                onClick={selectAll}
                className="text-emerald-600 hover:text-emerald-700 transition-colors underline decoration-dotted underline-offset-4"
              >
                تحديد الكل
              </button>
              <button 
                onClick={selectNone}
                className="text-slate-500 hover:text-slate-600 transition-colors underline decoration-dotted underline-offset-4"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
            {columnGroups.map((group, idx) => (
              <div key={idx} className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <h5 className="font-bold text-slate-700 text-sm tracking-wide">{group.title}</h5>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {group.columns.map(col => (
                    <label 
                      key={col.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                        selectedColumns.includes(col.id) 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-900 ring-1 ring-emerald-100' 
                          : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={selectedColumns.includes(col.id)}
                          onChange={() => toggleColumn(col.id)}
                        />
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          selectedColumns.includes(col.id) 
                            ? 'bg-emerald-600 border-emerald-600' 
                            : 'bg-white border-slate-300'
                        }`}>
                          {selectedColumns.includes(col.id) && <Check size={14} className="text-white" strokeWidth={3} />}
                        </div>
                      </div>
                      <span className="text-sm font-semibold">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
          <button
            onClick={() => onExport(selectedColumns, statusFilter)}
            disabled={selectedColumns.length === 0}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all shadow-sm ${
              selectedColumns.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Download size={20} />
            تصدير ملف Excel
          </button>
          <button
            onClick={onClose}
            className="px-8 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrphanExportExcelModal;
