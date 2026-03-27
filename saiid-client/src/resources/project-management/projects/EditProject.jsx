import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { useCacheInvalidation } from '../../../hooks/useCacheInvalidation';
import { toast } from 'react-toastify';
import {
  Save, ArrowRight, DollarSign, Calculator,
  Image as ImageIcon, X as XIcon, Calendar, Clock,
  FileText, Tag, Package, User, AlertCircle,
} from 'lucide-react';
import Unauthorized from '../components/Unauthorized';
const DEFAULT_PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];

const ALLOWED_IMAGE_TYPES      = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];
const MAX_IMAGE_SIZE_BYTES      = 5 * 1024 * 1024; // 5 MB

const INITIAL_FORM = {
  donor_code:             '',
  project_name:           '',
  description:            '',
  donor_name:             '',
  project_type:           '',
  subcategory_id:         '',
  donation_amount:        '',
  currency_id:            '',
  discount_percentage:    0,
  estimated_duration_days:'',
  notes:                  '',
  notes_image:            null,
  is_divided_into_phases: false,
  phase_type:             null,   // 'daily' | 'monthly' | null
  phase_duration_days:    '',     // daily only
  total_months:           '',     // monthly only
  phase_start_date:       '',
  is_urgent:              false,
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
const buildDefaultTypesMap = () => {
  const types = DEFAULT_PROJECT_TYPES.map((name, i) => ({ id: i + 1, name }));
  const map   = {};
  DEFAULT_PROJECT_TYPES.forEach((name, i) => { map[name] = i + 1; });
  return { types, map };
};

const toAbsoluteUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${normalizedPath}`;
};

const formatDateForInput = (raw) => {
  if (!raw) return '';
  try { return new Date(raw).toISOString().split('T')[0]; } catch { return raw; }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────
const EditProject = () => {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const { invalidateProjectsCache } = useCacheInvalidation();

  // ── State ────────────────────────────────────────────────────────────────
  const [loading,              setLoading]              = useState(false);
  const [currencies,           setCurrencies]           = useState([]);
  const [subcategories,        setSubcategories]        = useState([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [projectTypes,         setProjectTypes]         = useState([]);
  const [projectTypesLoading,  setProjectTypesLoading]  = useState(false);
  const [projectTypesMap,      setProjectTypesMap]      = useState({});
  const [calculatedValues,     setCalculatedValues]     = useState({ amountInUsd: 0, netAmount: 0 });
  const [formData,             setFormData]             = useState(INITIAL_FORM);
  const [errors,               setErrors]               = useState({});

  // image state
  const [notesImagePreview,    setNotesImagePreview]    = useState(null);
  const [existingNotesImageUrl,setExistingNotesImageUrl]= useState(null);
  const [existingNoteImages,   setExistingNoteImages]   = useState([]);   // from API
  const [newNoteImages,        setNewNoteImages]        = useState([]);   // { file, previewUrl }[]
  const [noteImagesToDelete,   setNoteImagesToDelete]   = useState([]);   // ids[]

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCurrencies();
    fetchProjectTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currencies.length > 0) fetchProjectDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencies, id]);

  // ── Financial calculations ───────────────────────────────────────────────
  useEffect(() => {
    if (!formData.donation_amount || !formData.currency_id) {
      setCalculatedValues({ amountInUsd: 0, netAmount: 0 });
      return;
    }
    const currency = currencies.find((c) => c.id === parseInt(formData.currency_id, 10));
    if (!currency) return;
    const amountInUsd = parseFloat(formData.donation_amount) * currency.exchange_rate_to_usd;
    const discount    = (amountInUsd * parseFloat(formData.discount_percentage || 0)) / 100;
    setCalculatedValues({ amountInUsd, netAmount: amountInUsd - discount });
  }, [formData.donation_amount, formData.currency_id, formData.discount_percentage, currencies]);

  // ── Subcategories when project_type changes ──────────────────────────────
  useEffect(() => {
    const fetchSubcategories = async () => {
      let typeValue = formData.project_type;
      if (typeof typeValue === 'object' && typeValue !== null) {
        typeValue = typeValue.id || typeValue.name || typeValue.name_ar || typeValue.name_en;
      }
      if (!typeValue) {
        setSubcategories([]);
        setFormData((prev) => ({ ...prev, subcategory_id: '' }));
        return;
      }

      const savedSubcategoryId = formData.subcategory_id;
      setSubcategoriesLoading(true);
      try {
        const res = await apiClient.get(`/project-subcategories/by-type/${typeValue}`, {
          params:  { _t: Date.now() },
          timeout: 20000,
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.data.success) {
          const data = res.data.data || [];
          setSubcategories(data);
          if (savedSubcategoryId) {
            const found = data.find(
              (s) => s.id === parseInt(savedSubcategoryId) || String(s.id) === String(savedSubcategoryId)
            );
            if (!found) setFormData((prev) => ({ ...prev, subcategory_id: '' }));
          }
        }
      } catch (error) {
        if (import.meta.env.DEV && !error.isConnectionError)
          console.error('Error fetching subcategories:', error);
        setSubcategories([]);
        if (formData.subcategory_id) setFormData((prev) => ({ ...prev, subcategory_id: '' }));
      } finally {
        setSubcategoriesLoading(false);
      }
    };
    fetchSubcategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.project_type]);

  // ── Cleanup Object URLs on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      newNoteImages.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── API: project types ───────────────────────────────────────────────────
  const fetchProjectTypes = async () => {
    setProjectTypesLoading(true);
    try {
      const res = await apiClient.get('/project-types', {
        params:  { _t: Date.now() },
        timeout: 10000,
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.data.success) {
        const data = res.data.data || res.data.types || [];
        if (data.length > 0) {
          setProjectTypes(data);
          const map = {};
          data.forEach((t) => {
            const name = typeof t === 'string' ? t : (t.name || t);
            const tid  = typeof t === 'object' ? t.id : null;
            if (name && tid) map[name] = tid;
          });
          setProjectTypesMap(map);
          setProjectTypesLoading(false);
          return;
        }
      }
    } catch (error) {
      if (import.meta.env.DEV && !error.isConnectionError)
        console.error('Error fetching project types:', error);
    }
    // fallback to defaults
    const { types, map } = buildDefaultTypesMap();
    setProjectTypes(types);
    setProjectTypesMap(map);
    setProjectTypesLoading(false);
  };

  // ── API: currencies ──────────────────────────────────────────────────────
  const fetchCurrencies = async () => {
    try {
      const res = await apiClient.get('/currencies', {
        params:  { per_page: 1000, include_inactive: false, _t: Date.now() },
        timeout: 20000,
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.data.success) {
        const data = res.data.currencies || res.data.data || [];
        setCurrencies(data.filter((c) => c.is_active));
      }
    } catch (error) {
      if (import.meta.env.DEV && !error.isConnectionError)
        console.error('Error fetching currencies:', error);
      if (!error.isConnectionError) toast.error('فشل تحميل العملات');
    }
  };

  // ── API: project details ─────────────────────────────────────────────────
  const fetchProjectDetails = async () => {
    let loadingTimeout;
    try {
      loadingTimeout = setTimeout(() => {}, 5000); // safety timeout

      const res = await apiClient.get(`/project-proposals/${id}`, {
        params:  { _t: Date.now() },
        timeout: 20000,
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (loadingTimeout) clearTimeout(loadingTimeout);

      if (res.data.success === false) {
        toast.error('تعذر تحميل بيانات المشروع');
        navigate('/project-management/projects');
        return;
      }

      const project = res.data.project || res.data.data || res.data.result || res.data;
      if (!project || Object.keys(project).length === 0)
        throw new Error('لم يتم العثور على بيانات للمشروع');

      // ── phase type detection ─────────────────────────────────────────────
      const isDivided      = project.is_divided_into_phases === true;
      const divisionInfo   = project.division_info;
      const phaseType      = project.phase_type;
      const isDaily        = divisionInfo?.is_daily   || phaseType === 'daily';
      const isMonthly      = divisionInfo?.is_monthly || phaseType === 'monthly';
      let determinedPhaseType = phaseType;
      if (!determinedPhaseType && isDivided) {
        if      (isDaily)                                              determinedPhaseType = 'daily';
        else if (isMonthly)                                            determinedPhaseType = 'monthly';
        else if (project.phase_duration_days && !project.total_months) determinedPhaseType = 'daily';
        else if (project.total_months && !project.phase_duration_days) determinedPhaseType = 'monthly';
      }

      // ── project_type (object or string) ─────────────────────────────────
      let projectTypeValue = project.project_type || '';
      if (typeof projectTypeValue === 'object' && projectTypeValue !== null) {
        projectTypeValue = projectTypeValue.name_ar || projectTypeValue.name || projectTypeValue.name_en || '';
      }

      // ── subcategory_id ───────────────────────────────────────────────────
      const subcategoryId =
        project.subcategory_id ||
        project.subcategory?.id ||
        (project.subcategory && typeof project.subcategory === 'object' ? project.subcategory.id : null);

      setFormData({
        donor_code:              project.donor_code    || '',
        project_name:            project.project_name  || '',
        description:             project.project_description || project.description || '',
        donor_name:              project.donor_name    || '',
        project_type:            projectTypeValue,
        subcategory_id:          subcategoryId ? String(subcategoryId) : '',
        donation_amount:         project.donation_amount ? String(project.donation_amount) : '',
        currency_id:             project.currency_id
                                   ? String(project.currency_id)
                                   : project.currency?.id ? String(project.currency.id) : '',
        discount_percentage:     project.admin_discount_percentage ?? project.discount_percentage ?? 0,
        estimated_duration_days: project.estimated_duration_days || project.estimated_duration || project.execution_duration_days || '',
        notes:                   project.notes || '',
        notes_image:             null,
        is_divided_into_phases:  isDivided,
        phase_type:              determinedPhaseType || null,
        phase_duration_days:     project.phase_duration_days ? String(project.phase_duration_days) : '',
        total_months:            project.total_months  ? String(project.total_months)  : '',
        phase_start_date:        formatDateForInput(project.phase_start_date),
        is_urgent:               project.is_urgent === true || project.is_urgent === 1 || false,
      });

      setCalculatedValues({
        amountInUsd: project.amount_in_usd || project.amountInUsd || 0,
        netAmount:   project.net_amount_usd || project.net_amount  || 0,
      });

      // ── note images ──────────────────────────────────────────────────────
      const noteImagesFromApi = project.note_images || project.noteImages || [];
      if (Array.isArray(noteImagesFromApi) && noteImagesFromApi.length > 0) {
        setExistingNoteImages(noteImagesFromApi);
        const firstPath = noteImagesFromApi[0]?.image_url || noteImagesFromApi[0]?.image_path;
        setExistingNotesImageUrl(toAbsoluteUrl(firstPath));
      } else {
        const legacyUrl =
          project.notes_image_url ||
          project.notes_image ||
          (project.id ? `${apiClient.defaults.baseURL || ''}/project-note-image/${project.id}` : null);
        setExistingNotesImageUrl(legacyUrl || null);
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      if (import.meta.env.DEV && !error.isConnectionError)
        console.error('Error fetching project details:', error);
      if (!error.isConnectionError)
        toast.error(error.userMessage || error.message || 'فشل تحميل بيانات المشروع');
      navigate('/project-management/projects');
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = useCallback((e) => {
    const { name, value, files, type, checked } = e.target;

    if (name === 'notes_image' && files?.length > 0) {
      const validFiles = [];
      Array.from(files).forEach((file) => {
        const ext  = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        const mime = (file.type === 'image/jpg' ? 'image/jpeg' : file.type).toLowerCase();
        const isValidType = mime.startsWith('image/') && ALLOWED_IMAGE_TYPES.includes(mime);
        const isValidExt  = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
        if (!isValidType && !isValidExt) {
          setErrors((prev) => ({ ...prev, notes_image: 'يجب اختيار ملف صورة بصيغة: jpeg, jpg, png, gif, webp' }));
          return;
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          setErrors((prev) => ({ ...prev, notes_image: 'حجم كل صورة يجب أن يكون أقل من 5MB' }));
          return;
        }
        validFiles.push(file);
      });
      if (validFiles.length === 0) return;

      const withPreviews = validFiles.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
      setNewNoteImages(withPreviews);
      setFormData((prev) => ({ ...prev, notes_image: validFiles[0] }));
      setNotesImagePreview(withPreviews[0].previewUrl);
      setErrors((prev) => ({ ...prev, notes_image: null }));
      return;
    }

    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  }, [errors]);

  // حذف صورة legacy مفردة
  const handleRemoveImage = useCallback(() => {
    newNoteImages.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
    setNewNoteImages([]);
    setFormData((prev) => ({ ...prev, notes_image: null }));
    setNotesImagePreview(null);
    setExistingNotesImageUrl(null);
    const input = document.querySelector('input[name="notes_image"]');
    if (input) input.value = '';
  }, [newNoteImages]);

  // تبديل حالة حذف صورة موجودة
  const toggleDeleteExistingNoteImage = useCallback((imageId) => {
    setNoteImagesToDelete((prev) =>
      prev.includes(imageId) ? prev.filter((i) => i !== imageId) : [...prev, imageId]
    );
  }, []);

  // إزالة صورة جديدة بالـ index
  const removeNewNoteImage = useCallback((indexToRemove) => {
    setNewNoteImages((prev) => {
      if (prev[indexToRemove]?.previewUrl) {
        URL.revokeObjectURL(prev[indexToRemove].previewUrl);
      }
      const remaining = prev.filter((_, i) => i !== indexToRemove);
      if (remaining.length > 0) {
        const { file, previewUrl } = remaining[0];
        setFormData((f) => ({ ...f, notes_image: file }));
        setNotesImagePreview(previewUrl);
        setExistingNotesImageUrl(null);
      } else {
        setFormData((f) => ({ ...f, notes_image: null }));
        setNotesImagePreview(null);
      }
      return remaining;
    });
  }, []);

  // ── Validation ───────────────────────────────────────────────────────────
  const validateForm = () => {
    const errs = {};

    if (!formData.donor_name.trim())
      errs.donor_name = 'اسم الجهة المتبرعة مطلوب';
    if (!formData.project_type)
      errs.project_type = 'نوع المشروع مطلوب';
    if (!formData.donation_amount || parseFloat(formData.donation_amount) <= 0)
      errs.donation_amount = 'مبلغ التبرع يجب أن يكون أكبر من صفر';
    if (!formData.currency_id)
      errs.currency_id = 'العملة مطلوبة';

    const disc = formData.discount_percentage;
    if (disc === '' || disc === null || disc === undefined)
      errs.discount_percentage = 'نسبة الخصم الإداري مطلوبة';
    else if (parseFloat(disc) < 0 || parseFloat(disc) > 100)
      errs.discount_percentage = 'نسبة الخصم يجب أن تكون بين 0 و 100';

    if (!formData.estimated_duration_days || parseInt(formData.estimated_duration_days, 10) <= 0)
      errs.estimated_duration_days = 'المدة التقديرية يجب أن تكون أكبر من صفر';

    if (formData.is_divided_into_phases) {
      if (!formData.phase_type)
        errs.phase_type = 'يجب اختيار نوع التقسيم';
      if (!formData.phase_start_date)
        errs.phase_start_date = 'تاريخ بداية المراحل مطلوب';
      if (formData.phase_type === 'daily' &&
          (!formData.phase_duration_days || parseInt(formData.phase_duration_days, 10) <= 0))
        errs.phase_duration_days = 'عدد أيام التقسيم يجب أن يكون أكبر من صفر';
      if (formData.phase_type === 'monthly' &&
          (!formData.total_months || parseInt(formData.total_months, 10) <= 0))
        errs.total_months = 'عدد الشهور يجب أن يكون أكبر من صفر';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) { toast.error('الرجاء تصحيح الأخطاء في النموذج'); return; }

    setLoading(true);
    try {
      const donationAmount      = parseFloat(formData.donation_amount);
      const currencyId          = parseInt(formData.currency_id, 10);
      const discountPercentage  = parseFloat(formData.discount_percentage);
      const estimatedDays       = parseInt(formData.estimated_duration_days, 10);
      const isDividedIntoPhases = formData.is_divided_into_phases ? 1 : 0;
      const phaseTypeValue      = formData.is_divided_into_phases ? formData.phase_type : null;
      const phaseDurationValue  =
        formData.phase_type === 'daily' && formData.is_divided_into_phases
          ? parseInt(formData.phase_duration_days) : null;
      const totalMonthsValue    =
        formData.phase_type === 'monthly' && formData.is_divided_into_phases
          ? parseInt(formData.total_months) : null;
      const phaseStartDateValue = formData.is_divided_into_phases ? formData.phase_start_date : null;

      const hasNewImages = Array.isArray(newNoteImages) && newNoteImages.length > 0;
      const hasDeletions = Array.isArray(noteImagesToDelete) && noteImagesToDelete.length > 0;

      let response;

      if (hasNewImages || hasDeletions) {
        // ── multipart/form-data + method spoofing ────────────────────────
        const fd = new FormData();
        fd.append('_method',               'PATCH');
        fd.append('donor_code',            formData.donor_code?.trim()    || '');
        fd.append('project_name',          formData.project_name?.trim()  || '');
        fd.append('project_description',   formData.description?.trim()   || '');
        fd.append('donor_name',            formData.donor_name.trim());

        if (formData.project_type && projectTypesMap[formData.project_type]) {
          fd.append('project_type_id', projectTypesMap[formData.project_type]);
        } else if (formData.project_type) {
          fd.append('project_type', formData.project_type);
        }

        if (formData.subcategory_id)
          fd.append('subcategory_id', parseInt(formData.subcategory_id, 10));

        fd.append('donation_amount',          donationAmount);
        fd.append('currency_id',              currencyId);
        fd.append('admin_discount_percentage',discountPercentage);
        fd.append('estimated_duration_days',  estimatedDays);
        fd.append('is_divided_into_phases',   isDividedIntoPhases);
        fd.append('phase_type',               phaseTypeValue  || '');
        fd.append('phase_duration_days',      phaseDurationValue ?? '');
        fd.append('total_months',             totalMonthsValue   ?? '');
        fd.append('phase_start_date',         phaseStartDateValue ?? '');
        fd.append('is_urgent',                formData.is_urgent ? '1' : '0');
        if (formData.notes) fd.append('notes', formData.notes.trim());

        // حالة: حذف كل الصور الموجودة بدون إضافة جديدة
        const hasExisting          = Array.isArray(existingNoteImages) && existingNoteImages.length > 0;
        const allMarkedForDelete   =
          hasExisting && hasDeletions &&
          noteImagesToDelete.length === existingNoteImages.length && !hasNewImages;

        if (allMarkedForDelete) {
          fd.append('notes_image', '');
        } else {
          if (hasNewImages) {
            newNoteImages.forEach((obj) => {
              const file = obj.file || obj;
              if (file instanceof File) fd.append('notes_images[]', file, file.name);
            });
          }
          if (hasDeletions) {
            noteImagesToDelete.forEach((imgId, idx) => {
              fd.append(`note_images_to_delete[${idx}]`, imgId);
            });
          }
        }

        response = await apiClient.post(`/project-proposals/${id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        });
      } else {
        // ── JSON PATCH ───────────────────────────────────────────────────
        const payload = {
          donor_code:               formData.donor_code?.trim()   || null,
          project_name:             formData.project_name?.trim() || null,
          project_description:      formData.description?.trim()  || '',
          donor_name:               formData.donor_name.trim(),
          project_type_id:
            formData.project_type && projectTypesMap[formData.project_type]
              ? projectTypesMap[formData.project_type] : null,
          ...(formData.project_type && !projectTypesMap[formData.project_type]
            ? { project_type: formData.project_type } : {}),
          subcategory_id:           formData.subcategory_id ? parseInt(formData.subcategory_id, 10) : null,
          donation_amount:          donationAmount,
          currency_id:              currencyId,
          admin_discount_percentage:discountPercentage,
          estimated_duration_days:  estimatedDays,
          notes:                    formData.notes || null,
          is_divided_into_phases:   isDividedIntoPhases,
          phase_type:               phaseTypeValue,
          phase_duration_days:      phaseDurationValue,
          total_months:             totalMonthsValue,
          phase_start_date:         phaseStartDateValue,
          is_urgent:                formData.is_urgent ? 1 : 0,
        };
        response = await apiClient.patch(`/project-proposals/${id}`, payload);
      }

      if (response.data.success) {
        toast.success('تم تحديث المشروع بنجاح');
        localStorage.setItem(`project_${id}_updated`, 'true');
        invalidateProjectsCache();
        navigate(`/project-management/projects/${id}`);
      } else {
        toast.error(response.data.message || 'فشل تحديث المشروع');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      if (error.response?.status === 403 || error.isPermissionError) {
        toast.error(error.response?.data?.message || error.userMessage || 'ليس لديك صلاحيات لتعديل هذا المشروع.');
        navigate('/project-management/projects');
        return;
      }
      toast.error(error.userMessage || 'حدث خطأ أثناء تحديث المشروع');
      if (error.response?.data?.errors) setErrors(error.response.data.errors);
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    }).format(amount);

  // ── Auth guard ───────────────────────────────────────────────────────────
  const userRole =
    user?.role?.toLowerCase?.()      ||
    user?.userRole?.toLowerCase?.()  ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role || '';

  const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

  if (!user || (userRole && !isAdmin)) {
    return <Unauthorized requiredRole="admin" pageName="تعديل المشروع" />;
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  const inputCls = (key) =>
    `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors[key] ? 'border-red-500' : 'border-gray-300'}`;

  const inputClsPurple = (key) =>
    `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors[key] ? 'border-red-500' : 'border-gray-300'}`;

  const FieldError = ({ name }) =>
    errors[name] ? <p className="text-red-500 text-sm mt-1">{errors[name]}</p> : null;

  const displayedProjectTypes = projectTypes.length > 0
    ? projectTypes
    : DEFAULT_PROJECT_TYPES.map((name, i) => ({ id: i + 1, name }));

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6 pt-4">
          <button
            onClick={() => navigate(`/project-management/projects/${id}`)}
            className="flex items-center text-sky-600 hover:text-sky-700 font-medium mb-4"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            العودة إلى التفاصيل
          </button>
          <h1 className="text-3xl font-bold text-gray-800">تعديل المشروع</h1>
          <p className="text-gray-600 mt-2">قم بتحديث بيانات المشروع الحالية</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Basic Information ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600" />
              المعلومات الأساسية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Donor code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag className="w-4 h-4 inline ml-1" />
                  كود المتبرع (اختياري)
                </label>
                <input
                  type="text" name="donor_code" value={formData.donor_code}
                  onChange={handleChange} placeholder="مثال: DON-2024-001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Donor name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline ml-1" />
                  اسم الجهة المتبرعة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" name="donor_name" value={formData.donor_name}
                  onChange={handleChange} placeholder="اسم المتبرع أو الجهة"
                  className={inputCls('donor_name')}
                />
                <FieldError name="donor_name" />
              </div>

              {/* Project name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Package className="w-4 h-4 inline ml-1" />
                  اسم المشروع (اختياري)
                </label>
                <input
                  type="text" name="project_name" value={formData.project_name}
                  onChange={handleChange} placeholder="مثال: حملة سقيا الماء - شمال غزة"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  يمكنك تركه فارغاً ليتم توليده تلقائياً أو تعديله هنا قبل الحفظ.
                </p>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline ml-1" />
                  وصف المشروع (اختياري)
                </label>
                <textarea
                  name="description" value={formData.description}
                  onChange={handleChange} placeholder="وصف تفصيلي للمشروع..." rows="4"
                  className={inputCls('description')}
                />
                <FieldError name="description" />
              </div>

              {/* Project type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag className="w-4 h-4 inline ml-1" />
                  نوع المشروع <span className="text-red-500">*</span>
                </label>
                <select
                  name="project_type" value={formData.project_type}
                  onChange={handleChange} className={inputCls('project_type')}
                >
                  <option value="">اختر النوع</option>
                  {projectTypesLoading
                    ? <option disabled>جاري تحميل الأنواع...</option>
                    : displayedProjectTypes.map((t) => {
                        const name = typeof t === 'string' ? t : (t.name || t);
                        return <option key={name} value={name}>{name}</option>;
                      })
                  }
                </select>
                <FieldError name="project_type" />
              </div>

              {/* Subcategory */}
              {formData.project_type && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag className="w-4 h-4 inline ml-1" />
                    التفرعية (اختياري)
                  </label>
                  <select
                    name="subcategory_id" value={formData.subcategory_id}
                    onChange={handleChange} disabled={subcategoriesLoading}
                    className={`${inputCls('subcategory_id')} ${subcategoriesLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="">اختر التفرعية</option>
                    {subcategories.map((s) => (
                      <option key={s.id} value={s.id}>{s.name_ar || s.name}</option>
                    ))}
                  </select>
                  {subcategoriesLoading && (
                    <p className="text-gray-500 text-sm mt-1">جاري تحميل التفريعات...</p>
                  )}
                  <FieldError name="subcategory_id" />
                </div>
              )}

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline ml-1" />
                  المدة التقديرية للتنفيذ (أيام) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" name="estimated_duration_days"
                  value={formData.estimated_duration_days}
                  onChange={handleChange} min="1"
                  className={inputCls('estimated_duration_days')}
                />
                <FieldError name="estimated_duration_days" />
              </div>

              {/* Urgent */}
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox" name="is_urgent" id="is_urgent"
                  checked={formData.is_urgent} onChange={handleChange}
                  className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <label htmlFor="is_urgent" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  عاجل
                </label>
              </div>
            </div>
          </div>

          {/* ── Financial Information ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-purple-600" />
              المعلومات المالية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline ml-1" />
                  مبلغ التبرع <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" name="donation_amount" value={formData.donation_amount}
                  onChange={handleChange} placeholder="مثال: 10000" step="0.01"
                  className={inputCls('donation_amount')}
                />
                <FieldError name="donation_amount" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline ml-1" />
                  العملة <span className="text-red-500">*</span>
                </label>
                <select
                  name="currency_id" value={formData.currency_id}
                  onChange={handleChange} className={inputCls('currency_id')}
                >
                  <option value="">اختر العملة</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.currency_name_ar || c.currency_name || c.name_ar || c.name}
                      {' '}({c.currency_code || c.code})
                    </option>
                  ))}
                </select>
                <FieldError name="currency_id" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calculator className="w-4 h-4 inline ml-1" />
                  نسبة الخصم الإداري (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" name="discount_percentage" value={formData.discount_percentage}
                  onChange={handleChange} min="0" max="100" step="0.01"
                  className={inputCls('discount_percentage')}
                />
                <FieldError name="discount_percentage" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-4 border-2 border-sky-200">
                <p className="text-sm text-sky-600 mb-1">المبلغ بالدولار</p>
                <p className="text-2xl font-bold text-sky-700">
                  {formatCurrency(calculatedValues.amountInUsd || 0)}
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
                <p className="text-sm text-green-600 mb-1">المبلغ الصافي بعد الخصم</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(calculatedValues.netAmount || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* ── Phase Division ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              تقسيم المشروع على مراحل
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox" name="is_divided_into_phases" id="is_divided_into_phases"
                  checked={formData.is_divided_into_phases}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData((prev) => ({
                      ...prev,
                      is_divided_into_phases: isChecked,
                      phase_type:          isChecked ? prev.phase_type          : null,
                      phase_duration_days: isChecked ? prev.phase_duration_days : '',
                      total_months:        isChecked ? prev.total_months        : '',
                      phase_start_date:    isChecked ? prev.phase_start_date    : '',
                    }));
                  }}
                  className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                />
                <label htmlFor="is_divided_into_phases" className="text-sm font-medium text-gray-700">
                  تقسيم المشروع على مراحل
                </label>
              </div>

              {formData.is_divided_into_phases && (
                <div className="grid grid-cols-1 gap-6 bg-purple-50 rounded-xl p-4 border-2 border-purple-200">

                  {/* Phase type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      نوع التقسيم <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="phase_type" value={formData.phase_type || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          phase_type:          val || null,
                          phase_duration_days: val === 'daily'   ? prev.phase_duration_days : '',
                          total_months:        val === 'monthly' ? prev.total_months        : '',
                        }));
                      }}
                      className={inputClsPurple('phase_type')}
                    >
                      <option value="">اختر نوع التقسيم</option>
                      <option value="daily">يومي</option>
                      <option value="monthly">شهري</option>
                    </select>
                    <FieldError name="phase_type" />
                  </div>

                  {/* Daily */}
                  {formData.phase_type === 'daily' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="w-4 h-4 inline ml-1" />
                        عدد أيام التقسيم <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number" name="phase_duration_days"
                        value={formData.phase_duration_days}
                        onChange={handleChange} min="1" placeholder="مثال: 30"
                        className={inputClsPurple('phase_duration_days')}
                      />
                      <FieldError name="phase_duration_days" />
                    </div>
                  )}

                  {/* Monthly */}
                  {formData.phase_type === 'monthly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline ml-1" />
                        عدد الشهور <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number" name="total_months" value={formData.total_months}
                        onChange={handleChange} min="1" placeholder="مثال: 12"
                        className={inputClsPurple('total_months')}
                      />
                      <FieldError name="total_months" />
                    </div>
                  )}

                  {/* Start date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline ml-1" />
                      تاريخ بداية المراحل <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date" name="phase_start_date" value={formData.phase_start_date}
                      onChange={handleChange}
                      className={inputClsPurple('phase_start_date')}
                    />
                    <FieldError name="phase_start_date" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Notes & Images ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              الملاحظات والصور
            </h2>
            <div className="space-y-4">

              {/* Notes textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الملاحظات</label>
                <textarea
                  name="notes" value={formData.notes} onChange={handleChange}
                  placeholder="ملاحظات أو تعليمات إضافية..." rows="4"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Notes images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ImageIcon className="w-4 h-4 inline ml-1" />
                  صور الملاحظات (يمكن اختيار عدة صور)
                </label>
                <div className="space-y-4">

                  {/* File input */}
                  <div className="relative">
                    <input
                      type="file" name="notes_image" accept="image/*" multiple
                      onChange={handleChange} className="hidden" id="notes_image_input_edit"
                    />
                    <label
                      htmlFor="notes_image_input_edit"
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl transition-all duration-300 cursor-pointer hover:border-sky-400 hover:bg-sky-50"
                    >
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-600 font-medium">
                        {(newNoteImages.length > 0 || existingNoteImages.length > 0 || existingNotesImageUrl)
                          ? 'إضافة / تغيير صور الملاحظات'
                          : 'اختر صوراً للملاحظات'}
                      </span>
                    </label>
                  </div>
                  {errors.notes_image && (
                    <p className="text-sm text-red-600">{errors.notes_image}</p>
                  )}

                  {/* Existing images (from API) */}
                  {existingNoteImages.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">الصور الحالية (يمكن تحديد صور للحذف):</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {existingNoteImages.map((img) => {
                          const path = img.image_url || img.image_path;
                          if (!path) return null;
                          const isMarkedForDelete = noteImagesToDelete.includes(img.id);
                          const finalUrl = toAbsoluteUrl(path);
                          return (
                            <div
                              key={img.id}
                              className={`relative rounded-xl border-2 overflow-hidden ${isMarkedForDelete ? 'border-red-400 opacity-60' : 'border-gray-200'}`}
                            >
                              <img src={finalUrl} alt={`صورة ملاحظة #${img.id}`} className="w-full h-28 object-cover" />
                              <button
                                type="button"
                                onClick={() => toggleDeleteExistingNoteImage(img.id)}
                                className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${isMarkedForDelete ? 'bg-red-600 text-white' : 'bg-white/80 text-gray-700 hover:bg-red-50'}`}
                              >
                                <XIcon className="w-3 h-3" />
                                {isMarkedForDelete ? 'إلغاء الحذف' : 'حذف'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Legacy single image fallback */}
                  {existingNotesImageUrl && existingNoteImages.length === 0 && !notesImagePreview && (
                    <div className="relative bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                      <button
                        type="button" onClick={handleRemoveImage}
                        className="absolute top-2 left-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10"
                        title="إزالة الصورة"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                      <img
                        src={existingNotesImageUrl} alt="صورة الملاحظات الحالية"
                        className="w-full h-auto rounded-lg max-h-64 object-contain"
                        onError={(e) => {
                          e.target.src = `${apiClient.defaults.baseURL || ''}/project-note-image/${id}`;
                        }}
                      />
                    </div>
                  )}

                  {/* New images previews */}
                  {newNoteImages.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">
                        الصور الجديدة (لن تُحفظ إلا بعد الضغط على زر "تحديث المشروع"):
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {newNoteImages.map((obj, index) => (
                          <div
                            key={`${obj.file?.name || index}-${index}`}
                            className="relative rounded-xl border-2 border-sky-200 overflow-hidden bg-gray-50"
                          >
                            <img src={obj.previewUrl} alt={obj.file?.name} className="w-full h-28 object-cover" />
                            <button
                              type="button" onClick={() => removeNewNoteImage(index)}
                              className="absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 bg-red-600 text-white hover:bg-red-700"
                            >
                              <XIcon className="w-3 h-3" />
                              إزالة
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(`/project-management/projects/${id}`)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              إلغاء
            </button>
            <button
              type="submit" disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'جاري الحفظ...' : 'تحديث المشروع'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default EditProject;