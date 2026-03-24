<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Currency extends Model
{
    use HasFactory;

    protected $fillable = [
        'currency_code',
        'currency_name_ar',
        'currency_name_en',
        'currency_symbol',
        'exchange_rate_to_usd',
        'is_active',
        'last_updated_by',
    ];

    protected $casts = [
        'exchange_rate_to_usd' => 'decimal:4',
        'is_active' => 'boolean',
    ];

    /**
     * Get the user who last updated this currency
     */
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'last_updated_by');
    }

    /**
     * Get all project proposals using this currency
     */
    public function projectProposals()
    {
        return $this->hasMany(ProjectProposal::class, 'currency_id');
    }

    /**
     * Convert amount to USD
     */
    public function convertToUSD($amount)
    {
        return round($amount * $this->exchange_rate_to_usd, 2);
    }

    /**
     * Update exchange rate
     */
    public function updateRate($newRate, $userId)
    {
        $this->exchange_rate_to_usd = $newRate;
        $this->last_updated_by = $userId;
        $this->save();
        
        return $this;
    }

    /**
     * Scope للعملات النشطة فقط
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}

