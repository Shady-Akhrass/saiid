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
            $table->unsignedBigInteger('subcategory_id')->nullable()->after('project_type')->comment('التفرعية');
            $table->unsignedInteger('beneficiaries_count')->nullable()->default(0)->after('quantity')->comment('عدد المستفيدين (يدوي)');
            $table->unsignedInteger('beneficiaries_per_unit')->nullable()->default(0)->after('beneficiaries_count')->comment('عدد المستفيدين لكل طرد (لحساب تلقائي)');
            
            // Foreign key
            $table->foreign('subcategory_id', 'fk_project_subcategory')
                  ->references('id')
                  ->on('project_subcategories')
                  ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropForeign('fk_project_subcategory');
            $table->dropColumn(['subcategory_id', 'beneficiaries_count', 'beneficiaries_per_unit']);
        });
    }
};

