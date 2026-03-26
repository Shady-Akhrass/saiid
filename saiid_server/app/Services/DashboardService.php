<?php
// app/Services/DashboardService.php

namespace App\Services;

use App\Models\ProjectProposal;
use Illuminate\Support\Facades\Log;

class DashboardService
{
    public function getAdminDashboard(array $filters = []): array
    {
        $baseQuery = ProjectProposal::forSurplusStatistics();

        // Apply filters if provided
        if (!empty($filters['start_date'])) {
            $baseQuery->where('created_at', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $baseQuery->where('created_at', '<=', $filters['end_date'] . ' 23:59:59');
        }
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $baseQuery->whereIn('status', (array)$filters['status']);
        }
        if (!empty($filters['project_type']) && $filters['project_type'] !== 'all') {
            $baseQuery->whereIn('project_type', (array)$filters['project_type']);
        }

        // Use the same base query for counting to ensure consistency
        $totalProjects = (clone $baseQuery)->count();

        // Use stored columns for accuracy and consistency with project-level calculations
        $totalValueUsd = (clone $baseQuery)->sum('amount_in_usd');
        $totalNetAmount = (clone $baseQuery)->sum('net_amount');

        $projectsByStatus = (clone $baseQuery)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $projectsByType = (clone $baseQuery)
            ->selectRaw('project_type, COUNT(*) as count')
            ->groupBy('project_type')
            ->pluck('count', 'project_type')
            ->toArray();

        $delayedExecution = ProjectProposal::forStatistics()->delayed()->count();
        $delayedMedia = ProjectProposal::forStatistics()->montageDelayed()->count();

        $recentProjects = $this->getRecentProjects();

        $this->logDashboardStats($totalProjects, $totalValueUsd, $totalNetAmount, $baseQuery);

        return [
            'total_projects'              => $totalProjects,
            'total_value_usd'             => round($totalValueUsd, 2),
            'total_net_amount'            => round($totalNetAmount, 2),
            'total_amount_before_discount'=> round($totalValueUsd, 2),
            'projects_by_status'          => $projectsByStatus,
            'projects_by_type'            => $projectsByType,
            'delayed_execution'           => $delayedExecution,
            'delayed_media'               => $delayedMedia,
            'recent_projects'             => $recentProjects,
        ];
    }

    // ─── Private ─────────────────────────────────────────

    /*
    private function countTotalProjects(): int
    {
        return ProjectProposal::where(function ($q) {
            $q->where(function ($nonDivided) {
                $nonDivided->where('is_divided_into_phases', false)
                    ->orWhereNull('is_divided_into_phases');
            })->orWhere(function ($child) {
                $child->where('is_daily_phase', true)
                    ->orWhere('is_monthly_phase', true)
                    ->orWhereNotNull('parent_project_id')
                    ->orWhereNotNull('phase_day')
                    ->orWhereNotNull('month_number');
            });
        })->count();
    }
    */

    private function getRecentProjects(): array
    {
        return ProjectProposal::forStatistics()
            ->select([
                'id', 'serial_number', 'project_description', 'donor_name',
                'donor_code', 'internal_code', 'project_type', 'amount_in_usd',
                'net_amount', 'status', 'currency_id', 'created_by', 'created_at',
            ])
            ->with([
                'currency:id,currency_code,currency_name_ar',
                'creator:id,name',
            ])
            ->orderBy('created_at', 'DESC')
            ->limit(10)
            ->get()
            ->map(fn ($p) => [
                'id'                  => $p->id,
                'serial_number'       => $p->serial_number,
                'project_description' => $p->project_description,
                'donor_name'          => $p->donor_name,
                'project_type'        => $p->project_type,
                'amount_in_usd'       => $p->amount_in_usd,
                'net_amount'          => $p->net_amount,
                'status'              => $p->status,
                'created_at'          => $p->created_at->format('Y-m-d H:i:s'),
                'currency'            => $p->currency ? [
                    'code'    => $p->currency->currency_code,
                    'name_ar' => $p->currency->currency_name_ar,
                ] : null,
                'creator'             => $p->creator ? [
                    'id'   => $p->creator->id,
                    'name' => $p->creator->name,
                ] : null,
            ])
            ->toArray();
    }

    private function logDashboardStats(
        int $total,
        float $totalUsd,
        float $netAmount,
        $baseQuery,
    ): void {
        $sample = (clone $baseQuery)
            ->select('id', 'serial_number', 'donation_amount', 'exchange_rate',
                'is_divided_into_phases', 'is_daily_phase', 'is_monthly_phase')
            ->limit(20)
            ->get();

        Log::info('Dashboard Statistics', [
            'total_projects'   => $total,
            'total_value_usd'  => $totalUsd,
            'total_net_amount' => $netAmount,
            'sample_count'     => $sample->count(),
        ]);
    }
}