<?php

namespace App\Imports;

use App\Models\Beneficiary;
use App\Models\ProjectProposal;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithValidation;
use Illuminate\Support\Facades\Log;

class BeneficiariesImport implements ToModel, WithHeadingRow, WithValidation
{
    private $projectProposalId;
    private $projectProposal;
    private $importedRows = [];
    private $errors = [];

    public function __construct($projectProposalId)
    {
        $this->projectProposalId = $projectProposalId;
        $this->projectProposal = ProjectProposal::find($projectProposalId);
    }

    public function model(array $row)
    {
        try {
            // Get aid_type from project's subcategory
            $aidType = null;
            if ($this->projectProposal && $this->projectProposal->subcategory) {
                $aidType = $this->projectProposal->subcategory->name_ar;
            }

            // Map Excel columns to database fields
            // Support multiple possible column names
            $name = $row['الاسم'] ?? $row['اسم المستفيد'] ?? $row['name'] ?? null;
            $idNumber = $row['رقم الهوية'] ?? $row['رقم_الهوية'] ?? $row['id_number'] ?? null;
            $phone = $row['رقم الهاتف'] ?? $row['الهاتف'] ?? $row['phone'] ?? null;
            $address = $row['العنوان'] ?? $row['address'] ?? null;
            $governorate = $row['المحافظة'] ?? $row['governorate'] ?? null;
            $district = $row['المنطقة'] ?? $row['الحي'] ?? $row['district'] ?? null;
            $notes = $row['ملاحظات'] ?? $row['notes'] ?? null;

            // Validate required fields
            if (empty($name) || empty($idNumber)) {
                $this->errors[] = "سطر بدون اسم أو رقم هوية: " . json_encode($row);
                return null;
            }

            $beneficiary = new Beneficiary([
                'project_proposal_id' => $this->projectProposalId,
                'name' => $name,
                'id_number' => $idNumber,
                'phone' => $phone,
                'address' => $address,
                'governorate' => $governorate,
                'district' => $district,
                'aid_type' => $aidType,
                'notes' => $notes,
            ]);

            $beneficiary->save();

            // Store row data for debugging
            $this->importedRows[] = $row;

            return $beneficiary;
        } catch (\Exception $e) {
            Log::error('Error importing beneficiary: ' . $e->getMessage(), [
                'row' => $row,
                'project_proposal_id' => $this->projectProposalId
            ]);
            $this->errors[] = "خطأ في استيراد السطر: " . $e->getMessage();
            return null;
        }
    }

    public function rules(): array
    {
        return [
            'الاسم' => 'nullable|string',
            'اسم المستفيد' => 'nullable|string',
            'name' => 'nullable|string',
            'رقم الهوية' => 'nullable|string',
            'رقم_الهوية' => 'nullable|string',
            'id_number' => 'nullable|string',
        ];
    }

    public function getImportedRows()
    {
        return $this->importedRows;
    }

    public function getErrors()
    {
        return $this->errors;
    }
}
