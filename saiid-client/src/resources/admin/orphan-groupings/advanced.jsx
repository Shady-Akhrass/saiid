import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../hooks/useToast";
import apiClient from "../../../utils/axiosConfig";
import { 
  Users, 
  Download, 
  Plus, 
  X, 
  Search, 
  Filter, 
  MapPin, 
  Heart,
  BookOpen,
  Activity,
  UserCheck,
  UserX,
  Settings,
  BarChart3,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  SlidersHorizontal,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ChevronUp,
  Loader2,
  FileText,
  FileSpreadsheet
} from "lucide-react";
import OrphanExportExcelModal from "./components/OrphanExportExcelModal";

const OrphanGroupingsAdvanced = () => {
  const { user } = useAuth();
  const userRole = (user?.role || user?.userRole || user?.user_role || user?.role_name || '').toLowerCase();
  const { success, error: showError } = useToast();
  
  // ══════════════════════════════════════════════
  // ALL HOOKS BEFORE ANY CONDITIONAL RETURN
  // ══════════════════════════════════════════════
  
  const [groupings, setGroupings] = useState([]);
  const [orphans, setOrphans] = useState([]);
  const [selectedOrphans, setSelectedOrphans] = useState([]);
  const [eligibleOrphans, setEligibleOrphans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOrphans, setIsLoadingOrphans] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddOrphansModal, setShowAddOrphansModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [orphanSearchQuery, setOrphanSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [locations, setLocations] = useState({ governorates: [], districts: [] });
  const [pagination, setPagination] = useState(null);
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [groupOrphans, setGroupOrphans] = useState({});
  const [loadingGroupOrphans, setLoadingGroupOrphans] = useState({});
  const [sponsoredOrphans, setSponsoredOrphans] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [excludeSponsored, setExcludeSponsored] = useState(false);
  const [showExportExcelModal, setShowExportExcelModal] = useState(false);
  
  const handleExportGroupPdf = async (groupId) => {
    try {
      setIsExporting(true);
      const response = await apiClient.get(`/orphan-groupings/${groupId}/export-pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `group_${groupId}.pdf`);
      document.body.appendChild(link);
      link.click();
      success('تم بدء تحميل تقرير المجموعة بنجاح');
    } catch (err) {
      console.error('Export error:', err);
      showError('فشل في تصدير تقرير المجموعة');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async (orphanId) => {
    try {
      const response = await apiClient.get(`/orphans/${orphanId}/export-pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orphan_${orphanId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      success('تم بدء تحميل ملف PDF بنجاح');
    } catch (err) {
      showError('فشل في تحميل ملف PDF');
    }
  };

  const handleDownloadWord = async (orphanId) => {
    try {
      const response = await apiClient.get(`/orphans/${orphanId}/export-word`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orphan_${orphanId}.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      success('تم بدء تحميل ملف Word بنجاح');
    } catch (err) {
      showError('فشل في تحميل ملف Word');
    }
  };

  const handleExportAllExcel = () => {
    setShowExportExcelModal(true);
  };

  const handlePerformExcelExport = async (selectedColumns, statusFilter) => {
    try {
      setShowExportExcelModal(false);
      success('جاري التحضير لتصدير ملف Excel مخصص...');
      
      const response = await apiClient.get('/orphan-groupings/export-all-excel', {
        params: { 
          columns: selectedColumns.join(','),
          statusFilter: statusFilter
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'all_orphan_groupings_custom.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      success('تم تصدير ملف Excel بنجاح');
    } catch (err) {
      console.error('Export error:', err);
      showError('فشل في بدء التصدير. يرجى التأكد من تسجيل الدخول.');
    }
  };

  const handleExportGroupWord = async (groupId) => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const response = await apiClient.get(`/orphan-groupings/${groupId}/export-word`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `group_${groupId}.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      success('تم تصدير ملف Word بنجاح');
    } catch (err) {
      console.error('Error exporting group Word:', err);
      showError('حدث خطأ أثناء تصدير ملف Word');
    } finally {
      setIsExporting(false);
    }
  };
  
  const defaultAddOrphansFilters = {
    governorate_filter: '',
    district_filter: '',
    mother_status: [],
    health_conditions: [],
    age_range: { min: 0, max: 12 },
    gender: 'both',
    enrollment_status: [],
    exclude_adopted: true,
    exclude_sponsored: true
  };

  const [addOrphansFilters, setAddOrphansFilters] = useState({ ...defaultAddOrphansFilters });
  
  const [newGrouping, setNewGrouping] = useState({
    name: '',
    max_capacity: 50,
    description: '',
    selection_criteria: {
      mother_status: [],
      father_status: [],
      health_conditions: [],
      governorate_filter: '',
      district_filter: '',
      age_range: { min: 0, max: 12 },
      gender: 'both',
      enrollment_status: [],
      exclude_adopted: true
    },
    exclusion_notes: ''
  });

  const [filters, setFilters] = useState({
    status: '',
    governorate_filter: '',
    district_filter: ''
  });

  // Check authorization - Admin and orphan_sponsor_coordinator (and Arabic variants)
  const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير' || userRole === 'مدير عام';
  const isAuthorized = isAdmin || 
                      userRole === 'orphan_sponsor_coordinator' || 
                      user?.userRole === 'orphan_sponsor_coordinator' ||
                      user?.user_role === 'orphan_sponsor_coordinator' ||
                      userRole === 'منسق كفالة الأيتام' ||
                      userRole === 'منسق مشاريع كفالة الأيتام' ||
                      userRole === 'منسق الكفالات';

  // Safety checks
  const safeOrphans = Array.isArray(orphans) ? orphans : [];
  const safeGroupOrphans = typeof groupOrphans === 'object' && groupOrphans !== null ? groupOrphans : {};
  
  const safeAddOrphansFilters = {
    ...addOrphansFilters,
    mother_status: Array.isArray(addOrphansFilters.mother_status) ? addOrphansFilters.mother_status : [],
    health_conditions: Array.isArray(addOrphansFilters.health_conditions) ? addOrphansFilters.health_conditions : [],
    enrollment_status: Array.isArray(addOrphansFilters.enrollment_status) ? addOrphansFilters.enrollment_status : [],
  };

  // ══════════════════════════════════════════════════════════════
  // FIXED: Robust orphan array extractor that handles ALL formats
  // ══════════════════════════════════════════════════════════════
  const extractOrphansArray = (responseData) => {
    if (!responseData) {
      console.warn('⚠️ extractOrphansArray: responseData is null/undefined');
      return [];
    }

    // If responseData itself is an array, return it
    if (Array.isArray(responseData)) {
      console.log('✅ extractOrphansArray: responseData is directly an array, length:', responseData.length);
      return responseData;
    }

    // ── Level 1: Check direct properties ──
    if (Array.isArray(responseData.eligible_orphans)) {
      console.log('✅ extractOrphansArray: found responseData.eligible_orphans, length:', responseData.eligible_orphans.length);
      return responseData.eligible_orphans;
    }
    if (Array.isArray(responseData.orphans)) {
      console.log('✅ extractOrphansArray: found responseData.orphans, length:', responseData.orphans.length);
      return responseData.orphans;
    }
    if (Array.isArray(responseData.selected_orphans)) {
      console.log('✅ extractOrphansArray: found responseData.selected_orphans, length:', responseData.selected_orphans.length);
      return responseData.selected_orphans;
    }

    // ── Level 2: Check inside responseData.data ──
    if (responseData.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data)) {
      if (Array.isArray(responseData.data.eligible_orphans)) {
        console.log('✅ extractOrphansArray: found responseData.data.eligible_orphans, length:', responseData.data.eligible_orphans.length);
        return responseData.data.eligible_orphans;
      }
      if (Array.isArray(responseData.data.orphans)) {
        console.log('✅ extractOrphansArray: found responseData.data.orphans, length:', responseData.data.orphans.length);
        return responseData.data.orphans;
      }
      if (Array.isArray(responseData.data.selected_orphans)) {
        console.log('✅ extractOrphansArray: found responseData.data.selected_orphans, length:', responseData.data.selected_orphans.length);
        return responseData.data.selected_orphans;
      }

      // ── Level 3: Check inside responseData.data.data ──
      if (responseData.data.data && typeof responseData.data.data === 'object' && !Array.isArray(responseData.data.data)) {
        if (Array.isArray(responseData.data.data.eligible_orphans)) {
          console.log('✅ extractOrphansArray: found responseData.data.data.eligible_orphans, length:', responseData.data.data.eligible_orphans.length);
          return responseData.data.data.eligible_orphans;
        }
        if (Array.isArray(responseData.data.data.orphans)) {
          console.log('✅ extractOrphansArray: found responseData.data.data.orphans, length:', responseData.data.data.orphans.length);
          return responseData.data.data.orphans;
        }
      }

      // If responseData.data is itself an array
      if (Array.isArray(responseData.data)) {
        console.log('✅ extractOrphansArray: responseData.data is an array, length:', responseData.data.length);
        return responseData.data;
      }
    }

    // ── Last resort: search all keys for any array of objects with orphan-like fields ──
    const allKeys = Object.keys(responseData);
    for (const key of allKeys) {
      if (Array.isArray(responseData[key]) && responseData[key].length > 0) {
        const firstItem = responseData[key][0];
        if (firstItem && typeof firstItem === 'object' && 
            (firstItem.orphan_id_number || firstItem.orphan_full_name || firstItem.id_number)) {
          console.log(`✅ extractOrphansArray: found orphan array at key "${key}", length:`, responseData[key].length);
          return responseData[key];
        }
      }
    }

    // Check inside .data too
    if (responseData.data && typeof responseData.data === 'object') {
      const dataKeys = Object.keys(responseData.data);
      for (const key of dataKeys) {
        if (Array.isArray(responseData.data[key]) && responseData.data[key].length > 0) {
          const firstItem = responseData.data[key][0];
          if (firstItem && typeof firstItem === 'object' && 
              (firstItem.orphan_id_number || firstItem.orphan_full_name || firstItem.id_number)) {
            console.log(`✅ extractOrphansArray: found orphan array at data."${key}", length:`, responseData.data[key].length);
            return responseData.data[key];
          }
        }
      }
    }

    console.warn('⚠️ extractOrphansArray: Could not find orphans array. Response structure:', {
      topLevelKeys: Object.keys(responseData),
      dataType: typeof responseData.data,
      dataKeys: responseData.data ? Object.keys(responseData.data) : 'N/A',
    });
    return [];
  };

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (addOrphansFilters.governorate_filter) count++;
    if (addOrphansFilters.district_filter) count++;
    if (addOrphansFilters.mother_status.length > 0) count++;
    if (addOrphansFilters.health_conditions.length > 0) count++;
    if (addOrphansFilters.gender !== 'both') count++;
    if (addOrphansFilters.enrollment_status.length > 0) count++;
    if (addOrphansFilters.age_range.min !== 0 || addOrphansFilters.age_range.max !== 12) count++;
    if (!addOrphansFilters.exclude_adopted) count++;
    if (addOrphansFilters.exclude_sponsored) count++;
    setActiveFilterCount(count);
  }, [addOrphansFilters]);

  useEffect(() => {
    if (!isAuthorized && user) {
      showError('ليس لديك صلاحيات للوصول إلى مجموعات الأيتام.');
    }
  }, [user, isAuthorized, showError]);

  // ══════════════════════════════════════════
  // DATA FETCHING FUNCTIONS
  // ══════════════════════════════════════════

  // Check sponsorship status for orphans
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

  const fetchGroupings = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/orphan-groupings');
      
      if (response.data.success) {
        const groupingsData = response.data.data?.groupings || response.data.groupings || [];
        setGroupings(Array.isArray(groupingsData) ? groupingsData : []);
      } else {
        showError('فشل في تحميل المجموعات');
      }
    } catch (err) {
      showError('حدث خطأ: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await apiClient.get('/orphan-groupings/locations');
      
      if (response.data.success) {
        const locationsData = response.data.data;
        const governorates = Array.isArray(locationsData?.governorates) ? locationsData.governorates : [];
        const districts = Array.isArray(locationsData?.districts) ? locationsData.districts : [];
        setLocations({ governorates, districts });
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err);
      setLocations({ governorates: [], districts: [] });
    }
  };

  // ══════════════════════════════════════════════════════
  // FIXED: fetchEligibleOrphans now uses extractOrphansArray
  // ══════════════════════════════════════════════════════
  const fetchEligibleOrphans = async (groupId) => {
    try {
      setIsLoadingOrphans(true);
      const response = await apiClient.get(`/orphan-groupings/${groupId}/eligible-orphans`);
      
      console.log('📡 fetchEligibleOrphans raw response:', response.data);
      
      if (response.data.success) {
        const orphansData = extractOrphansArray(response.data);
        console.log('✅ fetchEligibleOrphans extracted:', orphansData.length, 'orphans');
        setOrphans(orphansData);
        setFiltersApplied(false);
        
        // Check sponsorship status for the loaded orphans
        const orphanIds = orphansData.map(o => o.orphan_id_number || o.id_number || o.id).filter(Boolean);
        if (orphanIds.length > 0) {
          await checkSponsorshipStatus(orphanIds);
        }
      }
    } catch (err) {
      showError('حدث خطأ: ' + err.message);
    } finally {
      setIsLoadingOrphans(false);
    }
  };

  // ══════════════════════════════════════════════════════
  // FIXED: fetchGroupOrphans with robust data extraction
  // ══════════════════════════════════════════════════════
  const fetchGroupOrphans = async (groupId) => {
    // If already loaded, just toggle expansion
    if (groupOrphans[groupId] !== undefined) {
      setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
      return;
    }

    try {
      setLoadingGroupOrphans(prev => ({ ...prev, [groupId]: true }));
      setExpandedGroups(prev => ({ ...prev, [groupId]: true }));

      console.log('📡 Fetching group orphans for groupId:', groupId);
      const response = await apiClient.get(`/orphan-groupings/${groupId}/orphans`);
      
      console.log('📡 fetchGroupOrphans raw response.data:', JSON.stringify(response.data, null, 2).substring(0, 500));
      
      // Use the robust extractor
      const orphansData = extractOrphansArray(response.data);
      
      console.log('✅ fetchGroupOrphans extracted:', {
        groupId,
        count: orphansData.length,
        firstOrphan: orphansData[0]?.orphan_full_name || 'none',
      });
      
      setGroupOrphans(prev => ({ ...prev, [groupId]: orphansData }));
      
      // Check sponsorship status for the loaded orphans
      const orphanIds = orphansData.map(o => o.orphan_id_number || o.id_number || o.id).filter(Boolean);
      if (orphanIds.length > 0) {
        await checkSponsorshipStatus(orphanIds);
      }
    } catch (err) {
      console.error('❌ Error fetching group orphans:', err);
      showError('فشل في تحميل أيتام المجموعة: ' + err.message);
      setGroupOrphans(prev => ({ ...prev, [groupId]: [] }));
    } finally {
      setLoadingGroupOrphans(prev => ({ ...prev, [groupId]: false }));
    }
  };

  // ══════════════════════════════════════════════════════
  // FIXED: handleApplyFilters with robust data extraction
  // ══════════════════════════════════════════════════════
  const handleApplyFilters = async () => {
    if (!currentGroup) return;
    
    try {
      setIsLoadingOrphans(true);
      
      const params = new URLSearchParams();
      
      if (safeAddOrphansFilters.governorate_filter) {
        params.append('governorate_filter', safeAddOrphansFilters.governorate_filter);
      }
      if (safeAddOrphansFilters.district_filter) {
        params.append('district_filter', safeAddOrphansFilters.district_filter);
      }
      if (safeAddOrphansFilters.mother_status.length > 0) {
        params.append('mother_status', safeAddOrphansFilters.mother_status.join(','));
      }
      if (safeAddOrphansFilters.health_conditions.length > 0) {
        params.append('health_conditions', safeAddOrphansFilters.health_conditions.join(','));
      }
      if (safeAddOrphansFilters.gender !== 'both') {
        params.append('gender', safeAddOrphansFilters.gender);
      }
      if (safeAddOrphansFilters.enrollment_status.length > 0) {
        params.append('enrollment_status', safeAddOrphansFilters.enrollment_status.join(','));
      }
      if (safeAddOrphansFilters.age_range.min !== 0 || safeAddOrphansFilters.age_range.max !== 12) {
        params.append('age_range[min]', safeAddOrphansFilters.age_range.min);
        params.append('age_range[max]', safeAddOrphansFilters.age_range.max);
      }
      params.append('exclude_adopted', safeAddOrphansFilters.exclude_adopted);
      params.append('exclude_sponsored', safeAddOrphansFilters.exclude_sponsored);

      const queryString = params.toString();
      const url = `/orphan-groupings/${currentGroup.id}/eligible-orphans${queryString ? `?${queryString}` : ''}`;
      
      console.log('📡 handleApplyFilters URL:', url);
      
      const response = await apiClient.get(url);
      
      console.log('📡 handleApplyFilters raw response.data:', {
        success: response.data?.success,
        hasData: !!response.data?.data,
        dataKeys: response.data?.data ? Object.keys(response.data.data) : 'N/A',
        directEligible: Array.isArray(response.data?.eligible_orphans),
        nestedEligible: Array.isArray(response.data?.data?.eligible_orphans),
      });
      
      if (response.data.success) {
        const orphansData = extractOrphansArray(response.data);
        console.log('✅ handleApplyFilters extracted:', orphansData.length, 'orphans');
        
        setOrphans(orphansData);
        setFiltersApplied(true);
        success(`تم تطبيق الفلاتر - تم العثور على ${orphansData.length} يتيم`);
        
        // Check sponsorship status for the loaded orphans
        const orphanIds = orphansData.map(o => o.orphan_id_number || o.id_number || o.id).filter(Boolean);
        if (orphanIds.length > 0) {
          await checkSponsorshipStatus(orphanIds);
        }
      } else {
        showError('فشل في تطبيق الفلاتر');
      }
    } catch (err) {
      console.error('❌ handleApplyFilters error:', err);
      showError('حدث خطأ في تطبيق الفلاتر: ' + err.message);
    } finally {
      setIsLoadingOrphans(false);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setAddOrphansFilters({ ...defaultAddOrphansFilters });
    setFiltersApplied(false);
    setOrphanSearchQuery('');
    setOrphans([]);
    setSelectedOrphans([]);
  };

  const fuzzySearchOrphans = async (query) => {
    try {
      setIsLoadingOrphans(true);
      const response = await apiClient.post('/orphan-groupings/fuzzy-search', { query });
      
      if (response.data.success) {
        const orphansData = extractOrphansArray(response.data);
        setOrphans(orphansData);
        
        // Check sponsorship status for the loaded orphans
        const orphanIds = orphansData.map(o => o.orphan_id_number || o.id_number || o.id).filter(Boolean);
        if (orphanIds.length > 0) {
          await checkSponsorshipStatus(orphanIds);
        }
      }
    } catch (err) {
      showError('حدث خطأ: ' + err.message);
    } finally {
      setIsLoadingOrphans(false);
    }
  };

  // Select all visible orphans
  const handleSelectAll = () => {
    if (!currentGroup) return;
    const availableCapacity = (currentGroup.max_capacity || 0) - (currentGroup.current_count || 0);
    const remainingSlots = availableCapacity - selectedOrphans.length;
    
    if (remainingSlots <= 0) {
      showError('لا توجد سعة متاحة لإضافة المزيد');
      return;
    }
    
    const newSelected = [...selectedOrphans];
    const orphansToAdd = filteredOrphans.filter(
      orphan => !newSelected.some(o => 
        (o.orphan_id_number && o.orphan_id_number === orphan.orphan_id_number) ||
        (o.id && o.id === orphan.id)
      )
    ).slice(0, remainingSlots);
    
    setSelectedOrphans([...newSelected, ...orphansToAdd]);
    success(`تم تحديد ${orphansToAdd.length} يتيم إضافي`);
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedOrphans([]);
  };

  // Fetch initial data
  useEffect(() => {
    if (isAuthorized) {
      fetchGroupings();
      fetchLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  // Create grouping
  const handleCreateGrouping = async (e) => {
    e.preventDefault();
    
    try {
      const response = await apiClient.post('/orphan-groupings', newGrouping);
      
      if (response.data.success) {
        success('تم إنشاء المجموعة بنجاح');
        setShowCreateModal(false);
        setNewGrouping({
          name: '',
          max_capacity: 50,
          description: '',
          selection_criteria: {
            mother_status: [],
            father_status: [],
            health_conditions: [],
            governorate_filter: '',
            district_filter: '',
            age_range: { min: 0, max: 12 },
            gender: 'both',
            enrollment_status: [],
            exclude_adopted: true
          }
        });
        fetchGroupings();
      } else {
        showError('فشل في إنشاء المجموعة');
      }
    } catch (err) {
      showError('حدث خطأ: ' + err.message);
    }
  };

  // Add orphans to group
  const handleAddOrphans = async () => {
    if (!currentGroup || selectedOrphans.length === 0) {
      showError('يرجى تحديد المجموعة والأيتام المراد إضافتهم');
      return;
    }
    
    try {
      const response = await apiClient.post(`/orphan-groupings/${currentGroup.id}/add-orphans`, { 
        orphan_ids: selectedOrphans.map(o => o.orphan_id_number || o.id_number || o.id),
        notes: 'إضافة عبر الواجهة المتقدمة'
      });
      
      if (response.data.success) {
        success('تمت إضافة الأيتام بنجاح');
        setShowAddOrphansModal(false);
        setSelectedOrphans([]);
        setOrphans([]);
        setFiltersApplied(false);
        setAddOrphansFilters({ ...defaultAddOrphansFilters });
        // Clear cached data for this group
        setGroupOrphans(prev => {
          const updated = { ...prev };
          delete updated[currentGroup.id];
          return updated;
        });
        setExpandedGroups(prev => {
          const updated = { ...prev };
          delete updated[currentGroup.id];
          return updated;
        });
        fetchGroupings();
      } else {
        showError('فشل في إضافة الأيتام');
      }
    } catch (err) {
      showError('حدث خطأ: ' + err.message);
    }
  };

  const handleSmartSelect = async (groupId) => {
    try {
      if (!currentGroup) return;
      
      // Calculate available capacity 
      const availableCapacity = (currentGroup.max_capacity || 0) - (currentGroup.current_count || 0);
      const requestedCount = availableCapacity > 0 ? availableCapacity : 50;

      // Use orphans that are already visible in the list (matching current filters)
      if (safeOrphans.length > 0) {
        // Select orphans randomly from the shown results
        const resultPool = [...safeOrphans];
        // Shuffle the pool for random selection
        for (let i = resultPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [resultPool[i], resultPool[j]] = [resultPool[j], resultPool[i]];
        }
        const selected = resultPool.slice(0, requestedCount);
        setSelectedOrphans(selected);
        success(`تم تحديد ${selected.length} يتيم من النتائج الحالية`);
        return;
      }

      // If no orphans are loaded, we can still call the backend as a fallback
      setIsLoadingOrphans(true);
      const response = await apiClient.post(`/orphan-groupings/${groupId}/smart-select`, { 
        count: requestedCount,
        ...addOrphansFilters
      });
      
      if (response.data.success) {
        const selectedData = extractOrphansArray(response.data);
        setSelectedOrphans(selectedData);
        setOrphans(selectedData);
        setFiltersApplied(true);
        success(`تم جلب وتحديد ${selectedData.length} يتيم`);
      }
    } catch (err) {
      showError('حدث خطأ: ' + err.message);
    } finally {
      setIsLoadingOrphans(false);
    }
  };

  // Edit grouping
  const handleEditGrouping = (grouping) => {
    setEditingGroup({ ...grouping });
    setShowEditModal(true);
  };

  // Update grouping
  const handleUpdateGrouping = async (e) => {
    e.preventDefault();
    
    try {
      const response = await apiClient.put(`/orphan-groupings/${editingGroup.id}`, editingGroup);
      
      if (response.data.success) {
        success('تم تحديث المجموعة بنجاح');
        setShowEditModal(false);
        setEditingGroup(null);
        fetchGroupings();
      } else {
        showError('فشل في تحديث المجموعة');
      }
    } catch (err) {
      showError('حدث خطأ: ' + err.message);
    }
  };

  // Delete grouping
  const handleDeleteGrouping = async (groupingId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المجموعة؟')) {
      return;
    }
    
    try {
      const response = await apiClient.delete(`/orphan-groupings/${groupingId}`);
      
      if (response.data.success) {
        success('تم حذف المجموعة بنجاح');
        setExpandedGroups(prev => {
          const u = { ...prev }; delete u[groupingId]; return u;
        });
        setGroupOrphans(prev => {
          const u = { ...prev }; delete u[groupingId]; return u;
        });
        fetchGroupings();
      } else {
        showError('فشل في حذف المجموعة');
      }
    } catch (err) {
      showError('حدث خطأ: ' + err.message);
    }
  };

  // Filter orphans locally by search
  const filteredOrphans = orphanSearchQuery.length >= 2
    ? safeOrphans.filter(o => 
        o.orphan_full_name?.includes(orphanSearchQuery) ||
        o.current_governorate?.includes(orphanSearchQuery) ||
        o.current_district?.includes(orphanSearchQuery) ||
        o.current_address?.includes(orphanSearchQuery) ||
        o.orphan_id_number?.includes(orphanSearchQuery)
    ).filter(o => !filtersApplied || !excludeSponsored || sponsoredOrphans.size === 0 || !sponsoredOrphans.has(o.orphan_id_number || o.id_number || o.id))
    : safeOrphans.filter(o => !filtersApplied || !excludeSponsored || sponsoredOrphans.size === 0 || !sponsoredOrphans.has(o.orphan_id_number || o.id_number || o.id));

  // ══════════════════════════════════════════
  // CONDITIONAL RETURNS — AFTER ALL HOOKS
  // ══════════════════════════════════════════

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md mx-4">
          <h2 className="text-2xl font-bold text-red-600 mb-4">وصول مرفوض</h2>
          <p className="text-gray-600 mb-6">ليس لديك صلاحيات للوصول إلى هذه الصفحة.</p>
          <div className="text-sm text-gray-500">
            <p>الأدوار المخولة: <span className="font-semibold">مدير، منسق كفالات أيتام، منسق تنفيذ مشاريع</span></p>
            <p>دورك الحالي: <span className="font-semibold">{user?.role || 'غير محدد'}</span></p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Cairo, Tajawal, Arial, sans-serif' }} className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">مجموعات الأيتام المتقدمة</h1>
              <p className="text-sky-100">نظام متقدم لإدارة مجموعات الأيتام مع اختيار ذكي وتصفية دقيقة</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                إنشاء مجموعة جديدة
              </button>
              <button
                onClick={handleExportAllExcel}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all duration-300 shadow-lg"
              >
                <FileSpreadsheet className="w-4 h-4" />
                تصدير Excel (الكل)
              </button>
              <button
                onClick={() => {
                  setGroupOrphans({});
                  setExpandedGroups({});
                  fetchGroupings();
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                تحديث البيانات
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">إجمالي المجموعات</p>
                <p className="text-2xl font-bold text-gray-800">{groupings.length}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">السعة الإجمالية</p>
                <p className="text-2xl font-bold text-gray-800">{groupings.reduce((sum, g) => sum + (g.max_capacity || 0), 0)}</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">الأيتام المضافين</p>
                <p className="text-2xl font-bold text-gray-800">{groupings.reduce((sum, g) => sum + (g.current_count || 0), 0)}</p>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">السعة المتاحة</p>
                <p className="text-2xl font-bold text-gray-800">{groupings.reduce((sum, g) => sum + ((g.max_capacity || 0) - (g.current_count || 0)), 0)}</p>
              </div>
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="البحث عن مجموعات..."
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              الفلاتر
            </button>
          </div>
          
          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">جميع الحالات</option>
                <option value="active">نشط</option>
                <option value="full">ممتلئ</option>
                <option value="inactive">غير نشط</option>
              </select>
              <select
                value={filters.governorate_filter}
                onChange={(e) => setFilters(prev => ({ ...prev, governorate_filter: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">جميع المحافظات</option>
                {locations.governorates.map(gov => (
                  <option key={gov} value={gov}>{gov}</option>
                ))}
              </select>
              <select
                value={filters.district_filter}
                onChange={(e) => setFilters(prev => ({ ...prev, district_filter: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">جميع المناطق</option>
                {locations.districts.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* Groups Table                              */}
        {/* ══════════════════════════════════════════ */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم المجموعة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">السعة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالي</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الموقع</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupings.map((grouping) => {
                  const currentOrphans = safeGroupOrphans[grouping.id];
                  const orphansList = Array.isArray(currentOrphans) ? currentOrphans : [];
                  const isExpanded = expandedGroups[grouping.id];
                  const isLoadingThis = loadingGroupOrphans[grouping.id];

                  return (
                    <React.Fragment key={grouping.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <button
                              onClick={() => fetchGroupOrphans(grouping.id)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-2"
                            >
                              {isLoadingThis ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              {grouping.name}
                              {isExpanded && orphansList.length > 0 && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  {orphansList.length}
                                </span>
                              )}
                            </button>
                            {grouping.description && (
                              <div className="text-sm text-gray-500 mt-1">{grouping.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {grouping.max_capacity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            (grouping.current_count || 0) >= (grouping.max_capacity || 0)
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {grouping.current_count || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            grouping.status === 'active' ? 'bg-green-100 text-green-800' :
                            grouping.status === 'full' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {grouping.status === 'active' ? 'نشط' :
                             grouping.status === 'full' ? 'ممتلئ' :
                             grouping.status || 'غير محدد'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {grouping.governorate_filter || 'الكل'} - {grouping.district_filter || 'الكل'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleExportGroupPdf(grouping.id)}
                              disabled={isExporting}
                              className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 disabled:opacity-50"
                              title="تصدير المجموعة PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleExportGroupWord(grouping.id)}
                              disabled={isExporting}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 disabled:opacity-50"
                              title="تصدير المجموعة Word"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setCurrentGroup(grouping);
                                setShowAddOrphansModal(true);
                                setSelectedOrphans([]);
                                setOrphans([]);
                                setFiltersApplied(false);
                                
                                // Auto-populate filters from group criteria
                                const criteria = grouping.selection_criteria || {};
                                setAddOrphansFilters({
                                  ...defaultAddOrphansFilters,
                                  governorate_filter: criteria.governorate_filter || '',
                                  district_filter: criteria.district_filter || '',
                                  gender: criteria.gender || 'both',
                                  mother_status: Array.isArray(criteria.mother_status) ? criteria.mother_status : [],
                                  health_conditions: Array.isArray(criteria.health_conditions) ? criteria.health_conditions : [],
                                  enrollment_status: Array.isArray(criteria.enrollment_status) ? criteria.enrollment_status : [],
                                  exclude_adopted: criteria.exclude_adopted ?? true,
                                  age_range: criteria.age_range || { min: 0, max: 12 }
                                });
                                
                                setOrphanSearchQuery('');
                              }}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                              title="إضافة أيتام"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditGrouping(grouping)}
                              className="text-yellow-600 hover:text-yellow-900 p-1 rounded hover:bg-yellow-50"
                              title="تعديل المجموعة"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteGrouping(grouping.id)}
                              className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                              title="حذف المجموعة"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expandable orphan rows */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" className="px-6 py-4 bg-blue-50/50">
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-500" />
                                الأيتام في المجموعة ({orphansList.length})
                              </h4>

                              {isLoadingThis ? (
                                <div className="text-center py-8">
                                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                                  <p className="text-sm text-gray-500">جاري تحميل الأيتام...</p>
                                </div>
                              ) : orphansList.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {orphansList.map((orphan, idx) => (
                                    <div 
                                      key={orphan.orphan_id_number || orphan.id || idx} 
                                      className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-semibold text-gray-900">
                                            {orphan.orphan_full_name || orphan.name || 'غير معروف'}
                                          </div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            الهوية: {orphan.orphan_id_number || orphan.id_number || '-'}
                                          </div>
                                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                            <MapPin className="w-3 h-3 flex-shrink-0" />
                                            {orphan.current_address || orphan.address || orphan.current_governorate || '-'}
                                          </div>
                                          <div className="text-xs text-gray-500 mt-0.5">
                                            الجنس: {orphan.orphan_gender || orphan.gender || '-'}
                                          </div>
                                           {(orphan.orphan_birth_date || orphan.birth_date) && (
                                            <div className="text-xs text-gray-500 mt-0.5">
                                              تاريخ الميلاد: {orphan.orphan_birth_date || orphan.birth_date}
                                            </div>
                                          )}
                                            <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                                              <button
                                                onClick={() => handleDownloadPdf(orphan.orphan_id_number || orphan.id_number)}
                                                className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded text-[10px] font-bold hover:bg-red-100 transition-colors"
                                                title="تحميل PDF"
                                              >
                                                <FileText className="w-3 h-3" />
                                                PDF
                                              </button>
                                              <button
                                                onClick={() => handleDownloadWord(orphan.orphan_id_number || orphan.id_number)}
                                                className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-bold hover:bg-blue-100 transition-colors"
                                                title="تحميل Word"
                                              >
                                                <FileSpreadsheet className="w-3 h-3" />
                                                Word
                                              </button>
                                            </div>

                                         
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mr-2 flex-shrink-0">
                                          {sponsoredOrphans.has(orphan.orphan_id_number || orphan.id_number || orphan.id) && (
                                            <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full whitespace-nowrap font-medium">
                                              مكفول
                                            </span>
                                          )}
                                          {(orphan.is_mother_deceased === 'نعم' || orphan.is_mother_deceased === true) && (
                                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                              الأم متوفاة
                                            </span>
                                          )}
                                          {(orphan.health_status === 'مريض' || orphan.health_status === 'sick') && (
                                            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                            الحالة الصحية
                                            </span>
                                          )}
                                          {(orphan.is_enrolled_in_memorization_center === 'نعم' || orphan.is_enrolled_in_memorization_center === true) && (
                                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                              تحفيظ
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <UserX className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                  <p className="text-sm text-gray-500 font-medium">لا توجد أيتام في هذه المجموعة</p>
                                  <p className="text-xs text-gray-400 mt-1">يمكنك إضافة أيتام بالضغط على زر الإضافة</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {groupings.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 font-medium">لا توجد مجموعات حالياً</p>
            </div>
          )}
        </div>

        {/* Create Grouping Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl mx-4 w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">إنشاء مجموعة جديدة</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleCreateGrouping} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">اسم المجموعة *</label>
                    <input
                      type="text"
                      value={newGrouping.name}
                      onChange={(e) => setNewGrouping(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="أدخل اسم المجموعة"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">السعة القصوى *</label>
                    <input
                      type="number"
                      value={newGrouping.max_capacity}
                      onChange={(e) => setNewGrouping(prev => ({ ...prev, max_capacity: parseInt(e.target.value) || 50 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="1" max="1000" required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
                  <textarea
                    value={newGrouping.description}
                    onChange={(e) => setNewGrouping(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows="3" placeholder="أدخل وصف المجموعة"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">فلتر المحافظة</label>
                    <select
                      value={newGrouping.selection_criteria.governorate_filter}
                      onChange={(e) => setNewGrouping(prev => ({ 
                        ...prev, 
                        selection_criteria: { ...prev.selection_criteria, governorate_filter: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">جميع المحافظات</option>
                      {Array.isArray(locations.governorates) && locations.governorates.map(gov => (
                        <option key={gov} value={gov}>{gov}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">فلتر المنطقة</label>
                    <select
                      value={newGrouping.selection_criteria.district_filter}
                      onChange={(e) => setNewGrouping(prev => ({ 
                        ...prev, 
                        selection_criteria: { ...prev.selection_criteria, district_filter: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">جميع المناطق</option>
                      {Array.isArray(locations.districts) && locations.districts.map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold">
                    إنشاء مجموعة
                  </button>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg font-semibold">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* Add Orphans Modal                         */}
        {/* ══════════════════════════════════════════ */}
        {showAddOrphansModal && currentGroup && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
              
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    إضافة أيتام إلى مجموعة: {currentGroup.name}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    السعة المتاحة: {(currentGroup.max_capacity || 0) - (currentGroup.current_count || 0)} من {currentGroup.max_capacity}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddOrphansModal(false);
                    setOrphans([]);
                    setSelectedOrphans([]);
                    setFiltersApplied(false);
                    setAddOrphansFilters({ ...defaultAddOrphansFilters });
                  }}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                
                {/* Step 1: Filters */}
                <div className="border-2 border-blue-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3.5 flex items-center justify-between hover:from-blue-100 hover:to-indigo-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <SlidersHorizontal className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-gray-800 text-base">الخطوة ١: تحديد معايير التصفية</span>
                        <p className="text-xs text-gray-500 mt-0.5">اختر الفلاتر ثم اضغط "تطبيق الفلاتر" لعرض الأيتام المطابقين</p>
                      </div>
                      {activeFilterCount > 0 && (
                        <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          {activeFilterCount} فلتر نشط
                        </span>
                      )}
                    </div>
                    {showAdvancedFilters ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                  </button>

                  {showAdvancedFilters && (
                    <div className="p-5 bg-gray-50/50 space-y-5">
                      
                      {/* Location */}
                      <div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-500" />
                          الموقع الجغرافي
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">المحافظة</label>
                            <select
                              value={addOrphansFilters.governorate_filter}
                              onChange={(e) => setAddOrphansFilters(prev => ({ ...prev, governorate_filter: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm"
                            >
                              <option value="">جميع المحافظات</option>
                              <option value="محافظة رفح">محافظة رفح</option>
                              <option value="محافظة خانيونس">محافظة خانيونس</option>
                              <option value="محافظة الوسطى">محافظة الوسطى</option>
                              <option value="محافظة غزة">محافظة غزة</option>
                              <option value="محافظة الشمال">محافظة الشمال</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">المنطقة / الحي</label>
                            <input
                              type="text"
                              value={addOrphansFilters.district_filter}
                              onChange={(e) => setAddOrphansFilters(prev => ({ ...prev, district_filter: e.target.value }))}
                              placeholder="اكتب اسم المنطقة..."
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Demographics */}
                      <div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-500" />
                          البيانات الديموغرافية
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">الجنس</label>
                            <select
                              value={addOrphansFilters.gender}
                              onChange={(e) => setAddOrphansFilters(prev => ({ ...prev, gender: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm"
                            >
                              <option value="both">الجميع</option>
                              <option value="male">ذكر</option>
                              <option value="female">أنثى</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">العمر من</label>
                            <input
                              type="number"
                              value={addOrphansFilters.age_range.min}
                              onChange={(e) => setAddOrphansFilters(prev => ({ ...prev, age_range: { ...prev.age_range, min: parseInt(e.target.value) || 0 } }))}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm"
                              min="0" max="12"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">العمر إلى</label>
                            <input
                              type="number"
                              value={addOrphansFilters.age_range.max}
                              onChange={(e) => setAddOrphansFilters(prev => ({ ...prev, age_range: { ...prev.age_range, max: parseInt(e.target.value) || 12 } }))}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm"
                              min="0" max="12"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Status */}
                      <div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Heart className="w-4 h-4 text-red-500" />
                          الحالة العائلية
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <label className="block text-xs font-medium text-gray-600 mb-2">حالة الأم</label>
                            <div className="space-y-2">
                              {['deceased', 'alive'].map(status => (
                                <label key={status} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={safeAddOrphansFilters.mother_status.includes(status)}
                                    onChange={(e) => {
                                      setAddOrphansFilters(prev => ({
                                        ...prev,
                                        mother_status: e.target.checked
                                          ? [...(prev.mother_status || []).filter(s => s !== status), status]
                                          : (prev.mother_status || []).filter(s => s !== status)
                                      }));
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                  />
                                  <span className="text-sm text-gray-700">{status === 'deceased' ? 'متوفاة' : 'على قيد الحياة'}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <label className="block text-xs font-medium text-gray-600 mb-2"> الحالة الصحية</label>
                            <div className="space-y-2">
                              {['healthy', 'sick'].map(condition => (
                                <label key={condition} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={safeAddOrphansFilters.health_conditions.includes(condition)}
                                    onChange={(e) => {
                                      const conditions = [...safeAddOrphansFilters.health_conditions];
                                      if (e.target.checked) {
                                        conditions.push(condition);
                                      } else {
                                        const idx = conditions.indexOf(condition);
                                        if (idx > -1) conditions.splice(idx, 1);
                                      }
                                      setAddOrphansFilters(prev => ({ ...prev, health_conditions: conditions }));
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                  />
                                  <span className="text-sm text-gray-700">{condition === 'healthy' ? 'جيدة' : 'مريض'}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <label className="block text-xs font-medium text-gray-600 mb-2">حالة الالتحاق</label>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={safeAddOrphansFilters.enrollment_status.includes('enrolled')}
                                  onChange={(e) => {
                                    setAddOrphansFilters(prev => ({
                                      ...prev,
                                      enrollment_status: e.target.checked ? ['enrolled'] : []
                                    }));
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                />
                                <span className="text-sm text-gray-700">ملتحق بمراكز التحفيظ</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={addOrphansFilters.exclude_sponsored}
                                  onChange={(e) => setAddOrphansFilters(prev => ({ ...prev, exclude_sponsored: e.target.checked }))}
                                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                />
                                <span className="text-sm text-gray-700">استبعاد المكفولين</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Active filter tags */}
                      {activeFilterCount > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {addOrphansFilters.governorate_filter && (
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                              <MapPin className="w-3 h-3" /> {addOrphansFilters.governorate_filter}
                              <button onClick={() => setAddOrphansFilters(prev => ({ ...prev, governorate_filter: '' }))}><X className="w-3 h-3" /></button>
                            </span>
                          )}
                          {addOrphansFilters.district_filter && (
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                              <MapPin className="w-3 h-3" /> {addOrphansFilters.district_filter}
                              <button onClick={() => setAddOrphansFilters(prev => ({ ...prev, district_filter: '' }))}><X className="w-3 h-3" /></button>
                            </span>
                          )}
                          {addOrphansFilters.gender !== 'both' && (
                            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full">
                              {addOrphansFilters.gender === 'male' ? 'ذكر' : 'أنثى'}
                              <button onClick={() => setAddOrphansFilters(prev => ({ ...prev, gender: 'both' }))}><X className="w-3 h-3" /></button>
                            </span>
                          )}
                          {safeAddOrphansFilters.mother_status.length > 0 && (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full">
                              الأم: {safeAddOrphansFilters.mother_status.map(s => s === 'deceased' ? 'متوفاة' : 'على قيد الحياة').join(', ')}
                              <button onClick={() => setAddOrphansFilters(prev => ({ ...prev, mother_status: [] }))}><X className="w-3 h-3" /></button>
                            </span>
                          )}
                          {safeAddOrphansFilters.health_conditions.length > 0 && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-full">
                              <Activity className="w-3 h-3" />
                              {safeAddOrphansFilters.health_conditions.map(c => c === 'healthy' ? 'جيدة' : 'مريض').join(', ')}
                              <button onClick={() => setAddOrphansFilters(prev => ({ ...prev, health_conditions: [] }))}><X className="w-3 h-3" /></button>
                            </span>
                          )}
                          {addOrphansFilters.exclude_sponsored && (
                            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full">
                              <Heart className="w-3 h-3" />
                              مستبعاد المكفولين
                              <button onClick={() => setAddOrphansFilters(prev => ({ ...prev, exclude_sponsored: false }))}><X className="w-3 h-3" /></button>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Filter buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-gray-200">
                        <button
                          onClick={handleApplyFilters}
                          disabled={isLoadingOrphans}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                        >
                          {isLoadingOrphans ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                          {isLoadingOrphans ? 'جاري البحث...' : 'تطبيق الفلاتر وعرض النتائج'}
                        </button>
                        <button
                          onClick={handleResetFilters}
                          className="px-6 py-3 border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          إعادة تعيين
                        </button>
                        <button
                          onClick={() => handleSmartSelect(currentGroup.id)}
                          disabled={isLoadingOrphans}
                          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                          title={`تحديد تلقائي لـ ${(currentGroup.max_capacity || 0) - (currentGroup.current_count || 0)} يتيم`}
                        >
                          <Sparkles className="w-4 h-4" />
                          اختيار ذكي (استكمال السعة)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 2: Results */}
                <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <span className="font-bold text-gray-800 text-base">الخطوة ٢: اختيار الأيتام</span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {filtersApplied 
                            ? `تم العثور على ${safeOrphans.length} يتيم مطابق للفلاتر` 
                            : 'قم بتطبيق الفلاتر أولاً لعرض الأيتام المتاحين'
                          }
                        </p>
                      </div>
                    </div>
                    {safeOrphans.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button onClick={handleSelectAll} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium">
                          تحديد الكل
                        </button>
                        <button onClick={handleDeselectAll} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium">
                          إلغاء التحديد
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Search within results */}
                  {safeOrphans.length > 0 && (
                    <div className="px-5 py-3 border-b border-gray-200 bg-white">
                      <div className="flex gap-4">
                        <div className="relative flex-1">
                          <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={orphanSearchQuery}
                            onChange={(e) => setOrphanSearchQuery(e.target.value)}
                            placeholder="البحث في النتائج بالاسم أو المنطقة..."
                            className="w-full pr-9 pl-4 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                          <input
                            type="checkbox"
                            checked={excludeSponsored}
                            onChange={(e) => setExcludeSponsored(e.target.checked)}
                            className="w-4 h-4 text-purple-600 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700 font-medium">استبعاد المكفولين</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Results */}
                  <div className="bg-white">
                    {!filtersApplied && safeOrphans.length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Filter className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium text-lg mb-2">لم يتم تطبيق فلاتر بعد</p>
                        <p className="text-gray-400 text-sm max-w-md mx-auto">
                          حدد معايير التصفية ثم اضغط "تطبيق الفلاتر وعرض النتائج"
                        </p>
                      </div>
                    ) : isLoadingOrphans ? (
                      <div className="py-16 text-center">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">جاري البحث عن الأيتام المطابقين...</p>
                      </div>
                    ) : filtersApplied && safeOrphans.length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <UserX className="w-8 h-8 text-yellow-500" />
                        </div>
                        <p className="text-gray-500 font-medium text-lg mb-2">لا توجد نتائج</p>
                        <p className="text-gray-400 text-sm">جرّب تغيير معايير التصفية</p>
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {/* Results count */}
                        <div className="px-5 py-2 bg-blue-50 text-xs text-blue-700 font-medium">
                          عرض {filteredOrphans.length} من {safeOrphans.length} يتيم | تم تحديد {selectedOrphans.length}
                        </div>
                        
                        {filteredOrphans.map((orphan, idx) => {
                          const orphanKey = orphan.orphan_id_number || orphan.id || idx;
                          const isSelected = selectedOrphans.some(o => 
                            (o.orphan_id_number && o.orphan_id_number === orphan.orphan_id_number) ||
                            (o.id && o.id === orphan.id)
                          );
                          
                          return (
                            <label 
                              key={orphanKey}
                              className={`flex items-center p-4 cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedOrphans(prev => [...prev, orphan]);
                                  } else {
                                    setSelectedOrphans(prev => prev.filter(o => 
                                      !(o.orphan_id_number === orphan.orphan_id_number || o.id === orphan.id)
                                    ));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 ml-4 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-900">
                                  {orphan.orphan_full_name || orphan.name || 'غير معروف'}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  الهوية: {orphan.orphan_id_number || orphan.id_number || '-'}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {orphan.current_address || orphan.current_governorate || '-'}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  الجنس: {orphan.orphan_gender || orphan.gender || '-'}
                                </div>
                                {(orphan.orphan_birth_date || orphan.birth_date) && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    تاريخ الميلاد: {orphan.orphan_birth_date || orphan.birth_date}
                                  </div>
                                )}
                                {orphan.guardian_full_name && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    الوصي: {orphan.guardian_full_name}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 mr-3 flex-shrink-0">
                                {sponsoredOrphans.has(orphan.orphan_id_number || orphan.id_number || orphan.id) && (
                                  <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">مكفول</span>
                                )}
                                {(orphan.is_mother_deceased === 'نعم' || orphan.is_mother_deceased === true) && (
                                  <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">الأم متوفاة</span>
                                )}
                                {orphan.health_status && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                    orphan.health_status === 'جيدة' || orphan.health_status === 'healthy'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : orphan.health_status === 'مريض' || orphan.health_status === 'sick'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {orphan.health_status}
                                  </span>
                                )}
                                {(orphan.is_enrolled_in_memorization_center === 'نعم' || orphan.is_enrolled_in_memorization_center === true) && (
                                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">تحفيظ</span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${selectedOrphans.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-sm font-semibold text-gray-700">
                        تم تحديد: <span className="text-blue-600">{selectedOrphans.length}</span> يتيم
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs text-gray-500">
                      السعة المتاحة: {(currentGroup.max_capacity || 0) - (currentGroup.current_count || 0)}
                    </span>
                  </div>
                  {selectedOrphans.length > ((currentGroup.max_capacity || 0) - (currentGroup.current_count || 0)) && (
                    <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                      <X className="w-3 h-3" />
                      عدد المحددين يتجاوز السعة المتاحة!
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleAddOrphans}
                    disabled={selectedOrphans.length === 0 || selectedOrphans.length > ((currentGroup.max_capacity || 0) - (currentGroup.current_count || 0))}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserCheck className="w-5 h-5" />
                    إضافة {selectedOrphans.length} يتيم للمجموعة
                  </button>
                  <button
                    onClick={() => {
                      setShowAddOrphansModal(false);
                      setOrphans([]);
                      setSelectedOrphans([]);
                      setFiltersApplied(false);
                      setAddOrphansFilters({ ...defaultAddOrphansFilters });
                    }}
                    className="px-6 py-3 border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl font-semibold text-sm"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Grouping Modal */}
        {showEditModal && editingGroup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl mx-4 w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">تعديل مجموعة: {editingGroup.name}</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleUpdateGrouping} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">اسم المجموعة *</label>
                    <input
                      type="text"
                      value={editingGroup.name || ''}
                      onChange={(e) => setEditingGroup(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">السعة القصوى *</label>
                    <input
                      type="number"
                      value={editingGroup.max_capacity || 50}
                      onChange={(e) => setEditingGroup(prev => ({ ...prev, max_capacity: parseInt(e.target.value) || 50 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="1" max="1000" required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
                  <textarea
                    value={editingGroup.description || ''}
                    onChange={(e) => setEditingGroup(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows="3"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">فلتر المحافظة</label>
                    <select
                      value={editingGroup.selection_criteria?.governorate_filter || ''}
                      onChange={(e) => setEditingGroup(prev => ({ 
                        ...prev, selection_criteria: { ...(prev.selection_criteria || {}), governorate_filter: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">جميع المحافظات</option>
                      {Array.isArray(locations.governorates) && locations.governorates.map(gov => (
                        <option key={gov} value={gov}>{gov}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">فلتر المنطقة</label>
                    <select
                      value={editingGroup.selection_criteria?.district_filter || ''}
                      onChange={(e) => setEditingGroup(prev => ({ 
                        ...prev, selection_criteria: { ...(prev.selection_criteria || {}), district_filter: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">جميع المناطق</option>
                      {Array.isArray(locations.districts) && locations.districts.map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold">
                    تحديث المجموعة
                  </button>
                  <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg font-semibold">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Export Excel Modal */}
        <OrphanExportExcelModal 
          isOpen={showExportExcelModal}
          onClose={() => setShowExportExcelModal(false)}
          onExport={handlePerformExcelExport}
        />
      </div>
    </div>
  );
};

export default OrphanGroupingsAdvanced;