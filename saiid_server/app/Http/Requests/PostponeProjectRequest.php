<?php
// app/Http/Requests/PostponeProjectRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PostponeProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'postponement_reason' => 'nullable|string|max:500',
        ];
    }

    public function messages(): array
    {
        return [
            'postponement_reason.max' => 'سبب التأجيل يجب أن يكون أقل من 500 حرف',
        ];
    }
}