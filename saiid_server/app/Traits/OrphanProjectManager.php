<?php
// app/Traits/OrphanProjectManager.php

namespace App\Traits;

use App\Enums\UserRole;
use App\Models\Orphan;
use App\Models\ProjectProposal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

trait OrphanProjectManager
{
    /**
     * Add orphans to sponsorship project
     */
    protected function addOrphans(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!$this->hasRole($user, [UserRole::ADMIN, UserRole::ORPHAN_SPONSOR_COORDINATOR])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لإضافة أيتام للمشروع');
        }

        $validator = Validator::make($request->all(), [
            'orphan_ids' => 'required|array|min:1',
            'orphan_ids.*' => 'required|string|exists:orphans,orphan_id_number',
            'is_recurring' => 'nullable|boolean',
            'sponsorship_end_date' => 'nullable|date|after_or_equal:today',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $project = ProjectProposal::findOrFail($id);

            // Validation Checks
            $check = $this->validateOrphanAddition($project, $request->orphan_ids);
            if ($check !== true)
                return $check;

            DB::beginTransaction();

            $isRecurring = $request->boolean('is_recurring', false);
            $targetProject = $this->resolveTargetProject($project, $isRecurring);

            if (!$targetProject) {
                DB::rollBack();
                return response()->json(['success' => false, 'error' => 'المشروع الأصلي غير موجود'], 404);
            }

            [$added, $skipped] = $this->attachOrphans($targetProject, $request->orphan_ids, $isRecurring, $request->sponsorship_end_date);

            // Sync Monthly Phases if applicable
            if ($isRecurring && $targetProject->is_divided_into_phases && $targetProject->phase_type === 'monthly') {
                $targetProject->syncRecurringOrphansToMonthlyPhases();

                // Ensure current monthly phase gets them immediately
                if ($project->is_monthly_phase && $project->parent_project_id === $targetProject->id) {
                    $this->attachOrphans($project, $request->orphan_ids, true, $request->sponsorship_end_date);
                }
            }

            DB::commit();
            $this->clearProjectsCache();

            return response()->json([
                'success' => true,
                'message' => "تم إضافة {$added} يتيم بنجاح" . ($skipped > 0 ? " (تم تخطي {$skipped})" : ''),
                'project' => $project->load('sponsoredOrphans'),
                'added_count' => $added,
                'skipped_count' => $skipped,
                'total_orphans' => $project->sponsoredOrphans()->count()
            ], 200);

        }
        catch (\Exception $e) {
            DB::rollBack();
            Log::error('Add orphans error', ['id' => $id, 'error' => $e->getMessage()]);
            return $this->errorResponse('خطأ في إضافة الأيتام', $e->getMessage(), 500, $e);
        }
    }

    /**
     * Remove orphan from project
     */
    protected function removeOrphan(Request $request, int $projectId, string $orphanId): JsonResponse
    {
        if (!$this->hasRole($request->user(), [UserRole::ADMIN, UserRole::ORPHAN_SPONSOR_COORDINATOR])) {
            return $this->unauthorizedResponse();
        }

        try {
            $project = ProjectProposal::findOrFail($projectId);

            if (!$project->isSponsorshipProject()) {
                return $this->errorResponse('خطأ', 'المشروع ليس مشروع كفالة', 422);
            }

            $exists = DB::table('orphan_project_proposals')
                ->where('project_proposal_id', $project->id)
                ->where('orphan_id_number', $orphanId)
                ->exists();

            if (!$exists)
                return $this->notFoundResponse('اليتيم غير موجود في هذا المشروع');

            $project->sponsoredOrphans()->detach($orphanId);
            $this->clearProjectsCache();

            return response()->json([
                'success' => true,
                'message' => 'تم إزالة اليتيم بنجاح',
                'total_orphans' => $project->sponsoredOrphans()->count()
            ]);

        }
        catch (\Exception $e) {
            return $this->errorResponse('فشل الإزالة', $e->getMessage(), 500, $e);
        }
    }

    /**
     * Get orphans for project
     */
    protected function getProjectOrphansList(Request $request, int $id): JsonResponse
    {
        if (!$this->hasRole($request->user(), [UserRole::ADMIN, UserRole::ORPHAN_SPONSOR_COORDINATOR, UserRole::EXECUTED_PROJECTS_COORDINATOR])) {
            return $this->unauthorizedResponse();
        }

        try {
            $project = ProjectProposal::with('sponsoredOrphans')->findOrFail($id);
            return response()->json([
                'success' => true,
                'project_id' => $project->id,
                'orphans' => $project->sponsoredOrphans,
                'total_count' => $project->sponsoredOrphans->count(),
                'recurring_count' => $project->recurringOrphans()->count()
            ]);
        }
        catch (\Exception $e) {
            return $this->errorResponse('فشل جلب الأيتام', $e->getMessage(), 500);
        }
    }

    /**
     * Get projects for orphan
     */
    protected function getOrphanProjectsList(Request $request, string $orphanId): JsonResponse
    {
        if (!$this->hasRole($request->user(), [UserRole::ADMIN, UserRole::ORPHAN_SPONSOR_COORDINATOR])) {
            return $this->unauthorizedResponse();
        }

        try {
            $orphan = Orphan::findOrFail($orphanId);
            $projects = $orphan->sponsoredProjects()
                ->with(['currency', 'projectType', 'subcategory'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'orphan' => ['id' => $orphan->orphan_id_number, 'name' => $orphan->orphan_full_name],
                'projects' => $projects,
                'total_count' => $projects->count()
            ]);
        }
        catch (\Exception $e) {
            return $this->errorResponse('فشل جلب المشاريع', $e->getMessage(), 500);
        }
    }

    // ─── Helpers ─────────────────────────────────────────

    private function validateOrphanAddition(ProjectProposal $project, array $orphanIds): bool|JsonResponse
    {
        if (!$project->isSponsorshipProject()) {
            return response()->json(['success' => false, 'error' => 'يمكن إضافة الأيتام فقط لمشاريع الكفالات'], 422);
        }

        if (!in_array($project->status, ['جديد', 'تم التوريد', 'مسند لباحث', 'قيد التنفيذ', 'قيد التوريد'])) {
            return response()->json(['success' => false, 'error' => 'حالة المشروع الحالية (' . $project->status . ') لا تسمح بإضافة أيتام'], 422);
        }

        $existing = Orphan::whereIn('orphan_id_number', $orphanIds)->pluck('orphan_id_number')->toArray();
        $missing = array_diff($orphanIds, $existing);

        if (!empty($missing)) {
            return response()->json(['success' => false, 'error' => 'بعض الأيتام غير موجودين', 'missing' => $missing], 422);
        }

        return true;
    }

    private function resolveTargetProject(ProjectProposal $project, bool $isRecurring): ?ProjectProposal
    {
        if ($isRecurring && $project->is_monthly_phase && $project->parent_project_id) {
            return ProjectProposal::find($project->parent_project_id);
        }
        return $project;
    }

    private function attachOrphans(ProjectProposal $project, array $ids, bool $isRecurring, ?string $endDate = null): array
    {
        $added = 0;
        $skipped = 0;
        $now = now();
        $remainingDays = null;
        $sponsorshipAmount = null;

        // ✅ حساب مبلغ الكفالة لليتيم الواحد بناءً على صافي مبلغ المشروع وعدد المستفيدين
        if ($project->net_amount > 0 && $project->beneficiaries_count > 0) {
            $sponsorshipAmount = round($project->net_amount / $project->beneficiaries_count, 2);
        }

        if ($endDate) {
            $end = \Carbon\Carbon::parse($endDate);
            $remainingDays = max(0, $now->diffInDays($end, false));
        }

        foreach ($ids as $id) {
            $exists = DB::table('orphan_project_proposals')
                ->where('project_proposal_id', $project->id)
                ->where('orphan_id_number', $id)
                ->exists();

            if ($exists) {
                $skipped++;
                continue;
            }

            $project->sponsoredOrphans()->attach($id, [
                'is_recurring' => $isRecurring,
                'sponsorship_amount' => $sponsorshipAmount,
                'sponsorship_start_date' => $now,
                'sponsorship_end_date' => $endDate,
                'remaining_days' => $remainingDays,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            // ✅ زيادة عدد مرات الاستفادة لليتيم
            DB::table('orphans')
                ->where('orphan_id_number', $id)
                ->increment('beneficiary_count');

            $added++;
        }

        return [$added, $skipped];
    }
}