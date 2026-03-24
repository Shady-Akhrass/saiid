<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Notification;

class DeleteProjectCreatedNotifications extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notifications:delete-project-created';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'حذف جميع إشعارات "مشروع جديد تم إنشاؤه" من قاعدة البيانات';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('بدء حذف إشعارات "مشروع جديد تم إنشاؤه"...');
        
        try {
            $count = Notification::where('notification_type', 'project_created')->count();
            
            if ($count === 0) {
                $this->info('✅ لا توجد إشعارات من نوع "project_created" لحذفها.');
                return Command::SUCCESS;
            }
            
            if ($this->confirm("هل تريد حذف {$count} إشعار من نوع 'مشروع جديد تم إنشاؤه'؟", true)) {
                $deleted = Notification::where('notification_type', 'project_created')->delete();
                
                $this->info("✅ تم حذف {$deleted} إشعار بنجاح!");
                return Command::SUCCESS;
            } else {
                $this->info('تم إلغاء العملية.');
                return Command::SUCCESS;
            }
            
        } catch (\Exception $e) {
            $this->error('❌ حدث خطأ: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }
}

