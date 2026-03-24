<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * هذا Migration ينقل الصور القديمة من حقل project_image في جدول project_proposals
     * إلى الجدول الجديد project_proposal_images
     * 
     * ملاحظة: هذا Migration اختياري. يمكنك تشغيله أو تركه.
     * إذا لم تشغله، الصور القديمة ستبقى في project_image (للتوافق مع الكود القديم)
     */
    public function up(): void
    {
        // التحقق من وجود الجدول الجديد
        if (!Schema::hasTable('project_proposal_images')) {
            Log::warning('Table project_proposal_images does not exist. Please run the create migration first.');
            return;
        }

        // جلب جميع المشاريع التي لديها project_image
        $projectsWithImages = DB::table('project_proposals')
            ->whereNotNull('project_image')
            ->where('project_image', '!=', '')
            ->select('id', 'project_image')
            ->get();

        $migratedCount = 0;
        $skippedCount = 0;

        foreach ($projectsWithImages as $project) {
            try {
                // التحقق من أن الصورة غير موجودة بالفعل في الجدول الجديد
                $existingImage = DB::table('project_proposal_images')
                    ->where('project_proposal_id', $project->id)
                    ->where('image_path', $project->project_image)
                    ->first();

                if ($existingImage) {
                    $skippedCount++;
                    Log::info("Image already exists in new table", [
                        'project_id' => $project->id,
                        'image_path' => $project->project_image
                    ]);
                    continue;
                }

                // إدراج الصورة في الجدول الجديد
                DB::table('project_proposal_images')->insert([
                    'project_proposal_id' => $project->id,
                    'image_path' => $project->project_image,
                    'display_order' => 0, // الصورة القديمة تكون الأولى
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $migratedCount++;
                
                Log::info("Migrated old project image", [
                    'project_id' => $project->id,
                    'image_path' => $project->project_image
                ]);

            } catch (\Exception $e) {
                Log::error("Error migrating project image", [
                    'project_id' => $project->id,
                    'image_path' => $project->project_image,
                    'error' => $e->getMessage()
                ]);
                $skippedCount++;
            }
        }

        Log::info("Migration completed", [
            'migrated' => $migratedCount,
            'skipped' => $skippedCount,
            'total' => $projectsWithImages->count()
        ]);
    }

    /**
     * Reverse the migrations.
     * 
     * ملاحظة: هذا لا يحذف الصور من project_proposal_images
     * لأنه قد تكون هناك صور جديدة تم إضافتها بعد Migration
     * إذا أردت حذفها، يمكنك القيام بذلك يدوياً
     */
    public function down(): void
    {
        // لا نقوم بأي شيء في down()
        // لأننا لا نريد حذف الصور من الجدول الجديد
        // (قد تكون هناك صور جديدة تم إضافتها)
        
        Log::info("Migration down() called - no action taken to preserve new images");
    }
};
