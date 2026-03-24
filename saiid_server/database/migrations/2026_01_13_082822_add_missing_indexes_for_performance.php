<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Migration: إضافة Indexes المفقودة لتحسين الأداء
 * 
 * ✅ المهمة 1: إضافة Database Indexes (آمنة 100%)
 * 
 * الهدف: تحسين سرعة الاستعلامات على الحقول المستخدمة في WHERE/ORDER BY
 * المخاطرة: ⭐ منخفضة جداً (1/10) - فقط إضافة indexes، لا تغيير في البيانات
 * 
 * تم إنشاؤه: 2026-01-13
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * ✅ إضافة Index على month_start_date
     * هذا الحقل مستخدم في:
     * - فلترة المشاريع الشهرية للشهر الحالي
     * - whereRaw('MONTH(month_start_date) = ?') و whereRaw('YEAR(month_start_date) = ?')
     * 
     * ملاحظة: رغم أن whereRaw مع MONTH() لا يستخدم index مباشرة،
     * لكن إضافة index الآن ستفيد عندما نحسن الاستعلام لاستخدام whereBetween
     */
    public function up(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            // ✅ Index على month_start_date (مستخدم في فلترة المشاريع الشهرية)
            // التحقق من وجود الـ index أولاً لتجنب الأخطاء
            if (!$this->indexExists('project_proposals', 'month_start_date')) {
                $table->index('month_start_date', 'idx_pp_month_start_date');
            }
        });
        
        // ✅ Log للتوثيق
        \Log::info('✅ Performance Index Migration: تم إضافة index على month_start_date', [
            'table' => 'project_proposals',
            'index' => 'idx_pp_month_start_date',
            'column' => 'month_start_date',
            'timestamp' => now()->toDateTimeString()
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            // حذف الـ index في حالة Rollback
            try {
                $table->dropIndex('idx_pp_month_start_date');
            } catch (\Exception $e) {
                \Log::warning("Could not drop index: idx_pp_month_start_date", [
                    'error' => $e->getMessage()
                ]);
            }
        });
    }
    
    /**
     * Check if an index exists on a table
     *
     * @param string $table
     * @param string $column
     * @return bool
     */
    private function indexExists(string $table, string $column): bool
    {
        try {
            $indexes = DB::select("
                SELECT INDEX_NAME 
                FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = ? 
                AND COLUMN_NAME = ?
            ", [$table, $column]);
            
            return !empty($indexes);
        } catch (\Exception $e) {
            // If we can't check, assume it doesn't exist (safer to try to add)
            \Log::warning("Could not check for index existence on {$table}.{$column}", [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
};
