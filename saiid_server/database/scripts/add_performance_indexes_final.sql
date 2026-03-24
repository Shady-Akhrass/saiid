-- ✅ إضافة Indexes لتحسين أداء استعلامات project_proposals (Final Version)
-- تاريخ: 2025-12-31
-- هذا الإصدار يتحقق من وجود كل index قبل إنشائه
-- استخدم هذا الإصدار لتجنب أخطاء "Duplicate key name"

-- ✅ دالة مساعدة: التحقق من وجود index وإنشائه إذا لم يكن موجوداً
DELIMITER $$

DROP PROCEDURE IF EXISTS add_index_if_not_exists$$
CREATE PROCEDURE add_index_if_not_exists(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_index_columns VARCHAR(255)
)
BEGIN
    DECLARE index_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO index_exists
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = p_table_name
    AND index_name = p_index_name;
    
    IF index_exists = 0 THEN
        SET @sql = CONCAT('CREATE INDEX `', p_index_name, '` ON `', p_table_name, '` (', p_index_columns, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✅ Created index: ', p_index_name) AS result;
    ELSE
        SELECT CONCAT('⏭️  Index already exists: ', p_index_name) AS result;
    END IF;
END$$

DELIMITER ;

-- ✅ إضافة جميع الـ Indexes
CALL add_index_if_not_exists('project_proposals', 'project_proposals_status_index', '`status`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_project_type_index', '`project_type`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_status_type_index', '`status`, `project_type`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_assigned_researcher_id_index', '`assigned_researcher_id`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_assigned_photographer_id_index', '`assigned_photographer_id`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_assigned_to_team_id_index', '`assigned_to_team_id`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_shelter_id_index', '`shelter_id`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_parent_project_id_index', '`parent_project_id`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_created_at_index', '`created_at`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_execution_date_index', '`execution_date`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_phases_index', '`is_divided_into_phases`, `is_daily_phase`, `is_monthly_phase`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_status_researcher_index', '`status`, `assigned_researcher_id`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_status_photographer_index', '`status`, `assigned_photographer_id`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_status_shelter_index', '`status`, `shelter_id`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_status_created_at_index', '`status`, `created_at`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_status_execution_date_index', '`status`, `execution_date`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_assigned_by_index', '`assigned_by`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_currency_id_index', '`currency_id`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_subcategory_id_index', '`subcategory_id`');
CALL add_index_if_not_exists('project_proposals', 'project_proposals_team_status_index', '`assigned_to_team_id`, `status`');

-- ✅ حذف الـ stored procedure بعد الاستخدام
DROP PROCEDURE IF EXISTS add_index_if_not_exists;

-- ✅ تم إضافة جميع الـ Indexes بنجاح
SELECT '✅ All indexes have been processed. Check messages above for results.' AS final_result;

