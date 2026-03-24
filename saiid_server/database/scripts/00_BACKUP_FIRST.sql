-- ============================================
-- ⚠️ BACKUP قاعدة البيانات - مهم جداً!
-- سعيد API - Backup Before Optimization
-- التاريخ: 2026-01-05
-- ============================================

/*
⚠️⚠️⚠️ مهم جداً: عمل Backup قبل تطبيق أي تحسينات ⚠️⚠️⚠️

===========================================
الطريقة 1: Backup باستخدام mysqldump (الأفضل)
===========================================

في Terminal أو Command Prompt:

# Windows:
cd C:\xampp\mysql\bin\
mysqldump -u root -p saiid_db > C:\backup\saiid_db_backup_2026_01_05.sql

# Linux:
mysqldump -u root -p saiid_db > /home/backup/saiid_db_backup_2026_01_05.sql

# مع ضغط:
mysqldump -u root -p saiid_db | gzip > saiid_db_backup_2026_01_05.sql.gz

===========================================
الطريقة 2: Backup من داخل MySQL
===========================================

استخدم الأوامر التالية (غيّر المسار حسب نظامك):
*/

-- ✅ تأكد من تغيير اسم قاعدة البيانات والمسار
USE saiid_db;

-- Backup لجدول project_proposals فقط
SELECT 'Creating backup of project_proposals table...' AS status;

-- لا يمكن عمل backup مباشر من SQL، استخدم mysqldump من Terminal

/*
===========================================
الطريقة 3: Backup باستخدام phpMyAdmin
===========================================

1. افتح phpMyAdmin
2. اختر قاعدة البيانات saiid_db
3. اضغط على تبويب "تصدير" (Export)
4. اختر "سريع" (Quick) وتنسيق SQL
5. اضغط "تنفيذ" (Go)
6. احفظ الملف في مكان آمن

===========================================
التحقق من وجود Backup
===========================================

قبل المتابعة، تأكد من:
✅ تم إنشاء ملف Backup
✅ حجم الملف معقول (ليس 0 KB)
✅ يمكنك فتح الملف بمحرر نصوص
✅ تم حفظ الملف في مكان آمن

===========================================
استعادة Backup (في حالة الطوارئ)
===========================================

# Windows:
cd C:\xampp\mysql\bin\
mysql -u root -p saiid_db < C:\backup\saiid_db_backup_2026_01_05.sql

# Linux:
mysql -u root -p saiid_db < /home/backup/saiid_db_backup_2026_01_05.sql

# مع فك الضغط:
gunzip < saiid_db_backup_2026_01_05.sql.gz | mysql -u root -p saiid_db

===========================================
⚠️ تحذير مهم
===========================================

❌ لا تطبق أي تحسينات قبل عمل Backup كامل
❌ لا تحذف الـ Backup القديم إلا بعد التأكد من نجاح التحسينات
❌ لا تطبق على السيرفر مباشرة - اختبر على Development أولاً

✅ عمل Backup كامل لقاعدة البيانات
✅ الاحتفاظ بنسخة احتياطية لمدة أسبوع على الأقل
✅ اختبار استعادة الـ Backup قبل التطبيق على السيرفر

===========================================
*/

-- عرض معلومات الجدول قبل التحسينات
SELECT 'Table Info Before Optimization:' AS status;

SELECT 
    TABLE_NAME,
    ENGINE,
    TABLE_ROWS,
    AVG_ROW_LENGTH,
    DATA_LENGTH / 1024 / 1024 AS data_size_mb,
    INDEX_LENGTH / 1024 / 1024 AS index_size_mb,
    CREATE_TIME,
    UPDATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals';

-- عرض الـ Indexes الحالية
SELECT 'Current Indexes:' AS status;

SELECT 
    INDEX_NAME,
    INDEX_TYPE,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'project_proposals'
GROUP BY INDEX_NAME, INDEX_TYPE;

SELECT '==================================' AS '';
SELECT '⚠️ Make sure you have a BACKUP before proceeding!' AS status;
SELECT '==================================' AS '';

