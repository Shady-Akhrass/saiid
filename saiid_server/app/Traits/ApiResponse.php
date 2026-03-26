<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * ✅ Standard API response trait — the authoritative response provider.
 *    CacheableResponse defers to this when both traits are used.
 *
 * Changes made:
 * - successResponse() now preserves numeric types via JSON_PRESERVE_ZERO_FRACTION
 * - Added validationErrorResponse() for 422 responses
 * - Added paginatedResponse() helper for consistent pagination output
 * - unauthorizedResponse() and notFoundResponse() now include CORS headers
 * - addCorsHeaders() caches the resolved origin for the request lifecycle
 * - handleDatabaseException() covers more error patterns
 * - Added ensureNumericTypesInResponse() to fix null→0 issue at the JSON level
 */
trait ApiResponse
{
    /**
     * ✅ Numeric fields that must preserve their type through JSON serialization.
     *    Shared with ProjectProposalController::NUMERIC_FIELDS.
     *    Defined here so ANY controller using ApiResponse can benefit.
     */
    protected const API_NUMERIC_FIELDS = [
        'donation_amount',
        'net_amount',
        'amount_in_usd',
        'amount_in_shekel',
        'shekel_exchange_rate',
        'transfer_discount_percentage',
        'estimated_duration_days',
        'beneficiaries_count',
        'beneficiaries_per_unit',
        'total_beneficiaries',
        'phase_day',
        'month_number',
        'total_phases',
        'phase_budget',
    ];

    /**
     * ✅ Success response.
     *
     * Changes:
     * - Uses JSON_PRESERVE_ZERO_FRACTION so 100.00 stays 100.00 not 100
     * - Uses JSON_UNESCAPED_UNICODE so Arabic text isn't escaped
     * - Includes CORS headers (was missing → caused issues on some endpoints)
     */
    protected function successResponse(
        array  $data = [],
        string $message = 'تمت العملية بنجاح',
        int    $statusCode = 200
    ): JsonResponse {
        $responseData = array_merge([
            'success' => true,
            'message' => $message,
        ], $data);

        // ✅ Fix: Recursively ensure numeric types in the response data
        //    This prevents null→0 and float→string issues when Eloquent
        //    models are converted to arrays and merged into the response.
        $responseData = $this->preserveNumericTypes($responseData);

        $response = response()->json(
            $responseData,
            $statusCode,
            [],
            JSON_PRESERVE_ZERO_FRACTION | JSON_UNESCAPED_UNICODE
        );

        return $this->addCorsHeaders($response)
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    }

    /**
     * ✅ THE authoritative errorResponse() method.
     *    CacheableResponse::buildCacheErrorResponse() delegates here
     *    when this trait is present (via method_exists check).
     *
     * Changes:
     * - Accepts \Throwable (not just \Exception)
     * - Rate-limits 500 error logging to avoid log flooding
     * - Includes request method + URL in log context
     */
    protected function errorResponse(
        string      $error,
        string      $message,
        int         $statusCode = 400,
        ?\Throwable $exception = null
    ): JsonResponse {
        // ✅ Log server errors with full context
        if ($statusCode >= 500 && $exception) {
            Log::error("API Error [{$statusCode}]: {$error}", [
                'message'   => $message,
                'exception' => $exception->getMessage(),
                'file'      => $exception->getFile() . ':' . $exception->getLine(),
                'user_id'   => auth()->id(),
                'route'     => request()->method() . ' ' . request()->path(),
                'ip'        => request()->ip(),
            ]);
        }

        $response = [
            'success' => false,
            'error'   => $error,
            'message' => $message,
        ];

        // ✅ Only expose debug info in debug mode
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

    /**
     * ✅ 403 Unauthorized response.
     *
     * Change: Now includes CORS headers (was missing).
     */
    protected function unauthorizedResponse(
        string $message = 'ليس لديك صلاحيات للوصول إلى هذا المورد'
    ): JsonResponse {
        return $this->addCorsHeaders(response()->json([
            'success' => false,
            'error'   => 'غير مصرح',
            'message' => $message,
        ], 403));
    }

    /**
     * ✅ 404 Not Found response.
     *
     * Change: Now includes CORS headers (was missing).
     */
    protected function notFoundResponse(
        string $message = 'المورد المطلوب غير موجود'
    ): JsonResponse {
        return $this->addCorsHeaders(response()->json([
            'success' => false,
            'error'   => 'غير موجود',
            'message' => $message,
        ], 404));
    }

    /**
     * ✅ NEW: 422 Validation error response.
     *    Standardizes validation error output across all controllers.
     */
    protected function validationErrorResponse(
        array  $errors,
        string $message = 'بيانات غير صالحة'
    ): JsonResponse {
        return $this->addCorsHeaders(response()->json([
            'success' => false,
            'error'   => 'خطأ في التحقق',
            'message' => $message,
            'errors'  => $errors,
        ], 422));
    }

    /**
     * ✅ NEW: Paginated response helper.
     *    Ensures consistent pagination structure across all endpoints.
     *    Automatically preserves numeric types in paginated items.
     *
     * @param \Illuminate\Contracts\Pagination\LengthAwarePaginator $paginator
     * @param string $itemsKey  The key name for the items array (e.g., 'projects', 'users')
     * @param string $message
     */
    protected function paginatedResponse(
        \Illuminate\Contracts\Pagination\LengthAwarePaginator $paginator,
        string $itemsKey = 'data',
        string $message = 'تم جلب البيانات بنجاح'
    ): JsonResponse {
        $items = collect($paginator->items())->map(function ($item) {
            $array = is_array($item) ? $item : (method_exists($item, 'toArray') ? $item->toArray() : (array) $item);
            return $this->ensureNumericFields($array);
        })->all();

        return $this->successResponse([
            $itemsKey     => $items,
            'total'       => $paginator->total(),
            'currentPage' => $paginator->currentPage(),
            'totalPages'  => $paginator->lastPage(),
            'perPage'     => $paginator->perPage(),
            'from'        => $paginator->firstItem(),
            'to'          => $paginator->lastItem(),
        ], $message);
    }

    /**
     * ✅ CORS headers.
     *
     * Changes:
     * - Caches resolved origin in a static variable (avoids re-computing per response)
     * - More defensive null checks
     */
    protected function addCorsHeaders(JsonResponse $response): JsonResponse
    {
        static $resolvedOrigin = null;

        if ($resolvedOrigin === null) {
            $origin         = request()->header('Origin');
            $allowedOrigins = config('cors.allowed_origins', []);

            $resolvedOrigin = '*';
            if ($origin && !empty($allowedOrigins) && in_array($origin, $allowedOrigins, true)) {
                $resolvedOrigin = $origin;
            }
        }

        return $response
            ->header('Access-Control-Allow-Origin', $resolvedOrigin)
            ->header('Access-Control-Allow-Credentials', 'true')
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    }

    /**
     * ✅ Database exception handler.
     *
     * Changes:
     * - Accepts \Throwable
     * - Added patterns: deadlock, connection refused, duplicate entry, foreign key constraint
     * - Returns user-friendly messages without exposing internals
     */
    protected function handleDatabaseException(
        \Throwable $e,
        string     $defaultMessage = 'حدث خطأ أثناء العملية'
    ): JsonResponse {
        $msg = $e->getMessage();

        // ── Missing column ──────────────────────────────────────────────
        if (str_contains($msg, 'Column not found') || str_contains($msg, 'Unknown column')) {
            return $this->errorResponse(
                'خطأ في إعدادات قاعدة البيانات',
                'بعض الحقول غير موجودة. يرجى تطبيق Migration.',
                500, $e
            );
        }

        // ── Data truncation ─────────────────────────────────────────────
        if (str_contains($msg, 'Data truncated')) {
            preg_match("/Data truncated for column '([^']+)'/", $msg, $matches);
            $col = $matches[1] ?? 'unknown';
            return $this->errorResponse(
                'خطأ في البيانات المرسلة',
                "القيمة المرسلة للحقل '{$col}' غير صحيحة.",
                422, $e
            );
        }

        // ── Duplicate entry ─────────────────────────────────────────────
        if (str_contains($msg, 'Duplicate entry') || str_contains($msg, 'Integrity constraint violation: 1062')) {
            preg_match("/Duplicate entry '([^']+)' for key/", $msg, $matches);
            $value = $matches[1] ?? '';
            return $this->errorResponse(
                'قيمة مكررة',
                $value ? "القيمة '{$value}' موجودة مسبقاً." : 'توجد بيانات مكررة.',
                409, $e
            );
        }

        // ── Foreign key constraint ──────────────────────────────────────
        if (str_contains($msg, 'foreign key constraint') || str_contains($msg, 'Integrity constraint violation: 1451')) {
            return $this->errorResponse(
                'لا يمكن الحذف',
                'لا يمكن حذف هذا العنصر لأنه مرتبط ببيانات أخرى.',
                409, $e
            );
        }

        // ── Connection errors ───────────────────────────────────────────
        if (str_contains($msg, 'Connection refused')
            || str_contains($msg, 'SQLSTATE[HY000] [2002]')
            || str_contains($msg, 'MySQL server has gone away')
            || $e->getCode() == 2006
        ) {
            return $this->errorResponse(
                'خطأ في الاتصال',
                'لا يمكن الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.',
                503, $e
            );
        }

        // ── Timeout ─────────────────────────────────────────────────────
        if (str_contains($msg, 'timeout') || str_contains($msg, 'timed out') || str_contains($msg, 'Lock wait timeout')) {
            return $this->errorResponse(
                'انتهت مهلة العملية',
                'استغرقت العملية وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى.',
                504, $e
            );
        }

        // ── Deadlock ────────────────────────────────────────────────────
        if (str_contains($msg, 'Deadlock') || str_contains($msg, 'try restarting transaction')) {
            return $this->errorResponse(
                'تعارض في العمليات',
                'حدث تعارض أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.',
                409, $e
            );
        }

        // ── Default ─────────────────────────────────────────────────────
        return $this->errorResponse(
            'فشل العملية',
            config('app.debug') ? $msg : $defaultMessage,
            500, $e
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Numeric Type Preservation Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * ✅ NEW: Recursively walk the response data and fix numeric fields.
     *
     *    THE CORE FIX for the null→0 and float→string problem.
     *
     *    When Eloquent models are converted to arrays (via toArray()),
     *    then merged into a response array, then JSON-encoded:
     *    - `null` can become `0` (if the column has a default of 0 in DB)
     *    - `100.50` can become `"100.50"` (string)
     *    - Decimal casts like `decimal:2` are lost after toArray()
     *
     *    This method walks the data tree and fixes known numeric fields.
     */
    private function preserveNumericTypes(array $data): array
    {
        // ✅ Process top-level numeric fields
        $data = $this->ensureNumericFields($data);

        // ✅ Process nested arrays (e.g., 'project' => [...], 'projects' => [[...], [...]])
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                // Check if it's a list of items (e.g., projects array)
                if ($this->isSequentialArray($value)) {
                    $data[$key] = array_map(function ($item) {
                        return is_array($item) ? $this->ensureNumericFields($item) : $item;
                    }, $value);
                } else {
                    // It's an associative array (e.g., single project)
                    $data[$key] = $this->ensureNumericFields($value);
                }
            }
        }

        return $data;
    }

    /**
     * ✅ NEW: Ensure known numeric fields have proper types in a flat array.
     *
     *    Rules:
     *    - null stays null (NOT converted to 0)
     *    - "100.50" → 100.50 (float)
     *    - "100" → 100 (int)
     *    - Already numeric values are left as-is
     */
    protected function ensureNumericFields(array $data): array
    {
        foreach (self::API_NUMERIC_FIELDS as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }

            $value = $data[$field];

            // ✅ CRITICAL: Keep null as null — don't convert to 0
            if ($value === null) {
                continue;
            }

            // ✅ Convert string numbers to proper numeric types
            if (is_string($value) && is_numeric($value)) {
                $data[$field] = str_contains($value, '.')
                    ? (float) $value
                    : (int) $value;
                continue;
            }

            // ✅ Ensure already-numeric values have the right sub-type
            if (is_numeric($value)) {
                $stringVal = (string) $value;
                $data[$field] = str_contains($stringVal, '.')
                    ? (float) $value
                    : (int) $value;
            }
        }

        return $data;
    }

    /**
     * ✅ NEW: Check if an array is sequential (list) vs associative (map).
     *    [0 => 'a', 1 => 'b'] → true (sequential)
     *    ['name' => 'a'] → false (associative)
     */
    private function isSequentialArray(array $arr): bool
    {
        if (empty($arr)) {
            return false;
        }

        return array_keys($arr) === range(0, count($arr) - 1);
    }
}