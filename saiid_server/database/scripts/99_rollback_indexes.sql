-- ============================================
-- 🔄 Rollback - حذف جميع Indexes المضافة
-- سعيد API - Rollback Optimization
-- التاريخ: 2026-01-05
-- ============================================

/*
⚠️ استخدم هذا الملف فقط في حالة الطوارئ
⚠️ لإلغاء جميع التحسينات والعودة للحالة السابقة
*/

USE saiid_db; -- ✅ غيّر اسم قاعدة البيانات حسب السيرفر

-- ============================================
-- عرض الـ Indexes قبل الحذف
-- ============================================

SELECT '==================================' AS '';
SELECT 'Indexes Before Rollback:' AS status;
SELECT '==================================' AS '';

SELECT 
    INDEX_NAME,
    INDEX_TYPE,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
AND INDEX_NAME LIKE 'idx_pp%'
GROUP BY INDEX_NAME, INDEX_TYPE;

-- ============================================
-- حذف Composite Indexes أولاً
-- ============================================

SELECT '==================================' AS '';
SELECT 'Dropping Composite Indexes...' AS status;
SELECT '==================================' AS '';

ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_parent_phase;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_monthly_start;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_daily_exec_date;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_status_date;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_status_type;

-- ============================================
-- حذف Flags Indexes
-- ============================================

SELECT '==================================' AS '';
SELECT 'Dropping Flags Indexes...' AS status;
SELECT '==================================' AS '';

ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_is_monthly;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_is_divided;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_is_daily;

-- ============================================
-- حذف Single Column Indexes
-- ============================================

SELECT '==================================' AS '';
SELECT 'Dropping Single Column Indexes...' AS status;
SELECT '==================================' AS '';

ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_currency_id;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_parent_id;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_researcher_id;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_photographer_id;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_team_id;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_execution_date;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_created_at;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_project_type;
ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_status;

-- ============================================
-- حذف Full-text Index
-- ============================================

SELECT '==================================' AS '';
SELECT 'Dropping Full-text Index...' AS status;
SELECT '==================================' AS '';

ALTER TABLE project_proposals DROP INDEX IF EXISTS idx_pp_fulltext_search;

-- ============================================
-- التحقق من الحذف
-- ============================================

SELECT '==================================' AS '';
SELECT 'Verifying Rollback...' AS status;
SELECT '==================================' AS '';

SELECT 
    COUNT(DISTINCT INDEX_NAME) AS remaining_custom_indexes
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
AND INDEX_NAME LIKE 'idx_pp%';

-- ============================================
-- عرض الـ Indexes المتبقية
-- ============================================

SELECT '==================================' AS '';
SELECT 'Remaining Indexes:' AS status;
SELECT '==================================' AS '';

SELECT 
    INDEX_NAME,
    INDEX_TYPE,
    NON_UNIQUE,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
GROUP BY INDEX_NAME, INDEX_TYPE, NON_UNIQUE;

SELECT '==================================' AS '';
SELECT '✅ Rollback Completed!' AS status;
SELECT '==================================' AS '';

/*
ملاحظة:
- تم حذف جميع الـ Indexes المضافة
- الـ Indexes الأساسية (PRIMARY, UNIQUE) لم يتم حذفها
- يمكنك الآن إعادة تطبيق التحسينات من جديد إذا لزم الأمر
*/

