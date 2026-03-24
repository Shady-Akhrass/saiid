-- ===================================================================
-- SQL Script: إضافة نظام ممنتجي المونتاج (نسخة محسّنة)
-- التاريخ: 2025-12-22
-- الوصف: إضافة نظام كامل لإدارة ممنتجي المونتاج مع معالجة الأخطاء
-- ===================================================================

SET @dbname = DATABASE();

-- ===================================================================
-- الجزء 1: إضافة دور montage_producer إلى جدول users
-- ===================================================================

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

-- إضافة assigned_montage_producer_id
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'assigned_montage_producer_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `project_proposals` ADD COLUMN `assigned_montage_producer_id` BIGINT UNSIGNED NULL AFTER `assigned_photographer_id`;',
    'SELECT "Column assigned_montage_producer_id already exists" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- إضافة montage_producer_assigned_at
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'montage_producer_assigned_at'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `project_proposals` ADD COLUMN `montage_producer_assigned_at` TIMESTAMP NULL AFTER `assigned_montage_producer_id`;',
    'SELECT "Column montage_producer_assigned_at already exists" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- إضافة montage_completed_at
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'montage_completed_at'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `project_proposals` ADD COLUMN `montage_completed_at` TIMESTAMP NULL AFTER `montage_producer_assigned_at`;',
    'SELECT "Column montage_completed_at already exists" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===================================================================
-- الجزء 3: إضافة Foreign Key
-- ===================================================================

SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'project_proposals' 
    AND CONSTRAINT_NAME = 'project_proposals_assigned_montage_producer_id_foreign'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE `project_proposals` ADD CONSTRAINT `project_proposals_assigned_montage_producer_id_foreign` FOREIGN KEY (`assigned_montage_producer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;',
    'SELECT "Foreign key already exists" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===================================================================
-- الجزء 4: إضافة Indexes
-- ===================================================================

-- Index على assigned_montage_producer_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'project_proposals' 
    AND INDEX_NAME = 'project_proposals_assigned_montage_producer_id_index'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE `project_proposals` ADD INDEX `project_proposals_assigned_montage_producer_id_index` (`assigned_montage_producer_id`);',
    'SELECT "Index assigned_montage_producer_id already exists" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Composite Index على (assigned_montage_producer_id, status)
SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'project_proposals' 
    AND INDEX_NAME = 'project_proposals_assigned_montage_producer_id_status_index'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE `project_proposals` ADD INDEX `project_proposals_assigned_montage_producer_id_status_index` (`assigned_montage_producer_id`, `status`);',
    'SELECT "Index assigned_montage_producer_id_status already exists" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index على montage_producer_assigned_at
SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = 'project_proposals' 
    AND INDEX_NAME = 'project_proposals_montage_producer_assigned_at_index'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE `project_proposals` ADD INDEX `project_proposals_montage_producer_assigned_at_index` (`montage_producer_assigned_at`);',
    'SELECT "Index montage_producer_assigned_at already exists" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===================================================================
-- الجزء 5: إضافة أنواع الإشعارات الجديدة
-- ===================================================================

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
-- نهاية السكريبت
-- ===================================================================
-- ملاحظات:
-- 1. هذا السكريبت آمن للتشغيل عدة مرات (idempotent)
-- 2. يتم التحقق من وجود الأعمدة والـ indexes قبل إضافتها
-- 3. بعد تشغيل السكريبت، تأكد من تشغيل: php artisan migrate
-- 4. للتحقق من التطبيق، استخدم السكريبت: verify_montage_producers_system.sql
-- ===================================================================
