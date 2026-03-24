<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // تحديث enum project_type في جدول project_subcategories لإضافة 'الكفالات'
        DB::statement("ALTER TABLE project_subcategories MODIFY COLUMN project_type ENUM(
            'إغاثي',
            'تنموي',
            'طبي',
            'تعليمي',
            'الكفالات'
        ) NOT NULL COMMENT 'نوع المشروع'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // إرجاع enum project_type للحالة السابقة
        DB::statement("ALTER TABLE project_subcategories MODIFY COLUMN project_type ENUM(
            'إغاثي',
            'تنموي',
            'طبي',
            'تعليمي'
        ) NOT NULL COMMENT 'نوع المشروع'");
    }
};
