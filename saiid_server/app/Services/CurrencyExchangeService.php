<?php

namespace App\Services;

use App\Models\Currency;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CurrencyExchangeService
{
    /**
     * API Key - استخدم exchangerate-api.com (مجاني)
     * سجل على: https://www.exchangerate-api.com/
     */
    private $apiKey;
    private $baseUrl;

    public function __construct()
    {
        // ضع الـ API Key في .env
        $this->apiKey = env('EXCHANGE_RATE_API_KEY', 'your-api-key-here');
        $this->baseUrl = 'https://v6.exchangerate-api.com/v6';
    }

    /**
     * جلب أسعار العملات من API خارجي
     */
    public function fetchExchangeRates()
    {
        try {
            // التحقق من وجود API Key
            if (empty($this->apiKey) || $this->apiKey === 'your-api-key-here') {
                Log::error('API Key غير موجود في ملف .env');
                return [
                    'error' => 'api_key_missing',
                    'message' => 'API Key غير موجود. يرجى إضافة EXCHANGE_RATE_API_KEY في ملف .env'
                ];
            }

            // جلب الأسعار بالنسبة للدولار (USD)
            $response = Http::timeout(10)->get("{$this->baseUrl}/{$this->apiKey}/latest/USD");

            if (!$response->successful()) {
                $errorBody = $response->body();
                $statusCode = $response->status();
                
                Log::error('فشل جلب أسعار العملات من API', [
                    'status' => $statusCode,
                    'body' => $errorBody,
                    'api_key_set' => !empty($this->apiKey)
                ]);
                
                // محاولة تحليل الخطأ
                $errorData = $response->json();
                if (isset($errorData['error-type'])) {
                    return [
                        'error' => $errorData['error-type'],
                        'message' => $errorData['error-type'] === 'invalid-key' 
                            ? 'API Key غير صحيح. يرجى التحقق من EXCHANGE_RATE_API_KEY في ملف .env'
                            : 'فشل الاتصال بـ API الخارجي'
                    ];
                }
                
                return [
                    'error' => 'api_request_failed',
                    'message' => "فشل الاتصال بـ API (Status: {$statusCode})"
                ];
            }

            $data = $response->json();

            if (!isset($data['result']) || $data['result'] !== 'success') {
                $errorType = $data['error-type'] ?? 'unknown';
                Log::error('API أرجع خطأ', [
                    'data' => $data,
                    'error_type' => $errorType
                ]);
                
                return [
                    'error' => $errorType,
                    'message' => $errorType === 'invalid-key' 
                        ? 'API Key غير صحيح'
                        : 'فشل جلب الأسعار من API'
                ];
            }

            return $data['conversion_rates'];

        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('خطأ في الاتصال بـ API: ' . $e->getMessage());
            return [
                'error' => 'connection_error',
                'message' => 'فشل الاتصال بـ API الخارجي. يرجى التحقق من الاتصال بالإنترنت'
            ];
        } catch (\Exception $e) {
            Log::error('خطأ في جلب أسعار العملات: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return [
                'error' => 'unknown_error',
                'message' => 'حدث خطأ غير متوقع: ' . $e->getMessage()
            ];
        }
    }

    /**
     * تحديث أسعار العملات في قاعدة البيانات
     */
    public function updateAllCurrencyRates($userId = null)
    {
        $rates = $this->fetchExchangeRates();

        // التحقق من وجود خطأ في النتيجة
        if (!$rates || (is_array($rates) && isset($rates['error']))) {
            $errorMessage = is_array($rates) && isset($rates['message']) 
                ? $rates['message'] 
                : 'فشل جلب الأسعار من API';
            
            return [
                'success' => false,
                'message' => $errorMessage,
                'error' => is_array($rates) && isset($rates['error']) ? $rates['error'] : 'unknown',
                'updated' => 0
            ];
        }

        $updated = 0;
        $currencies = Currency::active()->get();

        foreach ($currencies as $currency) {
            $code = $currency->currency_code;

            // التحقق من وجود السعر في الـ API
            if (!isset($rates[$code])) {
                continue;
            }

            // API يعطي سعر العملة مقابل الدولار
            // نحن نحتاج سعر الدولار مقابل العملة
            // إذا كان USD = 1, SAR = 3.75
            // نحن نريد: 1 SAR = كم دولار؟ → 1/3.75 = 0.2666
            $apiRate = $rates[$code];
            $exchangeRateToUSD = ($code === 'USD') ? 1.0000 : (1 / $apiRate);

            $oldRate = $currency->exchange_rate_to_usd;
            
            $currency->exchange_rate_to_usd = round($exchangeRateToUSD, 4);
            $currency->last_updated_by = $userId;
            $currency->save();

            $updated++;

            Log::info("تم تحديث {$code}: من {$oldRate} إلى {$currency->exchange_rate_to_usd}");
        }

        return [
            'success' => true,
            'message' => "تم تحديث {$updated} عملة بنجاح",
            'updated' => $updated,
            'timestamp' => now()->format('Y-m-d H:i:s')
        ];
    }

    /**
     * تحديث عملة واحدة فقط
     */
    public function updateSingleCurrency($currencyId, $userId = null)
    {
        $rates = $this->fetchExchangeRates();

        // التحقق من وجود خطأ في النتيجة
        if (!$rates || (is_array($rates) && isset($rates['error']))) {
            $errorMessage = is_array($rates) && isset($rates['message']) 
                ? $rates['message'] 
                : 'فشل جلب الأسعار من API';
            
            return [
                'success' => false,
                'message' => $errorMessage,
                'error' => is_array($rates) && isset($rates['error']) ? $rates['error'] : 'unknown'
            ];
        }

        $currency = Currency::findOrFail($currencyId);
        $code = $currency->currency_code;

        if (!isset($rates[$code])) {
            return [
                'success' => false,
                'message' => "العملة {$code} غير متوفرة في API"
            ];
        }

        $apiRate = $rates[$code];
        $exchangeRateToUSD = ($code === 'USD') ? 1.0000 : (1 / $apiRate);

        $oldRate = $currency->exchange_rate_to_usd;
        
        $currency->exchange_rate_to_usd = round($exchangeRateToUSD, 4);
        $currency->last_updated_by = $userId;
        $currency->save();

        return [
            'success' => true,
            'message' => "تم تحديث {$code} من {$oldRate} إلى {$currency->exchange_rate_to_usd}",
            'currency' => $currency,
            'old_rate' => $oldRate,
            'new_rate' => $currency->exchange_rate_to_usd
        ];
    }

    /**
     * جلب آخر تحديث للعملات
     */
    public function getLastUpdateInfo()
    {
        $lastUpdated = Currency::orderBy('updated_at', 'DESC')->first();

        if (!$lastUpdated) {
            return null;
        }

        return [
            'last_updated_at' => $lastUpdated->updated_at->format('Y-m-d H:i:s'),
            'last_updated_by' => $lastUpdated->lastUpdatedBy ? $lastUpdated->lastUpdatedBy->name : 'النظام',
            'human_readable' => $lastUpdated->updated_at->locale('ar')->diffForHumans()
        ];
    }
}

