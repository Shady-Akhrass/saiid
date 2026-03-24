-- =====================================================
-- SQL Script: إضافة نظام التفريعات للمشاريع (نسخة مبسطة)
-- التاريخ: 2025-12-21
-- =====================================================

-- 1. إنشاء جدول project_subcategories
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

-- 2. إضافة الحقول الجديدة إلى project_proposals
ALTER TABLE `project_proposals` 
ADD COLUMN `subcategory_id` BIGINT UNSIGNED NULL COMMENT 'التفرعية' AFTER `project_type`;

ALTER TABLE `project_proposals` 
ADD COLUMN `beneficiaries_count` INT UNSIGNED NULL DEFAULT 0 COMMENT 'عدد المستفيدين (يدوي)' AFTER `quantity`;

ALTER TABLE `project_proposals` 
ADD COLUMN `beneficiaries_per_unit` INT UNSIGNED NULL DEFAULT 0 COMMENT 'عدد المستفيدين لكل طرد (لحساب تلقائي)' AFTER `beneficiaries_count`;

-- 3. إضافة Foreign Key
ALTER TABLE `project_proposals` 
ADD CONSTRAINT `fk_project_subcategory` 
FOREIGN KEY (`subcategory_id`) 
REFERENCES `project_subcategories` (`id`) 
ON DELETE SET NULL;

-- 4. إدراج البيانات الافتراضية
INSERT INTO `project_subcategories` (`name`, `name_ar`, `project_type`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
('Food Distribution', 'إطعام', 'إغاثي', 'مشاريع توزيع الطعام والوجبات للمحتاجين', 1, NOW(), NOW()),
('Health Baskets', 'سلال صحية', 'إغاثي', 'توزيع سلال صحية تحتوي على مواد غذائية صحية', 1, NOW(), NOW()),
('Shelter', 'مأوى', 'إغاثي', 'توفير مأوى للمحتاجين والمشردين', 1, NOW(), NOW()),
('Clothing', 'ملابس', 'إغاثي', 'توزيع الملابس للمحتاجين', 1, NOW(), NOW()),
('Vocational Training', 'تدريب مهني', 'تنموي', 'برامج تدريب مهني لتأهيل الأفراد للعمل', 1, NOW(), NOW()),
('Small Projects', 'مشاريع صغيرة', 'تنموي', 'دعم المشاريع الصغيرة والمتوسطة', 1, NOW(), NOW()),
('Agriculture', 'زراعة', 'تنموي', 'مشاريع زراعية لتحقيق الاكتفاء الذاتي', 1, NOW(), NOW()),
('Surgical Operations', 'عمليات جراحية', 'طبي', 'تمويل العمليات الجراحية للمحتاجين', 1, NOW(), NOW()),
('Medications', 'أدوية', 'طبي', 'توفير الأدوية للمرضى المحتاجين', 1, NOW(), NOW()),
('Medical Tests', 'فحوصات', 'طبي', 'تمويل الفحوصات الطبية للمحتاجين', 1, NOW(), NOW()),
('Scholarships', 'منح دراسية', 'تعليمي', 'منح دراسية للطلاب المحتاجين', 1, NOW(), NOW()),
('School Supplies', 'قرطاسية', 'تعليمي', 'توفير القرطاسية والكتب المدرسية', 1, NOW(), NOW()),
('Educational Devices', 'أجهزة', 'تعليمي', 'توفير الأجهزة التعليمية مثل الحواسيب والأجهزة اللوحية', 1, NOW(), NOW());

