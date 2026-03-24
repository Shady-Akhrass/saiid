<?php

namespace App\Helpers;

use App\Models\Notification;
use App\Models\ProjectProposal;
use App\Models\Team;
use App\Models\User;

/**
 * Helper Class لإنشاء إشعارات تلقائية لجميع مراحل المشروع
 * 
 * ⚠️ ملاحظة مهمة:
 * جميع الإشعارات في هذا النظام خاصة بالإدارة (Admin) فقط.
 * - جميع الإشعارات تُرسل فقط للمستخدمين الذين لديهم دور 'admin'
 * - لا يتم إرسال إشعارات للفرق أو مديري المشاريع أو أي أدوار أخرى
 * - هذا يضمن أن الإدارة فقط هي من ترى جميع التحديثات في النظام
 * 
 * 🔮 إمكانية التوسع المستقبلي:
 * يمكن بسهولة إضافة إشعارات لمدير المشاريع أو أي أدوار أخرى في المستقبل
 * عن طريق تعديل Helper Functions لإضافة المستخدمين المطلوبين
 */
class NotificationHelper
{
    /**
     * إنشاء إشعار عند إنشاء مشروع جديد
     * جميع الإشعارات خاصة بالإدارة (Admin) فقط
     * ✅ إضافة: إشعار لمنسق الكفالة إذا كان المشروع مشروع كفالة
     */
    public static function createProjectCreatedNotification(ProjectProposal $project)
    {
        // الإدارة فقط
        $users = User::where('role', 'admin')->get();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        
        foreach ($users as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'project_created',
                'title' => 'مشروع جديد تم إنشاؤه',
                'message' => "تم إنشاء مشروع جديد: {$projectCode} - {$project->project_name}",
                'is_read' => false,
                'priority' => 'medium',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'project_type' => $project->project_type,
                    'donor_name' => $project->donor_name,
                    'donation_amount' => $project->donation_amount,
                    'currency' => $project->currency->currency_code ?? null,
                    'created_by' => auth()->id(),
                    'created_by_name' => auth()->check() ? auth()->user()->name : null,
                    'created_at' => now()->toISOString(),
                ],
            ]);
        }

        // ✅ إشعار لمنسق الكفالة إذا كان المشروع مشروع كفالة
        if ($project->isSponsorshipProject()) {
            $sponsorCoordinators = User::where('role', 'orphan_sponsor_coordinator')->active()->get();
            
            foreach ($sponsorCoordinators as $coordinator) {
                Notification::create([
                    'user_id' => $coordinator->id,
                    'project_id' => $project->id,
                    'related_project_id' => $project->id,
                    'notification_type' => 'project_created', // ✅ استخدام نوع موجود في ENUM
                    'title' => 'مشروع كفالة جديد',
                    'message' => "تم إنشاء مشروع كفالة جديد: {$projectCode} - {$project->project_name}",
                    'is_read' => false,
                    'priority' => 'high',
                    'metadata' => [
                        'project_id' => $project->id,
                        'project_name' => $project->project_name,
                        'internal_code' => $project->internal_code,
                        'project_type' => $project->project_type,
                        'donor_name' => $project->donor_name,
                        'donation_amount' => $project->donation_amount,
                        'created_at' => now()->toISOString(),
                    ],
                ]);
            }
        }
    }

    /**
     * إنشاء إشعار عند إسناد الباحث للمشروع
     */
    public static function createResearcherAssignedNotification(
        ProjectProposal $project,
        $researcher,
        ?User $assignedBy = null
    ) {
        $assignedBy = $assignedBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';
        
        // إرسال إشعار لـ Media Manager لإسناد المصور
        $mediaManagers = User::where('role', 'media_manager')->get();
        
        foreach ($mediaManagers as $manager) {
            Notification::create([
                'user_id' => $manager->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'researcher_assigned',
                'title' => 'مشروع يحتاج إسناد مصور',
                'message' => "تم إسناد المشروع ({$projectName} + {$projectCode}) للباحث {$researcher->name} - يرجى إسناد المصور",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'researcher_id' => $researcher->id,
                    'researcher_name' => $researcher->name,
                    'assigned_by' => $assignedBy->id ?? null,
                    'assigned_by_name' => $assignedBy->name ?? null,
                    'assignment_date' => now()->toISOString(),
                    'new_status' => 'مسند لباحث',
                ],
            ]);
        }

        // ✅ إشعار لمنسق الكفالة إذا كان المشروع مشروع كفالة
        if ($project->isSponsorshipProject()) {
            $sponsorCoordinators = User::where('role', 'orphan_sponsor_coordinator')->active()->get();
            
            foreach ($sponsorCoordinators as $coordinator) {
                Notification::create([
                    'user_id' => $coordinator->id,
                    'project_id' => $project->id,
                    'related_project_id' => $project->id,
                    'notification_type' => 'researcher_assigned', // ✅ استخدام نوع موجود في ENUM
                    'title' => 'تم إسناد الباحث لمشروع كفالة',
                    'message' => "تم إسناد المشروع ({$projectName} + {$projectCode}) للباحث {$researcher->name}",
                    'is_read' => false,
                    'priority' => 'medium',
                    'metadata' => [
                        'project_id' => $project->id,
                        'project_name' => $project->project_name,
                        'internal_code' => $project->internal_code,
                        'researcher_id' => $researcher->id,
                        'researcher_name' => $researcher->name,
                        'assigned_by' => $assignedBy->id ?? null,
                        'assigned_by_name' => $assignedBy->name ?? null,
                        'assignment_date' => now()->toISOString(),
                    ],
                ]);
            }
        }
    }

    /**
     * إنشاء إشعار عند إسناد المصور للمشروع
     */
    public static function createPhotographerAssignedNotification(
        ProjectProposal $project,
        $photographer,
        ?User $assignedBy = null
    ) {
        $assignedBy = $assignedBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';
        
        // إرسال إشعار للإدارة
        $admins = User::where('role', 'admin')->get();
        
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'photographer_assigned',
                'title' => 'تم إسناد المصور - المشروع جاهز للتنفيذ',
                'message' => "تم إسناد المصور {$photographer->name} للمشروع ({$projectName} + {$projectCode}) - المشروع جاهز للتنفيذ",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'photographer_id' => $photographer->id,
                    'photographer_name' => $photographer->name,
                    'assigned_by' => $assignedBy->id ?? null,
                    'assigned_by_name' => $assignedBy->name ?? null,
                    'assignment_date' => now()->toISOString(),
                    'new_status' => 'جاهز للتنفيذ',
                ],
            ]);
        }
    }

    /**
     * إنشاء إشعار عند توزيع المشروع على فريق (للتوافق مع البيانات القديمة)
     */
    public static function createProjectAssignedNotification(
        ProjectProposal $project,
        Team $team = null,
        $photographer = null,
        ?User $assignedBy = null
    ) {
        $assignedBy = $assignedBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        
        $metadata = [
            'project_id' => $project->id,
            'project_name' => $project->project_name,
            'internal_code' => $project->internal_code ?? $project->id,
            'team_id' => $team->id ?? null,
            'team_name' => $team->team_name ?? null,
            'photographer_id' => $photographer->id ?? null,
            'photographer_name' => $photographer->name ?? null,
            'assigned_by' => $assignedBy->id ?? null,
            'assigned_by_name' => $assignedBy->name ?? null,
            'assignment_date' => now()->toISOString(),
            'new_status' => 'جاهز للتنفيذ',
        ];
        
        // الإدارة فقط
        $usersToNotify = User::where('role', 'admin')->get();
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'project_assigned',
                'title' => 'تم تعيين مشروع جديد',
                'message' => $team 
                    ? "تم تعيين المشروع {$projectCode} ({$project->project_name}) لفريق: {$team->team_name}"
                    : "تم تعيين المشروع {$projectCode} ({$project->project_name})",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => $metadata,
            ]);
        }
    }

    /**
     * إنشاء إشعار عند تغيير حالة المشروع
     */
    public static function createProjectStatusChangedNotification(
        ProjectProposal $project,
        string $oldStatus,
        string $newStatus,
        ?User $changedBy = null
    ) {
        $changedBy = $changedBy ?? auth()->user();
        
        $priority = self::getPriorityForStatus($newStatus);
        
        // ✅ تحديد نص الإشعار حسب الحالة
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';
        
        if ($newStatus === 'تم التنفيذ' || $newStatus === 'منفذ') {
            // ✅ نص خاص عند تنفيذ المشروع
            $message = "المشروع ({$projectName} + {$projectCode}) تم تنفيذه";
        } else {
            // ✅ نص عام لتغيير الحالة
            $message = "تم تغيير حالة المشروع {$projectCode} من '{$oldStatus}' إلى '{$newStatus}'";
        }
        
        // الإدارة فقط
        $usersToNotify = User::where('role', 'admin')->get();
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'project_status_changed',
                'title' => 'تم تغيير حالة المشروع',
                'message' => $message,
                'is_read' => false,
                'priority' => $priority,
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus,
                    'changed_by' => $changedBy->id ?? null,
                    'changed_by_name' => $changedBy->name ?? null,
                    'changed_at' => now()->toISOString(),
                ],
            ]);
        }
    }

    /**
     * إنشاء إشعار عند اختيار مخيم
     */
    public static function createShelterSelectedNotification(
        ProjectProposal $project,
        $shelter,
        ?User $selectedBy = null
    ) {
        $selectedBy = $selectedBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        
        // الإدارة فقط
        $usersToNotify = User::where('role', 'admin')->get();
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'shelter_selected',
                'title' => 'تم اختيار مخيم للمشروع',
                'message' => "تم اختيار المخيم '{$shelter->camp_name}' للمشروع {$projectCode} ({$project->project_name})",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'shelter_id' => $shelter->manager_id_number ?? $shelter->id,
                    'shelter_name' => $shelter->camp_name,
                    'selected_by' => $selectedBy->id ?? null,
                    'selected_by_name' => $selectedBy->name ?? null,
                    'selected_at' => now()->toISOString(),
                    'new_status' => 'تم اختيار المخيم',
                ],
            ]);
        }
    }

    /**
     * إنشاء إشعار عند تحديث حالة المونتاج
     * 
     * عند "وصل للمتبرع":
     * - يتم إرسال إشعار خاص media_completed للإدارة
     * - هذا الإشعار يحتوي على خيار القبول/الرفض
     * - الإدارة يمكنها الرد على الإشعار (قبول أو رفض)
     * 
     * عند "تم المونتاج" أو "يجب إعادة المونتاج" أو أي حالة أخرى:
     * - يتم إرسال إشعار media_updated عادي للإدارة
     * - هذا الإشعار إعلامي فقط (بدون خيار القبول/الرفض)
     */
    public static function createMediaUpdatedNotification(
        ProjectProposal $project,
        string $mediaStatus,
        ?string $notes = null,
        ?User $updatedBy = null
    ) {
        $updatedBy = $updatedBy ?? auth()->user();
        
        $priority = $mediaStatus === 'وصل للمتبرع' ? 'high' : 'medium';
        
        // تحديد نص الإشعار حسب حالة المونتاج
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';
        
        // ✅ التحقق من وصول المونتاج للمتبرع (يتم إرسال إشعار خاص للإدارة مع خيار القبول/الرفض)
        $isDeliveredToDonor = $mediaStatus === 'وصل للمتبرع';
        
        if ($isDeliveredToDonor) {
            // إرسال إشعار خاص media_completed للإدارة عند وصول المونتاج للمتبرع (يمكن الرد عليه بقبول/رفض)
            self::createMediaCompletedNotification($project, $mediaStatus, $notes, $updatedBy);
        } else {
            // إرسال إشعار عام media_updated للإدارة (إشعار عادي بدون خيار القبول/الرفض)
            if ($mediaStatus === 'في المونتاج') {
                $message = "المشروع ({$projectName} + {$projectCode}) تم والحالة الحالية فيه";
            } else {
                $message = "تم تحديث حالة المونتاج للمشروع {$projectCode} إلى '{$mediaStatus}'";
            }
            
            // الإدارة فقط
            $usersToNotify = User::where('role', 'admin')->get();
            
            foreach ($usersToNotify as $user) {
                Notification::create([
                    'user_id' => $user->id,
                    'project_id' => $project->id,
                    'related_project_id' => $project->id,
                    'notification_type' => 'media_updated',
                    'title' => 'تم تحديث حالة المونتاج',
                    'message' => $message,
                    'is_read' => false,
                    'priority' => $priority,
                    'metadata' => [
                        'project_id' => $project->id,
                        'project_name' => $project->project_name,
                        'internal_code' => $project->internal_code,
                        'media_status' => $mediaStatus,
                        'media_notes' => $notes,
                        'updated_by' => $updatedBy->id ?? null,
                        'updated_by_name' => $updatedBy->name ?? null,
                        'updated_at' => now()->toISOString(),
                    ],
                ]);
            }
        }
    }

    /**
     * إنشاء إشعار عند وصول المونتاج للمتبرع (وصل للمتبرع)
     * 
     * هذا الإشعار خاص بالإدارة فقط ويمكن الرد عليه (قبول/رفض)
     * - نوع الإشعار: media_completed
     * - يحتوي على خيار القبول/الرفض للإدارة
     * - يمكن للإدارة الرد على الإشعار عبر NotificationController@accept أو NotificationController@reply
     */
    private static function createMediaCompletedNotification(
        ProjectProposal $project,
        string $mediaStatus,
        ?string $notes = null,
        ?User $updatedBy = null
    ) {
        $updatedBy = $updatedBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';
        
        $message = "وصل المونتاج للمتبرع للمشروع ({$projectName} + {$projectCode})";
        
        // الإدارة فقط
        $usersToNotify = User::where('role', 'admin')->get();
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'media_completed',
                'title' => 'وصل المونتاج للمتبرع - يحتاج مراجعة',
                'message' => $message,
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'media_status' => $mediaStatus,
                    'media_notes' => $notes,
                    'updated_by' => $updatedBy->id ?? null,
                    'updated_by_name' => $updatedBy->name ?? null,
                    'updated_at' => now()->toISOString(),
                ],
            ]);
        }
    }

    /**
     * إنشاء إشعار رفض المونتاج لقسم الإعلام
     * يتم استدعاء هذه الدالة عند رد الإدارة على إشعار media_completed
     */
    public static function createMediaRejectionNotification(
        ProjectProposal $project,
        string $message,
        string $rejectionReason,
        ?User $repliedBy = null
    ) {
        $repliedBy = $repliedBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';
        
        // قسم الإعلام فقط (media_manager)
        $usersToNotify = User::where('role', 'media_manager')->get();
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'media_rejected',
                'title' => 'تم رفض المونتاج',
                'message' => "تم رفض المونتاج للمشروع ({$projectName} + {$projectCode})",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'rejection_message' => $message,
                    'rejection_reason' => $rejectionReason,
                    'replied_by' => $repliedBy->id ?? null,
                    'replied_by_name' => $repliedBy->name ?? null,
                    'rejected_at' => now()->toISOString(),
                ],
            ]);
        }
    }

    /**
     * إنشاء إشعار قبول المونتاج لقسم الإعلام
     * يتم استدعاء هذه الدالة عند قبول الإدارة للمونتاج
     */
    public static function createMediaAcceptanceNotification(
        ProjectProposal $project,
        ?User $acceptedBy = null
    ) {
        $acceptedBy = $acceptedBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';
        
        // تحديد الحالة الحالية للمشروع بعد القبول
        $currentStatus = $project->status ?? 'غير معروف';
        $statusMessage = $currentStatus === 'منتهي' 
            ? "وتم نقله إلى حالة 'منتهي'"
            : "وتم نقله إلى حالة '{$currentStatus}'";
        
        // قسم الإعلام فقط (media_manager)
        $usersToNotify = User::where('role', 'media_manager')->get();
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'media_accepted',
                'title' => 'تم قبول المونتاج',
                'message' => "تم قبول المونتاج للمشروع ({$projectName} + {$projectCode}) {$statusMessage}",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'accepted_by' => $acceptedBy->id ?? null,
                    'accepted_by_name' => $acceptedBy->name ?? null,
                    'accepted_at' => now()->toISOString(),
                    'new_status' => $currentStatus,
                ],
            ]);
        }
    }

    /**
     * إنشاء إشعار عند تأجيل المشروع
     */
    public static function createProjectPostponedNotification(
        ProjectProposal $project,
        ?string $reason = null,
        string $oldStatus,
        ?User $postponedBy = null
    ) {
        $postponedBy = $postponedBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        
        // استخدام السبب من Request أو من Project أو قيمة افتراضية
        $finalReason = $reason 
            ?? $project->postponement_reason 
            ?? 'لم يتم تحديد سبب';
        
        // الإدارة فقط
        $usersToNotify = User::where('role', 'admin')->get();
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'project_postponed',
                'title' => 'تم تأجيل المشروع',
                'message' => "تم تأجيل المشروع {$projectCode} ({$project->project_name})." . 
                            ($finalReason ? " السبب: {$finalReason}" : ''),
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'old_status' => $oldStatus,
                    'new_status' => 'مؤجل',
                    'postponement_reason' => $finalReason,
                    'postponed_by' => $postponedBy->id ?? null,
                    'postponed_by_name' => $postponedBy->name ?? null,
                    'postponed_at' => now()->toISOString(),
                ],
            ]);
        }
    }

    /**
     * إنشاء إشعار عند استئناف المشروع
     */
    public static function createProjectResumedNotification(
        ProjectProposal $project,
        string $newStatus,
        ?User $resumedBy = null
    ) {
        $resumedBy = $resumedBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        
        // الإدارة فقط
        $usersToNotify = User::where('role', 'admin')->get();
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'project_resumed',
                'title' => 'تم استئناف المشروع',
                'message' => "تم استئناف المشروع {$projectCode} ({$project->project_name})",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'old_status' => 'مؤجل',
                    'new_status' => $newStatus,
                    'resumed_by' => $resumedBy->id ?? null,
                    'resumed_by_name' => $resumedBy->name ?? null,
                    'resumed_at' => now()->toISOString(),
                ],
            ]);
        }
    }

    /**
     * إنشاء إشعار عند إلغاء المشروع
     */
    public static function createProjectCancelledNotification(
        ProjectProposal $project,
        string $oldStatus,
        ?string $reason = null,
        ?User $cancelledBy = null
    ) {
        $cancelledBy = $cancelledBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        
        // الإدارة فقط
        $usersToNotify = User::where('role', 'admin')->get();
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'project_cancelled',
                'title' => 'تم إلغاء المشروع',
                'message' => "تم إلغاء المشروع {$projectCode} ({$project->project_name})" . ($reason ? ". السبب: {$reason}" : ''),
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'old_status' => $oldStatus,
                    'new_status' => 'ملغى',
                    'cancellation_reason' => $reason,
                    'cancelled_by' => $cancelledBy->id ?? null,
                    'cancelled_by_name' => $cancelledBy->name ?? null,
                    'cancelled_at' => now()->toISOString(),
                ],
            ]);
        }
    }

    /**
     * إنشاء إشعار عند بدء يوم جديد في المشروع اليومي
     */
    public static function createDailyPhaseNotification(
        ProjectProposal $project,
        int $phaseDay,
        int $totalDays,
        ?ProjectProposal $parentProject = null,
        ?float $dailyAmount = null,
        ?float $totalAmount = null,
        ?float $dailyNetAmount = null,
        ?float $netAmount = null
    ) {
        // الإدارة فقط
        $usersToNotify = User::where('role', 'admin')->get();
        
        $metadata = [
            'project_id' => $project->id,
            'project_name' => $project->project_name,
            'parent_project_id' => $parentProject->id ?? null,
            'parent_project_name' => $parentProject->project_name ?? null,
            'phase_day' => $phaseDay,
            'total_days' => $totalDays,
            'daily_amount' => $dailyAmount,
            'total_amount' => $totalAmount,
            'daily_net_amount' => $dailyNetAmount,
            'net_amount' => $netAmount,
            'phase_start_date' => now()->toISOString(),
        ];
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $parentProject->id ?? $project->id,
                'notification_type' => 'daily_phase',
                'title' => 'بدء يوم جديد في المشروع',
                'message' => "بدأ اليوم {$phaseDay} من المشروع {$project->project_name}" . ($totalDays ? " من {$totalDays}" : ''),
                'is_read' => false,
                'priority' => 'high',
                'metadata' => $metadata,
            ]);
        }
    }

    /**
     * إنشاء إشعار عند نقل المشروع للتنفيذ
     */
    public static function createProjectTransferredToExecutionNotification(
        ProjectProposal $project,
        string $oldStatus,
        ?User $transferredBy = null
    ) {
        $transferredBy = $transferredBy ?? auth()->user();
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        
        // الإدارة فقط
        $usersToNotify = User::where('role', 'admin')->get();
        
        foreach ($usersToNotify as $user) {
            Notification::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'project_transferred_to_execution',
                'title' => 'تم نقل المشروع للتنفيذ',
                'message' => "تم نقل المشروع {$projectCode} ({$project->project_name}) إلى مرحلة التنفيذ",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'old_status' => $oldStatus,
                    'new_status' => 'قيد التنفيذ',
                    'transferred_by' => $transferredBy->id ?? null,
                    'transferred_by_name' => $transferredBy->name ?? null,
                    'transferred_at' => now()->toISOString(),
                ],
            ]);
        }
    }

    /**
     * تحديد الأولوية حسب الحالة
     */
    private static function getPriorityForStatus($status)
    {
        $highPriorityStatuses = ['قيد التنفيذ', 'تم التنفيذ', 'وصل للمتبرع'];
        $mediumPriorityStatuses = ['جاهز للتنفيذ', 'تم اختيار المخيم', 'في المونتاج'];
        
        if (in_array($status, $highPriorityStatuses)) {
            return 'high';
        } elseif (in_array($status, $mediumPriorityStatuses)) {
            return 'medium';
        }
        return 'low';
    }

    // ==================== Warehouse Notifications ====================

    /**
     * إشعار بدء التوريد
     */
    public static function createSupplyStartedNotification($project)
    {
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        
        $warehouseManagers = User::where('role', 'warehouse_manager')->get();
        foreach ($warehouseManagers as $manager) {
            Notification::create([
                'user_id' => $manager->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'supply_started',
                'title' => 'بدء توريد مشروع',
                'message' => "المشروع #{$projectCode} في مرحلة التوريد",
                'is_read' => false,
                'priority' => 'medium',
                'metadata' => [
                    'project_id' => $project->id,
                    'internal_code' => $project->internal_code,
                    'project_description' => $project->project_description,
                    'net_amount' => $project->net_amount,
                ],
            ]);
        }
    }

    /**
     * إشعار تأكيد التوريد - مع تفاصيل الطرد
     */
    public static function createSupplyConfirmedNotification($project)
    {
        // تحميل الأصناف المؤكدة مع تفاصيل المخزن
        $project->load(['confirmedWarehouseItems.warehouseItem']);
        
        // بناء قائمة محتويات الطرد
        $itemsList = [];
        $itemsText = "";
        foreach ($project->confirmedWarehouseItems as $item) {
            $itemName = $item->warehouseItem->item_name ?? 'صنف غير معروف';
            $quantityPerUnit = $item->quantity_per_unit;
            $itemsList[] = [
                'name' => $itemName,
                'quantity_per_unit' => $quantityPerUnit,
                'unit_price' => $item->unit_price,
                'total_price' => $item->total_price_per_unit,
            ];
            $itemsText .= "\n• {$itemName} ({$quantityPerUnit} لكل طرد)";
        }
        
        // اسم المشروع
        $projectName = $project->project_name ?? $project->project_description ?? 'مشروع بدون اسم';
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        
        // بناء الرسالة التفصيلية
        $message = "🎁 طلب تجهيز طرود جديد\n\n";
        $message .= "📋 المشروع: {$projectName}";
        if ($projectCode) {
            $message .= " ({$projectCode})";
        }
        $message .= "\n📦 عدد الطرود: {$project->quantity} طرد";
        $message .= "\n\n📝 محتوى الطرد الواحد:{$itemsText}";
        
        $warehouseManagers = User::where('role', 'warehouse_manager')->get();
        foreach ($warehouseManagers as $manager) {
            Notification::create([
                'user_id' => $manager->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'supply_confirmed',
                'title' => "🎁 تجهيز {$project->quantity} طرد - {$projectName}",
                'message' => $message,
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $projectName,
                    'internal_code' => $project->internal_code,
                    'donor_code' => $project->donor_code,
                    'supply_cost' => $project->supply_cost,
                    'quantity' => $project->quantity,
                    'items' => $itemsList,
                    'items_count' => count($itemsList),
                ],
            ]);
        }

        // ✅ إشعار لمنسق الكفالة إذا كان المشروع مشروع كفالة
        if ($project->isSponsorshipProject()) {
            $sponsorCoordinators = User::where('role', 'orphan_sponsor_coordinator')->active()->get();
            
            foreach ($sponsorCoordinators as $coordinator) {
                Notification::create([
                    'user_id' => $coordinator->id,
                    'project_id' => $project->id,
                    'related_project_id' => $project->id,
                    'notification_type' => 'sponsorship_supply_confirmed',
                    'title' => 'تم تأكيد التوريد لمشروع كفالة',
                    'message' => "تم تأكيد التوريد للمشروع {$projectName} ({$projectCode}) - يمكنك الآن إضافة الأيتام المكفولين",
                    'is_read' => false,
                    'priority' => 'high',
                    'metadata' => [
                        'project_id' => $project->id,
                        'project_name' => $projectName,
                        'internal_code' => $project->internal_code,
                        'donor_code' => $project->donor_code,
                        'supply_cost' => $project->supply_cost,
                        'quantity' => $project->quantity,
                        'status' => $project->status,
                    ],
                ]);
            }
        }
    }

    /**
     * إشعار وجود عجز
     */
    public static function createDeficitNotification($project, $deficitAmount)
    {
        // ✅ تحديد العملة المستخدمة (شيكل أو دولار)
        $currency = $project->getSupplyCurrency(); // 'ILS' أو 'USD'
        $currencyName = $currency === 'ILS' ? 'شيكل' : 'دولار';
        
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        
        // للإدارة
        $admin = User::where('role', 'admin')->first();
        if ($admin) {
            Notification::create([
                'user_id' => $admin->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'project_deficit',
                'title' => 'تنبيه: مشروع به عجز',
                'message' => "المشروع #{$projectCode} به عجز قدره " . abs($deficitAmount) . " {$currencyName}",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'internal_code' => $project->internal_code,
                    'deficit_amount' => abs($deficitAmount),
                    'deficit_currency' => $currency,
                    'net_amount' => $project->net_amount,
                    'supply_cost' => $project->supply_cost,
                ],
            ]);
        }
        
        // لمدير المشاريع
        $projectManagers = User::where('role', 'project_manager')->get();
        foreach ($projectManagers as $pm) {
            Notification::create([
                'user_id' => $pm->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'project_deficit',
                'title' => 'تنبيه: مشروع به عجز',
                'message' => "المشروع #{$projectCode} به عجز قدره " . abs($deficitAmount) . " {$currencyName}",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'internal_code' => $project->internal_code,
                    'deficit_amount' => abs($deficitAmount),
                    'deficit_currency' => $currency,
                    'net_amount' => $project->net_amount,
                    'supply_cost' => $project->supply_cost,
                ],
            ]);
        }
    }

    /**
     * إشعار نقص كمية في المخزن
     */
    public static function createLowStockNotification($warehouseItem)
    {
        $warehouseManagers = User::where('role', 'warehouse_manager')->get();
        foreach ($warehouseManagers as $manager) {
            Notification::create([
                'user_id' => $manager->id,
                'notification_type' => 'low_stock',
                'title' => 'تنبيه: نقص في المخزن',
                'message' => "الصنف '{$warehouseItem->item_name}' - الكمية المتوفرة: {$warehouseItem->quantity_available}",
                'is_read' => false,
                'priority' => 'medium',
                'metadata' => [
                    'warehouse_item_id' => $warehouseItem->id,
                    'item_name' => $warehouseItem->item_name,
                    'quantity_available' => $warehouseItem->quantity_available,
                ],
            ]);
        }
    }

    // ==================== Montage Producer Notifications ====================

    /**
     * إشعار إسناد مشروع لممنتج مونتاج
     */
    public static function createMontageProducerAssignedNotification(
        ProjectProposal $project,
        User $montageProducer
    ) {
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';
        
        Notification::create([
            'user_id' => $montageProducer->id,
            'project_id' => $project->id,
            'related_project_id' => $project->id,
            'notification_type' => 'montage_producer_assigned',
            'title' => 'تم إسناد مشروع لك',
            'message' => "تم إسناد المشروع ({$projectName} + {$projectCode}) لك لعمل المونتاج",
            'is_read' => false,
            'priority' => 'high',
            'metadata' => [
                'project_id' => $project->id,
                'project_name' => $project->project_name,
                'internal_code' => $project->internal_code,
                'donor_code' => $project->donor_code,
                'assigned_at' => now()->toISOString(),
            ],
        ]);
    }

    /**
     * إشعار ممنتج المونتاج أكمل المونتاج
     */
    public static function createMontageCompletedByProducerNotification(
        ProjectProposal $project,
        User $montageProducer
    ) {
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';
        
        // إرسال إشعار لمدير الإعلام
        $mediaManagers = User::where('role', 'media_manager')->get();
        
        foreach ($mediaManagers as $manager) {
            Notification::create([
                'user_id' => $manager->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'montage_completed_by_producer',
                'title' => 'اكتمل المونتاج - يحتاج مراجعة',
                'message' => "ممنتج المونتاج {$montageProducer->name} أكمل المونتاج للمشروع ({$projectName} + {$projectCode})",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'donor_code' => $project->donor_code,
                    'montage_producer_id' => $montageProducer->id,
                    'montage_producer_name' => $montageProducer->name,
                    'completed_at' => now()->toISOString(),
                ],
            ]);
        }
    }

    /**
     * إشعار مدير الإعلام وافق على المونتاج
     */
    public static function createMontageApprovedByManagerNotification(
        ProjectProposal $project,
        User $manager
    ) {
        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';
        
        // إرسال إشعار لممنتج المونتاج
        if ($project->assigned_montage_producer_id) {
            Notification::create([
                'user_id' => $project->assigned_montage_producer_id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'montage_approved_by_manager',
                'title' => 'تم قبول المونتاج',
                'message' => "تم قبول المونتاج للمشروع ({$projectName} + {$projectCode}) وتم نقله إلى حالة 'وصل للمتبرع'",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'donor_code' => $project->donor_code,
                    'approved_by' => $manager->id,
                    'approved_by_name' => $manager->name,
                    'approved_at' => now()->toISOString(),
                ],
            ]);
        }
    }

    /**
     * إنشاء إشعار عند اكتمال مشروع بدون ملف Excel للمستفيدين
     */
    public static function createMissingBeneficiariesFileNotification(ProjectProposal $project)
    {
        // التحقق من أن المشروع في حالة "تم التنفيذ" أو "منفذ"
        if (!in_array($project->status, ['تم التنفيذ', 'منفذ'])) {
            return;
        }

        // التحقق من عدم وجود ملف Excel
        if ($project->hasBeneficiariesFile()) {
            return;
        }

        $projectCode = $project->donor_code ?? $project->internal_code ?? '';
        $projectName = $project->project_name ?? 'مشروع بدون اسم';

        // للإدارة
        $admins = User::where('role', 'admin')->get();
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'missing_beneficiaries_file',
                'title' => 'تنبيه: مشروع مكتمل بدون ملف Excel للمستفيدين',
                'message' => "المشروع {$projectCode} ({$projectName}) في حالة '{$project->status}' ولا يحتوي على ملف Excel للمستفيدين",
                'is_read' => false,
                'priority' => 'medium',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'status' => $project->status,
                    'created_at' => now()->toISOString(),
                ],
            ]);
        }

        // لمنسق المشاريع المنفذة
        $coordinators = User::where('role', 'executed_projects_coordinator')->get();
        foreach ($coordinators as $coordinator) {
            Notification::create([
                'user_id' => $coordinator->id,
                'project_id' => $project->id,
                'related_project_id' => $project->id,
                'notification_type' => 'missing_beneficiaries_file',
                'title' => 'تنبيه: مشروع مكتمل بدون ملف Excel للمستفيدين',
                'message' => "المشروع {$projectCode} ({$projectName}) في حالة '{$project->status}' ولا يحتوي على ملف Excel للمستفيدين. يرجى رفع الملف.",
                'is_read' => false,
                'priority' => 'high',
                'metadata' => [
                    'project_id' => $project->id,
                    'project_name' => $project->project_name,
                    'internal_code' => $project->internal_code,
                    'status' => $project->status,
                    'created_at' => now()->toISOString(),
                ],
            ]);
        }
    }
}

