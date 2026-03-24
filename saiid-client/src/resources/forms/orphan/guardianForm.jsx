import React, { useState } from 'react';
import { User, Hash, Phone, Users } from 'lucide-react';

const GuardianForm = ({ formData, handleChange }) => {
    const [errors, setErrors] = useState({});

    // Function to validate individual fields
    const validateField = (name, value) => {
        switch (name) {
            case 'guardian_first_name':
            case 'guardian_fathers_name':
            case 'guardian_grandfathers_name':
            case 'guardian_last_name':
            case 'guardian_relationship':
                if (!value.trim()) {
                    return 'هذا الحقل مطلوب.';
                }
                break;
            case 'guardian_id_number':
                if (!value.trim()) {
                    return 'رقم هوية الوصي مطلوب.';
                }
                if (!/^\d+$/.test(value)) {
                    return 'رقم الهوية يجب أن يكون أرقامًا فقط.';
                }
                if (value.trim().length !== 9) {
                    return 'رقم الهوية يجب أن يكون 9 ارقام.';
                }
                break;
            case 'guardian_phone_number':
            case 'alternative_phone_number':
                if (!value.trim()) {
                    return 'رقم الجوال مطلوب.';
                }
                if (!/^\d{10}$/.test(value)) {
                    return 'رقم الجوال يجب أن يكون 10 أرقام.';
                }
                break;
            default:
                return '';
        }
    };

    // Function to handle field changes and validate
    const handleFieldChange = (e) => {
        const { name, value } = e.target;
        const error = validateField(name, value);
        setErrors((prevErrors) => ({ ...prevErrors, [name]: error }));
        handleChange(e);
    };

    return (
        <div className="guardian-form" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {/* Header */}
            <div className="mb-6 relative overflow-hidden p-6 bg-gradient-to-br from-indigo-400 via-blue-400 to-sky-500 rounded-3xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                <div className="relative flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                        <Users className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">بيانات الوصي</h2>
                        <p className="text-blue-100 text-sm">يرجى تعبئة كافة الحقول</p>
                    </div>
                </div>
            </div>

            <div className="mb-6 p-8 bg-gradient-to-br from-indigo-50 via-blue-50 to-sky-50 rounded-3xl border-2 border-indigo-200 shadow-lg">
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-5">

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg"><User className="w-4 h-4 text-indigo-600" /></div>الاسم الأول<span className="text-red-500 text-lg">*</span></label>
                    <input
                        type="text"
                        name="guardian_first_name"
                        value={formData.guardian_first_name}
                        onChange={handleFieldChange}
                        className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.guardian_first_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md focus:shadow-xl focus:shadow-indigo-100'}`}
                        required
                    />
                    {errors.guardian_first_name && <span className="text-red-500">{errors.guardian_first_name}</span>}
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-blue-100 to-sky-100 rounded-lg"><User className="w-4 h-4 text-blue-600" /></div>اسم الأب<span className="text-red-500 text-lg">*</span></label>
                    <input
                        type="text"
                        name="guardian_fathers_name"
                        value={formData.guardian_fathers_name}
                        onChange={handleFieldChange}
                        className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.guardian_fathers_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md focus:shadow-xl focus:shadow-indigo-100'}`}
                        required
                    />
                    {errors.guardian_fathers_name && <span className="text-red-500">{errors.guardian_fathers_name}</span>}
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-purple-100 to-fuchsia-100 rounded-lg"><User className="w-4 h-4 text-purple-600" /></div>اسم الجد<span className="text-red-500 text-lg">*</span></label>
                    <input
                        type="text"
                        name="guardian_grandfathers_name"
                        value={formData.guardian_grandfathers_name}
                        onChange={handleFieldChange}
                        className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.guardian_grandfathers_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md focus:shadow-xl focus:shadow-indigo-100'}`}
                        required
                    />
                    {errors.guardian_grandfathers_name && <span className="text-red-500">{errors.guardian_grandfathers_name}</span>}
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-lg"><User className="w-4 h-4 text-indigo-600" /></div>اسم العائلة<span className="text-red-500 text-lg">*</span></label>
                    <input
                        type="text"
                        name="guardian_last_name"
                        value={formData.guardian_last_name}
                        onChange={handleFieldChange}
                        className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.guardian_last_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md focus:shadow-xl focus:shadow-indigo-100'}`}
                        required
                    />
                    {errors.guardian_last_name && <span className="text-red-500">{errors.guardian_last_name}</span>}
                </div>
                </div>
            </div>

            <div className="mb-6 p-8 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 rounded-3xl border-2 border-sky-200 shadow-lg">
            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-sky-100 to-blue-100 rounded-lg"><Hash className="w-4 h-4 text-sky-600" /></div>رقم هوية الوصي<span className="text-red-500 text-lg">*</span></label>
                <input
                    type="number"
                    name="guardian_id_number"
                    value={formData.guardian_id_number}
                    onChange={handleFieldChange}
                    className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none text-gray-800 font-medium ${errors.guardian_id_number ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}`}
                    required
                />
                {errors.guardian_id_number && <span className="text-red-500">{errors.guardian_id_number}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg"><Users className="w-4 h-4 text-indigo-600" /></div>صلة قرابة الوصي<span className="text-red-500 text-lg">*</span></label>
                <input
                    type="text"
                    name="guardian_relationship"
                    value={formData.guardian_relationship}
                    onChange={handleFieldChange}
                    className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.guardian_relationship ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md focus:shadow-xl focus:shadow-indigo-100'}`}
                    required
                />
                {errors.guardian_relationship && <span className="text-red-500">{errors.guardian_relationship}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg"><Phone className="w-4 h-4 text-emerald-600" /></div>رقم الجوال<span className="text-red-500 text-lg">*</span></label>
                <input
                    type="text"
                    name="guardian_phone_number"
                    value={formData.guardian_phone_number}
                    onChange={handleFieldChange}
                    className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.guardian_phone_number ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md focus:shadow-xl focus:shadow-emerald-100'}`}
                    required
                />
                {errors.guardian_phone_number && <span className="text-red-500">{errors.guardian_phone_number}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg"><Phone className="w-4 h-4 text-teal-600" /></div>رقم جوال بديل<span className="text-red-500 text-lg">*</span></label>
                <input
                    type="text"
                    name="alternative_phone_number"
                    value={formData.alternative_phone_number}
                    onChange={handleFieldChange}
                    className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-teal-200 focus:border-teal-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.alternative_phone_number ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-teal-300 hover:shadow-md focus:shadow-xl focus:shadow-teal-100'}`}
                    required
                />
                {errors.alternative_phone_number && <span className="text-red-500">{errors.alternative_phone_number}</span>}
            </div>
            </div>
        </div>
    );
};

export default GuardianForm;
