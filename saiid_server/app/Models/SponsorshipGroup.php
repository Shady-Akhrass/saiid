<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class SponsorshipGroup extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'total_orphans',
        'total_cost',
        'notes',
    ];

    protected $casts = [
        'total_orphans' => 'integer',
        'total_cost' => 'decimal:2',
    ];

    // ========== Relationships ==========

    public function items()
    {
        return $this->hasMany(SponsorshipItem::class);
    }

    // ========== Auto-generate code ==========

    /**
     * Generate a sequential code like: {name}-O-0001
     */
    public static function generateCode(string $name): string
    {
        $prefix = $name . '-O-';

        // Find the last code with this prefix
        $lastGroup = self::where('code', 'like', $prefix . '%')
            ->orderByRaw('CAST(SUBSTRING(code, ?) AS UNSIGNED) DESC', [strlen($prefix) + 1])
            ->first();

        if ($lastGroup) {
            // Extract the numeric part and increment
            $lastNumber = (int) substr($lastGroup->code, strlen($prefix));
            $nextNumber = $lastNumber + 1;
        } else {
            $nextNumber = 1;
        }

        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    // ========== Recalculate totals ==========

    public function recalculateTotals(): void
    {
        $this->total_orphans = $this->items()->sum('orphans_count');
        $this->total_cost = $this->items()->sum('amount_in_usd');
        $this->save();
    }
}
