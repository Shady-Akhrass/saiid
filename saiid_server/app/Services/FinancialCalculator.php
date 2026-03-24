<?php
// app/Services/FinancialCalculator.php

namespace App\Services;

class FinancialCalculator
{
    public function calculate(
        float $donationAmount,
        float $exchangeRate,
        float $discountPercent
    ): array {
        $donationAmount   = max(0, $donationAmount);
        $exchangeRate     = max(0, $exchangeRate);
        $discountPercent  = max(0, min(100, $discountPercent));

        $usd      = round($donationAmount * $exchangeRate, 2);
        $discount = round($usd * ($discountPercent / 100), 2);
        $net      = round($usd - $discount, 2);

        return [
            'amount_in_usd'   => $usd,
            'discount_amount' => $discount,
            'net_amount'      => max(0, $net),
        ];
    }
}