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
        if (!Schema::hasTable('project_proposals')) {
            return;
        }
        
        Schema::table('project_proposals', function (Blueprint $table) {
            // إزالة foreign key القديم إذا كان موجوداً
            // Note: Laravel لا يدعم dropForeign مباشرة، يجب تنفيذها يدوياً في SQL إذا لزم الأمر
            
            // تغيير الحقل ليشير إلى team_personnel بدلاً من users
            // لكن يجب أن نتحقق من أن الحقل موجود أولاً
            if (Schema::hasColumn('project_proposals', 'assigned_photographer_id')) {
                // سنترك الحقل كما هو ولكن سنغير العلاقة في Model
                // لأن تغيير foreign key يحتاج إلى إعادة إنشاء الجدول
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // لا حاجة للتراجع لأننا لم نغير البنية
    }
};
