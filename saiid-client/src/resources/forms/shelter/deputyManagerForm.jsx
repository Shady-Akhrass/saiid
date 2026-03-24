import React, { useState } from 'react';
import { Users, Phone, Hash, FileText } from 'lucide-react';

const DeputyManagerForm = ({ formData, handleChange }) => {
    const [errors, setErrors] = useState({});

    const validateField = (name, value) => {
        switch (name) {
            case 'deputy_manager_id_number':
                if (!value.trim()) {
                    return 'رقم هوية نائب المدير مطلوب.';
                }
                if (!/^\d{9}$/.test(value)) {
                    return 'رقم الهوية يجب أن يتكون من 9 أرقام.';
                }
                break;
            case 'deputy_manager_name':
                if (!value.trim()) {
                    return 'اسم نائب المدير مطلوب.';
                }
                break;
            case 'deputy_manager_phone':
                if (!value.trim()) {
                    return 'رقم هاتف نائب المدير مطلوب.';
                }
                if (!/^05\d{8}$/.test(value)) {
                    return 'رقم الهاتف يجب أن يبدأ ب 05 ويتكون من 10 أرقام.';
                }
                break;
            case 'deputy_manager_job_description':
                if (!value.trim()) {
                    return 'الوصف الوظيفي لنائب المدير مطلوب.';
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
        <div className="deputy-manager-form" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {/* Header */}
            <div className="mb-6 relative overflow-hidden p-6 bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600 rounded-3xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                <div className="relative flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                        <Users className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">معلومات نائب مدير مركز النزوح</h2>
                        <p className="text-purple-100 text-sm">أدخل بيانات النائب بدقة</p>
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">رقم هوية نائب المدير<span className="text-red-500 text-lg"> *</span></label>
                <input
                    type="text"
                    name="deputy_manager_id_number"
                    value={formData.deputy_manager_id_number}
                    onChange={handleFieldChange}
                    className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-fuchsia-200 focus:border-fuchsia-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.deputy_manager_id_number ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-fuchsia-300 hover:shadow-md focus:shadow-xl focus:shadow-fuchsia-100'}`}
                    required
                />
                {errors.deputy_manager_id_number && <span className="text-red-500">{errors.deputy_manager_id_number}</span>}
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">اسم نائب المدير رباعي<span className="text-red-500 text-lg"> *</span></label>
                <input
                    type="text"
                    name="deputy_manager_name"
                    value={formData.deputy_manager_name}
                    onChange={handleFieldChange}
                    className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-fuchsia-200 focus:border-fuchsia-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.deputy_manager_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-fuchsia-300 hover:shadow-md focus:shadow-xl focus:shadow-fuchsia-100'}`}
                    required
                />
                {errors.deputy_manager_name && <span className="text-red-500">{errors.deputy_manager_name}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3">رقم هاتف نائب المدير<span className="text-red-500 text-lg"> *</span></label>
                    <input
                        type="tel"
                        name="deputy_manager_phone"
                        value={formData.deputy_manager_phone}
                        onChange={handleFieldChange}
                        className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-fuchsia-200 focus:border-fuchsia-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.deputy_manager_phone ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-fuchsia-300 hover:shadow-md focus:shadow-xl focus:shadow-fuchsia-100'}`}
                        required
                    />
                    {errors.deputy_manager_phone && <span className="text-red-500">{errors.deputy_manager_phone}</span>}
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3">رقم هاتف بديل لنائب المدير</label>
                    <input
                        type="tel"
                        name="deputy_manager_alternative_phone"
                        value={formData.deputy_manager_alternative_phone}
                        onChange={handleFieldChange}
                        className="w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-fuchsia-100 focus:border-fuchsia-300 outline-none text-gray-800 font-medium placeholder:text-gray-400 border-gray-200 bg-white hover:border-fuchsia-200"
                    />
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">الوصف الوظيفي لنائب المدير<span className="text-red-500 text-lg"> *</span></label>
                <textarea
                    name="deputy_manager_job_description"
                    value={formData.deputy_manager_job_description}
                    onChange={handleFieldChange}
                    className={`w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-fuchsia-200 focus:border-fuchsia-500 outline-none resize-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.deputy_manager_job_description ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-fuchsia-300 hover:shadow-md focus:shadow-xl focus:shadow-fuchsia-100'}`}
                    required
                />
                {errors.deputy_manager_job_description && <span className="text-red-500">{errors.deputy_manager_job_description}</span>}
            </div>
        </div>
    );
};

export default DeputyManagerForm;
