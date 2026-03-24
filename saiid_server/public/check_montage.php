<?php
/**
 * فحص سريع لمشكلة المونتاج
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

header('Content-Type: text/plain; charset=utf-8');

echo "=== فحص مشكلة قبول المونتاج ===\n\n";

try {
    // 1. التحقق من العمود
    echo "1. التحقق من وجود عمود completed_date...\n";
    $columns = DB::select("SHOW COLUMNS FROM project_proposals WHERE Field = 'completed_date'");
    
    if (empty($columns)) {
        echo "   ❌ العمود غير موجود!\n\n";
        exit;
    } else {
        echo "   ✅ العمود موجود\n";
        echo "   النوع: " . $columns[0]->Type . "\n";
        echo "   NULL: " . $columns[0]->Null . "\n\n";
    }
    
    // 2. مشاريع في حالة "وصل للمتبرع"
    echo "2. المشاريع في حالة 'وصل للمتبرع':\n";
    $projects = DB::select("
        SELECT id, serial_number, project_name, status
        FROM project_proposals 
        WHERE status = 'وصل للمتبرع'
        LIMIT 5
    ");
    
    if (empty($projects)) {
        echo "   ⚠️ لا يوجد مشاريع\n\n";
    } else {
        foreach ($projects as $p) {
            echo "   - [{$p->id}] {$p->serial_number} - {$p->project_name}\n";
        }
        echo "\n";
    }
    
    // 3. اختبار تحديث
    echo "3. اختبار التحديث:\n";
    $testProject = DB::table('project_proposals')
        ->where('status', 'وصل للمتبرع')
        ->first();
    
    if (!$testProject) {
        echo "   ⚠️ لا يوجد مشروع للاختبار\n\n";
    } else {
        echo "   المشروع: {$testProject->serial_number}\n";
        echo "   الحالة قبل: {$testProject->status}\n";
        
        DB::beginTransaction();
        
        try {
            $affected = DB::table('project_proposals')
                ->where('id', $testProject->id)
                ->update([
                    'status' => 'منتهي',
                    'completed_date' => now(),
                    'updated_at' => now(),
                ]);
            
            echo "   عدد الصفوف المتأثرة: {$affected}\n";
            
            $after = DB::table('project_proposals')->where('id', $testProject->id)->first();
            echo "   الحالة بعد: {$after->status}\n";
            echo "   completed_date: {$after->completed_date}\n";
            
            if ($after->status === 'منتهي') {
                echo "   ✅ التحديث نجح!\n";
            } else {
                echo "   ❌ فشل! الحالة لم تتغير\n";
            }
            
            DB::rollBack();
            echo "   (تم عمل Rollback)\n\n";
            
        } catch (\Exception $e) {
            DB::rollBack();
            echo "   ❌ خطأ: " . $e->getMessage() . "\n\n";
        }
    }
    
    // 4. آخر التحديثات
    echo "4. آخر المشاريع المُحدثة:\n";
    $recent = DB::select("
        SELECT id, serial_number, status, completed_date, updated_at
        FROM project_proposals 
        ORDER BY updated_at DESC 
        LIMIT 5
    ");
    
    foreach ($recent as $r) {
        $cd = $r->completed_date ?? 'NULL';
        echo "   - [{$r->id}] {$r->serial_number} | {$r->status} | {$cd} | {$r->updated_at}\n";
    }
    echo "\n";
    
    // 5. فحص الملفات
    echo "5. فحص الملفات المُحدثة:\n";
    $controllerFile = __DIR__ . '/../app/Http/Controllers/NotificationController.php';
    $modelFile = __DIR__ . '/../app/Models/ProjectProposal.php';
    
    echo "   NotificationController: ";
    if (file_exists($controllerFile)) {
        $modified = date('Y-m-d H:i:s', filemtime($controllerFile));
        echo "✅ (آخر تعديل: {$modified})\n";
        
        // ابحث عن كلمة BEFORE UPDATE في الملف
        $content = file_get_contents($controllerFile);
        if (strpos($content, 'BEFORE UPDATE') !== false) {
            echo "      ✅ يحتوي على كود التحديث الجديد\n";
        } else {
            echo "      ❌ لا يحتوي على كود التحديث الجديد!\n";
        }
    } else {
        echo "❌ غير موجود\n";
    }
    
    echo "   ProjectProposal Model: ";
    if (file_exists($modelFile)) {
        $modified = date('Y-m-d H:i:s', filemtime($modelFile));
        echo "✅ (آخر تعديل: {$modified})\n";
        
        // ابحث عن completed_date في fillable
        $content = file_get_contents($modelFile);
        if (strpos($content, "'completed_date'") !== false) {
            echo "      ✅ يحتوي على completed_date في \$fillable\n";
        } else {
            echo "      ❌ لا يحتوي على completed_date في \$fillable!\n";
        }
    } else {
        echo "❌ غير موجود\n";
    }
    
    echo "\n=== انتهى الفحص ===\n";
    echo "\nاحذف هذا الملف: rm public/check_montage.php\n";
    
} catch (\Exception $e) {
    echo "\n❌ خطأ: " . $e->getMessage() . "\n";
    echo "الملف: " . $e->getFile() . "\n";
    echo "السطر: " . $e->getLine() . "\n";
}

