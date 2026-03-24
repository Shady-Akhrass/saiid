<?php
// app/Http/Requests/BulkAssignPhotographerRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BulkAssignPhotographerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'project_ids'               => 'required|array|min:1',
            'project_ids.*'             => 'required|integer',
            'assigned_photographer_id'  => 'required|exists:team_personnel,id',
        ];
    }

    public function messages(): array
    {
        return [
            'project_ids.required'                  => 'يرجى تحديد المشاريع',
            'project_ids.array'                     => 'صيغة المشاريع غير صحيحة',
            'project_ids.min'                       => 'يجب اختيار مشروع واحد على الأقل',
            'assigned_photographer_id.required'      => 'يرجى اختيار المصور',
            'assigned_photographer_id.exists'        => 'المصور المحدد غير موجود',
        ];
    }
}