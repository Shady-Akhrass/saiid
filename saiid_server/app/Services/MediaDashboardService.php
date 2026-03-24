<?php
// app/Services/MediaDashboardService.php

namespace App\Services;

use App\Models\ProjectProposal;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

class MediaDashboardService
{
    public function getData(User $user, bool $refresh = false): array
    {
        $cacheKey = CacheService::buildKey('media_dashboard', [
            'user_id' => $user->id,
            'role'    => 'media_manager',
        ]);

        if (!$refresh) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                return ['data' => $cached, 'cached' => true];
            }
        }

        $stats = $this->buildStats();

        Cache::put($cacheKey, $stats, CacheService::TTL_DASHBOARD);

        return ['data' => $stats, 'cached' => false];
    }

    // ─── Private ─────────────────────────────────────────

    private function buildStats(): array
    {
        $mediaStatuses = ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'وصل للمتبرع'];

        $baseQuery = ProjectProposal::forStatistics()
            ->whereIn('status', $mediaStatuses);

        $statusCounts = (clone $baseQuery)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $needsPhotographer = ProjectProposal::forStatistics()
            ->where('status', 'مسند لباحث')
            ->whereNull('assigned_photographer_id')
            ->count();

        $delayedMontage = ProjectProposal::forStatistics()->montageDelayed()->count();

        return [
            'needs_photographer'             => $needsPhotographer,
            'projects_needing_photographer'  => $this->getProjectsNeedingPhotographer(),
            'ready_for_montage'              => $statusCounts['تم التنفيذ'] ?? 0,
            'in_montage'                     => $statusCounts['في المونتاج'] ?? 0,
            'delayed_montage'                => $delayedMontage,
            'approaching_delay'              => count($this->getApproachingDelayProjects()),
            'completed'                      => $statusCounts['وصل للمتبرع'] ?? 0,
            'average_montage_duration'       => ProjectProposal::getAverageMontageDuration(),
            'delay_percentage'               => ProjectProposal::getMontageDelayPercentage(),
            'projects_by_type'               => (clone $baseQuery)
                ->selectRaw('project_type, COUNT(*) as count')
                ->groupBy('project_type')
                ->pluck('count', 'project_type')
                ->toArray(),
            'recent_ready_projects'          => $this->getRecentReadyProjects(),
            'delayed_projects'               => $this->getDelayedProjects(),
            'approaching_delay_projects'     => $this->getApproachingDelayProjects(),
        ];
    }

    private function getProjectsNeedingPhotographer(): array
    {
        return ProjectProposal::forStatistics()
            ->select([
                'id', 'serial_number', 'project_name', 'project_description',
                'donor_name', 'donor_code', 'internal_code', 'project_type',
                'currency_id', 'assigned_researcher_id', 'assignment_date', 'status',
            ])
            ->where('status', 'مسند لباحث')
            ->whereNull('assigned_photographer_id')
            ->with([
                'currency:id,currency_code,currency_name_ar',
                'assignedResearcher:id,name,phone_number',
            ])
            ->orderBy('assignment_date', 'DESC')
            ->limit(10)
            ->get()
            ->map(fn ($p) => [
                'id'                    => $p->id,
                'serial_number'         => $p->serial_number,
                'project_name'          => $p->project_name,
                'project_description'   => $p->project_description,
                'donor_name'            => $p->donor_name,
                'donor_code'            => $p->donor_code,
                'internal_code'         => $p->internal_code,
                'project_type'          => $p->project_type,
                'status'                => $p->status,
                'assignment_date'       => $p->assignment_date?->format('Y-m-d'),
                'days_since_assignment' => $p->assignment_date
                    ? Carbon::now()->diffInDays(Carbon::parse($p->assignment_date))
                    : null,
                'researcher'            => $p->assignedResearcher ? [
                    'id'           => $p->assignedResearcher->id,
                    'name'         => $p->assignedResearcher->name,
                    'phone_number' => $p->assignedResearcher->phone_number,
                ] : null,
            ])
            ->toArray();
    }

    private function getRecentReadyProjects(): array
    {
        return ProjectProposal::forStatistics()
            ->select([
                'id', 'serial_number', 'project_name', 'project_description',
                'donor_name', 'donor_code', 'internal_code', 'project_type',
                'execution_date', 'currency_id', 'shelter_id', 'assigned_photographer_id',
            ])
            ->where('status', 'تم التنفيذ')
            ->with([
                'currency:id,currency_code,currency_name_ar',
                'shelter:manager_id_number,camp_name',
                'photographer:id,name,phone_number',
            ])
            ->orderBy('execution_date', 'DESC')
            ->limit(10)
            ->get()
            ->map(fn ($p) => [
                'id'                   => $p->id,
                'serial_number'        => $p->serial_number,
                'project_name'         => $p->project_name,
                'project_description'  => $p->project_description,
                'donor_name'           => $p->donor_name,
                'project_type'         => $p->project_type,
                'execution_date'       => $p->execution_date?->format('Y-m-d'),
                'days_since_execution' => $p->execution_date
                    ? Carbon::now()->diffInDays(Carbon::parse($p->execution_date))
                    : null,
                'shelter'              => $p->shelter ? [
                    'camp_name'          => $p->shelter->camp_name,
                    'manager_id_number'  => $p->shelter->manager_id_number,
                ] : null,
                'photographer'         => $p->photographer ? [
                    'id'           => $p->photographer->id,
                    'name'         => $p->photographer->name,
                    'phone_number' => $p->photographer->phone_number,
                ] : null,
            ])
            ->toArray();
    }

    private function getDelayedProjects(): array
    {
        return ProjectProposal::montageDelayed()
            ->select(['id', 'serial_number', 'project_name', 'project_description', 'donor_name', 'donor_code', 'internal_code', 'media_received_date'])
            ->get()
            ->map(fn ($p) => [
                'id'                  => $p->id,
                'serial_number'       => $p->serial_number,
                'project_name'        => $p->project_name,
                'project_description' => $p->project_description,
                'donor_name'          => $p->donor_name,
                'days_late'           => Carbon::now()->diffInDays(Carbon::parse($p->media_received_date)) - 5,
                'media_received_date' => $p->media_received_date?->format('Y-m-d'),
            ])
            ->values()
            ->toArray();
    }

    private function getApproachingDelayProjects(): array
    {
        return ProjectProposal::where('status', 'في المونتاج')
            ->whereNotNull('media_received_date')
            ->whereRaw('DATEDIFF(NOW(), media_received_date) BETWEEN 3 AND 5')
            ->select(['id', 'serial_number', 'project_name', 'donor_name', 'donor_code', 'internal_code', 'media_received_date'])
            ->get()
            ->map(fn ($p) => [
                'id'                  => $p->id,
                'serial_number'       => $p->serial_number,
                'project_name'        => $p->project_name,
                'donor_name'          => $p->donor_name,
                'days_remaining'      => $p->getDaysRemainingBeforeDelay(),
                'media_received_date' => $p->media_received_date?->format('Y-m-d'),
            ])
            ->values()
            ->toArray();
    }
}