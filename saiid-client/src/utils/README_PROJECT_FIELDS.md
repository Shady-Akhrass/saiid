# دليل استخدام project-proposals-fields-config.js

## نظرة عامة

هذا الملف يحتوي على جميع تعريفات حقول جدول `project_proposals` ويمكن استيراده واستخدامه في أي مكون في الفرونت.

## الاستيراد

```javascript
import {
  REAL_DATABASE_FIELDS,
  COMPUTED_FIELDS,
  RELATIONSHIP_FIELDS,
  FIELD_LABELS_AR,
  filterRealFields,
  extractChanges,
  validateFieldValue,
  isRealDatabaseField,
  isComputedField,
  getFieldLabel
} from '../utils/project-proposals-fields-config';
```

## أمثلة الاستخدام

### 1. تصفية الحقول الحقيقية قبل الإرسال

```javascript
import { filterRealFields } from '../utils/project-proposals-fields-config';

const formData = {
  project_name: "مشروع جديد",
  donation_amount: 5000,
  amount_in_usd: 18750, // ❌ حقل محسوب - سيتم إزالته
  remaining_days: 30,    // ❌ حقل محسوب - سيتم إزالته
  currency: { id: 2 }    // ❌ علاقة - سيتم إزالتها
};

// ✅ تصفية الحقول الحقيقية فقط
const updateData = filterRealFields(formData);
// النتيجة: { project_name: "مشروع جديد", donation_amount: 5000 }
```

### 2. استخراج التغييرات فقط

```javascript
import { extractChanges } from '../utils/project-proposals-fields-config';

const originalProject = {
  project_name: "مشروع قديم",
  donation_amount: 1000,
  quantity: 50
};

const updatedProject = {
  project_name: "مشروع محدّث",
  donation_amount: 1000, // لم يتغير
  quantity: 100           // تغير
};

// ✅ استخراج التغييرات فقط
const changes = extractChanges(originalProject, updatedProject);
// النتيجة: { project_name: "مشروع محدّث", quantity: 100 }
```

### 3. التحقق من نوع الحقل

```javascript
import { 
  isRealDatabaseField, 
  isComputedField,
  isRelationshipField 
} from '../utils/project-proposals-fields-config';

console.log(isRealDatabaseField('project_name'));  // true
console.log(isRealDatabaseField('remaining_days')); // false

console.log(isComputedField('remaining_days'));     // true
console.log(isComputedField('project_name'));       // false

console.log(isRelationshipField('currency'));      // true
console.log(isRelationshipField('currency_id'));    // false
```

### 4. الحصول على التسمية العربية

```javascript
import { getFieldLabel } from '../utils/project-proposals-fields-config';

console.log(getFieldLabel('project_name'));        // "اسم المشروع"
console.log(getFieldLabel('donation_amount'));     // "مبلغ التبرع"
console.log(getFieldLabel('remaining_days'));      // "الأيام المتبقية"
```

### 5. التحقق من صحة القيمة

```javascript
import { validateFieldValue } from '../utils/project-proposals-fields-config';

console.log(validateFieldValue('quantity', 50));           // true
console.log(validateFieldValue('quantity', '50'));        // false (يجب أن يكون number)
console.log(validateFieldValue('project_name', null));     // true (nullable)
console.log(validateFieldValue('donor_name', null));       // false (required)
```

### 6. استخدام في React Component

```jsx
import React, { useState } from 'react';
import { 
  filterRealFields, 
  extractChanges,
  FIELD_LABELS_AR 
} from '../utils/project-proposals-fields-config';
import apiClient from '../utils/axiosConfig';

function EditProjectForm({ project, onSave }) {
  const [formData, setFormData] = useState(project);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // استخراج التغييرات فقط
    const changes = extractChanges(project, formData);
    
    // تصفية الحقول الحقيقية
    const updateData = filterRealFields(changes);
    
    try {
      const response = await apiClient.patch(
        `/admin/project-proposals/${project.id}/advanced-update`,
        updateData
      );
      
      onSave(response.data);
    } catch (error) {
      console.error('خطأ في التحديث:', error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <label>{FIELD_LABELS_AR.project_name}</label>
      <input
        value={formData.project_name || ''}
        onChange={(e) => setFormData({
          ...formData,
          project_name: e.target.value
        })}
      />
      
      {/* باقي الحقول */}
      
      <button type="submit">حفظ</button>
    </form>
  );
}
```

## الحقول المتاحة

### REAL_DATABASE_FIELDS
جميع الحقول الحقيقية في قاعدة البيانات (~75 حقل)

### COMPUTED_FIELDS
الحقول المحسوبة تلقائياً (~10 حقول) - للعرض فقط

### RELATIONSHIP_FIELDS
العلاقات مع الجداول الأخرى (~25 علاقة)

### FIELD_LABELS_AR
التسميات العربية لجميع الحقول

### PROJECT_STATUSES
حالات المشروع المتاحة (17 حالة)

### PHASE_TYPES
أنواع التقسيم: 'daily', 'monthly', null

## ملاحظات مهمة

1. **لا ترسل الحقول المحسوبة**: استخدم `filterRealFields()` قبل الإرسال
2. **أرسل فقط التغييرات**: استخدم `extractChanges()` لتقليل حجم الطلب
3. **التحقق من الصحة**: استخدم `validateFieldValue()` قبل الإرسال
4. **التسميات**: استخدم `FIELD_LABELS_AR` لعرض التسميات العربية

## للمزيد من المعلومات

راجع ملف التوثيق الكامل:
- `md/PROJECT_PROPOSALS_FIELDS_DOCUMENTATION.md`
