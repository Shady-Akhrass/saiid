import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { Save, ArrowRight, DollarSign, Calculator, Image as ImageIcon, X as XIcon, Calendar, Clock, AlertCircle, Users } from 'lucide-react';
import Unauthorized from '../components/Unauthorized';
import { useCacheInvalidation } from '../../../hooks/useCacheInvalidation';

// Image preview component
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

const NewProject = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { invalidateProjectsCache } = useCacheInvalidation();
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  // الأنواع الافتراضية كـ fallback
  const DEFAULT_PROJECT_TYPES
    = ['إغاثي', 'تنموي', 'طبي', 'تعليمي', 'الكفالات', 'إنشائي', 'اجتماعي', 'دعم نفسي', 'موسمي'];

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
    notes_image: null, // صورة الملاحظات
    is_divided_into_phases: false, // تقسيم المشروع على مراحل
    phase_type: 'daily', // ✅ جديد: نوع التقسيم ('daily' أو 'monthly')
    phase_duration_days: '', // عدد أيام التقسيم (للتقسيم اليومي)
    total_months: '', // ✅ جديد: عدد الشهور (للتقسيم الشهري)
    phase_start_date: '', // تاريخ بداية المراحل
    is_urgent: false, // مشروع عاجل
    beneficiaries_count: '', // ✅ جديد: عدد المستفيدين
  });

  const [errors, setErrors] = useState({});
  const [notesImagePreview, setNotesImagePreview] = useState(null);
  const [noteImages, setNoteImages] = useState([]); // صور ملاحظات متعددة (notes_images[])

  useEffect(() => {
    fetchCurrencies();
    fetchProjectTypes();

    // ✅ إعادة جلب العملات عند focus على الصفحة (في حالة تحديثها في صفحة أخرى)
    const handleFocus = () => {
      fetchCurrencies();
      fetchProjectTypes();
    };

    window.addEventListener('focus', handleFocus);

    // ✅ الاستماع إلى أحداث تحديث العملات
    const handleCurrencyUpdate = () => {
      if (import.meta.env.DEV) {
        console.log('🔄 Currency updated, refreshing currencies...');
      }
      fetchCurrencies();
    };

    window.addEventListener('currency-updated', handleCurrencyUpdate);
    window.addEventListener('cache-invalidated', (event) => {
      if (event.detail?.cacheKey === 'currencies' || event.detail?.cacheKey === 'all') {
        handleCurrencyUpdate();
      }
      if (event.detail?.cacheKey === 'project-types' || event.detail?.cacheKey === 'all') {
        fetchProjectTypes();
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('currency-updated', handleCurrencyUpdate);
    };
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
      console.error('Error fetching project types:', error);
      console.error('Response:', error.response?.data);
      console.error('Status:', error.response?.status);
      // Fallback: استخدام الأنواع الافتراضية
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
    calculateValues();
  }, [formData.donation_amount, formData.currency_id, formData.discount_percentage, currencies]);

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
          setFormData(prev => ({ ...prev, subcategory_id: '' }));
        }
      } catch (error) {
        if (import.meta.env.DEV && !error.isConnectionError) {
          console.error('Error fetching subcategories:', error);
        }
        setSubcategories([]);
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
          per_page: 1000, // جلب كل العملات
          include_inactive: false, // فقط النشطة
          _t: Date.now(), // ✅ cache busting - إجبار الـ Backend على جلب البيانات المحدثة
        },
        timeout: 20000, // timeout 20 ثانية
        headers: {
          'Cache-Control': 'no-cache', // ✅ منع cache في الـ request
        }
      });

      if (response.data.success) {
        // ✅ الـ Backend يرجع البيانات في "currencies" وليس "data"
        let currenciesData = response.data.currencies || response.data.data || [];

        // ✅ إذا كان هناك pagination، نجمع كل الصفحات
        if (response.data.currentPage && response.data.lastPage && response.data.lastPage > 1) {
          const allCurrencies = [...currenciesData];

          for (let page = 2; page <= response.data.lastPage; page++) {
            try {
              const pageResponse = await apiClient.get('/currencies', {
                params: {
                  page: page,
                  per_page: 1000,
                  include_inactive: false,
                  _t: Date.now(), // ✅ cache busting
                },
                timeout: 20000,
                headers: {
                  'Cache-Control': 'no-cache',
                }
              });

              if (pageResponse.data.success) {
                const pageData = pageResponse.data.currencies || pageResponse.data.data || [];
                allCurrencies.push(...pageData);
              }
            } catch (pageError) {
              console.warn(`Failed to fetch currencies page ${page}:`, pageError);
              break;
            }
          }

          currenciesData = allCurrencies;
        }

        const activeCurrencies = currenciesData.filter((c) => c.is_active);
        setCurrencies(activeCurrencies);

        if (import.meta.env.DEV) {
          console.log(`✅ Loaded ${activeCurrencies.length} active currencies`);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('Error fetching currencies:', error);
      }
      // Fallback: بيانات وهمية في حالة فشل API (للتطوير فقط)
      // TODO: احذف هذا الـ fallback عندما يكون Backend جاهزاً
      const fallbackCurrencies = [
        {
          id: 1,
          currency_name: 'دولار أمريكي',
          currency_code: 'USD',
          symbol: '$',
          exchange_rate_to_usd: 1.00,
          is_active: true,
        },
        {
          id: 2,
          currency_name: 'يورو',
          currency_code: 'EUR',
          symbol: '€',
          exchange_rate_to_usd: 1.08,
          is_active: true,
        },
        {
          id: 3,
          currency_name: 'جنيه إسترليني',
          currency_code: 'GBP',
          symbol: '£',
          exchange_rate_to_usd: 1.27,
          is_active: true,
        },
        {
          id: 4,
          currency_name: 'دينار أردني',
          currency_code: 'JOD',
          symbol: 'د.أ',
          exchange_rate_to_usd: 0.71,
          is_active: true,
        },
        {
          id: 5,
          currency_name: 'دينار كويتي',
          currency_code: 'KWD',
          symbol: 'د.ك',
          exchange_rate_to_usd: 3.26,
          is_active: true,
        },
        {
          id: 6,
          currency_name: 'ريال سعودي',
          currency_code: 'SAR',
          symbol: 'ر.س',
          exchange_rate_to_usd: 0.27,
          is_active: true,
        },
      ];
      setCurrencies(fallbackCurrencies.filter((c) => c.is_active));
      // لا نعرض رسالة خطأ إذا كان Backend غير متاح (للتطوير)
      // toast.error('فشل تحميل العملات');
    }
  };

  const calculateValues = async () => {
    if (!formData.donation_amount || !formData.currency_id) {
      setCalculatedValues({ amountInUsd: 0, netAmount: 0 });
      return;
    }

    try {
      // حساب محلي باستخدام بيانات العملة من API
      const selectedCurrency = currencies.find(
        (c) => c.id === parseInt(formData.currency_id)
      );

      if (selectedCurrency) {
        const amountInUsd =
          parseFloat(formData.donation_amount) * selectedCurrency.exchange_rate_to_usd;
        const discount = (amountInUsd * parseFloat(formData.discount_percentage || 0)) / 100;
        const netAmount = amountInUsd - discount;

        setCalculatedValues({
          amountInUsd,
          netAmount,
        });
      }
    } catch (error) {
      console.error('Error calculating values:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === 'notes_image' && files && files.length > 0) {
      const selectedFiles = Array.from(files);

      // ✅ التحقق من نوع وحجم كل ملف
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];

      const validFiles = [];

      selectedFiles.forEach((file) => {
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        const fileType = file.type.toLowerCase();
        const normalizedType = fileType === 'image/jpg' ? 'image/jpeg' : fileType;
        const isValidType = normalizedType.startsWith('image/') && allowedTypes.includes(normalizedType);
        const isValidExtension = allowedExtensions.includes(fileExtension);

        // ✅ Debug: عرض معلومات الملف
        console.log('📸 File selected (NewProject - multiple):', {
          name: file.name,
          type: file.type,
          normalizedType,
          size: file.size,
          extension: fileExtension,
          isValidType,
          isValidExtension
        });

        if (!isValidType && !isValidExtension) {
          setErrors(prev => ({ ...prev, notes_image: 'يجب اختيار ملف صورة بصيغة: jpeg, jpg, png, gif, webp' }));
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          setErrors(prev => ({ ...prev, notes_image: 'حجم كل صورة يجب أن يكون أقل من 5MB' }));
          return;
        }

        validFiles.push(file);
      });

      if (validFiles.length === 0) {
        return;
      }

      // ✅ حفظ جميع الصور المختارة (مع الاحتفاظ بالسابق)
      setNoteImages(prev => {
        const newFiles = [...prev, ...validFiles];
        // تحديث الصورة الرئيسية للتوافقية
        if (newFiles.length > 0) {
          const mainFile = newFiles[0];
          setFormData(f => ({ ...f, [name]: mainFile }));
          const reader = new FileReader();
          reader.onloadend = () => setNotesImagePreview(reader.result);
          reader.readAsDataURL(mainFile);
        }
        return newFiles;
      });

      // مسح خطأ الصورة إذا كان موجوداً
      if (errors.notes_image) {
        setErrors({ ...errors, notes_image: null });
      }
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
    setNoteImages([]);
    // إعادة تعيين input file
    const fileInput = document.querySelector('input[name="notes_image"]');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const removeSpecificImage = (indexToRemove) => {
    setNoteImages(prev => {
      const remaining = prev.filter((_, i) => i !== indexToRemove);
      if (remaining.length > 0) {
        const mainFile = remaining[0];
        setFormData(f => ({ ...f, notes_image: mainFile }));
        const reader = new FileReader();
        reader.onloadend = () => setNotesImagePreview(reader.result);
        reader.readAsDataURL(mainFile);
      } else {
        setFormData(f => ({ ...f, notes_image: null }));
        setNotesImagePreview(null);
        const fileInput = document.getElementById('notes_image_input_new');
        if (fileInput) fileInput.value = '';
      }
      return remaining;
    });
  };

  const validateForm = () => {
    const newErrors = {};

    // ✅ اسم المشروع إجباري في قسم الإدارة
    if (!formData.project_name?.trim()) {
      newErrors.project_name = 'اسم المشروع مطلوب';
    }
    // ✅ الوصف اختياري في قسم الإدارة
    // if (!formData.description.trim()) {
    //   newErrors.description = 'وصف المشروع مطلوب';
    // }
    if (!formData.donor_name.trim()) {
      newErrors.donor_name = 'اسم الجهة المتبرعة مطلوب';
    }
    if (!formData.project_type) {
      newErrors.project_type = 'نوع المشروع مطلوب';
    }
    // ✅ التحقق من التفريعة - إجباري في قسم الإدارة
    if (!formData.subcategory_id) {
      newErrors.subcategory_id = 'التفريعة مطلوبة';
    }
    if (!formData.donation_amount || parseFloat(formData.donation_amount) <= 0) {
      newErrors.donation_amount = 'مبلغ التبرع يجب أن يكون أكبر من صفر';
    }
    if (!formData.currency_id) {
      newErrors.currency_id = 'العملة مطلوبة';
    }
    if (formData.discount_percentage === '' || formData.discount_percentage === null || formData.discount_percentage === undefined) {
      newErrors.discount_percentage = 'نسبة الخصم الإداري مطلوبة';
    } else if (parseFloat(formData.discount_percentage) < 0 || parseFloat(formData.discount_percentage) > 100) {
      newErrors.discount_percentage = 'نسبة الخصم يجب أن تكون بين 0 و 100';
    }
    if (!formData.estimated_duration_days || parseInt(formData.estimated_duration_days) <= 0) {
      newErrors.estimated_duration_days = 'المدة التقديرية يجب أن تكون أكبر من صفر';
    }
    // ✅ التحقق من عدد المستفيدين
    if (formData.beneficiaries_count !== '' && (parseInt(formData.beneficiaries_count) < 0)) {
      newErrors.beneficiaries_count = 'عدد المستفيدين لا يمكن أن يكون سالباً';
    }

    // ✅ Validation لحقول تقسيم المراحل
    if (formData.is_divided_into_phases) {
      if (!formData.phase_type) {
        newErrors.phase_type = 'نوع التقسيم مطلوب';
      }
      // ✅ التحقق من الحقول حسب نوع التقسيم
      if (formData.phase_type === 'daily') {
        // للتقسيم اليومي: يتطلب backend وجود phase_start_date + عدد الأيام
        if (!formData.phase_start_date) {
          newErrors.phase_start_date = 'تاريخ بداية المراحل (اليومية) مطلوب';
        }
        if (!formData.phase_duration_days || parseInt(formData.phase_duration_days) <= 0) {
          newErrors.phase_duration_days = 'عدد أيام التقسيم مطلوب ويجب أن يكون أكبر من صفر';
        }
      } else if (formData.phase_type === 'monthly') {
        // للتقسيم الشهري: total_months إجباري، و phase_start_date اختياري
        if (!formData.total_months || parseInt(formData.total_months) <= 0) {
          newErrors.total_months = 'عدد الشهور مطلوب ويجب أن يكون أكبر من صفر';
        }
        // ملاحظة: لا نتحقق من phase_start_date هنا حتى يبقى اختيارياً
      }
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
      // ✅ التحقق من صحة البيانات قبل الإرسال
      const donationAmount = parseFloat(formData.donation_amount);
      const currencyId = parseInt(formData.currency_id);
      const discountPercentage = parseFloat(formData.discount_percentage) || 0;
      const estimatedDays = parseInt(formData.estimated_duration_days);

      // ✅ التحقق من صحة الأرقام
      if (isNaN(donationAmount) || donationAmount <= 0) {
        toast.error('مبلغ التبرع غير صحيح');
        setErrors({ ...errors, donation_amount: 'مبلغ التبرع يجب أن يكون أكبر من صفر' });
        setLoading(false);
        return;
      }

      if (isNaN(currencyId) || currencyId <= 0) {
        toast.error('العملة غير صحيحة');
        setErrors({ ...errors, currency_id: 'يجب اختيار عملة صحيحة' });
        setLoading(false);
        return;
      }

      if (isNaN(estimatedDays) || estimatedDays <= 0) {
        toast.error('المدة التقديرية غير صحيحة');
        setErrors({ ...errors, estimated_duration_days: 'المدة التقديرية يجب أن تكون أكبر من صفر' });
        setLoading(false);
        return;
      }

      const isDividedIntoPhasesNum = formData.is_divided_into_phases ? 1 : 0;
      const phaseTypeValue = formData.is_divided_into_phases ? formData.phase_type : null;
      const phaseDurationValue = formData.is_divided_into_phases && formData.phase_type === 'daily'
        ? parseInt(formData.phase_duration_days)
        : null;
      const totalMonthsValue = formData.is_divided_into_phases && formData.phase_type === 'monthly'
        ? parseInt(formData.total_months)
        : null;
      // ✅ phase_start_date:
      // - للتقسيم اليومي: إجباري ويُرسل دائماً (الكود أعلاه يتحقق منه)
      // - للتقسيم الشهري: إذا تُرك فارغاً لا نرسله أبداً حتى يطبّق الباك‑إند منطق "بداية الشهر الحالي"
      let phaseStartDateValue = null;
      if (formData.is_divided_into_phases) {
        if (formData.phase_type === 'daily' && formData.phase_start_date) {
          phaseStartDateValue = formData.phase_start_date;
        } else if (formData.phase_type === 'monthly' && formData.phase_start_date) {
          phaseStartDateValue = formData.phase_start_date;
        }
      }

      // ✅ حلّ project_type_id من الاسم (projectTypesMap) أو من الرقم إذا كان الحقل مخزن كـ id
      const resolvedProjectTypeId = formData.project_type != null && formData.project_type !== ''
        ? (projectTypesMap[formData.project_type] ?? (/^\d+$/.test(String(formData.project_type)) ? parseInt(formData.project_type, 10) : null))
        : null;

      let response;

      // إذا كانت هناك صورة، استخدم FormData
      if (formData.notes_image) {
        const formDataToSend = new FormData();
        formDataToSend.append('donor_code', formData.donor_code?.trim() || '');
        formDataToSend.append('project_name', formData.project_name?.trim() || '');
        // ✅ إرسال project_description - string فارغ إذا لم يكن له قيمة (اختياري)
        // بعض Backends تتعامل مع string فارغ بشكل أفضل من عدم إرسال الحقل
        formDataToSend.append('project_description', formData.description?.trim() || '');
        formDataToSend.append('donor_name', formData.donor_name?.trim() || '');
        // ✅ إرسال project_type_id (مقسم شهري/يومي يحتاج project_type_id صحيح ليقبل الـ Backend)
        if (resolvedProjectTypeId != null) {
          formDataToSend.append('project_type_id', resolvedProjectTypeId);
        } else if (formData.project_type) {
          formDataToSend.append('project_type', formData.project_type);
        }
        if (formData.subcategory_id) {
          const subcategoryId = parseInt(formData.subcategory_id, 10);
          formDataToSend.append('subcategory_id', subcategoryId);
          console.log('✅ Sending subcategory_id:', subcategoryId);
        } else {
          console.log('⚠️ No subcategory_id selected');
        }
        formDataToSend.append('donation_amount', donationAmount);
        formDataToSend.append('currency_id', currencyId);
        formDataToSend.append('admin_discount_percentage', discountPercentage);
        formDataToSend.append('estimated_duration_days', estimatedDays);
        if (formData.notes) {
          formDataToSend.append('notes', formData.notes.trim());
        }
        // ✅ إضافة صور الملاحظات المتعددة (notes_images[]) إذا كانت موجودة
        if (Array.isArray(noteImages) && noteImages.length > 0) {
          noteImages.forEach((file) => {
            if (file instanceof File) {
              formDataToSend.append('notes_images[]', file, file.name);
            }
          });
        }
        // ✅ التأكد من إرسال الملف بشكل صحيح
        if (formData.notes_image instanceof File) {
          // ✅ Debug: عرض معلومات الملف قبل الإرسال
          console.log('📸 Sending file:', {
            name: formData.notes_image.name,
            type: formData.notes_image.type,
            size: formData.notes_image.size,
            lastModified: formData.notes_image.lastModified
          });

          // ✅ إرسال الملف مع اسمه - axios سيتعامل مع نوع MIME تلقائياً
          formDataToSend.append('notes_image', formData.notes_image, formData.notes_image.name);

          // ✅ التحقق من أن الملف تم إضافته بشكل صحيح
          const fileEntry = formDataToSend.get('notes_image');
          console.log('✅ File added to FormData:', fileEntry instanceof File ? 'Yes' : 'No', fileEntry);
        } else {
          console.warn('⚠️ notes_image is not a File instance:', formData.notes_image);
          formDataToSend.append('notes_image', formData.notes_image);
        }
        formDataToSend.append('is_divided_into_phases', isDividedIntoPhasesNum);
        if (phaseTypeValue) {
          formDataToSend.append('phase_type', phaseTypeValue);
        }
        if (phaseDurationValue) {
          formDataToSend.append('phase_duration_days', phaseDurationValue);
        }
        if (totalMonthsValue) {
          formDataToSend.append('total_months', totalMonthsValue);
        }
        // ✅ لا نرسل phase_start_date إلا إذا كان له قيمة فعلية
        if (phaseStartDateValue) {
          formDataToSend.append('phase_start_date', phaseStartDateValue);
        }
        formDataToSend.append('is_urgent', formData.is_urgent ? '1' : '0');
        if (formData.beneficiaries_count !== '') {
          formDataToSend.append('beneficiaries_count', parseInt(formData.beneficiaries_count));
        }

        // 🔍 Debug: عرض البيانات المرسلة
        console.log('📤 Sending project data with image (FormData)');
        console.log('📤 Form data:', formData);
        console.log('✅ Phase Division Data:', {
          is_divided_into_phases: isDividedIntoPhasesNum,
          phase_duration_days: phaseDurationValue,
          phase_start_date: phaseStartDateValue,
        });
        console.log('✅ project_name (من حقل اسم المشروع):', formData.project_name?.trim() || null);
        console.log('✅ project_description (من حقل وصف المشروع):', formData.description?.trim() || '');
        console.log('✅ has_notes:', !!formData.notes);
        console.log('✅ has_image: true');

        // عرض محتوى FormData للتأكد
        console.log('📋 FormData entries:');
        for (let pair of formDataToSend.entries()) {
          console.log(`  ${pair[0]}: ${pair[1]}`);
        }

        // ✅ لا نضيف Content-Type يدوياً - axios يضيفه تلقائياً مع boundary الصحيح
        response = await apiClient.post('/project-proposals', formDataToSend);

        // 🔍 Debug: عرض الـ Response من الباك إند
        console.log('📥 Response from backend:', response.data);
        if (response.data?.project) {
          console.log('✅ Created project:', {
            id: response.data.project.id,
            is_divided_into_phases: response.data.project.is_divided_into_phases,
            phase_duration_days: response.data.project.phase_duration_days,
            phase_start_date: response.data.project.phase_start_date,
            daily_phases_count: response.data.project.daily_phases?.length || 0,
          });
        }
      } else {
        // ✅ التأكد من أن project_name و project_description منفصلان
        const payload = {
          donor_code: formData.donor_code?.trim() || null,
          // ✅ project_name: من حقل "اسم المشروع" (منفصل تماماً عن project_description)
          project_name: formData.project_name?.trim() || null,
          // ✅ project_description: من حقل "وصف المشروع" (منفصل تماماً عن project_name) - اختياري
          // ✅ إرسال string فارغ بدلاً من null - بعض Backends تتعامل مع string فارغ بشكل أفضل
          project_description: formData.description?.trim() || '',
          donor_name: formData.donor_name?.trim() || '',
          // ✅ إرسال project_type_id (مقسم شهري/يومي يحتاج project_type_id صحيح)
          project_type_id: resolvedProjectTypeId,
          ...(formData.project_type && !resolvedProjectTypeId ? { project_type: formData.project_type } : {}),
          subcategory_id: formData.subcategory_id ? (() => {
            const subcategoryId = parseInt(formData.subcategory_id, 10);
            console.log('✅ Sending subcategory_id:', subcategoryId);
            return subcategoryId;
          })() : (() => {
            console.log('⚠️ No subcategory_id selected');
            return null;
          })(),
          donation_amount: donationAmount,
          currency_id: currencyId,
          admin_discount_percentage: discountPercentage,
          estimated_duration_days: estimatedDays,
          notes: formData.notes?.trim() || null,
          is_divided_into_phases: isDividedIntoPhasesNum,
          phase_type: phaseTypeValue,
          phase_duration_days: phaseDurationValue,
          total_months: totalMonthsValue,
          // ✅ لا نرسل phase_start_date في JSON إذا كان null/فارغ
          ...(phaseStartDateValue ? { phase_start_date: phaseStartDateValue } : {}),
          is_urgent: formData.is_urgent || false,
          beneficiaries_count: formData.beneficiaries_count !== '' ? parseInt(formData.beneficiaries_count) : null,
        };

        // 🔍 Debug: عرض البيانات المرسلة مع التأكيد على الفصل
        console.log('📤 Sending project data (JSON):', payload);
        console.log('📤 Form data:', formData);
        console.log('✅ project_description value:', {
          original: formData.description,
          trimmed: formData.description?.trim(),
          final: payload.project_description,
          isEmpty: !formData.description?.trim(),
          type: typeof payload.project_description
        });
        console.log('✅ Phase Division Data:', {
          is_divided_into_phases: isDividedIntoPhasesNum,
          phase_duration_days: phaseDurationValue,
          phase_start_date: phaseStartDateValue,
        });
        console.log('✅ project_name (من حقل اسم المشروع):', formData.project_name?.trim() || null);
        console.log('✅ project_description (من حقل وصف المشروع):', formData.description?.trim() || '');
        console.log('✅ الحقلان منفصلان:', {
          project_name: formData.project_name,
          description: formData.description,
          areDifferent: formData.project_name !== formData.description
        });
        console.log('✅ has_notes:', !!formData.notes);
        console.log('✅ has_image: false');

        response = await apiClient.post('/project-proposals', payload);

        // 🔍 Debug: عرض الـ Response من الباك إند
        console.log('📥 Response from backend:', response.data);
        if (response.data?.project) {
          console.log('✅ Created project:', {
            id: response.data.project.id,
            is_divided_into_phases: response.data.project.is_divided_into_phases,
            phase_duration_days: response.data.project.phase_duration_days,
            phase_start_date: response.data.project.phase_start_date,
            daily_phases_count: response.data.project.daily_phases?.length || 0,
            monthly_phases_count: response.data.project.monthly_phases?.length || 0,
          });
        }
      }
      // 🔍 للتشخيص: هل السيرفر أعاد project.id؟ (بدونه لا نعتبر النجاح حقيقياً)
      console.log('📥 Backend response check:', {
        success: response.data?.success,
        hasProject: !!response.data?.project,
        projectId: response.data?.project?.id,
        status: response.status,
      });
      // ✅ التحقق من النجاح الحقيقي: يجب أن يرجع السيرفر success + project.id صالح (لا 0 ولا null)
      const rawId = response.data?.project?.id;
      const hasProjectId = rawId != null && rawId !== 0 && rawId !== '';
      const isDividedIntoPhases = Boolean(formData.is_divided_into_phases);

      if (response.data.success && hasProjectId) {
        // ✅ لمشاريع مقسمة (شهرياً أو يومياً): التحقق من أن المشروع حُفظ فعلياً في قاعدة البيانات (GET بعد الإنشاء)
        if (isDividedIntoPhases) {
          try {
            const verifyRes = await apiClient.get(`/project-proposals/${rawId}`);
            const verifyProject = verifyRes?.data?.project ?? verifyRes?.data?.data ?? verifyRes?.data;
            const verifyId = verifyProject?.id ?? verifyProject?.project_proposal_id;
            // إذا كان الـ GET يرجع 200 لكن بدون مشروع أو بمعرف مختلف، نعتبر أن المشروع لم يُحفظ
            if (!verifyProject || verifyId == null || verifyId === '' || Number(verifyId) !== Number(rawId)) {
              console.error('❌ GET verify: response missing project or id mismatch', { rawId, verifyId, verifyProject });
              toast.error('تم استلام تأكيد من السيرفر لكن المشروع غير موجود في قاعدة البيانات. يرجى تفعيل حفظ المشاريع المقسمة (شهرياً أو يومياً) في الـ Backend (راجع BACKEND_STORE_MONTHLY_DIVIDED_PROJECT.md).');
              setLoading(false);
              return;
            }
            // تنبيه إذا لم يُنشأ الـ Backend المراحل الشهرية/اليومية
            const monthlyPhases = verifyProject?.monthly_phases ?? verifyProject?.monthlyPhases ?? [];
            const dailyPhases = verifyProject?.daily_phases ?? verifyProject?.dailyPhases ?? [];
            const isMonthly = formData.phase_type === 'monthly';
            if (isMonthly && (!Array.isArray(monthlyPhases) || monthlyPhases.length === 0)) {
              toast.warning('تم إنشاء المشروع الأساسي لكن المراحل الشهرية لم تُنشأ بعد. تحقق من إعدادات الخادم (BACKEND_STORE_MONTHLY_DIVIDED_PROJECT.md).');
            } else if (!isMonthly && formData.phase_type === 'daily' && (!Array.isArray(dailyPhases) || dailyPhases.length === 0)) {
              toast.warning('تم إنشاء المشروع الأساسي لكن المراحل اليومية لم تُنشأ بعد. تحقق من إعدادات الخادم (BACKEND_STORE_MONTHLY_DIVIDED_PROJECT.md).');
            }
          } catch (verifyErr) {
            console.error('❌ Project created but not found in DB (divided project):', verifyErr?.response?.status, verifyErr?.response?.data);
            toast.error('تم استلام تأكيد من السيرفر لكن المشروع غير موجود في قاعدة البيانات. يرجى تفعيل حفظ المشاريع المقسمة (شهرياً أو يومياً) في الـ Backend (راجع BACKEND_STORE_MONTHLY_DIVIDED_PROJECT.md).');
            setLoading(false);
            return;
          }
        }


        invalidateProjectsCache();
        toast.success('تم إنشاء المشروع بنجاح');
        navigate('/project-management/projects');
      } else if (response.data.success && !hasProjectId) {
        console.error('❌ Backend returned success but no project.id — project may not have been saved (check Backend store for divided projects)', response.data);
        toast.error('استجابة السيرفر لا تحتوي على معرف المشروع. قد لا يكون المشروع قد حُفظ. تحقق من الـ Backend (مشاريع مقسمة شهرياً أو يومياً).');
        setLoading(false);
      } else {
        toast.error(response.data?.message || 'فشل إنشاء المشروع');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      console.error('Error response:', error.response?.data);

      // ✅ عرض أخطاء التحقق بشكل واضح
      if (error.response?.status === 422 && error.response?.data?.errors) {
        console.error('❌ Validation Errors:', error.response.data.errors);
        console.error('📋 Failed Fields:', Object.keys(error.response.data.errors));

        // عرض كل خطأ على حدة
        Object.entries(error.response.data.errors).forEach(([field, messages]) => {
          console.error(`   ❌ ${field}:`, messages);
        });
      }

      console.error('Error request data:', {
        donor_code: formData.donor_code || null,
        project_name: formData.project_name || null,
        project_description: formData.description,
        donor_name: formData.donor_name,
        project_type: formData.project_type,
        donation_amount: parseFloat(formData.donation_amount),
        currency_id: parseInt(formData.currency_id),
        admin_discount_percentage: parseFloat(formData.discount_percentage),
        estimated_duration_days: parseInt(formData.estimated_duration_days),
        notes: formData.notes || null,
      });

      // ✅ معالجة خاصة لأخطاء الصلاحيات (403)
      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لإضافة مشروع. الصلاحيات مقتصرة على الإدارة فقط.';
        toast.error(permissionMessage);
        // إعادة توجيه إلى صفحة المشاريع بعد 2 ثانية
        setTimeout(() => {
          navigate('/project-management/projects');
        }, 2000);
        return;
      }

      // ✅ معالجة خاصة لأخطاء Validation (400 & 422)
      if (error.response?.status === 400 || error.response?.status === 422) {
        const errorData = error.response?.data;
        let errorMessage = error.response?.status === 422
          ? 'يرجى التحقق من البيانات المدخلة'
          : 'حدث خطأ في البيانات المرسلة';

        // 🔍 Debug: عرض تفاصيل الخطأ
        console.error(`❌ Validation Error (${error.response?.status}):`, {
          errorData,
          requestPayload: formData.notes_image ? 'FormData' : {
            project_name: formData.project_name,
            project_description: formData.description || '(فارغ/null)',
            donor_name: formData.donor_name,
            project_type: formData.project_type,
          },
          formData: {
            description: formData.description,
            descriptionTrimmed: formData.description?.trim(),
            descriptionIsEmpty: !formData.description?.trim(),
          }
        });

        // عرض أخطاء Validation من الـ Backend
        if (errorData?.errors) {
          // Laravel validation errors
          const validationErrors = Object.values(errorData.errors).flat();
          errorMessage = validationErrors.join(', ') || errorData.message || errorMessage;

          // 🔍 Debug: عرض أخطاء الحقول بتفصيل
          console.error('❌ Field Errors:', errorData.errors);
          console.error('📋 Fields with errors:', Object.keys(errorData.errors));

          // عرض كل خطأ بشكل منفصل للوضوح
          Object.entries(errorData.errors).forEach(([field, messages]) => {
            console.error(`   ❌ ${field}:`, Array.isArray(messages) ? messages : [messages]);
          });
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        }

        // ✅ عرض رسالة خطأ مفصلة مع الحقول المطلوبة
        if (errorData?.errors && Object.keys(errorData.errors).length > 0) {
          const missingFields = Object.keys(errorData.errors).join(', ');
          toast.error(`الحقول التالية تحتوي على أخطاء: ${missingFields}`, {
            autoClose: 8000,
            position: 'top-center'
          });
        } else {
          toast.error(errorMessage);
        }

        // عرض الأخطاء في الحقول
        if (errorData?.errors) {
          const fieldErrors = {};
          Object.keys(errorData.errors).forEach((field) => {
            fieldErrors[field] = errorData.errors[field][0];
          });
          setErrors(fieldErrors);
        }

        return;
      }

      // عرض رسالة خطأ واضحة
      let errorMessage = 'حدث خطأ أثناء إنشاء المشروع';

      if (error.response?.status === 500) {
        // خطأ في الـ Backend
        const backendError = error.response?.data?.message || error.userMessage || '';
        if (backendError.includes('project_id') || backendError.includes('project_timeline')) {
          errorMessage = 'خطأ في الـ Backend: يرجى التحقق من إعدادات قاعدة البيانات. المشكلة: ' + backendError;
        } else {
          errorMessage = 'خطأ في الخادم (500). يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني.';
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.userMessage) {
        errorMessage = error.userMessage;
      }

      toast.error(errorMessage);

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

  const selectedCurrency = currencies.find((c) => c.id === parseInt(formData.currency_id));

  // ✅ انتظار تحميل بيانات المستخدم أولاً
  // if (authLoading) {
  //   return (
  //     <div className="flex justify-center items-center min-h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
  //     </div>
  //   );
  // }

  // ✅ التحقق من الصلاحيات - فقط Admin يمكنه إضافة مشروع
  // 🔍 Debug: عرض معلومات المستخدم
  console.log('🔐 NewProject Permission Check:');
  console.log('  - User:', user);
  console.log('  - User Role:', user?.role);
  console.log('  - User Role (alternative):', user?.userRole || user?.user_role || user?.role_name);
  console.log('  - User Object Keys:', user ? Object.keys(user) : 'No user');
  console.log('  - Full User Object:', JSON.stringify(user, null, 2));

  // ✅ البحث عن role في أماكن مختلفة
  const userRole = user?.role?.toLowerCase?.() ||
    user?.userRole?.toLowerCase?.() ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role || '';

  // ✅ التحقق الصارم: فقط Admin يمكنه الدخول
  const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

  console.log('  - Normalized Role:', userRole || 'NOT FOUND');
  console.log('  - User ID:', user?.id);
  console.log('  - Final Check - Is Admin?', isAdmin);

  // ✅ التحقق: إذا لم يكن Admin، نمنع الوصول
  // ⚠️ لكن نسمح بالدخول إذا كان user موجود (حل مؤقت حتى يتم إصلاح Backend)
  if (!user) {
    console.warn('⚠️ Access Denied - No user found');
    return <Unauthorized requiredRole="admin" pageName="إضافة مشروع جديد" />;
  }

  // ✅ إذا كان role موجود وليس admin، نمنع الوصول
  if (userRole && !isAdmin) {
    console.warn('⚠️ Access Denied - User is not Admin');
    console.warn('  - User Role:', user.role);
    console.warn('  - Normalized:', userRole);
    return <Unauthorized requiredRole="admin" pageName="إضافة مشروع جديد" />;
  }

  // ✅ إذا كان role غير موجود، نسمح بالدخول (حل مؤقت - على افتراض أنه Admin)
  if (!userRole) {
    console.warn('⚠️ WARNING: User role is not found! Allowing access (assuming Admin).');
    console.warn('  - Please check Backend login response - it should include "role" field');
  }

  console.log('✅ Access Granted - User is Admin (or role not found, allowing access)');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 pt-4">
          <button
            onClick={() => navigate('/project-management/projects')}
            className="flex items-center text-sky-600 hover:text-sky-700 font-medium mb-4"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            العودة إلى القائمة
          </button>
          <h1 className="text-3xl font-bold text-gray-800">إنشاء مشروع جديد</h1>
          <p className="text-gray-600 mt-2">أدخل تفاصيل المشروع الجديد</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Info Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4">المعلومات الأساسية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  كود المتبرع (اختياري)
                </label>
                <input
                  type="text"
                  name="donor_code"
                  value={formData.donor_code}
                  onChange={handleChange}
                  placeholder="مثال: DON-2024-001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الجهة المتبرعة *
                </label>
                <input
                  type="text"
                  name="donor_name"
                  value={formData.donor_name}
                  onChange={handleChange}
                  placeholder="اسم المتبرع أو الجهة"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.donor_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {errors.donor_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.donor_name}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم المشروع *
                </label>
                <input
                  type="text"
                  name="project_name"
                  value={formData.project_name}
                  onChange={handleChange}
                  placeholder="مثال: حملة سقيا الماء - شمال غزة"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.project_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {errors.project_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.project_name}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وصف المشروع (اختياري)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="وصف تفصيلي للمشروع..."
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع المشروع *
                </label>
                <select
                  name="project_type"
                  value={formData.project_type}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.project_type ? 'border-red-500' : 'border-gray-300'
                    }`}
                >
                  <option value="">اختر النوع</option>
                  {projectTypesLoading ? (
                    <option value="" disabled>جاري تحميل الأنواع...</option>
                  ) : (
                    (projectTypes.length > 0 ? projectTypes : DEFAULT_PROJECT_TYPES.map((name, index) => ({ id: index + 1, name }))).map((type, index) => {
                      const typeName = typeof type === 'string' ? type : (type.name || type);
                      const key = (typeof type === 'object' && type.id != null)
                        ? `type-${type.id}`
                        : `type-${typeName}-${index}`;
                      return (
                        <option key={key} value={typeName}>
                          {typeName}
                        </option>
                      );
                    })
                  )}
                </select>
                {errors.project_type && (
                  <p className="text-red-500 text-sm mt-1">{errors.project_type}</p>
                )}
              </div>

              {formData.project_type && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    التفرعية <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="subcategory_id"
                    value={formData.subcategory_id}
                    onChange={handleChange}
                    disabled={subcategoriesLoading}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.subcategory_id ? 'border-red-500' : 'border-gray-300'
                      } ${subcategoriesLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    required
                  >
                    <option value="">اختر التفرعية</option>
                    {subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name_ar || sub.name}
                      </option>
                    ))}
                  </select>
                  {subcategoriesLoading && (
                    <p className="text-gray-500 text-sm mt-1">جاري تحميل التفريعات...</p>
                  )}
                  {errors.subcategory_id && (
                    <p className="text-red-500 text-sm mt-1">{errors.subcategory_id}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المدة التقديرية للتنفيذ (أيام) *
                </label>
                <input
                  type="number"
                  name="estimated_duration_days"
                  value={formData.estimated_duration_days}
                  onChange={handleChange}
                  min="1"
                  placeholder="عدد الأيام"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.estimated_duration_days ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {errors.estimated_duration_days && (
                  <p className="text-red-500 text-sm mt-1">{errors.estimated_duration_days}</p>
                )}
              </div>
            </div>
          </div>

          {/* Financial Info Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <DollarSign className="w-6 h-6 ml-2 text-green-600" />
              المعلومات المالية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  مبلغ التبرع *
                </label>
                <input
                  type="number"
                  name="donation_amount"
                  value={formData.donation_amount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.donation_amount ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {errors.donation_amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.donation_amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">العملة *</label>
                <select
                  name="currency_id"
                  value={formData.currency_id}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.currency_id ? 'border-red-500' : 'border-gray-300'
                    }`}
                >
                  <option value="">اختر العملة</option>
                  {currencies.map((currency) => (
                    <option key={currency.id} value={currency.id}>
                      {currency.currency_name} ({currency.currency_code})
                    </option>
                  ))}
                </select>
                {errors.currency_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.currency_id}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نسبة الخصم الإداري (%) *
                </label>
                <input
                  type="number"
                  name="discount_percentage"
                  value={formData.discount_percentage}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="0"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.discount_percentage ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {errors.discount_percentage && (
                  <p className="text-red-500 text-sm mt-1">{errors.discount_percentage}</p>
                )}
              </div>
            </div>

            {/* Calculator Display */}
            {formData.donation_amount && formData.currency_id && (
              <div className="mt-6 bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-6 border border-sky-200">
                <div className="flex items-center mb-4">
                  <Calculator className="w-5 h-5 ml-2 text-sky-600" />
                  <h3 className="font-bold text-gray-800">الحاسبة الفورية</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-600 mb-1">سعر الصرف</p>
                    <p className="text-xl font-bold text-gray-800">
                      {selectedCurrency?.exchange_rate_to_usd || 0} $
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-600 mb-1">المبلغ بالدولار</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(calculatedValues.amountInUsd)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <p className="text-sm text-gray-600 mb-1">
                      المبلغ الصافي (بعد الخصم {formData.discount_percentage}%)
                    </p>
                    <p className="text-2xl font-bold text-sky-600">
                      {formatCurrency(calculatedValues.netAmount)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Phase Division Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <Clock className="w-6 h-6 ml-2 text-purple-600" />
              تقسيم المشروع على مراحل
            </h2>

            <div className="space-y-6">
              {/* Toggle Switch */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    تفعيل تقسيم المشروع على مراحل
                  </label>
                  <p className="text-xs text-gray-500">
                    عند التفعيل، يمكنك اختيار التقسيم اليومي أو الشهري. سيتم تقسيم المبلغ الإجمالي حسب النوع المختار
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_divided_into_phases}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        is_divided_into_phases: e.target.checked,
                        phase_type: e.target.checked ? formData.phase_type : 'daily',
                        phase_duration_days: e.target.checked ? formData.phase_duration_days : '',
                        total_months: e.target.checked ? formData.total_months : '',
                        phase_start_date: e.target.checked ? formData.phase_start_date : '',
                      });
                      // إزالة الأخطاء عند إلغاء التفعيل
                      if (!e.target.checked) {
                        setErrors({
                          ...errors,
                          phase_type: '',
                          phase_duration_days: '',
                          total_months: '',
                          phase_start_date: '',
                        });
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Phase Fields - تظهر فقط عند تفعيل التقسيم */}
              {formData.is_divided_into_phases && (
                <div className="space-y-6 p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                  {/* نوع التقسيم */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      نوع التقسيم *
                    </label>
                    <select
                      name="phase_type"
                      value={formData.phase_type}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.phase_type ? 'border-red-500' : 'border-gray-300'}`}
                    >
                      <option value="daily">يومي</option>
                      <option value="monthly">شهري</option>
                    </select>
                    {errors.phase_type && (
                      <p className="text-red-500 text-sm mt-1">{errors.phase_type}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* حقل عدد الأيام (للتقسيم اليومي) */}
                    {formData.phase_type === 'daily' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          عدد أيام التقسيم *
                        </label>
                        <input
                          type="number"
                          name="phase_duration_days"
                          value={formData.phase_duration_days}
                          onChange={handleChange}
                          min="1"
                          placeholder="مثال: 30"
                          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.phase_duration_days ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        {errors.phase_duration_days && (
                          <p className="text-red-500 text-sm mt-1">{errors.phase_duration_days}</p>
                        )}
                      </div>
                    )}

                    {/* حقل عدد الشهور (للتقسيم الشهري) */}
                    {formData.phase_type === 'monthly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          عدد الشهور *
                        </label>
                        <input
                          type="number"
                          name="total_months"
                          value={formData.total_months}
                          onChange={handleChange}
                          min="1"
                          placeholder="مثال: 6"
                          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.total_months ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        {errors.total_months && (
                          <p className="text-red-500 text-sm mt-1">{errors.total_months}</p>
                        )}
                      </div>
                    )}

                    {/* تاريخ بداية المراحل */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        تاريخ بداية المراحل *
                      </label>
                      <input
                        type="date"
                        name="phase_start_date"
                        value={formData.phase_start_date}
                        onChange={handleChange}
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.phase_start_date ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.phase_start_date && (
                        <p className="text-red-500 text-sm mt-1">{errors.phase_start_date}</p>
                      )}
                    </div>
                  </div>

                  {/* عرض المبلغ المحسوب */}
                  {calculatedValues.netAmount > 0 && (
                    <div className="bg-white rounded-lg p-4 border-2 border-purple-300">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="w-5 h-5 text-purple-600" />
                        <span className="font-semibold text-gray-800">
                          {formData.phase_type === 'daily' ? 'المبلغ اليومي المحسوب:' : 'المبلغ الشهري المحسوب:'}
                        </span>
                      </div>
                      {formData.phase_type === 'daily' && formData.phase_duration_days && (
                        <>
                          <p className="text-2xl font-bold text-purple-600">
                            {formatCurrency(calculatedValues.netAmount / parseInt(formData.phase_duration_days))}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            المبلغ الصافي ({formatCurrency(calculatedValues.netAmount)}) ÷ {formData.phase_duration_days} يوم
                          </p>
                        </>
                      )}
                      {formData.phase_type === 'monthly' && formData.total_months && (
                        <>
                          <p className="text-2xl font-bold text-purple-600">
                            {formatCurrency(calculatedValues.netAmount / parseInt(formData.total_months))}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            المبلغ الصافي ({formatCurrency(calculatedValues.netAmount)}) ÷ {formData.total_months} شهر
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Urgent Project Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <AlertCircle className="w-6 h-6 ml-2 text-amber-600" />
              إعدادات المشروع
            </h2>
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border-2 border-amber-200">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1 cursor-pointer">
                  مشروع عاجل
                </label>
                <p className="text-xs text-gray-500">
                  حدد هذا الخيار إذا كان المشروع يحتاج إلى متابعة عاجلة
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_urgent"
                  checked={formData.is_urgent}
                  onChange={(e) => setFormData({ ...formData, is_urgent: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
          </div>

          {/* Notes Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4">ملاحظات إضافية</h2>

            {/* Notes Text */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الملاحظات النصية
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="ملاحظات أو تعليقات إضافية (اختياري)..."
                rows="4"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Notes Images */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                صور الملاحظات (يمكن اختيار عدة صور)
              </label>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="file"
                    name="notes_image"
                    accept="image/*"
                    multiple
                    onChange={handleChange}
                    className="hidden"
                    id="notes_image_input_new"
                  />
                  <label
                    htmlFor="notes_image_input_new"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl transition-all duration-300 cursor-pointer hover:border-sky-400 hover:bg-sky-50"
                  >
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600 font-medium">
                      {formData.notes_image ? 'تغيير الصور' : 'اختر صوراً للملاحظات'}
                    </span>
                  </label>
                </div>

                {errors.notes_image && (
                  <p className="text-sm text-red-600">{errors.notes_image}</p>
                )}

                {/* Image Previews */}
                {(noteImages.length > 0 || notesImagePreview) && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">الصور المختارة:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {noteImages.map((file, index) => (
                        <NoteImagePreview
                          key={`${file.name}-${index}`}
                          file={file}
                          index={index}
                          onRemove={removeSpecificImage}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/project-management/projects')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-8 py-3 rounded-xl font-medium flex items-center hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></div>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 ml-2" />
                  حفظ المشروع
                </>
              )}
            </button>
          </div>
        </form>
      </div>


    </div>
  );
};

export default NewProject;


