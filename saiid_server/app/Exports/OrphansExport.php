<?php

namespace App\Exports;

use App\Models\Orphan;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class OrphansExport implements FromCollection, WithHeadings, WithMapping
{
    public function collection()
    {
        return Orphan::all();
    }

    public function headings(): array
    {
        return [
            'رقم هوية اليتيم',
            'الاسم الكامل لليتيم',
            'تاريخ ميلاد اليتيم',
            'جنس اليتيم',
            'الحالة الصحية',
            'وصف المرض',
            'العنوان الأصلي',
            'العنوان الحالي',
            'العنوان بالتفصيل',
            'عدد الإخوة',
            'عدد الأخوات',
            'التحاق بمركز تحفيظ',
            'رقم هوية الوصي',
            'الاسم الكامل للوصي',
            'علاقة الوصي باليتيم',
            'رقم هاتف الوصي',
            'رقم هاتف بديل',
            'الاسم الكامل للأب المتوفي',
            'تاريخ ميلاد الأب المتوفي',
            'تاريخ وفاة الأب',
            'سبب الوفاة',
            'وظيفة الأب السابقة',
            'الاسم الكامل للأم',
            'رقم هوية الأم',
            'هل الأم متوفية؟',
            'تاريخ ميلاد الأم',
            'تاريخ وفاة الأم',
            'حالة الأم',
            'وظيفة الأم',
            'اسم المتعهد ',
            'صورة اليتيم',
            'شهادة وفاة الأب',
            'شهادة وفاة الأم'
        ];
    }

    public function map($orphan): array
    {
        return [
            $orphan->orphan_id_number,
            $orphan->orphan_full_name,
            $orphan->orphan_birth_date,
            $orphan->orphan_gender,
            $orphan->health_status,
            $orphan->disease_description,
            $orphan->original_address,
            $orphan->current_address,
            $orphan->address_details,
            $orphan->number_of_brothers,
            $orphan->number_of_sisters,
            $orphan->is_enrolled_in_memorization_center,
            $orphan->guardian_id_number,
            $orphan->guardian_full_name,
            $orphan->guardian_relationship,
            $orphan->guardian_phone_number,
            $orphan->alternative_phone_number,
            $orphan->deceased_father_full_name,
            $orphan->deceased_father_birth_date,
            $orphan->death_date,
            $orphan->death_cause,
            $orphan->previous_father_job,
            $orphan->mother_full_name,
            $orphan->mother_id_number,
            $orphan->is_mother_deceased,
            $orphan->mother_birth_date,
            $orphan->mother_death_date,
            $orphan->mother_status,
            $orphan->mother_job,
            $orphan->data_approval_name,
            'https://forms-api.saiid.org/api/image/' . $orphan->orphan_id_number,
            'https://forms-api.saiid.org/api/death-certificate/' . $orphan->orphan_id_number,
            'https://forms-api.saiid.org/api/' . $orphan->orphan_id_number . '/mother-death-certificate',
        ];
    }
}
