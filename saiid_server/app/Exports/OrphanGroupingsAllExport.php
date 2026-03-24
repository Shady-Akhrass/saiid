<?php

namespace App\Exports;

use App\Models\OrphanGrouping;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class OrphanGroupingsAllExport implements FromCollection, WithHeadings, WithMapping, ShouldAutoSize, WithStyles
{
    protected $columns;
    protected $statusFilter;

    public function __construct(array $columns = [], $statusFilter = 'all')
    {
        $this->columns = $columns;
        $this->statusFilter = $statusFilter;
    }

    public function collection()
    {
        // Get all groupings with their active orphans and their sponsored projects to calculate status
        return OrphanGrouping::with(['activeOrphans' => function($q) {
            $q->with('sponsoredProjects');
        }])->get()->flatMap(function ($grouping) {
            return $grouping->activeOrphans->filter(function ($orphan) {
                // Apply status filter if not 'all'
                if ($this->statusFilter === 'all') return true;
                
                $isSponsored = $orphan->sponsoredProjects->count() > 0;
                if ($this->statusFilter === 'sponsored') return $isSponsored;
                if ($this->statusFilter === 'not_sponsored') return !$isSponsored;
                
                return true;
            })->map(function ($orphan) use ($grouping) {
                // Calculate sponsorship status
                $isSponsored = $orphan->sponsoredProjects->count() > 0;
                $statusText = $isSponsored ? 'مكفول' : 'غير مكفول';

                return [
                    'group_name' => $grouping->name,
                    'orphan_id' => $orphan->orphan_id_number,
                    'orphan_name' => $orphan->orphan_full_name,
                    'gender' => $orphan->orphan_gender,
                    'birth_date' => $orphan->orphan_birth_date,
                    'health' => $orphan->health_status,
                    'disease_description' => $orphan->disease_description,
                    'current_address' => $orphan->current_address,
                    'original_address' => $orphan->original_address,
                    'address_details' => $orphan->address_details,
                    'governorate' => $grouping->governorate_filter,
                    'district' => $grouping->district_filter,
                    'num_brothers' => $orphan->number_of_brothers,
                    'num_sisters' => $orphan->number_of_sisters,
                    'in_memorization' => $orphan->is_enrolled_in_memorization_center,
                    'guardian_name' => $orphan->guardian_full_name,
                    'guardian_id' => $orphan->guardian_id_number,
                    'guardian_relation' => $orphan->guardian_relationship,
                    'phone' => $orphan->guardian_phone_number,
                    'alt_phone' => $orphan->alternative_phone_number,
                    'mother_name' => $orphan->mother_full_name,
                    'mother_id' => $orphan->mother_id_number,
                    'mother_deceased' => $orphan->is_mother_deceased,
                    'mother_birth' => $orphan->mother_birth_date,
                    'mother_death' => $orphan->mother_death_date,
                    'mother_job' => $orphan->mother_job,
                    'father_name' => $orphan->deceased_father_full_name,
                    'father_birth' => $orphan->deceased_father_birth_date,
                    'father_death' => $orphan->death_date,
                    'father_cause' => $orphan->death_cause,
                    'father_job' => $orphan->previous_father_job,
                    'approval_name' => $orphan->data_approval_name,
                    'sponsorship_status' => $statusText,
                ];
            });
        });
    }

    public function headings(): array
    {
        $allHeadings = [
            'group_name' => 'اسم المجموعة',
            'orphan_id' => 'رقم هوية اليتيم',
            'orphan_name' => 'الاسم الكامل لليتيم',
            'gender' => 'الجنس',
            'birth_date' => 'تاريخ الميلاد',
            'health' => 'الحالة الصحية',
            'disease_description' => 'وصف المرض',
            'current_address' => 'العنوان الحالي',
            'original_address' => 'العنوان الأصلي',
            'address_details' => 'تفاصيل العنوان',
            'governorate' => 'المحافظة (فلتر)',
            'district' => 'المنطقة (فلتر)',
            'num_brothers' => 'عدد الإخوة',
            'num_sisters' => 'عدد الأخوات',
            'in_memorization' => 'ملتحق بمركز تحفيظ',
            'guardian_name' => 'اسم الوصي',
            'guardian_id' => 'رقم هوية الوصي',
            'guardian_relation' => 'صلة القرابة',
            'phone' => 'رقم هاتف الوصي',
            'alt_phone' => 'رقم هاتف بديل',
            'mother_name' => 'اسم الأم',
            'mother_id' => 'رقم هوية الأم',
            'mother_deceased' => 'هل الأم متوفاة',
            'mother_birth' => 'تاريخ ميلاد الأم',
            'mother_death' => 'تاريخ وفاة الأم',
            'mother_job' => 'عمل الأم',
            'father_name' => 'اسم الأب المتوفى',
            'father_birth' => 'تاريخ ميلاد الأب',
            'father_death' => 'تاريخ وفاة الأب',
            'father_cause' => 'سبب الوفاة',
            'father_job' => 'عمل الأب السابق',
            'approval_name' => 'اسم معتمد البيانات',
            'sponsorship_status' => 'حالة الكفالة',
        ];

        if (empty($this->columns)) {
            return array_values($allHeadings);
        }

        $filtered = [];
        foreach ($this->columns as $col) {
            if (isset($allHeadings[$col])) {
                $filtered[] = $allHeadings[$col];
            }
        }
        return $filtered;
    }

    public function map($row): array
    {
        if (empty($this->columns)) {
            return array_values($row);
        }

        $mapped = [];
        foreach ($this->columns as $col) {
            if (array_key_exists($col, $row)) {
                $mapped[] = $row[$col];
            }
        }
        return $mapped;
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true]],
        ];
    }
}
