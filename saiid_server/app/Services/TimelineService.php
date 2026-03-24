<?php
// app/Services/TimelineService.php

namespace App\Services;

use App\Models\ProjectProposal;

class TimelineService
{
    /**
     * @return array{timeline: array, total: int, currentPage: int, totalPages: int, perPage: int}
     */
    public function getTimeline(int $projectId, int $perPage = 50, int $page = 1): array
    {
        $project = ProjectProposal::findOrFail($projectId);

        $perPage = min($perPage, 100);

        $paginated = $project->timeline()
            ->select(['id', 'project_id', 'old_status', 'new_status', 'changed_by', 'notes', 'created_at'])
            ->with('changedBy:id,name')
            ->orderBy('created_at', 'DESC')
            ->paginate($perPage, ['*'], 'page', $page);

        $formatted = $paginated->getCollection()->map(function ($item) {
            return [
                'id'              => $item->id,
                'project_id'      => $item->project_id,
                'old_status'      => $item->old_status,
                'new_status'      => $item->new_status,
                'changed_by'      => $item->changed_by,
                'changed_by_name' => $item->changedBy?->name,
                'changed_by_user' => $item->changedBy
                    ? ['id' => $item->changedBy->id, 'name' => $item->changedBy->name]
                    : null,
                'notes'           => $item->notes,
                'created_at'      => $item->created_at,
            ];
        });

        return [
            'timeline'    => $formatted->values()->all(),
            'total'       => $paginated->total(),
            'currentPage' => $paginated->currentPage(),
            'totalPages'  => $paginated->lastPage(),
            'perPage'     => $paginated->perPage(),
        ];
    }
}