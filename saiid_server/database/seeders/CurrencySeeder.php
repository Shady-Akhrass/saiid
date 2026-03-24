<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CurrencySeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $currencies = [
            [
                'currency_code' => 'USD',
                'currency_name_ar' => 'دولار أمريكي',
                'currency_name_en' => 'US Dollar',
                'currency_symbol' => '$',
                'exchange_rate_to_usd' => 1.0000,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'KWD',
                'currency_name_ar' => 'دينار كويتي',
                'currency_name_en' => 'Kuwaiti Dinar',
                'currency_symbol' => 'د.ك',
                'exchange_rate_to_usd' => 3.2700, // تقريبي
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'JOD',
                'currency_name_ar' => 'دينار أردني',
                'currency_name_en' => 'Jordanian Dinar',
                'currency_symbol' => 'د.أ',
                'exchange_rate_to_usd' => 1.4100,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'SAR',
                'currency_name_ar' => 'ريال سعودي',
                'currency_name_en' => 'Saudi Riyal',
                'currency_symbol' => 'ر.س',
                'exchange_rate_to_usd' => 0.2665,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'EUR',
                'currency_name_ar' => 'يورو',
                'currency_name_en' => 'Euro',
                'currency_symbol' => '€',
                'exchange_rate_to_usd' => 1.0900,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'GBP',
                'currency_name_ar' => 'جنيه إسترليني',
                'currency_name_en' => 'British Pound',
                'currency_symbol' => '£',
                'exchange_rate_to_usd' => 1.2700,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'TRY',
                'currency_name_ar' => 'ليرة تركية',
                'currency_name_en' => 'Turkish Lira',
                'currency_symbol' => '₺',
                'exchange_rate_to_usd' => 0.0300, // يتغير كثيراً
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'AED',
                'currency_name_ar' => 'درهم إماراتي',
                'currency_name_en' => 'UAE Dirham',
                'currency_symbol' => 'د.إ',
                'exchange_rate_to_usd' => 0.2720,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'QAR',
                'currency_name_ar' => 'ريال قطري',
                'currency_name_en' => 'Qatari Riyal',
                'currency_symbol' => 'ر.ق',
                'exchange_rate_to_usd' => 0.2747,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'EGP',
                'currency_name_ar' => 'جنيه مصري',
                'currency_name_en' => 'Egyptian Pound',
                'currency_symbol' => 'ج.م',
                'exchange_rate_to_usd' => 0.0200, // يتغير كثيراً
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        DB::table('currencies')->insert($currencies);
    }
}

