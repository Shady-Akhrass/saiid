import React from 'react';
import { ShoppingCart, X, Search, UserCheck } from 'lucide-react';

const SupplyModal = ({
  isOpen,
  onClose,
  project,
  isOrphanSponsorCoordinator,
  getProjectCode,
  getAvailableAmountInfo,
  setIsEditingShekel,
  setExchangeRate,
  setTransferDiscountPercentage,
  setShowShekelModal,
  warehouseSearchQuery,
  setWarehouseSearchQuery,
  loadingWarehouse,
  warehouseItems,
  handleAddToCart,
  addingItem,
  cartItems,
  handleRemoveFromCart,
  projectQuantity,
  surplusCategories,
  selectedSurplusCategoryId,
  setSelectedSurplusCategoryId,
  handleConfirmSupply,
  confirmingSupply,
  isProjectManager,
  canAssignResearcherAfterSupply,
  setSupplyModalOpen,
  setSelectedProject,
  setAssignModalOpen,
  setCartItems
}) => {
  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                {isOrphanSponsorCoordinator ? 'قيمة الكفالة' : 'التسوق من المخزن'}
              </h3>
              <p className="text-indigo-100 text-sm mt-1">
                المشروع: {getProjectCode(project, project.id?.toString() || '---')}
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                setCartItems([]);
                setWarehouseSearchQuery('');
                setSelectedSurplusCategoryId('');
                setShowShekelModal(false);
                setExchangeRate('');
                setTransferDiscountPercentage(0);
              }}
              className="text-white hover:text-indigo-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* معلومات المشروع */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            {(() => {
              const amountInfo = getAvailableAmountInfo(project);
              const needsConversion = !project?.shekel_exchange_rate;

              return (
                <div className="bg-white/10 rounded-lg p-3">
                  <span className="text-indigo-200">المبلغ المتاح للتوريد {amountInfo.currency === 'ILS' ? '(شيكل)' : '(دولار)'}:</span>
                  {needsConversion ? (
                    <div className="mt-1">
                      <span className="block font-bold text-lg text-red-300">غير محول</span>
                      <button
                        onClick={() => {
                          setIsEditingShekel(false);
                          setExchangeRate('');
                          setTransferDiscountPercentage(0);
                          setShowShekelModal(true);
                        }}
                        className="mt-2 text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                      >
                        تحويل للشيكل
                      </button>
                    </div>
                  ) : (
                    <span className="block font-bold text-lg">
                      {amountInfo.symbol}{parseFloat(String(amountInfo.amount || 0)).toFixed(2)}
                    </span>
                  )}
                </div>
              );
            })()}
            <div className="bg-white/10 rounded-lg p-3">
              <span className="text-indigo-200">الحالة:</span>
              <span className="block font-bold">{project.status}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* أصناف المخزن */}
            <div>
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                📦 {isOrphanSponsorCoordinator ? 'قيمة الكفالة' : 'أصناف المخزن المتوفرة'}
              </h4>

              {/* حقل البحث - مخفي لمنسق الكفالة */}
              {!isOrphanSponsorCoordinator && (
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={warehouseSearchQuery}
                      onChange={(e) => setWarehouseSearchQuery(e.target.value)}
                      placeholder="ابحث عن صنف..."
                      className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {loadingWarehouse ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                  <p className="text-gray-500 mt-2">جاري التحميل...</p>
                </div>
              ) : (() => {
                const filteredItems = isOrphanSponsorCoordinator
                  ? warehouseItems 
                  : warehouseItems.filter(item => {
                    if (!warehouseSearchQuery.trim()) return true;
                    const searchLower = warehouseSearchQuery.toLowerCase().trim();
                    const itemName = (item.item_name || '').toLowerCase();
                    return itemName.includes(searchLower);
                  });

                if (filteredItems.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      {warehouseSearchQuery.trim()
                        ? `لا توجد أصناف تطابق "${warehouseSearchQuery}"`
                        : 'لا توجد أصناف في المخزن'
                      }
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredItems.map(item => (
                      <div key={item.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{item.item_name}</p>
                          <p className="text-xs text-gray-500">
                            متوفر: {item.quantity_available} | السعر: {(() => {
                              const amountInfo = getAvailableAmountInfo(project);
                              return `${amountInfo.symbol}${parseFloat(item.unit_price || 0).toFixed(2)}`;
                            })()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="الكمية"
                            className="w-20 px-2 py-1 border rounded text-sm"
                            id={`qty-${item.id}`}
                          />
                          <button
                            onClick={() => {
                              const qty = document.getElementById(`qty-${item.id}`).value;
                              handleAddToCart(item, qty);
                            }}
                            disabled={addingItem}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* السلة */}
            <div>
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                {isOrphanSponsorCoordinator ? 'قيمة الكفالة' : '  '}
              </h4>
              {cartItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  السلة فارغة
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {cartItems.map(item => (
                    <div key={item.id} className="bg-green-50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{item.warehouse_item?.item_name || item.item_name}</p>
                        <p className="text-xs text-gray-500">
                          الكمية: {item.quantity_per_unit} × {item.unit_price} = {(() => {
                            const amountInfo = getAvailableAmountInfo(project);
                            return `${amountInfo.symbol}${parseFloat(item.total_price_per_unit || 0).toFixed(2)}`;
                          })()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ملخص */}
              {cartItems.length > 0 && (
                <div className="mt-4 bg-indigo-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>تكلفة الطرد الواحد:</span>
                    <span className="font-bold">
                      {(() => {
                        const amountInfo = getAvailableAmountInfo(project);
                        const unitCost = parseFloat(cartItems.reduce((sum, item) => sum + parseFloat(item.total_price_per_unit || 0), 0));
                        return `${amountInfo.symbol}${unitCost.toFixed(2)}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span>التكلفة الإجمالية:</span>
                    <span className="font-bold text-indigo-600">
                      {(() => {
                        const amountInfo = getAvailableAmountInfo(project);
                        const unitCost = parseFloat(cartItems.reduce((sum, item) => sum + parseFloat(item.total_price_per_unit || 0), 0));
                        const totalCost = unitCost * projectQuantity;
                        return `${amountInfo.symbol}${totalCost.toFixed(2)}`;
                      })()}
                    </span>
                  </div>
                  {(() => {
                    const amountInfo = getAvailableAmountInfo(project);
                    const availableAmount = parseFloat(amountInfo.amount || 0);
                    return (
                      <div className="flex justify-between text-sm">
                        <span>المبلغ المتاح للتوريد {amountInfo.currency === 'ILS' ? '(شيكل)' : '(دولار)'}:</span>
                        <span className="font-bold text-green-600">
                          {amountInfo.symbol}{availableAmount.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const amountInfo = getAvailableAmountInfo(project);
                    const totalCost = cartItems.reduce((sum, item) => sum + parseFloat(item.total_price_per_unit || 0), 0);
                    const availableAmount = parseFloat(amountInfo.amount || 0);
                    const surplus = availableAmount - totalCost;
                    return (
                      <div className={`flex justify-between text-sm font-bold ${surplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span>{surplus >= 0 ? 'الفائض:' : 'العجز:'}</span>
                        <span>{amountInfo.symbol}{Math.abs(surplus).toFixed(2)}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 📦 قسم الفائض - إجباري لتأكيد التوريد */}
              {surplusCategories.length > 0 && (
                <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📦 قسم الفائض <span className="text-red-500">*</span>
                    {isOrphanSponsorCoordinator && selectedSurplusCategoryId && (
                      <span className="text-green-600 text-xs mr-2">(تلقائي: كفالة الأيتام)</span>
                    )}
                  </label>
                  <select
                    value={selectedSurplusCategoryId}
                    onChange={(e) => setSelectedSurplusCategoryId(e.target.value)}
                    disabled={isOrphanSponsorCoordinator && selectedSurplusCategoryId !== ''}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${!selectedSurplusCategoryId || selectedSurplusCategoryId === ''
                      ? 'border-red-300 bg-red-50'
                      : isOrphanSponsorCoordinator && selectedSurplusCategoryId !== ''
                        ? 'bg-green-50 border-green-300 text-green-700 cursor-not-allowed'
                        : 'border-gray-300'
                      }`}
                    required
                  >
                    <option value="">-- اختر قسم الفائض (مطلوب) --</option>
                    {surplusCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {(!selectedSurplusCategoryId || selectedSurplusCategoryId === '') && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ اختيار قسم الفائض إجباري لتأكيد التوريد
                    </p>
                  )}
                  {isOrphanSponsorCoordinator && selectedSurplusCategoryId && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ تم اختيار "كفالة الأيتام" تلقائياً
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex gap-3">
            <button
              onClick={() => {
                onClose();
                setCartItems([]);
              }}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              إغلاق
            </button>
            {cartItems.length > 0 && (
              <button
                onClick={handleConfirmSupply}
                disabled={confirmingSupply || !selectedSurplusCategoryId || selectedSurplusCategoryId === ''}
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title={!selectedSurplusCategoryId || selectedSurplusCategoryId === '' ? 'يرجى اختيار قسم الفائض أولاً' : ''}
              >
                {confirmingSupply ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    جاري التأكيد...
                  </>
                ) : (
                  'تأكيد التوريد'
                )}
              </button>
            )}
          </div>

          {/* ✅ زر إسناد باحث (مدير المشاريع فقط) بعد مرحلة "تم التوريد" */}
          {isProjectManager && project && canAssignResearcherAfterSupply(project) && (
            <button
              onClick={() => {
                onClose();
                setSelectedProject(project);
                setAssignModalOpen(true);
              }}
              className="w-full md:w-auto px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md transition-colors"
              title="إسناد/تعديل باحث بعد التوريد"
            >
              <UserCheck className="w-4 h-4" />
              إسناد باحث
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplyModal;
