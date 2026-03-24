import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundaryClass extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });

        // يمكن إضافة error reporting هنا
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <ErrorFallback
                    error={ this.state.error }
                    errorInfo={ this.state.errorInfo }
                    onReset={ this.handleReset }
                    onNavigateHome={ this.props.onNavigateHome }
                />
            );
        }

        return this.props.children;
    }
}

const ErrorFallback = ({ error, errorInfo, onReset, onNavigateHome }) => {
    const handleGoHome = () => {
        if (onNavigateHome) {
            onNavigateHome();
        } else {
            window.location.href = '/';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4" dir="rtl">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl border-2 border-red-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-500 to-red-600 p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                            <AlertTriangle className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">حدث خطأ غير متوقع</h1>
                            <p className="text-red-100 text-sm mt-1">نعتذر عن الإزعاج. حدث خطأ في التطبيق.</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                        <p className="text-red-800 font-medium mb-2">تفاصيل الخطأ:</p>
                        <p className="text-red-700 text-sm">
                            { error?.message || 'حدث خطأ غير معروف' }
                        </p>
                    </div>

                    { import.meta.env.DEV && errorInfo && (
                        <details className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                                تفاصيل تقنية (للمطورين)
                            </summary>
                            <pre className="text-xs text-gray-600 overflow-auto max-h-64 mt-2">
                                { errorInfo.componentStack }
                            </pre>
                        </details>
                    ) }

                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                        <p className="text-blue-800 font-medium mb-2">ما يمكنك فعله:</p>
                        <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
                            <li>تحديث الصفحة</li>
                            <li>التأكد من اتصالك بالإنترنت</li>
                            <li>حذف الـ cache وإعادة المحاولة</li>
                            <li>الاتصال بالدعم الفني إذا استمرت المشكلة</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={ onReset }
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                        <RefreshCw className="w-5 h-5" />
                        إعادة المحاولة
                    </button>
                    <button
                        onClick={ handleGoHome }
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                        <Home className="w-5 h-5" />
                        العودة للصفحة الرئيسية
                    </button>
                </div>
            </div>
        </div>
    );
};

const ErrorBoundary = (props) => {
    return <ErrorBoundaryClass { ...props } />;
};

export default ErrorBoundary;

