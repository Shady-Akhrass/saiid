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
        // تحديث enum الأدوار لإضافة supervision
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM(
            'admin',
            'project_manager',
            'media_manager',
            'executed_projects_coordinator',
            'executor',
            'photographer',
            'warehouse_manager',
            'montage_producer',
            'orphan_sponsor_coordinator',
            'supervision'
        ) NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // إرجاع enum الأدوار للحالة السابقة
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM(
            'admin',
            'project_manager',
            'media_manager',
            'executed_projects_coordinator',
            'executor',
            'photographer',
            'warehouse_manager',
            'montage_producer',
            'orphan_sponsor_coordinator'
        ) NULL");
    }
};
