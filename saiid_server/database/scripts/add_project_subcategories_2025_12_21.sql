-- =====================================================
-- SQL Script: إضافة نظام التفريعات للمشاريع
-- التاريخ: 2025-12-21
-- الوصف: إضافة جدول التفريعات والحقول الجديدة للمشاريع
-- =====================================================

-- =====================================================
-- 1. إنشاء جدول project_subcategories
-- =====================================================

CREATE TABLE IF NOT EXISTS `project_subcategories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NULL COMMENT 'اسم التفرعية بالإنجليزية',
  `name_ar` VARCHAR(255) NOT NULL COMMENT 'اسم التفرعية بالعربية',
  `project_type` ENUM('إغاثي', 'تنموي', 'طبي', 'تعليمي') NOT NULL COMMENT 'نوع المشروع',
  `description` TEXT NULL COMMENT 'وصف التفرعية',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'تفعيل/تعطيل',
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_project_type` (`project_type`),
  INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. إضافة الحقول الجديدة إلى جدول project_proposals
-- =====================================================

-- التحقق من وجود الحقول قبل الإضافة
SET @dbname = DATABASE();
SET @tablename = 'project_proposals';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = 'subcategory_id')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `subcategory_id` BIGINT UNSIGNED NULL AFTER `project_type` COMMENT ''التفرعية'';')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = 'beneficiaries_count')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `beneficiaries_count` INT UNSIGNED NULL DEFAULT 0 AFTER `quantity` COMMENT ''عدد المستفيدين (يدوي)'';')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = 'beneficiaries_per_unit')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `beneficiaries_per_unit` INT UNSIGNED NULL DEFAULT 0 AFTER `beneficiaries_count` COMMENT ''عدد المستفيدين لكل طرد (لحساب تلقائي)'';')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة Foreign Key
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (CONSTRAINT_NAME = 'fk_project_subcategory')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD CONSTRAINT `fk_project_subcategory` FOREIGN KEY (`subcategory_id`) REFERENCES `project_subcategories` (`id`) ON DELETE SET NULL;')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- 3. إدراج البيانات الافتراضية (Seeder)
-- =====================================================

INSERT INTO `project_subcategories` (`name`, `name_ar`, `project_type`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
-- إغاثي
('Food Distribution', 'إطعام', 'إغاثي', 'مشاريع توزيع الطعام والوجبات للمحتاجين', 1, NOW(), NOW()),
('Health Baskets', 'سلال صحية', 'إغاثي', 'توزيع سلال صحية تحتوي على مواد غذائية صحية', 1, NOW(), NOW()),
('Shelter', 'مأوى', 'إغاثي', 'توفير مأوى للمحتاجين والمشردين', 1, NOW(), NOW()),
('Clothing', 'ملابس', 'إغاثي', 'توزيع الملابس للمحتاجين', 1, NOW(), NOW()),

-- تنموي
('Vocational Training', 'تدريب مهني', 'تنموي', 'برامج تدريب مهني لتأهيل الأفراد للعمل', 1, NOW(), NOW()),
('Small Projects', 'مشاريع صغيرة', 'تنموي', 'دعم المشاريع الصغيرة والمتوسطة', 1, NOW(), NOW()),
('Agriculture', 'زراعة', 'تنموي', 'مشاريع زراعية لتحقيق الاكتفاء الذاتي', 1, NOW(), NOW()),

-- طبي
('Surgical Operations', 'عمليات جراحية', 'طبي', 'تمويل العمليات الجراحية للمحتاجين', 1, NOW(), NOW()),
('Medications', 'أدوية', 'طبي', 'توفير الأدوية للمرضى المحتاجين', 1, NOW(), NOW()),
('Medical Tests', 'فحوصات', 'طبي', 'تمويل الفحوصات الطبية للمحتاجين', 1, NOW(), NOW()),

-- تعليمي
('Scholarships', 'منح دراسية', 'تعليمي', 'منح دراسية للطلاب المحتاجين', 1, NOW(), NOW()),
('School Supplies', 'قرطاسية', 'تعليمي', 'توفير القرطاسية والكتب المدرسية', 1, NOW(), NOW()),
('Educational Devices', 'أجهزة', 'تعليمي', 'توفير الأجهزة التعليمية مثل الحواسيب والأجهزة اللوحية', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- =====================================================
-- ملاحظات:
-- =====================================================
-- 1. تم استخدام IF NOT EXISTS للتحقق من وجود الحقول قبل الإضافة
-- 2. يمكن تشغيل هذا الملف عدة مرات بأمان (idempotent)
-- 3. البيانات الافتراضية تستخدم ON DUPLICATE KEY UPDATE لتجنب الأخطاء
-- 4. Foreign Key يستخدم ON DELETE SET NULL لحماية البيانات
-- =====================================================

