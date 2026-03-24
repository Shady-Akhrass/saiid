<?php
// app/Services/ExecutionStatusService.php

namespace App\Services;

use App\Helpers\NotificationHelper;
use App\Models\ProjectProposal;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class ExecutionStatusService
{
    /**
     * @return array{success: bool, project?: array, error?: string, code?: int}
     */
    public function updateStatus(int $projectId, string $newStatus, User $user): array
    {
        $project = ProjectProposal::findOrFail($projectId);
        $oldStatus = $project->status;
        $isOrphan = $user->role === 'orphan_sponsor_coordinator';

        // Validate transition
        $validationError = $this->validateTransition($project, $newStatus, $isOrphan);
        if ($validationError) {
            return $validationError;
        }

        // Update
        $project->update(['status' => $newStatus]);
        $project->refresh();

        // Timeline
        $roleName = $this->getRoleName($user->role);
        $timelineNote = $newStatus === 'تم التنفيذ'
            ? "تم تحديث حالة المشروع إلى \"تم التنفيذ\" من قبل {$roleName}"
            : "تم تحديث حالة المشروع إلى \"قيد التنفيذ\" من قبل {$roleName}";

        $project->recordStatusChange($oldStatus, $newStatus, $user->id, $timelineNote);

        // Notifications
        if ($newStatus === 'تم التنفيذ') {
            NotificationHelper::createProjectStatusChangedNotification($project, $oldStatus, $newStatus);
            NotificationHelper::createMissingBeneficiariesFileNotification($project);
        }

        return [
            'success' => true,
            'project' => [
                'id'             => $project->id,
                'status'         => $project->status,
                'execution_date' => $project->execution_date,
            ],
        ];
    }

    /**
     * Mark project as completed (Admin only): "وصل للمتبرع" → "منتهي"
     *
     * @return array{success: bool, project?: ProjectProposal, error?: string, code?: int}
     */
    public function markAsCompleted(int $projectId, User $user): array
    {
        $project = ProjectProposal::findOrFail($projectId);
        $oldStatus = $project->status;

        if ($oldStatus !== 'وصل للمتبرع') {
            return [
                'success' => false,
                'error'   => 'يمكن إنهاء المشروع فقط من حالة "وصل للمتبرع"',
                'code'    => 422,
            ];
        }

        $project->update([
            'status'         => 'منتهي',
            'completed_date' => now()->toDateString(),
        ]);

        $project->recordStatusChange(
            $oldStatus, 'منتهي', $user->id,
            'تم إنهاء المشروع بنجاح - المشروع مكتمل'
        );

        NotificationHelper::createProjectStatusChangedNotification($project, $oldStatus, 'منتهي', $user);

        return ['success' => true, 'project' => $project->fresh()];
    }

    // ─── Private ─────────────────────────────────────────

    private function validateTransition(
        ProjectProposal $project,
        string $newStatus,
        bool $isOrphan,
    ): ?array {
        $oldStatus = $project->status;

        if ($isOrphan) {
            if ($oldStatus !== 'جاهز للتنفيذ') {
                return $this->fail("يمكن التحديث فقط من 'جاهز للتنفيذ'. الحالة الحالية: {$oldStatus}");
            }
            if ($newStatus !== 'تم التنفيذ') {
                return $this->fail('يمكن التحديث فقط إلى "تم التنفيذ"');
            }
            return null;
        }

        // Non-orphan roles
        if ($oldStatus !== 'قيد التنفيذ') {
            return $this->fail("يمكن التحديث فقط من 'قيد التنفيذ'. الحالة الحالية: {$oldStatus}");
        }

        if ($newStatus !== 'تم التنفيذ') {
            return $this->fail('يمكن التحديث فقط إلى "تم التنفيذ"');
        }

        return null;
    }

    private function fail(string $message): array
    {
        return ['success' => false, 'error' => $message, 'code' => 422];
    }

    private function getRoleName(string $role): string
    {
        return match ($role) {
            'media_manager'              => 'مدير الإعلام',
            'project_manager'            => 'مدير المشاريع',
            'orphan_sponsor_coordinator' => 'منسق الكفالات',
            default                      => 'الإدارة',
        };
    }
}