# 📝 دليل تغيير حالة "معاد مونتاجه" إلى "يجب إعادة المونتاج"

## 🎯 الهدف
تغيير اسم الحالة من "معاد مونتاجه" إلى "يجب إعادة المونتاج" في قاعدة البيانات.

---

## 📋 الطريقة 1: استخدام SQL Script (موصى به)

### الخطوات:

1. **افتح phpMyAdmin** أو أي أداة لإدارة قاعدة البيانات

2. **اختر قاعدة البيانات** الخاصة بالمشروع

3. **افتح ملف SQL:**
   ```
   database/scripts/change_redone_montage_status_to_should_remontage.sql
   ```

4. **انسخ محتوى الملف** والصقه في phpMyAdmin

5. **اضغط "تنفيذ" (Go)** أو "Execute"

6. **تحقق من النتيجة:**
   - يجب أن ترى عدد المشاريع التي تم تحديثها
   - يجب أن يكون عدد المشاريع بحالة "معاد مونتاجه" = 0

---

## 📋 الطريقة 2: استخدام Laravel Migration

### إذا كان لديك وصول SSH للسيرفر:

```bash
# 1. الاتصال بالسيرفر
ssh username@your-server.com

# 2. الانتقال إلى مجلد المشروع
cd /path/to/your/project

# 3. تطبيق Migration
php artisan migrate

# 4. مسح Cache
php artisan cache:clear
php artisan config:clear
```

---

## 📋 الطريقة 3: تنفيذ SQL يدوياً

### الخطوة 1: إضافة القيمة الجديدة إلى ENUM
```sql
ALTER TABLE `project_proposals` 
MODIFY COLUMN `status` ENUM(
    'جديد',
    'قيد التوريد',
    'تم التوريد',
    'قيد التوزيع',
    'جاهز للتنفيذ',
    'تم اختيار المخيم',
    'قيد التنفيذ',
    'منفذ',
    'في المونتاج',
    'تم المونتاج',
    'وصل للمتبرع',
    'ملغى',
    'معاد مونتاجه',
    'يجب إعادة المونتاج',
    'مؤجل'
) NOT NULL DEFAULT 'جديد';
```

### الخطوة 2: تحديث المشاريع
```sql
UPDATE `project_proposals` 
SET `status` = 'يجب إعادة المونتاج', 
    `updated_at` = NOW()
WHERE `status` = 'معاد مونتاجه';
```

### الخطوة 3: إزالة القيمة القديمة من ENUM
```sql
ALTER TABLE `project_proposals` 
MODIFY COLUMN `status` ENUM(
    'جديد',
    'قيد التوريد',
    'تم التوريد',
    'قيد التوزيع',
    'جاهز للتنفيذ',
    'تم اختيار المخيم',
    'قيد التنفيذ',
    'منفذ',
    'في المونتاج',
    'تم المونتاج',
    'وصل للمتبرع',
    'ملغى',
    'يجب إعادة المونتاج',
    'مؤجل'
) NOT NULL DEFAULT 'جديد';
```

---

## ✅ التحقق من النتيجة

### 1. التحقق من عدد المشاريع المحدثة:
```sql
SELECT COUNT(*) as total 
FROM `project_proposals` 
WHERE `status` = 'يجب إعادة المونتاج';
```

### 2. التحقق من عدم وجود مشاريع بالحالة القديمة:
```sql
SELECT COUNT(*) as remaining 
FROM `project_proposals` 
WHERE `status` = 'معاد مونتاجه';
```
(يجب أن تكون النتيجة 0)

### 3. عرض ENUM الحالي:
```sql
SHOW COLUMNS FROM `project_proposals` WHERE Field = 'status';
```

---

## ⚠️ تحذيرات مهمة

1. **عمل Backup أولاً:**
   ```sql
   -- في phpMyAdmin: Export → Go
   -- أو
   mysqldump -u username -p database_name > backup.sql
   ```

2. **مسح Cache بعد التحديث:**
   ```bash
   php artisan cache:clear
   php artisan config:clear
   ```

3. **التحقق من النتيجة** قبل المتابعة

---

## 🔄 التراجع عن التغييرات (إذا لزم الأمر)

إذا أردت إرجاع التغييرات:

```sql
-- 1. إضافة "معاد مونتاجه" إلى ENUM
ALTER TABLE `project_proposals` 
MODIFY COLUMN `status` ENUM(
    'جديد',
    'قيد التوريد',
    'تم التوريد',
    'قيد التوزيع',
    'جاهز للتنفيذ',
    'تم اختيار المخيم',
    'قيد التنفيذ',
    'منفذ',
    'في المونتاج',
    'تم المونتاج',
    'وصل للمتبرع',
    'ملغى',
    'يجب إعادة المونتاج',
    'معاد مونتاجه',
    'مؤجل'
) NOT NULL DEFAULT 'جديد';

-- 2. تحديث المشاريع
UPDATE `project_proposals` 
SET `status` = 'معاد مونتاجه', 
    `updated_at` = NOW()
WHERE `status` = 'يجب إعادة المونتاج';

-- 3. إزالة "يجب إعادة المونتاج" من ENUM
ALTER TABLE `project_proposals` 
MODIFY COLUMN `status` ENUM(
    'جديد',
    'قيد التوريد',
    'تم التوريد',
    'قيد التوزيع',
    'جاهز للتنفيذ',
    'تم اختيار المخيم',
    'قيد التنفيذ',
    'منفذ',
    'في المونتاج',
    'تم المونتاج',
    'وصل للمتبرع',
    'ملغى',
    'معاد مونتاجه',
    'مؤجل'
) NOT NULL DEFAULT 'جديد';
```

---

## 📞 الدعم

إذا واجهت أي مشاكل:
1. تحقق من أن قاعدة البيانات متصلة
2. تحقق من أن لديك صلاحيات ALTER TABLE
3. راجع Logs في `storage/logs/laravel.log`
