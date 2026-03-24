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
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->boolean('is_divided_into_phases')->default(false)->after('estimated_duration_days');
            $table->integer('phase_duration_days')->nullable()->after('is_divided_into_phases');
            $table->date('phase_start_date')->nullable()->after('phase_duration_days');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropColumn(['is_divided_into_phases', 'phase_duration_days', 'phase_start_date']);
        });
    }
};
