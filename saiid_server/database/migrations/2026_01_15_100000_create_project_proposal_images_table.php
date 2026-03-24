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
        Schema::create('project_proposal_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_proposal_id')->constrained('project_proposals')->onDelete('cascade');
            $table->string('image_path');
            $table->integer('display_order')->default(0); // ترتيب عرض الصور
            $table->timestamps();
            
            // Indexes for better performance
            $table->index('project_proposal_id');
            $table->index('display_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_proposal_images');
    }
};
