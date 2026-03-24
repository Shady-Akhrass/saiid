import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import {
  Users,
  Upload,
  Download,
  FileSpreadsheet,
  Calendar,
  Home,
  Package,
  Search,
  Loader2,
  Eye,
  AlertCircle,
  X,
  Trash2,
  Filter,
  BarChart3,
  CheckCircle,
  FileDown,
} from 'lucide-react';
import PageLoader from '../../../components/PageLoader';
import ConfirmDialog from '../../../components/ConfirmDialog';

// ✅ Constants
const EXECUTED_STATUSES = [
  'تم التنفيذ',
  'منفذ',
  'في المونتاج',
  'تم المونتاج',
  'معاد مونتاجه',
  'وصل للمتبرع'
];

const FILE_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BENEFICIARIES_COUNT_DEBOUNCE = 300; // ms
const BATCH_SIZE = 20;

// ✅ Helper Functions
const isServerError = (status) => status >= 500 && status < 600;
const shouldUseFallback = (status) => status === 404 || isServerError(status);

const extractProjectsFromResponse = (response) => {
  if (Array.isArray(response.data?.projects)) {
    return response.data.projects;
  }
  if (Array.isArray(response.data?.data?.data)) {
    return response.data.data.data;
  }
  if (Array.isArray(response.data?.data)) {
    return response.data.data;
  }
  return [];
};

const getCampName = (project) => {
  return (
    project.shelter?.camp_name ||
    project.camp_name ||
    project.camp?.name ||
    project.camp_name_ar ||
    project.shelter_name ||
    'غير محدد'
  );
};

const getAidType = (project) => {
  return project.subcategory?.name_ar || project.subcategory_name_ar || 'غير محدد';
};

const getQuantity = (project) => {
  if (project.quantity !== undefined && project.quantity !== null) {
    return project.quantity;
  }
  if (project.total_quantity !== undefined && project.total_quantity !== null) {
    return project.total_quantity;
  }
  if (project.amount !== undefined && project.amount !== null) {
    return project.amount;
  }
  if (project.total_amount !== undefined && project.total_amount !== null) {
    return project.total_amount;
  }
  return null;
};

const formatDate = (date) => {
  if (!date) return 'غير محدد';
  try {
    const dateObj = new Date(date);
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(dateObj);
  } catch {
    return date;
  }
};

const formatQuantity = (project) => {
  const quantity = getQuantity(project);
  if (quantity === null || quantity === undefined) {
    if (import.meta.env.DEV) {
      const quantityFields = Object.keys(project).filter(
        k => k.includes('quantity') || k.includes('amount')
      );
      console.warn('⚠️ No quantity found for project:', {
        id: project.id,
        name: project.project_name,
        availableFields: quantityFields,
        allFields: Object.keys(project),
        projectData: project
      });
    }
    return '-';
  }
  return new Intl.NumberFormat('ar-EG').format(quantity);
};

const logDev = (message, data = {}) => {
  if (import.meta.env.DEV) {
    console.log(message, data);
  }
};

const warnDev = (message, data = {}) => {
  if (import.meta.env.DEV) {
    console.warn(message, data);
  }
};

const errorDev = (message, data = {}) => {
  if (import.meta.env.DEV) {
    console.error(message, data);
  }
};

const BeneficiariesManagement = () => {
  const { user } = useAuth();

  // ✅ State Management
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('executed');
  const [uploadingFile, setUploadingFile] = useState({});
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [beneficiariesCount, setBeneficiariesCount] = useState({});
  const [selectedProject, setSelectedProject] = useState(null);
  const [showBeneficiariesModal, setShowBeneficiariesModal] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState({});

  // ✅ User Role Detection
  const userRole = useMemo(() => {
    return (
      user?.role?.toLowerCase?.() ||
      user?.userRole?.toLowerCase?.() ||
      user?.user_role?.toLowerCase?.() ||
      user?.role_name?.toLowerCase?.() ||
      user?.role || ''
    );
  }, [user]);

  const isAdmin = useMemo(() => {
    return ['admin', 'administrator', 'مدير', 'مدير عام'].includes(userRole);
  }, [userRole]);

  const isExecutedCoordinator = useMemo(() => {
    return [
      'executed_projects_coordinator',
      'executedprojectscoordinator',
      'منسق المشاريع المنفذة',
      'منسق مشاريع منفذة'
    ].includes(userRole);
  }, [userRole]);

  const canUpload = isAdmin || isExecutedCoordinator;
  const canDelete = isAdmin || isExecutedCoordinator;

  // ✅ Fetch Projects
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);

      const params = {
        per_page: 10000,
        perPage: 10000,
        page: 1,
        _t: Date.now(),
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      // ✅ Add parameters based on user role
      if (isAdmin) {
        Object.assign(params, {
          include_executed: true,
          include_all_statuses: true,
          include_delivered_to_donor: true,
          include_non_divided: true,
          include_monthly_phases: true,
        });
      } else if (isExecutedCoordinator) {
        Object.assign(params, {
          include_executed: true,
          include_all_statuses: true,
          include_non_divided: true,
          include_monthly_phases: true,
        });
      }

      logDev('🔍 Fetching projects for beneficiaries with params:', params);

      let allProjects = [];

      // ✅ Use standard endpoint directly (more reliable)
      try {
        const response = await apiClient.get('/project-proposals', {
          params,
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (response.data.success) {
          allProjects = extractProjectsFromResponse(response);
          logDev(`✅ Fetched ${allProjects.length} projects`);
          logDev('📊 Projects statuses:', [...new Set(allProjects.map(p => p.status))]);

          if (allProjects.length > 0) {
            logDev('📦 Sample project data:', {
              id: allProjects[0].id,
              name: allProjects[0].project_name,
              quantity: allProjects[0].quantity,
              allKeys: Object.keys(allProjects[0])
            });
          }
        }
      } catch (fetchError) {
        const status = fetchError.response?.status;
        errorDev('Error fetching projects:', {
          status,
          message: fetchError.response?.data?.message || fetchError.message,
        });
        
        // Only show error if it's not a 404 or server error (those are handled gracefully)
        if (status && status !== 404 && !isServerError(status)) {
          toast.error('حدث خطأ أثناء جلب المشاريع');
        }
        throw fetchError;
      }

      logDev('📥 Total projects fetched (raw):', allProjects.length);
      logDev('📥 Projects statuses (raw):', [...new Set(allProjects.map(p => p.status))]);

      // ✅ Filter projects by status
      let projectsData = allProjects;

      if (statusFilter === 'executed' || statusFilter === 'all') {
        projectsData = allProjects.filter(project =>
          EXECUTED_STATUSES.includes(project.status)
        );
      } else if (statusFilter === 'completed') {
        projectsData = allProjects.filter(project =>
          project.status === 'وصل للمتبرع'
        );
      }

      logDev('🔍 Status filter:', statusFilter);
      logDev('📥 Projects after filter:', projectsData.length);

      // ✅ Sort by execution date
      projectsData.sort((a, b) => {
        const dateA = new Date(a.execution_date || a.executed_at || a.created_at || 0);
        const dateB = new Date(b.execution_date || b.executed_at || b.created_at || 0);
        return dateB - dateA;
      });

      setProjects(projectsData);
    } catch (error) {
      errorDev('Error fetching projects:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        error: error.response?.data,
      });

      const errorStatus = error.response?.status;
      if (!shouldUseFallback(errorStatus)) {
        toast.error('حدث خطأ أثناء جلب المشاريع');
      }

      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, searchQuery, isAdmin, isExecutedCoordinator]);

  // ✅ Fetch Beneficiaries Counts
  const fetchBeneficiariesCounts = useCallback(async () => {
    if (projects.length === 0) {
      setBeneficiariesCount({});
      return;
    }

    try {
      const projectIds = projects.map(p => p.id);
      const response = await apiClient.post('/beneficiaries/counts', {
        project_ids: projectIds,
      });

      if (response.data.success) {
        setBeneficiariesCount(response.data.data || {});
        logDev(`✅ Fetched beneficiaries counts for ${projectIds.length} projects in one request`);
      } else {
        await fetchBeneficiariesCountsFallback();
      }
    } catch (error) {
      warnDev('⚠️ Beneficiaries counts endpoint failed, using fallback method...', error);
      await fetchBeneficiariesCountsFallback();
    }
  }, [projects]);

  // ✅ Fallback: Fetch counts using batch processing
  const fetchBeneficiariesCountsFallback = useCallback(async () => {
    const counts = {};

    for (let i = 0; i < projects.length; i += BATCH_SIZE) {
      const batch = projects.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (project) => {
        try {
          const response = await apiClient.get(`/project-proposals/${project.id}/beneficiaries`, {
            timeout: 3000,
          });
          if (response.data.success) {
            counts[project.id] = response.data.data?.length || response.data.count || 0;
          } else {
            counts[project.id] = 0;
          }
        } catch (error) {
          const status = error.response?.status;
          if (status !== 404 && status !== 408) {
            errorDev(`Error fetching beneficiaries for project ${project.id}:`, error);
          }
          counts[project.id] = 0;
        }
      });

      await Promise.allSettled(promises);
      setBeneficiariesCount({ ...counts });
    }

    setBeneficiariesCount(counts);
  }, [projects]);

  // ✅ Fetch Beneficiaries for a project
  const fetchBeneficiaries = useCallback(async (projectId) => {
    try {
      setLoadingBeneficiaries(true);
      const response = await apiClient.get(`/project-proposals/${projectId}/beneficiaries`);

      if (response.data.success) {
        setBeneficiaries(response.data.data || []);
        setShowBeneficiariesModal(true);
      }
    } catch (error) {
      errorDev('Error fetching beneficiaries:', error);
      toast.error('حدث خطأ أثناء جلب المستفيدين');
    } finally {
      setLoadingBeneficiaries(false);
    }
  }, []);

  // ✅ Filter Projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => {
        const projectName = (project.project_name || project.name || project.description || '').toLowerCase();
        const donorCode = (project.donor_code || project.internal_code || '').toLowerCase();
        const campName = getCampName(project).toLowerCase();
        const subcategory = getAidType(project).toLowerCase();

        return (
          projectName.includes(query) ||
          donorCode.includes(query) ||
          campName.includes(query) ||
          subcategory.includes(query)
        );
      });
    }

    return filtered;
  }, [projects, searchQuery]);

  // ✅ File Upload Handlers
  const handleFileChange = useCallback((projectId, e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const fileExtension = selectedFile.name.toLowerCase().substring(
      selectedFile.name.lastIndexOf('.')
    );

    if (!FILE_EXTENSIONS.includes(fileExtension)) {
      toast.error('يجب أن يكون الملف بصيغة Excel (xlsx, xls, csv)');
      e.target.value = '';
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error('حجم الملف يجب أن يكون أقل من 10 ميجابايت');
      e.target.value = '';
      return;
    }

    setUploadingFile(prev => ({ ...prev, [projectId]: selectedFile }));
  }, []);

  const handleUpload = useCallback(async (projectId) => {
    const file = uploadingFile?.[projectId];
    if (!file) {
      toast.error('يرجى اختيار ملف Excel');
      return;
    }

    const project = projects.find(p => p.id === projectId);
    if (!EXECUTED_STATUSES.includes(project?.status)) {
      toast.error('يمكن رفع ملف Excel فقط للمشاريع في حالة "تم التنفيذ" أو ما بعدها');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(
        `/project-proposals/${projectId}/beneficiaries/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      if (response.data.success) {
        toast.success(`تم رفع الملف بنجاح! تم استيراد ${response.data.imported_count} مستفيد`);

        setUploadingFile(prev => {
          const newState = { ...prev };
          delete newState[projectId];
          return newState;
        });

        const fileInput = document.getElementById(`file-input-${projectId}`);
        if (fileInput) fileInput.value = '';

        setBeneficiariesCount(prev => ({
          ...prev,
          [projectId]: response.data.imported_count || prev[projectId] || 0,
        }));

        await fetchProjects();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        'حدث خطأ أثناء رفع الملف';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  }, [uploadingFile, projects, fetchProjects]);

  // ✅ Download Template
  const handleDownloadTemplate = useCallback(async (projectId) => {
    setDownloadingTemplate(prev => ({ ...prev, [projectId]: true }));
    
    try {
      const response = await apiClient.get(
        `/project-proposals/${projectId}/beneficiaries/template`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `beneficiaries_template_project_${projectId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('✅ تم تنزيل القالب بنجاح! يمكنك الآن ملؤه بالبيانات ثم رفعه.');
    } catch (error) {
      const errorMessage = error.response?.data?.message || 
        error.response?.data?.error || 
        'حدث خطأ أثناء تنزيل القالب';
      toast.error(errorMessage);
      errorDev('Error downloading template:', error);
    } finally {
      setDownloadingTemplate(prev => ({ ...prev, [projectId]: false }));
    }
  }, []);

  // ✅ Export Beneficiaries
  const handleExport = useCallback(async (projectId) => {
    try {
      const response = await apiClient.get(
        `/project-proposals/${projectId}/beneficiaries/export`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `beneficiaries_project_${projectId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('تم تصدير الملف بنجاح');
    } catch (error) {
      errorDev('Error exporting beneficiaries:', error);
      toast.error('حدث خطأ أثناء تصدير الملف');
    }
  }, []);

  // ✅ Delete Beneficiaries
  const handleDelete = useCallback(async (projectId) => {
    setDeleting(true);

    try {
      const response = await apiClient.delete(`/project-proposals/${projectId}/beneficiaries`);

      if (response.data.success) {
        toast.success(`تم حذف ${response.data.deleted_count} مستفيد بنجاح`);
        setBeneficiariesCount(prev => ({
          ...prev,
          [projectId]: 0,
        }));
        setShowDeleteConfirm(null);
        await fetchProjects();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        'حدث خطأ أثناء حذف المستفيدين';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  }, [fetchProjects]);

  // ✅ Effects
  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, statusFilter, fetchProjects]);

  useEffect(() => {
    if (projects.length === 0) {
      setBeneficiariesCount({});
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchBeneficiariesCounts();
    }, BENEFICIARIES_COUNT_DEBOUNCE);

    return () => clearTimeout(timeoutId);
  }, [projects, fetchBeneficiariesCounts]);

  // ✅ Statistics
  const statistics = useMemo(() => {
    const totalProjects = filteredProjects.length;
    const projectsWithFile = Object.values(beneficiariesCount).filter(count => count > 0).length;
    const totalBeneficiaries = Object.values(beneficiariesCount).reduce((sum, count) => sum + count, 0);
    const projectsWithoutFile = totalProjects - projectsWithFile;

    return {
      totalProjects,
      projectsWithFile,
      totalBeneficiaries,
      projectsWithoutFile,
    };
  }, [filteredProjects, beneficiariesCount]);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">إدارة المستفيدين</h1>
                <p className="text-gray-500 mt-1">إدارة ملفات Excel للمستفيدين من جميع المشاريع</p>
              </div>
            </div>
          </div>

          {/* Filters */ }
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="ابحث عن مشروع (اسم، كود متبرع، مخيم، نوع مساعدة)..."
                value={ searchQuery }
                onChange={ (e) => setSearchQuery(e.target.value) }
                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            <div className="relative">
              <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={ statusFilter }
                onChange={ (e) => setStatusFilter(e.target.value) }
                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">جميع المشاريع</option>
                <option value="executed">المشاريع المنفذة</option>
                <option value="completed">وصل للمتبرع</option>
              </select>
            </div>
          </div>
        </div>

        {/* Statistics Cards */ }
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">إجمالي المشاريع</p>
                <p className="text-2xl font-bold text-gray-800">{ statistics.totalProjects }</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">مشاريع مع ملف Excel</p>
                <p className="text-2xl font-bold text-green-600">{ statistics.projectsWithFile }</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">إجمالي المستفيدين</p>
                <p className="text-2xl font-bold text-sky-600">
                  { statistics.totalBeneficiaries.toLocaleString('ar-EG') }
                </p>
              </div>
              <Users className="w-8 h-8 text-sky-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">مشاريع بدون ملف</p>
                <p className="text-2xl font-bold text-orange-600">{ statistics.projectsWithoutFile }</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Projects List */ }
        { filteredProjects.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium mb-2">
              { searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد مشاريع' }
            </p>
            { !searchQuery && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-right">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>ملاحظة:</strong> هذه الصفحة تعرض المشاريع في الحالات التالية:
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  { EXECUTED_STATUSES.map(status => (
                    <li key={ status }>{ status }</li>
                  )) }
                </ul>
                { import.meta.env.DEV && (
                  <p className="text-xs text-blue-600 mt-3 pt-3 border-t border-blue-200">
                    💡 في وضع التطوير: تحقق من أن هناك مشاريع في قاعدة البيانات بهذه الحالات، وأن المستخدم لديه صلاحيات لجلبها.
                  </p>
                ) }
              </div>
            ) }
          </div>
        ) : (
          <div className="space-y-4">
            { filteredProjects.map((project) => {
              const hasBeneficiaries = beneficiariesCount[project.id] > 0;
              const canUploadForProject = canUpload && EXECUTED_STATUSES.includes(project.status);
              const projectName = project.project_name || project.name || project.description || `مشروع #${project.id}`;

              return (
                <div
                  key={ project.id }
                  className={ `bg-white rounded-2xl p-6 shadow-lg border-2 transition-all ${hasBeneficiaries ? 'border-green-200' : 'border-gray-200'
                    } hover:shadow-xl` }
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Project Info */ }
                    <div className="lg:col-span-8 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-800">{ projectName }</h3>
                            <span
                              className={ `px-3 py-1 rounded-full text-xs font-medium ${project.status === 'تم التنفيذ' || project.status === 'منفذ'
                                ? 'bg-green-100 text-green-700'
                                : project.status === 'وصل للمتبرع'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                                }` }
                            >
                              { project.status }
                            </span>
                            { hasBeneficiaries && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-700 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                { beneficiariesCount[project.id] } مستفيد
                              </span>
                            ) }
                          </div>
                          { project.donor_code && (
                            <p className="text-sm text-gray-500 mb-2">كود المتبرع: { project.donor_code }</p>
                          ) }
                        </div>
                        <Link
                          to={ `/project-management/projects/${project.id}` }
                          className="px-4 py-2 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>عرض التفاصيل</span>
                        </Link>
                      </div>

                      {/* Project Details Grid */ }
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Calendar className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-xs text-gray-500">تاريخ التنفيذ</p>
                            <p className="text-sm font-semibold text-gray-800">
                              { formatDate(project.execution_date || project.executed_at || project.updated_at) }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Home className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-xs text-gray-500">اسم المخيم</p>
                            <p className="text-sm font-semibold text-gray-800">{ getCampName(project) }</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Package className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-xs text-gray-500">نوع المساعدة</p>
                            <p className="text-sm font-semibold text-gray-800">{ getAidType(project) }</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Package className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-xs text-gray-500">الكمية</p>
                            <p className="text-sm font-semibold text-gray-800">{ formatQuantity(project) }</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions Section */ }
                    <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-r border-gray-200 pt-4 lg:pt-0 lg:pr-6 lg:pl-6">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <FileSpreadsheet className="w-5 h-5 text-sky-600" />
                          إدارة المستفيدين
                        </h4>

                        {/* View Beneficiaries */ }
                        { hasBeneficiaries && (
                          <button
                            onClick={ () => {
                              setSelectedProject(project);
                              fetchBeneficiaries(project.id);
                            } }
                            className="w-full px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            <span>عرض المستفيدين ({ beneficiariesCount[project.id] })</span>
                          </button>
                        ) }

                        {/* Download Template Section */ }
                        { canUploadForProject && (
                          <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <FileDown className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-medium text-blue-800">الخطوة 1: تنزيل القالب</span>
                              </div>
                              <button
                                onClick={ () => handleDownloadTemplate(project.id) }
                                disabled={ downloadingTemplate[project.id] }
                                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs"
                                title="تنزيل قالب Excel فارغ لملؤه بالبيانات"
                              >
                                { downloadingTemplate[project.id] ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>جاري التنزيل...</span>
                                  </>
                                ) : (
                                  <>
                                    <FileDown className="w-3 h-3" />
                                    <span>تنزيل القالب</span>
                                  </>
                                ) }
                              </button>
                            </div>
                            <p className="text-xs text-blue-700">
                              قم بتنزيل قالب Excel فارغ يحتوي على الأعمدة المطلوبة ونوع المساعدة للمشروع
                            </p>
                          </div>
                        ) }

                        {/* Upload Section */ }
                        { canUploadForProject ? (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                { canUploadForProject ? 'الخطوة 2: رفع الملف المملوء' : 'رفع ملف Excel' }
                              </label>
                              <input
                                id={ `file-input-${project.id}` }
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={ (e) => handleFileChange(project.id, e) }
                                disabled={ uploading }
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                { canUploadForProject 
                                  ? 'بعد ملء القالب بالبيانات، قم برفعه هنا (أو يمكنك رفع أي ملف Excel آخر)'
                                  : 'الملف يجب أن يكون بصيغة Excel (xlsx, xls, csv) وحجمه أقل من 10 ميجابايت'
                                }
                              </p>
                            </div>

                            { uploadingFile?.[project.id] && (
                              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-gray-700 flex-1 truncate">
                                  { uploadingFile[project.id].name }
                                </span>
                                <button
                                  onClick={ () => {
                                    setUploadingFile(prev => {
                                      const newState = { ...prev };
                                      delete newState[project.id];
                                      return newState;
                                    });
                                    const fileInput = document.getElementById(`file-input-${project.id}`);
                                    if (fileInput) fileInput.value = '';
                                  } }
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) }

                            <button
                              onClick={ () => handleUpload(project.id) }
                              disabled={ !uploadingFile?.[project.id] || uploading }
                              className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              { uploading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>جاري الرفع...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  <span>رفع الملف</span>
                                </>
                              ) }
                            </button>
                          </>
                        ) : !canUpload ? (
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs text-yellow-800">ليس لديك صلاحيات لرفع ملف Excel</p>
                          </div>
                        ) : (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-800">
                              المشروع يجب أن يكون في حالة "تم التنفيذ" أو ما بعدها
                            </p>
                          </div>
                        ) }

                        {/* Export & Delete */ }
                        { hasBeneficiaries && (
                          <div className="flex gap-2">
                            <button
                              onClick={ () => handleExport(project.id) }
                              className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              <span>تصدير</span>
                            </button>
                            { canDelete && (
                              <button
                                onClick={ () => setShowDeleteConfirm(project.id) }
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                                title="حذف المستفيدين"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) }
                          </div>
                        ) }
                      </div>
                    </div>
                  </div>
                </div>
              );
            }) }
          </div>
        ) }
      </div>

      {/* Beneficiaries Modal */ }
      { showBeneficiariesModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    المستفيدين - { selectedProject.project_name || selectedProject.name || `مشروع #${selectedProject.id}` }
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">إجمالي: { beneficiaries.length } مستفيد</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={ () => handleExport(selectedProject.id) }
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>تصدير</span>
                  </button>
                  <button
                    onClick={ () => {
                      setShowBeneficiariesModal(false);
                      setBeneficiaries([]);
                      setSelectedProject(null);
                    } }
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              { loadingBeneficiaries ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                </div>
              ) : beneficiaries.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">لا يوجد مستفيدين</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الاسم</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">رقم الهوية</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">رقم الهاتف</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المحافظة</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المنطقة</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">نوع المساعدة</th>
                      </tr>
                    </thead>
                    <tbody>
                      { beneficiaries.map((beneficiary) => (
                        <tr key={ beneficiary.id } className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-800">{ beneficiary.name || '-' }</td>
                          <td className="px-4 py-3 text-sm text-gray-700 font-mono">{ beneficiary.id_number || '-' }</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{ beneficiary.phone || '-' }</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{ beneficiary.governorate || '-' }</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{ beneficiary.district || '-' }</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs">
                              { beneficiary.aid_type || '-' }
                            </span>
                          </td>
                        </tr>
                      )) }
                    </tbody>
                  </table>
                </div>
              ) }
            </div>
          </div>
        </div>
      ) }

      {/* Delete Confirm Dialog */ }
      <ConfirmDialog
        isOpen={ showDeleteConfirm !== null }
        onClose={ () => setShowDeleteConfirm(null) }
        onConfirm={ () => handleDelete(showDeleteConfirm) }
        title="حذف المستفيدين"
        message={ `هل أنت متأكد من حذف جميع المستفيدين (${beneficiariesCount[showDeleteConfirm] || 0} مستفيد)؟ هذا الإجراء لا يمكن التراجع عنه.` }
        confirmText="حذف"
        cancelText="إلغاء"
        confirmButtonClass="bg-red-500 hover:bg-red-600"
        loading={ deleting }
      />
    </div>
  );
};

export default BeneficiariesManagement;
