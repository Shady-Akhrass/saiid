<?php

namespace App\Console\Commands;

use App\Models\ProjectProposal;
use Illuminate\Console\Command;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class CreateMonthlyPhases extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'projects:create-monthly-phases';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'إنشاء المشاريع الشهرية التلقائية كل 30 يوم';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('بدء إنشاء المشاريع الشهرية...');
        
        // جلب جميع المشاريع الأصلية الشهرية
        $parentProjects = ProjectProposal::where('is_divided_into_phases', true)
            ->where('phase_type', 'monthly')
            ->where('is_daily_phase', false)
            ->where('is_monthly_phase', false)
            ->whereNotNull('phase_start_date')
            ->whereNotNull('total_months')
            ->where('status', '!=', 'ملغى')
            ->get();

        $createdCount = 0;
        $skippedCount = 0;

        foreach ($parentProjects as $parentProject) {
            try {
                // حساب عدد الشهور المتبقية
                $existingMonths = $parentProject->monthlyPhases()->count();
                
                if ($existingMonths >= $parentProject->total_months) {
                    $skippedCount++;
                    continue; // تم إنشاء جميع الشهور
                }

                $startDate = Carbon::parse($parentProject->phase_start_date);
                $now = Carbon::now();
                
                // حساب الشهر التالي المطلوب
                $nextMonthNumber = $existingMonths + 1;
                
                // حساب تاريخ بداية الشهر التالي (من تاريخ بداية المشروع الأصلي)
                // ✅ استخدام addMonths بدلاً من addDays لضمان الانتقال للشهر التالي في التقويم
                $nextMonthStartDate = $startDate->copy()->addMonths($nextMonthNumber - 1)->startOfMonth();
                
                // التحقق من أن التاريخ الحالي >= تاريخ بداية الشهر التالي
                // نسمح بإنشاء المشروع قبل يوم واحد من تاريخ البداية (للتأكد من إنشائه في الوقت المناسب)
                $daysUntilNextMonth = $now->diffInDays($nextMonthStartDate, false);
                
                if ($daysUntilNextMonth > 1) {
                    // لم يحن الوقت بعد (أكثر من يوم واحد قبل تاريخ البداية)
                    $skippedCount++;
                    continue;
                }
                
                // التحقق من عدم وجود شهر بنفس الرقم
                $existingMonth = $parentProject->monthlyPhases()
                    ->where('month_number', $nextMonthNumber)
                    ->first();
                
                if ($existingMonth) {
                    // الشهر موجود بالفعل
                    $skippedCount++;
                    continue;
                }

                // إنشاء الشهر التالي
                $nextMonthlyPhase = $parentProject->createNextMonthlyPhase();
                
                if ($nextMonthlyPhase) {
                    $createdCount++;
                    $this->info("تم إنشاء المشروع الشهري - الشهر {$nextMonthlyPhase->month_number} للمشروع {$parentProject->serial_number}");
                    
                    Log::info('Monthly phase created automatically', [
                        'parent_project_id' => $parentProject->id,
                        'monthly_phase_id' => $nextMonthlyPhase->id,
                        'month_number' => $nextMonthlyPhase->month_number,
                    ]);
                }
                
            } catch (\Exception $e) {
                Log::error('Error creating monthly phase', [
                    'parent_project_id' => $parentProject->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                
                $this->error("خطأ في إنشاء المشروع الشهري للمشروع {$parentProject->serial_number}: " . $e->getMessage());
            }
        }

        $this->info("تم إنشاء {$createdCount} مشروع شهري جديد");
        $this->info("تم تخطي {$skippedCount} مشروع (لم يحن الوقت بعد أو تم إنشاؤها مسبقاً)");
        
        return Command::SUCCESS;
    }
}
