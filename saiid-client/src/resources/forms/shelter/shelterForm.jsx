import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const ShelterForm = ({ formData, handleChange }) => {
    const [filePreview, setFilePreview] = useState(formData.excel_sheet ? formData.excel_sheet.name : '');
    const [errors, setErrors] = useState({});
    const fileInputRef = useRef(null);

    const validateField = (name, value) => {
        switch (name) {
            case 'camp_name':
                if (!value.trim()) {
                    return 'اسم المخيم مطلوب.';
                }
                break;
            case 'governorate':
                if (!value) {
                    return 'المحافظة مطلوبة.';
                }
                break;
            case 'district':
                if (!value.trim()) {
                    return 'الحي مطلوب.';
                }
                break;
            case 'detailed_address':
                if (!value.trim()) {
                    return 'العنوان التفصيلي مطلوب.';
                }
                break;
            case 'tents_count':
            case 'families_count':
                if (!value.toString().trim()) {
                    return 'هذا الحقل مطلوب.';
                }
                if (isNaN(value) || value < 0) {
                    return 'يرجى إدخال عدد صحيح موجب.';
                }
                break;
            default:
                return '';
        }
    };

    const validateExcelFile = (file) => {
        const validTypes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        if (!validTypes.includes(file.type)) {
            return 'يرجى تحميل ملف Excel صالح (.xls أو .xlsx)';
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            return 'حجم الملف يجب أن يكون أقل من 5 ميجابايت';
        }

        return '';
    };

    const handleFieldChange = (e) => {
        const { name, value } = e.target;
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
        handleChange(e);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const error = validateExcelFile(file);
            if (error) {
                setErrors((prevErrors) => ({ ...prevErrors, excel_sheet: error }));
                e.target.value = ''; // Reset file input
            } else {
                setErrors((prevErrors) => ({ ...prevErrors, excel_sheet: '' }));
                setFilePreview(file.name);
                handleChange({
                    target: {
                        name: 'excel_sheet',
                        value: file,
                        type: 'file'
                    }
                });
            }
        }
    };

    const handleDragOver = (e) => e.preventDefault();

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            const error = validateExcelFile(file);
            if (error) {
                setErrors((prevErrors) => ({ ...prevErrors, excel_sheet: error }));
            } else {
                setErrors((prevErrors) => ({ ...prevErrors, excel_sheet: '' }));
                setFilePreview(file.name);
                handleChange({
                    target: {
                        name: 'excel_sheet',
                        value: file,
                        type: 'file'
                    }
                });
            }
        }
    };

    const handleFileBoxClick = () => {
        fileInputRef.current.click();
    };

    return (
        <div className="shelter-form" style={ { fontFamily: 'Cairo, sans-serif' } }>
            {/* Header */ }
            <div className="mb-6 relative overflow-hidden p-6 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 rounded-3xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                <div className="relative flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-white"><path d="M3 12l2-2 4 4 8-8 4 4" /></svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">معلومات مركز نزوح</h2>
                        <p className="text-blue-100 text-sm">يرجى تعبئة الحقول التالية بدقة</p>
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">اسم المخيم<span className="text-red-500 text-lg"> *</span></label>
                <input
                    type="text"
                    name="camp_name"
                    value={ formData.camp_name }
                    onChange={ handleFieldChange }
                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.camp_name ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}` }
                    required
                />
                { errors.camp_name && <span className="text-red-500">{ errors.camp_name }</span> }
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">المحافظة<span className="text-red-500 text-lg"> *</span></label>
                <select
                    name="governorate"
                    value={ formData.governorate }
                    onChange={ handleFieldChange }
                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none cursor-pointer text-gray-800 font-medium bg-white ${errors.governorate ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}` }
                    required
                >
                    <option value="">اختر المحافظة</option>
                    <option value="محافظة رفح">محافظة رفح</option>
                    <option value="محافظة خانيونس">محافظة خانيونس</option>
                    <option value="محافظة الوسطى">محافظة الوسطى</option>
                    <option value="محافظة غزة">محافظة غزة</option>
                    <option value="محافظة الشمال">محافظة الشمال</option>
                </select>
                { errors.governorate && <span className="text-red-500">{ errors.governorate }</span> }
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">الحي<span className="text-red-500 text-lg"> *</span></label>
                <input
                    type="text"
                    name="district"
                    value={ formData.district }
                    onChange={ handleFieldChange }
                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.district ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}` }
                    required
                />
                { errors.district && <span className="text-red-500">{ errors.district }</span> }
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">العنوان التفصيلي<span className="text-red-500 text-lg"> *</span></label>
                <textarea
                    name="detailed_address"
                    value={ formData.detailed_address }
                    onChange={ handleFieldChange }
                    className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none resize-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.detailed_address ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}` }
                    required
                />
                { errors.detailed_address && <span className="text-red-500">{ errors.detailed_address }</span> }
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3">عدد الخيام<span className="text-red-500 text-lg"> *</span></label>
                    <input
                        type="number"
                        name="tents_count"
                        value={ formData.tents_count }
                        onChange={ handleFieldChange }
                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.tents_count ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}` }
                        required
                    />
                    { errors.tents_count && <span className="text-red-500">{ errors.tents_count }</span> }
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3">عدد العائلات<span className="text-red-500 text-lg"> *</span></label>
                    <input
                        type="number"
                        name="families_count"
                        value={ formData.families_count }
                        onChange={ handleFieldChange }
                        className={ `w-full px-5 py-4 border-2 rounded-2xl transition-all duration-300 focus:ring-4 focus:ring-sky-200 focus:border-sky-500 outline-none text-gray-800 font-medium placeholder:text-gray-400 ${errors.families_count ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-md focus:shadow-xl focus:shadow-sky-100'}` }
                        required
                    />
                    { errors.families_count && <span className="text-red-500">{ errors.families_count }</span> }
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">ملف Excel للنازحين<span className="text-red-500 text-lg"> *</span></label>
                <Link
                    to="/shelter-template"
                    className="text-blue-600 hover:text-blue-800 text-sm block mb-2"
                    target="_blank"
                >
                    تحميل نموذج Excel فارغ
                </Link>
                <div
                    className={ `mb-4 p-8 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all duration-300 bg-white/50 backdrop-blur-sm ${errors.excel_sheet ? 'border-red-400 bg-red-50' : 'border-cyan-300 hover:border-cyan-400 hover:bg-cyan-50 hover:shadow-lg'}` }
                    onDragOver={ handleDragOver }
                    onDrop={ handleDrop }
                    onClick={ handleFileBoxClick }
                >
                    { filePreview ? (
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg font-semibold">
                                <span>✓</span>
                                <span>{ filePreview }</span>
                            </div>
                            <p className="text-gray-500 text-sm">انقر لتغيير الملف</p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-gray-800 font-bold text-lg mb-1">اسحب وأفلت ملف Excel هنا</p>
                            <p className="text-gray-600 text-base mb-2">أو انقر لاختيار ملف</p>
                            <p className="text-sm text-gray-400">(.xlsx أو .xls)</p>
                        </div>
                    ) }
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={ handleFileChange }
                        className="hidden"
                        ref={ fileInputRef }
                        required
                    />
                </div>
                { errors.excel_sheet && (
                    <span className="text-red-500">{ errors.excel_sheet }</span>
                ) }
            </div>
        </div>
    );
};

export default ShelterForm;
