import React from 'react';

const FormUnavailableSkeleton = () => {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            {/* Animated Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
                <div className="absolute top-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
                <div className="absolute -bottom-40 right-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 md:p-12 max-w-2xl w-full relative z-10" dir="rtl">
                <div className="text-center">
                    {/* Icon */}
                    <div className="relative mx-auto w-24 h-24 mb-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-400 rounded-full blur-xl opacity-50"></div>
                        <div className="relative bg-gradient-to-br from-orange-100 to-red-100 rounded-full w-24 h-24 flex items-center justify-center animate-pulse">
                            <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                        </div>
                    </div>

                    <div className="h-8 bg-gray-300 rounded w-64 mx-auto mb-4 animate-pulse"></div>

                    {/* Status Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-full mb-6 animate-pulse">
                        <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                        <div className="h-4 bg-gray-300 rounded w-24"></div>
                    </div>

                    {/* Custom Message */}
                    <div className="bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 rounded-2xl p-6 mb-6 animate-pulse">
                        <div className="w-8 h-8 bg-gray-300 rounded mx-auto mb-3"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-300 rounded w-full"></div>
                            <div className="h-4 bg-gray-300 rounded w-5/6 mx-auto"></div>
                            <div className="h-4 bg-gray-300 rounded w-4/6 mx-auto"></div>
                        </div>
                    </div>

                    {/* Website Link */}
                    <div className="border-t border-gray-200 pt-6">
                        <div className="h-5 bg-gray-300 rounded w-64 mx-auto mb-4 animate-pulse"></div>
                        <div className="inline-flex items-center gap-2 px-6 py-3 bg-gray-300 text-white rounded-xl animate-pulse">
                            <div className="h-4 bg-gray-400 rounded w-32"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FormUnavailableSkeleton;