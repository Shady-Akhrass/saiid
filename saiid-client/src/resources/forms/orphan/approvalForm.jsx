import React, { useState } from 'react';

const ApprovalForm = ({ formData, handleChange }) => {
    const [errors, setErrors] = useState({});
    const [isChecked, setIsChecked] = useState(formData.isChecked || false);

    // Function to validate the field
    const validateField = (name, value) => {
        if (name === 'data_approval_name' && !value.trim()) {
            return 'هذا الحقل مطلوب.';
        }
        if (name === 'isChecked' && !value) {
            return 'يجب الموافقة على التعهد.';
        }
        return '';
    };

    // Function to handle field changes and validate
    const handleFieldChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        const error = validateField(name, val);
        setErrors((prevErrors) => ({ ...prevErrors, [name]: error }));
        handleChange(e);
        if (type === 'checkbox') {
            setIsChecked(checked);
        }
    };

    return (
        <div className="approval-form ">
            <h2 className="text-2xl font-semibold mb-4">بيانات التعهد</h2>
            <div className="mb-4">
                <label className="block text-gray-700">اسم المتعهد</label>
                <input
                    type="text"
                    name="data_approval_name"
                    value={formData.data_approval_name}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.data_approval_name ? 'border-red-500' : 'border-gray-300'} rounded-lg w-full`}
                    required
                />
                {errors.data_approval_name && <span className="text-red-500">{errors.data_approval_name}</span>}
            </div>
            <div className="mb-4 flex items-start">
                <input
                    type="checkbox"
                    name="isChecked"
                    checked={isChecked}
                    onChange={handleFieldChange}
                    className={`ml-2 mt-1 h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring focus:ring-blue-200 ${errors.isChecked ? 'border-red-500' : 'border-gray-300'}`}
                    required
                />
                <label className="text-gray-700 flex-1">
                    أقر وأتعهد بأن جميع البيانات المقدمة في هذا النموذج صحيحة وكاملة، وأنني قدمت معلومات دقيقة بناءً على معرفتي الحالية. أوافق على أن أي معلومات مضللة أو غير صحيحة قد تؤدي إلى رفض الطلب أو اتخاذ إجراءات تصحيحية.
                </label>
                {errors.isChecked && <span className="text-red-500 block mt-1">{errors.isChecked}</span>}
            </div>

        </div>
    );
};

export default ApprovalForm;
