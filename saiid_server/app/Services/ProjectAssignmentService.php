<?php
// app/Services/ProjectAssignmentService.php

namespace App\Services;

use App\Enums\ProjectStatusGroup;
use App\Enums\UserRole;
use App\Helpers\NotificationHelper;
use App\Models\Notification;
use App\Models\ProjectProposal;
use App\Models\TeamPersonnel;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ProjectAssignmentService
{
    // ═══════════════════════════════════════════════════════
    //  RESEARCHER ASSIGNMENT
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, message: string, project?: ProjectProposal}
     */
    public function assignResearcher(Request $request, int $projectId, User $user): array
    {
        $project = ProjectProposal::findOrFail($projectId);
        $role = strtolower($user->role ?? '');
        $isSponsorshipProject = $project->isSponsorshipProject();
        $isOrphanCoordinator = $role === UserRole::ORPHAN_SPONSOR_COORDINATOR;

        // Block cancelled projects
        if ($project->status === 'ملغى') {
            return $this->fail('لا يمكن إسناد الباحث للمشاريع الملغاة');
        }

        // Validate finished project assignment
        $finishedError = $this->validateFinishedProjectAssignment($project, $user);
        if ($finishedError) {
            return $finishedError;
        }

        // Block assignment before "تم التوريد" (except finished reassignment)
        if ($project->status !== 'منتهي'
            && in_array($project->status, ProjectStatusGroup::BLOCKED_FOR_ASSIGNMENT)) {
            return $this->fail(
                'يجب أن تكون حالة المشروع "تم التوريد" أو ما بعدها',
                ['current_status' => $project->status]
            );
        }

        // Resolve researcher ID
        $researcherId = $this->resolveResearcherId(
            $request, $project, $user, $isSponsorshipProject, $isOrphanCoordinator
        );
        if (isset($researcherId['error'])) {
            return $this->fail($researcherId['error']);
        }
        $researcherId = $researcherId['id'];

        // Authorization: orphan coordinator → sponsorship only
        if ($isOrphanCoordinator && !$isSponsorshipProject) {
            return $this->fail('منسق الكفالة يمكنه إسناد الباحث فقط لمشاريع الكفالات');
        }

        // Determine new status
        $oldStatus = $project->status;
        $isReassignment = !is_null($project->assigned_researcher_id);
        $previousResearcherId = $project->assigned_researcher_id;
        $newStatus = $this->determineStatusAfterResearcherAssignment($project, $isReassignment);

        // Update project
        $project->update([
            'assigned_researcher_id' => $researcherId,
            'assigned_by'            => $user->id,
            'assignment_date'        => now(),
            'status'                 => $newStatus,
        ]);
        $project->refresh();

        // Timeline + Notifications
        $researcher = TeamPersonnel::find($researcherId);
        $this->recordResearcherTimeline($project, $oldStatus, $newStatus, $isReassignment, $previousResearcherId, $researcherId, $user);
        $this->sendResearcherNotifications($project, $oldStatus, $newStatus, $researcher, $user);

        $project->load(['assignedResearcher', 'assignedBy']);

        return [
            'success' => true,
            'message' => $this->buildResearcherSuccessMessage($isReassignment, $previousResearcherId, $researcherId, $oldStatus),
            'project' => $project,
        ];
    }

    // ═══════════════════════════════════════════════════════
    //  PHOTOGRAPHER ASSIGNMENT (single)
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, message?: string, status_changed?: bool, is_reassignment?: bool}
     */
    public function assignPhotographer(
        ProjectProposal $project,
        int $photographerId,
        User $user,
    ): array {
        // Validate researcher exists
        if (is_null($project->assigned_researcher_id)) {
            return $this->fail(
                'يجب إسناد الباحث أولاً. المشروع في حالة "' . $project->status . '"'
            );
        }

        // Validate status
        if (!in_array($project->status, ProjectStatusGroup::ALLOWED_FOR_PHOTOGRAPHER)) {
            return $this->fail(
                'الحالة الحالية: ' . $project->status . '. يجب أن يكون "مسند لباحث" أو "جاهز للتنفيذ" أو "قيد التنفيذ"'
            );
        }

        // Validate photographer type
        $photographer = TeamPersonnel::find($photographerId);
        if (!$photographer || $photographer->personnel_type !== 'مصور') {
            return $this->fail('يرجى اختيار مصور من قائمة المصورين');
        }

        $oldStatus = $project->status;
        $isReassignment = !is_null($project->assigned_photographer_id)
            && (int) $project->assigned_photographer_id !== $photographerId;

        $newStatus = $oldStatus === 'مسند لباحث' ? 'جاهز للتنفيذ' : $oldStatus;

        // Update
        $updateData = ['assigned_photographer_id' => $photographerId];
        if ($newStatus !== $oldStatus) {
            $updateData['status'] = $newStatus;
        }
        $project->update($updateData);
        $project->refresh();

        // Timeline
        $this->recordPhotographerTimeline($project, $oldStatus, $newStatus, $isReassignment, $user);

        // Notifications
        $this->sendPhotographerNotifications($project, $oldStatus, $newStatus, $photographer, $user);

        return [
            'success'        => true,
            'status_changed' => $newStatus !== $oldStatus,
            'is_reassignment'=> $isReassignment,
        ];
    }

    // ═══════════════════════════════════════════════════════
    //  AUTO-FIX broken researcher state
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{fixed: bool, error?: string}
     */
    public function autoFixMissingResearcher(ProjectProposal $project, User $user): array
    {
        if (!is_null($project->assigned_researcher_id)) {
            return ['fixed' => false];
        }

        if ($project->status !== 'مسند لباحث') {
            return [
                'fixed' => false,
                'error' => 'يجب إسناد الباحث أولاً. الحالة: "' . $project->status . '"',
            ];
        }

        // Auto-fix: revert to "تم التوريد"
        $oldStatus = $project->status;
        $project->update([
            'status'                 => 'تم التوريد',
            'assigned_researcher_id' => null,
            'assigned_by'            => null,
            'assignment_date'        => null,
        ]);

        $project->recordStatusChange(
            $oldStatus,
            'تم التوريد',
            $user->id,
            'إصلاح تلقائي: المشروع كان "مسند لباحث" بدون باحث مسند'
        );

        return [
            'fixed' => true,
            'error' => 'تم إرجاع المشروع إلى "تم التوريد". يرجى إسناد الباحث أولاً.',
        ];
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════

    private function fail(string $message, array $extra = []): array
    {
        return array_merge(['success' => false, 'message' => $message], $extra);
    }

    private function validateFinishedProjectAssignment(ProjectProposal $project, User $user): ?array
    {
        if ($project->status !== 'منتهي') {
            return null;
        }

        $isReassignment = !is_null($project->assigned_researcher_id);
        $role = strtolower($user->role ?? '');
        $canReassign = in_array($role, [UserRole::PROJECT_MANAGER, UserRole::ADMIN]);

        if ($isReassignment && $canReassign) {
            return null; // allowed
        }

        return $this->fail('لا يمكن إسناد الباحث للمشاريع المنتهية (إعادة الإسناد لمدير المشاريع فقط)');
    }

    /**
     * @return array{id: int}|array{error: string}
     */
    private function resolveResearcherId(
        Request $request,
        ProjectProposal $project,
        User $user,
        bool $isSponsorshipProject,
        bool $isOrphanCoordinator,
    ): array {
        $researcherId = $request->assigned_researcher_id;

        // Default researcher for sponsorship projects
        // Any authorized user can use the default researcher option if it's a sponsorship project
        if ($isSponsorshipProject && !$researcherId) {
            return ['id' => $this->getOrCreateCoordinatorResearcher($user)];
        }

        if (!$researcherId) {
            return ['error' => 'يرجى اختيار باحث من قائمة الباحثين'];
        }

        $researcher = TeamPersonnel::findOrFail($researcherId);
        if ($researcher->personnel_type !== 'باحث') {
            return ['error' => 'المحدد ليس باحث. يرجى اختيار باحث'];
        }

        return ['id' => (int) $researcherId];
    }

    private function getOrCreateCoordinatorResearcher(User $coordinator): int
    {
        $researcher = TeamPersonnel::where('name', $coordinator->name)
            ->where('personnel_type', 'باحث')
            ->first();

        if (!$researcher) {
            $researcher = TeamPersonnel::create([
                'name'           => $coordinator->name,
                'phone_number'   => $coordinator->phone_number ?? '0500000000',
                'personnel_type' => 'باحث',
                'department'     => $coordinator->department ?? 'مشاريع',
                'is_active'      => true,
            ]);
        }

        return $researcher->id;
    }

    private function determineStatusAfterResearcherAssignment(
        ProjectProposal $project,
        bool $isReassignment,
    ): string {
        // Finished project reassignment → keep "منتهي"
        if ($project->status === 'منتهي' && $isReassignment) {
            return 'منتهي';
        }

        // First assignment from "تم التوريد" or "قيد التوزيع"
        if (in_array($project->status, ['تم التوريد', 'قيد التوزيع']) && !$isReassignment) {
            return 'مسند لباحث';
        }

        // Otherwise keep current status
        return $project->status;
    }

    private function recordResearcherTimeline(
        ProjectProposal $project,
        string $oldStatus,
        string $newStatus,
        bool $isReassignment,
        ?int $previousResearcherId,
        int $newResearcherId,
        User $user,
    ): void {
        if ($oldStatus !== $newStatus) {
            $project->recordStatusChange($oldStatus, $newStatus, $user->id, 'تم إسناد الباحث');
            return;
        }

        $note = match (true) {
            $isReassignment && $previousResearcherId != $newResearcherId
                => ($oldStatus === 'منتهي' ? 'تم تغيير إسناد الباحث (مشروع منتهي)' : 'تم تغيير إسناد الباحث'),
            $isReassignment
                => ($oldStatus === 'منتهي' ? 'تم إعادة إسناد الباحث (مشروع منتهي)' : 'تم إعادة إسناد الباحث'),
            default => 'تم إسناد الباحث',
        };

        $project->recordStatusChange($oldStatus, $oldStatus, $user->id, $note);
    }

    private function sendResearcherNotifications(
        ProjectProposal $project,
        string $oldStatus,
        string $newStatus,
        ?TeamPersonnel $researcher,
        User $user,
    ): void {
        if ($oldStatus !== $newStatus) {
            NotificationHelper::createProjectStatusChangedNotification($project, $oldStatus, $newStatus, $user);
        }

        if ($researcher) {
            NotificationHelper::createResearcherAssignedNotification($project, $researcher, $user);
        }
    }

    private function buildResearcherSuccessMessage(
        bool $isReassignment,
        ?int $previousId,
        int $newId,
        string $oldStatus,
    ): string {
        if ($isReassignment && $previousId != $newId) {
            return $oldStatus === 'منتهي'
                ? 'تم تعديل إسناد الباحث بنجاح (مشروع منتهي)'
                : 'تم تعديل إسناد الباحث بنجاح';
        }

        if ($isReassignment) {
            return $oldStatus === 'منتهي'
                ? 'تم إعادة إسناد الباحث بنجاح (مشروع منتهي)'
                : 'تم إعادة إسناد الباحث بنجاح';
        }

        return 'تم إسناد المشروع للباحث بنجاح';
    }

    private function recordPhotographerTimeline(
        ProjectProposal $project,
        string $oldStatus,
        string $newStatus,
        bool $isReassignment,
        User $user,
    ): void {
        $note = match (true) {
            $newStatus !== $oldStatus => 'تم إسناد المصور - المشروع جاهز للتنفيذ',
            $isReassignment           => 'تم إعادة إسناد المصور - الحالة لم تتغير',
            default                   => 'تم إسناد المصور - الحالة لم تتغير',
        };

        $project->recordStatusChange($oldStatus, $newStatus, $user->id, $note);
    }

    private function sendPhotographerNotifications(
        ProjectProposal $project,
        string $oldStatus,
        string $newStatus,
        TeamPersonnel $photographer,
        User $user,
    ): void {
        NotificationHelper::createPhotographerAssignedNotification($project, $photographer, $user);

        if ($newStatus === $oldStatus) {
            return;
        }

        NotificationHelper::createProjectStatusChangedNotification($project, $oldStatus, $newStatus, $user);

        if ($newStatus === 'جاهز للتنفيذ') {
            $coordinators = User::byRole('executed_projects_coordinator')->active()->get();
            foreach ($coordinators as $coordinator) {
                Notification::create([
                    'user_id'           => $coordinator->id,
                    'project_id'        => $project->id,
                    'notification_type' => 'ready_for_shelter_selection',
                    'title'             => 'مشروع جاهز للتنفيذ',
                    'message'           => "المشروع #{$project->serial_number} جاهز - يرجى اختيار المخيم",
                    'priority'          => 'high',
                ]);
            }
        }
    }
}