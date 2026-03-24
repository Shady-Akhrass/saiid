-- ============================================
-- ملف SQL مبسط للتغييرات على قاعدة البيانات من 20-11-2025
-- Database Changes SQL Script (Simplified Version)
-- ============================================
-- تاريخ الإنشاء: 2025
-- الغرض: يحتوي على جميع الجداول الجديدة والتعديلات على الجداول القديمة
-- ملاحظة: هذه النسخة المبسطة تستخدم أوامر مباشرة بدون Prepared Statements
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- ============================================
-- الجزء 1: الجداول الجديدة (New Tables)
-- ============================================

-- --------------------------------------------------------
-- جدول العملات (Currencies)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `currencies` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `currency_code` varchar(3) NOT NULL,
  `currency_name_ar` varchar(255) NOT NULL,
  `currency_name_en` varchar(255) NOT NULL,
  `currency_symbol` varchar(10) NOT NULL,
  `exchange_rate_to_usd` decimal(10,4) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `currencies_currency_code_unique` (`currency_code`),
  KEY `currencies_is_active_index` (`is_active`),
  KEY `currencies_last_updated_by_foreign` (`last_updated_by`),
  CONSTRAINT `currencies_last_updated_by_foreign` FOREIGN KEY (`last_updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول الفرق (Teams)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `teams` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `team_name` varchar(255) NOT NULL,
  `team_leader_id` bigint(20) UNSIGNED DEFAULT NULL,
  `team_type` enum('إغاثة','مشاريع تنموية','صحة','تعليم') DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `teams_is_active_index` (`is_active`),
  KEY `teams_team_leader_id_foreign` (`team_leader_id`),
  CONSTRAINT `teams_team_leader_id_foreign` FOREIGN KEY (`team_leader_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول الكوادر (Team Personnel)
-- ملاحظة: يجب إنشاؤه قبل team_members لأنه يعتمد عليه
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `team_personnel` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `phone_number` varchar(10) NOT NULL,
  `personnel_type` enum('باحث','مصور') NOT NULL,
  `department` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `team_personnel_phone_number_unique` (`phone_number`),
  KEY `team_personnel_personnel_type_index` (`personnel_type`),
  KEY `team_personnel_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول أعضاء الفرق (Team Members)
-- ملاحظة: يستخدم team_personnel بدلاً من users (تم التحديث لاحقاً)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `team_members` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `team_id` bigint(20) UNSIGNED NOT NULL,
  `personnel_id` bigint(20) UNSIGNED NOT NULL,
  `role_in_team` enum('قائد','عضو','منسق') NOT NULL DEFAULT 'عضو',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `team_members_team_id_personnel_id_unique` (`team_id`,`personnel_id`),
  KEY `team_members_team_id_index` (`team_id`),
  KEY `team_members_personnel_id_index` (`personnel_id`),
  KEY `team_members_is_active_index` (`is_active`),
  CONSTRAINT `team_members_team_id_foreign` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `team_members_personnel_id_foreign` FOREIGN KEY (`personnel_id`) REFERENCES `team_personnel` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول أقسام الوافر (Surplus Categories)
-- ملاحظة: يجب إنشاؤه قبل project_proposals لأنه يعتمد عليه
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `surplus_categories` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `surplus_categories_name_unique` (`name`),
  KEY `surplus_categories_created_by_foreign` (`created_by`),
  CONSTRAINT `surplus_categories_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول المشاريع المقترحة (Project Proposals)
-- ملاحظة: هذا الجدول كبير ويحتوي على جميع التعديلات اللاحقة
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `project_proposals` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `serial_number` varchar(255) NOT NULL,
  `donor_code` varchar(255) DEFAULT NULL,
  `project_name` varchar(255) DEFAULT NULL,
  `project_description` text NOT NULL,
  `donor_name` varchar(255) NOT NULL,
  `project_type` enum('إغاثي','تنموي','طبي','تعليمي') NOT NULL,
  `donation_amount` decimal(15,2) NOT NULL,
  `currency_id` bigint(20) UNSIGNED NOT NULL,
  `exchange_rate` decimal(10,4) NOT NULL,
  `amount_in_usd` decimal(15,2) NOT NULL,
  `admin_discount_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `net_amount` decimal(15,2) NOT NULL,
  `shekel_exchange_rate` decimal(10,4) DEFAULT NULL,
  `net_amount_shekel` decimal(15,2) DEFAULT NULL,
  `shekel_converted_at` timestamp NULL DEFAULT NULL,
  `shekel_converted_by` bigint(20) UNSIGNED DEFAULT NULL,
  `quantity` int(11) DEFAULT 0,
  `unit_cost` decimal(10,2) DEFAULT NULL,
  `supply_cost` decimal(10,2) DEFAULT NULL,
  `surplus_amount` decimal(10,2) DEFAULT NULL,
  `has_deficit` tinyint(1) NOT NULL DEFAULT 0,
  `surplus_notes` text DEFAULT NULL,
  `surplus_recorded_at` timestamp NULL DEFAULT NULL,
  `surplus_recorded_by` bigint(20) UNSIGNED DEFAULT NULL,
  `surplus_category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `estimated_duration_days` int(11) DEFAULT NULL,
  `is_divided_into_phases` tinyint(1) NOT NULL DEFAULT 0,
  `phase_duration_days` int(11) DEFAULT NULL,
  `phase_start_date` date DEFAULT NULL,
  `parent_project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `phase_day` int(11) DEFAULT NULL,
  `is_daily_phase` tinyint(1) NOT NULL DEFAULT 0,
  `status` enum('جديد','قيد التوريد','تم التوريد','قيد التوزيع','جاهز للتنفيذ','تم اختيار المخيم','قيد التنفيذ','منفذ','في المونتاج','تم المونتاج','وصل للمتبرع','ملغى','معاد مونتاجه','مؤجل') NOT NULL DEFAULT 'جديد',
  `assigned_to_team_id` bigint(20) UNSIGNED DEFAULT NULL,
  `assigned_photographer_id` bigint(20) UNSIGNED DEFAULT NULL,
  `assigned_by` bigint(20) UNSIGNED DEFAULT NULL,
  `assignment_date` date DEFAULT NULL,
  `shelter_id` varchar(255) DEFAULT NULL,
  `execution_date` date DEFAULT NULL,
  `media_received_date` date DEFAULT NULL,
  `montage_start_date` date DEFAULT NULL,
  `montage_completed_date` date DEFAULT NULL,
  `sent_to_donor_date` date DEFAULT NULL,
  `transferred_to_projects` tinyint(1) NOT NULL DEFAULT 0,
  `project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `project_image` varchar(255) DEFAULT NULL,
  `notes_image` varchar(255) DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_proposals_serial_number_unique` (`serial_number`),
  KEY `project_proposals_status_index` (`status`),
  KEY `project_proposals_project_type_index` (`project_type`),
  KEY `project_proposals_serial_number_index` (`serial_number`),
  KEY `project_proposals_created_by_index` (`created_by`),
  KEY `project_proposals_assigned_to_team_id_index` (`assigned_to_team_id`),
  KEY `project_proposals_shelter_id_index` (`shelter_id`),
  KEY `project_proposals_transferred_to_projects_index` (`transferred_to_projects`),
  KEY `project_proposals_project_name_index` (`project_name`),
  KEY `project_proposals_parent_project_id_index` (`parent_project_id`,`phase_day`),
  KEY `project_proposals_is_daily_phase_index` (`is_daily_phase`),
  KEY `project_proposals_currency_id_foreign` (`currency_id`),
  KEY `project_proposals_assigned_photographer_id_foreign` (`assigned_photographer_id`),
  KEY `project_proposals_assigned_by_foreign` (`assigned_by`),
  KEY `project_proposals_project_id_foreign` (`project_id`),
  KEY `project_proposals_created_by_foreign` (`created_by`),
  KEY `project_proposals_shekel_converted_by_foreign` (`shekel_converted_by`),
  KEY `project_proposals_surplus_recorded_by_foreign` (`surplus_recorded_by`),
  KEY `project_proposals_surplus_category_id_foreign` (`surplus_category_id`),
  CONSTRAINT `project_proposals_currency_id_foreign` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `project_proposals_assigned_to_team_id_foreign` FOREIGN KEY (`assigned_to_team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_proposals_assigned_photographer_id_foreign` FOREIGN KEY (`assigned_photographer_id`) REFERENCES `team_personnel` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_proposals_assigned_by_foreign` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_proposals_shelter_id_foreign` FOREIGN KEY (`shelter_id`) REFERENCES `shelters` (`manager_id_number`) ON DELETE SET NULL,
  CONSTRAINT `project_proposals_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_proposals_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `project_proposals_shekel_converted_by_foreign` FOREIGN KEY (`shekel_converted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_proposals_surplus_recorded_by_foreign` FOREIGN KEY (`surplus_recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_proposals_surplus_category_id_foreign` FOREIGN KEY (`surplus_category_id`) REFERENCES `surplus_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_proposals_parent_project_id_foreign` FOREIGN KEY (`parent_project_id`) REFERENCES `project_proposals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول سجل حركة المشاريع (Project Timeline)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `project_timeline` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` bigint(20) UNSIGNED NOT NULL,
  `old_status` varchar(255) DEFAULT NULL,
  `new_status` varchar(255) NOT NULL,
  `changed_by` bigint(20) UNSIGNED NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `project_timeline_project_id_index` (`project_id`),
  KEY `project_timeline_created_at_index` (`created_at`),
  KEY `project_timeline_changed_by_foreign` (`changed_by`),
  CONSTRAINT `project_timeline_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `project_proposals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_timeline_changed_by_foreign` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول الإشعارات (Notifications)
-- ملاحظة: تم تحديث notification_type enum لاحقاً
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `related_project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `notification_type` enum('new_assignment','ready_for_shelter_selection','ready_for_montage','delay_execution','delay_montage','status_change','photographer_assignment','project_created','project_assigned','project_status_changed','shelter_selected','media_updated','media_completed','media_rejected','media_accepted','daily_phase','project_postponed','project_resumed','project_cancelled','project_transferred_to_execution','supply_started','supply_confirmed','low_stock','project_deficit','shekel_converted') NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_index` (`user_id`),
  KEY `notifications_is_read_index` (`is_read`),
  KEY `notifications_user_id_is_read_index` (`user_id`,`is_read`),
  KEY `notifications_created_at_index` (`created_at`),
  KEY `notifications_related_project_id_index` (`related_project_id`),
  KEY `notifications_user_type_read_index` (`user_id`,`notification_type`,`is_read`),
  KEY `notifications_user_read_created_index` (`user_id`,`is_read`,`created_at`),
  KEY `notifications_user_read_idx` (`user_id`,`is_read`),
  KEY `notifications_user_created_idx` (`user_id`,`created_at`),
  KEY `notifications_user_priority_idx` (`user_id`,`priority`),
  KEY `notifications_project_created_idx` (`related_project_id`,`created_at`),
  KEY `notifications_project_id_foreign` (`project_id`),
  CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `project_proposals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_related_project_id_foreign` FOREIGN KEY (`related_project_id`) REFERENCES `project_proposals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول إشعارات المراحل (Project Phase Notifications)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `project_phase_notifications` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` bigint(20) UNSIGNED NOT NULL,
  `notification_date` date NOT NULL,
  `phase_day` int(11) NOT NULL,
  `daily_amount` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_phase_notifications_project_id_notification_date_unique` (`project_id`,`notification_date`),
  KEY `project_phase_notifications_notification_date_index` (`notification_date`),
  KEY `project_phase_notifications_project_id_foreign` (`project_id`),
  CONSTRAINT `project_phase_notifications_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `project_proposals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول عناصر المخزن (Warehouse Items)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `warehouse_items` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `item_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `quantity_available` int(11) NOT NULL DEFAULT 0,
  `unit_price` decimal(10,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `warehouse_items_is_active_index` (`is_active`),
  KEY `warehouse_items_item_name_index` (`item_name`),
  KEY `warehouse_items_created_by_foreign` (`created_by`),
  KEY `warehouse_items_updated_by_foreign` (`updated_by`),
  CONSTRAINT `warehouse_items_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `warehouse_items_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول عناصر المخزن للمشاريع (Project Warehouse Items)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `project_warehouse_items` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_proposal_id` bigint(20) UNSIGNED NOT NULL,
  `warehouse_item_id` bigint(20) UNSIGNED NOT NULL,
  `quantity_per_unit` decimal(10,2) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price_per_unit` decimal(10,2) NOT NULL,
  `status` enum('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_warehouse_items_project_proposal_id_foreign` (`project_proposal_id`),
  KEY `project_warehouse_items_warehouse_item_id_foreign` (`warehouse_item_id`),
  CONSTRAINT `project_warehouse_items_project_proposal_id_foreign` FOREIGN KEY (`project_proposal_id`) REFERENCES `project_proposals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_warehouse_items_warehouse_item_id_foreign` FOREIGN KEY (`warehouse_item_id`) REFERENCES `warehouse_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول أرشيف المواد الإعلامية (Media Archives)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `media_archives` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_proposal_id` bigint(20) UNSIGNED NOT NULL,
  `archive_type` enum('before_montage','after_montage') NOT NULL,
  `local_path` text NOT NULL,
  `notes` text DEFAULT NULL,
  `archived_by` bigint(20) UNSIGNED NOT NULL,
  `archived_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `project_name` varchar(255) NOT NULL,
  `serial_number` varchar(255) NOT NULL,
  `donor_name` varchar(255) NOT NULL,
  `project_type` enum('إغاثي','تنموي','طبي','تعليمي') NOT NULL,
  `team_name` varchar(255) DEFAULT NULL,
  `photographer_name` varchar(255) DEFAULT NULL,
  `execution_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `media_archives_project_proposal_id_index` (`project_proposal_id`),
  KEY `media_archives_archive_type_index` (`archive_type`),
  KEY `media_archives_serial_number_index` (`serial_number`),
  KEY `media_archives_project_name_index` (`project_name`),
  KEY `media_archives_donor_name_index` (`donor_name`),
  KEY `media_archives_archived_at_index` (`archived_at`),
  KEY `media_archives_archived_by_foreign` (`archived_by`),
  CONSTRAINT `media_archives_project_proposal_id_foreign` FOREIGN KEY (`project_proposal_id`) REFERENCES `project_proposals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `media_archives_archived_by_foreign` FOREIGN KEY (`archived_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- جدول ردود الإشعارات (Notification Replies)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `notification_replies` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `notification_id` bigint(20) UNSIGNED NOT NULL,
  `replied_by` bigint(20) UNSIGNED NOT NULL,
  `message` text NOT NULL,
  `rejection_reason` text NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notification_replies_notification_id_index` (`notification_id`),
  KEY `notification_replies_replied_by_index` (`replied_by`),
  CONSTRAINT `notification_replies_notification_id_foreign` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_replies_replied_by_foreign` FOREIGN KEY (`replied_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- الجزء 2: التعديلات على الجداول القديمة (Alter Existing Tables)
-- ============================================
-- ملاحظة: إذا كان العمود موجوداً بالفعل، سيظهر خطأ يمكن تجاهله
-- ============================================

-- --------------------------------------------------------
-- تعديل جدول users - إضافة الأدوار والأقسام
-- --------------------------------------------------------

-- إعداد متغيرات للتحقق من وجود الأعمدة
SET @dbname = DATABASE();
SET @tablename = 'users';

-- إضافة role (إذا لم يكن موجوداً)
SET @columnname = 'role';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column role already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` enum('admin','project_manager','media_manager','executed_projects_coordinator','team_leader','photographer','executor','warehouse_manager') NOT NULL DEFAULT 'executor' AFTER `email`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة department (إذا لم يكن موجوداً)
SET @columnname = 'department';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column department already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` enum('إدارة','مشاريع','إعلام') DEFAULT NULL AFTER `role`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة is_active (إذا لم يكن موجوداً)
SET @columnname = 'is_active';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column is_active already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` tinyint(1) NOT NULL DEFAULT 1 AFTER `department`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة phone_number (إذا لم يكن موجوداً)
SET @columnname = 'phone_number';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column phone_number already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` varchar(255) DEFAULT NULL AFTER `is_active`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة added_by (إذا لم يكن موجوداً)
SET @columnname = 'added_by';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column added_by already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` bigint(20) UNSIGNED DEFAULT NULL AFTER `phone_number`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة Indexes (إذا لم تكن موجودة)
SET @indexname = 'users_role_index';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  "SELECT 'Index users_role_index already exists.';",
  "ALTER TABLE `users` ADD INDEX `users_role_index` (`role`);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @indexname = 'users_role_is_active_index';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  "SELECT 'Index users_role_is_active_index already exists.';",
  "ALTER TABLE `users` ADD INDEX `users_role_is_active_index` (`role`,`is_active`);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة Foreign Key (إذا لم يكن موجوداً)
SET @constraintname = 'users_added_by_foreign';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (constraint_name = @constraintname)
  ) > 0,
  "SELECT 'Foreign key users_added_by_foreign already exists.';",
  "ALTER TABLE `users` ADD CONSTRAINT `users_added_by_foreign` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- جعل email و password nullable (تعليق - قد يحتاج إلى تعديل حسب البيانات الموجودة)
-- ALTER TABLE `users` MODIFY COLUMN `email` varchar(255) DEFAULT NULL;
-- ALTER TABLE `users` MODIFY COLUMN `password` varchar(255) DEFAULT NULL;

-- --------------------------------------------------------
-- تعديل جدول shelters - إضافة حقول تتبع المشاريع
-- --------------------------------------------------------

SET @tablename = 'shelters';

-- إضافة number_of_families (إذا لم يكن موجوداً)
SET @columnname = 'number_of_families';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column number_of_families already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` int(11) NOT NULL DEFAULT 0 AFTER `district`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة last_project_date (إذا لم يكن موجوداً)
SET @columnname = 'last_project_date';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column last_project_date already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` date DEFAULT NULL AFTER `number_of_families`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة total_projects_received (إذا لم يكن موجوداً)
SET @columnname = 'total_projects_received';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column total_projects_received already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` int(11) NOT NULL DEFAULT 0 AFTER `last_project_date`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة Index (إذا لم يكن موجوداً)
SET @indexname = 'shelters_number_of_families_index';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  "SELECT 'Index shelters_number_of_families_index already exists.';",
  "ALTER TABLE `shelters` ADD INDEX `shelters_number_of_families_index` (`number_of_families`);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إصلاح updated_at إذا كان null
UPDATE `shelters` 
SET `updated_at` = `created_at` 
WHERE `updated_at` IS NULL AND `created_at` IS NOT NULL;

UPDATE `shelters` 
SET `updated_at` = NOW(), `created_at` = NOW() 
WHERE `updated_at` IS NULL OR `created_at` IS NULL;

-- --------------------------------------------------------
-- تعديل جدول projects - إضافة حقول رضا المخيم
-- --------------------------------------------------------

SET @tablename = 'projects';

-- إضافة shelter_satisfaction_status (إذا لم يكن موجوداً)
SET @columnname = 'shelter_satisfaction_status';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column shelter_satisfaction_status already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` enum('مكتفي','يحتاج المزيد') DEFAULT NULL AFTER `status`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة satisfaction_shortfall (إذا لم يكن موجوداً)
SET @columnname = 'satisfaction_shortfall';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column satisfaction_shortfall already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` int(11) NOT NULL DEFAULT 0 AFTER `shelter_satisfaction_status`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة satisfaction_notes (إذا لم يكن موجوداً)
SET @columnname = 'satisfaction_notes';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column satisfaction_notes already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` text DEFAULT NULL AFTER `satisfaction_shortfall`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة satisfaction_recorded_by (إذا لم يكن موجوداً)
SET @columnname = 'satisfaction_recorded_by';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column satisfaction_recorded_by already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` bigint(20) UNSIGNED DEFAULT NULL AFTER `satisfaction_notes`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة satisfaction_recorded_at (إذا لم يكن موجوداً)
SET @columnname = 'satisfaction_recorded_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column satisfaction_recorded_at already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` timestamp NULL DEFAULT NULL AFTER `satisfaction_recorded_by`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة source_project_id (إذا لم يكن موجوداً)
SET @columnname = 'source_project_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column source_project_id already exists.';",
  CONCAT("ALTER TABLE `", @tablename, "` ADD COLUMN `", @columnname, "` bigint(20) UNSIGNED DEFAULT NULL AFTER `id`;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة Indexes (إذا لم تكن موجودة)
SET @indexname = 'projects_shelter_satisfaction_status_index';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  "SELECT 'Index projects_shelter_satisfaction_status_index already exists.';",
  "ALTER TABLE `projects` ADD INDEX `projects_shelter_satisfaction_status_index` (`shelter_satisfaction_status`);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @indexname = 'projects_source_project_id_index';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  "SELECT 'Index projects_source_project_id_index already exists.';",
  "ALTER TABLE `projects` ADD INDEX `projects_source_project_id_index` (`source_project_id`);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إضافة Foreign Keys (إذا لم تكن موجودة)
SET @constraintname = 'projects_satisfaction_recorded_by_foreign';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (constraint_name = @constraintname)
  ) > 0,
  "SELECT 'Foreign key projects_satisfaction_recorded_by_foreign already exists.';",
  "ALTER TABLE `projects` ADD CONSTRAINT `projects_satisfaction_recorded_by_foreign` FOREIGN KEY (`satisfaction_recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @constraintname = 'projects_source_project_id_foreign';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (constraint_name = @constraintname)
  ) > 0,
  "SELECT 'Foreign key projects_source_project_id_foreign already exists.';",
  "ALTER TABLE `projects` ADD CONSTRAINT `projects_source_project_id_foreign` FOREIGN KEY (`source_project_id`) REFERENCES `project_proposals` (`id`) ON DELETE SET NULL;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- حذف حقول notes و notes_image من projects (إذا كانت موجودة)
-- ملاحظة: قم بإلغاء التعليق إذا كنت متأكداً من حذفها
-- ALTER TABLE `projects` DROP COLUMN `notes`;
-- ALTER TABLE `projects` DROP COLUMN `notes_image`;

-- ============================================
-- الجزء 3: البيانات الأولية (Initial Data)
-- ============================================

-- إدراج العملات الأساسية
INSERT INTO `currencies` (`currency_code`, `currency_name_ar`, `currency_name_en`, `currency_symbol`, `exchange_rate_to_usd`, `is_active`, `created_at`, `updated_at`) VALUES
('KWD', 'دينار كويتي', 'Kuwaiti Dinar', 'د.ك', 3.2600, 1, NOW(), NOW()),
('JOD', 'دينار أردني', 'Jordanian Dinar', 'د.أ', 1.4100, 1, NOW(), NOW()),
('USD', 'دولار أمريكي', 'US Dollar', '$', 1.0000, 1, NOW(), NOW()),
('EUR', 'يورو', 'Euro', '€', 1.0900, 1, NOW(), NOW()),
('GBP', 'جنيه إسترليني', 'British Pound', '£', 1.2700, 1, NOW(), NOW()),
('SAR', 'ريال سعودي', 'Saudi Riyal', 'ر.س', 0.2700, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- --------------------------------------------------------
-- إدراج المستخدمين الأساسيين (Initial Users)
-- ملاحظة: كلمات المرور الافتراضية هي 'password' (يجب تغييرها بعد أول تسجيل دخول)
-- Password hash: $2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- --------------------------------------------------------

-- مستخدمين الإدارة (Administration Users)
INSERT INTO `users` (`name`, `email`, `password`, `role`, `department`, `is_active`, `phone_number`, `added_by`, `email_verified_at`, `remember_token`, `created_at`, `updated_at`, `api_token`) VALUES
('مدير النظام', 'admin@saiid.org', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'إدارة', 1, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL),
('مسؤول الإدارة', 'admin2@saiid.org', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'إدارة', 1, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- مدير المشاريع (Project Manager)
INSERT INTO `users` (`name`, `email`, `password`, `role`, `department`, `is_active`, `phone_number`, `added_by`, `email_verified_at`, `remember_token`, `created_at`, `updated_at`, `api_token`) VALUES
('مدير المشاريع', 'project.manager@saiid.org', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'project_manager', 'مشاريع', 1, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- منسق المشاريع (Project Coordinator)
INSERT INTO `users` (`name`, `email`, `password`, `role`, `department`, `is_active`, `phone_number`, `added_by`, `email_verified_at`, `remember_token`, `created_at`, `updated_at`, `api_token`) VALUES
('منسق المشاريع', 'project.coordinator@saiid.org', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'executed_projects_coordinator', 'مشاريع', 1, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- مدير الإعلام (Media Manager)
INSERT INTO `users` (`name`, `email`, `password`, `role`, `department`, `is_active`, `phone_number`, `added_by`, `email_verified_at`, `remember_token`, `created_at`, `updated_at`, `api_token`) VALUES
('مدير الإعلام', 'media.manager@saiid.org', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'media_manager', 'إعلام', 1, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- ============================================
-- نهاية السكريبت
-- ============================================

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

-- ============================================
-- ملاحظات مهمة:
-- ============================================
-- 1. إذا ظهر خطأ "Duplicate column name" أو "Duplicate key name"، 
--    هذا يعني أن العمود/المفتاح موجود بالفعل ويمكن تجاهله
-- 
-- 2. إذا ظهر خطأ "Cannot add foreign key constraint"،
--    تأكد من أن الجداول المرتبطة موجودة
-- 
-- 3. إذا ظهر خطأ في تعديل email/password إلى nullable،
--    قد يكون هناك بيانات موجودة تتعارض مع NULL
-- 
-- 4. تأكد من تشغيل هذا السكريبت على نسخة احتياطية أولاً
-- ============================================

