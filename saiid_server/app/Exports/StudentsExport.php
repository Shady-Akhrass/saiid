<?php

namespace App\Exports;

use App\Models\Student;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class StudentsExport implements FromCollection, WithHeadings, WithMapping
{
    public function collection()
    {
        return Student::all();
    }

    public function headings(): array
    {
        return [
            'الاسم رباعي',
            'رقم الهوية',
            'تاريخ الميلاد',
            'الجنس',
            'المرحلة الدراسية',
            'عنوان السكن بالتفصيل',
            'رقم الجوال',
            'رقم الجوال البديل'
        ];
    }

    public function map($student): array
    {
        return [
            $student->name,
            $student->id_number,
            $student->birth_date,
            $student->gender,
            $student->academic_stage,
            $student->address_details,
            $student->guardian_phone_number,
            $student->alternative_phone_number
        ];
    }
}
