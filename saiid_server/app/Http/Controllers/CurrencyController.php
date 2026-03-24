<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use App\Services\CurrencyExchangeService;
use App\Traits\CacheableResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CurrencyController extends Controller
{
    use CacheableResponse;

    protected $exchangeService;

    public function __construct(CurrencyExchangeService $exchangeService)
    {
        $this->exchangeService = $exchangeService;
    }
    /**
     * Get all currencies
     * 
     * ✅ جلب البيانات مباشرة من قاعدة البيانات (بدون cache)
     * ✅ دعم cache busting parameter (_t) للـ Frontend
     */
    public function index(Request $request)
    {
        try {
            // ✅ جلب البيانات مباشرة من قاعدة البيانات (بدون cache)
            // ✅ دعم cache busting parameter من Frontend
            $useCache = !$request->has('_t'); // إذا كان هناك _t parameter، لا تستخدم cache
            
            if ($useCache) {
                // استخدام cache فقط إذا لم يكن هناك cache busting parameter
                $cacheKey = $this->buildCacheKey('currencies', $request);
                
                return $this->getCachedResponse($cacheKey, function() {
                    return $this->getCurrenciesData();
                }, 300); // 5 minutes cache
            }
            
            // ✅ جلب مباشر من قاعدة البيانات (بدون cache)
            return response()->json($this->getCurrenciesData(), 200)
                ->header('Cache-Control', 'no-cache, must-revalidate')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب العملات',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * جلب بيانات العملات من قاعدة البيانات
     */
    private function getCurrenciesData(): array
    {
        $currencies = Currency::active()
            ->orderBy('currency_code')
            ->get();
        
        return [
            'success' => true,
            'currencies' => $currencies
        ];
    }

    /**
     * إبطال cache العملات
     */
    private function clearCurrenciesCache(): void
    {
        try {
            // إبطال جميع cache keys المتعلقة بالعملات
            $patterns = [
                'currencies_*',
                'currency_*',
            ];
            
            // محاولة استخدام cache tags إذا كان متاحاً (Redis/Memcached)
            if (method_exists(Cache::getStore(), 'tags')) {
                try {
                    Cache::tags(['currencies'])->flush();
                } catch (\Exception $e) {
                    // إذا لم تكن tags متاحة، استخدم الطريقة البديلة
                }
            }
            
            // إبطال cache يدوياً بناءً على patterns
            // ملاحظة: Laravel file cache لا يدعم pattern matching
            // لذلك سنستخدم clearCacheByPrefix من trait
            $this->clearCacheByPrefix('currencies');
            
        } catch (\Exception $e) {
            \Log::warning('فشل إبطال cache العملات', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Create a new currency (Admin only)
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'currency_code' => 'required|string|size:3|unique:currencies,currency_code',
            'currency_name_ar' => 'required|string|max:255',
            'currency_name_en' => 'required|string|max:255',
            'currency_symbol' => 'required|string|max:10',
            'exchange_rate_to_usd' => 'required|numeric|min:0',
            'is_active' => 'sometimes|boolean',
        ], [
            'currency_code.required' => 'يرجى إدخال رمز العملة',
            'currency_code.size' => 'رمز العملة يجب أن يكون 3 أحرف',
            'currency_code.unique' => 'رمز العملة موجود مسبقاً',
            'currency_name_ar.required' => 'يرجى إدخال اسم العملة بالعربية',
            'currency_name_en.required' => 'يرجى إدخال اسم العملة بالإنجليزية',
            'currency_symbol.required' => 'يرجى إدخال رمز العملة',
            'exchange_rate_to_usd.required' => 'يرجى إدخال سعر الصرف',
            'exchange_rate_to_usd.numeric' => 'سعر الصرف يجب أن يكون رقماً',
            'exchange_rate_to_usd.min' => 'سعر الصرف يجب أن يكون أكبر من أو يساوي صفر',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            DB::beginTransaction();

            try {
                $currency = Currency::create([
                    'currency_code' => strtoupper($request->currency_code),
                    'currency_name_ar' => $request->currency_name_ar,
                    'currency_name_en' => $request->currency_name_en,
                    'currency_symbol' => $request->currency_symbol,
                    'exchange_rate_to_usd' => round($request->exchange_rate_to_usd, 4),
                    'is_active' => $request->has('is_active') ? $request->is_active : true,
                    'last_updated_by' => $request->user()->id,
                ]);

                // ✅ إبطال cache العملات بعد الإضافة
                $this->clearCurrenciesCache();

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'تم إضافة العملة بنجاح',
                    'data' => [
                        'id' => $currency->id,
                        'currency_name' => $currency->currency_name_ar,
                        'currency_name_ar' => $currency->currency_name_ar,
                        'currency_name_en' => $currency->currency_name_en,
                        'currency_code' => $currency->currency_code,
                        'currency_symbol' => $currency->currency_symbol,
                        'exchange_rate_to_usd' => floatval($currency->exchange_rate_to_usd),
                        'is_active' => $currency->is_active,
                        'last_updated_by' => $currency->last_updated_by,
                        'created_at' => $currency->created_at->format('Y-m-d H:i:s'),
                        'updated_at' => $currency->updated_at->format('Y-m-d H:i:s'),
                    ]
                ], 201)
                    ->header('Cache-Control', 'no-cache, must-revalidate')
                    ->header('Content-Type', 'application/json');

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إضافة العملة',
                'message' => $e->getMessage()
            ], 500)
                ->header('Content-Type', 'application/json');
        }
    }

    /**
     * Update exchange rate (Admin only)
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'exchange_rate_to_usd' => 'required|numeric|min:0',
        ], [
            'exchange_rate_to_usd.required' => 'يرجى إدخال سعر الصرف',
            'exchange_rate_to_usd.numeric' => 'سعر الصرف يجب أن يكون رقماً',
            'exchange_rate_to_usd.min' => 'سعر الصرف يجب أن يكون أكبر من صفر',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $currency = Currency::findOrFail($id);
            
            $oldRate = $currency->exchange_rate_to_usd;
            
            // ✅ تحديث سعر الصرف مع استخدام database transaction
            DB::beginTransaction();
            
            try {
                $currency->updateRate(
                    $request->exchange_rate_to_usd,
                    $request->user()->id
                );
                
                // ✅ إعادة تحميل العملة من قاعدة البيانات للتأكد من الحصول على القيم المحدثة
                $currency->refresh();
                
                // ✅ إبطال cache العملات بعد التحديث
                $this->clearCurrenciesCache();
                
                DB::commit();
                
                return response()->json([
                    'success' => true,
                    'message' => 'تم تحديث سعر الصرف بنجاح',
                    'data' => [
                        'id' => $currency->id,
                        'currency_name' => $currency->currency_name_ar,
                        'currency_name_ar' => $currency->currency_name_ar,
                        'currency_name_en' => $currency->currency_name_en,
                        'currency_code' => $currency->currency_code,
                        'currency_symbol' => $currency->currency_symbol,
                        'exchange_rate_to_usd' => floatval($currency->exchange_rate_to_usd),
                        'is_active' => $currency->is_active,
                        'last_updated_by' => $currency->last_updated_by,
                        'created_at' => $currency->created_at->format('Y-m-d H:i:s'),
                        'updated_at' => $currency->updated_at->format('Y-m-d H:i:s'),
                    ],
                    'old_rate' => $oldRate,
                    'new_rate' => floatval($currency->exchange_rate_to_usd)
                ], 200);
                
            } catch (\Exception $e) {
                \DB::rollBack();
                throw $e;
            }
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث سعر الصرف',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate amount in USD (حاسبة)
     */
    public function calculateUSD(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0',
            'currency_id' => 'required|exists:currencies,id',
        ], [
            'amount.required' => 'يرجى إدخال المبلغ',
            'amount.numeric' => 'المبلغ يجب أن يكون رقماً',
            'currency_id.required' => 'يرجى اختيار العملة',
            'currency_id.exists' => 'العملة المحددة غير موجودة',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            // ✅ جلب العملة مباشرة من قاعدة البيانات (بدون cache)
            $currency = Currency::findOrFail($request->currency_id);
            
            // ✅ إعادة تحميل العملة للتأكد من الحصول على أحدث سعر
            $currency->refresh();
            
            $usdAmount = $currency->convertToUSD($request->amount);
            
            return response()->json([
                'success' => true,
                'original_amount' => floatval($request->amount),
                'original_currency' => $currency->currency_code,
                'currency_name' => $currency->currency_name_ar,
                'exchange_rate' => floatval($currency->exchange_rate_to_usd),
                'usd_amount' => $usdAmount,
                'calculation' => "{$request->amount} {$currency->currency_symbol} × {$currency->exchange_rate_to_usd} = \${$usdAmount}"
            ], 200)
                ->header('Cache-Control', 'no-cache, must-revalidate');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل الحساب',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle currency active status (Admin only)
     */
    public function toggleStatus($id)
    {
        try {
            $currency = Currency::findOrFail($id);
            
            DB::beginTransaction();
            
            try {
                $currency->is_active = !$currency->is_active;
                $currency->save();
                
                // ✅ إعادة تحميل العملة من قاعدة البيانات
                $currency->refresh();
                
                // ✅ إبطال cache العملات بعد التحديث
                $this->clearCurrenciesCache();
                
                DB::commit();
                
                $status = $currency->is_active ? 'مفعّلة' : 'معطّلة';
                
                return response()->json([
                    'success' => true,
                    'message' => "تم تغيير حالة العملة إلى: {$status}",
                    'currency' => $currency
                ], 200);
                
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تغيير الحالة',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * تحديث جميع أسعار العملات تلقائياً (Admin only)
     */
    public function updateAllRatesFromAPI(Request $request)
    {
        try {
            $result = $this->exchangeService->updateAllCurrencyRates($request->user()->id);
            
            if (!$result['success']) {
                // تحديد status code بناءً على نوع الخطأ
                $statusCode = 500;
                if (isset($result['error'])) {
                    switch ($result['error']) {
                        case 'api_key_missing':
                        case 'invalid-key':
                            $statusCode = 400; // Bad Request
                            break;
                        case 'connection_error':
                            $statusCode = 503; // Service Unavailable
                            break;
                        default:
                            $statusCode = 500; // Internal Server Error
                    }
                }
                
                return response()->json([
                    'success' => false,
                    'error' => $result['message'],
                    'error_type' => $result['error'] ?? 'unknown',
                    'suggestion' => $this->getErrorSuggestion($result['error'] ?? 'unknown')
                ], $statusCode)
                    ->header('Content-Type', 'application/json');
            }
            
            // ✅ إبطال cache العملات بعد التحديث
            $this->clearCurrenciesCache();
            
            // ✅ جلب العملات المحدثة مباشرة من قاعدة البيانات
            $currencies = Currency::active()
                ->orderBy('currency_code')
                ->get();
            
            return response()->json([
                'success' => true,
                'message' => $result['message'],
                'updated_count' => $result['updated'],
                'timestamp' => $result['timestamp'],
                'currencies' => $currencies
            ], 200)
                ->header('Cache-Control', 'no-cache, must-revalidate');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث الأسعار',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * تحديث سعر عملة واحدة تلقائياً (Admin only)
     */
    public function updateSingleRateFromAPI(Request $request, $id)
    {
        try {
            $result = $this->exchangeService->updateSingleCurrency($id, $request->user()->id);
            
            if (!$result['success']) {
                // تحديد status code بناءً على نوع الخطأ
                $statusCode = 500;
                if (isset($result['error'])) {
                    switch ($result['error']) {
                        case 'api_key_missing':
                        case 'invalid-key':
                            $statusCode = 400; // Bad Request
                            break;
                        case 'connection_error':
                            $statusCode = 503; // Service Unavailable
                            break;
                        default:
                            $statusCode = 500; // Internal Server Error
                    }
                }
                
                return response()->json([
                    'success' => false,
                    'error' => $result['message'],
                    'error_type' => $result['error'] ?? 'unknown',
                    'suggestion' => $this->getErrorSuggestion($result['error'] ?? 'unknown')
                ], $statusCode)
                    ->header('Content-Type', 'application/json');
            }
            
            // ✅ إبطال cache العملات بعد التحديث
            $this->clearCurrenciesCache();
            
            // ✅ تحديث response ليتضمن البيانات المحدثة بشكل صحيح
            if (isset($result['currency'])) {
                $currency = $result['currency'];
                $result['data'] = [
                    'id' => $currency->id,
                    'currency_name' => $currency->currency_name_ar,
                    'currency_name_ar' => $currency->currency_name_ar,
                    'currency_name_en' => $currency->currency_name_en,
                    'currency_code' => $currency->currency_code,
                    'currency_symbol' => $currency->currency_symbol,
                    'exchange_rate_to_usd' => floatval($currency->exchange_rate_to_usd),
                    'is_active' => $currency->is_active,
                    'last_updated_by' => $currency->last_updated_by,
                    'created_at' => $currency->created_at->format('Y-m-d H:i:s'),
                    'updated_at' => $currency->updated_at->format('Y-m-d H:i:s'),
                ];
            }
            
            return response()->json($result, 200)
                ->header('Cache-Control', 'no-cache, must-revalidate');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث السعر',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * الحصول على اقتراح بناءً على نوع الخطأ
     */
    private function getErrorSuggestion($errorType): string
    {
        switch ($errorType) {
            case 'api_key_missing':
                return 'يرجى إضافة EXCHANGE_RATE_API_KEY في ملف .env. يمكنك الحصول على API Key مجاني من https://www.exchangerate-api.com/';
            case 'invalid-key':
                return 'API Key غير صحيح. يرجى التحقق من EXCHANGE_RATE_API_KEY في ملف .env';
            case 'connection_error':
                return 'فشل الاتصال بـ API الخارجي. يرجى التحقق من الاتصال بالإنترنت وإعادة المحاولة لاحقاً';
            case 'api_request_failed':
                return 'فشل الاتصال بـ API الخارجي. يرجى المحاولة لاحقاً';
            default:
                return 'إذا استمرت المشكلة، يرجى الاتصال بالدعم الفني.';
        }
    }

    /**
     * معلومات آخر تحديث
     */
    public function getLastUpdateInfo()
    {
        try {
            $info = $this->exchangeService->getLastUpdateInfo();
            
            return response()->json([
                'success' => true,
                'last_update' => $info
            ], 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب معلومات التحديث',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}

