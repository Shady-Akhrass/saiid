import React, { useState } from 'react';
import { User, Phone, Hash, FileText } from 'lucide-react';

const ManagerForm = ({ formData, handleChange }) => {
    const [errors, setErrors] = useState({});

    const validateField = (name, value) => {
        switch (name) {
            case 'manager_id_number':
                if (!value.trim()) {
                    return 'رقم هوية المدير مطلوب.';
                }
                if (!/^\d{9}$/.test(value)) {
                    return 'رقم الهوية يجب أن يتكون من 9 أرقام.';
                }
                break;
            case 'manager_name':
                if (!value.trim()) {
                    return 'اسم المدير مطلوب.';
                }
                break;
            case 'manager_phone':
                if (!value.trim()) {
                    return 'رقم هاتف المدير مطلوب.';
                }
                if (!/^05\d{8}$/.test(value)) {
                    return 'رقم الهاتف يجب أن يبدأ ب 05 ويتكون من 10 أرقام.';
                }
                break;
            case 'manager_job_description':
                if (!value.trim()) {
                    return 'الوصف الوظيفي للمدير مطلوب.';
                }
                break;
            default:
                return '';
        }
    };

    const handleFieldChange = (e) => {
        const { name, value } = e.target;
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
        handleChange(e);
    };

    return (
        <div className="manager-form" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {/* Header */}
            <div className="mb-6 relative overflow-hidden p-6 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-3xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                <div className="relative flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                        <User className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">معلومات مدير مركز النزوح</h2>
                        <p className="text-emerald-100 text-sm">يرجى تعبئة بيانات المدير</p>
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3"><span>رقم هوية المدير</span><span className="text-red-500 text-lg"> *</span></label>
                <input
                    type="text"
                    name="manager_id_number"
                    value={formData.manager_id_number}
                    onChange={handleFieldChange}
                    className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.manager_id_number ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md focus:shadow-xl focus:shadow-emerald-100'}`}
                    required
                />
                {errors.manager_id_number && <span className="text-red-500">{errors.manager_id_number}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">اسم المدير رباعي<span className="text-red-500 text-lg"> *</span></label>
                <input
                    type="text"
                    name="manager_name"
                    value={formData.manager_name}
                    onChange={handleFieldChange}
                    className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.manager_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md focus:shadow-xl focus:shadow-emerald-100'}`}
                    required
                />
                {errors.manager_name && <span className="text-red-500">{errors.manager_name}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3">رقم هاتف المدير<span className="text-red-500 text-lg"> *</span></label>
                    <input
                        type="tel"
                        name="manager_phone"
                        value={formData.manager_phone}
                        onChange={handleFieldChange}
                        className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.manager_phone ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md focus:shadow-xl focus:shadow-emerald-100'}`}
                        required
                    />
                    {errors.manager_phone && <span className="text-red-500">{errors.manager_phone}</span>}
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3">رقم هاتف بديل</label>
                    <input
                        type="tel"
                        name="manager_alternative_phone"
                        value={formData.manager_alternative_phone}
                        onChange={handleFieldChange}
                        className="w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-300 outline-none text-gray-800 font-medium placeholder:text-gray-400 border-gray-200 bg-white hover:border-emerald-200"
                    />
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">الوصف الوظيفي للمدير<span className="text-red-500 text-lg"> *</span></label>
                <textarea
                    name="manager_job_description"
                    value={formData.manager_job_description}
                    onChange={handleFieldChange}
                    className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none resize-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.manager_job_description ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md focus:shadow-xl focus:shadow-emerald-100'}`}
                    required
                />
                {errors.manager_job_description && <span className="text-red-500">{errors.manager_job_description}</span>}
            </div>
        </div>
    );
};

export default ManagerForm;
