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
            // Ensure personnel_id column exists and is required
            if (!Schema::hasColumn('team_members', 'personnel_id')) {
                $table->unsignedBigInteger('personnel_id')->after('team_id');
                $table->foreign('personnel_id')
                      ->references('id')
                      ->on('team_personnel')
                      ->cascadeOnDelete();
            } else {
                // Make sure foreign key is aligned with team_personnel table
                if ($this->hasForeignKey('team_members', 'team_members_personnel_id_foreign')) {
                    $table->dropForeign('team_members_personnel_id_foreign');
                }
                $table->foreign('personnel_id')
                      ->references('id')
                      ->on('team_personnel')
                      ->cascadeOnDelete();
            }

            // Drop legacy user_id column if it still exists
            if (Schema::hasColumn('team_members', 'user_id')) {
                if ($this->hasForeignKey('team_members', 'team_members_user_id_foreign')) {
                    $table->dropForeign('team_members_user_id_foreign');
                }
                $table->dropColumn('user_id');
            }

            // Enforce uniqueness per team/personnel pair
            if ($this->hasIndex('team_members', 'team_members_team_id_user_id_unique')) {
                $table->dropUnique('team_members_team_id_user_id_unique');
            }

            if ($this->hasIndex('team_members', 'team_members_team_id_personnel_id_unique')) {
                $table->dropUnique('team_members_team_id_personnel_id_unique');
            }

            $table->unique(['team_id', 'personnel_id'], 'team_members_team_id_personnel_id_unique');
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
            // Remove new unique constraint
            if ($this->hasIndex('team_members', 'team_members_team_id_personnel_id_unique')) {
                $table->dropUnique('team_members_team_id_personnel_id_unique');
            }

            // Recreate user_id for rollback scenarios
            if (!Schema::hasColumn('team_members', 'user_id')) {
                $table->unsignedBigInteger('user_id')->nullable()->after('team_id');
                $table->foreign('user_id')
                      ->references('id')
                      ->on('users')
                      ->nullOnDelete();
            }

            // Drop personnel_id column if needed
            if (Schema::hasColumn('team_members', 'personnel_id')) {
                if ($this->hasForeignKey('team_members', 'team_members_personnel_id_foreign')) {
                    $table->dropForeign('team_members_personnel_id_foreign');
                }
                $table->dropColumn('personnel_id');
            }
        });
    }

    private function hasForeignKey(string $table, string $keyName): bool
    {
        $databaseName = DB::getDatabaseName();

        return DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('TABLE_SCHEMA', $databaseName)
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $keyName)
            ->exists();
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $databaseName = DB::getDatabaseName();

        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', $databaseName)
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $indexName)
            ->exists();
    }
};

