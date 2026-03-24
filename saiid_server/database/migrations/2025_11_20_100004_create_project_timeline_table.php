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
        Schema::create('project_timeline', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id');
            $table->string('old_status')->nullable(); // الحالة القديمة
            $table->string('new_status'); // الحالة الجديدة
            $table->unsignedBigInteger('changed_by'); // المستخدم الذي غيّر الحالة
            $table->text('notes')->nullable(); // ملاحظات على التغيير
            $table->timestamp('created_at');

            // Foreign keys
            $table->foreign('project_id')->references('id')->on('project_proposals')->onDelete('cascade');
            $table->foreign('changed_by')->references('id')->on('users')->onDelete('restrict');
            
            // Indexes
            $table->index('project_id');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_timeline');
    }
};

