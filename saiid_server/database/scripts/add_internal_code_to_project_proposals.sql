-- ============================================
-- إضافة حقل internal_code إلى جدول project_proposals
-- Add internal_code column to project_proposals table
-- ============================================
-- تاريخ الإنشاء: 2025-12-16
-- الغرض: إضافة كود داخلي تلقائي لكل مشروع (YYNNNNN format)
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- ============================================
-- الجزء 1: إضافة العمود internal_code
-- ============================================

-- التحقق من وجود الجدول أولاً
SET @table_exists = (
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals'
);

-- إضافة العمود إذا لم يكن موجوداً
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'project_proposals' 
    AND column_name = 'internal_code'
);

-- إضافة العمود
SET @sql = IF(@table_exists > 0 AND @column_exists = 0,
    'ALTER TABLE `project_proposals` 
     ADD COLUMN `internal_code` VARCHAR(7) NULL UNIQUE AFTER `donor_code`,
     ADD INDEX `project_proposals_internal_code_index` (`internal_code`)',
    'SELECT "Column internal_code already exists or table does not exist" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- الجزء 2: توليد internal_code للمشاريع الموجودة (محسّن)
-- ============================================

-- ملاحظة: هذه الطريقة أسرع بكثير من استخدام Cursor
-- تقوم بتوليد الأكواد لكل سنة على حدة باستخدام UPDATE مباشر

-- دالة محسّنة لتوليد الكود الداخلي
DELIMITER $$

DROP PROCEDURE IF EXISTS generate_internal_codes$$

CREATE PROCEDURE generate_internal_codes()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE project_year INT;
    DECLARE current_year INT;
    DECLARE year_prefix VARCHAR(2);
    DECLARE last_sequence INT;
    DECLARE batch_size INT DEFAULT 1000;
    DECLARE processed_count INT DEFAULT 0;
    
    -- Cursor للسنوات المختلفة
    DECLARE year_cur CURSOR FOR 
        SELECT DISTINCT YEAR(created_at) as year
        FROM project_proposals 
        WHERE (internal_code IS NULL OR internal_code = '')
        AND created_at IS NOT NULL
        ORDER BY year ASC;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    SET current_year = YEAR(NOW());
    
    OPEN year_cur;
    
    year_loop: LOOP
        FETCH year_cur INTO project_year;
        
        IF done THEN
            LEAVE year_loop;
        END IF;
        
        SET project_year = IFNULL(project_year, current_year);
        SET year_prefix = LPAD(MOD(project_year, 100), 2, '0');
        
        -- البحث عن آخر كود في نفس السنة
        SELECT COALESCE(MAX(CAST(SUBSTRING(internal_code, 3) AS UNSIGNED)), 0)
        INTO last_sequence
        FROM project_proposals
        WHERE internal_code LIKE CONCAT(year_prefix, '%')
        AND internal_code IS NOT NULL
        AND LENGTH(internal_code) = 7;
        
        -- تحديث المشاريع في هذه السنة باستخدام UPDATE مباشر (أسرع بكثير)
        SET @seq = last_sequence;
        SET @year_prefix = year_prefix;
        
        UPDATE project_proposals 
        SET internal_code = CONCAT(
            @year_prefix, 
            LPAD((@seq := @seq + 1), 5, '0')
        )
        WHERE (internal_code IS NULL OR internal_code = '')
        AND YEAR(created_at) = project_year
        AND NOT EXISTS (
            SELECT 1 FROM project_proposals p2 
            WHERE p2.internal_code = CONCAT(@year_prefix, LPAD(@seq + 1, 5, '0'))
        )
        ORDER BY id ASC
        LIMIT batch_size;
        
        SET processed_count = processed_count + ROW_COUNT();
        
    END LOOP;
    
    CLOSE year_cur;
    
    -- معالجة المشاريع التي لا تحتوي على created_at
    SET @year_prefix = LPAD(MOD(current_year, 100), 2, '0');
    SELECT COALESCE(MAX(CAST(SUBSTRING(internal_code, 3) AS UNSIGNED)), 0)
    INTO last_sequence
    FROM project_proposals
    WHERE internal_code LIKE CONCAT(@year_prefix, '%')
    AND internal_code IS NOT NULL
    AND LENGTH(internal_code) = 7;
    
    SET @seq = last_sequence;
    
    UPDATE project_proposals 
    SET internal_code = CONCAT(
        @year_prefix, 
        LPAD((@seq := @seq + 1), 5, '0')
    )
    WHERE (internal_code IS NULL OR internal_code = '')
    AND created_at IS NULL
    ORDER BY id ASC
    LIMIT batch_size;
    
    SET processed_count = processed_count + ROW_COUNT();
    
    SELECT processed_count as total_processed;
END$$

DELIMITER ;

-- زيادة وقت تنفيذ الاستعلام (إذا كان مسموحاً)
SET SESSION max_statement_time = 300; -- 5 دقائق

-- تشغيل الدالة لتوليد الأكواد للمشاريع الموجودة
CALL generate_internal_codes();

-- حذف الدالة بعد الاستخدام
DROP PROCEDURE IF EXISTS generate_internal_codes;

-- ============================================
-- الجزء 3: التحقق من النتائج
-- ============================================

-- عرض عدد المشاريع التي تم تحديثها
SELECT 
    COUNT(*) as total_projects,
    COUNT(internal_code) as projects_with_internal_code,
    COUNT(*) - COUNT(internal_code) as projects_without_internal_code
FROM project_proposals;

-- عرض عينة من الأكواد المولدة
SELECT 
    id,
    serial_number,
    donor_code,
    internal_code,
    YEAR(created_at) as project_year,
    created_at
FROM project_proposals
WHERE internal_code IS NOT NULL
ORDER BY internal_code DESC
LIMIT 10;

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- ملاحظات:
-- ============================================
-- 1. يتم توليد الكود الداخلي تلقائياً لكل مشروع جديد من خلال Laravel Model
-- 2. هذا الـ Script يولد الأكواد للمشاريع الموجودة فقط
-- 3. التنسيق: YYNNNNN (سنة من رقمين + 5 أرقام متسلسلة)
-- 4. مثال: 2500001, 2500002, ... (للسنة 2025)
-- 5. مثال: 2600001, 2600002, ... (للسنة 2026)
-- ============================================
