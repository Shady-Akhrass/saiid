<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orphan_grouping_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grouping_id')->constrained('orphan_groupings')->onDelete('cascade');
            $table->string('orphan_id', 50); // Using string for orphan_id_number
            $table->enum('status', ['active', 'inactive', 'graduated'])->default('active');
            $table->timestamp('joined_at')->default(now());
            $table->timestamp('left_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Add foreign key constraint for orphan
            $table->foreign('orphan_id')->references('orphan_id_number')->on('orphans')->onDelete('cascade');

            // Prevent duplicate entries
            $table->unique(['grouping_id', 'orphan_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orphan_grouping_members');
    }
};
