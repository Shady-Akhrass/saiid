import React from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Info, X } from 'lucide-react';

const ProjectFilters = ({
  showFilters,
  setShowFilters,
  filters,
  handleFilterChange,
  clearFilters,
  handleSearchChange,
  handleSearchSubmit,
  handleSearchButtonClick,
  searchInput,
  projectTypes,
  projectTypesLoading,
  filteredSubcategories,
  subcategoriesLoading,
  researchers,
  photographers,
  producers,
  loadingFilterLists,
  parentProjectOptions,
  isOrphanSponsorCoordinator,
  isProjectManager,
  isMediaManager,
  isAdmin,
  showStatusDropdown,
  setShowStatusDropdown,
  showProjectTypeDropdown,
  setShowProjectTypeDropdown,
  showSubcategoryDropdown,
  setShowSubcategoryDropdown,
  showMonthlyPhasesHelp,
  setShowMonthlyPhasesHelp,
  PROJECT_STATUSES
}) => {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-xl border border-gray-100">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative group flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-sky-600 w-5 h-5 transition-colors" />
            <input
              type="text"
              placeholder="بحث في اسم المشروع، الوصف، اسم المتبرع، كود المتبرع، الكود الداخلي... (اضغط Enter)"
              value={searchInput}
              onChange={handleSearchChange}
              onKeyDown={handleSearchSubmit}
              className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all duration-300 text-gray-800 font-medium placeholder-gray-400"
              style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}
            />
          </div>
          <button
            onClick={handleSearchButtonClick}
            className="px-6 py-4 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
            style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}
            title="بحث"
          >
            <Search className="w-5 h-5" />
            بحث
          </button>
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`bg-gradient-to-r ${showFilters ? 'from-sky-500 to-blue-600 text-white' : 'from-gray-100 to-gray-200 text-gray-700'} hover:shadow-lg px-8 py-4 rounded-2xl font-semibold flex items-center gap-2 transition-all duration-300 transform hover:-translate-y-0.5`}
          style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 600 }}
        >
          <Filter className="w-5 h-5" />
          {showFilters ? 'إخفاء الفلاتر' : 'فلترة'}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="pt-5 mt-5 border-t-2 border-gray-200">
          {/* آلية عرض الدفعات الشهرية (لمنسق الكفالات فقط) */}
          {isOrphanSponsorCoordinator && (
            <div className="mb-4 rounded-2xl border-2 border-sky-100 bg-sky-50/80 p-4">
              <button
                type="button"
                onClick={() => setShowMonthlyPhasesHelp(!showMonthlyPhasesHelp)}
                className="w-full flex items-center justify-between gap-2 text-right hover:bg-sky-100/50 rounded-xl py-2 px-3 -mx-1 transition-colors"
              >
                <span className="flex items-center gap-2 text-sky-800 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <Info className="w-5 h-5 text-sky-600 shrink-0" />
                  آلية عرض الدفعات الشهرية
                </span>
                {showMonthlyPhasesHelp ? <ChevronUp className="w-5 h-5 text-sky-600" /> : <ChevronDown className="w-5 h-5 text-sky-600" />}
              </button>
              {showMonthlyPhasesHelp && (
                <div className="mt-3 pt-3 border-t border-sky-200 text-sm text-gray-700 space-y-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <p className="font-semibold text-sky-900">
                    يعتمد عرض الدفعات على <strong>تاريخ بداية المراحل</strong> للمشروع، وليس على تاريخ إدخال المشروع فقط.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li><strong>الشهر 1</strong> = شهر بداية المراحل (أول دفعة)</li>
                    <li><strong>الشهر 2</strong> = الشهر التالي (ثاني دفعة)، وهكذا.</li>
                    <li>لا تظهر أي دفعة قبل شهر الانطلاق الفعلي للمشروع.</li>
                  </ul>
                  <p className="text-gray-600">
                    مثال: إذا كانت بداية المراحل في <strong>فبراير</strong>، ففي فبراير تظهر <strong>الدفعة الأولى</strong>، وفي مارس <strong>الدفعة الثانية</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* حالة المشروع - اختيار متعدد */}
            <div className="relative">
              <label className="block text-sm font-bold text-gray-800 mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                الحالة
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-right flex items-center justify-between bg-white hover:border-sky-300 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                >
                  <span className={`${Array.isArray(filters.status) && filters.status.length > 0 ? 'text-sky-600 font-bold' : 'text-gray-600'}`}>
                    {Array.isArray(filters.status) && filters.status.length > 0
                      ? `${filters.status.length} محددة`
                      : 'الكل'
                    }
                  </span>
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                </button>

                {showStatusDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2">
                      <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Array.isArray(filters.status) && filters.status.length === 0}
                          onChange={() => handleFilterChange('status', [])}
                          className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                        />
                        <span className="text-sm text-gray-800 font-semibold">جميع الحالات</span>
                      </label>
                      {PROJECT_STATUSES.map((status) => (
                        <label key={status} className="flex items-center gap-2 px-3 py-2 hover:bg-sky-50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={Array.isArray(filters.status) && filters.status.includes(status)}
                            onChange={(e) => {
                              const currentStatus = Array.isArray(filters.status) ? filters.status : [];
                              if (e.target.checked) {
                                handleFilterChange('status', [...currentStatus, status]);
                              } else {
                                handleFilterChange('status', currentStatus.filter(s => s !== status));
                              }
                            }}
                            className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                          />
                          <span className="text-sm text-gray-700">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* نوع المشروع - اختيار متعدد */}
            {!isOrphanSponsorCoordinator && (
              <div className="relative">
                <label className="block text-sm font-bold text-gray-800 mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                  نوع المشروع
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProjectTypeDropdown(!showProjectTypeDropdown)}
                    disabled={projectTypesLoading}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 text-right flex items-center justify-between bg-white hover:border-sky-300 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                  >
                    <span className={`${Array.isArray(filters.project_type) && filters.project_type.length > 0 ? 'text-sky-600 font-bold' : 'text-gray-600'}`}>
                      {Array.isArray(filters.project_type) && filters.project_type.length > 0
                        ? `${filters.project_type.length} محدد`
                        : 'الكل'
                      }
                    </span>
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  </button>

                  {showProjectTypeDropdown && !projectTypesLoading && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Array.isArray(filters.project_type) && filters.project_type.length === 0}
                            onChange={() => handleFilterChange('project_type', [])}
                            className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                          />
                          <span className="text-sm text-gray-700 font-medium">الكل</span>
                        </label>
                        {projectTypes.map((type) => {
                          const typeLabel = typeof type === 'object' ? type.name_ar || type.name || type.name_en || String(type.id) : String(type);
                          const typeValue = typeof type === 'object' ? type.id || type.name_ar || type.name || type.name_en : type;
                          return (
                          <label key={String(typeValue)} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Array.isArray(filters.project_type) && filters.project_type.includes(String(typeValue))}
                              onChange={(e) => {
                                const currentTypes = Array.isArray(filters.project_type) ? filters.project_type : [];
                                const newTypes = e.target.checked
                                  ? [...currentTypes, String(typeValue)]
                                  : currentTypes.filter(t => t !== String(typeValue));
                                handleFilterChange('project_type', newTypes);
                              }}
                              className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                            />
                            <span className="text-sm text-gray-700">{typeLabel}</span>
                          </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* التفريعة - اختيار متعدد */}
            {!isOrphanSponsorCoordinator && (
              <div className="relative">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  التفريعة
                  {filters.project_type.length > 0 && (
                    <span className="text-xs font-normal text-gray-500 mr-2">
                      ({filteredSubcategories.length} متاحة)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSubcategoryDropdown(!showSubcategoryDropdown)}
                    disabled={subcategoriesLoading}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 text-right flex items-center justify-between bg-white hover:border-sky-300 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                  >
                    <span className={`${Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0 ? 'text-sky-600 font-bold' : 'text-gray-600'}`}>
                      {Array.isArray(filters.subcategory_id) && filters.subcategory_id.length > 0
                        ? `${filters.subcategory_id.length} محدد`
                        : 'الكل'
                      }
                    </span>
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  </button>

                  {showSubcategoryDropdown && !subcategoriesLoading && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Array.isArray(filters.subcategory_id) && filters.subcategory_id.length === 0}
                            onChange={() => handleFilterChange('subcategory_id', [])}
                            className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                          />
                          <span className="text-sm text-gray-700 font-medium">الكل</span>
                        </label>
                        {filteredSubcategories.length === 0 && filters.project_type.length > 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500 text-center">
                            لا توجد تفريعات لنوع المشروع المختار
                          </div>
                        ) : (
                          filteredSubcategories.map((subcategory) => (
                            <label key={subcategory.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Array.isArray(filters.subcategory_id) && filters.subcategory_id.includes(String(subcategory.id))}
                                onChange={(e) => {
                                  const currentIds = Array.isArray(filters.subcategory_id) ? filters.subcategory_id : [];
                                  const subcatId = String(subcategory.id);
                                  const newIds = e.target.checked
                                    ? [...currentIds, subcatId]
                                    : currentIds.filter(id => id !== subcatId);
                                  handleFilterChange('subcategory_id', newIds);
                                }}
                                className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                              />
                              <span className="text-sm text-gray-700">
                                {subcategory.name_ar || subcategory.name || `التفريعة ${subcategory.id}`}
                                {subcategory.project_type && (
                                  <span className="text-xs text-gray-400 mr-1">({typeof subcategory.project_type === 'object' ? subcategory.project_type.name_ar || subcategory.project_type.name : subcategory.project_type})</span>
                                )}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isOrphanSponsorCoordinator && (
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                  الباحث
                </label>
                <select
                  value={filters.researcher_id}
                  onChange={(e) => handleFilterChange('researcher_id', e.target.value)}
                  disabled={loadingFilterLists}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                  style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}
                >
                  <option value="">الكل</option>
                  {researchers.map((researcher) => (
                    <option key={researcher.id} value={researcher.id}>
                      {researcher.name || researcher.email || `الباحث ${researcher.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                المصور
              </label>
              <select
                value={filters.photographer_id}
                onChange={(e) => handleFilterChange('photographer_id', e.target.value)}
                disabled={loadingFilterLists}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500 }}
              >
                <option value="">الكل</option>
                {photographers.map((photographer) => (
                  <option key={photographer.id} value={photographer.id}>
                    {photographer.name || photographer.email || `المصور ${photographer.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* فلتر الممنتج (لدور الإعلام فقط) */}
            {isMediaManager && (
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                  الممنتج
                </label>
                <select
                  value={filters.producer_id}
                  onChange={(e) => handleFilterChange('producer_id', e.target.value)}
                  disabled={loadingFilterLists}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                >
                  <option value="">الكل</option>
                  {producers.map((producer) => (
                    <option key={producer.id} value={producer.id}>
                      {producer.name || producer.email || `الممنتج ${producer.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* فلتر الشهر: لا يُعرض لمنسق الكفالة */}
            {!isOrphanSponsorCoordinator && (
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  الشهر
                </label>
                <select
                  value={filters.month_number}
                  onChange={(e) => handleFilterChange('month_number', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                >
                  <option value="">الكل</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      الشهر {month}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isOrphanSponsorCoordinator && (
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  رقم اليوم (للمشاريع اليومية)
                </label>
                <input
                  type="number"
                  min="1"
                  value={filters.phase_day}
                  onChange={(e) => handleFilterChange('phase_day', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                  placeholder="مثال: 5"
                />
              </div>
            )}

            {!isOrphanSponsorCoordinator && (
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  المشروع الأصلي
                </label>
                <select
                  value={filters.parent_project_id}
                  onChange={(e) => handleFilterChange('parent_project_id', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all shadow-sm hover:shadow-md font-medium text-gray-700"
                >
                  <option value="">الكل</option>
                  {parentProjectOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* فلتر المشاريع المتأخرة - مخفي عن منسق الكفالات */}
            {!isOrphanSponsorCoordinator && (
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.show_delayed_only}
                      onChange={(e) => handleFilterChange('show_delayed_only', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-300 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-red-500 peer-checked:to-orange-500 transition-all duration-300 shadow-inner"></div>
                    <div className="absolute right-0.5 top-0.5 bg-white w-6 h-6 rounded-full transition-transform duration-300 peer-checked:translate-x-[-28px] shadow-md"></div>
                  </div>
                  <span className="text-sm font-bold text-gray-800 group-hover:text-red-600 transition-colors" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                    المشاريع المتأخرة فقط
                  </span>
                </label>
              </div>
            )}

            {/* فلتر المشاريع العاجلة */}
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={filters.show_urgent_only}
                    onChange={(e) => handleFilterChange('show_urgent_only', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-300 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-amber-500 peer-checked:to-yellow-500 transition-all duration-300 shadow-inner"></div>
                  <div className="absolute right-0.5 top-0.5 bg-white w-6 h-6 rounded-full transition-transform duration-300 peer-checked:translate-x-[-28px] shadow-md"></div>
                </div>
                <span className="text-sm font-bold text-gray-800 group-hover:text-amber-600 transition-colors" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                  المشاريع العاجلة فقط
                </span>
              </label>
            </div>

            {/* فلتر: المشاريع الفرعية فقط (لمدير المشاريع) */}
            {isProjectManager && (
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.show_sub_projects_only}
                      onChange={(e) => handleFilterChange('show_sub_projects_only', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-300 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600 transition-all duration-300 shadow-inner"></div>
                    <div className="absolute right-0.5 top-0.5 bg-white w-6 h-6 rounded-full transition-transform duration-300 peer-checked:translate-x-[-28px] shadow-md"></div>
                  </div>
                  <span className="text-sm font-bold text-gray-800 group-hover:text-purple-600 transition-colors" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                    المشاريع الفرعية فقط
                  </span>
                </label>
              </div>
            )}

            {/* فلتر المشاريع الأصلية المقسمة فقط (للإدارة) */}
            {isAdmin && (
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.show_divided_parents_only}
                      onChange={(e) => handleFilterChange('show_divided_parents_only', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-300 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-sky-500 peer-checked:to-blue-600 transition-all duration-300 shadow-inner"></div>
                    <div className="absolute right-0.5 top-0.5 bg-white w-6 h-6 rounded-full transition-transform duration-300 peer-checked:translate-x-[-28px] shadow-md"></div>
                  </div>
                  <span className="text-sm font-bold text-gray-800 group-hover:text-sky-600 transition-colors" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                    المشاريع الأصلية المقسمة فقط
                  </span>
                </label>
              </div>
            )}

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
              >
                <X className="w-5 h-5" />
                مسح الفلاتر
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectFilters;
