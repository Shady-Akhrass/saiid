-- ===================================================================
-- إضافة حقول المشاريع الشهرية إلى جدول project_proposals
-- ===================================================================
-- تاريخ الإنشاء: 2025-12-20
-- الوصف: إضافة الحقول المطلوبة لنظام تقسيم المشاريع الشهرية
-- ===================================================================

-- التحقق من وجود الأعمدة قبل إضافتها (idempotent)
SET @db_name = DATABASE();

-- التحقق من وجود phase_type
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'phase_type'
);

-- إضافة phase_type إذا لم يكن موجوداً
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `project_proposals` 
     ADD COLUMN `phase_type` ENUM(\'daily\', \'monthly\') NULL 
     AFTER `is_divided_into_phases`,
     ADD INDEX `idx_phase_type` (`phase_type`)',
    'SELECT "Column phase_type already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- التحقق من وجود total_months
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'total_months'
);

-- إضافة total_months إذا لم يكن موجوداً
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `project_proposals` 
     ADD COLUMN `total_months` INT NULL 
     AFTER `phase_duration_days`',
    'SELECT "Column total_months already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- التحقق من وجود month_number
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'month_number'
);

-- إضافة month_number إذا لم يكن موجوداً
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `project_proposals` 
     ADD COLUMN `month_number` INT NULL 
     AFTER `phase_day`',
    'SELECT "Column month_number already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- التحقق من وجود is_monthly_phase
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'is_monthly_phase'
);

-- إضافة is_monthly_phase إذا لم يكن موجوداً
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `project_proposals` 
     ADD COLUMN `is_monthly_phase` TINYINT(1) NOT NULL DEFAULT 0 
     AFTER `is_daily_phase`,
     ADD INDEX `idx_is_monthly_phase` (`is_monthly_phase`)',
    'SELECT "Column is_monthly_phase already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- التحقق من وجود month_start_date
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'month_start_date'
);

-- إضافة month_start_date إذا لم يكن موجوداً
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `project_proposals` 
     ADD COLUMN `month_start_date` DATE NULL 
     AFTER `phase_start_date`',
    'SELECT "Column month_start_date already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- إضافة index مركب إذا لم يكن موجوداً
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'project_proposals' 
    AND INDEX_NAME = 'project_proposals_parent_project_id_month_number_index'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE `project_proposals` 
     ADD INDEX `project_proposals_parent_project_id_month_number_index` (`parent_project_id`, `month_number`)',
    'SELECT "Index already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===================================================================
-- التحقق من نجاح الإضافة
-- ===================================================================
SELECT 
    'Migration completed successfully!' AS status,
    (SELECT COUNT(*) FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = @db_name 
     AND TABLE_NAME = 'project_proposals' 
     AND COLUMN_NAME IN ('phase_type', 'total_months', 'month_number', 'is_monthly_phase', 'month_start_date')) 
    AS columns_added;
