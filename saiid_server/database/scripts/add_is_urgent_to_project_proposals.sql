-- ============================================
-- إضافة عمود is_urgent (عاجل) لجدول project_proposals
-- ============================================
-- التاريخ: 7 يناير 2026
-- الوصف: إضافة عمود لتحديد المشاريع العاجلة
-- ============================================

-- التحقق من وجود الجدول أولاً
-- إذا كان الجدول غير موجود، سيظهر خطأ واضح

-- ============================================
-- 1. إضافة العمود is_urgent
-- ============================================

-- التحقق من وجود العمود قبل الإضافة (للمرة الأولى فقط)
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'is_urgent'
);

-- إضافة العمود فقط إذا لم يكن موجوداً
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE `project_proposals` ADD COLUMN `is_urgent` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''مشروع عاجل'' AFTER `status`',
    'SELECT "العمود is_urgent موجود بالفعل" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 2. إضافة Index للبحث السريع
-- ============================================

-- التحقق من وجود Index قبل الإضافة
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'project_proposals' 
    AND INDEX_NAME = 'project_proposals_is_urgent_index'
);

-- إضافة Index فقط إذا لم يكن موجوداً
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_is_urgent_index` ON `project_proposals` (`is_urgent`)',
    'SELECT "Index project_proposals_is_urgent_index موجود بالفعل" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 3. التحقق من نجاح الإضافة
-- ============================================

-- عرض معلومات العمود الجديد
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'project_proposals' 
AND COLUMN_NAME = 'is_urgent';

-- عرض معلومات Index
SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX
FROM information_schema.statistics 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'project_proposals' 
AND INDEX_NAME = 'project_proposals_is_urgent_index';

-- ============================================
-- ✅ تم إضافة عمود is_urgent بنجاح
-- ============================================
-- يمكنك الآن استخدام الحقل في:
-- 1. إنشاء مشروع جديد مع is_urgent = true
-- 2. تحديث مشروع موجود إلى عاجل
-- 3. البحث عن المشاريع العاجلة: WHERE is_urgent = 1
-- ============================================

