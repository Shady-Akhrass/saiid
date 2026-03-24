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
        // إضافة sponsorship_supply_confirmed إلى enum
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
            'montage_approved_by_manager',
            'researcher_assigned',
            'photographer_assigned',
            'missing_beneficiaries_file',
            'sponsorship_supply_confirmed'
        )");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // إزالة sponsorship_supply_confirmed من enum
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
            'montage_approved_by_manager',
            'researcher_assigned',
            'photographer_assigned',
            'missing_beneficiaries_file'
        )");
    }
};
