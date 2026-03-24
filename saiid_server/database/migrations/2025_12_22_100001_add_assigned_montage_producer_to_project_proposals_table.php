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
            $table->unsignedBigInteger('assigned_montage_producer_id')->nullable()->after('assigned_photographer_id');
            $table->timestamp('montage_producer_assigned_at')->nullable()->after('assigned_montage_producer_id');
            $table->timestamp('montage_completed_at')->nullable()->after('montage_producer_assigned_at');
            
            // Foreign key
            $table->foreign('assigned_montage_producer_id')
                  ->references('id')
                  ->on('users')
                  ->onDelete('set null');
            
            // Indexes للبحث السريع
            $table->index('assigned_montage_producer_id');
            $table->index(['assigned_montage_producer_id', 'status']);
            $table->index('montage_producer_assigned_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropForeign(['assigned_montage_producer_id']);
            $table->dropIndex(['project_proposals_assigned_montage_producer_id_index']);
            $table->dropIndex(['project_proposals_assigned_montage_producer_id_status_index']);
            $table->dropIndex(['project_proposals_montage_producer_assigned_at_index']);
            $table->dropColumn([
                'assigned_montage_producer_id',
                'montage_producer_assigned_at',
                'montage_completed_at'
            ]);
        });
    }
};
