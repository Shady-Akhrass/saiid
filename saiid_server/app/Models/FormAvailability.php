<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class FormAvailability extends Model
{
    // Use UUID primary key
    protected $keyType = 'string';
    public $incrementing = false;
    protected $primaryKey = 'id';

    protected $fillable = [
        'type',
        'is_available',
    ];

    protected $casts = [
        'is_available' => 'boolean',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    // Route model binding by UUID
    public function getRouteKeyName()
    {
        return 'id';
    }
}
