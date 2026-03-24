<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectTimeline extends Model
{
    use HasFactory;

    public $timestamps = false; // نستخدم created_at فقط
    
    protected $table = 'project_timeline';

    protected $fillable = [
        'project_id',
        'old_status',
        'new_status',
        'changed_by',
        'notes',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    /**
     * Boot method لإضافة created_at تلقائياً
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            $model->created_at = now();
        });
    }

    /**
     * Get the project
     */
    public function project()
    {
        return $this->belongsTo(ProjectProposal::class, 'project_id');
    }

    /**
     * Get the user who changed the status
     */
    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}

