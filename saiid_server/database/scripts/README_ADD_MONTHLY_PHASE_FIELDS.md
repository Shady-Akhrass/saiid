# 📘 دليل إضافة حقول المشاريع الشهرية

## المشكلة

عند محاولة إنشاء مشروع جديد، يظهر الخطأ التالي:
```
SQLSTATE[42S22]: Column not found: 1054 Unknown column 'phase_type' in 'INSERT INTO'
```

## السبب

الحقول الجديدة للمشاريع الشهرية غير موجودة في قاعدة البيانات. يجب تطبيق Migration يدوياً.

---

## الحل: تطبيق SQL Script

### الخطوة 1: فتح phpMyAdmin أو MySQL Client

1. افتح phpMyAdmin
2. اختر قاعدة البيانات الخاصة بالمشروع
3. اضغط على تبويب "SQL"

### الخطوة 2: نسخ ولصق SQL Script

1. افتح الملف: `database/scripts/add_monthly_phase_fields.sql`
2. انسخ المحتوى بالكامل
3. الصقه في phpMyAdmin
4. اضغط "Go" أو "تنفيذ"

### الخطوة 3: التحقق من النجاح

بعد التنفيذ، يجب أن ترى رسالة:
```
Migration completed successfully!
columns_added: 5
```

---

## الحقول المضافة

| الحقل | النوع | الوصف |
|------|------|-------|
| `phase_type` | ENUM('daily', 'monthly') | نوع التقسيم |
| `total_months` | INT | عدد الشهور (للمشاريع الشهرية) |
| `month_number` | INT | رقم الشهر |
| `is_monthly_phase` | TINYINT(1) | إذا كان المشروع مشروع شهري |
| `month_start_date` | DATE | تاريخ بداية الشهر |

---

## ملاحظات

- ✅ Script آمن: يتحقق من وجود الأعمدة قبل إضافتها (idempotent)
- ✅ يمكن تشغيله عدة مرات بدون مشاكل
- ✅ لا يحذف أي بيانات موجودة
- ✅ يضيف indexes لتحسين الأداء

---

## إذا استمرت المشكلة

1. **تحقق من قاعدة البيانات:**
   ```sql
   DESCRIBE project_proposals;
   ```
   يجب أن ترى الحقول الجديدة في القائمة.

2. **تحقق من الأخطاء:**
   - افتح `storage/logs/laravel.log`
   - ابحث عن أخطاء SQL

3. **مسح Cache:**
   ```bash
   php artisan cache:clear
   php artisan config:clear
   ```

---

## نهاية الدليل

بعد تطبيق SQL Script، يجب أن يعمل إنشاء المشاريع بشكل صحيح.
