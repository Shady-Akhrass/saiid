<?php
// app/Services/ProjectTypeResolver.php

namespace App\Services;

use App\Models\ProjectProposal;
use App\Models\ProjectSubcategory;
use App\Models\ProjectType;
use Illuminate\Http\Request;

class ProjectTypeResolver
{
    /**
     * @return array{type: ProjectType|null, error: string|null}
     */
    public function resolve(Request $request, ?ProjectProposal $existing = null): array
    {
        // By ID
        if ($request->filled('project_type_id')) {
            $type = ProjectType::find($request->project_type_id);
            return $type
                ? ['type' => $type, 'error' => null]
                : ['type' => null, 'error' => 'نوع المشروع المحدد غير موجود'];
        }

        // By name (backward compat)
        if ($request->filled('project_type')) {
            $type = ProjectType::where('name', $request->project_type)->first();
            return $type
                ? ['type' => $type, 'error' => null]
                : ['type' => null, 'error' => "نوع المشروع '{$request->project_type}' غير موجود"];
        }

        // Fall back to existing
        if ($existing?->projectType) {
            return ['type' => $existing->projectType, 'error' => null];
        }

        if (!$existing) {
            return ['type' => null, 'error' => 'يجب إرسال project_type_id أو project_type'];
        }

        return ['type' => null, 'error' => null];
    }

    public function validateSubcategory(
        Request $request,
        ProjectType $projectType
    ): ?string {
        if (!$request->filled('subcategory_id')) {
            return null;
        }

        $sub = ProjectSubcategory::find($request->subcategory_id);

        if (!$sub) {
            return 'التفرعية المحددة غير موجودة';
        }

        if ($sub->project_type !== $projectType->name) {
            return "التفرعية من نوع '{$sub->project_type}' لا تطابق '{$projectType->name}'";
        }

        return null;
    }
}