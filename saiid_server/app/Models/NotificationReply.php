<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationReply extends Model
{
    use HasFactory;

    protected $table = 'notification_replies';

    protected $fillable = [
        'notification_id',
        'replied_by',
        'message',
        'rejection_reason',
    ];

    /**
     * العلاقة مع الإشعار
     */
    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class);
    }

    /**
     * العلاقة مع المستخدم الذي رد
     */
    public function repliedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'replied_by');
    }
}

