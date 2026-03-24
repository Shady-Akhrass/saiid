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
        Schema::create('project_phase_notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id');
            $table->date('notification_date');
            $table->integer('phase_day');
            $table->decimal('daily_amount', 15, 2);
            $table->timestamps();

            $table->foreign('project_id')->references('id')->on('project_proposals')->onDelete('cascade');
            $table->unique(['project_id', 'notification_date']);
            $table->index('notification_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_phase_notifications');
    }
};
