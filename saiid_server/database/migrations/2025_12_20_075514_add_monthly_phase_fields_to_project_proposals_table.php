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
        Schema::table('project_proposals', function (Blueprint $table) {
            // إضافة phase_type بعد is_divided_into_phases
            $table->enum('phase_type', ['daily', 'monthly'])->nullable()->after('is_divided_into_phases');
            
            // إضافة total_months للمشاريع الشهرية
            $table->integer('total_months')->nullable()->after('phase_duration_days');
            
            // إضافة month_number للمشاريع الشهرية (بعد phase_day)
            $table->integer('month_number')->nullable()->after('phase_day');
            
            // إضافة is_monthly_phase
            $table->boolean('is_monthly_phase')->default(false)->after('is_daily_phase');
            
            // إضافة month_start_date (تاريخ بداية الشهر)
            $table->date('month_start_date')->nullable()->after('phase_start_date');
            
            // إضافة indexes
            $table->index('phase_type');
            $table->index(['parent_project_id', 'month_number']);
            $table->index('is_monthly_phase');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropIndex(['is_monthly_phase']);
            $table->dropIndex(['parent_project_id', 'month_number']);
            $table->dropIndex(['phase_type']);
            
            $table->dropColumn([
                'phase_type',
                'total_months',
                'month_number',
                'is_monthly_phase',
                'month_start_date'
            ]);
        });
    }
};
