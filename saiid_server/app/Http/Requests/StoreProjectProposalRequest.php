<?php
// app/Http/Requests/StoreProjectProposalRequest.php

namespace App\Http\Requests;

use App\Enums\UploadConfig;
use Illuminate\Foundation\Http\FormRequest;

class StoreProjectProposalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return strtolower($this->user()->role ?? '') === 'admin';
    }

    public function rules(): array
    {
        $mimes = UploadConfig::mimesString();
        $maxSize = UploadConfig::MAX_IMAGE_SIZE_KB;

        return [
            'project_name'              => 'nullable|string|min:3|max:255',
            'donor_code'                => 'nullable|string|max:50',
            'project_description'       => 'nullable|string',
            'donor_name'                => 'required|string|min:3',
            'project_type_id'           => 'required_without:project_type|exists:project_types,id',
            'project_type'              => 'required_without:project_type_id|string|exists:project_types,name',
            'subcategory_id'            => 'required|exists:project_subcategories,id',
            'donation_amount'           => 'required|numeric|min:0',
            'currency_id'              => 'required|exists:currencies,id',
            'admin_discount_percentage' => 'nullable|numeric|min:0|max:100',
            'estimated_duration_days'   => 'nullable|integer|min:1|max:365',
            'is_divided_into_phases'    => 'nullable|boolean',
            'phase_type'                => 'nullable|in:daily,monthly|required_if:is_divided_into_phases,1',
            'phase_duration_days'       => 'nullable|integer|min:1|required_if:phase_type,daily',
            'phase_start_date'          => 'nullable|date|required_if:is_divided_into_phases,1',
            'total_months'              => 'nullable|integer|min:1|required_if:phase_type,monthly',
            'beneficiaries_per_unit'    => 'nullable|integer|min:0',
            'notes'                     => 'nullable|string',
            'notes_image'               => "nullable|image|mimes:{$mimes}|max:{$maxSize}",
            'notes_images'              => 'nullable|array',
            'notes_images.*'            => "image|mimes:{$mimes}|max:{$maxSize}",
        ];
    }

    public function messages(): array
    {
        return [
            'donor_name.required'               => 'يرجى إدخال اسم الجهة المتبرعة',
            'project_type_id.required_without'   => 'يرجى اختيار نوع المشروع',
            'project_type_id.exists'             => 'نوع المشروع المحدد غير موجود',
            'subcategory_id.required'            => 'التفريعة مطلوبة',
            'subcategory_id.exists'              => 'التفريعة المحددة غير موجودة',
            'donation_amount.required'           => 'يرجى إدخال مبلغ التبرع',
            'currency_id.required'               => 'يرجى اختيار العملة',
            'phase_type.required_if'             => 'نوع التقسيم مطلوب عند تفعيل المراحل',
            'phase_type.in'                      => 'نوع التقسيم يجب أن يكون: يومي أو شهري',
            'total_months.required_if'           => 'عدد الشهور مطلوب عند التقسيم الشهري',
            'notes_image.max'                    => 'حجم صورة الملاحظات يجب أن يكون أقل من 5 ميجابايت',
        ];
    }

    /**
     * Merge nested phase_division into top-level before validation
     */
    protected function prepareForValidation(): void
    {
        $pd = $this->input('phase_division');
        if (!is_array($pd)) {
            return;
        }

        $merge = [];
        if (!empty($pd['type']))               $merge['phase_type']         = $pd['type'];
        if (isset($pd['total_months']))         $merge['total_months']       = $pd['total_months'];
        if (!empty($pd['phase_start_date']))    $merge['phase_start_date']   = $pd['phase_start_date'];
        if (isset($pd['phase_duration_days']))  $merge['phase_duration_days']= $pd['phase_duration_days'];

        if ($merge) {
            $this->merge($merge);
        }
    }
}