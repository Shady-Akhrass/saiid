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
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->string('team_name');
            $table->unsignedBigInteger('team_leader_id')->nullable();
            $table->enum('team_type', ['إغاثة', 'مشاريع تنموية', 'صحة', 'تعليم'])->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Foreign key
            $table->foreign('team_leader_id')->references('id')->on('users')->onDelete('set null');
            
            // Index
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('teams');
    }
};

