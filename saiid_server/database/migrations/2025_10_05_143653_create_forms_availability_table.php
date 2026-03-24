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
        if (Schema::hasTable('form_availabilities')) {
            return;
        }
        
        Schema::create('form_availabilities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->enum('type', ['orphan', 'patient', 'shelter', 'aids', 'employment'])->unique();
            $table->boolean('is_available')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('form_availabilities');
    }
};
