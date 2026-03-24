-- ✅ إضافة Indexes لتحسين أداء استعلامات project_proposals (Simple Version)
-- تاريخ: 2025-12-31
-- هذا الإصدار يستخدم IGNORE لتجاهل الأخطاء إذا كان الـ index موجوداً
-- استخدم هذا الإصدار إذا كان الإصدار Safe لا يعمل

-- ✅ Index للـ status (الأكثر استخداماً في الفلترة)
-- ⚠️ هذا الـ index موجود بالفعل - تم تعليقه
-- CREATE INDEX `project_proposals_status_index` ON `project_proposals` (`status`);

-- ✅ Index للـ project_type
CREATE INDEX `project_proposals_project_type_index` ON `project_proposals` (`project_type`);

-- ✅ Composite index للـ status و project_type
CREATE INDEX `project_proposals_status_type_index` ON `project_proposals` (`status`, `project_type`);

-- ✅ Index للـ assigned_researcher_id
CREATE INDEX `project_proposals_assigned_researcher_id_index` ON `project_proposals` (`assigned_researcher_id`);

-- ✅ Index للـ assigned_photographer_id
CREATE INDEX `project_proposals_assigned_photographer_id_index` ON `project_proposals` (`assigned_photographer_id`);

-- ✅ Index للـ assigned_to_team_id
CREATE INDEX `project_proposals_assigned_to_team_id_index` ON `project_proposals` (`assigned_to_team_id`);

-- ✅ Index للـ shelter_id
CREATE INDEX `project_proposals_shelter_id_index` ON `project_proposals` (`shelter_id`);

-- ✅ Index للـ parent_project_id
CREATE INDEX `project_proposals_parent_project_id_index` ON `project_proposals` (`parent_project_id`);

-- ✅ Index للـ created_at
CREATE INDEX `project_proposals_created_at_index` ON `project_proposals` (`created_at`);

-- ✅ Index للـ execution_date
CREATE INDEX `project_proposals_execution_date_index` ON `project_proposals` (`execution_date`);

-- ✅ Composite index للـ phases
CREATE INDEX `project_proposals_phases_index` ON `project_proposals` (`is_divided_into_phases`, `is_daily_phase`, `is_monthly_phase`);

-- ✅ Composite index للـ status و assigned_researcher_id
CREATE INDEX `project_proposals_status_researcher_index` ON `project_proposals` (`status`, `assigned_researcher_id`);

-- ✅ Composite index للـ status و assigned_photographer_id
CREATE INDEX `project_proposals_status_photographer_index` ON `project_proposals` (`status`, `assigned_photographer_id`);

-- ✅ Composite index للـ status و shelter_id
CREATE INDEX `project_proposals_status_shelter_index` ON `project_proposals` (`status`, `shelter_id`);

-- ✅ Composite index للـ status و created_at
CREATE INDEX `project_proposals_status_created_at_index` ON `project_proposals` (`status`, `created_at`);

-- ✅ Composite index للـ status و execution_date
CREATE INDEX `project_proposals_status_execution_date_index` ON `project_proposals` (`status`, `execution_date`);

-- ✅ Index للـ assigned_by
CREATE INDEX `project_proposals_assigned_by_index` ON `project_proposals` (`assigned_by`);

-- ✅ Index للـ currency_id
CREATE INDEX `project_proposals_currency_id_index` ON `project_proposals` (`currency_id`);

-- ✅ Index للـ subcategory_id
CREATE INDEX `project_proposals_subcategory_id_index` ON `project_proposals` (`subcategory_id`);

-- ✅ Composite index للـ assigned_to_team_id و status
CREATE INDEX `project_proposals_team_status_index` ON `project_proposals` (`assigned_to_team_id`, `status`);

-- ✅ ملاحظة: إذا ظهر خطأ "Duplicate key name" لأي index، فهذا يعني أنه موجود بالفعل
-- يمكنك تجاهل هذا الخطأ والمتابعة مع باقي الـ indexes

