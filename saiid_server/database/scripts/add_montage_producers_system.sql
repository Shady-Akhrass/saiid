-- ===================================================================
-- SQL Script: إضافة نظام ممنتجي المونتاج
-- التاريخ: 2025-12-22
-- الوصف: إضافة نظام كامل لإدارة ممنتجي المونتاج
-- ===================================================================

-- ===================================================================
-- الجزء 1: إضافة دور montage_producer إلى جدول users
-- ===================================================================

-- التحقق من وجود العمود role أولاً
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @columnname = 'role';

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND COLUMN_NAME = @columnname
    ) > 0,
    'SELECT "Column role already exists" AS result;',
    'SELECT "Column role does not exist" AS result;'
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- تحديث enum الأدوار لإضافة montage_producer
-- ملاحظة: يجب أن تحتوي على جميع الأدوار الموجودة حالياً
ALTER TABLE `users` 
MODIFY COLUMN `role` ENUM(
    'admin',
    'project_manager',
    'media_manager',
    'executed_projects_coordinator',
    'executor',
    'photographer',
    'warehouse_manager',
    'montage_producer'
) NULL;

-- ===================================================================
-- الجزء 2: إضافة الحقول الجديدة إلى جدول project_proposals
-- ===================================================================

-- التحقق من وجود الأعمدة قبل إضافتها
SET @tablename = 'project_proposals';

-- 1. إضافة assigned_montage_producer_id
SET @columnname = 'assigned_montage_producer_id';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND COLUMN_NAME = @columnname
    ) > 0,
    'SELECT "Column assigned_montage_producer_id already exists" AS result;',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` BIGINT UNSIGNED NULL AFTER `assigned_photographer_id`;')
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. إضافة montage_producer_assigned_at
SET @columnname = 'montage_producer_assigned_at';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND COLUMN_NAME = @columnname
    ) > 0,
    'SELECT "Column montage_producer_assigned_at already exists" AS result;',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` TIMESTAMP NULL AFTER `assigned_montage_producer_id`;')
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. إضافة montage_completed_at
SET @columnname = 'montage_completed_at';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND COLUMN_NAME = @columnname
    ) > 0,
    'SELECT "Column montage_completed_at already exists" AS result;',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` TIMESTAMP NULL AFTER `montage_producer_assigned_at`;')
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===================================================================
-- الجزء 3: إضافة Foreign Key و Indexes
-- ===================================================================

-- التحقق من وجود Foreign Key قبل إضافتها
SET @fk_name = 'project_proposals_assigned_montage_producer_id_foreign';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND CONSTRAINT_NAME = @fk_name
    ) > 0,
    'SELECT "Foreign key already exists" AS result;',
    CONCAT('ALTER TABLE `', @tablename, '` ADD CONSTRAINT `', @fk_name, '` FOREIGN KEY (`assigned_montage_producer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;')
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- إضافة Indexes
-- 1. Index على assigned_montage_producer_id
SET @index_name = 'project_proposals_assigned_montage_producer_id_index';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND INDEX_NAME = @index_name
    ) > 0,
    'SELECT "Index assigned_montage_producer_id already exists" AS result;',
    CONCAT('ALTER TABLE `', @tablename, '` ADD INDEX `', @index_name, '` (`assigned_montage_producer_id`);')
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Composite Index على (assigned_montage_producer_id, status)
SET @index_name = 'project_proposals_assigned_montage_producer_id_status_index';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND INDEX_NAME = @index_name
    ) > 0,
    'SELECT "Index assigned_montage_producer_id_status already exists" AS result;',
    CONCAT('ALTER TABLE `', @tablename, '` ADD INDEX `', @index_name, '` (`assigned_montage_producer_id`, `status`);')
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Index على montage_producer_assigned_at
SET @index_name = 'project_proposals_montage_producer_assigned_at_index';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND INDEX_NAME = @index_name
    ) > 0,
    'SELECT "Index montage_producer_assigned_at already exists" AS result;',
    CONCAT('ALTER TABLE `', @tablename, '` ADD INDEX `', @index_name, '` (`montage_producer_assigned_at`);')
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===================================================================
-- الجزء 4: إضافة أنواع الإشعارات الجديدة
-- ===================================================================

-- التحقق من وجود العمود notification_type
SET @tablename = 'notifications';
SET @columnname = 'notification_type';

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND COLUMN_NAME = @columnname
    ) > 0,
    'SELECT "Column notification_type exists" AS result;',
    'SELECT "Column notification_type does not exist" AS result;'
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- تحديث enum أنواع الإشعارات لإضافة الأنواع الجديدة
-- ملاحظة: يجب أن تحتوي على جميع الأنواع الموجودة حالياً
ALTER TABLE `notifications` 
MODIFY COLUMN `notification_type` ENUM(
    'new_assignment',
    'ready_for_shelter_selection',
    'ready_for_montage',
    'delay_execution',
    'delay_montage',
    'status_change',
    'photographer_assignment',
    'project_created',
    'project_assigned',
    'project_status_changed',
    'shelter_selected',
    'media_updated',
    'daily_phase',
    'project_postponed',
    'project_resumed',
    'project_cancelled',
    'project_transferred_to_execution',
    'media_completed',
    'media_rejected',
    'media_accepted',
    'supply_started',
    'supply_confirmed',
    'low_stock',
    'project_deficit',
    'shekel_converted',
    'montage_producer_assigned',
    'montage_completed_by_producer',
    'montage_approved_by_manager'
) NOT NULL;

-- ===================================================================
-- الجزء 5: التحقق من التطبيق
-- ===================================================================

-- التحقق من أن جميع التغييرات تمت بنجاح
SELECT 
    'users.role' AS table_column,
    COLUMN_TYPE AS current_type
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'users'
AND COLUMN_NAME = 'role';

SELECT 
    'project_proposals.assigned_montage_producer_id' AS table_column,
    CASE 
        WHEN COUNT(*) > 0 THEN 'EXISTS'
        ELSE 'NOT EXISTS'
    END AS status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'project_proposals'
AND COLUMN_NAME = 'assigned_montage_producer_id';

SELECT 
    'project_proposals.montage_producer_assigned_at' AS table_column,
    CASE 
        WHEN COUNT(*) > 0 THEN 'EXISTS'
        ELSE 'NOT EXISTS'
    END AS status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'project_proposals'
AND COLUMN_NAME = 'montage_producer_assigned_at';

SELECT 
    'project_proposals.montage_completed_at' AS table_column,
    CASE 
        WHEN COUNT(*) > 0 THEN 'EXISTS'
        ELSE 'NOT EXISTS'
    END AS status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'project_proposals'
AND COLUMN_NAME = 'montage_completed_at';

SELECT 
    'notifications.notification_type' AS table_column,
    COLUMN_TYPE AS current_type
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'notifications'
AND COLUMN_NAME = 'notification_type';

-- ===================================================================
-- نهاية السكريبت
-- ===================================================================
-- ملاحظات:
-- 1. هذا السكريبت آمن للتشغيل عدة مرات (idempotent)
-- 2. يتم التحقق من وجود الأعمدة والـ indexes قبل إضافتها
-- 3. في حالة وجود أخطاء، يمكن تجاهل الرسائل التي تقول "already exists"
-- 4. بعد تشغيل السكريبت، تأكد من تشغيل: php artisan migrate
-- ===================================================================
