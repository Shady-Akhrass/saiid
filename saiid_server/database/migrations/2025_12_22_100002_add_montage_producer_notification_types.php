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
        // إضافة أنواع إشعارات ممنتجي المونتاج الجديدة
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
            'project_transferred_to_execution',
            'media_completed',
            'media_rejected',
            'media_accepted',
            'supply_started',
            'supply_confirmed',
            'low_stock',
            'project_deficit',
            'shekel_converted',
            'montage_producer_assigned',
            'montage_completed_by_producer',
            'montage_approved_by_manager'
        )");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
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
            'project_transferred_to_execution',
            'media_completed',
            'media_rejected',
            'media_accepted',
            'supply_started',
            'supply_confirmed',
            'low_stock',
            'project_deficit',
            'shekel_converted'
        )");
    }
};
