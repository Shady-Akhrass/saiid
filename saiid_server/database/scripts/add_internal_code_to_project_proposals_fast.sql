-- ============================================
-- إضافة حقل internal_code إلى جدول project_proposals (نسخة سريعة)
-- Add internal_code column to project_proposals table (Fast Version)
-- ============================================
-- تاريخ الإنشاء: 2025-12-16
-- الغرض: إضافة كود داخلي تلقائي لكل مشروع (YYNNNNN format)
-- ملاحظة: هذه النسخة تستخدم UPDATE مباشر بدون Cursor (أسرع بكثير)
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- زيادة وقت تنفيذ الاستعلام
SET SESSION max_statement_time = 600; -- 10 دقائق

-- ============================================
-- الجزء 1: إضافة العمود internal_code
-- ============================================

-- التحقق من وجود الجدول وإضافة العمود
ALTER TABLE `project_proposals` 
ADD COLUMN IF NOT EXISTS `internal_code` VARCHAR(7) NULL UNIQUE AFTER `donor_code`;

-- إضافة Index إذا لم يكن موجوداً
CREATE INDEX IF NOT EXISTS `project_proposals_internal_code_index` 
ON `project_proposals` (`internal_code`);

-- ملاحظة: إذا كان MySQL لا يدعم IF NOT EXISTS، استخدم:
-- ALTER TABLE `project_proposals` 
-- ADD COLUMN `internal_code` VARCHAR(7) NULL UNIQUE AFTER `donor_code`;
-- CREATE INDEX `project_proposals_internal_code_index` ON `project_proposals` (`internal_code`);

-- ============================================
-- الجزء 2: توليد internal_code للمشاريع الموجودة (طريقة سريعة)
-- ============================================

-- الطريقة: استخدام UPDATE مباشر لكل سنة على حدة
-- هذا أسرع بكثير من استخدام Cursor

-- للمشاريع في سنة 2025
SET @seq_25 = COALESCE((
    SELECT MAX(CAST(SUBSTRING(internal_code, 3) AS UNSIGNED))
    FROM project_proposals
    WHERE internal_code LIKE '25%' AND LENGTH(internal_code) = 7
), 0);

UPDATE project_proposals 
SET internal_code = CONCAT('25', LPAD((@seq_25 := @seq_25 + 1), 5, '0'))
WHERE (internal_code IS NULL OR internal_code = '')
AND YEAR(created_at) = 2025
ORDER BY id ASC;

-- للمشاريع في سنة 2024
SET @seq_24 = COALESCE((
    SELECT MAX(CAST(SUBSTRING(internal_code, 3) AS UNSIGNED))
    FROM project_proposals
    WHERE internal_code LIKE '24%' AND LENGTH(internal_code) = 7
), 0);

UPDATE project_proposals 
SET internal_code = CONCAT('24', LPAD((@seq_24 := @seq_24 + 1), 5, '0'))
WHERE (internal_code IS NULL OR internal_code = '')
AND YEAR(created_at) = 2024
ORDER BY id ASC;

-- للمشاريع في سنة 2023
SET @seq_23 = COALESCE((
    SELECT MAX(CAST(SUBSTRING(internal_code, 3) AS UNSIGNED))
    FROM project_proposals
    WHERE internal_code LIKE '23%' AND LENGTH(internal_code) = 7
), 0);

UPDATE project_proposals 
SET internal_code = CONCAT('23', LPAD((@seq_23 := @seq_23 + 1), 5, '0'))
WHERE (internal_code IS NULL OR internal_code = '')
AND YEAR(created_at) = 2023
ORDER BY id ASC;

-- للمشاريع في سنة 2026
SET @seq_26 = COALESCE((
    SELECT MAX(CAST(SUBSTRING(internal_code, 3) AS UNSIGNED))
    FROM project_proposals
    WHERE internal_code LIKE '26%' AND LENGTH(internal_code) = 7
), 0);

UPDATE project_proposals 
SET internal_code = CONCAT('26', LPAD((@seq_26 := @seq_26 + 1), 5, '0'))
WHERE (internal_code IS NULL OR internal_code = '')
AND YEAR(created_at) = 2026
ORDER BY id ASC;

-- للمشاريع التي لا تحتوي على created_at (استخدام السنة الحالية)
SET @current_year = YEAR(NOW());
SET @year_prefix = LPAD(MOD(@current_year, 100), 2, '0');
SET @seq_current = COALESCE((
    SELECT MAX(CAST(SUBSTRING(internal_code, 3) AS UNSIGNED))
    FROM project_proposals
    WHERE internal_code LIKE CONCAT(@year_prefix, '%') AND LENGTH(internal_code) = 7
), 0);

UPDATE project_proposals 
SET internal_code = CONCAT(@year_prefix, LPAD((@seq_current := @seq_current + 1), 5, '0'))
WHERE (internal_code IS NULL OR internal_code = '')
AND created_at IS NULL
ORDER BY id ASC;

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

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- ملاحظات:
-- ============================================
-- 1. هذه النسخة أسرع بكثير من النسخة التي تستخدم Cursor
-- 2. إذا كان لديك سنوات أخرى، أضف UPDATE statement لكل سنة
-- 3. يتم توليد الكود الداخلي تلقائياً لكل مشروع جديد من خلال Laravel Model
-- 4. التنسيق: YYNNNNN (سنة من رقمين + 5 أرقام متسلسلة)
-- 5. مثال: 2500001, 2500002, ... (للسنة 2025)
-- 6. مثال: 2600001, 2600002, ... (للسنة 2026)
-- ============================================
