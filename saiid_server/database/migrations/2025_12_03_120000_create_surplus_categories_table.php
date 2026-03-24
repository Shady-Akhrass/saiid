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
        Schema::create('surplus_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // اسم القسم (مثل: التكية الخيرية، السقيا)
            $table->text('description')->nullable(); // وصف القسم
            $table->boolean('is_active')->default(true); // تفعيل/تعطيل
            $table->unsignedBigInteger('created_by'); // من أنشأ القسم
            $table->timestamps();
            
            // Foreign key
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('surplus_categories');
    }
};

