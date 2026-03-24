<?php
// app/Http/Requests/AssignPhotographerRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssignPhotographerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'assigned_photographer_id' => 'required|exists:team_personnel,id',
        ];
    }

    public function messages(): array
    {
        return [
            'assigned_photographer_id.required' => 'يرجى اختيار المصور',
            'assigned_photographer_id.exists'   => 'المصور المحدد غير موجود',
        ];
    }
}