<?php

namespace App\Exports;

use App\Models\OrphanMedicalTreatment;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class OrphanMedicalTreatmentsExport implements FromCollection, WithHeadings, WithMapping
{
    /**
     * Return collection of all orphan medical treatments
     */
    public function collection()
    {
        return OrphanMedicalTreatment::orderBy('created_at', 'DESC')->get();
    }

    /**
     * Define headings for Excel export
     */
    public function headings(): array
    {
        return [
            'الرقم',
            'اسم اليتيم',
            'رقم هوية اليتيم',
            'اسم الوصي',
            'رقم هوية الوصي',
            'رقم جوال الوصي',
            'مقيم في خانيونس',
            'نوع العلاج',
            'نوع العلاج الطبيعي',
            'وصف العلاج الطبيعي الآخر',
            'مسجل في قاعدة الأيتام',
            'تاريخ التسجيل',
        ];
    }

    /**
     * Map data for each row
     */
    public function map($treatment): array
    {
        return [
            $treatment->id,
            $treatment->orphan_name,
            $treatment->orphan_id_number,
            $treatment->guardian_name,
            $treatment->guardian_id_number,
            $treatment->guardian_phone_number,
            $treatment->currently_in_khan_younis ? 'نعم' : 'لا',
            $treatment->treatment_type,
            $treatment->physical_therapy_type ?? '-',
            $treatment->physical_therapy_other_description ?? '-',
            $treatment->is_registered_in_orphans ? 'نعم' : 'لا',
            $treatment->created_at->format('Y-m-d H:i:s'),
        ];
    }
}

