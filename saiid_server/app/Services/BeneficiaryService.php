<?php
// app/Services/BeneficiaryService.php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\ProjectProposal;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class BeneficiaryService
{
    /**
     * @return array{success: bool, project?: array, error?: string, code?: int}
     */
    public function updateCounts(int $projectId, int $count, int $perUnit, User $user): array
    {
        $project = ProjectProposal::findOrFail($projectId);

        // Authorization check
        if ($user->role === UserRole::ORPHAN_SPONSOR_COORDINATOR->value) {
            if (!$project->isSponsorshipProject()) {
                return ['success' => false, 'error' => 'مشاريع كفالات فقط', 'code' => 403];
            }
            if ($this->isBeforeSupply($project->status)) {
                return ['success' => false, 'error' => 'مرحلة التوريد أو بعدها فقط', 'code' => 403];
            }
        }

        // Update
        $project->beneficiaries_count = $count;
        $project->beneficiaries_per_unit = $perUnit;
        $project->save();

        return [
            'success' => true,
            'project' => [
                'id' => $project->id,
                'beneficiaries_count' => $project->beneficiaries_count,
                'beneficiaries_per_unit' => $project->beneficiaries_per_unit,
                'calculated_beneficiaries' => $project->calculated_beneficiaries,
            ],
        ];
    }

    public function getExecutedProjects(int $page, int $perPage, ?string $search, User $user): array
    {
        $query = ProjectProposal::query()
            ->with(['subcategory:id,name_ar', 'shelter:manager_id_number,camp_name', 'executedProject.shelter']);

        if ($user->role === UserRole::EXECUTED_PROJECTS_COORDINATOR->value) {
            $query->where(function ($q) {
                $q->where('is_daily_phase', true)
                    ->orWhere('is_monthly_phase', true)
                    ->orWhere(fn ($sq) => $sq->where('is_divided_into_phases', false)->orWhereNull('is_divided_into_phases'));
            });
        }

        $executedStatuses = ['تم التنفيذ', 'منفذ', 'في المونتاج', 'تم المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];
        $query->whereIn('status', $executedStatuses);

        if ($search && strlen($search) >= 2) {
            $query->where(function ($q) use ($search) {
                $q->where('project_name', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%")
                    ->orWhere('donor_code', 'like', "%{$search}%");
            });
        }

        $query->orderBy('execution_date', 'desc');

        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        return [
            'projects' => $this->formatExecutedProjects($paginated->items()),
            'pagination' => [
                'total' => $paginated->total(),
                'per_page' => $paginated->perPage(),
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
            ]
        ];
    }

    private function isBeforeSupply(string $status): bool
    {
        return in_array($status, ['جديد']);
    }

    private function formatExecutedProjects(array $projects): array
    {
        return array_map(function ($p) {
            return [
                'id' => $p->id,
                'serial_number' => $p->serial_number,
                'project_name' => $p->project_name,
                'camp_name' => $p->shelter->camp_name ?? $p->executedProject->shelter->camp_name ?? 'غير محدد',
                'aid_type' => $p->subcategory->name_ar ?? $p->executedProject->aid_type ?? 'غير محدد',
                'execution_date' => $p->execution_date,
                'status' => $p->status,
            ];
        }, $projects);
    }
}