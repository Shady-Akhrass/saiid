import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../../../utils/axiosConfig';
import LogoImage from '../../../assets/images/logo.jpg';
import Alert from '../base/alert';
import SuccessMessage from '../base/successMessage';
import ErrorMessage from '../base/errorMessage';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

function OrphanMedicalTreatmentForm() {
    const [formData, setFormData] = useState({
        orphan_name: '',
        orphan_id_number: '',
        guardian_name: '',
        guardian_id_number: '',
        guardian_phone_number: '',
        currently_in_khan_younis: false,
        treatment_type: '',
        physical_therapy_type: '',
        physical_therapy_other_description: ''
    });

    const [errors, setErrors] = useState({});
    const [isRegistered, setIsRegistered] = useState(null);
    const [isAlreadyRegisteredForTreatment, setIsAlreadyRegisteredForTreatment] = useState(false);
    const [duplicateError, setDuplicateError] = useState(null);
    const [existingTreatmentInfo, setExistingTreatmentInfo] = useState(null);
    const [checkingRegistration, setCheckingRegistration] = useState(false);
    const [loading, setLoading] = useState(false);
    const [canSubmit, setCanSubmit] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [warningMessage, setWarningMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const checkTimeout = useRef(null);

    // تعيين عنوان التبويب
    useEffect(() => {
        document.title = "نموذج تسجيل علاج أيتام";
    }, []);

    // خيارات نوع العلاج
    const treatmentTypes = [
        { value: 'علاج طبيعي', label: 'علاج طبيعي' },
        { value: 'علاج النطق وتأخر الكلام', label: 'علاج النطق وتأخر الكلام' },
        { value: 'الصحة النفسية', label: 'الصحة النفسية' },
        { value: 'الأسنان', label: 'الأسنان' }
    ];

    // خيارات العلاج الطبيعي
    const physicalTherapyTypes = [
        { value: 'شلل دماغي', label: 'شلل دماغي' },
        { value: 'تأخر نمو', label: 'تأخر نمو' },
        { value: 'إصابة حرب', label: 'إصابة حرب' },
        { value: 'أخرى', label: 'أخرى' }
    ];

    // التحقق من تسجيل اليتيم
    const checkOrphanRegistration = async (orphanId) => {
        if (orphanId.length !== 9) return;

        setCheckingRegistration(true);
        setIsRegistered(null);
        setIsAlreadyRegisteredForTreatment(false);
        setDuplicateError(null);
        setExistingTreatmentInfo(null);

        try {
            const response = await apiClient.get(`/orphan-medical-treatments/check/${orphanId}`);

            console.log('✅ استجابة التحقق من اليتيم:', response.data);

            // ✅ حالة 1: اليتيم مسجل بالفعل في نظام العلاج - امنع المتابعة
            if (response.data.success === false && response.data.already_registered_in_treatment) {
                setIsAlreadyRegisteredForTreatment(true);
                setDuplicateError(response.data.error || 'اليتيم مسجل مسبقاً في نظام العلاج الطبي');
                setExistingTreatmentInfo(response.data.existing_treatment || null);
                setCanSubmit(false);

                setErrors(prev => ({
                    ...prev,
                    orphan_id_number: response.data.error || 'اليتيم مسجل مسبقاً في نظام العلاج الطبي'
                }));

                return false;
            }

            const isRegisteredInOrphans = response.data.is_registered || false;
            const alreadyInTreatment = response.data.already_registered_for_treatment ||
                response.data.already_registered_in_treatment ||
                false;

            setIsRegistered(isRegisteredInOrphans);
            setIsAlreadyRegisteredForTreatment(alreadyInTreatment);

            // ✅ حالة 2: اليتيم غير مسجل في قاعدة الأيتام
            if (!isRegisteredInOrphans) {
                setCanSubmit(false);
                setWarningMessage('');
                setErrors(prev => ({
                    ...prev,
                    orphan_id_number: 'اليتيم غير مسجل في قاعدة البيانات. يجب تسجيله أولاً في نموذج تسجيل الأيتام'
                }));
                return false;
            }

            // ✅ حالة 3: اليتيم مسجل مسبقاً في العلاج
            if (alreadyInTreatment) {
                setCanSubmit(false);
                setDuplicateError('اليتيم مسجل مسبقاً في نظام العلاج الطبي');
                setWarningMessage('');
                setErrors(prev => ({
                    ...prev,
                    orphan_id_number: 'اليتيم مسجل مسبقاً في نظام العلاج الطبي. لا يمكن التسجيل مرتين'
                }));
                return false;
            }

            // ✅ حالة 4: كل شيء تمام - يمكن المتابعة
            setCanSubmit(true);
            setWarningMessage('');
            setDuplicateError(null);
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.orphan_id_number;
                return newErrors;
            });
            return true;

        } catch (error) {
            console.error('❌ خطأ في التحقق من التسجيل:', error);
            console.error('📋 تفاصيل الخطأ:', error.response?.data);

            // معالجة خطأ 409 Conflict
            if (error.response?.status === 409) {
                setIsAlreadyRegisteredForTreatment(true);
                setDuplicateError(error.response.data.error || 'اليتيم مسجل مسبقاً');
                setExistingTreatmentInfo(error.response.data.existing_treatment || null);
                setCanSubmit(false);
                setErrors(prev => ({
                    ...prev,
                    orphan_id_number: error.response.data.error
                }));
                return false;
            }

            setIsRegistered(false);
            setIsAlreadyRegisteredForTreatment(false);
            setCanSubmit(false);
            return false;
        } finally {
            setCheckingRegistration(false);
        }
    };

    // معالجة تغيير الحقول
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const fieldValue = type === 'checkbox' ? checked : value;

        setFormData(prev => ({
            ...prev,
            [name]: fieldValue
        }));

        // مسح الخطأ عند التعديل
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        // إذا تم تغيير نوع العلاج وليس علاج طبيعي، امسح الحقول المرتبطة
        if (name === 'treatment_type' && value !== 'علاج طبيعي') {
            setFormData(prev => ({
                ...prev,
                physical_therapy_type: '',
                physical_therapy_other_description: ''
            }));
        }

        // إذا تم تغيير نوع العلاج الطبيعي وليس "أخرى"، امسح الوصف
        if (name === 'physical_therapy_type' && value !== 'أخرى') {
            setFormData(prev => ({
                ...prev,
                physical_therapy_other_description: ''
            }));
        }
    };

    // معالجة blur لرقم هوية اليتيم
    const handleOrphanIdBlur = () => {
        if (checkTimeout.current) {
            clearTimeout(checkTimeout.current);
        }

        if (formData.orphan_id_number.length === 9) {
            checkTimeout.current = setTimeout(() => {
                checkOrphanRegistration(formData.orphan_id_number);
            }, 500);
        }
    };

    // التحقق من صحة البيانات
    const validateForm = () => {
        const newErrors = {};

        // اسم اليتيم
        if (!formData.orphan_name || formData.orphan_name.trim().length < 3) {
            newErrors.orphan_name = 'اسم اليتيم مطلوب ويجب أن يكون 3 أحرف على الأقل';
        }

        // رقم هوية اليتيم
        if (!formData.orphan_id_number) {
            newErrors.orphan_id_number = 'رقم هوية اليتيم مطلوب';
        } else if (!/^\d{9}$/.test(formData.orphan_id_number)) {
            newErrors.orphan_id_number = 'رقم الهوية يجب أن يكون 9 أرقام بالضبط';
        } else if (isRegistered === false) {
            newErrors.orphan_id_number = 'اليتيم غير مسجل في قاعدة البيانات. يجب تسجيله أولاً في نموذج تسجيل الأيتام';
        } else if (isAlreadyRegisteredForTreatment === true) {
            newErrors.orphan_id_number = 'اليتيم مسجل مسبقاً في نظام العلاج الطبي. لا يمكن التسجيل مرتين';
        }

        // اسم الوصي
        if (!formData.guardian_name || formData.guardian_name.trim().length < 3) {
            newErrors.guardian_name = 'اسم الوصي مطلوب ويجب أن يكون 3 أحرف على الأقل';
        }

        // رقم هوية الوصي
        if (!formData.guardian_id_number) {
            newErrors.guardian_id_number = 'رقم هوية الوصي مطلوب';
        } else if (!/^\d{9}$/.test(formData.guardian_id_number)) {
            newErrors.guardian_id_number = 'رقم الهوية يجب أن يكون 9 أرقام بالضبط';
        }

        // رقم جوال الوصي
        if (!formData.guardian_phone_number) {
            newErrors.guardian_phone_number = 'رقم جوال الوصي مطلوب';
        } else if (!/^(056|059)\d{7}$/.test(formData.guardian_phone_number)) {
            newErrors.guardian_phone_number = 'رقم الجوال يجب أن يبدأ بـ 056 أو 059 متبوعة بـ 7 أرقام';
        }

        // تأكيد الإقامة
        if (!formData.currently_in_khan_younis) {
            newErrors.currently_in_khan_younis = 'يجب تأكيد إقامة اليتيم في خانيونس';
        }

        // نوع العلاج
        if (!formData.treatment_type) {
            newErrors.treatment_type = 'نوع العلاج مطلوب';
        }

        // نوع العلاج الطبيعي (إذا كان مطلوباً)
        if (formData.treatment_type === 'علاج طبيعي' && !formData.physical_therapy_type) {
            newErrors.physical_therapy_type = 'نوع العلاج الطبيعي مطلوب';
        }

        // وصف العلاج الطبيعي الآخر (إذا كان مطلوباً)
        if (formData.physical_therapy_type === 'أخرى' && !formData.physical_therapy_other_description.trim()) {
            newErrors.physical_therapy_other_description = 'وصف العلاج الطبيعي مطلوب';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // معالجة إرسال النموذج
    const handleSubmit = async (e) => {
        e.preventDefault();

        setSuccessMessage('');
        setErrorMessage('');
        setWarningMessage('');

        if (!validateForm()) {
            setErrorMessage('يرجى تصحيح الأخطاء في النموذج');
            return;
        }

        setLoading(true);

        try {
            // إعداد البيانات للإرسال
            const dataToSend = {
                orphan_name: formData.orphan_name.trim(),
                orphan_id_number: formData.orphan_id_number,
                guardian_name: formData.guardian_name.trim(),
                guardian_id_number: formData.guardian_id_number,
                guardian_phone_number: formData.guardian_phone_number,
                currently_in_khan_younis: formData.currently_in_khan_younis,
                treatment_type: formData.treatment_type,
                physical_therapy_type: formData.treatment_type === 'علاج طبيعي' ? formData.physical_therapy_type : null,
                physical_therapy_other_description: formData.physical_therapy_type === 'أخرى' ? formData.physical_therapy_other_description.trim() : null
            };

            const response = await apiClient.post('/orphan-medical-treatments', dataToSend);

            if (response.data.success) {
                setSuccessMessage(response.data.message || 'تم تسجيل اليتيم للعلاج بنجاح');

                if (response.data.warning) {
                    setWarningMessage(response.data.warning);
                }

                // إعادة تعيين النموذج
                setFormData({
                    orphan_name: '',
                    orphan_id_number: '',
                    guardian_name: '',
                    guardian_id_number: '',
                    guardian_phone_number: '',
                    currently_in_khan_younis: false,
                    treatment_type: '',
                    physical_therapy_type: '',
                    physical_therapy_other_description: ''
                });
                setIsRegistered(null);

                // التمرير للأعلى
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (error) {
            console.error('خطأ في إرسال النموذج:', error);

            // ✅ حالة 1: خطأ 400 مع أخطاء التحقق
            if (error.response?.status === 400 && error.response.data.errors) {
                // التحقق من خطأ التسجيل المكرر في حقل orphan_id_number
                if (error.response.data.errors.orphan_id_number) {
                    const errorMsg = Array.isArray(error.response.data.errors.orphan_id_number)
                        ? error.response.data.errors.orphan_id_number[0]
                        : error.response.data.errors.orphan_id_number;

                    setIsAlreadyRegisteredForTreatment(true);
                    setDuplicateError(errorMsg);
                    setCanSubmit(false);
                    setErrors(prev => ({
                        ...prev,
                        orphan_id_number: errorMsg
                    }));
                    setErrorMessage('🚫 ' + errorMsg);
                } else {
                    // أخطاء validation أخرى
                    setErrors(error.response.data.errors);
                    setErrorMessage('يرجى تصحيح الأخطاء في النموذج');
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // ✅ حالة 2: خطأ 409 Conflict - التسجيل المكرر
            if (error.response?.status === 409) {
                const errorData = error.response.data;
                setIsAlreadyRegisteredForTreatment(true);
                setDuplicateError(errorData.error || 'اليتيم مسجل مسبقاً في نظام العلاج الطبي');
                setExistingTreatmentInfo(errorData.existing_treatment || null);
                setCanSubmit(false);

                setErrors(prev => ({
                    ...prev,
                    orphan_id_number: errorData.error || 'اليتيم مسجل مسبقاً'
                }));

                setErrorMessage('🚫 ' + (errorData.message || 'اليتيم مسجل مسبقاً في نظام العلاج الطبي. لا يمكن التسجيل مرتين.'));
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // ✅ حالة 3: فحص نصي لرسائل التسجيل المكرر
            const errorMessage = error.response?.data?.message || '';
            if (errorMessage.includes('مسجل مسبقاً') ||
                errorMessage.includes('already registered') ||
                errorMessage.includes('duplicate')) {
                setIsAlreadyRegisteredForTreatment(true);
                setDuplicateError(errorMessage);
                setCanSubmit(false);
                setErrors(prev => ({
                    ...prev,
                    orphan_id_number: errorMessage
                }));
                setErrorMessage('🚫 ' + errorMessage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // ✅ حالة 4: أخطاء عامة أخرى
            if (error.response?.data?.errors) {
                setErrors(error.response.data.errors);
                setErrorMessage('يرجى تصحيح الأخطاء في النموذج');
            } else {
                setErrorMessage(error.response?.data?.message || 'حدث خطأ أثناء إرسال البيانات. يرجى المحاولة مرة أخرى');
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 py-12 px-4" dir="rtl" style={ { fontFamily: 'Cairo, sans-serif' } }>
            <div className="max-w-4xl mx-auto">
                {/* الشعار */ }
                <div className="flex justify-center mb-6 pt-4">
                    <img
                        src={ LogoImage }
                        alt="جمعية ساعد - Saiid Organization Logo"
                        className="w-28 h-28 rounded-full border-4 border-white shadow-xl hover:scale-105 transition-transform duration-300 ease-in-out object-cover"
                    />
                </div>

                {/* العنوان */ }
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-600 to-orange-500 bg-clip-text text-transparent mb-3">
                        نموذج تسجيل الأيتام للعلاج الطبي
                    </h1>
                    <p className="text-gray-600 text-lg">
                        يرجى تعبئة جميع الحقول المطلوبة بدقة
                    </p>
                </div>

                {/* الرسائل */ }
                { successMessage && (
                    <div className="mb-6">
                        <SuccessMessage message={ successMessage } />
                    </div>
                ) }

                { errorMessage && (
                    <div className="mb-6">
                        <ErrorMessage message={ errorMessage } />
                    </div>
                ) }

                { warningMessage && !successMessage && (
                    <Alert
                        type="warning"
                        message={ warningMessage }
                        className="mb-6"
                    />
                ) }

                {/* النموذج */ }
                <form onSubmit={ handleSubmit } className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
                    {/* معلومات اليتيم */ }
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-sky-600 mb-6 flex items-center gap-2">
                            <span className="w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center text-sm">1</span>
                            معلومات اليتيم
                        </h2>

                        <div className="space-y-6">
                            {/* اسم اليتيم */ }
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">
                                    اسم اليتيم <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="orphan_name"
                                    value={ formData.orphan_name }
                                    onChange={ handleChange }
                                    disabled={ loading }
                                    className={ `w-full px-4 py-3 border-2 rounded-xl transition-all duration-300 outline-none
                                        ${errors.orphan_name ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-sky-400 focus:bg-white'}
                                        ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}` }
                                    placeholder="أدخل اسم اليتيم الثلاثي"
                                />
                                { errors.orphan_name && (
                                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        { errors.orphan_name }
                                    </p>
                                ) }
                            </div>

                            {/* رقم هوية اليتيم */ }
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">
                                    رقم هوية اليتيم <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="orphan_id_number"
                                        value={ formData.orphan_id_number }
                                        onChange={ handleChange }
                                        onBlur={ handleOrphanIdBlur }
                                        disabled={ loading }
                                        maxLength={ 9 }
                                        className={ `w-full px-4 py-3 border-2 rounded-xl transition-all duration-300 outline-none
                                            ${duplicateError ? 'border-red-500 bg-red-50' :
                                                errors.orphan_id_number ? 'border-red-400 bg-red-50' :
                                                    isRegistered && !isAlreadyRegisteredForTreatment ? 'border-green-400 bg-green-50' :
                                                        'border-gray-300 focus:border-sky-400 focus:bg-white'}
                                            ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}` }
                                        placeholder="أدخل رقم الهوية (9 أرقام)"
                                    />
                                    { checkingRegistration && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            <Loader className="w-5 h-5 animate-spin text-sky-500" />
                                        </div>
                                    ) }
                                    { !checkingRegistration && isRegistered && !isAlreadyRegisteredForTreatment && !errors.orphan_id_number && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                        </div>
                                    ) }
                                    { duplicateError && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                        </div>
                                    ) }
                                </div>
                                { checkingRegistration && (
                                    <div className="text-gray-500 text-sm mt-2 flex items-center gap-2">
                                        <Loader className="w-4 h-4 animate-spin" />
                                        🔄 جاري التحقق من رقم الهوية...
                                    </div>
                                ) }
                                { errors.orphan_id_number && !checkingRegistration && (
                                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        { errors.orphan_id_number }
                                    </p>
                                ) }
                                { isRegistered === true && !isAlreadyRegisteredForTreatment && !errors.orphan_id_number && !checkingRegistration && (
                                    <p className="text-green-600 text-sm mt-1 flex items-center gap-1 font-semibold">
                                        <CheckCircle className="w-4 h-4" />
                                        ✅ اليتيم مسجل في قاعدة البيانات ويمكن تسجيله للعلاج
                                    </p>
                                ) }
                                { isAlreadyRegisteredForTreatment && duplicateError && (
                                    <div className="mt-3 p-5 bg-red-50 border-2 border-red-400 rounded-xl shadow-md">
                                        <div className="flex items-start gap-3">
                                            <span className="text-3xl">🚫</span>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-lg text-red-800 mb-2">تسجيل مكرر</h3>
                                                <p className="text-red-700 mb-3 font-semibold">{ duplicateError }</p>

                                                { existingTreatmentInfo && (
                                                    <div className="mt-3 p-4 bg-white rounded-lg border border-red-300">
                                                        <p className="text-sm font-bold text-red-900 mb-2">📋 معلومات التسجيل السابق:</p>
                                                        <div className="space-y-2">
                                                            { existingTreatmentInfo.treatment_type && (
                                                                <p className="text-sm text-gray-800">
                                                                    <strong className="text-red-700">نوع العلاج:</strong> { existingTreatmentInfo.treatment_type }
                                                                </p>
                                                            ) }
                                                            { existingTreatmentInfo.registered_at && (
                                                                <p className="text-sm text-gray-800">
                                                                    <strong className="text-red-700">تاريخ التسجيل:</strong> { new Date(existingTreatmentInfo.registered_at).toLocaleDateString('ar-EG', {
                                                                        year: 'numeric',
                                                                        month: 'long',
                                                                        day: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    }) }
                                                                </p>
                                                            ) }
                                                            { existingTreatmentInfo.physical_therapy_type && (
                                                                <p className="text-sm text-gray-800">
                                                                    <strong className="text-red-700">نوع العلاج الطبيعي:</strong> { existingTreatmentInfo.physical_therapy_type }
                                                                </p>
                                                            ) }
                                                        </div>
                                                    </div>
                                                ) }

                                                <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
                                                    <p className="text-sm font-semibold text-blue-900">💡 للمساعدة:</p>
                                                    <p className="text-sm text-blue-800 mt-1">
                                                        يرجى الاتصال بالإدارة لتعديل أو تحديث البيانات الموجودة
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) }
                                { isRegistered === false && (
                                    <div className="mt-2 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                                        <p className="text-red-800 text-sm font-semibold flex items-start gap-2 mb-3">
                                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
                                            <span>❌ اليتيم غير مسجل في قاعدة بيانات الأيتام الأصلية. يجب تسجيله أولاً في نموذج تسجيل الأيتام قبل التسجيل للعلاج الطبي.</span>
                                        </p>
                                        <div className="mr-7 space-y-2">
                                            <p className="text-red-700 text-sm">
                                                يرجى التوجه إلى نموذج تسجيل الأيتام على الرابط التالي:
                                            </p>
                                            <a
                                                href="https://forms.saiid.org/orphan-form"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-all duration-300 hover:shadow-lg text-sm font-semibold"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                انتقل إلى نموذج تسجيل الأيتام
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                            <p className="text-xs text-red-600 mt-2">
                                                📌 بعد إتمام تسجيل اليتيم، يمكنك العودة لهذه الصفحة لإكمال التسجيل للعلاج الطبي
                                            </p>
                                        </div>
                                    </div>
                                ) }
                            </div>
                        </div>
                    </div>

                    {/* معلومات الوصي */ }
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-orange-600 mb-6 flex items-center gap-2">
                            <span className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm">2</span>
                            معلومات الوصي
                        </h2>

                        <div className="space-y-6">
                            {/* اسم الوصي */ }
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">
                                    اسم الوصي <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="guardian_name"
                                    value={ formData.guardian_name }
                                    onChange={ handleChange }
                                    disabled={ loading }
                                    className={ `w-full px-4 py-3 border-2 rounded-xl transition-all duration-300 outline-none
                                        ${errors.guardian_name ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-orange-400 focus:bg-white'}
                                        ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}` }
                                    placeholder="أدخل اسم الوصي الثلاثي"
                                />
                                { errors.guardian_name && (
                                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        { errors.guardian_name }
                                    </p>
                                ) }
                            </div>

                            {/* رقم هوية الوصي */ }
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">
                                    رقم هوية الوصي <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="guardian_id_number"
                                    value={ formData.guardian_id_number }
                                    onChange={ handleChange }
                                    disabled={ loading }
                                    maxLength={ 9 }
                                    className={ `w-full px-4 py-3 border-2 rounded-xl transition-all duration-300 outline-none
                                        ${errors.guardian_id_number ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-orange-400 focus:bg-white'}
                                        ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}` }
                                    placeholder="أدخل رقم الهوية (9 أرقام)"
                                />
                                { errors.guardian_id_number && (
                                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        { errors.guardian_id_number }
                                    </p>
                                ) }
                            </div>

                            {/* رقم جوال الوصي */ }
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">
                                    رقم جوال الوصي <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    name="guardian_phone_number"
                                    value={ formData.guardian_phone_number }
                                    onChange={ handleChange }
                                    disabled={ loading }
                                    maxLength={ 10 }
                                    className={ `w-full px-4 py-3 border-2 rounded-xl transition-all duration-300 outline-none
                                        ${errors.guardian_phone_number ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-orange-400 focus:bg-white'}
                                        ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}` }
                                    placeholder="مثال: 0599123456"
                                />
                                { errors.guardian_phone_number && (
                                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        { errors.guardian_phone_number }
                                    </p>
                                ) }
                            </div>
                        </div>
                    </div>

                    {/* معلومات الإقامة */ }
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-purple-600 mb-6 flex items-center gap-2">
                            <span className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm">3</span>
                            معلومات الإقامة
                        </h2>

                        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="currently_in_khan_younis"
                                    checked={ formData.currently_in_khan_younis }
                                    onChange={ handleChange }
                                    disabled={ loading }
                                    className="mt-1 w-5 h-5 text-purple-600 border-2 border-purple-300 rounded focus:ring-2 focus:ring-purple-400"
                                />
                                <div className="flex-1">
                                    <span className="text-gray-800 font-semibold">
                                        أؤكد أن اليتيم مقيم حالياً في محافظة خانيونس <span className="text-red-500">*</span>
                                    </span>
                                    <p className="text-purple-700 text-sm mt-2 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        ⚠️ يجب أن يكون اليتيم مقيماً حالياً في خانيونس للتسجيل
                                    </p>
                                </div>
                            </label>
                            { errors.currently_in_khan_younis && (
                                <p className="text-red-500 text-sm mt-2 mr-8 flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4" />
                                    { errors.currently_in_khan_younis }
                                </p>
                            ) }
                        </div>
                    </div>

                    {/* نوع العلاج */ }
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-green-600 mb-6 flex items-center gap-2">
                            <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">4</span>
                            نوع العلاج
                        </h2>

                        <div className="space-y-6">
                            {/* نوع العلاج */ }
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">
                                    نوع العلاج المطلوب <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="treatment_type"
                                    value={ formData.treatment_type }
                                    onChange={ handleChange }
                                    disabled={ loading }
                                    className={ `w-full px-4 py-3 border-2 rounded-xl transition-all duration-300 outline-none appearance-none
                                        ${errors.treatment_type ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-green-400 focus:bg-white'}
                                        ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}` }
                                >
                                    <option value="">-- اختر نوع العلاج --</option>
                                    { treatmentTypes.map(type => (
                                        <option key={ type.value } value={ type.value }>
                                            { type.label }
                                        </option>
                                    )) }
                                </select>
                                { errors.treatment_type && (
                                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        { errors.treatment_type }
                                    </p>
                                ) }
                            </div>

                            {/* نوع العلاج الطبيعي (يظهر فقط عند اختيار علاج طبيعي) */ }
                            { formData.treatment_type === 'علاج طبيعي' && (
                                <div className="animate-fadeIn">
                                    <label className="block text-gray-700 font-semibold mb-2">
                                        نوع العلاج الطبيعي <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="physical_therapy_type"
                                        value={ formData.physical_therapy_type }
                                        onChange={ handleChange }
                                        disabled={ loading }
                                        className={ `w-full px-4 py-3 border-2 rounded-xl transition-all duration-300 outline-none appearance-none
                                            ${errors.physical_therapy_type ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-green-400 focus:bg-white'}
                                            ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}` }
                                    >
                                        <option value="">-- اختر نوع العلاج الطبيعي --</option>
                                        { physicalTherapyTypes.map(type => (
                                            <option key={ type.value } value={ type.value }>
                                                { type.label }
                                            </option>
                                        )) }
                                    </select>
                                    { errors.physical_therapy_type && (
                                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            { errors.physical_therapy_type }
                                        </p>
                                    ) }
                                </div>
                            ) }

                            {/* وصف العلاج الطبيعي الآخر (يظهر فقط عند اختيار "أخرى") */ }
                            { formData.physical_therapy_type === 'أخرى' && (
                                <div className="animate-fadeIn">
                                    <label className="block text-gray-700 font-semibold mb-2">
                                        وصف العلاج الطبيعي الآخر <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        name="physical_therapy_other_description"
                                        value={ formData.physical_therapy_other_description }
                                        onChange={ handleChange }
                                        disabled={ loading }
                                        rows={ 4 }
                                        className={ `w-full px-4 py-3 border-2 rounded-xl transition-all duration-300 outline-none resize-none
                                            ${errors.physical_therapy_other_description ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-green-400 focus:bg-white'}
                                            ${loading ? 'bg-gray-100 cursor-not-allowed' : ''}` }
                                        placeholder="يرجى وصف نوع العلاج الطبيعي المطلوب بالتفصيل..."
                                    />
                                    { errors.physical_therapy_other_description && (
                                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            { errors.physical_therapy_other_description }
                                        </p>
                                    ) }
                                </div>
                            ) }
                        </div>
                    </div>

                    {/* زر الإرسال */ }
                    <div className="flex justify-center pt-6 border-t-2 border-gray-200">
                        <button
                            type="submit"
                            disabled={ loading || !canSubmit || isRegistered === false || isAlreadyRegisteredForTreatment || duplicateError }
                            className={ `px-12 py-4 rounded-xl font-bold text-white text-lg transition-all duration-300 transform flex items-center gap-3
                                ${loading || !canSubmit || isRegistered === false || isAlreadyRegisteredForTreatment || duplicateError
                                    ? 'bg-gray-400 cursor-not-allowed opacity-60'
                                    : 'bg-gradient-to-r from-sky-500 to-orange-500 hover:from-sky-600 hover:to-orange-600 hover:scale-105 hover:shadow-2xl active:scale-100'}` }
                        >
                            { loading ? (
                                <>
                                    <Loader className="w-6 h-6 animate-spin" />
                                    <span>جاري الإرسال...</span>
                                </>
                            ) : isAlreadyRegisteredForTreatment ? (
                                <>
                                    <AlertCircle className="w-6 h-6" />
                                    <span>اليتيم مسجل مسبقاً</span>
                                </>
                            ) : isRegistered === false ? (
                                <>
                                    <AlertCircle className="w-6 h-6" />
                                    <span>يجب تسجيل اليتيم أولاً</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-6 h-6" />
                                    <span>تسجيل اليتيم للعلاج</span>
                                </>
                            ) }
                        </button>
                    </div>

                    {/* رسالة تنبيه أسفل الزر */ }
                    { isAlreadyRegisteredForTreatment && (
                        <div className="text-center mt-4">
                            <p className="text-orange-600 text-sm font-semibold">
                                🚫 اليتيم مسجل مسبقاً في نظام العلاج الطبي. التسجيل المتكرر غير مسموح
                            </p>
                        </div>
                    ) }
                    { isRegistered === false && (
                        <div className="text-center mt-4">
                            <p className="text-red-600 text-sm font-semibold">
                                ⚠️ لا يمكن التسجيل للعلاج إلا بعد تسجيل اليتيم في قاعدة البيانات الأصلية
                            </p>
                        </div>
                    ) }
                </form>

                {/* تنبيه إضافي */ }
                <div className="mt-6 text-center text-gray-500 text-sm">
                    <p>جميع الحقول المعلمة بـ <span className="text-red-500">*</span> مطلوبة</p>
                </div>
            </div>

            {/* CSS للـ animations */ }
            <style>{ `
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}

export default OrphanMedicalTreatmentForm;

