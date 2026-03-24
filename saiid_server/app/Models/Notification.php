<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'project_id',
        'related_project_id',
        'notification_type',
        'title',
        'message',
        'is_read',
        'priority',
        'metadata',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the project
     */
    public function project()
    {
        return $this->belongsTo(ProjectProposal::class, 'project_id');
    }

    /**
     * Get the related project
     */
    public function relatedProject()
    {
        return $this->belongsTo(ProjectProposal::class, 'related_project_id');
    }

    /**
     * Get the reply for this notification
     */
    public function reply()
    {
        return $this->hasOne(NotificationReply::class, 'notification_id', 'id');
    }

    /**
     * Scope للإشعارات غير المقروءة
     */
    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    /**
     * Scope للإشعارات المقروءة
     */
    public function scopeRead($query)
    {
        return $query->where('is_read', true);
    }

    /**
     * Scope حسب المستخدم
     */
    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope حسب النوع
     */
    public function scopeByType($query, $type)
    {
        return $query->where('notification_type', $type);
    }

    /**
     * Scope حسب الأولوية
     */
    public function scopeHighPriority($query)
    {
        return $query->where('priority', 'high');
    }

    /**
     * Mark as read
     */
    public function markAsRead()
    {
        $this->is_read = true;
        $this->save();
    }

    /**
     * Mark as unread
     */
    public function markAsUnread()
    {
        $this->is_read = false;
        $this->save();
    }
}

