<?php
// app/Http/Requests/UpdateProjectProposalRequest.php

namespace App\Http\Requests;

use App\Enums\UploadConfig;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProjectProposalRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Specific role checks happen in the controller
        return (bool) $this->user();
    }

    public function rules(): array
    {
        $mimes   = UploadConfig::mimesString();
        $maxSize = UploadConfig::MAX_IMAGE_SIZE_KB;

        return [
            'project_name'              => 'sometimes|nullable|string|min:3|max:255',
            'donor_code'                => 'sometimes|nullable|string|max:50',
            'project_description'       => 'sometimes|nullable|string',
            'donor_name'                => 'sometimes|string|min:3',
            'project_type_id'           => 'sometimes|exists:project_types,id',
            'subcategory_id'            => 'sometimes|nullable|exists:project_subcategories,id',
            'donation_amount'           => 'sometimes|numeric|min:0',
            'currency_id'              => 'sometimes|exists:currencies,id',
            'admin_discount_percentage' => 'sometimes|numeric|min:0|max:100',
            'estimated_duration_days'   => 'sometimes|integer|min:1|max:365',
            'is_divided_into_phases'    => 'sometimes|boolean',
            'phase_type'                => 'sometimes|nullable|in:daily,monthly',
            'phase_duration_days'       => 'sometimes|nullable|integer|min:1|required_if:phase_type,daily',
            'phase_start_date'          => 'sometimes|nullable|date|required_if:is_divided_into_phases,true',
            'total_months'              => 'sometimes|nullable|integer|min:1|required_if:phase_type,monthly',
            'beneficiaries_per_unit'    => 'sometimes|nullable|integer|min:0',
            'notes'                     => 'sometimes|nullable|string',
            'notes_image'               => "nullable|image|mimes:{$mimes}|max:{$maxSize}",
            'notes_images'              => 'sometimes|nullable|array',
            'notes_images.*'            => "image|mimes:{$mimes}|max:{$maxSize}",
            'note_images_to_delete'     => 'sometimes|nullable|array',
            'note_images_to_delete.*'   => 'integer|exists:project_proposal_images,id',
            'project_image'             => "nullable|image|mimes:{$mimes}|max:{$maxSize}",
            'status'                    => 'sometimes|nullable|string',
            'sent_to_donor_date'        => 'sometimes|nullable|date',
            'completed_date'            => 'sometimes|nullable|date',
        ];
    }
}