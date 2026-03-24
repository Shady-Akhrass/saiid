-- ================================
-- التحقق من حقول سبب الرفض
-- ================================
-- التاريخ: 4 يناير 2026
-- الإصلاح: MD/FIX_MONTAGE_REJECTION_REASON.md

-- 1. عرض هيكل الأعمدة الجديدة
SELECT 
    COLUMN_NAME as 'اسم العمود',
    COLUMN_TYPE as 'النوع',
    IS_NULLABLE as 'يقبل NULL',
    COLUMN_DEFAULT as 'القيمة الافتراضية',
    COLUMN_KEY as 'المفتاح'
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_proposals'
    AND COLUMN_NAME LIKE '%rejection%';

-- 2. عدد المشاريع المرفوضة (التي لديها سبب رفض)
SELECT 
    COUNT(*) as 'عدد المشاريع المرفوضة',
    COUNT(CASE WHEN rejection_reason IS NOT NULL THEN 1 END) as 'لديها سبب رفض',
    COUNT(CASE WHEN rejection_reason IS NULL THEN 1 END) as 'بدون سبب رفض'
FROM project_proposals
WHERE status = 'يجب إعادة المونتاج';

-- 3. عرض أمثلة على المشاريع المرفوضة
SELECT 
    id as 'ID',
    project_name as 'اسم المشروع',
    status as 'الحالة',
    LEFT(rejection_reason, 50) as 'سبب الرفض (50 حرف)',
    LEFT(admin_rejection_reason, 50) as 'سبب رفض الإدارة',
    updated_at as 'آخر تحديث'
FROM project_proposals
WHERE rejection_reason IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- 4. إحصائيات حالات الرفض
SELECT 
    status as 'الحالة',
    COUNT(*) as 'العدد',
    COUNT(CASE WHEN rejection_reason IS NOT NULL THEN 1 END) as 'لديها سبب رفض',
    ROUND(
        COUNT(CASE WHEN rejection_reason IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as 'نسبة وجود سبب الرفض (%)'
FROM project_proposals
WHERE status IN ('يجب إعادة المونتاج', 'في المونتاج', 'تم المونتاج')
GROUP BY status
ORDER BY COUNT(*) DESC;

-- 5. التحقق من Index
SHOW INDEX FROM project_proposals
WHERE Column_name LIKE '%rejection%';

