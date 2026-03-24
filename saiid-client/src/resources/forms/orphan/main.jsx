import React, { useEffect, useState, useRef } from 'react';
import apiClient from '../../../utils/axiosConfig';
import { useCacheInvalidation } from '../../../hooks/useCacheInvalidation';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { Search } from 'lucide-react';

// Import components
import { InitialPageSkeleton } from '../skeletons/Skeletons';
import SearchSection from '../search/SearchSection';
import OrphanDetails from './OrphanDetails';
import FormUnavailable from '../FormUnavailable';
import { parseOrphanData, concatenateNames } from '../../../utils/helpers';
import ImageProcessingModal from '../base/imageProcessingModal';

// Import existing form components
import OrphanForm from './orphanForm';
import FatherForm from './fatherForm';
import MotherForm from './motherForm';
import GuardianForm from './guardianForm';
import ApprovalForm from './approvalForm';
import ProgressBar from '../base/progressBar';
import NavigationButtons from '../base/navigationButtons';
import SuccessMessage from '../base/successMessage';
import ErrorMessage from '../base/errorMessage';
import Alert from '../base/alert';
import Logo from '../base/logo';

function Main() {
    const { invalidateOrphansCache } = useCacheInvalidation();
    const sections = ['بيانات اليتيم', 'بيانات الأب', 'بيانات الأم', 'بيانات الوصي', 'التعهد'];
    const hasIncrementedRef = useRef(false);
    const totalSteps = sections.length;
    const [currentStep, setCurrentStep] = useState(0);
    const [isFormAvailable, setIsFormAvailable] = useState(null);
    const [formAvailabilityData, setFormAvailabilityData] = useState(null);

    // States
    const [searchMode, setSearchMode] = useState(true);
    const [searchId, setSearchId] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [existingOrphan, setExistingOrphan] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showProcessingModal, setShowProcessingModal] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);

    const [formData, setFormData] = useState({
        orphan: {
            orphan_id_number: '',
            orphan_first_name: '',
            orphan_fathers_name: '',
            orphan_grandfathers_name: '',
            orphan_last_name: '',
            orphan_full_name: '',
            orphan_birth_date: '',
            orphan_gender: '',
            health_status: '',
            disease_description: '',
            original_address: '',
            current_address: '',
            address_details: '',
            number_of_brothers: '',
            number_of_sisters: '',
            is_enrolled_in_memorization_center: '',
            orphan_photo: '',
        },
        guardian: {
            guardian_id_number: '',
            guardian_first_name: '',
            guardian_fathers_name: '',
            guardian_grandfathers_name: '',
            guardian_last_name: '',
            guardian_full_name: '',
            guardian_relationship: '',
            guardian_phone_number: '',
            alternative_phone_number: '',
        },
        father: {
            father_first_name: '',
            father_fathers_name: '',
            father_grandfathers_name: '',
            father_last_name: '',
            deceased_father_full_name: '',
            deceased_father_birth_date: '',
            death_date: '',
            death_cause: '',
            previous_father_job: '',
            death_certificate: '',
        },
        mother: {
            mother_first_name: '',
            mother_fathers_name: '',
            mother_grandfathers_name: '',
            mother_last_name: '',
            mother_full_name: '',
            mother_id_number: '',
            is_mother_deceased: '',
            mother_birth_date: '',
            mother_death_date: '',
            mother_death_certificate: '',
            mother_status: '',
            mother_job: '',
        },
        approval: {
            data_approval_name: '',
            isChecked: false
        }
    });

    const [uploadProgress, setUploadProgress] = useState({
        orphan_photo: 0,
        death_certificate: 0,
        mother_death_certificate: 0
    });

    // Search for orphan by ID
    const searchOrphanById = async () => {
        if (!searchId.trim()) {
            setErrorMessage('يرجى إدخال رقم الهوية');
            return;
        }

        setIsSearching(true);
        setErrorMessage('');
        setSuccessMessage('');
        setExistingOrphan(null);

        try {
            const response = await apiClient.get(`/orphans/${searchId}`);

            if (response.data && response.data.orphan) {
                // Store the orphan_id_number as the primary identifier
                const orphanData = {
                    ...response.data.orphan,
                    id: response.data.orphan.orphan_id_number // Ensure we have the correct ID
                };

                setExistingOrphan(orphanData);
                const parsedData = parseOrphanData(orphanData);
                setFormData(parsedData);
                setSuccessMessage('تم العثور على البيانات بنجاح');
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                setErrorMessage('لم يتم العثور على بيانات برقم الهوية المدخل');
            } else {
                setErrorMessage('حدث خطأ في البحث. يرجى المحاولة مرة أخرى');
            }
        } finally {
            setIsSearching(false);
        }
    };

    // Update orphan data
    const handleUpdate = async (e) => {
        e.preventDefault();

        if (!formData.approval.isChecked) {
            alert('يجب الموافقة على التعهد.');
            return;
        }

        // Create FormData and flatten the nested structure (same as create)
        const data = new FormData();

        // Flatten all sections into single level (like in create)
        for (const section in formData) {
            for (const key in formData[section]) {
                // Skip files that are empty
                if ((key === 'orphan_photo' || key === 'death_certificate' || key === 'mother_death_certificate') && !formData[section][key]) {
                    continue;
                }
                data.append(key, formData[section][key]);
            }
        }

        setIsUpdating(true);
        setShowProcessingModal(true);
        setProcessingProgress(0);

        try {
            // Use PATCH method and use orphan_id_number as the ID
            const orphanId = existingOrphan.orphan_id_number || existingOrphan.id;

            const response = await apiClient.patch(
                `/orphans/${orphanId}`,
                data,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setProcessingProgress(percentCompleted);
                        setUploadProgress((prevProgress) => ({
                            ...prevProgress,
                            orphan_photo: formData.orphan.orphan_photo ? percentCompleted : prevProgress.orphan_photo,
                            death_certificate: formData.father.death_certificate ? percentCompleted : prevProgress.death_certificate,
                            mother_death_certificate: formData.mother.mother_death_certificate ? percentCompleted : prevProgress.mother_death_certificate
                        }));
                    },
                }
            );

            setSuccessMessage('تم تحديث البيانات بنجاح!');
            setErrorMessage('');
            setUploadProgress({ orphan_photo: 0, death_certificate: 0, mother_death_certificate: 0 });

            // ✅ إبطال كاش الأيتام عند التحديث
            invalidateOrphansCache();

            // Close modal after a short delay
            setTimeout(() => {
                setShowProcessingModal(false);
                setCurrentStep(0);
                setSuccessMessage('');
                setEditMode(false);
                setSearchMode(true);
                setExistingOrphan(null);
                resetForm();
            }, 1000);

        } catch (error) {
            setShowProcessingModal(false);
            if (error.response && error.response.status === 400) {
                const errors = error.response.data.errors;
                const formattedErrors = Object.values(errors).flat().join('\n');
                setErrorMessage(formattedErrors);
            } else {
                setErrorMessage('حدث خطأ في تحديث البيانات. يرجى المحاولة مرة أخرى');
            }
        } finally {
            setIsUpdating(false);
        }
    };

    // Check form availability
    const checkFormAvailability = async () => {
        try {
            const response = await apiClient.get('/form-availabilities');
            const forms = response.data;
            const orphanForm = forms.find(form => form.type === 'orphan');

            if (orphanForm) {
                setIsFormAvailable(orphanForm.is_available === true);
                setFormAvailabilityData(orphanForm);
            } else {
                setIsFormAvailable(false);
                setFormAvailabilityData({
                    type: 'orphan',
                    is_available: false,
                    notes: 'نموذج كفالة الأيتام غير مفعّل حالياً'
                });
            }
        } catch (error) {
            console.error('Error checking form availability:', error);
            setIsFormAvailable(true);
            setFormAvailabilityData({
                type: 'orphan',
                is_available: true,
                notes: ''
            });
        }
    };

    useEffect(() => {
        document.title = "نموذج كفالة اليتيم";
        checkFormAvailability();

        const incrementVisitorCount = async () => {
            if (hasIncrementedRef.current) return;
            hasIncrementedRef.current = true;
            try {
                await apiClient.post('/increment-visitor-orphans-count');
            } catch (error) {
                console.error('Error incrementing visitor count:', error);
            }
        };

        if (isFormAvailable !== false) {
            incrementVisitorCount();
        }
    }, []);

    // Auto-clear success and error messages after 5 seconds
    useEffect(() => {
        if (!successMessage) return;
        const id = setTimeout(() => setSuccessMessage(''), 5000);
        return () => clearTimeout(id);
    }, [successMessage]);

    useEffect(() => {
        if (!errorMessage) return;
        const id = setTimeout(() => setErrorMessage(''), 5000);
        return () => clearTimeout(id);
    }, [errorMessage]);

    const handleChange = async (section, e) => {
        const { name, files, type, checked, value } = e.target;
        if (files && files[0]) {
            const file = files[0];
            try {
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1024,
                    useWebWorker: true,
                };
                const compressedFile = await imageCompression(file, options);
                setFormData((prevState) => ({
                    ...prevState,
                    [section]: {
                        ...prevState[section],
                        [name]: compressedFile,
                    },
                }));
            } catch (error) {
                console.error('Error compressing the image:', error);
            }
        } else if (type === 'checkbox') {
            setFormData((prevState) => ({
                ...prevState,
                [section]: {
                    ...prevState[section],
                    [name]: checked,
                },
            }));
        } else {
            setFormData((prevState) => ({
                ...prevState,
                [section]: {
                    ...prevState[section],
                    [name]: value,
                },
            }));
        }
    };

    const handleNext = () => {
        // Handle name concatenation for each step
        if (currentStep === 0) {
            const orphanFullName = concatenateNames({
                first_name: formData.orphan.orphan_first_name,
                fathers_name: formData.orphan.orphan_fathers_name,
                grandfathers_name: formData.orphan.orphan_grandfathers_name,
                last_name: formData.orphan.orphan_last_name,
            });
            setFormData((prevState) => ({
                ...prevState,
                orphan: { ...prevState.orphan, orphan_full_name: orphanFullName },
            }));
        }

        if (currentStep === 1) {
            const fatherFullName = concatenateNames({
                first_name: formData.father.father_first_name,
                fathers_name: formData.father.father_fathers_name,
                grandfathers_name: formData.father.father_grandfathers_name,
                last_name: formData.father.father_last_name,
            });
            setFormData((prevState) => ({
                ...prevState,
                father: { ...prevState.father, deceased_father_full_name: fatherFullName },
            }));
        }

        if (currentStep === 2) {
            const motherFullName = concatenateNames({
                first_name: formData.mother.mother_first_name,
                fathers_name: formData.mother.mother_fathers_name,
                grandfathers_name: formData.mother.mother_grandfathers_name,
                last_name: formData.mother.mother_last_name,
            });
            setFormData((prevState) => ({
                ...prevState,
                mother: { ...prevState.mother, mother_full_name: motherFullName },
            }));
        }

        if (currentStep === 3) {
            const guardianFullName = concatenateNames({
                first_name: formData.guardian.guardian_first_name,
                fathers_name: formData.guardian.guardian_fathers_name,
                grandfathers_name: formData.guardian.guardian_grandfathers_name,
                last_name: formData.guardian.guardian_last_name,
            });
            setFormData((prevState) => ({
                ...prevState,
                guardian: { ...prevState.guardian, guardian_full_name: guardianFullName },
            }));
        }

        if (currentStep < sections.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (editMode && existingOrphan) {
            handleUpdate(e);
            return;
        }

        if (!isFormAvailable) {
            setErrorMessage('عذراً، نموذج التسجيل غير متاح حالياً');
            return;
        }

        if (!formData.approval.isChecked) {
            alert('يجب الموافقة على التعهد.');
            return;
        }

        const data = new FormData();
        for (const section in formData) {
            for (const key in formData[section]) {
                data.append(key, formData[section][key]);
            }
        }

        setIsSubmitting(true);
        setShowProcessingModal(true);
        setProcessingProgress(0);

        try {
            await apiClient.post('/orphans', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setProcessingProgress(percentCompleted);
                    setUploadProgress((prevProgress) => ({
                        ...prevProgress,
                        orphan_photo: formData.orphan.orphan_photo ? percentCompleted : prevProgress.orphan_photo,
                        death_certificate: formData.father.death_certificate ? percentCompleted : prevProgress.death_certificate,
                        mother_death_certificate: formData.mother.mother_death_certificate ? percentCompleted : prevProgress.mother_death_certificate
                    }));
                },
            });

            setSuccessMessage('تمت إضافة البيانات بنجاح!');
            setErrorMessage('');
            setUploadProgress({ orphan_photo: 0, death_certificate: 0, mother_death_certificate: 0 });

            // ✅ إبطال كاش الأيتام عند الإضافة
            invalidateOrphansCache();

            // Close modal after a short delay
            setTimeout(() => {
                setShowProcessingModal(false);
                setCurrentStep(0);
                setSuccessMessage('');
                resetForm();
            }, 1000);

        } catch (error) {
            setShowProcessingModal(false);
            if (error.response && error.response.status === 400) {
                const errors = error.response.data.errors;
                const formattedErrors = Object.values(errors).flat().join('\n');
                setErrorMessage(formattedErrors);
            } else if (error.message === 'Network Error') {
                setErrorMessage('لا يوجد اتصال بالإنترنت. يرجى التحقق من الاتصال.');
            } else {
                setErrorMessage('حدث خطأ غير متوقع. حاول مرة أخرى لاحقاً.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            orphan: {
                orphan_id_number: '',
                orphan_first_name: '',
                orphan_fathers_name: '',
                orphan_grandfathers_name: '',
                orphan_last_name: '',
                orphan_full_name: '',
                orphan_birth_date: '',
                orphan_gender: '',
                health_status: '',
                disease_description: '',
                original_address: '',
                current_address: '',
                address_details: '',
                number_of_brothers: '',
                number_of_sisters: '',
                is_enrolled_in_memorization_center: '',
                orphan_photo: '',
            },
            guardian: {
                guardian_id_number: '',
                guardian_first_name: '',
                guardian_fathers_name: '',
                guardian_grandfathers_name: '',
                guardian_last_name: '',
                guardian_full_name: '',
                guardian_relationship: '',
                guardian_phone_number: '',
                alternative_phone_number: '',
            },
            father: {
                father_first_name: '',
                father_fathers_name: '',
                father_grandfathers_name: '',
                father_last_name: '',
                deceased_father_full_name: '',
                deceased_father_birth_date: '',
                death_date: '',
                death_cause: '',
                previous_father_job: '',
                death_certificate: '',
            },
            mother: {
                mother_first_name: '',
                mother_fathers_name: '',
                mother_grandfathers_name: '',
                mother_last_name: '',
                mother_full_name: '',
                mother_id_number: '',
                is_mother_deceased: '',
                mother_birth_date: '',
                mother_death_date: '',
                mother_death_certificate: '',
                mother_status: '',
                mother_job: '',
            },
            approval: {
                data_approval_name: '',
                isChecked: false
            }
        });
        setSearchId('');
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    // Show initial loading
    if (isFormAvailable === null) {
        return <InitialPageSkeleton />;
    }

    // Show unavailable message
    if (isFormAvailable === false) {
        return <FormUnavailable formAvailabilityData={ formAvailabilityData } />;
    }

    // Show search interface
    if (searchMode && !editMode) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center w-full px-4 sm:px-6 lg:px-8" style={ { direction: 'rtl', fontFamily: 'Cairo, sans-serif' } }>
                {/* Image Processing Modal */ }
                <ImageProcessingModal isOpen={ showProcessingModal } progress={ processingProgress } />

                {/* Page Header */ }
                <div className="w-full max-w-2xl mt-14">
                    <div className="relative overflow-hidden p-6 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 rounded-3xl shadow-2xl mb-6">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                        <div className="relative flex items-center gap-4">
                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-white"><path d="M3 12l2-2 4 4 8-8 4 4" /></svg>
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">نموذج كفالة اليتيم</h1>
                                <p className="text-blue-100 text-sm">ابحث عن يتيم للتعديل أو ابدأ تسجيلًا جديدًا</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow-2xl rounded-3xl max-w-2xl w-full mx-auto p-4 px-4 sm:px-6 lg:px-8 py-8 mb-10 border border-gray-100">
                    <Logo />

                    <SearchSection
                        searchId={ searchId }
                        setSearchId={ setSearchId }
                        searchOrphanById={ searchOrphanById }
                        isSearching={ isSearching }
                        onNewRegistration={ () => {
                            setSearchMode(false);
                            setExistingOrphan(null);
                            resetForm();
                        } }
                    />

                    { successMessage && <SuccessMessage message={ successMessage } /> }
                    { errorMessage && <ErrorMessage message={ errorMessage } /> }

                    { existingOrphan && !isSearching && (
                        <div className="animate-fadeIn">
                            { editMode ? (
                                <div>
                                    <Alert type="info">
                                        <p className="font-bold">وضع التحديث</p>
                                        <p>يمكنك تحديث بيانات اليتيم المسجل</p>
                                    </Alert>

                                    <ProgressBar currentStep={ currentStep } totalSteps={ totalSteps } />

                                    <form onSubmit={ handleSubmit }>
                                        { currentStep === 0 && (
                                            <OrphanForm
                                                formData={ formData.orphan }
                                                handleChange={ (e) => handleChange('orphan', e) }
                                            />
                                        ) }
                                        { currentStep === 1 && (
                                            <FatherForm
                                                formData={ formData.father }
                                                handleChange={ (e) => handleChange('father', e) }
                                            />
                                        ) }
                                        { currentStep === 2 && (
                                            <MotherForm
                                                formData={ formData.mother }
                                                handleChange={ (e) => handleChange('mother', e) }
                                            />
                                        ) }
                                        { currentStep === 3 && (
                                            <GuardianForm
                                                formData={ formData.guardian }
                                                handleChange={ (e) => handleChange('guardian', e) }
                                            />
                                        ) }
                                        { currentStep === 4 && (
                                            <ApprovalForm
                                                formData={ formData.approval }
                                                handleChange={ (e) => handleChange('approval', e) }
                                            />
                                        ) }

                                        <NavigationButtons
                                            currentStep={ currentStep }
                                            totalSteps={ totalSteps }
                                            handlePrevious={ handlePrevious }
                                            handleNext={ handleNext }
                                            isSubmitting={ isUpdating }
                                        />
                                    </form>
                                </div>
                            ) : (
                                <OrphanDetails
                                    orphan={ existingOrphan }
                                    onEdit={ () => setEditMode(true) }
                                    onNewSearch={ () => {
                                        setExistingOrphan(null);
                                        setSearchId('');
                                        resetForm();
                                    } }
                                />
                            ) }
                        </div>
                    ) }

                    <div className='text-center mt-8 text-xl'>
                        لمتابعة أنشطة الجمعية ولمسات الخير المستمرة، يمكنكم زيارة موقعها الإلكتروني
                        <a href="https://saiid.org" className='text-blue-500 font-bold' target='_blank' rel="noopener noreferrer"> saiid.org </a>
                    </div>
                </div>
            </div>
        );
    }

    // Show the form for new registration
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center w-full px-4 sm:px-6 lg:px-8" style={ { direction: 'rtl' } }>
            {/* Image Processing Modal */ }
            <ImageProcessingModal isOpen={ showProcessingModal } progress={ processingProgress } />

            {/* Page Header */ }
            <div className="w-full max-w-3xl mt-14">
                <div className="relative overflow-hidden p-6 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 rounded-3xl shadow-2xl mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                    <div className="relative flex items-center gap-4">
                        <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-white"><path d="M3 12l2-2 4 4 8-8 4 4" /></svg>
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">نموذج كفالة اليتيم</h1>
                            <p className="text-blue-100 text-sm">املأ الخطوات التالية وأرسل النموذج</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow-2xl rounded-3xl max-w-3xl mx-auto p-4 px-4 sm:px-6 lg:px-8 py-8 mb-10 border border-gray-100" style={ { fontFamily: 'Cairo, sans-serif' } }>
                <Logo />

                <button
                    onClick={ () => {
                        setSearchMode(true);
                        setEditMode(false);
                        setCurrentStep(0);
                        resetForm();
                    } }
                    className="mb-6 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 shadow-md hover:shadow-lg font-semibold"
                >
                    <Search className="w-4 h-4" />
                    العودة للبحث
                </button>

                <ProgressBar currentStep={ currentStep } totalSteps={ totalSteps } />

                <div className='text-center mt-8 mb-8 text-xl'>
                    لمتابعة أنشطة الجمعية ولمسات الخير المستمرة، يمكنكم زيارة موقعها الإلكتروني
                    <a href="https://saiid.org" className='text-blue-500 font-bold' target='_blank' rel="noopener noreferrer"> saiid.org </a>
                </div>

                { successMessage && <SuccessMessage message={ successMessage } /> }
                { errorMessage && <ErrorMessage message={ errorMessage } /> }

                <div className="mb-6 p-5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-200 rounded-2xl shadow-md">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-amber-800 mb-2">تنبيه مهم:</p>
                            <p className="text-amber-700 text-sm mb-1">التسجيل لا يعني ضمان الكفالة، يرجى التأكد من قراءة جميع المعلومات قبل تقديم الطلب.</p>
                            <p className="text-amber-700 text-sm font-semibold">التسجيل للأطفال دون 12 عام فقط.</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={ handleSubmit }>
                    { currentStep === 0 && (
                        <OrphanForm
                            formData={ formData.orphan }
                            handleChange={ (e) => handleChange('orphan', e) }
                        />
                    ) }
                    { currentStep === 1 && (
                        <FatherForm
                            formData={ formData.father }
                            handleChange={ (e) => handleChange('father', e) }
                        />
                    ) }
                    { currentStep === 2 && (
                        <MotherForm
                            formData={ formData.mother }
                            handleChange={ (e) => handleChange('mother', e) }
                        />
                    ) }
                    { currentStep === 3 && (
                        <GuardianForm
                            formData={ formData.guardian }
                            handleChange={ (e) => handleChange('guardian', e) }
                        />
                    ) }
                    { currentStep === 4 && (
                        <ApprovalForm
                            formData={ formData.approval }
                            handleChange={ (e) => handleChange('approval', e) }
                        />
                    ) }

                    <NavigationButtons
                        currentStep={ currentStep }
                        totalSteps={ totalSteps }
                        handlePrevious={ handlePrevious }
                        handleNext={ handleNext }
                        isSubmitting={ isSubmitting }
                    />
                </form>
            </div>
        </div>
    );
}

export default Main;