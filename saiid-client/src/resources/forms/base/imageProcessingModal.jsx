// src/resources/forms/base/imageProcessingModal.jsx
import React from 'react';
import { Image, CheckCircle, Upload } from 'lucide-react';

const ImageProcessingModal = ({ isOpen, progress }) => {
    if (!isOpen) return null;

    const isComplete = progress === 100;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-300 ${isOpen ? 'bg-opacity-60' : 'bg-opacity-0'
            }`}>
            <div className="absolute inset-0 backdrop-blur-sm"></div>

            <div className="relative bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl transform transition-all duration-300 scale-100">
                {/* Decorative Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-orange-50 rounded-2xl opacity-50"></div>

                {/* Content */}
                <div className="relative">
                    {/* Animated Icon */}
                    <div className="mb-6 relative">
                        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-200 relative overflow-hidden">
                            {/* Shimmer Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>

                            {isComplete ? (
                                <CheckCircle className="w-12 h-12 text-white animate-scale-in" />
                            ) : (
                                <Image className="w-12 h-12 text-white animate-pulse" />
                            )}
                        </div>

                        {/* Rotating Ring */}
                        {!isComplete && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-28 h-28 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                            </div>
                        )}

                        {/* Pulsing Rings */}
                        {!isComplete && (
                            <>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-32 h-32 border-2 border-blue-300 rounded-full animate-ping opacity-20"></div>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center animation-delay-150">
                                    <div className="w-36 h-36 border-2 border-blue-200 rounded-full animate-ping opacity-10"></div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                        {isComplete ? 'تم بنجاح!' : 'جاري معالجة الصور'}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-600 mb-8 text-sm">
                        {isComplete
                            ? 'تم معالجة جميع الصور بنجاح'
                            : 'يرجى الانتظار بينما نعالج الصور المرفقة... هذا قد يستغرق بضع لحظات'}
                    </p>

                    {/* Progress Bar Container */}
                    <div className="space-y-3 mb-6">
                        {/* Progress Bar */}
                        <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                            {/* Animated Background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100 animate-gradient"></div>

                            {/* Progress Fill */}
                            <div
                                className="relative h-3 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 shadow-lg shadow-blue-300"
                                style={{ width: `${progress}%` }}
                            >
                                {/* Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
                            </div>
                        </div>

                        {/* Progress Info */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Upload className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-semibold text-gray-700">
                                    {isComplete ? 'مكتمل' : 'جاري الرفع...'}
                                </span>
                            </div>
                            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                                {progress}%
                            </span>
                        </div>
                    </div>

                    {/* Status Steps */}
                    <div className="space-y-2">
                        <StatusStep
                            label="تحميل الصور"
                            isActive={progress > 0}
                            isComplete={progress > 33}
                        />
                        <StatusStep
                            label="معالجة البيانات"
                            isActive={progress > 33}
                            isComplete={progress > 66}
                        />
                        <StatusStep
                            label="حفظ المعلومات"
                            isActive={progress > 66}
                            isComplete={progress === 100}
                        />
                    </div>

                    {/* Loading Dots */}
                    {!isComplete && (
                        <div className="flex items-center justify-center gap-1.5 mt-6">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce animation-delay-100"></div>
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce animation-delay-200"></div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
                
                @keyframes gradient {
                    0%, 100% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                }

                @keyframes scale-in {
                    0% {
                        transform: scale(0);
                        opacity: 0;
                    }
                    50% {
                        transform: scale(1.2);
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                .animate-shimmer {
                    animation: shimmer 2s infinite;
                }

                .animate-gradient {
                    background-size: 200% 200%;
                    animation: gradient 3s ease infinite;
                }

                .animate-scale-in {
                    animation: scale-in 0.5s ease-out;
                }

                .animation-delay-100 {
                    animation-delay: 0.1s;
                }

                .animation-delay-150 {
                    animation-delay: 0.15s;
                }

                .animation-delay-200 {
                    animation-delay: 0.2s;
                }
            `}</style>
        </div>
    );
};

// Status Step Component
const StatusStep = ({ label, isActive, isComplete }) => {
    return (
        <div className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-300 ${isActive ? 'bg-blue-50' : 'bg-gray-50'
            }`}>
            {/* Status Icon */}
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isComplete
                    ? 'bg-green-500 border-green-500'
                    : isActive
                        ? 'border-blue-500 border-t-transparent animate-spin'
                        : 'border-gray-300'
                }`}>
                {isComplete && (
                    <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M5 13l4 4L19 7"></path>
                    </svg>
                )}
            </div>

            {/* Label */}
            <span className={`text-sm font-medium transition-colors duration-300 ${isComplete
                    ? 'text-green-700'
                    : isActive
                        ? 'text-blue-700'
                        : 'text-gray-500'
                }`}>
                {label}
            </span>

            {/* Active Indicator */}
            {isActive && !isComplete && (
                <div className="mr-auto flex gap-1">
                    <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse"></div>
                    <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse animation-delay-100"></div>
                    <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse animation-delay-200"></div>
                </div>
            )}

            {/* Complete Checkmark */}
            {isComplete && (
                <CheckCircle className="w-4 h-4 text-green-500 mr-auto" />
            )}
        </div>
    );
};

export default ImageProcessingModal;