<?php

namespace App\Exports;

use App\Models\Aid;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class AidsExport implements FromCollection, WithHeadings, WithMapping
{
    public function collection()
    {
        return Aid::all();
    }

    public function headings(): array
    {
        return [
            'الاسم رباعي',
            'رقم الهوية',
            'تاريخ الميلاد',
            'الجنس',
            'الحالة الصحية',
            'وصف المرض',
            'الحالة الإجتماعية',
            'عدد الأبناء الذكور',
            'عدد البنات الإناث',
            'نوع العمل',
            'مستوى الدخل',
            'عنوان السكن الأساسي',
            'عنوان السكن الحالي',
            'عنوان السكن بالتفصيل',
            'رقم الجوال',
            'رقم الجوال البديل',
            'نوع المساعدة',
            'طبيعة المساعدة',
            'اسم المتعهد'
        ];
    }

    public function map($aid): array
    {
        return [
            $aid->name,
            $aid->id_number,
            $aid->birth_date,
            $aid->gender,
            $aid->health_status,
            $aid->disease_description,
            $aid->marital_status,
            $aid->number_of_brothers,
            $aid->number_of_sisters,
            $aid->job,
            $aid->salary,
            $aid->original_address,
            $aid->current_address,
            $aid->address_details,
            $aid->guardian_phone_number,
            $aid->alternative_phone_number,
            $aid->aid,
            $aid->nature_of_aid,
            $aid->data_approval_name
        ];
    }
}
