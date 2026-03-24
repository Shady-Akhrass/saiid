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
        Schema::create('media_archives', function (Blueprint $table) {
            $table->id();
            
            // Foreign Key للمشروع المنفذ
            $table->unsignedBigInteger('project_proposal_id');
            
            // نوع الأرشيف
            $table->enum('archive_type', ['before_montage', 'after_montage']);
            
            // مسار الملفات على الهارد المحلي
            $table->text('local_path');
            
            // ملاحظات
            $table->text('notes')->nullable();
            
            // المستخدم الذي أرشف
            $table->unsignedBigInteger('archived_by');
            $table->timestamp('archived_at')->useCurrent();
            
            // معلومات تفصيلية (للبحث السريع)
            $table->string('project_name');
            $table->string('serial_number');
            $table->string('donor_name');
            $table->enum('project_type', ['إغاثي', 'تنموي', 'طبي', 'تعليمي']);
            $table->string('team_name')->nullable();
            $table->string('photographer_name')->nullable();
            $table->date('execution_date')->nullable();
            
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('project_proposal_id')->references('id')->on('project_proposals')->onDelete('cascade');
            $table->foreign('archived_by')->references('id')->on('users')->onDelete('restrict');
            
            // Indexes for better performance
            $table->index('project_proposal_id');
            $table->index('archive_type');
            $table->index('serial_number');
            $table->index('project_name');
            $table->index('donor_name');
            $table->index('archived_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('media_archives');
    }
};
