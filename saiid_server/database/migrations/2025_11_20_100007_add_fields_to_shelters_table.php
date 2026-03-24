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
        Schema::table('shelters', function (Blueprint $table) {
            // عدد الأسر في المخيم
            $table->integer('number_of_families')->default(0)->after('district');
            
            // معلومات إضافية لتتبع المشاريع
            $table->date('last_project_date')->nullable()->after('number_of_families');
            $table->integer('total_projects_received')->default(0)->after('last_project_date');
            
            // Index
            $table->index('number_of_families');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shelters', function (Blueprint $table) {
            $table->dropIndex(['shelters_number_of_families_index']);
            $table->dropColumn([
                'number_of_families',
                'last_project_date',
                'total_projects_received'
            ]);
        });
    }
};

