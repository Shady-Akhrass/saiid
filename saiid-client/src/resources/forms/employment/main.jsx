import React, { useEffect, useState, useRef } from "react";
import apiClient from "../../../utils/axiosConfig";
import axios from "axios";
import EmploymentForm from "./employmentForm";
import ApprovalForm from "../orphan/approvalForm";
import ProgressBar from "../base/progressBar";
import NavigationButtons from "../base/navigationButtons";
import SuccessMessage from "../base/successMessage";
import ErrorMessage from "../base/errorMessage";
import Alert from "../base/alert";
import Logo from "../base/logo";
import FormUnavailable from "../FormUnavailable";
import FormUnavailableSkeleton from "../skeletons/FormUnavailableSkeleton";

function Main() {
    const hasIncrementedRef = useRef(false);
    const sections = ["بيانات المتقدم", "التعهد"];
    const totalSteps = sections.length;
    const [currentStep, setCurrentStep] = useState(0);
    const [isFormAvailable, setIsFormAvailable] = useState(null);
    const [formAvailabilityData, setFormAvailabilityData] = useState(null);
    const [formData, setFormData] = useState({
        employment: {
            name: "",
            birth_date: "",
            address: "",
            specialization: "",
            phone_number: "",
            previous_work_url: "",
        },
        approval: {
            data_approval_name: "",
            isChecked: false,
        },
    });
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (section, e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prevState) => ({
            ...prevState,
            [section]: {
                ...prevState[section],
                [name]: type === "checkbox" ? checked : value,
            },
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.approval.isChecked) {
            alert("يجب الموافقة على التعهد.");
            return;
        }

        const data = new FormData();
        for (const section in formData) {
            for (const key in formData[section]) {
                data.append(key, formData[section][key]);
            }
        }

        setIsSubmitting(true);

        try {
            const response = await apiClient.post(
                "/employments",
                data,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                }
            );
            setSuccessMessage("تم إرسال طلب التوظيف بنجاح!");
            setErrorMessage("");

            setTimeout(() => {
                setCurrentStep(0);
                setSuccessMessage("");
                resetForm();
            }, 5000);
        } catch (error) {
            if (error.response && error.response.status === 400) {
                const errors = error.response.data.errors;
                const formattedErrors = Object.values(errors).flat().join("\n");
                setErrorMessage(formattedErrors);
            } else {
                setErrorMessage("حدث خطأ غير متوقع. حاول مرة أخرى لاحقاً.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            employment: {
                name: "",
                birth_date: "",
                address: "",
                specialization: "",
                phone_number: "",
                previous_work_url: "",
            },
            approval: {
                data_approval_name: "",
                isChecked: false,
            },
        });
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    useEffect(() => {
        document.title = "نموذج التوظيف";
        const checkFormAvailability = async () => {
            try {
                const response = await apiClient.get('/form-availabilities');
                const forms = response.data;
                const employmentForm = forms.find(f => f.type === 'employment');
                if (employmentForm) {
                    setIsFormAvailable(employmentForm.is_available === true);
                    setFormAvailabilityData(employmentForm);
                } else {
                    setIsFormAvailable(false);
                    setFormAvailabilityData({ type: 'employment', is_available: false, notes: 'نموذج التوظيف غير مفعّل حالياً' });
                }
            } catch (error) {
                console.error('Error checking form availability:', error);
                setIsFormAvailable(true);
                setFormAvailabilityData({ type: 'employment', is_available: true, notes: '' });
            }
        };

        checkFormAvailability();

        const incrementVisitorCount = async () => {
            if (hasIncrementedRef.current) return;
            hasIncrementedRef.current = true;
            try {
                const response = await apiClient.post(
                    "/increment-visitor-employment-count"
                );
                console.log(response.data);
            } catch (error) {
                console.error("Error incrementing visitor count:", error);
            }
        };

        if (isFormAvailable !== false) {
            incrementVisitorCount();
        }
    }, []);

    if (isFormAvailable === null) {
        return <FormUnavailableSkeleton />;
    }

    if (isFormAvailable === false) {
        return <FormUnavailable formAvailabilityData={formAvailabilityData} />;
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center w-full px-4 sm:px-6 lg:px-8" style={{ direction: "rtl" }}>
            <div className="bg-white shadow-md rounded-xl max-w-2xl mx-auto p-4 px-4 sm:px-6 lg:px-8 py-8 mt-16 mb-10">
                <Logo />
                <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />

                <div className="text-center mt-8 mb-8 text-xl">
                    لمتابعة أنشطة الجمعية ولمسات الخير المستمرة، يمكنكم زيارة موقعها الإلكتروني
                    <a href="https://saiid.org" className="text-blue-500 font-bold" target="_blank" rel="noopener noreferrer"> saiid.org </a>
                </div>

                {successMessage && <SuccessMessage message={successMessage} />}
                {errorMessage && <ErrorMessage message={errorMessage} />}

                <Alert type="warning">
                    <p className="font-bold">الشروط المطلوبة:</p>
                    <p>يشترط أن يكون المتقدم من سكان رفح وخانيونس جنوب غزة.</p>
                    <p>يرجى إرفاق رابط نماذج من الأعمال السابقة.</p>
                    <p>الشواغر المتاحة لموظفين ذكور فقط.</p>
                </Alert>

                <form onSubmit={handleSubmit}>
                    {currentStep === 0 && (
                        <EmploymentForm
                            formData={formData.employment}
                            handleChange={(e) => handleChange("employment", e)}
                        />
                    )}
                    {currentStep === 1 && (
                        <ApprovalForm
                            formData={formData.approval}
                            handleChange={(e) => handleChange("approval", e)}
                        />
                    )}
                    <NavigationButtons
                        currentStep={currentStep}
                        totalSteps={totalSteps}
                        handlePrevious={handlePrevious}
                        handleNext={() => setCurrentStep(currentStep + 1)}
                        isSubmitting={isSubmitting}
                    />
                </form>
            </div>
        </div>
    );
}

export default Main;
