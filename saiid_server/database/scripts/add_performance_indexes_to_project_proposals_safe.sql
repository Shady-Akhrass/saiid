-- ✅ إضافة Indexes لتحسين أداء استعلامات project_proposals (Safe Version)
-- تاريخ: 2025-12-31
-- الهدف: تحسين سرعة الاستعلامات عند مدير المشاريع وباقي الأدوار
-- هذا الإصدار يتحقق من وجود الـ indexes قبل إنشائها

-- ✅ دالة مساعدة للتحقق من وجود Index
-- ملاحظة: يجب تشغيل كل CREATE INDEX في استعلام منفصل

-- ✅ Index للـ status (الأكثر استخداماً في الفلترة)
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_status_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_status_index` ON `project_proposals` (`status`)',
    'SELECT "Index project_proposals_status_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ project_type
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_project_type_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_project_type_index` ON `project_proposals` (`project_type`)',
    'SELECT "Index project_proposals_project_type_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Composite index للـ status و project_type
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_status_type_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_status_type_index` ON `project_proposals` (`status`, `project_type`)',
    'SELECT "Index project_proposals_status_type_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ assigned_researcher_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_assigned_researcher_id_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_assigned_researcher_id_index` ON `project_proposals` (`assigned_researcher_id`)',
    'SELECT "Index project_proposals_assigned_researcher_id_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ assigned_photographer_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_assigned_photographer_id_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_assigned_photographer_id_index` ON `project_proposals` (`assigned_photographer_id`)',
    'SELECT "Index project_proposals_assigned_photographer_id_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ assigned_to_team_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_assigned_to_team_id_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_assigned_to_team_id_index` ON `project_proposals` (`assigned_to_team_id`)',
    'SELECT "Index project_proposals_assigned_to_team_id_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ shelter_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_shelter_id_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_shelter_id_index` ON `project_proposals` (`shelter_id`)',
    'SELECT "Index project_proposals_shelter_id_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ parent_project_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_parent_project_id_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_parent_project_id_index` ON `project_proposals` (`parent_project_id`)',
    'SELECT "Index project_proposals_parent_project_id_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ created_at
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_created_at_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_created_at_index` ON `project_proposals` (`created_at`)',
    'SELECT "Index project_proposals_created_at_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ execution_date
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_execution_date_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_execution_date_index` ON `project_proposals` (`execution_date`)',
    'SELECT "Index project_proposals_execution_date_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Composite index للـ phases
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_phases_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_phases_index` ON `project_proposals` (`is_divided_into_phases`, `is_daily_phase`, `is_monthly_phase`)',
    'SELECT "Index project_proposals_phases_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Composite index للـ status و assigned_researcher_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_status_researcher_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_status_researcher_index` ON `project_proposals` (`status`, `assigned_researcher_id`)',
    'SELECT "Index project_proposals_status_researcher_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Composite index للـ status و assigned_photographer_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_status_photographer_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_status_photographer_index` ON `project_proposals` (`status`, `assigned_photographer_id`)',
    'SELECT "Index project_proposals_status_photographer_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Composite index للـ status و shelter_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_status_shelter_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_status_shelter_index` ON `project_proposals` (`status`, `shelter_id`)',
    'SELECT "Index project_proposals_status_shelter_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Composite index للـ status و created_at
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_status_created_at_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_status_created_at_index` ON `project_proposals` (`status`, `created_at`)',
    'SELECT "Index project_proposals_status_created_at_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Composite index للـ status و execution_date
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_status_execution_date_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_status_execution_date_index` ON `project_proposals` (`status`, `execution_date`)',
    'SELECT "Index project_proposals_status_execution_date_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ assigned_by
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_assigned_by_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_assigned_by_index` ON `project_proposals` (`assigned_by`)',
    'SELECT "Index project_proposals_assigned_by_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ currency_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_currency_id_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_currency_id_index` ON `project_proposals` (`currency_id`)',
    'SELECT "Index project_proposals_currency_id_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Index للـ subcategory_id
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_subcategory_id_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_subcategory_id_index` ON `project_proposals` (`subcategory_id`)',
    'SELECT "Index project_proposals_subcategory_id_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ Composite index للـ assigned_to_team_id و status
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND index_name = 'project_proposals_team_status_index'
);
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX `project_proposals_team_status_index` ON `project_proposals` (`assigned_to_team_id`, `status`)',
    'SELECT "Index project_proposals_team_status_index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ✅ تم إضافة جميع الـ Indexes بنجاح
SELECT 'All indexes have been processed. Check messages above for any that already existed.' AS result;

