<?php
/**
 * سكريبت لإضافة عمود completed_date إلى جدول project_proposals
 * 
 * الاستخدام:
 * افتح المتصفح: http://your-domain.com/add_completed_date_column.php
 * أو عبر Terminal: php public/add_completed_date_column.php
 */

// تحميل Laravel
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

header('Content-Type: text/html; charset=utf-8');

echo "<!DOCTYPE html>
<html dir='rtl' lang='ar'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>إضافة عمود completed_date</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; border-right: 4px solid #28a745; margin: 10px 0; }
        .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; border-right: 4px solid #dc3545; margin: 10px 0; }
        .info { background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 5px; border-right: 4px solid #17a2b8; margin: 10px 0; }
        .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; border-right: 4px solid #ffc107; margin: 10px 0; }
        pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .step { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .step-number { display: inline-block; width: 30px; height: 30px; background: #3498db; color: white; border-radius: 50%; text-align: center; line-height: 30px; margin-left: 10px; }
    </style>
</head>
<body>
<div class='container'>";

echo "<h1>🔧 إضافة عمود completed_date إلى جدول project_proposals</h1>";

try {
    // التحقق من وجود الجدول
    if (!Schema::hasTable('project_proposals')) {
        echo "<div class='error'>❌ <strong>خطأ:</strong> جدول project_proposals غير موجود!</div>";
        echo "</div></body></html>";
        exit;
    }
    
    echo "<div class='info'>✅ تم العثور على جدول project_proposals</div>";
    
    // التحقق من وجود العمود
    if (Schema::hasColumn('project_proposals', 'completed_date')) {
        echo "<div class='warning'>⚠️ <strong>تنبيه:</strong> عمود completed_date موجود بالفعل!</div>";
        
        // عرض معلومات العمود
        $columnInfo = DB::select("SHOW COLUMNS FROM project_proposals WHERE Field = 'completed_date'");
        if (!empty($columnInfo)) {
            echo "<div class='step'>";
            echo "<h3>📊 معلومات العمود الحالي:</h3>";
            echo "<pre>" . print_r($columnInfo[0], true) . "</pre>";
            echo "</div>";
        }
        
    } else {
        echo "<div class='info'>🔍 عمود completed_date غير موجود. سيتم إضافته الآن...</div>";
        
        // إضافة العمود
        try {
            DB::statement("
                ALTER TABLE `project_proposals` 
                ADD COLUMN `completed_date` TIMESTAMP NULL 
                AFTER `sent_to_donor_date`
            ");
            
            echo "<div class='success'>✅ <strong>نجح!</strong> تم إضافة عمود completed_date بنجاح!</div>";
            
            // التحقق من الإضافة
            if (Schema::hasColumn('project_proposals', 'completed_date')) {
                echo "<div class='success'>✅ تم التحقق: العمود موجود الآن في قاعدة البيانات</div>";
                
                // عرض معلومات العمود الجديد
                $columnInfo = DB::select("SHOW COLUMNS FROM project_proposals WHERE Field = 'completed_date'");
                if (!empty($columnInfo)) {
                    echo "<div class='step'>";
                    echo "<h3>📊 معلومات العمود الجديد:</h3>";
                    echo "<pre>" . print_r($columnInfo[0], true) . "</pre>";
                    echo "</div>";
                }
                
            } else {
                echo "<div class='error'>❌ فشل التحقق من إضافة العمود!</div>";
            }
            
        } catch (\Exception $e) {
            echo "<div class='error'>❌ <strong>خطأ في إضافة العمود:</strong> " . $e->getMessage() . "</div>";
            echo "<div class='step'>";
            echo "<h3>🔧 الحل البديل - استخدم هذا الأمر SQL مباشرة:</h3>";
            echo "<pre>ALTER TABLE `project_proposals` 
ADD COLUMN `completed_date` TIMESTAMP NULL 
AFTER `sent_to_donor_date`;</pre>";
            echo "</div>";
        }
    }
    
    // عرض جميع الأعمدة المتعلقة بالتواريخ
    echo "<div class='step'>";
    echo "<h3>📅 الأعمدة المتعلقة بالتواريخ في جدول project_proposals:</h3>";
    $dateColumns = DB::select("
        SHOW COLUMNS FROM project_proposals 
        WHERE Field LIKE '%date%' OR Type LIKE '%timestamp%' OR Type LIKE '%datetime%'
    ");
    
    if (!empty($dateColumns)) {
        echo "<table style='width:100%; border-collapse: collapse;'>";
        echo "<tr style='background: #3498db; color: white;'>
                <th style='padding: 10px; border: 1px solid #ddd;'>اسم العمود</th>
                <th style='padding: 10px; border: 1px solid #ddd;'>النوع</th>
                <th style='padding: 10px; border: 1px solid #ddd;'>NULL</th>
                <th style='padding: 10px; border: 1px solid #ddd;'>القيمة الافتراضية</th>
              </tr>";
        
        foreach ($dateColumns as $column) {
            echo "<tr>";
            echo "<td style='padding: 10px; border: 1px solid #ddd;'><strong>" . $column->Field . "</strong></td>";
            echo "<td style='padding: 10px; border: 1px solid #ddd;'>" . $column->Type . "</td>";
            echo "<td style='padding: 10px; border: 1px solid #ddd;'>" . $column->Null . "</td>";
            echo "<td style='padding: 10px; border: 1px solid #ddd;'>" . ($column->Default ?? 'NULL') . "</td>";
            echo "</tr>";
        }
        
        echo "</table>";
    }
    echo "</div>";
    
    // عرض عدد المشاريع في كل حالة
    echo "<div class='step'>";
    echo "<h3>📊 إحصائيات المشاريع حسب الحالة:</h3>";
    $stats = DB::select("
        SELECT status, COUNT(*) as count 
        FROM project_proposals 
        GROUP BY status 
        ORDER BY count DESC
    ");
    
    if (!empty($stats)) {
        echo "<table style='width:100%; border-collapse: collapse;'>";
        echo "<tr style='background: #3498db; color: white;'>
                <th style='padding: 10px; border: 1px solid #ddd;'>الحالة</th>
                <th style='padding: 10px; border: 1px solid #ddd;'>عدد المشاريع</th>
              </tr>";
        
        foreach ($stats as $stat) {
            echo "<tr>";
            echo "<td style='padding: 10px; border: 1px solid #ddd;'><strong>" . $stat->status . "</strong></td>";
            echo "<td style='padding: 10px; border: 1px solid #ddd;'>" . $stat->count . "</td>";
            echo "</tr>";
        }
        
        echo "</table>";
    }
    echo "</div>";
    
    echo "<div class='success'>";
    echo "<h3>✅ العملية اكتملت بنجاح!</h3>";
    echo "<p>يمكنك الآن:</p>";
    echo "<ul>";
    echo "<li>اختبار قبول المونتاج من صفحة الإشعارات</li>";
    echo "<li>التحقق من أن المشاريع تنتقل إلى حالة 'منتهي' بنجاح</li>";
    echo "<li><strong>حذف هذا الملف من السيرفر لأسباب أمنية:</strong> <code>public/add_completed_date_column.php</code></li>";
    echo "</ul>";
    echo "</div>";
    
} catch (\Exception $e) {
    echo "<div class='error'>";
    echo "<h3>❌ حدث خطأ:</h3>";
    echo "<p><strong>الرسالة:</strong> " . $e->getMessage() . "</p>";
    echo "<p><strong>الملف:</strong> " . $e->getFile() . "</p>";
    echo "<p><strong>السطر:</strong> " . $e->getLine() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
    echo "</div>";
}

echo "</div>
</body>
</html>";

