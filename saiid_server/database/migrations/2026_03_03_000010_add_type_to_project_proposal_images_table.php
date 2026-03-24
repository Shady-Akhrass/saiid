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
        // Ensure table exists before applying changes
        if (!Schema::hasTable('project_proposal_images')) {
            return;
        }

        // Add type column and indexes if not already present
        if (!Schema::hasColumn('project_proposal_images', 'type')) {
            Schema::table('project_proposal_images', function (Blueprint $table) {
                $table->string('type', 20)
                    ->default('project')
                    ->after('image_path');

                // Composite index to speed up per-project, per-type queries
                $table->index(
                    ['project_proposal_id', 'type'],
                    'project_proposal_images_project_id_type_index'
                );

                // Optional index on type alone for future reporting/queries
                $table->index('type');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('project_proposal_images')) {
            return;
        }

        if (Schema::hasColumn('project_proposal_images', 'type')) {
            Schema::table('project_proposal_images', function (Blueprint $table) {
                // Drop custom composite index if it exists
                try {
                    $table->dropIndex('project_proposal_images_project_id_type_index');
                } catch (\Throwable $e) {
                    // Ignore if index does not exist
                }

                // Drop simple index on type if it exists
                try {
                    $table->dropIndex(['type']);
                } catch (\Throwable $e) {
                    // Ignore if index does not exist
                }

                $table->dropColumn('type');
            });
        }
    }
};

