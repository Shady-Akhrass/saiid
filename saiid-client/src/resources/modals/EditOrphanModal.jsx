import React, { useState, useEffect } from 'react';
import { X, Save, Camera, FileText, User, Users, Heart, UserCheck, CheckCircle, FileSpreadsheet } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import axios from 'axios';
import apiClient from '../../utils/axiosConfig';
import { useCacheInvalidation } from '../../hooks/useCacheInvalidation';

const API_BASE = import.meta.env.VITE_API_URL || "https://forms-api.saiid.org/api";

const EditOrphanModal = ({
    isOpen,
    onClose,
    orphanData,
    onUpdateSuccess
}) => {
    const { invalidateOrphansCache } = useCacheInvalidation();
    const [activeTab, setActiveTab] = useState('orphan');
    const [isUpdating, setIsUpdating] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const [formData, setFormData] = useState({
        // Orphan data
        orphan_id_number: '',
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
        orphan_photo: null,

        // Guardian data
        guardian_id_number: '',
        guardian_full_name: '',
        guardian_relationship: '',
        guardian_phone_number: '',
        alternative_phone_number: '',

        // Father data
        deceased_father_full_name: '',
        deceased_father_birth_date: '',
        death_date: '',
        death_cause: '',
        previous_father_job: '',
        death_certificate: null,

        // Mother data
        mother_full_name: '',
        mother_id_number: '',
        is_mother_deceased: '',
        mother_birth_date: '',
        mother_death_date: '',
        mother_status: '',
        mother_job: '',
        mother_death_certificate: null,

        // Approval
        data_approval_name: '',
        isChecked: true
    });

    const [photoPreview, setPhotoPreview] = useState(null);
    const [certificatePreview, setCertificatePreview] = useState(null);
    const [motherCertificatePreview, setMotherCertificatePreview] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // Document Download Handlers
    const handleDownloadPdf = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            const orphanId = orphanData.orphan_id_number || orphanData.id;
            const response = await apiClient.get(`/orphans/${orphanId}/export-pdf`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `orphan_${orphanId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download failed:', err);
            alert('فشل تحميل ملف PDF');
        } finally {
            setIsDownloading(false);
        }
    };

    // Initialize form data when modal opens
    useEffect(() => {
        if (isOpen && orphanData) {
            const orphanId = orphanData.id || orphanData.orphan_id_number;

            setFormData({
                orphan_id_number: orphanData.orphan_id_number || '',
                orphan_full_name: orphanData.orphan_full_name || '',
                orphan_birth_date: orphanData.orphan_birth_date || '',
                orphan_gender: orphanData.orphan_gender || '',
                health_status: orphanData.health_status || '',
                disease_description: orphanData.disease_description || '',
                original_address: orphanData.original_address || '',
                current_address: orphanData.current_address || '',
                address_details: orphanData.address_details || '',
                number_of_brothers: orphanData.number_of_brothers || '',
                number_of_sisters: orphanData.number_of_sisters || '',
                is_enrolled_in_memorization_center: orphanData.is_enrolled_in_memorization_center || '',
                orphan_photo: null,

                guardian_id_number: orphanData.guardian_id_number || '',
                guardian_full_name: orphanData.guardian_full_name || '',
                guardian_relationship: orphanData.guardian_relationship || '',
                guardian_phone_number: orphanData.guardian_phone_number || '',
                alternative_phone_number: orphanData.alternative_phone_number || '',

                deceased_father_full_name: orphanData.deceased_father_full_name || '',
                deceased_father_birth_date: orphanData.deceased_father_birth_date || '',
                death_date: orphanData.death_date || '',
                death_cause: orphanData.death_cause || '',
                previous_father_job: orphanData.previous_father_job || '',
                death_certificate: null,

                mother_full_name: orphanData.mother_full_name || '',
                mother_id_number: orphanData.mother_id_number || '',
                is_mother_deceased: orphanData.is_mother_deceased || '',
                mother_birth_date: orphanData.mother_birth_date || '',
                mother_death_date: orphanData.mother_death_date || '',
                mother_status: orphanData.mother_status || '',
                mother_job: orphanData.mother_job || '',

                data_approval_name: orphanData.guardian_full_name || '',
                isChecked: true
            });

            // Set image previews
            setPhotoPreview(`${API_BASE}/image/${orphanId}`);
            setCertificatePreview(`${API_BASE}/death-certificate/${orphanId}`);
        }
    }, [isOpen, orphanData]);

    // Handle input changes
    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle image upload - IMPROVED VERSION
    const handleImageUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log('Original file:', file.name, file.size, file.type);

        try {
            // Compress image
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            };
            const compressedFile = await imageCompression(file, options);

            console.log('Compressed file:', compressedFile.size, compressedFile.type);

            // Create a proper File object from the compressed blob
            const fileName = file.name || `image_${Date.now()}.jpg`;
            const fileType = compressedFile.type || 'image/jpeg';

            const compressedFileWithName = new File(
                [compressedFile],
                fileName,
                { type: fileType }
            );

            console.log('Final file object:', compressedFileWithName.name, compressedFileWithName.size, compressedFileWithName.type);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                if (type === 'photo') {
                    setPhotoPreview(reader.result);
                    setFormData(prev => ({ ...prev, orphan_photo: compressedFileWithName }));
                    console.log('Photo set in formData');
                } else if (type === 'certificate') {
                    setCertificatePreview(reader.result);
                    setFormData(prev => ({ ...prev, death_certificate: compressedFileWithName }));
                    console.log('Certificate set in formData');
                } else if (type === 'mother_certificate') {
                    setMotherCertificatePreview(reader.result);
                    setFormData(prev => ({ ...prev, mother_death_certificate: compressedFileWithName }));
                    console.log('Mother certificate set in formData');
                }
            };
            reader.readAsDataURL(compressedFileWithName);
        } catch (error) {
            console.error('Error compressing image:', error);
            alert('حدث خطأ في معالجة الصورة');
        }
    };

    // Show success message temporarily (no page reload here)
    const showSuccessMessage = (message) => {
        setSuccessMessage(message);
        setShowSuccess(true);

        // Hide message after 3 seconds and close modal
        setTimeout(() => {
            setShowSuccess(false);
            setSuccessMessage('');
            onClose();
        }, 3000);
    };

    // Handle form submission - FIXED VERSION with POST
    const handleSubmit = async () => {
        setIsUpdating(true);
        setErrorMessage('');

        try {
            const orphanId = orphanData.orphan_id_number;
            const hasNewPhoto = formData.orphan_photo instanceof File;
            const hasNewCertificate = formData.death_certificate instanceof File;
            const hasNewMotherCertificate = formData.mother_death_certificate instanceof File;

            // Prepare non-file fields for optimistic update
            const updatedFields = {};
            Object.keys(formData).forEach(key => {
                if (key === 'orphan_photo' || key === 'death_certificate' || key === 'mother_death_certificate' || key === 'isChecked') return;
                const v = formData[key];
                if (v !== null && v !== undefined && v !== '') updatedFields[key] = v;
            });

            const originalOrphan = orphanData || {};
            const optimisticOrphan = { ...originalOrphan, ...updatedFields };

            // attach image previews if available so parent can show them optimistically
            if (photoPreview) optimisticOrphan.orphan_photo_preview = photoPreview;
            if (certificatePreview) optimisticOrphan.death_certificate_preview = certificatePreview;

            // Immediately inform parent of optimistic update
            if (onUpdateSuccess) {
                // status: 'optimistic'
                onUpdateSuccess(optimisticOrphan, originalOrphan, 'optimistic');
            }

            // Perform request depending on whether files are present
            if (!hasNewPhoto && !hasNewCertificate && !hasNewMotherCertificate) {
                // No files - send as JSON with PATCH
                const dataToSend = { ...formData };
                delete dataToSend.orphan_photo;
                delete dataToSend.death_certificate;
                delete dataToSend.mother_death_certificate;
                delete dataToSend.isChecked;

                const response = await axios.patch(
                    `${API_BASE}/orphans/${orphanId}`,
                    dataToSend,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    }
                );

                if (response.data && response.data.success) {
                    // ✅ إبطال كاش الأيتام عند التحديث
                    invalidateOrphansCache();
                    // Notify parent of final state (server response)
                    if (onUpdateSuccess) onUpdateSuccess(response.data.data || optimisticOrphan, originalOrphan, 'success');
                    showSuccessMessage('تم تحديث بيانات اليتيم بنجاح ✓');
                } else {
                    // Revert on unexpected response
                    if (onUpdateSuccess) onUpdateSuccess(originalOrphan, originalOrphan, 'failure');
                    setErrorMessage('فشل في تحديث البيانات');
                }
            } else {
                // Has files - use FormData with POST (method spoofing to PATCH)
                const data = new FormData();
                data.append('_method', 'PATCH');

                Object.keys(formData).forEach(key => {
                    if (key === 'isChecked') return;
                    const value = formData[key];
                    if (value === null || value === undefined || value === '') return;
                    if (key === 'orphan_photo' || key === 'death_certificate' || key === 'mother_death_certificate') return; // append files below
                    data.append(key, String(value));
                });

                if (hasNewPhoto) data.append('orphan_photo', formData.orphan_photo);
                if (hasNewCertificate) data.append('death_certificate', formData.death_certificate);
                if (hasNewMotherCertificate) data.append('mother_death_certificate', formData.mother_death_certificate);

                const response = await axios.post(
                    `${API_BASE}/orphans/${orphanId}`,
                    data,
                    {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                        },
                        timeout: 30000,
                        onUploadProgress: (progressEvent) => {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            console.log('Upload progress:', percentCompleted + '%');
                        }
                    }
                );

                if (response.data && response.data.success) {
                    if (onUpdateSuccess) onUpdateSuccess(response.data.data || optimisticOrphan, originalOrphan, 'success');
                    showSuccessMessage('تم تحديث بيانات اليتيم بنجاح ✓');
                } else {
                    if (onUpdateSuccess) onUpdateSuccess(originalOrphan, originalOrphan, 'failure');
                    setErrorMessage('فشل في تحديث البيانات');
                }
            }

        } catch (error) {
            console.error('Error:', error);
            // Revert optimistic update
            if (onUpdateSuccess) onUpdateSuccess(orphanData, orphanData, 'failure');
            setErrorMessage('حدث خطأ في عملية الحفظ');
        } finally {
            setIsUpdating(false);
        }
    };


    if (!isOpen) return null;

    const tabs = [
        { id: 'orphan', label: 'بيانات اليتيم', icon: User },
        { id: 'father', label: 'بيانات الأب', icon: Users },
        { id: 'mother', label: 'بيانات الأم', icon: Heart },
        { id: 'guardian', label: 'بيانات الوصي', icon: UserCheck }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col relative">

                {/* Success Message Overlay */ }
                { showSuccess && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-60 animate-fadeIn">
                        <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
                            <CheckCircle className="w-6 h-6" />
                            <span className="font-medium">{ successMessage }</span>
                        </div>
                    </div>
                ) }

                {/* Error Message */ }
                { errorMessage && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-60 max-w-md">
                        <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg">
                            <p className="text-sm">{ errorMessage }</p>
                        </div>
                    </div>
                ) }

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">تعديل بيانات اليتيم</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isDownloading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                title="تحميل PDF"
                            >
                                <FileText className="w-4 h-4" />
                                <span>PDF</span>
                            </button>
                            <div className="w-px h-6 bg-white/30 mx-1"></div>
                            <button
                                onClick={onClose}
                                disabled={isUpdating}
                                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabs */ }
                <div className="flex border-b bg-gray-50">
                    { tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={ tab.id }
                                onClick={ () => setActiveTab(tab.id) }
                                className={ `flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${activeTab === tab.id
                                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }` }
                            >
                                <Icon className="w-5 h-5" />
                                { tab.label }
                            </button>
                        );
                    }) }
                </div>

                {/* Content */ }
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Orphan Tab */ }
                    { activeTab === 'orphan' && (
                        <div className="space-y-6">
                            {/* Photo Section */ }
                            <div className="border rounded-lg p-4 bg-gray-50">
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    صورة اليتيم
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <img
                                            src={ photoPreview }
                                            alt="صورة اليتيم"
                                            className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                                            onError={ (e) => {
                                                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjY0IiB5PSI2NCIgc3R5bGU9ImZpbGw6I2FhYTtmb250LXdlaWdodDpib2xkO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtZmFtaWx5OkFyaWFsLEhlbHZldGljYSxzYW5zLXNlcmlmO2RvbWluYW50LWJhc2VsaW5lOmNlbnRyYWwiPmxhIHRvamFkPC90ZXh0Pjwvc3ZnPg==';
                                            } }
                                        />
                                        <label className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors">
                                            <Camera className="w-4 h-4" />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={ (e) => handleImageUpload(e, 'photo') }
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        انقر على أيقونة الكاميرا لتغيير الصورة
                                    </p>
                                </div>
                            </div>

                            {/* Orphan Fields */ }
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        الاسم الرباعي
                                    </label>
                                    <input
                                        type="text"
                                        value={ formData.orphan_full_name }
                                        onChange={ (e) => handleChange('orphan_full_name', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="الاسم الأول + اسم الأب + اسم الجد + العائلة"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        رقم الهوية
                                    </label>
                                    <input
                                        type="text"
                                        value={ formData.orphan_id_number }
                                        onChange={ (e) => handleChange('orphan_id_number', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        تاريخ الميلاد
                                    </label>
                                    <input
                                        type="date"
                                        value={ formData.orphan_birth_date }
                                        onChange={ (e) => handleChange('orphan_birth_date', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        الجنس
                                    </label>
                                    <select
                                        value={ formData.orphan_gender }
                                        onChange={ (e) => handleChange('orphan_gender', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">اختر</option>
                                        <option value="ذكر">ذكر</option>
                                        <option value="أنثى">أنثى</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        الحالة الصحية
                                    </label>
                                    <select
                                        value={ formData.health_status }
                                        onChange={ (e) => handleChange('health_status', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">اختر</option>
                                        <option value="جيدة">جيدة</option>
                                        <option value="مريض">مريض</option>
                                    </select>
                                </div>

                                { formData.health_status === 'مريض' && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            وصف المرض
                                        </label>
                                        <textarea
                                            value={ formData.disease_description }
                                            onChange={ (e) => handleChange('disease_description', e.target.value) }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            rows="3"
                                        />
                                    </div>
                                ) }

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        العنوان الأصلي
                                    </label>
                                    <select
                                        value={ formData.original_address }
                                        onChange={ (e) => handleChange('original_address', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">اختر</option>
                                        <option value="محافظة الشمال">محافظة الشمال</option>
                                        <option value="محافظة غزة">محافظة غزة</option>
                                        <option value="محافظة الوسطى">محافظة الوسطى</option>
                                        <option value="محافظة خانيونس">محافظة خانيونس</option>
                                        <option value="محافظة رفح">محافظة رفح</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        العنوان الحالي
                                    </label>
                                    <select
                                        value={ formData.current_address }
                                        onChange={ (e) => handleChange('current_address', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">اختر</option>
                                        <option value="محافظة الشمال">محافظة الشمال</option>
                                        <option value="محافظة غزة">محافظة غزة</option>
                                        <option value="محافظة الوسطى">محافظة الوسطى</option>
                                        <option value="محافظة خانيونس">محافظة خانيونس</option>
                                        <option value="محافظة رفح">محافظة رفح</option>
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        تفاصيل العنوان
                                    </label>
                                    <textarea
                                        value={ formData.address_details }
                                        onChange={ (e) => handleChange('address_details', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        rows="2"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        عدد الإخوة
                                    </label>
                                    <input
                                        type="number"
                                        value={ formData.number_of_brothers }
                                        onChange={ (e) => handleChange('number_of_brothers', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        min="0"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        عدد الأخوات
                                    </label>
                                    <input
                                        type="number"
                                        value={ formData.number_of_sisters }
                                        onChange={ (e) => handleChange('number_of_sisters', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        min="0"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ملتحق بمركز تحفيظ
                                    </label>
                                    <select
                                        value={ formData.is_enrolled_in_memorization_center }
                                        onChange={ (e) => handleChange('is_enrolled_in_memorization_center', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">اختر</option>
                                        <option value="نعم">نعم</option>
                                        <option value="لا">لا</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ) }

                    {/* Father Tab */ }
                    { activeTab === 'father' && (
                        <div className="space-y-6">
                            {/* Death Certificate */ }
                            <div className="border rounded-lg p-4 bg-gray-50">
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    شهادة الوفاة
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <img
                                            src={ certificatePreview }
                                            alt="شهادة الوفاة"
                                            className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                                            onError={ (e) => {
                                                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjY0IiB5PSI2NCIgc3R5bGU9ImZpbGw6I2FhYTtmb250LXdlaWdodDpib2xkO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtZmFtaWx5OkFyaWFsLEhlbHZldGljYSxzYW5zLXNlcmlmO2RvbWluYW50LWJhc2VsaW5lOmNlbnRyYWwiPmxhIHRvamFkPC90ZXh0Pjwvc3ZnPg==';
                                            } }
                                        />
                                        <label className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors">
                                            <FileText className="w-4 h-4" />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={ (e) => handleImageUpload(e, 'certificate') }
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        انقر على الأيقونة لتغيير الشهادة
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        الاسم الرباعي للأب المتوفى
                                    </label>
                                    <input
                                        type="text"
                                        value={ formData.deceased_father_full_name }
                                        onChange={ (e) => handleChange('deceased_father_full_name', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="الاسم الأول + اسم الأب + اسم الجد + العائلة"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        تاريخ ميلاد الأب
                                    </label>
                                    <input
                                        type="date"
                                        value={ formData.deceased_father_birth_date }
                                        onChange={ (e) => handleChange('deceased_father_birth_date', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        تاريخ الوفاة
                                    </label>
                                    <input
                                        type="date"
                                        value={ formData.death_date }
                                        onChange={ (e) => handleChange('death_date', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        سبب الوفاة
                                    </label>
                                    <select
                                        value={ formData.death_cause }
                                        onChange={ (e) => handleChange('death_cause', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">اختر</option>
                                        <option value="شهيد حرب">شهيد حرب</option>
                                        <option value="وفاة طبيعية">وفاة طبيعية</option>
                                        <option value="وفاة بسبب المرض">وفاة بسبب المرض</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        طبيعة عمل الأب
                                    </label>
                                    <select
                                        value={ formData.previous_father_job }
                                        onChange={ (e) => handleChange('previous_father_job', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">اختر طبيعة العمل</option>
                                        <option value="قطاع حكومي">قطاع حكومي</option>
                                        <option value="قطاع خاص">قطاع خاص</option>
                                        <option value="لا يعمل">لا يعمل</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ) }

                    {/* Mother Tab */ }
                    { activeTab === 'mother' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        الاسم الرباعي للأم
                                    </label>
                                    <input
                                        type="text"
                                        value={ formData.mother_full_name }
                                        onChange={ (e) => handleChange('mother_full_name', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="الاسم الأول + اسم الأب + اسم الجد + العائلة"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        رقم هوية الأم
                                    </label>
                                    <input
                                        type="text"
                                        value={ formData.mother_id_number }
                                        onChange={ (e) => handleChange('mother_id_number', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        هل الأم متوفاة
                                    </label>
                                    <select
                                        value={ formData.is_mother_deceased }
                                        onChange={ (e) => handleChange('is_mother_deceased', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">اختر</option>
                                        <option value="نعم">نعم</option>
                                        <option value="لا">لا</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        تاريخ ميلاد الأم
                                    </label>
                                    <input
                                        type="date"
                                        value={ formData.mother_birth_date }
                                        onChange={ (e) => handleChange('mother_birth_date', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                { formData.is_mother_deceased === 'نعم' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            تاريخ وفاة الأم
                                        </label>
                                        <input
                                            type="date"
                                            value={ formData.mother_death_date }
                                            onChange={ (e) => handleChange('mother_death_date', e.target.value) }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                ) }

                                { formData.is_mother_deceased === 'نعم' && (
                                    <div className="col-span-2 border rounded-lg p-4 bg-gray-50">
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            شهادة وفاة الأم
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <img
                                                    src={ motherCertificatePreview || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjY0IiB5PSI2NCIgc3R5bGU9ImZpbGw6I2FhYTtmb250LXdlaWdodDpib2xkO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtZmFtaWx5OkFyaWFsLEhlbHZldGljYSxzYW5zLXNlcmlmO2RvbWluYW50LWJhc2VsaW5lOmNlbnRyYWwiPm5vIHByZXZpZXc8L3RleHQ+PC9zdmc+' }
                                                    alt="شهادة وفاة الأم"
                                                    className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                                                />
                                                <label className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors">
                                                    <FileText className="w-4 h-4" />
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={ (e) => handleImageUpload(e, 'mother_certificate') }
                                                        className="hidden"
                                                    />
                                                </label>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                انقر على الأيقونة لتغيير شهادة وفاة الأم
                                            </p>
                                        </div>
                                    </div>
                                ) }

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        حالة الأم
                                    </label>
                                    <select
                                        value={ formData.mother_status }
                                        onChange={ (e) => handleChange('mother_status', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">اختر</option>
                                        <option value="أرملة">أرملة</option>
                                        <option value="متزوجة">متزوجة</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        طبيعة عمل الأم
                                    </label>
                                    <select
                                        value={ formData.mother_job }
                                        onChange={ (e) => handleChange('mother_job', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">اختر طبيعة العمل</option>
                                        <option value="قطاع حكومي">قطاع حكومي</option>
                                        <option value="قطاع خاص">قطاع خاص</option>
                                        <option value="لا تعمل">لا تعمل</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ) }

                    {/* Guardian Tab */ }
                    { activeTab === 'guardian' && (
                        <div className="space-y-6 ">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        الاسم الرباعي للوصي
                                    </label>
                                    <input
                                        type="text"
                                        value={ formData.guardian_full_name }
                                        onChange={ (e) => handleChange('guardian_full_name', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="الاسم الأول + اسم الأب + اسم الجد + العائلة"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        رقم هوية الوصي
                                    </label>
                                    <input
                                        type="text"
                                        value={ formData.guardian_id_number }
                                        onChange={ (e) => handleChange('guardian_id_number', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-100"
                                        disabled
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        صلة القرابة
                                    </label>
                                    <input
                                        type="text"
                                        value={ formData.guardian_relationship }
                                        onChange={ (e) => handleChange('guardian_relationship', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        رقم الهاتف
                                    </label>
                                    <input
                                        type="tel"
                                        value={ formData.guardian_phone_number }
                                        onChange={ (e) => handleChange('guardian_phone_number', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        رقم هاتف بديل
                                    </label>
                                    <input
                                        type="tel"
                                        value={ formData.alternative_phone_number }
                                        onChange={ (e) => handleChange('alternative_phone_number', e.target.value) }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    ) }

                </div>

                {/* Footer */ }
                <div className="border-t p-6 bg-gray-50">
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={ onClose }
                            disabled={ isUpdating }
                            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
                        >
                            إلغاء
                        </button>
                        <button
                            onClick={ handleSubmit }
                            disabled={ isUpdating }
                            className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                            { isUpdating ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    جاري الحفظ...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    حفظ التعديلات
                                </>
                            ) }
                        </button>
                    </div>
                </div>
            </div>

            {/* Add CSS for animations */ }
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
};

export default EditOrphanModal;