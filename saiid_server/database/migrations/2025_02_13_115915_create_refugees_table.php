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
        if (Schema::hasTable('refugees')) {
            return;
        }
        
        Schema::create('refugees', function (Blueprint $table) {
            // Family members count
            $table->string('manager_id_number');
            $table->foreign('manager_id_number')->references('manager_id_number')->on('shelters');
            $table->string('husband_id_number')->primary();
            $table->integer('male_family_members');
            $table->integer('female_family_members');
            $table->integer('children_under_2_years');
            $table->integer('children_2_to_6_years');
            $table->integer('children_6_to_18_years');
            $table->integer('elderly_above_60');
            $table->integer('pregnant_women');
            $table->integer('nursing_women');
            $table->string('husband_name');
            $table->string('wife_name');
            $table->string('wife_id_number')->unique();
            $table->enum('governorate', ['محافظة الشمال', 'محافظة غزة', 'محافظة الوسطى', 'محافظة خانيونس', 'محافظة رفح']);
            $table->string('district');
            $table->text('detailed_address');
            $table->string('phone_number', 50);
            $table->string('alternative_phone_number', 50)->nullable();
            // Special cases
            $table->integer('special_cases_count');
            $table->enum('special_case_gender', ['ذكر', 'أنثى'])->nullable();
            $table->integer('special_case_age')->nullable();
            $table->string('special_case_type')->nullable();
            $table->string('disease_type')->nullable();
            $table->string('needs_type')->nullable();
            $table->text('additional_details')->nullable();


            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('refugees');
    }
};
