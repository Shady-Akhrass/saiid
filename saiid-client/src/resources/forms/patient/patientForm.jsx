import { useState, useEffect } from "react";

const PatientForm = ({ formData, handleChange }) => {
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const name = `${formData.name || ""}`;
        handleChange({ target: { name: "name", value: name } });
    }, [formData.name]);

    const validateField = (name, value) => {
        let error = "";

        switch (name) {
            case "name":
                if (!value) {
                    error = "يرجى إدخال الاسم رباعي";
                } else if (value.split(" ").length < 4) {
                    error = "يرجى إدخال الاسم رباعي كامل";
                } else if (/\d/.test(value)) {
                    error = "الاسم لا يجب أن يحتوي على أرقام";
                }
                break;

            case "id_number":
                if (!value) {
                    error = "يرجى إدخال رقم الهوية";
                } else if (!/^\d{9}$/.test(value)) {
                    error = "رقم الهوية يجب أن يتكون من 9 أرقام";
                }
                break;

            case "birth_date":
                if (!value) {
                    error = "يرجى إدخال تاريخ الميلاد";
                } else {
                    const date = new Date(value);
                    const today = new Date();
                    if (date > today) {
                        error = "تاريخ الميلاد لا يمكن أن يكون في المستقبل";
                    }
                }
                break;

            case "gender":
                if (!value) {
                    error = "يرجى اختيار الجنس";
                }
                break;

            case "health_status":
                if (!value) {
                    error = "يرجى اختيار حالة الصحة";
                }
                break;

            case "marital_status":
                if (!value) {
                    error = "يرجى اختيار الحالة الإجتماعية";
                }
                break;

            case "number_of_brothers":
                if (
                    formData.marital_status &&
                    ["متزوج", "أرمل", "مطلق"].includes(formData.marital_status)
                ) {
                    if (!value && value !== 0) {
                        error = "يرجى إدخال عدد الأبناء الذكور";
                    } else if (value < 0) {
                        error = "عدد الأبناء لا يمكن أن يكون سالباً";
                    }
                }
                break;

            case "number_of_sisters":
                if (
                    formData.marital_status &&
                    ["متزوج", "أرمل", "مطلق"].includes(formData.marital_status)
                ) {
                    if (!value && value !== 0) {
                        error = "يرجى إدخال عدد البنات الإناث";
                    } else if (value < 0) {
                        error = "عدد البنات لا يمكن أن يكون سالباً";
                    }
                }
                break;
            case "current_address":
                if (!value) {
                    error = "يرجى اختيار عنوان السكن الحالي";
                }
                break;
            case "guardian_phone_number":
                if (!value) {
                    error = "يرجى إدخال رقم الجوال";
                } else if (!/^05\d{8}$/.test(value)) {
                    error = "رقم الجوال يجب أن يبدأ ب 05 ويتكون من 10 أرقام";
                }
                break;

            case "alternative_phone_number":
                if (!value) {
                    error = "يرجى إدخال رقم الجوال البديل";
                } else if (!/^05\d{8}$/.test(value)) {
                    error = "رقم الجوال يجب أن يبدأ ب 05 ويتكون من 10 أرقام";
                } else if (value === formData.guardian_phone_number) {
                    error = "رقم الجوال البديل يجب أن يكون مختلفاً عن الرقم الأساسي";
                }
                break;

            default:
                break;
        }

        return error;
    };

    const handleFieldChange = (e) => {
        const { name, value } = e.target;
        const error = validateField(name, value);
        setErrors((prevErrors) => ({ ...prevErrors, [name]: error }));
        handleChange(e);
    };

    return (
        <div className="patient-form">
            <h2 className="text-2xl font-semibold mb-4">بيانات المريض</h2>
            <div className="mb-4">
                <label className="block text-gray-700">الاسم رباعي</label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.name ? "border-red-500" : "border-gray-300"
                        } rounded-lg w-full`}
                    required
                />
                {errors.name && <span className="text-red-500">{errors.name}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">رقم الهوية</label>
                <input
                    type="number"
                    name="id_number"
                    value={formData.id_number}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.id_number ? "border-red-500" : "border-gray-300"
                        } rounded-lg w-full`}
                    required
                />
                {errors.id_number && (
                    <span className="text-red-500">{errors.id_number}</span>
                )}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">تاريخ الميلاد</label>
                <input
                    type="date"
                    name="birth_date"
                    value={formData.birth_date}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.birth_date ? "border-red-500" : "border-gray-300"
                        } rounded-lg w-full`}
                    required
                />
                {errors.birth_date && (
                    <span className="text-red-500">{errors.birth_date}</span>
                )}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">الجنس</label>
                <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.gender ? "border-red-500" : "border-gray-300"
                        } rounded-lg w-full`}
                    required
                >
                    <option value="">اختار الجنس</option>
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">انثى</option>
                </select>
                {errors.gender && <span className="text-red-500">{errors.gender}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">
                    هل المريض يعاني من الإعاقة؟
                </label>
                <select
                    name="health_status"
                    value={formData.health_status}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.health_status ? "border-red-500" : "border-gray-300"
                        } rounded-lg w-full`}
                    required
                >
                    <option value="">هل المريض يعاني من إعاقة</option>
                    <option value="مريض">نعم</option>
                    <option value="جيدة">لا</option>
                </select>
                {errors.health_status && (
                    <span className="text-red-500">{errors.health_status}</span>
                )}
            </div>

            {formData.health_status === "مريض" && (
                <div className="mb-4">
                    <label className="block text-gray-700">
                        وصف المرض (في حال وجود مرض أو الإعاقة)
                    </label>
                    <textarea
                        name="disease_description"
                        value={formData.disease_description}
                        onChange={handleFieldChange}
                        className={`mt-1 p-2 border ${errors.disease_description ? "border-red-500" : "border-gray-300"
                            } rounded-lg w-full`}
                    />
                    {errors.disease_description && (
                        <span className="text-red-500">{errors.disease_description}</span>
                    )}
                </div>
            )}

            <div className="mb-4">
                <label className="block text-gray-700">الحالة الإجتماعية</label>
                <select
                    name="marital_status"
                    value={formData.marital_status}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.marital_status ? "border-red-500" : "border-gray-300"
                        } rounded-lg w-full`}
                    required
                >
                    <option value="">اختار الحالة الإجتماعية</option>
                    <option value="متزوج">متزوج</option>
                    <option value="أرمل">أرمل</option>
                    <option value="مطلق">مطلق</option>
                    <option value="أعزب">أعزب</option>
                </select>
                {errors.marital_status && (
                    <span className="text-red-500">{errors.marital_status}</span>
                )}
            </div>

            {["متزوج", "أرمل", "مطلق"].includes(formData.marital_status) && (
                <div className="mb-4">
                    <div className="mb-4 grid grid-cols-2 gap-4">
                        <div className="mb-4">
                            <label className="block text-gray-700">عدد الأبناء الذكور</label>
                            <input
                                type="number"
                                name="number_of_brothers"
                                value={formData.number_of_brothers}
                                onChange={handleFieldChange}
                                min="0"
                                className={`mt-1 p-2 border ${errors.number_of_brothers
                                    ? "border-red-500"
                                    : "border-gray-300"
                                    } rounded-lg w-full`}
                                required
                            />
                            {errors.number_of_brothers && (
                                <span className="text-red-500">
                                    {errors.number_of_brothers}
                                </span>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700">عدد البنات الاناث</label>
                            <input
                                type="number"
                                name="number_of_sisters"
                                value={formData.number_of_sisters}
                                onChange={handleFieldChange}
                                min="0"
                                className={`mt-1 p-2 border ${errors.number_of_sisters
                                    ? "border-red-500"
                                    : "border-gray-300"
                                    } rounded-lg w-full`}
                                required
                            />
                            {errors.number_of_sisters && (
                                <span className="text-red-500">{errors.number_of_sisters}</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-4">
                <label className="block text-gray-700">عنوان السكن الحالي</label>
                <select
                    name="current_address"
                    value={formData.current_address}
                    onChange={handleFieldChange}
                    className={`mt-1 p-2 border ${errors.current_address ? "border-red-500" : "border-gray-300"
                        } rounded-lg w-full`}
                    required
                >
                    <option value="">اختار عنوان السكن الحالي</option>
                    <option value="محافظة رفح">محافظة رفح</option>
                    <option value="محافظة خانيونس">محافظة خانيونس</option>
                    <option value="محافظة الوسطى">محافظة الوسطى</option>
                    <option value="محافظة غزة">محافظة غزة</option>
                    <option value="محافظة الشمال">محافظة الشمال</option>
                </select>
                {errors.current_address && (
                    <span className="text-red-500">{errors.current_address}</span>
                )}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">رقم الجوال</label>
                <input
                    type="text"
                    name="guardian_phone_number"
                    value={formData.guardian_phone_number}
                    onChange={handleFieldChange}
                    placeholder="05xxxxxxxx"
                    className={`mt-1 p-2 border ${errors.guardian_phone_number ? "border-red-500" : "border-gray-300"
                        } rounded-lg w-full`}
                    required
                />
                {errors.guardian_phone_number && (
                    <span className="text-red-500">{errors.guardian_phone_number}</span>
                )}
            </div>

            <div className="mb-4">
                <label className="block text-gray-700">رقم جوال بديل</label>
                <input
                    type="text"
                    name="alternative_phone_number"
                    value={formData.alternative_phone_number}
                    onChange={handleFieldChange}
                    placeholder="05xxxxxxxx"
                    className={`mt-1 p-2 border ${errors.alternative_phone_number
                        ? "border-red-500"
                        : "border-gray-300"
                        } rounded-lg w-full`}
                    required
                />
                {errors.alternative_phone_number && (
                    <span className="text-red-500">
                        {errors.alternative_phone_number}
                    </span>
                )}
            </div>
        </div>
    );
};

export default PatientForm;