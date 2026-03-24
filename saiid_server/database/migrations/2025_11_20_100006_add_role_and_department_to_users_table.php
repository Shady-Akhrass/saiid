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
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', [
                'admin',
                'project_manager',
                'media_manager',
                'executed_projects_coordinator',
                'team_leader',
                'photographer',
                'executor'
            ])->default('executor')->after('email');
            
            $table->enum('department', [
                'إدارة',
                'مشاريع',
                'إعلام'
            ])->nullable()->after('role');
            
            $table->boolean('is_active')->default(true)->after('department');
            $table->string('phone_number')->nullable()->after('is_active');
            $table->unsignedBigInteger('added_by')->nullable()->after('phone_number');
            
            // Foreign key
            $table->foreign('added_by')->references('id')->on('users')->onDelete('set null');
            
            // Index
            $table->index('role');
            $table->index(['role', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['added_by']);
            $table->dropIndex(['users_role_index']);
            $table->dropIndex(['users_role_is_active_index']);
            $table->dropColumn([
                'role',
                'department',
                'is_active',
                'phone_number',
                'added_by'
            ]);
        });
    }
};

