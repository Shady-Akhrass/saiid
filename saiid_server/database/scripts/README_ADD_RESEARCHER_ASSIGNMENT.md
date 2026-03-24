# 📘 دليل استخدام SQL Scripts: إضافة assigned_researcher_id

## 📋 الملفات المتوفرة

1. **`add_researcher_assignment_final.sql`** ⭐ (موصى به)
   - نسخة بسيطة ومباشرة
   - بدون استخدام prepared statements معقدة
   - مناسب للاستخدام المباشر على السيرفر

2. **`add_researcher_assignment_simple.sql`**
   - نسخة بسيطة مع بعض التحققات
   - يحتوي على queries للتحقق من النتائج

3. **`add_researcher_assignment_safe.sql`**
   - نسخة آمنة مع تحققات كاملة
   - يتحقق من وجود الأعمدة والجداول قبل التنفيذ

---

## 🚀 كيفية الاستخدام

### الطريقة 1: استخدام phpMyAdmin أو أي أداة SQL

1. افتح phpMyAdmin أو أي أداة SQL
2. اختر قاعدة البيانات الخاصة بك
3. افتح تبويب SQL
4. انسخ محتوى ملف `add_researcher_assignment_final.sql`
5. الصق في نافذة SQL
6. اضغط "Go" أو "Execute"

### الطريقة 2: استخدام MySQL Command Line

```bash
mysql -u username -p database_name < add_researcher_assignment_final.sql
```

### الطريقة 3: استخدام MySQL Workbench

1. افتح MySQL Workbench
2. اتصل بقاعدة البيانات
3. File → Open SQL Script
4. اختر ملف `add_researcher_assignment_final.sql`
5. اضغط Execute

---

## ⚠️ تحذيرات مهمة

1. **قم بعمل Backup أولاً!**
   ```sql
   -- مثال على عمل backup
   mysqldump -u username -p database_name > backup_before_researcher_assignment.sql
   ```

2. **تأكد من وجود جدول `team_personnel`**
   - إذا لم يكن موجوداً، سيظهر خطأ في إضافة Foreign Key
   - يمكنك تجاهل هذا الخطأ مؤقتاً

3. **إذا ظهر خطأ "Column already exists"**
   - يعني أن العمود موجود مسبقاً
   - يمكنك تخطي الخطوة الأولى

---

## 🔍 التحقق من النتائج

بعد تشغيل الـ script، يمكنك التحقق من النتائج باستخدام هذه الـ queries:

### 1. التحقق من وجود العمود:
```sql
SHOW COLUMNS FROM `project_proposals` LIKE 'assigned_researcher_id';
```

### 2. التحقق من عدد المشاريع بحالة "تم التنفيذ":
```sql
SELECT COUNT(*) AS count
FROM `project_proposals`
WHERE `status` = 'تم التنفيذ';
```

### 3. التحقق من عدد المشاريع بحالة "مسند لباحث":
```sql
SELECT COUNT(*) AS count
FROM `project_proposals`
WHERE `status` = 'مسند لباحث';
```

### 4. عرض جميع الحالات المتاحة:
```sql
SHOW COLUMNS FROM `project_proposals` WHERE Field = 'status';
```

---

## 🐛 حل المشاكل الشائعة

### خطأ: "Column 'assigned_researcher_id' already exists"
**الحل:** العمود موجود مسبقاً، يمكنك تخطي الخطوة الأولى أو تعديل الـ script لإضافة `IF NOT EXISTS`

### خطأ: "Unknown table 'team_personnel'"
**الحل:** جدول `team_personnel` غير موجود. يمكنك:
- تخطي إضافة Foreign Key مؤقتاً
- أو إنشاء جدول `team_personnel` أولاً

### خطأ: "Unknown table 'project_proposals' in information_schema"
**الحل:** هذا الخطأ يحدث أحياناً في بعض إصدارات MySQL. استخدم الـ query المباشر:
```sql
SHOW COLUMNS FROM `project_proposals` WHERE Field = 'assigned_researcher_id';
```

---

## 📝 ملاحظات إضافية

- جميع الـ scripts آمنة ويمكن تشغيلها عدة مرات (مع بعض التحذيرات)
- إذا ظهر خطأ في إضافة Foreign Key، يمكنك تخطيه وإضافته لاحقاً
- تأكد من أن قاعدة البيانات تستخدم UTF-8 encoding لدعم الأحرف العربية

---

**تاريخ الإنشاء:** 2025-12-22  
**الإصدار:** 1.0

