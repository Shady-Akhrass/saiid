-- =====================================================
-- SQL Script: إضافة جدول أنواع المشاريع
-- التاريخ: 2025-12-21
-- الوصف: إنشاء جدول project_types وتحويل project_type من ENUM إلى Foreign Key
-- =====================================================

-- 1. إنشاء جدول project_types
CREATE TABLE IF NOT EXISTS `project_types` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL UNIQUE COMMENT 'اسم نوع المشروع',
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_types_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. إدراج البيانات الأولية
INSERT INTO `project_types` (`name`, `created_at`, `updated_at`) VALUES
('إغاثي', NOW(), NOW()),
('تنموي', NOW(), NOW()),
('طبي', NOW(), NOW()),
('تعليمي', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- 3. إضافة عمود project_type_id إلى project_proposals
ALTER TABLE `project_proposals` 
ADD COLUMN `project_type_id` BIGINT UNSIGNED NULL COMMENT 'نوع المشروع (Foreign Key)' AFTER `project_type`;

-- 4. تحويل البيانات الموجودة من ENUM إلى Foreign Key
UPDATE `project_proposals` pp
INNER JOIN `project_types` pt ON pp.project_type = pt.name
SET pp.project_type_id = pt.id;

-- 5. جعل project_type_id NOT NULL بعد تحويل البيانات
ALTER TABLE `project_proposals` 
MODIFY COLUMN `project_type_id` BIGINT UNSIGNED NOT NULL;

-- 6. إضافة Foreign Key
ALTER TABLE `project_proposals` 
ADD CONSTRAINT `fk_project_type` 
FOREIGN KEY (`project_type_id`) 
REFERENCES `project_types` (`id`) 
ON DELETE RESTRICT;

-- ملاحظة: تم الاحتفاظ بعمود project_type القديم للتوافق
-- يمكن حذفه لاحقاً بعد التأكد من عدم استخدامه في أي مكان

