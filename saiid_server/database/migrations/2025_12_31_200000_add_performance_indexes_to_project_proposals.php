<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * ✅ إضافة indexes لتحسين أداء الاستعلامات
     */
    public function up(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            // ✅ Indexes للـ status (الأكثر استخداماً في الفلترة)
            if (!$this->indexExists('project_proposals', 'project_proposals_status_index')) {
                $table->index('status', 'project_proposals_status_index');
            }
            
            // ✅ Indexes للـ project_type
            if (!$this->indexExists('project_proposals', 'project_proposals_project_type_index')) {
                $table->index('project_type', 'project_proposals_project_type_index');
            }
            
            // ✅ Composite index للـ status و project_type (الأكثر استخداماً معاً)
            if (!$this->indexExists('project_proposals', 'project_proposals_status_type_index')) {
                $table->index(['status', 'project_type'], 'project_proposals_status_type_index');
            }
            
            // ✅ Indexes للـ assigned_researcher_id
            if (!$this->indexExists('project_proposals', 'project_proposals_assigned_researcher_id_index')) {
                $table->index('assigned_researcher_id', 'project_proposals_assigned_researcher_id_index');
            }
            
            // ✅ Indexes للـ assigned_photographer_id
            if (!$this->indexExists('project_proposals', 'project_proposals_assigned_photographer_id_index')) {
                $table->index('assigned_photographer_id', 'project_proposals_assigned_photographer_id_index');
            }
            
            // ✅ Indexes للـ assigned_to_team_id
            if (!$this->indexExists('project_proposals', 'project_proposals_assigned_to_team_id_index')) {
                $table->index('assigned_to_team_id', 'project_proposals_assigned_to_team_id_index');
            }
            
            // ✅ Indexes للـ shelter_id
            if (!$this->indexExists('project_proposals', 'project_proposals_shelter_id_index')) {
                $table->index('shelter_id', 'project_proposals_shelter_id_index');
            }
            
            // ✅ Indexes للـ parent_project_id
            if (!$this->indexExists('project_proposals', 'project_proposals_parent_project_id_index')) {
                $table->index('parent_project_id', 'project_proposals_parent_project_id_index');
            }
            
            // ✅ Indexes للـ created_at (للترتيب)
            if (!$this->indexExists('project_proposals', 'project_proposals_created_at_index')) {
                $table->index('created_at', 'project_proposals_created_at_index');
            }
            
            // ✅ Indexes للـ execution_date
            if (!$this->indexExists('project_proposals', 'project_proposals_execution_date_index')) {
                $table->index('execution_date', 'project_proposals_execution_date_index');
            }
            
            // ✅ Composite index للـ is_divided_into_phases و is_daily_phase و is_monthly_phase
            if (!$this->indexExists('project_proposals', 'project_proposals_phases_index')) {
                $table->index(['is_divided_into_phases', 'is_daily_phase', 'is_monthly_phase'], 'project_proposals_phases_index');
            }
            
            // ✅ Composite index للـ status و assigned_researcher_id (للمشاريع المسندة)
            if (!$this->indexExists('project_proposals', 'project_proposals_status_researcher_index')) {
                $table->index(['status', 'assigned_researcher_id'], 'project_proposals_status_researcher_index');
            }
            
            // ✅ Composite index للـ status و assigned_photographer_id (للمشاريع مع مصور)
            if (!$this->indexExists('project_proposals', 'project_proposals_status_photographer_index')) {
                $table->index(['status', 'assigned_photographer_id'], 'project_proposals_status_photographer_index');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropIndex('project_proposals_status_index');
            $table->dropIndex('project_proposals_project_type_index');
            $table->dropIndex('project_proposals_status_type_index');
            $table->dropIndex('project_proposals_assigned_researcher_id_index');
            $table->dropIndex('project_proposals_assigned_photographer_id_index');
            $table->dropIndex('project_proposals_assigned_to_team_id_index');
            $table->dropIndex('project_proposals_shelter_id_index');
            $table->dropIndex('project_proposals_parent_project_id_index');
            $table->dropIndex('project_proposals_created_at_index');
            $table->dropIndex('project_proposals_execution_date_index');
            $table->dropIndex('project_proposals_phases_index');
            $table->dropIndex('project_proposals_status_researcher_index');
            $table->dropIndex('project_proposals_status_photographer_index');
        });
    }
    
    /**
     * Check if index exists
     */
    private function indexExists(string $table, string $indexName): bool
    {
        $connection = Schema::getConnection();
        $databaseName = $connection->getDatabaseName();
        
        $result = DB::select(
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

