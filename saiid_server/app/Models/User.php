<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'department',
        'is_active',
        'phone_number',
        'added_by',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    // ==================== Relationships ====================

    /**
     * Get teams where user is a leader
     */
    public function ledTeams()
    {
        return $this->hasMany(Team::class , 'team_leader_id');
    }

    /**
     * Get teams where user is a member
     */
    public function teams()
    {
        return $this->belongsToMany(Team::class , 'team_members', 'user_id', 'team_id')
            ->withPivot('role_in_team', 'is_active')
            ->withTimestamps();
    }

    /**
     * Get projects created by this user
     */
    public function createdProjects()
    {
        return $this->hasMany(ProjectProposal::class , 'created_by');
    }

    /**
     * Get projects assigned by this user (for project managers)
     */
    public function assignedProjects()
    {
        return $this->hasMany(ProjectProposal::class , 'assigned_by');
    }

    /**
     * Get projects where user is photographer
     */
    public function photographyProjects()
    {
        return $this->hasMany(ProjectProposal::class , 'assigned_photographer_id');
    }

    /**
     * Get notifications for this user
     */
    public function notifications()
    {
        return $this->hasMany(Notification::class , 'user_id');
    }

    /**
     * Get unread notifications
     */
    public function unreadNotifications()
    {
        return $this->hasMany(Notification::class , 'user_id')->where('is_read', false);
    }

    /**
     * Get users added by this user
     */
    public function addedUsers()
    {
        return $this->hasMany(User::class , 'added_by');
    }

    /**
     * Get the user who added this user
     */
    public function addedBy()
    {
        return $this->belongsTo(User::class , 'added_by');
    }

    // ==================== Helper Methods ====================

    /**
     * Check if user is admin
     */
    public function isAdmin()
    {
        return $this->role === 'admin';
    }

    /**
     * Check if user is project manager
     */
    public function isProjectManager()
    {
        return $this->role === 'project_manager';
    }

    /**
     * Check if user is media manager
     */
    public function isMediaManager()
    {
        return $this->role === 'media_manager';
    }

    /**
     * Check if user is photographer
     */
    public function isPhotographer()
    {
        return $this->role === 'photographer';
    }

    /**
     * Check if user is executor
     */
    public function isExecutor()
    {
        return $this->role === 'executor';
    }

    /**
     * Check if user is executed projects coordinator
     */
    public function isExecutedProjectsCoordinator()
    {
        return $this->role === 'executed_projects_coordinator';
    }

    /**
     * Check if user is montage producer
     */
    public function isMontageProducer()
    {
        return $this->role === 'montage_producer';
    }

    /**
     * Get projects assigned to this montage producer
     */
    public function montageProducerProjects()
    {
        return $this->hasMany(ProjectProposal::class , 'assigned_montage_producer_id');
    }

    /**
     * Check if user is orphan sponsor coordinator
     */
    public function isOrphanSponsorCoordinator()
    {
        return $this->role === 'orphan_sponsor_coordinator';
    }

    /**
     * Scope للمستخدمين النشطين
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope حسب الدور
     */
    public function scopeByRole($query, $role)
    {
        return $query->where('role', $role);
    }

    /**
     * Scope حسب القسم
     */
    public function scopeByDepartment($query, $department)
    {
        return $query->where('department', $department);
    }

    /**
     * Scope لمنسقي الكفالات
     */
    public function scopeOrphanSponsorCoordinators($query)
    {
        return $query->where('role', 'orphan_sponsor_coordinator');
    }
}
