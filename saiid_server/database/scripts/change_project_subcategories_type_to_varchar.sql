-- =====================================================
-- SQL Script: تغيير نوع عمود project_type من ENUM إلى VARCHAR
-- التاريخ: 2025-12-13
-- الوصف: تغيير عمود project_type في جدول project_subcategories من ENUM إلى VARCHAR للسماح بأي نوع مشروع
-- =====================================================

-- تغيير نوع العمود من ENUM إلى VARCHAR(255) وإزالة القيمة الافتراضية
ALTER TABLE `project_subcategories` 
MODIFY COLUMN `project_type` VARCHAR(255) NOT NULL COMMENT 'نوع المشروع';

-- إزالة القيمة الافتراضية إذا كانت موجودة
ALTER TABLE `project_subcategories` 
ALTER COLUMN `project_type` DROP DEFAULT;

-- التحقق من التغيير
-- SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = DATABASE() 
-- AND TABLE_NAME = 'project_subcategories' 
-- AND COLUMN_NAME = 'project_type';
