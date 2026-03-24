import React, { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { useCacheInvalidation } from '../../hooks/useCacheInvalidation';

const API_BASE = import.meta.env.VITE_API_URL || "https://forms-api.saiid.org/api";

const DeleteOrphanModal = ({ isOpen, onClose, orphanData, onDeleteSuccess }) => {
    const { invalidateOrphansCache } = useCacheInvalidation();
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [error, setError] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    if (!isOpen) return null;

    // Show success screen if deletion was successful
    if (showSuccess) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-fadeIn">
                    <div className="p-8 text-center">
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">تم الحذف بنجاح!</h3>
                        <p className="text-gray-600">تم حذف سجل اليتيم وجميع الوثائق المرتبطة به</p>
                    </div>
                </div>
            </div>
        );
    }

    const handleDelete = async () => {
        // Verify confirmation text
        if (confirmText !== 'حذف') {
            setError('يرجى كتابة كلمة "حذف" للتأكيد');
            return;
        }

        setIsDeleting(true);
        setError('');

        try {
            // Use environment variable or fallback to Laravel default port

            const response = await fetch(`${API_BASE}/orphans/${orphanData.orphan_id_number}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    guardian_id_number: orphanData.guardian_id_number
                })
            });

            // Check if response has content
            const contentType = response.headers.get('content-type');
            let data = null;

            if (contentType && contentType.includes('application/json')) {
                const text = await response.text();
                if (text) {
                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        console.error('JSON parse error:', e);
                        console.error('Response text:', text);
                        throw new Error('استجابة غير صالحة من الخادم');
                    }
                }
            }

            if (!response.ok) {
                throw new Error(data?.error || data?.message || 'فشل في حذف السجل');
            }

            // Show success message
            setShowSuccess(true);

            // ✅ إبطال كاش الأيتام عند الحذف
            invalidateOrphansCache();

            // Wait 2 seconds then close and trigger callback
            setTimeout(() => {
                setShowSuccess(false);
                setConfirmText('');
                onDeleteSuccess();
            }, 2000);
        } catch (err) {
            console.error('Delete error:', err);
            setError(err.message || 'حدث خطأ أثناء الحذف');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleClose = () => {
        if (!isDeleting && !showSuccess) {
            setConfirmText('');
            setError('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-fadeIn">
                {/* Header */ }
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
                    <h3 className="text-xl font-bold text-red-700 flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6" />
                        تأكيد حذف السجل
                    </h3>
                    <button
                        onClick={ handleClose }
                        disabled={ isDeleting }
                        className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */ }
                <div className="p-6 space-y-4">
                    {/* Warning Message */ }
                    <div className="bg-red-50 border-r-4 border-red-500 p-4 rounded">
                        <p className="text-red-800 font-semibold mb-2">
                            ⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!
                        </p>
                        <p className="text-red-700 text-sm">
                            سيتم حذف جميع البيانات والصور المرتبطة بهذا السجل بشكل نهائي.
                        </p>
                    </div>

                    {/* Orphan Info */ }
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div>
                            <span className="text-sm text-gray-600">اسم اليتيم:</span>
                            <p className="font-bold text-gray-800">{ orphanData.orphan_full_name }</p>
                        </div>
                        <div>
                            <span className="text-sm text-gray-600">رقم الهوية:</span>
                            <p className="font-medium text-gray-800">{ orphanData.orphan_id_number }</p>
                        </div>
                        <div>
                            <span className="text-sm text-gray-600">اسم الوصي:</span>
                            <p className="font-medium text-gray-800">{ orphanData.guardian_full_name }</p>
                        </div>
                        <div>
                            <span className="text-sm text-gray-600">رقم هوية الوصي:</span>
                            <p className="font-medium text-gray-800">{ orphanData.guardian_id_number }</p>
                        </div>
                    </div>

                    {/* Confirmation Input */ }
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            للتأكيد، اكتب كلمة <span className="font-bold text-red-600">"حذف"</span> في الحقل أدناه:
                        </label>
                        <input
                            type="text"
                            value={ confirmText }
                            onChange={ (e) => setConfirmText(e.target.value) }
                            disabled={ isDeleting }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                            placeholder="حذف"
                        />
                    </div>

                    {/* Error Message */ }
                    { error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            { error }
                        </div>
                    ) }
                </div>

                {/* Footer */ }
                <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={ handleClose }
                        disabled={ isDeleting || showSuccess }
                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={ handleDelete }
                        disabled={ isDeleting || confirmText !== 'حذف' || showSuccess }
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        { isDeleting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                جاري الحذف...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-5 h-5" />
                                حذف نهائي
                            </>
                        ) }
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteOrphanModal;