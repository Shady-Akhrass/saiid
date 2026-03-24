import React, { useState } from 'react';
import { X, Shield, Lock, AlertCircle } from 'lucide-react';

const GuardianVerificationModal = ({ 
    isOpen, 
    onClose, 
    onVerify, 
    guardianName 
}) => {
    const [idNumber, setIdNumber] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!idNumber.trim()) {
            setError('يرجى إدخال رقم هوية الوصي');
            return;
        }

        if (idNumber.length < 9) {
            setError('رقم الهوية يجب أن يكون 9 أرقام على الأقل');
            return;
        }

        setIsVerifying(true);
        setError('');

        // Call the verification function
        const isValid = await onVerify(idNumber);
        
        if (isValid) {
            setIdNumber('');
            setError('');
        } else {
            setError('رقم هوية الوصي غير صحيح');
        }
        
        setIsVerifying(false);
    };

    const handleClose = () => {
        setIdNumber('');
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div 
                className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-fadeIn"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-t-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">التحقق من الهوية</h3>
                                <p className="text-blue-100 text-sm mt-1">مطلوب للتعديل على البيانات</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6">
                    {/* Info Alert */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm text-blue-800 font-medium">للتحقق من صلاحية التعديل</p>
                                <p className="text-sm text-blue-600 mt-1">
                                    يرجى إدخال رقم هوية الوصي المسجل
                                    {guardianName && (
                                        <span className="font-medium"> ({guardianName})</span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Input Field */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            رقم هوية الوصي
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={idNumber}
                                onChange={(e) => {
                                    setIdNumber(e.target.value);
                                    setError('');
                                }}
                                placeholder="أدخل رقم هوية الوصي"
                                className="w-full pr-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                autoFocus
                                maxLength="9"
                                dir="ltr"
                            />
                        </div>
                        
                        {/* Error Message */}
                        {error && (
                            <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            type="submit"
                            disabled={isVerifying}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isVerifying ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    جاري التحقق...
                                </>
                            ) : (
                                <>
                                    <Shield className="w-5 h-5" />
                                    تحقق
                                </>
                            )}
                        </button>
                        
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GuardianVerificationModal;