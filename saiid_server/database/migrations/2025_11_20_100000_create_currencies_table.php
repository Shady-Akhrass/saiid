<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('currencies', function (Blueprint $table) {
            $table->id();
            $table->string('currency_code', 3)->unique(); // KWD, JOD, USD, EUR, GBP, SAR
            $table->string('currency_name_ar');
            $table->string('currency_name_en');
            $table->string('currency_symbol', 10);
            $table->decimal('exchange_rate_to_usd', 10, 4); // سعر الصرف للدولار
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('last_updated_by')->nullable();
            $table->timestamps();

            // Foreign key
            $table->foreign('last_updated_by')->references('id')->on('users')->onDelete('set null');
            
            // Index
            $table->index('is_active');
        });

        // إدراج البيانات الأولية للعملات
        DB::table('currencies')->insert([
            [
                'currency_code' => 'KWD',
                'currency_name_ar' => 'دينار كويتي',
                'currency_name_en' => 'Kuwaiti Dinar',
                'currency_symbol' => 'د.ك',
                'exchange_rate_to_usd' => 3.26,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'JOD',
                'currency_name_ar' => 'دينار أردني',
                'currency_name_en' => 'Jordanian Dinar',
                'currency_symbol' => 'د.أ',
                'exchange_rate_to_usd' => 1.41,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'USD',
                'currency_name_ar' => 'دولار أمريكي',
                'currency_name_en' => 'US Dollar',
                'currency_symbol' => '$',
                'exchange_rate_to_usd' => 1.00,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'EUR',
                'currency_name_ar' => 'يورو',
                'currency_name_en' => 'Euro',
                'currency_symbol' => '€',
                'exchange_rate_to_usd' => 1.09,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'GBP',
                'currency_name_ar' => 'جنيه إسترليني',
                'currency_name_en' => 'British Pound',
                'currency_symbol' => '£',
                'exchange_rate_to_usd' => 1.27,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'currency_code' => 'SAR',
                'currency_name_ar' => 'ريال سعودي',
                'currency_name_en' => 'Saudi Riyal',
                'currency_symbol' => 'ر.س',
                'exchange_rate_to_usd' => 0.27,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('currencies');
    }
};

