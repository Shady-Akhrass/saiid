import React from 'react';
import { X, Download, Filter, ChevronDown, Users, Camera, Home, Calendar, CheckSquare, Square } from 'lucide-react';

const ExportFilterModal = ({
  isOpen,
  onClose,
  isDownloading,
  exportFilters,
  setExportFilters,
  setShowExportStatusDropdown,
  showExportStatusDropdown,
  exportStatusDropdownRef,
  PROJECT_STATUSES,
  setShowExportProjectTypeDropdown,
  showExportProjectTypeDropdown,
  exportProjectTypeDropdownRef,
  projectTypes,
  teams,
  photographers,
  shelters,
  governorates,
  districts,
  loadingFilterData,
  availableColumns,
  selectedColumns,
  toggleColumn,
  toggleAllColumns,
  resetExportFilters,
  handleConfirmExport
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !isDownloading && onClose()}
      />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Download className="w-6 h-6 text-green-600" />
            تصدير ملف Excel
          </h3>
          <button
            onClick={() => !isDownloading && onClose()}
            disabled={isDownloading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* ✅ حالة المشروع - اختيار متعدد في Export */}
          <div className="relative" ref={exportStatusDropdownRef}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              حالة المشروع
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportStatusDropdown(!showExportStatusDropdown)}
                disabled={isDownloading}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50 flex items-center justify-between"
              >
                <span className="text-gray-700">
                  {Array.isArray(exportFilters.status) && exportFilters.status.length > 0
                    ? `${exportFilters.status.length} محدد`
                    : 'جميع الحالات'
                  }
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {showExportStatusDropdown && !isDownloading && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-2">
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Array.isArray(exportFilters.status) && exportFilters.status.length === 0}
                        onChange={() => setExportFilters({ ...exportFilters, status: [] })}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">جميع الحالات</span>
                    </label>
                    {PROJECT_STATUSES.map((status) => (
                      <label key={status} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Array.isArray(exportFilters.status) && exportFilters.status.includes(status)}
                          onChange={(e) => {
                            const currentStatuses = Array.isArray(exportFilters.status) ? exportFilters.status : [];
                            const newStatuses = e.target.checked
                              ? [...currentStatuses, status]
                              : currentStatuses.filter(s => s !== status);
                            setExportFilters({ ...exportFilters, status: newStatuses });
                          }}
                          className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ✅ نوع المشروع - اختيار متعدد في Export */}
          <div className="relative" ref={exportProjectTypeDropdownRef}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              نوع المشروع
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportProjectTypeDropdown(!showExportProjectTypeDropdown)}
                disabled={isDownloading}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50 flex items-center justify-between"
              >
                <span className="text-gray-700">
                  {Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0
                    ? `${exportFilters.project_type.length} محدد`
                    : 'جميع الأنواع'
                  }
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {showExportProjectTypeDropdown && !isDownloading && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-2">
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Array.isArray(exportFilters.project_type) && exportFilters.project_type.length === 0}
                        onChange={() => setExportFilters({ ...exportFilters, project_type: [] })}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">جميع الأنواع</span>
                    </label>
                    {projectTypes.map((type) => (
                      <label key={type} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Array.isArray(exportFilters.project_type) && exportFilters.project_type.includes(type)}
                          onChange={(e) => {
                            const currentTypes = Array.isArray(exportFilters.project_type) ? exportFilters.project_type : [];
                            const newTypes = e.target.checked
                              ? [...currentTypes, type]
                              : currentTypes.filter(t => t !== type);
                            setExportFilters({ ...exportFilters, project_type: newTypes });
                          }}
                          className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              تاريخ التنفيذ
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={exportFilters.startDate}
                  onChange={(e) => setExportFilters({ ...exportFilters, startDate: e.target.value })}
                  disabled={isDownloading}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={exportFilters.endDate}
                  onChange={(e) => setExportFilters({ ...exportFilters, endDate: e.target.value })}
                  disabled={isDownloading}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* ✅ الفلاتر المتقدمة */}
          <div className="border-t-2 border-gray-200 pt-4">
            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-purple-600" />
              فلترة متقدمة
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* الفريق */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  الفريق المكلف
                </label>
                <select
                  value={exportFilters.team_id}
                  onChange={(e) => setExportFilters({ ...exportFilters, team_id: e.target.value })}
                  disabled={isDownloading || loadingFilterData}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                >
                  <option value="">جميع الفرق</option>
                  {teams.map(team => (
                    <option key={team.id || team._id} value={team.id || team._id}>
                      {team.team_name || team.name || '-'}
                    </option>
                  ))}
                </select>
              </div>

              {/* المصور */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  المصور
                </label>
                <select
                  value={exportFilters.photographer_id}
                  onChange={(e) => setExportFilters({ ...exportFilters, photographer_id: e.target.value })}
                  disabled={isDownloading || loadingFilterData}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                >
                  <option value="">جميع المصورين</option>
                  {photographers.map(photographer => (
                    <option key={photographer.id || photographer._id} value={photographer.id || photographer._id}>
                      {photographer.name || photographer.full_name || '-'}
                    </option>
                  ))}
                </select>
              </div>

              {/* المخيم */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  المخيم
                </label>
                <select
                  value={exportFilters.shelter_id}
                  onChange={(e) => setExportFilters({ ...exportFilters, shelter_id: e.target.value })}
                  disabled={isDownloading || loadingFilterData}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                >
                  <option value="">جميع المخيمات</option>
                  {shelters.map(shelter => (
                    <option key={shelter.id || shelter._id} value={shelter.id || shelter._id}>
                      {shelter.camp_name || shelter.name || shelter.manager_id_number || '-'}
                    </option>
                  ))}
                </select>
              </div>

              {/* المحافظة */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  المحافظة
                </label>
                <select
                  value={exportFilters.governorate}
                  onChange={(e) => setExportFilters({ ...exportFilters, governorate: e.target.value, district: '' })}
                  disabled={isDownloading || loadingFilterData}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                >
                  <option value="">جميع المحافظات</option>
                  {governorates.map(gov => (
                    <option key={gov} value={gov}>{gov}</option>
                  ))}
                </select>
              </div>

              {/* المنطقة */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  المنطقة
                </label>
                <select
                  value={exportFilters.district}
                  onChange={(e) => setExportFilters({ ...exportFilters, district: e.target.value })}
                  disabled={isDownloading || loadingFilterData || !exportFilters.governorate}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                >
                  <option value="">جميع المناطق</option>
                  {districts.map(district => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>

              {/* اسم المتبرع */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  اسم المتبرع
                </label>
                <input
                  type="text"
                  value={exportFilters.donor_name}
                  onChange={(e) => setExportFilters({ ...exportFilters, donor_name: e.target.value })}
                  disabled={isDownloading}
                  placeholder="ابحث عن اسم المتبرع..."
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                />
              </div>

              {/* كود المتبرع */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  كود المتبرع
                </label>
                <input
                  type="text"
                  value={exportFilters.donor_code}
                  onChange={(e) => setExportFilters({ ...exportFilters, donor_code: e.target.value })}
                  disabled={isDownloading}
                  placeholder="ابحث عن كود المتبرع..."
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                />
              </div>

              {/* نطاق الكمية */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  نطاق الكمية
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={exportFilters.quantity_min}
                    onChange={(e) => setExportFilters({ ...exportFilters, quantity_min: e.target.value })}
                    disabled={isDownloading}
                    placeholder="الحد الأدنى"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min="0"
                    value={exportFilters.quantity_max}
                    onChange={(e) => setExportFilters({ ...exportFilters, quantity_max: e.target.value })}
                    disabled={isDownloading}
                    placeholder="الحد الأقصى"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                  />
                </div>
              </div>

              {/* نطاق التكلفة */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  نطاق التكلفة
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={exportFilters.cost_min}
                    onChange={(e) => setExportFilters({ ...exportFilters, cost_min: e.target.value })}
                    disabled={isDownloading}
                    placeholder="الحد الأدنى"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={exportFilters.cost_max}
                    onChange={(e) => setExportFilters({ ...exportFilters, cost_max: e.target.value })}
                    disabled={isDownloading}
                    placeholder="الحد الأقصى"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                  />
                </div>
              </div>

              {/* تاريخ الإنشاء */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  تاريخ الإنشاء
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={exportFilters.created_at_start}
                    onChange={(e) => setExportFilters({ ...exportFilters, created_at_start: e.target.value })}
                    disabled={isDownloading}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                  />
                  <input
                    type="date"
                    value={exportFilters.created_at_end}
                    onChange={(e) => setExportFilters({ ...exportFilters, created_at_end: e.target.value })}
                    disabled={isDownloading}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                  />
                </div>
              </div>

              {/* تاريخ التحديث */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  تاريخ التحديث
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={exportFilters.updated_at_start}
                    onChange={(e) => setExportFilters({ ...exportFilters, updated_at_start: e.target.value })}
                    disabled={isDownloading}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                  />
                  <input
                    type="date"
                    value={exportFilters.updated_at_end}
                    onChange={(e) => setExportFilters({ ...exportFilters, updated_at_end: e.target.value })}
                    disabled={isDownloading}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right transition-all outline-none focus:border-green-400 focus:bg-white focus:shadow-lg disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ✅ اختيار الأعمدة */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-blue-800">
                اختيار الأعمدة للتصدير:
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAllColumns(true)}
                  disabled={isDownloading}
                  className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllColumns(false)}
                  disabled={isDownloading}
                  className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  إلغاء الكل
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {availableColumns.map(column => (
                <label
                  key={column.key}
                  className="flex items-center gap-2 p-2 bg-white rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={(e) => {
                    if (e.target.type === 'checkbox') {
                      e.stopPropagation();
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column.key)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleColumn(column.key);
                    }}
                    disabled={isDownloading}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-gray-700">{column.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-2">
              تم اختيار {selectedColumns.length} من {availableColumns.length} عمود
            </p>
          </div>

          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-800 mb-2">
              الفلاتر المحددة:
            </p>
            <div className="flex flex-wrap gap-2">
              {exportFilters.status && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  الحالة: {exportFilters.status}
                </span>
              )}
              {Array.isArray(exportFilters.project_type) && exportFilters.project_type.length > 0 && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  الأنواع: {exportFilters.project_type.join(', ')}
                </span>
              )}
              {exportFilters.startDate && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  تنفيذ من: {exportFilters.startDate}
                </span>
              )}
              {exportFilters.endDate && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  تنفيذ إلى: {exportFilters.endDate}
                </span>
              )}
              {exportFilters.team_id && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  الفريق: {teams.find(t => (t.id || t._id) == exportFilters.team_id)?.team_name || exportFilters.team_id}
                </span>
              )}
              {exportFilters.photographer_id && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  المصور: {photographers.find(p => (p.id || p._id) == exportFilters.photographer_id)?.name || exportFilters.photographer_id}
                </span>
              )}
              {exportFilters.shelter_id && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  المخيم: {shelters.find(s => (s.id || s._id) == exportFilters.shelter_id)?.camp_name || exportFilters.shelter_id}
                </span>
              )}
              {exportFilters.governorate && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  المحافظة: {exportFilters.governorate}
                </span>
              )}
              {exportFilters.district && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  المنطقة: {exportFilters.district}
                </span>
              )}
              {exportFilters.donor_name && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  المتبرع: {exportFilters.donor_name}
                </span>
              )}
              {exportFilters.donor_code && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  كود المتبرع: {exportFilters.donor_code}
                </span>
              )}
              {(exportFilters.quantity_min || exportFilters.quantity_max) && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  الكمية: {exportFilters.quantity_min || '0'} - {exportFilters.quantity_max || '∞'}
                </span>
              )}
              {(exportFilters.cost_min || exportFilters.cost_max) && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  التكلفة: {exportFilters.cost_min || '0'} - {exportFilters.cost_max || '∞'}
                </span>
              )}
              {exportFilters.created_at_start && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  إنشاء من: {exportFilters.created_at_start}
                </span>
              )}
              {exportFilters.created_at_end && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  إنشاء إلى: {exportFilters.created_at_end}
                </span>
              )}
              {exportFilters.updated_at_start && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  تحديث من: {exportFilters.updated_at_start}
                </span>
              )}
              {exportFilters.updated_at_end && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  تحديث إلى: {exportFilters.updated_at_end}
                </span>
              )}
              {!exportFilters.status && (!Array.isArray(exportFilters.project_type) || exportFilters.project_type.length === 0) && !exportFilters.startDate && !exportFilters.endDate &&
                !exportFilters.team_id && !exportFilters.photographer_id && !exportFilters.shelter_id &&
                !exportFilters.governorate && !exportFilters.district && !exportFilters.donor_name &&
                !exportFilters.donor_code && !exportFilters.quantity_min && !exportFilters.quantity_max &&
                !exportFilters.cost_min && !exportFilters.cost_max && !exportFilters.created_at_start &&
                !exportFilters.created_at_end && !exportFilters.updated_at_start && !exportFilters.updated_at_end && (
                  <span className="text-xs text-gray-500">لا توجد فلاتر محددة - سيتم تصدير جميع المشاريع</span>
                )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={resetExportFilters}
              disabled={isDownloading}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              مسح الفلاتر
            </button>
            <button
              onClick={() => onClose()}
              disabled={isDownloading}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirmExport}
              disabled={isDownloading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  جاري التصدير...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  تصدير
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportFilterModal;
