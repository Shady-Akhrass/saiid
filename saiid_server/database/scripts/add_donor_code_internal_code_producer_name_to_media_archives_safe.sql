-- إضافة الحقول الجديدة لجدول media_archives (نسخة آمنة)
-- donor_code: كود المتبرع
-- internal_code: الكود الداخلي للمشروع
-- producer_name: اسم ممنتج المونتاج
-- 
-- هذا السكريبت يتحقق من وجود الحقول قبل إضافتها لتجنب الأخطاء

-- إضافة donor_code إذا لم يكن موجوداً
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'media_archives' 
    AND column_name = 'donor_code'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `media_archives` ADD COLUMN `donor_code` VARCHAR(255) NULL AFTER `donor_name`',
    'SELECT "Column donor_code already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- إضافة internal_code إذا لم يكن موجوداً
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'media_archives' 
    AND column_name = 'internal_code'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `media_archives` ADD COLUMN `internal_code` VARCHAR(255) NULL AFTER `donor_code`',
    'SELECT "Column internal_code already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- إضافة producer_name إذا لم يكن موجوداً
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'media_archives' 
    AND column_name = 'producer_name'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `media_archives` ADD COLUMN `producer_name` VARCHAR(255) NULL AFTER `photographer_name`',
    'SELECT "Column producer_name already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

