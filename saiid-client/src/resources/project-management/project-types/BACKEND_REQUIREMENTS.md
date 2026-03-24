# 📋 متطلبات Backend - إدارة أنواع المشاريع

## 🗄️ جدول قاعدة البيانات

يجب إنشاء جدول `project_types` في قاعدة البيانات مع الحقول التالية:

```sql
CREATE TABLE project_types (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

### البيانات الأولية (Seed):

```sql
INSERT INTO project_types (name, created_at, updated_at) VALUES
('إغاثي', NOW(), NOW()),
('تنموي', NOW(), NOW()),
('طبي', NOW(), NOW()),
('تعليمي', NOW(), NOW());
```

---

## 🔗 API Endpoints المطلوبة

### 1. جلب جميع أنواع المشاريع

**GET** `/api/project-types`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "إغاثي",
      "created_at": "2025-01-01T00:00:00.000000Z",
      "updated_at": "2025-01-01T00:00:00.000000Z"
    },
    {
      "id": 2,
      "name": "تنموي",
      "created_at": "2025-01-01T00:00:00.000000Z",
      "updated_at": "2025-01-01T00:00:00.000000Z"
    }
  ]
}
```

---

### 2. جلب نوع مشروع واحد

**GET** `/api/project-types/{id}`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "إغاثي",
    "created_at": "2025-01-01T00:00:00.000000Z",
    "updated_at": "2025-01-01T00:00:00.000000Z"
  }
}
```

---

### 3. إنشاء نوع مشروع جديد (Admin only)

**POST** `/api/project-types`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "صحي"
}
```

**Validation:**
- `name`: مطلوب، string، على الأقل حرفين، فريد (unique)

**Response:**
```json
{
  "success": true,
  "message": "تم إنشاء نوع المشروع بنجاح",
  "data": {
    "id": 5,
    "name": "صحي",
    "created_at": "2025-01-21T10:00:00.000000Z",
    "updated_at": "2025-01-21T10:00:00.000000Z"
  }
}
```

---

### 4. تحديث نوع مشروع (Admin only)

**PATCH** `/api/project-types/{id}`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "إغاثي محسّن"
}
```

**Validation:**
- `name`: مطلوب، string، على الأقل حرفين، فريد (unique)

**Response:**
```json
{
  "success": true,
  "message": "تم تحديث نوع المشروع بنجاح",
  "data": {
    "id": 1,
    "name": "إغاثي محسّن",
    "created_at": "2025-01-01T00:00:00.000000Z",
    "updated_at": "2025-01-21T10:00:00.000000Z"
  }
}
```

---

### 5. حذف نوع مشروع (Admin only)

**DELETE** `/api/project-types/{id}`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (نجاح):**
```json
{
  "success": true,
  "message": "تم حذف نوع المشروع بنجاح"
}
```

**Response (فشل - يوجد مشاريع مرتبطة):**
```json
{
  "success": false,
  "error": "لا يمكن حذف نوع المشروع",
  "message": "يوجد 15 مشروع مرتبط بهذا النوع. يرجى نقل المشاريع إلى نوع آخر أولاً."
}
```

---

## 🔒 الصلاحيات

- **إنشاء/تعديل/حذف:** Admin only
- **القراءة:** جميع المستخدمين المسجلين

---

## ⚠️ ملاحظات مهمة

1. **التحقق من الاستخدام:** قبل حذف نوع المشروع، يجب التحقق من وجود مشاريع مرتبطة به
2. **الاسم فريد:** لا يمكن إنشاء نوعين بنفس الاسم
3. **التحقق من البيانات:** التحقق من أن الاسم على الأقل حرفين
4. **العلاقة مع المشاريع:** يجب أن يكون `project_type` في جدول `project_proposals` يشير إلى `name` في `project_types`

---

## 📝 مثال Laravel Controller

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectTypeController extends Controller
{
    public function index()
    {
        $types = ProjectType::orderBy('name')->get();
        
        return response()->json([
            'success' => true,
            'data' => $types
        ]);
    }

    public function show($id)
    {
        $type = ProjectType::findOrFail($id);
        
        return response()->json([
            'success' => true,
            'data' => $type
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|min:2|unique:project_types,name'
        ]);

        $type = ProjectType::create([
            'name' => $request->name
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء نوع المشروع بنجاح',
            'data' => $type
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $type = ProjectType::findOrFail($id);
        
        $request->validate([
            'name' => 'required|string|min:2|unique:project_types,name,' . $id
        ]);

        $type->update([
            'name' => $request->name
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث نوع المشروع بنجاح',
            'data' => $type
        ]);
    }

    public function destroy($id)
    {
        $type = ProjectType::findOrFail($id);
        
        // التحقق من وجود مشاريع مرتبطة
        $projectsCount = DB::table('project_proposals')
            ->where('project_type', $type->name)
            ->count();
        
        if ($projectsCount > 0) {
            return response()->json([
                'success' => false,
                'error' => 'لا يمكن حذف نوع المشروع',
                'message' => "يوجد {$projectsCount} مشروع مرتبط بهذا النوع. يرجى نقل المشاريع إلى نوع آخر أولاً."
            ], 400);
        }

        $type->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف نوع المشروع بنجاح'
        ]);
    }
}
```

---

## 🔄 Migration Laravel

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('project_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        // إضافة البيانات الأولية
        DB::table('project_types')->insert([
            ['name' => 'إغاثي', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'تنموي', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'طبي', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'تعليمي', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down()
    {
        Schema::dropIfExists('project_types');
    }
};
```

---

## ✅ Checklist للتنفيذ

- [ ] إنشاء جدول `project_types` في قاعدة البيانات
- [ ] إضافة البيانات الأولية (إغاثي، تنموي، طبي، تعليمي)
- [ ] إنشاء Model `ProjectType`
- [ ] إنشاء Controller `ProjectTypeController`
- [ ] إضافة Routes في `api.php`
- [ ] إضافة Validation Rules
- [ ] إضافة التحقق من الصلاحيات (Admin only للإنشاء/التعديل/الحذف)
- [ ] إضافة التحقق من وجود مشاريع مرتبطة قبل الحذف
- [ ] اختبار جميع الـ Endpoints

---

**آخر تحديث:** 2025-01-21

