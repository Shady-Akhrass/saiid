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
        // تعديل enum status لإضافة حالة "مؤجل"
        DB::statement("ALTER TABLE project_proposals MODIFY COLUMN status ENUM(
            'جديد',
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
        ) DEFAULT 'جديد'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // إزالة حالة "مؤجل" من enum
        // تحويل المشاريع المؤجلة إلى "جديد"
        DB::statement("UPDATE project_proposals SET status = 'جديد' WHERE status = 'مؤجل'");
        
        DB::statement("ALTER TABLE project_proposals MODIFY COLUMN status ENUM(
            'جديد',
            'قيد التوزيع',
            'جاهز للتنفيذ',
            'تم اختيار المخيم',
            'قيد التنفيذ',
            'منفذ',
            'في المونتاج',
            'تم المونتاج',
            'وصل للمتبرع',
            'ملغى',
            'معاد مونتاجه'
        ) DEFAULT 'جديد'");
    }
};

