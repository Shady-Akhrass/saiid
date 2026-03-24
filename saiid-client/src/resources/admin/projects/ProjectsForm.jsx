import React, { useState, useEffect } from 'react';
import { Package, Calendar, CheckCircle, XCircle, AlertTriangle, X, Download, FileText } from 'lucide-react';
import ShelterSelect from './ShelterSelect';
import apiClient from '../../../utils/axiosConfig';

const ProjectsForm = ({ onSubmit, isLoading }) => {
    const [importMode, setImportMode] = useState('manual'); // 'manual' or 'import'
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [readyProjects, setReadyProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [formData, setFormData] = useState({
        project_name: '',
        aid_type: '',
        quantity: '',
        shelter_id: '',
        execution_date: '',
        status: 'غير مكتمل',
        source_project_id: null, // ID المشروع المصدر (من نظام إدارة المشاريع)
    });

    const [errors, setErrors] = useState({});
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [completedProjects, setCompletedProjects] = useState([]);
    const [isCheckingProjects, setIsCheckingProjects] = useState(false);

    const API_BASE = import.meta.env.VITE_API_URL || "https://forms-api.saiid.org/api";

    // جلب المشاريع الجاهزة للتنفيذ
    useEffect(() => {
        if (importMode === 'import') {
            fetchReadyProjects();
        }
    }, [importMode]);

    const fetchReadyProjects = async () => {
        try {
            setLoadingProjects(true);
            const response = await apiClient.get('/project-proposals', {
                params: {
                    status: 'جاهز للتنفيذ',
                    perPage: 100,
                    page: 1,
                    include_non_divided: true, // ✅ تضمين المشاريع غير المقسمة
                    include_daily_phases: true, // ✅ تضمين المشاريع اليومية
                },
            });

            if (response.data.success) {
                const projectsData = response.data.projects || response.data.data?.data || response.data.data || [];

                // ✅ جلب المشاريع المنفذة للتحقق من source_project_id
                let executedProjectsSourceIds = [];
                try {
                    const executedResponse = await apiClient.get('/projects', {
                        params: {
                            perPage: 1000, // جلب جميع المشاريع المنفذة
                            page: 1,
                        },
                    });

                    if (executedResponse.data.success) {
                        const executedProjects =
                            executedResponse.data.projects ||
                            executedResponse.data.data?.data ||
                            executedResponse.data.data ||
                            [];

                        // ✅ استخراج source_project_id من المشاريع المنفذة
                        executedProjectsSourceIds = executedProjects
                            .map(p => p.source_project_id)
                            .filter(id => id !== null && id !== undefined && id !== '');

                        if (import.meta.env.DEV) {
                            console.log('📋 Executed projects source IDs for form:', executedProjectsSourceIds);
                        }
                    }
                } catch (error) {
                    // تجاهل الأخطاء في جلب المشاريع المنفذة
                    if (import.meta.env.DEV) {
                        console.warn('⚠️ Failed to fetch executed projects for filtering:', error.message);
                    }
                }

                // ✅ فلترة المشاريع: إظهار جميع المشاريع بحالة "جاهز للتنفيذ" حتى لو تم تنفيذها سابقاً
                const filteredProjects = projectsData.map((project) => {
                    const projectId = project.id || project._id;

                    // ✅ تحديد إذا كان المشروع تم تنفيذه سابقاً
                    const isAlreadyExecuted = executedProjectsSourceIds.includes(projectId) ||
                        executedProjectsSourceIds.includes(String(projectId)) ||
                        executedProjectsSourceIds.includes(Number(projectId));

                    // ✅ إضافة علامة للمشاريع التي تم تنفيذها سابقاً
                    return {
                        ...project,
                        __isAlreadyExecuted: isAlreadyExecuted
                    };
                }).filter((project) => {
                    const status = project.status || '';

                    // ✅ القائمة تحتوي فقط على المشاريع في حالة "جاهز للتنفيذ"
                    // ✅ استبعاد جميع الحالات الأخرى (لتطابق قسم المشاريع الجاهزة للتنفيذ)
                    if (status !== 'جاهز للتنفيذ') {
                        if (import.meta.env.DEV) {
                            console.log('🚫 Excluding project from import dropdown (not ready for execution):', {
                                id: project.id,
                                name: project.project_name,
                                status: status
                            });
                        }
                        return false;
                    }

                    return true;
                });

                console.log('📋 Ready projects for import:', {
                    total: projectsData.length,
                    filtered: filteredProjects.length,
                    excluded: projectsData.length - filteredProjects.length,
                    divided: filteredProjects.filter(p => (p.is_divided_into_phases || p.isDividedIntoPhases) && !(p.is_daily_phase || p.isDailyPhase)).length,
                    nonDivided: filteredProjects.filter(p => !(p.is_divided_into_phases || p.isDividedIntoPhases) && !(p.is_daily_phase || p.isDailyPhase)).length,
                    dailyPhases: filteredProjects.filter(p => p.is_daily_phase || p.isDailyPhase).length,
                });

                // ✅ عرض المشاريع المفلترة فقط
                setReadyProjects(filteredProjects);
            }
        } catch (error) {
            console.error('Error fetching ready projects:', error);
            setReadyProjects([]);
        } finally {
            setLoadingProjects(false);
        }
    };

    // عند اختيار مشروع للاستيراد
    const handleProjectSelect = async (projectId) => {
        setSelectedProjectId(projectId);
        const selectedProject = readyProjects.find(p => p.id === parseInt(projectId, 10));

        if (selectedProject) {
            // ✅ تسجيل بيانات المشروع المختار للتحقق
            if (import.meta.env.DEV) {
                console.log('📋 Selected project data:', {
                    id: selectedProject.id,
                    name: selectedProject.project_name,
                    quantity: selectedProject.quantity,
                    project_quantity: selectedProject.project_quantity,
                    total_quantity: selectedProject.total_quantity,
                    allKeys: Object.keys(selectedProject)
                });
            }
            // ✅ محاولة جلب الكمية من عدة مصادر في بيانات المشروع الأساسية
            let projectQuantity =
                selectedProject.quantity ||
                selectedProject.project_quantity ||
                selectedProject.total_quantity ||
                null;

            // ✅ محاولة جلب الكمية من API إذا لم تكن موجودة في بيانات المشروع الأساسية
            // نبدأ بـ project-proposals (متاح لجميع الأدوار) ثم نحاول warehouse API
            if (projectQuantity === null || projectQuantity === undefined || projectQuantity === '' || projectQuantity === 0) {
                // أولاً: محاولة جلب تفاصيل المشروع من project-proposals (متاح لجميع الأدوار)
                try {
                    if (import.meta.env.DEV) {
                        console.log('🔍 Quantity not found in project data, trying project-proposals API:', selectedProject.id);
                    }

                    const projectDetailsResponse = await apiClient.get(`/project-proposals/${selectedProject.id}`);

                    if (import.meta.env.DEV) {
                        console.log('📥 Project Details API Response:', projectDetailsResponse.data);
                    }

                    if (projectDetailsResponse.data.success !== false) {
                        const projectData =
                            projectDetailsResponse.data.project ||
                            projectDetailsResponse.data.data ||
                            projectDetailsResponse.data;

                        // ✅ محاولة جلب الكمية من تفاصيل المشروع
                        const detailsQuantity =
                            projectData.quantity ||
                            projectData.project_quantity ||
                            projectData.total_quantity ||
                            null;

                        if (detailsQuantity !== null && detailsQuantity !== undefined && detailsQuantity !== '' && detailsQuantity !== 0) {
                            projectQuantity = detailsQuantity;
                            if (import.meta.env.DEV) {
                                console.log('✅ Found quantity from project-proposals API:', projectQuantity);
                            }
                        }
                    }
                } catch (projectDetailsError) {
                    // تجاهل خطأ جلب تفاصيل المشروع (قد لا يكون متاحاً)
                    if (import.meta.env.DEV && projectDetailsError.response?.status !== 403 && projectDetailsError.response?.status !== 404) {
                        console.warn('⚠️ Failed to fetch project details:', projectDetailsError.message);
                    }
                }

                // ✅ إذا لم نجد الكمية من project-proposals، نحاول warehouse API (قد يحتاج صلاحيات خاصة)
                if ((projectQuantity === null || projectQuantity === undefined || projectQuantity === '' || projectQuantity === 0)) {
                    try {
                        if (import.meta.env.DEV) {
                            console.log('🔍 Trying warehouse API for quantity:', selectedProject.id);
                        }

                        const warehouseResponse = await apiClient.get(`/projects/${selectedProject.id}/warehouse`);

                        if (import.meta.env.DEV) {
                            console.log('📥 Warehouse API Response:', warehouseResponse.data);
                        }

                        if (warehouseResponse.data.success) {
                            const data = warehouseResponse.data.data || warehouseResponse.data;
                            // ✅ محاولة جلب الكمية من عدة أماكن في الـ response
                            const apiQuantity =
                                data.project?.quantity ||
                                data.quantity ||
                                data.project_quantity ||
                                null;

                            if (apiQuantity !== null && apiQuantity !== undefined && apiQuantity !== '' && apiQuantity !== 0) {
                                projectQuantity = apiQuantity;
                                if (import.meta.env.DEV) {
                                    console.log('✅ Found quantity from warehouse API:', projectQuantity);
                                }
                            }
                        }
                    } catch (warehouseError) {
                        // ✅ تجاهل أخطاء 403 (Forbidden) و 404 (Not Found) - المستخدم ليس لديه صلاحيات أو المشروع غير موجود
                        if (warehouseError.response?.status === 403 || warehouseError.isPermissionError || warehouseError.shouldIgnore) {
                            // ✅ خطأ 403 متوقع - المستخدم قد لا يكون لديه صلاحيات admin
                            // ✅ لا نعرض أي رسالة خطأ للمستخدم
                            if (import.meta.env.DEV) {
                                console.log('ℹ️ Warehouse API requires admin permissions (403). Using project data quantity or leaving empty.');
                            }
                            // ✅ تجاهل الخطأ بصمت - لا نعرض toast أو console.error
                        } else if (warehouseError.response?.status === 404) {
                            // ✅ خطأ 404 متوقع - المشروع غير موجود في warehouse
                            if (import.meta.env.DEV) {
                                console.log('ℹ️ Project not found in warehouse (404). Using project data quantity or leaving empty.');
                            }
                        } else if (import.meta.env.DEV && !warehouseError.isConnectionError && !warehouseError.isTimeoutError && !warehouseError.silent) {
                            // ✅ عرض الأخطاء الأخرى فقط (ما عدا connection/timeout/silent)
                            console.warn('⚠️ Failed to fetch quantity from warehouse API:', warehouseError.message);
                        }
                        // ✅ لا نعرض toast للمستخدم - الخطأ متوقع وليس مشكلة
                    }
                }
            } else {
                if (import.meta.env.DEV) {
                    console.log('✅ Using quantity from project data:', projectQuantity);
                }
            }

            // ✅ إذا لم نجد الكمية في أي مكان، نتركها فارغة ليتمكن المستخدم من إدخالها يدوياً
            if (projectQuantity === null || projectQuantity === undefined || projectQuantity === '' || projectQuantity === 0) {
                projectQuantity = '';
                if (import.meta.env.DEV) {
                    console.log('ℹ️ No quantity found. User can enter it manually.');
                }
            }

            // ✅ عند الاستيراد: يأخذ النوع والكمية من المشروع، يضع الحالة "تم التنفيذ"، باقي البيانات يدوي
            setFormData(prev => ({
                ...prev,
                project_name: '', // فارغ للإدخال اليدوي
                aid_type: selectedProject.project_type || '', // يأخذ النوع فقط
                quantity: projectQuantity || '', // يأخذ الكمية من المشروع تلقائياً
                shelter_id: '', // فارغ للإدخال اليدوي
                execution_date: '', // فارغ للإدخال اليدوي
                status: 'تم التنفيذ', // ✅ يضع الحالة "تم التنفيذ" تلقائياً
                source_project_id: selectedProject.id, // حفظ معرف المشروع المصدر
            }));

            if (import.meta.env.DEV) {
                console.log('📋 Form data updated with quantity:', projectQuantity);
            }
        }
    };

    // عند تغيير وضع الإدخال
    const handleModeChange = (mode) => {
        setImportMode(mode);
        setSelectedProjectId('');
        if (mode === 'manual') {
            // إعادة تعيين الفورم
            setFormData({
                project_name: '',
                aid_type: '',
                quantity: '',
                shelter_id: '',
                execution_date: '',
                status: 'غير مكتمل',
                source_project_id: null,
            });
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleShelterChange = (e) => {
        handleChange(e);
        // التحقق من المشاريع المكتملة عند تغيير المخيم
        if (e.target.value) {
            checkCompletedProjects(e.target.value);
        } else {
            setCompletedProjects([]);
        }
    };

    // التحقق من المشاريع المكتملة للمخيم المختار
    const checkCompletedProjects = async (shelterId) => {
        if (!shelterId) {
            setCompletedProjects([]);
            return;
        }

        setIsCheckingProjects(true);
        try {
            // ✅ استخدام apiClient بدلاً من axios (لحل مشكلة CORS)
            const response = await apiClient.get('/projects', {
                params: {
                    per_page: 1000,  // ✅ استخدام per_page بدلاً من perPage
                    page: 1,
                    _t: Date.now(), // ✅ cache busting
                },
                headers: {
                    'Cache-Control': 'no-cache',
                },
                timeout: 30000, // timeout 30 ثانية
            });

            let projectsList = [];
            if (response.data) {
                if (Array.isArray(response.data.projects)) {
                    projectsList = response.data.projects;
                } else if (Array.isArray(response.data)) {
                    projectsList = response.data;
                }
            }

            // فلترة المشاريع المكتملة فقط للمخيم المحدد
            const completed = projectsList.filter(project => {
                const projectShelterId = project.shelter_id ||
                    project.shelter?.id ||
                    project.shelter?.manager_id_number;

                return project.status === 'مكتمل' &&
                    String(projectShelterId) === String(shelterId);
            });

            setCompletedProjects(completed);
        } catch (error) {
            console.error("Error checking completed projects:", error);
            // في حالة الخطأ، نعتبر أنه لا توجد مشاريع مكتملة
            setCompletedProjects([]);
        } finally {
            setIsCheckingProjects(false);
        }
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

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (validate()) {
            // التحقق من وجود مشاريع مكتملة قبل الإرسال
            if (completedProjects.length > 0) {
                setShowWarningModal(true);
            } else {
                onSubmit(formData);
            }
        }
    };

    const handleConfirmSubmit = () => {
        setShowWarningModal(false);
        onSubmit(formData);
    };

    const handleCancelSubmit = () => {
        setShowWarningModal(false);
    };

    return (
        <>
            <form onSubmit={ handleSubmit } className="space-y-6" dir="rtl">
                {/* Import Mode Selection */ }
                <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-2xl p-6 border-2 border-sky-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-sky-600" />
                        طريقة الإدخال
                    </h3>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={ () => handleModeChange('manual') }
                            className={ `flex-1 px-6 py-4 rounded-xl font-semibold transition-all ${importMode === 'manual'
                                ? 'bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-lg'
                                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-sky-300'
                                }` }
                        >
                            إدخال يدوي
                        </button>
                        <button
                            type="button"
                            onClick={ () => handleModeChange('import') }
                            className={ `flex-1 px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${importMode === 'import'
                                ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-lg'
                                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-orange-300'
                                }` }
                        >
                            <Download className="w-5 h-5" />
                            استيراد من مشروع موجود
                        </button>
                    </div>
                </div>

                {/* Project Selection (if import mode) */ }
                { importMode === 'import' && (
                    <div className="bg-white rounded-xl p-4 border-2 border-orange-200">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            اختر المشروع الجاهز للتنفيذ <span className="text-red-500">*</span>
                        </label>
                        { loadingProjects ? (
                            <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                                <span className="mr-2 text-gray-600">جاري تحميل المشاريع...</span>
                            </div>
                        ) : readyProjects.length === 0 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                                <p className="text-sm text-amber-700">
                                    لا توجد مشاريع جاهزة للتنفيذ حالياً. يرجى استخدام الإدخال اليدوي.
                                </p>
                            </div>
                        ) : (
                            <select
                                value={ selectedProjectId }
                                onChange={ (e) => handleProjectSelect(e.target.value) }
                                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl transition-all duration-300 focus:outline-none focus:border-orange-400 hover:border-orange-300"
                            >
                                <option value="">اختر مشروعاً من القائمة</option>
                                { readyProjects.map((project) => {
                                    // ✅ استخدام getProjectCode للحصول على الكود (donor_code أو internal_code)
                                    const projectCode = (() => {
                                        const donorCode = project?.donor_code;
                                        const internalCode = project?.internal_code;
                                        const donorCodeStr = donorCode ? String(donorCode).trim() : '';
                                        const internalCodeStr = internalCode ? String(internalCode).trim() : '';
                                        if (donorCodeStr) return donorCodeStr;
                                        if (internalCodeStr) return internalCodeStr;
                                        return '---';
                                    })();
                                    const projectName = project.project_name || project.donor_name || 'مشروع بدون اسم';
                                    const isAlreadyExecuted = project.__isAlreadyExecuted || false;

                                    // ✅ عرض: الكود - اسم المشروع فقط [⚠️ تم تنفيذه سابقاً]
                                    let displayText = `${projectCode} - ${projectName}`;

                                    if (isAlreadyExecuted) {
                                        displayText = `${displayText} [⚠️ تم تنفيذه سابقاً]`;
                                    }

                                    return (
                                        <option key={ project.id } value={ project.id }>
                                            { displayText }
                                        </option>
                                    );
                                }) }
                            </select>
                        ) }
                        { selectedProjectId && (
                            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                                <p className="text-sm text-green-700 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    تم استيراد نوع المشروع فقط. يرجى إدخال اسم المشروع وباقي البيانات يدوياً. الحالة تم تعيينها تلقائياً إلى "تم التنفيذ".
                                </p>
                            </div>
                        ) }
                    </div>
                ) }

                {/* Project Name */ }
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        اسم المشروع <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <Package className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            name="project_name"
                            value={ formData.project_name }
                            onChange={ handleChange }
                            placeholder="مثال: توزيع مواد غذائية"
                            className={ `w-full pr-10 pl-4 py-3 border-2 rounded-xl transition-all duration-300 focus:outline-none ${errors.project_name
                                ? 'bg-white border-red-300 focus:border-red-500'
                                : 'bg-white border-gray-200 focus:border-sky-400 hover:border-sky-300'
                                }` }
                        />
                    </div>
                    { errors.project_name && (
                        <p className="mt-1 text-sm text-red-600">{ errors.project_name }</p>
                    ) }
                </div>

                {/* Aid Type */ }
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        نوع المساعدة <span className="text-red-500">*</span>
                        { importMode === 'import' && formData.aid_type && (
                            <span className="text-xs text-green-600 font-normal mr-2">(مستورد تلقائياً)</span>
                        ) }
                    </label>
                    <input
                        type="text"
                        name="aid_type"
                        value={ formData.aid_type }
                        onChange={ handleChange }
                        placeholder="مثال: مواد غذائية، ملابس، أغطية"
                        readOnly={ importMode === 'import' && selectedProjectId }
                        className={ `w-full px-4 py-3 border-2 rounded-xl transition-all duration-300 focus:outline-none ${importMode === 'import' && selectedProjectId
                            ? 'bg-green-50 border-green-300 text-gray-700 cursor-not-allowed'
                            : errors.aid_type
                                ? 'bg-white border-red-300 focus:border-red-500'
                                : 'bg-white border-gray-200 focus:border-sky-400 hover:border-sky-300'
                            }` }
                    />
                    { errors.aid_type && (
                        <p className="mt-1 text-sm text-red-600">{ errors.aid_type }</p>
                    ) }
                </div>

                {/* Quantity */ }
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        الكمية/العدد <span className="text-red-500">*</span>
                        { formData.source_project_id && (
                            <span className="text-xs text-gray-500 font-normal mr-2">(تم جلبها من المشروع - يمكن التعديل)</span>
                        ) }
                    </label>
                    <input
                        type="number"
                        name="quantity"
                        value={ formData.quantity }
                        onChange={ handleChange }
                        min="1"
                        placeholder={ formData.source_project_id ? "تم جلبها من المشروع..." : "مثال: 500" }
                        className={ `w-full px-4 py-3 border-2 rounded-xl transition-all duration-300 focus:outline-none ${errors.quantity
                            ? 'bg-white border-red-300 focus:border-red-500'
                            : 'bg-white border-gray-200 focus:border-sky-400 hover:border-sky-300'
                            }` }
                    />
                    { formData.source_project_id && formData.quantity && (
                        <p className="mt-1 text-xs text-gray-500">✓ تم جلب العدد من المشروع المختار - يمكنك تعديله</p>
                    ) }
                    { errors.quantity && (
                        <p className="mt-1 text-sm text-red-600">{ errors.quantity }</p>
                    ) }
                </div>

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
                    <div className="relative">
                        <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="date"
                            name="execution_date"
                            value={ formData.execution_date }
                            onChange={ handleChange }
                            className={ `w-full pr-10 pl-4 py-3 bg-white border-2 rounded-xl transition-all duration-300 focus:outline-none ${errors.execution_date
                                ? 'border-red-300 focus:border-red-500'
                                : 'border-gray-200 focus:border-sky-400 hover:border-sky-300'
                                }` }
                        />
                    </div>
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

                {/* Warning Message if shelter has completed projects */ }
                { completedProjects.length > 0 && !isCheckingProjects && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-amber-800">
                                تحذير: هذا المخيم استفاد من قبل
                            </p>
                            <p className="text-xs text-amber-700 mt-1">
                                يوجد { completedProjects.length } مشروع مكتمل سابقاً لهذا المخيم. هل تريد المتابعة؟
                            </p>
                        </div>
                    </div>
                ) }

                {/* Submit Button */ }
                <button
                    type="submit"
                    disabled={ isLoading || isCheckingProjects }
                    className={ `w-full py-3 px-6 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-sky-200 ${isLoading || isCheckingProjects
                        ? 'opacity-75 cursor-not-allowed'
                        : 'hover:from-sky-500 hover:to-sky-600 hover:shadow-xl hover:shadow-sky-300 transform hover:scale-[1.02] active:scale-100'
                        }` }
                >
                    { isLoading ? 'جاري الإرسال...' : isCheckingProjects ? 'جاري التحقق...' : 'إضافة المشروع' }
                </button>
            </form>

            {/* Warning Modal */ }
            { showWarningModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-amber-100 rounded-full">
                                <AlertTriangle className="w-6 h-6 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-gray-800 mb-2">
                                    تحذير: المخيم استفاد من قبل
                                </h3>
                                <p className="text-gray-600 text-sm">
                                    هذا المخيم لديه { completedProjects.length } مشروع مكتمل سابقاً.
                                    هل أنت متأكد من رغبتك في إضافة مشروع جديد لهذا المخيم؟
                                </p>
                                { completedProjects.length > 0 && (
                                    <div className="mt-4 bg-gray-50 rounded-lg p-3">
                                        <p className="text-xs font-semibold text-gray-700 mb-2">المشاريع المكتملة السابقة:</p>
                                        <ul className="space-y-1">
                                            { completedProjects.slice(0, 3).map((project, idx) => (
                                                <li key={ idx } className="text-xs text-gray-600 flex items-center gap-2">
                                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                                    <span>{ project.project_name || 'مشروع غير محدد' }</span>
                                                </li>
                                            )) }
                                            { completedProjects.length > 3 && (
                                                <li className="text-xs text-gray-500">
                                                    + { completedProjects.length - 3 } مشروع آخر
                                                </li>
                                            ) }
                                        </ul>
                                    </div>
                                ) }
                            </div>
                            <button
                                onClick={ handleCancelSubmit }
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={ handleCancelSubmit }
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={ handleConfirmSubmit }
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-xl font-medium hover:from-amber-500 hover:to-amber-600 transition-all shadow-lg shadow-amber-200"
                            >
                                متابعة
                            </button>
                        </div>
                    </div>
                </div>
            ) }
        </>
    );
};

export default ProjectsForm;

