-- ===================================================================
-- SQL Script: التحقق من نظام ممنتجي المونتاج
-- التاريخ: 2025-12-22
-- الوصف: التحقق من أن جميع التغييرات تمت بنجاح
-- ===================================================================

SET @dbname = DATABASE();

-- ===================================================================
-- التحقق من دور montage_producer في جدول users
-- ===================================================================

SELECT 
    'users.role' AS table_column,
    COLUMN_TYPE AS current_type,
    CASE 
        WHEN COLUMN_TYPE LIKE '%montage_producer%' THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END AS status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'users'
AND COLUMN_NAME = 'role';

-- ===================================================================
-- التحقق من الحقول الجديدة في جدول project_proposals
-- ===================================================================

SELECT 
    'project_proposals.assigned_montage_producer_id' AS table_column,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END AS status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'project_proposals'
AND COLUMN_NAME = 'assigned_montage_producer_id';

SELECT 
    'project_proposals.montage_producer_assigned_at' AS table_column,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END AS status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'project_proposals'
AND COLUMN_NAME = 'montage_producer_assigned_at';

SELECT 
    'project_proposals.montage_completed_at' AS table_column,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END AS status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'project_proposals'
AND COLUMN_NAME = 'montage_completed_at';

-- ===================================================================
-- التحقق من Foreign Key
-- ===================================================================

SELECT 
    'project_proposals_assigned_montage_producer_id_foreign' AS foreign_key_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END AS status
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'project_proposals'
AND CONSTRAINT_NAME = 'project_proposals_assigned_montage_producer_id_foreign';

-- ===================================================================
-- التحقق من Indexes
-- ===================================================================

SELECT 
    INDEX_NAME AS index_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END AS status
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'project_proposals'
AND INDEX_NAME IN (
    'project_proposals_assigned_montage_producer_id_index',
    'project_proposals_assigned_montage_producer_id_status_index',
    'project_proposals_montage_producer_assigned_at_index'
)
GROUP BY INDEX_NAME;

-- ===================================================================
-- التحقق من أنواع الإشعارات الجديدة
-- ===================================================================

SELECT 
    'notifications.notification_type' AS table_column,
    COLUMN_TYPE AS current_type,
    CASE 
        WHEN COLUMN_TYPE LIKE '%montage_producer_assigned%' 
         AND COLUMN_TYPE LIKE '%montage_completed_by_producer%'
         AND COLUMN_TYPE LIKE '%montage_approved_by_manager%' 
        THEN '✅ جميع الأنواع موجودة'
        ELSE '❌ بعض الأنواع غير موجودة'
    END AS status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'notifications'
AND COLUMN_NAME = 'notification_type';

-- ===================================================================
-- ملخص التحقق
-- ===================================================================

SELECT 
    '=== ملخص التحقق ===' AS summary;

SELECT 
    COUNT(*) AS total_users_with_montage_producer_role
FROM users
WHERE role = 'montage_producer';

SELECT 
    COUNT(*) AS total_projects_assigned_to_montage_producers
FROM project_proposals
WHERE assigned_montage_producer_id IS NOT NULL;

SELECT 
    COUNT(*) AS total_montage_producer_notifications
FROM notifications
WHERE notification_type IN (
    'montage_producer_assigned',
    'montage_completed_by_producer',
    'montage_approved_by_manager'
);

-- ===================================================================
-- نهاية السكريبت
-- ===================================================================
