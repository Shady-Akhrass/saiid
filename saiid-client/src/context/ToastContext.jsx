import React, { createContext, useContext } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

const ToastProvider = ({ children }) => {
    const showToast = (message, type = 'info', options = {}) => {
        const {
            duration = type === 'error' ? 5000 : 3000,
            position = 'top-left',
            rtl = true,
        } = options;

        const toastConfig = {
            position: position,
            autoClose: duration,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            rtl: rtl,
            className: 'toast-custom',
            ...options,
        };

        const iconStyle = 'w-5 h-5 ml-2 flex-shrink-0';

        switch (type) {
            case 'success':
                toast.success(
                    <div className="flex items-center" dir="rtl">
                        <CheckCircle className={ iconStyle } />
                        <span>{ message }</span>
                    </div>,
                    {
                        ...toastConfig,
                        icon: false,
                    }
                );
                break;

            case 'error':
                toast.error(
                    <div className="flex items-center" dir="rtl">
                        <XCircle className={ iconStyle } />
                        <span>{ message }</span>
                    </div>,
                    {
                        ...toastConfig,
                        icon: false,
                    }
                );
                break;

            case 'warning':
                toast.warning(
                    <div className="flex items-center" dir="rtl">
                        <AlertCircle className={ iconStyle } />
                        <span>{ message }</span>
                    </div>,
                    {
                        ...toastConfig,
                        icon: false,
                    }
                );
                break;

            case 'info':
            default:
                toast.info(
                    <div className="flex items-center" dir="rtl">
                        <Info className={ iconStyle } />
                        <span>{ message }</span>
                    </div>,
                    {
                        ...toastConfig,
                        icon: false,
                    }
                );
                break;
        }
    };

    const value = {
        showToast,
        success: (message, options) => showToast(message, 'success', options),
        error: (message, options) => showToast(message, 'error', options),
        warning: (message, options) => showToast(message, 'warning', options),
        info: (message, options) => showToast(message, 'info', options),
    };

    return (
        <ToastContext.Provider value={ value }>
            { children }
            <ToastContainer
                position="top-left"
                autoClose={ 3000 }
                hideProgressBar={ false }
                newestOnTop={ false }
                closeOnClick
                rtl={ true }
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
                className="toast-container"
                toastClassName="toast-wrapper"
                bodyClassName="toast-body"
                progressClassName="toast-progress"
                closeButton={ ({ closeToast }) => (
                    <button
                        onClick={ closeToast }
                        className="toast-close-button"
                        aria-label="إغلاق"
                    >
                        <X className="w-4 h-4" />
                    </button>
                ) }
            />
        </ToastContext.Provider>
    );
};

export default ToastProvider;

