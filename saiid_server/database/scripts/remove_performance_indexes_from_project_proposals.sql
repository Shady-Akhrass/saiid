-- ✅ إزالة Indexes من project_proposals (Rollback)
-- تاريخ: 2025-12-31
-- استخدم هذا الملف إذا أردت إزالة الـ Indexes
-- ملاحظة: إذا كان الـ index غير موجود، سيظهر خطأ يمكن تجاهله

-- ✅ إزالة Indexes
DROP INDEX `project_proposals_status_index` ON `project_proposals`;
DROP INDEX `project_proposals_project_type_index` ON `project_proposals`;
DROP INDEX `project_proposals_status_type_index` ON `project_proposals`;
DROP INDEX `project_proposals_assigned_researcher_id_index` ON `project_proposals`;
DROP INDEX `project_proposals_assigned_photographer_id_index` ON `project_proposals`;
DROP INDEX `project_proposals_assigned_to_team_id_index` ON `project_proposals`;
DROP INDEX `project_proposals_shelter_id_index` ON `project_proposals`;
DROP INDEX `project_proposals_parent_project_id_index` ON `project_proposals`;
DROP INDEX `project_proposals_created_at_index` ON `project_proposals`;
DROP INDEX `project_proposals_execution_date_index` ON `project_proposals`;
DROP INDEX `project_proposals_phases_index` ON `project_proposals`;
DROP INDEX `project_proposals_status_researcher_index` ON `project_proposals`;
DROP INDEX `project_proposals_status_photographer_index` ON `project_proposals`;
DROP INDEX `project_proposals_status_shelter_index` ON `project_proposals`;
DROP INDEX `project_proposals_status_created_at_index` ON `project_proposals`;
DROP INDEX `project_proposals_status_execution_date_index` ON `project_proposals`;
DROP INDEX `project_proposals_assigned_by_index` ON `project_proposals`;
DROP INDEX `project_proposals_currency_id_index` ON `project_proposals`;
DROP INDEX `project_proposals_subcategory_id_index` ON `project_proposals`;
DROP INDEX `project_proposals_team_status_index` ON `project_proposals`;

-- ✅ تم إزالة جميع الـ Indexes

