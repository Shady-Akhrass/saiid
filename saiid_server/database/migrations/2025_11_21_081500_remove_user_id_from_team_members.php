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
        if (!Schema::hasTable('team_members')) {
            return;
        }

        Schema::table('team_members', function (Blueprint $table) {
            if (Schema::hasColumn('team_members', 'user_id')) {
                // Drop FK if exists
                $foreignKeys = $this->getForeignKeys('team_members');
                if (in_array('team_members_user_id_foreign', $foreignKeys, true)) {
                    $table->dropForeign('team_members_user_id_foreign');
                }

                $table->dropColumn('user_id');
            }

            if (!Schema::hasColumn('team_members', 'personnel_id')) {
                $table->unsignedBigInteger('personnel_id')->after('team_id');
                $table->foreign('personnel_id')
                      ->references('id')
                      ->on('team_personnel')
                      ->cascadeOnDelete();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('team_members')) {
            return;
        }

        Schema::table('team_members', function (Blueprint $table) {
            if (!Schema::hasColumn('team_members', 'user_id')) {
                $table->unsignedBigInteger('user_id')->nullable()->after('team_id');
                $table->foreign('user_id')
                      ->references('id')
                      ->on('users')
                      ->nullOnDelete();
            }
        });
    }

    private function getForeignKeys(string $table): array
    {
        $connection = config('database.default');
        $databaseName = config("database.connections.$connection.database");

        return DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('TABLE_SCHEMA', $databaseName)
            ->where('TABLE_NAME', $table)
            ->whereNotNull('CONSTRAINT_NAME')
            ->pluck('CONSTRAINT_NAME')
            ->toArray();
    }
};

