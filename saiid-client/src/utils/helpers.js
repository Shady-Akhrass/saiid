/**
 * ✅ Helper Functions - Improved Version
 * دوال مساعدة محسّنة ومنظمة
 */

// ✅ Name Utilities
export const concatenateNames = (nameObj) => {
  if (!nameObj) return '';
  return [
    nameObj.first_name,
    nameObj.fathers_name,
    nameObj.grandfathers_name,
    nameObj.last_name,
  ].filter(Boolean).join(' ');
};

export const parseFullName = (fullName) => {
  if (!fullName) return { first: '', father: '', grandfather: '', last: '' };
  const parts = fullName.split(' ');
  return {
    first: parts[0] || '',
    father: parts[1] || '',
    grandfather: parts[2] || '',
    last: parts[3] || ''
  };
};

// ✅ Orphan Data Utilities
export const parseOrphanData = (orphanData) => {
  if (!orphanData) return null;

  const orphanNames = parseFullName(orphanData.orphan_full_name);
  const guardianNames = parseFullName(orphanData.guardian_full_name);
  const fatherNames = parseFullName(orphanData.deceased_father_full_name);
  const motherNames = parseFullName(orphanData.mother_full_name);

  return {
    orphan: {
      orphan_id_number: orphanData.orphan_id_number || '',
      orphan_first_name: orphanNames.first,
      orphan_fathers_name: orphanNames.father,
      orphan_grandfathers_name: orphanNames.grandfather,
      orphan_last_name: orphanNames.last,
      orphan_full_name: orphanData.orphan_full_name || '',
      orphan_birth_date: orphanData.orphan_birth_date || '',
      orphan_gender: orphanData.orphan_gender || '',
      health_status: orphanData.health_status || '',
      disease_description: orphanData.disease_description || '',
      original_address: orphanData.original_address || '',
      current_address: orphanData.current_address || '',
      address_details: orphanData.address_details || '',
      number_of_brothers: orphanData.number_of_brothers || '',
      number_of_sisters: orphanData.number_of_sisters || '',
      is_enrolled_in_memorization_center: orphanData.is_enrolled_in_memorization_center || '',
      orphan_photo: '',
    },
    guardian: {
      guardian_id_number: orphanData.guardian_id_number || '',
      guardian_first_name: guardianNames.first,
      guardian_fathers_name: guardianNames.father,
      guardian_grandfathers_name: guardianNames.grandfather,
      guardian_last_name: guardianNames.last,
      guardian_full_name: orphanData.guardian_full_name || '',
      guardian_relationship: orphanData.guardian_relationship || '',
      guardian_phone_number: orphanData.guardian_phone_number || '',
      alternative_phone_number: orphanData.alternative_phone_number || '',
    },
    father: {
      father_first_name: fatherNames.first,
      father_fathers_name: fatherNames.father,
      father_grandfathers_name: fatherNames.grandfather,
      father_last_name: fatherNames.last,
      deceased_father_full_name: orphanData.deceased_father_full_name || '',
      deceased_father_birth_date: orphanData.deceased_father_birth_date || '',
      death_date: orphanData.death_date || '',
      death_cause: orphanData.death_cause || '',
      previous_father_job: orphanData.previous_father_job || '',
      death_certificate: '',
    },
    mother: {
      mother_first_name: motherNames.first,
      mother_fathers_name: motherNames.father,
      mother_grandfathers_name: motherNames.grandfather,
      mother_last_name: motherNames.last,
      mother_full_name: orphanData.mother_full_name || '',
      mother_id_number: orphanData.mother_id_number || '',
      is_mother_deceased: orphanData.is_mother_deceased || '',
      mother_birth_date: orphanData.mother_birth_date || '',
      mother_death_date: orphanData.mother_death_date || '',
      mother_status: orphanData.mother_status || '',
      mother_job: orphanData.mother_job || '',
    },
    approval: {
      data_approval_name: orphanData.data_approval_name || '',
      isChecked: false
    }
  };
};

// ✅ Project Utilities
/**
 * الحصول على كود المشروع الموحد
 * يعيد كود المتبرع إذا كان موجوداً، وإلا يعيد الكود الداخلي
 * 
 * @param {Object} project - كائن المشروع
 * @param {string} fallback - القيمة الافتراضية إذا لم يكن هناك كود (افتراضي: '---')
 * @returns {string} - كود المشروع
 */
export const getProjectCode = (project, fallback = '---') => {
  if (!project) return fallback;

  // ✅ إذا كان donor_code موجوداً وليس فارغاً، استخدمه
  const donorCode = project?.donor_code;
  const internalCode = project?.internal_code;

  // ✅ تحويل إلى string والتحقق من أنه ليس فارغاً
  const donorCodeStr = donorCode ? String(donorCode).trim() : '';
  const internalCodeStr = internalCode ? String(internalCode).trim() : '';

  // ✅ إرجاع donor_code إذا كان موجوداً، وإلا internal_code
  if (donorCodeStr) {
    return donorCodeStr;
  }

  if (internalCodeStr) {
    return internalCodeStr;
  }

  return fallback;
};

/**
 * استخراج اسم المصور من المشروع
 * يبحث في: photographer المباشر -> team.photographers -> team.activeMembers
 * 
 * @param {Object} project - كائن المشروع
 * @returns {string|null} - اسم المصور أو null
 */
export const getPhotographerName = (project) => {
  if (!project) return null;

  // أولاً: محاولة استخدام photographer المباشر
  if (project?.photographer?.name) {
    return project.photographer.name;
  }

  // ثانياً: البحث في الفريق المكلف
  const team = project?.assigned_to_team || project?.assigned_team || project?.assignedToTeam;
  if (!team) return null;

  // محاولة استخدام photographers relationship
  if (team.photographers?.length > 0) {
    return team.photographers[0].name || null;
  }

  // البحث في activeMembers
  const members = team.activeMembers || team.active_members || team.members || [];
  const photographer = members.find((member) => member?.personnel_type === 'مصور');
  return photographer?.name || null;
};

// ✅ Date Utilities
/**
 * تنسيق التاريخ للعرض
 * @param {string|Date} date - التاريخ
 * @param {string} locale - اللغة (افتراضي: 'ar-EG')
 * @returns {string} التاريخ المنسق
 */
export const formatDate = (date, locale = 'ar-EG') => {
  if (!date) return 'غير محدد';
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'غير محدد';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(dateObj);
  } catch {
    return 'غير محدد';
  }
};

/**
 * تنسيق التاريخ والوقت
 * @param {string|Date} date - التاريخ
 * @param {string} locale - اللغة (افتراضي: 'ar-EG')
 * @returns {string} التاريخ والوقت المنسق
 */
export const formatDateTime = (date, locale = 'ar-EG') => {
  if (!date) return 'غير محدد';
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'غير محدد';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  } catch {
    return 'غير محدد';
  }
};

/**
 * حساب الفرق بين تاريخين بالأيام
 * @param {string|Date} date1 - التاريخ الأول
 * @param {string|Date} date2 - التاريخ الثاني
 * @returns {number} عدد الأيام
 */
export const getDaysDifference = (date1, date2) => {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};

// ✅ Number Utilities
/**
 * تنسيق الأرقام للعرض
 * @param {number} number - الرقم
 * @param {string} locale - اللغة (افتراضي: 'ar-EG')
 * @returns {string} الرقم المنسق
 */
export const formatNumber = (number, locale = 'ar-EG') => {
  if (number === null || number === undefined || isNaN(number)) return '-';
  return new Intl.NumberFormat(locale).format(number);
};

/**
 * تنسيق المبلغ (مع العملة)
 * @param {number} amount - المبلغ
 * @param {string} currency - العملة (افتراضي: 'USD')
 * @param {string} locale - اللغة (افتراضي: 'ar-EG')
 * @returns {string} المبلغ المنسق
 */
export const formatCurrency = (amount, currency = 'USD', locale = 'ar-EG') => {
  if (amount === null || amount === undefined || isNaN(amount)) return '-';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

// ✅ Validation Utilities
/**
 * التحقق من صحة البريد الإلكتروني
 * @param {string} email - البريد الإلكتروني
 * @returns {boolean} true إذا كان صحيحاً
 */
export const isValidEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * التحقق من صحة رقم الهاتف
 * @param {string} phone - رقم الهاتف
 * @returns {boolean} true إذا كان صحيحاً
 */
export const isValidPhone = (phone) => {
  if (!phone) return false;
  const phoneRegex = /^[0-9]{10,15}$/;
  return phoneRegex.test(phone.replace(/\s+/g, ''));
};

/**
 * التحقق من صحة رقم الهوية
 * @param {string} idNumber - رقم الهوية
 * @returns {boolean} true إذا كان صحيحاً
 */
export const isValidIdNumber = (idNumber) => {
  if (!idNumber) return false;
  const idRegex = /^[0-9]{9,11}$/;
  return idRegex.test(idNumber);
};

// ✅ String Utilities
/**
 * تقليم النص وإضافة ...
 * @param {string} text - النص
 * @param {number} maxLength - الطول الأقصى
 * @returns {string} النص المختصر
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * تحويل النص إلى حالة العنوان (Title Case)
 * @param {string} text - النص
 * @returns {string} النص المحول
 */
export const toTitleCase = (text) => {
  if (!text) return '';
  return text.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

// ✅ Array Utilities
/**
 * إزالة العناصر المكررة من المصفوفة
 * @param {Array} array - المصفوفة
 * @param {string} key - المفتاح للتمييز (اختياري)
 * @returns {Array} المصفوفة بدون تكرار
 */
export const removeDuplicates = (array, key = null) => {
  if (!Array.isArray(array)) return [];
  if (key) {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
  return [...new Set(array)];
};

/**
 * تجميع العناصر حسب مفتاح
 * @param {Array} array - المصفوفة
 * @param {string} key - المفتاح للتجميع
 * @returns {Object} العناصر المجمعة
 */
export const groupBy = (array, key) => {
  if (!Array.isArray(array)) return {};
  return array.reduce((groups, item) => {
    const group = item[key];
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
    return groups;
  }, {});
};

// ✅ Object Utilities
/**
 * دمج كائنات بشكل عميق (Deep Merge)
 * @param {Object} target - الكائن الهدف
 * @param {Object} source - الكائن المصدر
 * @returns {Object} الكائن المدمج
 */
export const deepMerge = (target, source) => {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
};

/**
 * التحقق من أن القيمة كائن
 * @param {any} item - القيمة
 * @returns {boolean} true إذا كان كائن
 */
export const isObject = (item) => {
  return item && typeof item === 'object' && !Array.isArray(item);
};

/**
 * إزالة القيم الفارغة من الكائن
 * @param {Object} obj - الكائن
 * @returns {Object} الكائن بدون قيم فارغة
 */
export const removeEmptyValues = (obj) => {
  if (!isObject(obj)) return {};
  return Object.keys(obj).reduce((acc, key) => {
    const value = obj[key];
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {});
};

// ✅ Storage Utilities
/**
 * حفظ في localStorage بشكل آمن
 * @param {string} key - المفتاح
 * @param {any} value - القيمة
 * @returns {boolean} true إذا تم الحفظ بنجاح
 */
export const setLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Error saving to localStorage (${key}):`, error);
    return false;
  }
};

/**
 * جلب من localStorage بشكل آمن
 * @param {string} key - المفتاح
 * @param {any} defaultValue - القيمة الافتراضية
 * @returns {any} القيمة المحفوظة أو الافتراضية
 */
export const getLocalStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading from localStorage (${key}):`, error);
    return defaultValue;
  }
};

/**
 * حذف من localStorage بشكل آمن
 * @param {string} key - المفتاح
 * @returns {boolean} true إذا تم الحذف بنجاح
 */
export const removeLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Error removing from localStorage (${key}):`, error);
    return false;
  }
};

// ✅ Export all utilities
export default {
  // Name
  concatenateNames,
  parseFullName,
  parseOrphanData,
  // Project
  getProjectCode,
  getPhotographerName,
  // Date
  formatDate,
  formatDateTime,
  getDaysDifference,
  // Number
  formatNumber,
  formatCurrency,
  // Validation
  isValidEmail,
  isValidPhone,
  isValidIdNumber,
  // String
  truncateText,
  toTitleCase,
  // Array
  removeDuplicates,
  groupBy,
  // Object
  deepMerge,
  isObject,
  removeEmptyValues,
  // Storage
  setLocalStorage,
  getLocalStorage,
  removeLocalStorage,
};
