-- =====================================================
-- SQL Script: إضافة نظام المستفيدين للمشاريع
-- التاريخ: 2025-12-28
-- الوصف: إضافة نظام كامل لإدارة المستفيدين من المشاريع المنفذة
-- =====================================================

-- =====================================================
-- 1. إضافة عمود beneficiaries_excel_file إلى جدول project_proposals
-- =====================================================

-- التحقق من وجود العمود قبل الإضافة
SET @dbname = DATABASE();
SET @tablename = 'project_proposals';
SET @columnname = 'beneficiaries_excel_file';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 'Column already exists.'",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " VARCHAR(255) NULL COMMENT 'مسار ملف Excel للمستفيدين' AFTER notes_image")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- 2. إنشاء جدول beneficiaries
-- =====================================================

CREATE TABLE IF NOT EXISTS `beneficiaries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_proposal_id` BIGINT UNSIGNED NOT NULL COMMENT 'المشروع',
  `name` VARCHAR(255) NOT NULL COMMENT 'اسم المستفيد',
  `id_number` VARCHAR(255) NOT NULL COMMENT 'رقم الهوية',
  `phone` VARCHAR(255) NULL COMMENT 'رقم الهاتف',
  `address` TEXT NULL COMMENT 'العنوان',
  `governorate` VARCHAR(255) NULL COMMENT 'المحافظة',
  `district` VARCHAR(255) NULL COMMENT 'المنطقة',
  `aid_type` VARCHAR(255) NULL COMMENT 'نوع المساعدة - يُملأ تلقائياً من subcategory',
  `notes` TEXT NULL COMMENT 'ملاحظات',
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_beneficiaries_id_number` (`id_number`),
  INDEX `idx_beneficiaries_aid_type` (`aid_type`),
  INDEX `idx_beneficiaries_project_proposal_id` (`project_proposal_id`),
  CONSTRAINT `fk_beneficiaries_project_proposal`
    FOREIGN KEY (`project_proposal_id`)
    REFERENCES `project_proposals` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. إضافة notification type جديد: missing_beneficiaries_file
-- =====================================================

-- تحديث enum notification_type لإضافة missing_beneficiaries_file
ALTER TABLE `notifications` MODIFY COLUMN `notification_type` ENUM(
    'new_assignment',
    'ready_for_shelter_selection',
    'ready_for_montage',
    'delay_execution',
    'delay_montage',
    'status_change',
    'photographer_assignment',
    'project_created',
    'project_assigned',
    'project_status_changed',
    'shelter_selected',
    'media_updated',
    'daily_phase',
    'project_postponed',
    'project_resumed',
    'project_cancelled',
    'project_transferred_to_execution',
    'media_completed',
    'media_rejected',
    'media_accepted',
    'supply_started',
    'supply_confirmed',
    'low_stock',
    'project_deficit',
    'shekel_converted',
    'montage_producer_assigned',
    'montage_completed_by_producer',
    'montage_approved_by_manager',
    'researcher_assigned',
    'photographer_assigned',
    'missing_beneficiaries_file'
) DEFAULT NULL;

-- =====================================================
-- تم الانتهاء من جميع التعديلات
-- =====================================================

