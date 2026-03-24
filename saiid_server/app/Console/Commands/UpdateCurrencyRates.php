<?php

namespace App\Console\Commands;

use App\Services\CurrencyExchangeService;
use Illuminate\Console\Command;

class UpdateCurrencyRates extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'currencies:update
                            {--force : Force update even if recently updated}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'تحديث أسعار صرف العملات تلقائياً من API';

    protected $exchangeService;

    public function __construct(CurrencyExchangeService $exchangeService)
    {
        parent::__construct();
        $this->exchangeService = $exchangeService;
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔄 جاري تحديث أسعار العملات...');

        $result = $this->exchangeService->updateAllCurrencyRates();

        if ($result['success']) {
            $this->info("✅ {$result['message']}");
            $this->info("📅 الوقت: {$result['timestamp']}");
            return Command::SUCCESS;
        } else {
            $this->error("❌ {$result['message']}");
            return Command::FAILURE;
        }
    }
}

