-- ✅ إضافة Indexes المفقودة فقط (تجاهل الموجودة)
-- تاريخ: 2025-12-31
-- هذا الإصدار يضيف فقط الـ indexes المفقودة ويتجاهل الموجودة

-- ✅ قائمة الـ indexes المطلوبة
-- إذا كان الـ index موجوداً، سيتم تجاهل الخطأ

-- ✅ Index للـ status
CREATE INDEX IF NOT EXISTS `project_proposals_status_index` ON `project_proposals` (`status`);

-- ✅ Index للـ project_type  
CREATE INDEX IF NOT EXISTS `project_proposals_project_type_index` ON `project_proposals` (`project_type`);

-- ✅ Composite index للـ status و project_type
CREATE INDEX IF NOT EXISTS `project_proposals_status_type_index` ON `project_proposals` (`status`, `project_type`);

-- ✅ Index للـ assigned_researcher_id
CREATE INDEX IF NOT EXISTS `project_proposals_assigned_researcher_id_index` ON `project_proposals` (`assigned_researcher_id`);

-- ✅ Index للـ assigned_photographer_id
CREATE INDEX IF NOT EXISTS `project_proposals_assigned_photographer_id_index` ON `project_proposals` (`assigned_photographer_id`);

-- ✅ Index للـ assigned_to_team_id
CREATE INDEX IF NOT EXISTS `project_proposals_assigned_to_team_id_index` ON `project_proposals` (`assigned_to_team_id`);

-- ✅ Index للـ shelter_id
CREATE INDEX IF NOT EXISTS `project_proposals_shelter_id_index` ON `project_proposals` (`shelter_id`);

-- ✅ Index للـ parent_project_id
CREATE INDEX IF NOT EXISTS `project_proposals_parent_project_id_index` ON `project_proposals` (`parent_project_id`);

-- ✅ Index للـ created_at
CREATE INDEX IF NOT EXISTS `project_proposals_created_at_index` ON `project_proposals` (`created_at`);

-- ✅ Index للـ execution_date
CREATE INDEX IF NOT EXISTS `project_proposals_execution_date_index` ON `project_proposals` (`execution_date`);

-- ✅ Composite index للـ phases
CREATE INDEX IF NOT EXISTS `project_proposals_phases_index` ON `project_proposals` (`is_divided_into_phases`, `is_daily_phase`, `is_monthly_phase`);

-- ✅ Composite index للـ status و assigned_researcher_id
CREATE INDEX IF NOT EXISTS `project_proposals_status_researcher_index` ON `project_proposals` (`status`, `assigned_researcher_id`);

-- ✅ Composite index للـ status و assigned_photographer_id
CREATE INDEX IF NOT EXISTS `project_proposals_status_photographer_index` ON `project_proposals` (`status`, `assigned_photographer_id`);

-- ✅ Composite index للـ status و shelter_id
CREATE INDEX IF NOT EXISTS `project_proposals_status_shelter_index` ON `project_proposals` (`status`, `shelter_id`);

-- ✅ Composite index للـ status و created_at
CREATE INDEX IF NOT EXISTS `project_proposals_status_created_at_index` ON `project_proposals` (`status`, `created_at`);

-- ✅ Composite index للـ status و execution_date
CREATE INDEX IF NOT EXISTS `project_proposals_status_execution_date_index` ON `project_proposals` (`status`, `execution_date`);

-- ✅ Index للـ assigned_by
CREATE INDEX IF NOT EXISTS `project_proposals_assigned_by_index` ON `project_proposals` (`assigned_by`);

-- ✅ Index للـ currency_id
CREATE INDEX IF NOT EXISTS `project_proposals_currency_id_index` ON `project_proposals` (`currency_id`);

-- ✅ Index للـ subcategory_id
CREATE INDEX IF NOT EXISTS `project_proposals_subcategory_id_index` ON `project_proposals` (`subcategory_id`);

-- ✅ Composite index للـ assigned_to_team_id و status
CREATE INDEX IF NOT EXISTS `project_proposals_team_status_index` ON `project_proposals` (`assigned_to_team_id`, `status`);

-- ✅ ملاحظة: 
-- إذا كان MySQL version < 5.7، قد لا يدعم IF NOT EXISTS
-- في هذه الحالة، استخدم add_performance_indexes_simple.sql وتجاهل الأخطاء

