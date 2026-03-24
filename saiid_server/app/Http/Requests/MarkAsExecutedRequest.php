<?php
// app/Http/Requests/MarkAsExecutedRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MarkAsExecutedRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'execution_date' => 'nullable|date',
            'notes'          => 'nullable|string|max:500',
        ];
    }

    public function messages(): array
    {
        return [
            'execution_date.date' => 'تاريخ التنفيذ يجب أن يكون تاريخاً صحيحاً',
        ];
    }
}