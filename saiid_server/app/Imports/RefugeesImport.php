<?php

namespace App\Imports;

use App\Models\Refugee;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class RefugeesImport implements ToModel, WithHeadingRow
{
    private $managerId;
    private $importedRows = []; // Store imported rows

    public function __construct($managerId)
    {
        $this->managerId = $managerId;
    }

    public function model($row)
    {
        try {
            $refugee = new Refugee([
                'manager_id_number' => $this->managerId,
                'husband_id_number' => $row['رقم هوية رب الأسرة'],
                'male_family_members' => intval($row['عدد أفراد الأسرة (ذكور)'] ?? 0),
                'female_family_members' => intval($row['عدد أفراد الأسرة (إناث)'] ?? 0),
                'children_under_2_years' => intval($row['عدد الأطفال (أقل من سنتين)'] ?? 0),
                'children_2_to_6_years' => intval($row['عدد الأطفال (2-6 سنوات)'] ?? 0),
                'children_6_to_18_years' => intval($row['عدد الأطفال (6-18 سنة)'] ?? 0),
                'elderly_above_60' => intval($row['عدد كبار السن (فوق 60)'] ?? 0),
                'pregnant_women' => intval($row['عدد النساء الحوامل'] ?? 0),
                'nursing_women' => intval($row['عدد المرضعات'] ?? 0),
                'husband_name' => $row['اسم رب الأسرة'],
                'wife_name' => $row['اسم الزوجة'],
                'wife_id_number' => $row['رقم هوية الزوجة'],
                'governorate' => $row['المحافظة'],
                'district' => $row['الحي'],
                'detailed_address' => $row['العنوان التفصيلي'],
                'phone_number' => $row['رقم الهاتف'],
                'alternative_phone_number' => $row['رقم هاتف بديل'] ?? null,
                'special_cases_count' => intval($row['عدد الحالات الخاصة'] ?? 0),
                'special_case_gender' => $row['جنس صاحب الحالة الخاصة'] ?? null,
                'special_case_age' => isset($row['عمر صاحب الحالة الخاصة']) ? intval($row['عمر صاحب الحالة الخاصة']) : null,
                'special_case_type' => $row['نوع الحالة الخاصة'] ?? null,
                'disease_type' => $row['نوع المرض'] ?? null,
                'needs_type' => $row['نوع الاحتياجات'] ?? null,
                'additional_details' => $row['تفاصيل إضافية'] ?? null
            ]);

            $refugee->save();

            // Store row data for debugging
            $this->importedRows[] = $row;

            return $refugee;
        } catch (\Exception $e) {
            \Log::error('Error importing refugee: ' . $e->getMessage());
            throw $e;
        }
    }

    public function getImportedRows()
    {
        return $this->importedRows;
    }
}
