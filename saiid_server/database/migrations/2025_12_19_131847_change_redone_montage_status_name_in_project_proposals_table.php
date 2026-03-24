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
        // تحديث الحالة في قاعدة البيانات
        // استبدال "معاد مونتاجه" بـ "يجب إعادة المونتاج"
        
        // أولاً: تعديل ENUM في جدول project_proposals (يجب أن يكون قبل تحديث البيانات)
        // ملاحظة: MySQL لا يدعم تعديل ENUM مباشرة، لذلك نستخدم ALTER TABLE
        // نضيف "يجب إعادة المونتاج" أولاً (مع الاحتفاظ بـ "معاد مونتاجه" مؤقتاً)
        DB::statement("ALTER TABLE `project_proposals` MODIFY COLUMN `status` ENUM(
            'جديد',
            'قيد التوريد',
            'تم التوريد',
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
            'يجب إعادة المونتاج',
            'مؤجل'
        ) NOT NULL DEFAULT 'جديد'");
        
        // ثانياً: تحديث المشاريع التي حالتها "معاد مونتاجه" إلى "يجب إعادة المونتاج"
        DB::statement("UPDATE `project_proposals` SET `status` = 'يجب إعادة المونتاج' WHERE `status` = 'معاد مونتاجه'");
        
        // ثالثاً: إزالة "معاد مونتاجه" من ENUM (بعد تحديث جميع البيانات)
        DB::statement("ALTER TABLE `project_proposals` MODIFY COLUMN `status` ENUM(
            'جديد',
            'قيد التوريد',
            'تم التوريد',
            'قيد التوزيع',
            'جاهز للتنفيذ',
            'تم اختيار المخيم',
            'قيد التنفيذ',
            'منفذ',
            'في المونتاج',
            'تم المونتاج',
            'وصل للمتبرع',
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
        // إرجاع الحالة إلى "معاد مونتاجه"
        
        // أولاً: إضافة "معاد مونتاجه" إلى ENUM (مع الاحتفاظ بـ "يجب إعادة المونتاج" مؤقتاً)
        DB::statement("ALTER TABLE `project_proposals` MODIFY COLUMN `status` ENUM(
            'جديد',
            'قيد التوريد',
            'تم التوريد',
            'قيد التوزيع',
            'جاهز للتنفيذ',
            'تم اختيار المخيم',
            'قيد التنفيذ',
            'منفذ',
            'في المونتاج',
            'تم المونتاج',
            'وصل للمتبرع',
            'ملغى',
            'يجب إعادة المونتاج',
            'معاد مونتاجه',
            'مؤجل'
        ) NOT NULL DEFAULT 'جديد'");
        
        // ثانياً: تحديث المشاريع التي حالتها "يجب إعادة المونتاج" إلى "معاد مونتاجه"
        DB::statement("UPDATE `project_proposals` SET `status` = 'معاد مونتاجه' WHERE `status` = 'يجب إعادة المونتاج'");
        
        // ثالثاً: إزالة "يجب إعادة المونتاج" من ENUM (بعد تحديث جميع البيانات)
        DB::statement("ALTER TABLE `project_proposals` MODIFY COLUMN `status` ENUM(
            'جديد',
            'قيد التوريد',
            'تم التوريد',
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
        ) NOT NULL DEFAULT 'جديد'");
    }
};
