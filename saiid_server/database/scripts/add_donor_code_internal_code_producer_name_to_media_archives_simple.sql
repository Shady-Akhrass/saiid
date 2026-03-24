-- إضافة الحقول الجديدة لجدول media_archives
-- donor_code: كود المتبرع
-- internal_code: الكود الداخلي للمشروع
-- producer_name: اسم ممنتج المونتاج

-- ملاحظة: إذا كان الحقل موجوداً بالفعل، سيظهر خطأ. يمكنك تجاهله أو تشغيل النسخة الآمنة

ALTER TABLE `media_archives`
ADD COLUMN `donor_code` VARCHAR(255) NULL AFTER `donor_name`,
ADD COLUMN `internal_code` VARCHAR(255) NULL AFTER `donor_code`,
ADD COLUMN `producer_name` VARCHAR(255) NULL AFTER `photographer_name`;

