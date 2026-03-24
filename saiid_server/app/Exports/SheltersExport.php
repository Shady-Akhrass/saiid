<?php

namespace App\Exports;

use App\Models\Shelter;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class SheltersExport implements FromCollection, WithHeadings, WithMapping
{
    public function collection()
    {
        return Shelter::all();
    }

    public function headings(): array
    {
        return [
            'رقم هوية النازح',
            'الاسم الكامل للنازح',
            'تاريخ الميلاد',
            'الجنس',
            'الحالة الصحية',
            'وصف المرض',
            'العنوان الأصلي',
            'العنوان الحالي',
            'تفاصيل العنوان',
            'عدد أفراد العائلة',
            'رقم هوية المسؤول',
            'اسم المسؤول',
            'صلة القرابة',
            'رقم الهاتف',
            'رقم هاتف بديل',
            'سبب النزوح',
            'نوع المأوى الحالي',
            'وصف الاحتياجات',
            'مستوى الضرر في المنزل',
            'اسم معتمد البيانات',
            'تاريخ التسجيل'
        ];
    }

    public function map($shelter): array
    {
        return [
            $shelter->shelter_id_number,
            $shelter->shelter_full_name,
            $shelter->shelter_birth_date,
            $shelter->shelter_gender,
            $shelter->health_status,
            $shelter->disease_description,
            $shelter->original_address,
            $shelter->current_address,
            $shelter->address_details,
            $shelter->number_of_family_members,
            $shelter->guardian_id_number,
            $shelter->guardian_full_name,
            $shelter->guardian_relationship,
            $shelter->guardian_phone_number,
            $shelter->alternative_phone_number,
            $shelter->displacement_reason,
            $shelter->current_shelter_type,
            $shelter->needs_description,
            $shelter->house_damage_level,
            $shelter->data_approval_name,
            $shelter->created_at->format('Y-m-d H:i:s')
        ];
    }
}
