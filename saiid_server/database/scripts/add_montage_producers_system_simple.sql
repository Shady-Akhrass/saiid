-- ===================================================================
-- SQL Script: إضافة نظام ممنتجي المونتاج (نسخة مبسطة)
-- التاريخ: 2025-12-22
-- الوصف: إضافة نظام كامل لإدارة ممنتجي المونتاج
-- ملاحظة: هذه النسخة المبسطة بدون تحقق من الوجود (أسرع)
-- ===================================================================

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
-- ملاحظة: إذا ظهر خطأ "Duplicate column name"، يمكن تجاهله
ALTER TABLE `project_proposals` 
ADD COLUMN `assigned_montage_producer_id` BIGINT UNSIGNED NULL 
AFTER `assigned_photographer_id`;

-- إضافة montage_producer_assigned_at
-- ملاحظة: إذا ظهر خطأ "Duplicate column name"، يمكن تجاهله
ALTER TABLE `project_proposals` 
ADD COLUMN `montage_producer_assigned_at` TIMESTAMP NULL 
AFTER `assigned_montage_producer_id`;

-- إضافة montage_completed_at
-- ملاحظة: إذا ظهر خطأ "Duplicate column name"، يمكن تجاهله
ALTER TABLE `project_proposals` 
ADD COLUMN `montage_completed_at` TIMESTAMP NULL 
AFTER `montage_producer_assigned_at`;

-- ===================================================================
-- الجزء 3: إضافة Foreign Key
-- ===================================================================

ALTER TABLE `project_proposals` 
ADD CONSTRAINT `project_proposals_assigned_montage_producer_id_foreign` 
FOREIGN KEY (`assigned_montage_producer_id`) 
REFERENCES `users` (`id`) 
ON DELETE SET NULL;

-- ===================================================================
-- الجزء 4: إضافة Indexes
-- ===================================================================

-- Index على assigned_montage_producer_id
ALTER TABLE `project_proposals` 
ADD INDEX `project_proposals_assigned_montage_producer_id_index` (`assigned_montage_producer_id`);

-- Composite Index على (assigned_montage_producer_id, status)
ALTER TABLE `project_proposals` 
ADD INDEX `project_proposals_assigned_montage_producer_id_status_index` (`assigned_montage_producer_id`, `status`);

-- Index على montage_producer_assigned_at
ALTER TABLE `project_proposals` 
ADD INDEX `project_proposals_montage_producer_assigned_at_index` (`montage_producer_assigned_at`);

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
-- 1. إذا ظهرت أخطاء "Duplicate column" أو "Duplicate key"، يمكن تجاهلها
-- 2. بعد تشغيل السكريبت، تأكد من تشغيل: php artisan migrate
-- 3. للتحقق من التطبيق، استخدم السكريبت: add_montage_producers_system.sql
-- ===================================================================
