<?php
// app/Services/PaginationResolver.php

namespace App\Services;

use App\Enums\UserRole;
use Illuminate\Http\Request;

class PaginationResolver
{
    private const DEFAULT_PER_PAGE = 15;
    private const MAX_PER_PAGE = 50;
    private const MAX_PER_PAGE_MANAGER = 2000;

    public function resolve(Request $request, string $userRole): int
    {
        $input = $request->query('perPage',
            $request->query('per_page', self::DEFAULT_PER_PAGE)
        );

        if ($input === 'all' || $input === 'الكل') {
            $this->assertHasFilter($request);
            return self::MAX_PER_PAGE_MANAGER;
        }

        $max = in_array($userRole, UserRole::managerRoles())
            ? self::MAX_PER_PAGE_MANAGER
            : self::MAX_PER_PAGE;

        return min(max(1, (int) $input), $max);
    }

    private function assertHasFilter(Request $request): void
    {
        $hasFilter = ($request->filled('status') && $request->get('status') !== 'all')
            || ($request->filled('project_type') && $request->get('project_type') !== 'all')
            || $request->filled('searchQuery')
            || $request->filled('subcategory_id')
            || $request->filled('team_id')
            || $request->filled('photographer_id')
            || $request->filled('shelter_id');

        if (!$hasFilter) {
            abort(422, 'يجب تحديد فلترة عند طلب جميع المشاريع');
        }
    }
}