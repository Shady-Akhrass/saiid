<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // ✅ Query Logging للاستعلامات البطيئة (فقط في Development)
        if (config('app.debug') && config('app.env') === 'local') {
            $this->enableQueryLogging();
        }
    }

    /**
     * تفعيل تسجيل الاستعلامات البطيئة
     */
    private function enableQueryLogging(): void
    {
        $slowQueryThreshold = 500; // 500ms
        $maxQueries = 50;
        $tooManyQueriesLogged = false; // Log "too many" only once per request

        $queryCount = 0;
        $totalQueryTime = 0;

        DB::listen(function ($query) use (&$queryCount, &$totalQueryTime, &$tooManyQueriesLogged, $slowQueryThreshold, $maxQueries) {
            $queryCount++;
            $executionTime = $query->time;
            $totalQueryTime += $executionTime;

            // ✅ تسجيل الاستعلامات البطيئة (>500ms)
            if ($executionTime > $slowQueryThreshold) {
                Log::warning('Slow query detected', [
                    'sql' => $query->sql,
                    'bindings' => $query->bindings,
                    'time' => $executionTime . 'ms',
                    'connection' => $query->connectionName,
                ]);
            }

            // ✅ تحذير عند تجاوز عدد الاستعلامات (>50) — مرة واحدة فقط لكل طلب
            if (!$tooManyQueriesLogged && $queryCount > $maxQueries) {
                $tooManyQueriesLogged = true;
                Log::warning('Too many queries detected', [
                    'count' => $queryCount,
                    'total_time' => $totalQueryTime . 'ms',
                    'avg_time' => round($totalQueryTime / $queryCount, 2) . 'ms',
                ]);
            }
        });
        
        // ✅ تسجيل إجمالي وقت الاستعلامات في نهاية الطلب
        if (app()->runningInConsole() === false) {
            app()->terminating(function () use (&$queryCount, &$totalQueryTime) {
                if ($queryCount > 0) {
                    Log::debug('Query performance summary', [
                        'total_queries' => $queryCount,
                        'total_time' => $totalQueryTime . 'ms',
                        'avg_time' => round($totalQueryTime / $queryCount, 2) . 'ms',
                    ]);
                }
            });
        }
    }
}

