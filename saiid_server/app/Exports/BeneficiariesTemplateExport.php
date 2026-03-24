<?php

namespace App\Exports;

use App\Models\ProjectProposal;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;

class BeneficiariesTemplateExport implements FromArray, WithHeadings
{
    private $projectId;
    private $aidType;

    public function __construct($projectId = null)
    {
        $this->projectId = $projectId;
        
        // Get aid_type from project's subcategory if project ID is provided
        if ($projectId) {
            $project = ProjectProposal::with('subcategory:id,name_ar')->find($projectId);
            if ($project && $project->subcategory) {
                $this->aidType = $project->subcategory->name_ar;
            }
        }
    }

    /**
     * Return array with example row if project has subcategory
     */
    public function array(): array
    {
        // If we have aid_type, add one example row to show the format
        if ($this->aidType) {
            return [
                [
                    '', // الاسم
                    '', // رقم الهوية
                    '', // رقم الهاتف
                    '', // العنوان
                    '', // المحافظة
                    '', // المنطقة
                    $this->aidType, // نوع المساعدة (مملوء من subcategory)
                    '', // ملاحظات
                ]
            ];
        }
        
        return [];
    }

    /**
     * Return column headings
     * Compatible with BeneficiariesImport which supports both Arabic and English column names
     */
    public function headings(): array
    {
        return [
            'الاسم',           // name (required)
            'رقم الهوية',      // id_number (required)
            'رقم الهاتف',      // phone (optional)
            'العنوان',         // address (optional)
            'المحافظة',        // governorate (optional)
            'المنطقة',         // district (optional)
            'نوع المساعدة',    // aid_type (filled automatically from subcategory)
            'ملاحظات',         // notes (optional)
        ];
    }
}

