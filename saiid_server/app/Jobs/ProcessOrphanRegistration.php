<?php

namespace App\Jobs;

use App\Models\Orphan;
use Illuminate\Bus\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Events\Dispatchable;

class ProcessOrphanRegistration implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $uploadId;

    public function __construct($uploadId)
    {
        $this->uploadId = $uploadId;
    }

    public function handle()
    {
        Log::info("Completed processing for upload ID: {$this->uploadId}");

        // Correct cache key names
        $orphanData = Cache::get("orphan_data_{$this->uploadId}");
        $orphanFiles = Cache::get("orphan_files_{$this->uploadId}");

        if (!$orphanData || !$orphanFiles) {
            // Handle missing data
            Cache::put("upload_result_{$this->uploadId}", ['success' => false, 'error' => 'Missing data'], 600);
            return;
        }

        // Simulate upload progress
        $totalSteps = 5;
        for ($i = 1; $i <= $totalSteps; $i++) {
            sleep(1); // Simulate processing time
            Cache::put("upload_progress_{$this->uploadId}", ($i / $totalSteps) * 100, 600);
        }



        try {
            $orphan = Orphan::create($orphanData);
            Cache::put("upload_result_{$this->uploadId}", ['success' => true, 'orphan' => $orphan], 600);
        } catch (\Exception $e) {
            Cache::put("upload_result_{$this->uploadId}", ['success' => false, 'error' => 'Internal Server Error'], 600);
            Log::error("Error processing orphan registration: " . $e->getMessage());
        }

        Log::info("Processing orphan registration for upload ID: {$this->uploadId}");

        // Clean up cache
        Cache::forget("orphan_data_{$this->uploadId}");
        Cache::forget("orphan_files_{$this->uploadId}");
        Cache::forget("upload_progress_{$this->uploadId}");
    }
}
