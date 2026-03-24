import React, { useState, useEffect } from 'react';
import { X, Save, FileText, User, Phone, Home, MapPin, Users, Trash2 } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || "https://forms-api.saiid.org/api";

const EditShelterModal = ({
    isOpen,
    onClose,
    shelterId,
    onUpdateSuccess
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [excelFile, setExcelFile] = useState(null);
    const [currentExcelFileName, setCurrentExcelFileName] = useState('');

    const [formData, setFormData] = useState({
        // Manager data
        manager_id_number: '',
        manager_name: '',
        manager_phone: '',
        manager_alternative_phone: '',
        manager_job_description: '',

        // Deputy Manager data
        deputy_manager_name: '',
        deputy_manager_id_number: '',
        deputy_manager_phone: '',
        deputy_manager_alternative_phone: '',
        deputy_manager_job_description: '',

        // Shelter data
        camp_name: '',
        governorate: '',
        district: '',
        detailed_address: '',
        tents_count: '',
        families_count: '',
    });

    // Load shelter data when modal opens
    useEffect(() => {
        if (isOpen && shelterId) {
            loadShelterData();
        }
    }, [isOpen, shelterId]);

    const loadShelterData = async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const response = await axios.get(
                `${API_BASE}/shelters/${shelterId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.data && response.data.success && response.data.shelter) {
                const shelter = response.data.shelter;
                setFormData({
                    manager_id_number: shelter.manager_id_number || '',
                    manager_name: shelter.manager_name || '',
                    manager_phone: shelter.manager_phone || '',
                    manager_alternative_phone: shelter.manager_alternative_phone || '',
                    manager_job_description: shelter.manager_job_description || '',

                    deputy_manager_name: shelter.deputy_manager_name || '',
                    deputy_manager_id_number: shelter.deputy_manager_id_number || '',
                    deputy_manager_phone: shelter.deputy_manager_phone || '',
                    deputy_manager_alternative_phone: shelter.deputy_manager_alternative_phone || '',
                    deputy_manager_job_description: shelter.deputy_manager_job_description || '',

                    camp_name: shelter.camp_name || '',
                    governorate: shelter.governorate || '',
                    district: shelter.district || '',
                    detailed_address: shelter.detailed_address || '',
                    tents_count: shelter.tents_count || '',
                    families_count: shelter.families_count || '',
                });

                // Set current Excel file name if exists
                if (shelter.excel_sheet) {
                    const fileName = shelter.excel_sheet.split('/').pop() || 'ملف Excel موجود';
                    setCurrentExcelFileName(fileName);
                } else {
                    setCurrentExcelFileName('');
                }
                setExcelFile(null);
            } else {
                setErrorMessage('فشل في جلب بيانات المخيم');
            }
        } catch (error) {
            console.error('Error loading shelter:', error);
            setErrorMessage(
                error.response?.data?.error ||
                error.response?.data?.message ||
                'فشل في جلب بيانات المخيم'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            const validTypes = [
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel.sheet.macroEnabled.12',
                'text/csv'
            ];

            if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
                setErrorMessage('يرجى تحميل ملف Excel صالح (.xlsx أو .xls أو .csv)');
                e.target.value = '';
                return;
            }

            // Validate file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                setErrorMessage('حجم الملف يجب أن يكون أقل من 5 ميجابايت');
                e.target.value = '';
                return;
            }

            setExcelFile(file);
            setErrorMessage('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsUpdating(true);
        setErrorMessage('');
        setShowSuccess(false);

        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");

            // Prepare data for submission
            const dataToSend = { ...formData };

            // Remove empty values
            Object.keys(dataToSend).forEach(key => {
                if (dataToSend[key] === '' || dataToSend[key] === null || dataToSend[key] === undefined) {
                    delete dataToSend[key];
                }
            });

            // Use FormData if there's an Excel file, otherwise use JSON
            if (excelFile) {
                const formDataToSend = new FormData();

                // Laravel requires _method for PATCH with FormData
                formDataToSend.append('_method', 'PATCH');

                // Add all fields to FormData
                Object.keys(dataToSend).forEach(key => {
                    // Only append non-empty values
                    if (dataToSend[key] !== '' && dataToSend[key] !== null && dataToSend[key] !== undefined) {
                        formDataToSend.append(key, dataToSend[key]);
                    }
                });

                // Add Excel file - make sure to use the correct field name
                formDataToSend.append('excel_sheet', excelFile);

                // Use POST with _method=PATCH for Laravel FormData compatibility
                // Don't set Content-Type manually - let axios set it with the correct boundary
                const response = await axios.post(
                    `${API_BASE}/shelters/${shelterId}`,
                    formDataToSend,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            // Remove Content-Type - axios will set it automatically with boundary
                        },
                    }
                );

                if (response.data && response.data.success) {
                    // Update current Excel file name if file was uploaded
                    if (excelFile && response.data.shelter?.excel_sheet) {
                        const fileName = response.data.shelter.excel_sheet.split('/').pop() || excelFile.name;
                        setCurrentExcelFileName(fileName);
                    }
                    // Clear the file input
                    setExcelFile(null);

                    showSuccessMessage('تم تحديث بيانات المخيم وملف Excel بنجاح ✓');
                    if (onUpdateSuccess) {
                        onUpdateSuccess(response.data.shelter || dataToSend);
                    }
                } else {
                    setErrorMessage(response.data?.message || 'فشل في تحديث البيانات');
                }
            } else {
                // No file, use JSON
                const response = await axios.patch(
                    `${API_BASE}/shelters/${shelterId}`,
                    dataToSend,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                if (response.data && response.data.success) {
                    showSuccessMessage('تم تحديث بيانات المخيم بنجاح ✓');
                    if (onUpdateSuccess) {
                        onUpdateSuccess(response.data.shelter || dataToSend);
                    }
                } else {
                    setErrorMessage('فشل في تحديث البيانات');
                }
            }
        } catch (error) {
            console.error('Error updating shelter:', error);
            setErrorMessage(
                error.response?.data?.error ||
                error.response?.data?.message ||
                'فشل في تحديث بيانات المخيم'
            );
        } finally {
            setIsUpdating(false);
        }
    };

    const showSuccessMessage = (message) => {
        setSuccessMessage(message);
        setShowSuccess(true);
        // Clear file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.value = '';
        }
        // Reload shelter data to get updated information
        setTimeout(() => {
            loadShelterData();
        }, 500);
        setTimeout(() => {
            setShowSuccess(false);
            onClose();
        }, 2000);
    };

    if (!isOpen) return null;

    return (
        <div
            className={ `fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }` }
        >
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={ onClose }
            />

            <div
                className={ `relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300 ${isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-10"
                    }` }
            >
                {/* Header */ }
                <div className="relative bg-gradient-to-br from-sky-400 via-sky-300 to-orange-200 p-6">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-orange-300/20 rounded-full blur-xl"></div>

                    <button
                        onClick={ onClose }
                        className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all duration-300 group z-10"
                    >
                        <X className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-white/30 rounded-2xl blur-lg"></div>
                            <div className="relative h-16 w-16 flex items-center justify-center rounded-2xl border-3 border-white shadow-xl bg-white">
                                <Home className="w-8 h-8 text-sky-500" />
                            </div>
                        </div>
                        <div className="text-white flex-1">
                            <h1 className="text-2xl font-bold mb-1">تعديل بيانات المخيم</h1>
                            <p className="text-sm opacity-90">تحديث معلومات مركز النزوح</p>
                        </div>
                    </div>
                </div>

                {/* Content */ }
                <div className="p-6 overflow-y-auto" style={ { maxHeight: 'calc(90vh - 200px)' } }>
                    { isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mb-4"></div>
                            <p className="text-gray-600">جاري تحميل البيانات...</p>
                        </div>
                    ) : (
                        <form onSubmit={ handleSubmit } className="space-y-6">
                            {/* Success Message */ }
                            { showSuccess && (
                                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-full">
                                        <Save className="w-5 h-5 text-green-600" />
                                    </div>
                                    <p className="text-green-700 font-medium">{ successMessage }</p>
                                </div>
                            ) }

                            {/* Error Message */ }
                            { errorMessage && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
                                    <div className="p-2 bg-red-100 rounded-full">
                                        <X className="w-5 h-5 text-red-600" />
                                    </div>
                                    <p className="text-red-700 font-medium">{ errorMessage }</p>
                                </div>
                            ) }

                            {/* Manager Information */ }
                            <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl p-6 border border-sky-100">
                                <h3 className="text-lg font-bold text-sky-700 mb-4 flex items-center gap-2">
                                    <User className="w-5 h-5" />
                                    معلومات المدير
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            رقم هوية المدير
                                        </label>
                                        <input
                                            type="text"
                                            name="manager_id_number"
                                            value={ formData.manager_id_number }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            اسم المدير
                                        </label>
                                        <input
                                            type="text"
                                            name="manager_name"
                                            value={ formData.manager_name }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            رقم هاتف المدير
                                        </label>
                                        <input
                                            type="text"
                                            name="manager_phone"
                                            value={ formData.manager_phone }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            رقم هاتف بديل للمدير
                                        </label>
                                        <input
                                            type="text"
                                            name="manager_alternative_phone"
                                            value={ formData.manager_alternative_phone }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            وصف وظيفة المدير
                                        </label>
                                        <input
                                            type="text"
                                            name="manager_job_description"
                                            value={ formData.manager_job_description }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Deputy Manager Information */ }
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100">
                                <h3 className="text-lg font-bold text-orange-700 mb-4 flex items-center gap-2">
                                    <User className="w-5 h-5" />
                                    معلومات نائب المدير
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            رقم هوية نائب المدير
                                        </label>
                                        <input
                                            type="text"
                                            name="deputy_manager_id_number"
                                            value={ formData.deputy_manager_id_number }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            اسم نائب المدير
                                        </label>
                                        <input
                                            type="text"
                                            name="deputy_manager_name"
                                            value={ formData.deputy_manager_name }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            رقم هاتف نائب المدير
                                        </label>
                                        <input
                                            type="text"
                                            name="deputy_manager_phone"
                                            value={ formData.deputy_manager_phone }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            رقم هاتف بديل لنائب المدير
                                        </label>
                                        <input
                                            type="text"
                                            name="deputy_manager_alternative_phone"
                                            value={ formData.deputy_manager_alternative_phone }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            وصف وظيفة نائب المدير
                                        </label>
                                        <input
                                            type="text"
                                            name="deputy_manager_job_description"
                                            value={ formData.deputy_manager_job_description }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Shelter Information */ }
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                                <h3 className="text-lg font-bold text-green-700 mb-4 flex items-center gap-2">
                                    <Home className="w-5 h-5" />
                                    معلومات المخيم
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            اسم المخيم
                                        </label>
                                        <input
                                            type="text"
                                            name="camp_name"
                                            value={ formData.camp_name }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            المحافظة
                                        </label>
                                        <select
                                            name="governorate"
                                            value={ formData.governorate }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                        >
                                            <option value="">اختر المحافظة</option>
                                            <option value="محافظة رفح">محافظة رفح</option>
                                            <option value="محافظة خانيونس">محافظة خانيونس</option>
                                            <option value="محافظة الوسطى">محافظة الوسطى</option>
                                            <option value="محافظة غزة">محافظة غزة</option>
                                            <option value="محافظة الشمال">محافظة الشمال</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            الحي
                                        </label>
                                        <input
                                            type="text"
                                            name="district"
                                            value={ formData.district }
                                            onChange={ handleChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            العنوان التفصيلي
                                        </label>
                                        <textarea
                                            name="detailed_address"
                                            value={ formData.detailed_address }
                                            onChange={ handleChange }
                                            rows={ 3 }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            عدد الخيام
                                        </label>
                                        <input
                                            type="number"
                                            name="tents_count"
                                            value={ formData.tents_count }
                                            onChange={ handleChange }
                                            min="0"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            عدد العائلات
                                        </label>
                                        <input
                                            type="number"
                                            name="families_count"
                                            value={ formData.families_count }
                                            onChange={ handleChange }
                                            min="0"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Excel File */ }
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                                <h3 className="text-lg font-bold text-purple-700 mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5" />
                                    ملف Excel للنازحين
                                </h3>
                                { currentExcelFileName && (
                                    <div className="mb-4 p-3 bg-white rounded-lg border border-purple-200">
                                        <p className="text-sm text-gray-600 mb-1">الملف الحالي:</p>
                                        <p className="text-sm font-medium text-purple-700">{ currentExcelFileName }</p>
                                    </div>
                                ) }
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        { excelFile ? 'ملف جديد محدد' : 'رفع ملف Excel جديد (اختياري)' }
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".xlsx,.xls,.csv"
                                            onChange={ handleFileChange }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        اتركه فارغاً إذا لم تريد تغيير الملف. الملفات المدعومة: .xlsx, .xls, .csv (حد أقصى 5MB)
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */ }
                            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={ onClose }
                                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300 font-medium"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={ isUpdating || isLoading }
                                    className="px-6 py-3 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-xl hover:from-sky-500 hover:to-sky-600 transition-all duration-300 font-medium shadow-lg shadow-sky-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
                                >
                                    { isUpdating ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            جاري الحفظ...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            حفظ التغييرات
                                        </>
                                    ) }
                                </button>
                            </div>
                        </form>
                    ) }
                </div>
            </div>
        </div>
    );
};

export default EditShelterModal;

