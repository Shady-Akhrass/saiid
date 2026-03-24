<?php
/**
 * ✅ فحص Dashboard API مباشرة - ماذا يُرجع فعلياً؟
 */

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\ProjectProposal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>فحص Dashboard API</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        .box { background: white; padding: 20px; margin: 20px auto; max-width: 900px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 20px; }
        h2 { color: #555; margin-top: 30px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
        .big { font-size: 4em; font-weight: bold; margin: 20px 0; text-align: center; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        .warning { color: #ff9800; }
        .info { color: #2196F3; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: right; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: bold; }
        .cmd { background: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; margin: 10px 0; line-height: 1.8; }
        .code { background: #f5f5f5; padding: 10px; border-radius: 5px; font-family: monospace; margin: 10px 0; overflow-x: auto; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .alert { padding: 15px; border-radius: 5px; margin: 15px 0; }
        .alert-success { background: #e8f5e9; border-left: 4px solid #4CAF50; }
        .alert-error { background: #ffebee; border-left: 4px solid #f44336; }
        .alert-warning { background: #fff3e0; border-left: 4px solid #ff9800; }
        .alert-info { background: #e3f2fd; border-left: 4px solid #2196F3; }
    </style>
</head>
<body>
    <div class="box">
        <h1>🔍 فحص Dashboard API - التشخيص الكامل</h1>
        
        <?php
        try {
            // ============================================
            // 1. فحص وجود scopeForActualCount
            // ============================================
            echo "<h2>1️⃣ فحص وجود scopeForActualCount()</h2>";
            
            $scopeExists = method_exists(ProjectProposal::class, 'scopeForActualCount');
            
            if ($scopeExists) {
                echo "<div class='alert alert-success'>";
                echo "✅ <strong>scopeForActualCount() موجود!</strong>";
                echo "</div>";
                
                // فحص الكود الفعلي
                $reflection = new ReflectionClass(ProjectProposal::class);
                $method = $reflection->getMethod('scopeForActualCount');
                $file = $method->getFileName();
                $line = $method->getStartLine();
                
                echo "<div class='code'>";
                echo "<strong>الموقع:</strong> $file<br>";
                echo "<strong>السطر:</strong> $line";
                echo "</div>";
            } else {
                echo "<div class='alert alert-error'>";
                echo "❌ <strong>scopeForActualCount() غير موجود!</strong>";
                echo "<p>يجب رفع الملف المعدل: <code>app/Models/ProjectProposal.php</code></p>";
                echo "</div>";
            }
            
            // ============================================
            // 2. حساب العدد المتوقع (من SQL مباشرة)
            // ============================================
            echo "<h2>2️⃣ العدد المتوقع (من قاعدة البيانات مباشرة)</h2>";
            
            $undivided = DB::table('project_proposals')
                ->whereNull('parent_project_id')
                ->where(function($q) {
                    $q->where('is_divided_into_phases', 0)
                      ->orWhereNull('is_divided_into_phases');
                })
                ->count();
            
            $monthlyPhases = DB::table('project_proposals')
                ->whereNotNull('parent_project_id')
                ->where('is_monthly_phase', 1)
                ->count();
            
            $dailyPhases = DB::table('project_proposals')
                ->whereNotNull('parent_project_id')
                ->where('is_daily_phase', 1)
                ->count();
            
            $expected = $undivided + $monthlyPhases + $dailyPhases;
            
            echo "<table>";
            echo "<tr><th>النوع</th><th>العدد</th></tr>";
            echo "<tr><td>غير مقسمة</td><td><strong>$undivided</strong></td></tr>";
            echo "<tr><td>فرعية شهرية</td><td><strong>$monthlyPhases</strong></td></tr>";
            echo "<tr><td>فرعية يومية</td><td><strong>$dailyPhases</strong></tr>";
            echo "<tr style='background: #e8f5e9;'><td><strong>الإجمالي المتوقع</strong></td><td class='big success' style='font-size: 2em;'><strong>$expected</strong></td></tr>";
            echo "</table>";
            
            // ============================================
            // 3. حساب العدد من scopeForActualCount
            // ============================================
            echo "<h2>3️⃣ ماذا يحسب forActualCount()؟</h2>";
            
            if ($scopeExists) {
                $actualCount = ProjectProposal::forActualCount()->count();
                
                echo "<div class='big " . ($actualCount == $expected ? 'success' : 'error') . "'>$actualCount</div>";
                
                if ($actualCount == $expected) {
                    echo "<div class='alert alert-success'>";
                    echo "✅ <strong>ممتاز!</strong> forActualCount() يحسب صح!";
                    echo "</div>";
                } else {
                    echo "<div class='alert alert-error'>";
                    echo "❌ <strong>خطأ!</strong> forActualCount() لا يحسب صح!";
                    echo "<p><strong>المتوقع:</strong> $expected</p>";
                    echo "<p><strong>الفعلي:</strong> $actualCount</p>";
                    echo "<p><strong>الفرق:</strong> " . abs($expected - $actualCount) . "</p>";
                    echo "</div>";
                }
            } else {
                echo "<div class='alert alert-warning'>";
                echo "⚠️ لا يمكن اختبار forActualCount() - Scope غير موجود";
                echo "</div>";
            }
            
            // ============================================
            // 4. محاكاة Dashboard API مباشرة
            // ============================================
            echo "<h2>4️⃣ محاكاة Dashboard API مباشرة</h2>";
            
            if ($scopeExists) {
                // محاكاة الكود من ProjectProposalController::dashboard()
                $dashboardTotalProjects = ProjectProposal::forActualCount()->count();
                
                echo "<div class='code'>";
                echo "<strong>الكود المستخدم:</strong><br>";
                echo "<code>ProjectProposal::forActualCount()->count()</code>";
                echo "</div>";
                
                echo "<div class='big " . ($dashboardTotalProjects == $expected ? 'success' : 'error') . "'>$dashboardTotalProjects</div>";
                
                if ($dashboardTotalProjects == $expected) {
                    echo "<div class='alert alert-success'>";
                    echo "✅ <strong>Dashboard API يحسب صح!</strong>";
                    echo "</div>";
                } else {
                    echo "<div class='alert alert-error'>";
                    echo "❌ <strong>Dashboard API لا يحسب صح!</strong>";
                    echo "<p><strong>المتوقع:</strong> $expected</p>";
                    echo "<p><strong>الفعلي من Dashboard:</strong> $dashboardTotalProjects</p>";
                    echo "</div>";
                }
            }
            
            // ============================================
            // 5. فحص Cache
            // ============================================
            echo "<h2>5️⃣ فحص Cache</h2>";
            
            $cacheDriver = config('cache.default');
            echo "<div class='code'>";
            echo "<strong>Cache Driver:</strong> $cacheDriver<br>";
            echo "</div>";
            
            // محاولة مسح cache
            try {
                Cache::flush();
                echo "<div class='alert alert-info'>";
                echo "✅ تم مسح Cache بنجاح";
                echo "</div>";
            } catch (\Exception $e) {
                echo "<div class='alert alert-warning'>";
                echo "⚠️ لا يمكن مسح Cache: " . $e->getMessage();
                echo "</div>";
            }
            
            // ============================================
            // 6. الحلول المقترحة
            // ============================================
            echo "<h2>6️⃣ الحلول المقترحة</h2>";
            
            $allGood = $scopeExists && isset($actualCount) && $actualCount == $expected && isset($dashboardTotalProjects) && $dashboardTotalProjects == $expected;
            
            if ($allGood) {
                echo "<div class='alert alert-success'>";
                echo "<h3>✅ Backend يعمل بشكل صحيح!</h3>";
                echo "<p>المشكلة على الأرجح في:</p>";
                echo "<ol>";
                echo "<li><strong>Frontend Cache:</strong> امسح browser cache (Ctrl + Shift + Delete)</li>";
                echo "<li><strong>Hard Refresh:</strong> اضغط Ctrl + F5</li>";
                echo "<li><strong>Incognito Mode:</strong> افتح في نافذة خاصة</li>";
                echo "<li><strong>Frontend Code:</strong> تأكد أن Frontend يستخدم API endpoint الصحيح</li>";
                echo "</ol>";
                echo "</div>";
            } else {
                echo "<div class='alert alert-error'>";
                echo "<h3>❌ Backend يحتاج إصلاح!</h3>";
                echo "<p><strong>خطوات الحل:</strong></p>";
                echo "<div class='cmd'>";
                echo "# 1. تأكد من رفع الملفات المعدلة:<br>";
                echo "   - app/Models/ProjectProposal.php<br>";
                echo "   - app/Http/Controllers/ProjectProposalController.php<br><br>";
                echo "# 2. على السيرفر (SSH):<br>";
                echo "cd /path/to/your/project<br>";
                echo "composer dump-autoload<br>";
                echo "php artisan cache:clear<br>";
                echo "php artisan config:clear<br>";
                echo "php artisan route:clear<br>";
                echo "php artisan view:clear<br>";
                echo "php artisan optimize:clear<br><br>";
                echo "# 3. إعادة تشغيل PHP-FPM:<br>";
                echo "sudo systemctl restart php-fpm<br>";
                echo "# أو إذا كنت تستخدم Apache:<br>";
                echo "sudo systemctl restart apache2<br><br>";
                echo "# 4. إعادة تشغيل Nginx (إذا كان موجود):<br>";
                echo "sudo systemctl restart nginx<br><br>";
                echo "# 5. مسح OPcache (إذا كان مفعّل):<br>";
                echo "php -r 'opcache_reset();'<br>";
                echo "# أو أعد تشغيل PHP-FPM (سيُمسح تلقائياً)";
                echo "</div>";
                echo "<p><strong>بعد تنفيذ الأوامر:</strong> أعد تحميل هذه الصفحة للتحقق</p>";
                echo "</div>";
            }
            
            // ============================================
            // 7. معلومات إضافية للتشخيص
            // ============================================
            echo "<h2>7️⃣ معلومات إضافية</h2>";
            
            echo "<table>";
            echo "<tr><th>المعلومة</th><th>القيمة</th></tr>";
            echo "<tr><td>PHP Version</td><td>" . PHP_VERSION . "</td></tr>";
            echo "<tr><td>Laravel Version</td><td>" . app()->version() . "</td></tr>";
            echo "<tr><td>Cache Driver</td><td>" . $cacheDriver . "</td></tr>";
            echo "<tr><td>OPcache Enabled</td><td>" . (function_exists('opcache_get_status') && opcache_get_status() ? 'نعم' : 'لا') . "</td></tr>";
            echo "<tr><td>الوقت الحالي</td><td>" . date('Y-m-d H:i:s') . "</td></tr>";
            echo "</table>";
            
        } catch (\Exception $e) {
            echo "<div class='alert alert-error'>";
            echo "<h3>❌ خطأ في التشخيص:</h3>";
            echo "<pre>" . htmlspecialchars($e->getMessage()) . "\n\n" . $e->getTraceAsString() . "</pre>";
            echo "</div>";
        }
        ?>
        
        <hr>
        <p style="text-align: center; color: #999;">
            <small>الوقت: <?= date('Y-m-d H:i:s') ?> | احذف بعد الاختبار</small>
        </p>
    </div>
</body>
</html>
