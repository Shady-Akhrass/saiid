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
        // التحقق من وجود الجدول أولاً
        if (!Schema::hasTable('team_members')) {
            return;
        }
        
        Schema::table('team_members', function (Blueprint $table) {
            // إزالة foreign key القديم
            if (Schema::hasColumn('team_members', 'user_id')) {
                $table->dropForeign(['user_id']);
            }
            
            // إزالة index القديم
            if (Schema::hasColumn('team_members', 'user_id')) {
                $table->dropIndex(['user_id']);
            }
            
            // إضافة حقل personnel_id
            if (!Schema::hasColumn('team_members', 'personnel_id')) {
                $table->unsignedBigInteger('personnel_id')->nullable()->after('team_id');
            }
            
            // إضافة foreign key جديد
            $table->foreign('personnel_id')->references('id')->on('team_personnel')->onDelete('cascade');
            
            // إضافة index
            $table->index('personnel_id');
            
            // تحديث unique constraint ليشمل personnel_id بدلاً من user_id
            if (Schema::hasColumn('team_members', 'user_id')) {
                try {
                    $table->dropUnique(['team_id', 'user_id']);
                } catch (\Exception $e) {
                    // قد لا يكون unique constraint موجود
                }
            }
            
            $table->unique(['team_id', 'personnel_id']);
            
            // إزالة member_type من pivot table لأن النوع موجود في team_personnel
            if (Schema::hasColumn('team_members', 'member_type')) {
                $table->dropIndex(['member_type']);
                $table->dropColumn('member_type');
            }
            
            // إزالة user_id بعد إضافة personnel_id (يمكن تنفيذها لاحقاً بعد نقل البيانات)
            // $table->dropColumn('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('team_members', function (Blueprint $table) {
            $table->dropForeign(['personnel_id']);
            $table->dropIndex(['personnel_id']);
            $table->dropColumn('personnel_id');
            
            // إعادة user_id إذا لزم الأمر
            // $table->unsignedBigInteger('user_id')->after('team_id');
            // $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }
};
