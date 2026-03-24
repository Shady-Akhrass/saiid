<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // $schedule->command('inspire')->hourly();
        
        // فحص المشاريع المتأخرة يومياً الساعة 9 صباحاً
        $schedule->job(new \App\Jobs\CheckDelayedProjects)
                 ->dailyAt('09:00')
                 ->timezone('Asia/Gaza');
        
        // إرسال إشعارات المشاريع المقسمة على مراحل يومياً الساعة 8 صباحاً
        $schedule->job(new \App\Jobs\SendDailyPhaseNotifications)
                 ->dailyAt('08:00')
                 ->timezone('Asia/Gaza');
        
        // إنشاء المشاريع الشهرية تلقائياً يومياً الساعة 7 صباحاً
        $schedule->command('projects:create-monthly-phases')
                 ->dailyAt('07:00')
                 ->timezone('Asia/Gaza');
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
