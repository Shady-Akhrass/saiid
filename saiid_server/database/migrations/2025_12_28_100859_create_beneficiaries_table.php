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
        Schema::create('beneficiaries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_proposal_id');
            $table->string('name')->comment('اسم المستفيد');
            $table->string('id_number')->comment('رقم الهوية');
            $table->string('phone')->nullable()->comment('رقم الهاتف');
            $table->text('address')->nullable()->comment('العنوان');
            $table->string('governorate')->nullable()->comment('المحافظة');
            $table->string('district')->nullable()->comment('المنطقة');
            $table->string('aid_type')->nullable()->comment('نوع المساعدة - يُملأ تلقائياً من subcategory');
            $table->text('notes')->nullable()->comment('ملاحظات');
            $table->timestamps();

            // Foreign key
            $table->foreign('project_proposal_id')
                  ->references('id')
                  ->on('project_proposals')
                  ->onDelete('cascade');

            // Indexes
            $table->index('id_number', 'idx_beneficiaries_id_number');
            $table->index('aid_type', 'idx_beneficiaries_aid_type');
            $table->index('project_proposal_id', 'idx_beneficiaries_project_proposal_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('beneficiaries');
    }
};
