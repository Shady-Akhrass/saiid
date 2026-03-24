<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * تصدير تقرير المشاريع المفصل (Supervision / project-management detailed-projects).
 * يحتوي على 11 عموداً بالترتيب المطلوب مع عمود "اسم المشروع" مضمون.
 */
class SupervisionProjectsExport implements FromCollection, WithHeadings, WithMapping, WithColumnWidths, WithStyles
{
    protected $projects;

    public function __construct($projects)
    {
        $this->projects = $projects;
    }

    public function collection()
    {
        return $this->projects;
    }

    public function headings(): array
    {
        return [
            'كود المشروع',
            'اسم المشروع',
            'اسم المتبرع',
            'الوصف',
            'المبلغ قبل الخصم',
            'المبلغ بعد التحويل',
            'المبلغ الصافي',
            'حالة المشروع',
            'الأيام المتبقية',
            'نوع المشروع',
            'تاريخ الإنشاء',
        ];
    }

    public function map($project): array
    {
        $projectName = $project->project_name
            ?? $project->donor_name
            ?? '---';

        $originalAmount = $project->donation_amount ?? 0;
        $currencySymbol = $project->currency && isset($project->currency->currency_symbol)
            ? $project->currency->currency_symbol
            : ($project->currency && isset($project->currency->currency_code) ? $project->currency->currency_code : '');
        $originalAmountFormatted = $originalAmount > 0
            ? number_format((float) $originalAmount, 2) . ' ' . trim($currencySymbol)
            : '---';

        $amountAfterConversion = $project->amount_in_usd ?? 0;
        $netAmount = $project->net_amount ?? 0;

        $remainingDays = $project->remaining_days !== null && $project->remaining_days !== ''
            ? $project->remaining_days
            : '-';

        $createdAt = $project->created_at
            ? $project->created_at->format('Y-m-d H:i:s')
            : '-';

        $description = $project->project_description ?? '---';
        if (is_string($description) && mb_strlen($description) > 500) {
            $description = mb_substr($description, 0, 500) . '...';
        }

        return [
            $project->serial_number ?? '---',
            $projectName,
            $project->donor_name ?? '---',
            $description,
            $originalAmountFormatted,
            number_format((float) $amountAfterConversion, 2),
            number_format((float) $netAmount, 2),
            $project->status ?? '---',
            $remainingDays,
            $project->project_type ?? '---',
            $createdAt,
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 16,
            'B' => 30,
            'C' => 22,
            'D' => 40,
            'E' => 18,
            'F' => 18,
            'G' => 16,
            'H' => 18,
            'I' => 16,
            'J' => 14,
            'K' => 20,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        $sheet->getStyle('1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 12],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'E8F4F8'],
            ],
            'alignment' => [
                'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER,
                'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER,
            ],
        ]);
        $sheet->getStyle('E:G')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_RIGHT);
        return [1 => ['font' => ['bold' => true, 'size' => 12]]];
    }
}
