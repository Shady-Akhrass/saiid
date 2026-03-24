import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Users, Home, Image as ImageIcon, X as XIcon, DollarSign, User, Tag, Clock, FileText } from 'lucide-react';
import ShelterSelect from './ShelterSelect';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';

const ProjectEditModal = ({ isOpen, onClose, projectData, onUpdateSuccess }) => {
    const [formData, setFormData] = useState({
        project_name: '',
        aid_type: '',
        quantity: '',
        shelter_id: '',
        execution_date: '',
        status: 'غير مكتمل',
        notes: '',
        notes_image: null,
        // حقول إضافية اختيارية
        donor_name: '',
        donor_code: '',
        donation_amount: '',
        currency_id: '',
        discount_percentage: '',
        project_type: '',
        estimated_duration_days: ''
    });

    const [errors, setErrors] = useState({});
    const [isUpdating, setIsUpdating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [shelterInfo, setShelterInfo] = useState(null);
    const [remainingFamilies, setRemainingFamilies] = useState(0);
    const [notesImagePreview, setNotesImagePreview] = useState(null);
    const [existingNotesImageUrl, setExistingNotesImageUrl] = useState(null);
    const [currencies, setCurrencies] = useState([]);
    const [loadingCurrencies, setLoadingCurrencies] = useState(false);

    const PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];

    // جلب العملات
    useEffect(() => {
        const fetchCurrencies = async () => {
            try {
                setLoadingCurrencies(true);
                const response = await apiClient.get('/currencies');
                if (response.data && response.data.currencies) {
                    setCurrencies(response.data.currencies);
                } else if (Array.isArray(response.data)) {
                    setCurrencies(response.data);
                }
            } catch (error) {
                console.error('Error fetching currencies:', error);
                setCurrencies([]);
            } finally {
                setLoadingCurrencies(false);
            }
        };

        if (isOpen) {
            fetchCurrencies();
        }
    }, [isOpen]);

    useEffect(() => {
        if (projectData && isOpen) {
            // تنسيق execution_date إذا كان موجوداً
            let formattedExecutionDate = '';
            if (projectData.execution_date) {
                try {
                    const date = new Date(projectData.execution_date);
                    formattedExecutionDate = date.toISOString().split('T')[0];
                } catch {
                    formattedExecutionDate = projectData.execution_date;
                }
            }

            setFormData({
                project_name: projectData.project_name || '',
                aid_type: projectData.aid_type || '',
                quantity: projectData.quantity || '',
                shelter_id: projectData.shelter_id || projectData.shelter?.id || projectData.shelter?.manager_id_number || '',
                execution_date: formattedExecutionDate,
                status: projectData.status || 'غير مكتمل',
                notes: projectData.notes || '',
                notes_image: null, // سيتم رفع صورة جديدة إذا تم اختيارها
                // حقول إضافية
                donor_name: projectData.donor_name || '',
                donor_code: projectData.donor_code || '',
                donation_amount: projectData.donation_amount || '',
                currency_id: projectData.currency_id || projectData.currency?.id || '',
                discount_percentage: projectData.discount_percentage || projectData.admin_discount_percentage || '',
                project_type: projectData.project_type || '',
                estimated_duration_days: projectData.estimated_duration_days || ''
            });
            setErrors({});
            setErrorMessage('');
            setNotesImagePreview(null);

            // عرض الصورة الموجودة إذا كانت متوفرة
            if (projectData.notes_image_url) {
                setExistingNotesImageUrl(projectData.notes_image_url);
            } else if (projectData.notes_image) {
                setExistingNotesImageUrl(projectData.notes_image);
            } else if (projectData.id) {
                const baseURL = apiClient.defaults.baseURL || '';
                setExistingNotesImageUrl(`${baseURL}/projects/${projectData.id}/notes-image`);
            } else {
                setExistingNotesImageUrl(null);
            }

            // Set initial shelter info if available
            if (projectData.shelter) {
                setShelterInfo({
                    camp_name: projectData.shelter.camp_name || projectData.shelter.name,
                    families_count: projectData.shelter.families_count || 0
                });
            }
        }
    }, [projectData, isOpen]);

    // Fetch shelter info when shelter_id changes
    useEffect(() => {
        const fetchShelterInfo = async () => {
            if (formData.shelter_id) {
                try {
                    const response = await apiClient.get(`/shelters/${formData.shelter_id}`);

                    if (response.data && response.data.shelter) {
                        setShelterInfo({
                            camp_name: response.data.shelter.camp_name,
                            families_count: response.data.shelter.families_count || 0
                        });
                    }
                } catch (error) {
                    console.error("Error fetching shelter info:", error);
                }
            }
        };

        fetchShelterInfo();
    }, [formData.shelter_id]);

    // Calculate remaining families
    useEffect(() => {
        if (shelterInfo && formData.quantity && formData.status === 'غير مكتمل') {
            const remaining = shelterInfo.families_count - parseInt(formData.quantity);
            setRemainingFamilies(remaining > 0 ? remaining : 0);
        } else {
            setRemainingFamilies(0);
        }
    }, [shelterInfo, formData.quantity, formData.status]);

    const handleChange = (e) => {
        const { name, value, files } = e.target;

        if (name === 'notes_image' && files && files[0]) {
            const file = files[0];
            // التحقق من نوع الملف
            if (!file.type.startsWith('image/')) {
                setErrors(prev => ({
                    ...prev,
                    notes_image: 'يجب اختيار ملف صورة'
                }));
                return;
            }
            // التحقق من حجم الملف (مثلاً 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setErrors(prev => ({
                    ...prev,
                    notes_image: 'حجم الصورة يجب أن يكون أقل من 5MB'
                }));
                return;
            }

            setFormData(prev => ({
                ...prev,
                [name]: file
            }));

            // عرض معاينة الصورة
            const reader = new FileReader();
            reader.onloadend = () => {
                setNotesImagePreview(reader.result);
                setExistingNotesImageUrl(null); // إخفاء الصورة القديمة عند اختيار صورة جديدة
            };
            reader.readAsDataURL(file);

            // مسح خطأ الصورة إذا كان موجوداً
            if (errors.notes_image) {
                setErrors(prev => ({
                    ...prev,
                    notes_image: ''
                }));
            }
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }

        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleRemoveImage = () => {
        setFormData(prev => ({
            ...prev,
            notes_image: null
        }));
        setNotesImagePreview(null);
        setExistingNotesImageUrl(null);
        // إعادة تعيين input file
        const fileInput = document.querySelector('input[name="notes_image"]');
        if (fileInput) {
            fileInput.value = '';
        }
    };

    const handleShelterChange = (e) => {
        handleChange(e);
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.project_name.trim()) {
            newErrors.project_name = 'اسم المشروع مطلوب';
        }

        if (!formData.aid_type.trim()) {
            newErrors.aid_type = 'نوع المساعدة مطلوب';
        }

        if (!formData.quantity || formData.quantity < 1) {
            newErrors.quantity = 'الكمية يجب أن تكون أكبر من صفر';
        }

        if (!formData.shelter_id) {
            newErrors.shelter_id = 'يجب اختيار المخيم';
        }

        if (!formData.execution_date) {
            newErrors.execution_date = 'تاريخ التنفيذ مطلوب';
        }

        // التحقق من الحقول المالية إذا كانت موجودة
        if (formData.donation_amount && parseFloat(formData.donation_amount) < 0) {
            newErrors.donation_amount = 'مبلغ التبرع يجب أن يكون أكبر من أو يساوي صفر';
        }

        if (formData.discount_percentage && (parseFloat(formData.discount_percentage) < 0 || parseFloat(formData.discount_percentage) > 100)) {
            newErrors.discount_percentage = 'نسبة الخصم يجب أن تكون بين 0 و 100';
        }

        if (formData.estimated_duration_days && parseInt(formData.estimated_duration_days) < 1) {
            newErrors.estimated_duration_days = 'المدة المقدرة يجب أن تكون أكبر من صفر';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        setIsUpdating(true);
        setErrorMessage('');

        try {
            let response;

            // إذا كانت هناك صورة جديدة، استخدم FormData
            if (formData.notes_image) {
                const formDataToSend = new FormData();
                formDataToSend.append('project_name', formData.project_name);
                formDataToSend.append('aid_type', formData.aid_type);
                formDataToSend.append('quantity', formData.quantity);
                formDataToSend.append('shelter_id', formData.shelter_id);
                formDataToSend.append('execution_date', formData.execution_date);
                formDataToSend.append('status', formData.status);
                if (formData.notes) {
                    formDataToSend.append('notes', formData.notes);
                }
                formDataToSend.append('notes_image', formData.notes_image);

                // إضافة الحقول الاختيارية إذا كانت موجودة
                if (formData.donor_name) formDataToSend.append('donor_name', formData.donor_name);
                if (formData.donor_code) formDataToSend.append('donor_code', formData.donor_code);
                if (formData.donation_amount) formDataToSend.append('donation_amount', formData.donation_amount);
                if (formData.currency_id) formDataToSend.append('currency_id', formData.currency_id);
                if (formData.discount_percentage) formDataToSend.append('discount_percentage', formData.discount_percentage);
                if (formData.project_type) formDataToSend.append('project_type', formData.project_type);
                if (formData.estimated_duration_days) formDataToSend.append('estimated_duration_days', formData.estimated_duration_days);

                response = await apiClient.patch(`/projects/${projectData.id}`, formDataToSend, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
            } else {
                // إرسال البيانات كـ JSON عادي
                const updateData = { ...formData };
                delete updateData.notes_image; // إزالة notes_image من البيانات إذا لم تكن موجودة

                // إزالة الحقول الفارغة الاختيارية
                Object.keys(updateData).forEach(key => {
                    if (updateData[key] === '' || updateData[key] === null) {
                        delete updateData[key];
                    }
                });

                response = await apiClient.patch(`/projects/${projectData.id}`, updateData);
            }

            if (response.data.success) {
                // ✅ إغلاق النافذة فوراً قبل استدعاء onUpdateSuccess لتجنب التأخير
                onClose();

                // عرض رسالة النجاح
                toast.success('تم تحديث المشروع بنجاح');

                // استدعاء onUpdateSuccess بعد إغلاق النافذة (غير متزامن)
                if (onUpdateSuccess) {
                    // استخدام setTimeout لضمان إغلاق النافذة أولاً
                    setTimeout(() => {
                        onUpdateSuccess(response.data);
                    }, 100);
                }
            } else {
                throw new Error(response.data.message || 'فشل في تحديث المشروع');
            }
        } catch (error) {
            console.error('Update error:', error);

            // عرض رسالة خطأ واضحة
            if (error.response?.status === 403) {
                setErrorMessage('ليس لديك صلاحيات لتعديل هذا المشروع. يرجى التأكد من صلاحياتك.');
            } else if (error.response?.status === 404) {
                setErrorMessage('المشروع غير موجود');
            } else if (error.response?.status === 422) {
                const validationErrors = error.response.data?.errors || {};
                const firstError = Object.values(validationErrors)[0];
                setErrorMessage(firstError || 'البيانات المدخلة غير صحيحة');
            } else {
                setErrorMessage(error.userMessage || error.message || 'حدث خطأ أثناء تحديث المشروع');
            }

            // عرض toast فقط إذا لم يكن خطأ 403 (لأنه سيظهر في errorMessage)
            if (error.response?.status !== 403) {
                toast.error(error.userMessage || error.message || 'فشل تحديث المشروع');
            }
        } finally {
            setIsUpdating(false);
        }
    };

    if (!isOpen) return null;

    // التحقق من وجود الحقول الاختيارية
    const hasDonorFields = projectData?.donor_name || projectData?.donor_code;
    const hasFinancialFields = projectData?.donation_amount || projectData?.currency_id;
    const hasProjectType = projectData?.project_type;
    const hasEstimatedDuration = projectData?.estimated_duration_days;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */ }
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-sky-50 to-orange-50 sticky top-0 z-10">
                    <h3 className="text-2xl font-bold text-gray-800">تعديل المشروع</h3>
                    <button
                        onClick={ onClose }
                        disabled={ isUpdating }
                        className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */ }
                <form onSubmit={ handleSubmit } className="p-6 space-y-6">
                    { errorMessage && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-red-700 text-sm">{ errorMessage }</p>
                        </div>
                    ) }

                    {/* Basic Information Section */ }
                    <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-4 border-2 border-gray-200">
                        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Tag className="w-5 h-5 text-sky-600" />
                            المعلومات الأساسية
                        </h4>
                        <div className="space-y-4">
                            {/* Project Name */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    اسم المشروع <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="project_name"
                                    value={ formData.project_name }
                                    onChange={ handleChange }
                                    className={ `w-full px-4 py-3 bg-white border-2 rounded-xl transition-all duration-300 focus:outline-none ${errors.project_name
                                        ? 'border-red-300 focus:border-red-500'
                                        : 'border-gray-200 focus:border-sky-400 hover:border-sky-300'
                                        }` }
                                />
                                { errors.project_name && (
                                    <p className="mt-1 text-sm text-red-600">{ errors.project_name }</p>
                                ) }
                            </div>

                            {/* Aid Type */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    نوع المساعدة <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="aid_type"
                                    value={ formData.aid_type }
                                    onChange={ handleChange }
                                    className={ `w-full px-4 py-3 bg-white border-2 rounded-xl transition-all duration-300 focus:outline-none ${errors.aid_type
                                        ? 'border-red-300 focus:border-red-500'
                                        : 'border-gray-200 focus:border-sky-400 hover:border-sky-300'
                                        }` }
                                />
                                { errors.aid_type && (
                                    <p className="mt-1 text-sm text-red-600">{ errors.aid_type }</p>
                                ) }
                            </div>

                            {/* Project Type (Optional) */ }
                            { hasProjectType && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        نوع المشروع
                                    </label>
                                    <select
                                        name="project_type"
                                        value={ formData.project_type }
                                        onChange={ handleChange }
                                        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl transition-all duration-300 focus:outline-none focus:border-sky-400 hover:border-sky-300"
                                    >
                                        <option value="">اختر نوع المشروع</option>
                                        { PROJECT_TYPES.map(type => (
                                            <option key={ type } value={ type }>{ type }</option>
                                        )) }
                                    </select>
                                </div>
                            ) }

                            {/* Quantity */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    الكمية/العدد (عدد الأسر المستفيدة) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="quantity"
                                    value={ formData.quantity }
                                    onChange={ handleChange }
                                    min="1"
                                    max={ shelterInfo?.families_count || undefined }
                                    className={ `w-full px-4 py-3 bg-white border-2 rounded-xl transition-all duration-300 focus:outline-none ${errors.quantity
                                        ? 'border-red-300 focus:border-red-500'
                                        : 'border-gray-200 focus:border-sky-400 hover:border-sky-300'
                                        }` }
                                />
                                { errors.quantity && (
                                    <p className="mt-1 text-sm text-red-600">{ errors.quantity }</p>
                                ) }

                                {/* Shelter Info Card - Show when status is غير مكتمل */ }
                                { formData.status === 'غير مكتمل' && shelterInfo && (
                                    <div className="mt-4 bg-gradient-to-r from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl p-4">
                                        <div className="flex items-start gap-3 mb-3">
                                            <Home className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-blue-800">
                                                    معلومات المخيم: { shelterInfo.camp_name }
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between bg-white rounded-lg p-3">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-blue-600" />
                                                    <span className="text-sm font-medium text-gray-700">إجمالي الأسر في المخيم:</span>
                                                </div>
                                                <span className="text-lg font-bold text-blue-700">
                                                    { shelterInfo.families_count } أسرة
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between bg-white rounded-lg p-3">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-green-600" />
                                                    <span className="text-sm font-medium text-gray-700">الأسر المستفيدة حالياً:</span>
                                                </div>
                                                <span className="text-lg font-bold text-green-700">
                                                    { formData.quantity || 0 } أسرة
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between bg-gradient-to-r from-orange-100 to-orange-50 rounded-lg p-3 border-2 border-orange-300">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-5 h-5 text-orange-600" />
                                                    <span className="text-sm font-bold text-orange-800">الأسر المتبقية (لم تستفد):</span>
                                                </div>
                                                <span className="text-xl font-bold text-orange-700">
                                                    { remainingFamilies } أسرة
                                                </span>
                                            </div>
                                        </div>

                                        { remainingFamilies > 0 && (
                                            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                                <p className="text-xs text-amber-700 text-center">
                                                    💡 يمكن زيادة الكمية لتشمل المزيد من الأسر المتبقية
                                                </p>
                                            </div>
                                        ) }

                                        { parseInt(formData.quantity) > shelterInfo.families_count && (
                                            <div className="mt-3 p-3 bg-red-50 border-2 border-red-300 rounded-lg flex items-start gap-2">
                                                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                <p className="text-sm text-red-700 font-medium">
                                                    تحذير: الكمية أكبر من عدد الأسر في المخيم!
                                                </p>
                                            </div>
                                        ) }
                                    </div>
                                ) }
                            </div>

                            {/* Estimated Duration (Optional) */ }
                            { hasEstimatedDuration && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        المدة المقدرة (أيام)
                                    </label>
                                    <input
                                        type="number"
                                        name="estimated_duration_days"
                                        value={ formData.estimated_duration_days }
                                        onChange={ handleChange }
                                        min="1"
                                        className={ `w-full px-4 py-3 bg-white border-2 rounded-xl transition-all duration-300 focus:outline-none ${errors.estimated_duration_days
                                            ? 'border-red-300 focus:border-red-500'
                                            : 'border-gray-200 focus:border-sky-400 hover:border-sky-300'
                                            }` }
                                    />
                                    { errors.estimated_duration_days && (
                                        <p className="mt-1 text-sm text-red-600">{ errors.estimated_duration_days }</p>
                                    ) }
                                </div>
                            ) }

                            {/* Shelter Select */ }
                            <ShelterSelect
                                value={ formData.shelter_id }
                                onChange={ handleShelterChange }
                                error={ errors.shelter_id }
                            />

                            {/* Execution Date */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    تاريخ التنفيذ <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="execution_date"
                                    value={ formData.execution_date }
                                    onChange={ handleChange }
                                    className={ `w-full px-4 py-3 bg-white border-2 rounded-xl transition-all duration-300 focus:outline-none ${errors.execution_date
                                        ? 'border-red-300 focus:border-red-500'
                                        : 'border-gray-200 focus:border-sky-400 hover:border-sky-300'
                                        }` }
                                />
                                { errors.execution_date && (
                                    <p className="mt-1 text-sm text-red-600">{ errors.execution_date }</p>
                                ) }
                            </div>

                            {/* Status */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    حالة المشروع
                                </label>
                                <select
                                    name="status"
                                    value={ formData.status }
                                    onChange={ handleChange }
                                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl transition-all duration-300 focus:outline-none focus:border-sky-400 hover:border-sky-300"
                                >
                                    <option value="غير مكتمل">غير مكتمل</option>
                                    <option value="مكتمل">مكتمل</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Donor Information Section (Optional) */ }
                    { hasDonorFields && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
                            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-600" />
                                معلومات المتبرع
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        اسم المتبرع
                                    </label>
                                    <input
                                        type="text"
                                        name="donor_name"
                                        value={ formData.donor_name }
                                        onChange={ handleChange }
                                        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl transition-all duration-300 focus:outline-none focus:border-sky-400 hover:border-sky-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        كود المتبرع
                                    </label>
                                    <input
                                        type="text"
                                        name="donor_code"
                                        value={ formData.donor_code }
                                        onChange={ handleChange }
                                        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl transition-all duration-300 focus:outline-none focus:border-sky-400 hover:border-sky-300"
                                    />
                                </div>
                            </div>
                        </div>
                    ) }

                    {/* Financial Information Section (Optional) */ }
                    { hasFinancialFields && (
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
                            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                المعلومات المالية
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        مبلغ التبرع
                                    </label>
                                    <input
                                        type="number"
                                        name="donation_amount"
                                        value={ formData.donation_amount }
                                        onChange={ handleChange }
                                        min="0"
                                        step="0.01"
                                        className={ `w-full px-4 py-3 bg-white border-2 rounded-xl transition-all duration-300 focus:outline-none ${errors.donation_amount
                                            ? 'border-red-300 focus:border-red-500'
                                            : 'border-gray-200 focus:border-sky-400 hover:border-sky-300'
                                            }` }
                                    />
                                    { errors.donation_amount && (
                                        <p className="mt-1 text-sm text-red-600">{ errors.donation_amount }</p>
                                    ) }
                                </div>
                                { currencies.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            العملة
                                        </label>
                                        <select
                                            name="currency_id"
                                            value={ formData.currency_id }
                                            onChange={ handleChange }
                                            disabled={ loadingCurrencies }
                                            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl transition-all duration-300 focus:outline-none focus:border-sky-400 hover:border-sky-300 disabled:opacity-50"
                                        >
                                            <option value="">اختر العملة</option>
                                            { currencies.map(currency => (
                                                <option key={ currency.id } value={ currency.id }>
                                                    { currency.currency_name_ar || currency.name_ar || currency.currency_code || currency.code }
                                                </option>
                                            )) }
                                        </select>
                                    </div>
                                ) }
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        نسبة الخصم (%)
                                    </label>
                                    <input
                                        type="number"
                                        name="discount_percentage"
                                        value={ formData.discount_percentage }
                                        onChange={ handleChange }
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        className={ `w-full px-4 py-3 bg-white border-2 rounded-xl transition-all duration-300 focus:outline-none ${errors.discount_percentage
                                            ? 'border-red-300 focus:border-red-500'
                                            : 'border-gray-200 focus:border-sky-400 hover:border-sky-300'
                                            }` }
                                    />
                                    { errors.discount_percentage && (
                                        <p className="mt-1 text-sm text-red-600">{ errors.discount_percentage }</p>
                                    ) }
                                </div>
                            </div>
                        </div>
                    ) }

                    {/* Notes Section */ }
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border-2 border-amber-200">
                        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-amber-600" />
                            الملاحظات والصور
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    الملاحظات
                                </label>
                                <textarea
                                    name="notes"
                                    value={ formData.notes }
                                    onChange={ handleChange }
                                    rows={ 4 }
                                    placeholder="أدخل أي ملاحظات إضافية حول المشروع..."
                                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl transition-all duration-300 focus:outline-none focus:border-sky-400 hover:border-sky-300 resize-none"
                                />
                            </div>

                            {/* Notes Image */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    صورة الملاحظات
                                </label>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <input
                                            type="file"
                                            name="notes_image"
                                            accept="image/*"
                                            onChange={ handleChange }
                                            className="hidden"
                                            id="notes_image_input_edit"
                                        />
                                        <label
                                            htmlFor="notes_image_input_edit"
                                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl transition-all duration-300 cursor-pointer hover:border-sky-400 hover:bg-sky-50"
                                        >
                                            <ImageIcon className="w-5 h-5 text-gray-400" />
                                            <span className="text-gray-600 font-medium">
                                                { formData.notes_image || existingNotesImageUrl ? 'تغيير الصورة' : 'اختر صورة للملاحظات' }
                                            </span>
                                        </label>
                                    </div>

                                    { errors.notes_image && (
                                        <p className="text-sm text-red-600">{ errors.notes_image }</p>
                                    ) }

                                    {/* Image Preview - New Image */ }
                                    { notesImagePreview && (
                                        <div className="relative bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                                            <button
                                                type="button"
                                                onClick={ handleRemoveImage }
                                                className="absolute top-2 left-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10"
                                                title="إزالة الصورة"
                                            >
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                            <img
                                                src={ notesImagePreview }
                                                alt="معاينة صورة الملاحظات"
                                                className="w-full h-auto rounded-lg max-h-64 object-contain"
                                            />
                                        </div>
                                    ) }

                                    {/* Existing Image */ }
                                    { existingNotesImageUrl && !notesImagePreview && (
                                        <div className="relative bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                                            <button
                                                type="button"
                                                onClick={ handleRemoveImage }
                                                className="absolute top-2 left-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10"
                                                title="إزالة الصورة"
                                            >
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                            <img
                                                src={ existingNotesImageUrl }
                                                alt="صورة الملاحظات الحالية"
                                                className="w-full h-auto rounded-lg max-h-64 object-contain"
                                                onError={ (e) => {
                                                    // إذا فشل تحميل الصورة، حاول استخدام endpoint مباشر
                                                    const projectId = projectData.id;
                                                    const baseURL = apiClient.defaults.baseURL || '';
                                                    e.target.src = `${baseURL}/projects/${projectId}/notes-image`;
                                                } }
                                            />
                                        </div>
                                    ) }
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */ }
                    <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={ onClose }
                            disabled={ isUpdating }
                            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold transition-all duration-300 hover:bg-gray-200 disabled:opacity-50"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={ isUpdating }
                            className={ `flex-1 px-6 py-3 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-sky-200 ${isUpdating
                                ? 'opacity-75 cursor-not-allowed'
                                : 'hover:from-sky-500 hover:to-sky-600 hover:shadow-xl transform hover:scale-105 active:scale-100'
                                } flex items-center justify-center gap-2` }
                        >
                            { isUpdating ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    <span>جاري التحديث...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    <span>حفظ التغييرات</span>
                                </>
                            ) }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProjectEditModal;
