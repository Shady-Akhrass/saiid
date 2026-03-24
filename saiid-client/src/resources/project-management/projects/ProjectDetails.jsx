import React, { useState, useEffect, memo, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient, { getImageBaseUrl } from '../../../utils/axiosConfig';

/** تفعيل سجلات التصحيح المزعجة (Project Data, Subcategory, Notes, Timeline…) — اتركه false للاستخدام العادي */
const DEBUG_PROJECT_DETAILS_VERBOSE = false;
import { useCacheInvalidation } from '../../../hooks/useCacheInvalidation';
import { getProjectCode as getProjectCodeHelper } from '../../../utils/helpers';
import { getCurrentProjectMonthFromStartDate } from '../../../utils/phaseUtils';
import { toast } from 'react-toastify';
import LazyImage from '../../../components/LazyImage';
import PageLoader from '../../../components/PageLoader';
import {
  ArrowRight,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  User,
  Users,
  Camera,
  Home,
  Clock,
  FileText,
  CheckCircle2,
  Play,
  Film,
  Pause,
  PlayCircle,
  X,
  AlertCircle,
  Image as ImageIcon,
  Calendar as CalendarIcon,
  List,
  Tag,
  Package,
  Download,
  ShoppingCart,
  RefreshCw,
  CheckCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react';
import BeneficiariesSection from './BeneficiariesSection';
import { AddOrphansModal } from '../components/AddOrphansModal';

// ✅ مكون منفصل لعرض صورة ملاحظة واحدة (للتوافقية مع الحقل القديم)
// ✅ استخدام memo لتحسين الأداء
const NotesImageDisplay = memo(({ project }) => {
  const [imageError, setImageError] = useState(false);
  const [imageBlobUrl, setImageBlobUrl] = useState(null); // ✅ blob URL للصورة (نفس منطق جدول الأيتام)
  const [loadingImage, setLoadingImage] = useState(false); // ✅ حالة التحميل

  // ✅ تنظيف blob URL السابق عند تغيير المشروع
  useEffect(() => {
    return () => {
      if (imageBlobUrl && typeof imageBlobUrl === 'string' && imageBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageBlobUrl);
      }
    };
  }, [imageBlobUrl]);

  // ✅ جلب الصورة وتحويلها إلى blob URL (نفس منطق جدول الأيتام بالضبط)
  useEffect(() => {
    if (!project?.id || loadingImage) {
      return;
    }

    const loadImageAsBlob = async () => {
      setLoadingImage(true);
      setImageError(false);

      // ✅ إذا كان هناك notes_image_url كامل (http/https)، استخدمه مباشرة
      if (project.notes_image_url && (project.notes_image_url.startsWith('http://') || project.notes_image_url.startsWith('https://'))) {
        try {
          const response = await fetch(project.notes_image_url, {
            method: 'GET',
            credentials: 'include',
            mode: 'cors',
          });

          if (response.ok) {
            const blob = await response.blob();
            if (blob.type.startsWith('image/')) {
              const blobUrl = URL.createObjectURL(blob);
              setImageBlobUrl(blobUrl);
              setImageError(false);
              setLoadingImage(false);
              return;
            }
          }
        } catch (error) {
          // Fallback to API endpoint
        }
      }

      // ✅ استخدام apiClient لتحميل الصورة من API endpoint
      if (!project.id) {
        setImageError(true);
        setLoadingImage(false);
        return;
      }

      try {
        // ✅ استخدام apiClient بدلاً من fetch - يمر عبر proxy/baseURL تلقائياً
        const response = await apiClient.get(`/project-note-image/${project.id}`, {
          responseType: 'blob',
          skipDeduplication: true, // ✅ اختياري للصور - لا نريد deduplication للصور
        });

        // ✅ التحقق من أن الـ blob هو صورة
        if (response.data && response.data.type && response.data.type.startsWith('image/')) {
          const blobUrl = URL.createObjectURL(response.data);
          setImageBlobUrl(blobUrl);
          setImageError(false);
          setLoadingImage(false);
          if (import.meta.env.DEV) {
            console.log('✅ Successfully loaded project image using blob URL:', {
              projectId: project?.id,
              blobType: response.data.type,
            });
          }
        } else {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Invalid content type:', response.data?.type);
          }
          setImageError(true);
          setLoadingImage(false);
        }
      } catch (error) {
        // ✅ معالجة 404 بشكل صحيح (الصورة غير موجودة)
        if (error.response?.status === 404) {
          if (import.meta.env.DEV) {
            console.info('ℹ️ Image not found (404) for project:', project.id);
          }
          setImageError(true);
          setLoadingImage(false);
        } else if (error.response?.status === 429) {
          // ✅ Handle 429 (Too Many Requests) - silently skip
          if (import.meta.env.DEV) {
            console.warn('⚠️ Rate limited (429) for project image:', project.id);
          }
          setImageError(true);
          setLoadingImage(false);
        } else {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Failed to load image from API:', error);
          }
          setImageError(true);
          setLoadingImage(false);
        }
      }
    };

    loadImageAsBlob();

    // ✅ تنظيف blob URL عند unmount أو تغيير الصورة
    return () => {
      if (imageBlobUrl && typeof imageBlobUrl === 'string' && imageBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageBlobUrl);
      }
    };
  }, [project?.id, project?.notes_image_url, project?.notes_image]); // ✅ يعتمد على project مباشرة

  // ✅ دالة تنزيل الصورة (نفس منطق جدول الأيتام)
  const handleDownloadImage = async () => {
    try {
      if (!imageBlobUrl) {
        toast.error('لا توجد صورة للتنزيل');
        return;
      }

      const response = await fetch(imageBlobUrl);
      const blob = await response.blob();

      // إنشاء رابط للتنزيل
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // اسم الملف
      const projectName = project?.project_name || project?.project_description || 'project';
      const sanitizedProjectName = projectName.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_').toLowerCase();
      const fileExtension = blob.type?.split('/')[1] || 'jpg';
      const fileName = `project_${project?.id || 'project'}_${sanitizedProjectName}_${Date.now()}.${fileExtension}`;

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('تم تنزيل الصورة بنجاح');
    } catch (error) {
      console.error('❌ Error downloading image:', error);
      toast.error(`فشل تنزيل الصورة: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <ImageIcon className="w-5 h-5 ml-2 text-indigo-600" />
          صورة الملاحظات
        </h2>
        { !imageError && imageBlobUrl && (
          <button
            onClick={ handleDownloadImage }
            className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            title="تنزيل الصورة"
            disabled={ loadingImage }
          >
            <Download className="w-4 h-4" />
            تنزيل
          </button>
        ) }
      </div>
      <div className="relative bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
        { loadingImage && (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 text-sm">جاري تحميل الصورة...</div>
          </div>
        ) }
        { !loadingImage && imageBlobUrl && !imageError && (
          <img
            key={ imageBlobUrl }
            src={ imageBlobUrl }
            alt="صورة الملاحظات"
            className="w-full h-auto rounded-lg max-h-96 object-contain"
            onError={ () => {
              console.error('❌ Failed to display blob URL image');
              setImageError(true);
            } }
            onLoad={ () => {
              if (DEBUG_PROJECT_DETAILS_VERBOSE) console.log('✅ Image loaded successfully from blob URL');
              setImageError(false);
            } }
          />
        ) }
        { imageError && (
          <div className="text-center text-gray-500 text-sm py-4">
            <div className="flex flex-col items-center gap-2">
              <span>⚠️ تعذر تحميل صورة الملاحظات</span>
              <div className="text-xs text-gray-500 mt-2 space-y-1">
                <p>تأكد من:</p>
                <ul className="list-disc list-inside text-right">
                  <li>أن Laravel storage link موجود: <code className="bg-gray-200 px-1 rounded">php artisan storage:link</code></li>
                  <li>أن الصورة موجودة في المسار الصحيح</li>
                  <li>أن الـ Backend يرجع <code className="bg-gray-200 px-1 rounded">notes_image_url</code> في الـ response</li>
                </ul>
              </div>
            </div>
          </div>
        ) }
      </div>
    </div>
  );
});

// ✅ معرض صور الملاحظات الكامل (note_images) مع دعم إعادة الترتيب
const NotesImagesSection = memo(({ project, user }) => {
  const [orderedIds, setOrderedIds] = useState(() => {
    const imgs = project?.note_images || project?.noteImages || [];
    return imgs.map((img) => img.id);
  });
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const noteImages = useMemo(() => {
    const imgs = project?.note_images || project?.noteImages || [];
    if (!Array.isArray(imgs) || imgs.length === 0) return [];

    const byId = new Map(imgs.map((img) => [img.id, img]));
    const sorted = orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean);
    const remaining = imgs.filter((img) => !orderedIds.includes(img.id));
    return [...sorted, ...remaining];
  }, [project?.note_images, project?.noteImages, orderedIds]);

  const userRole = user?.role?.toLowerCase?.() ||
    user?.userRole?.toLowerCase?.() ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role ||
    '';

  const canReorder =
    userRole === 'admin' ||
    userRole === 'project_manager' ||
    userRole === 'media_manager' ||
    userRole === 'orphan_sponsor_coordinator' ||
    userRole === 'منسق مشاريع كفالة الأيتام';

  const moveImage = (index, direction) => {
    setOrderedIds((prev) => {
      const newOrder = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= newOrder.length) return prev;
      const [moved] = newOrder.splice(index, 1);
      newOrder.splice(newIndex, 0, moved);
      return newOrder;
    });
  };

  const handleSaveOrder = async () => {
    if (!project?.id || orderedIds.length === 0) return;
    setIsSavingOrder(true);
    try {
      await apiClient.put('/project-note-images/reorder', {
        project_id: project.id,
        ordered_ids: orderedIds,
      });
      toast.success('تم حفظ ترتيب صور الملاحظات بنجاح');
    } catch (error) {
      console.error('Error reordering note images:', error);
      toast.error(error.response?.data?.message || 'فشل حفظ ترتيب الصور');
    } finally {
      setIsSavingOrder(false);
    }
  };

  // ✅ قاعدة الـ API لعرض صور الملاحظات — في الإنتاج نستخدم دائماً رابط الـ API الكامل ليعمل على السيرفر
  const baseURL = getImageBaseUrl();
  const API_BASE = baseURL.replace(/\/api\/?$/, '');

  // إذا لم يكن هناك note_images نستخدم المنطق القديم لصورة واحدة
  if (!noteImages || noteImages.length === 0) {
    return <NotesImageDisplay project={ project } />;
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <ImageIcon className="w-5 h-5 ml-2 text-indigo-600" />
          صور الملاحظات
        </h2>
        { canReorder && noteImages.length > 1 && (
          <button
            type="button"
            onClick={ handleSaveOrder }
            disabled={ isSavingOrder }
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            { isSavingOrder ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                جاري الحفظ...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                حفظ ترتيب الصور
              </>
            ) }
          </button>
        ) }
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        { noteImages.map((img, index) => {
          const path = img.image_url || img.image_path;
          if (!path) return null;

          let finalUrl = path;

          // ✅ إذا لم يكن URL كاملاً، نبنيه اعتماداً على إعدادات الـ API
          if (!path.startsWith('http://') && !path.startsWith('https://')) {
            const normalizedPath = path.startsWith('/') ? path : `/${path}`;

            // ✅ صور الملاحظات: الـ Backend يخدمها على /api/project_notes_images/{filename}
            if (normalizedPath.includes('/project_notes_images')) {
              finalUrl = `${baseURL.replace(/\/$/, '')}${normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath}`;
            } else {
              // ✅ باقي المسارات النسبية تُبنى على جذر الـ API (بدون /api في النهاية)
              finalUrl = `${API_BASE}${normalizedPath}`;
            }
          }
          const showReorderControls = canReorder && noteImages.length > 1;

          return (
            <div
              key={ img.id }
              className="relative rounded-2xl border border-gray-200 overflow-hidden group bg-gray-50"
            >
              <img
                src={ finalUrl }
                alt={ `صورة ملاحظة #${img.id}` }
                className="w-full h-32 md:h-40 object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* شريط التحكم أسفل كل صورة */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2 py-1 bg-black/40 text-white text-xs">
                <span className="px-2 py-0.5 bg-black/40 rounded-full">
                  ترتيب: { index + 1 }
                </span>

                <div className="flex items-center gap-1">
                  {/* زر التحريك يمين/يسار (إن كانت الصلاحيات تسمح) */}
                  { showReorderControls && (
                    <>
                      <button
                        type="button"
                        onClick={ () => moveImage(index, -1) }
                        disabled={ index === 0 }
                        className="p-1 rounded-full bg-white/20 hover:bg-white/40 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={ () => moveImage(index, 1) }
                        disabled={ index === noteImages.length - 1 }
                        className="p-1 rounded-full bg-white/20 hover:bg-white/40 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                    </>
                  ) }

                  {/* زر تنزيل الصورة */}
                  <a
                    href={ finalUrl }
                    download
                    className="px-2 py-0.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium"
                    title="تنزيل الصورة"
                  >
                    تنزيل
                  </a>
                </div>
              </div>
            </div>
          );
        }) }
      </div>
    </div>
  );
});

// ✅ دالة للتحقق من أن المشروع هو مشروع كفالة أيتام
const isOrphanSponsorshipProject = (project) => {
  if (!project) return false;

  const projectType = typeof project.project_type === 'object' && project.project_type !== null
    ? (project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '')
    : (project.project_type || '');

  if (projectType !== 'الكفالات' && projectType !== 'كفالات') return false;

  const subcategory = project.subcategory || {};
  const subcategoryNameAr = subcategory.name_ar || '';
  const subcategoryName = subcategory.name || '';

  return subcategoryNameAr === 'كفالة أيتام' || subcategoryName === 'Orphan Sponsorship' ||
    subcategoryNameAr.includes('كفالة أيتام') || subcategoryNameAr.includes('أيتام') ||
    (subcategoryName && subcategoryName.toLowerCase().includes('orphan sponsorship')) ||
    (subcategoryName && subcategoryName.toLowerCase().includes('orphan'));
};

const ProjectDetails = () => {
  const { invalidateProjectsCache } = useCacheInvalidation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponementReason, setPostponementReason] = useState('');
  const [isPostponing, setIsPostponing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [dailyPhases, setDailyPhases] = useState([]);
  const [dailyPhasesLoading, setDailyPhasesLoading] = useState(false);
  const [dailyPhasesError, setDailyPhasesError] = useState(null);
  // ✅ State للمشاريع الشهرية
  const [monthlyPhases, setMonthlyPhases] = useState([]);
  const [monthlyPhasesLoading, setMonthlyPhasesLoading] = useState(false);
  const [monthlyPhasesError, setMonthlyPhasesError] = useState(null);
  const [showMonthlyPhasesList, setShowMonthlyPhasesList] = useState(false); // ✅ State للتحكم في فتح/إغلاق القائمة
  const [showConvertToShekelModal, setShowConvertToShekelModal] = useState(false);
  const [exchangeRate, setExchangeRate] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [supplyData, setSupplyData] = useState(null);
  const [supplyLoading, setSupplyLoading] = useState(false);

  // ✅ State للقبول/الرفض (نفس وظيفة الإشعارات)
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [notificationToAccept, setNotificationToAccept] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [replyForm, setReplyForm] = useState({
    message: '',
    rejection_reason: '',
  });
  const [accepting, setAccepting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [projectNotification, setProjectNotification] = useState(null);
  const [subcategoryData, setSubcategoryData] = useState(null);
  const [addOrphansModalOpen, setAddOrphansModalOpen] = useState(false);

  // تعريف normalizedDailyPhases قبل استخدامه في isDividedOrDailyProject
  const normalizedDailyPhases = React.useMemo(() => {
    if (!Array.isArray(dailyPhases)) return [];
    return dailyPhases.map((phase) => ({
      ...phase,
      id: phase?.id ?? phase?._id,
      project_name: phase?.project_name ?? phase?.name,
      phase_day: phase?.phase_day ?? phase?.phaseDay ?? null,
      net_amount:
        phase?.net_amount ??
        phase?.net_amount_usd ??
        phase?.netAmount ??
        phase?.netAmountUsd ??
        0,
      execution_date: phase?.execution_date ?? phase?.phase_date ?? phase?.date ?? null,
      status: phase?.status ?? '---',
      // ✅ تنظيف quantity و beneficiaries_count - إزالة القيم 0 أو null
      quantity: phase?.quantity && phase.quantity > 0 ? phase.quantity : null,
      beneficiaries_count: phase?.beneficiaries_count && phase.beneficiaries_count > 0 ? phase.beneficiaries_count : null,
    }));
  }, [dailyPhases]);

  // ✅ تعريف normalizedMonthlyPhases للمشاريع الشهرية
  const normalizedMonthlyPhases = React.useMemo(() => {
    // ✅ محاولة الحصول من state أولاً
    const phasesFromState = Array.isArray(monthlyPhases) ? monthlyPhases : [];
    // ✅ محاولة الحصول من project.monthly_phases أو project.monthlyPhases
    const phasesFromProject = project?.monthly_phases || project?.monthlyPhases || [];

    // ✅ دمج المصادر مع إزالة التكرار بناءً على id أو month_number
    const allPhases = [...phasesFromState, ...(Array.isArray(phasesFromProject) ? phasesFromProject : [])];

    if (allPhases.length === 0) return [];

    // ✅ إزالة التكرار: استخدام Map للتأكد من عدم تكرار الشهور
    const uniquePhasesMap = new Map();

    allPhases.forEach((phase) => {
      const normalizedPhase = {
        ...phase,
        id: phase?.id ?? phase?._id,
        project_name: phase?.project_name ?? phase?.name,
        month_number: phase?.month_number ?? phase?.monthNumber ?? null,
        month_start_date: phase?.month_start_date ?? phase?.monthStartDate ?? null,
        net_amount:
          phase?.net_amount ??
          phase?.net_amount_usd ??
          phase?.netAmount ??
          phase?.netAmountUsd ??
          0,
        execution_date: phase?.execution_date ?? phase?.phase_date ?? phase?.date ?? null,
        status: phase?.status ?? '---',
        // ✅ تنظيف quantity و beneficiaries_count - إزالة القيم 0 أو null
        quantity: phase?.quantity && phase.quantity > 0 ? phase.quantity : null,
        beneficiaries_count: phase?.beneficiaries_count && phase.beneficiaries_count > 0 ? phase.beneficiaries_count : null,
      };

      // ✅ استخدام id كـ key أولاً، وإذا لم يكن موجوداً نستخدم month_number
      const key = normalizedPhase.id || `month-${normalizedPhase.month_number}`;

      // ✅ إذا كان الصنف موجوداً بالفعل، نستخدم الأحدث (الذي له id إذا كان موجوداً)
      if (!uniquePhasesMap.has(key) || (normalizedPhase.id && !uniquePhasesMap.get(key).id)) {
        uniquePhasesMap.set(key, normalizedPhase);
      }
    });

    let uniquePhases = Array.from(uniquePhasesMap.values());

    const phaseStart = project?.phase_start_date ?? project?.phaseStartDate ?? project?.parent_project?.phase_start_date ?? project?.parentProject?.phaseStartDate ?? null;
    const currentProjectMonth = getCurrentProjectMonthFromStartDate(phaseStart);

    if (phaseStart && currentProjectMonth === null) {
      uniquePhases = [];
    } else if (currentProjectMonth !== null) {
      uniquePhases = uniquePhases.filter((p) => (p.month_number ?? p.monthNumber) === currentProjectMonth);
    }

    return uniquePhases.sort((a, b) => {
      const monthA = a.month_number || 0;
      const monthB = b.month_number || 0;
      return monthA - monthB;
    });
  }, [monthlyPhases, project?.monthly_phases, project?.monthlyPhases, project?.phase_start_date, project?.parent_project?.phase_start_date]);

  // ✅ تحديد إذا كان المشروع الحالي هو مشروع يومي (له parent_project_id)
  const isDailyPhaseProject =
    project?.is_daily_phase ||
      project?.isDailyPhase ||
      project?.isDaily ||
      (project?.parent_project_id || project?.parentProjectId) ? true : false;

  // ✅ تحديد إذا كان المشروع الحالي هو مشروع شهري (child أو parent)
  const isMonthlyPhaseProject =
    project?.is_monthly_phase ||
    project?.isMonthlyPhase ||
    project?.phase_type === 'monthly' ||
    // ✅ للمشاريع الأصلية: إذا كان total_months موجود وليس phase_duration_days
    (project?.total_months && !project?.phase_duration_days && !project?.parent_project_id) ||
    // ✅ للمشاريع الشهرية (child): إذا كان total_months موجود وليس phase_duration_days وله parent_project_id
    (project?.total_months && !project?.phase_duration_days && project?.parent_project_id) ||
    // ✅ التحقق من وجود monthly_phases في الاستجابة
    (project?.monthly_phases?.length > 0) ||
    (project?.monthlyPhases?.length > 0) ||
    // ✅ التحقق من month_number (للمشاريع الشهرية child)
    (project?.month_number && !project?.phase_day && !project?.phase_duration_days);

  // ✅ تحديد نوع التقسيم مع fallback logic
  const divisionType = React.useMemo(() => {
    // ✅ إذا كان phase_type موجود، استخدمه مباشرة
    if (project?.phase_type === 'monthly' || project?.phase_type === 'daily') {
      return project.phase_type;
    }

    // ✅ إذا كان المشروع شهري (من isMonthlyPhaseProject)
    if (isMonthlyPhaseProject) {
      return 'monthly';
    }

    // ✅ إذا كان المشروع يومي (من isDailyPhaseProject)
    if (isDailyPhaseProject) {
      return 'daily';
    }

    // ✅ Fallback: تحديد من البيانات المتوفرة
    if (project?.is_divided_into_phases) {
      // ✅ التحقق من monthly_phases أولاً (الأهم)
      if (project?.monthly_phases?.length > 0 || project?.monthlyPhases?.length > 0) {
        return 'monthly';
      }
      // ✅ إذا كان هناك total_months وليس phase_duration_days، فهو شهري
      if (project?.total_months && !project?.phase_duration_days) {
        return 'monthly';
      }
      // ✅ إذا كان هناك phase_duration_days وليس total_months، فهو يومي
      if (project?.phase_duration_days && !project?.total_months) {
        return 'daily';
      }
      // ✅ إذا كان هناك month_number وليس phase_day، فهو شهري
      if ((project?.month_number || project?.monthNumber) && !project?.phase_day && !project?.phaseDay) {
        return 'monthly';
      }
      // ✅ إذا كان هناك daily_phases، فهو يومي
      if (normalizedDailyPhases.length > 0) {
        return 'daily';
      }
      // ✅ إذا كان هناك phase_day، فهو يومي
      if (project?.phase_day || project?.phaseDay) {
        return 'daily';
      }
      // ✅ افتراضياً: يومي (لأن معظم المشاريع المقسمة هي يومية)
      return 'daily';
    }

    // ✅ افتراضياً: يومي
    return 'daily';
  }, [project, isMonthlyPhaseProject, isDailyPhaseProject, normalizedDailyPhases.length]);

  // ✅ توحيد منطق المشاريع المقسمة - يشمل اليومية والشهرية (parent و child)
  // ✅ يعرض القسم إذا كان المشروع مقسم بأي طريقة (is_divided_into_phases, phase_type, total_months, phase_duration_days, أو له daily phases)
  const isDividedOrDailyProject =
    project?.is_divided_into_phases ||
    project?.isDividedIntoPhases ||
    project?.is_daily_phase ||
    project?.isDailyPhase ||
    project?.isDaily ||
    isMonthlyPhaseProject || // ✅ إضافة المشاريع الشهرية
    divisionType === 'monthly' || // ✅ إضافة المشاريع الشهرية
    project?.phase_type === 'monthly' ||
    project?.phase_type === 'daily' ||
    project?.total_months ||
    project?.phase_duration_days ||
    normalizedDailyPhases.length > 0 ||
    // ✅ إضافة فحوصات إضافية للتأكد من عدم إخفاء القسم
    (project?.parent_project_id && (project?.month_number || project?.phase_day));


  // الاحتفاظ بالمتغير القديم للتوافق مع الكود الموجود
  const isDividedProject = isDividedOrDailyProject;
  const phaseDay = project?.phase_day ?? project?.phaseDay ?? null;
  const monthNumber = project?.month_number ?? project?.monthNumber ?? null;
  const parentProjectId =
    project?.parent_project_id ??
    project?.parentProjectId ??
    project?.parent_project?.id ??
    null;
  const parentProjectName =
    project?.parent_project?.project_name ??
    project?.parent_project?.name ??
    null;

  // ✅ استخدام ref لمنع الطلبات المكررة في React Strict Mode
  const isFetchingRef = useRef(false);

  useEffect(() => {
    // ✅ إعادة تعيين subcategoryData عند تغيير المشروع
    setSubcategoryData(null);

    // ✅ منع الطلبات المكررة في React Strict Mode
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;

    // ✅ التحقق من وجود flag يشير إلى أن هناك تحديثات جديدة
    const shouldForceRefresh = localStorage.getItem(`project_${id}_updated`) === 'true';

    if (shouldForceRefresh) {
      // ✅ تحديث البيانات فوراً إذا كان هناك تحديثات جديدة
      fetchProjectDetails(true);
      // ✅ مسح الـ flag بعد التحديث
      localStorage.removeItem(`project_${id}_updated`);
    } else {
      // ✅ تحميل عادي بدون force refresh
      fetchProjectDetails();
    }

    fetchProjectTimeline();

    // ✅ Cleanup function لإعادة تعيين flag عند unmount
    return () => {
      isFetchingRef.current = false;
    };
  }, [id]);


  // ✅ جلب بيانات التوريد عند تحميل المشروع - متاح في أي مرحلة
  useEffect(() => {
    if (project?.id) {
      fetchSupplyData();
    }
  }, [project?.id, project?.status]);

  const extractProjectPayload = (payload) => {
    if (!payload) return null;
    if (payload.project) return payload.project;
    if (payload.data) return payload.data;
    if (payload.result) return payload.result;
    return payload;
  };

  const fetchProjectDetails = async (forceRefresh = false) => {
    let loadingTimeout;

    try {
      // setLoading(true);

      // إيقاف حالة التحميل بعد timeout
      loadingTimeout = setTimeout(() => {
        setLoading(false);
      }, 5000); // timeout 5 ثواني

      // ✅ إضافة timestamp لإجبار التحديث الفوري عند forceRefresh
      const params = forceRefresh ? { _t: Date.now() } : {};

      const response = await apiClient.get(`/project-proposals/${id}`, {
        params,
        timeout: 20000, // timeout 20 ثانية
        headers: forceRefresh ? {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        } : {}
      });

      if (loadingTimeout) clearTimeout(loadingTimeout);

      // ✅ التحقق من وجود البيانات والاستجابة الصحيحة
      if (!response.data) {
        throw new Error('لم يتم استلام بيانات من الخادم');
      }

      // ✅ التحقق من حالة success
      if (response.data.success === false) {
        const errorMessage = response.data.message || response.data.error || 'فشل تحميل بيانات المشروع';
        throw new Error(errorMessage);
      }

      // ✅ استخراج بيانات المشروع
      const projectData = extractProjectPayload(response.data);

      // ✅ التحقق من وجود بيانات المشروع
      if (!projectData) {
        console.error('⚠️ No project data found in response:', response.data);
        throw new Error('لم يتم العثور على بيانات المشروع في الاستجابة');
      }

      // ✅ التحقق من أن البيانات ليست فارغة (تحتوي على خصائص)
      if (Object.keys(projectData).length === 0) {
        console.error('⚠️ Project data is empty:', projectData);
        throw new Error('بيانات المشروع فارغة');
      }

      // ✅ التحقق من وجود id كحد أدنى
      if (!projectData.id && !projectData.project_proposal_id) {
        console.error('⚠️ Project data missing ID:', projectData);
        throw new Error('بيانات المشروع غير صحيحة - لا يوجد معرف للمشروع');
      }

      // 🔍 Debug: التحقق من وجود notes_image في البيانات (فقط عند تفعيل DEBUG_PROJECT_DETAILS_VERBOSE)
      if (import.meta.env.DEV && DEBUG_PROJECT_DETAILS_VERBOSE) {
        console.log('📋 Project Data:', projectData);
        console.log('📋 Subcategory check:', {
          subcategory_id: projectData.subcategory_id,
          subcategory: projectData.subcategory,
          subcategory_name: projectData.subcategory_name,
        });
        console.log('📋 Notes fields check:', {
          notes: projectData.notes,
          notes_image: projectData.notes_image,
          notes_image_url: projectData.notes_image_url,
          has_notes: !!projectData.notes,
          has_notes_image: !!projectData.notes_image,
          has_notes_image_url: !!projectData.notes_image_url,
        });

        // ✅ Debug: التحقق من بيانات التقسيم الشهري
        console.log('📅 Monthly Division Check:', {
          is_divided_into_phases: projectData.is_divided_into_phases,
          phase_type: projectData.phase_type,
          is_monthly_phase: projectData.is_monthly_phase,
          total_months: projectData.total_months,
          phase_duration_days: projectData.phase_duration_days,
          parent_project_id: projectData.parent_project_id,
          month_number: projectData.month_number,
          month_start_date: projectData.month_start_date,
          phase_start_date: projectData.phase_start_date,
          estimated_duration_days: projectData.estimated_duration_days,
          // ✅ التحقق من monthly_phases في الاستجابة
          has_monthly_phases: !!projectData.monthly_phases,
          monthly_phases_count: projectData.monthly_phases?.length || projectData.monthlyPhases?.length || 0,
          monthly_phases_keys: projectData.monthly_phases ? Object.keys(projectData.monthly_phases) : null,
          parent_project: projectData.parent_project ? {
            id: projectData.parent_project.id,
            project_name: projectData.parent_project.project_name,
            total_months: projectData.parent_project.total_months,
            phase_type: projectData.parent_project.phase_type,
            has_monthly_phases: !!projectData.parent_project.monthly_phases,
            monthly_phases_count: projectData.parent_project.monthly_phases?.length || 0
          } : null,
          // ✅ عرض جميع المفاتيح في projectData للتحقق من الحقول المرسلة
          all_keys: Object.keys(projectData).filter(key =>
            key.includes('phase') ||
            key.includes('month') ||
            key.includes('divided') ||
            key.includes('daily')
          )
        });

        // ✅ تحذير إذا كانت البيانات المهمة مفقودة
        if (projectData.is_divided_into_phases && !projectData.phase_type && !projectData.total_months && !projectData.phase_duration_days) {
          console.warn('⚠️ Backend لا يرسل تفاصيل التقسيم!', {
            message: 'المشروع مقسم لكن phase_type و total_months و phase_duration_days كلها null',
            required_fields: [
              'phase_type (monthly أو daily)',
              'total_months (للمشاريع الشهرية)',
              'phase_duration_days (للمشاريع اليومية)',
              'monthly_phases (array للمشاريع الشهرية)',
              'daily_phases (array للمشاريع اليومية)'
            ],
            received_data: {
              is_divided_into_phases: projectData.is_divided_into_phases,
              phase_type: projectData.phase_type,
              total_months: projectData.total_months,
              phase_duration_days: projectData.phase_duration_days,
              has_monthly_phases: !!projectData.monthly_phases,
              has_daily_phases: !!projectData.daily_phases
            }
          });
        }

        // ⚠️ تحذير إذا كانت هناك ملاحظات لكن لا توجد صورة
        if (projectData.notes && !projectData.notes_image_url && !projectData.notes_image) {
          console.warn('⚠️ يوجد نص ملاحظات لكن لا توجد صورة. تأكد من أن الـ Backend يرجع notes_image_url في الـ response.');
        }

        // ℹ️ ملاحظة إذا لم تكن هناك notes_image في الاستجابة (ليس خطأ - الصورة اختيارية)
        if (!projectData.notes_image && !projectData.notes_image_url) {
          if (import.meta.env.DEV) {
            console.info('ℹ️ لا توجد notes_image أو notes_image_url في استجابة الـ Backend (هذا طبيعي إذا لم تكن هناك صورة ملاحظات)');
          }
        }
      }

      // ✅ إصلاح البيانات المفقودة من monthly_phases إذا كانت موجودة
      if (projectData.is_divided_into_phases && !projectData.phase_type && !projectData.total_months) {
        const monthlyPhasesFromResponse = projectData.monthly_phases || projectData.monthlyPhases || [];
        if (Array.isArray(monthlyPhasesFromResponse) && monthlyPhasesFromResponse.length > 0) {
          // ✅ تحديد phase_type تلقائياً من monthly_phases
          projectData.phase_type = 'monthly';
          // ✅ تحديد total_months من عدد monthly_phases
          projectData.total_months = monthlyPhasesFromResponse.length;

        }
        // ✅ إذا لم تكن monthly_phases موجودة، لكن المشروع مقسم وليس له daily_phases، قد يكون شهري
        else if (!projectData.phase_duration_days && !projectData.daily_phases?.length && !projectData.dailyPhases?.length) {
          // ✅ التحقق من month_number كدليل على أنه شهري
          if (projectData.month_number || projectData.monthNumber) {
            projectData.phase_type = 'monthly';
          }
        }
      }

      // ✅ إصلاح البيانات المفقودة من daily_phases إذا كانت موجودة
      if (projectData.is_divided_into_phases && !projectData.phase_type && !projectData.phase_duration_days) {
        const phasesFromResponse = projectData.daily_phases || projectData.dailyPhases || [];
        if (Array.isArray(phasesFromResponse) && phasesFromResponse.length > 0) {
          // ✅ تحديد phase_type تلقائياً من daily_phases
          projectData.phase_type = 'daily';
          // ✅ تحديد phase_duration_days من عدد daily_phases
          projectData.phase_duration_days = phasesFromResponse.length;

        }
      }

      setProject(projectData);
      const phasesFromResponse =
        projectData.daily_phases || projectData.dailyPhases || [];
      setDailyPhases(Array.isArray(phasesFromResponse) ? phasesFromResponse : []);
      setDailyPhasesError(null);

      // ✅ حفظ monthly_phases في state إذا كانت موجودة
      const monthlyPhasesFromResponse = projectData.monthly_phases || projectData.monthlyPhases || [];
      setMonthlyPhases(Array.isArray(monthlyPhasesFromResponse) ? monthlyPhasesFromResponse : []);
      setMonthlyPhasesError(null);

      // ✅ جلب التفريعة من API إذا كانت موجودة فقط كـ ID
      if (import.meta.env.DEV && DEBUG_PROJECT_DETAILS_VERBOSE) {
        console.log('🔍 Subcategory check in project data:', {
          subcategory_id: projectData.subcategory_id,
          subcategory: projectData.subcategory,
          hasSubcategoryObject: !!projectData.subcategory
        });
      }

      if (projectData.subcategory_id) {
        if (projectData.subcategory && typeof projectData.subcategory === 'object') {
          // ✅ إذا كانت التفريعة موجودة كـ object، استخدمها مباشرة
          setSubcategoryData(projectData.subcategory);
          if (import.meta.env.DEV && DEBUG_PROJECT_DETAILS_VERBOSE) {
            console.log('✅ Using subcategory from project data:', projectData.subcategory);
          }
        } else {
          // ✅ إذا كانت موجودة فقط كـ ID، اجلبها من API
          fetchSubcategoryById(projectData.subcategory_id);
        }
      }

      // ✅ جلب الأيام المقسمة فقط للمشاريع الأصلية المقسمة (ليس للمشاريع اليومية نفسها)
      const isParentDividedProject =
        (projectData.is_divided_into_phases || projectData.isDividedIntoPhases) &&
        !projectData.is_daily_phase &&
        !projectData.isDailyPhase &&
        !projectData.isDaily &&
        !projectData.parent_project_id &&
        !projectData.parentProjectId;

      // ✅ فقط للمشاريع الأصلية المقسمة، وإذا لم تكن المراحل موجودة بالفعل
      if (
        (!phasesFromResponse || phasesFromResponse.length === 0) &&
        isParentDividedProject &&
        projectData.id
      ) {
        fetchDailyPhasesByProject(projectData.id, projectData);
      } else {
        setDailyPhasesLoading(false);
      }

      // جلب بيانات التوريد بعد تحميل بيانات المشروع
      if (projectData.id) {
        fetchSupplyData(projectData);
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);

      // ✅ معالجة خاصة لأخطاء 404 (المشروع غير موجود)
      if (error.response?.status === 404) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ Project not found (404):', id);
          console.warn('💡 Possible reasons:');
          console.warn('   1. Project was deleted from database');
          console.warn('   2. Project ID is incorrect');
          console.warn('   3. Cache contains outdated data');
          console.warn('   4. Database schema error prevents fetching project');
        }
        toast.error('المشروع غير موجود أو تم حذفه. سيتم إعادة التوجيه إلى قائمة المشاريع...', {
          autoClose: 3000
        });
        // إعادة توجيه إلى قائمة المشاريع
        setTimeout(() => {
          navigate('/project-management/projects');
        }, 2000);
        setProject(null);
        return;
      }

      // ✅ معالجة خاصة لأخطاء الصلاحيات (403)
      if (error.response?.status === 403 || error.isPermissionError) {
        const userRole = user?.role?.toLowerCase?.() ||
          user?.userRole?.toLowerCase?.() ||
          user?.user_role?.toLowerCase?.() ||
          user?.role_name?.toLowerCase?.() ||
          user?.role || '';

        const isExecutedCoordinator = userRole === 'executed_projects_coordinator' ||
          userRole === 'executedprojectscoordinator' ||
          userRole === 'منسق المشاريع المنفذة' ||
          userRole === 'منسق مشاريع منفذة';

        let permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لعرض تفاصيل هذا المشروع.';

        // ✅ رسالة خاصة لمنسق المشاريع المنفذة
        if (isExecutedCoordinator) {
          permissionMessage = 'ليس لديك صلاحيات لعرض تفاصيل هذا المشروع. يرجى التواصل مع الإدارة لتفعيل صلاحيات الوصول لمنسق المشاريع المنفذة.';
        }

        toast.error(permissionMessage, {
          autoClose: 5000
        });

        if (import.meta.env.DEV) {
          console.warn('⚠️ Permission Error (403):', {
            userRole,
            isExecutedCoordinator,
            errorMessage: error.response?.data?.message,
            backendMessage: error.response?.data
          });
        }

        // إعادة توجيه إلى قائمة المشاريع
        setTimeout(() => {
          navigate('/project-management/projects');
        }, 2000);
        setProject(null);
        return;
      }

      // ✅ معالجة أخطاء قاعدة البيانات (Database schema errors)
      // هذه الأخطاء قد تمنع جلب المشروع حتى لو كان موجوداً
      if (error.isDatabaseError || error.message?.includes('Column not found')) {
        if (import.meta.env.DEV) {
          console.error('⚠️ Database schema error detected:', error.message);
          console.error('💡 This error prevents fetching project details.');
          console.error('💡 The project might exist but cannot be loaded due to database schema issue.');
          console.error('💡 Please fix the database schema in Backend.');
        }
        // ✅ عرض رسالة واضحة للمستخدم
        toast.error('خطأ في قاعدة البيانات يمنع تحميل المشروع. يرجى التواصل مع الإدارة.', {
          autoClose: 5000
        });
        // إعادة توجيه إلى قائمة المشاريع بعد 3 ثوان
        setTimeout(() => {
          navigate('/project-management/projects');
        }, 3000);
        setProject(null);
        return;
      }

      // ✅ معالجة خطأ 404 (المشروع غير موجود)
      if (error.response?.status === 404) {
        const errorMessage = error.response?.data?.message || error.userMessage || 'المشروع غير موجود';
        toast.error(errorMessage, {
          autoClose: 5000
        });
        if (import.meta.env.DEV) {
          console.error('⚠️ Project not found (404):', {
            projectId: id,
            errorMessage: error.response?.data?.message,
            fullError: error
          });
        }
        // إعادة توجيه إلى قائمة المشاريع
        setTimeout(() => {
          navigate('/project-management/projects');
        }, 2000);
        setProject(null);
        return;
      }

      // ✅ معالجة الأخطاء الأخرى
      if (import.meta.env.DEV && !error.isConnectionError && !error.isTimeoutError) {
        console.error('Error fetching project details:', {
          projectId: id,
          error: error,
          response: error.response?.data,
          status: error.response?.status,
          message: error.message,
          userMessage: error.userMessage
        });
      }

      if (!error.isConnectionError && !error.isTimeoutError) {
        const errorMessage = error.userMessage || error.response?.data?.message || error.message || 'فشل تحميل تفاصيل المشروع';
        toast.error(errorMessage, {
          autoClose: 5000
        });
      }
      setProject(null);
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const fetchSubcategoryById = async (subcategoryId) => {
    if (!subcategoryId) return;

    if (import.meta.env.DEV) {
      console.log('📤 Fetching subcategory by ID:', subcategoryId);
    }

    try {
      const response = await apiClient.get(`/project-subcategories/${subcategoryId}`, {
        params: { _t: Date.now() },
        timeout: 10000,
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (import.meta.env.DEV) {
        console.log('📥 Subcategory API response:', response.data);
      }

      if (response.data.success !== false) {
        const subcategory = response.data.data || response.data.subcategory || response.data.result || response.data;
        if (subcategory && (subcategory.id || subcategory.name || subcategory.name_ar)) {
          setSubcategoryData(subcategory);
          if (import.meta.env.DEV) {
            console.log('✅ Fetched and set subcategory:', subcategory);
          }
        } else {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Subcategory data is invalid:', subcategory);
          }
        }
      } else {
        if (import.meta.env.DEV) {
          console.warn('⚠️ API returned success: false');
        }
      }
    } catch (error) {
      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('❌ Error fetching subcategory:', error);
        console.error('Error response:', error.response?.data);
      }
      // لا نعرض toast لأن هذا ليس خطأ حرج
    }
  };

  const fetchDailyPhasesByProject = async (projectId, projectDataToCheck = null) => {
    if (!projectId) return;

    // ✅ استخدام البيانات المُمررة أو البيانات من state
    const dataToCheck = projectDataToCheck || project;

    // ✅ لا تجلب المشاريع اليومية إذا كان المشروع الحالي نفسه مشروع يومي
    if (dataToCheck?.is_daily_phase ||
      dataToCheck?.isDailyPhase ||
      dataToCheck?.parent_project_id ||
      dataToCheck?.parentProjectId) {
      if (import.meta.env.DEV) {
        console.log('⏭️ تخطي جلب المشاريع اليومية - المشروع الحالي نفسه مشروع يومي');
      }
      setDailyPhasesLoading(false);
      return;
    }

    setDailyPhasesLoading(true);
    setDailyPhasesError(null);
    try {
      const response = await apiClient.get(`/project-proposals/${projectId}/daily-phases`, {
        params: {
          _t: Date.now(), // ✅ cache busting
        },
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      const phases =
        response.data?.daily_phases ||
        response.data?.dailyPhases ||
        response.data?.data ||
        response.data?.projects ||
        [];
      if (Array.isArray(phases)) {
        setDailyPhases(phases);
      } else {
        setDailyPhases([]);
      }
    } catch (error) {
      // ✅ فقط عرض التحذير إذا لم يكن الخطأ بسبب أن المشروع ليس مقسم
      if (error.response?.status !== 400) {
        console.warn('⚠️ تعذر جلب المشاريع اليومية للمشروع:', projectId, error);
      }
      setDailyPhases([]);
      // ✅ لا نعرض رسالة خطأ إذا كان المشروع ليس مقسماً (400)
      if (error.response?.status !== 400) {
        setDailyPhasesError(error.userMessage || error.response?.data?.message || 'فشل تحميل المشاريع اليومية');
      }
    } finally {
      setDailyPhasesLoading(false);
    }
  };

  const fetchProjectTimeline = async () => {
    try {
      const response = await apiClient.get(`/project-proposals/${id}/timeline`, {
        params: {
          _t: Date.now(), // ✅ cache busting
          include_user: true, // ✅ طلب بيانات المستخدم مع timeline
          include_shelter: true, // ✅ طلب بيانات المخيم مع timeline
        },
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      if (response.data.success !== false) {
        const timelineData =
          response.data.timeline ||
          response.data.data ||
          response.data.results ||
          response.data;

        if (import.meta.env.DEV && DEBUG_PROJECT_DETAILS_VERBOSE) {
          console.log(`📋 Timeline loaded: ${Array.isArray(timelineData) ? timelineData.length : 0} items`);
        }

        const normalizedTimeline = Array.isArray(timelineData) ? timelineData.map(item => {

          // ✅ استخراج changed_by_name إذا كان متاحاً من changed_by_user أو changedBy
          if (!item.changed_by_name) {
            item.changed_by_name =
              item.changed_by_user?.name ||
              item.changed_by_user?.user_name ||
              item.changedBy?.name ||
              item.changedBy?.user_name ||
              item.user?.name ||
              item.user?.user_name ||
              null;
          }

          // ✅ معالجة changed_by إذا كان object - استخراج id فقط
          if (item.changed_by && typeof item.changed_by === 'object' && item.changed_by !== null) {
            // ✅ حفظ الـ id الأصلي قبل التحويل
            const originalChangedBy = item.changed_by;
            item.changed_by = item.changed_by.id || item.changed_by.user_id || originalChangedBy;

            // ✅ إذا لم يكن هناك changed_by_name، نجرب استخراجه من object
            if (!item.changed_by_name) {
              item.changed_by_name = originalChangedBy.name || originalChangedBy.user_name || null;
            }
          }

          return item;
        }) : [];

        setTimeline(normalizedTimeline);
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
      setTimeline([]);
    }
  };

  // جلب بيانات التوريد من API
  const fetchSupplyData = async (projectData = null) => {
    const projectId = id || projectData?.id;
    if (!projectId) return;

    try {
      setSupplyLoading(true);
      const response = await apiClient.get(`/projects/${projectId}/warehouse`);

      if (response.data.success) {
        const data = response.data.data || response.data;
        const summaryData = data.summary || data;
        const currentProject = projectData || project;

        // تحديد العملة
        const isShekel = currentProject?.shekel_exchange_rate && currentProject?.net_amount_shekel;
        const currency = summaryData.currency || (isShekel ? 'ILS' : 'USD');

        // تحديث بيانات التوريد
        setSupplyData({
          quantity: data.project?.quantity || currentProject?.quantity || 0,
          unit_cost: summaryData.unit_cost || 0,
          total_supply_cost: summaryData.total_supply_cost || summaryData.supply_cost || 0,
          surplus_amount: summaryData.expected_surplus || summaryData.surplus_amount || 0,
          deficit_amount: summaryData.deficit_amount || 0,
          has_deficit: summaryData.has_deficit || false,
          currency: currency,
          items_count: data.items?.length || 0,
        });
      }
    } catch (error) {
      // ✅ تجاهل أخطاء 404 و 400 و 403 (المشروع لم يدخل مرحلة التوريد أو لا توجد صلاحيات)
      if (error.response?.status === 404 || error.response?.status === 400 || error.response?.status === 403) {
        if (import.meta.env.DEV) {
          console.log('ℹ️ Supply data not available:', error.response?.status === 404 ? 'Project not found' :
            error.response?.status === 403 ? 'No permissions' : 'Bad request');
        }
        setSupplyData(null);
        return;
      }

      // ✅ تجاهل أخطاء قاعدة البيانات (Database schema errors)
      if (error.isDatabaseError || error.message?.includes('Column not found')) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ Database schema error in supply data:', error.message);
        }
        setSupplyData(null);
        return;
      }

      // ✅ تجاهل أخطاء الاتصال والـ timeout
      if (error.isConnectionError || error.isTimeoutError) {
        setSupplyData(null);
        return;
      }

      // ✅ عرض الأخطاء الأخرى فقط في Development Mode
      if (import.meta.env.DEV) {
        console.error('Error fetching supply data:', error);
      }
      setSupplyData(null);
    } finally {
      setSupplyLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await apiClient.delete(`/project-proposals/${id}`);
      if (response.data.success) {
        toast.success('تم حذف المشروع بنجاح');

        // ✅ إبطال كاش المشاريع تلقائياً (سيتم إعلام جميع المكونات)
        invalidateProjectsCache();

        navigate('/project-management/projects');
      } else {
        toast.error(response.data.message || 'فشل حذف المشروع');
      }
    } catch (error) {
      console.error('Error deleting project:', error);

      // ✅ معالجة خاصة لأخطاء الصلاحيات (403)
      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لحذف مشروع. الصلاحيات مقتصرة على الإدارة فقط.';
        toast.error(permissionMessage);
        setShowDeleteConfirm(false);
        return;
      }

      toast.error(error.userMessage || 'حدث خطأ أثناء حذف المشروع');
    }
    setShowDeleteConfirm(false);
  };

  const handleTransferToExecution = async () => {
    if (!window.confirm('هل أنت متأكد من نقل المشروع للتنفيذ؟ سيتم نقل المشروع لجدول المشاريع المنفذة.')) {
      return;
    }

    try {
      // setLoading(true);
      const response = await apiClient.post(`/project-proposals/${id}/transfer-to-execution`);

      if (response.data.success) {
        toast.success(response.data.message || 'تم نقل المشروع للتنفيذ بنجاح');
        invalidateProjectsCache(); // ✅ إبطال كاش المشاريع
        fetchProjectDetails(true); // ✅ تحديث البيانات فوراً (force refresh)
        fetchProjectTimeline(); // تحديث Timeline
      } else {
        toast.error(response.data.message || 'فشل نقل المشروع');
      }
    } catch (error) {
      console.error('Error transferring project:', error);
      toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء نقل المشروع');
    } finally {
      setLoading(false);
    }
  };

  // ✅ تأجيل المشروع
  const handlePostponeProject = async () => {
    if (!postponementReason.trim()) {
      toast.error('يرجى إدخال سبب التأجيل');
      return;
    }

    try {
      setIsPostponing(true);
      const response = await apiClient.post(`/project-proposals/${id}/postpone`, {
        postponement_reason: postponementReason.trim(),
      });

      if (response.data.success) {
        toast.success(response.data.message || 'تم تأجيل المشروع بنجاح');
        invalidateProjectsCache(); // ✅ إبطال كاش المشاريع
        setShowPostponeModal(false);
        setPostponementReason('');
        fetchProjectDetails(true); // ✅ تحديث البيانات فوراً (force refresh)
        fetchProjectTimeline(); // تحديث Timeline
      } else {
        toast.error(response.data.message || 'فشل تأجيل المشروع');
      }
    } catch (error) {
      console.error('Error postponing project:', error);

      // معالجة خاصة لأخطاء الصلاحيات
      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لتأجيل هذا المشروع.';
        toast.error(permissionMessage);
      } else {
        toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء تأجيل المشروع');
      }
    } finally {
      setIsPostponing(false);
    }
  };

  // ✅ استئناف المشروع المؤجل
  const handleResumeProject = async () => {
    if (!window.confirm('هل أنت متأكد من استئناف المشروع؟ سيتم إعادة المشروع لحالته السابقة.')) {
      return;
    }

    try {
      setIsResuming(true);
      const response = await apiClient.post(`/project-proposals/${id}/resume`);

      if (response.data.success) {
        toast.success(response.data.message || 'تم استئناف المشروع بنجاح');
        invalidateProjectsCache(); // ✅ إبطال كاش المشاريع
        fetchProjectDetails(true); // ✅ تحديث البيانات فوراً (force refresh)
        fetchProjectTimeline(); // تحديث Timeline
      } else {
        toast.error(response.data.message || 'فشل استئناف المشروع');
      }
    } catch (error) {
      console.error('Error resuming project:', error);

      // معالجة خاصة لأخطاء الصلاحيات
      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لاستئناف هذا المشروع.';
        toast.error(permissionMessage);
      } else {
        toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء استئناف المشروع');
      }
    } finally {
      setIsResuming(false);
    }
  };

  // ✅ جلب إشعار media_completed المرتبط بمشروع معين
  const fetchProjectNotification = async (projectId) => {
    try {
      const response = await apiClient.get('/notifications', {
        params: {
          related_project_id: projectId,
          notification_type: 'media_completed',
        }
      });

      if (response.data.success) {
        const notifications = response.data.data || response.data.notifications || [];
        // جلب أول إشعار غير معالج (لم يتم قبوله أو رفضه)
        const notification = notifications.find(n =>
          n.type === 'media_completed' || n.notification_type === 'media_completed'
        );
        return notification || null;
      }
      return null;
    } catch (error) {
      console.error('Error fetching project notification:', error);
      return null;
    }
  };

  // ✅ فتح Modal للقبول/الرفض عند النقر على حالة "وصل للمتبرع"
  const handleStatusClick = async () => {
    if (project?.status !== 'وصل للمتبرع') return;

    // ✅ فتح Modal مباشرة مع بيانات المشروع
    // إنشاء كائن مؤقت يحتوي على بيانات المشروع
    const tempNotification = {
      id: null, // لا يوجد إشعار فعلي
      project_id: project.id,
      related_project_id: project.id,
      metadata: {
        project_id: project.id,
        project_name: project.project_name,
        donor_code: project.donor_code,
        internal_code: project.internal_code,
      },
      type: 'media_completed',
      notification_type: 'media_completed',
    };

    // حفظ المشروع الحالي والإشعار المؤقت
    setProjectNotification(tempNotification);
    setNotificationToAccept(tempNotification);
    setAcceptModalOpen(true);
  };

  // ✅ وظائف القبول/الرفض (نفس الكود من Notifications.jsx)
  const handleOpenAcceptModal = (notification) => {
    setNotificationToAccept(notification);
    setAcceptModalOpen(true);
  };

  const handleCloseAcceptModal = () => {
    setAcceptModalOpen(false);
    setNotificationToAccept(null);
    setProjectNotification(null);
  };

  const handleAccept = async () => {
    if (!notificationToAccept) return;

    let successHandled = false; // ✅ متغير لتتبع ما إذا تم عرض رسالة النجاح

    try {
      setAccepting(true);

      // ✅ التحقق من دور المستخدم
      const userRole = user?.role?.toLowerCase?.() ||
        user?.userRole?.toLowerCase?.() ||
        user?.user_role?.toLowerCase?.() ||
        user?.role_name?.toLowerCase?.() ||
        user?.role || '';

      const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

      // ✅ للـ Admin: ننقل المشروع مباشرة إلى "منتهي" دائماً
      if (isAdmin) {
        console.log('🔵 Admin detected - moving project to "منتهي" directly');
        const projectId = notificationToAccept.project_id || notificationToAccept.related_project_id || project?.id;
        console.log('📋 Project ID:', projectId);
        console.log('📋 Notification data:', notificationToAccept);

        // ✅ أولاً: نقبل الإشعار إذا كان موجوداً
        if (notificationToAccept.id) {
          try {
            console.log('📨 Accepting notification:', notificationToAccept.id);
            await apiClient.post(`/notifications/${notificationToAccept.id}/accept`);
            console.log('✅ Notification accepted successfully');
          } catch (error) {
            console.warn('⚠️ Error accepting notification (continuing):', error);
            // نستمر في تحديث حالة المشروع حتى لو فشل قبول الإشعار
          }
        }

        // ✅ ثانياً: نحدث حالة المشروع إلى "منتهي" مباشرة
        console.log('🔄 Updating project status to "منتهي"...');
        const updatePayload = {
          status: 'منتهي',
          completed_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
        };
        console.log('📤 Update payload:', updatePayload);

        const response = await apiClient.put(`/project-proposals/${projectId}`, updatePayload);
        console.log('📥 Backend response:', response.data);
        console.log('📥 Full response:', JSON.stringify(response.data, null, 2));

        // ✅ فحص حالة المشروع في الاستجابة
        const updatedProject = response.data.project || response.data.data;
        if (updatedProject) {
          console.log('📊 Updated project from backend:', {
            id: updatedProject.id,
            status: updatedProject.status,
            completed_date: updatedProject.completed_date,
            is_divided_into_phases: updatedProject.is_divided_into_phases
          });

          // ⚠️ تحذير إذا لم تتغير الحالة
          if (updatedProject.status !== 'منتهي') {
            console.error('⚠️ WARNING: Backend did not update status to "منتهي"!');
            console.error('⚠️ Current status:', updatedProject.status);
            console.error('⚠️ This might be a Backend Observer/Event issue');
          }
        }

        if (response.data.success) {
          successHandled = true;
          console.log('✅ Project status updated successfully to "منتهي"');
          toast.success('تم قبول المونتاج والمشروع أصبح في حالة "منتهي"');
          handleCloseAcceptModal();

          // ✅ إعادة جلب تفاصيل المشروع
          await fetchProjectDetails(true);

          // ✅ إذا كان المشروع اليومي، قم بتحديث المشروع الأصلي أيضاً
          if (isDailyPhaseProject && parentProjectId) {
            try {
              // ✅ جلب جميع المشاريع اليومية للمشروع الأصلي
              const dailyPhasesResponse = await apiClient.get('/project-proposals', {
                params: {
                  parent_project_id: parentProjectId,
                  is_daily_phase: true
                }
              });

              const allDailyPhases = dailyPhasesResponse.data.projects || dailyPhasesResponse.data.data || [];

              // ✅ التحقق من حالة جميع المشاريع اليومية
              const allFinished = allDailyPhases.every(phase => phase.status === 'منتهي');

              // ✅ إذا كانت جميع المشاريع اليومية منتهية، قم بتحديث المشروع الأصلي
              if (allFinished && allDailyPhases.length > 0) {
                await apiClient.put(`/project-proposals/${parentProjectId}`, {
                  status: 'منتهي'
                });
                toast.success('تم تحديث المشروع الأصلي إلى "منتهي" بعد إنهاء جميع المشاريع اليومية');

                // ✅ تحديث localStorage لإعلام صفحة المشروع الأصلي بالتحديثات
                localStorage.setItem(`project_${parentProjectId}_updated`, 'true');
              }
            } catch (parentError) {
              console.error('Error updating parent project:', parentError);
              // ✅ لا نعرض خطأ للمستخدم لأن المشروع اليومي تم تحديثه بنجاح
            }
          }
        } else {
          toast.error(response.data.message || 'حدث خطأ أثناء قبول المونتاج');
        }

        return; // ✅ الخروج من الدالة بعد معالجة Admin
      }

      // ✅ لغير الـ Admin: نستخدم API الإشعارات (الطريقة القديمة)
      // ✅ إذا كان هناك إشعار فعلي، استخدم API الإشعارات
      if (notificationToAccept.id) {
        try {
          const response = await apiClient.post(`/notifications/${notificationToAccept.id}/accept`);

          if (response.data.success) {
            successHandled = true; // ✅ تم معالجة النجاح
            const newStatus = response.data.project?.status;

            // ✅ التحقق من الحالة الجديدة
            if (newStatus === 'منتهي') {
              // إظهار رسالة خاصة للمشاريع المنتهية
              toast.success(response.data.message || 'تم قبول المونتاج والمشروع أصبح في حالة "منتهي"');
            } else {
              toast.success(response.data.message || 'تم قبول المونتاج بنجاح');
            }

            handleCloseAcceptModal();
            fetchProjectDetails(true); // تحديث بيانات المشروع

            // ✅ إذا كان المشروع اليومي، قم بتحديث المشروع الأصلي أيضاً
            if (isDailyPhaseProject && parentProjectId) {
              try {
                // ✅ جلب جميع المشاريع اليومية للمشروع الأصلي
                const dailyPhasesResponse = await apiClient.get('/project-proposals', {
                  params: {
                    parent_project_id: parentProjectId,
                    is_daily_phase: true
                  }
                });

                const allDailyPhases = dailyPhasesResponse.data.projects || dailyPhasesResponse.data.data || [];

                // ✅ التحقق من حالة جميع المشاريع اليومية
                const allFinished = allDailyPhases.every(phase => phase.status === 'منتهي');

                // ✅ إذا كانت جميع المشاريع اليومية منتهية، قم بتحديث المشروع الأصلي
                if (allFinished && allDailyPhases.length > 0) {
                  await apiClient.put(`/project-proposals/${parentProjectId}`, {
                    status: 'منتهي'
                  });
                  toast.success('تم تحديث المشروع الأصلي إلى "منتهي" بعد إنهاء جميع المشاريع اليومية');
                }

                // ✅ تحديث localStorage لإعلام صفحة المشروع الأصلي بالتحديثات
                localStorage.setItem(`project_${parentProjectId}_updated`, 'true');
              } catch (parentError) {
                console.error('Error updating parent project:', parentError);
                // ✅ لا نعرض خطأ للمستخدم لأن المشروع اليومي تم تحديثه بنجاح
              }
            }
          } else {
            toast.error(response.data.message || 'حدث خطأ أثناء قبول المونتاج');
          }
        } catch (acceptError) {
          // ✅ معالجة خطأ 422 - يجب تحديث المشروع الأصلي أولاً
          if (acceptError.response?.status === 422) {
            const errorMessage = acceptError.response?.data?.message || '';
            const errorData = acceptError.response?.data || {};

            // ✅ تسجيل تفاصيل الخطأ للمساعدة في التشخيص
            console.error('422 Error Details:', {
              message: errorMessage,
              data: errorData,
              isDailyPhaseProject,
              parentProjectId,
              projectId: project?.id
            });

            // ✅ التحقق من أن الخطأ يتعلق بتحديث المشروع الأصلي
            const isParentProjectError =
              errorMessage.includes('يجب تحديث المشروع الأصلي') ||
              errorMessage.includes('المشروع الأصلي') ||
              errorMessage.includes('original project') ||
              errorMessage.includes('parent project') ||
              (isDailyPhaseProject && parentProjectId);

            if (isParentProjectError && isDailyPhaseProject && parentProjectId) {
              try {
                // ✅ جلب المشروع الأصلي أولاً للتحقق من حالته
                let parentProject = null;
                try {
                  const parentResponse = await apiClient.get(`/project-proposals/${parentProjectId}`);
                  parentProject = parentResponse.data?.project || parentResponse.data?.data || parentResponse.data;
                } catch (parentFetchError) {
                  console.error('Error fetching parent project:', parentFetchError);
                }

                // ✅ جلب جميع المشاريع اليومية للمشروع الأصلي
                const dailyPhasesResponse = await apiClient.get('/project-proposals', {
                  params: {
                    parent_project_id: parentProjectId,
                    is_daily_phase: true
                  }
                });

                const allDailyPhases = dailyPhasesResponse.data.projects || dailyPhasesResponse.data.data || [];

                // ✅ التحقق من حالة جميع المشاريع اليومية
                const allFinished = allDailyPhases.length > 0 && allDailyPhases.every(phase => phase.status === 'منتهي');
                const finishedCount = allDailyPhases.filter(phase => phase.status === 'منتهي').length;

                console.log('Daily phases status:', {
                  total: allDailyPhases.length,
                  finished: finishedCount,
                  allFinished,
                  parentStatus: parentProject?.status
                });

                // ✅ تحديث المشروع الأصلي بناءً على حالة المشاريع اليومية
                if (allDailyPhases.length > 0) {
                  if (allFinished) {
                    // ✅ إذا كانت جميع المشاريع اليومية منتهية، قم بتحديث المشروع الأصلي إلى "منتهي"
                    await apiClient.put(`/project-proposals/${parentProjectId}`, {
                      status: 'منتهي'
                    });
                    toast.success('تم تحديث المشروع الأصلي إلى "منتهي" بعد إنهاء جميع المشاريع اليومية');
                  } else {
                    // ✅ إذا لم تكن جميع المشاريع منتهية، قد نحتاج فقط لتحديث حالة المشروع الأصلي
                    // ✅ محاولة تحديث المشروع الأصلي لضمان التزامن
                    try {
                      // ✅ جلب الحالة الحالية للمشروع الأصلي وتحديثه
                      const currentStatus = parentProject?.status;
                      if (currentStatus && currentStatus !== 'منتهي') {
                        // ✅ تحديث المشروع الأصلي بنفس الحالة (لتحديث البيانات)
                        await apiClient.put(`/project-proposals/${parentProjectId}`, {
                          status: currentStatus
                        });
                        console.log('Updated parent project status to sync:', currentStatus);
                      }
                    } catch (syncError) {
                      console.error('Error syncing parent project:', syncError);
                    }
                  }

                  // ✅ تحديث localStorage
                  localStorage.setItem(`project_${parentProjectId}_updated`, 'true');
                }

                // ✅ إعادة محاولة قبول الإشعار بعد تحديث المشروع الأصلي
                const retryResponse = await apiClient.post(`/notifications/${notificationToAccept.id}/accept`);

                if (retryResponse.data.success) {
                  successHandled = true;
                  const newStatus = retryResponse.data.project?.status;

                  if (newStatus === 'منتهي') {
                    toast.success(retryResponse.data.message || 'تم قبول المونتاج والمشروع أصبح في حالة "منتهي"');
                  } else {
                    toast.success(retryResponse.data.message || 'تم قبول المونتاج بنجاح');
                  }

                  handleCloseAcceptModal();
                  fetchProjectDetails(true);
                  return; // ✅ نجح، لا حاجة للمتابعة
                } else {
                  // ✅ إذا فشلت إعادة المحاولة
                  throw new Error(retryResponse.data.message || 'فشلت إعادة محاولة قبول الإشعار');
                }
              } catch (retryError) {
                console.error('Error retrying accept after parent update:', retryError);
                const retryErrorMessage = retryError.response?.data?.message || retryError.message || 'فشلت إعادة محاولة قبول الإشعار بعد تحديث المشروع الأصلي';
                toast.error(retryErrorMessage);
                throw retryError; // ✅ أعد إرسال الخطأ للـ catch الرئيسي
              }
            } else if (isParentProjectError) {
              // ✅ إذا كان الخطأ يتعلق بالمشروع الأصلي لكن لا يوجد parentProjectId
              toast.error(errorMessage || 'يجب تحديث المشروع الأصلي قبل قبول هذا الإشعار');
              throw acceptError;
            } else {
              // ✅ إذا كان الخطأ 422 لكن لا يتعلق بالمشروع الأصلي
              console.error('422 Error not related to parent project:', errorMessage);
              throw acceptError;
            }
          } else {
            // ✅ إذا لم يكن الخطأ 422
            throw acceptError;
          }
        }
      } else {
        // ✅ إذا لم يكن هناك إشعار، قم بتحويل المشروع مباشرة إلى "منتهي"
        const projectId = notificationToAccept.project_id || notificationToAccept.related_project_id;

        // ✅ إعداد البيانات المطلوبة للتحديث
        const updateData = {
          status: 'منتهي'
        };

        // ✅ إذا كان المشروع اليومي، أضف parent_project_id للبيانات
        if (isDailyPhaseProject && parentProjectId) {
          updateData.parent_project_id = parentProjectId;
          updateData.is_daily_phase = true;
        }

        const response = await apiClient.put(`/project-proposals/${projectId}`, updateData);

        if (response.data.success) {
          successHandled = true; // ✅ تم معالجة النجاح
          toast.success('تم قبول المونتاج والمشروع أصبح في حالة "منتهي"');
          handleCloseAcceptModal();

          // ✅ إعادة جلب تفاصيل المشروع
          await fetchProjectDetails(true);

          // ✅ إذا كان المشروع اليومي، قم بتحديث المشروع الأصلي أيضاً
          if (isDailyPhaseProject && parentProjectId) {
            try {
              // ✅ جلب جميع المشاريع اليومية للمشروع الأصلي
              const dailyPhasesResponse = await apiClient.get('/project-proposals', {
                params: {
                  parent_project_id: parentProjectId,
                  is_daily_phase: true
                }
              });

              const allDailyPhases = dailyPhasesResponse.data.projects || dailyPhasesResponse.data.data || [];

              // ✅ التحقق من حالة جميع المشاريع اليومية
              const allFinished = allDailyPhases.every(phase => phase.status === 'منتهي');

              // ✅ إذا كانت جميع المشاريع اليومية منتهية، قم بتحديث المشروع الأصلي
              if (allFinished && allDailyPhases.length > 0) {
                await apiClient.put(`/project-proposals/${parentProjectId}`, {
                  status: 'منتهي'
                });
                toast.success('تم تحديث المشروع الأصلي إلى "منتهي" بعد إنهاء جميع المشاريع اليومية');

                // ✅ تحديث localStorage لإعلام صفحة المشروع الأصلي بالتحديثات
                localStorage.setItem(`project_${parentProjectId}_updated`, 'true');
              }
            } catch (parentError) {
              console.error('Error updating parent project:', parentError);
              // ✅ لا نعرض خطأ للمستخدم لأن المشروع اليومي تم تحديثه بنجاح
            }
          }
        } else {
          toast.error(response.data.message || 'حدث خطأ أثناء قبول المونتاج');
        }
      }
    } catch (error) {
      console.error('Error accepting notification:', error);
      // ✅ فقط عرض رسالة خطأ إذا لم يتم عرض رسالة نجاح
      if (!successHandled) {
        const errorMessage = error.response?.data?.message || error.message || 'حدث خطأ أثناء قبول المونتاج';
        const errorStatus = error.response?.status;

        // ✅ عرض رسالة خطأ أكثر تفصيلاً
        if (errorStatus === 422) {
          toast.error(errorMessage || 'خطأ في التحقق من البيانات. يرجى التحقق من حالة المشروع الأصلي.');
        } else if (errorStatus === 400) {
          toast.error(errorMessage || 'طلب غير صحيح. يرجى المحاولة مرة أخرى.');
        } else if (errorStatus === 404) {
          toast.error('الإشعار أو المشروع غير موجود.');
        } else if (errorStatus >= 500) {
          toast.error('خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.');
        } else {
          toast.error(errorMessage);
        }
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleOpenReplyModal = (notification) => {
    setSelectedNotification(notification);
    setReplyForm({ message: '', rejection_reason: '' });
    setReplyModalOpen(true);
  };

  const handleCloseReplyModal = () => {
    setReplyModalOpen(false);
    setSelectedNotification(null);
    setReplyForm({ message: '', rejection_reason: '' });
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();

    if (!replyForm.message.trim() || !replyForm.rejection_reason.trim()) {
      toast.error('الرجاء ملء جميع الحقول');
      return;
    }

    let successHandled = false; // ✅ متغير لتتبع ما إذا تم عرض رسالة النجاح

    try {
      setReplying(true);

      // ✅ إذا كان هناك إشعار فعلي، استخدم API الإشعارات
      if (selectedNotification.id) {
        const response = await apiClient.post(
          `/notifications/${selectedNotification.id}/reply`,
          replyForm
        );

        if (response.data.success) {
          successHandled = true; // ✅ تم معالجة النجاح
          toast.success('تم إرسال الرد بنجاح');
          handleCloseReplyModal();
          fetchProjectDetails(true); // تحديث بيانات المشروع
        } else {
          toast.error(response.data.message || 'حدث خطأ أثناء إرسال الرد');
        }
      } else {
        // ✅ إذا لم يكن هناك إشعار، قم بتحويل المشروع إلى "يجب إعادة المونتاج"
        const projectId = selectedNotification.project_id || selectedNotification.related_project_id;

        console.log('📤 Rejecting montage - Sending to Backend:', {
          status: 'يجب إعادة المونتاج',
          rejection_reason: replyForm.rejection_reason,
          rejection_message: replyForm.message
        });

        const response = await apiClient.put(`/project-proposals/${projectId}`, {
          status: 'يجب إعادة المونتاج',
          rejection_reason: replyForm.rejection_reason,
          rejection_message: replyForm.message,
          admin_rejection_reason: replyForm.rejection_reason, // ✅ إضافة الحقل البديل
          media_rejection_reason: replyForm.rejection_reason  // ✅ إضافة الحقل البديل
        });

        console.log('📥 Backend response:', response.data);
        if (response.data.project) {
          console.log('📊 Updated project:', {
            id: response.data.project.id,
            status: response.data.project.status,
            rejection_reason: response.data.project.rejection_reason,
            admin_rejection_reason: response.data.project.admin_rejection_reason,
            media_rejection_reason: response.data.project.media_rejection_reason
          });
        }

        if (response.data.success) {
          successHandled = true; // ✅ تم معالجة النجاح
          toast.success('تم رفض المونتاج وإرجاع المشروع لإعادة المونتاج');
          handleCloseReplyModal();

          // ✅ إعادة جلب تفاصيل المشروع
          await fetchProjectDetails(true);
        } else {
          toast.error(response.data.message || 'حدث خطأ أثناء رفض المونتاج');
        }
      }
    } catch (error) {
      console.error('Error replying to notification:', error);
      // ✅ فقط عرض رسالة خطأ إذا لم يتم عرض رسالة نجاح
      if (!successHandled) {
        toast.error(error.response?.data?.message || 'حدث خطأ أثناء إرسال الرد');
      }
    } finally {
      setReplying(false);
    }
  };

  // ✅ دالة للحصول على كود المشروع (donor_code أولاً، ثم internal_code إذا كان donor_code فارغاً)
  const getProjectCode = () => {
    // ✅ استخدام الدالة الموحدة من helpers
    return getProjectCodeHelper(project, '---');
  };

  // ✅ التحقق من إمكانية تأجيل المشروع (قبل التنفيذ)
  const canPostponeProject = () => {
    const status = project?.status;
    const postponedStatuses = ['مؤجل'];
    const executionStatuses = ['قيد التنفيذ', 'منفذ', 'في المونتاج', 'تم المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];

    // لا يمكن تأجيل المشروع إذا كان مؤجلاً بالفعل أو في مرحلة التنفيذ
    if (postponedStatuses.includes(status) || executionStatuses.includes(status)) {
      return false;
    }

    return true;
  };

  // ✅ التحقق من إمكانية استئناف المشروع (مؤجل فقط)
  const canResumeProject = () => {
    return project?.status === 'مؤجل';
  };

  // ✅ نقل المشروع للتوريد
  const handleMoveToSupply = async () => {
    if (!window.confirm('هل أنت متأكد من نقل المشروع لمرحلة التوريد؟ سيتم تغيير حالة المشروع إلى "قيد التوريد".')) {
      return;
    }

    try {
      // setLoading(true);
      const response = await apiClient.post(`/project-proposals/${id}/move-to-supply`);

      if (response.data.success) {
        toast.success(response.data.message || 'تم نقل المشروع لمرحلة التوريد بنجاح');
        invalidateProjectsCache(); // ✅ إبطال كاش المشاريع
        fetchProjectDetails(true); // ✅ تحديث البيانات فوراً (force refresh)
        fetchProjectTimeline(); // تحديث Timeline
        // الانتقال لصفحة سلة التوريد
        navigate(`/project-management/projects/${id}/supply`);
      } else {
        toast.error(response.data.message || 'فشل نقل المشروع لمرحلة التوريد');
      }
    } catch (error) {
      console.error('Error moving to supply:', error);
      if (error.response?.status === 422) {
        toast.error(error.response.data.message || 'لا يمكن نقل المشروع لمرحلة التوريد');
      } else {
        toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء نقل المشروع للتوريد');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'جديد': 'bg-blue-500',
      'قيد التوريد': 'bg-indigo-500',
      'تم التوريد': 'bg-teal-500',
      'قيد التوزيع': 'bg-orange-500',
      'مؤجل': 'bg-amber-500',
      'جاهز للتنفيذ': 'bg-yellow-500',
      'تم اختيار المخيم': 'bg-yellow-600',
      'قيد التنفيذ': 'bg-purple-500',
      'منفذ': 'bg-gray-700',
      'في المونتاج': 'bg-purple-300',
      'تم المونتاج': 'bg-green-500',
      'معاد مونتاجه': 'bg-teal-500',
      'وصل للمتبرع': 'bg-green-700',
      'منتهي': 'bg-gray-600',
      'ملغى': 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const formatCurrency = (amount) => {
    // التأكد من أن القيمة رقم صحيح
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(0);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(numericAmount);
  };

  const getTeamName = () => {
    return (
      project?.assigned_to_team?.team_name ||
      project?.assigned_team?.team_name ||
      project?.assignedTeam?.team_name ||
      project?.team?.team_name ||
      project?.team_name ||
      'لم يتم التوزيع بعد'
    );
  };

  const getPhotographerName = () => {
    return (
      project?.assigned_photographer?.name ||
      project?.photographer?.name ||
      project?.assignedPhotographer?.name ||
      project?.photographer_name ||
      'لم يتم التحديد بعد'
    );
  };

  // ✅ استخدام useMemo لحفظ النتيجة وتجنب إعادة الحساب في كل render
  const subcategoryName = useMemo(() => {
    // ✅ استخدام subcategoryData المحفوظة أولاً
    if (subcategoryData) {
      // ✅ التأكد من أن subcategoryData ليس object كامل
      if (typeof subcategoryData === 'object' && subcategoryData !== null) {
        const name = subcategoryData.name_ar || subcategoryData.name || subcategoryData.name_en;
        // ✅ التأكد من أن name هو string وليس object
        if (name && typeof name === 'string') {
          return name;
        }
      } else if (typeof subcategoryData === 'string') {
        // ✅ إذا كان string مباشرة
        return subcategoryData;
      }
    }

    // ✅ استخدام البيانات من project object
    if (project?.subcategory) {
      if (typeof project.subcategory === 'object' && project.subcategory !== null) {
        const name = project.subcategory.name_ar || project.subcategory.name || project.subcategory.name_en;
        // ✅ التأكد من أن name هو string وليس object
        if (name && typeof name === 'string') {
          return name;
        }
      } else if (typeof project.subcategory === 'string') {
        // ✅ إذا كان string مباشرة
        return project.subcategory;
      }
    }

    // ✅ استخدام subcategory_name إذا كان موجوداً
    if (project?.subcategory_name) {
      // ✅ التأكد من أن subcategory_name هو string
      if (typeof project.subcategory_name === 'string') {
        return project.subcategory_name;
      }
    }

    // ✅ إذا كان هناك subcategory_id فقط، نعرض رسالة مؤقتة
    if (project?.subcategory_id) {
      return 'جاري التحميل...';
    }

    return 'لم يتم التحديد بعد';
  }, [subcategoryData, project?.subcategory, project?.subcategory_name, project?.subcategory_id]);

  // ✅ دالة للحصول على اسم التفريعة (للتوافق مع الكود القديم)
  const getSubcategoryName = () => subcategoryName;

  const getMediaStatus = () => {
    return (
      project?.media_status ||
      project?.mediaStatus ||
      project?.media?.status ||
      project?.media_state ||
      'غير محدد'
    );
  };

  const getMediaNotes = () => {
    return (
      project?.media_notes ||
      project?.mediaNotes ||
      project?.media?.notes ||
      project?.media_comment ||
      ''
    );
  };

  // ✅ الحصول على سبب التأجيل
  const getPostponementReason = () => {
    return (
      project?.postponement_reason ||
      project?.postponementReason ||
      project?.postponed_reason ||
      project?.reason_for_postponement ||
      ''
    );
  };

  const getDiscountPercentage = () => {
    return (
      project?.admin_discount_percentage ??
      project?.discount_percentage ??
      project?.discountPercent ??
      0
    );
  };

  const getCategoryLabel = () => {
    // ✅ محاولة الحصول على التصنيف من عدة مصادر
    const category = project?.category || project?.project_category || project?.campaign_name || project?.donation_category || project?.project_type;

    // ✅ إذا كان object، نستخرج name
    if (category && typeof category === 'object' && category !== null) {
      return category.name_ar || category.name || category.name_en || 'غير مصنف';
    }

    // ✅ إذا كان string، نستخدمه مباشرة
    if (typeof category === 'string') {
      return category;
    }

    return 'غير مصنف';
  };

  const getNetAmount = () => {
    // محاولة الحصول على المبلغ الصافي من عدة مصادر محتملة
    const netAmount =
      project?.net_amount_usd ||
      project?.net_amount ||
      project?.netAmount ||
      project?.netAmountUsd ||
      project?.final_amount ||
      project?.final_amount_usd ||
      0;

    // التأكد من أن القيمة رقم صحيح
    const numericValue = parseFloat(netAmount);
    return isNaN(numericValue) || numericValue < 0 ? 0 : numericValue;
  };

  const getNetAmountShekel = () => {
    return project?.net_amount_shekel || project?.netAmountShekel || 0;
  };

  const getShekelExchangeRate = () => {
    return project?.shekel_exchange_rate || project?.shekelExchangeRate || null;
  };

  const hasShekelConversion = () => {
    return !!getShekelExchangeRate();
  };

  const formatShekel = (amount) => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return '0.00';
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  };

  const handleConvertToShekel = async () => {
    if (!exchangeRate || parseFloat(exchangeRate) <= 0) {
      toast.error('يرجى إدخال سعر صرف صحيح');
      return;
    }

    try {
      setIsConverting(true);
      const response = await apiClient.post(`/project-proposals/${id}/convert-to-shekel`, {
        shekel_exchange_rate: parseFloat(exchangeRate),
      });

      if (response.data.success) {
        toast.success('تم تحويل المبلغ للشيكل بنجاح');
        invalidateProjectsCache(); // ✅ إبطال كاش المشاريع
        setShowConvertToShekelModal(false);
        setExchangeRate('');
        fetchProjectDetails(true); // ✅ تحديث البيانات فوراً (force refresh)
      } else {
        toast.error(response.data.message || 'فشل تحويل المبلغ');
      }
    } catch (error) {
      console.error('Error converting to shekel:', error);
      toast.error(error.response?.data?.message || error.userMessage || 'حدث خطأ أثناء التحويل');
    } finally {
      setIsConverting(false);
    }
  };

  const canConvertToShekel = () => {
    const status = project?.status;
    return status === 'جديد' || status === 'قيد التوريد';
  };

  const getExchangeRate = () => {
    // محاولة الحصول على سعر الصرف من عدة مصادر محتملة
    const exchangeRate =
      project?.exchange_rate_snapshot ||
      project?.exchange_rate ||
      project?.exchangeRate ||
      project?.currency?.exchange_rate_to_usd ||
      project?.currency?.exchange_rate ||
      0;

    // التأكد من أن القيمة رقم صحيح
    const numericValue = parseFloat(exchangeRate);
    return isNaN(numericValue) || numericValue < 0 ? 0 : numericValue;
  };

  const formatExchangeRate = (rate) => {
    // تنسيق سعر الصرف بشكل مناسب
    const numericRate = parseFloat(rate);
    if (isNaN(numericRate) || numericRate <= 0) {
      return 'غير محدد';
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    }).format(numericRate);
  };

  const formatDate = (date) => {
    if (!date) return 'غير محدد';
    const dateObj = new Date(date);
    // ✅ استخدام locale إنجليزي لضمان عرض التاريخ الميلادي
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  };

  // if (loading) {
  //   return (
  //     <div className="flex justify-center items-center min-h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
  //     </div>
  //   );
  // }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">لا يوجد مشروع</p>
        <Link
          to="/project-management/projects"
          className="text-sky-600 hover:text-sky-700 mt-4 inline-block"
        >
          العودة إلى القائمة
        </Link>
      </div>
    );
  }

  const hasAssignedTeam =
    Boolean(
      project?.assigned_to_team_id ||
      project?.assigned_team_id ||
      project?.assigned_team ||
      project?.assigned_to_team ||
      project?.team_name ||
      project?.assignedTeam
    );

  const canDeleteProject = user?.role === 'admin' && !hasAssignedTeam;

  // ✅ التحقق من دور منسق الأيتام
  const userRole = user?.role?.toLowerCase?.() ||
    user?.userRole?.toLowerCase?.() ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role || '';
  const isOrphanSponsorCoordinator = userRole === 'orphan_sponsor_coordinator' || userRole === 'منسق مشاريع كفالة الأيتام';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-sky-50 p-4 md:p-6 lg:p-8 relative">
      <PageLoader isLoading={ loading } />
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */ }
        <div className="bg-white/90 backdrop-blur rounded-3xl shadow-md p-4 md:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border border-gray-100">
          <div>
            <button
              onClick={ () => navigate(location.pathname.startsWith('/media-management') ? '/media-management/projects' : '/project-management/projects') }
              className="flex items-center text-sky-600 hover:text-sky-700 font-medium mb-3"
            >
              <ArrowRight className="w-5 h-5 ml-2" />
              العودة إلى القائمة
            </button>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">تفاصيل المشروع</h1>
            <p className="text-gray-500 text-sm">
              كود المشروع: { getProjectCode() }
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* زر نقل للتنفيذ - للـ Coordinator */ }
            { (user?.role === 'executed_projects_coordinator' || user?.role === 'admin') &&
              (project?.status === 'جاهز للتنفيذ' || project?.status === 'تم اختيار المخيم') &&
              project?.shelter_id && (
                <button
                  onClick={ handleTransferToExecution }
                  disabled={ loading }
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-medium flex items-center transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4 ml-2" />
                  نقل للتنفيذ
                </button>
              ) }

            {/* زر تأجيل المشروع - لمدير المشاريع فقط */ }
            { user?.role === 'project_manager' && canPostponeProject() && (
              <button
                onClick={ () => setShowPostponeModal(true) }
                disabled={ loading || isPostponing }
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-medium flex items-center transition-colors disabled:opacity-50"
              >
                <Pause className="w-4 h-4 ml-2" />
                تأجيل المشروع
              </button>
            ) }

            {/* زر استئناف المشروع - لمدير المشاريع فقط */ }
            { user?.role === 'project_manager' && canResumeProject() && (
              <button
                onClick={ handleResumeProject }
                disabled={ loading || isResuming }
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-medium flex items-center transition-colors disabled:opacity-50"
              >
                <PlayCircle className="w-4 h-4 ml-2" />
                { isResuming ? 'جاري الاستئناف...' : 'استئناف المشروع' }
              </button>
            ) }

            {/* ✅ زر التوريد - متاح في أي مرحلة */ }
            { (user?.role === 'project_manager' || user?.role === 'admin') && (
              <Link
                to={ `/project-management/projects/${id}/supply` }
                onClick={ async (e) => {
                  // ✅ إذا كان المشروع في حالة "جديد"، نحاول نقله للتوريد أولاً
                  if (project.status === 'جديد') {
                    e.preventDefault();
                    await handleMoveToSupply();
                  }
                  // ✅ في الحالات الأخرى، نذهب مباشرة لصفحة التوريد
                } }
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium flex items-center transition-colors"
              >
                <ShoppingCart className="w-4 h-4 ml-2" />
                { project?.status === 'جديد' ? 'نقل للتوريد' : 'عرض سلة التوريد' }
              </Link>
            ) }

            {/* ✅ زر إضافة الأيتام - لمشاريع الكفالة (منسق الأيتام) */ }
            { isOrphanSponsorshipProject(project) &&
              (project?.status === 'تم التوريد' || project?.status === 'مسند لباحث') &&
              isOrphanSponsorCoordinator && (
                <button
                  onClick={ () => setAddOrphansModalOpen(true) }
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl font-medium flex items-center transition-colors"
                >
                  <Users className="w-4 h-4 ml-2" />
                  إضافة/إدارة الأيتام
                </button>
              ) }

            {/* أزرار Admin */ }
            { user?.role === 'admin' && (
              <>
                <Link
                  to={ `/project-management/projects/${id}/edit` }
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-medium flex items-center transition-colors"
                >
                  <Edit className="w-4 h-4 ml-2" />
                  تعديل
                </Link>
                { canDeleteProject && (
                  <button
                    onClick={ () => setShowDeleteConfirm(true) }
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-medium flex items-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4 ml-2" />
                    حذف
                  </button>
                ) }
              </>
            ) }
          </div>
        </div>

        {/* Status Badge */ }
        <div className="flex flex-wrap items-center gap-3">
          { project.is_urgent && (
            <div className="inline-flex items-center gap-2 px-4 py-3 bg-amber-100 border-2 border-amber-400 text-amber-800 rounded-2xl font-bold shadow-sm">
              <AlertCircle className="w-5 h-5" />
              <span>مشروع عاجل</span>
            </div>
          ) }
          <span
            onClick={ handleStatusClick }
            className={ `inline-block px-6 py-3 rounded-2xl text-white text-base font-bold shadow ${getStatusColor(
              project.status
            )} ${project.status === 'وصل للمتبرع' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}` }
            title={ project.status === 'وصل للمتبرع' ? 'انقر للموافقة/الرفض' : '' }
          >
            { project.status }
          </span>
          <span className="inline-block px-4 py-2 bg-sky-100 text-sky-700 rounded-2xl font-medium shadow-sm">
            { getPostponementReason() }
          </span>
          <span className="inline-block px-4 py-2 bg-purple-50 text-purple-700 rounded-2xl font-medium shadow-sm">
            { getCategoryLabel() }
          </span>
        </div>

        {/* Summary Snapshot */ }
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SummaryCard title="كود المشروع" value={ getProjectCode() } />
          <SummaryCard title="اسم المشروع / الجهة" value={ project.project_name || project.donor_name || '---' } />
          <SummaryCard title="تفصيل التبرع" value={ project.project_description || project.description || '---' } multiline />
          <SummaryCard
            title="المبلغ الصافي بعد الخصم"
            value={ formatCurrency(getNetAmount()) }
            subtitle={ hasShekelConversion() ? `المبلغ بالشيكل: ₪${formatShekel(getNetAmountShekel())}` : null }
            highlight
          />
          <SummaryCard
            title="نسبة الخصم الإداري"
            value={ `${getDiscountPercentage()}%` }
          />
          <SummaryCard title="الفريق المكلف" value={ getTeamName() } />
          <SummaryCard title="التفريعة" value={ subcategoryName } />
          <SummaryCard title="حالة المشروع" value={ project.status } />
          <SummaryCard
            title="حالة الإعلام / المونتاج"
            value={ getMediaStatus() }
            subtitle={ getMediaNotes() || null }
          />
        </div>

        {/* Content Grid */ }
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Info */ }
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */ }
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <FileText className="w-5 h-5 ml-2 text-sky-600" />
                المعلومات الأساسية
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow
                  icon={ <Tag className="w-4 h-4 text-sky-600" /> }
                  label="كود المشروع"
                  value={ getProjectCodeHelper(project) }
                />
                <InfoRow
                  icon={ <Tag className="w-4 h-4 text-blue-600" /> }
                  label="كود المتبرع"
                  value={ project.donor_code || '---' }
                />
                <InfoRow
                  icon={ <User className="w-4 h-4 text-indigo-600" /> }
                  label="اسم الجهة المتبرعة"
                  value={ project.donor_name || '---' }
                />
                <InfoRow
                  icon={ <Package className="w-4 h-4 text-purple-600" /> }
                  label="اسم المشروع"
                  value={ project.project_name || project.donor_name || '---' }
                />
                <InfoRow
                  icon={ <Tag className="w-4 h-4 text-green-600" /> }
                  label="نوع المشروع"
                  value={ (() => {
                    if (!project.project_type) return '---';
                    if (typeof project.project_type === 'object' && project.project_type !== null) {
                      return project.project_type.name_ar || project.project_type.name || project.project_type.name_en || '---';
                    }
                    return project.project_type;
                  })() }
                />
                { (project?.subcategory_id || project?.subcategory || subcategoryData) && (
                  <InfoRow
                    icon={ <Tag className="w-4 h-4 text-blue-600" /> }
                    label="التفرعية"
                    value={ subcategoryName }
                  />
                ) }
                <InfoRow
                  icon={ <Clock className="w-4 h-4 text-amber-600" /> }
                  label="المدة التقديرية"
                  value={ `${project.estimated_duration_days || project.estimated_duration || 15} يوم` }
                />
                { (() => {
                  // ✅ منطق موحد مع Backend: العداد يتوقف عند "وصل للمتبرع" أو "منتهي"
                  const getRemainingDaysDisplay = () => {
                    const status = (project?.status || '').trim();

                    if (status === 'منتهي') {
                      return { label: '✓ منتهي', isOverdue: false, isFinished: true };
                    }
                    if (status === 'وصل للمتبرع') {
                      return { label: '✓ وصل للمتبرع', isOverdue: false, isFinished: true };
                    }
                    if (project.remaining_days === null || project.remaining_days === undefined) {
                      if (status === 'ملغى') return { label: 'ملغى', isOverdue: false, isFinished: true };
                      return { label: 'مكتمل', isOverdue: false, isFinished: true };
                    }
                    const remaining = Number(project.remaining_days);
                    if (!Number.isNaN(remaining) && remaining < 2) {
                      const fromApi = project.delayed_days ?? project.delayedDays;
                      const computed = Math.max(0, 2 - remaining);
                      const raw = (fromApi != null && fromApi > 0) ? fromApi : computed;
                      const d = Math.max(1, raw);
                      return { label: `⚠️ متأخر بـ ${d} يوم`, isOverdue: true, isFinished: false };
                    }
                    return { label: `${project.remaining_days} يوم متبقي`, isOverdue: false, isFinished: false };
                  };

                  const remainingInfo = getRemainingDaysDisplay();
                  return (
                    <InfoRow
                      icon={ <Clock className={ `w-4 h-4 ${remainingInfo.isFinished ? 'text-blue-600' : remainingInfo.isOverdue ? 'text-red-600' : 'text-green-600'}` } /> }
                      label="الأيام المتبقية للتنفيذ"
                      value={
                        <span className={ remainingInfo.isFinished ? 'text-blue-600 font-semibold' : remainingInfo.isOverdue ? 'text-red-600 font-semibold' : 'text-green-600' }>
                          { remainingInfo.label }
                        </span>
                      }
                    />
                  );
                })() }
                { project.created_at && (
                  <InfoRow
                    icon={ <Calendar className="w-4 h-4 text-gray-600" /> }
                    label="تاريخ الإنشاء"
                    value={ formatDate(project.created_at) }
                  />
                ) }
                { project.updated_at && (
                  <InfoRow
                    icon={ <Clock className="w-4 h-4 text-gray-600" /> }
                    label="آخر تحديث"
                    value={ formatDate(project.updated_at) }
                  />
                ) }
              </div>
              { (project.project_description || project.description) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <InfoRow
                    icon={ <FileText className="w-4 h-4 text-orange-600" /> }
                    label="وصف المشروع"
                    value={ project.project_description || project.description || '---' }
                    fullWidth
                  />
                </div>
              ) }
              { project.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <InfoRow
                    icon={ <FileText className="w-4 h-4 text-gray-600" /> }
                    label="ملاحظات"
                    value={ project.notes }
                    fullWidth
                    preserveWhitespace
                  />
                </div>
              ) }
            </div>

            {/* Supply Details Card */ }
            { (supplyData || project.quantity !== undefined && project.quantity !== null) && (
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <ShoppingCart className="w-5 h-5 ml-2 text-indigo-600" />
                    تفاصيل التوريد
                  </h2>
                  <Link
                    to={ `/project-management/projects/${project.id}/supply` }
                    className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    عرض تفاصيل التوريد
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                { supplyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : supplyData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoRow
                      icon={ <Package className="w-4 h-4 text-indigo-600" /> }
                      label="العدد"
                      value={ supplyData.quantity || 0 }
                    />
                    <InfoRow
                      icon={ <Package className="w-4 h-4 text-purple-600" /> }
                      label="عدد الأصناف في السلة"
                      value={ supplyData.items_count || 0 }
                    />
                    <InfoRow
                      icon={ <DollarSign className="w-4 h-4 text-green-600" /> }
                      label="تكلفة الطرد الواحد"
                      value={
                        supplyData.currency === 'ILS' || hasShekelConversion()
                          ? `₪${formatShekel(supplyData.unit_cost || 0)}`
                          : formatCurrency(supplyData.unit_cost || 0)
                      }
                    />
                    <InfoRow
                      icon={ <DollarSign className="w-4 h-4 text-blue-600" /> }
                      label="التكلفة الإجمالية"
                      value={
                        supplyData.currency === 'ILS' || hasShekelConversion()
                          ? `₪${formatShekel(supplyData.total_supply_cost || 0)}`
                          : formatCurrency(supplyData.total_supply_cost || 0)
                      }
                    />
                    <InfoRow
                      icon={ supplyData.has_deficit ? (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) }
                      label="الفائض/العجز"
                      value={
                        supplyData.surplus_amount !== undefined && supplyData.surplus_amount !== null ? (
                          <span className={ supplyData.has_deficit ? 'text-red-600 font-bold' : 'text-green-600 font-bold' }>
                            { supplyData.has_deficit ? 'عجز: ' : 'فائض: ' }
                            { supplyData.currency === 'ILS' || hasShekelConversion()
                              ? `₪${formatShekel(Math.abs(supplyData.surplus_amount || 0))}`
                              : formatCurrency(Math.abs(supplyData.surplus_amount || 0))
                            }
                          </span>
                        ) : (
                          '-'
                        )
                      }
                    />
                    { supplyData.currency && (
                      <InfoRow
                        icon={ <DollarSign className="w-4 h-4 text-gray-600" /> }
                        label="العملة"
                        value={ supplyData.currency === 'ILS' ? 'شيكل (₪)' : 'دولار ($)' }
                      />
                    ) }
                    { project.surplus_notes && (
                      <InfoRow
                        icon={ <FileText className="w-4 h-4 text-gray-600" /> }
                        label="ملاحظات الفائض"
                        value={ project.surplus_notes }
                        fullWidth
                        preserveWhitespace
                      />
                    ) }
                    { project.surplus_recorded_at && (
                      <InfoRow
                        icon={ <Calendar className="w-4 h-4 text-gray-600" /> }
                        label="تاريخ تسجيل الفائض"
                        value={ formatDate(project.surplus_recorded_at) }
                      />
                    ) }
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">لم يتم إدخال بيانات التوريد بعد</p>
                    <Link
                      to={ `/project-management/projects/${project.id}/supply` }
                      className="inline-flex items-center gap-2 mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      إضافة أصناف للتوريد
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) }
              </div>
            ) }


            {/* Notes Images Card (Gallery + reorder) */ }
            <NotesImagesSection project={ project } user={ user } />

            {/* Donor Information Card */ }
            { (project.donor_name || project.donor_code) && (
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <User className="w-5 h-5 ml-2 text-indigo-600" />
                  معلومات المتبرع
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  { project.donor_name && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border-2 border-indigo-200">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-indigo-600" />
                        <p className="text-sm font-semibold text-gray-600">اسم المتبرع</p>
                      </div>
                      <p className="text-lg font-bold text-gray-800">{ project.donor_name }</p>
                    </div>
                  ) }
                  { project.donor_code && (
                    <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-4 border-2 border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="w-4 h-4 text-blue-600" />
                        <p className="text-sm font-semibold text-gray-600">كود المتبرع</p>
                      </div>
                      <p className="text-lg font-bold text-gray-800">{ project.donor_code }</p>
                    </div>
                  ) }
                </div>
              </div>
            ) }

            {/* Convert to Shekel Card */ }
            { user?.role === 'project_manager' && canConvertToShekel() && (
              <ConvertToShekelCard
                project={ project }
                hasConversion={ hasShekelConversion() }
                netAmountUSD={ getNetAmount() }
                netAmountShekel={ getNetAmountShekel() }
                exchangeRate={ getShekelExchangeRate() }
                onConvert={ () => setShowConvertToShekelModal(true) }
                onUpdate={ () => setShowConvertToShekelModal(true) }
              />
            ) }

            {/* Financial Info Card */ }
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 ml-2 text-green-600" />
                المعلومات المالية
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-gray-600" />
                    <p className="text-sm font-semibold text-gray-600">المبلغ الأصلي</p>
                  </div>
                  <p className="text-xl font-bold text-gray-800">
                    { (() => {
                      // ✅ محاولة الحصول على المبلغ من عدة مصادر
                      const amount =
                        project?.donation_amount ||
                        project?.amount ||
                        project?.original_amount ||
                        project?.total_amount ||
                        null;

                      if (!amount || Number(amount) === 0) {
                        return '---';
                      }

                      const formatted = parseFloat(amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });

                      const currencySymbol =
                        project?.currency?.currency_symbol ||
                        project?.currency?.currency_code ||
                        project?.currency_code ||
                        '';

                      return `${formatted} ${currencySymbol}`.trim();
                    })() }
                  </p>
                  { project.currency && (
                    <p className="text-xs text-gray-500 mt-1">
                      { project.currency.currency_name_ar || project.currency.currency_name_en || project.currency.currency_code || '' }
                    </p>
                  ) }
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-semibold text-gray-600">سعر الصرف</p>
                  </div>
                  <p className="text-xl font-bold text-blue-700">
                    { formatExchangeRate(getExchangeRate()) }
                  </p>
                  { getExchangeRate() > 0 && project.currency && (
                    <p className="text-xs text-gray-500 mt-1">1 { project.currency.currency_code || '' } = { formatExchangeRate(getExchangeRate()) } USD</p>
                  ) }
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-semibold text-green-700">المبلغ بالدولار</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    { formatCurrency(project.amount_in_usd || 0) }
                  </p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border-2 border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-orange-600" />
                    <p className="text-sm font-semibold text-orange-700">
                      الخصم ({ getDiscountPercentage() }%)
                    </p>
                  </div>
                  <p className="text-xl font-bold text-orange-600">
                    { formatCurrency(((project.amount_in_usd || 0) * getDiscountPercentage()) / 100) }
                  </p>
                  { project.amount_in_usd && getDiscountPercentage() > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      { formatCurrency(project.amount_in_usd) } × { getDiscountPercentage() }%
                    </p>
                  ) }
                </div>
              </div>
              <div className="mt-4 bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-6 border-2 border-sky-300">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-sky-600" />
                  <p className="text-sm font-semibold text-sky-700">المبلغ الصافي بعد الخصم</p>
                </div>
                <p className="text-3xl font-bold text-sky-600">
                  { formatCurrency(getNetAmount()) }
                </p>
                { project.amount_in_usd && getDiscountPercentage() > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    { formatCurrency(project.amount_in_usd) } - { formatCurrency(((project.amount_in_usd || 0) * getDiscountPercentage()) / 100) } = { formatCurrency(getNetAmount()) }
                  </p>
                ) }
                { hasShekelConversion() && (
                  <p className="text-sm text-gray-600 mt-2">
                    المبلغ بالشيكل: ₪{ formatShekel(getNetAmountShekel()) }
                    { getShekelExchangeRate() && (
                      <span className="text-xs text-gray-500 block mt-1">
                        سعر الصرف: { getShekelExchangeRate() }
                      </span>
                    ) }
                  </p>
                ) }
              </div>
            </div>

            {/* Beneficiaries Section */ }
            { (['تم التنفيذ', 'منفذ', 'في المونتاج', 'تم المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'].includes(project?.status)) && (
              <BeneficiariesSection
                projectId={ project?.id }
                projectStatus={ project?.status }
                subcategory={ project?.subcategory?.name_ar || project?.subcategory_name_ar }
              />
            ) }

            {/* Phase Division Info Card - موحد للمشاريع المقسمة واليومية والشهرية */ }
            { isDividedOrDailyProject && (
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                {/* ✅ تحذير في وضع التطوير إذا كانت البيانات مفقودة (فقط إذا لم تكن هناك daily phases) */ }
                { import.meta.env.DEV && !isMonthlyPhaseProject && !isDailyPhaseProject && !project?.phase_type && !project?.total_months && !project?.phase_duration_days && normalizedDailyPhases.length === 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠️ تحذير: المشروع يبدو مقسم لكن البيانات مفقودة. تحقق من:
                    </p>
                    <ul className="text-xs text-yellow-700 mt-2 list-disc list-inside">
                      <li>is_divided_into_phases: { String(project?.is_divided_into_phases) }</li>
                      <li>phase_type: { project?.phase_type || 'null' }</li>
                      <li>total_months: { project?.total_months || 'null' }</li>
                      <li>phase_duration_days: { project?.phase_duration_days || 'null' }</li>
                      <li>is_monthly_phase: { String(project?.is_monthly_phase) }</li>
                      <li>is_daily_phase: { String(project?.is_daily_phase) }</li>
                      <li>daily_phases count: { normalizedDailyPhases.length }</li>
                    </ul>
                  </div>
                ) }
                {/* معلومات المشروع الأصلي - يظهر فقط إذا كان المشروع الحالي يومي أو شهري */ }
                { (isDailyPhaseProject || isMonthlyPhaseProject) && parentProjectId && (
                  <div className={ `bg-gradient-to-br ${isMonthlyPhaseProject ? 'from-purple-50 to-purple-100 border-purple-200' : 'from-blue-50 to-blue-100 border-blue-200'} rounded-xl p-4 mb-6 border` }>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          { isMonthlyPhaseProject ? (
                            <>
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-600 text-white">
                                مشروع شهري
                              </span>
                              { monthNumber && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                                  الشهر { monthNumber }
                                </span>
                              ) }
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white">
                                مشروع يومي
                              </span>
                              { phaseDay && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                                  اليوم { phaseDay }
                                </span>
                              ) }
                            </>
                          ) }
                        </div>
                        <p className="text-gray-700">
                          هذا المشروع هو { isMonthlyPhaseProject ? 'إحدى الشهور التابعة' : 'إحدى الأيام التابعة' } للمشروع الأصلي { parentProjectName || (parentProjectId ? `#${parentProjectId}` : '') }.
                        </p>
                        { isMonthlyPhaseProject && project?.parent_project?.total_months && (
                          <p className="text-sm text-gray-500 mt-1">
                            إجمالي الشهور: { project.parent_project.total_months } شهر
                          </p>
                        ) }
                        { isDailyPhaseProject && project.phase_duration_days && parentProjectName && (
                          <p className="text-sm text-gray-500 mt-1">
                            إجمالي الأيام: { project.phase_duration_days } يوم
                          </p>
                        ) }
                      </div>
                      { parentProjectId && (
                        <Link
                          to={ `/project-management/projects/${parentProjectId}` }
                          className="inline-flex items-center justify-center px-5 py-2 rounded-xl text-sm font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 transition-colors"
                        >
                          <ArrowRight className="w-4 h-4 ml-2 rotate-180" />
                          عرض المشروع الأصلي
                        </Link>
                      ) }
                    </div>
                  </div>
                ) }

                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <CalendarIcon className="w-5 h-5 ml-2 text-purple-600" />
                  معلومات التقسيم على مراحل
                </h2>

                {/* ✅ رسالة إذا كانت البيانات مفقودة */ }
                { !isMonthlyPhaseProject && !isDailyPhaseProject && !project?.phase_type && !project?.total_months && !project?.phase_duration_days && normalizedDailyPhases.length === 0 && (
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-semibold mb-2">
                      ⚠️ البيانات غير متوفرة
                    </p>
                    <p className="text-xs text-yellow-700">
                      يبدو أن المشروع مقسم لكن بيانات التقسيم غير متوفرة في الاستجابة من الخادم.
                      { import.meta.env.DEV && (
                        <span className="block mt-2">
                          تحقق من Console لرؤية البيانات المستلمة من الـ Backend.
                        </span>
                      ) }
                    </p>
                  </div>
                ) }

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* ✅ التقسيم: شهري أو يومي */ }
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <p className="text-sm text-gray-600 mb-1">التقسيم</p>
                      <p className="text-xl font-bold text-purple-600">
                        { (() => {
                          // ✅ للمشاريع الشهرية (parent أو child)
                          if (isMonthlyPhaseProject || divisionType === 'monthly') {
                            // ✅ محاولة الحصول على total_months من عدة مصادر
                            const totalMonths = project?.total_months ||
                              project?.parent_project?.total_months ||
                              (project?.monthly_phases?.length) ||
                              (project?.monthlyPhases?.length) ||
                              '---';
                            return totalMonths !== '---' ? `${totalMonths} شهر` : 'شهري';
                          }
                          // ✅ للمشاريع اليومية
                          if (divisionType === 'daily' || isDailyPhaseProject) {
                            const totalDays = project.phase_duration_days || normalizedDailyPhases.length || '---';
                            return totalDays !== '---' ? `${totalDays} يوم` : 'يومي';
                          }
                          // ✅ Fallback: محاولة تحديد من البيانات المتوفرة
                          // ✅ التحقق من monthly_phases أولاً
                          if (project?.monthly_phases?.length || project?.monthlyPhases?.length) {
                            const monthsCount = project?.monthly_phases?.length || project?.monthlyPhases?.length;
                            return `${monthsCount} شهر`;
                          }
                          if (normalizedDailyPhases.length > 0) {
                            return `${normalizedDailyPhases.length} يوم`;
                          }
                          if (project?.phase_duration_days) {
                            return `${project.phase_duration_days} يوم`;
                          }
                          if (project?.total_months) {
                            return `${project.total_months} شهر`;
                          }
                          return '---';
                        })() }
                      </p>
                    </div>
                    {/* ✅ تاريخ البدء */ }
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <p className="text-sm text-gray-600 mb-1">تاريخ البدء</p>
                      <p className="text-xl font-bold text-purple-600">
                        { (() => {
                          // ✅ للمشاريع الشهرية (child): استخدام month_start_date
                          if (isMonthlyPhaseProject && project.month_start_date) {
                            return new Date(project.month_start_date).toLocaleDateString('en-GB', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            });
                          }

                          // ✅ للمشاريع الأصلية الشهرية: استخدام phase_start_date
                          if ((isMonthlyPhaseProject || divisionType === 'monthly') && !project.parent_project_id && project.phase_start_date) {
                            return new Date(project.phase_start_date).toLocaleDateString('en-GB', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            });
                          }

                          // البحث عن تاريخ البدء من عدة مصادر
                          let startDate = project.phase_start_date || project.execution_started_at || project.start_date || project.project_start_date;

                          // إذا لم يوجد، جرب الحصول من أول يوم مقسم
                          if (!startDate && normalizedDailyPhases.length > 0) {
                            // البحث عن أول يوم (phase_day = 1) أو أصغر يوم
                            const sortedPhases = [...normalizedDailyPhases].sort((a, b) => {
                              const dayA = parseInt(a.phase_day) || 999;
                              const dayB = parseInt(b.phase_day) || 999;
                              return dayA - dayB;
                            });

                            const firstPhase = sortedPhases[0];

                            if (firstPhase) {
                              // إذا كان phase_start_date موجوداً، احسب التاريخ من phase_day = 1
                              if (project.phase_start_date && firstPhase.phase_day) {
                                const calculatedDate = new Date(project.phase_start_date);
                                calculatedDate.setDate(calculatedDate.getDate() + (parseInt(firstPhase.phase_day) - 1));
                                startDate = calculatedDate;
                              } else {
                                // استخدم execution_date من أول يوم
                                startDate = firstPhase.execution_date || firstPhase.phase_date || firstPhase.date;
                              }
                            }

                            // إذا لم يوجد، استخدم أصغر تاريخ من الأيام المقسمة
                            if (!startDate) {
                              const dates = normalizedDailyPhases
                                .map(p => p.execution_date || p.phase_date || p.date)
                                .filter(d => d)
                                .map(d => new Date(d))
                                .sort((a, b) => a - b);

                              if (dates.length > 0) {
                                startDate = dates[0];
                              }
                            }
                          }

                          return startDate ? new Date(startDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '---';
                        })() }
                      </p>
                    </div>
                  </div>

                  {/* ✅ بالأيام - للمشاريع الشهرية */ }
                  { (isMonthlyPhaseProject || divisionType === 'monthly') && (
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <p className="text-sm text-gray-600 mb-1">بالأيام</p>
                      <p className="text-xl font-bold text-purple-600">
                        { project.estimated_duration_days || project.parent_project?.estimated_duration_days || '---' } { (project.estimated_duration_days || project.parent_project?.estimated_duration_days) ? 'يوم' : '' }
                      </p>
                    </div>
                  ) }

                  {/* ✅ رقم الشهر - للمشاريع الشهرية (child فقط) */ }
                  { (isMonthlyPhaseProject || divisionType === 'monthly') && monthNumber && (
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <p className="text-sm text-gray-600 mb-1">رقم الشهر</p>
                      <p className="text-xl font-bold text-purple-600">
                        { monthNumber } من { project?.parent_project?.total_months ||
                          (project?.parent_project?.monthly_phases?.length) ||
                          (project?.parent_project?.monthlyPhases?.length) ||
                          '---' }
                      </p>
                    </div>
                  ) }

                  {/* ✅ عدد الشهور - للمشاريع الأصلية الشهرية */ }
                  { (isMonthlyPhaseProject || divisionType === 'monthly') && !monthNumber && !project?.parent_project_id && (
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <p className="text-sm text-gray-600 mb-1">عدد الشهور</p>
                      <p className="text-xl font-bold text-purple-600">
                        { project?.total_months ||
                          (project?.monthly_phases?.length) ||
                          (project?.monthlyPhases?.length) ||
                          '---' } { (project?.total_months || project?.monthly_phases?.length || project?.monthlyPhases?.length) ? 'شهر' : '' }
                      </p>
                    </div>
                  ) }

                  {/* ✅ المشروع الأصلي - للمشاريع الشهرية (child فقط) */ }
                  { (isMonthlyPhaseProject || divisionType === 'monthly') && parentProjectName && (
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <p className="text-sm text-gray-600 mb-1">المشروع الأصلي</p>
                      <p className="text-xl font-bold text-purple-600">
                        { parentProjectName }
                      </p>
                    </div>
                  ) }

                  {/* ✅ المبلغ الشهري - للمشاريع الشهرية */ }
                  { (isMonthlyPhaseProject || divisionType === 'monthly') && (() => {
                    // ✅ حساب المبلغ الشهري
                    let monthlyAmount = 0;
                    let totalAmount = 0;
                    let totalMonths = 0;

                    // ✅ للمشاريع الشهرية (child): حساب من parent_project
                    if (project?.parent_project?.total_months) {
                      totalAmount = project.parent_project.net_amount ||
                        project.parent_project.net_amount_usd ||
                        getNetAmount();
                      totalMonths = project.parent_project.total_months;
                      monthlyAmount = totalAmount / totalMonths;
                    }
                    // ✅ للمشاريع الأصلية الشهرية: حساب من المشروع نفسه
                    else if (project?.total_months && !project?.parent_project_id) {
                      totalAmount = project.net_amount ||
                        project.net_amount_usd ||
                        project.donation_amount ||
                        getNetAmount();
                      totalMonths = project.total_months;
                      monthlyAmount = totalAmount / totalMonths;
                    }

                    // ✅ إذا كان المبلغ الشهري أكبر من 0، نعرضه
                    if (monthlyAmount > 0 && totalMonths > 0) {
                      return (
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border-2 border-purple-300">
                          <p className="text-sm text-gray-600 mb-1">المبلغ الشهري</p>
                          <p className="text-2xl font-bold text-purple-600">
                            { formatCurrency(monthlyAmount) }
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            المبلغ الصافي ({ formatCurrency(totalAmount) }) ÷ { totalMonths } شهر
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })() }

                  {/* ✅ Current Monthly Phase Status - فقط للمشاريع الشهرية */ }
                  { (isMonthlyPhaseProject || divisionType === 'monthly') && project?.total_months && (() => {
                    // ✅ التحقق من حالة المشاريع الفرعية الشهرية الفعلية
                    const completedStatuses = ['تم التنفيذ', 'وصل للمتبرع', 'تم المونتاج'];
                    const allPhasesCompleted = normalizedMonthlyPhases.length > 0 &&
                      normalizedMonthlyPhases.every(phase =>
                        completedStatuses.includes(phase.status)
                      );

                    const completedCount = normalizedMonthlyPhases.filter(phase =>
                      completedStatuses.includes(phase.status)
                    ).length;

                    const totalPhases = normalizedMonthlyPhases.length || project.total_months || 0;

                    // ✅ إذا كانت جميع المشاريع الفرعية مكتملة
                    if (allPhasesCompleted && normalizedMonthlyPhases.length > 0) {
                      return (
                        <div className="bg-green-50 rounded-xl p-4 border-2 border-green-300">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <p className="font-semibold text-green-800">المرحلة اكتملت</p>
                          </div>
                          <p className="text-sm text-gray-600">
                            تم إكمال جميع الشهور ({ totalPhases } شهر)
                          </p>
                        </div>
                      );
                    }

                    // ✅ إذا لم تكتمل جميع المشاريع الفرعية
                    if (normalizedMonthlyPhases.length > 0 && !allPhasesCompleted) {
                      return (
                        <div className="bg-yellow-50 rounded-xl p-4 border-2 border-yellow-300">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-yellow-600" />
                            <p className="font-semibold text-yellow-800">في انتظار إكمال المشاريع الفرعية</p>
                          </div>
                          <p className="text-sm text-gray-600">
                            تم إكمال { completedCount } من { totalPhases } شهر
                          </p>
                          <p className="text-xs text-yellow-700 mt-1">
                            بعض المشاريع الفرعية لا تزال في حالة "{ normalizedMonthlyPhases.find(p => !completedStatuses.includes(p.status))?.status || 'جديد' }"
                          </p>
                        </div>
                      );
                    }

                    // ✅ إذا لم تكن هناك مشاريع فرعية محملة، لا نعرض شيء (نعتمد على البيانات الأخرى)
                    return null;
                  })() }

                  {/* Daily Amount - فقط للمشاريع اليومية */ }
                  { !isMonthlyPhaseProject && divisionType !== 'monthly' && project.phase_duration_days && getNetAmount() > 0 && (
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border-2 border-purple-300">
                      <p className="text-sm text-gray-600 mb-1">المبلغ اليومي</p>
                      <p className="text-2xl font-bold text-purple-600">
                        { formatCurrency(getNetAmount() / project.phase_duration_days) }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        المبلغ الصافي ({ formatCurrency(getNetAmount()) }) ÷ { project.phase_duration_days } يوم
                      </p>
                    </div>
                  ) }

                  {/* Current Phase Status - فقط للمشاريع اليومية */ }
                  { !isMonthlyPhaseProject && divisionType !== 'monthly' && project.phase_duration_days && (() => {
                    const getCurrentPhaseDay = () => {
                      if (!project.phase_start_date || !project.phase_duration_days) return null;

                      const startDate = new Date(project.phase_start_date);
                      const today = new Date();
                      startDate.setHours(0, 0, 0, 0);
                      today.setHours(0, 0, 0, 0);

                      const diffTime = today.getTime() - startDate.getTime();
                      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                      if (diffDays < 0) return null; // لم تبدأ بعد
                      if (diffDays >= project.phase_duration_days) return null; // انتهت

                      return diffDays + 1; // اليوم الحالي (1-based)
                    };

                    const currentDay = getCurrentPhaseDay();
                    const startDate = project.phase_start_date ? new Date(project.phase_start_date) : null;
                    const today = new Date();

                    if (currentDay !== null) {
                      // المرحلة نشطة
                      return (
                        <div className="bg-green-50 rounded-xl p-4 border-2 border-green-300">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <p className="font-semibold text-green-800">المرحلة نشطة</p>
                          </div>
                          <p className="text-lg font-bold text-green-600">
                            اليوم { currentDay } من { project.phase_duration_days }
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            متبقي { project.phase_duration_days - currentDay } يوم
                          </p>
                        </div>
                      );
                    } else if (startDate && startDate > today) {
                      // لم تبدأ بعد
                      return (
                        <div className="bg-yellow-50 rounded-xl p-4 border-2 border-yellow-300">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-yellow-600" />
                            <p className="font-semibold text-yellow-800">المرحلة لم تبدأ بعد</p>
                          </div>
                          <p className="text-sm text-gray-600">
                            تاريخ البدء: { startDate.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) }
                          </p>
                        </div>
                      );
                    } else {
                      // ✅ التحقق من حالة المشاريع الفرعية الفعلية
                      const completedStatuses = ['تم التنفيذ', 'وصل للمتبرع', 'تم المونتاج'];
                      const allPhasesCompleted = normalizedDailyPhases.length > 0 &&
                        normalizedDailyPhases.every(phase =>
                          completedStatuses.includes(phase.status)
                        );

                      const completedCount = normalizedDailyPhases.filter(phase =>
                        completedStatuses.includes(phase.status)
                      ).length;

                      const totalPhases = normalizedDailyPhases.length || project.phase_duration_days || 0;

                      // ✅ إذا كانت جميع المشاريع الفرعية مكتملة
                      if (allPhasesCompleted && normalizedDailyPhases.length > 0) {
                        return (
                          <div className="bg-green-50 rounded-xl p-4 border-2 border-green-300">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <p className="font-semibold text-green-800">المرحلة اكتملت</p>
                            </div>
                            <p className="text-sm text-gray-600">
                              تم إكمال جميع الأيام ({ totalPhases } يوم)
                            </p>
                          </div>
                        );
                      }

                      // ✅ إذا كان التاريخ تجاوز phase_duration_days لكن المشاريع الفرعية لم تكتمل بعد
                      if (normalizedDailyPhases.length > 0 && !allPhasesCompleted) {
                        return (
                          <div className="bg-yellow-50 rounded-xl p-4 border-2 border-yellow-300">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-5 h-5 text-yellow-600" />
                              <p className="font-semibold text-yellow-800">في انتظار إكمال المشاريع الفرعية</p>
                            </div>
                            <p className="text-sm text-gray-600">
                              تم إكمال { completedCount } من { totalPhases } يوم
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              بعض المشاريع الفرعية لا تزال في حالة "{ normalizedDailyPhases.find(p => !completedStatuses.includes(p.status))?.status || 'جديد' }"
                            </p>
                          </div>
                        );
                      }

                      // ✅ إذا لم تكن هناك مشاريع فرعية محملة، نعتمد على التاريخ فقط
                      return (
                        <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-300">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-5 h-5 text-gray-600" />
                            <p className="font-semibold text-gray-800">المرحلة اكتملت</p>
                          </div>
                          <p className="text-sm text-gray-600">
                            تم إكمال جميع الأيام ({ project.phase_duration_days } يوم)
                          </p>
                          { normalizedDailyPhases.length === 0 && (
                            <p className="text-xs text-yellow-700 mt-1">
                              ⚠️ لم يتم تحميل بيانات المشاريع الفرعية للتحقق من حالتها الفعلية
                            </p>
                          ) }
                        </div>
                      );
                    }
                  })() }

                  {/* Divided Days List - الأيام المقسمة/اليومية - فقط للمشاريع اليومية */ }
                  { !isMonthlyPhaseProject && divisionType !== 'monthly' && (
                    <div className="mt-6 border-t border-gray-200 pt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <List className="w-5 h-5 text-purple-600" />
                          الأيام المقسمة ({ normalizedDailyPhases.length } / { project.phase_duration_days || normalizedDailyPhases.length })
                        </h3>
                        { dailyPhasesLoading && (
                          <span className="text-sm text-gray-500 flex items-center gap-2">
                            <span className="inline-flex h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></span>
                            جارِ التحميل...
                          </span>
                        ) }
                      </div>
                      { dailyPhasesError && (
                        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                          { dailyPhasesError }
                        </div>
                      ) }
                      { !dailyPhasesLoading && normalizedDailyPhases.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          لم يتم إنشاء أيام مقسمة/يومية بعد أو لم يتم إرجاعها من الخادم.
                        </p>
                      ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                          { normalizedDailyPhases.map((phase) => {
                            // حساب تاريخ اليوم بناءً على تاريخ البدء ورقم اليوم
                            const getDayDate = () => {
                              if (!project.phase_start_date || !phase.phase_day) return null;
                              const startDate = new Date(project.phase_start_date);
                              startDate.setDate(startDate.getDate() + (phase.phase_day - 1));
                              return startDate;
                            };
                            const dayDate = getDayDate();

                            return (
                              <div
                                key={ phase.id || `phase-${phase.phase_day}` }
                                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                                      يوم { phase.phase_day || '--' }
                                    </span>
                                    { dayDate && (
                                      <span className="text-xs text-gray-500">
                                        { dayDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) }
                                      </span>
                                    ) }
                                    { phase.execution_date && (
                                      <span className="text-xs text-blue-600">
                                        تاريخ التنفيذ: { formatDate(phase.execution_date) }
                                      </span>
                                    ) }
                                  </div>
                                  <p className="text-sm text-gray-700 font-medium">{ phase.project_name || `يوم ${phase.phase_day || '--'}` }</p>



                                </div>
                                <div className="flex items-center gap-2">
                                  { phase.status && (
                                    <span
                                      className={ `inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                        phase.status
                                      )}` }
                                    >
                                      { phase.status }
                                    </span>
                                  ) }
                                  { phase.id && (
                                    <Link
                                      to={ `/project-management/projects/${phase.id}` }
                                      className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
                                    >
                                      عرض التفاصيل
                                    </Link>
                                  ) }
                                </div>
                              </div>
                            );
                          }) }
                        </div>
                      ) }
                    </div>
                  ) }

                  {/* ✅ Monthly Phases List - الشهور المقسمة - فقط للمشاريع الشهرية */ }
                  { (isMonthlyPhaseProject || divisionType === 'monthly') && !monthNumber && (
                    <div className="mt-6 border-t border-gray-200 pt-6">
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={ () => setShowMonthlyPhasesList(!showMonthlyPhasesList) }
                          className="flex items-center gap-2 text-lg font-bold text-gray-800 hover:text-purple-600 transition-colors"
                        >
                          <List className="w-5 h-5 text-purple-600" />
                          الشهور المقسمة ({ normalizedMonthlyPhases.length } / { project.total_months || normalizedMonthlyPhases.length })
                          { showMonthlyPhasesList ? (
                            <ChevronUp className="w-4 h-4 text-purple-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-purple-600" />
                          ) }
                        </button>
                        { monthlyPhasesLoading && (
                          <span className="text-sm text-gray-500 flex items-center gap-2">
                            <span className="inline-flex h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></span>
                            جارِ التحميل...
                          </span>
                        ) }
                      </div>
                      { monthlyPhasesError && (
                        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                          { monthlyPhasesError }
                        </div>
                      ) }
                      { showMonthlyPhasesList && (
                        <>
                          { !monthlyPhasesLoading && normalizedMonthlyPhases.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              لم يتم إنشاء شهور مقسمة بعد أو لم يتم إرجاعها من الخادم.
                            </p>
                          ) : (
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                              { normalizedMonthlyPhases.map((phase) => {
                                // حساب تاريخ الشهر بناءً على month_start_date
                                const getMonthDate = () => {
                                  if (phase.month_start_date) {
                                    return new Date(phase.month_start_date);
                                  }
                                  return null;
                                };
                                const monthDate = getMonthDate();

                                return (
                                  <div
                                    key={ phase.id || `month-phase-${phase.month_number}` }
                                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-purple-100 bg-purple-50 hover:bg-purple-100 transition-colors"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-200 text-purple-800 border border-purple-300">
                                          الشهر { phase.month_number || '--' }
                                        </span>
                                        { monthDate && (
                                          <span className="text-xs text-gray-500">
                                            { monthDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) }
                                          </span>
                                        ) }
                                        { phase.execution_date && (
                                          <span className="text-xs text-blue-600">
                                            تاريخ التنفيذ: { formatDate(phase.execution_date) }
                                          </span>
                                        ) }
                                      </div>
                                      <p className="text-sm text-gray-700 font-medium">{ phase.project_name || `الشهر ${phase.month_number || '--'}` }</p>
                                      { phase.net_amount > 0 && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          المبلغ: { formatCurrency(phase.net_amount) }
                                        </p>
                                      ) }
                                    </div>
                                    <div className="flex items-center gap-2">
                                      { phase.status && (
                                        <span
                                          className={ `inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                            phase.status
                                          )}` }
                                        >
                                          { phase.status }
                                        </span>
                                      ) }
                                      { phase.id && (
                                        <Link
                                          to={ `/project-management/projects/${phase.id}` }
                                          className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors"
                                        >
                                          عرض التفاصيل
                                        </Link>
                                      ) }
                                    </div>
                                  </div>
                                );
                              }) }
                            </div>
                          ) }
                        </>
                      ) }
                    </div>
                  ) }
                </div>
              </div>
            ) }

            {/* Execution Info Card */ }
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <CheckCircle2 className="w-5 h-5 ml-2 text-purple-600" />
                معلومات التنفيذ
              </h2>
              <div className="space-y-4">
                <InfoRow
                  icon={ <Users className="w-4 h-4 text-purple-600" /> }
                  label="الفريق المكلف"
                  value={ getTeamName() }
                />
                { project.assigned_to_team && project.assigned_to_team.team_leader && (
                  <InfoRow
                    icon={ <User className="w-4 h-4 text-indigo-600" /> }
                    label="قائد الفريق"
                    value={ project.assigned_to_team.team_leader.name || '---' }
                  />
                ) }
                <InfoRow
                  icon={ <Tag className="w-4 h-4 text-orange-600" /> }
                  label="التفريعة"
                  value={ subcategoryName }
                />
                <InfoRow
                  icon={ <Home className="w-4 h-4 text-blue-600" /> }
                  label="المخيم المختار"
                  value={
                    project.selected_shelter?.shelter_name ||
                    project.selected_shelter?.camp_name ||
                    project.selected_shelter?.name ||
                    project.shelter_name ||
                    project.camp_name ||
                    project.shelter?.shelter_name ||
                    project.shelter?.camp_name ||
                    project.shelter?.name ||
                    'لم يتم الاختيار بعد'
                  }
                />
                { project.selected_shelter && (
                  <>
                    { project.selected_shelter.governorate && (
                      <InfoRow
                        icon={ <Home className="w-4 h-4 text-blue-500" /> }
                        label="موقع المخيم"
                        value={ `${project.selected_shelter.governorate || ''} ${project.selected_shelter.district ? `- ${project.selected_shelter.district}` : ''}`.trim() || '---' }
                      />
                    ) }
                    { project.selected_shelter.detailed_address && (
                      <InfoRow
                        icon={ <Home className="w-4 h-4 text-blue-400" /> }
                        label="العنوان التفصيلي"
                        value={ project.selected_shelter.detailed_address }
                        fullWidth
                      />
                    ) }
                    { project.selected_shelter.families_count !== undefined && (
                      <InfoRow
                        icon={ <Users className="w-4 h-4 text-green-600" /> }
                        label="عدد الأسر في المخيم"
                        value={ `${project.selected_shelter.families_count} أسرة` }
                      />
                    ) }
                  </>
                ) }
                { project.assigned_by && (
                  <InfoRow
                    icon={ <User className="w-4 h-4 text-gray-600" /> }
                    label="تم التوزيع بواسطة"
                    value={ project.assigned_by_user?.name || `المستخدم #${project.assigned_by}` || '---' }
                  />
                ) }
                { project.assignment_date && (
                  <InfoRow
                    icon={ <Calendar className="w-4 h-4 text-gray-600" /> }
                    label="تاريخ التوزيع"
                    value={ formatDate(project.assignment_date) }
                  />
                ) }
                { project.execution_started_at && (
                  <InfoRow
                    icon={ <Clock className="w-4 h-4 text-green-600" /> }
                    label="تاريخ بدء التنفيذ"
                    value={ formatDate(project.execution_started_at) }
                  />
                ) }
                { project.execution_completed_at && (
                  <InfoRow
                    icon={ <CheckCircle2 className="w-4 h-4 text-green-600" /> }
                    label="تاريخ إتمام التنفيذ"
                    value={ formatDate(project.execution_completed_at) }
                  />
                ) }
                { project.media_received_date && (
                  <InfoRow
                    icon={ <Film className="w-4 h-4 text-purple-600" /> }
                    label="تاريخ استلام الميديا"
                    value={ formatDate(project.media_received_date) }
                  />
                ) }
                { project.montage_start_date && (
                  <InfoRow
                    icon={ <Film className="w-4 h-4 text-indigo-600" /> }
                    label="تاريخ بدء المونتاج"
                    value={ formatDate(project.montage_start_date) }
                  />
                ) }
                { project.montage_completed_date && (
                  <InfoRow
                    icon={ <CheckCircle2 className="w-4 h-4 text-indigo-600" /> }
                    label="تاريخ إتمام المونتاج"
                    value={ formatDate(project.montage_completed_date) }
                  />
                ) }
                { project.sent_to_donor_date && (
                  <InfoRow
                    icon={ <CheckCircle2 className="w-4 h-4 text-green-600" /> }
                    label="تاريخ الإرسال للمتبرع"
                    value={ formatDate(project.sent_to_donor_date) }
                  />
                ) }
              </div>
            </div>

            {/* Postponement Info Card - يظهر فقط إذا كان المشروع مؤجلاً */ }
            { project?.status === 'مؤجل' && getPostponementReason() && (
              <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-amber-300">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <Pause className="w-5 h-5 ml-2 text-amber-500" />
                  معلومات التأجيل
                </h2>
                <div className="space-y-4">
                  <InfoRow
                    icon={ <AlertCircle className="w-4 h-4 text-amber-600" /> }
                    label="سبب التأجيل"
                    value={ getPostponementReason() }
                    fullWidth
                  />
                  { project.postponed_at && (
                    <InfoRow
                      icon={ <Clock className="w-4 h-4 text-amber-600" /> }
                      label="تاريخ التأجيل"
                      value={ formatDate(project.postponed_at) }
                    />
                  ) }
                </div>
              </div>
            ) }
          </div>

          {/* Sidebar */ }
          <div className="space-y-6">
            {/* Timeline Card */ }
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Calendar className="w-5 h-5 ml-2 text-sky-600" />
                سجل الحركة
              </h2>
              <div className="space-y-4">
                { timeline.length === 0 ? (
                  <p className="text-gray-500 text-sm">لا توجد حركات بعد</p>
                ) : (
                  timeline.map((item, index) => (
                    <div key={ item.id } className="relative">
                      { index !== timeline.length - 1 && (
                        <div className="absolute right-3 top-8 bottom-0 w-0.5 bg-gray-200"></div>
                      ) }
                      <div className="flex gap-3">
                        <div
                          className={ `flex-shrink-0 w-6 h-6 rounded-full ${getStatusColor(
                            item.status_to
                          )} flex items-center justify-center relative z-10` }
                        >
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm font-medium text-gray-800">{ item.status_to }</p>
                          <p className="text-xs text-gray-600 mt-1">
                            بواسطة { (() => {
                              // ✅ محاولة استخراج اسم المستخدم من عدة مصادر
                              const userName =
                                item.changed_by_name || // ✅ اسم مباشر من Backend
                                item.changed_by_user?.name ||
                                item.changed_by_user?.user_name ||
                                item.changedBy?.name ||
                                item.changedBy?.user_name ||
                                item.user?.name ||
                                item.user?.user_name ||
                                null;

                              // ✅ محاولة استخراج الدور من عدة مصادر
                              const userRole =
                                item.changed_by_user?.role ||
                                item.changed_by_user?.role_name ||
                                item.changed_by_user?.user_role ||
                                item.changedBy?.role ||
                                item.changedBy?.role_name ||
                                item.changedBy?.user_role ||
                                item.user?.role ||
                                item.user?.role_name ||
                                item.user?.user_role ||
                                null;

                              // ✅ عرض اسم المستخدم مع الدور إذا كان متاحاً
                              if (userName) {
                                const roleText = userRole ? ` (${userRole})` : '';
                                return `${userName}${roleText}`;
                              }

                              // ✅ إذا لم يكن هناك اسم، نعرض معرف المستخدم أو "غير محدد"
                              // ✅ معالجة حالة كون changed_by هو object
                              let userId = null;
                              if (item.changed_by) {
                                // ✅ إذا كان changed_by هو object، نستخرج id منه
                                if (typeof item.changed_by === 'object' && item.changed_by !== null) {
                                  userId = item.changed_by.id || item.changed_by.user_id || null;
                                } else if (typeof item.changed_by === 'number' || typeof item.changed_by === 'string') {
                                  userId = item.changed_by;
                                }
                              }

                              // ✅ إذا لم نجد userId من changed_by، نجرب المصادر الأخرى
                              if (!userId) {
                                userId = item.changedBy?.id || item.user?.id || null;
                              }

                              if (userId) {
                                return `المستخدم #${userId}`;
                              }

                              return 'غير محدد';
                            })() }
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            { formatDate(item.created_at) }
                          </p>
                          { /* ✅ عرض اسم المخيم المختار عند الإسناد */ }
                          { (() => {
                            // ✅ محاولة استخراج اسم المخيم من عدة مصادر (من timeline item أولاً)
                            let shelterName =
                              item.selected_shelter?.shelter_name ||
                              item.selected_shelter?.camp_name ||
                              item.selected_shelter?.name ||
                              item.shelter?.shelter_name ||
                              item.shelter?.camp_name ||
                              item.shelter?.name ||
                              item.shelter_name ||
                              item.camp_name ||
                              null;

                            // ✅ إذا لم يكن اسم المخيم موجوداً في timeline item، نستخدم معلومات المشروع الحالي
                            // ✅ نعرض اسم المخيم في جميع الحالات المتعلقة بالإسناد والتنفيذ
                            if (!shelterName && project?.selected_shelter) {
                              shelterName =
                                project.selected_shelter.shelter_name ||
                                project.selected_shelter.camp_name ||
                                project.selected_shelter.name ||
                                null;
                            }

                            // ✅ عرض اسم المخيم إذا كان متاحاً وكانت الحالة متعلقة بالإسناد أو اختيار المخيم أو التنفيذ
                            if (shelterName && (
                              item.status_to === 'مسند لباحث' ||
                              item.status_to === 'جاهز للتنفيذ' ||
                              item.status_to === 'تم اختيار المخيم' ||
                              item.status_to === 'قيد التنفيذ' ||
                              item.status_to === 'تم التنفيذ'
                            )) {
                              return (
                                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                                  <Home className="w-3 h-3" />
                                  المخيم: { shelterName }
                                </p>
                              );
                            }
                            return null;
                          })() }
                          { /* ✅ عرض الملاحظات مع تحسين التنسيق */ }
                          { item.notes && (
                            <p className="text-xs text-gray-700 mt-2 bg-gray-50 p-2 rounded border-r-2 border-sky-500 whitespace-pre-wrap break-words">
                              { item.notes }
                            </p>
                          ) }
                        </div>
                      </div>
                    </div>
                  ))
                ) }
              </div>
            </div>

            {/* Media & Communications Card */ }
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Film className="w-5 h-5 ml-2 text-orange-500" />
                الإعلام والمونتاج
              </h2>
              <div className="space-y-3 text-sm">
                <InfoRow label="حالة الإعلام" value={ getMediaStatus() } />
                <InfoRow
                  label="آخر تحديث للإعلام"
                  value={
                    project.media_updated_at
                      ? formatDate(project.media_updated_at)
                      : 'لم يتم التحديث'
                  }
                />
                { getMediaNotes() ? (
                  <div className="col-span-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-2">ملاحظات الإعلام</p>
                        <div className="bg-sky-50 border-r-4 border-sky-500 rounded-lg p-4">
                          <div className="text-gray-800 font-medium whitespace-pre-wrap break-words">
                            { (() => {
                              const notes = getMediaNotes();
                              const urlRegex = /(https?:\/\/[^\s]+)/g;
                              const links = notes.match(urlRegex) || [];

                              if (links.length === 0) {
                                return <span>{ notes }</span>;
                              }

                              // تقسيم النص حسب الروابط
                              const parts = [];
                              let lastIndex = 0;

                              links.forEach((link) => {
                                const linkIndex = notes.indexOf(link, lastIndex);
                                if (linkIndex > lastIndex) {
                                  parts.push({ type: 'text', content: notes.substring(lastIndex, linkIndex) });
                                }
                                parts.push({ type: 'link', content: link, url: link });
                                lastIndex = linkIndex + link.length;
                              });

                              if (lastIndex < notes.length) {
                                parts.push({ type: 'text', content: notes.substring(lastIndex) });
                              }

                              return (
                                <span>
                                  { parts.map((part, index) => {
                                    if (part.type === 'link') {
                                      return (
                                        <a
                                          key={ index }
                                          href={ part.url }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sky-600 hover:text-sky-700 underline font-semibold break-all inline-block"
                                        >
                                          { part.content }
                                        </a>
                                      );
                                    }
                                    return <span key={ index }>{ part.content }</span>;
                                  }) }
                                </span>
                              );
                            })() }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <InfoRow
                    label="ملاحظات الإعلام"
                    value="لا توجد ملاحظات"
                    fullWidth
                  />
                ) }
              </div>
            </div>

            {/* Montage Producer Card - قسم الممنتجين */ }
            { (project.assigned_montage_producer_id || project.assigned_montage_producer) && (
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <Users className="w-5 h-5 ml-2 text-purple-500" />
                  ممنتج المونتاج
                </h2>
                <div className="space-y-3 text-sm">
                  <InfoRow
                    label="الممنتج المسند"
                    value={
                      project.assigned_montage_producer?.name ||
                      project.montage_producer_name ||
                      project.montage_producer?.name ||
                      project.assignedMontageProducer?.name ||
                      project.assigned_montage_producer_name ||
                      project.producer_name ||
                      project.montageProducer?.name ||
                      'غير محدد'
                    }
                  />
                  { project.assigned_montage_producer?.projects_count !== undefined && (
                    <InfoRow
                      label="عدد المشاريع المسندة"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <span className="font-bold text-purple-600">
                            { project.assigned_montage_producer.projects_count }
                          </span>
                          <span className="text-gray-500">مشروع</span>
                        </span>
                      }
                    />
                  ) }
                  { project.montage_producer_assigned_at && (
                    <InfoRow
                      label="تاريخ الإسناد"
                      value={ formatDate(project.montage_producer_assigned_at) }
                    />
                  ) }
                  { project.assigned_montage_producer_id && (
                    <div className="mt-4">
                      <Link
                        to={ `/media-management/producers/${project.assigned_montage_producer_id}/projects` }
                        className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium text-sm transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                        عرض جميع مشاريع الممنتج
                      </Link>
                    </div>
                  ) }
                </div>
              </div>
            ) }

            {/* Created Info Card */ }
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl p-6 border-2 border-sky-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                <User className="w-5 h-5 ml-2 text-sky-600" />
                معلومات الإنشاء والتحديث
              </h3>
              <div className="space-y-3">
                { project.created_by_user && (
                  <InfoRow
                    icon={ <User className="w-4 h-4 text-sky-600" /> }
                    label="تم الإنشاء بواسطة"
                    value={ (() => {
                      const user = project.created_by_user;
                      if (typeof user === 'object' && user !== null) {
                        return user.name || user.user_name || user.name_ar || `المستخدم #${project.created_by}` || '---';
                      }
                      return user || `المستخدم #${project.created_by}` || '---';
                    })() }
                  />
                ) }
                { project.created_at && (
                  <InfoRow
                    icon={ <Calendar className="w-4 h-4 text-blue-600" /> }
                    label="تاريخ الإنشاء"
                    value={ formatDate(project.created_at) }
                  />
                ) }
                { project.updated_at && (
                  <InfoRow
                    icon={ <Clock className="w-4 h-4 text-indigo-600" /> }
                    label="آخر تحديث"
                    value={ formatDate(project.updated_at) }
                  />
                ) }
                { project.created_by && !project.created_by_user && (
                  <InfoRow
                    icon={ <User className="w-4 h-4 text-gray-600" /> }
                    label="معرف المنشئ"
                    value={ `المستخدم #${project.created_by}` }
                  />
                ) }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */ }
      { showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4">تأكيد الحذف</h3>
            <p className="text-gray-600 mb-6">
              هل أنت متأكد من حذف هذا المشروع؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={ () => setShowDeleteConfirm(false) }
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={ handleDelete }
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      ) }

      {/* Modal Convert to Shekel */ }
      { showConvertToShekelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <RefreshCw className="w-5 h-5 ml-2 text-emerald-500" />
                { hasShekelConversion() ? 'تحديث سعر الصرف' : 'تحويل المبلغ للشيكل' }
              </h2>
              <button
                onClick={ () => {
                  setShowConvertToShekelModal(false);
                  setExchangeRate('');
                } }
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">المبلغ الصافي بالدولار:</p>
                <p className="text-xl font-bold text-gray-800">{ formatCurrency(getNetAmount()) }</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  سعر الصرف (USD → ILS) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={ exchangeRate }
                  onChange={ (e) => setExchangeRate(e.target.value) }
                  placeholder="مثال: 3.65"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  أدخل سعر صرف الدولار مقابل الشيكل الإسرائيلي
                </p>
              </div>

              { exchangeRate && parseFloat(exchangeRate) > 0 && (
                <div className="bg-emerald-50 rounded-xl p-4 border-2 border-emerald-200">
                  <p className="text-sm text-gray-600 mb-1">المبلغ المتوقع بالشيكل:</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    ₪{ formatShekel(getNetAmount() * parseFloat(exchangeRate)) }
                  </p>
                </div>
              ) }

              { hasShekelConversion() && (
                <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                  <p className="text-sm text-gray-600 mb-1">المبلغ الحالي بالشيكل:</p>
                  <p className="text-lg font-bold text-blue-700">
                    ₪{ formatShekel(getNetAmountShekel()) }
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    سعر الصرف الحالي: { getShekelExchangeRate() }
                  </p>
                </div>
              ) }

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={ () => {
                    setShowConvertToShekelModal(false);
                    setExchangeRate('');
                  } }
                  disabled={ isConverting }
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={ handleConvertToShekel }
                  disabled={ isConverting || !exchangeRate || parseFloat(exchangeRate) <= 0 }
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  { isConverting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                      جاري التحويل...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 ml-2" />
                      { hasShekelConversion() ? 'تحديث' : 'تحويل' }
                    </>
                  ) }
                </button>
              </div>
            </div>
          </div>
        </div>
      ) }

      {/* Modal تأجيل المشروع */ }
      { showPostponeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <Pause className="w-5 h-5 ml-2 text-amber-500" />
                تأجيل المشروع
              </h2>
              <button
                onClick={ () => {
                  setShowPostponeModal(false);
                  setPostponementReason('');
                } }
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سبب التأجيل <span className="text-red-500">*</span>
              </label>
              <textarea
                value={ postponementReason }
                onChange={ (e) => setPostponementReason(e.target.value) }
                placeholder="أدخل سبب تأجيل المشروع..."
                rows={ 4 }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                يرجى إدخال سبب واضح لتأجيل المشروع
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={ () => {
                  setShowPostponeModal(false);
                  setPostponementReason('');
                } }
                disabled={ isPostponing }
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={ handlePostponeProject }
                disabled={ isPostponing || !postponementReason.trim() }
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                { isPostponing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                    جاري التأجيل...
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 ml-2" />
                    تأجيل المشروع
                  </>
                ) }
              </button>
            </div>
          </div>
        </div>
      ) }

      {/* ✅ Accept Modal (نفس وظيفة الإشعارات) */ }
      { acceptModalOpen && notificationToAccept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              {/* Header */ }
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">قبول المونتاج</h2>
                    <p className="text-sm text-gray-500 mt-1">تأكيد قبول المونتاج</p>
                  </div>
                </div>
                <button
                  onClick={ handleCloseAcceptModal }
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={ accepting }
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */ }
              <div className="mb-6">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 mb-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">⚠️ ملاحظة مهمة:</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    عند قبول المونتاج، سيتم نقل المشروع إلى حالة <span className="font-bold text-green-700">"منتهي"</span> تلقائياً.
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed mt-2">
                    عند رفض المونتاج، سيتم إرجاع المشروع إلى الإعلام بحالة <span className="font-bold text-red-700">"يجب إعادة المونتاج"</span>.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-2">المشروع:</p>
                  <p className="font-semibold text-gray-800">
                    { notificationToAccept.metadata?.project_name || notificationToAccept.metadata?.projectName || project?.project_name || 'مشروع بدون اسم' }
                  </p>
                  { getProjectCodeHelper(notificationToAccept.metadata || project, null) && (
                    <p className="text-sm text-gray-500 mt-1">
                      كود المشروع: { getProjectCodeHelper(notificationToAccept.metadata || project) }
                    </p>
                  ) }
                </div>
              </div>

              {/* Actions */ }
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={ handleCloseAcceptModal }
                  className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                  disabled={ accepting }
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={ () => {
                    setSelectedNotification(notificationToAccept);
                    handleCloseAcceptModal();
                    handleOpenReplyModal(notificationToAccept);
                  } }
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                  disabled={ accepting }
                >
                  <MessageSquare className="w-4 h-4" />
                  رفض المونتاج
                </button>
                <button
                  onClick={ handleAccept }
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={ accepting }
                >
                  { accepting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>جاري القبول...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>قبول المونتاج</span>
                    </>
                  ) }
                </button>
              </div>
            </div>
          </div>
        </div>
      ) }

      {/* ✅ Reply Modal (نفس وظيفة الإشعارات) */ }
      { replyModalOpen && selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">رد على إشعار المونتاج</h2>
                <button
                  onClick={ handleCloseReplyModal }
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">الإشعار:</p>
                <p className="font-semibold text-gray-800">{ selectedNotification.title }</p>
                <p className="text-sm text-gray-600 mt-2">{ selectedNotification.message }</p>
              </div>

              <form onSubmit={ handleReplySubmit } className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الرسالة <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={ replyForm.message }
                    onChange={ (e) => setReplyForm({ ...replyForm, message: e.target.value }) }
                    rows={ 4 }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="أدخل الرسالة التي تريد إرسالها لقسم الإعلام..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    سبب الرفض <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={ replyForm.rejection_reason }
                    onChange={ (e) => setReplyForm({ ...replyForm, rejection_reason: e.target.value }) }
                    rows={ 4 }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="أدخل سبب رفض المونتاج..."
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={ handleCloseReplyModal }
                    className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    disabled={ replying }
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={ replying }
                  >
                    { replying ? 'جاري الإرسال...' : 'إرسال الرد' }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) }

      {/* Add Orphans Modal for Orphan Sponsorship Projects */ }
      { project && addOrphansModalOpen && (
        <AddOrphansModal
          isOpen={ addOrphansModalOpen }
          onClose={ () => {
            setAddOrphansModalOpen(false);
          } }
          projectId={ project.id }
          project={ project }
          onSuccess={ () => {
            invalidateProjectsCache();
            fetchProjectDetails(true);
          } }
        />
      ) }
    </div>
  );
};

const InfoRow = ({ label, value, icon, fullWidth, preserveWhitespace }) => {
  // ✅ التأكد من أن value هو string أو number أو null/undefined أو React element
  const safeValue = (() => {
    if (value === null || value === undefined) {
      return '---';
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    // ✅ إذا كان React element (object مع $$typeof)، نعيده كما هو
    if (typeof value === 'object' && value !== null) {
      // ✅ التحقق من أنه React element
      if (value.$$typeof === Symbol.for('react.element') || value.$$typeof === Symbol.for('react.transitional.element')) {
        return value; // ✅ إرجاع React element مباشرة
      }
      // ✅ إذا كان object عادي، نحاول استخراج name أو name_ar
      if (value.name_ar) return String(value.name_ar);
      if (value.name) return String(value.name);
      if (value.name_en) return String(value.name_en);
      // ✅ إذا لم نجد name، نعرض رسالة تحذير فقط في development
      if (import.meta.env.DEV) {
        console.warn('⚠️ InfoRow received object value:', value);
      }
      return '---';
    }
    return String(value);
  })();

  // ✅ التحقق من أن safeValue هو React element
  const isReactElement = typeof safeValue === 'object' && safeValue !== null &&
    (safeValue.$$typeof === Symbol.for('react.element') || safeValue.$$typeof === Symbol.for('react.transitional.element'));

  return (
    <div className={ fullWidth ? 'col-span-2' : '' }>
      <div className="flex items-start gap-2">
        { icon && <span className="mt-1">{ icon }</span> }
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{ label }</p>
          { isReactElement ? (
            <div className={ `text-gray-800 font-medium ${preserveWhitespace ? 'whitespace-pre-wrap break-words' : ''}` }>
              { safeValue }
            </div>
          ) : (
            <p className={ `text-gray-800 font-medium ${preserveWhitespace ? 'whitespace-pre-wrap break-words' : ''}` }>
              { safeValue }
            </p>
          ) }
        </div>
      </div>
    </div>
  );
};

// دالة لاستخراج الروابط من النص
const extractLinksFromText = (text) => {
  if (!text || typeof text !== 'string') return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const links = text.match(urlRegex) || [];

  if (links.length === 0) {
    return <span>{ text }</span>;
  }

  // تقسيم النص حسب الروابط
  const parts = [];
  let lastIndex = 0;

  links.forEach((link) => {
    const linkIndex = text.indexOf(link, lastIndex);
    if (linkIndex > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, linkIndex) });
    }
    parts.push({ type: 'link', content: link, url: link });
    lastIndex = linkIndex + link.length;
  });

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return (
    <span>
      { parts.map((part, index) => {
        if (part.type === 'link') {
          return (
            <a
              key={ index }
              href={ part.url }
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 hover:text-sky-700 underline font-medium break-all"
            >
              { part.content }
            </a>
          );
        }
        return <span key={ index }>{ part.content }</span>;
      }) }
    </span>
  );
};

// Convert to Shekel Card Component
const ConvertToShekelCard = ({ project, hasConversion, netAmountUSD, netAmountShekel, exchangeRate, onConvert, onUpdate }) => {
  const formatCurrency = (amount) => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(0);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(numericAmount);
  };

  const formatShekel = (amount) => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return '0.00';
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  };

  const formatDate = (date) => {
    if (!date) return 'غير محدد';
    const dateObj = new Date(date);
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  };

  if (hasConversion) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 shadow-lg border-2 border-emerald-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <DollarSign className="w-5 h-5 ml-2 text-emerald-600" />
            تم التحويل للشيكل ✅
          </h2>
          <button
            onClick={ onUpdate }
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث سعر الصرف
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border border-emerald-200">
            <p className="text-sm text-gray-600 mb-1">المبلغ بالدولار:</p>
            <p className="text-xl font-bold text-gray-800">{ formatCurrency(netAmountUSD) }</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-200">
            <p className="text-sm text-gray-600 mb-1">سعر الصرف:</p>
            <p className="text-xl font-bold text-emerald-700">{ exchangeRate }</p>
          </div>
          <div className="bg-white rounded-xl p-4 border-2 border-emerald-300 md:col-span-2">
            <p className="text-sm text-gray-600 mb-1">المبلغ بالشيكل:</p>
            <p className="text-3xl font-bold text-emerald-700">₪{ formatShekel(netAmountShekel) }</p>
          </div>
          { project.shekel_converted_at && (
            <div className="bg-white rounded-xl p-4 border border-emerald-200">
              <p className="text-sm text-gray-600 mb-1">تاريخ التحويل:</p>
              <p className="text-sm font-medium text-gray-800">{ formatDate(project.shekel_converted_at) }</p>
            </div>
          ) }
          { project.shekel_converted_by_user && (
            <div className="bg-white rounded-xl p-4 border border-emerald-200">
              <p className="text-sm text-gray-600 mb-1">تم بواسطة:</p>
              <p className="text-sm font-medium text-gray-800">
                { (() => {
                  const user = project.shekel_converted_by_user;
                  if (typeof user === 'object' && user !== null) {
                    return user.name || user.user_name || user.name_ar || '---';
                  }
                  return user || '---';
                })() }
              </p>
            </div>
          ) }
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <DollarSign className="w-5 h-5 ml-2 text-emerald-600" />
          تحويل المبلغ للشيكل
        </h2>
        <button
          onClick={ onConvert }
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          تحويل للشيكل
        </button>
      </div>
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-sm text-gray-600 mb-2">
          المبلغ الصافي الحالي: <span className="font-semibold text-gray-800">{ formatCurrency(netAmountUSD) }</span>
        </p>
        <p className="text-xs text-gray-500">
          يمكنك تحويل المبلغ للشيكل الإسرائيلي (ILS) قبل نقل المشروع لمرحلة التوريد. المخزن يعمل بالشيكل.
        </p>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, value, subtitle, highlight, multiline }) => {
  // ✅ التأكد من أن value هو string أو number أو null/undefined
  const safeValue = (() => {
    if (value === null || value === undefined) {
      return '---';
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    if (typeof value === 'object') {
      // ✅ إذا كان object، نحاول استخراج name أو name_ar
      if (value.name_ar) return String(value.name_ar);
      if (value.name) return String(value.name);
      if (value.name_en) return String(value.name_en);
      // ✅ إذا لم نجد name، نعرض رسالة خطأ
      console.warn('⚠️ SummaryCard received object value:', value);
      return '---';
    }
    return String(value);
  })();

  return (
    <div
      className={ `rounded-2xl p-4 border shadow-sm ${highlight ? 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200' : 'bg-white border-gray-100'
        }` }
    >
      <p className="text-sm text-gray-500 mb-2">{ title }</p>
      <p className={ `text-lg font-bold text-gray-800 ${multiline ? 'whitespace-pre-line leading-relaxed' : ''}` }>
        { safeValue }
      </p>
      { subtitle && (
        <div className="text-xs text-gray-500 mt-1 whitespace-pre-line break-words">
          { typeof subtitle === 'string' ? extractLinksFromText(subtitle) : subtitle }
        </div>
      ) }
    </div>
  );
};

export default ProjectDetails;


