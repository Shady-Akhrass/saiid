<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class MediaArchive extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_proposal_id',
        'archive_type',
        'local_path',
        'notes',
        'archived_by',
        'archived_at',
        'project_name',
        'serial_number',
        'donor_name',
        'donor_code',
        'internal_code',
        'project_type',
        'team_name',
        'photographer_name',
        'producer_name',
        'execution_date',
    ];

    protected $casts = [
        'archived_at' => 'datetime',
        'execution_date' => 'date',
    ];

    // ==================== Relationships ====================

    /**
     * Get the project proposal that this archive belongs to
     */
    public function projectProposal()
    {
        return $this->belongsTo(ProjectProposal::class, 'project_proposal_id');
    }

    /**
     * Get the user who archived this
     */
    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by');
    }

    // ==================== Scopes ====================

    /**
     * Scope to filter archives before montage
     */
    public function scopeBeforeMontage(Builder $query)
    {
        return $query->where('archive_type', 'before_montage');
    }

    /**
     * Scope to filter archives after montage
     */
    public function scopeAfterMontage(Builder $query)
    {
        return $query->where('archive_type', 'after_montage');
    }

    /**
     * Scope to filter by project
     */
    public function scopeByProject(Builder $query, $projectId)
    {
        return $query->where('project_proposal_id', $projectId);
    }

    /**
     * Scope to filter by archive type
     */
    public function scopeByType(Builder $query, $type)
    {
        return $query->where('archive_type', $type);
    }

    /**
     * Scope to search in archive fields
     */
    public function scopeSearch(Builder $query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('project_name', 'LIKE', "%{$search}%")
              ->orWhere('serial_number', 'LIKE', "%{$search}%")
              ->orWhere('donor_name', 'LIKE', "%{$search}%")
              ->orWhere('donor_code', 'LIKE', "%{$search}%")
              ->orWhere('internal_code', 'LIKE', "%{$search}%")
              ->orWhere('team_name', 'LIKE', "%{$search}%")
              ->orWhere('photographer_name', 'LIKE', "%{$search}%")
              ->orWhere('producer_name', 'LIKE', "%{$search}%");
        });
    }
}
