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

export const OrphanSelectionWidget = ({ initialSelectedOrphans = [], onSelectionSubmit, project = {}, maxSelection }) => {
    const limit = maxSelection || project?.beneficiaries_count || project?.calculated_beneficiaries || 1000;
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [orphans, setOrphans] = useState([]);
    const [selectedOrphanIds, setSelectedOrphanIds] = useState(initialSelectedOrphans || []);
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
        setSearchQuery('');
        setSelectedOrphanIds(initialSelectedOrphans || []);
        setIsRecurring(false);
        fetchOrphanGroups();
    }, []);

    // Sync selection up to parent
    useEffect(() => {
        if (onSelectionSubmit) {
            onSelectionSubmit({
                orphan_ids: selectedOrphanIds,
                is_recurring: !!isRecurring,
                sponsorship_end_date: sponsorshipEndDate || null
            });
        }
    }, [selectedOrphanIds, isRecurring, sponsorshipEndDate]);

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
            if (project?.id) params.append('project_id', project.id);

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
        
        const targetCount = limit;

        if (filteredEligibleOrphans.length > 0) {
            const resultPool = [...filteredEligibleOrphans];
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

        setIsLoadingEligible(true);
        try {
            const response = await apiClient.post(`/orphan-groupings/${selectedGroupId}/smart-select`, {
                count: targetCount, ...orphanFilters, project_id: project?.id
            });
            if (response.data.success) {
                const selected = response.data.selected_orphans || response.data.data?.selected_orphans || response.data.data || [];
                const finalSelected = Array.isArray(selected) ? selected : [];
                const newIds = finalSelected.map(o => o.orphan_id_number || o.id);
                setSelectedOrphanIds(newIds);
                if (eligibleOrphans.length === 0) setEligibleOrphans(finalSelected);
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
        setSelectedOrphanIds(prev => {
            const isSelected = prev.includes(orphanId);
            if (!isSelected && prev.length >= limit) {
                toast.warning(`لا يمكن اختيار أكثر من ${limit} يتيم`);
                return prev;
            }
            return isSelected ? prev.filter(id => id !== orphanId) : [...prev, orphanId];
        });
    };

    const handleSelectAll = () => {
        const ids = orphans.map(o => o.orphan_id_number).filter(Boolean);
        setSelectedOrphanIds(prev => {
            const combined = [...new Set([...prev, ...ids])];
            if (combined.length > limit) {
                toast.warning(`تم تحديد الأيتام حتى الحد المسموح به وهو ${limit}`);
                return combined.slice(0, limit);
            }
            return combined;
        });
    };

    const handleDeselectAll = () => {
        const idsInResults = new Set(orphans.map(o => o.orphan_id_number));
        setSelectedOrphanIds(prev => prev.filter(id => !idsInResults.has(id)));
    };

    const isStatusAllowed = true;
    const filteredEligibleOrphans = eligibleOrphans.filter(
        orphan => !orphanFilters.exclude_sponsored || !sponsoredOrphans.has(orphan.orphan_id_number || orphan.id)
    );
    const selectedGroup = orphanGroups.find(g => String(g.id) === String(selectedGroupId));

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
        <div className="w-full bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden mb-6">
            <div className="flex-1">
                <div className="p-6 space-y-6">
                    {/* ── Tab Navigation ── */}
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
                        <button
                            onClick={() => setActiveTab('manual')}
                            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                                activeTab === 'manual'
                                    ? 'bg-white text-blue-700 shadow-sm'
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
                                    ? 'bg-white text-blue-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Sparkles className="w-4 h-4" />
                            الاختيار الذكي
                            <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                {limit}
                            </span>
                        </button>
                    </div>

                    {/* ═══════════════ TAB: Manual Search ═══════════════ */}
                    {activeTab === 'manual' ? (
                        <div className="space-y-6">
                            <div className="">
                                <h4 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                                    <UserPlus className="w-5 h-5 ml-2 text-green-600" />
                                    اختيار مستفيدين
                                </h4>
                                <p className="text-sm text-gray-500 mb-4">ابحث عن الأيتام وحدد الذين ترغب بإضافتهم لهذا المشروع.</p>

                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input type="text" placeholder="ابحث عن يتيم (رقم الهوية أو الاسم - أدخل على الأقل حرفين)..."
                                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            disabled={loading || !isStatusAllowed} />
                                    </div>

                                    {loadingOrphans && (
                                        <div className="text-center py-4">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                                        </div>
                                    )}

                                    {!loadingOrphans && orphans.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <span className="text-sm text-gray-600">اختر الأيتام للإضافة ({orphans.length} نتيجة)</span>
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={handleSelectAll} disabled={loading}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-50">
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
                                                                ? 'bg-blue-50 border-2 border-blue-500'
                                                                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                                        }`}>
                                                        <input type="checkbox" checked={selectedOrphanIds.includes(orphan.orphan_id_number)}
                                                            onChange={() => handleToggleOrphan(orphan.orphan_id_number)}
                                                            className="ml-3 w-4 h-4 text-blue-600 rounded focus:ring-blue-500" disabled={loading} />
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
                                    {/* Auto-syncs selection state to parent via useEffect */}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ═══════════════ TAB: Smart Grouping (REDESIGNED) ═══════════════ */
                        <div className="space-y-5">
                            {/* ── Hero: Group Selector ── */}
                            <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 rounded-2xl p-6 text-white relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
                                <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />

                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                            <Layers className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg">الاختيار الذكي للأيتام</h4>
                                            <p className="text-blue-200 text-sm">اختر تجميعة ودع النظام يختار الأيتام المناسبين</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                        <div className="md:col-span-3">
                                            <label className="block text-blue-200 text-xs font-medium mb-2">تجميعة الأيتام</label>
                                            <div className="relative">
                                                <select
                                                    value={selectedGroupId}
                                                    onChange={(e) => setSelectedGroupId(e.target.value)}
                                                    className="w-full px-4 py-3 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl text-white text-sm font-medium appearance-none focus:ring-2 focus:ring-white/40 outline-none placeholder-blue-300"
                                                    disabled={isLoadingGroups || !isStatusAllowed}
                                                >
                                                    <option value="" className="text-gray-800">-- اختر تجميعة --</option>
                                                    {orphanGroups.map(group => (
                                                        <option key={group.id} value={group.id} className="text-gray-800">
                                                            {group.name} ({group.current_count || 0} يتيم)
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-200 pointer-events-none" />
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <button
                                                onClick={handleSmartSelect}
                                                disabled={!selectedGroupId || isLoadingEligible || !isStatusAllowed}
                                                className="w-full px-6 py-3 bg-white text-blue-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
                                            >
                                                <Zap className="w-4 h-4" />
                                                اختيار ذكي ({limit} يتيم)
                                            </button>
                                        </div>
                                    </div>

                                    {selectedGroup && (
                                        <div className="flex gap-4 mt-4 pt-4 border-t border-white/10">
                                            <div className="flex items-center gap-2 text-sm">
                                                <CircleDot className="w-3.5 h-3.5 text-green-300" />
                                                <span className="text-blue-200">المجموعة:</span>
                                                <span className="font-bold">{selectedGroup.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Users className="w-3.5 h-3.5 text-blue-300" />
                                                <span className="text-blue-200">عدد الأيتام:</span>
                                                <span className="font-bold">{selectedGroup.current_count || 0}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="بحث سريع بالاسم أو رقم الهوية..."
                                        value={orphanFilters.search}
                                        onChange={(e) => setOrphanFilters(prev => ({ ...prev, search: e.target.value }))}
                                        className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>

                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${
                                        showFilters || orphanFilters.gender || orphanFilters.exclude_sponsored
                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                                >
                                    <SlidersHorizontal className="w-4 h-4" />
                                    فلاتر
                                    {(orphanFilters.gender || orphanFilters.exclude_sponsored) && (
                                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                                    )}
                                </button>

                                <div className="flex bg-gray-100 rounded-xl p-1">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                                    >
                                        <Grid3X3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {showFilters && (
                                <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex-1 min-w-[160px]">
                                        <label className="block text-xs font-bold text-gray-600 mb-1.5">الجنس</label>
                                        <select
                                            value={orphanFilters.gender}
                                            onChange={(e) => setOrphanFilters(prev => ({ ...prev, gender: e.target.value }))}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                                                className="w-4 h-4 text-blue-600 rounded border-gray-300"
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

                            {selectedGroupId && !isLoadingEligible && (
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-gray-500">
                                        عرض <span className="font-bold text-gray-800">{filteredEligibleOrphans.length}</span> يتيم مؤهل
                                        {selectedOrphanIds.length > 0 && (
                                            <span className={`mr-2 font-bold ${selectedOrphanIds.length >= limit ? 'text-amber-600' : 'text-blue-600'}`}>
                                                · تم تحديد {selectedOrphanIds.length} من {limit}
                                            </span>
                                        )}
                                    </p>
                                    {filteredEligibleOrphans.length > 0 && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const allIds = filteredEligibleOrphans.map(o => o.orphan_id_number || o.id);
                                                    setSelectedOrphanIds(prev => {
                                                        const combined = [...new Set([...prev, ...allIds])];
                                                        if (combined.length > limit) {
                                                            toast.warning(`تم تحديد الأيتام حتى الحد المسموح به وهو ${limit}`);
                                                            return combined.slice(0, limit);
                                                        }
                                                        return combined;
                                                    });
                                                }}
                                                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
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

                            <div className="min-h-[320px]">
                                {isLoadingEligible ? (
                                    <div className="flex flex-col items-center justify-center h-72">
                                        <div className="relative">
                                            <div className="w-16 h-16 border-4 border-blue-100 rounded-full" />
                                            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
                                        </div>
                                        <p className="text-gray-500 font-medium mt-5">جاري جلب قائمة الأيتام المؤهلين...</p>
                                    </div>
                                ) : !selectedGroupId ? (
                                    <div className="flex flex-col items-center justify-center h-72 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-2xl border-2 border-dashed border-gray-200">
                                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                            <Layers className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <p className="text-gray-500 font-bold text-lg mb-1">اختر تجميعة للبدء</p>
                                        <p className="text-gray-400 text-sm">حدد تجميعة من القائمة أعلاه لعرض الأيتام المؤهلين</p>
                                    </div>
                                ) : filteredEligibleOrphans.length > 0 ? (
                                    viewMode === 'grid' ? (
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
                                                                ? 'border-blue-500 bg-blue-50/60 shadow-md shadow-blue-100'
                                                                : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-md'
                                                        } ${!isStatusAllowed ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        <div className={`absolute top-3 left-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-300'
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
                                                                <h3 className="font-bold text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">
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
                                                            {isSponsored && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-bold">مكفول</span>}
                                                            {orphan.is_mother_deceased === 'نعم' && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-bold">الأم متوفاة</span>}
                                                            {orphan.health_status === 'مريض' && <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-bold">حالة خاصة</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
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
                                                                ? 'border-blue-500 bg-blue-50/60'
                                                                : 'border-gray-100 bg-white hover:border-blue-200'
                                                        } ${!isStatusAllowed ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                                                        }`}>
                                                            {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                                        </div>

                                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                                            orphan.orphan_gender === 'أنثى' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
                                                        }`}>
                                                            {orphan.orphan_full_name?.charAt(0) || 'ي'}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-gray-900 text-sm truncate">{orphan.orphan_full_name}</p>
                                                            <p className="text-[11px] text-gray-400 font-mono">{orphan.orphan_id_number}</p>
                                                        </div>

                                                        <div className="flex gap-1.5 flex-shrink-0">
                                                            {orphan.current_address && (
                                                                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                                                                    <MapPin className="w-2.5 h-2.5" />
                                                                    <span className="truncate max-w-[80px]">{orphan.current_address}</span>
                                                                </span>
                                                            )}
                                                            {isSponsored && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-bold">مكفول</span>}
                                                            {orphan.is_mother_deceased === 'نعم' && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-bold">الأم متوفاة</span>}
                                                            {orphan.health_status === 'مريض' && <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-bold">حالة خاصة</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-72 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-2xl border-2 border-dashed border-gray-200">
                                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                            <AlertCircle className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <p className="text-gray-500 font-bold text-lg mb-1">لا يوجد أيتام متاحون</p>
                                        <p className="text-gray-400 text-sm">جرّب تغيير الفلاتر أو اختيار تجميعة أخرى</p>
                                    </div>
                                )}
                            </div>

                            <SponsorshipOptions />
                            {/* Sticky footer handles counts now */}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Selection Summary Footer ── */}
            <div className="p-4 bg-gradient-to-l from-blue-50 to-indigo-50 border-t border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        selectedOrphanIds.length >= limit 
                            ? 'bg-amber-600 text-white' 
                            : selectedOrphanIds.length > 0 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-200 text-gray-500'
                    }`}>
                        {selectedOrphanIds.length}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-800">يتيم محدد / {limit}</p>
                    </div>
                </div>
                {selectedOrphanIds.length > 0 && (
                    <button
                        onClick={() => setSelectedOrphanIds([])}
                        className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> إلغاء الكل
                    </button>
                )}
            </div>
        </div>
    );
};

export default OrphanSelectionWidget;