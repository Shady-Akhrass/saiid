-- ============================================
-- إضافة حقل internal_code إلى جدول project_proposals (نسخة مبسطة)
-- Add internal_code column to project_proposals table (Simple Version)
-- ============================================
-- تاريخ الإنشاء: 2025-12-16
-- الغرض: إضافة كود داخلي تلقائي لكل مشروع (YYNNNNN format)
-- ملاحظة: هذه النسخة المبسطة لا تستخدم Stored Procedures
-- ============================================

-- ============================================
-- الجزء 1: إضافة العمود internal_code
-- ============================================

-- التحقق من وجود العمود وإضافته إذا لم يكن موجوداً
ALTER TABLE `project_proposals` 
ADD COLUMN IF NOT EXISTS `internal_code` VARCHAR(7) NULL UNIQUE AFTER `donor_code`,
ADD INDEX IF NOT EXISTS `project_proposals_internal_code_index` (`internal_code`);

-- ملاحظة: إذا كان MySQL لا يدعم IF NOT EXISTS، استخدم هذا بدلاً منه:
-- ALTER TABLE `project_proposals` 
-- ADD COLUMN `internal_code` VARCHAR(7) NULL UNIQUE AFTER `donor_code`;
-- CREATE INDEX IF NOT EXISTS `project_proposals_internal_code_index` ON `project_proposals` (`internal_code`);

-- ============================================
-- الجزء 2: توليد internal_code للمشاريع الموجودة (يدوياً)
-- ============================================

-- ملاحظة: يمكنك استخدام Laravel Migration أو تشغيل الكود التالي في PHP/Laravel
-- لتوليد الأكواد للمشاريع الموجودة:

/*
-- مثال على كيفية توليد الأكواد للمشاريع الموجودة:

-- 1. للمشاريع في سنة 2025:
UPDATE project_proposals 
SET internal_code = CONCAT('25', LPAD(
    (SELECT COALESCE(MAX(CAST(SUBSTRING(internal_code, 3) AS UNSIGNED)), 0) + 1
     FROM project_proposals p2 
     WHERE p2.internal_code LIKE '25%' 
     AND p2.id <= project_proposals.id), 5, '0'))
WHERE (internal_code IS NULL OR internal_code = '')
AND YEAR(created_at) = 2025
ORDER BY id ASC;

-- 2. للمشاريع في سنة 2024:
UPDATE project_proposals 
SET internal_code = CONCAT('24', LPAD(
    (SELECT COALESCE(MAX(CAST(SUBSTRING(internal_code, 3) AS UNSIGNED)), 0) + 1
     FROM project_proposals p2 
     WHERE p2.internal_code LIKE '24%' 
     AND p2.id <= project_proposals.id), 5, '0'))
WHERE (internal_code IS NULL OR internal_code = '')
AND YEAR(created_at) = 2024
ORDER BY id ASC;

-- 3. للمشاريع في سنة 2026:
UPDATE project_proposals 
SET internal_code = CONCAT('26', LPAD(
    (SELECT COALESCE(MAX(CAST(SUBSTRING(internal_code, 3) AS UNSIGNED)), 0) + 1
     FROM project_proposals p2 
     WHERE p2.internal_code LIKE '26%' 
     AND p2.id <= project_proposals.id), 5, '0'))
WHERE (internal_code IS NULL OR internal_code = '')
AND YEAR(created_at) = 2026
ORDER BY id ASC;
*/

-- ============================================
-- الجزء 3: التحقق من النتائج
-- ============================================

-- عرض عدد المشاريع التي تم تحديثها
SELECT 
    COUNT(*) as total_projects,
    COUNT(internal_code) as projects_with_internal_code,
    COUNT(*) - COUNT(internal_code) as projects_without_internal_code
FROM project_proposals;

-- عرض عينة من الأكواد المولدة
SELECT 
    id,
    serial_number,
    donor_code,
    internal_code,
    YEAR(created_at) as project_year,
    created_at
FROM project_proposals
WHERE internal_code IS NOT NULL
ORDER BY internal_code DESC
LIMIT 10;

-- ============================================
-- ملاحظات:
-- ============================================
-- 1. يتم توليد الكود الداخلي تلقائياً لكل مشروع جديد من خلال Laravel Model
-- 2. هذا الـ Script يضيف العمود فقط، لتوليد الأكواد للمشاريع الموجودة:
--    - استخدم Laravel Migration: php artisan migrate
--    - أو استخدم الـ Script الكامل: add_internal_code_to_project_proposals.sql
-- 3. التنسيق: YYNNNNN (سنة من رقمين + 5 أرقام متسلسلة)
-- 4. مثال: 2500001, 2500002, ... (للسنة 2025)
-- 5. مثال: 2600001, 2600002, ... (للسنة 2026)
-- ============================================
