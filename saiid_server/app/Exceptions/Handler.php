<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * Render an exception into an HTTP response with CORS headers
     */
    public function render($request, Throwable $e)
    {
        $response = parent::render($request, $e);

        // ✅ إضافة CORS headers لجميع الاستجابات (حتى الأخطاء) - ضروري لتجنب "blocked by CORS policy"
        if ($request->is('api/*')) {
            $origin = $request->header('Origin');
            $allowedOrigins = config('cors.allowed_origins', []);
            $corsOrigin = null;

            if ($origin) {
                if (in_array($origin, $allowedOrigins)) {
                    $corsOrigin = $origin;
                }
                // دعم localhost و forms.saiid.org حتى لو لم يكونا في الـ config (مثلاً بعد config:cache قديم)
                if (!$corsOrigin && (str_contains($origin, 'localhost') || str_contains($origin, '127.0.0.1') || str_contains($origin, 'forms.saiid.org') || str_contains($origin, 'saiid.org'))) {
                    $corsOrigin = $origin;
                }
            }
            if (!$corsOrigin && config('app.debug') && !empty($allowedOrigins)) {
                $corsOrigin = $allowedOrigins[0];
            }

            if ($corsOrigin) {
                $response->headers->set('Access-Control-Allow-Origin', $corsOrigin);
            }
            $response->headers->set('Access-Control-Allow-Credentials', 'true');
            $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, If-Modified-Since, If-None-Match');
        }

        return $response;
    }
}
