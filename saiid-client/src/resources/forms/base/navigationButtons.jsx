// src/components/NavigationButtons.jsx
import React from 'react';

const NavigationButtons = ({
    currentStep,
    totalSteps,
    handlePrevious,
    handleNext,
    isSubmitting,
}) => {
    return (
        <div className={`flex ${currentStep === 0 ? 'justify-end' : 'justify-between'}`}>
            {currentStep > 0 && (
                <button
                    type="button"
                    onClick={handlePrevious}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                    العودة
                </button>
            )}
            {currentStep < totalSteps - 1 && (
                <button
                    type="button"
                    onClick={handleNext}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    التالي
                </button>
            )}
            {currentStep === totalSteps - 1 && (
                <button
                    type="submit"
                    className={`bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    disabled={isSubmitting}
                >
                    تقديم
                </button>
            )}
        </div>
    );
};

export default NavigationButtons;
