<?php
/**
 * ✅ فحص بسيط: ماذا يعرض Dashboard فعلياً؟
 */

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\ProjectProposal;
use Illuminate\Support\Facades\DB;

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>فحص Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        .box { background: white; padding: 20px; margin: 20px auto; max-width: 600px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 20px; }
        .big { font-size: 4em; font-weight: bold; margin: 20px 0; text-align: center; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        .warning { color: #ff9800; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: right; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: bold; }
        .cmd { background: #f5f5f5; padding: 10px; border-radius: 5px; font-family: monospace; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="box">
        <h1>🔍 فحص Dashboard - ماذا يحسب؟</h1>
        
        <?php
        try {
            echo "<h2>1️⃣ ما يجب أن يكون:</h2>";
            
            // الحساب الصحيح
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
            echo "<tr><td>فرعية يومية</td><td><strong>$dailyPhases</strong></td></tr>";
            echo "<tr style='background: #e8f5e9;'><td><strong>الإجمالي المتوقع</strong></td><td class='big success' style='font-size: 2em;'><strong>$expected</strong></td></tr>";
            echo "</table>";
            
            echo "<hr>";
            echo "<h2>2️⃣ ماذا يحسب forActualCount() فعلياً؟</h2>";
            
            // اختبار forActualCount
            if (method_exists(ProjectProposal::class, 'scopeForActualCount')) {
                $actualCount = ProjectProposal::forActualCount()->count();
                
                echo "<div class='big " . ($actualCount == $expected ? 'success' : 'error') . "'>$actualCount</div>";
                
                if ($actualCount == $expected) {
                    echo "<p class='success' style='font-size: 1.2em;'>✅ <strong>ممتاز!</strong> forActualCount() يحسب صح!</p>";
                } else {
                    echo "<p class='error' style='font-size: 1.2em;'>❌ <strong>خطأ!</strong> forActualCount() لا يحسب صح!</p>";
                    echo "<p><strong>المتوقع:</strong> $expected</p>";
                    echo "<p><strong>الفعلي:</strong> $actualCount</p>";
                }
            } else {
                echo "<p class='error' style='font-size: 1.3em;'>❌ <strong>Scope غير موجود!</strong></p>";
                echo "<p>scopeForActualCount() غير موجود في ProjectProposal.php</p>";
                echo "<p><strong>الحل:</strong> ارفع الملف المعدل!</p>";
            }
            
            echo "<hr>";
            echo "<h2>3️⃣ الحل:</h2>";
            
            if (method_exists(ProjectProposal::class, 'scopeForActualCount') && $actualCount == $expected) {
                echo "<div style='background: #e8f5e9; padding: 15px; border-radius: 5px;'>";
                echo "<p class='success'>✅ <strong>Backend يعمل بشكل صحيح!</strong></p>";
                echo "<p><strong>المشكلة:</strong> Frontend cache أو Browser cache</p>";
                echo "<p><strong>الحل:</strong></p>";
                echo "<ol>";
                echo "<li>امسح Browser cache: Ctrl + Shift + Delete</li>";
                echo "<li>Hard Refresh: Ctrl + F5</li>";
                echo "<li>افتح في Incognito Mode</li>";
                echo "</ol>";
                echo "</div>";
            } else {
                echo "<div style='background: #ffebee; padding: 15px; border-radius: 5px;'>";
                echo "<p class='error'>❌ <strong>Backend لا يعمل بشكل صحيح!</strong></p>";
                echo "<p><strong>الحل:</strong></p>";
                echo "<div class='cmd'>";
                echo "# على السيرفر:<br>";
                echo "sudo systemctl restart php-fpm<br>";
                echo "sudo systemctl restart nginx<br>";
                echo "php artisan cache:clear<br>";
                echo "composer dump-autoload";
                echo "</div>";
                echo "<p>ثم أعد تحميل هذه الصفحة</p>";
                echo "</div>";
            }
            
        } catch (\Exception $e) {
            echo "<p class='error'>خطأ: " . $e->getMessage() . "</p>";
        }
        ?>
        
        <hr>
        <p style="text-align: center; color: #999;">
            <small>الوقت: <?= date('Y-m-d H:i:s') ?> | احذف بعد الاختبار</small>
        </p>
    </div>
</body>
</html>
```
 