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
        Schema::create('orphan_project_proposals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_proposal_id')->comment('المشروع');
            $table->string('orphan_id_number')->comment('رقم هوية اليتيم');
            $table->boolean('is_recurring')->default(false)->comment('يتيم ثابت/متكرر - يُضاف تلقائياً لكل مشروع شهري جديد');
            $table->decimal('sponsorship_amount', 15, 2)->nullable()->comment('مبلغ الكفالة');
            $table->date('sponsorship_start_date')->nullable()->comment('تاريخ بداية الكفالة');
            $table->date('sponsorship_end_date')->nullable()->comment('تاريخ نهاية الكفالة');
            $table->integer('remaining_days')->nullable()->comment('الأيام المتبقية');
            $table->text('notes')->nullable()->comment('ملاحظات');
            $table->timestamps();

            // Foreign keys
            $table->foreign('project_proposal_id')
                  ->references('id')
                  ->on('project_proposals')
                  ->onDelete('cascade');

            $table->foreign('orphan_id_number')
                  ->references('orphan_id_number')
                  ->on('orphans')
                  ->onDelete('cascade');

            // Primary key مركب (منع التكرار)
            $table->unique(['project_proposal_id', 'orphan_id_number'], 'unique_orphan_project');

            // Indexes
            $table->index('project_proposal_id', 'idx_orphan_project_proposal_id');
            $table->index('orphan_id_number', 'idx_orphan_project_orphan_id');
            $table->index('is_recurring', 'idx_orphan_project_is_recurring');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orphan_project_proposals');
    }
};
