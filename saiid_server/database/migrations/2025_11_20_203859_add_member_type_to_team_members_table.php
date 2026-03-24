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
        Schema::table('team_members', function (Blueprint $table) {
            // إضافة حقل لتحديد نوع العضو في الفريق (باحث أو مصور)
            $table->enum('member_type', ['باحث', 'مصور'])->nullable()->after('role_in_team');
            
            // إضافة index للبحث السريع
            $table->index('member_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('team_members', function (Blueprint $table) {
            $table->dropIndex(['member_type']);
            $table->dropColumn('member_type');
        });
    }
};
