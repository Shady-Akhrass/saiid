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
        Schema::table('notifications', function (Blueprint $table) {
            $table->unsignedBigInteger('related_project_id')->nullable()->after('project_id');
            $table->json('metadata')->nullable()->after('priority');
            
            // Add foreign key for related_project_id
            $table->foreign('related_project_id')->references('id')->on('project_proposals')->onDelete('cascade');
            
            // Add index for related_project_id
            $table->index('related_project_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropForeign(['related_project_id']);
            $table->dropIndex(['related_project_id']);
            $table->dropColumn(['related_project_id', 'metadata']);
        });
    }
};

