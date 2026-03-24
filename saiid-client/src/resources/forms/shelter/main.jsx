import React, { useEffect, useState, useRef } from 'react';
import apiClient from '../../../utils/axiosConfig';
import { useCacheInvalidation } from '../../../hooks/useCacheInvalidation';
import axios from 'axios';
import ShelterForm from './shelterForm';
import ManagerForm from './managerForm';
import DeputyManagerForm from './deputyManagerForm';
import ApprovalForm from '../orphan/approvalForm'; // Reusing the approval form
import ProgressBar from '../base/progressBar';
import NavigationButtons from '../base/navigationButtons';
import SuccessMessage from '../base/successMessage';
import ErrorMessage from '../base/errorMessage';
import Alert from '../base/alert';
import Logo from '../base/logo';
import FormUnavailable from "../FormUnavailable";
import FormUnavailableSkeleton from "../skeletons/FormUnavailableSkeleton";
import SearchSection from '../search/SearchSection';
import ShelterDetails from './ShelterDetails';
import { ArrowRight, Search } from 'lucide-react';
// import { ExternalLink, FileSpreadsheet } from 'lucide-react';

function Main() {
    const { invalidateSheltersCache } = useCacheInvalidation();
    const sections = ['بيانات مركز نزوح', 'بيانات المدير', 'بيانات نائب المدير', 'التعهد'];
    const hasIncrementedRef = useRef(false);
    const totalSteps = sections.length;
    const [isFormAvailable, setIsFormAvailable] = useState(null);
    const [formAvailabilityData, setFormAvailabilityData] = useState(null);

    // جميع الـ hooks يجب أن تكون قبل أي conditional returns
    const [currentStep, setCurrentStep] = useState(0);

    // Search states
    const [searchMode, setSearchMode] = useState(true);
    const [searchId, setSearchId] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [existingShelter, setExistingShelter] = useState(null);

    const [formData, setFormData] = useState({
        shelter: {
            camp_name: '',
            governorate: '',
            district: '',
            detailed_address: '',
            tents_count: '',
            families_count: '',
            excel_sheet: null,
        },
        manager: {
            manager_id_number: '',
            manager_name: '',
            manager_phone: '',
            manager_alternative_phone: '',
            manager_job_description: '',
        },
        deputy: {
            deputy_manager_name: '',
            deputy_manager_id_number: '',
            deputy_manager_phone: '',
            deputy_manager_alternative_phone: '',
            deputy_manager_job_description: '',
        },
        approval: {
            data_approval_name: '',
            isChecked: false
        }
    });
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const checkFormAvailability = async () => {
        try {
            const response = await apiClient.get('/form-availabilities');
            const forms = response.data;
            const shelterForm = forms.find(f => f.type === 'shelter');
            if (shelterForm) {
                setIsFormAvailable(shelterForm.is_available === true);
                setFormAvailabilityData(shelterForm);
            } else {
                setIsFormAvailable(false);
                setFormAvailabilityData({ type: 'shelter', is_available: false, notes: 'نموذج المأوى غير مفعّل حالياً' });
            }
        } catch (error) {
            console.error('Error checking form availability:', error);
            setIsFormAvailable(true);
            setFormAvailabilityData({ type: 'shelter', is_available: true, notes: '' });
        }
    };

    useEffect(() => {
        checkFormAvailability();

        const incrementVisitorCount = async () => {
            if (hasIncrementedRef.current) return;
            hasIncrementedRef.current = true;
            try {
                await apiClient.post('/increment-visitor-shelters-count');
            } catch (err) {
                console.error('Error incrementing visitor count:', err);
            }
        };

        if (isFormAvailable !== false) {
            incrementVisitorCount();
        }
    }, []);

    // الآن يمكننا إضافة conditional returns بعد جميع الـ hooks
    if (isFormAvailable === null) {
        return <FormUnavailableSkeleton />;
    }

    if (isFormAvailable === false) {
        return <FormUnavailable formAvailabilityData={ formAvailabilityData } />;
    }

    const handleChange = (section, e) => {
        const { name, type, checked, value, files } = e.target;
        if (files && files[0]) {
            setFormData(prevState => ({
                ...prevState,
                [section]: {
                    ...prevState[section],
                    [name]: files[0],
                },
            }));
        } else {
            setFormData(prevState => ({
                ...prevState,
                [section]: {
                    ...prevState[section],
                    [name]: type === 'checkbox' ? checked : value,
                },
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.shelter.excel_sheet) {
            setErrorMessage('يرجى تحميل ملف Excel للنازحين');
            return;
        }

        if (!formData.approval.isChecked) {
            alert('يجب الموافقة على التعهد.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Create FormData object for shelter data
            const formDataToSend = new FormData();

            // Add shelter data
            formDataToSend.append('camp_name', formData.shelter.camp_name);
            formDataToSend.append('governorate', formData.shelter.governorate);
            formDataToSend.append('district', formData.shelter.district);
            formDataToSend.append('detailed_address', formData.shelter.detailed_address);
            formDataToSend.append('tents_count', formData.shelter.tents_count);
            formDataToSend.append('families_count', formData.shelter.families_count);
            formDataToSend.append('excel_sheet', formData.shelter.excel_sheet);

            // Add manager data
            formDataToSend.append('manager_id_number', formData.manager.manager_id_number);
            formDataToSend.append('manager_name', formData.manager.manager_name);
            formDataToSend.append('manager_phone', formData.manager.manager_phone);
            formDataToSend.append('manager_alternative_phone', formData.manager.manager_alternative_phone || '');
            formDataToSend.append('manager_job_description', formData.manager.manager_job_description);

            // Add deputy manager data
            formDataToSend.append('deputy_manager_name', formData.deputy.deputy_manager_name);
            formDataToSend.append('deputy_manager_id_number', formData.deputy.deputy_manager_id_number);
            formDataToSend.append('deputy_manager_phone', formData.deputy.deputy_manager_phone);
            formDataToSend.append('deputy_manager_alternative_phone', formData.deputy.deputy_manager_alternative_phone || '');
            formDataToSend.append('deputy_manager_job_description', formData.deputy.deputy_manager_job_description);

            // First store shelter data
            const response = await apiClient.post('/shelters', formDataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                }
            });


            // Create separate FormData for Excel file
            const excelFormData = new FormData();
            excelFormData.append('file', formData.shelter.excel_sheet); // Changed from 'excel_sheet' to 'file'
            excelFormData.append('manager_id_number', formData.manager.manager_id_number);

            // Process Excel file
            // await axios.post('http://127.0.0.1:8000/api/refugees/import', excelFormData, {
            //     headers: {
            //         'Content-Type': 'multipart/form-data'
            //     }
            // })
            //     .then(response => {
            //         console.log('Success:', response.data);
            //         console.log('Imported Rows:', response.data.imported_rows);
            //     })
            //     .catch(error => {
            //         console.error('Error:', error.response ? error.response.data : error.message);
            //         console.log('Imported Rows:', response.data.imported_rows);

            //     });

            setSuccessMessage('تم تسجيل بيانات مركز نزوح ومعالجة ملف Excel بنجاح!');
            setErrorMessage('');

            // ✅ إبطال كاش المخيمات عند الإضافة
            invalidateSheltersCache();

            // Reset form after successful submission
            setTimeout(() => {
                setCurrentStep(0);
                setSuccessMessage('');
                resetForm();
            }, 5000);

        } catch (error) {
            console.error('Submission error:', error);
            if (error.response?.data?.errors) {
                const errors = error.response.data.errors;
                const formattedErrors = Object.values(errors).flat().join('\n');
                setErrorMessage(formattedErrors);
            } else if (error.response?.data?.message) {
                setErrorMessage(error.response.data.message);
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
            shelter: {
                camp_name: '',
                governorate: '',
                district: '',
                detailed_address: '',
                tents_count: '',
                families_count: '',
                excel_sheet: null,
            },
            manager: {
                manager_id_number: '',
                manager_name: '',
                manager_phone: '',
                manager_alternative_phone: '',
                manager_job_description: '',
            },
            deputy: {
                deputy_manager_name: '',
                deputy_manager_id_number: '',
                deputy_manager_phone: '',
                deputy_manager_alternative_phone: '',
                deputy_manager_job_description: '',
            },
            approval: {
                data_approval_name: '',
                isChecked: false
            }
        });
    };

    const handleNext = () => {
        if (currentStep < sections.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    // Search for shelter by manager ID
    const searchShelterById = async () => {
        if (!searchId.trim()) {
            setErrorMessage('يرجى إدخال رقم هوية المدير');
            return;
        }

        setIsSearching(true);
        setErrorMessage('');
        setSuccessMessage('');
        setExistingShelter(null);

        try {
            const response = await apiClient.get(`/shelters/${searchId}`);

            if (response.data && response.data.success && response.data.shelter) {
                setExistingShelter(response.data.shelter);
                setSuccessMessage('تم العثور على بيانات المخيم بنجاح');
            } else {
                setErrorMessage('لم يتم العثور على بيانات مخيم برقم الهوية المدخل');
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                setErrorMessage('لم يتم العثور على بيانات مخيم برقم الهوية المدخل');
            } else {
                setErrorMessage('حدث خطأ في البحث. يرجى المحاولة مرة أخرى');
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleNewRegistration = () => {
        setSearchMode(false);
        setExistingShelter(null);
        setSearchId('');
        resetForm();
    };

    const handleUpdateSuccess = (updatedShelter) => {
        setExistingShelter(updatedShelter);
        setSuccessMessage('تم تحديث بيانات المخيم بنجاح');
    };


    // Show search interface
    if (searchMode && !existingShelter) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center w-full px-4 sm:px-6 lg:px-8" style={ { direction: 'rtl', fontFamily: 'Cairo, sans-serif' } }>
                {/* Page Header */ }
                <div className="w-full max-w-2xl mt-14">
                    <div className="relative overflow-hidden p-6 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 rounded-3xl shadow-2xl mb-6">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                        <div className="relative flex items-center gap-4">
                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-white"><path d="M3 12l2-2 4 4 8-8 4 4" /></svg>
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">نموذج مراكز النزوح</h1>
                                <p className="text-blue-100 text-sm">ابحث عن مخيم للتعديل أو ابدأ تسجيلًا جديدًا</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow-2xl rounded-3xl max-w-2xl w-full mx-auto p-4 px-4 sm:px-6 lg:px-8 py-8 mb-10 border border-gray-100">
                    <Logo />

                    <SearchSection
                        searchId={ searchId }
                        setSearchId={ setSearchId }
                        searchOrphanById={ searchShelterById }
                        isSearching={ isSearching }
                        onNewRegistration={ handleNewRegistration }
                        searchLabel="البحث عن مخيم مسجل"
                        idLabel="رقم هوية المدير"
                        searchPlaceholder="أدخل رقم هوية المدير (9 أرقام)"
                        searchButtonText="بحث عن مخيم"
                        newRegistrationText="+ تسجيل مخيم جديد"
                    />

                    { successMessage && <SuccessMessage message={ successMessage } /> }
                    { errorMessage && <ErrorMessage message={ errorMessage } /> }
                </div>
            </div>
        );
    }

    // Show shelter details if found
    if (searchMode && existingShelter) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center w-full px-4 sm:px-6 lg:px-8" style={ { direction: 'rtl', fontFamily: 'Cairo, sans-serif' } }>
                {/* Page Header */ }
                <div className="w-full max-w-4xl mt-14">
                    <div className="relative overflow-hidden p-6 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 rounded-3xl shadow-2xl mb-6">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                        <div className="relative flex items-center gap-4">
                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-white"><path d="M3 12l2-2 4 4 8-8 4 4" /></svg>
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">تفاصيل مركز نزوح</h1>
                                <p className="text-blue-100 text-sm">عرض وتحرير بيانات المخيم</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow-2xl rounded-3xl max-w-4xl w-full mx-auto p-4 px-4 sm:px-6 lg:px-8 py-8 mb-10 border border-gray-100">
                    <Logo />
                    { successMessage && <SuccessMessage message={ successMessage } /> }
                    { errorMessage && <ErrorMessage message={ errorMessage } /> }
                    <ShelterDetails
                        shelter={ existingShelter }
                        onEdit={ () => { } }
                        onNewSearch={ () => {
                            setSearchMode(true);
                            setExistingShelter(null);
                            setSearchId('');
                            setSuccessMessage('');
                            setErrorMessage('');
                        } }
                        onUpdateSuccess={ handleUpdateSuccess }
                    />
                </div>
            </div>
        );
    }

    // Show registration form
    return (
        <div
            className="min-h-screen bg-gray-100 flex flex-col items-center w-full px-4 sm:px-6 lg:px-8"
            style={ { direction: 'rtl', fontFamily: 'Cairo, sans-serif' } }
        >
            {/* Page Header */ }
            <div className="w-full max-w-2xl mt-14">
                <div className="relative overflow-hidden p-6 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 rounded-3xl shadow-2xl mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                    <div className="relative flex items-center gap-4">
                        <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-white"><path d="M3 12l2-2 4 4 8-8 4 4" /></svg>
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">تسجيل مركز نزوح جديد</h1>
                            <p className="text-blue-100 text-sm">املأ الخطوات التالية وأرسل النموذج</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow-2xl rounded-3xl max-w-2xl mx-auto p-4 px-4 sm:px-6 lg:px-8 py-8 mb-10 border border-gray-100">
                <Logo />

                <button
                    onClick={ () => {
                        setSearchMode(true);
                        setExistingShelter(null);
                        setSearchId('');
                        setCurrentStep(0);
                        resetForm();
                        setSuccessMessage('');
                        setErrorMessage('');
                    } }
                    className="mb-6 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 shadow-md hover:shadow-lg font-semibold"
                    title="العودة إلى البحث"
                >
                    <ArrowRight className="w-4 h-4" />
                    <span>العودة للبحث</span>
                </button>
                <ProgressBar currentStep={ currentStep } totalSteps={ totalSteps } />

                <div className='text-center mt-8 mb-8 text-xl'>
                    لمتابعة أنشطة الجمعية ولمسات الخير المستمرة، يمكنكم زيارة موقعها الإلكتروني
                    <a href="https://saiid.org" className='text-blue-500 font-bold' target='_blank' rel="noopener noreferrer"> saiid.org </a>
                </div>

                { successMessage && <SuccessMessage message={ successMessage } /> }
                { errorMessage && <ErrorMessage message={ errorMessage } /> }

                <Alert type="warning">
                    <p className="font-bold">تنبيه:</p>
                    <p>يرجى التأكد من صحة جميع البيانات المدخلة قبل إرسال النموذج.</p>

                </Alert>

                <form onSubmit={ handleSubmit }>
                    { currentStep === 0 && (
                        <ShelterForm
                            formData={ formData.shelter }
                            handleChange={ (e) => handleChange('shelter', e) }
                        />
                    ) }
                    { currentStep === 1 && (
                        <ManagerForm
                            formData={ formData.manager }
                            handleChange={ (e) => handleChange('manager', e) }
                        />
                    ) }
                    { currentStep === 2 && (
                        <DeputyManagerForm
                            formData={ formData.deputy }
                            handleChange={ (e) => handleChange('deputy', e) }
                        />
                    ) }
                    { currentStep === 3 && (
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
