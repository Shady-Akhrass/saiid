import React from 'react';

const ProgressBar = ({ currentStep, totalSteps }) => {
    const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

    return (
        <div className="w-full h-2 bg-gray-200 rounded-full mb-6">
            <div
                className="bg-blue-500 h-2 rounded-full transition-width duration-300"
                style={{ width: `${progressPercentage}%` }}
            ></div>
        </div>
    );
};

export default ProgressBar;
