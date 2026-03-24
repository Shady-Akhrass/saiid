-- ============================================
-- SQL Script للتحقق والتحديث بعد دمج قاعدة البيانات
-- ============================================
-- تاريخ الإنشاء: 2025
-- الغرض: التحقق من البيانات وتحديثها بعد دمج التغييرات الجديدة
-- ============================================

-- ============================================
-- 1. التحقق من الجداول الجديدة
-- ============================================

-- التحقق من وجود الجداول الجديدة
SELECT 'currencies' AS table_name, COUNT(*) AS record_count FROM currencies
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'team_members', COUNT(*) FROM team_members
UNION ALL
SELECT 'project_proposals', COUNT(*) FROM project_proposals
UNION ALL
SELECT 'project_timeline', COUNT(*) FROM project_timeline
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'team_personnel', COUNT(*) FROM team_personnel
UNION ALL
SELECT 'warehouse_items', COUNT(*) FROM warehouse_items
UNION ALL
SELECT 'project_warehouse_items', COUNT(*) FROM project_warehouse_items
UNION ALL
SELECT 'surplus_categories', COUNT(*) FROM surplus_categories
UNION ALL
SELECT 'media_archives', COUNT(*) FROM media_archives
UNION ALL
SELECT 'notification_replies', COUNT(*) FROM notification_replies;

-- ============================================
-- 2. التحقق من التعديلات على الجداول القديمة
-- ============================================

-- التحقق من وجود الحقول الجديدة في users
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'users'
AND COLUMN_NAME IN ('role', 'department', 'is_active', 'phone_number', 'added_by');

-- التحقق من وجود الحقول الجديدة في shelters
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'shelters'
AND COLUMN_NAME IN ('number_of_families', 'last_project_date', 'total_projects_received');

-- التحقق من وجود الحقول الجديدة في projects
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'projects'
AND COLUMN_NAME IN ('shelter_satisfaction_status', 'satisfaction_shortfall', 'satisfaction_notes', 'satisfaction_recorded_by', 'satisfaction_recorded_at', 'source_project_id');

-- ============================================
-- 3. التحقق من البيانات القديمة (لم تُفقد)
-- ============================================

-- عدد السجلات في الجداول القديمة
SELECT 'orphans' AS table_name, COUNT(*) AS record_count FROM orphans
UNION ALL
SELECT 'aids', COUNT(*) FROM aids
UNION ALL
SELECT 'shelters', COUNT(*) FROM shelters
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'refugees', COUNT(*) FROM refugees
UNION ALL
SELECT 'patients', COUNT(*) FROM patients
UNION ALL
SELECT 'students', COUNT(*) FROM students
UNION ALL
SELECT 'teachers', COUNT(*) FROM teachers
UNION ALL
SELECT 'employments', COUNT(*) FROM employments
UNION ALL
SELECT 'users', COUNT(*) FROM users;

-- ============================================
-- 4. تحديث البيانات الموجودة (اختياري)
-- ============================================

-- تحديث أدوار المستخدمين الحاليين
-- ⚠️ مهم: قم بتعديل WHERE حسب احتياجاتك

-- تعيين دور Admin للمستخدم الأول (عدّل ID حسب الحاجة)
UPDATE users 
SET role = 'admin', 
    department = 'إدارة',
    is_active = 1
WHERE id = 1 
AND (role IS NULL OR role = '');

-- تعيين دور executor للمستخدمين الذين لا يملكون دور
UPDATE users 
SET role = 'executor',
    is_active = 1
WHERE (role IS NULL OR role = '')
AND id > 1;

-- ============================================
-- 5. التحقق من Foreign Keys
-- ============================================

-- التحقق من Foreign Keys في project_proposals
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
AND REFERENCED_TABLE_NAME IS NOT NULL;

-- ============================================
-- 6. التحقق من Indexes
-- ============================================

-- التحقق من Indexes في notifications
SHOW INDEXES FROM notifications;

-- التحقق من Indexes في project_proposals
SHOW INDEXES FROM project_proposals;

-- ============================================
-- 7. إحصائيات الجداول
-- ============================================

-- حجم الجداول
SELECT 
    TABLE_NAME,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size (MB)',
    TABLE_ROWS AS 'Rows'
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN (
    'users', 'orphans', 'aids', 'shelters', 'projects',
    'currencies', 'teams', 'project_proposals', 'notifications'
)
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;

-- ============================================
-- 8. التحقق من البيانات المفقودة أو غير الصحيحة
-- ============================================

-- المستخدمون بدون دور
SELECT id, name, email, role, department 
FROM users 
WHERE role IS NULL OR role = '';

-- المشاريع المقترحة بدون عملة
SELECT id, serial_number, project_name, currency_id 
FROM project_proposals 
WHERE currency_id IS NULL;

-- الفرق بدون قائد
SELECT id, team_name, team_leader_id 
FROM teams 
WHERE team_leader_id IS NULL;

-- ============================================
-- 9. تنظيف البيانات (حذر!)
-- ============================================

-- ⚠️ تحذير: لا تقم بتشغيل هذه الأوامر إلا بعد التأكد

-- حذف الإشعارات القديمة (أقدم من 90 يوم) - اختياري
-- DELETE FROM notifications 
-- WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
-- AND is_read = 1;

-- ============================================
-- 10. إحصائيات نهائية
-- ============================================

-- عدد المستخدمين حسب الدور
SELECT 
    role,
    COUNT(*) AS count,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count
FROM users
GROUP BY role;

-- عدد المشاريع المقترحة حسب الحالة
SELECT 
    status,
    COUNT(*) AS count
FROM project_proposals
GROUP BY status
ORDER BY count DESC;

-- عدد الإشعارات حسب النوع
SELECT 
    notification_type,
    COUNT(*) AS count,
    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_count
FROM notifications
GROUP BY notification_type
ORDER BY count DESC;

-- ============================================
-- نهاية السكريبت
-- ============================================
