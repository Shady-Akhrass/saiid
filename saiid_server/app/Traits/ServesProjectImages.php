<?php
// app/Traits/ServesProjectImages.php

namespace App\Traits;

use App\Models\ProjectProposal;
use App\Models\ProjectProposalImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

trait ServesProjectImages
{
    /**
     * Serve project image with proper headers and CORS
     */
    protected function serveImage(int $id): BinaryFileResponse|\Illuminate\Http\JsonResponse|\Illuminate\Http\Response
    {
        try {
            $corsOrigin = $this->resolveCorsOrigin();
            $project = ProjectProposal::findOrFail($id);

            // If project has image, return it
            if ($project->project_image && file_exists(public_path($project->project_image))) {
                $filePath = public_path($project->project_image);
                $mimeType = mime_content_type($filePath) ?: 'image/jpeg';

                return response()->file($filePath)
                    ->header('Content-Type', $mimeType)
                    ->header('Cache-Control', 'public, max-age=31536000')
                    ->header('Access-Control-Allow-Origin', $corsOrigin)
                    ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                    ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                    ->header('Access-Control-Allow-Credentials', 'true');
            }

            // Otherwise, return default image if exists
            $defaultImage = public_path('images/default-project.jpg');
            if (file_exists($defaultImage)) {
                return response()->file($defaultImage)
                    ->header('Access-Control-Allow-Origin', $corsOrigin)
                    ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                    ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                    ->header('Access-Control-Allow-Credentials', 'true');
            }

            // If no image at all, return 404
            return response()->json([
                'success' => false,
                'error' => 'الصورة غير موجودة'
            ], 404)
                ->header('Access-Control-Allow-Origin', $corsOrigin)
                ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                ->header('Access-Control-Allow-Credentials', 'true');

        } catch (\Exception $e) {
            $corsOrigin = $this->resolveCorsOrigin();
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود',
                'message' => $e->getMessage()
            ], 404)
                ->header('Access-Control-Allow-Origin', $corsOrigin)
                ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                ->header('Access-Control-Allow-Credentials', 'true');
        }
    }

    /**
     * Serve notes image with proper headers and CORS
     */
    protected function serveNotesImage(int $id, bool $forceDownload = false): BinaryFileResponse|\Illuminate\Http\JsonResponse|\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
    {
        try {
            $corsOrigin = $this->resolveCorsOrigin();
            $project = ProjectProposal::with('noteImages')->findOrFail($id);

            // Get image path (new table > old field)
            $firstNoteImage = $project->noteImages->first();
            $storedPath = $firstNoteImage?->image_path ?? $project->notes_image;

            // Return transparent placeholder if no image
            if (empty($storedPath)) {
                return $this->serveTransparentPlaceholder($corsOrigin);
            }

            // Handle full URLs (redirect)
            if (str_starts_with($storedPath, 'http')) {
                return redirect($storedPath);
            }

            // Resolve physical path
            $imagePath = $this->resolvePhysicalPath($storedPath);

            if (!$imagePath) {
                return response()->json([
                    'success' => false,
                    'error'   => 'ملف الصورة غير موجود',
                ], 404)->header('Access-Control-Allow-Origin', $corsOrigin);
            }

            // Determine content type
            $contentType = $this->getMimeType($imagePath);

            // Build response headers
            $headers = [
                'Content-Type'                => $contentType,
                'Cache-Control'               => 'no-cache, no-store, must-revalidate, private',
                'Pragma'                      => 'no-cache',
                'Expires'                     => '0',
                'Access-Control-Allow-Origin' => $corsOrigin,
                'Access-Control-Allow-Methods'=> 'GET, OPTIONS',
                'Access-Control-Allow-Headers'=> 'Content-Type, Authorization',
                'Access-Control-Allow-Credentials' => 'true',
            ];

            // Handle download
            if ($forceDownload || request()->has('download')) {
                $filename = basename($imagePath);
                $projectName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $project->project_name ?? 'project');
                $headers['Content-Disposition'] = 'attachment; filename="' . $projectName . '_' . $filename . '"';
            }

            return response()->file($imagePath, $headers);

        } catch (\Exception $e) {
            Log::error('Error serving notes image', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['error' => 'خطأ في الخادم'], 500);
        }
    }

    /**
     * Reorder note images
     */
    protected function reorderImages(Request $request): \Illuminate\Http\JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'project_id'    => 'required|integer|exists:project_proposals,id',
            'ordered_ids'   => 'required|array|min:1',
            'ordered_ids.*' => 'integer|exists:project_proposal_images,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'خطأ في البيانات', 'errors' => $validator->errors()], 422);
        }

        try {
            $projectId = (int) $request->input('project_id');
            $orderedIds = $request->input('ordered_ids');

            // Validate ownership
            $images = ProjectProposalImage::where('project_proposal_id', $projectId)
                ->where('type', 'note')
                ->whereIn('id', $orderedIds)
                ->get();

            if ($images->count() !== count(array_unique($orderedIds))) {
                return response()->json(['error' => 'بعض الصور لا تعود لهذا المشروع'], 400);
            }

            // Update order
            foreach ($orderedIds as $index => $id) {
                ProjectProposalImage::where('id', $id)->update(['display_order' => $index]);
            }

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث الترتيب بنجاح',
                'images'  => ProjectProposalImage::where('project_proposal_id', $projectId)
                    ->where('type', 'note')
                    ->orderBy('display_order')
                    ->get(['id', 'image_path', 'display_order']),
            ]);

        } catch (\Exception $e) {
            Log::error('Reorder error', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'فشل التحديث'], 500);
        }
    }

    // ─── Helpers ─────────────────────────────────────────

    private function resolvePhysicalPath(string $path): ?string
    {
        $fullPath = public_path($path);
        if (file_exists($fullPath)) return $fullPath;

        // Try extensions
        $dir = dirname($fullPath);
        $name = pathinfo($fullPath, PATHINFO_FILENAME);
        foreach (['jpg', 'jpeg', 'png', 'gif', 'webp'] as $ext) {
            $test = "{$dir}/{$name}.{$ext}";
            if (file_exists($test)) return $test;
        }

        return null;
    }

    private function getMimeType(string $path): string
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        return match ($ext) {
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp'=> 'image/webp',
            default => 'image/jpeg',
        };
    }

    private function serveTransparentPlaceholder(string $origin): \Illuminate\Http\Response
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        return response($png, 200, [
            'Content-Type' => 'image/png',
            'Access-Control-Allow-Origin' => $origin,
        ]);
    }

    private function resolveCorsOrigin(): string
    {
        $origin = request()->header('Origin');
        $allowed = config('cors.allowed_origins', []);
        return ($origin && in_array($origin, $allowed)) ? $origin : '*';
    }
}