<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Collection;
use App\Models\SponsorshipItem;

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

    // ========== Currency Exchange Calculation ==========

    /**
     * Calculate total USD amount from items with their currency exchange rates
     */
    public function calculateTotalUsd(): float
    {
        $total = 0;
        
        foreach ($this->items as $item) {
            $cost = floatval($item->cost ?? 0);
            $exchangeRate = floatval($item->currency?->exchange_rate_to_usd ?? 1);
            $total += $cost * $exchangeRate;
        }
        
        return $total;
    }

    /**
     * Get currency breakdown for all items in this group
     */
    public function getCurrencyBreakdown(): array
    {
        $breakdown = [];
        
        foreach ($this->items as $item) {
            $currency = $item->currency;
            if (!$currency) continue;
            
            $code = $currency->currency_code ?? 'USD';
            $symbol = $currency->symbol ?? '$';
            $exchangeRate = floatval($currency->exchange_rate_to_usd ?? 1);
            $cost = floatval($item->cost ?? 0);
            
            if (!isset($breakdown[$code])) {
                $breakdown[$code] = [
                    'currency_code' => $code,
                    'symbol' => $symbol,
                    'exchange_rate_to_usd' => $exchangeRate,
                    'total_amount' => 0,
                    'total_usd' => 0,
                    'items_count' => 0,
                ];
            }
            
            $breakdown[$code]['total_amount'] += $cost;
            $breakdown[$code]['total_usd'] += $cost * $exchangeRate;
            $breakdown[$code]['items_count']++;
        }
        
        return array_values($breakdown);
    }

    /**
     * Create projects from sponsorship items with proper currency calculations
     */
    public function createAsProject(array $projectData): Collection
    {
        $projects = collect();
        $items = $this->items;
        
        // If specific item IDs are provided, filter items
        if (!empty($projectData['sponsorship_item_ids'])) {
            $items = $items->whereIn('id', $projectData['sponsorship_item_ids']);
        }
        
        foreach ($items as $item) {
            $projectDataForItem = $projectData;
            
            // Set project name based on item name or use provided name
            if (empty($projectDataForItem['project_name'])) {
                $projectDataForItem['project_name'] = $item->name;
            }
            
            // Calculate USD amount using exchange rate
            $cost = floatval($item->cost ?? 0);
            $exchangeRate = floatval($item->currency?->exchange_rate_to_usd ?? 1);
            $amountInUsd = $cost * $exchangeRate;
            
            // Add currency information to project data
            $projectDataForItem['original_currency_id'] = $item->currency_id;
            $projectDataForItem['original_cost'] = $cost;
            $projectDataForItem['amount_in_usd'] = $amountInUsd;
            $projectDataForItem['exchange_rate_used'] = $exchangeRate;
            
            // Create project (this would typically call a Project model or service)
            $project = $this->createProjectFromItem($item, $projectDataForItem);
            
            if ($project) {
                $projects->push($project);
            }
        }
        
        return $projects;
    }

    /**
     * Helper method to create a single project from a sponsorship item
     */
    private function createProjectFromItem(SponsorshipItem $item, array $projectData)
    {
        // This would typically create a Project model instance
        // For now, we'll return an array representing the project data
        return [
            'project_name' => $projectData['project_name'],
            'sponsorship_item_id' => $item->id,
            'sponsorship_item_name' => $item->name,
            'original_cost' => $projectData['original_cost'],
            'currency_id' => $projectData['original_currency_id'],
            'amount_in_usd' => $projectData['amount_in_usd'],
            'exchange_rate_used' => $projectData['exchange_rate_used'],
            'estimated_duration_days' => $projectData['estimated_duration_days'] ?? null,
            'project_type_id' => $projectData['project_type_id'] ?? null,
            'subcategory_id' => $projectData['subcategory_id'] ?? null,
            'orphans_count' => $item->orphans_count,
            'discount_percentage' => $item->discount_percentage ?? 0,
        ];
    }
}
