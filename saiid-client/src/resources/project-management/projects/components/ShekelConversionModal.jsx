import React from 'react';
import { X, DollarSign, CheckCircle2 } from 'lucide-react';

const ShekelConversionModal = ({
  isOpen,
  onClose,
  project,
  exchangeRate,
  setExchangeRate,
  transferDiscountPercentage,
  setTransferDiscountPercentage,
  onConvert,
  isConverting,
  formatCurrency,
  isEditing = false
}) => {
  if (!isOpen) return null;

  const netAmount = project?.net_amount_usd || project?.net_amount || 0;
  const rate = parseFloat(exchangeRate) || 0;
  const transferDiscount = parseFloat(transferDiscountPercentage) || 0;

  // ✅ حساب المبلغ بعد تطبيق نسبة خصم النقل (هي نفسها نسبة الخصم للتحويل)
  const transferDiscountAmount = (netAmount * transferDiscount) / 100;
  const amountAfterTransferDiscount = netAmount - transferDiscountAmount;

  // ✅ حساب المبلغ بالشيكل بعد الخصم
  const convertedAmount = amountAfterTransferDiscount * rate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-amber-600" />
            {isEditing ? 'تعديل التحويل للشيكل' : 'تحويل المبلغ إلى شيكل'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Current Amount */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600 mb-1">المبلغ الحالي (دولار)</p>
            <p className="text-2xl font-bold text-gray-800">${formatCurrency(netAmount)}</p>
          </div>

          {/* Exchange Rate Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              سعر الصرف (1 دولار = ؟ شيكل) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="مثال: 3.65"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg"
            />
          </div>

          {/* Transfer Discount Percentage Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              نسبة خصم النقل (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              value={transferDiscountPercentage}
              onChange={(e) => setTransferDiscountPercentage(e.target.value)}
              placeholder="مثال: 5 (مطلوب)"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              نسبة خصم النقل مطلوبة ويجب أن تكون أكبر من صفر (مثال: 5%) - هذه النسبة تُخصم من المبلغ قبل التحويل للشيكل
            </p>
          </div>

          {/* Calculation Preview */}
          {rate > 0 && (
            <div className="space-y-3">
              {transferDiscount > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-blue-600">المبلغ الأصلي:</p>
                    <p className="text-lg font-bold text-blue-700">${formatCurrency(netAmount)}</p>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-blue-600">نسبة خصم النقل ({transferDiscount}%):</p>
                    <p className="text-lg font-bold text-red-600">-${formatCurrency(transferDiscountAmount)}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t-2 border-blue-300">
                    <p className="text-sm font-medium text-blue-700">المبلغ بعد الخصم:</p>
                    <p className="text-xl font-bold text-blue-800">${formatCurrency(amountAfterTransferDiscount)}</p>
                  </div>
                </div>
              )}

              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-600 mb-1">المبلغ بعد التحويل (شيكل)</p>
                <p className="text-2xl font-bold text-green-700">₪{formatCurrency(convertedAmount)}</p>
                <p className="text-xs text-green-600 mt-1">
                  {transferDiscount > 0 ? (
                    <>المبلغ بعد الخصم ({formatCurrency(amountAfterTransferDiscount)} دولار) × {rate} = {formatCurrency(convertedAmount)} شيكل</>
                  ) : (
                    <>سعر الصرف: 1 دولار = {rate} شيكل</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            <p className="font-medium mb-1">⚠️ تنبيه مهم:</p>
            <p>
              {isEditing
                ? 'سيتم تحديث سعر الصرف ونسبة الخصم، وسيتم إعادة حساب المبلغ بالشيكل بناءً على القيم الجديدة.'
                : 'بعد التحويل، سيتم حساب جميع تكاليف التوريد والفائض بالشيكل. هذه العملية لا يمكن التراجع عنها.'
              }
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={onConvert}
              disabled={isConverting || !rate || rate <= 0 || !transferDiscountPercentage || parseFloat(transferDiscountPercentage) <= 0}
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isConverting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  {isEditing ? 'جاري التحديث...' : 'جاري التحويل...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isEditing ? 'تأكيد التعديل' : 'تأكيد التحويل'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShekelConversionModal;
