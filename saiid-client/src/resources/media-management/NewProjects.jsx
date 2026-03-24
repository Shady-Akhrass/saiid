import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { getProjectCode } from '../../utils/helpers';
import { Camera, Search, X, User, AlertCircle, Download, Eye, UserSearch, CheckSquare, Square } from 'lucide-react';
import { AssignPhotographerModal, BulkAssignPhotographerModal } from '../project-management/components/ProjectModals';

const NewProjects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [researchers, setResearchers] = useState([]);
  const [researcherFilterId, setResearcherFilterId] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState(new Set());
  const [selectedProject, setSelectedProject] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [imagePreview, setImagePreview] = useState({ url: null, isOpen: false });

  useEffect(() => {
    fetchProjects();
  }, []);

  // ✅ جلب قائمة الباحثين للفلترة
  useEffect(() => {
    const fetchResearchers = async () => {
      try {
        const response = await apiClient.get('/team-personnel/available', {
          params: { _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (response.data?.success && Array.isArray(response.data.researchers)) {
          setResearchers(response.data.researchers.filter((r) => r.is_active !== false));
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Failed to fetch researchers:', err);
      }
    };
    fetchResearchers();
  }, []);

  // ✅ تحديث عنوان الصفحة (Tab Title) ديناميكياً
  useEffect(() => {
    document.title = 'المشاريع الجديدة - قسم الإعلام';
  }, []);

  // ✅ إعادة جلب المشاريع عند تغيير البحث (مع debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchProjects();
    }, 500); // ✅ انتظار 500ms بعد توقف المستخدم عن الكتابة

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // ✅ الحالات المطلوبة لصفحة المشاريع الجديدة (مسندة لباحث + جاهزة للتنفيذ + قيد التنفيذ)
  const MEDIA_ALLOWED_STATUSES = ['مسند لباحث', 'جاهز للتنفيذ', 'قيد التنفيذ'];

  const fetchProjects = async () => {
    try {
      setLoading(true);

      // ✅ طلب منفصل لكل حالة ثم دمج النتائج لضمان ظهور كل المشاريع المسندة لباحث والجاهزة للتنفيذ
      const baseParams = {
        perPage: 500,
        page: 1,
        _t: Date.now(),
      };
      if (searchQuery && searchQuery.trim()) {
        baseParams.searchQuery = searchQuery.trim();
      }

      if (import.meta.env.DEV) {
        console.log('📤 Fetching projects (by status) with params:', baseParams);
      }

      const statusPromises = MEDIA_ALLOWED_STATUSES.map(status =>
        apiClient.get('/project-proposals', {
          params: { ...baseParams, status },
          timeout: 30000,
        }).catch(err => {
          if (import.meta.env.DEV) {
            console.warn(`⚠️ Failed to fetch status "${status}":`, err?.response?.data || err.message);
          }
          return { data: { success: false, data: [], projects: [] } };
        })
      );

      const responses = await Promise.all(statusPromises);

      // ✅ استخراج المشاريع من كل استجابة ودمجها مع إزالة التكرار حسب id
      const projectIds = new Set();
      const projectsData = [];
      responses.forEach((response) => {
        let list = [];
        if (response?.data?.success) {
          if (Array.isArray(response.data.data)) list = response.data.data;
          else if (Array.isArray(response.data.data?.data)) list = response.data.data.data;
          else if (Array.isArray(response.data.projects)) list = response.data.projects;
        }
        list.forEach(project => {
          if (!project) return;
          const id = project.id ?? project._id;
          if (id && !projectIds.has(id)) {
            projectIds.add(id);
            projectsData.push(project);
          }
        });
      });

      if (import.meta.env.DEV) {
        console.log('📥 NewProjects merged Response:', {
          total: projectsData.length,
          allStatuses: [...new Set(projectsData.map(p => p.status).filter(Boolean))],
          byStatus: MEDIA_ALLOWED_STATUSES.map(s => ({
            status: s,
            count: projectsData.filter(p => p.status === s).length,
          })),
        });
      }

      if (projectsData.length >= 0) {
        // ✅ فلترة المشاريع: إزالة المشاريع التي لديها مصور مسند بالفعل (لـ مسند لباحث) وغير المسموح بها
        const validProjects = projectsData.filter(project => {
          if (!project || !project.id) return false;

          const userRole = user?.role?.toLowerCase?.() ||
            user?.userRole?.toLowerCase?.() ||
            user?.user_role?.toLowerCase?.() ||
            user?.role_name?.toLowerCase?.() ||
            user?.role || '';
          const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

          const status = (project.status || '').trim();
          if (!isAdmin && status === 'منتهي') {
            return false;
          }

          if (status === 'تم التنفيذ' || status.includes('تم التنفيذ')) {
            return false;
          }

          // ✅ التحقق من أن الحالة مسموحة لإسناد/إعادة إسناد المصور
          if (!MEDIA_ALLOWED_STATUSES.includes(status)) {
            return false;
          }

          // ✅ للمشاريع بحالة "مسند لباحث": نعرض فقط المشاريع التي لا تحتوي على مصور
          if (status === 'مسند لباحث') {
            const hasPhotographer = !!(project.assigned_photographer_id ||
              project.photographer?.id ||
              project.assigned_photographer?.id);

            if (hasPhotographer) {
              return false;
            }
          }

          // ✅ التحقق من وجود باحث مسند
          const hasResearcher = !!(project.assigned_researcher_id ||
            project.assigned_researcher?.id ||
            project.researcher?.id);

          if (!hasResearcher) {
            return true; // ✅ نعرض المشروع حتى لو لم يكن له باحث (للأمان)
          }

          return true;
        });

        setProjects(validProjects);
      }
    } catch (error) {
      console.error('❌ Error fetching projects:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
        params: error.config?.params,
      });

      // ✅ عرض رسالة خطأ أكثر تفصيلاً
      if (error.response?.status === 500) {
        toast.error('خطأ في الخادم (500) - يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني', {
          autoClose: 5000,
        });
      } else if (error.response?.status === 404) {
        toast.error('الـ API غير موجود - يرجى التحقق من الإعدادات', {
          autoClose: 5000,
        });
      } else {
        toast.error(error.response?.data?.message || error.message || 'فشل تحميل المشاريع', {
          autoClose: 5000,
        });
      }

      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPhotographer = async (project) => {
    // ✅ Debug: عرض بيانات المشروع قبل التحقق
    if (import.meta.env.DEV) {
      console.log('🔍 Project data before assignment:', {
        id: project.id,
        status: project.status,
        assigned_researcher_id: project.assigned_researcher_id,
        assigned_researcher: project.assigned_researcher,
        hasResearcherId: !!project.assigned_researcher_id,
        hasResearcherObject: !!project.assigned_researcher?.id,
      });
    }

    // ✅ جلب بيانات المشروع الكاملة من الـ API للتأكد من وجود جميع البيانات
    try {
      const response = await apiClient.get(`/project-proposals/${project.id}`, {
        params: {
          _t: Date.now(), // cache busting
        },
      });

      if (import.meta.env.DEV) {
        console.log('📥 Full project API response:', {
          success: response.data.success,
          hasProject: !!response.data.project,
          hasData: !!response.data.data,
          projectKeys: response.data.project ? Object.keys(response.data.project) : [],
          dataKeys: response.data.data ? Object.keys(response.data.data) : [],
        });
      }

      let fullProject = null;
      if (response.data.success && response.data.project) {
        fullProject = response.data.project;
      } else if (response.data.success && response.data.data) {
        fullProject = response.data.data;
      }

      if (fullProject) {
        if (import.meta.env.DEV) {
          console.log('📋 Full project data:', {
            id: fullProject.id,
            status: fullProject.status,
            assigned_researcher_id: fullProject.assigned_researcher_id,
            assigned_researcher: fullProject.assigned_researcher,
            hasResearcherId: !!fullProject.assigned_researcher_id,
            hasResearcherObject: !!fullProject.assigned_researcher?.id,
            assigned_researcher_name: fullProject.assigned_researcher?.name,
            // ✅ عرض جميع المفاتيح المتاحة
            allKeys: Object.keys(fullProject),
            // ✅ البحث عن أي حقل يحتوي على "researcher"
            researcherKeys: Object.keys(fullProject).filter(k => k.toLowerCase().includes('researcher')),
          });
        }

        // ✅ التحقق من وجود assigned_researcher_id
        // ✅ قد يكون الاسم مختلفاً في الـ API (مثلاً: researcher_id, researcher, etc.)
        const researcherId = fullProject.assigned_researcher_id ||
          fullProject.researcher_id ||
          fullProject.assigned_researcher?.id ||
          fullProject.researcher?.id;

        const researcher = fullProject.assigned_researcher ||
          fullProject.researcher;

        if (!researcherId && !researcher?.id) {
          // ✅ رسالة واضحة للمستخدم
          toast.error('المشروع بحالة "مسند لباحث" لكن لا يوجد باحث مسند في قاعدة البيانات. يرجى إسناد باحث للمشروع أولاً من صفحة إدارة المشاريع.', {
            autoClose: 5000,
          });

          if (import.meta.env.DEV) {
            console.error('❌ Project missing assigned_researcher:', {
              projectId: fullProject.id,
              status: fullProject.status,
              assigned_researcher_id: fullProject.assigned_researcher_id,
              assigned_researcher: fullProject.assigned_researcher,
              researcher_id: fullProject.researcher_id,
              researcher: fullProject.researcher,
              allKeys: Object.keys(fullProject),
            });
            console.error('💡 Backend Fix Required:', {
              message: 'الـ Backend يجب أن يعيد assigned_researcher relationship',
              endpoint: `/project-proposals/${fullProject.id}`,
              expectedFields: ['assigned_researcher_id', 'assigned_researcher'],
              documentation: 'راجع ملف: BACKEND_ASSIGNED_RESEARCHER_RELATIONSHIP.md',
            });
          }
          return;
        }

        // ✅ استخدام بيانات المشروع الكاملة (مع إضافة researcher_id إذا كان مفقوداً)
        const projectWithResearcher = {
          ...fullProject,
          assigned_researcher_id: researcherId || fullProject.assigned_researcher_id,
          assigned_researcher: researcher || fullProject.assigned_researcher,
        };

        setSelectedProject(projectWithResearcher);
        setShowAssignModal(true);
      } else {
        // ✅ إذا لم يتم إرجاع بيانات المشروع، نستخدم البيانات المتوفرة
        if (import.meta.env.DEV) {
          console.warn('⚠️ No full project data returned, using available data');
        }

        // ✅ التحقق من البيانات المتوفرة
        if (!project.assigned_researcher_id && !project.assigned_researcher?.id) {
          toast.error('يجب أن يكون المشروع مسند للباحث أولاً - لا يوجد باحث مسند لهذا المشروع');
          if (import.meta.env.DEV) {
            console.error('❌ Project missing assigned_researcher (using available data):', {
              projectId: project.id,
              status: project.status,
              assigned_researcher_id: project.assigned_researcher_id,
              assigned_researcher: project.assigned_researcher,
            });
          }
          return;
        }

        setSelectedProject(project);
        setShowAssignModal(true);
      }
    } catch (error) {
      console.error('❌ Error fetching project details:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      // ✅ إذا فشل جلب البيانات، نستخدم البيانات المتوفرة
      if (!project.assigned_researcher_id && !project.assigned_researcher?.id) {
        toast.error('فشل جلب بيانات المشروع - يرجى المحاولة مرة أخرى');
        return;
      }

      setSelectedProject(project);
      setShowAssignModal(true);
    }
  };

  const handleAssignSuccess = () => {
    // ✅ لا نعرض toast هنا لأن Modal يعرضه بالفعل (تجنب التكرار)
    fetchProjects(); // إعادة جلب المشاريع
    setShowAssignModal(false);
    setSelectedProject(null);
  };

  // ✅ فلترة بالباحث ثم بالبحث
  const filteredProjects = projects.filter(project => {
    const researcherId = project.assigned_researcher_id ?? project.assigned_researcher?.id ?? project.researcher?.id;
    if (researcherFilterId && String(researcherId) !== String(researcherFilterId)) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (project.project_name || '').toLowerCase().includes(query) ||
      (project.donor_code || '').toLowerCase().includes(query) ||
      (project.serial_number || '').toLowerCase().includes(query) ||
      (project.donor_name || '').toLowerCase().includes(query) ||
      (project.assigned_researcher?.name || '').toLowerCase().includes(query)
    );
  });

  const toggleProjectSelection = (id) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProjectIds.size === filteredProjects.length) {
      setSelectedProjectIds(new Set());
    } else {
      setSelectedProjectIds(new Set(filteredProjects.map(p => p.id).filter(Boolean)));
    }
  };

  const handleBulkAssignSuccess = () => {
    setSelectedProjectIds(new Set());
    fetchProjects();
    setShowBulkAssignModal(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleDownloadImage = async (imageUrl, projectName) => {
    try {
      let blob;
      
      // ✅ إذا كان URL كامل (http/https)، استخدمه مباشرة مع fetch
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        const response = await fetch(imageUrl, {
          method: 'GET',
          credentials: 'include',
          mode: 'cors',
        });
        if (!response.ok) throw new Error('Failed to fetch image');
        blob = await response.blob();
      } else {
        // ✅ استخدام apiClient للصور من API endpoint
        // ✅ استخراج endpoint من imageUrl (مثل /project-note-image/{id} أو /api/...)
        let apiEndpoint = imageUrl;
        if (imageUrl.includes('/api/')) {
          apiEndpoint = imageUrl.split('/api/')[1]; // ✅ إزالة baseURL
        } else if (imageUrl.startsWith('/')) {
          apiEndpoint = imageUrl.substring(1); // ✅ إزالة / الأولى
        }
        
        const response = await apiClient.get(apiEndpoint, {
          responseType: 'blob',
          skipDeduplication: true, // ✅ اختياري للصور
        });
        blob = response.data;
      }

      if (!blob || !blob.type || !blob.type.startsWith('image/')) {
        throw new Error('Invalid image type');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `صورة_${projectName || 'مشروع'}_${Date.now()}.${blob.type.split('/')[1]}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('تم تنزيل الصورة بنجاح');
    } catch (error) {
      console.error('Error downloading image:', error);
      toast.error('فشل تنزيل الصورة');
    }
  };

  const handleViewImage = (imageUrl) => {
    setImagePreview({ url: imageUrl, isOpen: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <Camera className="w-8 h-8 text-orange-600" />
                المشاريع الجديدة
              </h1>
              <p className="text-gray-600 mt-2">
                المشاريع المسندة للباحث والتي تحتاج إسناد مصور
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                { filteredProjects.length } مشروع
              </span>
            </div>
          </div>

          {/* فلترة بالباحث + بحث */ }
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <UserSearch className="w-5 h-5 text-gray-500" />
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">الباحث:</label>
              <select
                value={ researcherFilterId }
                onChange={ (e) => setResearcherFilterId(e.target.value) }
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="">جميع الباحثين</option>
                { researchers.map((r) => (
                  <option key={ r.id } value={ r.id }>
                    { r.name || `باحث #${r.id}` }
                  </option>
                )) }
              </select>
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="بحث عن مشروع..."
                value={ searchQuery }
                onChange={ (e) => setSearchQuery(e.target.value) }
                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* تحديد مشاريع + إسناد جماعي */ }
          { filteredProjects.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 py-3 border-t border-gray-200">
              <button
                type="button"
                onClick={ toggleSelectAll }
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
              >
                { selectedProjectIds.size === filteredProjects.length ? (
                  <CheckSquare className="w-5 h-5 text-orange-600" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400" />
                ) }
                { selectedProjectIds.size === filteredProjects.length ? 'إلغاء تحديد الكل' : 'تحديد الكل' }
              </button>
              { selectedProjectIds.size > 0 && (
                <button
                  type="button"
                  onClick={ () => setShowBulkAssignModal(true) }
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium hover:shadow-lg"
                >
                  <Camera className="w-5 h-5" />
                  إسناد مصور للمحدد ({ selectedProjectIds.size })
                </button>
              ) }
            </div>
          ) }
        </div>

        {/* Projects List */ }
        { filteredProjects.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              { (searchQuery || researcherFilterId) ? 'لا توجد نتائج' : 'لا توجد مشاريع تحتاج إسناد مصور' }
            </h3>
            <p className="text-gray-500 mb-4">
              { (searchQuery || researcherFilterId)
                ? 'جرب تغيير البحث أو اختيار باحث آخر'
                : 'جميع المشاريع المسندة للباحث تم إسناد مصور لها'
              }
            </p>
            { import.meta.env.DEV && !searchQuery && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-right">
                <p className="text-sm text-blue-800 font-semibold mb-2">
                  ℹ️ معلومات:
                </p>
                <p className="text-xs text-blue-700">
                  الـ Backend يستخدم endpoint: <code className="bg-blue-100 px-2 py-1 rounded">/project-proposals/new-projects-needing-photographer</code>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  هذا الـ endpoint يعيد فقط المشاريع بحالة "مسند لباحث" التي لم يتم إسناد مصور لها.
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  تحقق من Console (F12) لرؤية تفاصيل الاستجابة.
                </p>
              </div>
            ) }
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            { filteredProjects.map((project) => (
              <div
                key={ project.id }
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-gray-100"
              >
                {/* Project Header + checkbox */ }
                <div className="flex items-start justify-between mb-4 gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={ () => toggleProjectSelection(project.id) }
                      className="shrink-0 mt-0.5 p-0.5 rounded hover:bg-gray-100"
                      title={ selectedProjectIds.has(project.id) ? 'إلغاء التحديد' : 'تحديد المشروع' }
                    >
                      { selectedProjectIds.has(project.id) ? (
                        <CheckSquare className="w-5 h-5 text-orange-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      ) }
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-800 mb-1 truncate">
                        { project.project_name || 'مشروع بدون اسم' }
                      </h3>
                    </div>
                  </div>
                  <span className={ `shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${project.status === 'مسند لباحث'
                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                    : project.status === 'جاهز للتنفيذ'
                      ? 'bg-orange-100 text-orange-700 border-orange-200'
                      : project.status === 'قيد التنفيذ'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }` }>
                    { project.status || 'غير محدد' }
                  </span>
                </div>

                {/* Project Info */ }
                <div className="space-y-3 mb-4">
                  {/* اسم المشروع */ }
                  <div className="flex items-start gap-2 text-sm">
                    <span className="font-semibold text-gray-700 min-w-[100px]">اسم المشروع:</span>
                    <span className="text-gray-600 flex-1">{ project.project_name || '-' }</span>
                  </div>

                  {/* اسم المتبرع */ }
                  { project.donor_name && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="font-semibold text-gray-700 min-w-[100px]">اسم المتبرع:</span>
                      <span className="text-gray-600 flex-1">{ project.donor_name }</span>
                    </div>
                  ) }

                  {/* وصف التبرع */ }
                  { (project.donation_description || project.description || project.project_description) && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="font-semibold text-gray-700 min-w-[100px]">وصف التبرع:</span>
                      <span className="text-gray-600 flex-1">
                        { project.donation_description || project.description || project.project_description }
                      </span>
                    </div>
                  ) }

                  {/* كود المشروع (موحد) */ }
                  { getProjectCode(project, null) && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="font-semibold text-gray-700 min-w-[100px]">كود المشروع:</span>
                      <span className="text-gray-600 flex-1">{ getProjectCode(project) }</span>
                    </div>
                  ) }

                  {/* الباحث المسند */ }
                  { (project.assigned_researcher?.name || project.assigned_researcher_id) && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="font-semibold text-gray-700 min-w-[100px]">الباحث:</span>
                      <span className="text-gray-600 flex-1 flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-600" />
                        { project.assigned_researcher?.name ||
                          project.researcher?.name ||
                          `الباحث #${project.assigned_researcher_id || project.researcher_id}` }
                      </span>
                    </div>
                  ) }

                  {/* عرض وتنزيل الصورة */ }
                  { (project.notes_image_url || project.image_url) && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="font-semibold text-gray-700 min-w-[100px]">صورة المشروع:</span>
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          onClick={ () => handleViewImage(project.notes_image_url || project.image_url) }
                          className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
                        >
                          <Eye className="w-3 h-3" />
                          عرض الصورة
                        </button>
                        <button
                          onClick={ () => handleDownloadImage(project.notes_image_url || project.image_url, project.project_name) }
                          className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-xs font-medium"
                        >
                          <Download className="w-3 h-3" />
                          تنزيل
                        </button>
                      </div>
                    </div>
                  ) }

                  {/* ملاحظات المشروع */ }
                  { project.notes && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="font-semibold text-gray-700 min-w-[100px]">ملاحظات المشروع:</span>
                      <span className="text-gray-600 flex-1 whitespace-pre-wrap">{ project.notes }</span>
                    </div>
                  ) }
                </div>

                {/* Actions */ }
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={ () => handleAssignPhotographer(project) }
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    { (project.assigned_photographer_id || project.photographer?.id)
                      ? 'إعادة إسناد المصور'
                      : 'إسناد مصور' }
                  </button>
                  <Link
                    to={ `/project-management/projects/${project.id}` }
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    عرض التفاصيل
                  </Link>
                </div>
              </div>
            )) }
          </div>
        ) }
      </div>

      {/* Assign Photographer Modal (مشروع واحد) */ }
      { showAssignModal && selectedProject && (
        <AssignPhotographerModal
          isOpen={ showAssignModal }
          onClose={ () => {
            setShowAssignModal(false);
            setSelectedProject(null);
          } }
          projectId={ selectedProject.id }
          project={ selectedProject }
          onSuccess={ handleAssignSuccess }
        />
      ) }

      {/* إسناد مصور لعدة مشاريع */ }
      { showBulkAssignModal && (
        <BulkAssignPhotographerModal
          isOpen={ showBulkAssignModal }
          onClose={ () => setShowBulkAssignModal(false) }
          projectIds={ Array.from(selectedProjectIds) }
          projects={ projects.filter((p) => selectedProjectIds.has(p.id)) }
          onSuccess={ handleBulkAssignSuccess }
        />
      ) }

      {/* Image Preview Modal */ }
      { imagePreview.isOpen && imagePreview.url && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={ () => setImagePreview({ url: null, isOpen: false }) }>
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden" onClick={ (e) => e.stopPropagation() }>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">معاينة الصورة</h3>
              <button
                onClick={ () => setImagePreview({ url: null, isOpen: false }) }
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-4">
              <img
                src={ imagePreview.url }
                alt="صورة المشروع"
                className="max-w-full max-h-[70vh] mx-auto rounded-lg"
              />
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
              <button
                onClick={ () => {
                  const project = filteredProjects.find(p => (p.notes_image_url || p.image_url) === imagePreview.url);
                  handleDownloadImage(imagePreview.url, project?.project_name);
                } }
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                تنزيل الصورة
              </button>
            </div>
          </div>
        </div>
      ) }
    </div>
  );
};

export default NewProjects;
