<?php
// app/Services/ProjectUpdateService.php

namespace App\Services;

use App\Enums\ProjectStatusGroup;
use App\Enums\UserRole;
use App\Models\Currency;
use App\Models\ProjectProposal;
use App\Models\ProjectProposalImage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ProjectUpdateService
{
    private const REJECTION_FIELDS = [
        'rejection_reason',
        'rejection_message',
        'admin_rejection_reason',
        'media_rejection_reason',
    ];

    private const EXCLUDED_FROM_PROJECT_DATA = [
        'notes_image', 'project_image', 'isChecked',
        '_method', 'exchange_rate', 'beneficiaries_count',
        'status', 'sent_to_donor_date', 'completed_date',
        'project_description', 'project_type_id', 'project_type',
        'currency_id',
    ];

    public function __construct(
        protected ProjectTypeResolver $typeResolver,
        protected PhaseFieldProcessor $phaseProcessor,
        protected ProjectDataCleaner $dataCleaner,
        protected ProjectProposalImageService $imageService,
        protected ProjectProposalService $proposalService,
    ) {}

    // ─── Public Entry Point ──────────────────────────────

    /**
     * @return array{success: bool, project?: ProjectProposal, error?: string, code?: int}
     */
    public function update(Request $request, int $projectId, User $user): array
    {
        $project = ProjectProposal::findOrFail($projectId);

        // Authorization
        $authError = $this->authorize($user, $project);
        if ($authError) {
            return ['success' => false, 'error' => $authError, 'code' => 403];
        }

        // Block daily phase general updates (except media status)
        $isMediaUpdate = $this->isMediaStatusUpdate($request);
        if ($project->is_daily_phase && !$isMediaUpdate) {
            return [
                'success' => false,
                'error'   => 'يجب تحديث المشروع الأصلي لتحديث المشاريع اليومية',
                'code'    => 422,
            ];
        }

        // Resolve project type
        $typeResult = $this->typeResolver->resolve($request, $project);
        if ($typeResult['error']) {
            return ['success' => false, 'error' => $typeResult['error'], 'code' => 422];
        }
        $projectType = $typeResult['type'];

        // Validate subcategory
        if ($projectType) {
            $subError = $this->typeResolver->validateSubcategory($request, $projectType);
            if ($subError) {
                return ['success' => false, 'error' => $subError, 'code' => 422];
            }
        }

        $oldStatus = $project->status;

        // Build update data
        $updateData = $this->buildUpdateData($request, $project, $projectType, $isMediaUpdate);

        // Handle image uploads
        $imageResult = $this->imageService->handleProjectImageUploads($request, $project);
        if (isset($imageResult['error'])) {
            return ['success' => false, 'error' => 'فشل رفع الصور', 'code' => 500];
        }
        if (isset($imageResult['project_image'])) {
            $updateData['project_image'] = $imageResult['project_image'];
        }

        // Process phase fields + clean
        $updateData = $this->phaseProcessor->process($request, $updateData);
        $updateData = $this->dataCleaner->clean($updateData);

        // Perform the update
        $this->performUpdate($project, $updateData, $oldStatus, $user);

        // Sync note images
        $syncResult = $this->imageService->syncNoteImages($request, $project);
        if (isset($syncResult['error'])) {
            return ['success' => false, 'error' => 'فشل مزامنة صور الملاحظات', 'code' => 500];
        }

        // Update child projects
        $this->syncChildProjects($project, $request, $updateData);

        return [
            'success' => true,
            'project' => $project->fresh(['currency', 'creator', 'subcategory']),
        ];
    }

    // ─── Beneficiaries-Only Detection ────────────────────

    public function isBeneficiariesOnlyUpdate(Request $request): bool
    {
        $data = $request->except(['_method', '_token', 'isChecked']);
        $beneficiariesFields = ['beneficiaries_count', 'beneficiaries_per_unit'];

        $hasBeneficiaries = $request->has('beneficiaries_count')
            || $request->has('beneficiaries_per_unit');

        $nonBeneficiaries = array_diff(array_keys($data), $beneficiariesFields);

        return $hasBeneficiaries && empty($nonBeneficiaries);
    }

    // ─── Authorization ───────────────────────────────────

    private function authorize(User $user, ProjectProposal $project): ?string
    {
        // Handle if role is an enum object or string
        $userRole = $user->role;
        if ($userRole instanceof UserRole) {
            $userRole = $userRole->value;
        }
        $role = strtolower($userRole ?? '');
        $isSponsorshipProject = $project->isSponsorshipProject();
        $isOrphanCoordinator = $role === UserRole::ORPHAN_SPONSOR_COORDINATOR->value;

        // Debug logging
        \Log::info('ProjectUpdateService::authorize', [
            'user_id' => $user->id,
            'user_role_raw' => $user->role,
            'user_role_type' => gettype($user->role),
            'user_role_is_enum' => $user->role instanceof UserRole,
            'role_lower' => $role,
            'admin_value' => UserRole::ADMIN->value,
            'is_admin' => $role === UserRole::ADMIN->value,
            'is_orphan_coordinator' => $isOrphanCoordinator,
            'is_sponsorship_project' => $isSponsorshipProject,
            'project_id' => $project->id,
        ]);

        if ($isOrphanCoordinator && !$isSponsorshipProject) {
            return 'منسق الكفالة يمكنه تحديث مشاريع الكفالات فقط';
        }

        if ($role !== UserRole::ADMIN->value && !($isOrphanCoordinator && $isSponsorshipProject)) {
            return 'ليس لديك صلاحيات لتعديل مشروع';
        }

        return null;
    }

    // ─── Media Status Check ──────────────────────────────

    private function isMediaStatusUpdate(Request $request): bool
    {
        return $request->has('status')
            && ProjectStatusGroup::isMediaStatus($request->status);
    }

    // ─── Build Update Data ───────────────────────────────

    private function buildUpdateData(
        Request $request,
        ProjectProposal $project,
        ?\App\Models\ProjectType $projectType,
        bool $isMediaUpdate,
    ): array {
        $updateData = [];

        // Description
        $this->mergeDescription($request, $updateData);

        // Project type
        $this->mergeProjectType($request, $projectType, $updateData);

        // Currency + exchange rate
        $this->mergeCurrency($request, $project, $updateData);

        // Media status fields
        if ($isMediaUpdate) {
            $this->mergeMediaStatus($request, $updateData);
        }

        // Rejection fields
        $this->mergeRejectionFields($request, $updateData);

        // Clear rejection on acceptance
        if (isset($updateData['status'])
            && in_array($updateData['status'], ProjectStatusGroup::REJECTION_CLEAR_STATUSES)) {
            foreach (self::REJECTION_FIELDS as $field) {
                $updateData[$field] = null;
            }
        }

        // Is divided into phases
        if ($request->has('is_divided_into_phases')) {
            $updateData['is_divided_into_phases'] = $this->proposalService
                ->normalizeBoolean($request->input('is_divided_into_phases'), false);
        }

        // Project name
        $this->mergeProjectName($request, $project, $updateData);

        // Remaining fields (exclude handled ones)
        $remaining = $request->except(self::EXCLUDED_FROM_PROJECT_DATA);
        foreach ($remaining as $key => $value) {
            if (!isset($updateData[$key]) && $value !== null && $value !== '') {
                $updateData[$key] = $value;
            }
        }

        return $updateData;
    }

    private function mergeDescription(Request $request, array &$data): void
    {
        if (!$request->has('project_description')) {
            return;
        }

        $desc = $request->input('project_description');
        $data['project_description'] = ($desc !== null && trim($desc) !== '')
            ? $desc
            : null;
    }

    private function mergeProjectType(
        Request $request,
        ?\App\Models\ProjectType $projectType,
        array &$data,
    ): void {
        if (!$projectType) {
            return;
        }
        if (!$request->has('project_type_id') && !$request->has('project_type')) {
            return;
        }

        $data['project_type_id'] = $projectType->id;
        $data['project_type'] = $projectType->name;
    }

    private function mergeCurrency(
        Request $request,
        ProjectProposal $project,
        array &$data,
    ): void {
        if (!$request->has('currency_id')) {
            return;
        }

        $data['currency_id'] = $request->input('currency_id');

        // Only update exchange rate if currency actually changed
        $newCurrencyId = $request->input('currency_id');
        if ($project->currency_id != $newCurrencyId) {
            $currency = Currency::findOrFail($newCurrencyId);
            $data['exchange_rate'] = $currency->exchange_rate_to_usd;
        }
    }

    private function mergeMediaStatus(Request $request, array &$data): void
    {
        $data['status'] = $request->status;

        if ($request->status === 'وصل للمتبرع') {
            $data['sent_to_donor_date'] = $request->sent_to_donor_date ?? now()->toDateString();
        }

        if ($request->status === 'منتهي') {
            $data['completed_date'] = $request->completed_date ?? now()->toDateString();
        }
    }

    private function mergeRejectionFields(Request $request, array &$data): void
    {
        foreach (self::REJECTION_FIELDS as $field) {
            if ($request->has($field)) {
                $data[$field] = $request->input($field);
            }
        }
    }

    private function mergeProjectName(
        Request $request,
        ProjectProposal $project,
        array &$data,
    ): void {
        if (!$request->has('project_name')) {
            return;
        }

        $name = $request->input('project_name');

        $data['project_name'] = !empty($name)
            ? Str::limit(trim($name), 255)
            : $this->proposalService->buildProjectName(
                null,
                $request->input('donor_code', $project->donor_code),
                $request->input('project_type', $project->project_type),
                $project->serial_number,
            );
    }

    // ─── Perform Update ──────────────────────────────────

    private function performUpdate(
        ProjectProposal $project,
        array $updateData,
        string $oldStatus,
        User $user,
    ): void {
        if (isset($updateData['status'])) {
            $this->performStatusUpdate($project, $updateData, $oldStatus, $user);
        } else {
            $project->update($updateData);
            $project->refresh();
        }
    }

    private function performStatusUpdate(
        ProjectProposal $project,
        array $updateData,
        string $oldStatus,
        User $user,
    ): void {
        Log::info('UPDATE PROJECT STATUS', [
            'project_id' => $project->id,
            'old_status' => $oldStatus,
            'new_status' => $updateData['status'],
        ]);

        DB::beginTransaction();
        try {
            $updateData['updated_at'] = now();
            DB::table('project_proposals')
                ->where('id', $project->id)
                ->update($updateData);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        // Reload without events
        $project = ProjectProposal::withoutEvents(fn () => ProjectProposal::find($project->id));

        if ($oldStatus !== $updateData['status']) {
            $project->recordStatusChange(
                $oldStatus,
                $updateData['status'],
                $user->id,
                'تم تحديث الحالة من لوحة التحكم'
            );
        }
    }

    // ─── Sync Child Projects ─────────────────────────────

    private function syncChildProjects(
        ProjectProposal $project,
        Request $request,
        array $updateData,
    ): void {
        if (!$project->isParentProject()) {
            return;
        }

        $project->refresh();
        $children = $project->dailyPhases->concat($project->monthlyPhases);

        if ($children->isEmpty()) {
            return;
        }

        // Sync note images
        $childIds = $children->pluck('id')->all();
        ProjectProposalImage::whereIn('project_proposal_id', $childIds)
            ->where('type', 'note')
            ->delete();
        $project->copyNoteImagesToAllChildren($children);

        // Build list of updated fields
        $updatedFields = array_keys($updateData);
        foreach (['project_name', 'phase_duration_days', 'phase_start_date'] as $field) {
            if (($request->has($field) || isset($updateData[$field]))
                && !in_array($field, $updatedFields)) {
                $updatedFields[] = $field;
            }
        }

        $project->updateChildProjects($updatedFields);
    }
}