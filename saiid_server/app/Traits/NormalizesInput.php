<?php
// app/Traits/NormalizesInput.php

namespace App\Traits;

use Schema;

trait NormalizesInput
{
    protected function normalizeBoolean($value, bool $default = false): bool
    {
        if (in_array($value, ['true', true, 1, '1'], true)) {
            return true;
        }
        if (in_array($value, ['false', false, 0, '0'], true)) {
            return false;
        }
        return $default;
    }

    protected function columnExists(string $table, string $column): bool
    {
        try {
            return in_array($column, Schema::getColumnListing($table));
        } catch (\Exception) {
            return false;
        }
    }
}