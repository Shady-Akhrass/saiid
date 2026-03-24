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
        if (Schema::hasTable('visitors')) {
            return; // الجدول موجود بالفعل، تخطي الإنشاء
        }
        
        Schema::create('visitors', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('orphan_visitors')->default(0);
            $table->unsignedBigInteger('aid_visitors')->default(0);
            $table->unsignedBigInteger('teacher_visitors')->default(0);
            $table->unsignedBigInteger('student_visitors')->default(0);
            $table->timestamps();
        });
    }


    public function down(): void
    {
        Schema::dropIfExists('visitors');
    }
};
