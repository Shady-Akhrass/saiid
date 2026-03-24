<?php

namespace App\Exports;

use App\Models\Teacher;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class TeachersExport implements FromCollection, WithHeadings, WithMapping
{

    public function collection()
    {
        return Teacher::all();
    }


    public function headings(): array
    {
        return [
            'الاسم رباعي',
            'رقم الهوية',
            'تاريخ الميلاد',
            'الجنس',
            'التخصص الجامعي',
            'الحالة الإجتماعية',
            'عنوان السكن بالتفصيل',
            'رقم الجوال',
            'رقم الجوال البديل'
        ];
    }

    public function map($teacher): array
    {
        return [
            $teacher->name,
            $teacher->id_number,
            $teacher->birth_date,
            $teacher->gender,
            $teacher->university_major,
            $teacher->marital_status,
            $teacher->address_details,
            $teacher->guardian_phone_number,
            $teacher->alternative_phone_number
        ];
    }
}
