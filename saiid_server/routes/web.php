<?php

use App\Http\Controllers\OrphanController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
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

// ✅ مسار الجذر: استجابة JSON بسيطة (لا تعتمد على view أو config) لتجنب 500 من edge/CDN
Route::get('/', function () {
    try {
        return response()->json([
            'name' => config('app.name', 'Laravel'),
            'message' => 'API Backend is running. Use /api/* for API endpoints.',
            'health' => url('/health'),
            'api_health' => url('/api/health'),
        ], 200, [], JSON_UNESCAPED_UNICODE);
    } catch (\Throwable $e) {
        return response()->json([
            'name' => 'Laravel',
            'message' => 'API Backend is running.',
            'health' => '/health',
            'api_health' => '/api/health',
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }
});

// ✅ favicon.ico: استجابة فورية لتجنب 500
Route::get('/favicon.ico', function () {
    return response('', 204);
});

// Static images routes with CORS support (for direct image access without /api/ prefix)
Route::get('/project_notes_images/{filename}', function ($filename) {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    $corsOrigin = '*';
    
    if ($origin && in_array($origin, $allowedOrigins)) {
        $corsOrigin = $origin;
    }
    
    $filePath = public_path('project_notes_images/' . $filename);
    
    if (file_exists($filePath)) {
        $mimeType = mime_content_type($filePath) ?: 'image/jpeg';
        $etag = md5($filePath . '_' . filesize($filePath) . '_' . filemtime($filePath));
        $ifNoneMatch = request()->header('If-None-Match');
        
        // ✅ التحقق من If-None-Match header
        if ($ifNoneMatch && trim($ifNoneMatch, '"') === $etag) {
            return response('', 304, [
                'ETag' => '"' . $etag . '"',
                'Cache-Control' => 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin' => $corsOrigin,
            ]);
        }
        
        return response()->file($filePath)
            ->header('Content-Type', $mimeType)
            ->header('Cache-Control', 'public, max-age=31536000, immutable') // ✅ immutable للصور الثابتة
            ->header('ETag', '"' . $etag . '"')
            ->header('Last-Modified', gmdate('D, d M Y H:i:s', filemtime($filePath)) . ' GMT')
            ->header('Access-Control-Allow-Origin', $corsOrigin)
            ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->header('Access-Control-Allow-Credentials', 'true');
    }
    
    return response()->json([
        'success' => false,
        'error' => 'الصورة غير موجودة'
    ], 404)
        ->header('Access-Control-Allow-Origin', $corsOrigin)
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->header('Access-Control-Allow-Credentials', 'true');
});

Route::options('/project_notes_images/{filename}', function () {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    $corsOrigin = '*';
    
    if ($origin && in_array($origin, $allowedOrigins)) {
        $corsOrigin = $origin;
    }
    
    return response('', 200)
        ->header('Access-Control-Allow-Origin', $corsOrigin)
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->header('Access-Control-Allow-Credentials', 'true')
        ->header('Access-Control-Max-Age', '86400');
});

// Additional routes for other paths that frontend might try
Route::get('/storage/project_notes_images/{filename}', function ($filename) {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    $corsOrigin = '*';
    
    if ($origin && in_array($origin, $allowedOrigins)) {
        $corsOrigin = $origin;
    }
    
    $filePath = public_path('project_notes_images/' . $filename);
    
    if (file_exists($filePath)) {
        $mimeType = mime_content_type($filePath) ?: 'image/jpeg';
        $etag = md5($filePath . '_' . filesize($filePath) . '_' . filemtime($filePath));
        $ifNoneMatch = request()->header('If-None-Match');
        
        // ✅ التحقق من If-None-Match header
        if ($ifNoneMatch && trim($ifNoneMatch, '"') === $etag) {
            return response('', 304, [
                'ETag' => '"' . $etag . '"',
                'Cache-Control' => 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin' => $corsOrigin,
            ]);
        }
        
        return response()->file($filePath)
            ->header('Content-Type', $mimeType)
            ->header('Cache-Control', 'public, max-age=31536000, immutable') // ✅ immutable للصور الثابتة
            ->header('ETag', '"' . $etag . '"')
            ->header('Last-Modified', gmdate('D, d M Y H:i:s', filemtime($filePath)) . ' GMT')
            ->header('Access-Control-Allow-Origin', $corsOrigin)
            ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->header('Access-Control-Allow-Credentials', 'true');
    }
    
    return response()->json([
        'success' => false,
        'error' => 'الصورة غير موجودة'
    ], 404)
        ->header('Access-Control-Allow-Origin', $corsOrigin)
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->header('Access-Control-Allow-Credentials', 'true');
});

Route::options('/storage/project_notes_images/{filename}', function () {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    $corsOrigin = '*';
    
    if ($origin && in_array($origin, $allowedOrigins)) {
        $corsOrigin = $origin;
    }
    
    return response('', 200)
        ->header('Access-Control-Allow-Origin', $corsOrigin)
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->header('Access-Control-Allow-Credentials', 'true')
        ->header('Access-Control-Max-Age', '86400');
});

Route::get('/public/storage/project_notes_images/{filename}', function ($filename) {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    $corsOrigin = '*';
    
    if ($origin && in_array($origin, $allowedOrigins)) {
        $corsOrigin = $origin;
    }
    
    $filePath = public_path('project_notes_images/' . $filename);
    
    if (file_exists($filePath)) {
        $mimeType = mime_content_type($filePath) ?: 'image/jpeg';
        $etag = md5($filePath . '_' . filesize($filePath) . '_' . filemtime($filePath));
        $ifNoneMatch = request()->header('If-None-Match');
        
        // ✅ التحقق من If-None-Match header
        if ($ifNoneMatch && trim($ifNoneMatch, '"') === $etag) {
            return response('', 304, [
                'ETag' => '"' . $etag . '"',
                'Cache-Control' => 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin' => $corsOrigin,
            ]);
        }
        
        return response()->file($filePath)
            ->header('Content-Type', $mimeType)
            ->header('Cache-Control', 'public, max-age=31536000, immutable') // ✅ immutable للصور الثابتة
            ->header('ETag', '"' . $etag . '"')
            ->header('Last-Modified', gmdate('D, d M Y H:i:s', filemtime($filePath)) . ' GMT')
            ->header('Access-Control-Allow-Origin', $corsOrigin)
            ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->header('Access-Control-Allow-Credentials', 'true');
    }
    
    return response()->json([
        'success' => false,
        'error' => 'الصورة غير موجودة'
    ], 404)
        ->header('Access-Control-Allow-Origin', $corsOrigin)
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->header('Access-Control-Allow-Credentials', 'true');
});

Route::options('/public/storage/project_notes_images/{filename}', function () {
    $allowedOrigins = config('cors.allowed_origins', []);
    $origin = request()->header('Origin');
    $corsOrigin = '*';
    
    if ($origin && in_array($origin, $allowedOrigins)) {
        $corsOrigin = $origin;
    }
    
    return response('', 200)
        ->header('Access-Control-Allow-Origin', $corsOrigin)
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->header('Access-Control-Allow-Credentials', 'true')
        ->header('Access-Control-Max-Age', '86400');
});

