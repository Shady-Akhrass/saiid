<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ClearOpcache extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'opcache:clear';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clear PHP OPcache';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        if (!function_exists('opcache_reset')) {
            $this->error('❌ OPcache is not enabled on this server.');
            return 1;
        }

        $result = opcache_reset();

        if ($result) {
            $this->info('✅ OPcache cleared successfully!');
            $this->info('✅ You can now try again.');
            return 0;
        } else {
            $this->error('❌ Failed to clear OPcache.');
            $this->warn('Please restart PHP-FPM or Web Server manually.');
            return 1;
        }
    }
}

