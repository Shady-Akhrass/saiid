<?php
// app/Enums/ProjectStatusGroup.php (UPDATED — add new groups)

namespace App\Enums;

class ProjectStatusGroup
{
    // ── existing groups ──
    public const BEFORE_EXECUTION = [
        'جديد', 'قيد التوريد', 'تم التوريد',
        'قيد التوزيع', 'جاهز للتنفيذ', 'مؤجل',
    ];

    public const AFTER_EXECUTION = [
        'تم التنفيذ', 'في المونتاج', 'تم المونتاج',
        'يجب إعادة المونتاج', 'وصل للمتبرع', 'ملغى',
    ];

    public const MEDIA_STATUSES = [
        'في المونتاج', 'تم المونتاج',
        'يجب إعادة المونتاج', 'وصل للمتبرع', 'منتهي',
    ];

    public const BLOCKED_FOR_ASSIGNMENT = [
        'جديد', 'قيد التوريد', 'مؤجل',
    ];

    public const ALLOWED_FOR_PHOTOGRAPHER = [
        'مسند لباحث', 'جاهز للتنفيذ', 'قيد التنفيذ',
    ];

    public const REJECTION_CLEAR_STATUSES = [
        'تم المونتاج', 'وصل للمتبرع', 'منتهي',
    ];

    // ── NEW groups ──

    public const TERMINAL = ['منتهي', 'ملغى'];

    public const NON_POSTPONABLE = [
        'تم التنفيذ', 'في المونتاج', 'تم المونتاج',
        'وصل للمتبرع', 'منتهي', 'ملغى',
    ];

    public const ADVANCED = [
        'تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'وصل للمتبرع',
    ];

    public const ALLOWED_FOR_SHEKEL_CONVERSION = ['جديد', 'قيد التوريد'];

    public const ALLOWED_FOR_TRANSFER = ['قيد التنفيذ', 'جاهز للتنفيذ', 'تم التنفيذ'];

    public const ALLOWED_FOR_MONTAGE_ASSIGNMENT = ['تم التنفيذ', 'في المونتاج', 'يجب إعادة المونتاج'];

    // ── helpers ──

    public static function isTerminal(string $status): bool
    {
        return in_array($status, self::TERMINAL);
    }

    public static function isBeforeExecution(string $status): bool
    {
        return in_array($status, self::BEFORE_EXECUTION);
    }

    public static function isAfterExecution(string $status): bool
    {
        return in_array($status, self::AFTER_EXECUTION);
    }

    public static function isMediaStatus(string $status): bool
    {
        return in_array($status, self::MEDIA_STATUSES);
    }

    public static function isAdvanced(string $status): bool
    {
        return in_array($status, self::ADVANCED);
    }
}