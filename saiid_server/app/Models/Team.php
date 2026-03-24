<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Team extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_name',
        'team_leader_id',
        'team_type',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get the team leader
     */
    public function leader()
    {
        return $this->belongsTo(User::class, 'team_leader_id');
    }

    /**
     * Get all team members (personnel)
     */
    public function members()
    {
        return $this->belongsToMany(TeamPersonnel::class, 'team_members', 'team_id', 'personnel_id')
                    ->withPivot('role_in_team', 'is_active')
                    ->withTimestamps();
    }

    /**
     * Get active members only
     */
    public function activeMembers()
    {
        return $this->belongsToMany(TeamPersonnel::class, 'team_members', 'team_id', 'personnel_id')
                    ->wherePivot('is_active', true)
                    ->withPivot('role_in_team', 'is_active')
                    ->withTimestamps();
    }

    /**
     * Get researchers (باحثين) in team
     */
    public function researchers()
    {
        return $this->belongsToMany(TeamPersonnel::class, 'team_members', 'team_id', 'personnel_id')
                    ->where('personnel_type', 'باحث')
                    ->wherePivot('is_active', true)
                    ->withPivot('role_in_team', 'is_active')
                    ->withTimestamps();
    }

    /**
     * Get photographers (مصورين) in team
     */
    public function photographers()
    {
        return $this->belongsToMany(TeamPersonnel::class, 'team_members', 'team_id', 'personnel_id')
                    ->where('personnel_type', 'مصور')
                    ->wherePivot('is_active', true)
                    ->withPivot('role_in_team', 'is_active')
                    ->withTimestamps();
    }

    /**
     * Get all projects assigned to this team
     */
    public function projectProposals()
    {
        return $this->hasMany(ProjectProposal::class, 'assigned_to_team_id');
    }

    /**
     * Scope للفرق النشطة فقط
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Check if team has incomplete projects
     */
    public function hasIncompleteProjects()
    {
        return $this->projectProposals()
                    ->whereIn('status', ['قيد التوزيع', 'جاهز للتنفيذ', 'قيد التنفيذ'])
                    ->exists();
    }

    /**
     * Check if team has at least one active researcher
     */
    public function hasActiveResearchers(): bool
    {
        return $this->researchers()->exists();
    }

    /**
     * Check if team has at least one active photographer
     */
    public function hasActivePhotographers(): bool
    {
        return $this->photographers()->exists();
    }

    /**
     * Check if team meets minimum composition (1 researcher + 1 photographer)
     */
    public function hasMinimumComposition(): bool
    {
        return $this->hasActiveResearchers() && $this->hasActivePhotographers();
    }
}

