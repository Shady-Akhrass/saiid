<?php
// app/Http/Requests/ConvertToShekelRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ConvertToShekelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'shekel_exchange_rate'          => 'required|filled|numeric|min:0.01',
            'transfer_discount_percentage'  => 'nullable|numeric|min:0|max:100',
        ];
    }

    public function messages(): array
    {
        return [
            'shekel_exchange_rate.required'         => 'سعر الصرف مطلوب',
            'shekel_exchange_rate.filled'            => 'سعر الصرف لا يمكن أن يكون فارغاً',
            'shekel_exchange_rate.numeric'           => 'سعر الصرف يجب أن يكون رقماً',
            'shekel_exchange_rate.min'               => 'سعر الصرف يجب أن يكون أكبر من صفر',
            'transfer_discount_percentage.numeric'   => 'نسبة خصم النقل يجب أن تكون رقماً',
            'transfer_discount_percentage.min'       => 'نسبة خصم النقل >= 0',
            'transfer_discount_percentage.max'       => 'نسبة خصم النقل <= 100',
        ];
    }
}