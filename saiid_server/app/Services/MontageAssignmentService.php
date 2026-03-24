<?php
// app/Services/MontageAssignmentService.php (UPDATED — add batchAssign)

namespace App\Services;

use App\Enums\ProjectStatusGroup;
use App\Helpers\NotificationHelper;
use App\Models\MediaArchive;
use App\Models\ProjectProposal;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MontageAssignmentService
{
    // ═══════════════════════════════════════════════════════
    //  SINGLE ASSIGN (unchanged from previous)
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, project?: array, is_reassignment?: bool, error?: string, code?: int}
     */
    public function assign(int $projectId, int $producerId, User $user): array
    {
        $project = ProjectProposal::findOrFail($projectId);
        return $this->performAssignment($project, $producerId, $user);
    }

    // ═══════════════════════════════════════════════════════
    //  BATCH ASSIGN
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{assigned: array, failed: array}
     */
    public function batchAssign(array $projectIds, int $producerId, User $user): array
    {
        $producer = User::findOrFail($producerId);

        if ($producer->role !== 'montage_producer') {
            return [
                'assigned' => [],
                'failed'   => array_map(
                    fn ($id) => ['project_id' => $id, 'error' => 'المستخدم ليس ممنتج مونتاج'],
                    $projectIds
                ),
            ];
        }

        $projects = ProjectProposal::whereIn('id', $projectIds)->get();

        $assigned = [];
        $failed = [];

        foreach ($projects as $project) {
            try {
                DB::transaction(function () use ($project, $producer, $user, &$assigned) {
                    $result = $this->performAssignment($project, $producer->id, $user, $producer);

                    if (!$result['success']) {
                        throw new \RuntimeException($result['error']);
                    }

                    $assigned[] = $result['project'];
                });
            } catch (\Exception $e) {
                Log::error('batchAssignProducer failed', [
                    'project_id' => $project->id,
                    'error'      => $e->getMessage(),
                ]);

                $failed[] = [
                    'project_id' => $project->id,
                    'error'      => $e->getMessage(),
                ];
            }
        }

        return ['assigned' => $assigned, 'failed' => $failed];
    }

    // ═══════════════════════════════════════════════════════
    //  CORE LOGIC
    // ═══════════════════════════════════════════════════════

    private function performAssignment(
        ProjectProposal $project,
        int $producerId,
        User $user,
        ?User $producer = null,
    ): array {
        if (!in_array($project->status, ProjectStatusGroup::ALLOWED_FOR_MONTAGE_ASSIGNMENT)) {
            return [
                'success' => false,
                'error'   => 'حالة المشروع غير مناسبة: ' . $project->status,
                'code'    => 422,
            ];
        }

        $producer = $producer ?? User::findOrFail($producerId);
        if ($producer->role !== 'montage_producer') {
            return ['success' => false, 'error' => 'المستخدم ليس ممنتج مونتاج', 'code' => 422];
        }

        $isReassignment = $project->assigned_montage_producer_id !== null
            && $project->assigned_montage_producer_id != $producerId;

        $oldProducer = $isReassignment
            ? User::find($project->assigned_montage_producer_id)
            : null;

        $oldStatus = $project->status;

        // Build update
        $updateData = [
            'assigned_montage_producer_id' => $producerId,
            'montage_producer_assigned_at' => now(),
        ];

        if ($project->status === 'تم التنفيذ') {
            $updateData['status'] = 'في المونتاج';
            $updateData['montage_start_date'] = $project->montage_start_date ?? now();
        } elseif ($project->status === 'يجب إعادة المونتاج') {
            $updateData['status'] = 'في المونتاج';
        }

        $project->update($updateData);
        $project->refresh();

        // Timeline
        $msg = $isReassignment
            ? 'تم إعادة إسناد من: ' . ($oldProducer?->name ?? 'غير محدد') . " إلى: {$producer->name}"
            : "تم إسناد لممنتج المونتاج: {$producer->name}";

        $project->recordStatusChange($oldStatus, $project->status, $user->id, $msg);

        // Notification
        NotificationHelper::createMontageProducerAssignedNotification($project, $producer);

        // Sync archive
        MediaArchive::where('project_proposal_id', $project->id)
            ->update(['producer_name' => $producer->name]);

        // Load relations
        $project->load(['currency', 'assignedMontageProducer:id,name,phone_number']);

        $projectData = [
            'id'                             => $project->id,
            'status'                         => $project->status,
            'assigned_montage_producer'      => $project->assignedMontageProducer
                ? ['id' => $project->assignedMontageProducer->id, 'name' => $project->assignedMontageProducer->name]
                : null,
            'montage_producer_assigned_at'   => $project->montage_producer_assigned_at,
            'is_reassignment'                => $isReassignment,
        ];

        return [
            'success'         => true,
            'is_reassignment' => $isReassignment,
            'project'         => $projectData,
        ];
    }
}