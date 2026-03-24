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
            // إضافة عمود is_urgent (عاجل)
            if (!Schema::hasColumn('project_proposals', 'is_urgent')) {
                $table->boolean('is_urgent')->default(false)->after('status');
                $table->index('is_urgent');
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

        Schema::table('project_proposals', function (Blueprint $table) {
            if (Schema::hasColumn('project_proposals', 'is_urgent')) {
                $table->dropIndex(['is_urgent']);
                $table->dropColumn('is_urgent');
            }
        });
    }
};
