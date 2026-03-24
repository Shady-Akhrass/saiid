<?php
// app/Http/Requests/BatchAssignProducerRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BatchAssignProducerRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && in_array($user->role, ['media_manager', 'admin']);
    }

    public function rules(): array
    {
        return [
            'project_ids'          => 'required|array|min:1',
            'project_ids.*'        => 'required|integer|exists:project_proposals,id',
            'montage_producer_id'  => 'required|exists:users,id',
        ];
    }

    public function messages(): array
    {
        return [
            'project_ids.required'         => 'يرجى تحديد المشاريع المطلوبة',
            'project_ids.array'            => 'صيغة المشاريع غير صحيحة',
            'project_ids.min'              => 'يجب اختيار مشروع واحد على الأقل',
            'project_ids.*.exists'         => 'أحد المشاريع المحددة غير موجود',
            'montage_producer_id.required' => 'يرجى اختيار ممنتج المونتاج',
            'montage_producer_id.exists'   => 'ممنتج المونتاج غير موجود',
        ];
    }
}