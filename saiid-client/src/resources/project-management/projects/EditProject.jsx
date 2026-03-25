import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { useCacheInvalidation } from '../../../hooks/useCacheInvalidation';
import { toast } from 'react-toastify';
import { Save, ArrowRight, DollarSign, Calculator, Image as ImageIcon, X as XIcon, Calendar, Clock, FileText, Tag, Package, User, AlertCircle } from 'lucide-react';
import Unauthorized from '../components/Unauthorized';

// Image preview component to avoid hooks inside map
const NoteImagePreview = ({ file, index, onRemove }) => {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }, [file]);

  return (
    <div
      key={`${file.name}-${index}`}
      className="relative rounded-xl border-2 border-sky-200 overflow-hidden bg-gray-50"
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={file.name}
          className="w-full h-28 object-cover"
        />
      ) : (
        <div className="flex items-center justify-center h-28 text-xs text-gray-500">
          جاري التحميل...
        </div>
      )}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 bg-red-600 text-white hover:bg-red-700"
      >
        <XIcon className="w-3 h-3" />
        إزالة
      </button>
    </div>
  );
};

const EditProject = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  // الأنواع الافتراضية كـ fallback
  const DEFAULT_PROJECT_TYPES = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];

  const [currencies, setCurrencies] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [projectTypes, setProjectTypes] = useState([]); // ✅ قائمة أنواع المشاريع مع ID
  const [projectTypesLoading, setProjectTypesLoading] = useState(false);
  const [projectTypesMap, setProjectTypesMap] = useState({}); // ✅ mapping بين الاسم والـ ID
  const [calculatedValues, setCalculatedValues] = useState({
    amountInUsd: 0,
    netAmount: 0,
  });

  const [formData, setFormData] = useState({
    donor_code: '',
    project_name: '',
    description: '',
    donor_name: '',
    project_type: '',
    subcategory_id: '',
    donation_amount: '',
    currency_id: '',
    discount_percentage: 0,
    estimated_duration_days: '',
    notes: '',
    notes_image: null,
    is_divided_into_phases: false,
    phase_type: null, // ✅ 'daily' أو 'monthly' أو null
    phase_duration_days: '', // ✅ للمشاريع اليومية فقط
    total_months: '', // ✅ للمشاريع الشهرية فقط
    phase_start_date: '',
    is_urgent: false,
  });

  const [errors, setErrors] = useState({});
  const [notesImagePreview, setNotesImagePreview] = useState(null);
  const [existingNotesImageUrl, setExistingNotesImageUrl] = useState(null);
  const [existingNoteImages, setExistingNoteImages] = useState([]); // note_images من الـ API
  const [newNoteImages, setNewNoteImages] = useState([]); // ملفات جديدة لصور الملاحظات
  const [noteImagesToDelete, setNoteImagesToDelete] = useState([]); // IDs المراد حذفها

  const { invalidateProjectsCache } = useCacheInvalidation();

  useEffect(() => {
    fetchCurrencies();
    fetchProjectTypes();
  }, []);

  const fetchProjectTypes = async () => {
    setProjectTypesLoading(true);
    try {
      const response = await apiClient.get('/project-types', {
        params: {
          _t: Date.now(),
        },
        timeout: 10000,
        headers: {
          'Cache-Control': 'no-cache',
        }
      });

      if (response.data.success) {
        const data = response.data.data || response.data.types || [];
        if (data.length > 0) {
          // حفظ البيانات الكاملة (مع ID)
          setProjectTypes(data);
          // إنشاء mapping بين الاسم والـ ID
          const map = {};
          data.forEach(type => {
            const name = typeof type === 'string' ? type : (type.name || type);
            const id = typeof type === 'object' ? type.id : null;
            if (name && id) {
              map[name] = id;
            }
          });
          setProjectTypesMap(map);
          console.log('✅ Loaded project types from API:', data);
          console.log('✅ Project types map:', map);
        } else {
          // إذا كانت القائمة فارغة، استخدم الافتراضية
          setProjectTypes(DEFAULT_PROJECT_TYPES.map((name, index) => ({ id: index + 1, name })));
          const defaultMap = {};
          DEFAULT_PROJECT_TYPES.forEach((name, index) => {
            defaultMap[name] = index + 1;
          });
          setProjectTypesMap(defaultMap);
          console.warn('⚠️ No project types from API, using defaults');
        }
      } else {
        setProjectTypes(DEFAULT_PROJECT_TYPES.map((name, index) => ({ id: index + 1, name })));
        const defaultMap = {};
        DEFAULT_PROJECT_TYPES.forEach((name, index) => {
          defaultMap[name] = index + 1;
        });
        setProjectTypesMap(defaultMap);
        console.warn('⚠️ API response not successful, using defaults');
      }
    } catch (error) {
      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('Error fetching project types:', error);
        console.error('Response:', error.response?.data);
      }
      // Fallback: استخدام الأنواع الافتراضية فقط إذا كان API غير موجود (404)
      if (error.response?.status === 404) {
        console.warn('⚠️ Project types API not found (404), using defaults');
      }
      setProjectTypes(DEFAULT_PROJECT_TYPES.map((name, index) => ({ id: index + 1, name })));
      const defaultMap = {};
      DEFAULT_PROJECT_TYPES.forEach((name, index) => {
        defaultMap[name] = index + 1;
      });
      setProjectTypesMap(defaultMap);
    } finally {
      setProjectTypesLoading(false);
    }
  };

  useEffect(() => {
    if (currencies.length > 0) {
      fetchProjectDetails();
    }
  }, [currencies, id]);

  useEffect(() => {
    calculateValues();
  }, [formData.donation_amount, formData.currency_id, formData.discount_percentage]);

  // جلب التفريعات عند تغيير نوع المشروع
  useEffect(() => {
    const fetchSubcategories = async () => {
      if (!formData.project_type) {
        setSubcategories([]);
        setFormData(prev => ({ ...prev, subcategory_id: '' }));
        return;
      }

      // ✅ Extract the actual value from project_type (handle both object and string/number)
      let projectTypeValue = formData.project_type;
      if (typeof projectTypeValue === 'object' && projectTypeValue !== null) {
        // If it's an object, extract id or name
        projectTypeValue = projectTypeValue.id || projectTypeValue.name || projectTypeValue.name_ar || projectTypeValue.name_en;
      }
      
      // ✅ Ensure we have a valid value
      if (!projectTypeValue) {
        setSubcategories([]);
        return;
      }

      // حفظ subcategory_id الحالي للتحقق منه بعد جلب البيانات
      const currentSubcategoryId = formData.subcategory_id;

      setSubcategoriesLoading(true);
      try {
        const response = await apiClient.get(`/project-subcategories/by-type/${projectTypeValue}`, {
          params: {
            _t: Date.now(),
          },
          timeout: 20000,
          headers: {
            'Cache-Control': 'no-cache',
          }
        });

        if (response.data.success) {
          const subcategoriesData = response.data.data || [];
          setSubcategories(subcategoriesData);

          // ✅ إذا كان هناك subcategory_id محفوظ، تأكد من أنه موجود في القائمة
          if (currentSubcategoryId) {
            const currentSubcategory = subcategoriesData.find(
              s => s.id === parseInt(currentSubcategoryId) || String(s.id) === String(currentSubcategoryId)
            );
            if (!currentSubcategory) {
              // إذا لم تكن التفرعية موجودة في القائمة، أزل subcategory_id
              setFormData(prev => ({ ...prev, subcategory_id: '' }));
              if (import.meta.env.DEV) {
                console.warn('⚠️ Subcategory not found in list, clearing subcategory_id');
              }
            } else {
              // ✅ تأكد من أن subcategory_id محفوظ بشكل صحيح
              if (import.meta.env.DEV) {
                console.log('✅ Subcategory found in list:', currentSubcategory);
              }
            }
          }
        }
      } catch (error) {
        if (import.meta.env.DEV && !error.isConnectionError) {
          console.error('Error fetching subcategories:', error);
        }
        setSubcategories([]);
        // إعادة تعيين subcategory_id في حالة الخطأ
        if (formData.subcategory_id) {
          setFormData(prev => ({ ...prev, subcategory_id: '' }));
        }
      } finally {
        setSubcategoriesLoading(false);
      }
    };

    fetchSubcategories();
  }, [formData.project_type]);

  const fetchCurrencies = async () => {
    try {
      // ✅ إضافة cache busting parameter لإجبار الـ Backend على جلب البيانات المحدثة
      const response = await apiClient.get('/currencies', {
        params: {
          per_page: 1000,
          include_inactive: false,
          _t: Date.now(), // ✅ cache busting - إجبار الـ Backend على جلب البيانات المحدثة
        },
        timeout: 20000, // timeout 20 ثانية
        headers: {
          'Cache-Control': 'no-cache', // ✅ منع cache في الـ request
        }
      });
      if (response.data.success) {
        const currenciesData = response.data.currencies || response.data.data || [];
        setCurrencies(currenciesData.filter((c) => c.is_active));
      }
    } catch (error) {
      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('Error fetching currencies:', error);
      }
      if (!error.isConnectionError) {
        toast.error('فشل تحميل العملات');
      }
    }
  };

  const fetchProjectDetails = async () => {
    let loadingTimeout;

    try {
      // setInitialLoading(true);

      // إيقاف حالة التحميل بعد timeout
      loadingTimeout = setTimeout(() => {
        setInitialLoading(false);
      }, 5000); // timeout 5 ثواني

      const response = await apiClient.get(`/project-proposals/${id}`, {
        params: {
          _t: Date.now(), // ✅ cache busting
        },
        timeout: 20000, // timeout 20 ثانية
        headers: {
          'Cache-Control': 'no-cache',
        }
      });

      if (loadingTimeout) clearTimeout(loadingTimeout);

      if (response.data.success !== false) {
        const project =
          response.data.project ||
          response.data.data ||
          response.data.result ||
          response.data;

        if (!project || Object.keys(project).length === 0) {
          throw new Error('لم يتم العثور على بيانات للمشروع');
        }

        // تنسيق phase_start_date إذا كان موجوداً
        let formattedPhaseStartDate = '';
        if (project.phase_start_date) {
          try {
            const date = new Date(project.phase_start_date);
            formattedPhaseStartDate = date.toISOString().split('T')[0];
          } catch {
            formattedPhaseStartDate = project.phase_start_date;
          }
        }

        // ✅ استخراج subcategory_id من عدة أماكن محتملة
        const subcategoryId = project.subcategory_id
          || project.subcategory?.id
          || (project.subcategory && typeof project.subcategory === 'object' ? project.subcategory.id : null);

        if (import.meta.env.DEV) {
          console.log('📋 Project subcategory data:', {
            subcategory_id: project.subcategory_id,
            subcategory: project.subcategory,
            extracted: subcategoryId
          });
        }

        // ✅ تحديد نوع التقسيم (من التوثيق)
        const isDivided = project.is_divided_into_phases === true;
        const divisionInfo = project.division_info;
        const phaseType = project.phase_type;
        
        // ✅ استخدام division_info إذا كان متاحاً (أكثر موثوقية)
        const isDaily = divisionInfo?.is_daily || phaseType === 'daily';
        const isMonthly = divisionInfo?.is_monthly || phaseType === 'monthly';
        
        // ✅ تحديد phase_type إذا لم يكن محدداً
        let determinedPhaseType = phaseType;
        if (!determinedPhaseType && isDivided) {
          if (isDaily) {
            determinedPhaseType = 'daily';
          } else if (isMonthly) {
            determinedPhaseType = 'monthly';
          } else if (project.phase_duration_days && !project.total_months) {
            determinedPhaseType = 'daily';
          } else if (project.total_months && !project.phase_duration_days) {
            determinedPhaseType = 'monthly';
          }
        }

        // ✅ Extract project_type value (handle both object and string)
        let projectTypeValue = project.project_type || '';
        if (typeof projectTypeValue === 'object' && projectTypeValue !== null) {
          // If it's an object, extract name (prefer name_ar, then name, then name_en)
          projectTypeValue = projectTypeValue.name_ar || projectTypeValue.name || projectTypeValue.name_en || '';
        }

        setFormData({
          donor_code: project.donor_code || '',
          project_name: project.project_name || '',
          description: project.project_description || project.description || '',
          donor_name: project.donor_name || '',
          project_type: projectTypeValue,
          subcategory_id: subcategoryId ? String(subcategoryId) : '',
          donation_amount: project.donation_amount ? String(project.donation_amount) : '',
          currency_id: project.currency_id
            ? String(project.currency_id)
            : project.currency?.id
              ? String(project.currency.id)
              : '',
          discount_percentage:
            project.admin_discount_percentage ?? project.discount_percentage ?? 0,
          estimated_duration_days:
            project.estimated_duration_days ||
            project.estimated_duration ||
            project.execution_duration_days ||
            '',
          notes: project.notes || '',
          notes_image: null,
          is_divided_into_phases: isDivided,
          phase_type: determinedPhaseType || null,
          phase_duration_days: project.phase_duration_days ? String(project.phase_duration_days) : '',
          total_months: project.total_months ? String(project.total_months) : '',
          phase_start_date: formattedPhaseStartDate,
          is_urgent: project.is_urgent === true || project.is_urgent === 1 || false,
        });

        // 🔍 Debug: عرض معلومات التقسيم
        if (import.meta.env.DEV && isDivided) {
          console.log('📊 Project Division Info:', {
            isDivided,
            phaseType,
            determinedPhaseType,
            divisionInfo,
            phase_duration_days: project.phase_duration_days,
            total_months: project.total_months,
            isDaily,
            isMonthly,
          });
        }

        setCalculatedValues({
          amountInUsd: project.amount_in_usd || project.amountInUsd || 0,
          netAmount: project.net_amount_usd || project.net_amount || 0,
        });

        // ✅ تحميل صور الملاحظات المتعددة (note_images) إن وُجدت
        const noteImagesFromApi = project.note_images || project.noteImages || [];
        if (Array.isArray(noteImagesFromApi) && noteImagesFromApi.length > 0) {
          setExistingNoteImages(noteImagesFromApi);
          // لأغراض التوافقية، نستخدم أول صورة كصورة قديمة مفردة
          const first = noteImagesFromApi[0];
          const path = first.image_url || first.image_path;
          if (path) {
            if (path.startsWith('http://') || path.startsWith('https://')) {
              setExistingNotesImageUrl(path);
            } else {
              const origin = window.location.origin;
              const normalizedPath = path.startsWith('/') ? path : `/${path}`;
              setExistingNotesImageUrl(`${origin}${normalizedPath}`);
            }
          }
        } else {
          // عرض الصورة الموجودة إذا كانت متوفرة (من الحقل القديم)
          if (project.notes_image_url) {
            setExistingNotesImageUrl(project.notes_image_url);
          } else if (project.notes_image) {
            setExistingNotesImageUrl(project.notes_image);
          } else if (project.id) {
            const baseURL = apiClient.defaults.baseURL || '';
            setExistingNotesImageUrl(`${baseURL}/project-note-image/${project.id}`);
          } else {
            setExistingNotesImageUrl(null);
          }
        }
      } else {
        toast.error('تعذر تحميل بيانات المشروع');
        navigate('/project-management/projects');
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);

      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('Error fetching project details:', error);
      }

      if (!error.isConnectionError) {
        toast.error(error.userMessage || error.message || 'فشل تحميل بيانات المشروع');
      }
      navigate('/project-management/projects');
    } finally {
      setInitialLoading(false);
    }
  };

  const calculateValues = () => {
    if (!formData.donation_amount || !formData.currency_id) {
      setCalculatedValues({ amountInUsd: 0, netAmount: 0 });
      return;
    }

    const selectedCurrency = currencies.find(
      (c) => c.id === parseInt(formData.currency_id, 10)
    );

    if (selectedCurrency) {
      const amountInUsd =
        parseFloat(formData.donation_amount) * selectedCurrency.exchange_rate_to_usd;
      const discount = (amountInUsd * parseFloat(formData.discount_percentage || 0)) / 100;
      const netAmount = amountInUsd - discount;
      setCalculatedValues({ amountInUsd, netAmount });
    }
  };

  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;

    if (name === 'notes_image' && files && files.length > 0) {
      const selectedFiles = Array.from(files);

      // ✅ التحقق من نوع الملف - قائمة الصيغ المدعومة (jpeg, png, jpg, gif, webp)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];

      const validFiles = [];

      selectedFiles.forEach((file) => {
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        const fileType = file.type.toLowerCase();

        // ✅ Debug: عرض معلومات الملف
        if (import.meta.env.DEV) {
          console.log('📸 File info (EditProject - multiple):', {
            name: file.name,
            type: file.type,
            size: file.size,
            extension: fileExtension
          });
        }

        // ✅ التحقق من نوع MIME أو الامتداد
        const normalizedType = fileType === 'image/jpg' ? 'image/jpeg' : fileType;
        const isValidType = normalizedType.startsWith('image/') && allowedTypes.includes(normalizedType);
        const isValidExtension = allowedExtensions.includes(fileExtension);

        if (!isValidType && !isValidExtension) {
          setErrors(prev => ({ ...prev, notes_image: 'يجب اختيار ملف صورة بصيغة: jpeg, jpg, png, gif, webp' }));
          return;
        }

        // ✅ التحقق من حجم الملف (5MB)
        if (file.size > 5 * 1024 * 1024) {
          setErrors(prev => ({ ...prev, notes_image: 'حجم كل صورة يجب أن يكون أقل من 5MB' }));
          return;
        }

        validFiles.push(file);
      });

      if (validFiles.length === 0) {
        return;
      }

      // ✅ حفظ الملفات الجديدة (مع الاحتفاظ بالسابق)
      setNewNoteImages(prev => {
        const newFiles = [...prev, ...validFiles];
        // تحديث الصورة الرئيسية للتوافقية
        if (newFiles.length > 0) {
          const mainFile = newFiles[0];
          setFormData(f => ({ ...f, [name]: mainFile }));
          // عرض معاينة لأول صورة فقط
          const reader = new FileReader();
          reader.onloadend = () => {
            setNotesImagePreview(reader.result);
            setExistingNotesImageUrl(null); // إخفاء الصور القديمة
          };
          reader.readAsDataURL(mainFile);
        }
        return newFiles;
      });

      // مسح خطأ الصورة إذا كان موجوداً
      if (errors.notes_image) {
        setErrors({ ...errors, notes_image: null });
      }
    } else if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }

    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, notes_image: null });
    setNotesImagePreview(null);
    setExistingNotesImageUrl(null);
    setNewNoteImages([]);
    // إعادة تعيين input file
    const fileInput = document.querySelector('input[name="notes_image"]');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // ✅ الوصف اختياري - لا حاجة للتحقق منه
    // if (!formData.description.trim()) {
    //   newErrors.description = 'وصف المشروع مطلوب';
    // }
    if (!formData.donor_name.trim()) {
      newErrors.donor_name = 'اسم الجهة المتبرعة مطلوب';
    }
    if (!formData.project_type) {
      newErrors.project_type = 'نوع المشروع مطلوب';
    }
    if (!formData.donation_amount || parseFloat(formData.donation_amount) <= 0) {
      newErrors.donation_amount = 'مبلغ التبرع يجب أن يكون أكبر من صفر';
    }
    if (!formData.currency_id) {
      newErrors.currency_id = 'العملة مطلوبة';
    }
    if (
      formData.discount_percentage === '' ||
      formData.discount_percentage === null ||
      formData.discount_percentage === undefined
    ) {
      newErrors.discount_percentage = 'نسبة الخصم الإداري مطلوبة';
    } else if (
      parseFloat(formData.discount_percentage) < 0 ||
      parseFloat(formData.discount_percentage) > 100
    ) {
      newErrors.discount_percentage = 'نسبة الخصم يجب أن تكون بين 0 و 100';
    }
    if (!formData.estimated_duration_days || parseInt(formData.estimated_duration_days, 10) <= 0) {
      newErrors.estimated_duration_days = 'المدة التقديرية يجب أن تكون أكبر من صفر';
    }

    // التحقق من حقول التقسيم على مراحل
    // ✅ التحقق من صحة بيانات التقسيم (من التوثيق)
    if (formData.is_divided_into_phases) {
      if (!formData.phase_type) {
        newErrors.phase_type = 'يجب اختيار نوع التقسيم';
      }
      
      if (!formData.phase_start_date) {
        newErrors.phase_start_date = 'تاريخ بداية المراحل مطلوب';
      }
      
      // ✅ للمشاريع اليومية: التحقق من phase_duration_days
      if (formData.phase_type === 'daily') {
        if (!formData.phase_duration_days || parseInt(formData.phase_duration_days, 10) <= 0) {
          newErrors.phase_duration_days = 'عدد أيام التقسيم يجب أن يكون أكبر من صفر';
        }
      }
      
      // ✅ للمشاريع الشهرية: التحقق من total_months
      if (formData.phase_type === 'monthly') {
        if (!formData.total_months || parseInt(formData.total_months, 10) <= 0) {
          newErrors.total_months = 'عدد الشهور يجب أن يكون أكبر من صفر';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ تبديل حالة حذف صورة ملاحظة موجودة
  const toggleDeleteExistingNoteImage = (imageId) => {
    setNoteImagesToDelete((prev) => {
      if (prev.includes(imageId)) {
        return prev.filter((id) => id !== imageId);
      }
      return [...prev, imageId];
    });
  };

  // ✅ إزالة صورة جديدة من القائمة قبل الحفظ
  const removeNewNoteImage = (indexToRemove) => {
    setNewNoteImages((prev) => {
      const remaining = prev.filter((_, i) => i !== indexToRemove);
      if (remaining.length > 0) {
        const mainFile = remaining[0];
        setFormData(f => ({ ...f, notes_image: mainFile }));
        const reader = new FileReader();
        reader.onloadend = () => {
          setNotesImagePreview(reader.result);
          setExistingNotesImageUrl(null);
        };
        reader.readAsDataURL(mainFile);
      } else {
        setFormData(f => ({ ...f, notes_image: null }));
        setNotesImagePreview(null);
        // لا نعيد الصور القديمة هنا إلا إذا أردنا ذلك، حالياً نتركها مخفية
      }
      return remaining;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('الرجاء تصحيح الأخطاء في النموذج');
      return;
    }

    setLoading(true);
    try {
      const donationAmount = parseFloat(formData.donation_amount);
      const currencyId = parseInt(formData.currency_id, 10);
      const discountPercentage = parseFloat(formData.discount_percentage);
      const estimatedDays = parseInt(formData.estimated_duration_days, 10);

      // ✅ إعداد بيانات التقسيم (من التوثيق)
      const isDividedIntoPhases = formData.is_divided_into_phases ? 1 : 0;
      const phaseTypeValue = formData.is_divided_into_phases ? formData.phase_type : null;
      
      // ✅ للمشاريع اليومية فقط
      const phaseDurationValue = formData.phase_type === 'daily' && formData.is_divided_into_phases
        ? parseInt(formData.phase_duration_days)
        : null;
      
      // ✅ للمشاريع الشهرية فقط
      const totalMonthsValue = formData.phase_type === 'monthly' && formData.is_divided_into_phases
        ? parseInt(formData.total_months)
        : null;
      
      const phaseStartDateValue = formData.is_divided_into_phases
        ? formData.phase_start_date
        : null;

      let response;

      // ✅ Debug: التحقق من formData قبل الإرسال
      console.log('📤 Preparing to submit EditProject:', {
        hasNotesImage: !!formData.notes_image,
        notesImageType: formData.notes_image instanceof File ? 'File' : typeof formData.notes_image,
        notesImageName: formData.notes_image instanceof File ? formData.notes_image.name : 'N/A'
      });

      // ✅ التحقق من وجود صور جديدة أو صور مراد حذفها
      const hasNewImages = Array.isArray(newNoteImages) && newNoteImages.length > 0;
      const hasDeletions = Array.isArray(noteImagesToDelete) && noteImagesToDelete.length > 0;

      // إذا كانت هناك صور جديدة أو صور للحذف، نستخدم FormData مع method spoofing
      if (hasNewImages || hasDeletions) {
        const formDataToSend = new FormData();

        // ✅ إضافة method spoofing للـ PATCH
        formDataToSend.append('_method', 'PATCH');

        // ✅ إضافة جميع الحقول (مثل منطق الأيتام)
        formDataToSend.append('donor_code', formData.donor_code?.trim() || '');
        formDataToSend.append('project_name', formData.project_name?.trim() || '');
        formDataToSend.append('project_description', formData.description?.trim() || '');
        formDataToSend.append('donor_name', formData.donor_name?.trim() || '');
        // ✅ إرسال project_type_id بدلاً من project_type
        if (formData.project_type && projectTypesMap[formData.project_type]) {
          formDataToSend.append('project_type_id', projectTypesMap[formData.project_type]);
        } else if (formData.project_type) {
          // Fallback: إرسال project_type كـ string إذا لم نجد ID
          formDataToSend.append('project_type', formData.project_type);
        }
        if (formData.subcategory_id) {
          formDataToSend.append('subcategory_id', parseInt(formData.subcategory_id, 10));
        }
        formDataToSend.append('donation_amount', donationAmount);
        formDataToSend.append('currency_id', currencyId);
        formDataToSend.append('admin_discount_percentage', discountPercentage);
        formDataToSend.append('estimated_duration_days', estimatedDays);
        formDataToSend.append('is_divided_into_phases', isDividedIntoPhases);
        formDataToSend.append('phase_type', phaseTypeValue || '');
        formDataToSend.append('phase_duration_days', phaseDurationValue ?? '');
        formDataToSend.append('total_months', totalMonthsValue ?? '');
        formDataToSend.append('phase_start_date', phaseStartDateValue ?? '');
        formDataToSend.append('is_urgent', formData.is_urgent ? '1' : '0');

        if (formData.notes) {
          formDataToSend.append('notes', formData.notes.trim());
        }
        // ✅ حالة خاصة: حذف كل صور الملاحظات (بدون إضافة صور جديدة)
        const hasExisting = Array.isArray(existingNoteImages) && existingNoteImages.length > 0;
        const allExistingMarkedForDelete = hasExisting && hasDeletions && noteImagesToDelete.length === existingNoteImages.length && !hasNewImages;

        if (allExistingMarkedForDelete) {
          // ✅ backend: notes_image = null (أو قيمة فارغة) بدون note_images_to_delete => حذف كل الصور
          formDataToSend.append('notes_image', '');
        } else {
          // ✅ إضافة الصور الجديدة كـ notes_images[]
          if (hasNewImages) {
            newNoteImages.forEach((file) => {
              if (file instanceof File) {
                formDataToSend.append('notes_images[]', file, file.name);
              }
            });

            // ✅ استخدام أول صورة جديدة أيضاً في الحقل القديم notes_image للتوافقية
            const mainFile = newNoteImages[0];
            if (mainFile instanceof File) {
              formDataToSend.append('notes_image', mainFile, mainFile.name);
              console.log('📸 Sending main notes_image in EditProject (POST with method spoofing):', {
                name: mainFile.name,
                type: mainFile.type,
                size: mainFile.size,
                lastModified: mainFile.lastModified
              });
            }
          }

          // ✅ إضافة IDs الصور المراد حذفها (note_images_to_delete[])
          if (hasDeletions) {
            noteImagesToDelete.forEach((imageId, index) => {
              formDataToSend.append(`note_images_to_delete[${index}]`, imageId);
            });
          }
        }

        // ✅ استخدام POST مع method spoofing (مثل منطق الأيتام)
        response = await apiClient.post(`/project-proposals/${id}`, formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000,
        });
      } else {
        // إرسال البيانات كـ JSON عادي
        const payload = {
          donor_code: formData.donor_code?.trim() || null,
          project_name: formData.project_name?.trim() || null,
          // ✅ project_description اختياري - إرسال string فارغ إذا كان فارغاً
          project_description: formData.description?.trim() || '',
          donor_name: formData.donor_name.trim(),
          // ✅ إرسال project_type_id بدلاً من project_type
          project_type_id: formData.project_type && projectTypesMap[formData.project_type]
            ? projectTypesMap[formData.project_type]
            : null,
          // Fallback: إرسال project_type كـ string إذا لم نجد ID
          ...(formData.project_type && !projectTypesMap[formData.project_type] ? { project_type: formData.project_type } : {}),
          subcategory_id: formData.subcategory_id ? parseInt(formData.subcategory_id, 10) : null,
          donation_amount: donationAmount,
          currency_id: currencyId,
          admin_discount_percentage: discountPercentage,
          estimated_duration_days: estimatedDays,
          notes: formData.notes || null,
          is_divided_into_phases: isDividedIntoPhases,
          phase_type: phaseTypeValue,
          phase_duration_days: phaseDurationValue,
          total_months: totalMonthsValue,
          phase_start_date: phaseStartDateValue,
          is_urgent: formData.is_urgent ? 1 : 0,
        };

        response = await apiClient.patch(`/project-proposals/${id}`, payload);
      }

      if (response.data.success) {
        toast.success('تم تحديث المشروع بنجاح');
        // ✅ وضع flag يشير إلى أن المشروع تم تحديثه
        localStorage.setItem(`project_${id}_updated`, 'true');
        invalidateProjectsCache(); // ✅ إبطال كاش المشاريع لضمان تحديث البيانات فوراً
        navigate(`/project-management/projects/${id}`);
      } else {
        toast.error(response.data.message || 'فشل تحديث المشروع');
      }
    } catch (error) {
      console.error('Error updating project:', error);

      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage =
          error.response?.data?.message ||
          error.userMessage ||
          'ليس لديك صلاحيات لتعديل هذا المشروع.';
        toast.error(permissionMessage);
        navigate('/project-management/projects');
        return;
      }

      toast.error(error.userMessage || 'حدث خطأ أثناء تحديث المشروع');
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // if (authLoading || initialLoading) {
  //   return (
  //     <div className="flex justify-center items-center min-h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
  //     </div>
  //   );
  // }

  const userRole =
    user?.role?.toLowerCase?.() ||
    user?.userRole?.toLowerCase?.() ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role ||
    '';

  const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

  if (!user || (userRole && !isAdmin)) {
    return <Unauthorized requiredRole="admin" pageName="تعديل المشروع" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 pt-4">
          <button
            onClick={ () => navigate(`/project-management/projects/${id}`) }
            className="flex items-center text-sky-600 hover:text-sky-700 font-medium mb-4"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            العودة إلى التفاصيل
          </button>
          <h1 className="text-3xl font-bold text-gray-800">تعديل المشروع</h1>
          <p className="text-gray-600 mt-2">قم بتحديث بيانات المشروع الحالية</p>
        </div>

        <form onSubmit={ handleSubmit } className="space-y-6">
          {/* Basic Information Section */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600" />
              المعلومات الأساسية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag className="w-4 h-4 inline ml-1" />
                  كود المتبرع (اختياري)
                </label>
                <input
                  type="text"
                  name="donor_code"
                  value={ formData.donor_code }
                  onChange={ handleChange }
                  placeholder="مثال: DON-2024-001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline ml-1" />
                  اسم الجهة المتبرعة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="donor_name"
                  value={ formData.donor_name }
                  onChange={ handleChange }
                  placeholder="اسم المتبرع أو الجهة"
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.donor_name ? 'border-red-500' : 'border-gray-300'
                    }` }
                />
                { errors.donor_name && (
                  <p className="text-red-500 text-sm mt-1">{ errors.donor_name }</p>
                ) }
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Package className="w-4 h-4 inline ml-1" />
                  اسم المشروع (اختياري)
                </label>
                <input
                  type="text"
                  name="project_name"
                  value={ formData.project_name }
                  onChange={ handleChange }
                  placeholder="مثال: حملة سقيا الماء - شمال غزة"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  يمكنك تركه فارغاً ليتم توليده تلقائياً أو تعديله هنا قبل الحفظ.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline ml-1" />
                  وصف المشروع (اختياري)
                </label>
                <textarea
                  name="description"
                  value={ formData.description }
                  onChange={ handleChange }
                  placeholder="وصف تفصيلي للمشروع..."
                  rows="4"
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.description ? 'border-red-500' : 'border-gray-300'
                    }` }
                />
                { errors.description && (
                  <p className="text-red-500 text-sm mt-1">{ errors.description }</p>
                ) }
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag className="w-4 h-4 inline ml-1" />
                  نوع المشروع <span className="text-red-500">*</span>
                </label>
                <select
                  name="project_type"
                  value={ formData.project_type }
                  onChange={ handleChange }
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.project_type ? 'border-red-500' : 'border-gray-300'
                    }` }
                >
                  <option value="">اختر النوع</option>
                  { projectTypesLoading ? (
                    <option value="" disabled>جاري تحميل الأنواع...</option>
                  ) : (
                    (projectTypes.length > 0 ? projectTypes : DEFAULT_PROJECT_TYPES.map((name, index) => ({ id: index + 1, name }))).map((type) => {
                      const typeName = typeof type === 'string' ? type : (type.name || type);
                      return (
                        <option key={ typeName } value={ typeName }>
                          { typeName }
                        </option>
                      );
                    })
                  ) }
                </select>
                { errors.project_type && (
                  <p className="text-red-500 text-sm mt-1">{ errors.project_type }</p>
                ) }
              </div>

              { formData.project_type && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag className="w-4 h-4 inline ml-1" />
                    التفرعية (اختياري)
                  </label>
                  <select
                    name="subcategory_id"
                    value={ formData.subcategory_id }
                    onChange={ handleChange }
                    disabled={ subcategoriesLoading }
                    className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.subcategory_id ? 'border-red-500' : 'border-gray-300'
                      } ${subcategoriesLoading ? 'opacity-50 cursor-not-allowed' : ''}` }
                  >
                    <option value="">اختر التفرعية</option>
                    { subcategories.map((sub) => (
                      <option key={ sub.id } value={ sub.id }>
                        { sub.name_ar || sub.name }
                      </option>
                    )) }
                  </select>
                  { subcategoriesLoading && (
                    <p className="text-gray-500 text-sm mt-1">جاري تحميل التفريعات...</p>
                  ) }
                  { errors.subcategory_id && (
                    <p className="text-red-500 text-sm mt-1">{ errors.subcategory_id }</p>
                  ) }
                </div>
              ) }

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline ml-1" />
                  المدة التقديرية للتنفيذ (أيام) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="estimated_duration_days"
                  value={ formData.estimated_duration_days }
                  onChange={ handleChange }
                  min="1"
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.estimated_duration_days ? 'border-red-500' : 'border-gray-300'
                    }` }
                />
                { errors.estimated_duration_days && (
                  <p className="text-red-500 text-sm mt-1">{ errors.estimated_duration_days }</p>
                ) }
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  name="is_urgent"
                  id="is_urgent"
                  checked={ formData.is_urgent }
                  onChange={ handleChange }
                  className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <label htmlFor="is_urgent" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  عاجل
                </label>
              </div>
            </div>
          </div>

          {/* Financial Information Section */ }
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
                  type="number"
                  name="donation_amount"
                  value={ formData.donation_amount }
                  onChange={ handleChange }
                  placeholder="مثال: 10000"
                  step="0.01"
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.donation_amount ? 'border-red-500' : 'border-gray-300'
                    }` }
                />
                { errors.donation_amount && (
                  <p className="text-red-500 text-sm mt-1">{ errors.donation_amount }</p>
                ) }
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline ml-1" />
                  العملة <span className="text-red-500">*</span>
                </label>
                <select
                  name="currency_id"
                  value={ formData.currency_id }
                  onChange={ handleChange }
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.currency_id ? 'border-red-500' : 'border-gray-300'
                    }` }
                >
                  <option value="">اختر العملة</option>
                  { currencies.map((currency) => (
                    <option key={ currency.id } value={ currency.id }>
                      { currency.currency_name_ar || currency.currency_name || currency.name_ar || currency.name } ({ currency.currency_code || currency.code })
                    </option>
                  )) }
                </select>
                { errors.currency_id && (
                  <p className="text-red-500 text-sm mt-1">{ errors.currency_id }</p>
                ) }
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calculator className="w-4 h-4 inline ml-1" />
                  نسبة الخصم الإداري (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="discount_percentage"
                  value={ formData.discount_percentage }
                  onChange={ handleChange }
                  min="0"
                  max="100"
                  step="0.01"
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.discount_percentage ? 'border-red-500' : 'border-gray-300'
                    }` }
                />
                { errors.discount_percentage && (
                  <p className="text-red-500 text-sm mt-1">{ errors.discount_percentage }</p>
                ) }
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-4 border-2 border-sky-200">
                <p className="text-sm text-sky-600 mb-1">المبلغ بالدولار</p>
                <p className="text-2xl font-bold text-sky-700">
                  { formatCurrency(calculatedValues.amountInUsd || 0) }
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
                <p className="text-sm text-green-600 mb-1">المبلغ الصافي بعد الخصم</p>
                <p className="text-2xl font-bold text-green-700">
                  { formatCurrency(calculatedValues.netAmount || 0) }
                </p>
              </div>
            </div>
          </div>

          {/* Phase Division Section */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              تقسيم المشروع على مراحل
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="is_divided_into_phases"
                  id="is_divided_into_phases"
                  checked={ formData.is_divided_into_phases }
                  onChange={ (e) => {
                    const isChecked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_divided_into_phases: isChecked,
                      // ✅ إذا تم إلغاء التفعيل، إعادة تعيين جميع الحقول
                      phase_type: isChecked ? formData.phase_type : null,
                      phase_duration_days: isChecked ? formData.phase_duration_days : '',
                      total_months: isChecked ? formData.total_months : '',
                      phase_start_date: isChecked ? formData.phase_start_date : '',
                    });
                  } }
                  className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                />
                <label htmlFor="is_divided_into_phases" className="text-sm font-medium text-gray-700">
                  تقسيم المشروع على مراحل
                </label>
              </div>

              { formData.is_divided_into_phases && (
                <div className="grid grid-cols-1 gap-6 bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                  {/* ✅ نوع التقسيم */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      نوع التقسيم <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="phase_type"
                      value={ formData.phase_type || '' }
                      onChange={ (e) => {
                        const newPhaseType = e.target.value;
                        setFormData({
                          ...formData,
                          phase_type: newPhaseType || null,
                          // ✅ إعادة تعيين الحقول حسب النوع
                          phase_duration_days: newPhaseType === 'daily' ? formData.phase_duration_days : '',
                          total_months: newPhaseType === 'monthly' ? formData.total_months : '',
                        });
                      } }
                      className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.phase_type ? 'border-red-500' : 'border-gray-300'
                        }` }
                    >
                      <option value="">اختر نوع التقسيم</option>
                      <option value="daily">يومي</option>
                      <option value="monthly">شهري</option>
                    </select>
                    { errors.phase_type && (
                      <p className="text-red-500 text-sm mt-1">{ errors.phase_type }</p>
                    ) }
                  </div>

                  {/* ✅ للمشاريع اليومية */}
                  { formData.phase_type === 'daily' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="w-4 h-4 inline ml-1" />
                        عدد أيام التقسيم <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="phase_duration_days"
                        value={ formData.phase_duration_days }
                        onChange={ handleChange }
                        min="1"
                        placeholder="مثال: 30"
                        className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.phase_duration_days ? 'border-red-500' : 'border-gray-300'
                          }` }
                      />
                      { errors.phase_duration_days && (
                        <p className="text-red-500 text-sm mt-1">{ errors.phase_duration_days }</p>
                      ) }
                    </div>
                  ) }

                  {/* ✅ للمشاريع الشهرية */}
                  { formData.phase_type === 'monthly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline ml-1" />
                        عدد الشهور <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="total_months"
                        value={ formData.total_months }
                        onChange={ handleChange }
                        min="1"
                        placeholder="مثال: 12"
                        className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.total_months ? 'border-red-500' : 'border-gray-300'
                          }` }
                      />
                      { errors.total_months && (
                        <p className="text-red-500 text-sm mt-1">{ errors.total_months }</p>
                      ) }
                    </div>
                  ) }

                  {/* تاريخ بداية المراحل (لجميع أنواع التقسيم) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline ml-1" />
                      تاريخ بداية المراحل <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="phase_start_date"
                      value={ formData.phase_start_date }
                      onChange={ handleChange }
                      className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.phase_start_date ? 'border-red-500' : 'border-gray-300'
                        }` }
                    />
                    { errors.phase_start_date && (
                      <p className="text-red-500 text-sm mt-1">{ errors.phase_start_date }</p>
                    ) }
                  </div>
                </div>
              ) }
            </div>
          </div>

          {/* Notes Section */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              الملاحظات والصور
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الملاحظات
                </label>
                <textarea
                  name="notes"
                  value={ formData.notes }
                  onChange={ handleChange }
                  placeholder="ملاحظات أو تعليمات إضافية..."
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Notes Images (Multiple) */ }
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ImageIcon className="w-4 h-4 inline ml-1" />
                  صور الملاحظات (يمكن اختيار عدة صور)
                </label>
                <div className="space-y-4">
                  {/* Upload input */ }
                  <div className="relative">
                    <input
                      type="file"
                      name="notes_image"
                      accept="image/*"
                      multiple
                      onChange={ handleChange }
                      className="hidden"
                      id="notes_image_input_edit"
                    />
                    <label
                      htmlFor="notes_image_input_edit"
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl transition-all duration-300 cursor-pointer hover:border-sky-400 hover:bg-sky-50"
                    >
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-600 font-medium">
                        { (newNoteImages.length > 0 || existingNoteImages.length > 0 || existingNotesImageUrl) ? 'إضافة / تغيير صور الملاحظات' : 'اختر صوراً للملاحظات' }
                      </span>
                    </label>
                  </div>

                  { errors.notes_image && (
                    <p className="text-sm text-red-600">{ errors.notes_image }</p>
                  ) }

                  {/* Existing note images (from note_images) */ }
                  { existingNoteImages.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">الصور الحالية (يمكن تحديد صور للحذف):</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        { existingNoteImages.map((img) => {
                          const path = img.image_url || img.image_path;
                          if (!path) return null;
                          const isMarkedForDelete = noteImagesToDelete.includes(img.id);

                          let finalUrl = path;
                          if (!path.startsWith('http://') && !path.startsWith('https://')) {
                            const origin = window.location.origin;
                            const normalizedPath = path.startsWith('/') ? path : `/${path}`;
                            finalUrl = `${origin}${normalizedPath}`;
                          }

                          return (
                            <div
                              key={ img.id }
                              className={ `relative rounded-xl border-2 overflow-hidden ${isMarkedForDelete ? 'border-red-400 opacity-60' : 'border-gray-200'}` }
                            >
                              <img
                                src={ finalUrl }
                                alt={ `صورة ملاحظة #${img.id}` }
                                className="w-full h-28 object-cover"
                              />
                              <button
                                type="button"
                                onClick={ () => toggleDeleteExistingNoteImage(img.id) }
                                className={ `absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${isMarkedForDelete ? 'bg-red-600 text-white' : 'bg-white/80 text-gray-700 hover:bg-red-50'}` }
                              >
                                <XIcon className="w-3 h-3" />
                                { isMarkedForDelete ? 'إلغاء الحذف' : 'حذف' }
                              </button>
                            </div>
                          );
                        }) }
                      </div>
                    </div>
                  ) }

                  {/* Legacy single image fallback (when no note_images present) */ }
                  { existingNotesImageUrl && existingNoteImages.length === 0 && !notesImagePreview && (
                    <div className="relative bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                      <button
                        type="button"
                        onClick={ handleRemoveImage }
                        className="absolute top-2 left-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10"
                        title="إزالة الصورة"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                      <img
                        src={ existingNotesImageUrl }
                        alt="صورة الملاحظات الحالية"
                        className="w-full h-auto rounded-lg max-h-64 object-contain"
                        onError={ (e) => {
                          const baseURL = apiClient.defaults.baseURL || '';
                          e.target.src = `${baseURL}/project-note-image/${id}`;
                        } }
                      />
                    </div>
                  ) }

                  {/* New note images previews */}
                  {(newNoteImages.length > 0 || notesImagePreview) && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">الصور الجديدة (لن تُحفظ إلا بعد الضغط على زر "تحديث المشروع"):</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {newNoteImages.map((file, index) => (
                          <NoteImagePreview
                            key={`${file.name}-${index}`}
                            file={file}
                            index={index}
                            onRemove={removeNewNoteImage}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */ }
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={ () => navigate(`/project-management/projects/${id}`) }
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              إلغاء
            </button>
            <button
              type="submit"
              disabled={ loading }
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              { loading ? 'جاري الحفظ...' : 'تحديث المشروع' }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProject;
