-- =====================================================
-- SQL Script: تحديث enum status مع التحقق من Foreign Key
-- تاريخ الإنشاء: 2025-12-22
-- الوصف: تحديث enum status مع التحقق من Foreign Key قبل إضافته
-- =====================================================
-- 
-- ⚠️ مهم: قم بعمل backup لقاعدة البيانات قبل التنفيذ!
-- =====================================================

-- =====================================================
-- 1. تحديث enum status - إضافة الحالات الجديدة
-- =====================================================

-- أولاً: إضافة "مسند لباحث" و "تم التنفيذ" إلى ENUM
ALTER TABLE `project_proposals` MODIFY COLUMN `status` ENUM(
    'جديد',
    'قيد التوريد',
    'تم التوريد',
    'قيد التوزيع',
    'مسند لباحث',
    'جاهز للتنفيذ',
    'تم اختيار المخيم',
    'قيد التنفيذ',
    'منفذ',
    'تم التنفيذ',
    'في المونتاج',
    'تم المونتاج',
    'وصل للمتبرع',
    'ملغى',
    'يجب إعادة المونتاج',
    'مؤجل'
) NOT NULL DEFAULT 'جديد';

-- =====================================================
-- 2. تحديث المشاريع من "منفذ" إلى "تم التنفيذ"
-- =====================================================

UPDATE `project_proposals` 
SET `status` = 'تم التنفيذ' 
WHERE `status` = 'منفذ';

-- =====================================================
-- 3. إزالة "منفذ" و "قيد التوزيع" من ENUM
-- =====================================================

ALTER TABLE `project_proposals` MODIFY COLUMN `status` ENUM(
    'جديد',
    'قيد التوريد',
    'تم التوريد',
    'مسند لباحث',
    'جاهز للتنفيذ',
    'تم اختيار المخيم',
    'قيد التنفيذ',
    'تم التنفيذ',
    'في المونتاج',
    'تم المونتاج',
    'وصل للمتبرع',
    'ملغى',
    'يجب إعادة المونتاج',
    'مؤجل'
) NOT NULL DEFAULT 'جديد';

-- =====================================================
-- 4. حذف Foreign Key القديم (إن وجد) ثم إضافة الجديد
-- =====================================================

-- حذف Foreign Key القديم إذا كان موجوداً
SET @constraint_name = (
    SELECT CONSTRAINT_NAME 
    FROM information_schema.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_proposals'
    AND COLUMN_NAME = 'assigned_researcher_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);

-- إذا كان هناك Foreign Key موجود، احذفه
SET @sql = IF(@constraint_name IS NOT NULL,
    CONCAT('ALTER TABLE `project_proposals` DROP FOREIGN KEY `', @constraint_name, '`'),
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- إضافة Foreign Key جديد
ALTER TABLE `project_proposals` 
ADD CONSTRAINT `project_proposals_assigned_researcher_id_foreign` 
FOREIGN KEY (`assigned_researcher_id`) 
REFERENCES `team_personnel` (`id`) 
ON DELETE SET NULL;

-- =====================================================
-- ✅ تم الانتهاء!
-- =====================================================
-- 
-- ملخص التغييرات:
-- 1. ✅ تم تحديث enum status لإضافة "مسند لباحث" و "تم التنفيذ"
-- 2. ✅ تم تحديث جميع المشاريع من "منفذ" إلى "تم التنفيذ"
-- 3. ✅ تم إزالة "منفذ" و "قيد التوزيع" من enum
-- 4. ✅ تم حذف Foreign Key القديم (إن وجد) وإضافة الجديد
-- 
-- =====================================================
