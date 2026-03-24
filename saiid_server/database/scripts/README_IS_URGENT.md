# كيفية إضافة عمود is_urgent على Hostinger

## الطريقة 1: استخدام SQL Script (الأسهل والأسرع) ✅

### الخطوات:

1. **افتح phpMyAdmin في Hostinger**
   - اذهب إلى لوحة التحكم في Hostinger
   - افتح phpMyAdmin
   - اختر قاعدة البيانات الخاصة بك

2. **شغّل SQL Script**
   - اضغط على تبويب "SQL" في الأعلى
   - انسخ محتوى الملف: `add_is_urgent_to_project_proposals_simple.sql`
   - الصق الكود في المربع
   - اضغط "Go" أو "تنفيذ"

### الملف الموصى به:
```
database/scripts/add_is_urgent_to_project_proposals_simple.sql
```

### إذا ظهر خطأ "العمود موجود بالفعل":
- هذا يعني أن العمود موجود مسبقاً
- لا مشكلة، يمكنك المتابعة

---

## الطريقة 2: استخدام SQL Script مع التحقق (آمنة أكثر)

### الملف:
```
database/scripts/add_is_urgent_to_project_proposals.sql
```

### الفرق:
- يتحقق من وجود العمود قبل الإضافة
- لا يظهر أخطاء إذا كان العمود موجوداً
- يعرض رسالة تأكيد بعد التنفيذ

---

## الطريقة 3: استخدام Laravel Migration (إذا كان لديك SSH)

إذا كان لديك وصول SSH إلى Hostinger:

```bash
php artisan migrate
```

أو migration محدد:

```bash
php artisan migrate --path=database/migrations/2026_01_07_212212_add_is_urgent_to_project_proposals_table.php
```

---

## التحقق من نجاح الإضافة

بعد تشغيل SQL، تحقق من:

```sql
-- التحقق من وجود العمود
SHOW COLUMNS FROM `project_proposals` LIKE 'is_urgent';

-- التحقق من وجود Index
SHOW INDEX FROM `project_proposals` WHERE Key_name = 'project_proposals_is_urgent_index';
```

### النتيجة المتوقعة:
- يجب أن ترى عمود `is_urgent` من نوع `tinyint(1)`
- القيمة الافتراضية: `0`
- يجب أن ترى index باسم `project_proposals_is_urgent_index`

---

## استخدام الحقل بعد الإضافة

### في API:
```json
POST /api/project-proposals
{
  "is_urgent": true,
  // ... باقي الحقول
}
```

### في SQL:
```sql
-- البحث عن المشاريع العاجلة
SELECT * FROM project_proposals WHERE is_urgent = 1;

-- تحديث مشروع إلى عاجل
UPDATE project_proposals SET is_urgent = 1 WHERE id = 123;
```

---

## ملاحظات مهمة

1. **النسخ الاحتياطي**: احرص على عمل نسخة احتياطية قبل تشغيل SQL
2. **البيانات الموجودة**: جميع المشاريع الموجودة ستكون `is_urgent = 0` (غير عاجلة)
3. **الأداء**: تم إضافة Index لتحسين البحث عن المشاريع العاجلة

---

## الدعم

إذا واجهت أي مشاكل:
1. تحقق من أن اسم الجدول صحيح: `project_proposals`
2. تحقق من أن لديك صلاحيات ALTER TABLE
3. راجع ملف التوثيق: `MD/FRONTEND_URGENT_PROJECTS_GUIDE.md`

