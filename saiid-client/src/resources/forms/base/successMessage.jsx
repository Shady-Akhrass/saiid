// src/components/SuccessMessage.jsx
import React from 'react';

const SuccessMessage = ({ message }) => (
    <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-8 rounded">
        <p className="font-bold">نجاح:</p>
        <p>{message}</p>
    </div>
);

export default SuccessMessage;
