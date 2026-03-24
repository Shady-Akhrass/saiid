<?php
// app/Services/MediaStatusService.php

namespace App\Services;

use App\Helpers\NotificationHelper;
use App\Models\ProjectProposal;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MediaStatusService
{
    private const REJECTION_STATUSES = ['معاد مونتاجه', 'يجب إعادة المونتاج'];

    private const MEDIA_RELATIONS = [
        'currency', 'shelter', 'projectType', 'subcategory',
        'assignedToTeam', 'assignedResearcher', 'photographer',
        'assignedMontageProducer',
    ];

    // ═══════════════════════════════════════════════════════
    //  SINGLE UPDATE
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{success: bool, project?: ProjectProposal, old_status?: string, new_status?: string, error?: string, code?: int}
     */
    public function updateStatus(
        int $projectId,
        string $status,
        User $user,
        ?string $notes = null,
        ?string $rejectionReason = null,
    ): array {
        $project = ProjectProposal::findOrFail($projectId);

        $oldStatus = $project->status;
        $updateData = $this->buildUpdateData($project, $status, $notes, $rejectionReason);

        $project->update($updateData);
        $project = $project->fresh();
        $project->load(self::MEDIA_RELATIONS);

        $newStatus = $project->status;

        // Timeline
        $project->recordStatusChange($oldStatus, $newStatus, $user->id, $notes);

        // Notifications
        NotificationHelper::createMediaUpdatedNotification($project, $status, $notes);

        if ($oldStatus !== $newStatus) {
            NotificationHelper::createProjectStatusChangedNotification($project, $oldStatus, $newStatus);
        }

        return [
            'success'          => true,
            'project'          => $project,
            'old_status'       => $oldStatus,
            'new_status'       => $newStatus,
            'old_media_status' => $oldStatus,
            'new_media_status' => $status,
        ];
    }

    // ═══════════════════════════════════════════════════════
    //  BATCH UPDATE
    // ═══════════════════════════════════════════════════════

    /**
     * @return array{updated: ProjectProposal[], failed: array}
     */
    public function batchUpdate(
        array $projectIds,
        string $status,
        User $user,
        ?string $notes = null,
        ?string $rejectionReason = null,
    ): array {
        $projects = ProjectProposal::whereIn('id', $projectIds)->get();

        $updated = [];
        $failed = [];

        foreach ($projects as $project) {
            try {
                DB::transaction(function () use (
                    $project, $status, $user, $notes, $rejectionReason, &$updated
                ) {
                    $oldStatus = $project->status;
                    $updateData = $this->buildUpdateData($project, $status, $notes, $rejectionReason);

                    $project->update($updateData);
                    $project->refresh();
                    $project->load(self::MEDIA_RELATIONS);

                    $newStatus = $project->status;

                    $project->recordStatusChange($oldStatus, $newStatus, $user->id, $notes);
                    NotificationHelper::createMediaUpdatedNotification($project, $status, $notes);

                    if ($oldStatus !== $newStatus) {
                        NotificationHelper::createProjectStatusChangedNotification($project, $oldStatus, $newStatus);
                    }

                    $updated[] = $project;
                });
            } catch (\Exception $e) {
                Log::error('batchUpdateStatus failed for project', [
                    'project_id' => $project->id,
                    'status'     => $status,
                    'error'      => $e->getMessage(),
                ]);

                $failed[] = [
                    'project_id' => $project->id,
                    'error'      => $e->getMessage(),
                ];
            }
        }

        return ['updated' => $updated, 'failed' => $failed];
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE
    // ═══════════════════════════════════════════════════════

    private function buildUpdateData(
        ProjectProposal $project,
        string $status,
        ?string $notes,
        ?string $rejectionReason,
    ): array {
        $data = ['status' => $status];

        if ($notes !== null) {
            $data['media_notes'] = $notes;
        }

        // Rejection reason
        if (in_array($status, self::REJECTION_STATUSES) && $rejectionReason) {
            $data['rejection_reason'] = $rejectionReason;
        }

        // Date updates based on status
        $this->applyDateUpdates($data, $project, $status);

        return $data;
    }

    private function applyDateUpdates(array &$data, ProjectProposal $project, string $status): void
    {
        switch ($status) {
            case 'في المونتاج':
                if (!$project->montage_start_date) {
                    $data['montage_start_date'] = now();
                }
                break;

            case 'تم المونتاج':
                $data['montage_completed_date'] = now();
                $data['montage_completed_at'] = now();
                break;

            case 'معاد مونتاجه':
            case 'يجب إعادة المونتاج':
                $data['montage_start_date'] = null;
                $data['montage_completed_date'] = null;
                $data['montage_completed_at'] = null;
                break;

            case 'وصل للمتبرع':
                $data['sent_to_donor_date'] = now();
                $data['delivered_to_donor_at'] = now();
                break;
        }
    }
}