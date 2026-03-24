import React, { useState, useEffect } from 'react';
import {
    X,
    FileText,
    Image as ImageIcon,
    Calendar,
    Package,
    Home,
    Users,
    CheckCircle,
    XCircle,
    DollarSign,
    User,
    Clock,
    Tag,
    MapPin,
    Building
} from 'lucide-react';
import apiClient from '../../../utils/axiosConfig';

const ProjectDetailsModal = ({ isOpen, onClose, project }) => {
    const [notesImageUrl, setNotesImageUrl] = useState(null);
    const [alternativePaths, setAlternativePaths] = useState([]);
    const [currentPathIndex, setCurrentPathIndex] = useState(0);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        if (project && isOpen) {
            // 🔍 Debug: التحقق من البيانات القادمة من الـ Backend
            if (import.meta.env.DEV) {
                console.log('🔍 ProjectDetailsModal - Project data:', project);
                console.log('🔍 Notes fields check:', {
                    notes: project.notes,
                    notes_image: project.notes_image,
                    notes_image_url: project.notes_image_url,
                    has_notes: !!project.notes,
                    has_notes_image: !!project.notes_image,
                    has_notes_image_url: !!project.notes_image_url,
                });

                // التحقق من جميع الحقول المتعلقة بالملاحظات
                const notesRelatedKeys = Object.keys(project).filter(key =>
                    key.toLowerCase().includes('notes') ||
                    key.toLowerCase().includes('image')
                );
                console.log('🔍 Notes/Image related keys:', notesRelatedKeys);
                notesRelatedKeys.forEach(key => {
                    console.log(`   ${key}:`, project[key]);
                });
            }

            // محاولة الحصول على رابط الصورة من عدة مصادر
            const getImageUrl = () => {
                const baseURL = apiClient.defaults.baseURL || import.meta.env.VITE_API_URL || 'https://forms-api.saiid.org/api';
                const cleanBaseURL = baseURL.replace(/\/api$/, '');

                // 1. محاولة من notes_image_url
                if (project.notes_image_url) {
                    // ✅ إذا كان notes_image_url endpoint (يحتوي على /notes-image)، نحاول بناء URL مباشر أولاً
                    if (project.notes_image_url.includes('/notes-image')) {
                        // محاولة بناء URL مباشر من notes_image
                        if (project.notes_image) {
                            const directUrl = `${cleanBaseURL}/storage/${project.notes_image}`;
                            const endpointUrl = project.notes_image_url;
                            return {
                                url: directUrl,
                                alternatives: [endpointUrl]
                            };
                        }
                    }
                    return {
                        url: project.notes_image_url,
                        alternatives: []
                    };
                }

                // 2. محاولة من notes_image (إذا كان URL أو مسار)
                if (project.notes_image) {
                    if (typeof project.notes_image === 'string') {
                        // إذا كان URL كامل
                        if (project.notes_image.startsWith('http://') || project.notes_image.startsWith('https://')) {
                            return {
                                url: project.notes_image,
                                alternatives: []
                            };
                        }

                        // إذا كان مسار نسبي (يبدأ بـ /)
                        if (project.notes_image.startsWith('/')) {
                            return {
                                url: `${cleanBaseURL}${project.notes_image}`,
                                alternatives: []
                            };
                        }

                        // إذا كان مسار storage (مثل: project_notes_images/notes_xxx.jpg)
                        if (!project.notes_image.includes('://')) {
                            const possiblePaths = [
                                `${cleanBaseURL}/storage/${project.notes_image}`,
                                `${cleanBaseURL}/public/storage/${project.notes_image}`,
                                `${baseURL}/storage/${project.notes_image}`,
                                `${cleanBaseURL}/${project.notes_image}`,
                            ];

                            // ✅ إضافة endpoint منفصل كمسار بديل
                            if (project.id) {
                                possiblePaths.push(`${baseURL}/project-proposals/${project.id}/notes-image`);
                            }

                            return {
                                url: possiblePaths[0],
                                alternatives: possiblePaths.slice(1)
                            };
                        }
                    }
                }

                // 3. محاولة استخدام endpoint مباشر
                if (project.id) {
                    return {
                        url: `${baseURL}/project-proposals/${project.id}/notes-image`,
                        alternatives: []
                    };
                }

                return null;
            };

            const imageUrlData = getImageUrl();
            if (imageUrlData) {
                setNotesImageUrl(imageUrlData.url);
                setAlternativePaths(imageUrlData.alternatives || []);
                setCurrentPathIndex(0);
                setImageError(false);
                setImageLoading(true);
            } else {
                setNotesImageUrl(null);
                setAlternativePaths([]);
                setCurrentPathIndex(0);
                setImageError(false);
                setImageLoading(false);
            }
        }
    }, [project, isOpen]);

    if (!isOpen || !project) return null;

    const formatDate = (dateString) => {
        if (!dateString) return 'غير محدد';
        try {
            const date = new Date(dateString);
            // ✅ استخدام locale إنجليزي لضمان عرض التاريخ الميلادي
            return date.toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'غير محدد';
        try {
            const date = new Date(dateString);
            // ✅ استخدام locale إنجليزي لضمان عرض التاريخ الميلادي
            return date.toLocaleString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    };

    const formatCurrency = (amount, currency) => {
        if (!amount) return 'غير محدد';
        const formattedAmount = parseFloat(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        if (currency) {
            const symbol = currency.currency_symbol || currency.symbol || '';
            const code = currency.currency_code || currency.code || '';
            return `${formattedAmount} ${symbol || code}`;
        }
        return formattedAmount;
    };

    const handleImageError = (e) => {
        console.error('❌ Failed to load notes image from:', notesImageUrl);

        // إذا كانت هناك مسارات بديلة، جرب التالي
        if (alternativePaths.length > 0 && currentPathIndex < alternativePaths.length) {
            const nextIndex = currentPathIndex + 1;
            if (nextIndex < alternativePaths.length) {
                const nextUrl = alternativePaths[nextIndex];
                console.log(`🔄 Trying alternative path ${nextIndex + 1}/${alternativePaths.length}:`, nextUrl);
                setCurrentPathIndex(nextIndex);
                setNotesImageUrl(nextUrl);
                setImageError(false);
                return; // لا نخفي الصورة بعد، سنحاول المسار التالي
            }
        }

        // إذا لم تنجح أي محاولة
        setImageError(true);
        setImageLoading(false);
        if (e.target) {
            e.target.style.display = 'none';
        }
    };

    const handleImageLoad = () => {
        console.log('✅ Notes image loaded successfully from:', notesImageUrl);
        setImageLoading(false);
        setImageError(false);
    };

    // التحقق من وجود الحقول الاختيارية
    const hasDonorInfo = project.donor_name || project.donor_code;
    const hasFinancialInfo = project.donation_amount || project.net_amount || project.currency;
    const hasProjectType = project.project_type;
    const hasEstimatedDuration = project.estimated_duration_days;
    const hasDates = project.created_at || project.updated_at;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */ }
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-sky-50 to-orange-50 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-sky-400 to-orange-400 rounded-lg">
                            <Package className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-gray-800">تفاصيل المشروع</h3>
                            <p className="text-sm text-gray-600 mt-1">{ project.project_name || 'مشروع بدون اسم' }</p>
                        </div>
                    </div>
                    <button
                        onClick={ onClose }
                        className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */ }
                <div className="p-6 space-y-6">
                    {/* Header Section - Status and Type Badges */ }
                    <div className="flex flex-wrap items-center gap-3">
                        <span
                            className={ `px-4 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 ${project.status === 'مكتمل'
                                ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-700'
                                : 'bg-gradient-to-r from-red-100 to-red-200 text-red-700'
                                }` }
                        >
                            { project.status === 'مكتمل' ? (
                                <CheckCircle className="w-4 h-4" />
                            ) : (
                                <XCircle className="w-4 h-4" />
                            ) }
                            { project.status || 'غير مكتمل' }
                        </span>
                        { hasProjectType && (
                            <span className="px-4 py-2 bg-sky-100 text-sky-700 rounded-full text-sm font-medium inline-flex items-center gap-2">
                                <Tag className="w-4 h-4" />
                                { (() => {
                                  if (!project.project_type) return '---';
                                  if (typeof project.project_type === 'object' && project.project_type !== null) {
                                    return project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '---';
                                  }
                                  return project.project_type;
                                })() }
                            </span>
                        ) }
                    </div>

                    {/* Basic Information Section */ }
                    <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6 border-2 border-gray-200">
                        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Package className="w-5 h-5 text-sky-600" />
                            المعلومات الأساسية
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white rounded-xl p-4 border-2 border-sky-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Package className="w-4 h-4 text-sky-600" />
                                    <span className="text-sm font-semibold text-gray-600">اسم المشروع</span>
                                </div>
                                <p className="text-lg font-bold text-gray-800">{ project.project_name || 'غير محدد' }</p>
                            </div>

                            <div className="bg-white rounded-xl p-4 border-2 border-orange-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText className="w-4 h-4 text-orange-600" />
                                    <span className="text-sm font-semibold text-gray-600">نوع المساعدة</span>
                                </div>
                                <p className="text-lg font-bold text-gray-800">{ project.aid_type || 'غير محدد' }</p>
                            </div>

                            <div className="bg-white rounded-xl p-4 border-2 border-green-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Users className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-semibold text-gray-600">الكمية/العدد</span>
                                </div>
                                <p className="text-lg font-bold text-gray-800">{ project.quantity || 'غير محدد' }</p>
                            </div>

                            <div className="bg-white rounded-xl p-4 border-2 border-purple-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="w-4 h-4 text-purple-600" />
                                    <span className="text-sm font-semibold text-gray-600">تاريخ التنفيذ</span>
                                </div>
                                <p className="text-lg font-bold text-gray-800">{ formatDate(project.execution_date) }</p>
                            </div>

                            { hasEstimatedDuration && (
                                <div className="bg-white rounded-xl p-4 border-2 border-indigo-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-4 h-4 text-indigo-600" />
                                        <span className="text-sm font-semibold text-gray-600">المدة المقدرة (أيام)</span>
                                    </div>
                                    <p className="text-lg font-bold text-gray-800">{ project.estimated_duration_days } يوم</p>
                                </div>
                            ) }
                        </div>
                    </div>

                    {/* Donor Information Section */ }
                    { hasDonorInfo && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200">
                            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-600" />
                                معلومات المتبرع
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                { project.donor_name && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-blue-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User className="w-4 h-4 text-blue-600" />
                                            <span className="text-sm font-semibold text-gray-600">اسم المتبرع</span>
                                        </div>
                                        <p className="text-lg font-bold text-gray-800">{ project.donor_name }</p>
                                    </div>
                                ) }
                                { project.donor_code && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-indigo-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Tag className="w-4 h-4 text-indigo-600" />
                                            <span className="text-sm font-semibold text-gray-600">كود المتبرع</span>
                                        </div>
                                        <p className="text-lg font-bold text-gray-800">{ project.donor_code }</p>
                                    </div>
                                ) }
                            </div>
                        </div>
                    ) }

                    {/* Financial Information Section */ }
                    { hasFinancialInfo && (
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
                            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                المعلومات المالية
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                { project.donation_amount && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-green-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DollarSign className="w-4 h-4 text-green-600" />
                                            <span className="text-sm font-semibold text-gray-600">مبلغ التبرع</span>
                                        </div>
                                        <p className="text-lg font-bold text-gray-800">
                                            { formatCurrency(project.donation_amount, project.currency) }
                                        </p>
                                    </div>
                                ) }
                                { project.currency && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-emerald-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Tag className="w-4 h-4 text-emerald-600" />
                                            <span className="text-sm font-semibold text-gray-600">العملة</span>
                                        </div>
                                        <p className="text-lg font-bold text-gray-800">
                                            { project.currency.currency_name_ar || project.currency.name_ar || project.currency.currency_code || project.currency.code || 'غير محدد' }
                                        </p>
                                    </div>
                                ) }
                                { (project.discount_percentage || project.admin_discount_percentage) && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-amber-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DollarSign className="w-4 h-4 text-amber-600" />
                                            <span className="text-sm font-semibold text-gray-600">نسبة الخصم</span>
                                        </div>
                                        <p className="text-lg font-bold text-gray-800">
                                            { (project.discount_percentage || project.admin_discount_percentage) || 0 }%
                                        </p>
                                    </div>
                                ) }
                                { project.net_amount && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-teal-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DollarSign className="w-4 h-4 text-teal-600" />
                                            <span className="text-sm font-semibold text-gray-600">المبلغ الصافي</span>
                                        </div>
                                        <p className="text-lg font-bold text-gray-800">
                                            { formatCurrency(project.net_amount, project.currency) }
                                        </p>
                                    </div>
                                ) }
                            </div>
                        </div>
                    ) }

                    {/* Shelter Information Section */ }
                    { project.shelter && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200">
                            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Home className="w-5 h-5 text-blue-600" />
                                معلومات المخيم
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white rounded-xl p-4 border-2 border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Building className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-semibold text-gray-600">اسم المخيم</span>
                                    </div>
                                    <p className="text-lg font-bold text-gray-800">
                                        { project.shelter.camp_name || project.shelter.name || 'غير محدد' }
                                    </p>
                                </div>
                                { (project.shelter.governorate || project.shelter.district) && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-indigo-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MapPin className="w-4 h-4 text-indigo-600" />
                                            <span className="text-sm font-semibold text-gray-600">الموقع</span>
                                        </div>
                                        <p className="text-lg font-bold text-gray-800">
                                            { project.shelter.governorate || '' } { project.shelter.district ? `- ${project.shelter.district}` : '' }
                                        </p>
                                    </div>
                                ) }
                                { project.shelter.detailed_address && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-purple-100 md:col-span-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MapPin className="w-4 h-4 text-purple-600" />
                                            <span className="text-sm font-semibold text-gray-600">العنوان التفصيلي</span>
                                        </div>
                                        <p className="text-base font-medium text-gray-800">{ project.shelter.detailed_address }</p>
                                    </div>
                                ) }
                                { project.shelter.families_count !== undefined && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-green-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="w-4 h-4 text-green-600" />
                                            <span className="text-sm font-semibold text-gray-600">عدد الأسر</span>
                                        </div>
                                        <p className="text-lg font-bold text-gray-800">{ project.shelter.families_count } أسرة</p>
                                    </div>
                                ) }
                            </div>
                        </div>
                    ) }

                    {/* Dates Section */ }
                    { hasDates && (
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-purple-600" />
                                التواريخ
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                { project.created_at && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-purple-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar className="w-4 h-4 text-purple-600" />
                                            <span className="text-sm font-semibold text-gray-600">تاريخ الإنشاء</span>
                                        </div>
                                        <p className="text-base font-medium text-gray-800">{ formatDateTime(project.created_at) }</p>
                                    </div>
                                ) }
                                { project.updated_at && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-pink-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-4 h-4 text-pink-600" />
                                            <span className="text-sm font-semibold text-gray-600">تاريخ آخر تحديث</span>
                                        </div>
                                        <p className="text-base font-medium text-gray-800">{ formatDateTime(project.updated_at) }</p>
                                    </div>
                                ) }
                                { project.execution_date && (
                                    <div className="bg-white rounded-xl p-4 border-2 border-orange-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar className="w-4 h-4 text-orange-600" />
                                            <span className="text-sm font-semibold text-gray-600">تاريخ التنفيذ</span>
                                        </div>
                                        <p className="text-base font-medium text-gray-800">{ formatDate(project.execution_date) }</p>
                                    </div>
                                ) }
                            </div>
                        </div>
                    ) }

                    {/* Notes Section */ }
                    { project.notes && (
                        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-4 border-2 border-amber-200">
                            <div className="flex items-center gap-2 mb-3">
                                <FileText className="w-5 h-5 text-amber-600" />
                                <span className="text-lg font-bold text-gray-800">الملاحظات</span>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-4 border-2 border-amber-100">
                                { project.notes }
                            </p>
                        </div>
                    ) }

                    {/* Notes Image */ }
                    { notesImageUrl && !imageError && (
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border-2 border-indigo-200">
                            <div className="flex items-center gap-2 mb-3">
                                <ImageIcon className="w-5 h-5 text-indigo-600" />
                                <span className="text-lg font-bold text-gray-800">صورة الملاحظات</span>
                            </div>
                            <div className="relative bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                                { imageLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    </div>
                                ) }
                                <img
                                    src={ notesImageUrl }
                                    alt="صورة الملاحظات"
                                    className="w-full h-auto rounded-lg max-h-96 object-contain"
                                    onLoad={ handleImageLoad }
                                    onError={ handleImageError }
                                    style={ { display: imageLoading ? 'none' : 'block' } }
                                />
                            </div>
                        </div>
                    ) }

                    { imageError && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                            <p className="text-red-700 text-sm text-center">
                                ⚠️ تعذر تحميل صورة الملاحظات
                            </p>
                        </div>
                    ) }

                    {/* Empty State - No Notes or Image */ }
                    { !project.notes && !notesImageUrl && (
                        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center">
                            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500">لا توجد ملاحظات أو صور لهذا المشروع</p>
                        </div>
                    ) }
                </div>

                {/* Footer */ }
                <div className="flex items-center justify-end p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0">
                    <button
                        onClick={ onClose }
                        className="px-6 py-3 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-xl font-semibold transition-all duration-300 hover:from-sky-500 hover:to-sky-600 shadow-lg shadow-sky-200"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectDetailsModal;
