<?php
/**
 * تنظيف Cache وإعادة تحميل Autoload
 * افتح: https://forms-api.saiid.org/restart-php.php
 * ثم احذف هذا الملف فوراً!
 */

// للأمان - يمكنك وضع password بسيط
$password = 'admin123'; // غير هذا!
if (!isset($_GET['pass']) || $_GET['pass'] !== $password) {
    die('❌ Unauthorized. Add ?pass=admin123 to URL');
}

echo '<h2>🔄 تنظيف Cache...</h2>';

// 1. مسح OPcache
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo '✅ OPcache cleared<br>';
} else {
    echo '⚠️ OPcache not available<br>';
}

// 2. مسح Composer autoload cache
$composerAutoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($composerAutoload)) {
    // إعادة تحميل composer autoload
    include $composerAutoload;
    echo '✅ Composer autoload reloaded<br>';
}

// 3. مسح Laravel cache files
$cacheFiles = [
    __DIR__ . '/../bootstrap/cache/config.php',
    __DIR__ . '/../bootstrap/cache/routes.php',
    __DIR__ . '/../bootstrap/cache/packages.php',
    __DIR__ . '/../bootstrap/cache/services.php',
];

foreach ($cacheFiles as $file) {
    if (file_exists($file)) {
        unlink($file);
        echo '✅ Deleted: ' . basename($file) . '<br>';
    }
}

// 4. مسح storage cache
$storageCachePath = __DIR__ . '/../storage/framework/cache';
if (is_dir($storageCachePath)) {
    $files = glob($storageCachePath . '/data/*');
    foreach ($files as $file) {
        if (is_file($file)) {
            unlink($file);
        }
    }
    echo '✅ Storage cache cleared<br>';
}

echo '<hr>';
echo '<h3>✅ تم التنظيف بنجاح!</h3>';
echo '<p><strong>⚠️ مهم جداً:</strong> احذف هذا الملف الآن من السيرفر!</p>';
echo '<p>الملف: <code>public/restart-php.php</code></p>';
echo '<hr>';
echo '<p><a href="/">← العودة للموقع</a></p>';

