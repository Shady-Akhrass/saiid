/**
 * Project Proposals Fields Configuration
 * 
 * هذا الملف يحتوي على جميع تعريفات حقول جدول project_proposals
 * يمكن استيراده واستخدامه في الفرونت للتحقق من الحقول والتعامل معها
 * 
 * @version 1.0
 * @date 2026-01-11
 */

/**
 * جميع الحقول الحقيقية الموجودة في قاعدة البيانات
 * يمكن إرسال هذه الحقول فقط عند التحديث
 */
export const REAL_DATABASE_FIELDS = [
  // ==================== Basic Information ====================
  'id',
  'serial_number',
  'donor_code',
  'internal_code',
  'project_name',
  'project_description',
  'donor_name',
  'created_at',
  'updated_at',
  'created_by',

  // ==================== Classification ====================
  'project_type',
  'project_type_id',
  'subcategory_id',

  // ==================== Financial Information ====================
  'donation_amount',
  'currency_id',
  'exchange_rate',
  'amount_in_usd',
  'admin_discount_percentage',
  'discount_amount',
  'net_amount',
  'shekel_exchange_rate',
  'net_amount_shekel',
  'shekel_converted_at',
  'shekel_converted_by',

  // ==================== Execution Information ====================
  'quantity',
  'beneficiaries_count',
  'beneficiaries_per_unit',
  'estimated_duration_days',
  'is_urgent',

  // ==================== Supply & Surplus ====================
  'unit_cost',
  'supply_cost',
  'surplus_amount',
  'has_deficit',
  'surplus_notes',
  'surplus_recorded_at',
  'surplus_recorded_by',
  'surplus_category_id',

  // ==================== Phasing ====================
  'is_divided_into_phases',
  'phase_type',
  'parent_project_id',
  'is_daily_phase',
  'phase_day',
  'phase_duration_days',
  'phase_start_date',
  'is_monthly_phase',
  'month_number',
  'total_months',
  'month_start_date',

  // ==================== Status & Assignment ====================
  'status',
  'assigned_to_team_id',
  'assigned_researcher_id',
  'assigned_photographer_id',
  'assigned_montage_producer_id',
  'assigned_by',
  'assignment_date',
  'montage_producer_assigned_at',

  // ==================== Dates ====================
  'execution_date',
  'media_received_date',
  'montage_start_date',
  'montage_completed_at',
  'montage_completed_date',
  'sent_to_donor_date',
  'completed_date',

  // ==================== Integration ====================
  'shelter_id',
  'transferred_to_projects',
  'project_id',

  // ==================== Files & Notes ====================
  'notes',
  'notes_image',
  'project_image',
  'beneficiaries_excel_file',

  // ==================== Rejection Reasons ====================
  'rejection_reason',
  'rejection_message',
  'admin_rejection_reason',
  'media_rejection_reason'
];

/**
 * الحقول المحسوبة/الوهمية (Accessors)
 * هذه الحقول تأتي من الباك اند للعرض فقط - لا ترسلها عند التحديث
 */
export const COMPUTED_FIELDS = [
  'project_image_url',
  'notes_image_url',
  'notes_image_download_url',
  'beneficiaries_excel_url',
  'remaining_days',
  'is_delayed',
  'delayed_days',
  'calculated_beneficiaries',
  'sponsored_orphans_count',
  'has_sponsored_orphans'
];

/**
 * العلاقات (Relationships)
 * تأتي من الباك اند كـ nested objects
 * عند التحديث، أرسل فقط الـ IDs (مثل currency_id وليس currency)
 */
export const RELATIONSHIP_FIELDS = [
  'currency',
  'projectType',
  'subcategory',
  'assignedToTeam',
  'assignedResearcher',
  'photographer',
  'assignedMontageProducer',
  'assignedBy',
  'shelter',
  'creator',
  'parentProject',
  'executedProject',
  'dailyPhases',
  'monthlyPhases',
  'timeline',
  'notifications',
  'warehouseItems',
  'confirmedWarehouseItems',
  'pendingWarehouseItems',
  'surplusRecorder',
  'surplusCategory',
  'mediaArchives',
  'beneficiaries',
  'sponsoredOrphans',
  'recurringOrphans'
];

/**
 * الحقول التي يتم حسابها تلقائياً
 * يمكن قراءتها لكن لا ترسلها عند التحديث (الباك اند يحسبها)
 */
export const AUTO_CALCULATED_FIELDS = [
  'amount_in_usd',      // = donation_amount × exchange_rate
  'discount_amount',    // = amount_in_usd × admin_discount_percentage / 100
  'net_amount',         // = amount_in_usd - discount_amount
  'serial_number',      // يُولّد تلقائياً
  'internal_code',      // يُولّد تلقائياً (7 أرقام)
  'unit_cost',          // يُحسب من warehouse items
  'supply_cost',        // = unit_cost × quantity
  'surplus_amount'      // = net_amount - supply_cost
];

/**
 * الحقول الإلزامية (Required)
 * لا يمكن إرسال null لهذه الحقول
 */
export const REQUIRED_FIELDS = [
  'project_description',
  'donor_name',
  'donation_amount',
  'currency_id',
  'exchange_rate',
  'status',
  'created_by'
];

/**
 * الحقول القابلة للإفراغ (Nullable)
 * يمكن إرسال null لإفراغ هذه الحقول
 */
export const NULLABLE_FIELDS = [
  'donor_code',
  'internal_code',
  'project_name',
  'project_type_id',
  'subcategory_id',
  'quantity',
  'beneficiaries_count',
  'beneficiaries_per_unit',
  'estimated_duration_days',
  'unit_cost',
  'supply_cost',
  'surplus_amount',
  'surplus_notes',
  'surplus_recorded_at',
  'surplus_recorded_by',
  'surplus_category_id',
  'phase_duration_days',
  'phase_start_date',
  'month_number',
  'total_months',
  'month_start_date',
  'assigned_to_team_id',
  'assigned_researcher_id',
  'assigned_photographer_id',
  'assigned_montage_producer_id',
  'assigned_by',
  'assignment_date',
  'montage_producer_assigned_at',
  'execution_date',
  'media_received_date',
  'montage_start_date',
  'montage_completed_at',
  'montage_completed_date',
  'sent_to_donor_date',
  'completed_date',
  'shelter_id',
  'orphan_group_id',
  'selected_orphan_ids',
  'project_id',
  'notes',
  'notes_image',
  'project_image',
  'beneficiaries_excel_file',
  'rejection_reason',
  'rejection_message',
  'admin_rejection_reason',
  'media_rejection_reason',
  'parent_project_id',
  'phase_day',
  'shekel_exchange_rate',
  'net_amount_shekel',
  'shekel_converted_at',
  'shekel_converted_by'
];

/**
 * أنواع البيانات لكل حقل
 */
export const FIELD_TYPES = {
  // Numbers
  id: 'number',
  currency_id: 'number',
  project_type_id: 'number',
  subcategory_id: 'number',
  quantity: 'number',
  beneficiaries_count: 'number',
  beneficiaries_per_unit: 'number',
  estimated_duration_days: 'number',
  phase_day: 'number',
  phase_duration_days: 'number',
  month_number: 'number',
  total_months: 'number',
  assigned_to_team_id: 'number',
  assigned_researcher_id: 'number',
  assigned_photographer_id: 'number',
  assigned_montage_producer_id: 'number',
  assigned_by: 'number',
  created_by: 'number',
  surplus_recorded_by: 'number',
  surplus_category_id: 'number',
  project_id: 'number',
  parent_project_id: 'number',
  shekel_converted_by: 'number',

  // Decimals
  donation_amount: 'decimal',
  exchange_rate: 'decimal',
  amount_in_usd: 'decimal',
  admin_discount_percentage: 'decimal',
  discount_amount: 'decimal',
  net_amount: 'decimal',
  shekel_exchange_rate: 'decimal',
  net_amount_shekel: 'decimal',
  unit_cost: 'decimal',
  supply_cost: 'decimal',
  surplus_amount: 'decimal',

  // Strings
  serial_number: 'string',
  donor_code: 'string',
  internal_code: 'string',
  project_name: 'string',
  project_description: 'string',
  donor_name: 'string',
  project_type: 'string',
  phase_type: 'string',
  status: 'string',
  shelter_id: 'string',
  notes: 'string',
  notes_image: 'string',
  project_image: 'string',
  beneficiaries_excel_file: 'string',
  rejection_reason: 'string',
  rejection_message: 'string',
  admin_rejection_reason: 'string',
  media_rejection_reason: 'string',
  surplus_notes: 'string',

  // Booleans
  is_urgent: 'boolean',
  has_deficit: 'boolean',
  is_divided_into_phases: 'boolean',
  is_daily_phase: 'boolean',
  is_monthly_phase: 'boolean',
  transferred_to_projects: 'boolean',

  // Dates
  assignment_date: 'date',
  phase_start_date: 'date',
  month_start_date: 'date',
  execution_date: 'date',
  media_received_date: 'date',
  montage_start_date: 'date',
  montage_completed_date: 'date',
  sent_to_donor_date: 'date',
  completed_date: 'date',

  // Datetimes
  created_at: 'datetime',
  updated_at: 'datetime',
  montage_completed_at: 'datetime',
  montage_producer_assigned_at: 'datetime',
  surplus_recorded_at: 'datetime',
  shekel_converted_at: 'datetime'
};

/**
 * حالات المشروع المتاحة
 */
export const PROJECT_STATUSES = [
  'جديد',
  'قيد التوريد',
  'تم التوريد',
  'قيد التوزيع',
  'مسند لباحث',
  'جاهز للتنفيذ',
  'تم اختيار المخيم',
  'قيد التنفيذ',
  'تم التنفيذ',
  'منفذ',
  'في المونتاج',
  'تم المونتاج',
  'يجب إعادة المونتاج',
  'وصل للمتبرع',
  'منتهي',
  'ملغى',
  'مؤجل'
];

/**
 * أنواع التقسيم
 */
export const PHASE_TYPES = {
  DAILY: 'daily',
  MONTHLY: 'monthly',
  NONE: null
};

/**
 * مجموعات الحقول حسب الفئة (للتنظيم في الفورم)
 */
export const FIELD_GROUPS = {
  basic: [
    'serial_number',
    'donor_code',
    'internal_code',
    'project_name',
    'project_description',
    'donor_name'
  ],

  classification: [
    'project_type',
    'project_type_id',
    'subcategory_id'
  ],

  financial: [
    'donation_amount',
    'currency_id',
    'exchange_rate',
    'amount_in_usd',
    'admin_discount_percentage',
    'discount_amount',
    'net_amount'
  ],

  shekel: [
    'shekel_exchange_rate',
    'net_amount_shekel',
    'shekel_converted_at',
    'shekel_converted_by'
  ],

  execution: [
    'quantity',
    'beneficiaries_count',
    'beneficiaries_per_unit',
    'estimated_duration_days',
    'is_urgent'
  ],

  supply: [
    'unit_cost',
    'supply_cost',
    'surplus_amount',
    'has_deficit',
    'surplus_notes',
    'surplus_recorded_at',
    'surplus_recorded_by',
    'surplus_category_id'
  ],

  phasing: [
    'is_divided_into_phases',
    'phase_type',
    'parent_project_id',
    'is_daily_phase',
    'phase_day',
    'phase_duration_days',
    'phase_start_date',
    'is_monthly_phase',
    'month_number',
    'total_months',
    'month_start_date'
  ],

  assignment: [
    'status',
    'assigned_to_team_id',
    'assigned_researcher_id',
    'assigned_photographer_id',
    'assigned_montage_producer_id',
    'assigned_by',
    'assignment_date',
    'montage_producer_assigned_at'
  ],

  dates: [
    'execution_date',
    'media_received_date',
    'montage_start_date',
    'montage_completed_at',
    'montage_completed_date',
    'sent_to_donor_date',
    'completed_date'
  ],

  integration: [
    'shelter_id',
    'transferred_to_projects',
    'project_id'
  ],

  files: [
    'notes',
    'notes_image',
    'project_image',
    'beneficiaries_excel_file'
  ],

  rejection: [
    'rejection_reason',
    'rejection_message',
    'admin_rejection_reason',
    'media_rejection_reason'
  ]
};

/**
 * التسميات العربية للحقول (للعرض في الواجهة)
 */
export const FIELD_LABELS_AR = {
  id: 'المعرف',
  serial_number: 'الرقم التسلسلي',
  donor_code: 'كود المتبرع',
  internal_code: 'الكود الداخلي',
  project_name: 'اسم المشروع',
  project_description: 'وصف المشروع',
  donor_name: 'اسم المتبرع',
  project_type: 'نوع المشروع',
  project_type_id: 'معرف نوع المشروع',
  subcategory_id: 'التفريعة',
  donation_amount: 'مبلغ التبرع',
  currency_id: 'العملة',
  exchange_rate: 'سعر الصرف',
  amount_in_usd: 'المبلغ بالدولار',
  admin_discount_percentage: 'نسبة الخصم الإداري (%)',
  discount_amount: 'قيمة الخصم',
  net_amount: 'المبلغ الصافي',
  shekel_exchange_rate: 'سعر صرف الشيكل',
  net_amount_shekel: 'المبلغ بالشيكل',
  quantity: 'الكمية',
  beneficiaries_count: 'عدد المستفيدين',
  beneficiaries_per_unit: 'عدد المستفيدين لكل طرد',
  estimated_duration_days: 'المدة المقدرة (أيام)',
  is_urgent: 'عاجل',
  unit_cost: 'تكلفة الطرد',
  supply_cost: 'تكلفة التوريد',
  surplus_amount: 'الوافر/العجز',
  has_deficit: 'يوجد عجز',
  surplus_notes: 'ملاحظات الوافر',
  surplus_category_id: 'فئة الوافر',
  is_divided_into_phases: 'مقسم لمراحل',
  phase_type: 'نوع التقسيم',
  phase_duration_days: 'مدة المرحلة (أيام)',
  phase_start_date: 'تاريخ بداية المرحلة',
  total_months: 'عدد الشهور',
  month_number: 'رقم الشهر',
  status: 'الحالة',
  assigned_researcher_id: 'الباحث المسند',
  assigned_photographer_id: 'المصور المسند',
  assigned_montage_producer_id: 'منتج المونتاج',
  assignment_date: 'تاريخ الإسناد',
  execution_date: 'تاريخ التنفيذ',
  media_received_date: 'تاريخ استلام الوسائط',
  montage_start_date: 'تاريخ بدء المونتاج',
  montage_completed_date: 'تاريخ إتمام المونتاج',
  sent_to_donor_date: 'تاريخ الإرسال للمتبرع',
  completed_date: 'تاريخ الانتهاء',
  shelter_id: 'المخيم',
  orphan_group_id: 'تجميعة الأيتام',
  selected_orphan_ids: 'الأيتام المختارون',
  notes: 'ملاحظات',
  notes_image: 'صورة الملاحظات',
  project_image: 'صورة المشروع',
  beneficiaries_excel_file: 'ملف المستفيدين',
  rejection_reason: 'سبب الرفض',
  admin_rejection_reason: 'سبب رفض الإدارة',
  media_rejection_reason: 'سبب رفض الإعلام',
  created_at: 'تاريخ الإنشاء',
  updated_at: 'تاريخ التحديث',
  remaining_days: 'الأيام المتبقية',
  is_delayed: 'متأخر',
  delayed_days: 'أيام التأخير'
};

/**
 * وظائف مساعدة
 */

/**
 * التحقق من أن الحقل موجود في قاعدة البيانات
 * @param {string} fieldName - اسم الحقل
 * @returns {boolean}
 */
export function isRealDatabaseField(fieldName) {
  return REAL_DATABASE_FIELDS.includes(fieldName);
}

/**
 * التحقق من أن الحقل محسوب
 * @param {string} fieldName - اسم الحقل
 * @returns {boolean}
 */
export function isComputedField(fieldName) {
  return COMPUTED_FIELDS.includes(fieldName);
}

/**
 * التحقق من أن الحقل علاقة
 * @param {string} fieldName - اسم الحقل
 * @returns {boolean}
 */
export function isRelationshipField(fieldName) {
  return RELATIONSHIP_FIELDS.includes(fieldName);
}

/**
 * التحقق من أن الحقل يتم حسابه تلقائياً
 * @param {string} fieldName - اسم الحقل
 * @returns {boolean}
 */
export function isAutoCalculatedField(fieldName) {
  return AUTO_CALCULATED_FIELDS.includes(fieldName);
}

/**
 * التحقق من أن الحقل إلزامي
 * @param {string} fieldName - اسم الحقل
 * @returns {boolean}
 */
export function isRequiredField(fieldName) {
  return REQUIRED_FIELDS.includes(fieldName);
}

/**
 * التحقق من أن الحقل قابل للإفراغ
 * @param {string} fieldName - اسم الحقل
 * @returns {boolean}
 */
export function isNullableField(fieldName) {
  return NULLABLE_FIELDS.includes(fieldName);
}

/**
 * الحصول على نوع بيانات الحقل
 * @param {string} fieldName - اسم الحقل
 * @returns {string|null}
 */
export function getFieldType(fieldName) {
  return FIELD_TYPES[fieldName] || null;
}

/**
 * الحصول على التسمية العربية للحقل
 * @param {string} fieldName - اسم الحقل
 * @returns {string}
 */
export function getFieldLabel(fieldName) {
  return FIELD_LABELS_AR[fieldName] || fieldName;
}

/**
 * تصفية الـ object ليحتوي فقط على الحقول الحقيقية
 * يستخدم عند إرسال البيانات للباك اند
 * @param {Object} data - البيانات
 * @returns {Object}
 */
export function filterRealFields(data) {
  const filtered = {};

  for (const [key, value] of Object.entries(data)) {
    if (isRealDatabaseField(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * استخراج التغييرات فقط بين الكائن الأصلي والمحدّث
 * @param {Object} original - الكائن الأصلي
 * @param {Object} updated - الكائن المحدّث
 * @returns {Object} - فقط الحقول المتغيرة
 */
export function extractChanges(original, updated) {
  const changes = {};

  for (const [key, value] of Object.entries(updated)) {
    // تخطي الحقول المحسوبة والعلاقات
    if (isComputedField(key) || isRelationshipField(key)) {
      continue;
    }

    // تخطي الحقول غير الموجودة في قاعدة البيانات
    if (!isRealDatabaseField(key)) {
      continue;
    }

    // إضافة فقط إذا تغيرت القيمة
    if (original[key] !== value) {
      changes[key] = value;
    }
  }

  return changes;
}

/**
 * Validate field value based on its type
 * @param {string} fieldName - Field name
 * @param {any} value - Field value
 * @returns {boolean}
 */
export function validateFieldValue(fieldName, value) {
  const fieldType = getFieldType(fieldName);

  if (!fieldType) {
    return false;
  }

  // null is valid for nullable fields
  if (value === null && isNullableField(fieldName)) {
    return true;
  }

  // null is invalid for required fields
  if (value === null && isRequiredField(fieldName)) {
    return false;
  }

  switch (fieldType) {
    case 'number':
      return typeof value === 'number' && !isNaN(value);

    case 'decimal':
      return typeof value === 'number' || typeof value === 'string';

    case 'string':
      return typeof value === 'string';

    case 'boolean':
      return typeof value === 'boolean';

    case 'date':
    case 'datetime':
      // Check if valid date string (YYYY-MM-DD or ISO 8601)
      return typeof value === 'string' && !isNaN(Date.parse(value));

    default:
      return true;
  }
}

/**
 * مثال للاستخدام
 */
export const USAGE_EXAMPLE = {
  // عند تحميل المشروع
  async fetchProject(projectId) {
    const response = await fetch(`/api/admin/project-proposals/${projectId}/full-details`);
    const result = await response.json();
    return result.data.project;
  },

  // عند التعديل
  async updateProject(projectId, originalData, formData) {
    // استخراج التغييرات فقط
    const changes = extractChanges(originalData, formData);

    // تصفية الحقول الحقيقية فقط
    const updateData = filterRealFields(changes);

    // التحقق من الحقول
    for (const [field, value] of Object.entries(updateData)) {
      if (!validateFieldValue(field, value)) {
        throw new Error(`قيمة غير صحيحة للحقل: ${getFieldLabel(field)}`);
      }
    }

    // إرسال الطلب
    const response = await fetch(
      `/api/admin/project-proposals/${projectId}/advanced-update`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      }
    );

    return await response.json();
  }
};
