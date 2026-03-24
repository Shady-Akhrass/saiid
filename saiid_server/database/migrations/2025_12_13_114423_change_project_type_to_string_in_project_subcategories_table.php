<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * تغيير نوع عمود project_type من ENUM إلى VARCHAR للسماح بأي نوع مشروع موجود في جدول project_types
     */
    public function up(): void
    {
        // ✅ استخدام DB::statement مباشرة لأن Laravel قد لا يدعم تغيير ENUM بشكل كامل
        // ✅ تغيير نوع العمود من ENUM إلى VARCHAR وإزالة أي قيمة افتراضية
        DB::statement("ALTER TABLE `project_subcategories` MODIFY COLUMN `project_type` VARCHAR(255) NOT NULL COMMENT 'نوع المشروع'");
        
        // ✅ إزالة القيمة الافتراضية إذا كانت موجودة
        DB::statement("ALTER TABLE `project_subcategories` ALTER COLUMN `project_type` DROP DEFAULT");
    }

    /**
     * Reverse the migrations.
     * إرجاع العمود إلى ENUM (لن يتم استخدامه عادة)
     */
    public function down(): void
    {
        // ⚠️ إرجاع إلى ENUM (اختياري - يمكن حذف هذا إذا لم تكن بحاجة للتراجع)
        DB::statement("ALTER TABLE `project_subcategories` MODIFY COLUMN `project_type` ENUM('إغاثي', 'تنموي', 'طبي', 'تعليمي') NOT NULL COMMENT 'نوع المشروع'");
    }
};
