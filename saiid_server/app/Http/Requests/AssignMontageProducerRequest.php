<?php
// app/Http/Requests/AssignMontageProducerRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssignMontageProducerRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && in_array($user->role, ['media_manager', 'admin']);
    }

    public function rules(): array
    {
        return [
            'montage_producer_id' => 'required|exists:users,id',
        ];
    }

    public function messages(): array
    {
        return [
            'montage_producer_id.required' => 'يرجى اختيار ممنتج المونتاج',
            'montage_producer_id.exists'   => 'ممنتج المونتاج المحدد غير موجود',
        ];
    }
}