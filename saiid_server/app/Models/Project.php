<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_name',
        'aid_type',
        'quantity',
        'shelter_id',
        'execution_date',
        'status',
        'source_project_id',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'execution_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the shelter that this project belongs to
     */
    public function shelter()
    {
        return $this->belongsTo(Shelter::class, 'shelter_id', 'manager_id_number');
    }

    /**
     * Get the source project proposal (if imported from project management system)
     */
    public function sourceProject()
    {
        return $this->belongsTo(ProjectProposal::class, 'source_project_id');
    }

    /**
     * Scope a query to only include incomplete projects
     */
    public function scopeIncomplete($query)
    {
        return $query->where('status', 'غير مكتمل');
    }

    /**
     * Scope a query to only include complete projects
     */
    public function scopeComplete($query)
    {
        return $query->where('status', 'مكتمل');
    }

    /**
     * Check if a shelter has any incomplete projects
     */
    public static function shelterHasIncompleteProjects($shelterId): bool
    {
        return self::where('shelter_id', $shelterId)
            ->where('status', 'غير مكتمل')
            ->exists();
    }
}
