<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectWarehouseItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_proposal_id',
        'warehouse_item_id',
        'quantity_per_unit',
        'unit_price',
        'total_price_per_unit',
        'status',
    ];

    protected $casts = [
        'quantity_per_unit' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'total_price_per_unit' => 'decimal:2',
    ];

    // ==================== Boot Method ====================

    protected static function boot()
    {
        parent::boot();

        // حساب total_price_per_unit تلقائياً عند الإنشاء
        static::creating(function ($model) {
            $model->total_price_per_unit = round(
                $model->quantity_per_unit * $model->unit_price,
                2
            );
        });

        // حساب total_price_per_unit تلقائياً عند التحديث
        static::updating(function ($model) {
            if ($model->isDirty(['quantity_per_unit', 'unit_price'])) {
                $model->total_price_per_unit = round(
                    $model->quantity_per_unit * $model->unit_price,
                    2
                );
            }
        });
    }

    // ==================== Relationships ====================

    /**
     * المشروع المرتبط
     */
    public function projectProposal()
    {
        return $this->belongsTo(ProjectProposal::class);
    }

    /**
     * الصنف من المخزن
     */
    public function warehouseItem()
    {
        return $this->belongsTo(WarehouseItem::class);
    }

    // ==================== Scopes ====================

    /**
     * الأصناف المؤكدة فقط
     */
    public function scopeConfirmed($query)
    {
        return $query->where('status', 'confirmed');
    }

    /**
     * الأصناف المعلقة (في السلة)
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * الأصناف الملغاة
     */
    public function scopeCancelled($query)
    {
        return $query->where('status', 'cancelled');
    }

    // ==================== Helper Methods ====================

    /**
     * حساب الكمية الإجمالية المطلوبة للمشروع
     */
    public function getTotalQuantityNeeded()
    {
        $project = $this->projectProposal;
        if (!$project || !$project->quantity) {
            return 0;
        }
        return round($this->quantity_per_unit * $project->quantity, 2);
    }

    /**
     * حساب التكلفة الإجمالية لهذا الصنف في المشروع
     */
    public function getTotalCostForProject()
    {
        $project = $this->projectProposal;
        if (!$project || !$project->quantity) {
            return 0;
        }
        return round($this->total_price_per_unit * $project->quantity, 2);
    }
}
