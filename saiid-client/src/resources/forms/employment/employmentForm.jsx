import { useState, useEffect } from "react";

const EmploymentForm = ({ formData, handleChange }) => {
    const [errors, setErrors] = useState({});

    const validateField = (name, value) => {
        let error = "";

        switch (name) {
            case "name":
                if (!value) {
                    error = "يرجى إدخال الاسم";
                }
                break;

            case "birth_date":
                if (!value) {
                    error = "يرجى إدخال تاريخ الميلاد";
                }
                break;

            case "address":
                if (!value) {
                    error = "يرجى اختيار عنوان السكن ";
                }
                break;


            case "specialization":
                if (!value) {
                    error = "يرجى اختيار التخصص";
                }
                break;

            case "phone_number":
                if (!value) {
                    error = "يرجى إدخال رقم الجوال";
                } else if (!/^\d{10}$/.test(value)) {
                    error = "رقم الجوال يجب أن يتكون من 10 أرقام";
                }
                break;

            case "previous_work_url":
                if (!value) {
                    error = "يرجى إدخال رابط الأعمال السابقة";
                } else if (!isValidUrl(value)) {
                    error = "يرجى إدخال رابط صحيح";
                }
                break;

            default:
                break;
        }

        return error;
    };

    const isValidUrl = (url) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    const handleFieldChange = (e) => {
        const { name, value } = e.target;
        const error = validateField(name, value);
        setErrors((prevErrors) => ({ ...prevErrors, [name]: error }));
        handleChange(e);
    };

    return (
        <div className="aids-form">
            <h2 className="text-2xl font-semibold mb-4">بيانات المتقدم</h2>

            <div className="mb-4">
                <label className="block text-gray-700">الاسم</label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.name ? "border-red-500" : "border-gray-300"} rounded-lg w-full`}
                    required
                />
                {errors.name && <span className="text-red-500">{errors.name}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">تاريخ الميلاد</label>
                <input
                    type="date"
                    name="birth_date"
                    value={formData.birth_date}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.birth_date ? "border-red-500" : "border-gray-300"} rounded-lg w-full`}
                    required
                />
                {errors.birth_date && <span className="text-red-500">{errors.birth_date}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">عنوان السكن </label>
                <select
                    name="address"
                    value={formData.address}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.address ? "border-red-500" : "border-gray-300"
                        } rounded-lg w-full`}
                    required
                >
                    <option value="">اختار عنوان السكن </option>
                    <option value="محافظة رفح">محافظة رفح</option>
                    <option value="محافظة خانيونس">محافظة خانيونس</option>
                </select>
                {errors.address && (
                    <span className="text-red-500">{errors.address}</span>
                )}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">التخصص</label>
                <select
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.specialization ? "border-red-500" : "border-gray-300"} rounded-lg w-full`}
                    required
                >
                    <option value="">اختر التخصص</option>
                    <option value="مصمم جرافيك">مصمم جرافيك</option>
                    <option value="كاتب محتوى">كاتب محتوى</option>
                    <option value="مونتاج">مونتاج</option>
                    <option value="مصور رونين">مصور رونين</option>
                    <option value="كاتب مقترحات مشاريع">كاتب مقترحات مشاريع</option>
                </select>
                {errors.specialization && <span className="text-red-500">{errors.specialization}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">رقم الجوال</label>
                <input
                    type="text"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.phone_number ? "border-red-500" : "border-gray-300"} rounded-lg w-full`}
                    required
                />
                {errors.phone_number && <span className="text-red-500">{errors.phone_number}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">رابط الأعمال السابقة</label>
                <input
                    type="url"
                    name="previous_work_url"
                    value={formData.previous_work_url}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.previous_work_url ? "border-red-500" : "border-gray-300"} rounded-lg w-full`}
                    placeholder="https://example.com"
                    required
                />
                {errors.previous_work_url && <span className="text-red-500">{errors.previous_work_url}</span>}
            </div>
        </div>
    );
};

export default EmploymentForm;
