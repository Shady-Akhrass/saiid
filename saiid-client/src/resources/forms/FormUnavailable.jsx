import React from 'react';
import { AlertCircle, XCircle, Heart } from 'lucide-react';

const FormUnavailable = ({ formAvailabilityData }) => {
    // Get the title based on the form type
    const getTitle = () => {
        switch (formAvailabilityData?.type) {
            case 'orphan':
                return 'نموذج كفالة الأيتام';
            case 'aids':
                return 'نموذج المساعدات';
            case 'employment':
                return 'نموذج التوظيف';
            case 'patient':
                return 'نموذج المرضى';
            case 'shelter':
                return 'نموذج مراكز النزوح';
            default:
                return 'النموذج';
        }
    };

    // Get the default message based on the form type
    const getDefaultMessage = () => {
        switch (formAvailabilityData?.type) {
            case 'orphan':
                return 'عذراً، نموذج التسجيل لكفالة الأيتام مغلق مؤقتاً. يرجى المحاولة في وقت لاحق.';
            case 'aids':
                return 'عذراً، نموذج المساعدات مغلق مؤقتاً. يرجى المحاولة في وقت لاحق.';
            case 'employment':
                return 'عذراً، نموذج التوظيف مغلق مؤقتاً. يرجى المحاولة في وقت لاحق.';
            case 'patient':
                return 'عذراً، نموذج المرضى مغلق مؤقتاً. يرجى المحاولة في وقت لاحق.';
            case 'shelter':
                return 'عذراً، نموذج المأوى مغلق مؤقتاً. يرجى المحاولة في وقت لاحق.';
            default:
                return 'عذراً، النموذج مغلق مؤقتاً. يرجى المحاولة في وقت لاحق.';
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            {/* Animated Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute top-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-40 right-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 md:p-12 max-w-2xl w-full relative z-10" dir="rtl">
                <div className="text-center">
                    {/* Icon */}
                    <div className="relative mx-auto w-24 h-24 mb-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-400 rounded-full blur-xl opacity-50"></div>
                        <div className="relative bg-gradient-to-br from-orange-100 to-red-100 rounded-full w-24 h-24 flex items-center justify-center">
                            <Heart className="w-12 h-12 text-red-500" />
                        </div>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent mb-4">
                        {getTitle()}
                    </h1>

                    {/* Status Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full mb-6">
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">غير متاح حالياً</span>
                    </div>

                    {/* Custom Message */}
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-2xl p-6 mb-6">
                        <AlertCircle className="w-8 h-8 text-orange-500 mx-auto mb-3" />
                        <p className="text-lg text-gray-700 leading-relaxed">
                            {formAvailabilityData?.notes || getDefaultMessage()}
                        </p>
                    </div>

                    {/* Website Link */}
                    <div className="border-t border-gray-200 pt-6">
                        <p className="text-gray-600 mb-4">
                            لمتابعة أنشطة الجمعية ولمسات الخير المستمرة
                        </p>
                        <a
                            href="https://saiid.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-700 transform hover:scale-105 transition-all duration-300"
                        >
                            <span>زيارة الموقع الرسمي</span>
                        </a>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob {
                    animation: blob 7s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
            `}</style>
        </div>
    );
};

export default FormUnavailable;