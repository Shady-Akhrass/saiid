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
        if (Schema::hasTable('patients')) {
            return;
        }
        
        Schema::create('patients', function (Blueprint $table) {
            $table->string('id_number')->primary();
            $table->string('name');
            $table->date('birth_date');
            $table->enum('gender', ['ذكر', 'أنثى']);
            $table->enum('health_status', ['مريض', 'جيدة']);
            $table->text('disease_description')->nullable();
            $table->enum('marital_status', ['متزوج', 'أرمل', 'مطلق', 'أعزب']);
            $table->integer('number_of_brothers')->nullable();
            $table->integer('number_of_sisters')->nullable();
            $table->enum('current_address', ['محافظة رفح', 'محافظة خانيونس', 'محافظة الوسطى', 'محافظة غزة', 'محافظة الشمال']);
            $table->string('guardian_phone_number');
            $table->string('alternative_phone_number');
            $table->string('data_approval_name');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
