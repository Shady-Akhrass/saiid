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
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id'); // المستلم
            $table->unsignedBigInteger('project_id')->nullable(); // المشروع المرتبط
            $table->enum('notification_type', [
                'new_assignment',
                'ready_for_shelter_selection',
                'ready_for_montage',
                'delay_execution',
                'delay_montage',
                'status_change',
                'photographer_assignment'
            ]);
            $table->string('title'); // عنوان التنبيه
            $table->text('message'); // رسالة التنبيه
            $table->boolean('is_read')->default(false); // مقروء أم لا
            $table->enum('priority', ['low', 'medium', 'high'])->default('medium'); // الأولوية
            $table->timestamps();

            // Foreign keys
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('project_id')->references('id')->on('project_proposals')->onDelete('cascade');
            
            // Indexes
            $table->index('user_id');
            $table->index('is_read');
            $table->index(['user_id', 'is_read']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};

