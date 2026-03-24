<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AidController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\OrphanController;
use App\Http\Controllers\RefugeeController;
use App\Http\Controllers\ShelterController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\TeacherController;
use App\Http\Controllers\EmploymentController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\StatisticsController;
use App\Http\Controllers\FormAvailabilityController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\OrphanMedicalTreatmentController;
use App\Http\Controllers\CurrencyController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\ProjectProposalController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\TeamPersonnelController;
use App\Http\Controllers\WarehouseController;
use App\Http\Controllers\ProjectWarehouseController;
use App\Http\Controllers\ProjectSurplusController;
use App\Http\Controllers\SurplusCategoryController;
use App\Http\Controllers\MediaArchiveController;
use App\Http\Controllers\ProjectSubcategoryController;
use App\Http\Controllers\ProjectTypeController;
use App\Http\Controllers\MontageProducerController;
use App\Http\Controllers\MontageProducerProjectsController;
use App\Http\Controllers\BeneficiaryController;
use App\Http\Controllers\SupervisionController;
use App\Http\Controllers\OrphanExportController;
 

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// ✅ Health check endpoint - يجب أن يكون أول route لتحسين cold start
Route::get('/health', function () {
    try {
        // ✅ اختبار بسيط للاتصال بقاعدة البيانات
        \DB::connection()->getPdo();
        $dbStatus = 'connected';
    } catch (\Exception $e) {
        $dbStatus = 'disconnected';
    }
    
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toIso8601String(),
        'database' => $dbStatus,
        'version' => '1.0.0'
    ], 200);
});

// ✅ OPTIONS للـ CORS preflight (تسجيل الدخول/الخروج) - ضروري عند طلب API من localhost أو نطاق آخر
$corsPreflight = function () {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    $corsOrigin = '*';
    if ($origin) {
        if (in_array($origin, $allowedOrigins)) {
            $corsOrigin = $origin;
        } elseif (str_contains($origin, 'forms.saiid.org') || str_contains($origin, 'saiid.org') || str_contains($origin, 'localhost') || str_contains($origin, '127.0.0.1')) {
            $corsOrigin = $origin;
        }
    }
    return response('', 204)
        ->header('Access-Control-Allow-Origin', $corsOrigin)
        ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match')
        ->header('Access-Control-Allow-Credentials', 'true')
        ->header('Access-Control-Max-Age', '86400');
};
Route::options('/login', $corsPreflight);
Route::options('/logout', $corsPreflight);
// ✅ OPTIONS صريح لتحديث المشروع وتحديث عدد المستفيدين — يضمن إرجاع PATCH في CORS حتى مع كاش قديم على الخادم
Route::options('/project-proposals/{id}/beneficiaries', $corsPreflight);
Route::options('/project-proposals/{id}', $corsPreflight);

// ✅ Static images routes with CORS support (يجب أن تكون في البداية قبل أي middleware)
// ✅ OPTIONS route للـ CORS preflight - يجب أن يكون في البداية جداً
Route::options('/project_notes_images/{filename}', function () {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    
    $corsOrigin = '*';
    if ($origin) {
        if (in_array($origin, $allowedOrigins)) {
            $corsOrigin = $origin;
        } elseif (str_contains($origin, 'forms.saiid.org') || str_contains($origin, 'saiid.org')) {
            $corsOrigin = $origin;
        } elseif (str_contains($origin, 'localhost') || str_contains($origin, '127.0.0.1')) {
            // ✅ دعم localhost للـ development
            $corsOrigin = $origin;
        }
    }
    
    return response('', 200, [
        'Access-Control-Allow-Origin' => $corsOrigin,
        'Access-Control-Allow-Methods' => 'GET, OPTIONS, HEAD',
        'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match',
        'Access-Control-Allow-Credentials' => 'true',
        'Access-Control-Max-Age' => '86400',
    ]);
})->where('filename', '[^\/]+');

// ✅ GET route للصور
Route::get('/project_notes_images/{filename}', function ($filename) {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    
    // ✅ تحديد CORS Origin - استخدم Origin المطلوب إذا كان في القائمة
    $corsOrigin = '*';
    
    if ($origin) {
        // ✅ إذا كان Origin في القائمة المسموحة، استخدمه
        if (in_array($origin, $allowedOrigins)) {
            $corsOrigin = $origin;
        } else {
            // ✅ للـ production، استخدم Origin المطلوب إذا كان forms.saiid.org
            if (str_contains($origin, 'forms.saiid.org') || str_contains($origin, 'saiid.org')) {
                $corsOrigin = $origin;
            } elseif (str_contains($origin, 'localhost') || str_contains($origin, '127.0.0.1')) {
                // ✅ دعم localhost للـ development
                $corsOrigin = $origin;
            }
        }
    }
    
    // ✅ إذا كان OPTIONS request (preflight)، إرجاع headers فقط
    if (request()->isMethod('OPTIONS')) {
        \Illuminate\Support\Facades\Log::info('OPTIONS request for project notes image', [
            'origin' => $origin,
            'cors_origin' => $corsOrigin,
            'request_url' => request()->fullUrl(),
        ]);
        
        return response('', 200, [
            'Access-Control-Allow-Origin' => $corsOrigin,
            'Access-Control-Allow-Methods' => 'GET, OPTIONS, HEAD',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match',
            'Access-Control-Allow-Credentials' => 'true',
            'Access-Control-Max-Age' => '86400',
        ]);
    }
    
    // ✅ GET request - إرجاع الملف
    \Illuminate\Support\Facades\Log::info('Project notes image request', [
        'filename' => $filename,
        'request_url' => request()->fullUrl(),
        'request_method' => request()->method(),
    ]);
    
    try {
        // تنظيف اسم الملف من أي مسارات خطيرة
        $filename = basename($filename);
        
        // ✅ Logging بعد تنظيف اسم الملف
        \Illuminate\Support\Facades\Log::info('Filename after basename', ['filename' => $filename]);
        
        // التحقق من أن اسم الملف صحيح
        if (empty($filename)) {
            \Illuminate\Support\Facades\Log::warning('Empty filename');
            return response()->json([
                'success' => false,
                'error' => 'اسم الملف غير صحيح'
            ], 400)
                ->header('Access-Control-Allow-Origin', $corsOrigin)
                ->header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match')
                ->header('Access-Control-Allow-Credentials', 'true');
        }
        
        // ✅ التحقق من وجود مسارات خطيرة
        if (preg_match('/[\/\\\\]/', $filename)) {
            \Illuminate\Support\Facades\Log::warning('Invalid filename with path separators', ['filename' => $filename]);
            return response()->json([
                'success' => false,
                'error' => 'اسم الملف غير صحيح'
            ], 400)
                ->header('Access-Control-Allow-Origin', $corsOrigin)
                ->header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match')
                ->header('Access-Control-Allow-Credentials', 'true');
        }
        
        $filePath = public_path('project_notes_images/' . $filename);
        
        // ✅ Logging للمسار
        \Illuminate\Support\Facades\Log::info('Checking file path', [
            'file_path' => $filePath,
            'public_path' => public_path(),
            'directory_exists' => is_dir(public_path('project_notes_images')),
            'file_exists' => file_exists($filePath),
            'is_file' => is_file($filePath),
        ]);
        
        // التحقق من وجود الملف
        if (!file_exists($filePath)) {
            \Illuminate\Support\Facades\Log::warning('File not found', [
                'file_path' => $filePath,
                'directory_listing' => is_dir(public_path('project_notes_images')) ? 
                    array_slice(scandir(public_path('project_notes_images')), 2) : 'directory not found'
            ]);
            return response()->json([
                'success' => false,
                'error' => 'الصورة غير موجودة',
                'path' => $filePath,
                'debug' => config('app.debug') ? [
                    'filename' => $filename,
                    'file_path' => $filePath,
                    'public_path' => public_path(),
                    'directory_exists' => is_dir(public_path('project_notes_images')),
                ] : null
            ], 404)
                ->header('Access-Control-Allow-Origin', $corsOrigin)
                ->header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match')
                ->header('Access-Control-Allow-Credentials', 'true');
        }
        
        // التحقق من أن الملف ليس مجلد
        if (!is_file($filePath)) {
            \Illuminate\Support\Facades\Log::warning('Path is not a file', ['file_path' => $filePath]);
            return response()->json([
                'success' => false,
                'error' => 'المسار المحدد ليس ملف'
            ], 400)
                ->header('Access-Control-Allow-Origin', $corsOrigin)
                ->header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match')
                ->header('Access-Control-Allow-Credentials', 'true');
        }
        
        // تحديد نوع الملف
        $mimeType = mime_content_type($filePath);
        if (!$mimeType) {
            // Fallback: تحديد النوع من الامتداد
            $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            $mimeTypes = [
                'jpg' => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'png' => 'image/png',
                'gif' => 'image/gif',
                'webp' => 'image/webp'
            ];
            $mimeType = $mimeTypes[$extension] ?? 'image/jpeg';
        }
        
        // ✅ Logging قبل إرجاع الملف
        \Illuminate\Support\Facades\Log::info('Serving file', [
            'filename' => $filename,
            'mime_type' => $mimeType,
            'file_size' => filesize($filePath),
            'cors_origin' => $corsOrigin,
        ]);
        
        // ✅ استخدام response()->make() لضمان إرسال CORS headers بشكل صحيح
        // ✅ تحسين cache headers للصور (1 سنة + ETag)
        $fileSize = filesize($filePath);
        $fileContent = file_get_contents($filePath);
        $etag = md5($filePath . '_' . $fileSize . '_' . filemtime($filePath));
        
        // ✅ التحقق من If-None-Match header
        $ifNoneMatch = request()->header('If-None-Match');
        if ($ifNoneMatch && trim($ifNoneMatch, '"') === $etag) {
            return response('', 304, [
                'ETag' => '"' . $etag . '"',
                'Cache-Control' => 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin' => $corsOrigin,
            ]);
        }
        
        return response()->make($fileContent, 200, [
            'Content-Type' => $mimeType,
            'Content-Length' => $fileSize,
            'Cache-Control' => 'public, max-age=31536000, immutable', // ✅ immutable للصور الثابتة
            'ETag' => '"' . $etag . '"',
            'Last-Modified' => gmdate('D, d M Y H:i:s', filemtime($filePath)) . ' GMT',
            'Access-Control-Allow-Origin' => $corsOrigin,
            'Access-Control-Allow-Methods' => 'GET, OPTIONS, HEAD',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match',
            'Access-Control-Allow-Credentials' => 'true',
            'Access-Control-Max-Age' => '86400',
        ]);
            
    } catch (\Exception $e) {
        \Illuminate\Support\Facades\Log::error('Error serving project notes image', [
            'filename' => $filename,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]);
    
        return response()->json([
            'success' => false,
            'error' => 'حدث خطأ أثناء جلب الصورة',
            'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ غير متوقع'
        ], 500)
            ->header('Access-Control-Allow-Origin', $corsOrigin)
            ->header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match')
            ->header('Access-Control-Allow-Credentials', 'true');
    }
})->where('filename', '[^\/]+');

// Authentication routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login'])->name('login');

// Public form creation routes
Route::post('/aids', [AidController::class, 'create']);
Route::post('/increment-visitor-aids-count', [AidController::class, 'incrementVisitorCount']);

// Orphan public routes
Route::post('/orphans', [OrphanController::class, 'create']);
Route::post('/increment-visitor-orphans-count', [OrphanController::class, 'incrementVisitorCount']);
Route::get('/orphans/check-availability', [OrphanController::class, 'checkAvailability']); // Check form availability

Route::post('/teachers', [TeacherController::class, 'create']);
Route::post('/increment-visitor-teachers-count', [TeacherController::class, 'incrementVisitorCount']);

Route::post('/students', [StudentController::class, 'create']);
Route::post('/increment-visitor-students-count', [StudentController::class, 'incrementVisitorCount']);

Route::post('/employments', [EmploymentController::class, 'create']);

Route::post('/shelters', [ShelterController::class, 'create']);
Route::post('/increment-visitor-shelters-count', [ShelterController::class, 'incrementVisitorCount']);

Route::post('/patients', [PatientController::class, 'create']);

Route::post('/refugees/import', [ShelterController::class, 'importRefugees']);

// Orphan Medical Treatment public routes
Route::post('/orphan-medical-treatments', [OrphanMedicalTreatmentController::class, 'create']);
Route::get('/orphan-medical-treatments/check/{orphan_id_number}', [OrphanMedicalTreatmentController::class, 'checkOrphanRegistration']);

// Public export routes (accessible by form users without auth)
Route::get('/orphans/{id}/export-pdf', [OrphanExportController::class, 'exportOrphanPdf']);
Route::get('/orphans/{id}/export-word', [OrphanExportController::class, 'exportOrphanWord']);

// Protected routes (require authentication)
Route::middleware('auth:sanctum')->group(function () {
    // Orphan management routes
    Route::get('/orphans', [OrphanController::class, 'fetchOrphans']);
    Route::get('/orphans/dashboard', [OrphanController::class, 'fetchAllOrphansForDashboard']);
    Route::get('/orphans/export', [OrphanController::class, 'exportOrphansToExcel']);
    Route::get('/orphan-groupings/export-all-excel', [OrphanExportController::class, 'exportAllGroupsExcel']);
    // Route::delete('/orphans/{id}', [OrphanController::class, 'destroy']); // Delete orphan


    // Aid management routes
    Route::get('/aids', [AidController::class, 'fetchAids']);
    Route::get('/aids/dashboard', [AidController::class, 'fetchAllAidsForDashboard']);
    Route::get('/aids/export', [AidController::class, 'exportAidsToExcel']);

    // Student management routes
    Route::get('/students', [StudentController::class, 'fetchStudents']);
    Route::get('/students/export', [StudentController::class, 'exportStudentToExcel']);
    Route::get('/students/dashboard', [StudentController::class, 'fetchAllStudentsForDashboard']);

    // Teacher management routes
    Route::get('/teachers', [TeacherController::class, 'fetchTeachers']);
    Route::get('/teachers/export', [TeacherController::class, 'exportTeacherToExcel']);
    Route::get('/teachers/dashboard', [TeacherController::class, 'fetchAllTeachersForDashboard']);

    // Employment management routes
    Route::get('/employments', [EmploymentController::class, 'fetchEmployments']);
    Route::get('/employments/export', [EmploymentController::class, 'exportEmploymentToExcel']);
    Route::get('/employments/dashboard', [EmploymentController::class, 'fetchAllEmploymentsForDashboard']);

    // Refugee and shelter management routes
    Route::get('/refugees/export', [ShelterController::class, 'exportRefugeesToExcel']);
    Route::get('/shelters', [ShelterController::class, 'fetchShelters']);
    Route::get('/shelters/dashboard', [ShelterController::class, 'fetchAllSheltersForDashboard']);
    Route::get('/shelters/{id}/benefits', [ShelterController::class, 'getShelterBenefits']);

    // Patient management routes
    Route::get('/patients', [PatientController::class, 'fetchPatients']);
    Route::get('/patients/export', [PatientController::class, 'exportPatientsToExcel']);
    Route::get('/patients/dashboard', [PatientController::class, 'fetchAllPatientsForDashboard']);

    // Project management routes
    Route::get('/projects', [ProjectController::class, 'fetchProjects']);
    Route::get('/projects/dashboard', [ProjectController::class, 'fetchAllProjectsForDashboard']);
    Route::get('/projects/export', [ProjectController::class, 'exportProjectsToExcel']);
    Route::get('/projects/{id}', [ProjectController::class, 'show']);
    
    // ✅ إضافة مشروع: Admin و Executed Projects Coordinator
    // Note: Permission check is done in controller method
    Route::post('/projects', [ProjectController::class, 'create']);
    
    // تعديل المشاريع المنفذة: Admin و Executed Projects Coordinator
    Route::middleware(['auth:sanctum', 'role:admin,executed_projects_coordinator'])->group(function () {
        Route::patch('/projects/{id}', [ProjectController::class, 'update']);
        Route::patch('/projects/{id}/satisfaction', [ProjectController::class, 'updateShelterSatisfaction']);
    });
    
    Route::delete('/projects/{id}', [ProjectController::class, 'destroy']);
    Route::get('/shelters/list', [ProjectController::class, 'getSheltersList']);

    // Orphan Medical Treatment management routes
    Route::get('/orphan-medical-treatments', [OrphanMedicalTreatmentController::class, 'fetchOrphanMedicalTreatments']);
    Route::get('/orphan-medical-treatments/dashboard', [OrphanMedicalTreatmentController::class, 'fetchAllForDashboard']);
    Route::get('/orphan-medical-treatments/export', [OrphanMedicalTreatmentController::class, 'exportToExcel']);

    // ==================== Project Management System Routes ====================
    
    // ==================== Public Routes (لكل المستخدمين المسجلين) ====================
    // Currency Routes - قراءة فقط
    Route::get('/currencies', [CurrencyController::class, 'index']);
    Route::post('/currencies/calculate-usd', [CurrencyController::class, 'calculateUSD']);
    Route::get('/currencies/last-update-info', [CurrencyController::class, 'getLastUpdateInfo']);
    
    // Team Routes - قراءة فقط
    Route::get('/teams', [TeamController::class, 'index']);
    Route::get('/photographers', [TeamController::class, 'photographers']);
    Route::get('/teams/available-members', [TeamController::class, 'getAvailableMembers']); // ✅ جلب الباحثين والمصورين المتاحين
    
    // Team Personnel Routes - قراءة فقط
    Route::get('/researchers', [TeamPersonnelController::class, 'getResearchers']);
    Route::get('/photographers-list', [TeamPersonnelController::class, 'getPhotographers']);
    Route::get('/team-personnel/available', [TeamPersonnelController::class, 'getAvailablePersonnel']);
    
    // Project Proposal Routes - قراءة فقط (مفلترة حسب الدور تلقائياً)
    // ✅ استخدام rate limiting محدد لتجنب 429 Too Many Requests
    Route::middleware('throttle:project-proposals')->group(function () {
        Route::get('/project-proposals', [ProjectProposalController::class, 'index']);
        // ✅ Route للاختبار والتشخيص
        Route::get('/project-proposals/debug-data', function() {
            try {
                $project = \App\Models\ProjectProposal::with([
                    'currency', 'shelter', 'assignedResearcher', 'photographer', 'assignedToTeam'
                ])->find(480);
                
                if (!$project) {
                    return response()->json(['error' => 'المشروع غير موجود'], 404);
                }
                
                return response()->json([
                    'success' => true,
                    'message' => 'اختبار البيانات',
                    'project_id' => $project->id,
                    'fields_check' => [
                        'donor_name' => $project->donor_name ?: 'NULL',
                        'project_description' => $project->project_description ? 'موجود (' . strlen($project->project_description) . ' حرف)' : 'NULL',
                        'donation_amount' => $project->donation_amount ?: 'NULL',
                        'net_amount' => $project->net_amount ?: 'NULL',
                        'currency' => $project->currency ? 'محملة' : 'NULL',
                        'shelter' => $project->shelter ? 'محمل' : 'NULL',
                    ],
                    'full_project' => $project->toArray(),
                ]);
            } catch (\Exception $e) {
                return response()->json(['error' => $e->getMessage()], 500);
            }
        });
        // ✅ Routes الثابتة يجب أن تأتي قبل Routes الديناميكية {id}
        Route::get('/project-proposals/executed-for-beneficiaries', [ProjectProposalController::class, 'getExecutedProjectsForBeneficiaries'])
            ->middleware(['auth:sanctum', 'role:admin,executed_projects_coordinator']);
        Route::get('/project-proposals/export', [ProjectProposalController::class, 'export']);
        // ✅ Routes الثابتة الأخرى (يجب أن تأتي قبل {id})
        Route::get('/project-proposals/new-projects-needing-photographer', [ProjectProposalController::class, 'getNewProjectsNeedingPhotographer'])
            ->middleware(['auth:sanctum', 'role:media_manager,admin']);
        // ✅ Routes الديناميكية {id} - يجب أن تأتي بعد Routes الثابتة
        Route::get('/project-proposals/{id}', [ProjectProposalController::class, 'show']);
        Route::get('/project-proposals/{id}/timeline', [ProjectProposalController::class, 'getTimeline']);
        Route::get('/project-proposals/{id}/daily-phases', [ProjectProposalController::class, 'getDailyPhases']);
    });
    
    // Project Types Routes - قراءة فقط
    // ✅ استخدام rate limiting محدد لتجنب 429 Too Many Requests
    Route::middleware('throttle:project-metadata')->group(function () {
        Route::get('/project-types', [ProjectTypeController::class, 'index']);
        Route::get('/project-types/{id}', [ProjectTypeController::class, 'show']);
    });
    
    // Project Subcategories Routes - قراءة فقط
    // ✅ استخدام rate limiting محدد لتجنب 429 Too Many Requests
    Route::middleware('throttle:project-metadata')->group(function () {
        Route::get('/project-subcategories', [ProjectSubcategoryController::class, 'index']);
        Route::get('/project-subcategories/by-type/{type}', [ProjectSubcategoryController::class, 'getByProjectType']);
        Route::get('/project-subcategories/{id}', [ProjectSubcategoryController::class, 'show']);
    });
    Route::get('/project-subcategories/{id}/statistics', [ProjectSubcategoryController::class, 'getStatistics']);
    
    // Notification Routes
    // ✅ استخدام rate limiter خاص للـ notifications لتجنب 429 Too Many Requests
    Route::middleware(['throttle:notifications'])->group(function () {
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::post('/notifications/{id}/accept', [NotificationController::class, 'accept']);
        Route::post('/notifications/{id}/reply', [NotificationController::class, 'reply']);
        Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
    });
    
    // User Management Routes - قراءة فقط
    Route::get('/users', [UserManagementController::class, 'index']); // ✅ جلب جميع المستخدمين
    Route::get('/executors', [UserManagementController::class, 'getExecutors']);
    Route::get('/photographers-list', [UserManagementController::class, 'getPhotographers']);
    Route::get('/users/by-role/{role}', [UserManagementController::class, 'getUsersByRole']);
    
    // ==================== Admin Only Routes ====================
    Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
        // Dashboard - Admin and Executed Projects Coordinator
        // Note: Permission check is done in controller method
        Route::get('/project-proposals-dashboard', [ProjectProposalController::class, 'dashboard']);
        
        // إنشاء/حذف مشروع (Admin only)
        Route::post('/project-proposals', [ProjectProposalController::class, 'create']);
        Route::delete('/project-proposals/{id}', [ProjectProposalController::class, 'destroy']);
        
        // تحويل المشروع إلى "منتهي" (Admin only)
        Route::post('/project-proposals/{id}/mark-as-completed', [ProjectProposalController::class, 'markAsCompleted']);
        
        // إدارة العملات
        Route::post('/currencies', [CurrencyController::class, 'store']); // ✅ إضافة عملة جديدة
        // ✅ Routes الثابتة قبل Routes الديناميكية
        Route::post('/currencies/update-all-from-api', [CurrencyController::class, 'updateAllRatesFromAPI']);
        Route::post('/currencies/update-all', [CurrencyController::class, 'updateAllRatesFromAPI']); // ✅ Route إضافي للتوافق مع Frontend
        // ✅ Routes الديناميكية
        Route::patch('/currencies/{id}', [CurrencyController::class, 'update']);
        Route::patch('/currencies/{id}/toggle-status', [CurrencyController::class, 'toggleStatus']);
        Route::post('/currencies/{id}/update-from-api', [CurrencyController::class, 'updateSingleRateFromAPI']);
        
        // إدارة المستخدمين
        Route::patch('/users/{id}', [UserManagementController::class, 'updateUser']);
        Route::patch('/users/{id}/toggle-status', [UserManagementController::class, 'toggleUserStatus']);
        
        // إدارة أنواع المشاريع (Admin only)
        Route::post('/project-types', [ProjectTypeController::class, 'store']);
        Route::patch('/project-types/{id}', [ProjectTypeController::class, 'update']);
        Route::delete('/project-types/{id}', [ProjectTypeController::class, 'destroy']);
        
        // إدارة التفريعات (Admin only)
        Route::post('/project-subcategories', [ProjectSubcategoryController::class, 'store']);
        Route::patch('/project-subcategories/{id}', [ProjectSubcategoryController::class, 'update']);
        Route::delete('/project-subcategories/{id}', [ProjectSubcategoryController::class, 'destroy']);
        Route::patch('/project-subcategories/{id}/toggle-status', [ProjectSubcategoryController::class, 'toggleStatus']);
    });
    
    // ==================== Advanced Management Routes (Admin & Project Manager) ====================
    Route::middleware(['auth:sanctum', 'role:admin,project_manager'])->group(function () {
        // البحث المتقدم للمشاريع
        Route::get('/admin/project-proposals/advanced-search', [ProjectProposalController::class, 'advancedSearch']);
        
        // جلب التفاصيل الكاملة للمشروع
        Route::get('/admin/project-proposals/{id}/full-details', [ProjectProposalController::class, 'getFullProjectDetails']);
        
        // التحديث المتقدم (يسمح بإفراغ الحقول)
        Route::patch('/admin/project-proposals/{id}/advanced-update', [ProjectProposalController::class, 'advancedUpdate']);
        
        // تغيير الحالة لأي حالة متاحة
        Route::post('/admin/project-proposals/{id}/change-status', [ProjectProposalController::class, 'changeStatus']);
    });
    
    // ==================== Project Manager Routes ====================
    Route::middleware(['auth:sanctum', 'role:project_manager,media_manager,admin,orphan_sponsor_coordinator,supervision'])->group(function () {
        // ✅ تحديث حالة التنفيذ (من "قيد التنفيذ" إلى "تم التنفيذ")
        // ✅ الصلاحيات: مدير المشاريع، مدير الإعلام، والإدارة، منسق الكفالة
        Route::post('/project-proposals/{id}/update-execution-status', [ProjectProposalController::class, 'updateExecutionStatus']);
        // توزيع المشاريع
        Route::post('/project-proposals/{id}/assign', [ProjectProposalController::class, 'assignProject']);
        Route::post('/project-proposals/{id}/return-to-supply', [ProjectProposalController::class, 'returnToSupply']);
        
        // تأجيل واستئناف المشاريع
        Route::post('/project-proposals/{id}/postpone', [ProjectProposalController::class, 'postponeProject']);
        Route::post('/project-proposals/{id}/resume', [ProjectProposalController::class, 'resumeProject']);
        
        // إدارة الفرق
        Route::post('/teams', [TeamController::class, 'store']);
        Route::patch('/teams/{id}', [TeamController::class, 'update']);
        Route::delete('/teams/{id}', [TeamController::class, 'destroy']);
        Route::post('/teams/{teamId}/members', [TeamController::class, 'addMember']);
        Route::post('/teams/{teamId}/members/bulk', [TeamController::class, 'addMultipleMembers']); // ✅ إضافة عدة أعضاء دفعة واحدة
        Route::delete('/teams/{teamId}/members/{personnelId}', [TeamController::class, 'removeMember']);
        Route::get('/teams/{teamId}/members-by-type', [TeamController::class, 'getTeamMembersByType']); // ✅ جلب أعضاء الفريق حسب النوع
        
        // إدارة الباحثين والمصورين
        Route::post('/researchers', [TeamPersonnelController::class, 'addResearcher']);
        Route::patch('/team-personnel/{id}', [TeamPersonnelController::class, 'update']);
        Route::delete('/team-personnel/{id}', [TeamPersonnelController::class, 'destroy']);
        
        // نقل المشروع لمرحلة التوريد
        Route::post('/project-proposals/{id}/move-to-supply', [ProjectProposalController::class, 'moveToSupply']);
        
        // تحويل المبلغ للشيكل
        Route::post('/project-proposals/{id}/convert-to-shekel', [ProjectProposalController::class, 'convertToShekel']);
        
        // Shopping Cart - سلة التسوق للمشروع
        // ✅ استخدام rate limiter خاص للـ warehouse لتجنب 429 Too Many Requests
        Route::middleware(['throttle:warehouse'])->group(function () {
            Route::prefix('projects/{projectId}/warehouse')->group(function () {
                Route::get('/', [ProjectWarehouseController::class, 'getProjectCart']);
                Route::post('/items', [ProjectWarehouseController::class, 'addItemToProject']);
                Route::delete('/items/{itemId}', [ProjectWarehouseController::class, 'removeItemFromProject']);
                Route::patch('/items/{itemId}', [ProjectWarehouseController::class, 'updateItemQuantity']);
                Route::patch('/quantity', [ProjectWarehouseController::class, 'updateProjectQuantity']);
                Route::patch('/surplus-category', [ProjectWarehouseController::class, 'updateSurplusCategory']); // ✅ حفظ صندوق الفائض قبل التأكيد
                Route::post('/confirm', [ProjectWarehouseController::class, 'confirmProjectSupply']);
                Route::post('/cancel', [ProjectWarehouseController::class, 'cancelProjectSupply']);
                Route::post('/edit', [ProjectWarehouseController::class, 'editConfirmedSupply']); // تعديل التوريد المؤكد
            });
        });
        
        // Surplus Management - إدارة الوافر
        Route::get('/surplus/dashboard', [ProjectSurplusController::class, 'getSurplusDashboard']);
        Route::get('/surplus/report', [ProjectSurplusController::class, 'getSurplusReport']);
        Route::get('/projects/{projectId}/surplus', [ProjectSurplusController::class, 'getProjectSurplus']);
        Route::patch('/projects/{projectId}/surplus', [ProjectSurplusController::class, 'updateSurplus']);
        
        // Surplus Categories - أقسام الوافر
        Route::get('/surplus-categories', [SurplusCategoryController::class, 'index']);
        Route::get('/surplus-categories/statistics/all', [SurplusCategoryController::class, 'getAllStatistics']);
        Route::get('/surplus-categories/{id}', [SurplusCategoryController::class, 'show']);
        Route::get('/surplus-categories/{id}/balance', [SurplusCategoryController::class, 'getCategoryBalance']);
        Route::post('/surplus-categories', [SurplusCategoryController::class, 'store']);
        Route::patch('/surplus-categories/{id}', [SurplusCategoryController::class, 'update']);
        Route::patch('/surplus-categories/{id}/toggle-status', [SurplusCategoryController::class, 'toggleStatus']);
        Route::delete('/surplus-categories/{id}', [SurplusCategoryController::class, 'destroy']);
    });
    
    // ==================== Warehouse Manager & Admin Routes ====================
    Route::middleware(['auth:sanctum', 'role:warehouse_manager,admin'])->group(function () {
        Route::prefix('warehouse')->group(function () {
            Route::post('/', [WarehouseController::class, 'store']);
            Route::patch('/{id}', [WarehouseController::class, 'update']);
            Route::delete('/{id}', [WarehouseController::class, 'destroy']);
            Route::post('/{id}/add-quantity', [WarehouseController::class, 'addQuantity']);
            Route::post('/{id}/subtract-quantity', [WarehouseController::class, 'subtractQuantity']);
        });
    });
    
    // ==================== Shared Warehouse Read-Only Routes ====================
    // ✅ إضافة orphan_sponsor_coordinator للوصول إلى warehouse endpoints (لإدارة مشاريع الكفالات)
    // ✅ استخدام rate limiter خاص للـ warehouse لتجنب 429 Too Many Requests
    Route::middleware(['auth:sanctum', 'role:admin,project_manager,warehouse_manager,orphan_sponsor_coordinator', 'throttle:warehouse'])->group(function () {
        Route::get('/warehouse', [WarehouseController::class, 'index']);
        Route::get('/warehouse/dashboard', [WarehouseController::class, 'dashboard']);
        // ⚠️ مهم: الـ Routes الثابتة يجب أن تأتي قبل الـ Routes الديناميكية {id}
        Route::get('/warehouse/available', [WarehouseController::class, 'getAvailableItems']);
        Route::get('/warehouse/{id}', [WarehouseController::class, 'show']);
    });
    
    // ==================== Shared Routes (Project Manager & Media Manager) ====================
    Route::middleware(['auth:sanctum', 'role:project_manager,media_manager,admin'])->group(function () {
        // إدارة المصورين (مشترك بين Project Manager و Media Manager)
        Route::post('/photographers-management', [TeamPersonnelController::class, 'addPhotographer']);
    });
    
    // ==================== Shared Routes (Project Manager & Executed Projects Coordinator & Orphan Sponsor Coordinator) ====================
    // ✅ منسق الكفالة: يمكنه تحديث عدد المستفيدين لمشاريع الكفالات فقط في مرحلة التوريد أو ما يليها
    Route::middleware(['auth:sanctum', 'role:project_manager,executed_projects_coordinator,admin,orphan_sponsor_coordinator'])->group(function () {
        // تحديث عدد المستفيدين (مدير المشاريع، رئيس قسم التنفيذ، منسق الكفالة لمشاريع الكفالات في مرحلة التوريد+)
        Route::patch('/project-proposals/{id}/beneficiaries', [ProjectProposalController::class, 'updateBeneficiaries']);
        
        // ✅ تحديث مشروع (للسماح بتحديث beneficiaries عبر update endpoint أيضاً)
        // دعم PATCH و PUT للتوافق مع Frontend
        Route::match(['patch', 'put'], '/project-proposals/{id}', [ProjectProposalController::class, 'update']);
    });

    // ==================== Orphan Sponsor Coordinator - Update Projects ====================
    // ✅ منسق الكفالة يمكنه تحديث مشاريع الكفالات
    Route::middleware(['auth:sanctum', 'role:orphan_sponsor_coordinator,admin'])->group(function () {
        Route::match(['patch', 'put'], '/project-proposals/{id}', [ProjectProposalController::class, 'update']);
    });
    
    // ==================== Montage Producers Read-Only Routes (Admin & Project Manager) ====================
    // ✅ إضافة routes للقراءة فقط لـ Admin و Project Manager للوصول من صفحة الإدارة المتقدمة
    Route::middleware(['auth:sanctum', 'role:admin,project_manager'])->group(function () {
        Route::prefix('montage-producers')->group(function () {
            Route::get('/list', [MontageProducerController::class, 'list']); // قائمة بسيطة للقائمة المنسدلة
            Route::get('/', [MontageProducerController::class, 'index']); // قائمة كاملة مع pagination
        });
    });
    
    // ==================== Media Manager Routes ====================
    Route::middleware(['auth:sanctum', 'role:media_manager,admin'])->group(function () {
        // Dashboard والتقارير
        Route::get('/project-proposals/media-dashboard', [ProjectProposalController::class, 'mediaDashboard']);
        Route::get('/project-proposals/media-reports', [ProjectProposalController::class, 'mediaReports']);
        
        // ✅ المشاريع الجديدة التي تحتاج إسناد مصور - تم نقله قبل {id} route لتجنب 404
        // ✅ إسناد مصور لعدة مشاريع دفعة واحدة (يجب أن يكون قبل route الـ {id})
        Route::post('/project-proposals/bulk-assign-photographer', [ProjectProposalController::class, 'bulkAssignPhotographer']);
        
        // إسناد المصور للمشروع
        Route::post('/project-proposals/{id}/assign-photographer', [ProjectProposalController::class, 'assignPhotographer']);
        
        // تحديث حالة المونتاج
        Route::post('/project-proposals/{id}/update-media-status', [ProjectProposalController::class, 'updateMediaStatus']);
        
        // إسناد ممنتج مونتاج لمشروع
        Route::post('/project-proposals/{id}/assign-montage-producer', [ProjectProposalController::class, 'assignMontageProducer']);
        
        // ✅ Batch operations - العمليات الجماعية
        Route::post('/project-proposals/batch-update-status', [ProjectProposalController::class, 'batchUpdateStatus']);
        Route::post('/project-proposals/batch-assign-producer', [ProjectProposalController::class, 'batchAssignProducer']);
        
        // إشعارات الإعلام
        Route::get('/notifications/media', [NotificationController::class, 'getMediaNotifications']);
        
        // إدارة ممنتجي المونتاج (كتابة وتعديل وحذف)
        Route::prefix('montage-producers')->group(function () {
            // ✅ Routes الثابتة يجب أن تأتي قبل Routes الديناميكية {id}
            Route::get('/list', [MontageProducerController::class, 'list']); // قائمة بسيطة للقائمة المنسدلة
            Route::get('/', [MontageProducerController::class, 'index']); // قائمة كاملة مع pagination
            Route::get('/daily-report', [MontageProducerController::class, 'getDailyReport']);
            
            Route::post('/', [MontageProducerController::class, 'store']);
            // ✅ Routes الديناميكية {id} - يجب أن تأتي بعد Routes الثابتة
            Route::get('/{id}', [MontageProducerController::class, 'show']);
            Route::put('/{id}', [MontageProducerController::class, 'update']);
            Route::delete('/{id}', [MontageProducerController::class, 'destroy']);
            Route::get('/{id}/projects', [MontageProducerController::class, 'getMontageProducerProjects']);
        });
        
        // إدارة المصورين (يستخدم نفس الـ endpoint مثل Project Manager)
        // Route::post('/photographers-management', [TeamPersonnelController::class, 'addPhotographer']); // ✅ تم نقله لـ Project Manager
        
        // أرشفة المواد
        Route::prefix('media-archives')->group(function () {
            Route::get('/', [MediaArchiveController::class, 'index']);
            Route::get('/available-projects', [MediaArchiveController::class, 'getProjectsForArchive']);
            Route::post('/', [MediaArchiveController::class, 'store']);
            Route::get('/{id}', [MediaArchiveController::class, 'show']);
            Route::put('/{id}', [MediaArchiveController::class, 'update']);
            Route::delete('/{id}', [MediaArchiveController::class, 'destroy']);
        });
    });
    
    // ==================== Executed Projects Coordinator Routes ====================
    Route::middleware(['auth:sanctum', 'role:executed_projects_coordinator,admin'])->group(function () {
        // اختيار المخيم ونقل للتنفيذ
        Route::post('/project-proposals/{id}/select-shelter', [ProjectProposalController::class, 'selectShelter']);
        Route::post('/project-proposals/{id}/transfer-to-execution', [ProjectProposalController::class, 'transferToExecution']);
    });

    // ==================== Orphan Sponsor Coordinator - Transfer to Execution ====================
    // ✅ منسق الكفالة يمكنه نقل مشاريع الكفالة للتنفيذ مباشرة (بدون اختيار مخيم)
    Route::middleware(['auth:sanctum', 'role:orphan_sponsor_coordinator,admin'])->group(function () {
        Route::post('/project-proposals/{id}/transfer-to-execution', [ProjectProposalController::class, 'transferToExecution']);
    });

    // ==================== Orphan Sponsor Coordinator Routes ====================
    Route::middleware(['auth:sanctum', 'role:orphan_sponsor_coordinator,admin'])->group(function () {
        // إدارة الأيتام المكفولين
        Route::post('/project-proposals/{id}/orphans', [ProjectProposalController::class, 'addOrphansToProject']);
        Route::delete('/project-proposals/{id}/orphans/{orphanId}', [ProjectProposalController::class, 'removeOrphanFromProject']);
        Route::get('/project-proposals/{id}/orphans', [ProjectProposalController::class, 'getProjectOrphans']);
        Route::get('/orphans/{orphanId}/projects', [ProjectProposalController::class, 'getOrphanProjects']);
    });
    
    // ==================== Beneficiaries Routes ====================
    Route::middleware(['auth:sanctum'])->group(function () {
        // Beneficiaries routes for projects
        Route::get('/project-proposals/{id}/beneficiaries', [BeneficiaryController::class, 'getBeneficiaries']);
        Route::get('/project-proposals/{id}/beneficiaries/export', [BeneficiaryController::class, 'exportBeneficiaries']);
        
        // Beneficiaries routes (admin and executed_projects_coordinator only)
        Route::middleware(['role:admin,executed_projects_coordinator'])->group(function () {
            Route::get('/project-proposals/{id}/beneficiaries/template', [BeneficiaryController::class, 'downloadTemplate']);
            Route::post('/project-proposals/{id}/beneficiaries/upload', [BeneficiaryController::class, 'uploadExcel']);
            Route::delete('/project-proposals/{id}/beneficiaries', [BeneficiaryController::class, 'deleteBeneficiaries']);
        });
        
        // Beneficiaries statistics (admin only)
        Route::middleware(['role:admin'])->group(function () {
            Route::get('/beneficiaries/statistics', [BeneficiaryController::class, 'getStatistics']);
            Route::get('/beneficiaries/by-aid-type/{aidType}', [BeneficiaryController::class, 'getUniqueBeneficiariesByAidType']);
        });
        
        // Executed projects for beneficiaries management
        Route::middleware(['role:admin,executed_projects_coordinator'])->group(function () {
            // ✅ تم نقل /project-proposals/executed-for-beneficiaries إلى الأعلى قبل /project-proposals/{id}
            // ✅ Endpoint محسّن لجلب عدد المستفيدين لعدة مشاريع في طلب واحد
            Route::post('/beneficiaries/counts', [BeneficiaryController::class, 'getBeneficiariesCounts']);
        });
    });
    
    // ==================== Montage Producer Routes ====================
    Route::middleware(['auth:sanctum', 'role:montage_producer'])->group(function () {
        // مشاريع ممنتج المونتاج
        Route::get('/my-montage-projects', [MontageProducerProjectsController::class, 'index']);
        Route::get('/my-montage-projects/{id}', [MontageProducerProjectsController::class, 'show']);
        Route::post('/my-montage-projects/{id}/complete-montage', [MontageProducerProjectsController::class, 'completeMontage']);
        // ✅ Route للمنتج لتحديث حالة المشروع
        Route::post('/my-montage-projects/{id}/update-status', [MontageProducerProjectsController::class, 'updateStatus']);
    });
    
    // ==================== Supervision Routes (الإدارة العليا - إشراف) ====================
    // ✅ الإشراف + الأدمن + مدير المشاريع + مدير الإعلام (إحصائيات المصورين/الممنتجين لمدير الإعلام)
    // مدير المشاريع: تقرير المشاريع المفصل والتصدير projects فقط
    Route::middleware(['auth:sanctum', 'role:supervision,admin,project_manager,media_manager'])->group(function () {
        // التقارير المختصرة - Summary Reports (إشراف/أدمن فقط — مدير المشاريع يُرفض داخل الـ Controller)
        Route::get('/supervision/summary-dashboard', [SupervisionController::class, 'summaryDashboard']);
        Route::get('/supervision/financial-summary', [SupervisionController::class, 'financialSummary']);
        Route::get('/supervision/performance-summary', [SupervisionController::class, 'performanceSummary']);
        
        // التقارير المفصلة - Detailed Reports (مدير المشاريع مسموح له detailed-projects فقط)
        Route::get('/supervision/detailed-projects', [SupervisionController::class, 'detailedProjectsReport']);
        Route::get('/supervision/detailed-financial', [SupervisionController::class, 'detailedFinancialReport']);
        Route::get('/supervision/detailed-beneficiaries', [SupervisionController::class, 'detailedBeneficiariesReport']);
        
        // إحصائيات منتجي المونتاج - Montage Producers Statistics
        Route::get('/supervision/montage-producers-statistics', [SupervisionController::class, 'montageProducersStatistics']);
        
        // إحصائيات المصورين - Photographers Statistics
        Route::get('/supervision/photographers-statistics', [SupervisionController::class, 'getPhotographersStatistics']);
        
        // التصدير - Export (مدير المشاريع مسموح له report_type=projects فقط)
        Route::get('/supervision/export', [SupervisionController::class, 'exportReport']);
    });

    // ==================== Project Notes Images Routes ====================
    // ✅ يسمح بإعادة ترتيب صور ملاحظات المشروع للأدوار المسؤولة عن إدارة المشاريع والإعلام والكفالة
    Route::middleware(['auth:sanctum', 'role:admin,project_manager,media_manager,orphan_sponsor_coordinator'])->group(function () {
        Route::get('/project-proposals/{id}/note-images', [ProjectProposalController::class, 'getNoteImages']);
        Route::put('/project-note-images/reorder', [ProjectProposalController::class, 'reorderNoteImages']);
    });
    
    // ==================== End of Project Management System Routes ====================

    // User management routes
    Route::patch('/register/{id}', [AuthController::class, 'update']);
    Route::get('/user/{id}', [AuthController::class, 'fetchData']);
    
    // Form availability management routes
    Route::get('/form-availabilities/{formAvailability}', [FormAvailabilityController::class, 'show']);
    Route::post('/form-availabilities', [FormAvailabilityController::class, 'store']);
    Route::patch('/form-availabilities/{formAvailability}', [FormAvailabilityController::class, 'update']);
});

// ✅ Logout route - خارج middleware group ليعمل حتى لو كان الـ token منتهي الصلاحية
Route::post('/logout', [AuthController::class, 'logout']);

// Update orphan routes 
Route::get('/orphans/{id}', [OrphanController::class, 'getOrphanById']);
Route::patch('/orphans/{id}', [OrphanController::class, 'update']);
Route::post('/orphans/{id}', [OrphanController::class, 'update']); 
Route::delete('/orphans/{id}', [OrphanController::class, 'destroy']);


// Public routes (no authentication required)
Route::get('/form-availabilities', [FormAvailabilityController::class, 'index']);
Route::get('/statistics', [StatisticsController::class, 'getStatistics']);

// File viewing routes (public)
Route::get('/image/{id}', [OrphanController::class, 'show']);
Route::get('/excel/{id}', [ShelterController::class, 'show']);
Route::get('/death-certificate/{id}', [OrphanController::class, 'death_certificate']);
Route::get('/{id}/mother-death-certificate', [OrphanController::class, 'mother_death_certificate']);

// Project images routes (public - no authentication required for images)
Route::get('/project-proposals/{id}/image', [ProjectProposalController::class, 'getProjectImage']);
// Route::get('/project-proposals/{id}/note-images', [ProjectProposalController::class, 'getNoteImages']);
Route::get('/project-proposals/{id}/notes-image', [ProjectProposalController::class, 'getNotesImage']);

// ✅ Route بسيط لصور ملاحظات المشروع (نفس نمط صور الأيتام)
Route::get('/project-note-image/{id}', [ProjectProposalController::class, 'getNotesImage']);

// ✅ Route لتحميل صورة ملاحظات المشروع (مع Content-Disposition: attachment)
Route::get('/project-proposals/{id}/notes-image/download', [ProjectProposalController::class, 'downloadNotesImage']);
Route::get('/project-note-image/{id}/download', [ProjectProposalController::class, 'downloadNotesImage']);

// OPTIONS routes for CORS preflight requests
Route::options('/project-proposals/{id}/image', function () {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    $corsOrigin = '*';
    
    if ($origin && in_array($origin, $allowedOrigins)) {
        $corsOrigin = $origin;
    }
    
    return response('', 200)
        ->header('Access-Control-Allow-Origin', $corsOrigin)
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match')
        ->header('Access-Control-Allow-Credentials', 'true')
        ->header('Access-Control-Max-Age', '86400');
});

Route::options('/project-proposals/{id}/notes-image', function () {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    $corsOrigin = '*';
    
    if ($origin && in_array($origin, $allowedOrigins)) {
        $corsOrigin = $origin;
    }
    
    return response('', 200)
        ->header('Access-Control-Allow-Origin', $corsOrigin)
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match')
        ->header('Access-Control-Allow-Credentials', 'true')
        ->header('Access-Control-Max-Age', '86400');
});

// ✅ Static images routes موجودة في البداية (قبل أي middleware)

// ✅ OPTIONS route بدون filename parameter (للحالات الخاصة)
Route::options('/project_notes_images', function () {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    
    \Illuminate\Support\Facades\Log::info('OPTIONS request for project_notes_images (no filename)', [
        'origin' => $origin,
    ]);
    
    $corsOrigin = '*';
    if ($origin && in_array($origin, $allowedOrigins)) {
        $corsOrigin = $origin;
    } elseif ($origin) {
        $corsOrigin = $origin;
    }
    
    return response('', 200)
        ->header('Access-Control-Allow-Origin', $corsOrigin)
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match')
        ->header('Access-Control-Allow-Credentials', 'true')
        ->header('Access-Control-Max-Age', '86400');
});

// Update shelter routes 
Route::get('/shelters/{id}', [ShelterController::class, 'getShelterById']);
Route::patch('/shelters/{id}', [ShelterController::class, 'update']);
Route::post('/shelters/{id}', [ShelterController::class, 'update']); 
Route::delete('/shelters/{id}', [ShelterController::class, 'destroy']);

// ✅ Orphan Groupings Routes - Admin Only
use App\Http\Controllers\OrphanGroupingController;

// Public endpoints for testing
Route::get('/orphan-groupings/locations', [OrphanGroupingController::class, 'locations']);

Route::middleware(['auth:sanctum', 'role:admin,orphan_sponsor_coordinator,executed_projects_coordinator'])->group(function () {
    // Basic CRUD operations
    Route::get('/orphan-groupings', [OrphanGroupingController::class, 'index']);
    Route::post('/orphan-groupings', [OrphanGroupingController::class, 'store']);
    Route::get('/orphan-groupings/{id}', [OrphanGroupingController::class, 'show']);
    Route::put('/orphan-groupings/{id}', [OrphanGroupingController::class, 'update']);
    Route::delete('/orphan-groupings/{id}', [OrphanGroupingController::class, 'destroy']);
    
    // Advanced operations
    Route::get('/orphan-groupings/{id}/eligible-orphans', [OrphanGroupingController::class, 'eligibleOrphans']);
    Route::get('/orphan-groupings/{id}/orphans', [OrphanGroupingController::class, 'getGroupOrphans']);
    Route::post('/orphan-groupings/{id}/add-orphans', [OrphanGroupingController::class, 'addOrphans']);
    Route::post('/orphan-groupings/{id}/remove-orphans', [OrphanGroupingController::class, 'removeOrphans']);
    Route::post('/orphan-groupings/{id}/smart-select', [OrphanGroupingController::class, 'smartSelect']);
    Route::get('/orphan-groupings/{id}/export-pdf', [OrphanExportController::class, 'exportGroupPdf']);
    Route::get('/orphan-groupings/{id}/export-word', [OrphanExportController::class, 'exportGroupWord']);
    
    // Search and utilities
    Route::post('/orphan-groupings/fuzzy-search', [OrphanGroupingController::class, 'fuzzySearch']);
    Route::get('/orphan-groupings/statistics', [OrphanGroupingController::class, 'statistics']);
    Route::post('/orphan-groupings/check-sponsorship', [OrphanGroupingController::class, 'checkSponsorshipStatus']);
});

