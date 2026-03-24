<?php
// app/Traits/HandlesFileUploads.php

namespace App\Traits;

use App\Enums\UploadConfig;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

trait HandlesFileUploads
{
    protected function uploadImage(
        ?UploadedFile $file,
        string $directory,
        ?string $oldImagePath = null
    ): ?string {
        if (!$file || !$file->isValid()) {
            return null;
        }

        $maxBytes = UploadConfig::MAX_IMAGE_SIZE_KB * 1024;
        if ($file->getSize() > $maxBytes) {
            throw new \Exception('حجم الملف يتجاوز الحد الأقصى (5 ميجابايت)');
        }

        $this->deleteFileIfExists($oldImagePath);

        $extension = $this->resolveExtension($file);
        $this->assertAllowedExtension($extension);

        $fileName = time() . '_' . Str::random(8) . '.' . $extension;
        $uploadDir = public_path($directory);

        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $file->move($uploadDir, $fileName);

        $path = "{$directory}/{$fileName}";
        Log::info('Image uploaded', ['path' => $path]);

        return $path;
    }

    protected function deleteFileIfExists(?string $relativePath): void
    {
        if (!$relativePath) {
            return;
        }

        $fullPath = public_path($relativePath);

        if (file_exists($fullPath) && is_file($fullPath)) {
            @unlink($fullPath);
            Log::info("Deleted file: {$relativePath}");
        }
    }

    private function resolveExtension(UploadedFile $file): string
    {
        $ext = $file->extension() ?: $file->getClientOriginalExtension();

        if (empty($ext)) {
            $mime = $file->getMimeType();
            $ext = match (true) {
                str_contains($mime, 'jpeg') => 'jpg',
                str_contains($mime, 'png')  => 'png',
                str_contains($mime, 'gif')  => 'gif',
                str_contains($mime, 'webp') => 'webp',
                default                     => 'jpg',
            };
        }

        return strtolower($ext);
    }

    private function assertAllowedExtension(string $ext): void
    {
        if (!in_array($ext, UploadConfig::ALLOWED_IMAGE_MIMES)) {
            throw new \Exception(
                'نوع الملف غير مسموح. الأنواع المسموحة: '
                . UploadConfig::mimesString()
            );
        }
    }
}