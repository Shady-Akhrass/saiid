<?php

namespace App\Http\Controllers;

use App\Models\ProjectProposal;
use App\Models\ProjectProposalImage;
use App\Models\Project;
use App\Models\Shelter;
use App\Models\Currency;
use App\Models\Team;
use App\Models\User;
use App\Models\TeamPersonnel;
use App\Models\Orphan;
use App\Models\Notification;
use App\Models\MediaArchive;
use App\Exports\ProjectProposalsExport;
use App\Helpers\NotificationHelper;
use App\Services\ProjectProposalQuery;
use App\Services\ProjectsCacheService;
use App\Services\ProjectProposalIndexService;
use App\Services\ProjectProposalImageService;
use App\Services\ProjectProposalService;
use App\Services\CacheService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Maatwebsite\Excel\Facades\Excel;
use Carbon\Carbon;

class ProjectProposalController extends Controller
{
    protected ProjectProposalQuery $query;
    protected ProjectProposalIndexService $indexService;
    protected ProjectProposalImageService $imageService;
    protected ProjectProposalService $service;

    public function __construct(
        ProjectProposalQuery $query,
        ProjectProposalIndexService $indexService,
        ProjectProposalImageService $imageService,
        ProjectProposalService $service
    ) {
        $this->query = $query;
        $this->indexService = $indexService;
        $this->imageService = $imageService;
        $this->service = $service;
    }

    // Project Status Constants
    private const STATUS_NEW = 'جديد';
    private const STATUS_SUPPLY = 'قيد التوريد';
    private const STATUS_SUPPLIED = 'تم التوريد';
    private const STATUS_DISTRIBUTION = 'قيد التوزيع';
    private const STATUS_READY = 'جاهز للتنفيذ';
    private const STATUS_EXECUTING = 'قيد التنفيذ';
    private const STATUS_POSTPONED = 'مؤجل';
    private const STATUS_EXECUTED = 'تم التنفيذ';
    private const STATUS_MONTAGE = 'في المونتاج';
    private const STATUS_MONTAGE_COMPLETED = 'تم المونتاج';
    private const STATUS_MONTAGE_REDO = 'يجب إعادة المونتاج';
    private const STATUS_DELIVERED = 'وصل للمتبرع';
    private const STATUS_ASSIGNED_TO_RESEARCHER = 'مسند لباحث';

    // User Role Constants
    private const ROLE_ADMIN = 'admin';
    private const ROLE_PROJECT_MANAGER = 'project_manager';
    private const ROLE_MEDIA_MANAGER = 'media_manager';
    private const ROLE_EXECUTED_PROJECTS_COORDINATOR = 'executed_projects_coordinator';
    private const ROLE_ORPHAN_SPONSOR_COORDINATOR = 'orphan_sponsor_coordinator';

    // Phase Type Constants
    private const PHASE_TYPE_DAILY = 'daily';
    private const PHASE_TYPE_MONTHLY = 'monthly';

    // File Upload Constants
    private const MAX_IMAGE_SIZE = 5120; // 5MB in KB
    private const ALLOWED_IMAGE_MIMES = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    private const PROJECT_IMAGES_DIR = 'project_images';
    private const PROJECT_NOTES_IMAGES_DIR = 'project_notes_images';

    // Cache Constants
    private const CACHE_TTL_SECONDS = 30;
    private const CACHE_TAG_PROJECTS = 'projects';
    private const CACHE_TAG_USERS = 'users';
    private const CACHE_TAG_TEAMS = 'teams';

    // Pagination Constants
    private const DEFAULT_PER_PAGE = 15;
    private const MAX_PER_PAGE = 50;
    private const MAX_PER_PAGE_MANAGER = 2000; // ✅ تقليل من 100000 إلى 2000 لتجنب Memory spike

    /**
     * Validate request and return errors if validation fails
     *
     * @param Request $request
     * @param array $rules
     * @param array $messages
     * @return \Illuminate\Http\JsonResponse|null Returns JsonResponse on failure, null on success
     */
    private function validateRequest(Request $request, array $rules, array $messages = []): ?\Illuminate\Http\JsonResponse
    {
        $validator = Validator::make($request->all(), $rules, $messages);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors(),
                'message' => 'يرجى التحقق من البيانات المدخلة'
            ], 422);
        }

        return null;
    }

    /**
     * Check if user has admin role
     *
     * @param User|null $user
     * @return bool
     */
    private function isAdmin(?User $user): bool
    {
        return $user && strtolower($user->role ?? '') === self::ROLE_ADMIN;
    }

    /**
     * Check if user has one of the allowed roles
     *
     * @param User|null $user
     * @param array<string> $allowedRoles
     * @return bool
     */
    private function hasRole(?User $user, array $allowedRoles): bool
    {
        if (!$user) {
            return false;
        }
        $userRole = strtolower($user->role ?? '');
        return in_array($userRole, array_map('strtolower', $allowedRoles));
    }

    /**
     * Get user role in lowercase
     *
     * @param User|null $user
     * @return string
     */
    private function getUserRole(?User $user): string
    {
        return strtolower($user->role ?? 'guest');
    }

    /**
     * Return unauthorized response
     *
     * @param string $message
     * @return \Illuminate\Http\JsonResponse
     */
    private function unauthorizedResponse(string $message = 'ليس لديك صلاحيات للوصول إلى هذا المورد'): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'success' => false,
            'error' => 'غير مصرح',
            'message' => $message
        ], 403);
    }

    /**
     * Return error response with automatic logging
     *
     * @param string $error
     * @param string $message
     * @param int $statusCode
     * @param \Exception|null $exception
     * @return \Illuminate\Http\JsonResponse
     */
    private function errorResponse(string $error, string $message, int $statusCode = 400, ?\Exception $exception = null): \Illuminate\Http\JsonResponse
    {
        // Auto-log errors with status >= 500
        if ($statusCode >= 500 && $exception) {
            Log::error("ProjectProposal Error: {$error}", [
                'message' => $message,
                'exception' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'user_id' => auth()->id(),
                'route' => request()->path()
            ]);
        }

        $response = [
            'success' => false,
            'error' => $error,
            'message' => $message
        ];

        if (config('app.debug') && $exception) {
            $response['debug'] = [
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => $exception->getTraceAsString()
            ];
        }

        return $this->addCorsHeaders(response()->json($response, $statusCode));
    }

    /**
     * Add CORS headers to response
     *
     * @param \Illuminate\Http\JsonResponse $response
     * @return \Illuminate\Http\JsonResponse
     */
    private function addCorsHeaders(\Illuminate\Http\JsonResponse $response): \Illuminate\Http\JsonResponse
    {
        $origin = request()->header('Origin');
        $allowedOrigins = config('cors.allowed_origins', []);

        // التحقق من أن Origin مسموح
        $corsOrigin = '*';
        if ($origin && in_array($origin, $allowedOrigins)) {
            $corsOrigin = $origin;
        }

        return $response
            ->header('Access-Control-Allow-Origin', $corsOrigin)
            ->header('Access-Control-Allow-Credentials', 'true')
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }

    /**
     * Return success response with proper cache headers
     *
     * @param array<string, mixed> $data
     * @param string $message
     * @param int $statusCode
     * @return \Illuminate\Http\JsonResponse
     */
    private function successResponse(array $data = [], string $message = 'تمت العملية بنجاح', int $statusCode = 200): \Illuminate\Http\JsonResponse
    {
        return response()->json(array_merge([
            'success' => true,
            'message' => $message
        ], $data), $statusCode)
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    }

    /**
     * Handle image upload with security and uniqueness
     *
     * @param \Illuminate\Http\UploadedFile|null $file
     * @param string $directory
     * @param string|null $oldImagePath
     * @return string|null
     * @throws \Exception
     */
    private function handleImageUpload(?\Illuminate\Http\UploadedFile $file, string $directory, ?string $oldImagePath = null): ?string
    {
        if (!$file || !$file->isValid()) {
            return null;
        }

        try {
            // Validate file size (5MB max)
            $maxSize = self::MAX_IMAGE_SIZE * 1024; // Convert KB to bytes
            if ($file->getSize() > $maxSize) {
                throw new \Exception("حجم الملف يتجاوز الحد الأقصى المسموح (5 ميجابايت)");
            }

            // Delete old image if exists
            if ($oldImagePath) {
                $oldPath = public_path($oldImagePath);
                if (file_exists($oldPath) && is_file($oldPath)) {
                    @unlink($oldPath); // @ to suppress warnings if file doesn't exist
                    Log::info("Deleted old image: {$oldImagePath}");
                }
            }

            // Get file extension with better validation
            $extension = $file->extension() ?: $file->getClientOriginalExtension();
            if (empty($extension)) {
                $mimeType = $file->getMimeType();
                $extension = match (true) {
                    str_contains($mimeType, 'jpeg') => 'jpg',
                    str_contains($mimeType, 'png') => 'png',
                    str_contains($mimeType, 'gif') => 'gif',
                    str_contains($mimeType, 'webp') => 'webp',
                    default => 'jpg',
                };
            }

            // Validate extension
            if (!in_array(strtolower($extension), self::ALLOWED_IMAGE_MIMES)) {
                throw new \Exception("نوع الملف غير مسموح. الأنواع المسموحة: " . implode(', ', self::ALLOWED_IMAGE_MIMES));
            }

            // Generate unique filename to prevent collisions
            $fileName = time() . '_' . Str::random(8) . '.' . $extension;
            $uploadDir = public_path($directory);

            // Create directory if doesn't exist with proper permissions
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            // Move file with error handling
            if (!$file->move($uploadDir, $fileName)) {
                throw new \Exception("فشل نقل الملف إلى المجلد المحدد");
            }

            $imagePath = "{$directory}/{$fileName}";

            Log::info("Image uploaded successfully", [
                'path' => $imagePath,
                'size' => $file->getSize(),
                'mime' => $file->getMimeType()
            ]);

            return $imagePath;
        } catch (\Exception $e) {
            Log::error("Error uploading image: {$e->getMessage()}", [
                'directory' => $directory,
                'file_size' => $file->getSize() ?? 'unknown',
                'mime_type' => $file->getMimeType() ?? 'unknown',
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Validate project type from request
     *
     * @param Request $request
     * @return \App\Models\ProjectType|null
     */
    private function validateProjectType(Request $request): ?\App\Models\ProjectType
    {
        if ($request->has('project_type_id') && $request->project_type_id) {
            $projectType = \App\Models\ProjectType::find($request->project_type_id);
            if (!$projectType) {
                return null;
            }
            return $projectType;
        }

        if ($request->has('project_type') && $request->project_type) {
            $projectType = \App\Models\ProjectType::where('name', $request->project_type)->first();
            return $projectType;
        }

        return null;
    }

    /**
     * Validate and get project type from request with error handling
     *
     * @param Request $request
     * @param ProjectProposal|null $existingProject
     * @return array{projectType: \App\Models\ProjectType|null, error: \Illuminate\Http\JsonResponse|null}
     */
    private function getProjectTypeFromRequest(Request $request, ?ProjectProposal $existingProject = null): array
    {
        // Try project_type_id first
        if ($request->has('project_type_id') && $request->project_type_id) {
            $projectType = \App\Models\ProjectType::find($request->project_type_id);
            if (!$projectType) {
                return [
                    'projectType' => null,
                    'error' => $this->errorResponse(
                        'نوع المشروع غير موجود',
                        'نوع المشروع المحدد غير موجود في قاعدة البيانات',
                        422
                    )
                ];
            }
            return ['projectType' => $projectType, 'error' => null];
        }

        // Try project_type (for backward compatibility)
        if ($request->has('project_type') && $request->project_type) {
            $projectType = \App\Models\ProjectType::where('name', $request->project_type)->first();
            if (!$projectType) {
                return [
                    'projectType' => null,
                    'error' => $this->errorResponse(
                        'نوع المشروع غير موجود',
                        "نوع المشروع '{$request->project_type}' غير موجود في قاعدة البيانات",
                        422
                    )
                ];
            }
            return ['projectType' => $projectType, 'error' => null];
        }

        // If no project type in request, use existing project's type
        if ($existingProject && $existingProject->projectType) {
            return ['projectType' => $existingProject->projectType, 'error' => null];
        }

        // If creating new project and no type provided
        if (!$existingProject) {
            return [
                'projectType' => null,
                'error' => $this->errorResponse(
                    'نوع المشروع مطلوب',
                    'يجب إرسال project_type_id أو project_type',
                    422
                )
            ];
        }

        return ['projectType' => null, 'error' => null];
    }

    /**
     * Validate subcategory matches project type
     *
     * @param Request $request
     * @param \App\Models\ProjectType $projectType
     * @return \Illuminate\Http\JsonResponse|null
     */
    private function validateSubcategory(Request $request, \App\Models\ProjectType $projectType): ?\Illuminate\Http\JsonResponse
    {
        if (!$request->has('subcategory_id') || !$request->subcategory_id) {
            return null;
        }

        $subcategory = \App\Models\ProjectSubcategory::find($request->subcategory_id);
        if (!$subcategory) {
            return $this->errorResponse(
                'التفرعية المحددة غير موجودة',
                'التفرعية المحددة غير موجودة في قاعدة البيانات',
                422
            );
        }

        if ($subcategory->project_type !== $projectType->name) {
            return $this->errorResponse(
                'التفرعية المحددة لا تطابق نوع المشروع',
                "التفرعية المحددة من نوع '{$subcategory->project_type}' بينما المشروع من نوع '{$projectType->name}'",
                422
            );
        }

        return null;
    }

    /**
     * Calculate financial amounts (USD, discount, net)
     *
     * @param float $donationAmount
     * @param float $exchangeRate
     * @param float $adminDiscountPercentage
     * @return array{amount_in_usd: float, discount_amount: float, net_amount: float}
     */
    /**
     * Calculate financial amounts with validation and precision
     *
     * @param float $donationAmount
     * @param float $exchangeRate
     * @param float $adminDiscountPercentage
     * @return array
     */
    private function calculateFinancialAmounts(float $donationAmount, float $exchangeRate, float $adminDiscountPercentage): array
    {
        // Ensure positive values and valid percentage
        $donationAmount = max(0, $donationAmount);
        $exchangeRate = max(0, $exchangeRate);
        $adminDiscountPercentage = max(0, min(100, $adminDiscountPercentage));

        $amountInUsd = round($donationAmount * $exchangeRate, 2);
        $discountAmount = round($amountInUsd * ($adminDiscountPercentage / 100), 2);
        $netAmount = round($amountInUsd - $discountAmount, 2);

        return [
            'amount_in_usd' => $amountInUsd,
            'discount_amount' => $discountAmount,
            'net_amount' => max(0, $netAmount)
        ];
    }

    /**
     * Handle database exceptions with user-friendly messages
     *
     * @param \Exception $e
     * @param string $defaultMessage
     * @return \Illuminate\Http\JsonResponse
     */
    private function handleDatabaseException(\Exception $e, string $defaultMessage = 'حدث خطأ أثناء العملية'): \Illuminate\Http\JsonResponse
    {
        $errorMessage = $e->getMessage();

        // Handle specific database errors
        if (str_contains($errorMessage, 'Column not found') || str_contains($errorMessage, 'Unknown column')) {
            return $this->errorResponse(
                'خطأ في إعدادات قاعدة البيانات',
                'يبدو أن بعض الحقول غير موجودة في قاعدة البيانات. يرجى تطبيق Migration أو SQL Script.',
                500,
                $e
            );
        }

        if (str_contains($errorMessage, 'Data truncated')) {
            preg_match("/Data truncated for column '([^']+)'/", $errorMessage, $matches);
            $problematicColumn = $matches[1] ?? 'unknown';

            return $this->errorResponse(
                'خطأ في البيانات المرسلة',
                "القيمة المرسلة للحقل '{$problematicColumn}' غير صحيحة. يرجى التحقق من البيانات.",
                500,
                $e
            );
        }

        if (str_contains($errorMessage, 'internal_code')) {
            return $this->errorResponse(
                'خطأ في توليد الكود الداخلي',
                'خطأ في توليد الكود الداخلي. يرجى التأكد من تشغيل migration لإضافة حقل internal_code.',
                500,
                $e
            );
        }

        // Default error response
        return $this->errorResponse(
            'فشل العملية',
            config('app.debug') ? $errorMessage : $defaultMessage,
            500,
            $e
        );
    }

    /**
     * Handle image uploads for project (notes_image and project_image)
     *
     * @param Request $request
     * @param ProjectProposal|null $project
     * @return array{notes_image?: string|null, project_image?: string|null, error?: \Illuminate\Http\JsonResponse}
     */
    private function handleProjectImageUploads(Request $request, ?ProjectProposal $project = null): array
    {
        $result = [];

        // Handle notes_image
        if ($request->hasFile('notes_image')) {
            try {
                $result['notes_image'] = $this->handleImageUpload(
                    $request->file('notes_image'),
                    self::PROJECT_NOTES_IMAGES_DIR,
                    $project?->notes_image
                );
            } catch (\Exception $e) {
                return [
                    'error' => $this->errorResponse(
                        'فشل رفع صورة الملاحظات',
                        'حدث خطأ أثناء رفع صورة الملاحظات',
                        500,
                        $e
                    )
                ];
            }
        } elseif ($request->has('notes_image') && $request->input('notes_image') === null && $project) {
            // Delete image if null is sent
            if (!empty($project->notes_image)) {
                $oldImagePath = public_path($project->notes_image);
                if (file_exists($oldImagePath)) {
                    unlink($oldImagePath);
                    Log::info('Deleted notes image: ' . $project->notes_image);
                }
            }
            $result['notes_image'] = null;
        }

        // Handle project_image
        if ($request->hasFile('project_image')) {
            try {
                $result['project_image'] = $this->handleImageUpload(
                    $request->file('project_image'),
                    self::PROJECT_IMAGES_DIR,
                    $project?->project_image
                );
            } catch (\Exception $e) {
                return [
                    'error' => $this->errorResponse(
                        'فشل رفع صورة المشروع',
                        'حدث خطأ أثناء رفع صورة المشروع',
                        500,
                        $e
                    )
                ];
            }
        } elseif ($request->has('project_image') && $request->input('project_image') === null && $project) {
            // Delete image if null is sent
            if (!empty($project->project_image)) {
                $oldImagePath = public_path($project->project_image);
                if (file_exists($oldImagePath)) {
                    unlink($oldImagePath);
                    Log::info('Deleted project image: ' . $project->project_image);
                }
            }
            $result['project_image'] = null;
        }

        return $result;
    }

    /**
     * Get validation rules for creating a project
     *
     * @return array<string, string>
     */
    private function getCreateValidationRules(): array
    {
        return [
            'project_name' => 'nullable|string|min:3|max:255',
            'donor_code' => 'nullable|string|max:50',
            'project_description' => 'nullable|string',
            'donor_name' => 'required|string|min:3',
            'project_type_id' => 'required_without:project_type|exists:project_types,id',
            'project_type' => 'required_without:project_type_id|string|exists:project_types,name',
            'subcategory_id' => 'required|exists:project_subcategories,id',
            'donation_amount' => 'required|numeric|min:0',
            'currency_id' => 'required|exists:currencies,id',
            'admin_discount_percentage' => 'nullable|numeric|min:0|max:100',
            'estimated_duration_days' => 'nullable|integer|min:1|max:365',
            'is_divided_into_phases' => 'nullable|boolean',
            'phase_type' => 'nullable|in:daily,monthly|required_if:is_divided_into_phases,1',
            'phase_duration_days' => 'nullable|integer|min:1|required_if:phase_type,daily',
            'phase_start_date' => 'nullable|date|required_if:is_divided_into_phases,1',
            'total_months' => 'nullable|integer|min:1|required_if:phase_type,monthly',
            'beneficiaries_per_unit' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
            // ✅ دعم كلٍ من notes_image (قديم) و notes_images[] (جديد - متعدد)
            'notes_image' => 'nullable|image|mimes:' . implode(',', self::ALLOWED_IMAGE_MIMES) . '|max:' . self::MAX_IMAGE_SIZE,
            'notes_images' => 'nullable|array',
            'notes_images.*' => 'image|mimes:' . implode(',', self::ALLOWED_IMAGE_MIMES) . '|max:' . self::MAX_IMAGE_SIZE,
        ];
    }

    /**
     * Get validation messages for creating a project
     *
     * @return array<string, string>
     */
    private function getCreateValidationMessages(): array
    {
        return [
            'project_name.min' => 'اسم المشروع يجب أن يكون 3 أحرف على الأقل',
            'donor_name.required' => 'يرجى إدخال اسم الجهة المتبرعة',
            'project_type_id.required_without' => 'يرجى اختيار نوع المشروع (project_type_id أو project_type)',
            'project_type_id.exists' => 'نوع المشروع المحدد غير موجود',
            'project_type.required_without' => 'يرجى اختيار نوع المشروع (project_type_id أو project_type)',
            'project_type.exists' => 'نوع المشروع المحدد غير موجود في قاعدة البيانات',
            'subcategory_id.required' => 'التفريعة مطلوبة لإنشاء المشروع',
            'subcategory_id.exists' => 'التفريعة المحددة غير موجودة',
            'donation_amount.required' => 'يرجى إدخال مبلغ التبرع',
            'currency_id.required' => 'يرجى اختيار العملة',
            'currency_id.exists' => 'العملة المحددة غير موجودة',
            'phase_type.required_if' => 'نوع التقسيم مطلوب عند تفعيل التقسيم على مراحل (يومي أو شهري)',
            'phase_type.in' => 'نوع التقسيم يجب أن يكون: يومي أو شهري',
            'phase_duration_days.required_if' => 'عدد أيام التقسيم مطلوب عند اختيار التقسيم اليومي',
            'phase_start_date.required_if' => 'تاريخ بداية المراحل مطلوب عند تفعيل التقسيم على مراحل',
            'total_months.required_if' => 'عدد الشهور مطلوب عند اختيار التقسيم الشهري',
            'total_months.min' => 'عدد الشهور يجب أن يكون 1 على الأقل',
            'notes_image.image' => 'يجب أن تكون صورة الملاحظات من نوع صورة',
            'notes_image.mimes' => 'صورة الملاحظات يجب أن تكون من نوع: jpeg, jpg, png, gif, webp',
            'notes_image.max' => 'حجم صورة الملاحظات يجب أن يكون أقل من 5 ميجابايت',
            'notes_images.array' => 'صور الملاحظات يجب أن تُرسل كمصفوفة',
            'notes_images.*.image' => 'يجب أن تكون كل صورة ملاحظات من نوع صورة',
            'notes_images.*.mimes' => 'كل صورة ملاحظات يجب أن تكون من نوع: jpeg, jpg, png, gif, webp',
            'notes_images.*.max' => 'حجم كل صورة ملاحظات يجب أن يكون أقل من 5 ميجابايت',
        ];
    }

    /**
     * Get validation rules for updating a project
     *
     * @return array<string, string>
     */
    private function getUpdateValidationRules(): array
    {
        return [
            'project_name' => 'sometimes|nullable|string|min:3|max:255',
            'donor_code' => 'sometimes|nullable|string|max:50',
            'project_description' => 'sometimes|nullable|string',
            'donor_name' => 'sometimes|string|min:3',
            'project_type_id' => 'sometimes|exists:project_types,id',
            'project_type' => 'sometimes|string|exists:project_types,name',
            'subcategory_id' => 'sometimes|nullable|exists:project_subcategories,id',
            'donation_amount' => 'sometimes|numeric|min:0',
            'currency_id' => 'sometimes|exists:currencies,id',
            'admin_discount_percentage' => 'sometimes|numeric|min:0|max:100',
            'estimated_duration_days' => 'sometimes|integer|min:1|max:365',
            'is_divided_into_phases' => 'sometimes|boolean',
            'phase_type' => 'sometimes|nullable|in:daily,monthly',
            'phase_duration_days' => 'sometimes|nullable|integer|min:1|required_if:phase_type,daily',
            'phase_start_date' => 'sometimes|nullable|date|required_if:is_divided_into_phases,true',
            'total_months' => 'sometimes|nullable|integer|min:1|required_if:phase_type,monthly',
            'beneficiaries_per_unit' => 'sometimes|nullable|integer|min:0',
            'notes' => 'sometimes|nullable|string',
            // ✅ دعم صورة واحدة (notes_image) أو عدة صور (notes_images[])
            'notes_image' => 'nullable|image|mimes:' . implode(',', self::ALLOWED_IMAGE_MIMES) . '|max:' . self::MAX_IMAGE_SIZE,
            'notes_images' => 'sometimes|nullable|array',
            'notes_images.*' => 'image|mimes:' . implode(',', self::ALLOWED_IMAGE_MIMES) . '|max:' . self::MAX_IMAGE_SIZE,
            'note_images_to_delete' => 'sometimes|nullable|array',
            'note_images_to_delete.*' => 'integer|exists:project_proposal_images,id',
            'project_image' => 'nullable|image|mimes:' . implode(',', self::ALLOWED_IMAGE_MIMES) . '|max:' . self::MAX_IMAGE_SIZE,
            // ✅ حقول التواريخ لحالات المونتاج والإنهاء
            'status' => 'sometimes|nullable|string',
            'sent_to_donor_date' => 'sometimes|nullable|date',
            'completed_date' => 'sometimes|nullable|date',
        ];
    }

    /**
     * Refresh user from database to ensure latest data
     *
     * @param User|null $user
     * @return void
     */
    private function refreshUser(?User $user): void
    {
        if ($user) {
            $user->refresh();
        }
    }

    /**
     * Normalize boolean value from request
     *
     * @param mixed $value
     * @param bool $default
     * @return bool
     */
    private function normalizeBoolean($value, bool $default = false): bool
    {
        if ($value === 'true' || $value === true || $value === 1 || $value === '1') {
            return true;
        }
        if ($value === 'false' || $value === false || $value === 0 || $value === '0') {
            return false;
        }
        return $default;
    }

    /**
     * Get safe pagination per page value based on user role with bounds checking
     *
     * @param Request $request
     * @param string $userRole
     * @return int
     */
    private function getPerPageValue(Request $request, string $userRole): int
    {
        $perPageInput = $request->query('perPage', self::DEFAULT_PER_PAGE);
        $perPageInput = $request->query('per_page', $perPageInput);

        // ✅ إجبار filter عند طلب "all" لتجنب Memory spike
        if ($perPageInput === 'all' || $perPageInput === 'الكل') {
            // التحقق من وجود filter على الأقل
            $hasFilter = $request->has('status') && $request->get('status') !== 'all' ||
                $request->has('project_type') && $request->get('project_type') !== 'all' ||
                $request->has('searchQuery') && !empty($request->get('searchQuery')) ||
                $request->has('subcategory_id') ||
                $request->has('team_id') ||
                $request->has('photographer_id') ||
                $request->has('shelter_id');

            if (!$hasFilter) {
                abort(422, 'يجب تحديد فلترة (status, project_type, searchQuery, team_id, etc.) عند طلب جميع المشاريع');
            }

            // إذا كان هناك filter، نستخدم الحد الأقصى الآمن
            return self::MAX_PER_PAGE_MANAGER;
        }

        if ($userRole === self::ROLE_PROJECT_MANAGER || $userRole === self::ROLE_ADMIN) {
            // ✅ تقليل الحد الأقصى للمديرين أيضاً
            return min(max(1, (int) $perPageInput), self::MAX_PER_PAGE_MANAGER);
        }

        return min(max(1, (int) $perPageInput), self::MAX_PER_PAGE);
    }

    /**
     * Check if database column exists
     *
     * @param string $table
     * @param string $column
     * @return bool
     */
    private function columnExists(string $table, string $column): bool
    {
        try {
            $columns = \Schema::getColumnListing($table);
            return in_array($column, $columns);
        } catch (\Exception $e) {
            Log::warning("Could not check column existence: {$table}.{$column}", [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Process phase-related fields from request
     *
     * @param Request $request
     * @param array<string, mixed> $projectData
     * @return array<string, mixed>
     */
    private function processPhaseFields(Request $request, array $projectData): array
    {
        try {
            $hasPhaseType = $this->columnExists('project_proposals', 'phase_type');
            $hasTotalMonths = $this->columnExists('project_proposals', 'total_months');
            $hasPhaseDurationDays = $this->columnExists('project_proposals', 'phase_duration_days');
            $hasPhaseStartDate = $this->columnExists('project_proposals', 'phase_start_date');

            if ($hasPhaseType) {
                $phaseType = $request->input('phase_type');
                if ($phaseType !== null && $phaseType !== '' && in_array($phaseType, [self::PHASE_TYPE_DAILY, self::PHASE_TYPE_MONTHLY])) {
                    $projectData['phase_type'] = $phaseType;
                }
            }

            if ($hasTotalMonths) {
                $totalMonths = $request->input('total_months');
                if ($totalMonths !== null && $totalMonths !== '' && is_numeric($totalMonths) && (int)$totalMonths > 0) {
                    $projectData['total_months'] = (int) $totalMonths;
                } elseif (
                    isset($projectData['is_divided_into_phases']) && $projectData['is_divided_into_phases']
                    && isset($projectData['phase_type']) && $projectData['phase_type'] === self::PHASE_TYPE_MONTHLY
                ) {
                    unset($projectData['total_months']);
                }
            }

            if ($hasPhaseDurationDays) {
                $phaseDurationDays = $request->input('phase_duration_days');
                if ($phaseDurationDays !== null && $phaseDurationDays !== '' && is_numeric($phaseDurationDays) && (int)$phaseDurationDays > 0) {
                    $projectData['phase_duration_days'] = (int) $phaseDurationDays;
                } elseif (
                    isset($projectData['is_divided_into_phases']) && $projectData['is_divided_into_phases']
                    && isset($projectData['phase_type']) && $projectData['phase_type'] === self::PHASE_TYPE_DAILY
                ) {
                    // Log only if there's an actual issue
                    if (config('app.debug')) {
                        Log::warning('phase_duration_days is missing for daily divided project');
                    }
                } else {
                    $projectData['phase_duration_days'] = null;
                }
            }

            if ($hasPhaseStartDate) {
                $phaseStartDate = $request->input('phase_start_date');
                if ($phaseStartDate !== null && $phaseStartDate !== '') {
                    $projectData['phase_start_date'] = $phaseStartDate;
                } elseif (isset($projectData['is_divided_into_phases']) && $projectData['is_divided_into_phases']) {
                    // Log only if there's an actual issue
                    if (config('app.debug')) {
                        Log::warning('phase_start_date is missing for divided project');
                    }
                } else {
                    $projectData['phase_start_date'] = null;
                }
            }
        } catch (\Exception $e) {
            Log::warning('Could not check database columns, skipping new phase fields', [
                'error' => $e->getMessage()
            ]);
        }

        return $projectData;
    }

    /**
     * Clean project data by removing null/empty values while preserving important fields
     *
     * @param array<string, mixed> $projectData
     * @return array<string, mixed>
     */
    private function cleanProjectData(array $projectData): array
    {
        $importantFields = [
            'is_divided_into_phases',
            'phase_type',
            'phase_duration_days',
            'total_months',
            'phase_start_date',
            'is_daily_phase',
            'is_monthly_phase',
            'parent_project_id',
            'phase_day',
            'month_number',
            'month_start_date'
        ];

        $cleanedData = [];
        foreach ($projectData as $key => $value) {
            if (in_array($key, $importantFields)) {
                $cleanedData[$key] = $value;
            } elseif ($value === false || $value === 0 || $value === '0') {
                $cleanedData[$key] = $value;
            } elseif ($value !== null && $value !== '') {
                $cleanedData[$key] = $value;
            }
        }

        return $cleanedData;
    }

    /**
     * Create new project proposal (Admin only)
     */
    public function create(Request $request)
    {
        $user = $request->user();
        $this->refreshUser($user);

        // Authorization check
        if (!$this->isAdmin($user)) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لإضافة مشروع. الصلاحيات مقتصرة على الإدارة فقط.');
        }

        // دمج phase_division في الطلب إذا أرسل الفرونت البيانات داخل phase_division فقط (للمشاريع المقسمة شهرياً)
        $phaseDivision = $request->input('phase_division');
        if (is_array($phaseDivision)) {
            $merge = [];
            if (!empty($phaseDivision['type'])) {
                $merge['phase_type'] = $phaseDivision['type'];
            }
            if (isset($phaseDivision['total_months'])) {
                $merge['total_months'] = $phaseDivision['total_months'];
            }
            if (!empty($phaseDivision['phase_start_date'])) {
                $merge['phase_start_date'] = $phaseDivision['phase_start_date'];
            }
            if (isset($phaseDivision['phase_duration_days'])) {
                $merge['phase_duration_days'] = $phaseDivision['phase_duration_days'];
            }
            if (!empty($merge)) {
                $request->merge($merge);
            }
        }

        // Validation using helper method
        $validationError = $this->validateRequest($request, $this->getCreateValidationRules(), $this->getCreateValidationMessages());
        if ($validationError) {
            return $validationError;
        }

        // Delegate to service
        $result = $this->service->createProject($request, $user);

        if (!$result['success']) {
            return $this->errorResponse(
                'فشل إنشاء المشروع',
                $result['error'],
                $result['code'] ?? 500
            );
        }

        // Ensure we have the created project instance for subsequent operations
        $project = $result['project'];

        // ✅ مزامنة صور الملاحظات (متعددة) بعد إنشاء المشروع بنجاح
        $syncResult = $this->imageService->syncNoteImages($request, $project);
        if (isset($syncResult['error'])) {
            return $syncResult['error'];
        }

        // ✅ توريث صور الملاحظات للمشاريع الفرعية دفعة واحدة (أداء أفضل — استعلام واحد + إدراج جماعي)
        if ($project->is_divided_into_phases) {
            $project->refresh();
            $children = $project->dailyPhases()->get()->concat($project->monthlyPhases()->get());
            $project->copyNoteImagesToAllChildren($children);
        }

        // Clear cache after creating project and syncing images
        $this->clearProjectsCache();

        // Build response — ensure project has id (never return success without persisted project)
        $phaseResult = $result['phase_result'] ?? null;

        if (empty($project->id)) {
            \Log::error('Create project returned success but project has no id', [
                'serial_number' => $project->serial_number ?? null,
            ]);
            return $this->errorResponse('فشل التحقق من حفظ المشروع', 'لم يتم حفظ المشروع في قاعدة البيانات', 500);
        }

        if ($phaseResult) {
            if ($phaseResult['type'] === 'daily') {
                return response()->json([
                    'success' => true,
                    'message' => 'تم إنشاء المشروع بنجاح مع ' . $phaseResult['count'] . ' مشروع يومي',
                    'project' => $project,
                    'serial_number' => $project->serial_number,
                    'daily_phases_count' => $phaseResult['count']
                ], 201)
                    ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                    ->header('Pragma', 'no-cache')
                    ->header('Expires', '0');
            } elseif ($phaseResult['type'] === 'monthly') {
                return response()->json([
                    'success' => true,
                    'message' => 'تم إنشاء المشروع بنجاح مع جميع المشاريع الشهرية (' . $phaseResult['count'] . ' مشروع من ' . $phaseResult['total_months'] . ' شهور)',
                    'project' => $project,
                    'serial_number' => $project->serial_number,
                    'total_months' => $phaseResult['total_months'],
                    'monthly_phases_count' => $phaseResult['count'],
                    'first_monthly_phase' => $phaseResult['first_phase'] ?? null
                ], 201)
                    ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                    ->header('Pragma', 'no-cache')
                    ->header('Expires', '0');
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء المشروع بنجاح',
            'project' => $project->fresh(['currency', 'creator']),
            'serial_number' => $project->serial_number
        ], 201)
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0')
            ->header('Content-Type', 'application/json');
    }

    /**
     * Get all projects with filters
     */
    public function index(Request $request)
    {
        try {
            $user = $request->user();

            // التحقق من أن المستخدم مسجل دخول
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'يجب تسجيل الدخول للوصول إلى المشاريع'
                ], 401);
            }

            // استخدام ProjectProposalIndexService
            $result = $this->indexService->getProjects($request, $user);
            return $result['response'];
        } catch (\Illuminate\Database\QueryException $e) {
            // خطأ في قاعدة البيانات (مثل timeout)
            Log::error('Database error fetching projects', [
                'user_id' => $user->id ?? null,
                'role' => $user->role ?? null,
                'error' => $e->getMessage(),
                'code' => $e->getCode()
            ]);

            // إذا كان timeout، أعد استجابة فارغة بدلاً من خطأ
            if (
                str_contains($e->getMessage(), 'timeout') ||
                str_contains($e->getMessage(), 'timed out') ||
                $e->getCode() == 2006
            ) { // MySQL server has gone away
                return response()->json([
                    'success' => true,
                    'projects' => [],
                    'total' => 0,
                    'currentPage' => 1,
                    'totalPages' => 0,
                    'perPage' => 20,
                    'message' => 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى أو تقليل عدد النتائج.'
                ], 200);
            }

            return $this->addCorsHeaders(response()->json([
                'success' => false,
                'error' => 'فشل جلب المشاريع',
                'message' => 'حدث خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.',
                'trace' => config('app.debug') ? $e->getTraceAsString() : null
            ], 500));
        } catch (\Illuminate\Validation\ValidationException $e) {
            // معالجة أخطاء Validation بشكل منفصل
            return $this->addCorsHeaders(response()->json([
                'success' => false,
                'error' => 'خطأ في التحقق من البيانات',
                'errors' => $e->errors(),
                'message' => 'يرجى التحقق من البيانات المدخلة'
            ], 400));
        } catch (\Exception $e) {
            Log::error('Error fetching projects', [
                'user_id' => $user->id ?? null,
                'role' => $user->role ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);

            return $this->addCorsHeaders(response()->json([
                'success' => false,
                'error' => 'فشل جلب المشاريع',
                'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ أثناء جلب المشاريع',
                'debug' => config('app.debug') ? [
                    'file' => $e->getFile(),
                    'line' => $e->getLine()
                ] : null
            ], 500));
        }
    }

    /**
     * Test endpoint to check project data fields
     * GET /api/project-proposals/test-data
     */
    public function testData(Request $request)
    {
        try {
            $project = ProjectProposal::with([
                'currency',
                'shelter',
                'creator',
                'assignedToTeam',
                'assignedResearcher',
                'photographer',
                'assignedMontageProducer',
                'subcategory',
            ])->first();

            if (!$project) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا توجد مشاريع في قاعدة البيانات'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'message' => 'اختبار البيانات - جميع الحقول موجودة',
                'project_raw' => $project->toArray(),
                'field_checks' => [
                    'donor_name' => [
                        'exists' => !is_null($project->donor_name),
                        'value' => $project->donor_name,
                        'type' => gettype($project->donor_name),
                    ],
                    'project_description' => [
                        'exists' => !is_null($project->project_description),
                        'value' => $project->project_description,
                        'length' => strlen($project->project_description ?? ''),
                    ],
                    'donation_amount' => [
                        'exists' => !is_null($project->donation_amount),
                        'value' => $project->donation_amount,
                        'type' => gettype($project->donation_amount),
                    ],
                    'net_amount' => [
                        'exists' => !is_null($project->net_amount),
                        'value' => $project->net_amount,
                        'type' => gettype($project->net_amount),
                    ],
                    'amount_in_usd' => [
                        'exists' => !is_null($project->amount_in_usd),
                        'value' => $project->amount_in_usd,
                        'type' => gettype($project->amount_in_usd),
                    ],
                    'estimated_duration_days' => [
                        'exists' => !is_null($project->estimated_duration_days),
                        'value' => $project->estimated_duration_days,
                        'type' => gettype($project->estimated_duration_days),
                    ],
                ]
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get project details
     */
    public function show($id)
    {
        try {
            // ✅ جلب جميع الحقول بدون select محدد لضمان إرجاع جميع البيانات
            // استخدام findOrFail مباشرة للحصول على جميع الحقول
            $project = ProjectProposal::findOrFail($id);

            // ✅ تحميل جميع العلاقات المطلوبة بشكل شامل
            try {
                $project->load([
                    'currency',
                    'creator',
                    'assignedToTeam',
                    'shelter',
                    'subcategory',
                    'projectType',
                    'assignedBy',
                    'assignedResearcher',
                    'photographer',
                    'assignedMontageProducer',
                    'parentProject',
                    'executedProject'
                ]);
            } catch (\Exception $e) {
                Log::warning('Error loading some relations', [
                    'project_id' => $id,
                    'error' => $e->getMessage()
                ]);
                // ✅ محاولة تحميل العلاقات الأساسية فقط
                try {
                    $project->load([
                        'currency',
                        'creator',
                        'shelter',
                        'projectType'
                    ]);
                } catch (\Exception $e2) {
                    Log::error('Error loading basic relations', [
                        'project_id' => $id,
                        'error' => $e2->getMessage()
                    ]);
                }
            }

            // ✅ تحميل العلاقات المتعلقة بالمشاريع المتفرعة
            if ($project->is_divided_into_phases) {
                try {
                    $project->load([
                        'dailyPhases',
                        'monthlyPhases'
                    ]);
                } catch (\Exception $e) {
                    Log::warning('Error loading phases', [
                        'project_id' => $id,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            return $this->addCorsHeaders(response()->json([
                'success' => true,
                'project' => $project
            ], 200));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->addCorsHeaders(response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود',
                'message' => 'المشروع المطلوب غير موجود في قاعدة البيانات'
            ], 404));
        } catch (\Exception $e) {
            Log::error('Error fetching project', [
                'project_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);

            return $this->addCorsHeaders(response()->json([
                'success' => false,
                'error' => 'حدث خطأ أثناء جلب تفاصيل المشروع',
                'message' => config('app.debug') ? $e->getMessage() : 'خطأ في قاعدة البيانات يمنع تحميل المشروع. يرجى التواصل مع الإدارة.'
            ], 500));
        }
    }

    /**
     * Update project
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        $this->refreshUser($user);
        $userRole = $this->getUserRole($user);

        // السماح لـ Admin و Project Manager و Executed Projects Coordinator بتحديث beneficiaries_count فقط
        $requestData = $request->except(['_method', '_token', 'isChecked']);
        $beneficiariesFields = ['beneficiaries_count', 'beneficiaries_per_unit'];

        // التحقق من أن الطلب يحتوي على حقول beneficiaries فقط (أو لا يحتوي على حقول أخرى)
        $hasBeneficiariesFields = $request->has('beneficiaries_count') || $request->has('beneficiaries_per_unit');
        $requestKeys = array_keys($requestData);
        $nonBeneficiariesFields = array_diff($requestKeys, $beneficiariesFields);
        $onlyBeneficiariesFields = $hasBeneficiariesFields && empty($nonBeneficiariesFields);

        // إذا كان المستخدم Admin أو Project Manager أو Executed Projects Coordinator أو منسق الكفالة ويريد تحديث beneficiaries فقط
        if (
            $onlyBeneficiariesFields &&
            $this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_PROJECT_MANAGER, self::ROLE_EXECUTED_PROJECTS_COORDINATOR, self::ROLE_ORPHAN_SPONSOR_COORDINATOR])
        ) {

            if (config('app.debug')) {
                Log::info('Project update - redirecting to updateBeneficiaries', [
                    'user_role' => $userRole,
                    'user_id' => $user->id ?? null,
                    'project_id' => $id,
                    'has_beneficiaries_fields' => $hasBeneficiariesFields,
                    'only_beneficiaries_fields' => $onlyBeneficiariesFields,
                    'request_keys' => $requestKeys,
                    'non_beneficiaries_fields' => $nonBeneficiariesFields,
                    'beneficiaries_data' => array_intersect_key($requestData, array_flip($beneficiariesFields))
                ]);
            }

            return $this->updateBeneficiaries($request, $id);
        }

        // ✅ التحقق من الصلاحيات: Admin أو منسق الكفالة (لمشاريع الكفالات فقط)
        $project = ProjectProposal::findOrFail($id);
        $isSponsorshipProject = $project->isSponsorshipProject();
        $isOrphanSponsorCoordinator = $userRole === self::ROLE_ORPHAN_SPONSOR_COORDINATOR;

        // منسق الكفالة يمكنه تحديث مشاريع الكفالات فقط
        if ($isOrphanSponsorCoordinator && !$isSponsorshipProject) {
            return $this->unauthorizedResponse('منسق الكفالة يمكنه تحديث مشاريع الكفالات فقط');
        }

        // Admin يمكنه تحديث جميع المشاريع
        // منسق الكفالة يمكنه تحديث مشاريع الكفالات فقط
        if (!$this->isAdmin($user) && !($isOrphanSponsorCoordinator && $isSponsorshipProject)) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لتعديل مشروع. الصلاحيات مقتصرة على الإدارة ومنسق الكفالة (لمشاريع الكفالات فقط).');
        }

        $validator = Validator::make($request->all(), $this->getUpdateValidationRules());

        if ($validator->fails()) {
            // ✅ Log detailed validation errors for debugging
            Log::warning('Project update validation failed', [
                'project_id' => $id,
                'user_id' => $user->id ?? null,
                'user_role' => $userRole,
                'validation_errors' => $validator->errors()->toArray(),
                'request_data' => $request->except(['notes_image', 'project_image', '_token', '_method']),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors(),
                'message' => 'يرجى التحقق من البيانات المرسلة والتأكد من صحتها'
            ], 400);
        }

        try {
            $oldStatus = $project->status;

            // منع تحديث المشاريع اليومية (يمكن تحديثها فقط من خلال المشروع الأصلي)
            // ✅ استثناء: السماح بتحديث حالة المونتاج والإنهاء للمشاريع اليومية
            // لأن المشاريع اليومية يجب أن تكون قابلة للتحديث بشكل مستقل من قبل Media Manager والإدارة
            $isMediaStatusUpdate = $request->has('status') && in_array($request->status, [
                'في المونتاج',
                'تم المونتاج',
                'يجب إعادة المونتاج',
                'وصل للمتبرع',
                'منتهي'
            ]);

            if ($project->is_daily_phase && !$isMediaStatusUpdate) {
                return $this->errorResponse(
                    'لا يمكن تحديث المشروع اليومي',
                    'يجب تحديث المشروع الأصلي لتحديث المشاريع اليومية',
                    422
                );
            }

            // جلب نوع المشروع باستخدام Service
            $projectTypeResult = $this->service->getProjectTypeFromRequest($request, $project);
            if ($projectTypeResult['error']) {
                return $this->errorResponse(
                    'نوع المشروع غير موجود',
                    $projectTypeResult['error']['message'],
                    $projectTypeResult['error']['code']
                );
            }
            $projectType = $projectTypeResult['projectType'];

            // التحقق من subcategory
            $subcategoryError = $this->service->validateSubcategory($request, $projectType);
            if ($subcategoryError) {
                return $this->errorResponse(
                    'خطأ في التفرعية',
                    $subcategoryError['message'],
                    $subcategoryError['code']
                );
            }

            // ✅ إذا تم تغيير العملة فعلياً، جلب سعر الصرف الجديد
            // ✅ إذا لم تتغير العملة، نحتفظ بسعر الصرف المحفوظ الأصلي
            $exchangeRateUpdated = false;
            if ($request->has('currency_id')) {
                $newCurrencyId = $request->input('currency_id');
                // ✅ فقط إذا تغيرت العملة فعلياً، نحدث سعر الصرف
                if ($project->currency_id != $newCurrencyId) {
                    $currency = Currency::findOrFail($newCurrencyId);
                    $newExchangeRate = $currency->exchange_rate_to_usd;
                    $request->merge(['exchange_rate' => $newExchangeRate]);
                    $exchangeRateUpdated = true;
                }
                // ✅ إذا لم تتغير العملة، لا نحدث exchange_rate (نحتفظ بالقيمة المحفوظة)
            }

            // التحقق من تغيير إعدادات التقسيم
            $phaseChanged = false;
            if (
                $request->has('is_divided_into_phases') ||
                $request->has('phase_duration_days') ||
                $request->has('phase_start_date')
            ) {

                $newIsDivided = $request->input('is_divided_into_phases', $project->is_divided_into_phases);
                $newPhaseDays = $request->input('phase_duration_days', $project->phase_duration_days);
                $newPhaseStart = $request->input('phase_start_date', $project->phase_start_date);

                if (
                    $project->is_divided_into_phases != $newIsDivided ||
                    $project->phase_duration_days != $newPhaseDays ||
                    $project->phase_start_date != $newPhaseStart
                ) {
                    $phaseChanged = true;
                }
            }

            if ($request->has('project_name')) {
                // استخدام الاسم المدخل إذا كان موجوداً، وإلا توليد اسم تلقائي
                if (!empty($request->input('project_name'))) {
                    $request->merge([
                        'project_name' => Str::limit(trim($request->input('project_name')), 255)
                    ]);
                } else {
                    // إذا كان فارغاً، توليد اسم تلقائي
                    $request->merge([
                        'project_name' => $this->service->buildProjectName(
                            null,
                            $request->input('donor_code', $project->donor_code),
                            $request->input('project_type', $project->project_type),
                            $project->serial_number
                        )
                    ]);
                }
            }

            // Handle image uploads
            $updateData = [];
            $imageUploadResult = $this->imageService->handleProjectImageUploads($request, $project);
            if (isset($imageUploadResult['error'])) {
                return $imageUploadResult['error'];
            }
            if (isset($imageUploadResult['project_image'])) {
                $updateData['project_image'] = $imageUploadResult['project_image'];
            }

            // ✅ Add other fields to update array (نفس منطق الأيتام)
            // ✅ استثناء الحقول التي لا تنتمي لجدول project_proposals
            $projectData = $request->except([
                'notes_image',
                'project_image',
                'isChecked',
                '_method',
            ]);

            // ✅ معالجة project_description - تحويل string فارغ إلى null وإضافته دائماً إذا كان موجوداً
            if ($request->has('project_description')) {
                $projectDescription = $request->input('project_description');
                if ($projectDescription !== null && trim($projectDescription) === '') {
                    $updateData['project_description'] = null; // ✅ تحويل string فارغ إلى null
                } elseif ($projectDescription !== null) {
                    $updateData['project_description'] = $projectDescription;
                } else {
                    $updateData['project_description'] = null; // ✅ إذا كان null، نضيفه كـ null
                }
                // ✅ إزالة project_description من $projectData لتجنب إضافته مرتين
                unset($projectData['project_description']);
            }

            // ✅ معالجة project_type_id أو project_type - إضافته بشكل صريح إذا تم إرساله
            if (($request->has('project_type_id') || $request->has('project_type')) && $projectType) {
                $updateData['project_type_id'] = $projectType->id;
                $updateData['project_type'] = $projectType->name; // للتوافق
                // ✅ إزالة project_type_id و project_type من $projectData لتجنب إضافتهما مرتين
                unset($projectData['project_type_id']);
                unset($projectData['project_type']);
            }

            // ✅ معالجة currency_id - إضافته بشكل صريح إذا تم إرساله
            if ($request->has('currency_id')) {
                $updateData['currency_id'] = $request->input('currency_id');
                // ✅ إزالة currency_id من $projectData لتجنب إضافته مرتين
                unset($projectData['currency_id']);
            }

            // ✅ معالجة exchange_rate - إضافته بشكل صريح فقط إذا تم تحديثه بسبب تغيير العملة
            // ✅ إذا لم يتم تغيير العملة، نحتفظ بسعر الصرف القديم (لا نحدثه)
            if ($exchangeRateUpdated && $request->has('exchange_rate')) {
                $updateData['exchange_rate'] = $request->input('exchange_rate');
            }
            // ✅ إزالة exchange_rate من $projectData دائماً لتجنب تحديثه تلقائياً
            // ✅ إذا لم يتم تغيير العملة، exchange_rate لن يُضاف إلى $updateData وسيبقى القيمة القديمة
            unset($projectData['exchange_rate']);

            // ✅ إزالة beneficiaries_count من $projectData - فقط مدير المشاريع يمكنه تحديثه عبر endpoint منفصل
            unset($projectData['beneficiaries_count']);

            // ✅ منع تحديث حالة المشروع (status) من endpoint التحديث العام
            // ✅ استثناء: السماح بتحديث حالة المونتاج والإنهاء لجميع المشاريع
            // (المشاريع اليومية والمشاريع غير المقسمة)
            if ($isMediaStatusUpdate && $request->has('status')) {
                // ✅ السماح بتحديث status لجميع المشاريع في حالات المونتاج والإنهاء
                $updateData['status'] = $request->status;

                // ✅ تحديث التواريخ المناسبة
                if ($request->status === 'وصل للمتبرع') {
                    $updateData['sent_to_donor_date'] = $request->sent_to_donor_date ?? now()->toDateString();
                }

                if ($request->status === 'منتهي') {
                    $updateData['completed_date'] = $request->completed_date ?? now()->toDateString();
                }
            }
            // ✅ إزالة الحقول المعالجة من $projectData لتجنب إضافتها مرتين
            unset($projectData['status']);
            unset($projectData['sent_to_donor_date']);
            unset($projectData['completed_date']);

            foreach ($projectData as $key => $value) {
                if ($value !== null && $value !== '') {
                    $updateData[$key] = $value;
                }
            }

            // ✅ معالجة is_divided_into_phases
            if ($request->has('is_divided_into_phases')) {
                $updateData['is_divided_into_phases'] = $this->service->normalizeBoolean($request->input('is_divided_into_phases'), false);
            }

            // ✅ معالجة حقول سبب الرفض (rejection fields)
            $rejectionFields = ['rejection_reason', 'rejection_message', 'admin_rejection_reason', 'media_rejection_reason'];
            foreach ($rejectionFields as $field) {
                if ($request->has($field)) {
                    $updateData[$field] = $request->input($field);
                }
            }

            // ✅ تنظيف سبب الرفض عند قبول المونتاج
            if (isset($updateData['status']) && in_array($updateData['status'], ['تم المونتاج', 'وصل للمتبرع', 'منتهي'])) {
                // مسح سبب الرفض عند قبول المونتاج أو إكمال المشروع
                $updateData['rejection_reason'] = null;
                $updateData['rejection_message'] = null;
                $updateData['admin_rejection_reason'] = null;
                $updateData['media_rejection_reason'] = null;
            }

            // ✅ معالجة phase fields
            $updateData = $this->service->processPhaseFields($request, $updateData);

            // ✅ تنظيف البيانات
            $updateData = $this->service->cleanProjectData($updateData);

            // ✅ تحديث المشروع
            // ✅ إذا كان التحديث يتضمن status (حالات المونتاج/الإنهاء)، استخدم DB::table() لتجاوز Model Events
            if (isset($updateData['status'])) {
                Log::info('🔵 UPDATE PROJECT STATUS via general endpoint', [
                    'project_id' => $project->id,
                    'old_status' => $oldStatus,
                    'new_status' => $updateData['status'],
                    'is_daily_phase' => $project->is_daily_phase,
                    'is_monthly_phase' => $project->is_monthly_phase,
                ]);

                DB::beginTransaction();
                try {
                    $updateData['updated_at'] = now();
                    $updated = DB::table('project_proposals')
                        ->where('id', $project->id)
                        ->update($updateData);

                    if ($updated) {
                        DB::commit();
                        Log::info('✅ PROJECT STATUS UPDATED SUCCESSFULLY', [
                            'project_id' => $project->id,
                            'new_status' => $updateData['status'],
                        ]);
                    } else {
                        DB::rollBack();
                        Log::error('❌ FAILED TO UPDATE PROJECT STATUS', [
                            'project_id' => $project->id,
                        ]);
                    }
                } catch (\Exception $e) {
                    DB::rollBack();
                    Log::error('❌ EXCEPTION during project status update', [
                        'project_id' => $project->id,
                        'error' => $e->getMessage(),
                    ]);
                    throw $e;
                }

                // إعادة تحميل المشروع بدون Events
                $project = ProjectProposal::withoutEvents(function () use ($project) {
                    return ProjectProposal::find($project->id);
                });

                // تسجيل تغيير الحالة في Timeline
                if ($oldStatus !== $updateData['status']) {
                    $project->recordStatusChange($oldStatus, $updateData['status'], $request->user()->id, 'تم تحديث الحالة من لوحة التحكم');
                }
            } else {
                // تحديث عادي بدون status
                $project->update($updateData);
                // إعادة تحميل المشروع لضمان الحصول على القيم المحدثة
                $project->refresh();
            }

            // ✅ مزامنة صور الملاحظات (إضافة/حذف) بعد تحديث بيانات المشروع
            $syncResult = $this->imageService->syncNoteImages($request, $project);
            if (isset($syncResult['error'])) {
                return $syncResult['error'];
            }

            // ✅ تحديث المشاريع الفرعية تلقائياً إذا كان هذا مشروع أصلي (حقول + صور ملاحظات)
            if ($project->isParentProject()) {
                $project->refresh();
                $children = $project->dailyPhases()->get()->concat($project->monthlyPhases()->get());
                if ($children->isNotEmpty()) {
                    $childIds = $children->pluck('id')->all();
                    ProjectProposalImage::whereIn('project_proposal_id', $childIds)->where('type', 'note')->delete();
                    $project->copyNoteImagesToAllChildren($children);
                }
                // تحديد الحقول التي تم تحديثها
                $updatedFields = array_keys($updateData);
                // إضافة project_name إذا تم تحديثه
                if ($request->has('project_name')) {
                    $updatedFields[] = 'project_name';
                }
                // إضافة phase_duration_days إذا تم تحديثه (للمشاريع اليومية)
                // التحقق من وجوده في updateData أو في request
                if (isset($updateData['phase_duration_days']) || $request->has('phase_duration_days')) {
                    if (!in_array('phase_duration_days', $updatedFields)) {
                        $updatedFields[] = 'phase_duration_days';
                    }
                }
                // إضافة phase_start_date إذا تم تحديثه (للمشاريع اليومية)
                // التحقق من وجوده في updateData أو في request
                if (isset($updateData['phase_start_date']) || $request->has('phase_start_date')) {
                    if (!in_array('phase_start_date', $updatedFields)) {
                        $updatedFields[] = 'phase_start_date';
                    }
                }
                // تحديث المشاريع الفرعية (يجب أن يكون بعد refresh)
                $project->updateChildProjects($updatedFields);
            }

            // ✅ مسح cache
            $this->clearProjectsCache();

            // ✅ إرجاع المشروع المحدث
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث المشروع بنجاح',
                'project' => $project->fresh(['currency', 'creator', 'subcategory'])
            ], 200)
                ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود',
                'message' => 'المشروع المطلوب غير موجود في قاعدة البيانات'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error updating project', [
                'project_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث المشروع',
                'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ أثناء تحديث المشروع'
            ], 500);
        }
    }

    /**
     * Delete project
     */
    public function destroy(Request $request, $id)
    {
        // التحقق من أن المستخدم هو Admin
        $user = $request->user();
        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات لحذف مشروع. الصلاحيات مقتصرة على الإدارة فقط.'
            ], 403);
        }

        try {
            $project = ProjectProposal::with(['confirmedWarehouseItems.warehouseItem'])->findOrFail($id);

            DB::beginTransaction();

            // ✅ إرجاع الأصناف المؤكدة للمخزن قبل الحذف (فقط إذا كان المشروع قبل التنفيذ)
            // ✅ لا نرجع الأصناف إذا كان المشروع في حالة "تم التنفيذ" أو ما بعدها لأن المشروع تم تنفيذه بالفعل
            $statusesBeforeExecution = ['جديد', 'قيد التوريد', 'تم التوريد', 'قيد التوزيع', 'جاهز للتنفيذ', 'مؤجل'];
            $statusesAfterExecution = ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'وصل للمتبرع', 'ملغى'];

            // ✅ فقط إذا كان المشروع قبل التنفيذ (وليس تم التنفيذ أو ما بعدها)
            if (
                in_array($project->status, $statusesBeforeExecution) &&
                !in_array($project->status, $statusesAfterExecution) &&
                $project->confirmedWarehouseItems->isNotEmpty()
            ) {
                foreach ($project->confirmedWarehouseItems as $item) {
                    $totalNeeded = $item->quantity_per_unit * ($project->quantity ?? 1);
                    $item->warehouseItem->addQuantity($totalNeeded, $user->id);
                }
            }

            // إذا كان مشروع يومي، حذفه مباشرة (cascade delete سيتعامل معه)
            if ($project->is_daily_phase) {
                // ✅ الإدارة تستطيع حذف أي مشروع في أي مرحلة
                // ✅ لا توجد قيود على حذف المشاريع للإدارة

                // ✅ تحديد ما إذا تم إرجاع الأصناف للمخزن
                $itemsReturned = in_array($project->status, $statusesBeforeExecution) &&
                    !in_array($project->status, $statusesAfterExecution) &&
                    $project->confirmedWarehouseItems->isNotEmpty();

                $project->delete();
                DB::commit();

                // ✅ مسح cache للمشاريع بعد الحذف
                $this->clearProjectsCache();

                return response()->json([
                    'success' => true,
                    'message' => 'تم حذف المشروع اليومي بنجاح' .
                        ($itemsReturned ? ' وتم إرجاع الأصناف للمخزن' : '')
                ], 200);
            }

            // إذا كان مشروع أصلي مقسم، حذف المشاريع اليومية أولاً
            if ($project->is_divided_into_phases) {
                // إرجاع الأصناف للمشاريع اليومية أيضاً - تحسين الأداء
                $dailyPhases = $project->dailyPhases()
                    ->select(['id', 'parent_project_id', 'status', 'quantity'])
                    ->with([
                        'confirmedWarehouseItems.warehouseItem' => function ($q) {
                            $q->select('id', 'item_name', 'quantity_available');
                        }
                    ])
                    ->get();
                foreach ($dailyPhases as $dailyPhase) {
                    // ✅ فقط إذا كان المشروع اليومي قبل التنفيذ (وليس تم التنفيذ أو ما بعدها)
                    if (
                        in_array($dailyPhase->status, $statusesBeforeExecution) &&
                        !in_array($dailyPhase->status, $statusesAfterExecution) &&
                        $dailyPhase->confirmedWarehouseItems->isNotEmpty()
                    ) {
                        foreach ($dailyPhase->confirmedWarehouseItems as $item) {
                            $totalNeeded = $item->quantity_per_unit * ($dailyPhase->quantity ?? 1);
                            $item->warehouseItem->addQuantity($totalNeeded, $user->id);
                        }
                    }
                }

                // ✅ الإدارة تستطيع حذف أي مشروع في أي مرحلة
                // ✅ لا توجد قيود على حذف المشاريع للإدارة - يمكن حذف المشاريع اليومية حتى لو كانت قيد التنفيذ

                // حذف المشاريع اليومية
                $project->deleteDailyPhases();
            }

            // ✅ الإدارة تستطيع حذف أي مشروع في أي مرحلة
            // ✅ لا توجد قيود على حذف المشاريع للإدارة - يمكن حذف المشاريع حتى لو كانت قيد التنفيذ

            // ✅ حفظ معلومات المشروع قبل الحذف (للاستخدام في الرسالة)
            $projectStatus = $project->status;
            $hasConfirmedItems = $project->confirmedWarehouseItems->isNotEmpty();

            // ✅ تحديد ما إذا تم إرجاع الأصناف للمخزن (فقط للمشاريع قبل التنفيذ)
            $itemsReturned = in_array($projectStatus, $statusesBeforeExecution) &&
                !in_array($projectStatus, $statusesAfterExecution) &&
                $hasConfirmedItems;

            $project->delete();
            DB::commit();

            // ✅ مسح cache للمشاريع بعد الحذف
            $this->clearProjectsCache();

            // ✅ رسالة واضحة توضح ما حدث
            $message = 'تم حذف المشروع بنجاح';
            if ($itemsReturned) {
                $message .= ' وتم إرجاع الأصناف للمخزن';
            } elseif (in_array($projectStatus, $statusesAfterExecution) && $hasConfirmedItems) {
                $message .= ' (لم يتم إرجاع الأصناف للمخزن لأن المشروع تم تنفيذه)';
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'items_returned_to_warehouse' => $itemsReturned,
                'project_status_before_deletion' => $projectStatus
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل حذف المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Assign project to researcher (Project Manager)
     */
    public function assignProject(Request $request, $id)
    {
        $user = $request->user();
        $project = ProjectProposal::findOrFail($id);

        // ✅ لمشاريع الكفالة: assigned_researcher_id اختياري (الباحث افتراضياً هو منسق الكفالة)
        $isSponsorshipProject = $project->isSponsorshipProject();
        $isOrphanSponsorCoordinator = $user->role === self::ROLE_ORPHAN_SPONSOR_COORDINATOR;

        $validationRules = [];
        $validationMessages = [];

        if ($isSponsorshipProject && $isOrphanSponsorCoordinator) {
            // مشروع كفالة + منسق كفالة: assigned_researcher_id اختياري
            $validationRules['assigned_researcher_id'] = 'nullable|exists:team_personnel,id';
        } else {
            // مشاريع عادية: assigned_researcher_id مطلوب
            $validationRules['assigned_researcher_id'] = 'required|exists:team_personnel,id';
            $validationMessages['assigned_researcher_id.required'] = 'يرجى اختيار الباحث';
        }

        $validationMessages['assigned_researcher_id.exists'] = 'الباحث المحدد غير موجود';

        $validator = Validator::make($request->all(), $validationRules, $validationMessages);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $userRole = $user->role;
            $isProjectManager = $userRole === self::ROLE_PROJECT_MANAGER;
            $isAdmin = $userRole === self::ROLE_ADMIN;
            $wasPreviouslyAssigned = !is_null($project->assigned_researcher_id);
            $isReassignment = $wasPreviouslyAssigned;

            // ✅ منع الإسناد للمشاريع الملغاة دائماً (لجميع الأدوار)
            if ($project->status === 'ملغى') {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن إسناد الباحث',
                    'message' => 'لا يمكن إسناد الباحث للمشاريع الملغاة'
                ], 422);
            }

            // ✅ السماح لمدير المشاريع بإعادة الإسناد حتى مرحلة "منتهي"
            // القواعد:
            // 1. منع الإسناد الأولي للمشاريع المنتهية (لجميع الأدوار)
            // 2. السماح بإعادة الإسناد للمشاريع المنتهية فقط لمدير المشاريع أو Admin
            // 3. يجب أن يكون هناك باحث مسند مسبقاً لإعادة الإسناد
            if ($project->status === 'منتهي') {
                if ($isReassignment && ($isProjectManager || $isAdmin)) {
                    // ✅ السماح بإعادة الإسناد للمشاريع المنتهية (مدير المشاريع أو Admin فقط)
                    // متابعة العملية - لا حاجة لفحص إضافي
                } else {
                    // منع الإسناد في الحالات التالية:
                    // - إسناد أولي لمشروع منتهي (لا يوجد باحث مسند مسبقاً)
                    // - إعادة إسناد من قبل دور غير مدير المشاريع أو Admin
                    return response()->json([
                        'success' => false,
                        'error' => 'لا يمكن إسناد الباحث',
                        'message' => 'لا يمكن إسناد الباحث للمشاريع المنتهية (يُسمح بإعادة الإسناد فقط لمدير المشاريع)'
                    ], 422);
                }
            }

            // ✅ منع الإسناد قبل "تم التوريد" (للمشاريع غير المنتهية)
            // استثناء: إذا كان المشروع منتهي ومدير المشاريع يريد إعادة الإسناد، نتجاوز هذا الفحص
            if ($project->status !== 'منتهي') {
                $blockedStatuses = [
                    'جديد',
                    'قيد التوريد',
                    'مؤجل',
                ];
                if (in_array($project->status, $blockedStatuses)) {
                    return response()->json([
                        'success' => false,
                        'error' => 'لا يمكن إسناد المشروع للباحث',
                        'message' => 'لا يمكن إسناد المشروع للباحث - يجب أن تكون حالة المشروع "تم التوريد" أو ما بعدها',
                        'current_status' => $project->status,
                    ], 400);
                }
            }

            // ✅ الباحث الافتراضي لمشاريع الكفالة
            $researcherId = $request->assigned_researcher_id;

            if ($isSponsorshipProject && $isOrphanSponsorCoordinator && !$researcherId) {
                // مشروع كفالة + منسق كفالة + لم يتم تحديد باحث
                // البحث عن باحث في team_personnel بنفس اسم منسق الكفالة
                $coordinatorName = $user->name;
                $coordinatorPhone = $user->phone_number ?? '0500000000';

                $researcher = TeamPersonnel::where('name', $coordinatorName)
                    ->where('personnel_type', 'باحث')
                    ->first();

                if (!$researcher) {
                    // إنشاء باحث جديد من بيانات منسق الكفالة
                    $researcher = TeamPersonnel::create([
                        'name' => $coordinatorName,
                        'phone_number' => $coordinatorPhone,
                        'personnel_type' => 'باحث',
                        'department' => $user->department ?? 'مشاريع',
                        'is_active' => true,
                    ]);
                }

                $researcherId = $researcher->id;
            } else {
                // التحقق من أن المحدد هو باحث فعلاً
                if (!$researcherId) {
                    return response()->json([
                        'success' => false,
                        'error' => 'يرجى اختيار الباحث',
                        'message' => 'يرجى اختيار باحث من قائمة الباحثين'
                    ], 422);
                }

                $researcher = TeamPersonnel::findOrFail($researcherId);
                if ($researcher->personnel_type !== 'باحث') {
                    return response()->json([
                        'success' => false,
                        'error' => 'المحدد ليس باحث',
                        'message' => 'يرجى اختيار باحث من قائمة الباحثين'
                    ], 422);
                }
            }

            // ✅ التحقق من الصلاحيات: منسق الكفالة يسند فقط لمشاريع الكفالات
            if ($isOrphanSponsorCoordinator && !$isSponsorshipProject) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'منسق الكفالة يمكنه إسناد الباحث فقط لمشاريع الكفالات'
                ], 403);
            }

            // ✅ حفظ الحالة القديمة قبل التغيير
            $oldStatus = $project->status;
            $previousResearcherId = $project->assigned_researcher_id;

            // ✅ تحديد الحالة الجديدة بناءً على قواعد الإسناد
            $newStatus = $oldStatus;

            // ✅ إذا كان المشروع "منتهي" ومدير المشاريع يعيد الإسناد، نبقى على الحالة "منتهي"
            if ($oldStatus === 'منتهي' && $isReassignment) {
                // إعادة إسناد لمشروع منتهي - الحالة تبقى "منتهي"
                $newStatus = 'منتهي';
            }
            // ✅ إذا كانت الحالة "تم التوريد" أو "قيد التوزيع" وكان هذا أول إسناد
            // يمكن تغيير الحالة إلى "مسند لباحث" تلقائياً
            elseif (in_array($project->status, ['تم التوريد', 'قيد التوزيع']) && !$isReassignment) {
                // هذا أول إسناد - تغيير الحالة إلى "مسند لباحث"
                $newStatus = 'مسند لباحث';
            }
            // ✅ إذا كانت الحالة "مسند لباحث" أو ما بعدها وكان هناك باحث مسند بالفعل
            // هذا تعديل/إعادة إسناد - لا نغير الحالة (تبقى كما هي)

            // ✅ تحديث المشروع
            $project->update([
                'assigned_researcher_id' => $researcherId,
                'assigned_by' => $request->user()->id,
                'assignment_date' => now(),
                'status' => $newStatus
            ]);

            // ✅ إعادة تحميل المشروع للحصول على الحالة المحدثة
            $project->refresh();
            $newStatus = $project->status;

            // تسجيل في Timeline فقط إذا تغيرت الحالة فعلاً
            if ($oldStatus !== $newStatus) {
                // تغيير الحالة من "تم التوريد" إلى "مسند لباحث"
                $timelineNote = 'تم إسناد الباحث';
                $project->recordStatusChange($oldStatus, $newStatus, $request->user()->id, $timelineNote);

                // ✅ إنشاء إشعار تغيير الحالة للإدارة
                NotificationHelper::createProjectStatusChangedNotification(
                    $project,
                    $oldStatus,
                    $newStatus,
                    $request->user()
                );
            } else {
                // الحالة لم تتغير (إعادة إسناد في نفس الحالة)
                if ($isReassignment && $previousResearcherId != $request->assigned_researcher_id) {
                    // تغيير باحث مختلف
                    $timelineNote = $oldStatus === 'منتهي'
                        ? 'تم تغيير إسناد الباحث (مشروع منتهي)'
                        : 'تم تغيير إسناد الباحث';
                } elseif ($isReassignment) {
                    // إعادة إسناد لنفس الباحث (تأكيد)
                    $timelineNote = $oldStatus === 'منتهي'
                        ? 'تم إعادة إسناد الباحث (مشروع منتهي)'
                        : 'تم إعادة إسناد الباحث';
                } else {
                    // إسناد أولي (يجب ألا يحدث هنا لأن الحالة لم تتغير)
                    $timelineNote = 'تم إسناد الباحث';
                }
                // تسجيل في Timeline بدون تغيير الحالة
                $project->recordStatusChange($oldStatus, $oldStatus, $request->user()->id, $timelineNote);
            }

            // ✅ إنشاء إشعار إسناد الباحث لـ Media Manager (دائماً)
            NotificationHelper::createResearcherAssignedNotification($project, $researcher, $request->user());

            $project->load(['assignedResearcher', 'assignedBy']);

            // ✅ مسح cache للمشاريع بعد الإسناد
            $this->clearProjectsCache();

            // رسالة النجاح
            if ($isReassignment && $previousResearcherId != $request->assigned_researcher_id) {
                $successMessage = $oldStatus === 'منتهي'
                    ? 'تم تعديل إسناد الباحث بنجاح (مشروع منتهي)'
                    : 'تم تعديل إسناد الباحث بنجاح';
            } elseif ($isReassignment) {
                $successMessage = $oldStatus === 'منتهي'
                    ? 'تم إعادة إسناد الباحث بنجاح (مشروع منتهي)'
                    : 'تم إعادة إسناد الباحث بنجاح';
            } else {
                $successMessage = 'تم إسناد المشروع للباحث بنجاح';
            }

            return response()->json([
                'success' => true,
                'message' => $successMessage,
                'project' => $project
            ], 200);
        } catch (\Exception $e) {
            // ✅ Logging مفصل للخطأ
            \Log::error('❌ Error assigning researcher', [
                'project_id' => $id,
                'user_id' => $request->user()->id,
                'user_role' => $request->user()->role,
                'error_message' => $e->getMessage(),
                'error_trace' => $e->getTraceAsString(),
                'request_data' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل إسناد المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Perform photographer assignment for one project (validation + update + timeline + notifications).
     * Used by assignPhotographer and bulkAssignPhotographer.
     *
     * @return array{success: bool, message?: string, status_changed?: bool, is_reassignment?: bool}
     */
    private function performAssignPhotographerToProject(ProjectProposal $project, int $photographerId, User $user): array
    {
        if (is_null($project->assigned_researcher_id)) {
            return [
                'success' => false,
                'message' => 'يجب إسناد الباحث أولاً قبل إسناد المصور. المشروع في حالة "' . ($project->status ?? 'غير معرف') . '" لكن لا يوجد باحث مسند.',
            ];
        }

        $allowedStatuses = ['مسند لباحث', 'جاهز للتنفيذ', 'قيد التنفيذ'];
        if (!in_array($project->status, $allowedStatuses)) {
            return [
                'success' => false,
                'message' => 'يجب أن يكون المشروع في حالة "مسند لباحث" أو "جاهز للتنفيذ" أو "قيد التنفيذ". الحالة الحالية: ' . ($project->status ?? 'غير معرف'),
            ];
        }

        $photographer = TeamPersonnel::find($photographerId);
        if (!$photographer || $photographer->personnel_type !== 'مصور') {
            return [
                'success' => false,
                'message' => 'يرجى اختيار مصور من قائمة المصورين',
            ];
        }

        $oldStatus = $project->status;
        $isReassignment = !is_null($project->assigned_photographer_id) && (int) $project->assigned_photographer_id !== $photographerId;
        $newStatus = $oldStatus === 'مسند لباحث' ? 'جاهز للتنفيذ' : $oldStatus;

        $updateData = ['assigned_photographer_id' => $photographerId];
        if ($newStatus !== $oldStatus) {
            $updateData['status'] = $newStatus;
        }
        $project->update($updateData);
        $project->refresh();

        if ($newStatus !== $oldStatus) {
            $project->recordStatusChange($oldStatus, $newStatus, $user->id, 'تم إسناد المصور - المشروع جاهز للتنفيذ');
        } elseif ($isReassignment) {
            $project->recordStatusChange($oldStatus, $oldStatus, $user->id, 'تم إعادة إسناد المصور - الحالة لم تتغير');
        } else {
            $project->recordStatusChange($oldStatus, $oldStatus, $user->id, 'تم إسناد المصور - الحالة لم تتغير');
        }

        NotificationHelper::createPhotographerAssignedNotification($project, $photographer, $user);

        if ($newStatus !== $oldStatus) {
            NotificationHelper::createProjectStatusChangedNotification($project, $oldStatus, $newStatus, $user);
            if ($newStatus === 'جاهز للتنفيذ') {
                $coordinators = User::byRole('executed_projects_coordinator')->active()->get();
                foreach ($coordinators as $coordinator) {
                    Notification::create([
                        'user_id' => $coordinator->id,
                        'project_id' => $project->id,
                        'notification_type' => 'ready_for_shelter_selection',
                        'title' => 'مشروع جاهز للتنفيذ',
                        'message' => "المشروع #{$project->serial_number} جاهز - يرجى اختيار المخيم",
                        'priority' => 'high'
                    ]);
                }
            }
        }

        return [
            'success' => true,
            'status_changed' => $newStatus !== $oldStatus,
            'is_reassignment' => $isReassignment,
        ];
    }

    /**
     * Assign photographer to project (Media Manager)
     */
    public function assignPhotographer(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'assigned_photographer_id' => 'required|exists:team_personnel,id',
        ], [
            'assigned_photographer_id.required' => 'يرجى اختيار المصور',
            'assigned_photographer_id.exists' => 'المصور المحدد غير موجود',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $project = ProjectProposal::findOrFail($id);

            // إصلاح تلقائي: إذا كانت الحالة "مسند لباحث" لكن لا يوجد باحث مسند
            if (is_null($project->assigned_researcher_id)) {
                if ($project->status === 'مسند لباحث') {
                    $oldStatus = $project->status;
                    $project->update([
                        'status' => 'تم التوريد',
                        'assigned_researcher_id' => null,
                        'assigned_by' => null,
                        'assignment_date' => null
                    ]);
                    $project->recordStatusChange(
                        $oldStatus,
                        'تم التوريد',
                        $request->user()->id,
                        'إصلاح تلقائي: المشروع كان في حالة "مسند لباحث" بدون باحث مسند - تم إرجاعه إلى "تم التوريد"'
                    );
                    return response()->json([
                        'success' => false,
                        'error' => 'لا يمكن إسناد المصور',
                        'message' => 'المشروع كان في حالة "مسند لباحث" لكن لا يوجد باحث مسند. تم إرجاع المشروع تلقائياً إلى حالة "تم التوريد". يرجى إسناد الباحث أولاً ثم المحاولة مرة أخرى.',
                        'auto_fixed' => true,
                        'new_status' => 'تم التوريد'
                    ], 422);
                }
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن إسناد المصور',
                    'message' => 'يجب إسناد الباحث أولاً قبل إسناد المصور. المشروع في حالة "' . ($project->status ?? 'غير معرف') . '" لكن لا يوجد باحث مسند.',
                    'debug' => config('app.debug') ? [
                        'project_id' => $project->id,
                        'status' => $project->status,
                        'assigned_researcher_id' => $project->assigned_researcher_id,
                    ] : null
                ], 422);
            }

            $result = $this->performAssignPhotographerToProject(
                $project,
                (int) $request->assigned_photographer_id,
                $request->user()
            );

            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن إسناد المصور',
                    'message' => $result['message'] ?? 'فشل إسناد المصور'
                ], 422);
            }

            $project->load(['assignedResearcher', 'photographer', 'assignedBy']);
            $this->clearMediaCache();

            $message = $result['is_reassignment']
                ? 'تم إعادة إسناد المصور بنجاح - الحالة لم تتغير'
                : ($result['status_changed'] ? 'تم إسناد المصور بنجاح - المشروع جاهز للتنفيذ' : 'تم إسناد المصور بنجاح');

            return response()->json([
                'success' => true,
                'message' => $message,
                'project' => $project,
                'status_changed' => $result['status_changed'],
                'is_reassignment' => $result['is_reassignment']
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إسناد المصور',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk assign photographer to multiple projects (Media Manager).
     * POST /project-proposals/bulk-assign-photographer
     * Body: { "project_ids": [1, 2, 3], "assigned_photographer_id": 5 }
     */
    public function bulkAssignPhotographer(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'project_ids' => 'required|array|min:1',
            'project_ids.*' => 'required|integer',
            'assigned_photographer_id' => 'required|exists:team_personnel,id',
        ], [
            'project_ids.required' => 'يرجى تحديد المشاريع',
            'project_ids.array' => 'صيغة المشاريع المحددة غير صحيحة',
            'project_ids.min' => 'يجب اختيار مشروع واحد على الأقل',
            'assigned_photographer_id.required' => 'يرجى اختيار المصور',
            'assigned_photographer_id.exists' => 'المصور المحدد غير موجود',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 400);
        }

        $photographer = TeamPersonnel::findOrFail($request->assigned_photographer_id);
        if ($photographer->personnel_type !== 'مصور') {
            return response()->json([
                'success' => false,
                'error' => 'المحدد ليس مصور',
                'message' => 'يرجى اختيار مصور من قائمة المصورين'
            ], 422);
        }

        $projectIds = array_values(array_unique(array_map('intval', $request->project_ids)));
        $assignedCount = 0;
        $failedIds = [];
        $failedReasons = [];

        foreach ($projectIds as $projectId) {
            $project = ProjectProposal::find($projectId);
            if (!$project) {
                $failedIds[] = $projectId;
                $failedReasons[$projectId] = 'المشروع غير موجود';
                continue;
            }

            $result = $this->performAssignPhotographerToProject(
                $project,
                (int) $request->assigned_photographer_id,
                $request->user()
            );

            if ($result['success']) {
                $assignedCount++;
            } else {
                $failedIds[] = $projectId;
                $failedReasons[$projectId] = $result['message'] ?? 'فشل الإسناد';
            }
        }

        $this->clearMediaCache();
        $failedCount = count($failedIds);

        $message = $failedCount === 0
            ? 'تم إسناد المصور لـ ' . $assignedCount . ' مشاريع'
            : 'تم إسناد المصور لـ ' . $assignedCount . ' مشاريع، وفشل ' . $failedCount . ' مشاريع';

        return response()->json([
            'success' => true,
            'message' => $message,
            'assigned_count' => $assignedCount,
            'failed_count' => $failedCount,
            'failed_ids' => $failedIds,
            'failed_reasons' => $failedReasons,
        ], 200);
    }

    /**
     * Return project to "تم التوريد" (Project Manager)
     * ✅ يمكن تحديث حالة التوريد من أي مرحلة
     */
    public function returnToSupply(Request $request, $id)
    {
        try {
            $project = ProjectProposal::findOrFail($id);

            // ✅ إزالة القيود - يمكن تحديث حالة التوريد من أي مرحلة
            // منع فقط الحالات النهائية (منتهي، ملغى)
            $nonChangeableStatuses = ['منتهي', 'ملغى'];
            if (in_array($project->status, $nonChangeableStatuses)) {
                return $this->addCorsHeaders(response()->json([
                    'success' => false,
                    'error' => 'لا يمكن إرجاع المشروع',
                    'message' => 'لا يمكن تحديث حالة التوريد للمشاريع المنتهية أو الملغاة'
                ], 422));
            }

            // ✅ إذا كان المشروع في حالة متقدمة (بعد التنفيذ)، نطلب تأكيد
            $advancedStatuses = ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'وصل للمتبرع'];
            $isAdvancedStatus = in_array($project->status, $advancedStatuses);

            // ✅ إذا كان مصور مسند، نزيل الإسناد عند الإرجاع
            $shouldRemovePhotographer = !is_null($project->assigned_photographer_id);

            // حفظ الحالة القديمة
            $oldStatus = $project->status;

            // ✅ إرجاع المشروع إلى حالة "تم التوريد" وإزالة الإسنادات
            $updateData = [
                'status' => 'تم التوريد',
                'assigned_researcher_id' => null,
                'assigned_by' => null,
                'assignment_date' => null
            ];

            // ✅ إزالة إسناد المصور إذا كان موجوداً
            if ($shouldRemovePhotographer) {
                $updateData['assigned_photographer_id'] = null;
            }

            $project->update($updateData);

            // إعادة تحميل المشروع
            $project->refresh();

            // تسجيل في Timeline
            $notes = 'تم إرجاع المشروع إلى حالة التوريد';
            if ($shouldRemovePhotographer) {
                $notes .= ' - تم إلغاء إسناد الباحث والمصور';
            } else {
                $notes .= ' - تم إلغاء إسناد الباحث';
            }

            if ($isAdvancedStatus) {
                $notes .= ' (من حالة متقدمة)';
            }

            $project->recordStatusChange(
                $oldStatus,
                'تم التوريد',
                $request->user()->id,
                $notes
            );

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            // ✅ إجبار Frontend على إعادة جلب البيانات
            $response = $this->addCorsHeaders(response()->json([
                'success' => true,
                'message' => 'تم إرجاع المشروع إلى حالة التوريد بنجاح',
                'project' => $project,
                'cache_bust' => time(),
            ], 200));

            $response->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0')
                ->header('X-Cache-Bust', time())
                ->header('X-Cache-Version', CacheService::getVersion('projects'));

            return $response;
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إرجاع المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Postpone project (Project Manager)
     */
    public function postponeProject(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'postponement_reason' => 'nullable|string|max:500',
        ], [
            'postponement_reason.max' => 'سبب التأجيل يجب أن يكون أقل من 500 حرف',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $project = ProjectProposal::findOrFail($id);

            // ✅ السماح بتأجيل المشاريع في حالة "قيد التنفيذ" (مدير المشاريع يمكنه تأجيل المشروع)
            // ✅ منع تأجيل المشاريع بعد التنفيذ أو في مراحل متقدمة
            $nonPostponableStatuses = ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'وصل للمتبرع', 'منتهي', 'ملغى'];
            if (in_array($project->status, $nonPostponableStatuses)) {
                return $this->addCorsHeaders(response()->json([
                    'success' => false,
                    'error' => 'لا يمكن تأجيل هذا المشروع',
                    'message' => 'لا يمكن تأجيل المشروع بعد إتمام التنفيذ أو في مراحل متقدمة'
                ], 422));
            }

            // ✅ التحقق من الصلاحيات - فقط مدير المشاريع والإدارة يمكنهم تأجيل المشاريع في حالة "قيد التنفيذ"
            $user = $request->user();
            if ($project->status === 'قيد التنفيذ' && $user && !in_array($user->role, ['project_manager', 'admin'])) {
                return $this->addCorsHeaders(response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'فقط مدير المشاريع والإدارة يمكنهم تأجيل المشاريع في حالة "قيد التنفيذ"'
                ], 403));
            }

            $oldStatus = $project->status;

            // تحديث حالة المشروع إلى "مؤجل"
            $project->update([
                'status' => 'مؤجل',
                'postponement_reason' => $request->postponement_reason ?? null,
            ]);

            // ✅ إعادة تحميل المشروع للحصول على الحالة المحدثة
            $project->refresh();

            // تسجيل في Timeline
            $notes = $request->postponement_reason
                ? "تم تأجيل المشروع. السبب: {$request->postponement_reason}"
                : 'تم تأجيل المشروع';
            $project->recordStatusChange($oldStatus, 'مؤجل', $request->user()->id, $notes);

            // ✅ الحصول على السبب من Request (حتى لو لم يُحفظ في قاعدة البيانات مباشرة)
            $reason = $request->postponement_reason ?? $project->postponement_reason ?? null;

            // ✅ إنشاء إشعار التأجيل فقط (بدون إشعار تغيير الحالة المكرر)
            NotificationHelper::createProjectPostponedNotification(
                $project,
                $reason ?? 'لم يتم تحديد سبب',
                $oldStatus
            );

            $project->load(['currency', 'assignedToTeam', 'photographer', 'shelter']);

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            // ✅ إجبار Frontend على إعادة جلب البيانات مباشرة
            $response = $this->addCorsHeaders(response()->json([
                'success' => true,
                'message' => 'تم تأجيل المشروع بنجاح',
                'project' => $project,
                'cache_bust' => time(), // ✅ إضافة timestamp لإجبار Frontend على إعادة الجلب
            ], 200));

            // ✅ إضافة headers لإجبار Frontend على عدم استخدام الكاش
            $response->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0')
                ->header('X-Cache-Bust', time())
                ->header('X-Cache-Version', CacheService::getVersion('projects'));

            return $response;
        } catch (\Exception $e) {
            Log::error('Error postponing project', [
                'project_id' => $id,
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return $this->addCorsHeaders(response()->json([
                'success' => false,
                'error' => 'فشل تأجيل المشروع',
                'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ أثناء تأجيل المشروع'
            ], 500));
        }
    }

    /**
     * Resume postponed project (Project Manager)
     */
    public function resumeProject(Request $request, $id)
    {
        try {
            $project = ProjectProposal::findOrFail($id);

            if ($project->status !== 'مؤجل') {
                return response()->json([
                    'success' => false,
                    'error' => 'المشروع غير مؤجل',
                    'message' => 'هذا المشروع ليس في حالة مؤجل'
                ], 422);
            }

            $oldStatus = $project->status;

            // إعادة المشروع إلى الحالة المناسبة
            // إذا كان له فريق مكلف، نرجعه إلى "جاهز للتنفيذ"
            // وإلا نرجعه إلى "جديد"
            $newStatus = $project->assigned_to_team_id ? 'جاهز للتنفيذ' : 'جديد';

            $project->update([
                'status' => $newStatus,
                'postponement_reason' => null,
                'postponed_at' => null,
            ]);

            // ✅ إعادة تحميل المشروع للحصول على الحالة المحدثة
            $project->refresh();

            // تسجيل في Timeline
            $project->recordStatusChange($oldStatus, $newStatus, $request->user()->id, 'تم استئناف المشروع بعد التأجيل');

            // ✅ إنشاء إشعار الاستئناف فقط (بدون إشعار تغيير الحالة المكرر)
            NotificationHelper::createProjectResumedNotification($project, $newStatus);

            $project->load(['currency', 'assignedToTeam', 'photographer', 'shelter']);

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            return response()->json([
                'success' => true,
                'message' => 'تم استئناف المشروع بنجاح',
                'project' => $project
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل استئناف المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Move project to supply stage (Project Manager)
     * ✅ يمكن تحديث حالة التوريد من أي مرحلة
     */
    public function moveToSupply($id)
    {
        try {
            $project = ProjectProposal::findOrFail($id);

            // ✅ إزالة القيود - يمكن تحديث حالة التوريد من أي مرحلة
            // منع فقط الحالات النهائية (منتهي، ملغى)
            $nonChangeableStatuses = ['منتهي', 'ملغى'];
            if (in_array($project->status, $nonChangeableStatuses)) {
                return $this->addCorsHeaders(response()->json([
                    'success' => false,
                    'error' => 'لا يمكن نقل المشروع',
                    'message' => 'لا يمكن تحديث حالة التوريد للمشاريع المنتهية أو الملغاة'
                ], 422));
            }

            $oldStatus = $project->status;
            $project->update(['status' => 'قيد التوريد']);

            // Timeline
            $notes = 'تم نقل المشروع لمرحلة التوريد';
            if ($oldStatus !== 'جديد') {
                $notes .= " (من حالة: {$oldStatus})";
            }

            $project->recordStatusChange(
                $oldStatus,
                'قيد التوريد',
                request()->user()->id,
                $notes
            );

            // إشعار لمدير المخزن
            NotificationHelper::createSupplyStartedNotification($project);

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            // ✅ إجبار Frontend على إعادة جلب البيانات
            $response = $this->addCorsHeaders(response()->json([
                'success' => true,
                'message' => 'تم نقل المشروع لمرحلة التوريد',
                'project' => $project,
                'cache_bust' => time(),
            ], 200));

            $response->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0')
                ->header('X-Cache-Bust', time())
                ->header('X-Cache-Version', CacheService::getVersion('projects'));

            return $response;
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل نقل المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Convert project amount to Shekel (Project Manager)
     */
    public function convertToShekel(Request $request, $id)
    {
        // ✅ Log الطلب الوارد للتشخيص
        \Log::info('Convert to Shekel Request', [
            'project_id' => $id,
            'request_data' => $request->all(),
            'user_id' => $request->user()?->id,
        ]);

        $validator = Validator::make($request->all(), [
            'shekel_exchange_rate' => 'required|filled|numeric|min:0.01',
            'transfer_discount_percentage' => 'nullable|numeric|min:0|max:100', // ✅ نسبة خصم النقل (اختيارية - افتراضية 0)
        ], [
            'shekel_exchange_rate.required' => 'سعر الصرف مطلوب',
            'shekel_exchange_rate.filled' => 'سعر الصرف لا يمكن أن يكون فارغاً',
            'shekel_exchange_rate.numeric' => 'سعر الصرف يجب أن يكون رقماً',
            'shekel_exchange_rate.min' => 'سعر الصرف يجب أن يكون أكبر من صفر',
            'transfer_discount_percentage.numeric' => 'نسبة خصم النقل يجب أن تكون رقماً',
            'transfer_discount_percentage.min' => 'نسبة خصم النقل يجب أن تكون أكبر من أو تساوي صفر',
            'transfer_discount_percentage.max' => 'نسبة خصم النقل يجب أن تكون أقل من أو تساوي 100',
        ]);

        if ($validator->fails()) {
            \Log::warning('Convert to Shekel Validation Failed', [
                'project_id' => $id,
                'errors' => $validator->errors()->toArray(),
                'request_data' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'فشل التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $project = ProjectProposal::findOrFail($id);

            \Log::info('Convert to Shekel - Project Found', [
                'project_id' => $project->id,
                'project_status' => $project->status,
                'net_amount' => $project->net_amount,
            ]);

            // ✅ التحقق من وجود المستخدم أولاً (للاستخدام في فحص منسق الكفالات)
            $user = $request->user();
            if (!$user) {
                \Log::error('Convert to Shekel - User Not Authenticated', [
                    'project_id' => $project->id,
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'يجب تسجيل الدخول أولاً'
                ], 401);
            }

            // يمكن التحويل: "جديد" أو "قيد التوريد" للجميع، أو أي حالة ما عدا "ملغى" لمنسق الكفالات في مشاريع الكفالات
            $isOrphanSponsorCoordinator = $user->role === 'orphan_sponsor_coordinator';
            $isSponsorshipProject = $project->isSponsorshipProject();

            if ($isOrphanSponsorCoordinator && $isSponsorshipProject) {
                // ✅ منسق الكفالات: يمكنه التحويل للشيكل في كل حالات المشروع ما عدا "ملغى"
                if ($project->status === 'ملغى') {
                    \Log::warning('Convert to Shekel - Sponsorship project cancelled', [
                        'project_id' => $project->id,
                        'current_status' => $project->status,
                    ]);
                    return response()->json([
                        'success' => false,
                        'error' => 'لا يمكن تحويل المبلغ',
                        'message' => 'لا يمكن التحويل للشيكل - المشروع ملغى'
                    ], 422);
                }
            } else {
                // للآخرين: التحويل فقط في حالة "جديد" أو "قيد التوريد"
                if (!in_array($project->status, ['جديد', 'قيد التوريد'])) {
                    \Log::warning('Convert to Shekel - Invalid Status', [
                        'project_id' => $project->id,
                        'current_status' => $project->status,
                        'allowed_statuses' => ['جديد', 'قيد التوريد'],
                    ]);
                    return response()->json([
                        'success' => false,
                        'error' => 'لا يمكن تحويل المبلغ',
                        'message' => 'المشروع يجب أن يكون في حالة جديد أو قيد التوريد. الحالة الحالية: ' . $project->status
                    ], 422);
                }
            }

            // ✅ نسبة خصم النقل (افتراضية 0 إذا لم يتم إرسالها)
            $transferDiscountPercentage = $request->input('transfer_discount_percentage', 0);

            // ✅ التحقق من أن سعر الصرف موجود وصحيح
            $exchangeRate = $request->input('shekel_exchange_rate');
            if (!$exchangeRate || $exchangeRate <= 0) {
                \Log::error('Convert to Shekel - Invalid Exchange Rate', [
                    'project_id' => $project->id,
                    'exchange_rate' => $exchangeRate,
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'سعر الصرف غير صحيح',
                    'message' => 'سعر الصرف يجب أن يكون أكبر من صفر'
                ], 422);
            }

            // ✅ تمرير نسبة خصم النقل (هي نفسها نسبة الخصم للتحويل)
            $netAmountShekel = $project->convertToShekel(
                $exchangeRate,
                $user->id,
                $transferDiscountPercentage // ✅ نسبة خصم النقل (افتراضية 0)
            );

            // Timeline
            $timelineNote = "تم تحويل المبلغ الصافي للشيكل: {$project->net_amount} USD × {$exchangeRate} = {$netAmountShekel} ILS";
            if ($transferDiscountPercentage > 0) {
                $timelineNote .= " (تم خصم نسبة النقل: {$transferDiscountPercentage}%)";
            }

            $project->recordStatusChange(
                $project->status,
                $project->status,
                $user->id,
                $timelineNote
            );

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            return response()->json([
                'success' => true,
                'message' => 'تم تحويل المبلغ للشيكل بنجاح',
                'data' => [
                    'net_amount_usd' => $project->net_amount,
                    'shekel_exchange_rate' => $project->shekel_exchange_rate,
                    'net_amount_shekel' => $project->net_amount_shekel,
                    'converted_at' => $project->shekel_converted_at,
                ]
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تحويل المبلغ',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Select shelter for project (Executed Projects Coordinator)
     */
    public function selectShelter(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'shelter_id' => 'required|exists:shelters,manager_id_number',
        ], [
            'shelter_id.required' => 'يرجى اختيار المخيم',
            'shelter_id.exists' => 'المخيم المحدد غير موجود',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $project = ProjectProposal::findOrFail($id);

            // ✅ Logging: بداية العملية
            Log::info('🔵 SELECT_SHELTER_START', [
                'project_id' => $id,
                'current_status' => $project->status,
                'shelter_id' => $request->shelter_id,
                'user_id' => $request->user()->id,
                'user_name' => $request->user()->name,
                'user_role' => $request->user()->role,
                'timestamp' => now()->toDateTimeString()
            ]);

            // ✅ منع اختيار مخيم لمشاريع الكفالات
            if ($project->isSponsorshipProject()) {
                return response()->json([
                    'success' => false,
                    'error' => 'مشاريع الكفالات لا تحتاج مخيم',
                    'message' => 'مشاريع الكفالات لا تحتاج اختيار مخيم لأن الأيتام محددين من قاعدة البيانات'
                ], 422);
            }

            if ($project->status !== 'جاهز للتنفيذ') {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن اختيار المخيم',
                    'message' => 'المشروع ليس في حالة جاهز للتنفيذ'
                ], 422);
            }

            $oldStatus = $project->status;
            $shelter = Shelter::where('manager_id_number', $request->shelter_id)->first();

            // ✅ بعد اختيار المخيم، تبقى الحالة "جاهز للتنفيذ"
            // عند الضغط على "نقل للتنفيذ" تنتقل إلى "قيد التنفيذ"
            // لا نغير الحالة هنا، فقط نضيف shelter_id

            // ✅ Logging: قبل التحديث
            Log::info('🟡 SELECT_SHELTER_BEFORE_UPDATE', [
                'project_id' => $id,
                'old_status' => $oldStatus,
                'shelter_id' => $request->shelter_id,
                'status_will_remain' => 'جاهز للتنفيذ'
            ]);

            $project->update([
                'shelter_id' => $request->shelter_id,
                // ✅ لا نغير status - تبقى "جاهز للتنفيذ"
            ]);

            // ✅ إعادة تحميل المشروع للحصول على الحالة المحدثة
            $project->refresh();

            // ✅ Logging: بعد التحديث
            Log::info('🟢 SELECT_SHELTER_AFTER_UPDATE', [
                'project_id' => $id,
                'final_status' => $project->status,
                'shelter_id' => $project->shelter_id,
                'timestamp' => now()->toDateTimeString()
            ]);

            // ✅ تسجيل في Timeline (بدون تغيير الحالة)
            $project->recordStatusChange(
                $oldStatus,
                $oldStatus, // ✅ نفس الحالة - لم تتغير
                $request->user()->id,
                "تم اختيار المخيم: {$shelter->camp_name} - المشروع لا يزال في حالة جاهز للتنفيذ"
            );

            // ✅ إنشاء إشعار اختيار المخيم
            NotificationHelper::createShelterSelectedNotification($project, $shelter);

            // ✅ لا ننشئ إشعار تغيير الحالة لأن الحالة لم تتغير

            $project->load('shelter');

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            return response()->json([
                'success' => true,
                'message' => 'تم اختيار المخيم بنجاح - المشروع لا يزال في حالة جاهز للتنفيذ',
                'project' => $project,
                'next_step' => 'يمكنك الآن الضغط على "نقل للتنفيذ" لنقل المشروع إلى حالة قيد التنفيذ'
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل اختيار المخيم',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Transfer project to execution system (النظام القديم)
     */
    public function transferToExecution(Request $request, $id)
    {
        try {
            $proposal = ProjectProposal::findOrFail($id);

            // ✅ إذا كان المشروع قد تم نقله بالفعل (تم إنشاء project في جدول projects)، نعيد نجاح بدون إنشاء duplicate
            if ($proposal->transferred_to_projects && $proposal->project_id) {
                $executedProject = Project::find($proposal->project_id);
                if ($executedProject) {
                    $proposal->load(['executedProject', 'shelter']);
                    return response()->json([
                        'success' => true,
                        'message' => 'المشروع تم نقله للتنفيذ مسبقاً',
                        'proposal' => $proposal,
                        'executed_project' => $executedProject,
                        'already_transferred' => true
                    ], 200);
                }
            }

            // ✅ لمشاريع الكفالات: السماح بالانتقال مباشرة للتنفيذ بدون اختيار مخيم
            $isSponsorshipProject = $proposal->isSponsorshipProject();

            if ($isSponsorshipProject) {
                // مشاريع الكفالات: السماح بالانتقال من "جاهز للتنفيذ" إلى "قيد التنفيذ" مباشرة
                $allowedStatuses = ['جاهز للتنفيذ', 'قيد التنفيذ', 'تم التنفيذ'];
                if (!in_array($proposal->status, $allowedStatuses)) {
                    return response()->json([
                        'success' => false,
                        'error' => 'لا يمكن نقل المشروع',
                        'message' => 'المشروع يجب أن يكون في حالة "جاهز للتنفيذ" أو "قيد التنفيذ" أو "تم التنفيذ"',
                        'current_status' => $proposal->status
                    ], 422);
                }
            } else {
                // المشاريع العادية: تحتاج مخيم
                // ✅ السماح بنقل المشروع إذا كان في حالة "قيد التنفيذ" أو "جاهز للتنفيذ" أو "تم التنفيذ" (إذا كان له shelter_id)
                // "تم التنفيذ" مسموح لأنه قد يكون تم إنشاؤه مباشرة عبر POST /api/projects
                // "قيد التنفيذ" مسموح لأنه بعد اختيار المخيم ينتقل المشروع مباشرة إلى "قيد التنفيذ"
                $allowedStatuses = ['قيد التنفيذ', 'جاهز للتنفيذ', 'تم التنفيذ'];
                if (!in_array($proposal->status, $allowedStatuses)) {
                    return response()->json([
                        'success' => false,
                        'error' => 'لا يمكن نقل المشروع',
                        'message' => 'المشروع يجب أن يكون في حالة "قيد التنفيذ" أو "جاهز للتنفيذ" أو "تم التنفيذ" مع وجود مخيم محدد',
                        'current_status' => $proposal->status,
                        'has_shelter' => !empty($proposal->shelter_id)
                    ], 422);
                }

                // ✅ إذا كان المشروع في حالة "جاهز للتنفيذ" بدون shelter_id، نطلب اختيار المخيم أولاً
                if ($proposal->status === 'جاهز للتنفيذ' && !$proposal->shelter_id) {
                    return response()->json([
                        'success' => false,
                        'error' => 'المخيم غير محدد',
                        'message' => 'يجب اختيار المخيم أولاً قبل نقل المشروع للتنفيذ'
                    ], 422);
                }

                // ✅ التحقق من وجود shelter_id (في حالة "قيد التنفيذ" يجب أن يكون موجوداً)
                if (!$proposal->shelter_id) {
                    return response()->json([
                        'success' => false,
                        'error' => 'المخيم غير محدد',
                        'message' => 'يجب اختيار المخيم أولاً'
                    ], 422);
                }
            }

            // ✅ لمشاريع الكفالات: لا ننشئ Project في جدول projects القديم (لأنها لا تحتاج مخيم)
            // للمشاريع العادية: ننشئ Project في جدول projects القديم
            $executedProject = null;

            if (!$isSponsorshipProject) {
                // المشاريع العادية: تحتاج إنشاء Project في جدول projects القديم
                // ✅ تحويل shelter_id إلى string إذا كان رقماً
                $shelterId = $proposal->shelter_id;
                if (is_numeric($shelterId) || is_int($shelterId)) {
                    $shelterId = (string) $shelterId;
                }

                // ✅ التحقق من وجود project مسبقاً لهذا source_project_id لتجنب التكرار
                $existingProject = Project::where('source_project_id', $proposal->id)->first();
                if ($existingProject) {
                    // ✅ إذا كان المشروع موجوداً بالفعل، نربطه بالـ proposal ونعيد النجاح
                    if (!$proposal->project_id) {
                        $proposal->update([
                            'transferred_to_projects' => true,
                            'project_id' => $existingProject->id,
                        ]);
                    }
                    $proposal->load(['executedProject', 'shelter']);
                    return response()->json([
                        'success' => true,
                        'message' => 'المشروع تم نقله للتنفيذ مسبقاً',
                        'proposal' => $proposal,
                        'executed_project' => $existingProject,
                        'already_transferred' => true
                    ], 200);
                }

                // إنشاء مشروع في جدول projects القديم
                // الكمية ستكون في جدول projects عند التنفيذ الفعلي
                $executedProject = Project::create([
                    'source_project_id' => $proposal->id, // ✅ إضافة source_project_id للربط
                    'project_name' => Str::limit($proposal->project_name ?? $proposal->project_description, 255),
                    'aid_type' => $proposal->project_type,
                    'quantity' => 1, // قيمة افتراضية - سيتم تحديثها عند التنفيذ الفعلي
                    'shelter_id' => $shelterId, // ✅ استخدام shelter_id المحول إلى string
                    'execution_date' => now(),
                    'status' => 'غير مكتمل'
                ]);
            }

            $oldStatus = $proposal->status;

            // ✅ دائماً نضع الحالة "قيد التنفيذ" عند نقل المشروع للتنفيذ
            // ✅ الحالة "قيد التنفيذ" ستبقى كما هي ولا تتغير تلقائياً
            // ✅ فقط مدير المشاريع يمكنه تغيير الحالة من "قيد التنفيذ" إلى "تم التنفيذ"
            // ✅ لا يوجد أي كود آخر يغير الحالة تلقائياً من "قيد التنفيذ"
            $newStatus = 'قيد التنفيذ';

            // ✅ Logging: قبل التحديث
            Log::info('🟡 TRANSFER_TO_EXECUTION_BEFORE_UPDATE', [
                'project_id' => $id,
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'user_id' => $request->user()->id,
                'user_role' => $request->user()->role
            ]);

            // ✅ تحديث الـ proposal مباشرة في قاعدة البيانات
            // ✅ استخدام DB::table() لتحديث مباشر بدون observers
            $updateData = [
                'status' => $newStatus, // ✅ "قيد التنفيذ" - تحديث مباشر في DB
                'updated_at' => now()
            ];

            // ✅ لمشاريع الكفالات: لا نضيف transferred_to_projects و project_id
            // للمشاريع العادية: نضيف transferred_to_projects و project_id
            if (!$isSponsorshipProject && $executedProject) {
                $updateData['transferred_to_projects'] = true;
                $updateData['project_id'] = $executedProject->id;
            }

            DB::table('project_proposals')
                ->where('id', $proposal->id)
                ->update($updateData);

            // ✅ إعادة تحميل المشروع من قاعدة البيانات
            $proposal->refresh();

            // ✅ Logging: بعد التحديث المباشر
            Log::info('🟢 TRANSFER_TO_EXECUTION_AFTER_DIRECT_UPDATE', [
                'project_id' => $id,
                'status_after_direct_update' => $proposal->status,
                'expected_status' => 'قيد التنفيذ',
                'status_match' => $proposal->status === 'قيد التنفيذ'
            ]);

            // ✅ Logging: بعد التحديث
            Log::info('🟢 TRANSFER_TO_EXECUTION_COMPLETE', [
                'project_id' => $id,
                'final_status' => $proposal->status,
                'timestamp' => now()->toDateTimeString()
            ]);

            // ✅ Logging: بعد refresh للتأكد من الحالة النهائية
            Log::info('🟢 TRANSFER_TO_EXECUTION_AFTER_REFRESH', [
                'project_id' => $id,
                'status_after_refresh' => $proposal->status,
                'expected_status' => 'قيد التنفيذ',
                'status_match' => $proposal->status === 'قيد التنفيذ',
                'timestamp' => now()->toDateTimeString()
            ]);

            // ✅ التحقق من أن الحالة لم تتغير تلقائياً
            if ($proposal->status !== 'قيد التنفيذ') {
                Log::error('❌ TRANSFER_TO_EXECUTION_STATUS_MISMATCH', [
                    'project_id' => $id,
                    'expected_status' => 'قيد التنفيذ',
                    'actual_status' => $proposal->status,
                    'old_status' => $oldStatus,
                    'new_status_set' => $newStatus,
                    'warning' => 'الحالة تغيرت تلقائياً بعد update() - يجب التحقق من observers أو triggers'
                ]);

                // ✅ إعادة تعيين الحالة إلى "قيد التنفيذ" إذا تغيرت
                $proposal->update(['status' => 'قيد التنفيذ']);
                $proposal->refresh();

                Log::info('✅ TRANSFER_TO_EXECUTION_STATUS_CORRECTED', [
                    'project_id' => $id,
                    'corrected_status' => $proposal->status
                ]);
            }

            // تسجيل في Timeline (فقط إذا تغيرت الحالة)
            if ($oldStatus !== $newStatus) {
                $proposal->recordStatusChange(
                    $oldStatus,
                    'قيد التنفيذ', // ✅ استخدام الحالة الصحيحة دائماً
                    $request->user()->id,
                    'تم نقل المشروع للتنفيذ'
                );
            }

            // ✅ إنشاء إشعار نقل للتنفيذ فقط (بدون إشعار تغيير الحالة المكرر)
            NotificationHelper::createProjectTransferredToExecutionNotification(
                $proposal,
                $oldStatus
            );

            // ✅ تحميل العلاقات (executedProject فقط للمشاريع العادية)
            if (!$isSponsorshipProject) {
                $proposal->load(['executedProject', 'shelter']);
            } else {
                $proposal->load('shelter'); // مشاريع الكفالات لا تحتاج executedProject
            }

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            // ✅ Logging: الحالة النهائية قبل الإرجاع
            Log::info('🟢 TRANSFER_TO_EXECUTION_FINAL_STATUS', [
                'project_id' => $id,
                'final_status' => $proposal->status,
                'is_sponsorship_project' => $isSponsorshipProject,
                'proposal_status_in_response' => $proposal->status,
                'timestamp' => now()->toDateTimeString()
            ]);

            $responseData = [
                'success' => true,
                'message' => $isSponsorshipProject
                    ? 'تم نقل مشروع الكفالة للتنفيذ بنجاح - المشروع الآن في حالة قيد التنفيذ'
                    : 'تم نقل المشروع للتنفيذ بنجاح - المشروع الآن في حالة قيد التنفيذ',
                'proposal' => $proposal,
                'next_step' => $isSponsorshipProject
                    ? 'يمكنك الآن متابعة تنفيذ مشروع الكفالة'
                    : 'مدير المشاريع يمكنه تحديث الحالة إلى "تم التنفيذ" عند اكتمال التنفيذ'
            ];

            // ✅ إضافة executed_project فقط للمشاريع العادية
            if (!$isSponsorshipProject && $executedProject) {
                $responseData['executed_project'] = $executedProject;
            }

            return response()->json($responseData, 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل نقل المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mark project as executed (Executed Projects Coordinator / Executor)
     */
    public function markAsExecuted(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'execution_date' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
        ], [
            'execution_date.date' => 'تاريخ التنفيذ يجب أن يكون تاريخاً صحيحاً',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $project = ProjectProposal::findOrFail($id);

            // ✅ Logging: بداية العملية
            Log::info('🔵 MARK_AS_EXECUTED_START', [
                'project_id' => $id,
                'current_status' => $project->status,
                'user_id' => $request->user()->id,
                'user_name' => $request->user()->name,
                'user_role' => $request->user()->role,
                'timestamp' => now()->toDateTimeString()
            ]);

            // ✅ التحقق من أن المشروع في حالة "قيد التنفيذ"
            // ✅ هذا endpoint يستخدمه مدير المشاريع فقط لتغيير الحالة من "قيد التنفيذ" إلى "تم التنفيذ"
            // ✅ الحالة "قيد التنفيذ" لا تتغير تلقائياً - فقط من خلال هذا endpoint أو updateExecutionStatus
            if ($project->status !== 'قيد التنفيذ') {
                Log::warning('❌ MARK_AS_EXECUTED_BLOCKED', [
                    'project_id' => $id,
                    'current_status' => $project->status,
                    'required_status' => 'قيد التنفيذ'
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن تحديث حالة المشروع',
                    'message' => 'المشروع يجب أن يكون في حالة قيد التنفيذ. الحالة الحالية: ' . $project->status
                ], 422);
            }

            $oldStatus = $project->status;

            // ✅ Logging: قبل التحديث
            Log::info('🟡 MARK_AS_EXECUTED_BEFORE_UPDATE', [
                'project_id' => $id,
                'old_status' => $oldStatus,
                'new_status' => 'تم التنفيذ'
            ]);

            // ✅ تحديث حالة المشروع إلى "تم التنفيذ"
            // ✅ الحالة "تم التنفيذ" لا تعتمد على execution_date
            // ✅ execution_date هو فقط تاريخ يضعه منسق المشروع ولا يؤثر على تغيير الحالة
            // ✅ الحالة تتغير فقط عندما يضغط مدير المشاريع على "تم التنفيذ"
            $updateData = [
                'status' => 'تم التنفيذ',
            ];

            // ✅ execution_date يمكن تحديثه فقط إذا أرسله المستخدم صراحة
            // ✅ لكنه لا يؤثر على تغيير الحالة - الحالة تتغير دائماً إلى "تم التنفيذ"
            if ($request->execution_date) {
                $updateData['execution_date'] = $request->execution_date;
            }
            // ✅ لا نحدّث execution_date تلقائياً - يبقى كما هو (أو null)

            $project->update($updateData);

            // ✅ Logging: بعد التحديث
            Log::info('🟢 MARK_AS_EXECUTED_COMPLETE', [
                'project_id' => $id,
                'final_status' => $project->status,
                'execution_date' => $project->execution_date,
                'note' => 'الحالة "تم التنفيذ" لا تعتمد على execution_date - التغيير تم من قبل مدير المشاريع فقط',
                'timestamp' => now()->toDateTimeString()
            ]);

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            // تسجيل في Timeline
            $notes = $request->notes
                ? "تم إتمام تنفيذ المشروع. {$request->notes}"
                : 'تم إتمام تنفيذ المشروع';
            $project->recordStatusChange($oldStatus, 'تم التنفيذ', $request->user()->id, $notes);

            // ✅ إنشاء إشعار تغيير الحالة
            NotificationHelper::createProjectStatusChangedNotification($project, $oldStatus, 'تم التنفيذ');

            // ✅ التحقق من وجود ملف Excel للمستفيدين وإرسال تنبيه إذا لم يكن موجوداً
            NotificationHelper::createMissingBeneficiariesFileNotification($project);

            // إرسال إشعار لجميع Media Managers (القديم - يمكن إزالته لاحقاً)
            $mediaManagers = User::byRole('media_manager')->active()->get();
            foreach ($mediaManagers as $mediaManager) {
                Notification::create([
                    'user_id' => $mediaManager->id,
                    'project_id' => $project->id,
                    'notification_type' => 'ready_for_montage',
                    'title' => 'مشروع جاهز للمونتاج',
                    'message' => "المشروع #{$project->serial_number} - {$project->project_name} جاهز للمونتاج",
                    'priority' => 'high'
                ]);
            }

            $project->load(['currency', 'assignedToTeam', 'photographer', 'shelter']);

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث حالة المشروع إلى تم التنفيذ بنجاح',
                'project' => $project
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث حالة المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Assign or reassign montage producer to project (Media Manager or Admin)
     * ✅ يدعم الإسناد الأولي وإعادة الإسناد
     */

    public function assignMontageProducer(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'montage_producer_id' => 'required|exists:users,id',
        ], [
            'montage_producer_id.required' => 'يرجى اختيار ممنتج المونتاج',
            'montage_producer_id.exists' => 'ممنتج المونتاج المحدد غير موجود',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = $request->user();

            // التحقق من الصلاحيات
            if (!$user || !in_array($user->role, ['media_manager', 'admin'])) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات لإسناد ممنتج المونتاج'
                ], 403);
            }

            $project = ProjectProposal::findOrFail($id);

            // ✅ التحقق من أن المشروع في حالة تسمح بالإسناد أو إعادة الإسناد
            $allowedStatuses = ['تم التنفيذ', 'في المونتاج', 'يجب إعادة المونتاج'];
            if (!in_array($project->status, $allowedStatuses)) {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن إسناد ممنتج المونتاج',
                    'message' => 'المشروع يجب أن يكون في حالة "تم التنفيذ" أو "في المونتاج" أو "يجب إعادة المونتاج"'
                ], 422);
            }

            // التحقق من أن ممنتج المونتاج موجود وله دور صحيح
            $montageProducer = User::findOrFail($request->montage_producer_id);
            if ($montageProducer->role !== 'montage_producer') {
                return response()->json([
                    'success' => false,
                    'error' => 'المستخدم المحدد ليس ممنتج مونتاج',
                    'message' => 'يرجى اختيار ممنتج مونتاج صحيح'
                ], 422);
            }

            // ✅ التحقق من إعادة الإسناد (إذا كان هناك منتج مونتاج موجود)
            $isReassignment = $project->assigned_montage_producer_id !== null
                && $project->assigned_montage_producer_id != $request->montage_producer_id;

            $oldProducerId = $project->assigned_montage_producer_id;
            $oldProducer = $oldProducerId ? User::find($oldProducerId) : null;
            $oldStatus = $project->status;

            // تحديث المشروع
            $updateData = [
                'assigned_montage_producer_id' => $request->montage_producer_id,
                'montage_producer_assigned_at' => now(),
            ];

            // ✅ إذا كان المشروع في حالة "تم التنفيذ"، نغيره إلى "في المونتاج"
            if ($project->status === 'تم التنفيذ') {
                $updateData['status'] = 'في المونتاج';
                $updateData['montage_start_date'] = $project->montage_start_date ?? now();
            }
            // ✅ إذا كان في حالة "يجب إعادة المونتاج"، نغيره إلى "في المونتاج"
            elseif ($project->status === 'يجب إعادة المونتاج') {
                $updateData['status'] = 'في المونتاج';
            }

            $project->update($updateData);

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            // ✅ تسجيل في Timeline
            if ($isReassignment) {
                $message = "تم إعادة إسناد المشروع من ممنتج المونتاج: "
                    . ($oldProducer ? $oldProducer->name : 'غير محدد')
                    . " إلى: {$montageProducer->name}";
            } else {
                $message = "تم إسناد المشروع لممنتج المونتاج: {$montageProducer->name}";
            }

            $project->recordStatusChange(
                $oldStatus,
                $project->status,
                $user->id,
                $message
            );

            // ✅ إرسال إشعار لممنتج المونتاج الجديد
            NotificationHelper::createMontageProducerAssignedNotification($project, $montageProducer);

            // ✅ تحديث اسم الممنتج في الأرشيف تلقائياً إذا كان المشروع موجوداً في الأرشيف
            MediaArchive::where('project_proposal_id', $project->id)
                ->update(['producer_name' => $montageProducer->name]);

            // إعادة تحميل المشروع مع العلاقات
            $project->load([
                'currency',
                'assignedMontageProducer' => function ($q) {
                    $q->select('id', 'name', 'phone_number');
                }
            ]);

            return response()->json([
                'success' => true,
                'message' => $isReassignment
                    ? 'تم إعادة إسناد المشروع لممنتج المونتاج بنجاح'
                    : 'تم إسناد المشروع لممنتج المونتاج بنجاح',
                'is_reassignment' => $isReassignment,
                'project' => [
                    'id' => $project->id,
                    'status' => $project->status,
                    'assigned_montage_producer' => $project->assignedMontageProducer ? [
                        'id' => $project->assignedMontageProducer->id,
                        'name' => $project->assignedMontageProducer->name,
                    ] : null,
                    'montage_producer_assigned_at' => $project->montage_producer_assigned_at,
                ]
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error assigning montage producer', [
                'project_id' => $id,
                'montage_producer_id' => $request->montage_producer_id ?? null,
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل إسناد ممنتج المونتاج',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Batch assign montage producer to multiple projects (Media Manager or Admin)
     * ✅ يدعم الإسناد الأولي وإعادة الإسناد لعدة مشاريع دفعة واحدة
     */
    public function batchAssignProducer(Request $request)
    {
        // ✅ التحقق من البيانات
        $validator = Validator::make($request->all(), [
            'project_ids' => 'required|array|min:1',
            'project_ids.*' => 'required|integer|exists:project_proposals,id',
            'montage_producer_id' => 'required|exists:users,id',
        ], [
            'project_ids.required' => 'يرجى تحديد المشاريع المطلوبة',
            'project_ids.array' => 'صيغة المشاريع المحددة غير صحيحة',
            'project_ids.min' => 'يجب اختيار مشروع واحد على الأقل',
            'project_ids.*.exists' => 'أحد المشاريع المحددة غير موجود',
            'montage_producer_id.required' => 'يرجى اختيار ممنتج المونتاج',
            'montage_producer_id.exists' => 'ممنتج المونتاج المحدد غير موجود',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = $request->user();

            // ✅ التحقق من الصلاحيات (احتياطي بجانب الـ middleware)
            if (!$user || !$this->hasRole($user, [self::ROLE_MEDIA_MANAGER, self::ROLE_ADMIN])) {
                return $this->unauthorizedResponse('ليس لديك صلاحيات لإسناد ممنتج المونتاج للمشاريع');
            }

            $projectIds = array_unique($request->input('project_ids', []));

            // ✅ التحقق من أن ممنتج المونتاج موجود وله دور صحيح
            $montageProducer = User::findOrFail($request->montage_producer_id);
            if ($montageProducer->role !== 'montage_producer') {
                return response()->json([
                    'success' => false,
                    'error' => 'المستخدم المحدد ليس ممنتج مونتاج',
                    'message' => 'يرجى اختيار ممنتج مونتاج صحيح'
                ], 422);
            }

            $projects = ProjectProposal::whereIn('id', $projectIds)->get();

            $assignedProjects = [];
            $failedProjects = [];

            foreach ($projects as $project) {
                try {
                    DB::transaction(function () use (
                        $project,
                        $montageProducer,
                        $user,
                        &$assignedProjects
                    ) {
                        // ✅ التحقق من أن المشروع في حالة تسمح بالإسناد أو إعادة الإسناد
                        $allowedStatuses = ['تم التنفيذ', 'في المونتاج', 'يجب إعادة المونتاج'];
                        if (!in_array($project->status, $allowedStatuses, true)) {
                            throw new \RuntimeException('لا يمكن إسناد ممنتج المونتاج - حالة المشروع غير مناسبة');
                        }

                        $oldProducerId = $project->assigned_montage_producer_id;
                        $oldProducer = $oldProducerId ? User::find($oldProducerId) : null;
                        $oldStatus = $project->status;

                        $isReassignment = $project->assigned_montage_producer_id !== null
                            && $project->assigned_montage_producer_id != $montageProducer->id;

                        // تحديث المشروع
                        $updateData = [
                            'assigned_montage_producer_id' => $montageProducer->id,
                            'montage_producer_assigned_at' => now(),
                        ];

                        // ✅ إذا كان المشروع في حالة "تم التنفيذ"، نغيره إلى "في المونتاج"
                        if ($project->status === 'تم التنفيذ') {
                            $updateData['status'] = 'في المونتاج';
                            $updateData['montage_start_date'] = $project->montage_start_date ?? now();
                        }
                        // ✅ إذا كان في حالة "يجب إعادة المونتاج"، نغيره إلى "في المونتاج"
                        elseif ($project->status === 'يجب إعادة المونتاج') {
                            $updateData['status'] = 'في المونتاج';
                        }

                        $project->update($updateData);
                        $project->refresh();

                        // ✅ تسجيل في Timeline
                        if ($isReassignment) {
                            $message = "تم إعادة إسناد المشروع من ممنتج المونتاج: "
                                . ($oldProducer ? $oldProducer->name : 'غير محدد')
                                . " إلى: {$montageProducer->name}";
                        } else {
                            $message = "تم إسناد المشروع لممنتج المونتاج: {$montageProducer->name}";
                        }

                        $project->recordStatusChange(
                            $oldStatus,
                            $project->status,
                            $user->id,
                            $message
                        );

                        // ✅ إرسال إشعار لممنتج المونتاج الجديد
                        NotificationHelper::createMontageProducerAssignedNotification($project, $montageProducer);

                        // ✅ تحديث اسم الممنتج في الأرشيف تلقائياً إذا كان المشروع موجوداً في الأرشيف
                        MediaArchive::where('project_proposal_id', $project->id)
                            ->update(['producer_name' => $montageProducer->name]);

                        // إعادة تحميل المشروع مع العلاقات المطلوبة للـ Frontend
                        $project->load([
                            'currency',
                            'assignedMontageProducer' => function ($q) {
                                $q->select('id', 'name', 'phone_number');
                            }
                        ]);

                        $assignedProjects[] = [
                            'id' => $project->id,
                            'status' => $project->status,
                            'assigned_montage_producer' => $project->assignedMontageProducer ? [
                                'id' => $project->assignedMontageProducer->id,
                                'name' => $project->assignedMontageProducer->name,
                            ] : null,
                            'montage_producer_assigned_at' => $project->montage_producer_assigned_at,
                            'is_reassignment' => $isReassignment,
                        ];
                    });
                } catch (\Exception $e) {
                    Log::error('Error in batchAssignProducer for project', [
                        'project_id' => $project->id,
                        'montage_producer_id' => $montageProducer->id,
                        'user_id' => $user->id ?? null,
                        'error' => $e->getMessage(),
                    ]);

                    $failedProjects[] = [
                        'project_id' => $project->id,
                        'error' => $e->getMessage(),
                    ];
                }
            }

            // ✅ مسح cache بعد انتهاء العملية
            if (!empty($assignedProjects)) {
                $this->clearMediaCache();
                $this->clearProjectsCache();
            }

            $assignedCount = count($assignedProjects);

            if ($assignedCount === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'لم يتم إسناد أي مشروع. يرجى التحقق من الحالات وصلاحيات المشاريع.',
                    'assigned_count' => 0,
                    'failed_projects' => $failedProjects,
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'تم إسناد ' . $assignedCount . ' مشروع/مشاريع لممنتج المونتاج بنجاح',
                'assigned_count' => $assignedCount,
                'projects' => $assignedProjects,
                'failed_projects' => $failedProjects,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error in batchAssignProducer', [
                'user_id' => $request->user()?->id,
                'project_ids' => $request->input('project_ids', []),
                'montage_producer_id' => $request->input('montage_producer_id'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تنفيذ عملية الإسناد الجماعي: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update project execution status (Project Manager)
     * ✅ يسمح لمدير المشاريع بتحديث الحالة من "قيد التنفيذ" إلى "تم التنفيذ"
     */
    public function updateExecutionStatus(Request $request, $id)
    {
        $user = $request->user();
        $isOrphanSponsorCoordinator = $user && $user->role === 'orphan_sponsor_coordinator';

        // ✅ Validation مختلف حسب الدور
        $allowedStatuses = $isOrphanSponsorCoordinator
            ? ['تم التنفيذ'] // منسق الكفالة: فقط "تم التنفيذ"
            : ['قيد التنفيذ', 'تم التنفيذ']; // الأدوار الأخرى: "قيد التنفيذ" أو "تم التنفيذ"

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:' . implode(',', $allowedStatuses),
        ], [
            'status.required' => 'يرجى تحديد الحالة',
            'status.in' => $isOrphanSponsorCoordinator
                ? 'الحالة يجب أن تكون "تم التنفيذ"'
                : 'الحالة يجب أن تكون "قيد التنفيذ" أو "تم التنفيذ"',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {

            // ✅ Logging: بداية العملية
            Log::info('🔵 UPDATE_EXECUTION_STATUS_START', [
                'project_id' => $id,
                'requested_status' => $request->status,
                'user_id' => $user->id ?? null,
                'user_name' => $user->name ?? null,
                'user_role' => $user->role ?? null,
                'timestamp' => now()->toDateTimeString()
            ]);

            // التحقق من الصلاحيات
            // ✅ الصلاحيات: مدير المشاريع، مدير الإعلام، والإدارة، منسق الكفالة
            $allowedRoles = ['project_manager', 'media_manager', 'admin', 'orphan_sponsor_coordinator'];
            if (!$user || !in_array($user->role, $allowedRoles)) {
                Log::warning('❌ UPDATE_EXECUTION_STATUS_UNAUTHORIZED', [
                    'project_id' => $id,
                    'user_role' => $user->role ?? 'guest'
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات لتحديث حالة التنفيذ'
                ], 403);
            }

            $project = ProjectProposal::findOrFail($id);
            $oldStatus = $project->status;
            $newStatus = $request->status;
            $isOrphanSponsorCoordinator = $user->role === 'orphan_sponsor_coordinator';

            // ✅ Logging: قبل التحقق
            Log::info('🟡 UPDATE_EXECUTION_STATUS_BEFORE_CHECK', [
                'project_id' => $id,
                'old_status' => $oldStatus,
                'requested_status' => $newStatus,
                'user_role' => $user->role,
                'is_orphan_sponsor_coordinator' => $isOrphanSponsorCoordinator
            ]);

            // ✅ منطق مختلف حسب الدور:
            // - orphan_sponsor_coordinator: من "جاهز للتنفيذ" إلى "تم التنفيذ"
            // - الأدوار الأخرى: من "قيد التنفيذ" إلى "تم التنفيذ"
            if ($isOrphanSponsorCoordinator) {
                // ✅ منسق الكفالة: التحقق من أن الحالة الحالية هي "جاهز للتنفيذ"
                if ($oldStatus !== 'جاهز للتنفيذ') {
                    Log::warning('❌ UPDATE_EXECUTION_STATUS_BLOCKED_ORPHAN_COORDINATOR', [
                        'project_id' => $id,
                        'current_status' => $oldStatus,
                        'required_status' => 'جاهز للتنفيذ',
                        'user_role' => $user->role
                    ]);

                    return $this->addCorsHeaders(response()->json([
                        'success' => false,
                        'error' => 'لا يمكن تحديث الحالة',
                        'message' => 'يمكن تحديث الحالة فقط للمشاريع في حالة "جاهز للتنفيذ". الحالة الحالية: ' . $oldStatus
                    ], 422));
                }

                // ✅ التحقق من أن الحالة الجديدة هي "تم التنفيذ"
                if ($newStatus !== 'تم التنفيذ') {
                    return $this->addCorsHeaders(response()->json([
                        'success' => false,
                        'error' => 'لا يمكن تحديث الحالة',
                        'message' => 'يمكن تحديث الحالة فقط من "جاهز للتنفيذ" إلى "تم التنفيذ"'
                    ], 422));
                }

                Log::info('✅ STATUS_CHANGE_TO_EXECUTED_BY_ORPHAN_COORDINATOR', [
                    'project_id' => $id,
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus,
                    'user_id' => $user->id,
                    'user_role' => $user->role
                ]);
            } else {
                // ✅ الأدوار الأخرى: التحقق من أن الحالة الحالية هي "قيد التنفيذ"
                if ($oldStatus !== 'قيد التنفيذ') {
                    Log::warning('❌ UPDATE_EXECUTION_STATUS_BLOCKED', [
                        'project_id' => $id,
                        'current_status' => $oldStatus,
                        'required_status' => 'قيد التنفيذ',
                        'execution_date' => $project->execution_date,
                        'warning' => 'الحالة يجب أن تكون "قيد التنفيذ" - لا يوجد تغيير تلقائي بناءً على التاريخ'
                    ]);

                    return $this->addCorsHeaders(response()->json([
                        'success' => false,
                        'error' => 'لا يمكن تحديث الحالة',
                        'message' => 'يمكن تحديث الحالة فقط للمشاريع في حالة "قيد التنفيذ". الحالة الحالية: ' . $oldStatus . ' - الحالة "قيد التنفيذ" تبقى كما هي حتى يضغط مدير المشاريع على "تم التنفيذ"'
                    ], 422));
                }

                // ✅ حماية إضافية: التأكد من أن التغيير إلى "تم التنفيذ" يأتي فقط من مدير المشاريع
                if ($newStatus === 'تم التنفيذ' && $oldStatus === 'قيد التنفيذ') {
                    Log::info('✅ STATUS_CHANGE_TO_EXECUTED_BY_PROJECT_MANAGER', [
                        'project_id' => $id,
                        'old_status' => $oldStatus,
                        'new_status' => $newStatus,
                        'user_id' => $user->id,
                        'user_role' => $user->role,
                        'execution_date' => $project->execution_date,
                        'note' => 'التغيير تم من قبل مدير المشاريع فقط - لا يوجد تغيير تلقائي بناءً على execution_date'
                    ]);
                }

                // ✅ السماح بالتحديث من "قيد التنفيذ" إلى "تم التنفيذ" فقط
                if ($newStatus !== 'تم التنفيذ') {
                    return $this->addCorsHeaders(response()->json([
                        'success' => false,
                        'error' => 'لا يمكن تحديث الحالة',
                        'message' => 'يمكن تحديث الحالة فقط من "قيد التنفيذ" إلى "تم التنفيذ"'
                    ], 422));
                }
            }

            // ✅ Logging: قبل التحديث
            Log::info('🟡 UPDATE_EXECUTION_STATUS_BEFORE_UPDATE', [
                'project_id' => $id,
                'old_status' => $oldStatus,
                'new_status' => $newStatus
            ]);

            // ✅ تحديث المشروع
            // ✅ الحالة "تم التنفيذ" لا تعتمد على execution_date
            // ✅ execution_date هو فقط تاريخ يضعه منسق المشروع ولا يؤثر على تغيير الحالة
            // ✅ الحالة تتغير فقط عندما يضغط مدير المشاريع على "تم التنفيذ"
            $project->update([
                'status' => $newStatus,
                // ✅ لا نحدّث execution_date تلقائياً - يبقى كما هو (أو null)
                // ✅ execution_date لا يؤثر على تغيير الحالة
            ]);

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            // ✅ إعادة تحميل المشروع للحصول على الحالة المحدثة
            $project->refresh();

            // ✅ Logging: بعد التحديث
            Log::info('🟢 UPDATE_EXECUTION_STATUS_COMPLETE', [
                'project_id' => $id,
                'final_status' => $project->status,
                'execution_date' => $project->execution_date,
                'note' => 'الحالة "تم التنفيذ" لا تعتمد على execution_date - التغيير تم من قبل مدير المشاريع فقط',
                'timestamp' => now()->toDateTimeString()
            ]);

            // تسجيل في Timeline
            $roleName = $user->role === 'media_manager' ? 'مدير الإعلام'
                : ($user->role === 'project_manager' ? 'مدير المشاريع'
                    : ($user->role === 'orphan_sponsor_coordinator' ? 'منسق الكفالات'
                        : 'الإدارة'));
            $project->recordStatusChange(
                $oldStatus,
                $newStatus,
                $user->id,
                $newStatus === 'تم التنفيذ'
                    ? "تم تحديث حالة المشروع إلى \"تم التنفيذ\" من قبل {$roleName}"
                    : "تم تحديث حالة المشروع إلى \"قيد التنفيذ\" من قبل {$roleName}"
            );

            // ✅ إرسال إشعار عند اكتمال التنفيذ
            if ($newStatus === 'تم التنفيذ') {
                NotificationHelper::createProjectStatusChangedNotification(
                    $project,
                    $oldStatus,
                    $newStatus
                );

                // ✅ التحقق من وجود ملف Excel للمستفيدين
                NotificationHelper::createMissingBeneficiariesFileNotification($project);
            }

            // ✅ إجبار Frontend على إعادة جلب البيانات مباشرة
            $response = $this->addCorsHeaders(response()->json([
                'success' => true,
                'message' => 'تم تحديث حالة المشروع بنجاح',
                'project' => [
                    'id' => $project->id,
                    'status' => $project->status,
                    'execution_date' => $project->execution_date,
                ],
                'cache_bust' => time(), // ✅ إضافة timestamp لإجبار Frontend على إعادة الجلب
            ], 200));

            // ✅ إضافة headers لإجبار Frontend على عدم استخدام الكاش
            $response->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0')
                ->header('X-Cache-Bust', time());

            return $response;
        } catch (\Exception $e) {
            Log::error('Error updating execution status', [
                'project_id' => $id,
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return $this->addCorsHeaders(response()->json([
                'success' => false,
                'error' => 'فشل تحديث حالة المشروع',
                'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ أثناء تحديث حالة المشروع'
            ], 500));
        }
    }

    /**
     * Mark project as completed (Admin only)
     * تحويل المشروع من "وصل للمتبرع" إلى "منتهي"
     */
    public function markAsCompleted(Request $request, $id)
    {
        $user = $request->user();
        $this->refreshUser($user);

        // التحقق من الصلاحيات - Admin فقط
        if (!$this->isAdmin($user)) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لإنهاء المشروع. الصلاحيات مقتصرة على الإدارة فقط.');
        }

        try {
            $project = ProjectProposal::findOrFail($id);
            $oldStatus = $project->status;

            // التحقق من أن المشروع في حالة "وصل للمتبرع"
            if ($oldStatus !== 'وصل للمتبرع') {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن إنهاء المشروع',
                    'message' => 'يمكن إنهاء المشروع فقط من حالة "وصل للمتبرع"',
                    'current_status' => $oldStatus
                ], 422);
            }

            // تحديث الحالة إلى "منتهي"
            $project->update([
                'status' => 'منتهي',
                'completed_date' => now()->toDateString()
            ]);

            // تسجيل في Timeline
            $project->recordStatusChange(
                $oldStatus,
                'منتهي',
                $user->id,
                'تم إنهاء المشروع بنجاح - المشروع مكتمل'
            );

            // إرسال إشعار
            NotificationHelper::createProjectStatusChangedNotification(
                $project,
                $oldStatus,
                'منتهي',
                $user
            );

            // مسح Cache
            $this->clearProjectsCache();

            return response()->json([
                'success' => true,
                'message' => 'تم تحويل المشروع إلى حالة "منتهي" بنجاح',
                'project' => $project->fresh()
            ], 200);
        } catch (\Exception $e) {
            Log::error("Error marking project as completed: {$e->getMessage()}", [
                'project_id' => $id,
                'user_id' => $user->id,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل إنهاء المشروع',
                'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ أثناء إنهاء المشروع'
            ], 500);
        }
    }

    /**
     * Update media status (Media Manager)
     */
    public function updateMediaStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:في المونتاج,تم المونتاج,يجب إعادة المونتاج,معاد مونتاجه,وصل للمتبرع',
            'notes' => 'nullable|string',
            'rejection_reason' => 'nullable|string',
        ], [
            'status.required' => 'يرجى تحديد الحالة',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 400);
        }

        try {
            $project = ProjectProposal::findOrFail($id);

            // ✅ حفظ الحالة القديمة
            $oldStatus = $project->status;
            $oldMediaStatus = $project->status; // في هذا النظام status و media_status نفس الشيء

            // Frontend يرسل 'status' وليس 'media_status'
            $mediaStatus = $request->status;

            // ✅ التحقق من صحة الحالة
            $allowedStatuses = ['في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];
            if (!in_array($mediaStatus, $allowedStatuses)) {
                return response()->json([
                    'success' => false,
                    'message' => 'الحالة المختارة غير صحيحة'
                ], 400);
            }

            $updateData = ['status' => $mediaStatus];

            // ✅ تحديث الملاحظات إذا كانت موجودة
            if ($request->has('notes')) {
                $updateData['media_notes'] = $request->notes;
            }

            // ✅ إضافة سبب الرفض إذا كانت الحالة "معاد مونتاجه" أو "يجب إعادة المونتاج"
            if (in_array($mediaStatus, ['معاد مونتاجه', 'يجب إعادة المونتاج']) && $request->has('rejection_reason')) {
                $updateData['rejection_reason'] = $request->rejection_reason;
            }

            // ✅ تحديث التواريخ حسب الحالة
            if ($mediaStatus === 'في المونتاج' && !$project->montage_start_date) {
                $updateData['montage_start_date'] = now();
            }

            if ($mediaStatus === 'تم المونتاج') {
                $updateData['montage_completed_date'] = now();
                $updateData['montage_completed_at'] = now();
            }

            if (in_array($mediaStatus, ['معاد مونتاجه', 'يجب إعادة المونتاج'])) {
                // ✅ إعادة تعيين تواريخ المونتاج
                $updateData['montage_start_date'] = null;
                $updateData['montage_completed_date'] = null;
                $updateData['montage_completed_at'] = null;
            }

            // ✅ إذا كانت حالة المونتاج "وصل للمتبرع"، تحديث حالة المشروع
            if ($mediaStatus === 'وصل للمتبرع') {
                $updateData['sent_to_donor_date'] = now();
                $updateData['delivered_to_donor_at'] = now();
            }

            $project->update($updateData);
            $project->refresh();

            // ✅ إعادة تحميل المشروع مع العلاقات
            $project = $project->fresh()->load([
                'currency',
                'shelter',
                'projectType',
                'subcategory',
                'assignedToTeam',
                'assignedResearcher',
                'photographer',
                'assignedMontageProducer',
            ]);

            $newStatus = $project->status;

            // ✅ مسح cache محدد للإعلام بعد التحديث
            $this->clearMediaCache();
            try {
                Cache::tags(['projects', 'project-proposals'])->flush();
            } catch (\Exception $e) {
                // ✅ إذا كان cache store لا يدعم tagging، استخدم flush() مباشرة
                Cache::flush();
            }

            // تسجيل في Timeline
            $project->recordStatusChange($oldStatus, $newStatus, $request->user()->id, $request->notes);

            // ✅ إنشاء إشعار تحديث المونتاج فقط
            NotificationHelper::createMediaUpdatedNotification(
                $project,
                $mediaStatus,
                $request->notes ?? null
            );

            // ✅ إذا تغيرت حالة المشروع (مثلاً إلى "وصل للمتبرع")، إنشاء إشعار تغيير الحالة
            if ($oldStatus !== $newStatus) {
                NotificationHelper::createProjectStatusChangedNotification(
                    $project,
                    $oldStatus,
                    $newStatus
                );
            }

            // ✅ إرجاع بيانات المشروع المحدثة
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث حالة المونتاج بنجاح',
                'project' => $project, // ✅ إرجاع المشروع المحدث
                'old_status' => $oldStatus,
                'new_status' => $project->status,
                'old_media_status' => $oldMediaStatus,
                'new_media_status' => $mediaStatus,
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error updating media status: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تحديث الحالة: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Batch update media status for multiple projects (Media Manager or Admin)
     */
    public function batchUpdateStatus(Request $request)
    {
        // ✅ التحقق من البيانات
        $validator = Validator::make($request->all(), [
            'project_ids' => 'required|array|min:1',
            'project_ids.*' => 'required|integer|exists:project_proposals,id',
            'status' => 'required|in:في المونتاج,تم المونتاج,يجب إعادة المونتاج,معاد مونتاجه,وصل للمتبرع',
            'notes' => 'nullable|string',
            'rejection_reason' => 'nullable|string|required_if:status,معاد مونتاجه',
        ], [
            'project_ids.required' => 'يرجى تحديد المشاريع المطلوبة',
            'project_ids.array' => 'صيغة المشاريع المحددة غير صحيحة',
            'project_ids.min' => 'يجب اختيار مشروع واحد على الأقل',
            'project_ids.*.exists' => 'أحد المشاريع المحددة غير موجود',
            'status.required' => 'يرجى تحديد الحالة',
            'status.in' => 'الحالة المختارة غير صحيحة',
            'rejection_reason.required_if' => 'سبب الرفض مطلوب عند اختيار حالة "معاد مونتاجه"',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = $request->user();

            // ✅ التحقق من الصلاحيات (احتياطي بجانب الـ middleware)
            if (!$user || !$this->hasRole($user, [self::ROLE_MEDIA_MANAGER, self::ROLE_ADMIN])) {
                return $this->unauthorizedResponse('ليس لديك صلاحيات لتحديث حالة المشاريع في قسم الإعلام');
            }

            $projectIds = array_unique($request->input('project_ids', []));
            $status = $request->input('status');
            $notes = $request->input('notes');
            $rejectionReason = $request->input('rejection_reason');

            $allowedStatuses = ['في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];
            if (!in_array($status, $allowedStatuses, true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'الحالة المختارة غير صحيحة'
                ], 400);
            }

            $projects = ProjectProposal::whereIn('id', $projectIds)->get();

            $updatedProjects = [];
            $failedProjects = [];

            foreach ($projects as $project) {
                try {
                    DB::transaction(function () use (
                        $project,
                        $status,
                        $notes,
                        $rejectionReason,
                        $user,
                        &$updatedProjects
                    ) {
                        $oldStatus = $project->status;
                        $oldMediaStatus = $project->status; // في هذا النظام status و media_status نفس الشيء

                        $updateData = ['status' => $status];

                        // ✅ تحديث الملاحظات إذا كانت موجودة
                        if ($notes !== null) {
                            $updateData['media_notes'] = $notes;
                        }

                        // ✅ إضافة سبب الرفض إذا كانت الحالة "معاد مونتاجه" أو "يجب إعادة المونتاج"
                        if (in_array($status, ['معاد مونتاجه', 'يجب إعادة المونتاج'], true) && $rejectionReason) {
                            $updateData['rejection_reason'] = $rejectionReason;
                        }

                        // ✅ تحديث التواريخ حسب الحالة
                        if ($status === 'في المونتاج' && !$project->montage_start_date) {
                            $updateData['montage_start_date'] = now();
                        }

                        if ($status === 'تم المونتاج') {
                            $updateData['montage_completed_date'] = now();
                            $updateData['montage_completed_at'] = now();
                        }

                        if (in_array($status, ['معاد مونتاجه', 'يجب إعادة المونتاج'], true)) {
                            // ✅ إعادة تعيين تواريخ المونتاج
                            $updateData['montage_start_date'] = null;
                            $updateData['montage_completed_date'] = null;
                            $updateData['montage_completed_at'] = null;
                        }

                        // ✅ إذا كانت حالة المونتاج "وصل للمتبرع"، تحديث حالة المشروع
                        if ($status === 'وصل للمتبرع') {
                            $updateData['sent_to_donor_date'] = now();
                            $updateData['delivered_to_donor_at'] = now();
                        }

                        $project->update($updateData);
                        $project->refresh();

                        // ✅ إعادة تحميل المشروع مع العلاقات المطلوبة للـ Frontend
                        $project->load([
                            'currency',
                            'shelter',
                            'projectType',
                            'subcategory',
                            'assignedToTeam',
                            'assignedResearcher',
                            'photographer',
                            'assignedMontageProducer',
                        ]);

                        $newStatus = $project->status;

                        // تسجيل في Timeline
                        $project->recordStatusChange($oldStatus, $newStatus, $user->id, $notes);

                        // ✅ إنشاء إشعار تحديث المونتاج
                        NotificationHelper::createMediaUpdatedNotification(
                            $project,
                            $status,
                            $notes
                        );

                        // ✅ إذا تغيرت حالة المشروع (مثلاً إلى "وصل للمتبرع")، إنشاء إشعار تغيير الحالة
                        if ($oldStatus !== $newStatus) {
                            NotificationHelper::createProjectStatusChangedNotification(
                                $project,
                                $oldStatus,
                                $newStatus
                            );
                        }

                        $updatedProjects[] = $project;
                    });
                } catch (\Exception $e) {
                    Log::error('Error in batchUpdateStatus for project', [
                        'project_id' => $project->id,
                        'status' => $status,
                        'user_id' => $user->id ?? null,
                        'error' => $e->getMessage(),
                    ]);

                    $failedProjects[] = [
                        'project_id' => $project->id,
                        'error' => $e->getMessage(),
                    ];
                }
            }

            // ✅ مسح cache بعد انتهاء العملية
            if (!empty($updatedProjects)) {
                $this->clearMediaCache();
                $this->clearProjectsCache();

                try {
                    Cache::tags(['projects', 'project-proposals'])->flush();
                } catch (\Exception $e) {
                    Cache::flush();
                }
            }

            $updatedCount = count($updatedProjects);

            if ($updatedCount === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'لم يتم تحديث أي مشروع. يرجى التحقق من البيانات والمحاولة مرة أخرى.',
                    'updated_count' => 0,
                    'failed_projects' => $failedProjects,
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث حالة ' . $updatedCount . ' مشروع/مشاريع بنجاح',
                'updated_count' => $updatedCount,
                'projects' => $updatedProjects,
                'failed_projects' => $failedProjects,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error in batchUpdateStatus', [
                'user_id' => $request->user()?->id,
                'project_ids' => $request->input('project_ids', []),
                'status' => $request->input('status'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تنفيذ عملية التحديث الجماعي: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get project timeline
     */
    public function getTimeline($id)
    {
        try {
            $project = ProjectProposal::findOrFail($id);

            // إضافة pagination للـ timeline لتجنب جلب جميع السجلات
            $perPage = min((int) request()->query('perPage', 50), 100);
            $page = (int) request()->query('page', 1);

            $timeline = $project->timeline()
                ->select(['id', 'project_id', 'old_status', 'new_status', 'changed_by', 'notes', 'created_at'])
                ->with('changedBy:id,name')
                ->orderBy('created_at', 'DESC')
                ->paginate($perPage, ['*'], 'page', $page);

            // ✅ تحويل البيانات لضمان إرجاع اسم المستخدم بشكل صحيح
            $formattedTimeline = $timeline->getCollection()->map(function ($item) {
                return [
                    'id' => $item->id,
                    'project_id' => $item->project_id,
                    'old_status' => $item->old_status,
                    'new_status' => $item->new_status,
                    'changed_by' => $item->changed_by,
                    'changed_by_name' => $item->changedBy ? $item->changedBy->name : null,
                    'changed_by_user' => $item->changedBy ? [
                        'id' => $item->changedBy->id,
                        'name' => $item->changedBy->name
                    ] : null,
                    'notes' => $item->notes,
                    'created_at' => $item->created_at
                ];
            });

            return response()->json([
                'success' => true,
                'timeline' => $formattedTimeline->values()->all(),
                'total' => $timeline->total(),
                'currentPage' => $timeline->currentPage(),
                'totalPages' => $timeline->lastPage(),
                'perPage' => $timeline->perPage()
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب السجل',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Dashboard statistics (Admin only)
     */
    public function dashboard(Request $request)
    {
        // التحقق من أن المستخدم هو Admin أو Executed Projects Coordinator
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'يجب تسجيل الدخول للوصول إلى لوحة التحكم.'
            ], 401);
        }

        // السماح لـ Admin و Executed Projects Coordinator بالوصول
        if (!$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_EXECUTED_PROJECTS_COORDINATOR])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات للوصول إلى لوحة التحكم. الصلاحيات مقتصرة على الإدارة ومنسق المشاريع المنفذة فقط.');
        }

        try {
            // ✅ استخدام Query Builder مع استبعاد المشاريع الأصلية المقسمة للإحصائيات (للمبالغ)
            // المنطق الصحيح: حساب المشاريع غير المقسمة + المشاريع الفرعية (اليومية والشهرية) فقط
            // استبعاد المشاريع الأصلية المقسمة من المبالغ لأنها تكرار (المبالغ موجودة في المشاريع الفرعية)
            $baseQuery = ProjectProposal::forSurplusStatistics();

            // ✅ حساب عدد المشاريع: المشاريع غير المقسمة + المشاريع المتفرعية (اليومية والشهرية)
            // استبعاد المشاريع الأصلية المقسمة من العدد
            $totalProjects = ProjectProposal::where(function ($q) {
                // المشاريع غير المقسمة
                $q->where(function ($nonDividedQ) {
                    $nonDividedQ->where('is_divided_into_phases', false)
                        ->orWhereNull('is_divided_into_phases');
                })
                    // المشاريع المتفرعية (اليومية والشهرية)
                    ->orWhere(function ($childQ) {
                        $childQ->where('is_daily_phase', true)
                            ->orWhere('is_monthly_phase', true)
                            ->orWhereNotNull('parent_project_id')
                            ->orWhereNotNull('phase_day')
                            ->orWhereNotNull('month_number');
                    });
            })->count();

            // ✅ حساب المبلغ قبل الخصم الإداري (donation_amount * exchange_rate) - هذا هو القيمة الإجمالية
            // المنطق الصحيح: حساب donation_amount * exchange_rate للمشاريع غير المقسمة + المشاريع الفرعية (اليومية والشهرية)
            // استبعاد المشاريع الأصلية المقسمة
            $totalValueUsd = (clone $baseQuery)
                ->whereNotNull('donation_amount')
                ->whereNotNull('exchange_rate')
                ->where('donation_amount', '>', 0)
                ->where('exchange_rate', '>', 0)
                ->selectRaw('SUM(COALESCE(donation_amount, 0) * COALESCE(exchange_rate, 0)) as total')
                ->value('total') ?? 0;

            // ✅ حساب المبلغ الصافي (net_amount) - بعد الخصم الإداري
            $totalNetAmount = (clone $baseQuery)
                ->whereNotNull('net_amount')
                ->where('net_amount', '>', 0)
                ->sum('net_amount');

            // ✅ Log للتشخيص - فحص المشاريع المحسوبة
            $projectsForStats = (clone $baseQuery)
                ->select(
                    'id',
                    'serial_number',
                    'project_name',
                    'donation_amount',
                    'exchange_rate',
                    'is_divided_into_phases',
                    'is_daily_phase',
                    'is_monthly_phase',
                    'parent_project_id',
                    'phase_day',
                    'month_number'
                )
                ->limit(20)
                ->get();

            \Log::info('Dashboard Statistics Calculation', [
                'total_projects' => $totalProjects,
                'total_value_usd_calculated' => $totalValueUsd,
                'total_net_amount' => $totalNetAmount,
                'projects_count' => $projectsForStats->count(),
                'sample_projects' => $projectsForStats->map(function ($p) {
                    return [
                        'id' => $p->id,
                        'serial' => $p->serial_number,
                        'name' => $p->project_name,
                        'donation_amount' => $p->donation_amount,
                        'exchange_rate' => $p->exchange_rate,
                        'calculated' => ($p->donation_amount ?? 0) * ($p->exchange_rate ?? 0),
                        'is_divided' => $p->is_divided_into_phases,
                        'is_daily_phase' => $p->is_daily_phase,
                        'is_monthly_phase' => $p->is_monthly_phase,
                        'parent_project_id' => $p->parent_project_id,
                        'phase_day' => $p->phase_day,
                        'month_number' => $p->month_number,
                    ];
                })->toArray(),
                'query_sql' => (clone $baseQuery)->selectRaw('SUM(COALESCE(donation_amount, 0) * COALESCE(exchange_rate, 0)) as total')->toSql(),
            ]);

            // المشاريع حسب الحالة - استخدام Query Builder
            $projectsByStatus = (clone $baseQuery)
                ->selectRaw('status, COUNT(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status')
                ->toArray();

            // المشاريع حسب النوع - استخدام Query Builder
            $projectsByType = (clone $baseQuery)
                ->selectRaw('project_type, COUNT(*) as count')
                ->groupBy('project_type')
                ->pluck('count', 'project_type')
                ->toArray();

            // المشاريع المتأخرة في التنفيذ - استخدام scope مع استبعاد المشاريع المتفرعية
            $delayedExecution = ProjectProposal::forStatistics()->delayed()->count();

            // المشاريع المتأخرة في المونتاج - استخدام scope مع استبعاد المشاريع المتفرعية
            $delayedMedia = ProjectProposal::forStatistics()->montageDelayed()->count();

            // آخر المشاريع (10 مشاريع) - تحسين الأداء باستخدام select محدد
            // ✅ استبعاد المشاريع المتفرعية من آخر المشاريع
            $recentProjects = ProjectProposal::forStatistics()
                ->select([
                    'id',
                    'serial_number',
                    'project_description',
                    'donor_name',
                    'donor_code',
                    'internal_code',
                    'project_type',
                    'amount_in_usd',
                    'net_amount',
                    'status',
                    'currency_id',
                    'created_by',
                    'created_at'
                ])
                ->with([
                    'currency:id,currency_code,currency_name_ar',
                    'creator:id,name'
                ])
                ->orderBy('created_at', 'DESC')
                ->limit(10)
                ->get()
                ->map(function ($project) {
                    return [
                        'id' => $project->id,
                        'serial_number' => $project->serial_number,
                        'project_description' => $project->project_description,
                        'donor_name' => $project->donor_name,
                        'project_type' => $project->project_type,
                        'amount_in_usd' => $project->amount_in_usd,
                        'net_amount' => $project->net_amount,
                        'status' => $project->status,
                        'created_at' => $project->created_at->format('Y-m-d H:i:s'),
                        'currency' => $project->currency ? [
                            'code' => $project->currency->currency_code,
                            'name_ar' => $project->currency->currency_name_ar,
                        ] : null,
                        'creator' => $project->creator ? [
                            'id' => $project->creator->id,
                            'name' => $project->creator->name,
                        ] : null,
                    ];
                })
                ->toArray();

            // تجميع البيانات في format موحد
            // ✅ استخدام total_value_usd كقيمة إجمالية رئيسية (مجموع المبلغ قبل الخصم)
            $stats = [
                'total_projects' => $totalProjects,
                'total_value_usd' => round($totalValueUsd, 2), // ✅ مجموع المبلغ قبل الخصم (donation_amount * exchange_rate)
                'total_net_amount' => round($totalNetAmount, 2), // ✅ المبلغ الصافي بعد الخصم
                'total_amount_before_discount' => round($totalValueUsd, 2), // ✅ المبلغ قبل الخصم (نفس القيمة)
                'projects_by_status' => $projectsByStatus,
                'projects_by_type' => $projectsByType,
                'delayed_execution' => $delayedExecution,
                'delayed_media' => $delayedMedia,
                'recent_projects' => $recentProjects,
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Dashboard Statistics Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);

            return $this->addCorsHeaders(response()->json([
                'success' => false,
                'error' => 'فشل جلب الإحصائيات',
                'message' => $e->getMessage()
            ], 500));
        }
    }

    /**
     * Media Dashboard statistics (Media Manager only)
     */
    public function mediaDashboard(Request $request)
    {
        // التحقق من أن المستخدم هو Media Manager
        $user = $request->user();
        if (!$user || $user->role !== 'media_manager') {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات للوصول إلى لوحة التحكم. الصلاحيات مقتصرة على مدير الإعلام فقط.'
            ], 403);
        }

        try {
            // ✅ Caching للـ Dashboard - TTL 60 ثانية (1 دقيقة)
            $cacheKey = CacheService::buildKey('media_dashboard', [
                'user_id' => $user->id,
                'role' => 'media_manager'
            ]);

            // محاولة جلب البيانات من cache
            $cachedData = Cache::get($cacheKey);
            if ($cachedData !== null && !$request->has('_refresh')) {
                return response()->json([
                    'success' => true,
                    'data' => $cachedData,
                    'cached' => true
                ], 200);
            }

            // ✅ استخدام Query Builder مع استبعاد المشاريع المتفرعية للإحصائيات
            $baseQuery = ProjectProposal::forStatistics()
                ->whereIn('status', ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'يجب إعادة المونتاج', 'وصل للمتبرع']);

            // ✅ استخدام Eloquent للحصول على جميع الإحصائيات في استعلام واحد
            $statusCounts = (clone $baseQuery)
                ->selectRaw('status, COUNT(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status')
                ->toArray();

            $readyForMontage = $statusCounts['تم التنفيذ'] ?? 0;
            $inMontage = $statusCounts['في المونتاج'] ?? 0;
            $completed = $statusCounts['وصل للمتبرع'] ?? 0;

            // عدد المشاريع التي تحتاج إسناد مصور (مسند لباحث) - استبعاد المشاريع المتفرعية
            $needsPhotographer = ProjectProposal::forStatistics()
                ->where('status', 'مسند لباحث')
                ->whereNull('assigned_photographer_id')
                ->count();

            // ✅ آخر المشاريع التي تحتاج إسناد مصور (10 مشاريع) - مع eager loading محسّن
            $projectsNeedingPhotographer = ProjectProposal::forStatistics()
                ->select([
                    'id',
                    'serial_number',
                    'project_name',
                    'project_description',
                    'donor_name',
                    'donor_code',
                    'internal_code',
                    'project_type',
                    'currency_id',
                    'assigned_researcher_id',
                    'assignment_date',
                    'status'
                ])
                ->where('status', 'مسند لباحث')
                ->whereNull('assigned_photographer_id')
                ->with([
                    'currency:id,currency_code,currency_name_ar',
                    'assignedResearcher:id,name,phone_number'
                ])
                ->orderBy('assignment_date', 'DESC')
                ->limit(10)
                ->get()
                ->map(function ($project) {
                    return [
                        'id' => $project->id,
                        'serial_number' => $project->serial_number,
                        'project_name' => $project->project_name,
                        'project_description' => $project->project_description,
                        'donor_name' => $project->donor_name,
                        'donor_code' => $project->donor_code,
                        'internal_code' => $project->internal_code,
                        'project_type' => $project->project_type,
                        'status' => $project->status,
                        'assignment_date' => $project->assignment_date ? $project->assignment_date->format('Y-m-d') : null,
                        'days_since_assignment' => $project->assignment_date ? Carbon::now()->diffInDays(Carbon::parse($project->assignment_date)) : null,
                        'researcher' => $project->assignedResearcher ? [
                            'id' => $project->assignedResearcher->id,
                            'name' => $project->assignedResearcher->name,
                            'phone_number' => $project->assignedResearcher->phone_number,
                        ] : null,
                    ];
                })
                ->toArray();

            // ✅ عدد المشاريع المتأخرة في المونتاج - استخدام scope مع استبعاد المشاريع المتفرعية
            $delayedMontage = ProjectProposal::forStatistics()->montageDelayed()->count();

            // متوسط وقت المونتاج - استبعاد المشاريع المتفرعية (يتم في Model)
            $averageMontageDuration = ProjectProposal::getAverageMontageDuration();

            // نسبة المشاريع المتأخرة - استبعاد المشاريع المتفرعية (يتم في Model)
            $delayPercentage = ProjectProposal::getMontageDelayPercentage();

            // المشاريع حسب نوع المشروع - استخدام Query Builder
            $projectsByType = (clone $baseQuery)
                ->selectRaw('project_type, COUNT(*) as count')
                ->groupBy('project_type')
                ->pluck('count', 'project_type')
                ->toArray();

            // ✅ آخر المشاريع الجاهزة للمونتاج (10 مشاريع) - استبعاد المشاريع المتفرعية
            $recentReadyProjects = ProjectProposal::forStatistics()
                ->select([
                    'id',
                    'serial_number',
                    'project_name',
                    'project_description',
                    'donor_name',
                    'donor_code',
                    'internal_code',
                    'project_type',
                    'execution_date',
                    'currency_id',
                    'shelter_id',
                    'assigned_photographer_id'
                ])
                ->where('status', 'تم التنفيذ')
                ->with([
                    'currency:id,currency_code,currency_name_ar',
                    'shelter:manager_id_number,camp_name',
                    'photographer:id,name,phone_number'
                ])
                ->orderBy('execution_date', 'DESC')
                ->limit(10)
                ->get()
                ->map(function ($project) {
                    return [
                        'id' => $project->id,
                        'serial_number' => $project->serial_number,
                        'project_name' => $project->project_name,
                        'project_description' => $project->project_description,
                        'donor_name' => $project->donor_name,
                        'project_type' => $project->project_type,
                        'execution_date' => $project->execution_date ? $project->execution_date->format('Y-m-d') : null,
                        'days_since_execution' => $project->execution_date ? Carbon::now()->diffInDays(Carbon::parse($project->execution_date)) : null,
                        'shelter' => $project->shelter ? [
                            'camp_name' => $project->shelter->camp_name,
                            'manager_id_number' => $project->shelter->manager_id_number,
                        ] : null,
                        'photographer' => $project->photographer ? [
                            'id' => $project->photographer->id,
                            'name' => $project->photographer->name,
                            'phone_number' => $project->photographer->phone_number,
                        ] : null,
                    ];
                })
                ->toArray();

            // المشاريع المتأخرة - استخدام scope مباشرة
            $delayedProjects = ProjectProposal::montageDelayed()
                ->select([
                    'id',
                    'serial_number',
                    'project_name',
                    'project_description',
                    'donor_name',
                    'donor_code',
                    'internal_code',
                    'media_received_date'
                ])
                ->get()
                ->map(function ($project) {
                    $daysLate = Carbon::now()->diffInDays(Carbon::parse($project->media_received_date)) - 5;
                    return [
                        'id' => $project->id,
                        'serial_number' => $project->serial_number,
                        'project_name' => $project->project_name,
                        'project_description' => $project->project_description,
                        'donor_name' => $project->donor_name,
                        'days_late' => $daysLate,
                        'media_received_date' => $project->media_received_date ? $project->media_received_date->format('Y-m-d') : null,
                    ];
                })
                ->values()
                ->toArray();

            // المشاريع التي تقترب من التأخير (خلال يومين) - استخدام Query Builder
            $approachingDelay = ProjectProposal::where('status', 'في المونتاج')
                ->whereNotNull('media_received_date')
                ->whereRaw('DATEDIFF(NOW(), media_received_date) BETWEEN 3 AND 5')
                ->select([
                    'id',
                    'serial_number',
                    'project_name',
                    'donor_name',
                    'donor_code',
                    'internal_code',
                    'media_received_date'
                ])
                ->get()
                ->map(function ($project) {
                    return [
                        'id' => $project->id,
                        'serial_number' => $project->serial_number,
                        'project_name' => $project->project_name,
                        'donor_name' => $project->donor_name,
                        'days_remaining' => $project->getDaysRemainingBeforeDelay(),
                        'media_received_date' => $project->media_received_date ? $project->media_received_date->format('Y-m-d') : null,
                    ];
                })
                ->values()
                ->toArray();

            // تجميع البيانات
            $stats = [
                'needs_photographer' => $needsPhotographer,
                'projects_needing_photographer' => $projectsNeedingPhotographer,
                'ready_for_montage' => $readyForMontage,
                'in_montage' => $inMontage,
                'delayed_montage' => $delayedMontage,
                'approaching_delay' => count($approachingDelay),
                'completed' => $completed,
                'average_montage_duration' => $averageMontageDuration,
                'delay_percentage' => $delayPercentage,
                'projects_by_type' => $projectsByType,
                'recent_ready_projects' => $recentReadyProjects,
                'delayed_projects' => $delayedProjects,
                'approaching_delay_projects' => $approachingDelay,
            ];

            // ✅ حفظ البيانات في cache لمدة 60 ثانية
            Cache::put($cacheKey, $stats, CacheService::TTL_DASHBOARD);

            return response()->json([
                'success' => true,
                'data' => $stats,
                'cached' => false
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الإحصائيات',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get new projects needing photographer assignment (Media Manager only)
     * المشاريع الجديدة التي تحتاج إسناد مصور
     */
    public function getNewProjectsNeedingPhotographer(Request $request)
    {
        // ✅ التحقق من أن المستخدم هو Media Manager أو Admin
        $user = $request->user();
        if (!$user || !in_array($user->role, ['media_manager', 'admin'])) {
            return $this->addCorsHeaders(response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات للوصول إلى هذه الصفحة. الصلاحيات مقتصرة على مدير الإعلام والإدارة فقط.'
            ], 403));
        }

        try {
            $page = max(1, (int) $request->query('page', 1));
            $perPage = min(max(1, (int) $request->query('perPage', 15)), 50);
            $searchQuery = $request->query('searchQuery', '');

            // ✅ Caching للمشاريع التي تحتاج إسناد مصور - TTL 30 ثانية
            $cacheKey = CacheService::buildKey('media_projects_needing_photographer', [
                'user_id' => $user->id,
                'page' => $page,
                'per_page' => $perPage,
                'search' => substr(md5($searchQuery), 0, 8)
            ]);

            // محاولة جلب البيانات من cache (فقط إذا لم يكن هناك بحث)
            if (empty($searchQuery) && !$request->has('_refresh')) {
                $cachedData = Cache::get($cacheKey);
                if ($cachedData !== null) {
                    return response()->json([
                        'success' => true,
                        'data' => $cachedData,
                        'cached' => true
                    ], 200);
                }
            }

            // بناء Query للمشاريع التي تحتاج إسناد مصور
            // ✅ التأكد من أن المشروع في حالة "مسند لباحث" ولديه باحث مسند وليس لديه مصور مسند
            $query = ProjectProposal::where('status', 'مسند لباحث')
                ->whereNotNull('assigned_researcher_id') // ✅ يجب أن يكون الباحث مسند (شرط أساسي)
                ->whereNull('assigned_photographer_id'); // ✅ فقط المشاريع التي لم يتم إسناد مصور لها

            // البحث
            if (!empty($searchQuery)) {
                $query->where(function ($q) use ($searchQuery) {
                    $q->where('project_name', 'LIKE', "%{$searchQuery}%")
                        ->orWhere('serial_number', 'LIKE', "%{$searchQuery}%")
                        ->orWhere('donor_code', 'LIKE', "%{$searchQuery}%")
                        ->orWhere('internal_code', 'LIKE', "%{$searchQuery}%")
                        ->orWhere('donor_name', 'LIKE', "%{$searchQuery}%");
                });
            }

            // جلب البيانات مع العلاقات
            $projects = $query->select([
                'id',
                'serial_number',
                'project_name',
                'project_description',
                'donor_name',
                'donor_code',
                'internal_code',
                'project_type',
                'currency_id',
                'assigned_researcher_id',
                'assignment_date',
                'status',
                'donation_amount',
                'net_amount',
                'amount_in_usd'
            ])
                ->with([
                    'currency:id,currency_code,currency_name_ar',
                    'assignedResearcher:id,name,phone_number',
                    'assignedBy:id,name'
                ])
                ->orderBy('assignment_date', 'DESC')
                ->paginate($perPage, ['*'], 'page', $page);

            // تحويل البيانات
            $projectsData = $projects->map(function ($project) {
                return [
                    'id' => $project->id,
                    'serial_number' => $project->serial_number,
                    'project_name' => $project->project_name,
                    'project_description' => $project->project_description,
                    'donor_name' => $project->donor_name,
                    'donor_code' => $project->donor_code,
                    'internal_code' => $project->internal_code,
                    'project_type' => $project->project_type,
                    'status' => $project->status,
                    'donation_amount' => $project->donation_amount,
                    'net_amount' => $project->net_amount,
                    'amount_in_usd' => $project->amount_in_usd,
                    'assignment_date' => $project->assignment_date ? $project->assignment_date->format('Y-m-d H:i:s') : null,
                    'days_since_assignment' => $project->assignment_date ? Carbon::now()->diffInDays(Carbon::parse($project->assignment_date)) : null,
                    'currency' => $project->currency ? [
                        'id' => $project->currency->id,
                        'code' => $project->currency->currency_code,
                        'name' => $project->currency->currency_name_ar,
                    ] : null,
                    'researcher' => $project->assignedResearcher ? [
                        'id' => $project->assignedResearcher->id,
                        'name' => $project->assignedResearcher->name,
                        'phone_number' => $project->assignedResearcher->phone_number,
                    ] : null,
                    'assigned_by' => $project->assignedBy ? [
                        'id' => $project->assignedBy->id,
                        'name' => $project->assignedBy->name,
                    ] : null,
                ];
            });

            $responseData = [
                'data' => $projectsData,
                'pagination' => [
                    'current_page' => $projects->currentPage(),
                    'last_page' => $projects->lastPage(),
                    'per_page' => $projects->perPage(),
                    'total' => $projects->total(),
                    'from' => $projects->firstItem(),
                    'to' => $projects->lastItem(),
                ]
            ];

            // ✅ حفظ البيانات في cache (فقط إذا لم يكن هناك بحث)
            if (empty($searchQuery)) {
                Cache::put($cacheKey, $responseData, CacheService::TTL_REALTIME);
            }

            return $this->addCorsHeaders(response()->json(array_merge([
                'success' => true,
                'cached' => false
            ], $responseData), 200));
        } catch (\Exception $e) {
            Log::error('Error fetching new projects needing photographer', [
                'user_id' => $user->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return $this->addCorsHeaders(response()->json([
                'success' => false,
                'error' => 'فشل جلب المشاريع',
                'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ أثناء جلب المشاريع'
            ], 500));
        }
    }

    /**
     * Media Reports (Media Manager only)
     */
    public function mediaReports(Request $request)
    {
        // التحقق من أن المستخدم هو Media Manager
        $user = $request->user();
        if (!$user || $user->role !== 'media_manager') {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات للوصول إلى التقارير. الصلاحيات مقتصرة على مدير الإعلام فقط.'
            ], 403);
        }

        try {
            $month = $request->query('month'); // YYYY-MM
            $year = $request->query('year'); // YYYY
            $projectType = $request->query('project_type');

            // ✅ بناء Query للمشاريع المكتملة مع استبعاد المشاريع المتفرعية
            $query = ProjectProposal::forStatistics()
                ->where('status', 'وصل للمتبرع')
                ->whereNotNull('montage_start_date')
                ->whereNotNull('montage_completed_date');

            // فلترة حسب الشهر
            if ($month) {
                $query->whereYear('montage_completed_date', Carbon::parse($month)->year)
                    ->whereMonth('montage_completed_date', Carbon::parse($month)->month);
            } elseif ($year) {
                $query->whereYear('montage_completed_date', $year);
            }

            // فلترة حسب نوع المشروع
            if ($projectType) {
                $query->where('project_type', $projectType);
            }

            // عدد المشاريع المكتملة
            $completedCount = $query->count();

            // متوسط وقت المونتاج - استخدام Query Builder مباشرة
            $averageDuration = 0;
            if ($completedCount > 0) {
                $avgResult = (clone $query)
                    ->selectRaw('AVG(DATEDIFF(montage_completed_date, montage_start_date)) as avg_duration')
                    ->first();
                $averageDuration = $avgResult && $avgResult->avg_duration ? round($avgResult->avg_duration, 2) : 0;
            }

            $completedProjects = $query->get();

            // ✅ حساب نسبة المشاريع المتأخرة - استخدام scope مع استبعاد المشاريع المتفرعية
            $delayedCount = 0;
            if ($month) {
                $delayedQuery = ProjectProposal::forStatistics()
                    ->montageDelayed()
                    ->whereYear('media_received_date', Carbon::parse($month)->year)
                    ->whereMonth('media_received_date', Carbon::parse($month)->month);

                if ($projectType) {
                    $delayedQuery->where('project_type', $projectType);
                }

                $delayedCount = $delayedQuery->count();
            } elseif ($year) {
                $delayedQuery = ProjectProposal::forStatistics()
                    ->montageDelayed()
                    ->whereYear('media_received_date', $year);

                if ($projectType) {
                    $delayedQuery->where('project_type', $projectType);
                }

                $delayedCount = $delayedQuery->count();
            }

            $totalMontageProjects = $completedCount + $delayedCount;
            $delayPercentage = $totalMontageProjects > 0
                ? round(($delayedCount / $totalMontageProjects) * 100, 2)
                : 0;

            // المشاريع حسب نوع المشروع - استخدام Query Builder
            $byType = (clone $query)
                ->selectRaw('project_type, COUNT(*) as count')
                ->groupBy('project_type')
                ->pluck('count', 'project_type')
                ->toArray();

            // Trend شهري (آخر 6 أشهر)
            $monthlyTrend = [];
            $startDate = $month ? Carbon::parse($month)->subMonths(5) : Carbon::now()->subMonths(5);
            $endDate = $month ? Carbon::parse($month) : Carbon::now();

            for ($date = $startDate->copy(); $date <= $endDate; $date->addMonth()) {
                $monthKey = $date->format('Y-m');
                // ✅ استبعاد المشاريع المتفرعية من الإحصائيات
                $monthProjects = ProjectProposal::forStatistics()
                    ->where('status', 'وصل للمتبرع')
                    ->whereNotNull('montage_completed_date')
                    ->whereYear('montage_completed_date', $date->year)
                    ->whereMonth('montage_completed_date', $date->month);

                if ($projectType) {
                    $monthProjects->where('project_type', $projectType);
                }

                $monthCompleted = $monthProjects->count();
                $monthAvgDuration = 0;

                if ($monthCompleted > 0) {
                    // استخدام Query Builder مباشرة لحساب المتوسط
                    $avgResult = (clone $monthProjects)
                        ->selectRaw('AVG(DATEDIFF(montage_completed_date, montage_start_date)) as avg_duration')
                        ->first();
                    $monthAvgDuration = $avgResult && $avgResult->avg_duration ? round($avgResult->avg_duration, 2) : 0;
                }

                $monthlyTrend[] = [
                    'month' => $monthKey,
                    'completed_count' => $monthCompleted,
                    'average_duration' => $monthAvgDuration,
                ];
            }

            $reportData = [
                'month' => $month,
                'year' => $year,
                'project_type' => $projectType,
                'completed_count' => $completedCount,
                'average_duration' => $averageDuration,
                'delay_percentage' => $delayPercentage,
                'by_type' => $byType,
                'monthly_trend' => $monthlyTrend,
            ];

            return response()->json([
                'success' => true,
                'data' => $reportData
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب التقارير',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export projects to Excel with date and status filtering
     */
    public function export(Request $request)
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $statuses = $request->query('statuses');
        $projectType = $request->query('project_type');

        // التحقق من صحة التواريخ إذا تم إرسالها
        if ($startDate && !strtotime($startDate)) {
            return response()->json([
                'success' => false,
                'error' => 'تاريخ البداية غير صحيح',
                'message' => 'يجب أن يكون تاريخ البداية بصيغة صحيحة (YYYY-MM-DD)'
            ], 400);
        }

        if ($endDate && !strtotime($endDate)) {
            return response()->json([
                'success' => false,
                'error' => 'تاريخ النهاية غير صحيح',
                'message' => 'يجب أن يكون تاريخ النهاية بصيغة صحيحة (YYYY-MM-DD)'
            ], 400);
        }

        // التحقق من أن تاريخ البداية قبل تاريخ النهاية
        if ($startDate && $endDate && strtotime($startDate) > strtotime($endDate)) {
            return response()->json([
                'success' => false,
                'error' => 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
                'message' => 'الرجاء التحقق من التواريخ المدخلة'
            ], 400);
        }

        // معالجة الحالات - دعم مصفوفة أو قيمة واحدة أو قيم مفصولة بفواصل
        $statusArray = null;
        if ($statuses) {
            if (is_array($statuses)) {
                $statusArray = $statuses;
            } elseif (is_string($statuses)) {
                // محاولة تحليل JSON إذا كان مرسلاً كسلسلة
                $decoded = json_decode($statuses, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $statusArray = $decoded;
                } elseif (strpos($statuses, ',') !== false) {
                    // إذا كانت القيمة مفصولة بفواصل، قم بتقسيمها
                    $statusArray = array_map('trim', explode(',', $statuses));
                } else {
                    // إذا لم يكن JSON أو مفصول بفواصل، استخدمه كقيمة واحدة
                    $statusArray = [$statuses];
                }
            }
        }

        // أيضاً دعم status (مفرد) للتوافق مع الكود القديم
        $singleStatus = $request->query('status');
        if ($singleStatus && !$statusArray) {
            if ($singleStatus !== 'all' && $singleStatus !== 'الكل') {
                $statusArray = [$singleStatus];
            }
        }

        // التحقق من وجود مشاريع قبل التصدير
        $query = ProjectProposal::query();

        if ($startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        if ($statusArray && count($statusArray) > 0) {
            // إزالة القيم الفارغة
            $statusArray = array_filter($statusArray, function ($status) {
                return !empty($status) && $status !== 'all' && $status !== 'الكل';
            });

            if (count($statusArray) > 0) {
                $query->whereIn('status', $statusArray);
            }
        }

        if ($projectType) {
            $query->where('project_type', $projectType);
        }

        $projectsCount = $query->count();

        if ($projectsCount === 0) {
            return response()->json([
                'success' => false,
                'error' => 'لا يوجد مشاريع للتصدير',
                'message' => 'لا توجد مشاريع تطابق معايير الفلترة المحددة'
            ], 404);
        }

        // إنشاء اسم الملف بناءً على التواريخ والحالات
        $fileName = 'project_proposals';
        if ($startDate && $endDate) {
            $fileName .= '_' . $startDate . '_to_' . $endDate;
        } elseif ($startDate) {
            $fileName .= '_from_' . $startDate;
        } elseif ($endDate) {
            $fileName .= '_until_' . $endDate;
        }

        if ($statusArray && count($statusArray) > 0) {
            $statusStr = implode('_', array_map(function ($s) {
                return str_replace(' ', '_', $s);
            }, $statusArray));
            $fileName .= '_status_' . $statusStr;
        }

        if ($projectType) {
            $fileName .= '_type_' . str_replace(' ', '_', $projectType);
        }

        $fileName .= '.xlsx';

        try {
            return Excel::download(
                new ProjectProposalsExport($startDate, $endDate, $statusArray, $projectType),
                $fileName
            );
        } catch (\Exception $e) {
            Log::error('Error exporting project proposals to Excel: ' . $e->getMessage(), [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'statuses' => $statusArray,
                'project_type' => $projectType,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'فشل تصدير البيانات',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get project image
     */
    public function getProjectImage($id)
    {
        try {
            $project = ProjectProposal::findOrFail($id);

            // Get allowed origins from CORS config
            $allowedOrigins = config('cors.allowed_origins', []);
            $origin = request()->header('Origin');
            $corsOrigin = '*';

            // If origin is in allowed list, use it; otherwise use wildcard
            if ($origin && in_array($origin, $allowedOrigins)) {
                $corsOrigin = $origin;
            }

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
            // Get allowed origins from CORS config
            $allowedOrigins = config('cors.allowed_origins', []);
            $origin = request()->header('Origin');
            $corsOrigin = '*';

            if ($origin && in_array($origin, $allowedOrigins)) {
                $corsOrigin = $origin;
            }

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
     * Get notes image for a project
     */
    /**
     * ✅ عرض صورة ملاحظات المشروع - نفس منطق صور الأيتام تماماً
     * Based on OrphanController@show() pattern
     */
    public function getNotesImage($id)
    {
        try {
            // ✅ جلب CORS headers
            $allowedOrigins = config('cors.allowed_origins', []);
            $origin = request()->header('Origin');
            $corsOrigin = '*';

            if ($origin && in_array($origin, $allowedOrigins)) {
                $corsOrigin = $origin;
            } elseif ($origin && (str_contains($origin, 'forms.saiid.org') || str_contains($origin, 'saiid.org'))) {
                $corsOrigin = $origin;
            }

            // ✅ جلب المشروع بناءً على الـ ID (مع صور الملاحظات إن وُجدت)
            $project = ProjectProposal::with('noteImages')->findOrFail($id);

            // ✅ الحصول على أول صورة ملاحظات من الجدول الجديد إن وُجدت
            $firstNoteImage = $project->noteImages->first();
            $storedPath = $firstNoteImage?->image_path ?? $project->notes_image;

            // ✅ التحقق من وجود صورة ملاحظات
            // إذا لم تكن موجودة في الجدول الجديد ولا في الحقل القديم، إرجاع transparent placeholder (مثل صور الأيتام)
            if (empty($storedPath)) {
                $transparentPng = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
                return response($transparentPng, 200, [
                    'Content-Type' => 'image/png',
                    'Cache-Control' => 'no-cache, no-store, must-revalidate',
                    'Access-Control-Allow-Origin' => $corsOrigin,
                    'Access-Control-Allow-Methods' => 'GET, OPTIONS',
                    'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials' => 'true',
                ]);
            }

            $imagePath = null;
            $triedPaths = [];

            // ✅ استخدام المسار المخزن (من الجدول الجديد أو من الحقل القديم) إذا كان موجوداً
            if (!empty($storedPath)) {
                // ✅ إذا كان URL كامل، إرجاع redirect (دعم البيانات القديمة)
                if (str_starts_with($storedPath, 'http://') || str_starts_with($storedPath, 'https://')) {
                    return redirect($storedPath);
                }

                // ✅ إذا كان يبدأ بـ /، استخدمه مباشرة
                if (str_starts_with($storedPath, '/')) {
                    $imagePath = public_path($storedPath);
                    $triedPaths[] = $storedPath;
                } else {
                    // ✅ مسار نسبي
                    $imagePath = public_path($storedPath);
                    $triedPaths[] = $storedPath;
                }
            }

            // ✅ التحقق من وجود الملف
            if (!file_exists($imagePath)) {
                // ✅ محاولة أنواع مختلفة من الصور
                $extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                $found = false;

                if (!empty($storedPath)) {
                    $photoDir = dirname($storedPath);
                    $photoFileName = basename($storedPath, '.' . pathinfo($storedPath, PATHINFO_EXTENSION));

                    // محاولة البحث في نفس المجلد مع امتدادات مختلفة
                    foreach ($extensions as $ext) {
                        $testPath = public_path("{$photoDir}/{$photoFileName}.{$ext}");
                        $triedPaths[] = "{$photoDir}/{$photoFileName}.{$ext}";

                        if (file_exists($testPath)) {
                            $imagePath = $testPath;
                            $found = true;
                            break;
                        }
                    }
                }

                if (!$found) {
                    return response()->json([
                        'success' => false,
                        'error' => 'ملف الصورة غير موجود',
                        'message' => 'Image file not found',
                        'project_id' => $id,
                        'notes_image_from_db' => $project->notes_image ?? null,
                        'notes_image_from_table' => $firstNoteImage?->image_path ?? null,
                        'tried_paths' => array_unique($triedPaths)
                    ], 404)
                        ->header('Access-Control-Allow-Origin', $corsOrigin)
                        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                        ->header('Access-Control-Allow-Credentials', 'true');
                }
            }

            // ✅ تحديد Content-Type بناءً على امتداد الملف (نفس منطق الأيتام)
            $extension = strtolower(pathinfo($imagePath, PATHINFO_EXTENSION));
            $contentType = 'image/jpeg'; // افتراضي

            switch ($extension) {
                case 'png':
                    $contentType = 'image/png';
                    break;
                case 'gif':
                    $contentType = 'image/gif';
                    break;
                case 'webp':
                    $contentType = 'image/webp';
                    break;
                default:
                    $contentType = 'image/jpeg';
            }

            // ✅ التحقق من وجود معامل download في الـ request
            $shouldDownload = request()->has('download') || request()->get('download') === 'true';

            // ✅ إرجاع الصورة مع headers مناسبة (نفس منطق الأيتام تماماً)
            // ✅ تغيير Cache-Control لضمان تحديث الصورة بعد التعديل
            $headers = [
                'Content-Type' => $contentType,
                'Cache-Control' => 'no-cache, no-store, must-revalidate, private',
                'Pragma' => 'no-cache',
                'Expires' => '0',
                'Access-Control-Allow-Origin' => $corsOrigin,
                'Access-Control-Allow-Methods' => 'GET, OPTIONS',
                'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
                'Access-Control-Allow-Credentials' => 'true',
            ];

            // ✅ إذا كان download=true، أضف Content-Disposition للتحميل
            if ($shouldDownload) {
                $filename = basename($imagePath);
                // ✅ استخدام اسم المشروع في اسم الملف إذا كان متاحاً
                $projectName = $project->project_name ?? 'project';
                $projectName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $projectName);
                $downloadFilename = $projectName . '_' . $filename;
                $headers['Content-Disposition'] = 'attachment; filename="' . $downloadFilename . '"';
            }

            return response()->file($imagePath, $headers);
        } catch (\Exception $e) {
            \Log::error('Error loading project notes image: ' . $e->getMessage(), [
                'project_id' => $id,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'خطأ في الخادم',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ تحميل صورة ملاحظات المشروع (مع Content-Disposition: attachment)
     */
    public function downloadNotesImage($id)
    {
        // ✅ إضافة معامل download للـ request
        request()->merge(['download' => 'true']);
        // ✅ استدعاء getNotesImage مع معامل download
        return $this->getNotesImage($id);
    }

    /**
     * ✅ إعادة ترتيب صور ملاحظات المشروع (Reorder)
     * يستقبل مصفوفة IDs بالترتيب الجديد ويتحقق من أن كل صورة تعود لنفس المشروع ومن النوع note
     */
    public function reorderNoteImages(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'project_id' => 'required|integer|exists:project_proposals,id',
            'ordered_ids' => 'required|array|min:1',
            'ordered_ids.*' => 'integer|exists:project_proposal_images,id',
        ], [
            'project_id.required' => 'معرّف المشروع مطلوب',
            'project_id.exists' => 'المشروع المحدد غير موجود',
            'ordered_ids.required' => 'يجب إرسال مصفوفة معرفات الصور بالترتيب الجديد',
            'ordered_ids.array' => 'قائمة الصور يجب أن تكون مصفوفة',
            'ordered_ids.min' => 'يجب أن تحتوي قائمة الصور على عنصر واحد على الأقل',
            'ordered_ids.*.integer' => 'يجب أن يكون معرف الصورة رقماً صحيحاً',
            'ordered_ids.*.exists' => 'بعض معرفات الصور غير موجودة في قاعدة البيانات',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors(),
            ], 422);
        }

        $projectId = (int) $request->input('project_id');
        $orderedIds = $request->input('ordered_ids', []);

        try {
            $project = ProjectProposal::findOrFail($projectId);

            // جلب الصور التي تنتمي لهذا المشروع ومن النوع note فقط
            $images = ProjectProposalImage::query()
                ->where('project_proposal_id', $project->id)
                ->where('type', 'note')
                ->whereIn('id', $orderedIds)
                ->get();

            // أمان إضافي: التأكد أن كل ID يعود لنفس المشروع ونفس النوع
            $uniqueIdsFromDb = $images->pluck('id')->unique()->values()->all();
            $uniqueIdsFromRequest = array_values(array_unique($orderedIds));

            sort($uniqueIdsFromDb);
            sort($uniqueIdsFromRequest);

            if ($uniqueIdsFromDb !== $uniqueIdsFromRequest) {
                return response()->json([
                    'success' => false,
                    'error' => 'بعض الصور لا تعود لهذا المشروع أو ليست من نوع ملاحظات',
                ], 400);
            }

            // تحديث display_order حسب الترتيب الجديد
            foreach ($orderedIds as $index => $imageId) {
                $image = $images->firstWhere('id', $imageId);
                if ($image) {
                    $image->display_order = $index;
                    $image->save();
                }
            }

            // إعادة تحميل صور الملاحظات بالترتيب الجديد
            $project->load('noteImages');

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث ترتيب صور الملاحظات بنجاح',
                'note_images' => $project->noteImages->map(function (ProjectProposalImage $image) {
                    return [
                        'id' => $image->id,
                        'image_path' => $image->image_path,
                        'image_url' => $image->image_url,
                        'display_order' => $image->display_order,
                    ];
                }),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error reordering project note images', [
                'project_id' => $projectId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث ترتيب صور الملاحظات',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Helper: تجهيز اسم المشروع بناءً على المدخلات أو توليد اسم افتراضي
     */
    private function buildProjectName(?string $requestedName, ?string $donorCode, ?string $projectType, ?string $serialNumber = null): string
    {
        if ($requestedName) {
            return Str::limit(trim($requestedName), 255);
        }

        $parts = [];

        if ($donorCode) {
            $parts[] = trim($donorCode);
        }

        if ($projectType) {
            $parts[] = "مشروع {$projectType}";
        }

        if ($serialNumber) {
            $parts[] = "#{$serialNumber}";
        }

        if (empty($parts)) {
            $parts[] = 'مشروع جديد';
        }

        return Str::limit(implode(' - ', $parts), 255);
    }

    /**
     * Get daily phases for a project proposal
     * GET /api/project-proposals/{id}/daily-phases
     */
    public function getDailyPhases(Request $request, $id)
    {
        try {
            // جلب المشروع الأصلي
            $project = ProjectProposal::select([
                'id',
                'serial_number',
                'project_name',
                'donor_code',
                'internal_code',
                'is_divided_into_phases',
                'is_daily_phase'
            ])->findOrFail($id);

            // التحقق من أن المشروع مقسم على مراحل
            if (!$project->is_divided_into_phases || $project->is_daily_phase) {
                return response()->json([
                    'success' => false,
                    'error' => 'المشروع غير مقسم على مراحل يومية',
                    'message' => 'هذا المشروع ليس مشروعاً أصلياً مقسماً على مراحل يومية'
                ], 400);
            }

            // جلب المشاريع اليومية
            $dailyPhases = ProjectProposal::select([
                'id',
                'parent_project_id',
                'serial_number',
                'project_name',
                'donor_code',
                'internal_code',
                'status',
                'currency_id',
                'assigned_to_team_id',
                'assigned_photographer_id',
                'phase_day',
                'execution_date',
                'net_amount',
                'created_at',
                'updated_at'
            ])
                ->where('parent_project_id', $id)
                ->where('is_daily_phase', true)
                ->with([
                    'currency:id,currency_code,currency_name_ar,exchange_rate_to_usd',
                    'assignedToTeam' => function ($q) {
                        $q->select('id', 'team_name')->with(['activeMembers:id,name,phone_number']);
                    },
                    'photographer:id,name,phone_number'
                ])
                ->orderBy('phase_day', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'project' => [
                    'id' => $project->id,
                    'serial_number' => $project->serial_number,
                    'project_name' => $project->project_name,
                ],
                'daily_phases' => $dailyPhases,
                'count' => $dailyPhases->count()
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود',
                'message' => 'المشروع المطلوب غير موجود في قاعدة البيانات'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error fetching daily phases', [
                'project_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'حدث خطأ أثناء جلب المشاريع اليومية',
                'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ غير متوقع'
            ], 500);
        }
    }

    /**
     * Update beneficiaries count for a project (Project Manager & Executed Projects Coordinator)
     * PATCH /api/project-proposals/{id}/beneficiaries
     */
    public function updateBeneficiaries(Request $request, $id)
    {
        $user = $request->user();
        $this->refreshUser($user);
        $userRole = $this->getUserRole($user);

        // ✅ التحقق من الصلاحيات: Admin أو Project Manager أو Executed Projects Coordinator أو منسق الكفالة (لمشاريع الكفالات في مرحلة التوريد+)
        if (!$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_PROJECT_MANAGER, self::ROLE_EXECUTED_PROJECTS_COORDINATOR, self::ROLE_ORPHAN_SPONSOR_COORDINATOR])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لتحديث عدد المستفيدين. الصلاحيات: الإدارة، مدير المشاريع، رئيس قسم التنفيذ، أو منسق الكفالة (لمشاريع الكفالات في مرحلة التوريد وما يليها).');
        }

        $validator = Validator::make($request->all(), [
            'beneficiaries_count' => 'nullable|integer|min:0',
            'beneficiaries_per_unit' => 'nullable|integer|min:0',
        ], [
            'beneficiaries_count.integer' => 'عدد المستفيدين يجب أن يكون رقماً صحيحاً',
            'beneficiaries_count.min' => 'عدد المستفيدين لا يمكن أن يكون سالباً',
            'beneficiaries_per_unit.integer' => 'عدد المستفيدين لكل طرد يجب أن يكون رقماً صحيحاً',
            'beneficiaries_per_unit.min' => 'عدد المستفيدين لكل طرد لا يمكن أن يكون سالباً',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $project = ProjectProposal::findOrFail($id);

            // ✅ منسق الكفالة: السماح فقط لمشاريع الكفالات في مرحلة التوريد أو المراحل التي تليها
            if ($this->getUserRole($user) === self::ROLE_ORPHAN_SPONSOR_COORDINATOR) {
                if (!$project->isSponsorshipProject()) {
                    return $this->unauthorizedResponse('منسق الكفالة يمكنه تحديث عدد المستفيدين لمشاريع الكفالات فقط.');
                }
                $statusesSupplyOrLater = [
                    'قيد التوريد',
                    'تم التوريد',
                    'قيد التوزيع',
                    'مسند لباحث',
                    'جاهز للتنفيذ',
                    'قيد التنفيذ',
                    'مؤجل',
                    'تم التنفيذ',
                    'في المونتاج',
                    'تم المونتاج',
                    'يجب إعادة المونتاج',
                    'وصل للمتبرع',
                    'منتهي'
                ];
                if (!in_array($project->status, $statusesSupplyOrLater)) {
                    return $this->unauthorizedResponse(
                        'يمكن لمنسق الكفالة تعديل عدد المستفيدين فقط في مرحلة التوريد أو المراحل التي تليها. الحالة الحالية: ' . ($project->status ?? 'غير محددة') . '.'
                    );
                }
            }

            // Update beneficiaries fields
            if ($request->has('beneficiaries_count')) {
                $project->beneficiaries_count = $request->beneficiaries_count;
            }
            if ($request->has('beneficiaries_per_unit')) {
                $project->beneficiaries_per_unit = $request->beneficiaries_per_unit;
            }

            $project->save();

            // ✅ مسح cache للمشاريع بعد التحديث
            $this->clearProjectsCache();

            // ✅ مسح cache للمنفذين والمصورين (قد يتغيروا)
            $this->clearUsersCache();

            // Reload to get calculated_beneficiaries
            $project->refresh();

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث عدد المستفيدين بنجاح',
                'project' => [
                    'id' => $project->id,
                    'serial_number' => $project->serial_number,
                    'beneficiaries_count' => $project->beneficiaries_count,
                    'beneficiaries_per_unit' => $project->beneficiaries_per_unit,
                    'calculated_beneficiaries' => $project->calculated_beneficiaries,
                ]
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error updating beneficiaries: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث عدد المستفيدين',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * التحقق من أن المشروع الشهري في الشهر الحالي
     */
    private function isMonthlyPhaseInCurrentMonth($project, $currentMonthStart, $currentMonthEnd): bool
    {
        if (!$project->is_monthly_phase) {
            return false;
        }

        // إذا كان هناك month_start_date، استخدمه
        if (!empty($project->month_start_date)) {
            $date = Carbon::parse($project->month_start_date);
            return $date->gte($currentMonthStart) && $date->lte($currentMonthEnd);
        }

        // إذا كان هناك execution_date، استخدمه
        if (!empty($project->execution_date)) {
            $date = Carbon::parse($project->execution_date);
            return $date->gte($currentMonthStart) && $date->lte($currentMonthEnd);
        }

        // إذا لم يكن هناك تاريخ، نعتبره في الشهر الحالي (لأن Backend قد يكون قد فلتره)
        return true;
    }

    /**
     * التحقق من أن المشروع اليومي في النافذة الزمنية (اليوم + 3 أيام)
     */
    private function isDailyPhaseInWindow($project, $today, $threeDaysLater): bool
    {
        if (!$project->is_daily_phase) {
            return false;
        }

        // إذا كان هناك phase_day و parentProject.phase_start_date، احسب التاريخ
        if (!empty($project->phase_day) && $project->relationLoaded('parentProject') && $project->parentProject) {
            $parentProject = $project->parentProject;
            if (!empty($parentProject->phase_start_date)) {
                $phaseStartDate = Carbon::parse($parentProject->phase_start_date);
                $projectDate = $phaseStartDate->copy()->addDays($project->phase_day - 1);
                return $projectDate->gte($today) && $projectDate->lte($threeDaysLater);
            }
        }

        // إذا كان هناك execution_date، استخدمه
        if (!empty($project->execution_date)) {
            $date = Carbon::parse($project->execution_date);
            return $date->gte($today) && $date->lte($threeDaysLater);
        }

        // إذا لم يكن هناك تاريخ، نعتبره في النافذة (لأن Backend قد يكون قد فلتره)
        return true;
    }

    /**
     * مسح cache للمشاريع
     * يتم استدعاؤها عند تحديث أو حذف مشروع
     * ✅ يستخدم Service مركزي لإدارة cache
     */
    private function clearProjectsCache(): void
    {
        ProjectsCacheService::clearProjectsCache('ProjectProposalController');
    }

    /**
     * مسح cache محدد لقسم الإعلام فقط (أسرع من مسح كل الـ cache)
     */
    private function clearMediaCache(): void
    {
        // ✅ مسح cache Dashboard الإعلام
        $cacheKeys = [
            CacheService::buildKey('media_dashboard', ['user_id' => '*', 'role' => 'media_manager']),
            CacheService::buildKey('media_projects_needing_photographer', ['user_id' => '*']),
        ];

        // مسح cache باستخدام pattern (إذا كان مدعوماً)
        try {
            // محاولة مسح cache tags (إذا كان مدعوماً)
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['media_dashboard', 'media_projects'])->flush();
            } else {
                // مسح cache يدوياً للمستخدمين النشطين
                $mediaManagers = User::where('role', 'media_manager')->where('is_active', true)->pluck('id');
                foreach ($mediaManagers as $userId) {
                    Cache::forget(CacheService::buildKey('media_dashboard', [
                        'user_id' => $userId,
                        'role' => 'media_manager'
                    ]));
                    // مسح cache المشاريع التي تحتاج مصور (جميع الصفحات)
                    for ($page = 1; $page <= 10; $page++) {
                        Cache::forget(CacheService::buildKey('media_projects_needing_photographer', [
                            'user_id' => $userId,
                            'page' => $page,
                            'per_page' => 15,
                            'search' => ''
                        ]));
                    }
                }
            }
        } catch (\Exception $e) {
            // في حالة الفشل، استخدم الطريقة العادية
            $this->clearProjectsCache();
        }
    }

    /**
     * جلب المشاريع المنفذة لإدارة المستفيدين
     * Endpoint مخصص لمنسق المشاريع المنفذة
     */
    public function getExecutedProjectsForBeneficiaries(Request $request)
    {
        $user = $request->user();

        // ✅ التحقق من وجود المستخدم
        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'يجب تسجيل الدخول أولاً'
            ], 401);
        }

        // التحقق من الصلاحيات
        if (!$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_EXECUTED_PROJECTS_COORDINATOR])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لجلب المشاريع المنفذة');
        }

        try {
            // ✅ التحقق من صحة المعاملات
            $perPage = (int) $request->input('per_page', 10000);
            $page = (int) $request->input('page', 1);

            // ✅ تحديد الحد الأقصى لعدد الصفحات
            if ($perPage > 50000) {
                $perPage = 50000;
            }
            if ($perPage < 1) {
                $perPage = 10;
            }
            if ($page < 1) {
                $page = 1;
            }

            // الحالات المطلوبة للمشاريع المنفذة
            $executedStatuses = [
                self::STATUS_EXECUTED,
                'منفذ',
                self::STATUS_MONTAGE,
                self::STATUS_MONTAGE_COMPLETED,
                'معاد مونتاجه',
                self::STATUS_DELIVERED
            ];

            // ✅ استخدام query بسيط بدون JOIN معقد لتجنب مشاكل SQL
            $query = ProjectProposal::query()
                ->with([
                    'subcategory:id,name_ar',
                    'shelter:manager_id_number,camp_name',
                    'projectType:id,name',
                    // ✅ إضافة executedProject مع shelter للحصول على البيانات من جدول projects
                    'executedProject' => function ($q) {
                        $q->select('id', 'shelter_id', 'aid_type', 'source_project_id')
                            ->with(['shelter:manager_id_number,camp_name']);
                    }
                ]);

            // فلترة حسب نوع المشروع (اليومية، الشهرية، غير المقسمة)
            if ($this->getUserRole($user) === self::ROLE_EXECUTED_PROJECTS_COORDINATOR) {
                // ✅ للمشاريع المنفذة: المشاريع اليومية + الشهرية + غير المقسمة
                $query->where(function ($q) {
                    $q->where('is_daily_phase', true)
                        ->orWhere('is_monthly_phase', true)
                        ->orWhere(function ($nonDividedQ) {
                            $nonDividedQ->where('is_divided_into_phases', false)
                                ->orWhereNull('is_divided_into_phases');
                        });
                });
            }

            // فلترة حسب الحالة
            $query->whereIn('status', $executedStatuses);

            // ✅ البحث - تنظيف نص البحث
            if ($request->has('search') && $request->search) {
                $search = trim($request->search);
                if (!empty($search) && strlen($search) >= 2) {
                    $query->where(function ($q) use ($search) {
                        $q->where('project_name', 'like', "%{$search}%")
                            ->orWhere('serial_number', 'like', "%{$search}%")
                            ->orWhere('donor_code', 'like', "%{$search}%")
                            ->orWhere('internal_code', 'like', "%{$search}%");
                    });
                }
            }

            // الترتيب
            $query->orderBy('execution_date', 'desc')
                ->orderBy('created_at', 'desc');

            // ✅ معالجة الأخطاء المحتملة في pagination
            try {
                $projects = $query->paginate($perPage, ['*'], 'page', $page);
            } catch (\Exception $paginationError) {
                Log::warning('Pagination error in getExecutedProjectsForBeneficiaries', [
                    'error' => $paginationError->getMessage(),
                    'per_page' => $perPage,
                    'page' => $page
                ]);
                // ✅ محاولة pagination بمعاملات آمنة
                $projects = $query->paginate(100, ['*'], 'page', 1);
            }

            // ✅ التحقق من وجود نتائج
            if (!$projects || $projects->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'projects' => [],
                    'total' => 0,
                    'per_page' => $perPage,
                    'current_page' => $page,
                    'last_page' => 1,
                    'message' => 'لا توجد مشاريع منفذة متاحة'
                ], 200);
            }

            // ✅ تحويل البيانات لاستخدام اسم المخيم ونوع المساعدة
            // ✅ نستخدم العلاقات بدلاً من JOIN لتجنب مشاكل SQL
            $formattedProjects = $projects->getCollection()->map(function ($project) {
                try {
                    // ✅ جلب quantity بشكل صريح من attributes
                    $quantity = isset($project->quantity) ? (int)$project->quantity : 0;

                    // ✅ اسم المخيم: من العلاقات
                    $campName = null;
                    if ($project->shelter && $project->shelter->camp_name) {
                        // ✅ من العلاقة shelter
                        $campName = $project->shelter->camp_name;
                    } elseif ($project->executedProject && $project->executedProject->shelter) {
                        // ✅ من executedProject
                        $campName = $project->executedProject->shelter->camp_name;
                    }

                    // ✅ نوع المساعدة: من subcategory أو executedProject
                    $aidType = null;
                    if ($project->subcategory && $project->subcategory->name_ar) {
                        // ✅ من subcategory
                        $aidType = $project->subcategory->name_ar;
                    } elseif ($project->executedProject && $project->executedProject->aid_type) {
                        // ✅ من executedProject
                        $aidType = $project->executedProject->aid_type;
                    }

                    // ✅ معالجة execution_date بشكل آمن
                    $executionDate = null;
                    if ($project->execution_date) {
                        if (is_object($project->execution_date)) {
                            $executionDate = $project->execution_date->format('Y-m-d');
                        } elseif (is_string($project->execution_date)) {
                            $executionDate = $project->execution_date;
                        }
                    }

                    // ✅ معالجة التواريخ بشكل آمن
                    $formatDate = function ($date) {
                        if (!$date) return null;
                        if (is_object($date)) {
                            return $date->format('Y-m-d H:i:s');
                        }
                        return is_string($date) ? $date : null;
                    };

                    // ✅ إرجاع البيانات بشكل منظم لضمان ظهورها في الـ response
                    return [
                        'id' => $project->id ?? null,
                        'serial_number' => $project->serial_number ?? null,
                        'donor_code' => $project->donor_code ?? null,
                        'internal_code' => $project->internal_code ?? null,
                        'project_name' => $project->project_name ?? 'غير محدد',
                        'status' => $project->status ?? null,
                        'execution_date' => $executionDate,
                        'shelter_id' => $project->shelter_id ?? null,
                        'subcategory_id' => $project->subcategory_id ?? null,
                        'project_type_id' => $project->project_type_id ?? null,
                        'quantity' => $quantity,
                        'beneficiaries_excel_file' => $project->beneficiaries_excel_file ?? null,
                        'camp_name' => $campName ?: 'غير محدد',
                        'aid_type' => $aidType ?: 'غير محدد',
                        'shelter' => $project->shelter ? [
                            'manager_id_number' => $project->shelter->manager_id_number ?? null,
                            'camp_name' => $project->shelter->camp_name ?? null,
                        ] : null,
                        'subcategory' => $project->subcategory ? [
                            'id' => $project->subcategory->id ?? null,
                            'name_ar' => $project->subcategory->name_ar ?? null,
                            'name' => $project->subcategory->name ?? null,
                        ] : null,
                        'project_type' => $project->projectType ? [
                            'id' => $project->projectType->id ?? null,
                            'name' => $project->projectType->name ?? null,
                        ] : null,
                        'created_at' => $formatDate($project->created_at ?? null),
                        'updated_at' => $formatDate($project->updated_at ?? null),
                    ];
                } catch (\Exception $e) {
                    // ✅ تسجيل خطأ في معالجة مشروع واحد دون إيقاف العملية
                    Log::warning('Error formatting project in getExecutedProjectsForBeneficiaries', [
                        'project_id' => $project->id ?? 'unknown',
                        'error' => $e->getMessage()
                    ]);
                    return null;
                }
            })->filter(); // ✅ إزالة القيم null

            // ✅ التحقق من صحة البيانات قبل الإرجاع
            $projectsArray = $formattedProjects->values()->all();

            return response()->json([
                'success' => true,
                'projects' => $projectsArray,
                'total' => $projects->total(),
                'per_page' => $projects->perPage(),
                'current_page' => $projects->currentPage(),
                'last_page' => $projects->lastPage(),
            ], 200);
        } catch (\Illuminate\Database\QueryException $e) {
            // ✅ معالجة خاصة لأخطاء قاعدة البيانات
            Log::error('Database error in getExecutedProjectsForBeneficiaries', [
                'error' => $e->getMessage(),
                'sql' => $e->getSql() ?? null,
                'bindings' => $e->getBindings() ?? null,
                'user_id' => $user->id ?? null,
                'user_role' => $user->role ?? null
            ]);

            return response()->json([
                'success' => false,
                'error' => 'خطأ في قاعدة البيانات',
                'message' => config('app.debug')
                    ? 'خطأ في قاعدة البيانات: ' . $e->getMessage()
                    : 'حدث خطأ أثناء جلب المشاريع من قاعدة البيانات. يرجى المحاولة مرة أخرى.'
            ], 500);
        } catch (\Exception $e) {
            // ✅ معالجة عامة للأخطاء
            Log::error('Error fetching executed projects for beneficiaries', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'user_id' => $user->id ?? null,
                'user_role' => $user->role ?? null,
                'request_params' => $request->all()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'حدث خطأ أثناء جلب المشاريع',
                'message' => config('app.debug')
                    ? $e->getMessage()
                    : 'حدث خطأ أثناء جلب المشاريع. يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني.'
            ], 500);
        }
    }

    /**
     * مسح cache للمستخدمين (المنفذين والمصورين)
     */
    private function clearUsersCache(): void
    {
        try {
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags([self::CACHE_TAG_USERS, 'executors', 'photographers'])->flush();
            } else {
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    $redis = $cacheDriver->getRedis();
                    $patterns = ['*executors_list_*', '*photographers_list_*'];
                    foreach ($patterns as $pattern) {
                        $keys = $redis->keys($pattern);
                        if (!empty($keys)) {
                            $redis->del($keys);
                        }
                    }
                } else {
                    // Fallback: مسح cache يدوياً
                    Cache::forget('executors_list_' . (request()->user()?->id ?? 'guest'));
                    Cache::forget('photographers_list_' . (request()->user()?->id ?? 'guest'));
                }
            }
        } catch (\Exception $e) {
            Log::warning('Failed to clear users cache', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * مسح cache للفرق
     */
    private function clearTeamsCache(): void
    {
        try {
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags([self::CACHE_TAG_TEAMS])->flush();
            } else {
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    $redis = $cacheDriver->getRedis();
                    $keys = $redis->keys('*teams*');
                    if (!empty($keys)) {
                        $redis->del($keys);
                    }
                }
            }
        } catch (\Exception $e) {
            Log::warning('Failed to clear teams cache', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Advanced search for projects with multiple filters
     * Access: Admin and Project Manager only
     */
    public function advancedSearch(Request $request)
    {
        $user = $request->user();

        if (!$user || !$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_PROJECT_MANAGER])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات للوصول إلى البحث المتقدم. الصلاحيات مقتصرة على الإدارة ومدير المشاريع فقط.');
        }

        try {
            $query = ProjectProposal::query();

            // تطبيق الفلاتر من Service
            $this->service->applyAdvancedSearchFilters($query, $request);

            // ترتيب النتائج
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $allowedSortFields = ['created_at', 'updated_at', 'project_name', 'status', 'execution_date', 'montage_completed_date'];

            if (in_array($sortBy, $allowedSortFields)) {
                $query->orderBy($sortBy, $sortOrder === 'asc' ? 'asc' : 'desc');
            } else {
                $query->orderBy('created_at', 'desc');
            }

            // Pagination
            $perPage = min(max(1, (int) $request->get('per_page', 15)), 200);
            $page = max(1, (int) $request->get('page', 1));

            // تحميل العلاقات
            $query->with([
                'currency:id,currency_code,currency_name_ar',
                'shelter:manager_id_number,camp_name',
                'projectType:id,name',
                'subcategory:id,name_ar',
                'assignedToTeam:id,team_name',
                'assignedResearcher:id,name',
                'photographer:id,name',
                'assignedMontageProducer:id,name'
            ]);

            $projects = $query->paginate($perPage, ['*'], 'page', $page);
            $this->clearProjectsCache();

            return response()->json([
                'success' => true,
                'data' => [
                    'projects' => $projects->items(),
                    'pagination' => [
                        'current_page' => $projects->currentPage(),
                        'last_page' => $projects->lastPage(),
                        'per_page' => $projects->perPage(),
                        'total' => $projects->total(),
                        'from' => $projects->firstItem(),
                        'to' => $projects->lastItem(),
                    ]
                ]
            ], 200);
        } catch (\Exception $e) {
            Log::error('Advanced search error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id ?? null
            ]);

            return $this->errorResponse('خطأ في البحث', 'حدث خطأ أثناء البحث: ' . $e->getMessage(), 500, $e);
        }
    }

    /**
     * Get full project details with all relationships
     * Access: Admin and Project Manager only
     * 
     * Returns ALL database fields + computed fields + relationships
     * See PROJECT_PROPOSALS_FIELDS_DOCUMENTATION.md for field details
     */
    public function getFullProjectDetails(Request $request, $id)
    {
        $user = $request->user();

        // التحقق من الصلاحيات
        if (!$user) {
            return $this->unauthorizedResponse('يجب تسجيل الدخول أولاً');
        }

        if (!$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_PROJECT_MANAGER])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات للوصول إلى التفاصيل الكاملة. الصلاحيات مقتصرة على الإدارة ومدير المشاريع فقط.');
        }

        try {
            // ✅ جلب المشروع مع جميع العلاقات
            $project = ProjectProposal::with([
                'currency',
                'shelter',
                'projectType',
                'subcategory',
                'assignedToTeam',
                'assignedResearcher',
                'photographer',
                'assignedMontageProducer',
                'assignedBy',
                'creator',
                'parentProject',
                'executedProject',
                'surplusRecorder',
                'surplusCategory',
                'sponsoredOrphans' // ✅ إضافة الأيتام المكفولين
            ])->find($id);

            if (!$project) {
                return response()->json([
                    'success' => false,
                    'error' => 'المشروع غير موجود',
                    'message' => 'المشروع المطلوب غير موجود في قاعدة البيانات'
                ], 404);
            }

            // جلب Timeline
            $timeline = $project->timeline()->with('changedBy:id,name')->orderBy('created_at', 'desc')->get();

            // جلب المراحل اليومية إن وجدت
            $dailyPhases = [];
            if ($project->is_divided_into_phases && $project->phase_type === self::PHASE_TYPE_DAILY) {
                $dailyPhases = ProjectProposal::where('parent_project_id', $project->id)
                    ->where('is_daily_phase', true)
                    ->with(['currency', 'shelter'])
                    ->orderBy('phase_day', 'asc')
                    ->get();
            }

            // جلب المراحل الشهرية إن وجدت
            $monthlyPhases = [];
            if ($project->is_divided_into_phases && $project->phase_type === self::PHASE_TYPE_MONTHLY) {
                $monthlyPhases = ProjectProposal::where('parent_project_id', $project->id)
                    ->where('is_monthly_phase', true)
                    ->with(['currency', 'shelter', 'sponsoredOrphans'])
                    ->orderBy('month_number', 'asc')
                    ->get();
            }

            // ✅ جلب أصناف المستودع
            $warehouseItems = $project->warehouseItems()
                ->with('warehouseItem') // ✅ العلاقة الصحيحة من النموذج
                ->get();

            // ✅ معلومات إضافية مفيدة للإدارة المتقدمة
            $additionalInfo = [
                'has_warehouse_items' => $warehouseItems->isNotEmpty(),
                'confirmed_warehouse_items_count' => $project->confirmedWarehouseItems()->count(),
                'pending_warehouse_items_count' => $project->pendingWarehouseItems()->count(),
                'has_beneficiaries_file' => $project->hasBeneficiariesFile(),
                'beneficiaries_count_from_db' => $project->beneficiaries()->count(),
                'is_parent_project' => $project->isParentProject(),
                'is_sponsorship_project' => $project->isSponsorshipProject(),
                'has_surplus_recorded' => !is_null($project->surplus_recorded_at),
                'has_shekel_conversion' => $project->hasShekelConversion(),
                'days_since_creation' => $project->getDaysSinceCreation(),
                'days_since_assignment' => $project->getDaysSinceAssignment(),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'project' => $project, // ✅ يحتوي على جميع الحقول الحقيقية + المحسوبة + العلاقات
                    'timeline' => $timeline,
                    'daily_phases' => $dailyPhases,
                    'monthly_phases' => $monthlyPhases,
                    'warehouse_items' => $warehouseItems,
                    'additional_info' => $additionalInfo,
                ]
            ], 200);
        } catch (\Exception $e) {
            Log::error('Get full project details error', [
                'project_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id ?? null
            ]);

            return $this->errorResponse(
                'خطأ في جلب التفاصيل',
                'حدث خطأ أثناء جلب تفاصيل المشروع: ' . $e->getMessage(),
                500,
                $e
            );
        }
    }

    /**
     * Advanced update - allows updating any field and nullifying fields
     * Access: Admin and Project Manager only
     */
    public function advancedUpdate(Request $request, $id)
    {
        $user = $request->user();

        if (!$user || !$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_PROJECT_MANAGER])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات للتحديث المتقدم. الصلاحيات مقتصرة على الإدارة ومدير المشاريع فقط.');
        }

        try {
            DB::beginTransaction();

            $project = ProjectProposal::findOrFail($id);
            $oldStatus = $project->status;

            // معالجة البيانات من Service
            $updateData = $this->service->processAdvancedUpdateData($request, $project);

            // ✅ تنظيف البيانات عند تغيير الحالة إلى حالة سابقة
            if (isset($updateData['status']) && $updateData['status'] !== $oldStatus) {
                $cleanupData = $this->service->cleanDataForStatusRevert($updateData['status'], $project);

                // ✅ حذف warehouse items وإرجاعها للمخزن إذا لزم الأمر
                if (isset($cleanupData['_delete_warehouse_items']) && $cleanupData['_delete_warehouse_items']) {
                    $project->load(['confirmedWarehouseItems.warehouseItem']);
                    if ($project->confirmedWarehouseItems->isNotEmpty()) {
                        foreach ($project->confirmedWarehouseItems as $item) {
                            if ($item->warehouseItem) {
                                $totalNeeded = $item->quantity_per_unit * ($project->quantity ?? 1);
                                $item->warehouseItem->addQuantity($totalNeeded, $user->id);
                            }
                        }
                    }
                    // حذف جميع warehouse items
                    $project->warehouseItems()->delete();
                    unset($cleanupData['_delete_warehouse_items']);
                }

                $updateData = array_merge($updateData, $cleanupData);
            }

            // تحديث المشروع
            if (!empty($updateData)) {
                if (isset($updateData['status'])) {
                    DB::table('project_proposals')->where('id', $project->id)->update($updateData);
                    $project->refresh();

                    if ($oldStatus !== $updateData['status']) {
                        $note = $request->input('status_change_note', 'تم تغيير الحالة من لوحة الإدارة المتقدمة');
                        $project->recordStatusChange($oldStatus, $updateData['status'], $user->id, $note);
                    }
                } else {
                    $project->update($updateData);
                    // إعادة تحميل المشروع لضمان الحصول على القيم المحدثة
                    $project->refresh();
                }
            }

            DB::commit();

            // ✅ تحديث المشاريع الفرعية تلقائياً إذا كان هذا مشروع أصلي
            if ($project->isParentProject() && !empty($updateData)) {
                // تحديد الحقول التي تم تحديثها
                $updatedFields = array_keys($updateData);
                // إضافة project_name إذا تم تحديثه
                if ($request->has('project_name')) {
                    $updatedFields[] = 'project_name';
                }
                // إضافة phase_duration_days إذا تم تحديثه (للمشاريع اليومية)
                // التحقق من وجوده في updateData أو في request
                if (isset($updateData['phase_duration_days']) || $request->has('phase_duration_days')) {
                    if (!in_array('phase_duration_days', $updatedFields)) {
                        $updatedFields[] = 'phase_duration_days';
                    }
                }
                // إضافة phase_start_date إذا تم تحديثه (للمشاريع اليومية)
                // التحقق من وجوده في updateData أو في request
                if (isset($updateData['phase_start_date']) || $request->has('phase_start_date')) {
                    if (!in_array('phase_start_date', $updatedFields)) {
                        $updatedFields[] = 'phase_start_date';
                    }
                }
                // تحديث المشاريع الفرعية (يجب أن يكون بعد refresh)
                $project->updateChildProjects($updatedFields);
            }

            $this->clearProjectsCache();
            $project->load([
                'currency',
                'shelter',
                'projectType',
                'subcategory',
                'assignedToTeam',
                'assignedResearcher',
                'photographer',
                'assignedMontageProducer',
                'assignedBy',
                'creator'
            ]);

            Log::info('Advanced update completed', [
                'project_id' => $id,
                'user_id' => $user->id,
                'updated_fields' => array_keys($updateData)
            ]);

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث المشروع بنجاح',
                'data' => $project
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود',
                'message' => 'المشروع المطلوب غير موجود في قاعدة البيانات'
            ], 404);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Advanced update error', [
                'project_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id ?? null
            ]);

            return $this->errorResponse('خطأ في التحديث', 'حدث خطأ أثناء تحديث المشروع: ' . $e->getMessage(), 500, $e);
        }
    }

    /**
     * Change project status to any available status
     * Access: Admin and Project Manager only
     */
    public function changeStatus(Request $request, $id)
    {
        $user = $request->user();

        // التحقق من الصلاحيات
        if (!$user) {
            return $this->unauthorizedResponse('يجب تسجيل الدخول أولاً');
        }

        if (!$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_PROJECT_MANAGER])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لتغيير حالة المشروع. الصلاحيات مقتصرة على الإدارة ومدير المشاريع فقط.');
        }

        // قائمة الحالات المتاحة
        $availableStatuses = [
            'جديد',
            'قيد التوريد',
            'تم التوريد',
            'قيد التوزيع',
            'مسند لباحث',
            'جاهز للتنفيذ',
            'تم اختيار المخيم',
            'قيد التنفيذ',
            'تم التنفيذ',
            'في المونتاج',
            'تم المونتاج',
            'يجب إعادة المونتاج',
            'وصل للمتبرع',
            'منتهي',
            'ملغى',
            'مؤجل'
        ];

        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:' . implode(',', $availableStatuses),
            'note' => 'nullable|string|max:1000',
        ], [
            'status.required' => 'الحالة مطلوبة',
            'status.in' => 'الحالة المحددة غير صحيحة',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $project = ProjectProposal::findOrFail($id);
            $oldStatus = $project->status;
            $newStatus = $request->input('status');
            $note = $request->input('note', 'تم تغيير الحالة من لوحة الإدارة المتقدمة');

            // ✅ تنظيف البيانات عند الرجوع إلى حالة سابقة
            $cleanupData = $this->service->cleanDataForStatusRevert($newStatus, $project);

            // ✅ حذف warehouse items وإرجاعها للمخزن إذا لزم الأمر
            if (isset($cleanupData['_delete_warehouse_items']) && $cleanupData['_delete_warehouse_items']) {
                $project->load(['confirmedWarehouseItems.warehouseItem']);
                if ($project->confirmedWarehouseItems->isNotEmpty()) {
                    foreach ($project->confirmedWarehouseItems as $item) {
                        if ($item->warehouseItem) {
                            $totalNeeded = $item->quantity_per_unit * ($project->quantity ?? 1);
                            $item->warehouseItem->addQuantity($totalNeeded, $user->id);
                        }
                    }
                }
                // حذف جميع warehouse items
                $project->warehouseItems()->delete();
                unset($cleanupData['_delete_warehouse_items']);
            }

            // تحديث الحالة والتواريخ المرتبطة من Service
            $updateData = array_merge(
                ['status' => $newStatus],
                $this->service->getStatusDateUpdates($newStatus, $project),
                $cleanupData // ✅ إضافة البيانات المراد حذفها
            );

            // تحديث المشروع
            DB::table('project_proposals')
                ->where('id', $project->id)
                ->update($updateData);

            // إعادة تحميل المشروع
            $project->refresh();

            // تسجيل تغيير الحالة في Timeline
            if ($oldStatus !== $newStatus) {
                $project->recordStatusChange($oldStatus, $newStatus, $user->id, $note);
            }

            DB::commit();

            // مسح cache
            $this->clearProjectsCache();

            // إعادة تحميل العلاقات
            $project->load([
                'currency',
                'shelter',
                'projectType',
                'subcategory',
                'assignedToTeam',
                'assignedResearcher',
                'photographer',
                'assignedMontageProducer'
            ]);

            Log::info('Status changed via advanced management', [
                'project_id' => $id,
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'user_id' => $user->id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'تم تغيير حالة المشروع بنجاح',
                'data' => [
                    'project' => $project,
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus
                ]
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود',
                'message' => 'المشروع المطلوب غير موجود في قاعدة البيانات'
            ], 404);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Change status error', [
                'project_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id ?? null
            ]);

            return $this->errorResponse(
                'خطأ في تغيير الحالة',
                'حدث خطأ أثناء تغيير حالة المشروع: ' . $e->getMessage(),
                500,
                $e
            );
        }
    }

    /**
     * Add orphans to sponsorship project
     * POST /api/project-proposals/{id}/orphans
     */
    public function addOrphansToProject(Request $request, $id)
    {
        $user = $request->user();

        // التحقق من الصلاحيات
        if (!$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_ORPHAN_SPONSOR_COORDINATOR])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لإضافة أيتام للمشروع');
        }

        $validator = Validator::make($request->all(), [
            'orphan_ids' => 'required|array|min:1',
            'orphan_ids.*' => 'required|string|exists:orphans,orphan_id_number',
            'is_recurring' => 'nullable|boolean',
        ], [
            'orphan_ids.required' => 'يرجى اختيار الأيتام',
            'orphan_ids.array' => 'يجب أن تكون قائمة الأيتام مصفوفة',
            'orphan_ids.min' => 'يجب اختيار يتيم واحد على الأقل',
            'orphan_ids.*.required' => 'رقم هوية اليتيم مطلوب',
            'orphan_ids.*.exists' => 'اليتيم المحدد غير موجود في قاعدة البيانات',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $project = ProjectProposal::findOrFail($id);

            // التحقق من أن المشروع هو مشروع كفالة
            if (!$project->isSponsorshipProject()) {
                return response()->json([
                    'success' => false,
                    'error' => 'المشروع ليس مشروع كفالة',
                    'message' => 'يمكن إضافة الأيتام فقط لمشاريع الكفالات'
                ], 422);
            }

            // التحقق من حالة المشروع (بعد "تم التوريد" أو "مسند لباحث")
            $allowedStatuses = ['جديد', 'تم التوريد', 'مسند لباحث'];
            if (!in_array($project->status, $allowedStatuses)) {
                return response()->json([
                    'success' => false,
                    'error' => 'حالة المشروع غير صحيحة',
                    'message' => 'يمكن إضافة الأيتام فقط للمشاريع في حالة "جديد" أو "تم التوريد" أو "مسند لباحث"',
                    'current_status' => $project->status
                ], 422);
            }

            // التحقق من وجود الأيتام في قاعدة البيانات
            $orphanIds = $request->orphan_ids;
            $existingOrphans = Orphan::whereIn('orphan_id_number', $orphanIds)->pluck('orphan_id_number');
            $missingOrphans = array_diff($orphanIds, $existingOrphans->toArray());

            if (!empty($missingOrphans)) {
                return response()->json([
                    'success' => false,
                    'error' => 'بعض الأيتام غير موجودين',
                    'message' => 'الأيتام التالية غير موجودين في قاعدة البيانات: ' . implode(', ', $missingOrphans),
                    'missing_orphans' => $missingOrphans
                ], 422);
            }

            DB::beginTransaction();

            $isRecurring = $request->boolean('is_recurring', false);
            $addedCount = 0;
            $skippedCount = 0;

            // ✅ تحديد المشروع المستهدف: إذا كان مشروع شهري و is_recurring=true، نضيف للمشروع الأصلي
            $targetProject = $project;
            if ($isRecurring && $project->is_monthly_phase && $project->parent_project_id) {
                // إذا كان مشروع شهري و is_recurring=true، نضيف للمشروع الأصلي
                $targetProject = ProjectProposal::find($project->parent_project_id);
                if (!$targetProject) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'error' => 'المشروع الأصلي غير موجود',
                        'message' => 'لا يمكن إضافة يتيم ثابت - المشروع الأصلي غير موجود'
                    ], 404);
                }
            }

            foreach ($orphanIds as $orphanId) {
                // التحقق من أن اليتيم غير موجود بالفعل في المشروع المستهدف
                // ✅ إصلاح: التحقق مباشرة من pivot table لتجنب غموض orphan_id_number
                $exists = DB::table('orphan_project_proposals')
                    ->where('project_proposal_id', $targetProject->id)
                    ->where('orphan_id_number', $orphanId)
                    ->exists();

                if ($exists) {
                    $skippedCount++;
                    continue;
                }

                // إضافة اليتيم للمشروع المستهدف
                $targetProject->sponsoredOrphans()->attach($orphanId, [
                    'is_recurring' => $isRecurring,
                    'sponsorship_start_date' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $addedCount++;
            }

            // ✅ إذا كان المشروع مقسم شهرياً و is_recurring=true، إضافة الأيتام للمشاريع الشهرية
            // ملاحظة: syncRecurringOrphansToMonthlyPhases() يضيف الأيتام لجميع المشاريع الشهرية تلقائياً
            if ($isRecurring && $targetProject->is_divided_into_phases && $targetProject->phase_type === 'monthly') {
                $targetProject->syncRecurringOrphansToMonthlyPhases();

                // ✅ إذا كان المشروع الحالي هو مشروع شهري، إضافة اليتيم له مباشرة أيضاً
                // (لضمان ظهوره فوراً حتى لو لم يكن موجوداً في قائمة المشاريع الشهرية عند الاستدعاء)
                if ($project->is_monthly_phase && $project->parent_project_id === $targetProject->id) {
                    foreach ($orphanIds as $orphanId) {
                        $exists = DB::table('orphan_project_proposals')
                            ->where('project_proposal_id', $project->id)
                            ->where('orphan_id_number', $orphanId)
                            ->exists();

                        if (!$exists) {
                            $project->sponsoredOrphans()->attach($orphanId, [
                                'is_recurring' => true,
                                'sponsorship_start_date' => now(),
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                        }
                    }
                }
            }

            DB::commit();

            // مسح cache
            $this->clearProjectsCache();

            // إعادة تحميل المشروع مع الأيتام
            $project->load('sponsoredOrphans');

            return response()->json([
                'success' => true,
                'message' => "تم إضافة {$addedCount} يتيم بنجاح" . ($skippedCount > 0 ? " (تم تخطي {$skippedCount} يتيم موجود مسبقاً)" : ''),
                'project' => $project,
                'added_count' => $addedCount,
                'skipped_count' => $skippedCount,
                'total_orphans' => $project->sponsoredOrphans()->count()
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error adding orphans to project', [
                'project_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return $this->errorResponse(
                'خطأ في إضافة الأيتام',
                'حدث خطأ أثناء إضافة الأيتام للمشروع: ' . $e->getMessage(),
                500,
                $e
            );
        }
    }

    /**
     * Remove orphan from sponsorship project
     * DELETE /api/project-proposals/{id}/orphans/{orphanId}
     */
    public function removeOrphanFromProject(Request $request, $id, $orphanId)
    {
        $user = $request->user();

        // التحقق من الصلاحيات
        if (!$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_ORPHAN_SPONSOR_COORDINATOR])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لإزالة يتيم من المشروع');
        }

        try {
            $project = ProjectProposal::findOrFail($id);

            // التحقق من أن المشروع هو مشروع كفالة
            if (!$project->isSponsorshipProject()) {
                return response()->json([
                    'success' => false,
                    'error' => 'المشروع ليس مشروع كفالة',
                    'message' => 'يمكن إزالة الأيتام فقط من مشاريع الكفالات'
                ], 422);
            }

            // التحقق من وجود اليتيم في المشروع
            // ✅ إصلاح: التحقق مباشرة من pivot table لتجنب غموض orphan_id_number
            $exists = DB::table('orphan_project_proposals')
                ->where('project_proposal_id', $project->id)
                ->where('orphan_id_number', $orphanId)
                ->exists();

            if (!$exists) {
                return response()->json([
                    'success' => false,
                    'error' => 'اليتيم غير موجود',
                    'message' => 'اليتيم المحدد غير موجود في هذا المشروع'
                ], 404);
            }

            DB::beginTransaction();

            // إزالة اليتيم من المشروع
            $project->sponsoredOrphans()->detach($orphanId);

            DB::commit();

            // مسح cache
            $this->clearProjectsCache();

            // إعادة تحميل المشروع
            $project->load('sponsoredOrphans');

            return response()->json([
                'success' => true,
                'message' => 'تم إزالة اليتيم من المشروع بنجاح',
                'project' => $project,
                'total_orphans' => $project->sponsoredOrphans()->count()
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error removing orphan from project', [
                'project_id' => $id,
                'orphan_id' => $orphanId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return $this->errorResponse(
                'خطأ في إزالة اليتيم',
                'حدث خطأ أثناء إزالة اليتيم من المشروع: ' . $e->getMessage(),
                500,
                $e
            );
        }
    }

    /**
     * Get sponsored orphans for a project
     * GET /api/project-proposals/{id}/orphans
     */
    public function getProjectOrphans(Request $request, $id)
    {
        $user = $request->user();

        // التحقق من الصلاحيات
        if (!$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_ORPHAN_SPONSOR_COORDINATOR, self::ROLE_EXECUTED_PROJECTS_COORDINATOR])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لعرض الأيتام المكفولين');
        }

        try {
            $project = ProjectProposal::with('sponsoredOrphans')->findOrFail($id);

            return response()->json([
                'success' => true,
                'project_id' => $project->id,
                'project_name' => $project->project_name,
                'orphans' => $project->sponsoredOrphans,
                'total_count' => $project->sponsoredOrphans()->count(),
                'recurring_count' => $project->recurringOrphans()->count()
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error getting project orphans', [
                'project_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return $this->errorResponse(
                'خطأ في جلب الأيتام',
                'حدث خطأ أثناء جلب الأيتام المكفولين: ' . $e->getMessage(),
                500,
                $e
            );
        }
    }

    /**
     * Get sponsorship projects for an orphan
     * GET /api/orphans/{orphanId}/projects
     */
    public function getOrphanProjects(Request $request, $orphanId)
    {
        $user = $request->user();

        // التحقق من الصلاحيات
        if (!$this->hasRole($user, [self::ROLE_ADMIN, self::ROLE_ORPHAN_SPONSOR_COORDINATOR])) {
            return $this->unauthorizedResponse('ليس لديك صلاحيات لعرض مشاريع الكفالة ليتيم');
        }

        try {
            $orphan = Orphan::findOrFail($orphanId);

            $projects = $orphan->sponsoredProjects()
                ->with(['currency', 'projectType', 'subcategory'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'orphan' => [
                    'orphan_id_number' => $orphan->orphan_id_number,
                    'orphan_full_name' => $orphan->orphan_full_name,
                ],
                'projects' => $projects,
                'total_count' => $projects->count()
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error getting orphan projects', [
                'orphan_id' => $orphanId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return $this->errorResponse(
                'خطأ في جلب المشاريع',
                'حدث خطأ أثناء جلب مشاريع الكفالة: ' . $e->getMessage(),
                500,
                $e
            );
        }
    }
}
