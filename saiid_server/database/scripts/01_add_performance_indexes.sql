-- ============================================
-- 🚀 تحسينات الأداء - إضافة Indexes
-- سعيد API - Performance Optimization
-- التاريخ: 2026-01-05
-- ============================================

USE u302193701_api; -- ✅ غيّر اسم قاعدة البيانات حسب السيرفر

-- ============================================
-- التحقق من وجود الجدول
-- ============================================
SELECT 'Checking table exists...' AS status;
SELECT COUNT(*) AS table_exists 
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
AND table_name = 'project_proposals';

-- ============================================
-- 1. Single Column Indexes (9 indexes)
-- ============================================

SELECT '==================================' AS '';
SELECT 'Adding Single Column Indexes...' AS status;
SELECT '==================================' AS '';

-- Index على status (مستخدم بكثرة في الفلترة)
SELECT 'Adding index: idx_pp_status' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_status ON project_proposals(status);

-- Index على project_type
SELECT 'Adding index: idx_pp_project_type' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_project_type ON project_proposals(project_type);

-- Index على created_at (مستخدم في الترتيب)
SELECT 'Adding index: idx_pp_created_at' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_created_at ON project_proposals(created_at);

-- Index على execution_date
SELECT 'Adding index: idx_pp_execution_date' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_execution_date ON project_proposals(execution_date);

-- Index على assigned_to_team_id
SELECT 'Adding index: idx_pp_team_id' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_team_id ON project_proposals(assigned_to_team_id);

-- Index على assigned_photographer_id
SELECT 'Adding index: idx_pp_photographer_id' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_photographer_id ON project_proposals(assigned_photographer_id);

-- Index على assigned_researcher_id
SELECT 'Adding index: idx_pp_researcher_id' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_researcher_id ON project_proposals(assigned_researcher_id);

-- Index على parent_project_id
SELECT 'Adding index: idx_pp_parent_id' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_parent_id ON project_proposals(parent_project_id);

-- Index على currency_id
SELECT 'Adding index: idx_pp_currency_id' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_currency_id ON project_proposals(currency_id);

-- ============================================
-- 2. Flags Indexes (3 indexes)
-- ============================================

SELECT '==================================' AS '';
SELECT 'Adding Flags Indexes...' AS status;
SELECT '==================================' AS '';

-- Index على is_daily_phase
SELECT 'Adding index: idx_pp_is_daily' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_is_daily ON project_proposals(is_daily_phase);

-- Index على is_divided_into_phases
SELECT 'Adding index: idx_pp_is_divided' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_is_divided ON project_proposals(is_divided_into_phases);

-- Index على is_monthly_phase
SELECT 'Adding index: idx_pp_is_monthly' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_is_monthly ON project_proposals(is_monthly_phase);

-- ============================================
-- 3. Composite Indexes (5 indexes)
-- ============================================

SELECT '==================================' AS '';
SELECT 'Adding Composite Indexes...' AS status;
SELECT '==================================' AS '';

-- Composite Index: status + project_type
SELECT 'Adding index: idx_pp_status_type' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_status_type ON project_proposals(status, project_type);

-- Composite Index: status + created_at
SELECT 'Adding index: idx_pp_status_date' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_status_date ON project_proposals(status, created_at);

-- Composite Index: is_daily_phase + execution_date
SELECT 'Adding index: idx_pp_daily_exec_date' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_daily_exec_date ON project_proposals(is_daily_phase, execution_date);

-- Composite Index: is_monthly_phase + month_start_date
SELECT 'Adding index: idx_pp_monthly_start' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_monthly_start ON project_proposals(is_monthly_phase, month_start_date);

-- Composite Index: parent_project_id + phase_day
SELECT 'Adding index: idx_pp_parent_phase' AS status;
CREATE INDEX IF NOT EXISTS idx_pp_parent_phase ON project_proposals(parent_project_id, phase_day);

-- ============================================
-- التحقق من الـ Indexes المضافة
-- ============================================

SELECT '==================================' AS '';
SELECT 'Verifying Indexes...' AS status;
SELECT '==================================' AS '';

SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
AND INDEX_NAME LIKE 'idx_pp%'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- عد الـ Indexes
SELECT '==================================' AS '';
SELECT 'Total Indexes Count:' AS status;
SELECT COUNT(DISTINCT INDEX_NAME) AS total_indexes
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
AND INDEX_NAME LIKE 'idx_pp%';

SELECT '==================================' AS '';
SELECT '✅ Performance Indexes Added Successfully!' AS status;
SELECT '==================================' AS '';

