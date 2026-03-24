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
        Schema::table('notifications', function (Blueprint $table) {
            // فهرس مركب لتحسين استعلامات قسم الإعلام
            // يستخدم في: where('user_id', X)->whereIn('notification_type', [...])->where('is_read', false)
            if (!Schema::hasIndex('notifications', 'notifications_user_type_read_index')) {
                $table->index(['user_id', 'notification_type', 'is_read'], 'notifications_user_type_read_index');
            }

            // فهرس مركب لتحسين استعلامات الحساب السريع
            // يستخدم في: where('user_id', X)->where('is_read', false)
            if (!Schema::hasIndex('notifications', 'notifications_user_read_created_index')) {
                $table->index(['user_id', 'is_read', 'created_at'], 'notifications_user_read_created_index');
            }

            // فهرس مركب للاستعلامات الشائعة على notifications
            // يساعد في تحسين أداء الاستعلامات التي تفلتر حسب user_id و is_read
            if (!Schema::hasIndex('notifications', 'notifications_user_read_idx')) {
                $table->index(['user_id', 'is_read'], 'notifications_user_read_idx');
            }

            // فهرس مركب للاستعلامات التي تفلتر حسب user_id و created_at
            // مفيد لترتيب الإشعارات حسب التاريخ
            if (!Schema::hasIndex('notifications', 'notifications_user_created_idx')) {
                $table->index(['user_id', 'created_at'], 'notifications_user_created_idx');
            }

            // فهرس مركب للاستعلامات التي تفلتر حسب user_id و priority
            // مفيد لترتيب الإشعارات حسب الأولوية
            if (!Schema::hasIndex('notifications', 'notifications_user_priority_idx')) {
                $table->index(['user_id', 'priority'], 'notifications_user_priority_idx');
            }

            // فهرس مركب للاستعلامات التي تفلتر حسب related_project_id
            // مفيد لجلب جميع إشعارات مشروع معين
            if (!Schema::hasIndex('notifications', 'notifications_project_created_idx')) {
                $table->index(['related_project_id', 'created_at'], 'notifications_project_created_idx');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_user_type_read_index');
            $table->dropIndex('notifications_user_read_created_index');
            $table->dropIndex('notifications_user_read_idx');
            $table->dropIndex('notifications_user_created_idx');
            $table->dropIndex('notifications_user_priority_idx');
            $table->dropIndex('notifications_project_created_idx');
        });
    }
};

