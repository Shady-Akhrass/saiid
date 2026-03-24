import React, { useState, useRef } from 'react';
import { User, Calendar, Heart, FileText, Camera, Hash } from 'lucide-react';

const MotherForm = ({ formData, handleChange }) => {
    const [errors, setErrors] = useState({});
    const [isMotherDeceased, setIsMotherDeceased] = useState(false);
    const [imagePreview, setImagePreview] = useState(formData.mother_death_certificate ? URL.createObjectURL(formData.mother_death_certificate) : '');
    const fileInputRef = useRef(null);
    const validateField = (name, value) => {
        switch (name) {
            case 'mother_first_name':
            case 'mother_fathers_name':
            case 'mother_grandfathers_name':
            case 'mother_last_name':
                if (!value.trim()) {
                    return 'هذا الحقل مطلوب.';
                }
                break;
            case 'mother_id_number':
                if (!value.trim()) {
                    return 'رقم هوية الام مطلوبة.';
                }
                if (!/^\d+$/.test(value)) {
                    return 'رقم الهوية يجب أن يكون أرقامًا فقط.';
                }
                if (value.trim().length !== 9) {
                    return 'رقم الهوية يجب أن يكون 9 ارقام.';
                }
                break;
            case 'mother_birth_date':
                if (!value) {
                    return 'تاريخ الميلاد مطلوب.';
                }
                break;
            case 'is_mother_deceased':
                if (!value) {
                    return 'هذا الحقل مطلوب';
                }
                break;
            case 'mother_status':
                if (!value) {
                    return 'يرجى اختبار حالة الأم.';
                }
                break;
            case 'mother_job':
                if (!value) {
                    return 'طبيعة عمل الأم مطلوبة.';
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
                    mother_death_certificate: 'يرجى تحميل ملف صورة صالح.'
                }));
            } else if (file.size > 2048 * 1024) {
                setErrors((prevErrors) => ({
                    ...prevErrors,
                    mother_death_certificate: 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت. يمكنك استخدام أداة مثل '
                        + '<a href="https://compressjpeg.com/" target="_blank" rel="noopener noreferrer" style="color: blue; font-weight: bold;">Compress JPEG</a> لتصغير حجم الصورة.'
                }));
            } else {
                setErrors((prevErrors) => ({ ...prevErrors, mother_death_certificate: '' }));
                handleChange({ target: { name: 'mother_death_certificate', files: [file] } });
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
                    mother_death_certificate: 'يرجى تحميل ملف صورة صالح.'
                }));
            } else if (file.size > 2048 * 1024) {
                setErrors((prevErrors) => ({
                    ...prevErrors,
                    mother_death_certificate: 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت. يمكنك استخدام أداة مثل '
                        + '<a href="https://compressjpeg.com/" target="_blank" rel="noopener noreferrer" style="color: blue; font-weight: bold;">Compress JPEG</a> لتصغير حجم الصورة.'
                }));
            } else {
                setErrors((prevErrors) => ({ ...prevErrors, mother_death_certificate: '' }));
                handleChange({ target: { name: 'mother_death_certificate', files: [file] } });
                setImagePreview(URL.createObjectURL(file));
            }
        }
    };

    const handleImageBoxClick = () => {
        fileInputRef.current.click();
    };


    return (
        <div className="mother-form" style={ { fontFamily: 'Cairo, sans-serif' } }>
            {/* Header */ }
            <div className="mb-6 relative overflow-hidden p-6 bg-gradient-to-br from-rose-400 via-pink-400 to-fuchsia-500 rounded-3xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                <div className="relative flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                        <User className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">بيانات الأم</h2>
                        <p className="text-pink-100 text-sm">يرجى تعبئة الحقول بدقة</p>
                    </div>
                </div>
            </div>

            {/* Names Section */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-rose-50 via-pink-50 to-red-50 rounded-3xl border-2 border-rose-200 shadow-lg">
                <h3 className="text-xl font-bold text-rose-800 mb-6 flex items-center gap-3 pb-3 border-b-2 border-rose-200">
                    <div className="p-2 bg-gradient-to-br from-rose-400 to-pink-500 rounded-xl shadow-md">
                        <User className="w-5 h-5 text-white" />
                    </div>
                    <span>المعلومات الأساسية</span>
                </h3>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <div className="p-1.5 bg-gradient-to-br from-rose-100 to-pink-100 rounded-lg"><User className="w-4 h-4 text-rose-600" /></div>
                            <span>الاسم الأول</span>
                            <span className="text-red-500 text-lg">*</span>
                        </label>
                        <input
                            type="text"
                            name="mother_first_name"
                            value={ formData.mother_first_name }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.mother_first_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'}` }
                            required
                        />
                        { errors.mother_first_name && <span className="text-red-500">{ errors.mother_first_name }</span> }
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <div className="p-1.5 bg-gradient-to-br from-pink-100 to-rose-100 rounded-lg"><User className="w-4 h-4 text-pink-600" /></div>
                            <span>اسم الأب</span>
                            <span className="text-red-500 text-lg">*</span>
                        </label>
                        <input
                            type="text"
                            name="mother_fathers_name"
                            value={ formData.mother_fathers_name }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.mother_fathers_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'}` }
                            required
                        />
                        { errors.mother_fathers_name && <span className="text-red-500">{ errors.mother_fathers_name }</span> }
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <div className="p-1.5 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg"><User className="w-4 h-4 text-purple-600" /></div>
                            <span>اسم الجد</span>
                            <span className="text-red-500 text-lg">*</span>
                        </label>
                        <input
                            type="text"
                            name="mother_grandfathers_name"
                            value={ formData.mother_grandfathers_name }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.mother_grandfathers_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'}` }
                            required
                        />
                        { errors.mother_grandfathers_name && <span className="text-red-500">{ errors.mother_grandfathers_name }</span> }
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <div className="p-1.5 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-lg"><User className="w-4 h-4 text-indigo-600" /></div>
                            <span>اسم العائلة</span>
                            <span className="text-red-500 text-lg">*</span>
                        </label>
                        <input
                            type="text"
                            name="mother_last_name"
                            value={ formData.mother_last_name }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.mother_last_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'}` }
                            required
                        />
                        { errors.mother_last_name && <span className="text-red-500">{ errors.mother_last_name }</span> }
                    </div>
                </div>
            </div>

            {/* ID and Birth */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-pink-50 via-rose-50 to-amber-50 rounded-3xl border-2 border-pink-200 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-rose-100 to-pink-100 rounded-lg"><Hash className="w-4 h-4 text-rose-600" /></div>رقم هوية الأم<span className="text-red-500 text-lg">*</span></label>
                        <input
                            type="number"
                            name="mother_id_number"
                            value={ formData.mother_id_number }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none text-gray-800 font-medium ${errors.mother_id_number ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-2 00 bg-white hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'}` }
                            required
                        />
                        { errors.mother_id_number && <span className="text-red-500">{ errors.mother_id_number }</span> }
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-lg"><Calendar className="w-4 h-4 text-amber-600" /></div>تاريخ ميلاد الأم<span className="text-red-500 text-lg">*</span></label>
                        <input
                            type="date"
                            name="mother_birth_date"
                            value={ formData.mother_birth_date }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-amber-200 focus:border-amber-500 outline-none text-gray-800 font-medium ${errors.mother_birth_date ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-amber-300 hover:shadow-md focus:shadow-xl focus:shadow-amber-100'}` }
                            required
                        />
                        { errors.mother_birth_date && <span className="text-red-500">{ errors.mother_birth_date }</span> }
                    </div>
                </div>
            </div>

            {/* Status */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-fuchsia-50 via-rose-50 to-pink-50 rounded-3xl border-2 border-fuchsia-200 shadow-lg">
                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-rose-100 to-pink-100 rounded-lg"><Heart className="w-4 h-4 text-rose-600" /></div>هل الأم متوفاة<span className="text-red-500 text-lg">*</span></label>
                    <select
                        name="is_mother_deceased"
                        value={ formData.is_mother_deceased }
                        onChange={ handleFieldChange }
                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.is_mother_deceasede ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'}` }
                        required
                    >
                        <option value="">اختار نعم أو لا</option>
                        <option value="نعم">نعم</option>
                        <option value="لا">لا</option>
                    </select>
                    { errors.is_mother_deceased && <span className="text-red-500">{ errors.is_mother_deceased }</span> }
                </div>

                { formData.is_mother_deceased === 'نعم' && (
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-rose-100 to-pink-100 rounded-lg"><Calendar className="w-4 h-4 text-rose-600" /></div>تاريخ وفاة الأم</label>
                        <input
                            type="date"
                            name="mother_death_date"
                            value={ formData.mother_death_date }
                            onChange={ handleFieldChange }
                            className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none text-gray-800 font-medium ${errors.mother_death_date ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'}` }
                        />
                        { errors.mother_death_date && <span className="text-red-500">{ errors.mother_death_date }</span> }
                    </div>
                ) }

                { formData.is_mother_deceased === 'نعم' && (
                    <div className='mb-4'>
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-rose-100 to-pink-100 rounded-lg"><FileText className="w-4 h-4 text-rose-600" /></div>صورة شهادة وفاة الأم</label>
                        <div
                            className={ `relative p-8 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all duration-300 bg-white/50 backdrop-blur-sm ${errors.mother_death_certificate ? 'border-red-400 bg-red-50' : 'border-rose-300 hover:border-rose-400 hover:bg-rose-50 hover:shadow-lg'}` }
                            onDragOver={ handleDragOver }
                            onDrop={ handleDrop }
                            onClick={ handleImageBoxClick }
                        >
                            { imagePreview ? (
                                <div className="space-y-4">
                                    <div className="relative inline-block">
                                        <div className="absolute inset-0 bg-gradient-to-br from-rose-400 to-pink-400 rounded-2xl blur-xl opacity-50"></div>
                                        <img src={ imagePreview } alt="Preview" className="relative w-40 h-40 object-cover rounded-2xl border-4 border-white shadow-xl mx-auto" />
                                    </div>
                                    <p className="text-sm text-gray-600 font-medium">انقر لتغيير الصورة</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="mx-auto w-20 h-20 bg-gradient-to-br from-rose-100 to-pink-100 rounded-2xl flex items-center justify-center">
                                        <Camera className="w-10 h-10 text-rose-500" />
                                    </div>
                                    <div>
                                        <p className="text-gray-700 font-semibold mb-2">اسحب وأفلت الصورة هنا</p>
                                        <p className="text-gray-500 text-sm">أو انقر لاختيار صورة</p>
                                    </div>
                                </div>
                            ) }
                            <input type="file" accept="image/*" onChange={ handleFileChange } className="hidden" ref={ fileInputRef } required />
                        </div>
                        { errors.mother_death_certificate && (
                            <div className="mt-3 p-3 bg-red-50 border-2 border-red-200 rounded-xl">
                                <span className="text-red-600 text-sm" dangerouslySetInnerHTML={ { __html: errors.mother_death_certificate } }></span>
                            </div>
                        ) }
                    </div>
                ) }

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-pink-100 to-rose-100 rounded-lg"><User className="w-4 h-4 text-rose-600" /></div>الحالة الاجتماعية للأم<span className="text-red-500 text-lg">*</span></label>
                    <select
                        name="mother_status"
                        value={ formData.mother_status }
                        onChange={ handleFieldChange }
                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.mother_status ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'}` }
                        required
                    >
                        <option value="">اختار الحالة الاجتماعية</option>
                        <option value="أرملة">أرملة</option>
                        <option value="متزوجة">متزوجة</option>
                    </select>
                    { errors.mother_status && <span className="text-red-500">{ errors.mother_status }</span> }
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><div className="p-1.5 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-lg"><FileText className="w-4 h-4 text-amber-600" /></div>طبيعة عمل الأم<span className="text-red-500 text-lg">*</span></label>
                    <select
                        name="mother_job"
                        value={ formData.mother_job }
                        onChange={ handleFieldChange }
                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-amber-200 focus:border-amber-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.mother_job ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 hover:border-amber-300 hover:shadow-md focus:shadow-xl focus:shadow-amber-100'}` }
                        required
                    >
                        <option value="">اختر طبيعة العمل</option>
                        <option value="قطاع حكومي">قطاع حكومي</option>
                        <option value="قطاع خاص">قطاع خاص</option>
                        <option value="لا تعمل">لا تعمل</option>
                    </select>
                    { errors.mother_job && <span className="text-red-500">{ errors.mother_job }</span> }
                </div>
            </div>
        </div>

    );
};

export default MotherForm;