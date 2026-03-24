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
            // إضافة حقول سبب الرفض للمونتاج
            $table->text('rejection_reason')->nullable()->after('status');
            $table->text('rejection_message')->nullable()->after('rejection_reason');
            $table->text('admin_rejection_reason')->nullable()->after('rejection_message');
            $table->text('media_rejection_reason')->nullable()->after('admin_rejection_reason');
            
            // إضافة index للبحث السريع عن المشاريع المرفوضة
            $table->index('rejection_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropIndex(['rejection_reason']);
            $table->dropColumn([
                'rejection_reason',
                'rejection_message',
                'admin_rejection_reason',
                'media_rejection_reason'
            ]);
        });
    }
};
