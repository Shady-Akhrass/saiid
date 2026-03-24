<?php
// app/Services/AdvancedUpdateService.php

namespace App\Services;

use App\Models\ProjectProposal;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AdvancedUpdateService
{
    private const WAREHOUSE_RELATIONS = ['confirmedWarehouseItems.warehouseItem'];

    /**
     * @return array{success: bool, data?: ProjectProposal, error?: string, code?: int}
     */
    public function update(int $projectId, Request $request, User $user): array
    {
        try {
            DB::beginTransaction();

            $project = ProjectProposal::findOrFail($projectId);
            $oldStatus = $project->status;

            // Process data via existing service logic
            $updateData = $this->processUpdateData($request, $project);

            // Handle Status Revert (Warehouse cleanup)
            if (isset($updateData['status']) && $updateData['status'] !== $oldStatus) {
                $this->handleStatusRevert($project, $updateData['status'], $user->id);
            }

            // Perform Update
            if (!empty($updateData)) {
                $this->performDbUpdate($project, $updateData, $oldStatus, $user, $request);
            }

            DB::commit();

            // Sync Children
            if ($project->isParentProject()) {
                $this->syncChildProjects($project, $updateData, $request);
            }

            // Sync Orphans ifExecuted
            if ($project->status === 'تم التنفيذ' && $project->isSponsorshipProject()) {
                $this->syncOrphans($project, $request);
            }

            return ['success' => true, 'data' => $project->fresh()];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Advanced update failed', ['id' => $projectId, 'error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage(), 'code' => 500];
        }
    }

    /**
     * Change status directly
     */
    public function changeStatus(int $projectId, string $newStatus, string $note, User $user, Request $request = null): array
    {
        try {
            DB::beginTransaction();

            $project = ProjectProposal::findOrFail($projectId);
            $oldStatus = $project->status;

            // Cleanup for revert
            $this->handleStatusRevert($project, $newStatus, $user->id);

            // Get date updates
            $dateUpdates = $this->getStatusDateUpdates($newStatus);

            // Update
            $updateData = array_merge(['status' => $newStatus], $dateUpdates);
            
            // If marking as executed via status change, we might have an execution date
            if ($newStatus === 'تم التنفيذ' && $request && $request->has('execution_date')) {
                $updateData['execution_date'] = $request->input('execution_date');
            }

            // ✅ Filter date column safety
            $fillable = $project->getFillable();
            $filteredData = array_intersect_key($updateData, array_flip($fillable));
            $filteredData['status'] = $newStatus; // Ensure status is there

            DB::table('project_proposals')->where('id', $project->id)->update($filteredData);

            if ($oldStatus !== $newStatus) {
                $project->recordStatusChange($oldStatus, $newStatus, $user->id, $note);
            }

            // Sync Orphans if Executed
            if ($newStatus === 'تم التنفيذ' && $project->isSponsorshipProject() && $request) {
                $this->syncOrphans($project, $request);
            }

            DB::commit();

            return [
                'success' => true,
                'data' => $project->fresh(),
                'old_status' => $oldStatus,
                'new_status' => $newStatus
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            return ['success' => false, 'error' => $e->getMessage(), 'code' => 500];
        }
    }

    // ─── Private Helpers ─────────────────────────────────

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
        Log::info('Orphans synced for project', ['project_id' => $project->id, 'count' => count($orphanIds)]);
    }

    private function handleStatusRevert(ProjectProposal $project, string $newStatus, int $userId): void
    {
        // Check if reverting to pre-execution state requires warehouse return
        // (This logic mimics ProjectProposalService::cleanDataForStatusRevert)
        // Simplified here for clarity:
        if ($this->isRevertToBeforeExecution($project->status, $newStatus)) {
            $project->load(self::WAREHOUSE_RELATIONS);
            
            foreach ($project->confirmedWarehouseItems as $item) {
                if ($item->warehouseItem) {
                    $qty = $item->quantity_per_unit * ($project->quantity ?? 1);
                    $item->warehouseItem->addQuantity($qty, $userId);
                }
            }
            
            $project->warehouseItems()->delete();
        }
    }

    private function isRevertToBeforeExecution(string $old, string $new): bool
    {
        // Example logic: if moving from "Executed" back to "New/Supply"
        $after = ['تم التنفيذ', 'في المونتاج', 'منتهي'];
        $before = ['جديد', 'قيد التوريد', 'جاهز للتنفيذ'];
        
        return in_array($old, $after) && in_array($new, $before);
    }

    private function performDbUpdate(ProjectProposal $project, array $data, string $oldStatus, User $user, Request $request): void
    {
        // ✅ List of keys to exclude from project_proposals table update
        // These keys are handled separately (e.g., syncOrphans) or are not DB columns
        $excludeKeys = [
            'selected_orphan_ids',
            'sponsorship_start_date',
            'sponsorship_end_date',
            'sponsorship_amount',
            'orphan_notes',
            'orphan_group_id',
            'status_change_note'
        ];

        // ✅ Filter data to only include valid columns (fillable)
        $fillable = $project->getFillable();
        $filteredData = array_filter($data, function ($key) use ($fillable, $excludeKeys) {
            return in_array($key, $fillable) && !in_array($key, $excludeKeys);
        }, ARRAY_FILTER_USE_KEY);

        if (isset($data['status'])) {
            $filteredData['status'] = $data['status']; // Ensure status is included
            DB::table('project_proposals')->where('id', $project->id)->update($filteredData);
            
            if ($oldStatus !== $data['status']) {
                $note = $request->input('status_change_note', 'تم تغيير الحالة من لوحة الإدارة المتقدمة');
                $project->recordStatusChange($oldStatus, $data['status'], $user->id, $note);
            }
        } else {
            $project->update($filteredData);
        }
    }

    private function syncChildProjects(ProjectProposal $project, array $data, Request $request): void
    {
        $fields = array_keys($data);
        foreach (['project_name', 'phase_duration_days', 'phase_start_date'] as $f) {
            if ($request->has($f)) $fields[] = $f;
        }
        $project->refresh()->updateChildProjects($fields);
    }

    // Placeholder for actual service logic
    private function processUpdateData(Request $request, ProjectProposal $project): array
    {
        // Call ProjectProposalService logic here
        // For refactoring, we assume input is already clean or cleaned here
        return $request->except(['_token', '_method']);
    }

    private function getStatusDateUpdates(string $status): array
    {
        $updates = [];
        if ($status === 'تم التوريد') {
            $updates = [
                'assigned_researcher_id' => null,
                'assigned_photographer_id' => null,
                'assigned_by' => null,
                'assignment_date' => null,
            ];
        }
        return $updates;
    }
}