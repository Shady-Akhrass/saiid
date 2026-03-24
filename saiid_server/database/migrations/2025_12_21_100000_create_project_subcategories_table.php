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
        Schema::create('project_subcategories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable()->comment('اسم التفرعية بالإنجليزية');
            $table->string('name_ar')->comment('اسم التفرعية بالعربية');
            $table->enum('project_type', ['إغاثي', 'تنموي', 'طبي', 'تعليمي'])->comment('نوع المشروع');
            $table->text('description')->nullable()->comment('وصف التفرعية');
            $table->boolean('is_active')->default(true)->comment('تفعيل/تعطيل');
            $table->timestamps();
            
            // Indexes
            $table->index('project_type', 'idx_project_type');
            $table->index('is_active', 'idx_is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_subcategories');
    }
};

