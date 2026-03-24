-- ✅ إضافة Index على month_start_date لتحسين الأداء
-- تاريخ: 2026-01-13
-- المهمة: 1 - إضافة Database Indexes (آمنة 100%)
-- المخاطرة: ⭐ منخفضة جداً (1/10)

-- ✅ التحقق من وجود الـ index وإنشائه إذا لم يكن موجوداً
-- IF NOT EXISTS يضمن عدم حدوث خطأ إذا كان الـ index موجوداً بالفعل
CREATE INDEX IF NOT EXISTS `idx_pp_month_start_date` 
ON `project_proposals` (`month_start_date`);

-- ✅ التحقق من النجاح
-- شغل هذا الاستعلام للتأكد من أن الـ index تم إضافته
-- SHOW INDEX FROM project_proposals WHERE Column_name = 'month_start_date';

-- ✅ Rollback (إذا أردت التراجع)
-- DROP INDEX `idx_pp_month_start_date` ON `project_proposals`;
