-- =====================================================
-- SQL Script: إضافة researcher_assigned و photographer_assigned إلى notification_type enum
-- تاريخ الإنشاء: 2025-12-22
-- الوصف: إضافة أنواع الإشعارات الجديدة لإسناد الباحث والمصور
-- =====================================================
-- 
-- ⚠️ مهم: قم بعمل backup لقاعدة البيانات قبل التنفيذ!
-- =====================================================

-- =====================================================
-- إضافة researcher_assigned و photographer_assigned إلى enum
-- =====================================================

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
    'photographer_assigned'
) NOT NULL;

-- =====================================================
-- ✅ تم الانتهاء!
-- =====================================================
-- 
-- ملخص التغييرات:
-- 1. ✅ تم إضافة 'researcher_assigned' إلى enum
-- 2. ✅ تم إضافة 'photographer_assigned' إلى enum
-- 
-- =====================================================
