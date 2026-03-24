<?php
// app/Enums/ProjectStatus.php

namespace App\Enums;

class ProjectStatus
{
    public const NEW = 'جديد';
    public const SUPPLY = 'قيد التوريد';
    public const SUPPLIED = 'تم التوريد';
    public const DISTRIBUTION = 'قيد التوزيع';
    public const READY = 'جاهز للتنفيذ';
    public const EXECUTING = 'قيد التنفيذ';
    public const POSTPONED = 'مؤجل';
    public const EXECUTED = 'تم التنفيذ';
    public const MONTAGE = 'في المونتاج';
    public const MONTAGE_COMPLETED = 'تم المونتاج';
    public const MONTAGE_REDO = 'يجب إعادة المونتاج';
    public const DELIVERED = 'وصل للمتبرع';
    public const ASSIGNED_TO_RESEARCHER = 'مسند لباحث';

    public static function all(): array
    {
        return [
            self::NEW,
            self::SUPPLY,
            self::SUPPLIED,
            self::DISTRIBUTION,
            self::READY,
            self::EXECUTING,
            self::POSTPONED,
            self::EXECUTED,
            self::MONTAGE,
            self::MONTAGE_COMPLETED,
            self::MONTAGE_REDO,
            self::DELIVERED,
            self::ASSIGNED_TO_RESEARCHER,
        ];
    }
}