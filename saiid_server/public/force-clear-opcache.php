<?php
/**
 * Force Clear OPcache - مسح قوي لـ OPcache
 * 
 * افتح هذا الملف في المتصفح:
 * https://forms-api.saiid.org/force-clear-opcache.php?pass=admin123
 * 
 * ⚠️ احذف هذا الملف بعد الاستخدام!
 */

// Password protection
$password = 'admin123'; // غير هذا!
if (!isset($_GET['pass']) || $_GET['pass'] !== $password) {
    die('❌ Unauthorized. Add ?pass=admin123 to URL');
}

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>مسح OPcache</title>
    <style>
        body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .success { color: #4CAF50; font-weight: bold; margin: 10px 0; }
        .error { color: #f44336; font-weight: bold; margin: 10px 0; }
        .warning { color: #ff9800; font-weight: bold; margin: 10px 0; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .btn { display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .btn:hover { background: #45a049; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔄 مسح OPcache القوي</h1>
        
        <?php
        $results = [];
        
        // 1. مسح OPcache
        if (function_exists('opcache_reset')) {
            $result = opcache_reset();
            if ($result) {
                $results[] = ['type' => 'success', 'message' => '✅ OPcache تم مسحه بنجاح'];
            } else {
                $results[] = ['type' => 'error', 'message' => '❌ فشل في مسح OPcache'];
            }
            
            // مسح OPcache invalidate للملفات المحددة
            $filePath = __DIR__ . '/../app/Services/ProjectProposalIndexService.php';
            if (file_exists($filePath)) {
                $realPath = realpath($filePath);
                if ($realPath && function_exists('opcache_invalidate')) {
                    opcache_invalidate($realPath, true);
                    $results[] = ['type' => 'success', 'message' => '✅ تم إلغاء صلاحية ProjectProposalIndexService.php من OPcache'];
                }
            }
        } else {
            $results[] = ['type' => 'warning', 'message' => '⚠️ OPcache غير مفعّل على هذا السيرفر'];
        }
        
        // 2. مسح Composer autoload cache
        $autoloadFiles = [
            __DIR__ . '/../vendor/composer/autoload_classmap.php',
            __DIR__ . '/../vendor/composer/autoload_static.php',
        ];
        
        foreach ($autoloadFiles as $file) {
            if (file_exists($file)) {
                $realPath = realpath($file);
                if ($realPath && function_exists('opcache_invalidate')) {
                    opcache_invalidate($realPath, true);
                }
            }
        }
        $results[] = ['type' => 'success', 'message' => '✅ تم إلغاء صلاحية Composer autoload files'];
        
        // 3. مسح Laravel bootstrap cache
        $cacheFiles = [
            __DIR__ . '/../bootstrap/cache/config.php',
            __DIR__ . '/../bootstrap/cache/routes.php',
            __DIR__ . '/../bootstrap/cache/packages.php',
            __DIR__ . '/../bootstrap/cache/services.php',
        ];
        
        foreach ($cacheFiles as $file) {
            if (file_exists($file)) {
                unlink($file);
                $results[] = ['type' => 'success', 'message' => '✅ تم حذف: ' . basename($file)];
            }
        }
        
        // 4. مسح storage cache
        $storageCachePath = __DIR__ . '/../storage/framework/cache/data';
        if (is_dir($storageCachePath)) {
            $files = glob($storageCachePath . '/*');
            $count = 0;
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                    $count++;
                }
            }
            if ($count > 0) {
                $results[] = ['type' => 'success', 'message' => "✅ تم حذف $count ملف من storage cache"];
            }
        }
        
        // عرض النتائج
        foreach ($results as $result) {
            $class = $result['type'] === 'success' ? 'success' : ($result['type'] === 'error' ? 'error' : 'warning');
            echo "<div class='$class'>{$result['message']}</div>";
        }
        ?>
        
        <hr>
        
        <h2>📊 معلومات OPcache:</h2>
        <?php
        if (function_exists('opcache_get_status')) {
            $status = opcache_get_status();
            if ($status) {
                echo '<pre>';
                echo "OPcache Enabled: " . ($status['opcache_enabled'] ? 'Yes' : 'No') . "\n";
                echo "Cache Full: " . ($status['cache_full'] ? 'Yes' : 'No') . "\n";
                echo "Cached Scripts: " . $status['opcache_statistics']['num_cached_scripts'] . "\n";
                echo "Memory Used: " . round($status['memory_usage']['used_memory'] / 1024 / 1024, 2) . " MB\n";
                echo "Memory Free: " . round($status['memory_usage']['free_memory'] / 1024 / 1024, 2) . " MB\n";
                echo '</pre>';
            } else {
                echo '<div class="warning">⚠️ لا يمكن الحصول على معلومات OPcache</div>';
            }
        }
        ?>
        
        <hr>
        
        <h2>✅ تم التنظيف بنجاح!</h2>
        <p><strong>⚠️ مهم جداً:</strong> احذف هذا الملف الآن من السيرفر!</p>
        <p>الملف: <code>public/force-clear-opcache.php</code></p>
        
        <a href="/" class="btn">← العودة للموقع</a>
    </div>
</body>
</html>

