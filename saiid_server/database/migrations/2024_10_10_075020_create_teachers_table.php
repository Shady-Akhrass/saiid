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
        if (Schema::hasTable('teachers')) {
            return;
        }
        
        Schema::create('teachers', function (Blueprint $table) {
            $table->string('id_number')->primary();
            $table->string('name');
            $table->date('birth_date');
            $table->enum('gender', ['ذكر', 'أنثى']);
            $table->enum('university_major', ['صف', 'رياضيات', 'عربي', 'انجليزي', 'علوم']);
            $table->enum('marital_status', ['متزوج', 'أرمل', 'مطلق', 'أعزب']);
            $table->text('address_details');
            $table->string('guardian_phone_number');
            $table->string('alternative_phone_number');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('teachers');
    }
};
