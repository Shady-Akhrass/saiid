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
            $table->unsignedBigInteger('surplus_category_id')->nullable()->after('surplus_recorded_by');
            
            // Foreign key
            $table->foreign('surplus_category_id')->references('id')->on('surplus_categories')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropForeign(['surplus_category_id']);
            $table->dropColumn('surplus_category_id');
        });
    }
};

