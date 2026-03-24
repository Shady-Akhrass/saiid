-- =====================================================
-- SQL Script: إضافة assigned_researcher_id وتحديث enum status
-- تاريخ الإنشاء: 2025-12-22
-- الوصف: إلغاء نظام الفرق وإضافة إسناد مباشر للباحثين والمصورين
-- =====================================================

-- =====================================================
-- 1. إضافة عمود assigned_researcher_id
-- =====================================================

ALTER TABLE `project_proposals` 
ADD COLUMN `assigned_researcher_id` BIGINT UNSIGNED NULL AFTER `assigned_to_team_id`,
ADD INDEX `project_proposals_assigned_researcher_id_index` (`assigned_researcher_id`);

-- =====================================================
-- 2. تحديث enum status - إضافة الحالات الجديدة
-- =====================================================

-- أولاً: إضافة "مسند لباحث" و "تم التنفيذ" إلى ENUM (مع الاحتفاظ بالحالات القديمة مؤقتاً)
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
-- 3. تحديث المشاريع من "منفذ" إلى "تم التنفيذ"
-- =====================================================

UPDATE `project_proposals` 
SET `status` = 'تم التنفيذ' 
WHERE `status` = 'منفذ';

-- =====================================================
-- 4. إزالة "منفذ" و "قيد التوزيع" من ENUM
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
-- 5. إضافة Foreign Key لـ assigned_researcher_id
-- =====================================================

-- إزالة Foreign Key القديم إذا كان موجوداً (تجاهل الخطأ إذا لم يكن موجوداً)
SET @sql = (
    SELECT CONCAT('ALTER TABLE `project_proposals` DROP FOREIGN KEY `', CONSTRAINT_NAME, '`')
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_proposals'
    AND COLUMN_NAME = 'assigned_researcher_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);

SET @sql = IFNULL(@sql, 'SELECT 1');

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
-- 6. التحقق من النتائج
-- =====================================================

-- عرض معلومات العمود الجديد
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
AND COLUMN_NAME = 'assigned_researcher_id';

-- عرض عدد المشاريع بحالة "تم التنفيذ"
SELECT 
    COUNT(*) AS projects_with_completed_status
FROM `project_proposals`
WHERE `status` = 'تم التنفيذ';

-- عرض عدد المشاريع بحالة "مسند لباحث"
SELECT 
    COUNT(*) AS projects_assigned_to_researcher
FROM `project_proposals`
WHERE `status` = 'مسند لباحث';

-- =====================================================
-- ملاحظات:
-- =====================================================
-- 1. تم إضافة عمود assigned_researcher_id
-- 2. تم تحديث enum status لإضافة "مسند لباحث" و "تم التنفيذ"
-- 3. تم تحديث جميع المشاريع من "منفذ" إلى "تم التنفيذ"
-- 4. تم إزالة "منفذ" و "قيد التوزيع" من enum
-- 5. تم إضافة Foreign Key لـ assigned_researcher_id → team_personnel.id
-- =====================================================

