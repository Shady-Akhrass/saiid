<?php
// app/Enums/PhaseType.php

namespace App\Enums;

class PhaseType
{
    public const DAILY = 'daily';
    public const MONTHLY = 'monthly';

    public static function all(): array
    {
        return [self::DAILY, self::MONTHLY];
    }
}