<?php

namespace App\Services;

use App\Models\ProjectProposal;
use App\Models\ProjectProposalImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\UploadedFile;

class ProjectProposalImageService
{
    // File Upload Constants
    private const MAX_IMAGE_SIZE = 5120; // 5MB in KB
    private const ALLOWED_IMAGE_MIMES = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    private const PROJECT_IMAGES_DIR = 'project_images';
    private const PROJECT_NOTES_IMAGES_DIR = 'project_notes_images';

    /**
     * Handle project image uploads
     *
     * @param Request $request
     * @param ProjectProposal|null $project
     * @return array
     */
    public function handleProjectImageUploads(Request $request, ?ProjectProposal $project = null): array
    {
        $result = [];

        // Handle project image (cover image stored on ProjectProposal model)
        if ($request->hasFile('project_image')) {
            $projectImage = $request->file('project_image');
            $oldImagePath = $project ? $project->project_image : null;
            
            $uploadResult = $this->handleImageUpload($projectImage, self::PROJECT_IMAGES_DIR, $oldImagePath);
            
            if (isset($uploadResult['error'])) {
                return $uploadResult;
            }
            
            if ($uploadResult) {
                $result['project_image'] = $uploadResult;
            }
        }

        return $result;
    }

    /**
     * Sync notes images (multiple) for a project using project_proposal_images table.
     *
     * - Supports new uploads via notes_images[] (and legacy notes_image as a single file).
     * - Supports deletion via note_images_to_delete[] (IDs from project_proposal_images).
     *
     * @param Request $request
     * @param ProjectProposal $project
     * @return array{
     *   added?: array<int, \App\Models\ProjectProposalImage>,
     *   deleted?: array<int, int>,
     *   error?: \Illuminate\Http\JsonResponse
     * }
     */
    public function syncNoteImages(Request $request, ProjectProposal $project): array
    {
        $result = [
            'added' => [],
            'deleted' => [],
        ];

        // Handle deletions first (for safety and predictable display_order)
        $deleteIds = $request->input('note_images_to_delete', []);
        if (is_array($deleteIds) && !empty($deleteIds)) {
            $imagesToDelete = ProjectProposalImage::query()
                ->where('project_proposal_id', $project->id)
                ->where('type', 'note')
                ->whereIn('id', $deleteIds)
                ->get();

            foreach ($imagesToDelete as $image) {
                // Extra safety: ensure the image really belongs to this project
                if ($image->project_proposal_id !== $project->id || $image->type !== 'note') {
                    continue;
                }

                $this->deleteImage($image->image_path);
                $result['deleted'][] = $image->id;
                $image->delete();
            }
        }

        // Legacy support: if notes_image is explicitly set to null and no specific IDs are provided,
        // treat it as a request to delete all note images for this project.
        if ($request->has('notes_image') && $request->input('notes_image') === null && empty($deleteIds)) {
            $allNoteImages = ProjectProposalImage::query()
                ->where('project_proposal_id', $project->id)
                ->where('type', 'note')
                ->get();

            foreach ($allNoteImages as $image) {
                $this->deleteImage($image->image_path);
                $result['deleted'][] = $image->id;
                $image->delete();
            }

            // Also delete legacy single notes_image file if it exists (backward compatibility)
            if (!empty($project->notes_image)) {
                $this->deleteImage($project->notes_image);
            }
        }

        // Legacy support: if notes_image is explicitly set to null and no specific IDs are provided,
        // treat it as a request to delete all note images for this project.
        if ($request->has('notes_image') && $request->input('notes_image') === null && empty($deleteIds)) {
            $allNoteImages = ProjectProposalImage::query()
                ->where('project_proposal_id', $project->id)
                ->where('type', 'note')
                ->get();

            foreach ($allNoteImages as $image) {
                $this->deleteImage($image->image_path);
                $result['deleted'][] = $image->id;
                $image->delete();
            }

            // Also delete legacy single notes_image file if it exists (backward compatibility)
            if (!empty($project->notes_image)) {
                $this->deleteImage($project->notes_image);
            }
        }

        // Collect all uploaded files (supports both notes_images[] and legacy notes_image)
        $files = [];

        if ($request->hasFile('notes_images')) {
            $uploaded = $request->file('notes_images');
            if (is_array($uploaded)) {
                $files = array_merge($files, $uploaded);
            } elseif ($uploaded instanceof UploadedFile) {
                $files[] = $uploaded;
            }
        }

        if ($request->hasFile('notes_image')) {
            $single = $request->file('notes_image');
            if ($single instanceof UploadedFile) {
                $files[] = $single;
            }
        }

        if (empty($files)) {
            return $result;
        }

        // Determine the next display_order base for this project's note images
        $currentMaxOrder = ProjectProposalImage::query()
            ->where('project_proposal_id', $project->id)
            ->where('type', 'note')
            ->max('display_order');

        if ($currentMaxOrder === null) {
            $currentMaxOrder = -1;
        }

        foreach ($files as $index => $file) {
            $uploadResult = $this->handleImageUpload($file, self::PROJECT_NOTES_IMAGES_DIR, null);

            if (is_array($uploadResult) && isset($uploadResult['error'])) {
                // Propagate JSON error response to caller
                return $uploadResult;
            }

            if (is_string($uploadResult) && $uploadResult !== '') {
                $image = ProjectProposalImage::create([
                    'project_proposal_id' => $project->id,
                    'image_path' => $uploadResult,
                    'display_order' => $currentMaxOrder + $index + 1,
                    'type' => 'note',
                ]);

                $result['added'][] = $image;
            }
        }

        return $result;
    }

    /**
     * Handle single image upload
     *
     * @param UploadedFile|null $file
     * @param string $directory
     * @param string|null $oldImagePath
     * @return string|array|null
     */
    public function handleImageUpload(?UploadedFile $file, string $directory, ?string $oldImagePath = null)
    {
        if (!$file || !$file->isValid()) {
            return null;
        }

        try {
            // Validate file size
            $fileSizeKB = $file->getSize() / 1024;
            if ($fileSizeKB > self::MAX_IMAGE_SIZE) {
                return [
                    'error' => response()->json([
                        'success' => false,
                        'error' => 'حجم الملف كبير جداً',
                        'message' => 'حجم الصورة يجب أن يكون أقل من ' . self::MAX_IMAGE_SIZE . ' كيلوبايت'
                    ], 400)
                ];
            }

            // Validate MIME type
            $extension = $file->extension() ?: $file->getClientOriginalExtension();
            if (empty($extension)) {
                $mimeType = $file->getMimeType();
                $extension = match(true) {
                    str_contains($mimeType, 'jpeg') => 'jpg',
                    str_contains($mimeType, 'png') => 'png',
                    str_contains($mimeType, 'gif') => 'gif',
                    str_contains($mimeType, 'webp') => 'webp',
                    default => 'jpg',
                };
            }

            if (!in_array(strtolower($extension), self::ALLOWED_IMAGE_MIMES)) {
                return [
                    'error' => response()->json([
                        'success' => false,
                        'error' => 'نوع الملف غير مدعوم',
                        'message' => 'نوع الصورة يجب أن يكون: ' . implode(', ', self::ALLOWED_IMAGE_MIMES)
                    ], 400)
                ];
            }

            // Delete old image if exists
            if ($oldImagePath) {
                $this->deleteImage($oldImagePath);
            }

            // Upload new image
            $fileName = time() . '_' . uniqid() . '.' . $extension;
            $uploadDir = public_path($directory);
            
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            $file->move($uploadDir, $fileName);
            $imagePath = "{$directory}/{$fileName}";

            Log::info("Image uploaded successfully: {$imagePath}");
            return $imagePath;

        } catch (\Exception $e) {
            Log::error("Error uploading image: {$e->getMessage()}", [
                'directory' => $directory,
                'trace' => $e->getTraceAsString()
            ]);
            
            return [
                'error' => response()->json([
                    'success' => false,
                    'error' => 'فشل رفع الصورة',
                    'message' => 'حدث خطأ أثناء رفع الصورة: ' . $e->getMessage()
                ], 500)
            ];
        }
    }

    /**
     * Delete image file
     *
     * @param string $imagePath
     * @return bool
     */
    public function deleteImage(string $imagePath): bool
    {
        try {
            $fullPath = public_path($imagePath);
            if (file_exists($fullPath)) {
                unlink($fullPath);
                Log::info("Deleted image: {$imagePath}");
                return true;
            }
            return false;
        } catch (\Exception $e) {
            Log::warning("Failed to delete image: {$imagePath}", [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Get project image URL
     *
     * @param ProjectProposal $project
     * @return string|null
     */
    public function getProjectImageUrl(ProjectProposal $project): ?string
    {
        if (!$project->project_image) {
            return null;
        }

        return asset($project->project_image);
    }

    /**
     * Get notes image URL
     *
     * @param ProjectProposal $project
     * @return string|null
     */
    public function getNotesImageUrl(ProjectProposal $project): ?string
    {
        if (!$project->notes_image) {
            return null;
        }

        return asset($project->notes_image);
    }
}

