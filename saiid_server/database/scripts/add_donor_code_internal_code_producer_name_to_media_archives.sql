-- إضافة الحقول الجديدة لجدول media_archives
-- donor_code: كود المتبرع
-- internal_code: الكود الداخلي للمشروع
-- producer_name: اسم ممنتج المونتاج

-- التحقق من وجود الجدول أولاً
SET @table_exists = (
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() 
    AND table_name = 'media_archives'
);

-- إضافة الحقول إذا كان الجدول موجوداً
SET @sql = IF(@table_exists > 0,
    CONCAT(
        'ALTER TABLE `media_archives` ',
        'ADD COLUMN `donor_code` VARCHAR(255) NULL AFTER `donor_name`, ',
        'ADD COLUMN `internal_code` VARCHAR(255) NULL AFTER `donor_code`, ',
        'ADD COLUMN `producer_name` VARCHAR(255) NULL AFTER `photographer_name`'
    ),
    'SELECT "Table media_archives does not exist" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- بديل: استخدام ALTER TABLE مباشرة (إذا كنت متأكداً من وجود الجدول)
-- ALTER TABLE `media_archives`
-- ADD COLUMN `donor_code` VARCHAR(255) NULL AFTER `donor_name`,
-- ADD COLUMN `internal_code` VARCHAR(255) NULL AFTER `donor_code`,
-- ADD COLUMN `producer_name` VARCHAR(255) NULL AFTER `photographer_name`;

