<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * SQL Script Explanation:
     * 
     * This migration creates a comprehensive orphan groupings system with:
     * - Independent table for groups (not a view)
     * - Group naming and capacity management
     * - Smart selection criteria (orphans status, health, memorization)
     * - Location-based filtering (governorate, district)
     * - Exclusion of adopted orphans
     * - Fuzzy search capabilities
     * 
     * Tables Created:
     * 1. orphan_groupings - Main groups table
     * 2. orphan_grouping_members - Many-to-many relationship
     * 
     * Features:
     * - Group capacity limits
     * - Selection criteria (death status, health conditions, memorization)
     * - Location filtering
     * - Smart selection algorithms
     * - Exclusion rules (adopted orphans)
     */
    public function up(): void
    {
        // Main orphan groupings table
        Schema::create('orphan_groupings', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255)->comment('Group name for identification');
            $table->text('description')->nullable()->comment('Group description and purpose');
            $table->integer('max_capacity')->default(50)->comment('Maximum number of orphans allowed in this group');
            $table->integer('current_count')->default(0)->comment('Current number of orphans in the group');
            
            // Selection criteria for smart grouping
            $table->json('selection_criteria')->nullable()->comment('JSON object containing selection criteria');
            /*
             * Selection criteria structure:
             * {
             *     "mother_status": ["deceased", "alive"], // Filter by mother status
             *     "father_status": ["deceased", "alive"], // Filter by father status
             *     "health_conditions": ["healthy", "sick", "chronic_ill"], // Health status filter
             *     "in_memorization": true/false, // Whether to include memorization students
             *     "age_range": {
             *         "min": 5,
             *         "max": 15
             *     }, // Age range filter
             *     "gender": ["male", "female", "both"] // Gender filter
             * }
             */
            
            // Location filtering
            $table->string('governorate_filter')->nullable()->comment('Filter by governorate (null for all)');
            $table->string('district_filter')->nullable()->comment('Filter by district (null for all)');
            
            // Exclusion rules
            $table->boolean('exclude_adopted')->default(true)->comment('Exclude adopted orphans from selection');
            $table->text('exclusion_notes')->nullable()->comment('Notes on exclusion criteria');
            
            // Group status and metadata
            $table->enum('status', ['active', 'inactive', 'full', 'archived'])->default('active');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->unsignedBigInteger('created_by')->nullable()->comment('Admin who created the group');
            $table->unsignedBigInteger('updated_by')->nullable()->comment('Admin who last updated the group');
            
            // Indexes for performance
            $table->index(['status', 'governorate_filter', 'district_filter']);
            $table->index(['created_at']);
        });

        // Many-to-many relationship table for group members
        Schema::create('orphan_grouping_members', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('grouping_id')->comment('Reference to orphan_groupings table');
            $table->string('orphan_id')->comment('Reference to orphans table (orphan_id_number)');
            
            // Membership details
            $table->enum('status', ['active', 'inactive', 'transferred', 'graduated'])->default('active');
            $table->timestamp('joined_at')->useCurrent()->comment('When the orphan joined the group');
            $table->timestamp('left_at')->nullable()->comment('When the orphan left the group');
            $table->text('notes')->nullable()->comment('Notes about this membership');
            
            // Foreign keys
            $table->foreign('grouping_id')->references('id')->on('orphan_groupings')->onDelete('cascade');
            $table->foreign('orphan_id')->references('orphan_id_number')->on('orphans')->onDelete('cascade');
            
            // Unique constraint to prevent duplicate memberships
            $table->unique(['grouping_id', 'orphan_id'], 'unique_group_membership');
            
            // Indexes for performance
            $table->index(['grouping_id', 'status']);
            $table->index(['orphan_id']);
            $table->index(['joined_at']);
        });

        // Add indexes to orphans table for better search performance
        Schema::table('orphans', function (Blueprint $table) {
            // Add fuzzy search indexes
            $table->index(['orphan_full_name'], 'orphan_name_index');
            $table->index(['current_address'], 'orphan_address_index');
            
            // Add status indexes for filtering
            $table->index(['is_mother_deceased', 'mother_status'], 'orphan_parent_status_index');
            $table->index(['health_status'], 'orphan_health_index');
            $table->index(['orphan_gender', 'orphan_birth_date'], 'orphan_demographics_index');
            $table->index(['current_address'], 'orphan_location_index');
            $table->index(['is_enrolled_in_memorization_center'], 'orphan_memorization_index');
        });
    }

    /**
     * Reverse the migrations.
     *
     * SQL Script Explanation:
     * 
     * This will remove all the created tables and indexes
     * in reverse order of creation to avoid foreign key conflicts.
     */
    public function down(): void
    {
        // Drop the relationship table first (foreign key dependency)
        Schema::dropIfExists('orphan_grouping_members');
        
        // Drop the main groupings table
        Schema::dropIfExists('orphan_groupings');
        
        // Remove the added indexes from orphans table
        Schema::table('orphans', function (Blueprint $table) {
            $table->dropIndex('orphan_name_index');
            $table->dropIndex('orphan_address_index');
            $table->dropIndex('orphan_parent_status_index');
            $table->dropIndex('orphan_health_index');
            $table->dropIndex('orphan_demographics_index');
            $table->dropIndex('orphan_location_index');
        });
    }
};
