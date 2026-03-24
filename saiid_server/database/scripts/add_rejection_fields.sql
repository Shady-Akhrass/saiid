-- ============================================
-- إضافة حقول سبب الرفض لجدول project_proposals
-- ============================================
-- التاريخ: 4 يناير 2026
-- الإصلاح: MD/FIX_MONTAGE_REJECTION_REASON.md
-- ============================================

-- التحقق من وجود الجدول أولاً
-- إذا كان الجدول غير موجود، سيظهر خطأ واضح

-- ============================================
-- 1. إضافة الأعمدة الجديدة
-- ============================================

-- إضافة عمود rejection_reason بعد status
ALTER TABLE `project_proposals` ADD COLUMN `rejection_reason` TEXT NULL COMMENT 'سبب رفض المونتاج' AFTER `status`;

-- إضافة عمود rejection_message بعد rejection_reason
ALTER TABLE `project_proposals` ADD COLUMN `rejection_message` TEXT NULL COMMENT 'رسالة رفض المونتاج التفصيلية' AFTER `rejection_reason`;

-- إضافة عمود admin_rejection_reason بعد rejection_message
ALTER TABLE `project_proposals` ADD COLUMN `admin_rejection_reason` TEXT NULL COMMENT 'سبب رفض الإدارة للمونتاج' AFTER `rejection_message`;

-- إضافة عمود media_rejection_reason بعد admin_rejection_reason
ALTER TABLE `project_proposals` ADD COLUMN `media_rejection_reason` TEXT NULL COMMENT 'سبب رفض مدير الإعلام للمونتاج' AFTER `admin_rejection_reason`;

-- ============================================
-- 2. إضافة Index للبحث السريع
-- ============================================

-- إضافة Index على rejection_reason للبحث السريع عن المشاريع المرفوضة
ALTER TABLE `project_proposals` ADD INDEX `idx_rejection_reason` (`rejection_reason`(255));

-- ============================================
-- 3. التحقق من نجاح الإضافة
-- ============================================

-- عرض الأعمدة الجديدة للتأكد من نجاح الإضافة
SELECT 
    COLUMN_NAME as 'اسم العمود',
    COLUMN_TYPE as 'النوع',
    IS_NULLABLE as 'يقبل NULL',
    COLUMN_DEFAULT as 'القيمة الافتراضية',
    COLUMN_COMMENT as 'الوصف'
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_proposals'
    AND COLUMN_NAME LIKE '%rejection%'
ORDER BY ORDINAL_POSITION;

-- عرض Index للتأكد من نجاح الإضافة
-- ملاحظة: SHOW INDEX لا يدعم WHERE في بعض الإصدارات، لذا نستخدم information_schema
SELECT 
    INDEX_NAME as 'اسم الـ Index',
    COLUMN_NAME as 'اسم العمود',
    SEQ_IN_INDEX as 'ترتيب العمود في الـ Index',
    NON_UNIQUE as 'غير فريد',
    INDEX_TYPE as 'نوع الـ Index'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_proposals'
    AND COLUMN_NAME LIKE '%rejection%'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- ============================================
-- ✅ تم الانتهاء بنجاح!
-- ============================================
-- الآن يمكنك استخدام حقول سبب الرفض في Backend
-- راجع: MD/FIX_MONTAGE_REJECTION_REASON.md
-- ============================================

