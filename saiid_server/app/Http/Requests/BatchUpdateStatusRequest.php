<?php
// app/Http/Requests/BatchUpdateStatusRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BatchUpdateStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && in_array($user->role, ['media_manager', 'admin']);
    }

    public function rules(): array
    {
        $statuses = implode(',', UpdateMediaStatusRequest::ALLOWED_STATUSES);

        return [
            'project_ids'      => 'required|array|min:1',
            'project_ids.*'    => 'required|integer|exists:project_proposals,id',
            'status'           => "required|in:{$statuses}",
            'notes'            => 'nullable|string',
            'rejection_reason' => 'nullable|string|required_if:status,معاد مونتاجه',
        ];
    }

    public function messages(): array
    {
        return [
            'project_ids.required'              => 'يرجى تحديد المشاريع',
            'project_ids.array'                 => 'صيغة المشاريع غير صحيحة',
            'project_ids.min'                   => 'يجب اختيار مشروع واحد على الأقل',
            'project_ids.*.exists'              => 'أحد المشاريع غير موجود',
            'status.required'                   => 'يرجى تحديد الحالة',
            'status.in'                         => 'الحالة المختارة غير صحيحة',
            'rejection_reason.required_if'      => 'سبب الرفض مطلوب عند اختيار "معاد مونتاجه"',
        ];
    }
}