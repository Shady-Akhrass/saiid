<?php
/**
 * ملف لمسح جميع أنواع الـ Cache
 * ⚠️ تحذير: يجب حذف هذا الملف بعد الاستخدام لأسباب أمنية
 */

// التحقق من الصلاحيات (يمكن إضافة كلمة مرور بسيطة)
$password = $_GET['password'] ?? '';
$expectedPassword = 'your_secure_password_here'; // ⚠️ غيّر هذا!

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

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\Artisan;

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>مسح جميع أنواع الـ Cache</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1000px;
            margin: 20px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }
        .status {
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-right: 4px solid;
        }
        .success {
            background: #d4edda;
            border-color: #28a745;
            color: #155724;
        }
        .error {
            background: #f8d7da;
            border-color: #dc3545;
            color: #721c24;
        }
        pre {
            background: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            direction: ltr;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧹 مسح جميع أنواع الـ Cache</h1>
        
        <?php
        $action = $_GET['action'] ?? '';

        if ($action === 'clear') {
            echo '<h2>جارٍ مسح الـ Cache...</h2>';
            
            $results = [];
            
            // 1. مسح Laravel Cache
            try {
                Artisan::call('cache:clear');
                $results[] = ['name' => 'Laravel Cache', 'status' => 'success', 'output' => Artisan::output()];
            } catch (\Exception $e) {
                $results[] = ['name' => 'Laravel Cache', 'status' => 'error', 'message' => $e->getMessage()];
            }
            
            // 2. مسح Config Cache
            try {
                Artisan::call('config:clear');
                $results[] = ['name' => 'Config Cache', 'status' => 'success', 'output' => Artisan::output()];
            } catch (\Exception $e) {
                $results[] = ['name' => 'Config Cache', 'status' => 'error', 'message' => $e->getMessage()];
            }
            
            // 3. مسح Route Cache
            try {
                Artisan::call('route:clear');
                $results[] = ['name' => 'Route Cache', 'status' => 'success', 'output' => Artisan::output()];
            } catch (\Exception $e) {
                $results[] = ['name' => 'Route Cache', 'status' => 'error', 'message' => $e->getMessage()];
            }
            
            // 4. مسح View Cache
            try {
                Artisan::call('view:clear');
                $results[] = ['name' => 'View Cache', 'status' => 'success', 'output' => Artisan::output()];
            } catch (\Exception $e) {
                $results[] = ['name' => 'View Cache', 'status' => 'error', 'message' => $e->getMessage()];
            }
            
            // 5. مسح OPcache
            if (function_exists('opcache_reset')) {
                if (opcache_reset()) {
                    $results[] = ['name' => 'OPcache', 'status' => 'success', 'output' => 'OPcache cleared successfully'];
                } else {
                    $results[] = ['name' => 'OPcache', 'status' => 'error', 'message' => 'Failed to clear OPcache'];
                }
            } else {
                $results[] = ['name' => 'OPcache', 'status' => 'warning', 'message' => 'OPcache not available'];
            }
            
            // 6. مسح Autoload Cache
            try {
                Artisan::call('optimize:clear');
                $results[] = ['name' => 'Optimize Clear', 'status' => 'success', 'output' => Artisan::output()];
            } catch (\Exception $e) {
                $results[] = ['name' => 'Optimize Clear', 'status' => 'error', 'message' => $e->getMessage()];
            }
            
            // عرض النتائج
            foreach ($results as $result) {
                $class = $result['status'] === 'success' ? 'success' : ($result['status'] === 'error' ? 'error' : 'warning');
                echo '<div class="status ' . $class . '">';
                echo '<strong>' . $result['name'] . ':</strong> ';
                if ($result['status'] === 'success') {
                    echo '✅ تم المسح بنجاح';
                    if (isset($result['output']) && !empty(trim($result['output']))) {
                        echo '<pre>' . htmlspecialchars($result['output']) . '</pre>';
                    }
                } else {
                    echo '❌ ' . ($result['message'] ?? 'فشل المسح');
                }
                echo '</div>';
            }
            
            echo '<div class="status success" style="margin-top: 20px;">';
            echo '<strong>✅ تم مسح جميع أنواع الـ Cache</strong>';
            echo '</div>';
            
        } else {
            echo '<div class="status warning">⚠️ اضغط على الزر أدناه لمسح جميع أنواع الـ Cache</div>';
        }
        ?>

        <h2>🔧 الإجراءات المتاحة</h2>
        <div style="margin: 20px 0;">
            <a href="?password=<?php echo htmlspecialchars($password); ?>&action=clear" 
               style="display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px;">
               مسح جميع أنواع الـ Cache
            </a>
        </div>

        <div class="status warning" style="margin-top: 30px;">
            <strong>⚠️ تحذير أمني:</strong><br>
            بعد الانتهاء، يجب حذف هذا الملف فوراً من الخادم لأسباب أمنية.
        </div>
    </div>
</body>
</html>
