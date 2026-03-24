// components/Toast.jsx
import React, { useState, useEffect } from 'react';

const Toast = ({ message, type, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            onClose();
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    if (!isVisible) return null;

    return (
        <div className={`fixed top-16 left-4 z-50 p-4 rounded-md ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            {message}
        </div>
    );
};

export default Toast;