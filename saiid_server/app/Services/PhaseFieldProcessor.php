<?php
// app/Services/PhaseFieldProcessor.php

namespace App\Services;

use App\Enums\PhaseType;
use App\Traits\NormalizesInput;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PhaseFieldProcessor
{
    use NormalizesInput;

    public function process(Request $request, array $data): array
    {
        $fields = [
            'phase_type'          => fn() => $this->extractPhaseType($request),
            'total_months'        => fn() => $this->extractPositiveInt($request, 'total_months'),
            'phase_duration_days' => fn() => $this->extractPhaseDuration($request, $data),
            'phase_start_date'    => fn() => $this->extractPhaseStartDate($request, $data),
        ];

        foreach ($fields as $column => $extractor) {
            if (!$this->columnExists('project_proposals', $column)) {
                continue;
            }

            $value = $extractor();
            if ($value !== '__skip__') {
                $data[$column] = $value;
            }
        }

        return $data;
    }

    private function extractPhaseType(Request $request): string|null
    {
        $val = $request->input('phase_type');
        if ($val && in_array($val, PhaseType::all())) {
            return $val;
        }
        return '__skip__';
    }

    private function extractPositiveInt(Request $request, string $key): int|string
    {
        $val = $request->input($key);
        if ($val !== null && $val !== '' && is_numeric($val) && (int)$val > 0) {
            return (int) $val;
        }
        return '__skip__';
    }

    private function extractPhaseDuration(Request $request, array $data): int|null|string
    {
        $val = $request->input('phase_duration_days');
        if ($val !== null && $val !== '' && is_numeric($val) && (int)$val > 0) {
            return (int) $val;
        }

        $isDivided = $data['is_divided_into_phases'] ?? false;
        $type      = $data['phase_type'] ?? null;

        if ($isDivided && $type === PhaseType::DAILY) {
            Log::warning('phase_duration_days missing for daily divided project');
            return '__skip__';
        }

        return null;
    }

    private function extractPhaseStartDate(Request $request, array $data): string|null
    {
        $val = $request->input('phase_start_date');
        if ($val !== null && $val !== '') {
            return $val;
        }

        $isDivided = $data['is_divided_into_phases'] ?? false;
        if (!$isDivided) {
            return null;
        }

        return '__skip__';
    }
}