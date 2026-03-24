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
        // تحديث enum status لإضافة حالة "منتهي"
        DB::statement("ALTER TABLE `project_proposals` MODIFY COLUMN `status` ENUM(
            'جديد',
            'قيد التوريد',
            'تم التوريد',
            'مسند لباحث',
            'جاهز للتنفيذ',
            'تم اختيار المخيم',
            'قيد التنفيذ',
            'تم التنفيذ',
            'في المونتاج',
            'تم المونتاج',
            'وصل للمتبرع',
            'منتهي',
            'ملغى',
            'يجب إعادة المونتاج',
            'مؤجل'
        ) NOT NULL DEFAULT 'جديد'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // إزالة حالة "منتهي" من enum
        // تحويل المشاريع المنتهية إلى "وصل للمتبرع"
        DB::statement("UPDATE `project_proposals` SET `status` = 'وصل للمتبرع' WHERE `status` = 'منتهي'");
        
        DB::statement("ALTER TABLE `project_proposals` MODIFY COLUMN `status` ENUM(
            'جديد',
            'قيد التوريد',
            'تم التوريد',
            'مسند لباحث',
            'جاهز للتنفيذ',
            'تم اختيار المخيم',
            'قيد التنفيذ',
            'تم التنفيذ',
            'في المونتاج',
            'تم المونتاج',
            'وصل للمتبرع',
            'ملغى',
            'يجب إعادة المونتاج',
            'مؤجل'
        ) NOT NULL DEFAULT 'جديد'");
    }
};
