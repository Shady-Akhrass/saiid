import React, { useState, useEffect, useRef } from 'react';
import { User, Calendar, FileText, Briefcase, Heart, Hash, Camera } from 'lucide-react';

const FatherForm = ({ formData, handleChange }) => {
    const [errors, setErrors] = useState({});
    const [imagePreview, setImagePreview] = useState(formData.death_certificate ? URL.createObjectURL(formData.death_certificate) : '');
    const fileInputRef = useRef(null);

    const validateField = (name, value) => {
        switch (name) {
            case 'father_first_name':
            case 'father_fathers_name':
            case 'father_grandfathers_name':
            case 'father_last_name':
                if (!value.trim()) {
                    return 'هذا الحقل مطلوب.';
                }
                break;
            case 'deceased_father_birth_date':
                if (!value) {
                    return 'تاريخ الميلاد مطلوب.';
                }
                break;
            case 'death_date':
                if (!value) {
                    return 'تاريخ الوفاة مطلوب.';
                }
                break;
            case 'death_cause':
                if (!value) {
                    return 'يرجى تحديد ما سبب الوفاة.';
                }
                break;
            case 'previous_father_job':
                if (!value) {
                    return 'يرجى تحديد طبيعة عمل الأب.';
                }
                break;
            default:
                return '';
        }
    };
    const handleFieldChange = (e) => {
        const { name, value } = e.target;
        const error = validateField(name, value);
        setErrors((prevErrors) => ({ ...prevErrors, [name]: error }));
        handleChange(e);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setErrors((prevErrors) => ({
                    ...prevErrors,
                    death_certificate: 'يرجى تحميل ملف صورة صالح.'
                }));
            } else if (file.size > 2048 * 1024) {
                setErrors((prevErrors) => ({
                    ...prevErrors,
                    death_certificate: 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت. يمكنك استخدام أداة مثل ' +
                        '<a href="https://compressjpeg.com/" target="_blank" rel="noopener noreferrer" style="color: blue; font-weight: bold;">Compress JPEG</a> لتصغير حجم الصورة.'
                }));
            } else {
                setErrors((prevErrors) => ({ ...prevErrors, death_certificate: '' }));
                handleChange({ target: { name: 'death_certificate', files: [file] } });
                setImagePreview(URL.createObjectURL(file));
            }
        }
    };

    const handleDragOver = (e) => e.preventDefault();

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setErrors((prevErrors) => ({
                    ...prevErrors,
                    death_certificate: 'يرجى تحميل ملف صورة صالح.'
                }));
            } else if (file.size > 2048 * 1024) {
                setErrors((prevErrors) => ({
                    ...prevErrors,
                    death_certificate: 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت. يمكنك استخدام أداة مثل ' +
                        '<a href="https://compressjpeg.com/" target="_blank" rel="noopener noreferrer" style="color: blue; font-weight: bold;">Compress JPEG</a> لتصغير حجم الصورة.'
                }));
            } else {
                setErrors((prevErrors) => ({ ...prevErrors, death_certificate: '' }));
                handleChange({ target: { name: 'death_certificate', files: [file] } });
                setImagePreview(URL.createObjectURL(file));
            }
        }
    };

    const handleImageBoxClick = () => {
        fileInputRef.current.click();
    };
    return (
        <div className="father-form" style={ { fontFamily: 'Cairo, sans-serif' } }>
            {/* Header */ }
            <div className="mb-6 relative overflow-hidden p-6 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 rounded-3xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                <div className="relative flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                        <User className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">بيانات الأب</h2>
                        <p className="text-blue-100 text-sm">يرجى تعبئة الحقول المطلوبة</p>
                    </div>
                </div>
            </div>

            {/* Names */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 rounded-3xl border-2 border-sky-200 shadow-lg">
                <h3 className="text-xl font-bold text-sky-800 mb-6 flex items-center gap-3 pb-3 border-b-2 border-sky-200">
                    <div className="p-2 bg-gradient-to-br from-sky-400 to-blue-500 rounded-xl shadow-md">
                        <User className="w-5 h-5 text-white" />
                    </div>
                    <span>المعلومات الأساسية</span>
                </h3>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-sky-100 to-blue-100 rounded-lg"><User className="w-4 h-4 text-sky-600" /></div>الاسم الأول<span className="text-red-500 text-lg">*</span></label>
                        <input
                            type="text"
                            name="father_first_name"
                            value={ formData.father_first_name }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.father_first_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}` }
                            required
                        />
                        { errors.father_first_name && <span className="text-red-500">{ errors.father_first_name }</span> }
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg"><User className="w-4 h-4 text-blue-600" /></div>اسم الأب<span className="text-red-500 text-lg">*</span></label>
                        <input
                            type="text"
                            name="father_fathers_name"
                            value={ formData.father_fathers_name }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.father_fathers_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}` }
                            required
                        />
                        { errors.father_fathers_name && <span className="text-red-500">{ errors.father_fathers_name }</span> }
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-purple-100 to-fuchsia-100 rounded-lg"><User className="w-4 h-4 text-purple-600" /></div>اسم الجد<span className="text-red-500 text-lg">*</span></label>
                        <input
                            type="text"
                            name="father_grandfathers_name"
                            value={ formData.father_grandfathers_name }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.father_grandfathers_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}` }
                            required
                        />
                        { errors.father_grandfathers_name && <span className="text-red-500">{ errors.father_grandfathers_name }</span> }
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-lg"><User className="w-4 h-4 text-indigo-600" /></div>اسم العائلة<span className="text-red-500 text-lg">*</span></label>
                        <input
                            type="text"
                            name="father_last_name"
                            value={ formData.father_last_name }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.father_last_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}` }
                            required
                        />
                        { errors.father_last_name && <span className="text-red-500">{ errors.father_last_name }</span> }
                    </div>
                </div>
            </div>

            {/* Dates */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-3xl border-2 border-emerald-200 shadow-lg">
                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg"><Calendar className="w-4 h-4 text-teal-600" /></div>تاريخ ميلاد الأب<span className="text-red-500 text-lg">*</span></label>
                    <input
                        type="date"
                        name="deceased_father_birth_date"
                        value={ formData.deceased_father_birth_date }
                        onChange={ handleFieldChange }
                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-teal-200 focus:border-teal-500 outline-none text-gray-800 font-medium ${errors.deceased_father_birth_date ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-teal-300 hover:shadow-md focus:shadow-xl focus:shadow-teal-100'}` }
                        required
                    />
                    { errors.deceased_father_birth_date && <span className="text-red-500">{ errors.deceased_father_birth_date }</span> }
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-rose-100 to-pink-100 rounded-lg"><Calendar className="w-4 h-4 text-rose-600" /></div>تاريخ وفاة الأب<span className="text-red-500 text-lg">*</span></label>
                    <input
                        type="date"
                        name="death_date"
                        value={ formData.death_date }
                        onChange={ handleFieldChange }
                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none text-gray-800 font-medium ${errors.death_date ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'}` }
                        required
                    />
                    { errors.death_date && <span className="text-red-500">{ errors.death_date }</span> }
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-rose-100 to-amber-100 rounded-lg"><Heart className="w-4 h-4 text-rose-600" /></div>سبب وفاة الأب<span className="text-red-500 text-lg">*</span></label>
                    <select
                        name="death_cause"
                        value={ formData.death_cause }
                        onChange={ handleFieldChange }
                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.death_cause ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'}` }
                        required
                    >
                        <option value="">سبب الوفاة</option>
                        <option value="شهيد حرب">شهيد حرب</option>
                        <option value="وفاة طبيعية">وفاة طبيعية</option>
                        <option value="وفاة بسبب المرض">وفاة بسبب المرض</option>
                    </select>
                    { errors.death_cause && <span className="text-red-500">{ errors.death_cause }</span> }
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-lg"><Briefcase className="w-4 h-4 text-amber-600" /></div>طبيعة عمل الأب<span className="text-red-500 text-lg">*</span></label>
                    <select
                        name="previous_father_job"
                        value={ formData.previous_father_job }
                        onChange={ handleFieldChange }
                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-amber-200 focus:border-amber-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.previous_father_job ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 hover:border-amber-300 hover:shadow-md focus:shadow-xl focus:shadow-amber-100'}` }
                        required
                    >
                        <option value="">اختر طبيعة العمل</option>
                        <option value="قطاع حكومي">قطاع حكومي</option>
                        <option value="قطاع خاص">قطاع خاص</option>
                        <option value="لا يعمل">لا يعمل</option>
                    </select>
                    { errors.previous_father_job && <span className="text-red-500">{ errors.previous_father_job }</span> }
                </div>

                <div className='mb-6 p-8 bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 rounded-3xl border-2 border-cyan-200 shadow-lg'>
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-lg"><FileText className="w-4 h-4 text-cyan-600" /></div>صورة شهادة وفاة الأب</label>
                    <div
                        className={ `relative p-10 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all duration-300 bg-white/50 backdrop-blur-sm ${errors.death_certificate ? 'border-red-400 bg-red-50' : 'border-cyan-300 hover:border-cyan-400 hover:bg-cyan-50 hover:shadow-2xl'}` }
                        onDragOver={ handleDragOver }
                        onDrop={ handleDrop }
                        onClick={ handleImageBoxClick }
                    >
                        { imagePreview ? (
                            <div className="space-y-5">
                                <div className="relative inline-block">
                                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 via-blue-400 to-indigo-400 rounded-3xl blur-2xl opacity-60"></div>
                                    <img src={ imagePreview } alt="Preview" className="relative w-40 h-40 object-cover rounded-3xl border-4 border-white shadow-2xl mx-auto" />
                                </div>
                                <p className="text-gray-700 font-bold text-lg mb-1">✓ تم رفع الصورة بنجاح</p>
                                <p className="text-gray-500 text-sm">انقر لتغيير الصورة</p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-cyan-100 via-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center">
                                    <Camera className="w-12 h-12 text-cyan-600" />
                                </div>
                                <div>
                                    <p className="text-gray-800 font-bold text-lg mb-2">اسحب وأفلت الصورة هنا</p>
                                    <p className="text-gray-600 text-base mb-3">أو انقر لاختيار صورة</p>
                                </div>
                            </div>
                        ) }
                        <input type="file" accept="image/*" onChange={ handleFileChange } className="hidden" ref={ fileInputRef } required />
                    </div>
                    { errors.death_certificate && (
                        <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
                            <span className="text-red-700 text-sm font-medium" dangerouslySetInnerHTML={ { __html: errors.death_certificate } }></span>
                        </div>
                    ) }

                </div>
            </div>
        </div>
    );
};

export default FatherForm;