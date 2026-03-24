<?php
// app/Http/Requests/UpdateExecutionStatusRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateExecutionStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && in_array($user->role, [
            'project_manager', 'media_manager', 'admin', 'orphan_sponsor_coordinator',
        ]);
    }

    public function rules(): array
    {
        $isOrphan = $this->user()?->role === 'orphan_sponsor_coordinator';

        $allowed = $isOrphan
            ? ['تم التنفيذ']
            : ['قيد التنفيذ', 'تم التنفيذ'];

        return [
            'status' => 'required|in:' . implode(',', $allowed),
        ];
    }

    public function messages(): array
    {
        $isOrphan = $this->user()?->role === 'orphan_sponsor_coordinator';

        return [
            'status.required' => 'يرجى تحديد الحالة',
            'status.in'       => $isOrphan
                ? 'الحالة يجب أن تكون "تم التنفيذ"'
                : 'الحالة يجب أن تكون "قيد التنفيذ" أو "تم التنفيذ"',
        ];
    }
}