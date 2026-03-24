<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Migration: إضافة Full-text Index للبحث النصي السريع
 * 
 * الهدف: تحسين سرعة البحث النصي في الحقول الكبيرة
 * المتوقع: تحسين 90%+ في سرعة البحث النصي
 * 
 * ملاحظة: Full-text Index يعمل فقط مع MyISAM أو InnoDB (MySQL 5.6+)
 * 
 * تم إنشاؤه بتاريخ: 2026-01-05
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            // ✅ التحقق من أن المحرك InnoDB (يدعم Full-text Index)
            $engine = DB::select("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_proposals'");
            
            if (empty($engine) || strtolower($engine[0]->ENGINE ?? '') !== 'innodb') {
                \Log::warning('⚠️ Full-text Index: الجدول ليس InnoDB، سيتم تخطي إنشاء Full-text Index', [
                    'current_engine' => $engine[0]->ENGINE ?? 'unknown'
                ]);
                return;
            }
            
            // ✅ التحقق من عدم وجود Full-text Index مسبقاً
            $existingIndexes = DB::select("SHOW INDEX FROM project_proposals WHERE Index_type = 'FULLTEXT'");
            
            if (!empty($existingIndexes)) {
                \Log::info('ℹ️ Full-text Index موجود مسبقاً، سيتم تخطي الإنشاء');
                return;
            }
            
            // ✅ إنشاء Full-text Index للبحث النصي السريع
            // يشمل: اسم المشروع، الوصف، اسم المتبرع، كود المتبرع
            DB::statement('
                ALTER TABLE project_proposals 
                ADD FULLTEXT INDEX idx_pp_fulltext_search (
                    project_name, 
                    project_description, 
                    donor_name, 
                    donor_code
                )
            ');
            
            \Log::info('✅ Full-text Index Migration: تم إنشاء Full-text Index بنجاح', [
                'table' => 'project_proposals',
                'columns' => ['project_name', 'project_description', 'donor_name', 'donor_code'],
                'index_name' => 'idx_pp_fulltext_search',
                'timestamp' => now()->toDateTimeString()
            ]);
            
        } catch (\Exception $e) {
            \Log::error('❌ Full-text Index Migration Failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // لا نرمي exception حتى لا نوقف Migration
            // Full-text Index اختياري ويمكن للنظام العمل بدونه
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        try {
            // ✅ حذف Full-text Index
            DB::statement('ALTER TABLE project_proposals DROP INDEX idx_pp_fulltext_search');
            
            \Log::info('✅ Full-text Index Rollback: تم حذف Full-text Index بنجاح');
            
        } catch (\Exception $e) {
            \Log::warning('⚠️ Full-text Index Rollback: لم يتم العثور على Index أو حدث خطأ', [
                'error' => $e->getMessage()
            ]);
        }
    }
};

