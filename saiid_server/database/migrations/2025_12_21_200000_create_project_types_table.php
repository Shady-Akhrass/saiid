<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('project_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique()->comment('اسم نوع المشروع');
            $table->timestamps();
        });

        // إضافة البيانات الأولية
        DB::table('project_types')->insert([
            ['name' => 'إغاثي', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'تنموي', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'طبي', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'تعليمي', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_types');
    }
};

