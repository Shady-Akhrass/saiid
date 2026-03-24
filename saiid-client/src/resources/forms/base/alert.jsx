import React from 'react';

const Alert = ({ type, children }) => {
    let bgColor, borderColor, textColor;

    switch (type) {
        case 'warning':
            bgColor = 'bg-yellow-100';
            borderColor = 'border-yellow-500';
            textColor = 'text-yellow-700';
            break;
        // You can add more cases for different alert types
        default:
            bgColor = 'bg-blue-100';
            borderColor = 'border-blue-500';
            textColor = 'text-blue-700';
    }

    return (
        <div className={`${bgColor} border-l-4 ${borderColor} ${textColor} p-4 mb-8 rounded`}>
            {children}
        </div>
    );
};

export default Alert;
