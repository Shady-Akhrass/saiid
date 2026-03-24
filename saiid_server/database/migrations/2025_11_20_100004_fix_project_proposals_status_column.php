<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            // Drop the old status column
            $table->dropColumn('status');
        });

        Schema::table('project_proposals', function (Blueprint $table) {
            // Re-add status column with proper ENUM values and character set
            $table->enum('status', [
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
                'يجب إعادة المونتاج',
                'وصل للمتبرع',
                'منتهي',
                'ملغى',
                'مؤجل',
                'معاد مونتاجه'
            ])->default('جديد')->charset('utf8mb4')->collation('utf8mb4_unicode_ci')->after('estimated_duration_days');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropColumn('status');
        });

        Schema::table('project_proposals', function (Blueprint $table) {
            $table->enum('status', [
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
            ])->default('جديد')->after('estimated_duration_days');
        });
    }
};
