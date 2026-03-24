<?php

namespace App\Jobs;

use App\Models\ProjectProposal;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Carbon\Carbon;

class CheckDelayedProjects implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $this->checkExecutionDelays();
        $this->checkMontageDelays();
    }

    /**
     * Check for projects delayed in execution
     */
    private function checkExecutionDelays(): void
    {
        $delayedProjects = ProjectProposal::where('status', 'قيد التنفيذ')
            ->whereNotNull('assignment_date')
            ->whereNotNull('estimated_duration_days')
            ->get()
            ->filter(function ($project) {
                return $project->isExecutionDelayed();
            });

        foreach ($delayedProjects as $project) {
            $daysLate = $project->getDaysSinceAssignment() - ($project->estimated_duration_days + 2);

            // إرسال إشعار للـ Admin
            $admin = User::where('role', 'admin')->first();
            if ($admin) {
                $this->createNotification(
                    $admin->id,
                    $project->id,
                    'delay_execution',
                    'مشروع متأخر في التنفيذ',
                    "المشروع #{$project->serial_number} متأخر في التنفيذ - {$daysLate} يوم تأخير",
                    'high'
                );
            }

            // إرسال إشعار لـ Project Manager
            $projectManagers = User::where('role', 'project_manager')->get();
            foreach ($projectManagers as $pm) {
                $this->createNotification(
                    $pm->id,
                    $project->id,
                    'delay_execution',
                    'مشروع متأخر في التنفيذ',
                    "المشروع #{$project->serial_number} متأخر في التنفيذ - {$daysLate} يوم تأخير",
                    'high'
                );
            }
        }
    }

    /**
     * Check for projects delayed in montage
     */
    private function checkMontageDelays(): void
    {
        $delayedProjects = ProjectProposal::where('status', 'في المونتاج')
            ->whereNotNull('media_received_date')
            ->get()
            ->filter(function ($project) {
                return $project->isMontageDelayed();
            });

        foreach ($delayedProjects as $project) {
            $daysLate = Carbon::now()->diffInDays(Carbon::parse($project->media_received_date)) - 5;

            // إرسال إشعار للـ Admin
            $admin = User::where('role', 'admin')->first();
            if ($admin) {
                $this->createNotification(
                    $admin->id,
                    $project->id,
                    'delay_montage',
                    'مشروع متأخر في المونتاج',
                    "المشروع #{$project->serial_number} متأخر في المونتاج - {$daysLate} يوم تأخير",
                    'high'
                );
            }

            // إرسال إشعار لـ Media Manager
            $mediaManagers = User::where('role', 'media_manager')->get();
            foreach ($mediaManagers as $mm) {
                $this->createNotification(
                    $mm->id,
                    $project->id,
                    'delay_montage',
                    'مشروع متأخر في المونتاج',
                    "المشروع #{$project->serial_number} متأخر في المونتاج - {$daysLate} يوم تأخير",
                    'high'
                );
            }
        }
    }

    /**
     * Create notification
     */
    private function createNotification($userId, $projectId, $type, $title, $message, $priority = 'medium'): void
    {
        // التحقق من عدم وجود إشعار غير مقروء بنفس النوع لنفس المشروع
        $existingNotification = Notification::where('user_id', $userId)
            ->where('project_id', $projectId)
            ->where('notification_type', $type)
            ->where('is_read', false)
            ->first();

        if (!$existingNotification) {
            Notification::create([
                'user_id' => $userId,
                'project_id' => $projectId,
                'notification_type' => $type,
                'title' => $title,
                'message' => $message,
                'priority' => $priority,
                'is_read' => false,
            ]);
        }
    }
}

