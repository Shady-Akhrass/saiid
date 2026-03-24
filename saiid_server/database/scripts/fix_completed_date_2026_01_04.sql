-- ✅ إصلاح عمود completed_date في جدول project_proposals
-- التاريخ: 2026-01-04
-- المشكلة: العمود قد يكون من نوع TIMESTAMP بدلاً من DATE

-- 1. تغيير نوع العمود إلى DATE
ALTER TABLE project_proposals 
MODIFY COLUMN completed_date DATE NULL 
COMMENT 'تاريخ إنهاء المشروع (عند الوصول لحالة منتهي)';

-- 2. تحديث المشاريع المنتهية التي لا تحتوي على completed_date
-- استخدام sent_to_donor_date أو updated_at كبديل
UPDATE project_proposals 
SET completed_date = COALESCE(
    DATE(sent_to_donor_date), 
    DATE(updated_at)
)
WHERE status = 'منتهي' 
AND completed_date IS NULL;

-- 3. التحقق من النتائج
SELECT 
    'مشاريع منتهية مع تاريخ' AS description,
    COUNT(*) AS count
FROM project_proposals
WHERE status = 'منتهي' 
AND completed_date IS NOT NULL

UNION ALL

SELECT 
    'مشاريع منتهية بدون تاريخ' AS description,
    COUNT(*) AS count
FROM project_proposals
WHERE status = 'منتهي' 
AND completed_date IS NULL;

