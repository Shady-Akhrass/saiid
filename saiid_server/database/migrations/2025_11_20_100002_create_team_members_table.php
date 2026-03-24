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
        Schema::create('team_members', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('team_id');
            $table->unsignedBigInteger('user_id');
            $table->enum('role_in_team', ['قائد', 'عضو', 'منسق'])->default('عضو');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Foreign keys
            $table->foreign('team_id')->references('id')->on('teams')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            
            // Unique constraint لمنع تكرار نفس المستخدم في نفس الفريق
            $table->unique(['team_id', 'user_id']);
            
            // Indexes
            $table->index('team_id');
            $table->index('user_id');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('team_members');
    }
};

