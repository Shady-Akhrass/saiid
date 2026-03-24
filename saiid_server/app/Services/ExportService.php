<?php
// app/Services/ExportService.php

namespace App\Services;

use App\Exports\ProjectProposalsExport;
use App\Models\ProjectProposal;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ExportService
{
    /**
     * @return BinaryFileResponse|array{error: string, code: int}
     */
    public function export(Request $request)
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $statusInput = $request->query('statuses');
        $projectType = $request->query('project_type');

        // Validation
        $validationError = $this->validateDates($startDate, $endDate);
        if ($validationError) return $validationError;

        // Normalize statuses
        $statuses = $this->normalizeStatuses($statusInput, $request->query('status'));

        // Check if data exists
        if (!$this->hasData($startDate, $endDate, $statuses, $projectType)) {
            return ['error' => 'لا توجد مشاريع للتصدير', 'code' => 404];
        }

        // Generate filename
        $fileName = $this->generateFilename($startDate, $endDate, $statuses, $projectType);

        return Excel::download(
            new ProjectProposalsExport($startDate, $endDate, $statuses, $projectType),
            $fileName
        );
    }

    private function validateDates(?string $start, ?string $end): ?array
    {
        if ($start && !strtotime($start)) return ['error' => 'تاريخ البداية غير صحيح', 'code' => 400];
        if ($end && !strtotime($end)) return ['error' => 'تاريخ النهاية غير صحيح', 'code' => 400];
        if ($start && $end && strtotime($start) > strtotime($end)) {
            return ['error' => 'تاريخ البداية يجب أن يكون قبل النهاية', 'code' => 400];
        }
        return null;
    }

    private function normalizeStatuses($statuses, ?string $singleStatus): array
    {
        $result = [];

        if (is_array($statuses)) {
            $result = $statuses;
        } elseif (is_string($statuses)) {
            $decoded = json_decode($statuses, true);
            $result = (json_last_error() === JSON_ERROR_NONE && is_array($decoded))
                ? $decoded
                : array_map('trim', explode(',', $statuses));
        }

        if (empty($result) && $singleStatus && !in_array($singleStatus, ['all', 'الكل'])) {
            $result = [$singleStatus];
        }

        return array_filter($result, fn ($s) => !empty($s) && !in_array($s, ['all', 'الكل']));
    }

    private function hasData(?string $start, ?string $end, array $statuses, ?string $type): bool
    {
        $query = ProjectProposal::query();

        if ($start) $query->whereDate('created_at', '>=', $start);
        if ($end) $query->whereDate('created_at', '<=', $end);
        if (!empty($statuses)) $query->whereIn('status', $statuses);
        if ($type) $query->where('project_type', $type);

        return $query->exists();
    }

    private function generateFilename(?string $start, ?string $end, array $statuses, ?string $type): string
    {
        $name = 'project_proposals';

        if ($start && $end) $name .= "_{$start}_to_{$end}";
        elseif ($start) $name .= "_from_{$start}";
        elseif ($end) $name .= "_until_{$end}";

        if (!empty($statuses)) {
            $statusStr = implode('_', array_map(fn ($s) => str_replace(' ', '_', $s), $statuses));
            $name .= "_status_{$statusStr}";
        }

        if ($type) {
            $name .= '_type_' . str_replace(' ', '_', $type);
        }

        return $name . '.xlsx';
    }
}