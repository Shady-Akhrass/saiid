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
        if (!Schema::hasTable('visitors')) {
            return;
        }

        if (!Schema::hasColumn('visitors', 'shelter_visitors')) {
            Schema::table('visitors', function (Blueprint $table) {
                $table->unsignedBigInteger('shelter_visitors')->default(0)->after('student_visitors');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('visitors')) {
            return;
        }

        if (Schema::hasColumn('visitors', 'shelter_visitors')) {
            Schema::table('visitors', function (Blueprint $table) {
                $table->dropColumn('shelter_visitors');
            });
        }
    }
};

