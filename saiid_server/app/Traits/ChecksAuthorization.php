<?php
// app/Traits/ChecksAuthorization.php

namespace App\Traits;

use App\Enums\UserRole;
use App\Models\User;

trait ChecksAuthorization
{
    protected function isAdmin(?User $user): bool
    {
        return $this->hasRole($user, [UserRole::ADMIN]);
    }

    protected function hasRole(?User $user, array $allowedRoles): bool
    {
        if (!$user) {
            return false;
        }

        // Get user role as string (handling enum objects)
        $userRole = $this->getUserRole($user);

        // Convert enum objects to their string values
        $allowedRoleStrings = array_map(function($role) {
            if (is_object($role) && property_exists($role, 'value')) {
                return strtolower($role->value);
            }
            return strtolower($role);
        }, $allowedRoles);

        return in_array($userRole, $allowedRoleStrings);
    }

    protected function getUserRole(?User $user): string
    {
        // Handle if role is an enum object or string
        $userRole = $user->role ?? 'guest';
        if ($userRole instanceof UserRole) {
            $userRole = $userRole->value;
        }
        return strtolower($userRole);
    }
}