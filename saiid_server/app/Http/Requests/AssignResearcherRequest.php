<?php
// app/Http/Requests/AssignResearcherRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssignResearcherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'assigned_researcher_id' => 'nullable|exists:team_personnel,id',
        ];
    }

    public function messages(): array
    {
        return [
            'assigned_researcher_id.exists' => 'الباحث المحدد غير موجود',
        ];
    }
}