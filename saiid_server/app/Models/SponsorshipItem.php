<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class SponsorshipItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sponsorship_group_id',
        'name',
        'donor_code',
        'orphans_count',
        'cost',
        'discount_percentage',
        'currency_id',
        'amount_in_usd',
        'images',
        'notes',
    ];

    protected $casts = [
        'orphans_count' => 'integer',
        'cost' => 'decimal:2',
        'discount_percentage' => 'decimal:2',
        'amount_in_usd' => 'decimal:2',
        'images' => 'array',
    ];

    // ========== Relationships ==========

    public function group()
    {
        return $this->belongsTo(SponsorshipGroup::class, 'sponsorship_group_id');
    }

    public function currency()
    {
        return $this->belongsTo(Currency::class);
    }

    // ========== Boot: auto-recalculate group totals ==========

    protected static function booted()
    {
        static::saved(function (SponsorshipItem $item) {
            $item->group->recalculateTotals();
        });

        static::deleted(function (SponsorshipItem $item) {
            $item->group->recalculateTotals();
        });
    }
}
