import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { X, Users, Camera, Home, Film, Search } from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';
import { getProjectCode } from '../../../utils/helpers';

// ✅ دالة للتحقق من أن المشروع هو مشروع كفالة أيتام
// ✅ تدعم قراءة project_type و subcategory من parent_project للمشاريع الفرعية
const isOrphanSponsorshipProject = (project) => {
    if (!project) return false;

    try {
        // ✅ للمشاريع الفرعية: قراءة project_type و subcategory من parent_project
        const parentProject = project.parent_project || project.parentProject || null;
        const hasParentProjectId = project.parent_project_id != null && project.parent_project_id !== undefined;
        const isSubProject = hasParentProjectId ||
            project.is_monthly_phase === true ||
            project.is_daily_phase === true ||
            project.month_number != null ||
            project.phase_day != null;

        // ✅ التحقق من project_type (من المشروع نفسه أو من parent_project)
        let projectType = '';
        if (typeof project.project_type === 'object' && project.project_type !== null) {
            projectType = project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '';
        } else if (project.project_type != null) {
            projectType = String(project.project_type);
        }

        // ✅ إذا كان المشروع فرعي ولم يكن له project_type، نقرأه من parent_project
        if ((!projectType || projectType.trim() === '') && isSubProject && parentProject) {
            if (typeof parentProject.project_type === 'object' && parentProject.project_type !== null) {
                projectType = parentProject.project_type.name_ar || parentProject.project_type.name || parentProject.project_type.name_en || '';
            } else if (parentProject.project_type != null) {
                projectType = String(parentProject.project_type);
            }
        }

        // ✅ التحقق من أن نوع المشروع هو "الكفالات" أو "كفالات" (أكثر مرونة)
        const projectTypeStr = (projectType || '').trim();
        const isSponsorshipType = projectTypeStr === 'الكفالات' ||
            projectTypeStr === 'كفالات' ||
            projectTypeStr.toLowerCase() === 'الكفالات' ||
            projectTypeStr.toLowerCase() === 'كفالات' ||
            projectTypeStr.includes('كفالات') ||
            projectTypeStr.includes('كفالة');

        // ✅ إذا كان المشروع شهري فرعي وله parent_project_id، نعتبره مشروع كفالة حتى لو لم نجد project_type
        if (!isSponsorshipType && isSubProject && (project.is_monthly_phase || project.month_number != null)) {
            if (parentProject) {
                let parentProjectType = '';
                if (typeof parentProject.project_type === 'object' && parentProject.project_type !== null) {
                    parentProjectType = parentProject.project_type.name_ar || parentProject.project_type.name || parentProject.project_type.name_en || '';
                } else if (parentProject.project_type != null) {
                    parentProjectType = String(parentProject.project_type);
                }
                const parentProjectTypeStr = (parentProjectType || '').trim();
                const isParentSponsorshipType = parentProjectTypeStr === 'الكفالات' ||
                    parentProjectTypeStr === 'كفالات' ||
                    parentProjectTypeStr.toLowerCase() === 'الكفالات' ||
                    parentProjectTypeStr.toLowerCase() === 'كفالات' ||
                    parentProjectTypeStr.includes('كفالات') ||
                    parentProjectTypeStr.includes('كفالة');

                if (isParentSponsorshipType) {
                    return true;
                }
            }
            return true;
        }

        if (!isSponsorshipType) {
            return false;
        }

        // ✅ التحقق من subcategory (من المشروع نفسه أو من parent_project)
        let subcategory = project.subcategory || {};

        if ((!subcategory || Object.keys(subcategory).length === 0) && isSubProject && parentProject) {
            subcategory = parentProject.subcategory || parentProject.sub_category || {};
        }

        let subcategoryNameAr = '';
        let subcategoryName = '';
        let subcategoryNameEn = '';

        if (subcategory.name_ar != null) {
            subcategoryNameAr = String(subcategory.name_ar).trim();
        }
        if (subcategory.name != null) {
            subcategoryName = String(subcategory.name).trim();
        }
        if (subcategory.name_en != null) {
            subcategoryNameEn = String(subcategory.name_en).trim();
        }

        const isOrphanSponsorship = subcategoryNameAr === 'كفالة أيتام' ||
            subcategoryName === 'Orphan Sponsorship' ||
            subcategoryNameEn === 'Orphan Sponsorship' ||
            subcategoryNameAr.includes('كفالة أيتام') ||
            subcategoryNameAr.includes('أيتام') ||
            (subcategoryName && subcategoryName.toLowerCase().includes('orphan sponsorship')) ||
            (subcategoryName && subcategoryName.toLowerCase().includes('orphan')) ||
            (subcategoryNameEn && subcategoryNameEn.toLowerCase().includes('orphan sponsorship')) ||
            (subcategoryNameEn && subcategoryNameEn.toLowerCase().includes('orphan'));

        return isSponsorshipType && isOrphanSponsorship;
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error('❌ Error in isOrphanSponsorshipProject:', error, {
                project: project?.id,
                parentProject: project?.parent_project?.id || project?.parentProject?.id,
            });
        }
        return false;
    }
};

// Modal إسناد المشروع للباحث
export const AssignProjectModal = ({ isOpen, onClose, projectId, project, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [researchers, setResearchers] = useState([]);
    const [selectedResearcherId, setSelectedResearcherId] = useState('');
    const [useDefaultResearcher, setUseDefaultResearcher] = useState(false);

    const isSponsorshipProject = isOrphanSponsorshipProject(project);

    useEffect(() => {
        if (isOpen) {
            fetchResearchers();
            // ✅ تحميل الباحث المسند حالياً إذا كان موجوداً
            if (project?.assigned_researcher_id) {
                setSelectedResearcherId(String(project.assigned_researcher_id));
                setUseDefaultResearcher(false);
            } else {
                setSelectedResearcherId('');
                // ✅ لمشاريع الكفالة: تفعيل الباحث الافتراضي تلقائياً
                setUseDefaultResearcher(isSponsorshipProject);
            }
        }
    }, [isOpen, project, isSponsorshipProject]);

    const fetchResearchers = async () => {
        try {
            const response = await apiClient.get('/team-personnel/available', {
                params: {
                    _t: Date.now(), // ✅ cache busting
                },
                headers: {
                    'Cache-Control': 'no-cache',
                }
            });
            if (response.data.success) {
                const researchersData = response.data.researchers || [];
                setResearchers(researchersData.filter((r) => r.is_active !== false));
            }
        } catch (error) {
            console.error('Error fetching researchers:', error);
            toast.error('فشل تحميل قائمة الباحثين');
        }
    };

    const handleClose = () => {
        setSelectedResearcherId('');
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // ✅ التحقق من أن الحالة مسموحة للإسناد
        const blockedStatuses = ['جديد', 'قيد التوريد', 'مؤجل', 'ملغى', 'منتهي'];
        if (project && blockedStatuses.includes(project.status)) {
            const errorMessages = {
                'جديد': 'لا يمكن إسناد الباحث - يجب أن تكون حالة المشروع "تم التوريد" أو ما بعدها',
                'قيد التوريد': 'لا يمكن إسناد الباحث - يجب أن تكون حالة المشروع "تم التوريد" أو ما بعدها',
                'مؤجل': 'لا يمكن إسناد الباحث - يجب استئناف المشروع أولاً',
                'ملغى': 'لا يمكن إسناد الباحث للمشاريع الملغاة',
                'منتهي': 'لا يمكن إسناد الباحث للمشاريع المنتهية'
            };
            toast.error(errorMessages[project.status] || 'لا يمكن إسناد الباحث لهذه الحالة');
            return;
        }

        // ✅ لمشاريع الكفالة: إذا كان useDefaultResearcher مفعّل، نرسل null
        // ✅ للمشاريع العادية: يجب اختيار باحث
        if (!isSponsorshipProject && !selectedResearcherId) {
            toast.error('الرجاء اختيار الباحث');
            return;
        }

        // ✅ لمشاريع الكفالة: إذا كان useDefaultResearcher مفعّل، نرسل null
        const researcherIdToSend = isSponsorshipProject && useDefaultResearcher
            ? null
            : (selectedResearcherId ? parseInt(selectedResearcherId, 10) : null);

        // ✅ التحقق من أن researcherIdToSend صحيح (integer أو null)
        if (researcherIdToSend !== null && (isNaN(researcherIdToSend) || researcherIdToSend <= 0)) {
            toast.error('معرف الباحث غير صحيح');
            return;
        }

        // ✅ التحقق من أن الباحث المختار مختلف عن الباحث الحالي (في حالة التعديل)
        const currentResearcherId = project?.assigned_researcher_id || project?.assigned_researcher?.id;
        if (currentResearcherId && selectedResearcherId && parseInt(selectedResearcherId, 10) === parseInt(String(currentResearcherId), 10)) {
            toast.info('الباحث المختار هو نفسه الباحث المسند حالياً. لا يوجد تغيير لتطبيقه.');
            return;
        }

        setLoading(true);
        try {
            // ✅ إرسال payload صحيح - integer أو null فقط
            const payload = {
                assigned_researcher_id: researcherIdToSend,
            };

            if (import.meta.env.DEV) {
                console.log('📤 Assigning researcher payload:', {
                    projectId,
                    payload,
                    researcherIdToSend,
                    isNull: researcherIdToSend === null,
                    type: typeof researcherIdToSend,
                });
            }

            const response = await apiClient.post(`/project-proposals/${projectId}/assign`, payload);

            if (response.data.success) {
                const isUpdate = currentResearcherId && selectedResearcherId && parseInt(selectedResearcherId, 10) !== parseInt(String(currentResearcherId), 10);
                toast.success(
                    isUpdate
                        ? (response.data.message || 'تم تعديل إسناد الباحث بنجاح')
                        : (response.data.message || 'تم إسناد المشروع للباحث بنجاح')
                );
                setSelectedResearcherId('');
                onSuccess?.();
                onClose();
            } else {
                toast.error(response.data.message || response.data.error || 'فشل إسناد المشروع');
            }
        } catch (error) {
            console.error('Error assigning researcher:', error);
            toast.error(error.response?.data?.message || error.response?.data?.error || 'حدث خطأ أثناء إسناد المشروع');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Users className="w-6 h-6 ml-2 text-purple-600" />
                        { project?.assigned_researcher_id
                            ? 'تعديل إسناد الباحث'
                            : 'إسناد المشروع للباحث'
                        } { getProjectCode(project, '') }
                    </h3>
                    <button onClick={ handleClose } className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* معلومات المشروع */ }
                { project && (
                    <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-4 mb-6 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">معلومات المشروع:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-gray-600">الوصف:</span>
                                <p className="font-medium text-gray-800">{ project.description || project.project_description || '-' }</p>
                            </div>
                            <div>
                                <span className="text-gray-600">الجهة المتبرعة:</span>
                                <p className="font-medium text-gray-800">{ project.donor_name || '-' }</p>
                            </div>
                            <div>
                                <span className="text-gray-600">النوع:</span>
                                <p className="font-medium text-gray-800">
                                    { (() => {
                                        if (!project.project_type) return '-';
                                        if (typeof project.project_type === 'object' && project.project_type !== null) {
                                            return project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '-';
                                        }
                                        return project.project_type;
                                    })() }
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-600">الحالة:</span>
                                <p className="font-medium text-gray-800">{ project.status || '-' }</p>
                            </div>
                        </div>
                    </div>
                ) }

                {/* ✅ معلومات الباحث المسند حالياً (إن وجد) */ }
                { project && project.assigned_researcher_id && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                        <p className="text-sm text-blue-800 font-semibold mb-2">
                            الباحث المسند حالياً:
                        </p>
                        <p className="text-sm text-blue-700">
                            { project.assigned_researcher?.name ||
                                project.researcher?.name ||
                                `الباحث #${project.assigned_researcher_id}` }
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                            يمكنك اختيار باحث آخر لتعديل الإسناد
                        </p>
                    </div>
                ) }


                {/* ✅ تحذير إذا كانت الحالة ممنوعة للإسناد */ }
                { project && ['جديد', 'قيد التوريد', 'مؤجل', 'ملغى', 'منتهي'].includes(project.status) && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                        <p className="text-sm text-red-800 font-semibold">
                            ❌ لا يمكن إسناد المشروع للباحث - الحالة الحالية غير مسموحة
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                            الحالة الحالية: { project.status }
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                            { project.status === 'جديد' || project.status === 'قيد التوريد' 
                                ? 'يجب تأكيد التوريد أولاً قبل إسناد المشروع للباحث'
                                : project.status === 'مؤجل'
                                ? 'يجب استئناف المشروع أولاً'
                                : project.status === 'ملغى'
                                ? 'لا يمكن إسناد الباحث للمشاريع الملغاة'
                                : 'لا يمكن إسناد الباحث للمشاريع المنتهية'
                            }
                        </p>
                    </div>
                ) }

                <form onSubmit={ handleSubmit } className="space-y-4">
                    {/* ✅ لمشاريع الكفالة: خيار الباحث الافتراضي */ }
                    { isSponsorshipProject && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={ useDefaultResearcher }
                                    onChange={ (e) => {
                                        setUseDefaultResearcher(e.target.checked);
                                        if (e.target.checked) {
                                            setSelectedResearcherId('');
                                        }
                                    } }
                                    className="ml-3 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    disabled={
                                        ['جديد', 'قيد التوريد', 'مؤجل', 'ملغى', 'منتهي'].includes(project?.status)
                                    }
                                />
                                <div>
                                    <p className="text-sm font-medium text-blue-800">
                                        استخدام الباحث الافتراضي (منسق الكفالة)
                                    </p>
                                    <p className="text-xs text-blue-700 mt-1">
                                        سيتم تعيين منسق الكفالة نفسه كباحث تلقائياً
                                    </p>
                                </div>
                            </label>
                        </div>
                    ) }

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Users className="w-4 h-4 ml-2 text-purple-600" />
                            { isSponsorshipProject ? 'اختر باحث (اختياري)' : 'اختر الباحث *' }
                        </label>
                        <select
                            value={ selectedResearcherId }
                            onChange={ (e) => {
                                setSelectedResearcherId(e.target.value);
                                if (e.target.value) {
                                    setUseDefaultResearcher(false);
                                }
                            } }
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            required={ !isSponsorshipProject }
                            disabled={
                                ['جديد', 'قيد التوريد', 'مؤجل', 'ملغى', 'منتهي'].includes(project?.status) ||
                                (isSponsorshipProject && useDefaultResearcher)
                            }
                        >
                            <option value="">{ isSponsorshipProject ? 'اختر باحث (اختياري)' : 'اختر الباحث' }</option>
                            { researchers.map((researcher) => (
                                <option key={ researcher.id } value={ researcher.id }>
                                    { researcher.name } { researcher.phone_number ? `- ${researcher.phone_number}` : '' }
                                    { researcher.department ? ` (${researcher.department})` : '' }
                                </option>
                            )) }
                        </select>
                        { researchers.length === 0 && (
                            <p className="text-sm text-orange-600 mt-2">
                                لا يوجد باحثين متاحين. يرجى إضافة باحثين أولاً.
                            </p>
                        ) }
                    </div>


                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={ handleClose }
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                            disabled={ loading }
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={
                                loading ||
                                (!isSponsorshipProject && !selectedResearcherId) ||
                                (isSponsorshipProject && !useDefaultResearcher && !selectedResearcherId) ||
                                ['جديد', 'قيد التوريد', 'مؤجل', 'ملغى', 'منتهي'].includes(project?.status)
                            }
                            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                        >
                            { loading
                                ? (project?.assigned_researcher_id ? 'جاري التعديل...' : 'جاري الإسناد...')
                                : (project?.assigned_researcher_id ? 'تعديل الإسناد' : 'إسناد الباحث')
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Modal إسناد المصور (Media Manager)
export const AssignPhotographerModal = ({ isOpen, onClose, projectId, project, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [photographers, setPhotographers] = useState([]);
    const [selectedPhotographerId, setSelectedPhotographerId] = useState('');
    const [fullProject, setFullProject] = useState(project); // ✅ بيانات المشروع الكاملة

    useEffect(() => {
        if (isOpen) {
            fetchPhotographers();
            // ✅ جلب بيانات المشروع الكاملة من الـ API إذا لم يكن assigned_researcher_id موجوداً
            if (!project?.assigned_researcher_id && !project?.assigned_researcher?.id) {
                fetchFullProject();
            } else {
                setFullProject(project);
            }

            // ✅ تحميل المصور المسند حالياً إذا كان موجوداً
            if (project?.assigned_photographer_id || project?.photographer?.id) {
                setSelectedPhotographerId(String(project.assigned_photographer_id || project.photographer.id));
            } else {
                setSelectedPhotographerId('');
            }
        }
    }, [isOpen, project]);

    // ✅ جلب بيانات المشروع الكاملة من الـ API
    const fetchFullProject = async () => {
        try {
            const response = await apiClient.get(`/project-proposals/${projectId}`);
            if (response.data.success && response.data.project) {
                setFullProject(response.data.project);
            } else if (response.data.success && response.data.data) {
                setFullProject(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching full project:', error);
            // ✅ إذا فشل، نستخدم البيانات المتوفرة
            setFullProject(project);
        }
    };

    const fetchPhotographers = async () => {
        try {
            const response = await apiClient.get('/team-personnel/available', {
                params: {
                    _t: Date.now(),
                },
                headers: {
                    'Cache-Control': 'no-cache',
                }
            });
            if (response.data.success) {
                const photographersData = response.data.photographers || [];
                setPhotographers(photographersData.filter((p) => p.is_active !== false));
            }
        } catch (error) {
            console.error('Error fetching photographers:', error);
            toast.error('فشل تحميل قائمة المصورين');
        }
    };

    const handleClose = () => {
        setSelectedPhotographerId('');
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // ✅ استخدام fullProject بدلاً من project
        const currentProject = fullProject || project;

        // ✅ التحقق من أن الحالة مسموحة لإسناد/إعادة إسناد المصور
        const allowedStatuses = ['مسند لباحث', 'جاهز للتنفيذ', 'قيد التنفيذ'];
        if (!allowedStatuses.includes(currentProject?.status)) {
            toast.error(`لا يمكن إسناد المصور - الحالة الحالية: ${currentProject?.status || 'غير محدد'}`);
            return;
        }

        // ✅ التحقق من وجود باحث مسند (مطلوب فقط للإسناد الأولي من "مسند لباحث")
        if (currentProject?.status === 'مسند لباحث' &&
            !currentProject?.assigned_researcher_id &&
            !currentProject?.assigned_researcher?.id) {
            toast.error('يجب أن يكون المشروع مسند للباحث أولاً - لا يوجد باحث مسند لهذا المشروع');
            if (import.meta.env.DEV) {
                console.error('Project missing assigned_researcher:', {
                    projectId,
                    status: currentProject?.status,
                    assigned_researcher_id: currentProject?.assigned_researcher_id,
                    assigned_researcher: currentProject?.assigned_researcher,
                });
            }
            return;
        }

        if (!selectedPhotographerId) {
            toast.error('الرجاء اختيار المصور');
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.post(`/project-proposals/${projectId}/assign-photographer`, {
                assigned_photographer_id: parseInt(selectedPhotographerId),
            });

            if (response.data.success) {
                // ✅ عرض رسالة مناسبة حسب الحالة
                if (response.data.is_reassignment) {
                    toast.success(response.data.message || 'تم إعادة إسناد المصور بنجاح - الحالة لم تتغير');
                } else if (response.data.status_changed) {
                    toast.success(response.data.message || 'تم إسناد المصور بنجاح - المشروع جاهز للتنفيذ');
                } else {
                    toast.success(response.data.message || 'تم إسناد المصور بنجاح');
                }
                setSelectedPhotographerId('');
                onSuccess?.();
                onClose();
            } else {
                toast.error(response.data.message || response.data.error || 'فشل إسناد المصور');
            }
        } catch (error) {
            console.error('Error assigning photographer:', error);
            toast.error(error.response?.data?.message || error.response?.data?.error || 'حدث خطأ أثناء إسناد المصور');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Camera className="w-6 h-6 ml-2 text-orange-600" />
                        { ((fullProject || project)?.assigned_photographer_id || (fullProject || project)?.photographer?.id)
                            ? 'إعادة إسناد المصور للمشروع'
                            : 'إسناد المصور للمشروع' } { (fullProject || project)?.donor_code || (fullProject || project)?.internal_code ? ((fullProject || project).donor_code || (fullProject || project).internal_code) : '' }
                    </h3>
                    <button onClick={ handleClose } className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* معلومات المشروع */ }
                { (fullProject || project) && (
                    <div className="bg-gradient-to-br from-gray-50 to-orange-50 rounded-xl p-4 mb-6 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">معلومات المشروع:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-gray-600">الوصف:</span>
                                <p className="font-medium text-gray-800">{ (fullProject || project).description || (fullProject || project).project_description || '-' }</p>
                            </div>
                            <div>
                                <span className="text-gray-600">الجهة المتبرعة:</span>
                                <p className="font-medium text-gray-800">{ (fullProject || project).donor_name || '-' }</p>
                            </div>
                            <div>
                                <span className="text-gray-600">الباحث المسند:</span>
                                <p className="font-medium text-gray-800">
                                    { (fullProject || project).assigned_researcher?.name ||
                                        (fullProject || project).assigned_researcher_id ||
                                        '-' }
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-600">الحالة:</span>
                                <p className="font-medium text-gray-800">{ (fullProject || project).status || '-' }</p>
                            </div>
                        </div>
                    </div>
                ) }

                {/* ✅ تحذير إذا لم تكن الحالة مسموحة أو لا يوجد باحث مسند (للحالة "مسند لباحث" فقط) */ }
                { (fullProject || project) && (
                    <>
                        { !['مسند لباحث', 'جاهز للتنفيذ', 'قيد التنفيذ'].includes((fullProject || project).status) && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                                <p className="text-sm text-yellow-800 font-semibold">
                                    ⚠️ لا يمكن إسناد المصور في هذه الحالة
                                </p>
                                <p className="text-xs text-yellow-700 mt-1">
                                    الحالة الحالية: { (fullProject || project).status }
                                </p>
                                <p className="text-xs text-yellow-700 mt-1">
                                    الحالات المسموحة: مسند لباحث، جاهز للتنفيذ، قيد التنفيذ
                                </p>
                            </div>
                        ) }
                        { (fullProject || project).status === 'مسند لباحث' &&
                            !(fullProject || project).assigned_researcher_id &&
                            !(fullProject || project).assigned_researcher?.id && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-red-800 font-semibold">
                                        ❌ لا يوجد باحث مسند لهذا المشروع
                                    </p>
                                    <p className="text-xs text-red-700 mt-1">
                                        يجب إسناد باحث للمشروع أولاً قبل إسناد المصور
                                    </p>
                                </div>
                            ) }
                    </>
                ) }

                <form onSubmit={ handleSubmit } className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Camera className="w-4 h-4 ml-2 text-orange-600" />
                            اختر المصور *
                        </label>
                        <select
                            value={ selectedPhotographerId }
                            onChange={ (e) => setSelectedPhotographerId(e.target.value) }
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            required
                            disabled={ !['مسند لباحث', 'جاهز للتنفيذ', 'قيد التنفيذ'].includes((fullProject || project)?.status) ||
                                ((fullProject || project)?.status === 'مسند لباحث' &&
                                    !(fullProject || project)?.assigned_researcher_id &&
                                    !(fullProject || project)?.assigned_researcher?.id) }
                        >
                            <option value="">اختر المصور</option>
                            { photographers.map((photographer) => (
                                <option key={ photographer.id } value={ photographer.id }>
                                    { photographer.name } { photographer.phone_number ? `- ${photographer.phone_number}` : '' }
                                    { photographer.department ? ` (${photographer.department})` : '' }
                                </option>
                            )) }
                        </select>
                        { photographers.length === 0 && (
                            <p className="text-sm text-orange-600 mt-2">
                                لا يوجد مصورين متاحين. يرجى إضافة مصورين أولاً.
                            </p>
                        ) }
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={ handleClose }
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                            disabled={ loading }
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={ loading || !selectedPhotographerId ||
                                !['مسند لباحث', 'جاهز للتنفيذ', 'قيد التنفيذ'].includes((fullProject || project)?.status) ||
                                ((fullProject || project)?.status === 'مسند لباحث' &&
                                    !(fullProject || project)?.assigned_researcher_id &&
                                    !(fullProject || project)?.assigned_researcher?.id) }
                            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                        >
                            { loading
                                ? 'جاري الإسناد...'
                                : ((fullProject || project)?.assigned_photographer_id || (fullProject || project)?.photographer?.id)
                                    ? 'إعادة إسناد المصور'
                                    : 'إسناد المصور' }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/**
 * مودال إسناد مصور لعدة مشاريع دفعة واحدة (مدير الإعلام - المشاريع الجديدة)
 */
export const BulkAssignPhotographerModal = ({
    isOpen,
    onClose,
    projectIds = [],
    projects = [],
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);
    const [photographers, setPhotographers] = useState([]);
    const [selectedPhotographerId, setSelectedPhotographerId] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchPhotographers();
            setSelectedPhotographerId('');
        }
    }, [isOpen]);

    const fetchPhotographers = async () => {
        try {
            const response = await apiClient.get('/team-personnel/available', {
                params: { _t: Date.now() },
                headers: { 'Cache-Control': 'no-cache' },
            });
            if (response.data.success) {
                const photographersData = response.data.photographers || [];
                setPhotographers(photographersData.filter((p) => p.is_active !== false));
            }
        } catch (error) {
            console.error('Error fetching photographers:', error);
            toast.error('فشل تحميل قائمة المصورين');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPhotographerId || projectIds.length === 0) {
            toast.error('اختر المصور وتأكد من وجود مشاريع محددة');
            return;
        }

        setLoading(true);
        const photographerId = parseInt(selectedPhotographerId, 10);
        let successCount = 0;
        let failCount = 0;

        for (const projectId of projectIds) {
            try {
                const res = await apiClient.post(`/project-proposals/${projectId}/assign-photographer`, {
                    assigned_photographer_id: photographerId,
                });
                if (res.data?.success) successCount++;
                else failCount++;
            } catch {
                failCount++;
            }
        }

        setLoading(false);
        if (failCount === 0) {
            toast.success(`تم إسناد المصور لـ ${successCount} مشروع بنجاح`);
        } else {
            toast.warning(`تم إسناد ${successCount} مشروع، وفشل ${failCount}`);
        }
        onSuccess?.();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Camera className="w-5 h-5 text-orange-600" />
                        إسناد مصور لـ { projectIds.length } مشروع
                    </h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">اختر المصور *</label>
                        <select
                            value={selectedPhotographerId}
                            onChange={(e) => setSelectedPhotographerId(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                            required
                            disabled={loading}
                        >
                            <option value="">اختر المصور</option>
                            {photographers.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {p.phone_number ? `- ${p.phone_number}` : ''}
                                </option>
                            ))}
                        </select>
                        {photographers.length === 0 && (
                            <p className="text-sm text-orange-600 mt-2">لا يوجد مصورين متاحين</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                            disabled={loading}
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedPhotographerId}
                            className="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50"
                        >
                            {loading ? 'جاري الإسناد...' : `إسناد لـ ${projectIds.length} مشروع`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Modal اختيار المخيم
export const SelectShelterModal = ({ isOpen, onClose, projectId, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [allShelters, setAllShelters] = useState([]); // ✅ جميع المخيمات من API
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedShelterId, setSelectedShelterId] = useState('');

    // ✅ استخدام debounce للبحث لتجنب إرسال طلبات كثيرة
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // ✅ فلترة المخيمات حسب البحث (في Frontend فقط - لا نرسل طلبات API عند كل تغيير)
    const shelters = useMemo(() => {
        if (!debouncedSearchQuery.trim()) {
            return allShelters;
        }

        const query = debouncedSearchQuery.toLowerCase().trim();
        return allShelters.filter(shelter => {
            const campName = (shelter.camp_name || shelter.name || shelter.shelter_name || '').toLowerCase();
            const governorate = (shelter.governorate || shelter.province || '').toLowerCase();
            const district = (shelter.district || shelter.area || '').toLowerCase();
            const managerName = (shelter.manager_name || '').toLowerCase();

            return campName.includes(query) ||
                governorate.includes(query) ||
                district.includes(query) ||
                managerName.includes(query);
        });
    }, [allShelters, debouncedSearchQuery]);

    // ✅ جلب المخيمات فقط عند فتح الـ Modal (لا نرسل طلبات عند كل تغيير في البحث)
    useEffect(() => {
        if (isOpen) {
            fetchShelters();
        }
    }, [isOpen]); // ✅ إزالة searchQuery من dependencies

    const fetchShelters = async () => {
        try {
            setLoading(true);
            // ✅ جلب جميع المخيمات النشطة (بدون بحث) - البحث يتم في Frontend
            const response = await apiClient.get('/shelters/list', {
                params: {
                    perPage: 1000, // ✅ جلب عدد كبير من المخيمات للبحث المحلي
                },
            });
            if (response.data.success) {
                // ✅ فلترة المخيمات النشطة فقط
                const activeShelters = response.data.data?.filter((s) => s.is_active) || [];
                setAllShelters(activeShelters);

                if (import.meta.env.DEV) {
                    console.log('✅ Fetched shelters:', {
                        total: response.data.data?.length || 0,
                        active: activeShelters.length,
                        searchQuery,
                    });
                }
            } else {
                setAllShelters([]);
            }
        } catch (error) {
            console.error('Error fetching shelters:', error);
            toast.error('فشل تحميل المخيمات');
            setAllShelters([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedShelterId) {
            toast.error('الرجاء اختيار المخيم');
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.post(`/project-proposals/${projectId}/select-shelter`, {
                shelter_id: parseInt(selectedShelterId),
            });

            if (response.data.success) {
                toast.success('تم اختيار المخيم بنجاح');
                onSuccess?.();
                onClose();
            } else {
                toast.error(response.data.message || 'فشل اختيار المخيم');
            }
        } catch (error) {
            console.error('Error selecting shelter:', error);
            toast.error(error.userMessage || 'حدث خطأ أثناء اختيار المخيم');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Home className="w-6 h-6 ml-2 text-blue-600" />
                        اختيار المخيم
                    </h3>
                    <button onClick={ onClose } className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={ handleSubmit } className="space-y-4">
                    {/* Search */ }
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="بحث عن المخيم..."
                            value={ searchQuery }
                            onChange={ (e) => setSearchQuery(e.target.value) }
                            className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>

                    {/* Shelters List */ }
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        { shelters.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">لا توجد مخيمات</p>
                        ) : (
                            shelters.map((shelter) => (
                                <label
                                    key={ shelter.id }
                                    className={ `block p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedShelterId === shelter.id.toString()
                                        ? 'border-sky-500 bg-sky-50'
                                        : 'border-gray-200 hover:border-sky-300'
                                        }` }
                                >
                                    <input
                                        type="radio"
                                        name="shelter"
                                        value={ shelter.id }
                                        checked={ selectedShelterId === shelter.id.toString() }
                                        onChange={ (e) => setSelectedShelterId(e.target.value) }
                                        className="ml-2"
                                    />
                                    <div className="inline-block">
                                        <p className="font-bold text-gray-800">
                                            { shelter.camp_name || shelter.name || shelter.shelter_name || 'مخيم بدون اسم' }
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            { shelter.governorate || shelter.province || '' } { shelter.district || shelter.area ? ' - ' : '' } { shelter.district || shelter.area || '' }
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            عدد العائلات: { shelter.families_count || shelter.familiesCount || 0 }
                                        </p>
                                    </div>
                                </label>
                            ))
                        ) }
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={ onClose }
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                            disabled={ loading }
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={ loading || !selectedShelterId }
                            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                        >
                            { loading ? 'جاري الحفظ...' : 'اختيار المخيم' }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Modal تحديث حالة المونتاج
export const UpdateMediaStatusModal = ({ isOpen, onClose, projectId, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        status: '',
        notes: '',
    });

    const MEDIA_STATUSES = ['في المونتاج', 'تم المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.status) {
            toast.error('الرجاء اختيار الحالة');
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.post(
                `/project-proposals/${projectId}/update-media-status`,
                formData
            );

            if (response.data.success) {
                toast.success('تم تحديث حالة المونتاج بنجاح');
                onSuccess?.();
                onClose();
            } else {
                toast.error(response.data.message || 'فشل تحديث الحالة');
            }
        } catch (error) {
            console.error('Error updating media status:', error);
            toast.error(error.userMessage || 'حدث خطأ أثناء تحديث الحالة');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Film className="w-6 h-6 ml-2 text-purple-600" />
                        تحديث حالة المونتاج
                    </h3>
                    <button onClick={ onClose } className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={ handleSubmit } className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">الحالة الجديدة *</label>
                        <select
                            value={ formData.status }
                            onChange={ (e) => setFormData({ ...formData, status: e.target.value }) }
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            required
                        >
                            <option value="">اختر الحالة</option>
                            { MEDIA_STATUSES.map((status) => (
                                <option key={ status } value={ status }>
                                    { status }
                                </option>
                            )) }
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            ملاحظات (اختياري)
                        </label>
                        <textarea
                            value={ formData.notes }
                            onChange={ (e) => setFormData({ ...formData, notes: e.target.value }) }
                            placeholder="أضف أي ملاحظات..."
                            rows="4"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={ onClose }
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                            disabled={ loading }
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={ loading }
                            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                        >
                            { loading ? 'جاري الحفظ...' : 'تحديث الحالة' }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
