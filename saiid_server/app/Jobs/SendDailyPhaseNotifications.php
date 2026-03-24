<?php

namespace App\Jobs;

use App\Models\ProjectProposal;
use App\Models\Notification;
use App\Models\User;
use App\Helpers\NotificationHelper;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Carbon\Carbon;

class SendDailyPhaseNotifications implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        // جلب جميع المشاريع اليومية النشطة (التي يجب أن تظهر اليوم)
        $today = Carbon::now()->format('Y-m-d');
        
        // جلب المشاريع الأصلية المقسمة
        $parentProjects = ProjectProposal::where('is_divided_into_phases', true)
            ->where('is_daily_phase', false)
            ->whereNotNull('phase_start_date')
            ->whereNotNull('phase_duration_days')
            ->where('status', '!=', 'ملغى')
            ->get();

        foreach ($parentProjects as $parentProject) {
            // حساب اليوم الحالي من المرحلة
            $startDate = Carbon::parse($parentProject->phase_start_date);
            $currentDate = Carbon::now();
            $daysSinceStart = $currentDate->diffInDays($startDate);
            
            // التحقق من أن اليوم الحالي ضمن فترة المرحلة
            if ($daysSinceStart < 0 || $daysSinceStart >= $parentProject->phase_duration_days) {
                continue; // خارج فترة المرحلة
            }
            
            $currentDay = $daysSinceStart + 1; // 1-based day number
            
            // جلب المشروع اليومي المقابل
            $dailyPhase = ProjectProposal::where('parent_project_id', $parentProject->id)
                ->where('phase_day', $currentDay)
                ->where('is_daily_phase', true)
                ->first();
            
            if (!$dailyPhase) {
                continue; // المشروع اليومي غير موجود
            }

            // التحقق من عدم إرسال إشعار لهذا اليوم مسبقاً
            $existingNotification = Notification::where('project_id', $dailyPhase->id)
                ->where('notification_type', 'daily_phase')
                ->whereDate('created_at', $today)
                ->first();

            if ($existingNotification) {
                continue; // تم إرسال إشعار لهذا اليوم مسبقاً
            }

            // ✅ تعطيل إشعارات المشاريع اليومية (قد تكون كثيرة جداً)
            // يمكن تفعيلها لاحقاً إذا لزم الأمر
            // NotificationHelper::createDailyPhaseNotification(
            //     $dailyPhase,
            //     $currentDay,
            //     $parentProject->phase_duration_days,
            //     $parentProject,
            //     $dailyPhase->donation_amount ?? null,
            //     $parentProject->donation_amount ?? null,
            //     $dailyPhase->net_amount_usd ?? null,
            //     $parentProject->net_amount_usd ?? null
            // );
        }
    }
}
