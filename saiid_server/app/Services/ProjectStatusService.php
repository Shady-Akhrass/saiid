<?php
// app/Services/ProjectStatusService.php

namespace App\Services;

use App\Enums\ProjectStatusGroup;
use App\Enums\UserRole;
use App\Helpers\NotificationHelper;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectProposal;
use App\Models\Shelter;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ProjectStatusService
{
    // ═══════════════════════════════════════════════════════
    //  RETURN TO SUPPLY
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, project?: ProjectProposal, error?: string, code?: int}
     */
    public function returnToSupply(int $projectId, User $user): array
    {
        $project = ProjectProposal::findOrFail($projectId);

        if (ProjectStatusGroup::isTerminal($project->status)) {
            return $this->fail('لا يمكن تحديث حالة التوريد للمشاريع المنتهية أو الملغاة', 422);
        }

        $oldStatus = $project->status;
        $hadPhotographer = !is_null($project->assigned_photographer_id);
        $isAdvanced = ProjectStatusGroup::isAdvanced($project->status);

        $updateData = [
            'status'                 => 'تم التوريد',
            'assigned_researcher_id' => null,
            'assigned_by'            => null,
            'assignment_date'        => null,
        ];

        if ($hadPhotographer) {
            $updateData['assigned_photographer_id'] = null;
        }

        $project->update($updateData);
        $project->refresh();

        // Timeline
        $notes = 'تم إرجاع المشروع إلى حالة التوريد';
        $notes .= $hadPhotographer
            ? ' - تم إلغاء إسناد الباحث والمصور'
            : ' - تم إلغاء إسناد الباحث';
        if ($isAdvanced) {
            $notes .= ' (من حالة متقدمة)';
        }

        $project->recordStatusChange($oldStatus, 'تم التوريد', $user->id, $notes);

        return ['success' => true, 'project' => $project];
    }

    // ═══════════════════════════════════════════════════════
    //  POSTPONE
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, project?: ProjectProposal, error?: string, code?: int}
     */
    public function postpone(int $projectId, User $user, ?string $reason = null): array
    {
        $project = ProjectProposal::findOrFail($projectId);

        if (in_array($project->status, ProjectStatusGroup::NON_POSTPONABLE)) {
            return $this->fail('لا يمكن تأجيل المشروع بعد إتمام التنفيذ أو في مراحل متقدمة', 422);
        }

        // Only project_manager / admin can postpone "قيد التنفيذ"
        if ($project->status === 'قيد التنفيذ'
            && !in_array($user->role, [UserRole::PROJECT_MANAGER->value, UserRole::ADMIN->value])) {
            return $this->fail('فقط مدير المشاريع والإدارة يمكنهم تأجيل المشاريع قيد التنفيذ', 403);
        }

        $oldStatus = $project->status;

        $project->update([
            'status'              => 'مؤجل',
            'postponement_reason' => $reason,
        ]);
        $project->refresh();

        // Timeline
        $notes = $reason
            ? "تم تأجيل المشروع. السبب: {$reason}"
            : 'تم تأجيل المشروع';
        $project->recordStatusChange($oldStatus, 'مؤجل', $user->id, $notes);

        // Notification
        NotificationHelper::createProjectPostponedNotification(
            $project,
            $reason ?? 'لم يتم تحديد سبب',
            $oldStatus
        );

        $project->load(['currency', 'assignedToTeam', 'photographer', 'shelter']);

        return ['success' => true, 'project' => $project];
    }

    // ═══════════════════════════════════════════════════════
    //  RESUME
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, project?: ProjectProposal, error?: string, code?: int}
     */
    public function resume(int $projectId, User $user): array
    {
        $project = ProjectProposal::findOrFail($projectId);

        if ($project->status !== 'مؤجل') {
            return $this->fail('هذا المشروع ليس في حالة مؤجل', 422);
        }

        $oldStatus = $project->status;
        $newStatus = $project->assigned_to_team_id ? 'جاهز للتنفيذ' : 'جديد';

        $project->update([
            'status'              => $newStatus,
            'postponement_reason' => null,
            'postponed_at'        => null,
        ]);
        $project->refresh();

        $project->recordStatusChange($oldStatus, $newStatus, $user->id, 'تم استئناف المشروع بعد التأجيل');
        NotificationHelper::createProjectResumedNotification($project, $newStatus);

        $project->load(['currency', 'assignedToTeam', 'photographer', 'shelter']);

        return ['success' => true, 'project' => $project];
    }

    // ═══════════════════════════════════════════════════════
    //  MOVE TO SUPPLY
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, project?: ProjectProposal, error?: string, code?: int}
     */
    public function moveToSupply(int $projectId, User $user): array
    {
        $project = ProjectProposal::findOrFail($projectId);

        if (ProjectStatusGroup::isTerminal($project->status)) {
            return $this->fail('لا يمكن تحديث حالة التوريد للمشاريع المنتهية أو الملغاة', 422);
        }

        $oldStatus = $project->status;
        $project->update(['status' => 'قيد التوريد']);

        $notes = 'تم نقل المشروع لمرحلة التوريد';
        if ($oldStatus !== 'جديد') {
            $notes .= " (من حالة: {$oldStatus})";
        }

        $project->recordStatusChange($oldStatus, 'قيد التوريد', $user->id, $notes);
        NotificationHelper::createSupplyStartedNotification($project);

        return ['success' => true, 'project' => $project];
    }

    // ═══════════════════════════════════════════════════════
    //  SELECT SHELTER
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, project?: ProjectProposal, error?: string, code?: int}
     */
    public function selectShelter(int $projectId, string $shelterId, User $user): array
    {
        $project = ProjectProposal::findOrFail($projectId);

        if ($project->isSponsorshipProject()) {
            return $this->fail('مشاريع الكفالات لا تحتاج مخيم', 422);
        }

        if ($project->status !== 'جاهز للتنفيذ') {
            return $this->fail('المشروع ليس في حالة جاهز للتنفيذ', 422);
        }

        $shelter = Shelter::where('manager_id_number', $shelterId)->firstOrFail();
        $oldStatus = $project->status;

        $project->update(['shelter_id' => $shelterId]);
        $project->refresh();

        $project->recordStatusChange(
            $oldStatus,
            $oldStatus, // status unchanged
            $user->id,
            "تم اختيار المخيم: {$shelter->camp_name} - المشروع لا يزال جاهز للتنفيذ"
        );

        NotificationHelper::createShelterSelectedNotification($project, $shelter);

        $project->load('shelter');

        return ['success' => true, 'project' => $project];
    }

    // ═══════════════════════════════════════════════════════
    //  TRANSFER TO EXECUTION
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, project?: ProjectProposal, executed_project?: Project|null, already_transferred?: bool, error?: string, code?: int}
     */
    public function transferToExecution(int $projectId, User $user): array
    {
        $proposal = ProjectProposal::findOrFail($projectId);

        // Already transferred?
        if ($proposal->transferred_to_projects && $proposal->project_id) {
            $existing = Project::find($proposal->project_id);
            if ($existing) {
                $proposal->load(['executedProject', 'shelter']);
                return [
                    'success'             => true,
                    'project'             => $proposal,
                    'executed_project'    => $existing,
                    'already_transferred' => true,
                ];
            }
        }

        $isSponsorship = $proposal->isSponsorshipProject();

        // Validate status
        $statusError = $this->validateTransferStatus($proposal, $isSponsorship);
        if ($statusError) {
            return $statusError;
        }

        // Validate shelter for non-sponsorship
        if (!$isSponsorship) {
            $shelterError = $this->validateTransferShelter($proposal);
            if ($shelterError) {
                return $shelterError;
            }
        }

        // Create executed project (non-sponsorship only)
        $executedProject = null;
        if (!$isSponsorship) {
            $executedProject = $this->findOrCreateExecutedProject($proposal);
        }

        $oldStatus = $proposal->status;

        // Direct DB update to bypass observers
        $updateData = [
            'status'     => 'قيد التنفيذ',
            'updated_at' => now(),
        ];
        if (!$isSponsorship && $executedProject) {
            $updateData['transferred_to_projects'] = true;
            $updateData['project_id'] = $executedProject->id;
        }

        DB::table('project_proposals')
            ->where('id', $proposal->id)
            ->update($updateData);

        $proposal->refresh();

        // Auto-correct if observer changed status
        if ($proposal->status !== 'قيد التنفيذ') {
            Log::warning('Status auto-corrected after transfer', [
                'project_id' => $projectId,
                'actual'     => $proposal->status,
            ]);
            $proposal->update(['status' => 'قيد التنفيذ']);
            $proposal->refresh();
        }

        // Timeline + notification
        if ($oldStatus !== 'قيد التنفيذ') {
            $proposal->recordStatusChange($oldStatus, 'قيد التنفيذ', $user->id, 'تم نقل المشروع للتنفيذ');
        }

        NotificationHelper::createProjectTransferredToExecutionNotification($proposal, $oldStatus);

        $relations = $isSponsorship ? ['shelter'] : ['executedProject', 'shelter'];
        $proposal->load($relations);

        return [
            'success'          => true,
            'project'          => $proposal,
            'executed_project' => $executedProject,
            'is_sponsorship'   => $isSponsorship,
        ];
    }

    // ═══════════════════════════════════════════════════════
    //  MARK AS EXECUTED
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, project?: ProjectProposal, error?: string, code?: int}
     */
    public function markAsExecuted(
        int $projectId,
        User $user,
        ?string $executionDate = null,
        ?string $notes = null,
        Request $request = null
    ): array {
        $project = ProjectProposal::findOrFail($projectId);

        if ($project->status !== 'قيد التنفيذ') {
            return $this->fail(
                'المشروع يجب أن يكون في حالة قيد التنفيذ. الحالة الحالية: ' . $project->status,
                422
            );
        }

        $oldStatus = $project->status;

        $updateData = ['status' => 'تم التنفيذ'];
        if ($executionDate) {
            $updateData['execution_date'] = $executionDate;
        }

        $project->update($updateData);

        // Sync Orphans if Sponsorship
        if ($project->isSponsorshipProject() && $request) {
            $this->syncOrphans($project, $request);
        }

        // Timeline
        $timelineNotes = $notes
            ? "تم إتمام تنفيذ المشروع. {$notes}"
            : 'تم إتمام تنفيذ المشروع';
        $project->recordStatusChange($oldStatus, 'تم التنفيذ', $user->id, $timelineNotes);

        // Notifications
        NotificationHelper::createProjectStatusChangedNotification($project, $oldStatus, 'تم التنفيذ');
        NotificationHelper::createMissingBeneficiariesFileNotification($project);

        $this->notifyMediaManagers($project);

        $project->load(['currency', 'assignedToTeam', 'photographer', 'shelter']);

        return ['success' => true, 'project' => $project];
    }

    private function syncOrphans(ProjectProposal $project, Request $request): void
    {
        $orphanIds = $request->input('selected_orphan_ids');
        if (!$orphanIds || !is_array($orphanIds)) {
            return;
        }

        $startDate = $request->input('sponsorship_start_date');
        $endDate = $request->input('sponsorship_end_date');
        $amount = $request->input('sponsorship_amount', ($project->net_amount / max(1, count($orphanIds))));
        $notes = $request->input('orphan_notes');

        $syncData = [];
        foreach ($orphanIds as $id) {
            $syncData[$id] = [
                'sponsorship_start_date' => $startDate,
                'sponsorship_end_date' => $endDate,
                'sponsorship_amount' => $amount,
                'notes' => $notes,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        $project->sponsoredOrphans()->sync($syncData);
        Log::info('Orphans synced for project (StatusService)', ['project_id' => $project->id, 'count' => count($orphanIds)]);
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════

    private function fail(string $message, int $code = 422): array
    {
        return ['success' => false, 'error' => $message, 'code' => $code];
    }

    private function validateTransferStatus(ProjectProposal $proposal, bool $isSponsorship): ?array
    {
        $allowed = ProjectStatusGroup::ALLOWED_FOR_TRANSFER;

        if (!in_array($proposal->status, $allowed)) {
            return $this->fail(
                'المشروع يجب أن يكون في حالة "قيد التنفيذ" أو "جاهز للتنفيذ" أو "تم التنفيذ"',
                422
            );
        }

        return null;
    }

    private function validateTransferShelter(ProjectProposal $proposal): ?array
    {
        if ($proposal->status === 'جاهز للتنفيذ' && !$proposal->shelter_id) {
            return $this->fail('يجب اختيار المخيم أولاً قبل نقل المشروع للتنفيذ', 422);
        }

        if (!$proposal->shelter_id) {
            return $this->fail('يجب اختيار المخيم أولاً', 422);
        }

        return null;
    }

    private function findOrCreateExecutedProject(ProjectProposal $proposal): Project
    {
        $existing = Project::where('source_project_id', $proposal->id)->first();
        if ($existing) {
            // Link if not already linked
            if (!$proposal->project_id) {
                $proposal->update([
                    'transferred_to_projects' => true,
                    'project_id'              => $existing->id,
                ]);
            }
            return $existing;
        }

        return Project::create([
            'source_project_id' => $proposal->id,
            'project_name'      => Str::limit($proposal->project_name ?? $proposal->project_description, 255),
            'aid_type'          => $proposal->project_type,
            'quantity'          => 1,
            'shelter_id'        => (string) $proposal->shelter_id,
            'execution_date'    => now(),
            'status'            => 'غير مكتمل',
        ]);
    }

    private function notifyMediaManagers(ProjectProposal $project): void
    {
        $mediaManagers = User::byRole('media_manager')->active()->get();

        foreach ($mediaManagers as $manager) {
            Notification::create([
                'user_id'           => $manager->id,
                'project_id'        => $project->id,
                'notification_type' => 'ready_for_montage',
                'title'             => 'مشروع جاهز للمونتاج',
                'message'           => "المشروع #{$project->serial_number} - {$project->project_name} جاهز للمونتاج",
                'priority'          => 'high',
            ]);
        }
    }
}