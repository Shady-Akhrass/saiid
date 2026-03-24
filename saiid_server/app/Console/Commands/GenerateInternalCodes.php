<?php

namespace App\Console\Commands;

use App\Models\ProjectProposal;
use Illuminate\Console\Command;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class GenerateInternalCodes extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'projects:generate-internal-codes 
                            {--force : Force regeneration even if code exists}
                            {--year= : Generate codes for specific year (e.g., 2025)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate internal codes for existing projects that don\'t have one';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🚀 بدء توليد الأكواد الداخلية للمشاريع...');
        
        $force = $this->option('force');
        $year = $this->option('year');
        
        // بناء query للمشاريع التي تحتاج أكواد
        $query = ProjectProposal::query();
        
        if (!$force) {
            $query->whereNull('internal_code')
                  ->orWhere('internal_code', '');
        }
        
        if ($year) {
            $query->whereYear('created_at', $year);
        }
        
        $projects = $query->orderBy('id', 'asc')->get();
        
        if ($projects->isEmpty()) {
            $this->info('✅ لا توجد مشاريع تحتاج إلى أكواد داخلية.');
            return 0;
        }
        
        $this->info("📊 تم العثور على {$projects->count()} مشروع يحتاج إلى كود داخلي.");
        
        $bar = $this->output->createProgressBar($projects->count());
        $bar->start();
        
        $successCount = 0;
        $errorCount = 0;
        
        DB::beginTransaction();
        
        try {
            foreach ($projects as $project) {
                try {
                    // استخدام سنة إنشاء المشروع أو السنة الحالية
                    $projectYear = $project->created_at 
                        ? (int) $project->created_at->format('y') 
                        : (int) Carbon::now()->format('y');
                    
                    $yearPrefix = str_pad($projectYear, 2, '0', STR_PAD_LEFT);
                    
                    // البحث عن آخر كود في نفس السنة
                    $lastInternalCode = ProjectProposal::where('internal_code', 'like', $yearPrefix . '%')
                        ->whereNotNull('internal_code')
                        ->orderBy('internal_code', 'desc')
                        ->value('internal_code');
                    
                    if ($lastInternalCode && strlen($lastInternalCode) === 7) {
                        $lastSequence = (int) substr($lastInternalCode, 2);
                        $nextSequence = $lastSequence + 1;
                    } else {
                        $nextSequence = 1;
                    }
                    
                    // التأكد من عدم تجاوز الحد الأقصى
                    if ($nextSequence > 99999) {
                        $this->error("\n❌ تم الوصول إلى الحد الأقصى للأكواد الداخلية للسنة {$projectYear}");
                        $errorCount++;
                        $bar->advance();
                        continue;
                    }
                    
                    // توليد الكود
                    $internalCode = $yearPrefix . str_pad($nextSequence, 5, '0', STR_PAD_LEFT);
                    
                    // التحقق من التفرد
                    $maxAttempts = 10;
                    $attempts = 0;
                    while (ProjectProposal::where('internal_code', $internalCode)->exists() && $attempts < $maxAttempts) {
                        $nextSequence++;
                        if ($nextSequence > 99999) {
                            throw new \Exception('تم الوصول إلى الحد الأقصى للأكواد الداخلية');
                        }
                        $internalCode = $yearPrefix . str_pad($nextSequence, 5, '0', STR_PAD_LEFT);
                        $attempts++;
                    }
                    
                    if ($attempts >= $maxAttempts) {
                        throw new \Exception('فشل في توليد كود فريد بعد عدة محاولات');
                    }
                    
                    // تحديث المشروع
                    $project->internal_code = $internalCode;
                    $project->save();
                    
                    $successCount++;
                    
                } catch (\Exception $e) {
                    $errorCount++;
                    $this->error("\n❌ خطأ في المشروع #{$project->id}: {$e->getMessage()}");
                }
                
                $bar->advance();
            }
            
            DB::commit();
            
            $bar->finish();
            $this->newLine(2);
            
            $this->info("✅ تم بنجاح: {$successCount} مشروع");
            if ($errorCount > 0) {
                $this->warn("⚠️  فشل: {$errorCount} مشروع");
            }
            
            // عرض إحصائيات
            $this->newLine();
            $this->info('📊 إحصائيات:');
            $stats = DB::table('project_proposals')
                ->selectRaw('SUBSTRING(internal_code, 1, 2) as year, COUNT(*) as count')
                ->whereNotNull('internal_code')
                ->groupBy('year')
                ->orderBy('year', 'desc')
                ->get()
                ->map(function ($item) {
                    return [
                        '20' . $item->year,
                        $item->count
                    ];
                })
                ->toArray();
            
            if (!empty($stats)) {
                $this->table(['السنة', 'عدد المشاريع'], $stats);
            }
            
            return 0;
            
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("\n❌ خطأ عام: {$e->getMessage()}");
            return 1;
        }
    }
}
