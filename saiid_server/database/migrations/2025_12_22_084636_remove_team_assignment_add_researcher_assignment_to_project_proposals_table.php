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
        if (!Schema::hasTable('project_proposals')) {
            return;
        }

        Schema::table('project_proposals', function (Blueprint $table) {
            // إضافة assigned_researcher_id
            if (!Schema::hasColumn('project_proposals', 'assigned_researcher_id')) {
                $table->unsignedBigInteger('assigned_researcher_id')->nullable()->after('assigned_to_team_id');
                $table->index('assigned_researcher_id');
            }
        });

        // تحديث enum status لإضافة "مسند لباحث" و "تم التنفيذ" (بدلاً من "منفذ")
        // أولاً: إضافة الحالات الجديدة (مع الاحتفاظ بالحالات القديمة مؤقتاً)
        DB::statement("ALTER TABLE `project_proposals` MODIFY COLUMN `status` ENUM(
            'جديد',
            'قيد التوريد',
            'تم التوريد',
            'قيد التوزيع',
            'مسند لباحث',
            'جاهز للتنفيذ',
            'تم اختيار المخيم',
            'قيد التنفيذ',
            'منفذ',
            'تم التنفيذ',
            'في المونتاج',
            'تم المونتاج',
            'وصل للمتبرع',
            'ملغى',
            'يجب إعادة المونتاج',
            'مؤجل'
        ) NOT NULL DEFAULT 'جديد'");

        // تحديث المشاريع التي حالتها "منفذ" إلى "تم التنفيذ"
        DB::statement("UPDATE `project_proposals` SET `status` = 'تم التنفيذ' WHERE `status` = 'منفذ'");

        // إزالة "منفذ" و "قيد التوزيع" من ENUM (بعد تحديث جميع البيانات)
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

        // إضافة foreign key constraint لـ assigned_researcher_id
        Schema::table('project_proposals', function (Blueprint $table) {
            if (Schema::hasColumn('project_proposals', 'assigned_researcher_id')) {
                // التحقق من وجود الجدول team_personnel
                if (Schema::hasTable('team_personnel')) {
                    // إزالة foreign key القديم إذا كان موجوداً
                    $foreignKeys = DB::select("
                        SELECT CONSTRAINT_NAME 
                        FROM information_schema.KEY_COLUMN_USAGE 
                        WHERE TABLE_SCHEMA = DATABASE() 
                        AND TABLE_NAME = 'project_proposals' 
                        AND COLUMN_NAME = 'assigned_researcher_id'
                        AND REFERENCED_TABLE_NAME IS NOT NULL
                    ");
                    
                    foreach ($foreignKeys as $fk) {
                        $table->dropForeign([$fk->CONSTRAINT_NAME]);
                    }

                    // إضافة foreign key جديد
                    $table->foreign('assigned_researcher_id')
                          ->references('id')
                          ->on('team_personnel')
                          ->onDelete('set null');
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('project_proposals')) {
            return;
        }

        // إرجاع enum status للحالة السابقة
        // أولاً: إضافة "منفذ" و "قيد التوزيع" إلى ENUM
        DB::statement("ALTER TABLE `project_proposals` MODIFY COLUMN `status` ENUM(
            'جديد',
            'قيد التوريد',
            'تم التوريد',
            'قيد التوزيع',
            'مسند لباحث',
            'جاهز للتنفيذ',
            'تم اختيار المخيم',
            'قيد التنفيذ',
            'منفذ',
            'تم التنفيذ',
            'في المونتاج',
            'تم المونتاج',
            'وصل للمتبرع',
            'ملغى',
            'يجب إعادة المونتاج',
            'مؤجل'
        ) NOT NULL DEFAULT 'جديد'");

        // تحديث المشاريع التي حالتها "تم التنفيذ" إلى "منفذ"
        DB::statement("UPDATE `project_proposals` SET `status` = 'منفذ' WHERE `status` = 'تم التنفيذ'");

        // إزالة "تم التنفيذ" و "مسند لباحث" من ENUM
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

        // إزالة assigned_researcher_id
        Schema::table('project_proposals', function (Blueprint $table) {
            if (Schema::hasColumn('project_proposals', 'assigned_researcher_id')) {
                // إزالة foreign key أولاً
                $foreignKeys = DB::select("
                    SELECT CONSTRAINT_NAME 
                    FROM information_schema.KEY_COLUMN_USAGE 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'project_proposals' 
                    AND COLUMN_NAME = 'assigned_researcher_id'
                    AND REFERENCED_TABLE_NAME IS NOT NULL
                ");
                
                foreach ($foreignKeys as $fk) {
                    try {
                        $table->dropForeign([$fk->CONSTRAINT_NAME]);
                    } catch (\Exception $e) {
                        // تجاهل الخطأ إذا كان الـ foreign key غير موجود
                    }
                }

                // إزالة العمود
                $table->dropColumn('assigned_researcher_id');
            }
        });
    }
};
