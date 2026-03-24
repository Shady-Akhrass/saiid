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
            if (!Schema::hasColumn('project_proposals', 'internal_code')) {
                $table->string('internal_code', 7)->nullable()->unique()->after('donor_code');
                $table->index('internal_code');
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
            if (Schema::hasColumn('project_proposals', 'internal_code')) {
                $table->dropIndex(['internal_code']);
                $table->dropColumn('internal_code');
            }
        });
    }
};
