<?php
// app/Services/ProjectDataCleaner.php

namespace App\Services;

class ProjectDataCleaner
{
    private const IMPORTANT_FIELDS = [
        'is_divided_into_phases',
        'phase_type',
        'phase_duration_days',
        'total_months',
        'phase_start_date',
        'is_daily_phase',
        'is_monthly_phase',
        'parent_project_id',
        'phase_day',
        'month_number',
        'month_start_date',
    ];

    public function clean(array $data): array
    {
        $cleaned = [];

        foreach ($data as $key => $value) {
            if (in_array($key, self::IMPORTANT_FIELDS)) {
                $cleaned[$key] = $value;
            } elseif ($value === false || $value === 0 || $value === '0') {
                $cleaned[$key] = $value;
            } elseif ($value !== null && $value !== '') {
                $cleaned[$key] = $value;
            }
        }

        return $cleaned;
    }
}