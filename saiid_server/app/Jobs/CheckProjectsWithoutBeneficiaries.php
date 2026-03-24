<?php

namespace App\Jobs;

use App\Models\ProjectProposal;
use App\Helpers\NotificationHelper;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CheckProjectsWithoutBeneficiaries implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            // Get all projects in "تم التنفيذ" or "منفذ" status without beneficiaries file
            $projects = ProjectProposal::whereIn('status', ['تم التنفيذ', 'منفذ'])
                ->where(function($query) {
                    $query->whereNull('beneficiaries_excel_file')
                          ->orWhere('beneficiaries_excel_file', '');
                })
                ->get();

            $count = 0;
            foreach ($projects as $project) {
                // Send notification for each project
                NotificationHelper::createMissingBeneficiariesFileNotification($project);
                $count++;
            }

            if ($count > 0) {
                Log::info("CheckProjectsWithoutBeneficiaries: Sent notifications for {$count} projects without beneficiaries file");
            }

        } catch (\Exception $e) {
            Log::error('Error in CheckProjectsWithoutBeneficiaries job: ' . $e->getMessage());
        }
    }
}
