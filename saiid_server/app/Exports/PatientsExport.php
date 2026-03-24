<?php

namespace App\Exports;

use App\Models\Patient;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class PatientsExport implements FromCollection, WithHeadings, WithMapping
{
    /**
     * Return the collection of patients.
     *
     * @return \Illuminate\Support\Collection
     */
    public function collection()
    {
        return Patient::all();
    }

    /**
     * Define the headings for the Excel file.
     *
     * @return array
     */
    public function headings(): array
    {
        return [
            'رقم الهوية',
            'الاسم رباعي',
            'تاريخ الميلاد',
            'الجنس',
            'الحالة الصحية',
            'وصف المرض (إن وجد)',
            'الحالة الإجتماعية',
            'عدد الأبناء الذكور',
            'عدد البنات الإناث',
            'عنوان السكن الحالي',
            'رقم الجوال',
            'رقم الجوال البديل',
            'اسم المتعهد',
            'تاريخ الإنشاء',
            'تاريخ التحديث'
        ];
    }

    /**
     * Map the patient data to the Excel file rows.
     *
     * @param Patient $patient
     * @return array
     */
    public function map($patient): array
    {
        return [
            $patient->id_number,
            $patient->name,
            $patient->birth_date,
            $patient->gender,
            $patient->health_status,
            $patient->disease_description ?? 'N/A', // Handle nullable field
            $patient->marital_status,
            $patient->number_of_brothers ?? 'N/A', // Handle nullable field
            $patient->number_of_sisters ?? 'N/A', // Handle nullable field
            $patient->current_address,
            $patient->guardian_phone_number,
            $patient->alternative_phone_number,
            $patient->data_approval_name,
            $patient->created_at,
            $patient->updated_at
        ];
    }
}