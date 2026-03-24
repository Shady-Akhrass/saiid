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
        // Add indexes to orphans table
        Schema::table('orphans', function (Blueprint $table) {
            if (!$this->hasIndex('orphans', 'orphans_created_at_index')) {
                $table->index('created_at');
            }
            if (!$this->hasIndex('orphans', 'orphans_health_status_index')) {
                $table->index('health_status');
            }
            if (!$this->hasIndex('orphans', 'orphans_original_address_index')) {
                $table->index('original_address');
            }
            if (!$this->hasIndex('orphans', 'orphans_current_address_index')) {
                $table->index('current_address');
            }
            if (!$this->hasIndex('orphans', 'orphans_mother_status_index')) {
                $table->index('mother_status');
            }
            // Composite index for common search combinations
            if (!$this->hasIndex('orphans', 'orphans_search_index')) {
                $table->index(['health_status', 'original_address', 'created_at'], 'orphans_search_index');
            }
        });

        // Add indexes to aids table
        Schema::table('aids', function (Blueprint $table) {
            if (!$this->hasIndex('aids', 'aids_created_at_index')) {
                $table->index('created_at');
            }
            if (!$this->hasIndex('aids', 'aids_health_status_index')) {
                $table->index('health_status');
            }
            if (!$this->hasIndex('aids', 'aids_original_address_index')) {
                $table->index('original_address');
            }
            if (!$this->hasIndex('aids', 'aids_current_address_index')) {
                $table->index('current_address');
            }
            if (!$this->hasIndex('aids', 'aids_aid_index')) {
                $table->index('aid');
            }
            // Composite index for common search combinations
            if (!$this->hasIndex('aids', 'aids_search_index')) {
                $table->index(['health_status', 'current_address', 'created_at'], 'aids_search_index');
            }
        });

        // Add indexes to shelters table
        Schema::table('shelters', function (Blueprint $table) {
            if (!$this->hasIndex('shelters', 'shelters_created_at_index')) {
                $table->index('created_at');
            }
            if (!$this->hasIndex('shelters', 'shelters_governorate_index')) {
                $table->index('governorate');
            }
            if (!$this->hasIndex('shelters', 'shelters_district_index')) {
                $table->index('district');
            }
            // Composite index for common search combinations
            if (!$this->hasIndex('shelters', 'shelters_search_index')) {
                $table->index(['governorate', 'district', 'created_at'], 'shelters_search_index');
            }
        });

        // Add indexes to patients table
        Schema::table('patients', function (Blueprint $table) {
            if (!$this->hasIndex('patients', 'patients_created_at_index')) {
                $table->index('created_at');
            }
            if (!$this->hasIndex('patients', 'patients_health_status_index')) {
                $table->index('health_status');
            }
            if (!$this->hasIndex('patients', 'patients_current_address_index')) {
                $table->index('current_address');
            }
            // Composite index for common search combinations
            if (!$this->hasIndex('patients', 'patients_search_index')) {
                $table->index(['health_status', 'current_address', 'created_at'], 'patients_search_index');
            }
        });

        // Add additional indexes to project_proposals table if not exist
        Schema::table('project_proposals', function (Blueprint $table) {
            if (!$this->hasIndex('project_proposals', 'project_proposals_created_at_index')) {
                $table->index('created_at');
            }
            if (!$this->hasIndex('project_proposals', 'project_proposals_execution_date_index')) {
                $table->index('execution_date');
            }
            // Composite index for common filter combinations
            if (!$this->hasIndex('project_proposals', 'project_proposals_status_type_index')) {
                $table->index(['status', 'project_type'], 'project_proposals_status_type_index');
            }
            // Indexes for surplus queries
            if (!$this->hasIndex('project_proposals', 'project_proposals_surplus_amount_index')) {
                $table->index('surplus_amount');
            }
            if (!$this->hasIndex('project_proposals', 'project_proposals_has_deficit_index')) {
                $table->index('has_deficit');
            }
            if (!$this->hasIndex('project_proposals', 'project_proposals_surplus_recorded_at_index')) {
                $table->index('surplus_recorded_at');
            }
            // Composite index for surplus queries
            if (!$this->hasIndex('project_proposals', 'project_proposals_surplus_composite_index')) {
                $table->index(['surplus_amount', 'has_deficit', 'surplus_recorded_at'], 'project_proposals_surplus_composite_index');
            }
            // Indexes for media queries
            if (!$this->hasIndex('project_proposals', 'project_proposals_media_received_date_index')) {
                $table->index('media_received_date');
            }
            if (!$this->hasIndex('project_proposals', 'project_proposals_montage_start_date_index')) {
                $table->index('montage_start_date');
            }
            // Index for search queries
            if (!$this->hasIndex('project_proposals', 'project_proposals_donor_name_index')) {
                $table->index('donor_name');
            }
            // Composite index for search
            if (!$this->hasIndex('project_proposals', 'project_proposals_search_index')) {
                $table->index(['serial_number', 'project_name', 'donor_name'], 'project_proposals_search_index');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orphans', function (Blueprint $table) {
            $table->dropIndex('orphans_created_at_index');
            $table->dropIndex('orphans_health_status_index');
            $table->dropIndex('orphans_original_address_index');
            $table->dropIndex('orphans_current_address_index');
            $table->dropIndex('orphans_mother_status_index');
            $table->dropIndex('orphans_search_index');
        });

        Schema::table('aids', function (Blueprint $table) {
            $table->dropIndex('aids_created_at_index');
            $table->dropIndex('aids_health_status_index');
            $table->dropIndex('aids_original_address_index');
            $table->dropIndex('aids_current_address_index');
            $table->dropIndex('aids_aid_index');
            $table->dropIndex('aids_search_index');
        });

        Schema::table('shelters', function (Blueprint $table) {
            $table->dropIndex('shelters_created_at_index');
            $table->dropIndex('shelters_governorate_index');
            $table->dropIndex('shelters_district_index');
            $table->dropIndex('shelters_search_index');
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->dropIndex('patients_created_at_index');
            $table->dropIndex('patients_health_status_index');
            $table->dropIndex('patients_current_address_index');
            $table->dropIndex('patients_search_index');
        });

        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropIndex('project_proposals_created_at_index');
            $table->dropIndex('project_proposals_execution_date_index');
            $table->dropIndex('project_proposals_status_type_index');
            $table->dropIndex('project_proposals_surplus_amount_index');
            $table->dropIndex('project_proposals_has_deficit_index');
            $table->dropIndex('project_proposals_surplus_recorded_at_index');
            $table->dropIndex('project_proposals_surplus_composite_index');
            $table->dropIndex('project_proposals_media_received_date_index');
            $table->dropIndex('project_proposals_montage_start_date_index');
            $table->dropIndex('project_proposals_donor_name_index');
            $table->dropIndex('project_proposals_search_index');
        });
    }

    /**
     * Check if an index exists on a table
     */
    private function hasIndex(string $table, string $indexName): bool
    {
        $connection = Schema::getConnection();
        $databaseName = $connection->getDatabaseName();
        
        $result = $connection->select(
            "SELECT COUNT(*) as count 
             FROM information_schema.statistics 
             WHERE table_schema = ? 
             AND table_name = ? 
             AND index_name = ?",
            [$databaseName, $table, $indexName]
        );
        
        return $result[0]->count > 0;
    }
};

