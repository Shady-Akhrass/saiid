<?php
// app/Http/Requests/SelectShelterRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SelectShelterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'shelter_id' => 'required|exists:shelters,manager_id_number',
        ];
    }

    public function messages(): array
    {
        return [
            'shelter_id.required' => 'يرجى اختيار المخيم',
            'shelter_id.exists'   => 'المخيم المحدد غير موجود',
        ];
    }
}