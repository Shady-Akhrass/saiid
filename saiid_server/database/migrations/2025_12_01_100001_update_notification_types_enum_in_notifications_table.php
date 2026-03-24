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
        // Modify the enum to include all new notification types
        DB::statement("ALTER TABLE notifications MODIFY COLUMN notification_type ENUM(
            'new_assignment',
            'ready_for_shelter_selection',
            'ready_for_montage',
            'delay_execution',
            'delay_montage',
            'status_change',
            'photographer_assignment',
            'project_created',
            'project_assigned',
            'project_status_changed',
            'shelter_selected',
            'media_updated',
            'daily_phase',
            'project_postponed',
            'project_resumed',
            'project_cancelled',
            'project_transferred_to_execution'
        )");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert to original enum values
        DB::statement("ALTER TABLE notifications MODIFY COLUMN notification_type ENUM(
            'new_assignment',
            'ready_for_shelter_selection',
            'ready_for_montage',
            'delay_execution',
            'delay_montage',
            'status_change',
            'photographer_assignment'
        )");
    }
};

