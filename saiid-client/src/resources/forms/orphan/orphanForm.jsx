import React, { useState, useEffect, useRef } from 'react';
import { User, Calendar, Heart, MapPin, Users, BookOpen, Camera, Hash } from 'lucide-react';

const OrphanForm = ({ formData, handleChange }) => {
    const [imagePreview, setImagePreview] = useState(formData.orphan_photo ? URL.createObjectURL(formData.orphan_photo) : '');
    const [errors, setErrors] = useState({});
    const fileInputRef = useRef(null);

    useEffect(() => {
        const orphan_name = `${formData.orphan_first_name || ''} ${formData.orphan_fathers_name || ''} ${formData.orphan_grandfathers_name || ''} ${formData.orphan_last_name || ''}`.trim();
        handleChange({ target: { name: 'orphan_name', value: orphan_name } });
    }, [formData.orphan_first_name, formData.orphan_fathers_name, formData.orphan_grandfathers_name, formData.orphan_last_name]);

    const validateField = (name, value) => {
        switch (name) {
            case 'orphan_first_name':
            case 'orphan_fathers_name':
            case 'orphan_grandfathers_name':
            case 'orphan_last_name':
                if (!value.trim()) {
                    return 'هذا الحقل مطلوب.';
                }
                break;
            case 'orphan_id_number':
                if (!value.trim()) {
                    return 'رقم هوية اليتيم مطلوب.';
                }
                if (!/^\d+$/.test(value)) {
                    return 'رقم الهوية يجب أن يكون أرقامًا فقط.';
                }
                if (value.trim().length !== 9) {
                    return 'رقم الهوية يجب أن يكون 9 ارقام.';
                }
                break;
            case 'orphan_birth_date':
                if (!value) {
                    return 'تاريخ الميلاد مطلوب.';
                }
                const today = new Date();
                const twelveYearsAgo = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate());

                const enteredDate = new Date(value);

                if (enteredDate < twelveYearsAgo) {
                    return 'يجب أن يكون عمر الطفل أقل من 12 سنة.';
                }
                break;

            case 'health_status':
                if (!value) {
                    return 'الحالة الصحية مطلوبة.';
                }
                break;
            case 'original_address':
            case 'current_address':
                if (!value) {
                    return 'عنوان السكن مطلوب.';
                }
                break;
            case 'is_enrolled_in_memorization_center':
                if (!value) {
                    return 'يرجى تحديد ما إذا كان اليتيم ملتحقًا في مراكز التحفيظ.';
                }
                break;
            case 'orphan_gender':
                if (!value) {
                    return 'يرجى تحديد جنس اليتيم.'
                }
            case 'address_details':
                if (!value) {
                    return 'يرجى إدخال عنوان السكن بالتفصيل'
                }
            case 'orphan_photo':
                if (!value) {
                    return 'يرجى أدخال صورة اليتيم'
                }
                break;
            case 'number_of_brothers':
                if (!value.trim()) {
                    return 'يرجى أدخال عدد الأخوة الذكور'
                }
                if (isNaN(value) || value < 0) {
                    return 'يرجى إدخال عدد صحيح موجب.';
                }
            case 'number_of_sisters':
                if (!value.trim()) {
                    return 'يرجى أدخال عدد الأخوات الاناث'
                }
                if (isNaN(value) || value < 0) {
                    return 'يرجى إدخال عدد صحيح موجب.';
                }
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
                setErrors((prevErrors) => ({ ...prevErrors, orphan_photo: 'يرجى تحميل ملف صورة صالح.' }));
            } else if (file.size > 2048 * 1024) {  // Check if file size is greater than 2MB
                setErrors((prevErrors) => ({
                    ...prevErrors,
                    orphan_photo: 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت. يمكنك استخدام أداة مثل ' +
                        '<a href="https://compressjpeg.com/" target="_blank" rel="noopener noreferrer" style="color: blue; font-weight: bold;">Compress JPEG</a> لتصغير حجم الصورة.'
                }));
            } else {
                setErrors((prevErrors) => ({ ...prevErrors, orphan_photo: '' }));  // Clear previous errors
                handleChange({ target: { name: 'orphan_photo', files: [file] } });
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
                setErrors((prevErrors) => ({ ...prevErrors, orphan_photo: 'يرجى تحميل ملف صورة صالح.' }));
            } else if (file.size > 2048 * 1024) {  // Check if file size is greater than 2MB
                setErrors((prevErrors) => ({
                    ...prevErrors,
                    orphan_photo: 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت. يمكنك استخدام أداة مثل ' +
                        '<a href="https://compressjpeg.com/" target="_blank" rel="noopener noreferrer" style="color: blue; font-weight: bold;">Compress JPEG</a> لتصغير حجم الصورة.'
                }));
            } else {
                setErrors((prevErrors) => ({ ...prevErrors, orphan_photo: '' }));  // Clear previous errors
                handleChange({ target: { name: 'orphan_photo', files: [file] } });
                setImagePreview(URL.createObjectURL(file));
            }
        }
    };



    const handleImageBoxClick = () => {
        fileInputRef.current.click();
    };

    return (
        <div className="orphan-form" style={ { fontFamily: 'Cairo, sans-serif' } }>
            {/* Header Section */ }
            <div className="mb-8 relative overflow-hidden p-8 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 rounded-3xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
                <div className="relative flex items-center gap-4">
                    <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl transform hover:scale-110 transition-transform duration-300">
                        <User className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-1">بيانات اليتيم</h2>
                        <p className="text-blue-100 text-sm">يرجى ملء جميع الحقول المطلوبة</p>
                    </div>
                </div>
            </div>

            {/* Personal Information Section */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 rounded-3xl border-2 border-sky-200 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-200/30 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="relative">
                    <h3 className="text-xl font-bold text-sky-800 mb-6 flex items-center gap-3 pb-3 border-b-2 border-sky-200">
                        <div className="p-2 bg-gradient-to-br from-sky-400 to-blue-500 rounded-xl shadow-md">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <span>المعلومات الشخصية</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-sky-100 to-blue-100 rounded-lg">
                                    <User className="w-4 h-4 text-sky-600" />
                                </div>
                                <span>الاسم الأول</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="orphan_first_name"
                                    value={ formData.orphan_first_name }
                                    onChange={ handleFieldChange }
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.orphan_first_name
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'
                                        }` }
                                    placeholder="أدخل الاسم الأول"
                                    required
                                />
                                { !errors.orphan_first_name && formData.orphan_first_name && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) }
                            </div>
                            { errors.orphan_first_name && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.orphan_first_name }</span>
                                </div>
                            ) }
                        </div>
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
                                    <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <span>اسم الأب</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    required
                                    type="text"
                                    name="orphan_fathers_name"
                                    value={ formData.orphan_fathers_name }
                                    onChange={ handleFieldChange }
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-blue-200 focus:border-blue-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.orphan_fathers_name
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md focus:shadow-xl focus:shadow-blue-100'
                                        }` }
                                    placeholder="أدخل اسم الأب"
                                />
                                { !errors.orphan_fathers_name && formData.orphan_fathers_name && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) }
                            </div>
                            { errors.orphan_fathers_name && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.orphan_fathers_name }</span>
                                </div>
                            ) }
                        </div>
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                                    <User className="w-4 h-4 text-purple-600" />
                                </div>
                                <span>اسم الجد</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    required
                                    type="text"
                                    name="orphan_grandfathers_name"
                                    value={ formData.orphan_grandfathers_name }
                                    onChange={ handleFieldChange }
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-purple-200 focus:border-purple-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.orphan_grandfathers_name
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md focus:shadow-xl focus:shadow-purple-100'
                                        }` }
                                    placeholder="أدخل اسم الجد"
                                />
                                { !errors.orphan_grandfathers_name && formData.orphan_grandfathers_name && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) }
                            </div>
                            { errors.orphan_grandfathers_name && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.orphan_grandfathers_name }</span>
                                </div>
                            ) }
                        </div>
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-lg">
                                    <User className="w-4 h-4 text-indigo-600" />
                                </div>
                                <span>اسم العائلة</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    name="orphan_last_name"
                                    value={ formData.orphan_last_name }
                                    onChange={ handleFieldChange }
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.orphan_last_name
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md focus:shadow-xl focus:shadow-indigo-100'
                                        }` }
                                    placeholder="أدخل اسم العائلة"
                                />
                                { !errors.orphan_last_name && formData.orphan_last_name && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) }
                            </div>
                            { errors.orphan_last_name && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.orphan_last_name }</span>
                                </div>
                            ) }
                        </div>
                    </div>
                </div>
            </div>

            {/* ID and Basic Info Section */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-3xl border-2 border-emerald-200 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-200/30 rounded-full blur-3xl -ml-16 -mb-16"></div>
                <div className="relative">
                    <h3 className="text-xl font-bold text-emerald-800 mb-6 flex items-center gap-3 pb-3 border-b-2 border-emerald-200">
                        <div className="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-md">
                            <Hash className="w-5 h-5 text-white" />
                        </div>
                        <span>المعلومات الأساسية</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg">
                                    <Hash className="w-4 h-4 text-emerald-600" />
                                </div>
                                <span>رقم هوية اليتيم</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="orphan_id_number"
                                    value={ formData.orphan_id_number }
                                    onChange={ handleFieldChange }
                                    dir="ltr"
                                    maxLength={ 9 }
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.orphan_id_number
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md focus:shadow-xl focus:shadow-emerald-100'
                                        }` }
                                    placeholder="123456789"
                                    required
                                />
                                { !errors.orphan_id_number && formData.orphan_id_number && formData.orphan_id_number.length === 9 && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) }
                                { formData.orphan_id_number && formData.orphan_id_number.length < 9 && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                        { formData.orphan_id_number.length }/9
                                    </div>
                                ) }
                            </div>
                            { errors.orphan_id_number && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.orphan_id_number }</span>
                                </div>
                            ) }
                        </div>
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg">
                                    <Calendar className="w-4 h-4 text-teal-600" />
                                </div>
                                <span>تاريخ الميلاد</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    name="orphan_birth_date"
                                    value={ formData.orphan_birth_date }
                                    onChange={ handleFieldChange }
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-teal-200 focus:border-teal-500 outline-none text-gray-800 font-medium ${errors.orphan_birth_date
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 bg-white hover:border-teal-300 hover:shadow-md focus:shadow-xl focus:shadow-teal-100'
                                        }` }
                                    required
                                />
                                { !errors.orphan_birth_date && formData.orphan_birth_date && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) }
                            </div>
                            { errors.orphan_birth_date && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.orphan_birth_date }</span>
                                </div>
                            ) }
                        </div>
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-pink-100 to-rose-100 rounded-lg">
                                    <User className="w-4 h-4 text-pink-600" />
                                </div>
                                <span>الجنس</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    name="orphan_gender"
                                    value={ formData.orphan_gender }
                                    onChange={ handleFieldChange }
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-pink-200 focus:border-pink-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.orphan_gender
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 hover:border-pink-300 hover:shadow-md focus:shadow-xl focus:shadow-pink-100'
                                        }` }
                                    required
                                >
                                    <option value="">اختر الجنس</option>
                                    <option value="ذكر">ذكر</option>
                                    <option value="أنثى">أنثى</option>
                                </select>
                                { !errors.orphan_gender && formData.orphan_gender && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) }
                            </div>
                            { errors.orphan_gender && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.orphan_gender }</span>
                                </div>
                            ) }
                        </div>
                    </div>
                </div>
            </div>
            {/* Health Status Section */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-rose-50 via-pink-50 to-red-50 rounded-3xl border-2 border-rose-200 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-rose-200/30 rounded-full blur-3xl -ml-16 -mt-16"></div>
                <div className="relative">
                    <h3 className="text-xl font-bold text-rose-800 mb-6 flex items-center gap-3 pb-3 border-b-2 border-rose-200">
                        <div className="p-2 bg-gradient-to-br from-rose-400 to-pink-500 rounded-xl shadow-md">
                            <Heart className="w-5 h-5 text-white" />
                        </div>
                        <span>الحالة الصحية</span>
                    </h3>
                    <div className="space-y-5">
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-rose-100 to-pink-100 rounded-lg">
                                    <Heart className="w-4 h-4 text-rose-600" />
                                </div>
                                <span>الحالة الصحية</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    name="health_status"
                                    value={ formData.health_status }
                                    onChange={ handleFieldChange }
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.health_status
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'
                                        }` }
                                    required
                                >
                                    <option value="">اختر الحالة الصحية</option>
                                    <option value="جيدة">جيدة</option>
                                    <option value="مريض">مريض</option>
                                </select>
                                { !errors.health_status && formData.health_status && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className={ `w-2 h-2 rounded-full animate-pulse ${formData.health_status === 'جيدة' ? 'bg-green-500' : 'bg-amber-500'}` }></div>
                                    </div>
                                ) }
                            </div>
                            { errors.health_status && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.health_status }</span>
                                </div>
                            ) }
                        </div>

                        { formData.health_status === 'مريض' && (
                            <div className="group relative animate-fadeIn">
                                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <div className="p-1.5 bg-gradient-to-br from-red-100 to-rose-100 rounded-lg">
                                        <Heart className="w-4 h-4 text-red-600" />
                                    </div>
                                    <span>وصف المرض (في حال وجود مرض)</span>
                                </label>
                                <textarea
                                    name="disease_description"
                                    value={ formData.disease_description }
                                    onChange={ handleFieldChange }
                                    rows={ 4 }
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-rose-200 focus:border-rose-500 outline-none resize-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.disease_description
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 bg-white hover:border-rose-300 hover:shadow-md focus:shadow-xl focus:shadow-rose-100'
                                        }` }
                                    placeholder="أدخل وصف المرض إن وجد..."
                                />
                                { errors.disease_description && (
                                    <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                        <span className="text-red-500">⚠</span>
                                        <span>{ errors.disease_description }</span>
                                    </div>
                                ) }
                            </div>
                        ) }
                    </div>
                </div>
            </div>

            {/* Address Section */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-3xl border-2 border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-orange-200/30 rounded-full blur-3xl -mr-16 -mb-16"></div>
                <div className="relative">
                    <h3 className="text-xl font-bold text-orange-800 mb-6 flex items-center gap-3 pb-3 border-b-2 border-orange-200">
                        <div className="p-2 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl shadow-md">
                            <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <span>معلومات العنوان</span>
                    </h3>
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="group relative">
                                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <div className="p-1.5 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg">
                                        <MapPin className="w-4 h-4 text-orange-600" />
                                    </div>
                                    <span>عنوان السكن الأساسي</span>
                                    <span className="text-red-500 text-lg">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        name="original_address"
                                        value={ formData.original_address }
                                        onChange={ handleFieldChange }
                                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-orange-200 focus:border-orange-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.original_address
                                            ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                            : 'border-gray-200 hover:border-orange-300 hover:shadow-md focus:shadow-xl focus:shadow-orange-100'
                                            }` }
                                        required
                                    >
                                        <option value="">اختر عنوان السكن الأساسي</option>
                                        <option value="محافظة رفح">محافظة رفح</option>
                                        <option value="محافظة خانيونس">محافظة خانيونس</option>
                                        <option value="محافظة الوسطى">محافظة الوسطى</option>
                                        <option value="محافظة غزة">محافظة غزة</option>
                                        <option value="محافظة الشمال">محافظة الشمال</option>
                                    </select>
                                    { !errors.original_address && formData.original_address && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        </div>
                                    ) }
                                </div>
                                { errors.original_address && (
                                    <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                        <span className="text-red-500">⚠</span>
                                        <span>{ errors.original_address }</span>
                                    </div>
                                ) }
                            </div>
                            <div className="group relative">
                                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <div className="p-1.5 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-lg">
                                        <MapPin className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <span>عنوان السكن الحالي</span>
                                    <span className="text-red-500 text-lg">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        name="current_address"
                                        value={ formData.current_address }
                                        onChange={ handleFieldChange }
                                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-amber-200 focus:border-amber-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.current_address
                                            ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                            : 'border-gray-200 hover:border-amber-300 hover:shadow-md focus:shadow-xl focus:shadow-amber-100'
                                            }` }
                                        required
                                    >
                                        <option value="">اختر عنوان السكن الحالي</option>
                                        <option value="محافظة رفح">محافظة رفح</option>
                                        <option value="محافظة خانيونس">محافظة خانيونس</option>
                                        <option value="محافظة الوسطى">محافظة الوسطى</option>
                                        <option value="محافظة غزة">محافظة غزة</option>
                                        <option value="محافظة الشمال">محافظة الشمال</option>
                                    </select>
                                    { !errors.current_address && formData.current_address && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        </div>
                                    ) }
                                </div>
                                { errors.current_address && (
                                    <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                        <span className="text-red-500">⚠</span>
                                        <span>{ errors.current_address }</span>
                                    </div>
                                ) }
                            </div>
                        </div>
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-lg">
                                    <MapPin className="w-4 h-4 text-yellow-600" />
                                </div>
                                <span>عنوان السكن بالتفصيل</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <textarea
                                name="address_details"
                                value={ formData.address_details }
                                required
                                onChange={ handleFieldChange }
                                rows={ 3 }
                                className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-yellow-200 focus:border-yellow-500 outline-none resize-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.address_details
                                    ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                    : 'border-gray-200 bg-white hover:border-yellow-300 hover:shadow-md focus:shadow-xl focus:shadow-yellow-100'
                                    }` }
                                placeholder="أدخل العنوان بالتفصيل..."
                            />
                            { errors.address_details && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.address_details }</span>
                                </div>
                            ) }
                        </div>
                    </div>
                </div>
            </div>
            {/* Family Information Section */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 rounded-3xl border-2 border-violet-200 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-200/30 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="relative">
                    <h3 className="text-xl font-bold text-violet-800 mb-6 flex items-center gap-3 pb-3 border-b-2 border-violet-200">
                        <div className="p-2 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl shadow-md">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <span>معلومات العائلة</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-violet-100 to-purple-100 rounded-lg">
                                    <Users className="w-4 h-4 text-violet-600" />
                                </div>
                                <span>عدد الأخوة الذكور</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    name="number_of_brothers"
                                    value={ formData.number_of_brothers }
                                    onChange={ handleFieldChange }
                                    min="0"
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-violet-200 focus:border-violet-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.number_of_brothers
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 bg-white hover:border-violet-300 hover:shadow-md focus:shadow-xl focus:shadow-violet-100'
                                        }` }
                                    placeholder="0"
                                    required
                                />
                                { !errors.number_of_brothers && formData.number_of_brothers && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) }
                            </div>
                            { errors.number_of_brothers && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.number_of_brothers }</span>
                                </div>
                            ) }
                        </div>
                        <div className="group relative">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-purple-100 to-fuchsia-100 rounded-lg">
                                    <Users className="w-4 h-4 text-purple-600" />
                                </div>
                                <span>عدد الأخوات الإناث</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    name="number_of_sisters"
                                    value={ formData.number_of_sisters }
                                    onChange={ handleFieldChange }
                                    min="0"
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-purple-200 focus:border-purple-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.number_of_sisters
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md focus:shadow-xl focus:shadow-purple-100'
                                        }` }
                                    placeholder="0"
                                    required
                                />
                                { !errors.number_of_sisters && formData.number_of_sisters && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) }
                            </div>
                            { errors.number_of_sisters && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.number_of_sisters }</span>
                                </div>
                            ) }
                        </div>
                        <div className="group relative md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg">
                                    <BookOpen className="w-4 h-4 text-indigo-600" />
                                </div>
                                <span>هل اليتيم ملتحق في مراكز التحفيظ</span>
                                <span className="text-red-500 text-lg">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    name="is_enrolled_in_memorization_center"
                                    value={ formData.is_enrolled_in_memorization_center }
                                    onChange={ handleFieldChange }
                                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.is_enrolled_in_memorization_center
                                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500'
                                        : 'border-gray-200 hover:border-indigo-300 hover:shadow-md focus:shadow-xl focus:shadow-indigo-100'
                                        }` }
                                    required
                                >
                                    <option value="">هل اليتيم ملتحق في مراكز التحفيظ</option>
                                    <option value="نعم">نعم</option>
                                    <option value="لا">لا</option>
                                </select>
                                { !errors.is_enrolled_in_memorization_center && formData.is_enrolled_in_memorization_center && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) }
                            </div>
                            { errors.is_enrolled_in_memorization_center && (
                                <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                                    <span className="text-red-500">⚠</span>
                                    <span>{ errors.is_enrolled_in_memorization_center }</span>
                                </div>
                            ) }
                        </div>
                    </div>
                </div>
            </div>

            {/* Photo Upload Section */ }
            <div className="mb-6 p-8 bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 rounded-3xl border-2 border-cyan-200 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-200/30 rounded-full blur-3xl -ml-16 -mt-16"></div>
                <div className="relative">
                    <h3 className="text-xl font-bold text-cyan-800 mb-6 flex items-center gap-3 pb-3 border-b-2 border-cyan-200">
                        <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl shadow-md">
                            <Camera className="w-5 h-5 text-white" />
                        </div>
                        <span>صورة اليتيم</span>
                    </h3>
                    <div
                        className={ `relative p-10 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all duration-300 group bg-white/50 backdrop-blur-sm hover:bg-white/80 ${errors.orphan_photo
                            ? 'border-red-400 bg-red-50 hover:bg-red-100'
                            : 'border-cyan-300 hover:border-cyan-400 hover:shadow-2xl'
                            }` }
                        onDragOver={ handleDragOver }
                        onDrop={ handleDrop }
                        onClick={ handleImageBoxClick }
                    >
                        { imagePreview ? (
                            <div className="space-y-5">
                                <div className="relative inline-block group-hover:scale-105 transition-transform duration-300">
                                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 via-blue-400 to-indigo-400 rounded-3xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity"></div>
                                    <img
                                        src={ imagePreview }
                                        alt="Preview"
                                        className="relative w-40 h-40 object-cover rounded-3xl border-4 border-white shadow-2xl mx-auto"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-3xl"></div>
                                </div>
                                <div>
                                    <p className="text-gray-700 font-bold text-lg mb-1">✓ تم رفع الصورة بنجاح</p>
                                    <p className="text-gray-500 text-sm">انقر لتغيير الصورة</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-cyan-100 via-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                                    <Camera className="w-12 h-12 text-cyan-600" />
                                </div>
                                <div>
                                    <p className="text-gray-800 font-bold text-lg mb-2">اسحب وأفلت الصورة هنا</p>
                                    <p className="text-gray-600 text-base mb-3">أو انقر لاختيار صورة</p>
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium shadow-md group-hover:shadow-lg transition-shadow">
                                        <Camera className="w-4 h-4" />
                                        <span>اختر صورة</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-4">الحجم الأقصى: 2 ميجابايت</p>
                                </div>
                            </div>
                        ) }
                        <input
                            type="file"
                            accept="image/*"
                            onChange={ handleFileChange }
                            className="hidden"
                            ref={ fileInputRef }
                            required
                        />
                    </div>
                    { errors.orphan_photo && (
                        <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl shadow-md">
                            <div className="flex items-start gap-3">
                                <span className="text-red-500 text-xl">⚠</span>
                                <span className="text-red-700 text-sm font-medium" dangerouslySetInnerHTML={ { __html: errors.orphan_photo } }></span>
                            </div>
                        </div>
                    ) }
                </div>
            </div>
        </div>
    );
};

export default OrphanForm;

