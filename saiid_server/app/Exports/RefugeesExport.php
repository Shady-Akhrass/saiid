<?php

namespace App\Exports;

use App\Models\Refugee;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class RefugeesExport implements FromCollection, WithHeadings, WithMapping
{
    public function collection()
    {
        return Refugee::all();
    }

    public function headings(): array
    {
        return [
            'رقم هوية رب الأسرة',
            'عدد أفراد الأسرة (ذكور)',
            'عدد أفراد الأسرة (إناث)',
            'عدد الأطفال (أقل من سنتين)',
            'عدد الأطفال (2-6 سنوات)',
            'عدد الأطفال (6-18 سنة)',
            'عدد كبار السن (فوق 60)',
            'عدد النساء الحوامل',
            'عدد المرضعات',
            'اسم رب الأسرة',
            'اسم الزوجة',
            'رقم هوية الزوجة',
            'المحافظة',
            'الحي',
            'العنوان التفصيلي',
            'رقم الهاتف',
            'رقم هاتف بديل',
            'عدد الحالات الخاصة',
            'جنس صاحب الحالة الخاصة',
            'عمر صاحب الحالة الخاصة',
            'نوع الحالة الخاصة',
            'نوع المرض',
            'نوع الاحتياجات',
            'تفاصيل إضافية'
        ];
    }

    public function map($refugee): array
    {
        return [
            $refugee->husband_id_number,
            $refugee->male_family_members,
            $refugee->female_family_members,
            $refugee->children_under_2_years,
            $refugee->children_2_to_6_years,
            $refugee->children_6_to_18_years,
            $refugee->elderly_above_60,
            $refugee->pregnant_women,
            $refugee->nursing_women,
            $refugee->husband_name,
            $refugee->wife_name,
            $refugee->wife_id_number,
            $refugee->governorate,
            $refugee->district,
            $refugee->detailed_address,
            $refugee->phone_number,
            $refugee->alternative_phone_number,
            $refugee->special_cases_count,
            $refugee->special_case_gender,
            $refugee->special_case_age,
            $refugee->special_case_type,
            $refugee->disease_type,
            $refugee->needs_type,
            $refugee->additional_details
        ];
    }
}
