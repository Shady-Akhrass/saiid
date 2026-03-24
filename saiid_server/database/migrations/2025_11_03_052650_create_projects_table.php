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
        if (Schema::hasTable('projects')) {
            return;
        }
        
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('project_name');
            $table->string('aid_type');
            $table->integer('quantity');
            $table->string('shelter_id'); // FK to shelters.manager_id_number
            $table->date('execution_date');
            $table->enum('status', ['مكتمل', 'غير مكتمل'])->default('غير مكتمل');
            $table->timestamps();
            
            // Foreign key constraint
            $table->foreign('shelter_id')->references('manager_id_number')->on('shelters')->onDelete('cascade');
            // Index for faster queries
            $table->index(['shelter_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
