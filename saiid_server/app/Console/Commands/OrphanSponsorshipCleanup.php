<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class OrphanSponsorshipCleanup extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'orphan-sponsorship:cleanup';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Remove expired orphan sponsorships from the database';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting orphan sponsorship cleanup...');

        $expiredCount = DB::table('orphan_project_proposals')
            ->whereNotNull('sponsorship_end_date')
            ->where('sponsorship_end_date', '<', now()->toDateString())
            ->delete();

        $this->info("Successfully removed {$expiredCount} expired sponsorships.");

        return 0;
    }
}
