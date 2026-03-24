<?php
// app/Services/WarehouseReturnService.php

namespace App\Services;

use App\Enums\ProjectStatusGroup;
use App\Models\ProjectProposal;
use App\Models\User;

class WarehouseReturnService
{
    /**
     * Return confirmed warehouse items for a project if eligible.
     *
     * @return bool Whether items were actually returned
     */
    public function returnItemsIfEligible(ProjectProposal $project, int $userId): bool
    {
        if (!$this->shouldReturnItems($project)) {
            return false;
        }

        $this->returnItems($project, $userId);
        return true;
    }

    public function shouldReturnItems(ProjectProposal $project): bool
    {
        return ProjectStatusGroup::isBeforeExecution($project->status)
            && !ProjectStatusGroup::isAfterExecution($project->status)
            && $project->confirmedWarehouseItems->isNotEmpty();
    }

    public function returnItems(ProjectProposal $project, int $userId): void
    {
        foreach ($project->confirmedWarehouseItems as $item) {
            $totalNeeded = $item->quantity_per_unit * ($project->quantity ?? 1);
            $item->warehouseItem->addQuantity($totalNeeded, $userId);
        }
    }
}