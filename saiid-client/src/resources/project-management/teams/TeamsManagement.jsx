import React, { useState, useEffect } from 'react';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { Plus, Users, Edit, Trash2, UserPlus, UserMinus, X, Crown, Camera, Search } from 'lucide-react';

const TeamsManagement = () => {
    const [loading, setLoading] = useState(false);
    const [teams, setTeams] = useState([]);
    const [researchers, setResearchers] = useState([]);
    const [photographers, setPhotographers] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showAddResearcherModal, setShowAddResearcherModal] = useState(false);
    const [showAddPhotographerModal, setShowAddPhotographerModal] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);

    useEffect(() => {
        fetchTeams(false); // ✅ جلب عادي عند التحميل الأول
        fetchAvailableMembers();
        
        // ✅ الاستماع لحدث team-created لإعادة جلب البيانات
        const handleTeamCreated = () => {
            fetchTeams(true);
        };
        
        window.addEventListener('team-created', handleTeamCreated);
        
        return () => {
            window.removeEventListener('team-created', handleTeamCreated);
        };
    }, []);

    const fetchTeams = async (forceRefresh = false) => {
        try {
            setLoading(true);
            
            // ✅ إبطال الكاش إذا كان forceRefresh
            if (forceRefresh) {
                try {
                    localStorage.removeItem('cache_teams');
                    localStorage.removeItem('teams_cache');
                    window.dispatchEvent(new CustomEvent('cache-invalidated', {
                        detail: { cacheKey: 'teams' }
                    }));
                } catch (error) {
                    console.warn('Error invalidating teams cache:', error);
                }
            }

            // ✅ cache busting وإجبار Backend على جلب البيانات المحدثة
            const response = await apiClient.get('/teams', {
                params: {
                    _t: Date.now(), // ✅ cache busting
                },
                headers: {
                    'Cache-Control': 'no-cache', // ✅ منع cache في الـ request
                },
                timeout: 30000, // 30 ثانية
            });

            if (response.data.success) {
                const teamsData =
                    response.data.teams ||
                    response.data.data ||
                    response.data.results ||
                    [];
                setTeams(Array.isArray(teamsData) ? teamsData : []);
                
                if (import.meta.env.DEV && forceRefresh) {
                    console.log('✅ Teams refreshed successfully:', teamsData.length);
                }
            } else {
                toast.warning(response.data.message || 'لم يتم العثور على بيانات للفرق');
                setTeams([]);
            }
        } catch (error) {
            console.error('Error fetching teams:', error);
            toast.error(error.userMessage || 'فشل تحميل الفرق');
            setTeams([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableMembers = async () => {
        try {
            // ✅ استخدام API الجديد مع cache busting
            const response = await apiClient.get('/team-personnel/available', {
                params: {
                    _t: Date.now(), // ✅ cache busting
                },
                headers: {
                    'Cache-Control': 'no-cache',
                }
            });
            if (response.data.success) {
                setResearchers(response.data.researchers || []);
                setPhotographers(response.data.photographers || []);
            }
        } catch (error) {
            console.error('Error fetching available members:', error);
            setResearchers([]);
            setPhotographers([]);
        }
    };

    const handleViewMembers = (team) => {
        setSelectedTeam(team);
        setShowMembersModal(true);
    };

    // if (loading) {
    //     return (
    //         <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
    //             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
    //         </div>
    //     );
    // }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */ }
                <div className="bg-white/80 border border-white rounded-3xl p-6 shadow-lg shadow-blue-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-sm text-sky-500 font-semibold mb-1">لوحة إدارة الفرق</p>
                        <h1 className="text-3xl font-black text-slate-900">إدارة الفرق</h1>
                        <p className="text-gray-500 mt-1">يمكنك إنشاء فريق جديد أو مراجعة الأعضاء الحاليين.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-sky-50 text-sky-700 px-4 py-2 rounded-2xl font-semibold">
                            إجمالي الفرق: { teams.length }
                        </div>
                        <button
                            onClick={ () => setShowCreateModal(true) }
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-blue-200 hover:opacity-95 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            إنشاء فريق جديد
                        </button>
                    </div>
                </div>

                {/* Add Members Section */ }
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-purple-50 border border-white">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">إضافة أعضاء للفرق</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={ () => setShowAddPhotographerModal(true) }
                            className="group rounded-3xl bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-5 flex items-center justify-between shadow-lg shadow-purple-200 hover:translate-y-0.5 transition-all"
                        >
                            <div className="text-right">
                                <p className="font-black text-lg">إضافة مصور جديد</p>
                                <p className="text-sm opacity-90">(Photographer) مصور</p>
                            </div>
                            <div className="bg-white/20 p-3 rounded-2xl">
                                <Camera className="w-7 h-7" />
                            </div>
                        </button>
                        <button
                            onClick={ () => setShowAddResearcherModal(true) }
                            className="group rounded-3xl bg-gradient-to-r from-sky-500 to-blue-600 text-white px-6 py-5 flex items-center justify-between shadow-lg shadow-blue-200 hover:translate-y-0.5 transition-all"
                        >
                            <div className="text-right">
                                <p className="font-black text-lg">إضافة باحث جديد</p>
                                <p className="text-sm opacity-90">(Executor) منفذ</p>
                            </div>
                            <div className="bg-white/20 p-3 rounded-2xl">
                                <Users className="w-7 h-7" />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Researchers and Photographers Tables */ }
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Researchers Table */ }
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex items-center justify-between">
                            <div className="flex items-center">
                                <Users className="w-6 h-6 text-white ml-2" />
                                <h3 className="text-xl font-bold text-white">الباحثين</h3>
                            </div>
                            <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium">
                                { researchers.length }
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">الاسم</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">رقم الهاتف</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">القسم</th>
                                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    { researchers.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-8 text-gray-500">
                                                <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                                <p>لا يوجد باحثين</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        researchers.map((researcher) => (
                                            <tr key={ researcher.id } className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                <td className="py-3 px-4 text-sm font-medium text-gray-800">
                                                    { researcher.name }
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-700">
                                                    { researcher.phone_number || '-' }
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-700">
                                                    { researcher.department || '-' }
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span
                                                        className={ `inline-block px-3 py-1 rounded-full text-xs font-medium ${researcher.is_active
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                            }` }
                                                    >
                                                        { researcher.is_active ? 'نشط' : 'معطل' }
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) }
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Photographers Table */ }
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 flex items-center justify-between">
                            <div className="flex items-center">
                                <Camera className="w-6 h-6 text-white ml-2" />
                                <h3 className="text-xl font-bold text-white">المصورين</h3>
                            </div>
                            <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium">
                                { photographers.length }
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">الاسم</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">رقم الهاتف</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">القسم</th>
                                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    { photographers.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-8 text-gray-500">
                                                <Camera className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                                <p>لا يوجد مصورين</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        photographers.map((photographer) => (
                                            <tr key={ photographer.id } className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                <td className="py-3 px-4 text-sm font-medium text-gray-800">
                                                    { photographer.name }
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-700">
                                                    { photographer.phone_number || '-' }
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-700">
                                                    { photographer.department || '-' }
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span
                                                        className={ `inline-block px-3 py-1 rounded-full text-xs font-medium ${photographer.is_active
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                            }` }
                                                    >
                                                        { photographer.is_active ? 'نشط' : 'معطل' }
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Teams Grid */ }
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-blue-50 border border-white">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">الفرق الحالية</h2>
                            <p className="text-sm text-gray-500">تابع حالة كل فريق وعدد الباحثين والمصورين.</p>
                        </div>
                        <span className="text-sm px-4 py-2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                            { teams.length } فريق
                        </span>
                    </div>
                    { teams.length === 0 ? (
                        <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-200 rounded-2xl">
                            <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                            لا يوجد أي فرق حتى الآن. ابدأ بإنشاء فريق جديد.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            { teams.map((team) => (
                                <TeamCard
                                    key={ team.id }
                                    team={ team }
                                    onViewMembers={ () => handleViewMembers(team) }
                                    onRefresh={ () => fetchTeams(true) }
                                />
                            )) }
                        </div>
                    ) }
                </div>

                {/* Create Team Modal */ }
                { showCreateModal && (
                    <CreateTeamModal
                        isOpen={ showCreateModal }
                        onClose={ () => setShowCreateModal(false) }
                        researchers={ researchers }
                        photographers={ photographers }
                        onSuccess={ () => {
                            fetchTeams(true); // ✅ force refresh مع cache busting
                            setShowCreateModal(false);
                        } }
                    />
                ) }

                {/* Team Members Modal */ }
                { showMembersModal && selectedTeam && (
                    <TeamMembersModal
                        isOpen={ showMembersModal }
                        onClose={ () => setShowMembersModal(false) }
                        team={ selectedTeam }
                        researchers={ researchers }
                        photographers={ photographers }
                        onSuccess={ () => {
                            fetchTeams(true); // ✅ force refresh مع cache busting
                            fetchAvailableMembers();
                        } }
                    />
                ) }

                {/* Add Researcher Modal */ }
                { showAddResearcherModal && (
                    <AddMemberModal
                        isOpen={ showAddResearcherModal }
                        onClose={ () => setShowAddResearcherModal(false) }
                        memberType="باحث"
                        endpoint="/researchers"
                        onSuccess={ () => {
                            fetchAvailableMembers();
                            setShowAddResearcherModal(false);
                        } }
                    />
                ) }

                {/* Add Photographer Modal */ }
                { showAddPhotographerModal && (
                    <AddMemberModal
                        isOpen={ showAddPhotographerModal }
                        onClose={ () => setShowAddPhotographerModal(false) }
                        memberType="مصور"
                        endpoint="/photographers-management"
                        onSuccess={ () => {
                            fetchAvailableMembers();
                            setShowAddPhotographerModal(false);
                        } }
                    />
                ) }
            </div>
        </div>
    );
};

// Team Card Component
const TeamCard = ({ team, onViewMembers, onRefresh }) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const researchersList = (team.activeMembers || team.members || []).filter(
        (member) =>
            (member.personnel_type || member.member_type || member.pivot?.member_type) === 'باحث'
    );
    const photographersList = (team.activeMembers || team.members || []).filter(
        (member) =>
            (member.personnel_type || member.member_type || member.pivot?.member_type) === 'مصور'
    );

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const response = await apiClient.delete(`/teams/${team.id}`);
            if (response.data.success) {
                toast.success('تم حذف الفريق بنجاح');
                onRefresh();
            } else {
                toast.error(response.data.message || 'فشل حذف الفريق');
            }
        } catch (error) {
            console.error('Error deleting team:', error);
            toast.error(error.userMessage || 'حدث خطأ أثناء حذف الفريق');
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{ team.team_name }</h3>
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                        <Crown className="w-4 h-4 ml-1 text-orange-500" />
                        <span className="font-medium">القائد:</span>
                        <span className="mr-1">{ team.team_leader?.name }</span>
                    </div>
                    <p className="text-sm text-gray-600">
                        النوع: <span className="font-medium">{ team.team_type }</span>
                    </p>
                </div>
                <div
                    className={ `px-3 py-1 rounded-full text-xs font-medium ${team.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }` }
                >
                    { team.is_active ? 'نشط' : 'غير نشط' }
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4">
                <div className="border border-blue-100 rounded-xl p-3 bg-gradient-to-br from-blue-50 to-white">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center text-sm font-semibold text-blue-800">
                            <Users className="w-4 h-4 ml-1" />
                            الباحثين
                        </div>
                        <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                            { researchersList.length }
                        </span>
                    </div>
                    { researchersList.length === 0 ? (
                        <p className="text-xs text-blue-600">لم يتم تعيين باحثين بعد</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            { researchersList.map((member) => (
                                <span
                                    key={ member.id }
                                    className="text-xs bg-white border border-blue-100 text-blue-700 px-3 py-1 rounded-full"
                                >
                                    { member.name || member.user?.name }
                                </span>
                            )) }
                        </div>
                    ) }
                </div>
                <div className="border border-purple-100 rounded-xl p-3 bg-gradient-to-br from-purple-50 to-white">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center text-sm font-semibold text-purple-800">
                            <Camera className="w-4 h-4 ml-1" />
                            المصورين
                        </div>
                        <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                            { photographersList.length }
                        </span>
                    </div>
                    { photographersList.length === 0 ? (
                        <p className="text-xs text-purple-700">لم يتم تعيين مصورين بعد</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            { photographersList.map((member) => (
                                <span
                                    key={ member.id }
                                    className="text-xs bg-white border border-purple-100 text-purple-700 px-3 py-1 rounded-full"
                                >
                                    { member.name || member.user?.name }
                                </span>
                            )) }
                        </div>
                    ) }
                </div>
            </div>

            <div className="bg-sky-50 rounded-xl p-3 mb-4">
                <p className="text-sm text-sky-700">
                    <Users className="w-4 h-4 inline ml-1" />
                    عدد الأعضاء: <span className="font-bold">{ team.activeMembers?.length || team.members?.length || 0 }</span>
                </p>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={ onViewMembers }
                    className="flex-1 bg-sky-100 hover:bg-sky-200 text-sky-700 py-2 rounded-xl font-medium text-sm transition-colors"
                >
                    عرض الأعضاء
                </button>
                <button
                    onClick={ () => setShowDeleteConfirm(true) }
                    className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-xl transition-colors"
                    title="حذف الفريق"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Delete Confirmation */ }
            { showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">تأكيد الحذف</h3>
                        <p className="text-gray-600 mb-6">
                            هل أنت متأكد من حذف فريق "{ team.team_name }"؟
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={ () => setShowDeleteConfirm(false) }
                                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                                disabled={ deleting }
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={ handleDelete }
                                disabled={ deleting }
                                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium disabled:opacity-50"
                            >
                                { deleting ? 'جاري الحذف...' : 'حذف' }
                            </button>
                        </div>
                    </div>
                </div>
            ) }
        </div>
    );
};

// Create Team Modal
const CreateTeamModal = ({ isOpen, onClose, researchers, photographers, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        team_name: '',
        selectedResearcherId: '',
        selectedPhotographerId: '',
    });
    const [formErrors, setFormErrors] = useState({});

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormErrors({});

        const trimmedName = formData.team_name.trim();
        const selectedResearcherId = formData.selectedResearcherId;
        const selectedPhotographerId = formData.selectedPhotographerId;
        const newErrors = {};
        if (trimmedName.length < 3) {
            newErrors.team_name = ['اسم الفريق يجب أن يكون 3 أحرف على الأقل'];
        }
        if (!selectedResearcherId) {
            newErrors.selectedResearcherId = ['يجب اختيار باحث'];
        }
        if (!selectedPhotographerId) {
            newErrors.selectedPhotographerId = ['يجب اختيار مصور'];
        }

        if (Object.keys(newErrors).length > 0) {
            setFormErrors(newErrors);
            toast.error('يرجى تعبئة البيانات المطلوبة');
            return;
        }

        setLoading(true);

        try {
            const payload = {
                team_name: trimmedName,
                is_active: true,
            };

            const response = await apiClient.post('/teams', payload);

            if (!response.data.success) {
                toast.error(response.data.message || 'فشل إنشاء الفريق');
                return;
            }

            const teamId =
                response.data.team?.id ||
                response.data.data?.id ||
                response.data.id;

            if (!teamId) {
                toast.error('تم إنشاء الفريق بدون الحصول على معرف. يرجى التحقق من الـ API.');
                return;
            }

            await apiClient.post(`/teams/${teamId}/members`, {
                personnel_id: parseInt(selectedResearcherId, 10),
                role_in_team: 'قائد',
            });

            await apiClient.post(`/teams/${teamId}/members`, {
                personnel_id: parseInt(selectedPhotographerId, 10),
                role_in_team: 'عضو',
            });

            toast.success('تم إنشاء الفريق وتعيين الباحث والمصور بنجاح');
            setFormData({
                team_name: '',
                selectedResearcherId: '',
                selectedPhotographerId: '',
            });
            setFormErrors({});
            
            // ✅ إبطال الكاش قبل استدعاء onSuccess
            try {
                localStorage.removeItem('cache_teams');
                localStorage.removeItem('teams_cache');
                window.dispatchEvent(new CustomEvent('cache-invalidated', {
                    detail: { cacheKey: 'teams' }
                }));
                window.dispatchEvent(new CustomEvent('team-created', {
                    detail: { teamId }
                }));
            } catch (error) {
                console.warn('Error invalidating teams cache:', error);
            }
            
            onSuccess();
        } catch (error) {
            console.error('Error creating team:', error);
            const serverErrors = error.response?.data?.errors;
            if (serverErrors) {
                setFormErrors(serverErrors);
                const firstError = Object.values(serverErrors)[0]?.[0];
                toast.error(firstError || 'حدث خطأ أثناء إنشاء الفريق');
            } else {
                toast.error(error.userMessage || 'حدث خطأ أثناء إنشاء الفريق');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-800">إنشاء فريق جديد</h3>
                    <button onClick={ onClose } className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={ handleSubmit } className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">اسم الفريق *</label>
                        <input
                            type="text"
                            value={ formData.team_name }
                            onChange={ (e) => setFormData({ ...formData, team_name: e.target.value }) }
                            placeholder="مثال: فريق التنفيذ الأول"
                            className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${formErrors.team_name ? 'border-red-500' : 'border-gray-300'}` }
                            required
                        />
                        { formErrors.team_name && (
                            <p className="text-red-500 text-sm mt-1">{ formErrors.team_name[0] }</p>
                        ) }
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-lg font-bold text-gray-800 mb-3">اختر الباحث</h4>
                        <label className="block text-sm font-medium text-gray-700 mb-2">الباحث *</label>
                        <select
                            value={ formData.selectedResearcherId }
                            onChange={ (e) => setFormData({ ...formData, selectedResearcherId: e.target.value }) }
                            className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${formErrors.selectedResearcherId ? 'border-red-500' : 'border-gray-300'}` }
                            required
                        >
                            <option value="">اختر الباحث</option>
                            { researchers.map((researcher) => (
                                <option key={ researcher.id } value={ researcher.id }>
                                    { researcher.name } { researcher.phone_number ? `- ${researcher.phone_number}` : '' }
                                </option>
                            )) }
                        </select>
                        { formErrors.selectedResearcherId && (
                            <p className="text-red-500 text-sm mt-1">{ formErrors.selectedResearcherId[0] }</p>
                        ) }
                        { researchers.length === 0 && (
                            <p className="text-sm text-orange-600 mt-1">لا يوجد باحثين متاحين. يرجى إضافتهم أولاً.</p>
                        ) }
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-lg font-bold text-gray-800 mb-3">اختر المصور</h4>
                        <label className="block text-sm font-medium text-gray-700 mb-2">المصور *</label>
                        <select
                            value={ formData.selectedPhotographerId }
                            onChange={ (e) => setFormData({ ...formData, selectedPhotographerId: e.target.value }) }
                            className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${formErrors.selectedPhotographerId ? 'border-red-500' : 'border-gray-300'}` }
                            required
                        >
                            <option value="">اختر المصور</option>
                            { photographers.map((photographer) => (
                                <option key={ photographer.id } value={ photographer.id }>
                                    { photographer.name } { photographer.phone_number ? `- ${photographer.phone_number}` : '' }
                                </option>
                            )) }
                        </select>
                        { formErrors.selectedPhotographerId && (
                            <p className="text-red-500 text-sm mt-1">{ formErrors.selectedPhotographerId[0] }</p>
                        ) }
                        { photographers.length === 0 && (
                            <p className="text-sm text-orange-600 mt-1">لا يوجد مصورين متاحين. يرجى إضافتهم أولاً.</p>
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
                            disabled={ loading }
                            className="px-6 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                        >
                            { loading ? 'جاري الحفظ...' : 'إنشاء الفريق' }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Team Members Modal
const TeamMembersModal = ({ isOpen, onClose, team, researchers, photographers, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [showAddMemberForm, setShowAddMemberForm] = useState(false);
    const [showBulkAddModal, setShowBulkAddModal] = useState(false);
    const [newMember, setNewMember] = useState({
        personnel_id: '',
        role_in_team: '',
    });

    const handleAddMember = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await apiClient.post(`/teams/${team.id}/members`, {
                personnel_id: parseInt(newMember.personnel_id),
                role_in_team: newMember.role_in_team,
            });

            if (response.data.success) {
                toast.success('تم إضافة العضو بنجاح');
                setShowAddMemberForm(false);
                setNewMember({ personnel_id: '', role_in_team: '' });
                onSuccess();
            } else {
                toast.error(response.data.message || 'فشل إضافة العضو');
            }
        } catch (error) {
            console.error('Error adding member:', error);
            toast.error(error.userMessage || error.response?.data?.error || 'حدث خطأ أثناء إضافة العضو');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!confirm('هل أنت متأكد من إزالة هذا العضو؟')) return;

        try {
            const response = await apiClient.delete(`/teams/${team.id}/members/${userId}`);
            if (response.data.success) {
                toast.success('تم إزالة العضو بنجاح');
                const updatedTeam = response.data.team;
                if (updatedTeam?.activeMembers) {
                    setSelectedTeam({
                        ...team,
                        activeMembers: updatedTeam.activeMembers,
                    });
                }
                onSuccess();
            } else {
                toast.error(response.data.message || 'فشل إزالة العضو');
            }
        } catch (error) {
            console.error('Error removing member:', error);
            toast.error(error.userMessage || 'حدث خطأ أثناء إزالة العضو');
        }
    };

    if (!isOpen) return null;

    // ✅ الحصول على جميع الأعضاء المتاحين (باحثين ومصورين)
    const getAvailableMembers = () => {
        const allMembers = [...researchers, ...photographers];
        return allMembers.filter(
            (member) => !team.activeMembers?.some((teamMember) => teamMember.id === member.id)
        );
    };

    const availableMembers = getAvailableMembers();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800">{ team.team_name }</h3>
                        <p className="text-gray-600">أعضاء الفريق</p>
                    </div>
                    <button onClick={ onClose } className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Members List */ }
                <div className="space-y-3 mb-6">
                    { (!team.activeMembers || team.activeMembers.length === 0) ? (
                        <p className="text-center text-gray-500 py-6">لا يوجد أعضاء في الفريق</p>
                    ) : (
                        team.activeMembers?.map((member) => (
                            <div
                                key={ member.id }
                                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold">
                                        { (member.name || member.user?.name || '?').charAt(0) }
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">{ member.name }</p>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span>{ member.role_in_team }</span>
                                            { member.personnel_type ? (
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                    { member.personnel_type }
                                                </span>
                                            ) : null }
                                            { member.phone_number && (
                                                <span className="text-xs text-gray-500">{ member.phone_number }</span>
                                            ) }
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={ () => handleRemoveMember(member.id) }
                                    className="text-red-600 hover:text-red-700 p-2"
                                    title="إزالة من الفريق"
                                >
                                    <UserMinus className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    ) }
                </div>

                {/* Add Member Section */ }
                { !showAddMemberForm ? (
                    <div className="space-y-3">
                        <button
                            onClick={ () => setShowAddMemberForm(true) }
                            className="w-full bg-sky-100 hover:bg-sky-200 text-sky-700 py-3 rounded-xl font-medium flex items-center justify-center"
                        >
                            <UserPlus className="w-5 h-5 ml-2" />
                            إضافة عضو جديد
                        </button>
                        <button
                            onClick={ () => setShowBulkAddModal(true) }
                            className="w-full bg-purple-100 hover:bg-purple-200 text-purple-700 py-3 rounded-xl font-medium flex items-center justify-center"
                        >
                            <Users className="w-5 h-5 ml-2" />
                            إضافة عدة أعضاء دفعة واحدة
                        </button>
                    </div>
                ) : (
                    <form onSubmit={ handleAddMember } className="space-y-4 p-4 bg-sky-50 rounded-xl">
                        <div className="space-y-4">
                            {/* العضو */ }
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">اختر العامل *</label>
                                <select
                                    value={ newMember.personnel_id }
                                    onChange={ (e) => setNewMember({ ...newMember, personnel_id: e.target.value }) }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    required
                                >
                                    <option value="">اختر العامل</option>
                                    { availableMembers.map((member) => (
                                        <option key={ member.id } value={ member.id }>
                                            { member.name } ({ member.personnel_type || 'باحث' }) { member.department ? `- ${member.department}` : '' }
                                        </option>
                                    )) }
                                </select>
                                { availableMembers.length === 0 && (
                                    <p className="text-sm text-orange-600 mt-1">
                                        لا يوجد أعضاء متاحين
                                    </p>
                                ) }
                            </div>

                            {/* الدور */ }
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">الدور في الفريق *</label>
                                <select
                                    value={ newMember.role_in_team }
                                    onChange={ (e) => setNewMember({ ...newMember, role_in_team: e.target.value }) }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    required
                                >
                                    <option value="">اختر الدور</option>
                                    <option value="قائد">قائد</option>
                                    <option value="عضو">عضو</option>
                                    <option value="منسق">منسق</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={ () => setShowAddMemberForm(false) }
                                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl font-medium hover:bg-gray-50"
                            >
                                إلغاء
                            </button>
                            <button
                                type="submit"
                                disabled={ loading }
                                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-xl font-medium disabled:opacity-50"
                            >
                                { loading ? 'جاري الإضافة...' : 'إضافة' }
                            </button>
                        </div>
                    </form>
                ) }
            </div>

            {/* Bulk Add Members Modal */ }
            { showBulkAddModal && (
                <BulkAddMembersModal
                    isOpen={ showBulkAddModal }
                    onClose={ () => setShowBulkAddModal(false) }
                    team={ team }
                    researchers={ researchers }
                    photographers={ photographers }
                    onSuccess={ () => {
                        onSuccess();
                        setShowBulkAddModal(false);
                    } }
                />
            ) }
        </div>
    );
};

// Add Member Modal (Researcher or Photographer)
const AddMemberModal = ({ isOpen, onClose, memberType, endpoint, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone_number: '',
        department: '',
    });
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (errors[name]) {
            setErrors({ ...errors, [name]: null });
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = 'الاسم مطلوب';
        }
        if (!formData.phone_number.trim()) {
            newErrors.phone_number = 'رقم الهاتف مطلوب';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            toast.error('الرجاء تصحيح الأخطاء في النموذج');
            return;
        }

        setLoading(true);
        try {
            // ✅ إرسال البيانات فقط (بدون email و password)
            const requestData = {
                name: formData.name,
                phone_number: formData.phone_number,
            };

            if (formData.department && formData.department.trim()) {
                requestData.department = formData.department.trim();
            }

            const response = await apiClient.post(endpoint, requestData);

            if (response.data.success) {
                toast.success(`تم إضافة ${memberType} بنجاح`);
                setFormData({
                    name: '',
                    phone_number: '',
                    department: '',
                });
                setErrors({});
                onSuccess();
            } else {
                toast.error(response.data.message || `فشل إضافة ${memberType}`);
            }
        } catch (error) {
            console.error(`Error adding ${memberType}:`, error);
            toast.error(error.userMessage || error.response?.data?.message || `حدث خطأ أثناء إضافة ${memberType}`);
            if (error.response?.data?.errors) {
                setErrors(error.response.data.errors);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-800">إضافة { memberType } جديد</h3>
                    <button onClick={ onClose } className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={ handleSubmit } className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل *</label>
                            <input
                                type="text"
                                name="name"
                                value={ formData.name }
                                onChange={ handleChange }
                                className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
                                    }` }
                                required
                            />
                            { errors.name && <p className="text-red-500 text-sm mt-1">{ errors.name }</p> }
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف *</label>
                            <input
                                type="tel"
                                name="phone_number"
                                value={ formData.phone_number }
                                onChange={ handleChange }
                                placeholder="05xxxxxxxx"
                                className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.phone_number ? 'border-red-500' : 'border-gray-300'
                                    }` }
                                required
                            />
                            { errors.phone_number && <p className="text-red-500 text-sm mt-1">{ errors.phone_number }</p> }
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">القسم (اختياري)</label>
                            <input
                                type="text"
                                name="department"
                                value={ formData.department }
                                onChange={ handleChange }
                                placeholder="مثال: مشاريع، إعلام"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
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
                            className="px-6 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                        >
                            { loading ? 'جاري الإضافة...' : `إضافة ${memberType}` }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Bulk Add Members Modal
const BulkAddMembersModal = ({ isOpen, onClose, team, researchers, photographers, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState([]);

    const handleToggleMember = (memberId, memberType) => {
        const allMembers = [...researchers, ...photographers];
        const member = allMembers.find(m => m.id === memberId);

        if (!member) return;

        const isSelected = selectedMembers.some(m => m.personnel_id === memberId);

        if (isSelected) {
            setSelectedMembers(selectedMembers.filter(m => m.personnel_id !== memberId));
        } else {
            // ✅ التحقق من أن العضو غير موجود بالفعل في الفريق
            const isInTeam = team.activeMembers?.some(tm => tm.id === memberId);
            if (isInTeam) {
                toast.warning(`${member.name} موجود بالفعل في الفريق`);
                return;
            }

            setSelectedMembers([
                ...selectedMembers,
                {
                    personnel_id: memberId,
                    role_in_team: 'عضو',
                }
            ]);
        }
    };

    const handleBulkAdd = async () => {
        if (selectedMembers.length === 0) {
            toast.error('يرجى اختيار عضو واحد على الأقل');
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.post(`/teams/${team.id}/members/bulk`, {
                members: selectedMembers,
            });

            if (response.data.success) {
                toast.success(`تم إضافة ${response.data.added_count || selectedMembers.length} عضو بنجاح`);
                setSelectedMembers([]);
                onSuccess();
            } else {
                toast.error(response.data.message || 'فشل إضافة الأعضاء');
            }
        } catch (error) {
            console.error('Error bulk adding members:', error);
            toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء إضافة الأعضاء');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const availableResearchers = researchers.filter(
        (member) => !team.activeMembers?.some((teamMember) => teamMember.id === member.id)
    );
    const availablePhotographers = photographers.filter(
        (member) => !team.activeMembers?.some((teamMember) => teamMember.id === member.id)
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800">إضافة عدة أعضاء دفعة واحدة</h3>
                        <p className="text-gray-600">فريق: { team.team_name }</p>
                    </div>
                    <button onClick={ onClose } className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="mb-4 p-4 bg-blue-50 rounded-xl">
                    <p className="text-sm text-blue-800">
                        <strong>المحدد:</strong> { selectedMembers.length } عضو
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Researchers Section */ }
                    <div>
                        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <Users className="w-5 h-5 ml-2 text-blue-600" />
                            الباحثين ({ availableResearchers.length })
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            { availableResearchers.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">لا يوجد باحثين متاحين</p>
                            ) : (
                                availableResearchers.map((member) => {
                                    const isSelected = selectedMembers.some(m => m.personnel_id === member.id);
                                    return (
                                        <div
                                            key={ member.id }
                                            onClick={ () => handleToggleMember(member.id, 'باحث') }
                                            className={ `p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                                                ? 'bg-blue-100 border-blue-500'
                                                : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                                                }` }
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-gray-800">{ member.name }</p>
                                                    { member.phone_number && (
                                                        <p className="text-xs text-gray-500">{ member.phone_number }</p>
                                                    ) }
                                                    { member.department && (
                                                        <p className="text-xs text-gray-500">{ member.department }</p>
                                                    ) }
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={ isSelected }
                                                    onChange={ () => handleToggleMember(member.id, 'باحث') }
                                                    className="w-5 h-5 text-blue-600 rounded"
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            ) }
                        </div>
                    </div>

                    {/* Photographers Section */ }
                    <div>
                        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <Camera className="w-5 h-5 ml-2 text-purple-600" />
                            المصورين ({ availablePhotographers.length })
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            { availablePhotographers.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">لا يوجد مصورين متاحين</p>
                            ) : (
                                availablePhotographers.map((member) => {
                                    const isSelected = selectedMembers.some(m => m.personnel_id === member.id);
                                    return (
                                        <div
                                            key={ member.id }
                                            onClick={ () => handleToggleMember(member.id, 'مصور') }
                                            className={ `p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                                                ? 'bg-purple-100 border-purple-500'
                                                : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                                                }` }
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-gray-800">{ member.name }</p>
                                                    { member.phone_number && (
                                                        <p className="text-xs text-gray-500">{ member.phone_number }</p>
                                                    ) }
                                                    { member.department && (
                                                        <p className="text-xs text-gray-500">{ member.department }</p>
                                                    ) }
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={ isSelected }
                                                    onChange={ () => handleToggleMember(member.id, 'مصور') }
                                                    className="w-5 h-5 text-purple-600 rounded"
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            ) }
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={ onClose }
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                        disabled={ loading }
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={ handleBulkAdd }
                        disabled={ loading || selectedMembers.length === 0 }
                        className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                    >
                        { loading ? 'جاري الإضافة...' : `إضافة ${selectedMembers.length} عضو` }
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeamsManagement;

