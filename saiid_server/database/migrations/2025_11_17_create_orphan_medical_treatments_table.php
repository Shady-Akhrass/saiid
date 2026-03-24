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
        Schema::create('orphan_medical_treatments', function (Blueprint $table) {
            $table->id();
            $table->string('orphan_name');
            $table->string('orphan_id_number');
            $table->string('guardian_name');
            $table->string('guardian_id_number');
            $table->string('guardian_phone_number', 50);
            $table->boolean('currently_in_khan_younis')->default(true);
            $table->enum('treatment_type', [
                'علاج طبيعي',
                'علاج النطق وتأخر الكلام',
                'الصحة النفسية',
                'الأسنان'
            ]);
            $table->enum('physical_therapy_type', [
                'شلل دماغي',
                'تأخر نمو',
                'إصابة حرب',
                'أخرى'
            ])->nullable();
            $table->text('physical_therapy_other_description')->nullable();
            $table->boolean('is_registered_in_orphans')->default(false);
            $table->timestamps();

            // Add unique constraint to prevent duplicate registrations
            $table->unique('orphan_id_number');
            
            // Add index for faster lookups
            $table->index('is_registered_in_orphans');
            $table->index('treatment_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orphan_medical_treatments');
    }
};

