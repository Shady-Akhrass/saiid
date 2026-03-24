-- ✅ التحقق من Indexes على month_start_date
-- شغل هذا الاستعلام أولاً

-- 1. التحقق من وجود index على month_start_date
SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    NON_UNIQUE,
    INDEX_TYPE
FROM information_schema.statistics
WHERE table_schema = DATABASE()
AND table_name = 'project_proposals'
AND COLUMN_NAME = 'month_start_date';

-- 2. عدد الـ indexes الكلي
SELECT 
    COUNT(DISTINCT INDEX_NAME) as total_indexes
FROM information_schema.statistics
WHERE table_schema = DATABASE()
AND table_name = 'project_proposals';

-- 3. البحث عن composite indexes تحتوي على month_start_date
SELECT 
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns
FROM information_schema.statistics
WHERE table_schema = DATABASE()
AND table_name = 'project_proposals'
AND INDEX_NAME != 'PRIMARY'
GROUP BY INDEX_NAME
HAVING FIND_IN_SET('month_start_date', columns) > 0;
