<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('project_proposals')) {
            return;
        }

        Schema::table('project_proposals', function (Blueprint $table) {
            if (!Schema::hasColumn('project_proposals', 'project_name')) {
                $table->string('project_name')->nullable()->after('donor_code');
                $table->index('project_name');
            }
        });

        // تعبئة القيم الحالية لعدم ترك الحقل فارغاً
        // استخدام chunk لتجنب مشاكل الذاكرة مع جداول كبيرة
        DB::table('project_proposals')
            ->whereNull('project_name')
            ->orWhere('project_name', '')
            ->chunkById(100, function ($projects) {
                foreach ($projects as $project) {
                    $projectName = $project->donor_code 
                        ? $project->donor_code 
                        : "مشروع {$project->project_type} #{$project->serial_number}";
                    
                    DB::table('project_proposals')
                        ->where('id', $project->id)
                        ->update(['project_name' => Str::limit($projectName, 255)]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('project_proposals')) {
            return;
        }

        Schema::table('project_proposals', function (Blueprint $table) {
            if (Schema::hasColumn('project_proposals', 'project_name')) {
                $table->dropIndex(['project_name']);
                $table->dropColumn('project_name');
            }
        });
    }
};

