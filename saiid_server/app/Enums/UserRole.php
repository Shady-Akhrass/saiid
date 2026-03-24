<?php

namespace App\Enums;

enum UserRole: string
{
    case ADMIN = 'admin';
    case PROJECT_MANAGER = 'project_manager';
    case MEDIA_MANAGER = 'media_manager';
    case EXECUTED_PROJECTS_COORDINATOR = 'executed_projects_coordinator';
    case ORPHAN_SPONSOR_COORDINATOR = 'orphan_sponsor_coordinator';
}