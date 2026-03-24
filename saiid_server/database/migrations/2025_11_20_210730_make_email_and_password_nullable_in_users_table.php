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
        Schema::table('users', function (Blueprint $table) {
            // إزالة unique constraint من email أولاً
            $table->dropUnique(['email']);
            
            // جعل email nullable
            $table->string('email')->nullable()->change();
            
            // إضافة unique constraint مرة أخرى (لكن nullable)
            $table->unique('email');
            
            // جعل password nullable
            $table->string('password')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // إزالة unique constraint
            $table->dropUnique(['email']);
            
            // إرجاع email إلى required
            $table->string('email')->nullable(false)->change();
            
            // إضافة unique constraint مرة أخرى
            $table->unique('email');
            
            // إرجاع password إلى required
            $table->string('password')->nullable(false)->change();
        });
    }
};
