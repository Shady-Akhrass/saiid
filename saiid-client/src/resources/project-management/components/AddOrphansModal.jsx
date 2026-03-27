import React, { useState, useEffect } from 'react';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import {
    X,
    Users,
    Search,
    UserPlus,
    UserMinus,
    CheckSquare,
    Square,
    Sparkles,
    CheckCircle,
    Activity,
    MapPin,
    RefreshCw,
    AlertCircle,
    ChevronDown,
    Zap,
    Grid3X3,
    List,
    SlidersHorizontal,
    Check,
    CircleDot,
    Layers
} from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';
import { getProjectCode } from '../../../utils/helpers';

export const AddOrphansModal = ({ isOpen, onClose, projectId, project, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [orphans, setOrphans] = useState([]);
    const [selectedOrphanIds, setSelectedOrphanIds] = useState([]);
    const [isRecurring, setIsRecurring] = useState(false);
    const [loadingOrphans, setLoadingOrphans] = useState(false);
    const [currentProjectOrphans, setCurrentProjectOrphans] = useState([]);
    const [loadingCurrentOrphans, setLoadingCurrentOrphans] = useState(false);
    const [sponsorshipEndDate, setSponsorshipEndDate] = useState('');
    const [sponsoredOrphans, setSponsoredOrphans] = useState(new Set());

    const [activeTab, setActiveTab] = useState('manual');
    const [orphanGroups, setOrphanGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [eligibleOrphans, setEligibleOrphans] = useState([]);
    const [isLoadingGroups, setIsLoadingGroups] = useState(false);
    const [isLoadingEligible, setIsLoadingEligible] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const [showFilters, setShowFilters] = useState(false);
    const [orphanFilters, setOrphanFilters] = useState({
        search: '',
        gender: '',
        exclude_sponsored: true
    });

    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // ─── All existing logic (unchanged) ─────────────────────────

    const checkSponsorshipStatus = async (orphanIds) => {
        try {
            const response = await apiClient.post('/orphan-groupings/check-sponsorship', {
                orphan_ids: orphanIds
            });
            if (response.data.success) {
                setSponsoredOrphans(prev => {
                    const next = new Set(prev);
                    const sponsoredList = Array.isArray(response.data.sponsored_orphans) 
                        ? response.data.sponsored_orphans 
                        : [];
                    
                    orphanIds.forEach(id => {
                        if (sponsoredList.includes(id)) {
                            next.add(id);
                        } else {
                            next.delete(id);
                        }
                    });
                    
                    return next;
                });
            }
        } catch (err) {
            console.error('Failed to check sponsorship status:', err);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCurrentOrphans();
            setSearchQuery('');
            setSelectedOrphanIds([]);
            setIsRecurring(false);
            fetchOrphanGroups();
        }
    }, [isOpen, projectId]);

    const fetchOrphanGroups = async () => {
        setIsLoadingGroups(true);
        try {
            const response = await apiClient.get('/orphan-groupings');
            if (response.data.success) {
                const groupings = response.data.groupings || response.data.data?.groupings || response.data.data || [];
                setOrphanGroups(Array.isArray(groupings) ? groupings : []);
            }
        } catch (error) {
            console.error('Error fetching orphan groups:', error);
        } finally {
            setIsLoadingGroups(false);
        }
    };

    const fetchEligibleOrphans = async (groupId) => {
        if (!groupId) return;
        setIsLoadingEligible(true);
        try {
            const params = new URLSearchParams();
            if (orphanFilters.search) params.append('search', orphanFilters.search);
            if (orphanFilters.gender) params.append('gender', orphanFilters.gender);
            if (orphanFilters.exclude_sponsored) params.append('exclude_sponsored', orphanFilters.exclude_sponsored);
            if (projectId) params.append('project_id', projectId);

            const response = await apiClient.get(`/orphan-groupings/${groupId}/orphans?${params}`);
            if (response.data.success) {
                const orphansList = response.data.orphans || response.data.data?.orphans || response.data.data || [];
                setEligibleOrphans(Array.isArray(orphansList) ? orphansList : []);
                const orphanIds = orphansList.map(o => o.orphan_id_number || o.id_number || o.id).filter(Boolean);
                if (orphanIds.length > 0) await checkSponsorshipStatus(orphanIds);
            }
        } catch (error) {
            console.error('Error fetching eligible orphans:', error);
            toast.error('حدث خطأ أثناء جلب الأيتام المؤهلين');
        } finally {
            setIsLoadingEligible(false);
        }
    };

    const handleSmartSelect = async () => {
        if (!selectedGroupId) return;
        
        // Target count from project beneficiaries
        const targetCount = project?.beneficiaries_count || 20;

        // Use orphans that are already visible in the list (matching current filters)
        if (filteredEligibleOrphans.length > 0) {
            // Select from the shown results
            const resultPool = [...filteredEligibleOrphans];
            // Shuffle the pool for random selection
            for (let i = resultPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [resultPool[i], resultPool[j]] = [resultPool[j], resultPool[i]];
            }
            const selectedMatch = resultPool.slice(0, targetCount);
            
            const newIds = selectedMatch.map(o => o.orphan_id_number || o.id);
            setSelectedOrphanIds(newIds);
            toast.success(`تم اختيار ${selectedMatch.length} يتيم عشوائياً من النتائج`);
            return;
        }

        // Fallback to backend selection if no orphans are loaded locally
        setIsLoadingEligible(true);
        try {
            const response = await apiClient.post(`/orphan-groupings/${selectedGroupId}/smart-select`, {
                count: targetCount, ...orphanFilters, project_id: projectId
            });
            if (response.data.success) {
                const selected = response.data.selected_orphans || response.data.data?.selected_orphans || response.data.data || [];
                const finalSelected = Array.isArray(selected) ? selected : [];
                const newIds = finalSelected.map(o => o.orphan_id_number || o.id);
                setSelectedOrphanIds(newIds);
                
                // If the list is empty, populate it with the selected data so user sees them
                if (eligibleOrphans.length === 0) {
                    setEligibleOrphans(finalSelected);
                }
                
                toast.success(`تم اختيار ${finalSelected.length} يتيم ذكياً بنجاح`);
            }
        } catch (error) {
            console.error('Error in smart select:', error);
            toast.error('حدث خطأ أثناء الاختيار الذكي');
        } finally {
            setIsLoadingEligible(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'grouping' && selectedGroupId) fetchEligibleOrphans(selectedGroupId);
    }, [selectedGroupId, orphanFilters, activeTab]);

    useEffect(() => {
        const trimmedQuery = debouncedSearchQuery.trim();
        const isIdNumber = /^\d+$/.test(trimmedQuery);
        const minLength = isIdNumber ? 1 : 2;
        if (trimmedQuery.length >= minLength) searchOrphans();
        else setOrphans([]);
    }, [debouncedSearchQuery]);

    const fetchCurrentOrphans = async () => {
        if (!projectId) return;
        setLoadingCurrentOrphans(true);
        try {
            const response = await apiClient.get(`/project-proposals/${projectId}/orphans`);
            if (response.data.success) setCurrentProjectOrphans(response.data.orphans || []);
        } catch (error) {
            console.error('Error fetching current orphans:', error);
        } finally {
            setLoadingCurrentOrphans(false);
        }
    };

    const searchOrphans = async () => {
        const query = debouncedSearchQuery.trim();
        if (!query) { setOrphans([]); return; }
        const isIdNumber = /^\d+$/.test(query);
        const minLength = isIdNumber ? 1 : 2;
        if (query.length < minLength) { setOrphans([]); return; }

        setLoadingOrphans(true);
        try {
            let response;
            if (isIdNumber) {
                try {
                    response = await apiClient.get(`/orphans/${query}`);
                    response = response.data?.orphan
                        ? { data: { success: true, orphans: [response.data.orphan], data: [response.data.orphan] } }
                        : { data: { success: true, orphans: [], data: [] } };
                } catch (idError) {
                    if (idError.response?.status === 404) response = { data: { success: true, orphans: [], data: [] } };
                    else throw idError;
                }
            } else {
                response = await apiClient.get('/orphans', { params: { searchQuery: query, perPage: 100, page: 1 } });
            }

            if (response.data?.success) {
                const found = response.data.orphans || response.data.data || [];
                const currentIds = currentProjectOrphans.map(o => o.orphan_id_number);
                setOrphans(found.filter(o => o?.orphan_id_number && !currentIds.includes(o.orphan_id_number)));
            } else setOrphans([]);
        } catch (error) {
            console.error('Error searching orphans:', error);
            const isId = /^\d+$/.test(debouncedSearchQuery.trim());
            if (!(isId && error.response?.status === 404)) toast.error('فشل البحث عن الأيتام');
            setOrphans([]);
        } finally {
            setLoadingOrphans(false);
        }
    };

    const handleToggleOrphan = (orphanId) => {
        setSelectedOrphanIds(prev => prev.includes(orphanId) ? prev.filter(id => id !== orphanId) : [...prev, orphanId]);
    };

    const handleSelectAll = () => {
        const ids = orphans.map(o => o.orphan_id_number).filter(Boolean);
        setSelectedOrphanIds(prev => [...new Set([...prev, ...ids])]);
    };

    const handleDeselectAll = () => {
        const idsInResults = new Set(orphans.map(o => o.orphan_id_number));
        setSelectedOrphanIds(prev => prev.filter(id => !idsInResults.has(id)));
    };

    const handleRemoveOrphan = async (orphanId) => {
        if (!window.confirm('هل أنت متأكد من إزالة هذا اليتيم من المشروع؟')) return;
        setLoading(true);
        try {
            const response = await apiClient.delete(`/project-proposals/${projectId}/orphans/${orphanId}`);
            if (response.data.success) { toast.success('تم إزالة اليتيم من المشروع بنجاح'); fetchCurrentOrphans(); onSuccess?.(); }
            else toast.error(response.data.message || 'فشل إزالة اليتيم');
        } catch (error) {
            console.error('Error removing orphan:', error);
            toast.error(error.response?.data?.message || 'حدث خطأ أثناء إزالة اليتيم');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e, andContinue = false) => {
        e?.preventDefault?.();
        if (selectedOrphanIds.length === 0) { toast.error('الرجاء اختيار يتيم واحد على الأقل'); return; }
        

        // ✅ Expanded statuses to match OrphanProjectManager trait backend logic
        const allowedStatuses = ['جديد', 'تم التوريد', 'مسند لباحث', 'قيد التنفيذ', 'قيد التوريد'];
        if (!allowedStatuses.includes(project?.status)) {
            toast.error(`لا يمكن إضافة الأيتام - حالة المشروع الحالية هي "${project?.status}"`);
            return;
        }

        // Sanitize payload
        const payload = {
            orphan_ids: selectedOrphanIds,
            is_recurring: !!isRecurring,
            sponsorship_end_date: sponsorshipEndDate || null,
        };

        setLoading(true);
        try {
            const response = await apiClient.post(`/project-proposals/${projectId}/orphans`, payload);
            if (response.data.success) {
                toast.success(response.data.message || `تم إضافة ${selectedOrphanIds.length} يتيم بنجاح`);
                setSelectedOrphanIds([]); setSearchQuery(''); setOrphans([]); setIsRecurring(false);
                fetchCurrentOrphans(); onSuccess?.();
                if (!andContinue) onClose();
            } else toast.error(response.data.message || 'فشل إضافة الأيتام');
        } catch (error) {
            console.error('Error adding orphans:', error);
            toast.error(error.response?.data?.message || 'حدث خطأ أثناء إضافة الأيتام');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSearchQuery(''); setSelectedOrphanIds([]); setOrphans([]);
        setIsRecurring(false); setSponsorshipEndDate(''); onClose();
    };

    if (!isOpen) return null;

    const allowedStatuses = ['جديد', 'تم التوريد', 'مسند لباحث', 'قيد التنفيذ', 'قيد التوريد'];
    const isStatusAllowed = allowedStatuses.includes(project?.status);
    const filteredEligibleOrphans = eligibleOrphans.filter(
        orphan => !orphanFilters.exclude_sponsored || !sponsoredOrphans.has(orphan.orphan_id_number || orphan.id)
    );
    const selectedGroup = orphanGroups.find(g => String(g.id) === String(selectedGroupId));

    // ─── Shared: Sponsorship Options ────────────────────────────
    const SponsorshipOptions = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)}
                        className="ml-3 w-4 h-4 text-blue-600 rounded focus:ring-blue-500" disabled={loading} />
                    <div>
                        <p className="text-sm font-medium text-blue-800">يتيم ثابت/متكرر</p>
                        <p className="text-xs text-blue-700 mt-1">إذا كان المشروع مقسم شهرياً، سيتم إضافة الأيتام تلقائياً لكل مشروع شهري جديد</p>
                    </div>
                </label>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <label className="block text-sm font-bold text-amber-800 mb-2">
                    تاريخ نهاية الكفالة <span className="text-red-500">*</span>
                </label>
                <input type="date" required value={sponsorshipEndDate} onChange={(e) => setSponsorshipEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm" disabled={loading} />
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">

                {/* ═══════════════ Header ═══════════════ */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 bg-gradient-to-l from-purple-50/50 to-white">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-600" />
                        </div>
                        إدارة الأيتام المكفولين {getProjectCode(project, '')}
                    </h3>
                    <button onClick={handleClose} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* ═══════════════ Scrollable Body ═══════════════ */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">

                        {/* ── Project Info ── */}
                        {project && (
                            <div className="bg-gradient-to-br from-gray-50 to-purple-50/50 rounded-xl p-4 border border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">معلومات المشروع:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-500 text-xs">اسم المشروع</span>
                                        <p className="font-medium text-gray-800">{project.project_name || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 text-xs">الحالة</span>
                                        <p className="font-medium text-gray-800">{project.status || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 text-xs">عدد الأيتام الحالي</span>
                                        <p className="font-medium text-gray-800">
                                            {project.sponsored_orphans_count || currentProjectOrphans.length || 0}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Tab Navigation ── */}
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
                            <button
                                onClick={() => setActiveTab('manual')}
                                className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                                    activeTab === 'manual'
                                        ? 'bg-white text-purple-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Search className="w-4 h-4" />
                                بحث يدوي
                            </button>
                            <button
                                onClick={() => setActiveTab('grouping')}
                                className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                                    activeTab === 'grouping'
                                        ? 'bg-white text-purple-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Sparkles className="w-4 h-4" />
                                اختيار ذكي
                                <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                    {project?.beneficiaries_count || 20}
                                </span>
                            </button>
                        </div>

                        {/* ═══════════════ TAB: Manual Search ═══════════════ */}
                        {activeTab === 'manual' ? (
                            <div className="space-y-6">
                                {/* Current Orphans */}
                                <div>
                                        <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                                            <Users className="w-5 h-5 ml-2 text-purple-600" />
                                            الأيتام المكفولين حالياً ({currentProjectOrphans.length})
                                        </h4>
                                        {loadingCurrentOrphans ? (
                                            <div className="text-center py-4">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
                                            </div>
                                        ) : currentProjectOrphans.length === 0 ? (
                                            <p className="text-gray-500 text-center py-4">لا يوجد أيتام مكفولين حالياً</p>
                                        ) : (
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {currentProjectOrphans.map((orphan) => (
                                                    <div key={orphan.orphan_id_number}
                                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                        <div className="flex-1">
                                                            <p className="font-medium text-gray-800">{orphan.orphan_full_name || orphan.name || 'غير محدد'}</p>
                                                            <p className="text-sm text-gray-600">رقم الهوية: {orphan.orphan_id_number}</p>
                                                            {orphan.pivot?.is_recurring && (
                                                                <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">يتيم ثابت/متكرر</span>
                                                            )}
                                                        </div>
                                                        <button onClick={() => handleRemoveOrphan(orphan.orphan_id_number)} disabled={loading}
                                                            className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="إزالة اليتيم">
                                                            <UserMinus className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                {/* Add New Orphans */}
                                {/* Add New Orphans */}
                                <div className="border-t pt-6">
                                    <h4 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                                        <UserPlus className="w-5 h-5 ml-2 text-green-600" />
                                        إضافة أيتام جدد
                                    </h4>
                                    <p className="text-sm text-gray-500 mb-4">يمكنك اختيار أكثر من يتيم دفعة واحدة من نتائج البحث، ثمّ الإضافة.</p>

                                    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                            <input type="text" placeholder="ابحث عن يتيم (رقم الهوية أو الاسم - أدخل على الأقل حرفين)..."
                                                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                disabled={loading || !isStatusAllowed} />
                                        </div>

                                        {loadingOrphans && (
                                            <div className="text-center py-4">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto" />
                                            </div>
                                        )}

                                        {!loadingOrphans && orphans.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className="text-sm text-gray-600">اختر الأيتام للإضافة ({orphans.length} نتيجة)</span>
                                                    <div className="flex gap-2">
                                                        <button type="button" onClick={handleSelectAll} disabled={loading}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors disabled:opacity-50">
                                                            <CheckSquare className="w-4 h-4" /> تحديد الكل
                                                        </button>
                                                        <button type="button" onClick={handleDeselectAll} disabled={loading}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 transition-colors disabled:opacity-50">
                                                            <Square className="w-4 h-4" /> إلغاء التحديد
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-xl p-4">
                                                    {orphans.map((orphan) => (
                                                        <label key={orphan.orphan_id_number}
                                                            className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                                                                selectedOrphanIds.includes(orphan.orphan_id_number)
                                                                    ? 'bg-purple-50 border-2 border-purple-500'
                                                                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                                            }`}>
                                                            <input type="checkbox" checked={selectedOrphanIds.includes(orphan.orphan_id_number)}
                                                                onChange={() => handleToggleOrphan(orphan.orphan_id_number)}
                                                                className="ml-3 w-4 h-4 text-purple-600 rounded focus:ring-purple-500" disabled={loading} />
                                                            <div className="flex-1">
                                                                <p className="font-medium text-gray-800">{orphan.orphan_full_name || orphan.name || 'غير محدد'}</p>
                                                                <p className="text-sm text-gray-600">رقم الهوية: {orphan.orphan_id_number}</p>
                                                                {orphan.orphan_birth_date && <p className="text-xs text-gray-500">تاريخ الميلاد: {orphan.orphan_birth_date}</p>}
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {!loadingOrphans && searchQuery.trim().length >= 2 && orphans.length === 0 && (
                                            <p className="text-gray-500 text-center py-4">لا توجد نتائج</p>
                                        )}

                                        <SponsorshipOptions />

                                        {/* Manual Actions */}
                                        <div className="flex justify-end gap-3 mt-6 flex-wrap">
                                            <button type="button" onClick={handleClose} disabled={loading}
                                                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50">إلغاء</button>
                                            <button type="button" onClick={(e) => handleSubmit(e, true)} disabled={loading || selectedOrphanIds.length === 0}
                                                className="px-6 py-2 border-2 border-purple-500 text-purple-600 rounded-xl font-medium hover:bg-purple-50 transition-colors disabled:opacity-50">
                                                {loading ? 'جاري...' : `إضافة ${selectedOrphanIds.length} يتيم ومتابعة`}
                                            </button>
                                            <button type="submit" disabled={loading || selectedOrphanIds.length === 0}
                                                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50">
                                                {loading ? 'جاري...' : `إضافة ${selectedOrphanIds.length} يتيم وإغلاق`}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            /* ═══════════════ TAB: Smart Grouping (REDESIGNED) ═══════════════ */
                            <div className="space-y-5">

                                {/* ── Hero: Group Selector ── */}
                                <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 rounded-2xl p-6 text-white relative overflow-hidden">
                                    {/* Decorative shapes */}
                                    <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
                                    <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                                <Layers className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg">الاختيار الذكي للأيتام</h4>
                                                <p className="text-purple-200 text-sm">اختر تجميعة ودع النظام يختار الأيتام المناسبين</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                            {/* Group Selector */}
                                            <div className="md:col-span-3">
                                                <label className="block text-purple-200 text-xs font-medium mb-2">تجميعة الأيتام</label>
                                                <div className="relative">
                                                    <select
                                                        value={selectedGroupId}
                                                        onChange={(e) => setSelectedGroupId(e.target.value)}
                                                        className="w-full px-4 py-3 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl text-white text-sm font-medium appearance-none focus:ring-2 focus:ring-white/40 outline-none placeholder-purple-300"
                                                        disabled={isLoadingGroups || !isStatusAllowed}
                                                    >
                                                        <option value="" className="text-gray-800">-- اختر تجميعة --</option>
                                                        {orphanGroups.map(group => (
                                                            <option key={group.id} value={group.id} className="text-gray-800">
                                                                {group.name} ({group.current_count || 0} يتيم)
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-200 pointer-events-none" />
                                                </div>
                                            </div>

                                            {/* Smart Select Button */}
                                            <div className="md:col-span-2">
                                                <button
                                                    onClick={handleSmartSelect}
                                                    disabled={!selectedGroupId || isLoadingEligible || !isStatusAllowed}
                                                    className="w-full px-6 py-3 bg-white text-purple-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
                                                >
                                                    <Zap className="w-4 h-4" />
                                                    اختيار ذكي ({project?.beneficiaries_count || 20} يتيم)
                                                </button>
                                            </div>
                                        </div>

                                        {/* Selected Group Stats */}
                                        {selectedGroup && (
                                            <div className="flex gap-4 mt-4 pt-4 border-t border-white/10">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <CircleDot className="w-3.5 h-3.5 text-green-300" />
                                                    <span className="text-purple-200">المجموعة:</span>
                                                    <span className="font-bold">{selectedGroup.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Users className="w-3.5 h-3.5 text-blue-300" />
                                                    <span className="text-purple-200">عدد الأيتام:</span>
                                                    <span className="font-bold">{selectedGroup.current_count || 0}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Toolbar: Search + Filters + View Toggle ── */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    {/* Search */}
                                    <div className="relative flex-1">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <input
                                            type="text"
                                            placeholder="بحث سريع بالاسم أو رقم الهوية..."
                                            value={orphanFilters.search}
                                            onChange={(e) => setOrphanFilters(prev => ({ ...prev, search: e.target.value }))}
                                            className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                        />
                                    </div>

                                    {/* Filter Toggle */}
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className={`px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${
                                            showFilters || orphanFilters.gender || orphanFilters.exclude_sponsored
                                                ? 'bg-purple-50 border-purple-200 text-purple-700'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                    >
                                        <SlidersHorizontal className="w-4 h-4" />
                                        فلاتر
                                        {(orphanFilters.gender || orphanFilters.exclude_sponsored) && (
                                            <span className="w-2 h-2 bg-purple-500 rounded-full" />
                                        )}
                                    </button>

                                    {/* View Toggle */}
                                    <div className="flex bg-gray-100 rounded-xl p-1">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}
                                        >
                                            <Grid3X3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}
                                        >
                                            <List className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* ── Expandable Filters ── */}
                                {showFilters && (
                                    <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="flex-1 min-w-[160px]">
                                            <label className="block text-xs font-bold text-gray-600 mb-1.5">الجنس</label>
                                            <select
                                                value={orphanFilters.gender}
                                                onChange={(e) => setOrphanFilters(prev => ({ ...prev, gender: e.target.value }))}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            >
                                                <option value="">الكل</option>
                                                <option value="male">ذكر</option>
                                                <option value="female">أنثى</option>
                                            </select>
                                        </div>
                                        <div className="flex items-end">
                                            <label className="flex items-center gap-2.5 px-4 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={orphanFilters.exclude_sponsored}
                                                    onChange={(e) => setOrphanFilters(prev => ({ ...prev, exclude_sponsored: e.target.checked }))}
                                                    className="w-4 h-4 text-purple-600 rounded border-gray-300"
                                                />
                                                <span className="text-sm text-gray-700 font-medium">استبعاد المكفولين حالياً</span>
                                            </label>
                                        </div>
                                        {(orphanFilters.gender || orphanFilters.exclude_sponsored) && (
                                            <div className="flex items-end">
                                                <button
                                                    onClick={() => setOrphanFilters({ search: orphanFilters.search, gender: '', exclude_sponsored: false })}
                                                    className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    مسح الفلاتر
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Results Counter ── */}
                                {selectedGroupId && !isLoadingEligible && (
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-gray-500">
                                            عرض <span className="font-bold text-gray-800">{filteredEligibleOrphans.length}</span> يتيم مؤهل
                                            {selectedOrphanIds.length > 0 && (
                                                <span className="mr-2 text-purple-600 font-bold">
                                                    · تم تحديد {selectedOrphanIds.length}
                                                </span>
                                            )}
                                        </p>
                                        {filteredEligibleOrphans.length > 0 && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const allIds = filteredEligibleOrphans.map(o => o.orphan_id_number || o.id);
                                                        setSelectedOrphanIds(prev => [...new Set([...prev, ...allIds])]);
                                                    }}
                                                    className="text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1"
                                                >
                                                    <CheckSquare className="w-3.5 h-3.5" /> تحديد الكل
                                                </button>
                                                <span className="text-gray-300">|</span>
                                                <button
                                                    onClick={() => {
                                                        const visibleIds = new Set(filteredEligibleOrphans.map(o => o.orphan_id_number || o.id));
                                                        setSelectedOrphanIds(prev => prev.filter(id => !visibleIds.has(id)));
                                                    }}
                                                    className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                                >
                                                    <Square className="w-3.5 h-3.5" /> إلغاء الكل
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Orphans Display ── */}
                                <div className="min-h-[320px]">
                                    {isLoadingEligible ? (
                                        <div className="flex flex-col items-center justify-center h-72">
                                            <div className="relative">
                                                <div className="w-16 h-16 border-4 border-purple-100 rounded-full" />
                                                <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
                                            </div>
                                            <p className="text-gray-500 font-medium mt-5">جاري جلب قائمة الأيتام المؤهلين...</p>
                                        </div>
                                    ) : !selectedGroupId ? (
                                        <div className="flex flex-col items-center justify-center h-72 bg-gradient-to-br from-gray-50 to-purple-50/30 rounded-2xl border-2 border-dashed border-gray-200">
                                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                                <Layers className="w-8 h-8 text-gray-300" />
                                            </div>
                                            <p className="text-gray-500 font-bold text-lg mb-1">اختر تجميعة للبدء</p>
                                            <p className="text-gray-400 text-sm">حدد تجميعة من القائمة أعلاه لعرض الأيتام المؤهلين</p>
                                        </div>
                                    ) : filteredEligibleOrphans.length > 0 ? (
                                        viewMode === 'grid' ? (
                                            /* ── Grid View ── */
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                                                {filteredEligibleOrphans.map(orphan => {
                                                    const orphanId = orphan.orphan_id_number || orphan.id;
                                                    const isSelected = selectedOrphanIds.includes(orphanId);
                                                    const isSponsored = sponsoredOrphans.has(orphanId);

                                                    return (
                                                        <div
                                                            key={orphanId}
                                                            onClick={() => {
                                                                if (!isStatusAllowed) { toast.warning('لا يمكن تعديل الأيتام في حالة المشروع الحالية'); return; }
                                                                handleToggleOrphan(orphanId);
                                                            }}
                                                            className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                                                                isSelected
                                                                    ? 'border-purple-500 bg-purple-50/60 shadow-md shadow-purple-100'
                                                                    : 'border-gray-100 bg-white hover:border-purple-200 hover:shadow-md'
                                                            } ${!isStatusAllowed ? 'cursor-not-allowed opacity-60' : ''}`}
                                                        >
                                                            {/* Selection indicator */}
                                                            <div className={`absolute top-3 left-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                                isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300 group-hover:border-purple-300'
                                                            }`}>
                                                                {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                                            </div>

                                                            <div className="flex items-start gap-3 mb-3">
                                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                                                                    orphan.orphan_gender === 'أنثى'
                                                                        ? 'bg-gradient-to-br from-pink-100 to-rose-50 text-pink-600'
                                                                        : 'bg-gradient-to-br from-blue-100 to-sky-50 text-blue-600'
                                                                }`}>
                                                                    {orphan.orphan_full_name?.charAt(0) || 'ي'}
                                                                </div>
                                                                <div className="min-w-0 flex-1 pl-6">
                                                                    <h3 className="font-bold text-gray-900 text-sm truncate group-hover:text-purple-700 transition-colors">
                                                                        {orphan.orphan_full_name}
                                                                    </h3>
                                                                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">{orphan.orphan_id_number}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-1.5">
                                                                {orphan.current_address && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                                                                        <MapPin className="w-2.5 h-2.5" />
                                                                        <span className="truncate max-w-[100px]">{orphan.current_address}</span>
                                                                    </span>
                                                                )}
                                                                {isSponsored && (
                                                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md font-bold">مكفول</span>
                                                                )}
                                                                {orphan.is_mother_deceased === 'نعم' && (
                                                                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-bold">الأم متوفاة</span>
                                                                )}
                                                                {orphan.health_status === 'مريض' && (
                                                                    <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-bold">حالة خاصة</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            /* ── List View ── */
                                            <div className="max-h-[420px] overflow-y-auto pr-1 custom-scrollbar space-y-2">
                                                {filteredEligibleOrphans.map(orphan => {
                                                    const orphanId = orphan.orphan_id_number || orphan.id;
                                                    const isSelected = selectedOrphanIds.includes(orphanId);
                                                    const isSponsored = sponsoredOrphans.has(orphanId);

                                                    return (
                                                        <div
                                                            key={orphanId}
                                                            onClick={() => {
                                                                if (!isStatusAllowed) { toast.warning('لا يمكن تعديل الأيتام في حالة المشروع الحالية'); return; }
                                                                handleToggleOrphan(orphanId);
                                                            }}
                                                            className={`flex items-center gap-4 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                                                isSelected
                                                                    ? 'border-purple-500 bg-purple-50/60'
                                                                    : 'border-gray-100 bg-white hover:border-purple-200'
                                                            } ${!isStatusAllowed ? 'cursor-not-allowed opacity-60' : ''}`}
                                                        >
                                                            {/* Checkbox */}
                                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                                isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                                                            }`}>
                                                                {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                                            </div>

                                                            {/* Avatar */}
                                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                                                orphan.orphan_gender === 'أنثى'
                                                                    ? 'bg-pink-100 text-pink-600'
                                                                    : 'bg-blue-100 text-blue-600'
                                                            }`}>
                                                                {orphan.orphan_full_name?.charAt(0) || 'ي'}
                                                            </div>

                                                            {/* Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-bold text-gray-900 text-sm truncate">{orphan.orphan_full_name}</p>
                                                                <p className="text-[11px] text-gray-400 font-mono">{orphan.orphan_id_number}</p>
                                                            </div>

                                                            {/* Tags */}
                                                            <div className="flex gap-1.5 flex-shrink-0">
                                                                {orphan.current_address && (
                                                                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                                                                        <MapPin className="w-2.5 h-2.5" />
                                                                        <span className="truncate max-w-[80px]">{orphan.current_address}</span>
                                                                    </span>
                                                                )}
                                                                {isSponsored && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md font-bold">مكفول</span>}
                                                                {orphan.is_mother_deceased === 'نعم' && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-bold">الأم متوفاة</span>}
                                                                {orphan.health_status === 'مريض' && <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-bold">حالة خاصة</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-72 bg-gradient-to-br from-gray-50 to-purple-50/30 rounded-2xl border-2 border-dashed border-gray-200">
                                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                                <AlertCircle className="w-8 h-8 text-gray-300" />
                                            </div>
                                            <p className="text-gray-500 font-bold text-lg mb-1">لا يوجد أيتام متاحون</p>
                                            <p className="text-gray-400 text-sm">جرّب تغيير الفلاتر أو اختيار تجميعة أخرى</p>
                                        </div>
                                    )}
                                </div>

                                {/* ── Sponsorship Options ── */}
                                <SponsorshipOptions />

                                {/* ── Sticky Action Bar ── */}
                                <div className="flex items-center justify-between p-4 bg-gradient-to-l from-purple-50 to-indigo-50 rounded-2xl border border-purple-100">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                            selectedOrphanIds.length > 0 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
                                        }`}>
                                            {selectedOrphanIds.length}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">يتيم محدد</p>
                                            {selectedOrphanIds.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedOrphanIds([])}
                                                    className="text-[11px] text-red-500 hover:text-red-700 font-medium flex items-center gap-1 mt-0.5"
                                                >
                                                    <RefreshCw className="w-3 h-3" /> إلغاء الكل
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleClose} disabled={loading}
                                            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all">
                                            إلغاء
                                        </button>
                                        <button
                                            onClick={(e) => handleSubmit(e, false)}
                                            disabled={loading || selectedOrphanIds.length === 0 || !sponsorshipEndDate}
                                            className="px-8 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-purple-200 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                    جاري الإضافة...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-4 h-4" />
                                                    تأكيد الإضافة ({selectedOrphanIds.length})
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddOrphansModal;