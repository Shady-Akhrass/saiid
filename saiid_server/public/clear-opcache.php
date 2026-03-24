<?php
/**
 * ✅ Script لمسح OPcache
 * ضع هذا الملف في public/clear-opcache.php
 * ثم افتح: https://forms-api.saiid.org/clear-opcache.php?password=hmada123@@
 */

// التحقق من الصلاحيات
$password = $_GET['password'] ?? '';
$expectedPassword = 'hmada123@@'; // ⚠️ كلمة المرور

if ($password !== $expectedPassword) {
    die('
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>تحقق من الصلاحيات</title>
        <style>
            body { font-family: Arial; text-align: center; padding: 50px; }
            input { padding: 10px; margin: 10px; }
            button { padding: 10px 20px; background: #4CAF50; color: white; border: none; cursor: pointer; }
        </style>
    </head>
    <body>
        <h2>🔐 إدخال كلمة المرور</h2>
        <form method="GET">
            <input type="password" name="password" placeholder="كلمة المرور" required>
            <button type="submit">دخول</button>
        </form>
    </body>
    </html>
    ');
}

header('Content-Type: application/json; charset=utf-8');

$results = [];

// ✅ 1. مسح OPcache
if (function_exists('opcache_reset')) {
    if (opcache_reset()) {
        $results['opcache'] = 'تم مسح OPcache بنجاح ✅';
    } else {
        $results['opcache'] = 'فشل مسح OPcache ❌';
    }
} else {
    $results['opcache'] = 'OPcache غير مفعل';
}

// ✅ 2. مسح OPcache status
if (function_exists('opcache_get_status')) {
    $status = opcache_get_status();
    $results['opcache_status'] = [
        'enabled' => $status['opcache_enabled'] ?? false,
        'cached_scripts' => $status['opcache_statistics']['num_cached_scripts'] ?? 0,
        'cache_hits' => $status['opcache_statistics']['hits'] ?? 0,
        'cache_misses' => $status['opcache_statistics']['misses'] ?? 0,
    ];
}

// ✅ 3. مسح Laravel Cache
try {
    if (file_exists(__DIR__ . '/../bootstrap/cache/config.php')) {
        @unlink(__DIR__ . '/../bootstrap/cache/config.php');
        $results['laravel_config_cache'] = 'تم مسح config cache ✅';
    }
    
    if (file_exists(__DIR__ . '/../bootstrap/cache/routes.php')) {
        @unlink(__DIR__ . '/../bootstrap/cache/routes.php');
        $results['laravel_routes_cache'] = 'تم مسح routes cache ✅';
    }
    
    if (file_exists(__DIR__ . '/../bootstrap/cache/services.php')) {
        @unlink(__DIR__ . '/../bootstrap/cache/services.php');
        $results['laravel_services_cache'] = 'تم مسح services cache ✅';
    }
    
    // مسح application cache
    $cachePath = __DIR__ . '/../storage/framework/cache/data';
    if (is_dir($cachePath)) {
        $files = glob($cachePath . '/*');
        $deleted = 0;
        foreach ($files as $file) {
            if (is_file($file)) {
                @unlink($file);
                $deleted++;
            }
        }
        $results['laravel_app_cache'] = "تم مسح $deleted ملف من application cache ✅";
    }
} catch (\Exception $e) {
    $results['laravel_cache_error'] = $e->getMessage();
}

// ✅ 4. مسح View cache
try {
    $viewPath = __DIR__ . '/../storage/framework/views';
    if (is_dir($viewPath)) {
        $files = glob($viewPath . '/*.php');
        $deleted = 0;
        foreach ($files as $file) {
            if (is_file($file)) {
                @unlink($file);
                $deleted++;
            }
        }
        $results['laravel_view_cache'] = "تم مسح $deleted ملف من view cache ✅";
    }
} catch (\Exception $e) {
    $results['laravel_view_cache_error'] = $e->getMessage();
}

echo json_encode([
    'success' => true,
    'message' => 'تم مسح جميع أنواع الـ Cache',
    'results' => $results,
    'timestamp' => date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
