# ملفات SQL لنظام ممنتجي المونتاج

## نظرة عامة

هذا المجلد يحتوي على ملفات SQL لإضافة نظام ممنتجي المونتاج إلى قاعدة البيانات.

---

## الملفات المتوفرة

### 1. `add_montage_producers_system_simple.sql` ⚡ (موصى به للبداية)

**الوصف:** نسخة مبسطة وسريعة بدون تحقق من الوجود.

**المميزات:**
- سريع في التنفيذ
- بسيط وسهل القراءة
- مناسب للبيئات الجديدة

**الاستخدام:**
```bash
mysql -u username -p database_name < database/scripts/add_montage_producers_system_simple.sql
```

**ملاحظات:**
- إذا ظهرت أخطاء "Duplicate column" أو "Duplicate key"، يمكن تجاهلها بأمان
- هذه الأخطاء تعني أن التغييرات موجودة بالفعل

---

### 2. `add_montage_producers_system_enhanced.sql` ✅ (موصى به للإنتاج)

**الوصف:** نسخة محسّنة مع التحقق من الوجود قبل الإضافة.

**المميزات:**
- آمن للتشغيل عدة مرات (idempotent)
- يتحقق من وجود الأعمدة والـ indexes قبل الإضافة
- لا يعطي أخطاء عند التشغيل المتكرر

**الاستخدام:**
```bash
mysql -u username -p database_name < database/scripts/add_montage_producers_system_enhanced.sql
```

**ملاحظات:**
- آمن تماماً للتشغيل عدة مرات
- يعرض رسائل توضيحية إذا كانت التغييرات موجودة بالفعل

---

### 3. `add_montage_producers_system.sql` 🔍 (للتحقق الشامل)

**الوصف:** نسخة شاملة مع تحقق مفصل من كل شيء.

**المميزات:**
- تحقق شامل من جميع العناصر
- يعرض معلومات تفصيلية عن كل خطوة
- مناسب للتحقق من التطبيق

**الاستخدام:**
```bash
mysql -u username -p database_name < database/scripts/add_montage_producers_system.sql
```

---

### 4. `verify_montage_producers_system.sql` ✅ (للتحقق)

**الوصف:** سكريبت للتحقق من أن جميع التغييرات تمت بنجاح.

**الاستخدام:**
```bash
mysql -u username -p database_name < database/scripts/verify_montage_producers_system.sql
```

**المخرجات:**
- حالة كل عمود (موجود/غير موجود)
- حالة الـ Foreign Keys
- حالة الـ Indexes
- ملخص إحصائي

---

## ما يتم تنفيذه في SQL

### 1. تحديث جدول `users`
```sql
-- إضافة دور montage_producer إلى enum role
ALTER TABLE `users` 
MODIFY COLUMN `role` ENUM(..., 'montage_producer') NULL;
```

### 2. تحديث جدول `project_proposals`
```sql
-- إضافة 3 أعمدة جديدة:
-- - assigned_montage_producer_id (BIGINT UNSIGNED)
-- - montage_producer_assigned_at (TIMESTAMP)
-- - montage_completed_at (TIMESTAMP)

-- إضافة Foreign Key
-- إضافة 3 Indexes للبحث السريع
```

### 3. تحديث جدول `notifications`
```sql
-- إضافة 3 أنواع إشعارات جديدة:
-- - montage_producer_assigned
-- - montage_completed_by_producer
-- - montage_approved_by_manager
```

---

## خطوات التطبيق

### الطريقة 1: استخدام SQL مباشرة (موصى به)

```bash
# 1. نسخ احتياطي لقاعدة البيانات (مهم جداً!)
mysqldump -u username -p database_name > backup_before_montage_producers.sql

# 2. تشغيل السكريبت
mysql -u username -p database_name < database/scripts/add_montage_producers_system_enhanced.sql

# 3. التحقق من التطبيق
mysql -u username -p database_name < database/scripts/verify_montage_producers_system.sql
```

### الطريقة 2: استخدام Laravel Migrations

```bash
# تشغيل migrations
php artisan migrate

# التحقق من migrations
php artisan migrate:status
```

---

## التحقق من التطبيق

بعد تشغيل SQL، استخدم سكريبت التحقق:

```bash
mysql -u username -p database_name < database/scripts/verify_montage_producers_system.sql
```

**النتائج المتوقعة:**
- ✅ جميع الأعمدة موجودة
- ✅ جميع الـ Foreign Keys موجودة
- ✅ جميع الـ Indexes موجودة
- ✅ جميع أنواع الإشعارات موجودة

---

## استكشاف الأخطاء

### خطأ: "Duplicate column name"
**السبب:** العمود موجود بالفعل  
**الحل:** يمكن تجاهل الخطأ بأمان، أو استخدام النسخة المحسّنة

### خطأ: "Duplicate key name"
**السبب:** الـ Index موجود بالفعل  
**الحل:** يمكن تجاهل الخطأ بأمان، أو استخدام النسخة المحسّنة

### خطأ: "Foreign key constraint fails"
**السبب:** قد يكون هناك بيانات غير صحيحة  
**الحل:** 
1. التحقق من وجود جدول `users`
2. التحقق من أن جميع `assigned_montage_producer_id` تشير إلى مستخدمين موجودين

### خطأ: "Unknown column 'assigned_photographer_id'"
**السبب:** العمود `assigned_photographer_id` غير موجود  
**الحل:** تعديل السكريبت لاستخدام عمود آخر موجود (مثل `assigned_to_team_id`)

---

## التراجع عن التغييرات (Rollback)

إذا أردت التراجع عن التغييرات:

```sql
-- حذف الأعمدة
ALTER TABLE `project_proposals` 
DROP COLUMN `montage_completed_at`,
DROP COLUMN `montage_producer_assigned_at`,
DROP COLUMN `assigned_montage_producer_id`;

-- إرجاع enum role (إزالة montage_producer)
ALTER TABLE `users` 
MODIFY COLUMN `role` ENUM(
    'admin',
    'project_manager',
    'media_manager',
    'executed_projects_coordinator',
    'executor',
    'photographer',
    'warehouse_manager'
) NULL;

-- إرجاع enum notification_type (إزالة الأنواع الجديدة)
ALTER TABLE `notifications` 
MODIFY COLUMN `notification_type` ENUM(
    -- ... (جميع الأنواع القديمة بدون montage_producer_assigned, etc.)
) NOT NULL;
```

**⚠️ تحذير:** التراجع سيحذف جميع البيانات المرتبطة بممنتجي المونتاج!

---

## ملاحظات مهمة

1. **النسخ الاحتياطي:** دائماً قم بعمل نسخة احتياطية قبل تشغيل SQL
2. **البيئة:** اختبر على بيئة التطوير أولاً
3. **الصلاحيات:** تأكد من أن المستخدم لديه صلاحيات ALTER TABLE
4. **الوقت:** قد يستغرق التنفيذ بعض الوقت على قواعد البيانات الكبيرة

---

## الدعم

إذا واجهت أي مشاكل:
1. تحقق من سجلات الأخطاء
2. استخدم سكريبت التحقق
3. راجع ملفات migrations في `database/migrations/`

---

## نهاية الدليل
