<?php

namespace App\Exports;

use App\Models\Beneficiary;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;

class BeneficiariesExport implements FromCollection, WithHeadings, WithMapping, WithTitle, ShouldAutoSize
{
    protected $beneficiaries;

    public function __construct($beneficiaries = null)
    {
        $this->beneficiaries = $beneficiaries;
    }

    /**
     * @return \Illuminate\Support\Collection
     */
    public function collection()
    {
        if ($this->beneficiaries) {
            return $this->beneficiaries;
        }
        return Beneficiary::with(['project'])->get();
    }

    /**
     * @return array
     */
    public function headings(): array
    {
        return [
            'الرقم التسلسلي',
            'رقم المشروع',
            'اسم المشروع',
            'نوع المشروع',
            'الاسم الكامل',
            'رقم الهوية',
            'رقم الهاتف',
            'نوع المساعدة',
            'العمر',
            'الجنس',
            'العنوان',
            'تاريخ الإضافة',
        ];
    }

    /**
     * @param mixed $beneficiary
     * @return array
     */
    public function map($beneficiary): array
    {
        return [
            $beneficiary->id,
            $beneficiary->project ? $beneficiary->project->serial_number : '-',
            $beneficiary->project ? $beneficiary->project->project_name : '-',
            $beneficiary->project ? $beneficiary->project->project_type : '-',
            $beneficiary->full_name ?? '-',
            $beneficiary->id_number ?? '-',
            $beneficiary->phone_number ?? '-',
            $beneficiary->aid_type ?? '-',
            $beneficiary->age ?? '-',
            $beneficiary->gender ?? '-',
            $beneficiary->address ?? '-',
            $beneficiary->created_at ? $beneficiary->created_at->format('Y-m-d H:i:s') : '-',
        ];
    }

    /**
     * @return string
     */
    public function title(): string
    {
        return 'المستفيدون';
    }
}
