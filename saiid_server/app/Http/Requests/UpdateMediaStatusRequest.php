<?php
// app/Http/Requests/UpdateMediaStatusRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMediaStatusRequest extends FormRequest
{
    public const ALLOWED_STATUSES = [
        'في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'معاد مونتاجه', 'وصل للمتبرع',
    ];

    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        $statuses = implode(',', self::ALLOWED_STATUSES);

        return [
            'status'           => "required|in:{$statuses}",
            'notes'            => 'nullable|string',
            'rejection_reason' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'status.required' => 'يرجى تحديد الحالة',
            'status.in'       => 'الحالة المختارة غير صحيحة',
        ];
    }
}