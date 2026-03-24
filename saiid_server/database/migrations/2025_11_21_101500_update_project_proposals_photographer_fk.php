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
        if (!Schema::hasTable('project_proposals')) {
            return;
        }

        Schema::table('project_proposals', function (Blueprint $table) {
            if (Schema::hasColumn('project_proposals', 'assigned_photographer_id')) {
                if ($this->hasForeignKey('project_proposals', 'project_proposals_assigned_photographer_id_foreign')) {
                    $table->dropForeign('project_proposals_assigned_photographer_id_foreign');
                }

                $table->foreign('assigned_photographer_id')
                      ->references('id')
                      ->on('team_personnel')
                      ->nullOnDelete();
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
            if (Schema::hasColumn('project_proposals', 'assigned_photographer_id')) {
                if ($this->hasForeignKey('project_proposals', 'project_proposals_assigned_photographer_id_foreign')) {
                    $table->dropForeign('project_proposals_assigned_photographer_id_foreign');
                }

                $table->foreign('assigned_photographer_id')
                      ->references('id')
                      ->on('users')
                      ->nullOnDelete();
            }
        });
    }

    private function hasForeignKey(string $table, string $keyName): bool
    {
        $connection = config('database.default');
        $databaseName = config("database.connections.$connection.database");

        return DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('TABLE_SCHEMA', $databaseName)
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $keyName)
            ->exists();
    }
};

