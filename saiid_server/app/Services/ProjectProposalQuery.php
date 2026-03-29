<?php

namespace App\Services;

use App\Models\ProjectProposal;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ProjectProposalQuery
{
    /*
     |--------------------------------------------------------------------------
     | Recommended Database Indexes (add via migration)
     |--------------------------------------------------------------------------
     |
     | Schema::table('project_proposals', function (Blueprint $table) {
     |     $table->index('parent_project_id');
     |     $table->index('is_divided_into_phases');
     |     $table->index('phase_day');
     |     $table->index('month_number');
     |     $table->index('phase_type');
     |     $table->index('assigned_to_team_id');
     |     $table->index('assigned_by');
     |     $table->index('created_by');
     |     $table->index('status');
     |     $table->index('created_at');
     |     $table->index('execution_date');
     |     $table->index('assigned_photographer_id');
     |     $table->index('shelter_id');
     |     $table->index('subcategory_id');
     |     // Composite index for admin role filter (matches new admin filtering logic)
     |     $table->index(['is_divided_into_phases', 'parent_project_id', 'phase_day', 'month_number', 'phase_type'], 'idx_admin_filter');
     |     // Composite index for coordinator status checks
     |     $table->index(['status', 'is_daily_phase', 'is_monthly_phase', 'is_divided_into_phases'], 'idx_coordinator_filter');
     | });
     |
     | Schema::table('team_members', function (Blueprint $table) {
     |     $table->index(['user_id', 'team_id']);
     | });
     |
     */

    /**
     * ✅ Whitelist of sortable columns — prevents SQL injection via sort_by parameter
     */
    private const ALLOWED_SORT_COLUMNS = [
        'created_at',
        'execution_date',
        'donation_amount',
        'status',
    ];

    /**
     * ✅ Searchable columns defined once — DRY + easy to maintain
     */
    private const SEARCHABLE_COLUMNS = [

        'project_name',
        'serial_number',
        'donor_name',
        'donor_code',
        'internal_code',
    ];

    /**
     * ✅ Roles that get full relationship loading — defined once
     */
    private const PRIVILEGED_ROLES = [
        'project_manager',
        'admin',
        'executed_projects_coordinator',
        'media_manager',
        'orphan_sponsor_coordinator',
    ];

    /**
     * ✅ Coordinator visible statuses — extracted to constant for reusability
     */
    private const COORDINATOR_STATUSES = ['جاهز للتنفيذ', 'تم التنفيذ'];

    // ─────────────────────────────────────────────────────────────────────────
    //  Main Entry Point
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build query for listing projects with filters.
     *
     * Returns the same Builder shape — no change in output structure.
     */
    public function buildListQuery(Request $request, User $user, ?bool $finishedOnly = null): Builder
    {
        $userRole = strtolower($user->role ?? 'guest');
        $userId = $user->id ?? 0;

        $query = ProjectProposal::query();

        // ✅ Finished/Unfinished status filter (applied before role filters)
        if ($finishedOnly !== null) {
            $this->applyFinishedStatusFilter($query, $finishedOnly);
        }

        // Role-based filtering
        $this->applyRoleFilters($query, $userRole, $userId);

        // Status filter
        $this->applyStatusFilter($query, $request);

        // Project type filter
        $this->applyProjectTypeFilter($query, $request);

        // Search filter
        $this->applySearchFilter($query, $request);

        // Date filters
        $this->applyDateFilters($query, $request);

        // Additional filters
        $this->applyAdditionalFilters($query, $request, $userRole);

        // Eager load relationships
        $this->loadRelationships($query, $userRole);

        // Apply sorting
        $this->applySorting($query, $request);

        return $query;
    }

    /**
     * ✅ NEW: Get daily phases for a specific project.
     */
    public function getDailyPhases(int $id): array
    {
        $project = ProjectProposal::with([
            'dailyPhases',
            'dailyPhases.assignedResearcher:id,name',
            'dailyPhases.photographer:id,name',
            'dailyPhases.assignedToTeam:id,team_name'
        ])->findOrFail($id);

        return [
            'success' => true,
            'project' => $project,
            'daily_phases' => $project->dailyPhases
        ];
    }

    /**
     * ✅ Filter by finished or unfinished status.
     *    - finishedOnly=true  → only 'منتهي'
     *    - finishedOnly=false → everything except 'منتهي'
     */
    public function applyFinishedStatusFilter(Builder $query, bool $finishedOnly): void
    {
        if ($finishedOnly) {
            $query->where('status', 'منتهي');
        } else {
            $query->where('status', '!=', 'منتهي');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Role Filters
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * ✅ NEW: Apply admin filtering logic - exclude original divided parent projects
     *    This matches the frontend filterProjectsForAdmin function logic
     */
    private function applyAdminFilter(Builder $query): void
    {
        $query->where(function (Builder $q) {
            $q->where(
                function (Builder $subQ) {
                    // Keep: undivided projects (is_divided_into_phases = false and no parent_project_id)
                    $subQ->where('is_divided_into_phases', false)
                        ->whereNull('parent_project_id');
                }
            )->orWhere(
                    function (Builder $subQ) {
                        // Keep: daily sub-projects (has phase_day OR phase_type = 'daily' with parent_project_id)
                        $subQ->whereNotNull('phase_day')
                            ->orWhere('phase_type', 'daily')
                            ->whereNotNull('parent_project_id');
                    }
                )->orWhere(
                    function (Builder $subQ) {
                        // Keep: monthly sub-projects (has month_number OR phase_type = 'monthly' with parent_project_id)
                        $subQ->whereNotNull('month_number')
                            ->orWhere('phase_type', 'monthly')
                            ->whereNotNull('parent_project_id');
                    }
                );
        });
    }

    /**
     * Apply role-based filters.
     *
     * ✅ Improvements:
     *    - Arrow functions for cleaner closures
     *    - Cached team-ID lookup for project_manager (avoids repeated sub-query)
     *    - whereIntegerInRaw for integer arrays (skips PDO parameter binding overhead)
     *    - whereIn for coordinator statuses (single query instead of OR chain)
     *    - Fixed media_manager no-op (was: whereNull OR whereNotNull ≡ no filter)
     */
    private function applyRoleFilters(Builder $query, string $userRole, int $userId): void
    {
        switch ($userRole) {
            case 'admin':
                // ✅ Apply admin filtering logic: exclude original divided parent projects
                $this->applyAdminFilter($query);
                break;

            case 'project_manager':
                // ✅ Cache team IDs for 10 min — avoids sub-query on every request
                $teamIds = $this->getUserTeamIds($userId);

                $query->where(function (Builder $q) use ($userId, $teamIds) {
                    if (!empty($teamIds)) {
                        // ✅ whereIntegerInRaw: faster for int arrays (no PDO binding)
                        $q->whereIntegerInRaw('assigned_to_team_id', $teamIds);
                    }
                    $q->orWhere('assigned_by', $userId);
                });
                break;

            case 'media_manager':
                // ✅ FIX: Previous code was whereNull OR whereNotNull = ALL rows (no-op).
                //    Now intentionally left unfiltered — media managers see all projects.
                //    If you need "only projects WITH photographer", uncomment below:
                // $query->whereNotNull('assigned_photographer_id');
                break;

            case 'executed_projects_coordinator':
                $query->where(function (Builder $q) {
                    // ✅ whereIn instead of multiple orWhere — single comparison
                    $q->whereIn('status', self::COORDINATOR_STATUSES)
                        ->orWhere('is_daily_phase', true)
                        ->orWhere('is_monthly_phase', true)
                        ->orWhere(
                            fn(Builder $subQ) =>
                            $subQ->where('is_divided_into_phases', false)
                                ->where('status', '!=', 'جديد')
                        );
                });
                break;

            case 'orphan_sponsor_coordinator':
                // Orphan coordinators see all sponsorship projects
                $query->where('project_type', 'الكفالات');
                // Also apply admin filter to handle divided projects correctly (exclude parents)
                $this->applyAdminFilter($query);
                break;

            default:
                $query->where('created_by', $userId);
                break;
        }
    }

    /**
     * ✅ NEW: Cached team-ID resolver — avoids a sub-query on every page load.
     *    Cache key is per-user, TTL = 10 minutes.
     *    Invalidate via: Cache::forget("user_team_ids:{$userId}")
     */
    private function getUserTeamIds(int $userId): array
    {
        return Cache::remember(
            "user_team_ids:{$userId}",
            now()->addMinutes(10),
            fn() => DB::table('team_members')
                ->where('user_id', $userId)
                ->pluck('team_id')
                ->all() // ✅ ->all() returns plain array (faster than ->toArray())
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Reusable Multi-Value Filter Helpers (DRY)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * ✅ NEW: Generic multi-value filter — eliminates repeated if/explode/whereIn blocks.
     *    Handles: single value, comma-separated string, or array.
     */
    private function applyMultiValueFilter(Builder $query, string $column, mixed $value): void
    {
        if (empty($value) || $value === 'all') {
            return;
        }

        $values = $this->parseMultiValue($value);

        if (count($values) === 1) {
            $query->where($column, $values[0]);
        } else {
            $query->whereIn($column, $values);
        }
    }

    /**
     * ✅ NEW: Integer-specific multi-value filter — uses whereIntegerInRaw
     *    for better performance (no PDO parameter binding, no type casting overhead).
     */
    private function applyIntegerMultiValueFilter(Builder $query, string $column, mixed $value): void
    {
        if (empty($value)) {
            return;
        }

        $values = $this->parseMultiValue($value);
        $intValues = array_filter(array_map('intval', $values)); // ✅ remove zeros from bad input

        if (empty($intValues)) {
            return;
        }

        if (count($intValues) === 1) {
            $query->where($column, reset($intValues));
        } else {
            $query->whereIntegerInRaw($column, $intValues);
        }
    }

    /**
     * ✅ NEW: Parse mixed input into a flat array.
     *    Handles: "1,2,3" → [1,2,3], [1,2,3] → [1,2,3], "single" → ["single"]
     */
    private function parseMultiValue(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_filter($value, fn($v) => $v !== '' && $v !== null));
        }

        if (is_string($value) && str_contains($value, ',')) {
            return array_values(array_filter(
                array_map('trim', explode(',', $value)),
                fn($v) => $v !== ''
            ));
        }

        return [$value];
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Individual Filters
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Apply status filter — now delegates to reusable helper.
     */
    private function applyStatusFilter(Builder $query, Request $request): void
    {
        $this->applyMultiValueFilter($query, 'status', $request->get('status', 'all'));
    }

    /**
     * Apply project type filter — now delegates to reusable helper.
     */
    private function applyProjectTypeFilter(Builder $query, Request $request): void
    {
        $this->applyMultiValueFilter($query, 'project_type', $request->get('project_type', 'all'));
    }

    /**
     * Apply search filter.
     *
     * ✅ Improvements:
     *    - Escapes LIKE wildcards (%, _, \) to prevent unintended pattern matching
     *    - Trims whitespace before checking
     *    - Uses constant array for searchable columns
     */
    private function applySearchFilter(Builder $query, Request $request): void
    {
        $searchQuery = trim((string) $request->get('searchQuery', $request->get('search', '')));

        if ($searchQuery === '') {
            return;
        }

        // ✅ Escape LIKE special characters so user input like "100%" doesn't break results
        $escaped = str_replace(
            ['\\', '%', '_'],
            ['\\\\', '\\%', '\\_'],
            $searchQuery
        );

        $query->where(function (Builder $q) use ($escaped) {
            foreach (self::SEARCHABLE_COLUMNS as $index => $column) {
                $method = $index === 0 ? 'where' : 'orWhere';
                $q->{$method}($column, 'like', "%{$escaped}%");
            }

            // ✅ Include the parent project's serial_number and other searchable columns
            $q->orWhereHas('parentProject', function (Builder $pq) use ($escaped) {
                foreach (self::SEARCHABLE_COLUMNS as $index => $column) {
                    $method = $index === 0 ? 'where' : 'orWhere';
                    $pq->{$method}($column, 'like', "%{$escaped}%");
                }
            });
        });
    }

    /**
     * Apply date filters using range comparisons for better index utilization.
     *
     * ✅ Improvements:
     *    - Uses WHERE col >= '2024-01-01 00:00:00' instead of WHERE DATE(col) >= '2024-01-01'
     *      → This allows MySQL/PostgreSQL to use an index on the column
     *    - Uses Carbon for safe date parsing with try-catch
     *    - Supports all parameter name variants: start_date/end_date, created_at_start/created_at_end, created_from/created_to
     */
    private function applyDateFilters(Builder $query, Request $request): void
    {
        // Resolve created_at start from multiple possible parameter names (priority order)
        $startDate = $request->input('start_date')
            ?? $request->input('created_at_start')
            ?? $request->input('created_from');

        $endDate = $request->input('end_date')
            ?? $request->input('created_at_end')
            ?? $request->input('created_to');

        // ✅ Range comparison instead of whereDate() — allows index usage on created_at
        if ($startDate && $this->isValidDate($startDate)) {
            $query->where('created_at', '>=', Carbon::parse($startDate)->startOfDay());
        }
        if ($endDate && $this->isValidDate($endDate)) {
            $query->where('created_at', '<=', Carbon::parse($endDate)->endOfDay());
        }

        // Execution date filters (assuming DATE column, direct comparison is fine)
        if ($request->filled('execution_date_from') && $this->isValidDate($request->input('execution_date_from'))) {
            $query->where('execution_date', '>=', $request->input('execution_date_from'));
        }
        if ($request->filled('execution_date_to') && $this->isValidDate($request->input('execution_date_to'))) {
            $query->where('execution_date', '<=', $request->input('execution_date_to'));
        }
    }

    /**
     * ✅ NEW: Safe date validation — prevents Carbon::parse exceptions on garbage input.
     */
    private function isValidDate(mixed $date): bool
    {
        if (empty($date) || !is_string($date)) {
            return false;
        }

        try {
            Carbon::parse($date);
            return true;
        } catch (\Exception) {
            return false;
        }
    }

    /**
     * Apply additional filters.
     *
     * ✅ Improvements:
     *    - DRY: Loop over a config array instead of repeating the same if/explode/whereIn 4 times
     *    - Uses applyIntegerMultiValueFilter → whereIntegerInRaw for integer FKs
     *    - Phase type extracted to its own method with match expression
     */
    private function applyAdditionalFilters(Builder $query, Request $request, string $userRole): void
    {
        // ✅ DRY: All integer-FK filters in one loop
        $integerFilters = [
            'team_id' => 'assigned_to_team_id',
            'photographer_id' => 'assigned_photographer_id',
            'researcher_id' => 'assigned_researcher_id',
            'montage_producer_id' => 'assigned_montage_producer_id',
            'shelter_id' => 'shelter_id',
            'subcategory_id' => 'subcategory_id',
        ];

        foreach ($integerFilters as $requestParam => $dbColumn) {
            if ($request->filled($requestParam)) {
                $this->applyIntegerMultiValueFilter($query, $dbColumn, $request->input($requestParam));
            }
        }

        // Phase type filter
        if ($request->filled('phase_type')) {
            $this->applyPhaseTypeFilter($query, $request->input('phase_type'));
        }

        // Montage status multi-value filter
        if ($request->filled('montage_status')) {
            $this->applyMultiValueFilter($query, 'status', $request->input('montage_status'));
        }

        // Montage statuses only (for Media Manager projects list)
        if ($request->boolean('montage_statuses_only')) {
            $query->whereIn('status', [
                'جاهز للتنفيذ',
                'تم اختيار المخيم',
                'قيد التنفيذ',
                'تم التنفيذ',
                'في المونتاج',
                'تم المونتاج',
                'معاد مونتاجه',
                'وصل للمتبرع'
            ]);
        }

        // Delayed filter
        if ($request->boolean('is_delayed')) {
            $notDelayedStatuses = ['وصل للمتبرع', 'منتهي', 'تم التنفيذ', 'منفذ', 'ملغى'];
            $query->whereNotIn('status', $notDelayedStatuses)
                ->where(function (Builder $q) {
                    $q->where(
                        function (Builder $subQ) {
                            $subQ->where('is_daily_phase', true)
                                ->whereNotNull('execution_date')
                                ->whereRaw("DATEDIFF(execution_date, NOW()) <= 0");
                        }
                    )
                        ->orWhere(
                            function (Builder $subQ) {
                                $subQ->where(
                                    function (Builder $qq) {
                                        $qq->where('is_daily_phase', false)
                                            ->orWhereNull('is_daily_phase');
                                    }
                                )
                                    ->whereNotNull('created_at')
                                    ->whereNotNull('estimated_duration_days')
                                    ->whereRaw("DATEDIFF(NOW(), created_at) >= estimated_duration_days");
                            }
                        );
                });
        }
    }

    /**
     * ✅ NEW: Extracted phase type logic — cleaner with match expression.
     */
    private function applyPhaseTypeFilter(Builder $query, string $phaseType): void
    {
        match ($phaseType) {
            'daily' => $query->where('is_daily_phase', true),
            'monthly' => $query->where('is_monthly_phase', true),
            'parent' => $query->where('is_divided_into_phases', true)->whereNull('parent_project_id'),
            default => null, // unknown phase_type → no filter
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Eager Loading
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Load relationships based on user role.
     *
     * ✅ Improvements:
     *    - Strict in_array comparison
     *    - Arrow function for assignedToTeam constraint
     *    - Same output shape — no display change
     */
    private function loadRelationships(Builder $query, string $userRole): void
    {
        $relations = [
            'currency:id,currency_code,currency_name_ar',
        ];

        if (in_array($userRole, self::PRIVILEGED_ROLES, true)) {
            $relations['assignedToTeam'] = fn($q) =>
                $q->select('id', 'team_name')
                    ->with('photographers:id,name,phone_number');

            $relations[] = 'assignedResearcher:id,name,phone_number';
            $relations[] = 'photographer:id,name';
            // ✅ Frontend needs montage producer name in the projects list (media manager)
            $relations[] = 'assignedMontageProducer:id,name,phone_number,email';
        }

        if (in_array($userRole, ['executed_projects_coordinator', 'admin', 'media_manager', 'orphan_sponsor_coordinator'], true)) {
            $relations[] = 'shelter:manager_id_number,camp_name';
        }

        $query->with($relations);
        $query->withCount('sponsoredOrphans');
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Sorting
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Apply sorting.
     *
     * ✅ Improvements:
     *    - Whitelist validation via ALLOWED_SORT_COLUMNS constant (prevents SQL injection)
     *    - Sanitizes sort_order to only 'asc' or 'desc'
     *    - Replaces switch with simple in_array check
     */
    private function applySorting(Builder $query, Request $request): void
    {
        $sortBy = $request->get('sort_by', 'default');
        $sortOrder = strtolower($request->get('sort_order', 'desc')) === 'asc' ? 'asc' : 'desc';

        if ($sortBy !== 'default' && in_array($sortBy, self::ALLOWED_SORT_COLUMNS, true)) {
            $query->orderBy($sortBy, $sortOrder);
        } else {
            $query->orderBy('created_at', 'desc');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Pagination
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get pagination per page value based on user role.
     *
     * ✅ Improvements:
     *    - Extracted limit constants
     *    - Simplified conditional flow with early returns
     *    - Same behavior — no display change
     */
    private const PER_PAGE_DEFAULT = 15;
    private const PER_PAGE_MAX_GENERAL = 50;
    private const PER_PAGE_MAX_MANAGER = 2000;
    private const PER_PAGE_MAX_MEDIA_MANAGER = 1000;
    private const PER_PAGE_MAX_ORPHAN_COORDINATOR = 5000;
    private const PER_PAGE_MAX_REPORTS = 10000;
    private const PER_PAGE_UNFINISHED_DEFAULT = 5000;

    /**
     * @param bool $forceAllDefault  When true (unfinished endpoint), return all results by default
     *                               unless the client explicitly sends per_page.
     */
    public function getPerPageValue(Request $request, string $userRole, bool $forceAllDefault = false): int
    {
        $perPageInput = $request->query('per_page', $request->query('perPage', null));

        // ── Unfinished endpoint default: return all unless client sends per_page ─
        if ($forceAllDefault && $perPageInput === null) {
            return self::PER_PAGE_UNFINISHED_DEFAULT;
        }

        // Fallback to default if no per_page was given
        if ($perPageInput === null) {
            $perPageInput = self::PER_PAGE_DEFAULT;
        }

        $hasDateFilter = $request->hasAny(['start_date', 'end_date', 'created_at_start', 'created_at_end']);

        // ── Report mode: date filters present → allow up to 10 000 ──────────
        if ($hasDateFilter) {
            $requested = (int) $perPageInput;
            if ($requested >= 1) {
                return min($requested, self::PER_PAGE_MAX_REPORTS);
            }
        }

        // ── Orphan sponsor coordinator: special high limit ──────────────────
        if ($userRole === 'orphan_sponsor_coordinator') {
            return $this->resolveOrphanCoordinatorPerPage($perPageInput, $request);
        }

        // ── "all" / "الكل" requests: require at least one filter ───────────
        if ($perPageInput === 'all' || $perPageInput === 'الكل') {
            // ✅ When forceAllDefault is true, skip the filter requirement
            if ($forceAllDefault) {
                return self::PER_PAGE_UNFINISHED_DEFAULT;
            }
            return $this->resolveAllPerPage($request, $userRole);
        }

        // ── Explicit per_page parameter ─────────────────────────────────────
        if ($request->hasAny(['per_page', 'perPage'])) {
            return $this->clampPerPage((int) $perPageInput, $userRole);
        }

        return self::PER_PAGE_DEFAULT;
    }

    /**
     * ✅ NEW: Orphan coordinator per-page resolver — extracted for readability.
     */
    private function resolveOrphanCoordinatorPerPage(mixed $input, Request $request): int
    {
        if ($input === 'all' || $input === 'الكل') {
            return self::PER_PAGE_MAX_ORPHAN_COORDINATOR;
        }

        if ($request->hasAny(['per_page', 'perPage'])) {
            return min(max(1, (int) $input), self::PER_PAGE_MAX_ORPHAN_COORDINATOR);
        }

        return 1000; // default for orphan coordinator
    }

    /**
     * ✅ NEW: Resolve "all" request — ensures at least one filter is present.
     */
    private function resolveAllPerPage(Request $request, string $userRole): int
    {
        $hasFilter = ($request->filled('status') && $request->get('status') !== 'all')
            || ($request->filled('project_type') && $request->get('project_type') !== 'all')
            || $request->filled('searchQuery')
            || $request->filled('search')
            || $request->filled('team_id')
            || $request->filled('photographer_id')
            || $request->filled('shelter_id')
            || $request->boolean('montage_statuses_only')
            || $request->hasAny(['start_date', 'end_date', 'created_at_start', 'created_at_end']);

        if (!$hasFilter) {
            abort(422, 'يجب تحديد فلترة (status, project_type, searchQuery, team_id, تواريخ، إلخ) عند طلب جميع المشاريع');
        }

        return $userRole === 'media_manager'
            ? self::PER_PAGE_MAX_MEDIA_MANAGER
            : self::PER_PAGE_MAX_MANAGER;
    }

    /**
     * ✅ NEW: Clamp per_page to role-appropriate maximum.
     */
    private function clampPerPage(int $perPage, string $userRole): int
    {
        $max = match (true) {
            $userRole === 'media_manager' => self::PER_PAGE_MAX_MEDIA_MANAGER,
            in_array($userRole, ['admin', 'project_manager'], true) => self::PER_PAGE_MAX_MANAGER,
            default => self::PER_PAGE_MAX_GENERAL,
        };

        return min(max(1, $perPage), $max);
    }
}