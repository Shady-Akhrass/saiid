<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        // ✅ زيادة Rate Limit للـ API لتجنب 429 Too Many Requests
        // خاصة عند جلب بيانات متعددة (مثل المشاريع والتفريعات)
        RateLimiter::for('api', function (Request $request) {
            // ✅ 180 طلب في الدقيقة للمستخدمين المسجلين (زيادة من 120)
            // ✅ 90 طلب في الدقيقة للزوار (IP) (زيادة من 60)
            return Limit::perMinute($request->user() ? 180 : 90)
                ->by($request->user()?->id ?: $request->ip());
        });
        
        // ✅ Rate Limit خاص لـ project-proposals (أكثر تساهلاً)
        RateLimiter::for('project-proposals', function (Request $request) {
            return Limit::perMinute($request->user() ? 200 : 100)
                ->by($request->user()?->id ?: $request->ip());
        });
        
        // ✅ Rate Limit خاص لـ project-types و project-subcategories (أكثر تساهلاً)
        RateLimiter::for('project-metadata', function (Request $request) {
            return Limit::perMinute($request->user() ? 300 : 150)
                ->by($request->user()?->id ?: $request->ip());
        });
        
        // ✅ Rate Limit خاص لـ warehouse endpoints (أكثر تساهلاً - تُستخدم كثيراً)
        RateLimiter::for('warehouse', function (Request $request) {
            // ✅ 300 طلب في الدقيقة للمستخدمين المسجلين
            // ✅ 150 طلب في الدقيقة للزوار
            return Limit::perMinute($request->user() ? 300 : 150)
                ->by($request->user()?->id ?: $request->ip());
        });
        
        // ✅ Rate Limit خاص لـ notifications (تُستخدم كثيراً في الواجهة)
        RateLimiter::for('notifications', function (Request $request) {
            return Limit::perMinute($request->user() ? 200 : 100)
                ->by($request->user()?->id ?: $request->ip());
        });

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
}
