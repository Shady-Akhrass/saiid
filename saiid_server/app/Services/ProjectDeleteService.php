<?php
// app/Services/ProjectDeleteService.php

namespace App\Services;

use App\Enums\ProjectStatusGroup;
use App\Models\ProjectProposal;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProjectDeleteService
{
    public function __construct(
        protected WarehouseReturnService $warehouseService
    ) {}

    /**
     * @return array{success: bool, message: string, items_returned: bool, status_before: string}
     */
    public function delete(int $projectId, User $user): array
    {
        $project = ProjectProposal::with(['confirmedWarehouseItems.warehouseItem'])
            ->findOrFail($projectId);

        DB::beginTransaction();

        try {
            $itemsReturned = $this->warehouseService->returnItemsIfEligible($project, $user->id);

            if ($project->is_divided_into_phases) {
                $this->returnChildWarehouseItems($project, $user->id);
                $project->deleteDailyPhases();
            }

            $statusBefore = $project->status;
            $hadItems = $project->confirmedWarehouseItems->isNotEmpty();

            $project->delete();
            DB::commit();

            return [
                'success'        => true,
                'message'        => $this->buildDeleteMessage($statusBefore, $itemsReturned, $hadItems),
                'items_returned' => $itemsReturned,
                'status_before'  => $statusBefore,
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to delete project', [
                'project_id' => $projectId,
                'error'      => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function returnChildWarehouseItems(ProjectProposal $project, int $userId): void
    {
        $children = $project->dailyPhases()
            ->select(['id', 'parent_project_id', 'status', 'quantity'])
            ->with(['confirmedWarehouseItems.warehouseItem:id,item_name,quantity_available'])
            ->get();

        foreach ($children as $child) {
            $this->warehouseService->returnItemsIfEligible($child, $userId);
        }
    }

    private function buildDeleteMessage(string $status, bool $itemsReturned, bool $hadItems): string
    {
        $message = 'تم حذف المشروع بنجاح';

        if ($itemsReturned) {
            $message .= ' وتم إرجاع الأصناف للمخزن';
        } elseif (ProjectStatusGroup::isAfterExecution($status) && $hadItems) {
            $message .= ' (لم يتم إرجاع الأصناف لأن المشروع تم تنفيذه)';
        }

        return $message;
    }
}