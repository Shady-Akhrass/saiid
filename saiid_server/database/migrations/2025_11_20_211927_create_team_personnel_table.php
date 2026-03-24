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
        Schema::create('team_personnel', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone_number', 10)->unique();
            $table->enum('personnel_type', ['باحث', 'مصور']);
            $table->string('department')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            // Indexes
            $table->index('personnel_type');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('team_personnel');
    }
};
