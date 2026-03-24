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
        Schema::table('projects', function (Blueprint $table) {
            $table->unsignedBigInteger('source_project_id')->nullable()->after('id');
            $table->foreign('source_project_id')
                  ->references('id')
                  ->on('project_proposals')
                  ->onDelete('set null');
            $table->index('source_project_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropForeign(['source_project_id']);
            $table->dropIndex(['source_project_id']);
            $table->dropColumn('source_project_id');
        });
    }
};

