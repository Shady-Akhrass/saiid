-- ===================================================================
-- تحويل عمود project_type من ENUM إلى VARCHAR
-- ===================================================================
-- تاريخ الإنشاء: 2025-12-20
-- الوصف: تحويل project_type من ENUM إلى VARCHAR للسماح بأي نوع مشروع
-- ===================================================================

SET @db_name = DATABASE();

-- التحقق من نوع العمود الحالي
SET @column_type = (
    SELECT COLUMN_TYPE 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'project_type'
);

-- التحقق من أن العمود موجود
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'project_proposals' 
    AND COLUMN_NAME = 'project_type'
);

-- تحويل من ENUM إلى VARCHAR إذا كان ENUM
SET @sql = IF(
    @column_exists > 0 AND (
        @column_type LIKE 'enum%' OR 
        @column_type LIKE 'ENUM%'
    ),
    'ALTER TABLE `project_proposals` 
     MODIFY COLUMN `project_type` VARCHAR(255) NULL 
     COMMENT ''نوع المشروع (من جدول project_types)''',
    'SELECT "Column project_type is not ENUM or does not exist" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===================================================================
-- التحقق من نجاح التحويل
-- ===================================================================
SELECT 
    'Migration completed successfully!' AS status,
    (SELECT COLUMN_TYPE 
     FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = @db_name 
     AND TABLE_NAME = 'project_proposals' 
     AND COLUMN_NAME = 'project_type') AS new_column_type;
