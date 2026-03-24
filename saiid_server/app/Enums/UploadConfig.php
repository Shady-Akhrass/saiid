<?php
// app/Enums/UploadConfig.php

namespace App\Enums;

class UploadConfig
{
    public const MAX_IMAGE_SIZE_KB = 5120;
    public const ALLOWED_IMAGE_MIMES = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    public const PROJECT_IMAGES_DIR = 'project_images';
    public const PROJECT_NOTES_IMAGES_DIR = 'project_notes_images';

    public static function mimesString(): string
    {
        return implode(',', self::ALLOWED_IMAGE_MIMES);
    }
}