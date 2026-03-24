-- ✅ التحقق من الـ Indexes الموجودة في project_proposals
-- تاريخ: 2025-12-31
-- استخدم هذا الاستعلام لمعرفة أي indexes موجودة وأيها مفقود

SELECT 
    INDEX_NAME as 'Index Name',
    COLUMN_NAME as 'Column Name',
    SEQ_IN_INDEX as 'Column Order',
    NON_UNIQUE as 'Non Unique',
    INDEX_TYPE as 'Index Type'
FROM 
    information_schema.statistics
WHERE 
    table_schema = DATABASE()
    AND table_name = 'project_proposals'
    AND INDEX_NAME NOT IN ('PRIMARY')  -- استثناء primary key
ORDER BY 
    INDEX_NAME, SEQ_IN_INDEX;

-- ✅ للتحقق من indexes محددة:
-- SELECT INDEX_NAME 
-- FROM information_schema.statistics 
-- WHERE table_schema = DATABASE() 
-- AND table_name = 'project_proposals' 
-- AND INDEX_NAME = 'project_proposals_status_index';

