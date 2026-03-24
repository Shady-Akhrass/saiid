<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TeamPersonnel extends Model
{
    use HasFactory;

    protected $table = 'team_personnel'; // ✅ تحديد اسم الجدول بشكل صريح

    protected $fillable = [
        'name',
        'phone_number',
        'personnel_type',
        'department',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get all teams this personnel belongs to
     */
    public function teams()
    {
        return $this->belongsToMany(Team::class, 'team_members', 'personnel_id', 'team_id')
                    ->withPivot('role_in_team', 'is_active')
                    ->withTimestamps();
    }

    /**
     * Scope للباحثين فقط
     */
    public function scopeResearchers($query)
    {
        return $query->where('personnel_type', 'باحث');
    }

    /**
     * Scope للمصورين فقط
     */
    public function scopePhotographers($query)
    {
        return $query->where('personnel_type', 'مصور');
    }

    /**
     * Scope للنشطين فقط
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get all projects assigned to this personnel as researcher
     */
    public function assignedProjectsAsResearcher()
    {
        return $this->hasMany(ProjectProposal::class, 'assigned_researcher_id');
    }

    /**
     * Get all projects assigned to this personnel as photographer
     */
    public function assignedProjectsAsPhotographer()
    {
        return $this->hasMany(ProjectProposal::class, 'assigned_photographer_id');
    }
}
