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
        // تحديث enum status لإضافة حالة "قيد التوريد"
        DB::statement("ALTER TABLE project_proposals MODIFY COLUMN status ENUM(
            'جديد',
            'قيد التوريد',
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
        // إرجاع enum status للحالة السابقة
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
};
