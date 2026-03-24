-- ============================================
-- 🔍 إضافة Full-text Search Index
-- سعيد API - Full-text Search Optimization
-- التاريخ: 2026-01-05
-- ============================================

USE u302193701_api; -- ✅ غيّر اسم قاعدة البيانات حسب السيرفر

-- ============================================
-- التحقق من محرك الجدول (يجب أن يكون InnoDB)
-- ============================================

SELECT '==================================' AS '';
SELECT 'Checking Table Engine...' AS status;
SELECT '==================================' AS '';

SELECT 
    TABLE_NAME,
    ENGINE,
    TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals';

-- ============================================
-- التحقق من وجود Full-text Index مسبقاً
-- ============================================

SELECT '==================================' AS '';
SELECT 'Checking Existing Full-text Indexes...' AS status;
SELECT '==================================' AS '';

SELECT 
    INDEX_NAME,
    INDEX_TYPE,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
AND INDEX_TYPE = 'FULLTEXT'
GROUP BY INDEX_NAME;

-- ============================================
-- إضافة Full-text Index
-- ملاحظة: إذا كان موجود مسبقاً، سيظهر خطأ (يمكن تجاهله)
-- ============================================

SELECT '==================================' AS '';
SELECT 'Adding Full-text Search Index...' AS status;
SELECT '==================================' AS '';

-- إضافة Full-text Index على 4 أعمدة نصية
ALTER TABLE project_proposals 
ADD FULLTEXT INDEX idx_pp_fulltext_search (
    project_name, 
    project_description, 
    donor_name, 
    donor_code
);

-- ============================================
-- التحقق من نجاح الإضافة
-- ============================================

SELECT '==================================' AS '';
SELECT 'Verifying Full-text Index...' AS status;
SELECT '==================================' AS '';

SELECT 
    INDEX_NAME,
    INDEX_TYPE,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS indexed_columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
AND INDEX_TYPE = 'FULLTEXT'
GROUP BY INDEX_NAME, INDEX_TYPE;

-- اختبار Full-text Search
SELECT '==================================' AS '';
SELECT 'Testing Full-text Search...' AS status;
SELECT '==================================' AS '';

-- اختبار بسيط (سيعرض أول 5 نتائج)
SELECT 
    id,
    project_name,
    donor_name
FROM project_proposals
WHERE MATCH(project_name, project_description, donor_name, donor_code) 
      AGAINST('مشروع' IN BOOLEAN MODE)
LIMIT 5;

SELECT '==================================' AS '';
SELECT '✅ Full-text Index Added Successfully!' AS status;
SELECT '==================================' AS '';

-- ============================================
-- ملاحظات هامة
-- ============================================
/*
ملاحظات:
1. Full-text Index يعمل فقط مع InnoDB (MySQL 5.6+) أو MyISAM
2. البحث يجب أن يكون على الأقل 3 أحرف (افتراضياً)
3. للبحث باستخدام Full-text Index:
   
   SELECT * FROM project_proposals
   WHERE MATCH(project_name, project_description, donor_name, donor_code)
         AGAINST('كلمة البحث' IN BOOLEAN MODE);

4. Boolean Mode يدعم عمليات متقدمة:
   '+مشروع +إغاثة'  = يجب أن يحتوي على كلا الكلمتين
   '+مشروع -مؤجل'   = يحتوي على "مشروع" ولا يحتوي على "مؤجل"
   'مشروع*'         = أي كلمة تبدأ بـ "مشروع"

5. إذا كان الجدول MyISAM، يمكن تحويله لـ InnoDB:
   ALTER TABLE project_proposals ENGINE=InnoDB;
*/

