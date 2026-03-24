<?php
// app/Services/MediaReportingService.php

namespace App\Services;

use App\Models\ProjectProposal;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class MediaReportingService
{
    // Caching configuration
    private const TTL_REALTIME = 30; // seconds

    /**
     * Get new projects needing photographer assignment
     */
    public function getProjectsNeedingPhotographer(
        int $userId,
        int $page = 1,
        int $perPage = 15,
        string $searchQuery = '',
        bool $refresh = false
    ): array {
        // Build cache key
        $cacheKey = CacheService::buildKey('media_projects_needing_photographer', [
            'user_id'  => $userId,
            'page'     => $page,
            'per_page' => $perPage,
            'search'   => substr(md5($searchQuery), 0, 8),
        ]);

        // Return cached if no search & not refresh
        if (empty($searchQuery) && !$refresh) {
            $cachedData = Cache::get($cacheKey);
            if ($cachedData !== null) {
                return ['data' => $cachedData, 'cached' => true];
            }
        }

        // Build Query
        $query = ProjectProposal::where('status', 'مسند لباحث')
            ->whereNotNull('assigned_researcher_id')
            ->whereNull('assigned_photographer_id');

        if (!empty($searchQuery)) {
            $query->where(function ($q) use ($searchQuery) {
                $q->where('project_name', 'LIKE', "%{$searchQuery}%")
                    ->orWhere('serial_number', 'LIKE', "%{$searchQuery}%")
                    ->orWhere('donor_code', 'LIKE', "%{$searchQuery}%")
                    ->orWhere('internal_code', 'LIKE', "%{$searchQuery}%")
                    ->orWhere('donor_name', 'LIKE', "%{$searchQuery}%");
            });
        }

        // Fetch paginated results
        $projects = $query->select([
            'id', 'serial_number', 'project_name', 'project_description',
            'donor_name', 'donor_code', 'internal_code', 'project_type',
            'currency_id', 'assigned_researcher_id', 'assignment_date', 'status',
            'donation_amount', 'net_amount', 'amount_in_usd',
        ])
        ->with([
            'currency:id,currency_code,currency_name_ar',
            'assignedResearcher:id,name,phone_number',
            'assignedBy:id,name',
        ])
        ->orderBy('assignment_date', 'DESC')
        ->paginate($perPage, ['*'], 'page', $page);

        // Transform data
        $data = $this->transformProjectsData($projects);

        // Cache result
        if (empty($searchQuery)) {
            Cache::put($cacheKey, $data, self::TTL_REALTIME);
        }

        return ['data' => $data, 'cached' => false];
    }

    /**
     * Generate Media Reports
     */
    public function generateReport(?string $month, ?string $year, ?string $projectType): array
    {
        // Completed Projects Query (excluding child projects)
        $query = ProjectProposal::forStatistics()
            ->where('status', 'وصل للمتبرع')
            ->whereNotNull('montage_start_date')
            ->whereNotNull('montage_completed_date');

        if ($month) {
            $query->whereYear('montage_completed_date', Carbon::parse($month)->year)
                ->whereMonth('montage_completed_date', Carbon::parse($month)->month);
        } elseif ($year) {
            $query->whereYear('montage_completed_date', $year);
        }

        if ($projectType) {
            $query->where('project_type', $projectType);
        }

        $completedCount = $query->count();
        $averageDuration = $this->calculateAverageDuration($query, $completedCount);

        // Calculate Delayed Percentage
        $delayedCount = $this->countDelayedProjects($month, $year, $projectType);
        $totalMontage = $completedCount + $delayedCount;
        $delayPercentage = $totalMontage > 0
            ? round(($delayedCount / $totalMontage) * 100, 2)
            : 0;

        // Group by Type
        $byType = (clone $query)
            ->selectRaw('project_type, COUNT(*) as count')
            ->groupBy('project_type')
            ->pluck('count', 'project_type')
            ->toArray();

        // Monthly Trend
        $monthlyTrend = $this->generateMonthlyTrend($month, $projectType);

        return [
            'month'            => $month,
            'year'             => $year,
            'project_type'     => $projectType,
            'completed_count'  => $completedCount,
            'average_duration' => $averageDuration,
            'delay_percentage' => $delayPercentage,
            'by_type'          => $byType,
            'monthly_trend'    => $monthlyTrend,
        ];
    }

    // ─── Private Helpers ─────────────────────────────────

    private function transformProjectsData($projects): array
    {
        $items = $projects->map(fn ($p) => [
            'id'                    => $p->id,
            'serial_number'         => $p->serial_number,
            'project_name'          => $p->project_name,
            'project_description'   => $p->project_description,
            'donor_name'            => $p->donor_name,
            'donor_code'            => $p->donor_code,
            'internal_code'         => $p->internal_code,
            'project_type'          => $p->project_type,
            'status'                => $p->status,
            'donation_amount'       => $p->donation_amount,
            'net_amount'            => $p->net_amount,
            'amount_in_usd'         => $p->amount_in_usd,
            'assignment_date'       => $p->assignment_date?->format('Y-m-d H:i:s'),
            'days_since_assignment' => $p->assignment_date
                ? Carbon::now()->diffInDays($p->assignment_date)
                : null,
            'currency'              => $p->currency ? [
                'id'   => $p->currency->id,
                'code' => $p->currency->currency_code,
                'name' => $p->currency->currency_name_ar,
            ] : null,
            'researcher'            => $p->assignedResearcher ? [
                'id'           => $p->assignedResearcher->id,
                'name'         => $p->assignedResearcher->name,
                'phone_number' => $p->assignedResearcher->phone_number,
            ] : null,
            'assigned_by'           => $p->assignedBy ? [
                'id'   => $p->assignedBy->id,
                'name' => $p->assignedBy->name,
            ] : null,
        ]);

        return [
            'data'       => $items,
            'pagination' => [
                'current_page' => $projects->currentPage(),
                'last_page'    => $projects->lastPage(),
                'per_page'     => $projects->perPage(),
                'total'        => $projects->total(),
                'from'         => $projects->firstItem(),
                'to'           => $projects->lastItem(),
            ],
        ];
    }

    private function calculateAverageDuration($query, int $count): float
    {
        if ($count === 0) return 0;

        $result = (clone $query)
            ->selectRaw('AVG(DATEDIFF(montage_completed_date, montage_start_date)) as avg_duration')
            ->first();

        return $result && $result->avg_duration ? round($result->avg_duration, 2) : 0;
    }

    private function countDelayedProjects(?string $month, ?string $year, ?string $type): int
    {
        $query = ProjectProposal::forStatistics()->montageDelayed();

        if ($month) {
            $query->whereYear('media_received_date', Carbon::parse($month)->year)
                ->whereMonth('media_received_date', Carbon::parse($month)->month);
        } elseif ($year) {
            $query->whereYear('media_received_date', $year);
        }

        if ($type) {
            $query->where('project_type', $type);
        }

        return $query->count();
    }

    private function generateMonthlyTrend(?string $month, ?string $type): array
    {
        $trend = [];
        $start = $month ? Carbon::parse($month)->subMonths(5) : Carbon::now()->subMonths(5);
        $end = $month ? Carbon::parse($month) : Carbon::now();

        for ($date = $start->copy(); $date <= $end; $date->addMonth()) {
            $query = ProjectProposal::forStatistics()
                ->where('status', 'وصل للمتبرع')
                ->whereNotNull('montage_completed_date')
                ->whereYear('montage_completed_date', $date->year)
                ->whereMonth('montage_completed_date', $date->month);

            if ($type) {
                $query->where('project_type', $type);
            }

            $count = $query->count();
            $avg = $this->calculateAverageDuration($query, $count);

            $trend[] = [
                'month'            => $date->format('Y-m'),
                'completed_count'  => $count,
                'average_duration' => $avg,
            ];
        }

        return $trend;
    }
}