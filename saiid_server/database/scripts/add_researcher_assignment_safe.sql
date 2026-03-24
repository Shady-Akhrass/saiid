-- =====================================================
-- SQL Script: إضافة assigned_researcher_id وتحديث enum status
-- تاريخ الإنشاء: 2025-12-22
-- الوصف: إلغاء نظام الفرق وإضافة إسناد مباشر للباحثين والمصورين
-- =====================================================
-- 
-- تعليمات الاستخدام:
-- 1. قم بعمل backup لقاعدة البيانات أولاً
-- 2. شغل هذا الـ script على قاعدة البيانات
-- 3. تحقق من النتائج في نهاية الـ script
-- =====================================================

-- =====================================================
-- 1. إضافة عمود assigned_researcher_id (إذا لم يكن موجوداً)
-- =====================================================

-- التحقق من وجود العمود أولاً
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND column_name = 'assigned_researcher_id'
);

-- إضافة العمود فقط إذا لم يكن موجوداً
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `project_proposals` 
     ADD COLUMN `assigned_researcher_id` BIGINT UNSIGNED NULL AFTER `assigned_to_team_id`,
     ADD INDEX `project_proposals_assigned_researcher_id_index` (`assigned_researcher_id`)',
    'SELECT "Column assigned_researcher_id already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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

-- عرض عدد المشاريع المحدثة
SELECT 
    ROW_COUNT() AS updated_projects_count;

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
-- 5. إزالة Foreign Key القديم (إن وجد)
-- =====================================================

-- البحث عن Foreign Key موجود
SET @fk_name = (
    SELECT CONSTRAINT_NAME 
    FROM information_schema.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'assigned_researcher_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);

-- إزالة Foreign Key إذا كان موجوداً
SET @sql = IF(@fk_name IS NOT NULL,
    CONCAT('ALTER TABLE `project_proposals` DROP FOREIGN KEY `', @fk_name, '`'),
    'SELECT "No existing foreign key to drop" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- 6. إضافة Foreign Key لـ assigned_researcher_id
-- =====================================================

-- التحقق من وجود جدول team_personnel
SET @team_personnel_exists = (
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() 
    AND table_name = 'team_personnel'
);

-- إضافة Foreign Key فقط إذا كان جدول team_personnel موجوداً
SET @sql = IF(@team_personnel_exists > 0,
    'ALTER TABLE `project_proposals` 
     ADD CONSTRAINT `project_proposals_assigned_researcher_id_foreign` 
     FOREIGN KEY (`assigned_researcher_id`) 
     REFERENCES `team_personnel` (`id`) 
     ON DELETE SET NULL',
    'SELECT "Table team_personnel not found - skipping foreign key" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- 7. التحقق من النتائج
-- =====================================================

-- عرض معلومات العمود الجديد
SELECT 
    'Column Information' AS info_type,
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
    'Projects with completed status' AS info_type,
    COUNT(*) AS count
FROM `project_proposals`
WHERE `status` = 'تم التنفيذ';

-- عرض عدد المشاريع بحالة "مسند لباحث"
SELECT 
    'Projects assigned to researcher' AS info_type,
    COUNT(*) AS count
FROM `project_proposals`
WHERE `status` = 'مسند لباحث';

-- عرض جميع الحالات المتاحة
SELECT 
    'Available statuses' AS info_type,
    COLUMN_TYPE AS enum_values
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
AND COLUMN_NAME = 'status';

-- =====================================================
-- ✅ تم الانتهاء بنجاح!
-- =====================================================
-- ملخص التغييرات:
-- 1. ✅ تم إضافة عمود assigned_researcher_id
-- 2. ✅ تم تحديث enum status لإضافة "مسند لباحث" و "تم التنفيذ"
-- 3. ✅ تم تحديث جميع المشاريع من "منفذ" إلى "تم التنفيذ"
-- 4. ✅ تم إزالة "منفذ" و "قيد التوزيع" من enum
-- 5. ✅ تم إضافة Foreign Key لـ assigned_researcher_id → team_personnel.id
-- =====================================================

