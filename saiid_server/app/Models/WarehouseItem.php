<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WarehouseItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'item_name',
        'description',
        'quantity_available',
        'unit_price',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'quantity_available' => 'integer',
        'unit_price' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    // ==================== Relationships ====================

    /**
     * المستخدم الذي أنشأ الصنف
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * المستخدم الذي قام بآخر تحديث
     */
    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * المشاريع المرتبطة بهذا الصنف
     */
    public function projectWarehouseItems()
    {
        return $this->hasMany(ProjectWarehouseItem::class);
    }

    // ==================== Scopes ====================

    /**
     * الأصناف النشطة فقط
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * الأصناف المتوفرة (كمية أكبر من صفر)
     */
    public function scopeAvailable($query)
    {
        return $query->where('quantity_available', '>', 0);
    }

    /**
     * الأصناف التي تحتاج إلى إعادة توريد (كمية قليلة)
     */
    public function scopeLowStock($query, $threshold = 10)
    {
        return $query->where('quantity_available', '<=', $threshold)
                     ->where('quantity_available', '>', 0);
    }

    // ==================== Helper Methods ====================

    /**
     * التحقق من توفر الكمية المطلوبة
     */
    public function hasEnoughStock($quantity)
    {
        return $this->quantity_available >= $quantity;
    }

    /**
     * التحقق من حاجة الصنف لإعادة توريد
     */
    public function needsRestocking($threshold = 10)
    {
        return $this->quantity_available <= $threshold && $this->quantity_available > 0;
    }

    /**
     * حساب القيمة الإجمالية للصنف في المخزن
     */
    public function getTotalValueAttribute()
    {
        return round($this->quantity_available * $this->unit_price, 2);
    }

    /**
     * إضافة كمية للمخزن
     */
    public function addQuantity($quantity, $userId = null)
    {
        $this->quantity_available += $quantity;
        if ($userId) {
            $this->updated_by = $userId;
        }
        $this->save();
        return $this;
    }

    /**
     * خصم كمية من المخزن
     */
    public function subtractQuantity($quantity, $userId = null)
    {
        if ($this->quantity_available < $quantity) {
            throw new \Exception('الكمية المتوفرة غير كافية');
        }
        
        $this->quantity_available -= $quantity;
        if ($userId) {
            $this->updated_by = $userId;
        }
        $this->save();
        return $this;
    }
}
