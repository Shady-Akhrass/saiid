<?php
/**
 * سكريبت لإصلاح عمود completed_date في جدول project_proposals
 * 
 * المشكلة: العمود قد يكون من نوع TIMESTAMP بدلاً من DATE
 * الحل: تغيير نوع العمود إلى DATE
 * 
 * الاستخدام: افتح في المتصفح
 * http://your-domain.com/fix_completed_date_column.php
 */

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
    <title>إصلاح عمود completed_date</title>
    <style>
        body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; background: #f5f5f5; direction: rtl; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 10px 0; border-right: 4px solid #28a745; }
        .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 10px 0; border-right: 4px solid #dc3545; }
        .info { background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 5px; margin: 10px 0; border-right: 4px solid #17a2b8; }
        .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; margin: 10px 0; border-right: 4px solid #ffc107; }
        pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; direction: ltr; text-align: left; }
        .step { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; border-right: 4px solid #3498db; }
        code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
        .btn { display: inline-block; padding: 10px 20px; background: #3498db; color: white; border-radius: 5px; text-decoration: none; margin: 10px 5px; }
        .btn:hover { background: #2980b9; }
        .btn-danger { background: #dc3545; }
        .btn-danger:hover { background: #c82333; }
        .btn-success { background: #28a745; }
        .btn-success:hover { background: #218838; }
    </style>
</head>
<body>
<div class='container'>";

echo "<h1>🔧 إصلاح عمود completed_date</h1>";

try {
    // 1. التحقق من نوع العمود الحالي
    echo "<h2>1️⃣ التحقق من نوع العمود</h2>";
    
    $columns = DB::select("SHOW COLUMNS FROM project_proposals WHERE Field = 'completed_date'");
    
    if (empty($columns)) {
        echo "<div class='error'>❌ عمود completed_date غير موجود! يجب تشغيل migration أولاً.</div>";
        echo "<div class='step'>";
        echo "<strong>تشغيل Migration:</strong><br>";
        echo "<code>php artisan migrate</code>";
        echo "</div>";
    } else {
        $column = $columns[0];
        $currentType = strtoupper($column->Type);
        
        echo "<div class='step'>";
        echo "<strong>نوع العمود الحالي:</strong> <code>{$currentType}</code><br>";
        echo "<strong>الحالة المتوقعة:</strong> <code>DATE</code>";
        echo "</div>";
        
        // 2. التحقق من وجود مشاريع في حالة "منتهي" بدون completed_date
        echo "<h2>2️⃣ التحقق من البيانات</h2>";
        
        $completedWithoutDate = DB::table('project_proposals')
            ->where('status', 'منتهي')
            ->whereNull('completed_date')
            ->count();
        
        $completedWithDate = DB::table('project_proposals')
            ->where('status', 'منتهي')
            ->whereNotNull('completed_date')
            ->count();
        
        echo "<div class='info'>";
        echo "✅ مشاريع منتهية مع تاريخ: <strong>{$completedWithDate}</strong><br>";
        if ($completedWithoutDate > 0) {
            echo "⚠️ مشاريع منتهية بدون تاريخ: <strong>{$completedWithoutDate}</strong>";
        }
        echo "</div>";
        
        // 3. إصلاح نوع العمود إذا كان خطأ
        if (strpos($currentType, 'TIMESTAMP') !== false || strpos($currentType, 'DATETIME') !== false) {
            echo "<h2>3️⃣ إصلاح نوع العمود</h2>";
            
            echo "<div class='warning'>⚠️ نوع العمود غير صحيح! سيتم التحويل من {$currentType} إلى DATE</div>";
            
            // إصلاح نوع العمود
            DB::statement("ALTER TABLE project_proposals MODIFY COLUMN completed_date DATE NULL");
            
            echo "<div class='success'>✅ تم تحويل نوع العمود بنجاح!</div>";
            
            // التحقق من النوع الجديد
            $newColumns = DB::select("SHOW COLUMNS FROM project_proposals WHERE Field = 'completed_date'");
            $newType = strtoupper($newColumns[0]->Type);
            
            echo "<div class='step'>";
            echo "<strong>نوع العمود الجديد:</strong> <code>{$newType}</code>";
            echo "</div>";
        } else {
            echo "<h2>3️⃣ حالة العمود</h2>";
            echo "<div class='success'>✅ نوع العمود صحيح بالفعل (DATE)</div>";
        }
        
        // 4. إصلاح البيانات للمشاريع المنتهية بدون تاريخ
        if ($completedWithoutDate > 0) {
            echo "<h2>4️⃣ إصلاح البيانات</h2>";
            
            echo "<div class='warning'>سيتم تحديث {$completedWithoutDate} مشروع منتهي بدون تاريخ</div>";
            
            // تحديث المشاريع المنتهية بدون تاريخ - استخدام sent_to_donor_date أو updated_at
            DB::statement("
                UPDATE project_proposals 
                SET completed_date = COALESCE(
                    DATE(sent_to_donor_date), 
                    DATE(updated_at)
                )
                WHERE status = 'منتهي' 
                AND completed_date IS NULL
            ");
            
            echo "<div class='success'>✅ تم تحديث تواريخ الإنتهاء للمشاريع المنتهية</div>";
            
            // التحقق من النتيجة
            $remaining = DB::table('project_proposals')
                ->where('status', 'منتهي')
                ->whereNull('completed_date')
                ->count();
            
            echo "<div class='info'>";
            echo "ℹ️ المشاريع المتبقية بدون تاريخ: <strong>{$remaining}</strong>";
            echo "</div>";
        }
        
        // 5. اختبار تحديث مشروع "وصل للمتبرع" إلى "منتهي"
        echo "<h2>5️⃣ اختبار التحديث</h2>";
        
        $testProject = DB::table('project_proposals')
            ->where('status', 'وصل للمتبرع')
            ->where(function($q) {
                $q->where('is_daily_phase', 0)
                  ->orWhereNull('is_daily_phase');
            })
            ->first();
        
        if ($testProject) {
            echo "<div class='info'>✅ سيتم اختبار المشروع: {$testProject->serial_number} - {$testProject->project_name}</div>";
            
            echo "<div class='step'>";
            echo "<strong>الحالة قبل التحديث:</strong><br>";
            echo "- Status: <code>{$testProject->status}</code><br>";
            echo "- Completed Date: <code>" . ($testProject->completed_date ?? 'NULL') . "</code><br>";
            echo "</div>";
            
            // محاولة التحديث
            DB::beginTransaction();
            
            try {
                $updateData = [
                    'status' => 'منتهي',
                    'completed_date' => date('Y-m-d'),
                    'updated_at' => now(),
                ];
                
                echo "<div class='step'><strong>بيانات التحديث:</strong><pre>" . print_r($updateData, true) . "</pre></div>";
                
                $affected = DB::table('project_proposals')
                    ->where('id', $testProject->id)
                    ->update($updateData);
                
                echo "<div class='info'>Rows affected: <code>{$affected}</code></div>";
                
                // التحقق من قاعدة البيانات
                $afterUpdate = DB::table('project_proposals')
                    ->where('id', $testProject->id)
                    ->first();
                
                echo "<div class='step'>";
                echo "<strong>الحالة بعد التحديث:</strong><br>";
                echo "- Status: <code>{$afterUpdate->status}</code><br>";
                echo "- Completed Date: <code>{$afterUpdate->completed_date}</code><br>";
                echo "- Updated At: <code>{$afterUpdate->updated_at}</code><br>";
                echo "</div>";
                
                if ($afterUpdate->status === 'منتهي' && $afterUpdate->completed_date) {
                    echo "<div class='success'>✅ الاختبار نجح! الحالة تغيرت إلى 'منتهي' مع تسجيل تاريخ الإنتهاء</div>";
                } else {
                    echo "<div class='error'>❌ الاختبار فشل! الحالة: {$afterUpdate->status}, completed_date: " . ($afterUpdate->completed_date ?? 'NULL') . "</div>";
                }
                
                // Rollback للحفاظ على البيانات
                DB::rollBack();
                echo "<div class='warning'>ℹ️ تم عمل Rollback للحفاظ على البيانات الأصلية</div>";
                
            } catch (\Exception $e) {
                DB::rollBack();
                echo "<div class='error'>❌ خطأ: {$e->getMessage()}</div>";
                echo "<pre>" . $e->getTraceAsString() . "</pre>";
            }
        } else {
            echo "<div class='warning'>⚠️ لا يوجد مشروع في حالة 'وصل للمتبرع' للاختبار</div>";
        }
    }
    
    // 6. التوصيات
    echo "<h2>📋 التوصيات</h2>";
    echo "<div class='info'>";
    echo "<ol>";
    echo "<li>تأكد من رفع ملفات التحديث للسيرفر</li>";
    echo "<li>امسح cache Laravel: <code>php artisan cache:clear</code></li>";
    echo "<li>أعد تشغيل الطلب مرة أخرى</li>";
    echo "<li>تحقق من logs في <code>storage/logs/laravel.log</code></li>";
    echo "</ol>";
    echo "</div>";
    
    echo "<div class='warning'>";
    echo "<strong>⚠️ مهم:</strong> احذف هذا الملف بعد الانتهاء من الإصلاح:<br>";
    echo "<code>rm public/fix_completed_date_column.php</code>";
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

echo "</div></body></html>";

