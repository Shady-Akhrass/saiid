<?php
// app/Traits/ApiResponse.php

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

trait ApiResponse
{
    protected function successResponse(
        array $data = [],
        string $message = 'تمت العملية بنجاح',
        int $statusCode = 200
    ): JsonResponse {
        return response()->json(array_merge([
            'success' => true,
            'message' => $message,
        ], $data), $statusCode)
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    }

    protected function errorResponse(
        string $error,
        string $message,
        int $statusCode = 400,
        ?\Exception $exception = null
    ): JsonResponse {
        if ($statusCode >= 500 && $exception) {
            Log::error("API Error: {$error}", [
                'message'   => $message,
                'exception' => $exception->getMessage(),
                'file'      => $exception->getFile(),
                'line'      => $exception->getLine(),
                'user_id'   => auth()->id(),
                'route'     => request()->path(),
            ]);
        }

        $response = [
            'success' => false,
            'error'   => $error,
            'message' => $message,
        ];

        if (config('app.debug') && $exception) {
            $response['debug'] = [
                'message' => $exception->getMessage(),
                'file'    => $exception->getFile(),
                'line'    => $exception->getLine(),
                'trace'   => $exception->getTraceAsString(),
            ];
        }

        return $this->addCorsHeaders(response()->json($response, $statusCode));
    }

    protected function unauthorizedResponse(
        string $message = 'ليس لديك صلاحيات للوصول إلى هذا المورد'
    ): JsonResponse {
        return response()->json([
            'success' => false,
            'error'   => 'غير مصرح',
            'message' => $message,
        ], 403);
    }

    protected function notFoundResponse(
        string $message = 'المورد المطلوب غير موجود'
    ): JsonResponse {
        return response()->json([
            'success' => false,
            'error'   => 'غير موجود',
            'message' => $message,
        ], 404);
    }

    protected function addCorsHeaders(JsonResponse $response): JsonResponse
    {
        $origin = request()->header('Origin');
        $allowedOrigins = config('cors.allowed_origins', []);

        $corsOrigin = '*';
        if ($origin && in_array($origin, $allowedOrigins)) {
            $corsOrigin = $origin;
        }

        return $response
            ->header('Access-Control-Allow-Origin', $corsOrigin)
            ->header('Access-Control-Allow-Credentials', 'true')
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }

    protected function handleDatabaseException(
        \Exception $e,
        string $defaultMessage = 'حدث خطأ أثناء العملية'
    ): JsonResponse {
        $msg = $e->getMessage();

        if (str_contains($msg, 'Column not found') || str_contains($msg, 'Unknown column')) {
            return $this->errorResponse(
                'خطأ في إعدادات قاعدة البيانات',
                'بعض الحقول غير موجودة. يرجى تطبيق Migration.',
                500, $e
            );
        }

        if (str_contains($msg, 'Data truncated')) {
            preg_match("/Data truncated for column '([^']+)'/", $msg, $matches);
            $col = $matches[1] ?? 'unknown';
            return $this->errorResponse(
                'خطأ في البيانات المرسلة',
                "القيمة المرسلة للحقل '{$col}' غير صحيحة.",
                500, $e
            );
        }

        return $this->errorResponse(
            'فشل العملية',
            config('app.debug') ? $msg : $defaultMessage,
            500, $e
        );
    }
}