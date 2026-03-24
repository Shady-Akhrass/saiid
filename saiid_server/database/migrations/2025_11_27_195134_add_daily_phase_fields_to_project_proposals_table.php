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
            $table->unsignedBigInteger('parent_project_id')->nullable()->after('project_id');
            $table->integer('phase_day')->nullable()->after('parent_project_id');
            $table->boolean('is_daily_phase')->default(false)->after('phase_day');
            
            $table->foreign('parent_project_id')->references('id')->on('project_proposals')->onDelete('cascade');
            $table->index(['parent_project_id', 'phase_day']);
            $table->index('is_daily_phase');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropForeign(['parent_project_id']);
            $table->dropIndex(['parent_project_id', 'phase_day']);
            $table->dropIndex(['is_daily_phase']);
            $table->dropColumn(['parent_project_id', 'phase_day', 'is_daily_phase']);
        });
    }
};
