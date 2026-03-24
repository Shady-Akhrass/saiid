<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\NotificationReply;
use App\Models\ProjectProposal;
use App\Helpers\NotificationHelper;
use App\Traits\CacheableResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    use CacheableResponse;

    /**
     * Get user notifications
     */
    public function index(Request $request)
    {
        try {
            // ✅ التحقق من وجود المستخدم
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'يجب تسجيل الدخول للوصول إلى الإشعارات',
                    'notifications' => [],
                    'data' => [],
                    'total' => 0,
                    'unread_count' => 0
                ], 401);
            }
            
            // زيادة timeout للاستعلامات الطويلة
            set_time_limit(60); // 60 ثانية
            
            $userId = $user->id;
            
            // Notifications change frequently, cache for 1 minute only
            $cacheKey = $this->buildCacheKey('notifications', $request, $userId, $user->role ?? 'guest');
            
            return $this->getCachedResponse($cacheKey, function() use ($request, $userId) {
                // ✅ استخدام select لتقليل حجم البيانات
                $query = Notification::where('user_id', $userId)
                    ->select([
                        'id', 'user_id', 'project_id', 'related_project_id', 
                        'notification_type', 'title', 'message', 'is_read', 
                        'priority', 'metadata', 'created_at', 'updated_at'
                    ]);
                
                // فلترة حسب حالة القراءة
                if ($request->has('unread_only') && $request->unread_only) {
                    $query->where('is_read', false);
                }
                
                // ✅ تحديد حد أقصى لعدد العناصر في الصفحة لتجنب timeout
                // ✅ زيادة الحد الأقصى إلى 100 لتجنب مشاكل مع Frontend
                $perPage = min(max(1, (int) $request->query('perPage', 20)), 100);
                
                // ✅ تحميل المشروع والرد مع الحقول الأساسية فقط لتقليل حجم البيانات
                // ✅ استخدام relatedProject بدلاً من project لأن معظم الإشعارات تستخدم related_project_id
                $notifications = $query->with([
                        'relatedProject' => function ($q) {
                            $q->select('id', 'serial_number', 'project_name', 'status');
                        },
                        'project' => function ($q) {
                            $q->select('id', 'serial_number', 'project_name', 'status');
                        },
                        'reply' => function ($q) {
                            $q->select('id', 'notification_id', 'replied_by', 'message', 'rejection_reason', 'created_at');
                        }
                    ])
                    ->orderBy('created_at', 'DESC')
                    ->paginate($perPage);
                
                // حساب العدد في استعلام واحد محسّن مع timeout
                try {
                    $unreadCount = Notification::where('user_id', $userId)
                                              ->where('is_read', false)
                                              ->count();
                } catch (\Exception $e) {
                    // إذا فشل حساب العدد، استخدم 0
                    Log::warning('Failed to count unread notifications', [
                        'user_id' => $userId,
                        'error' => $e->getMessage()
                    ]);
                    $unreadCount = 0;
                }
                
                // إضافة معلومات الرد لكل إشعار
                $notificationsData = $notifications->items();
                foreach ($notificationsData as $notification) {
                    // إضافة حقل يشير إلى حالة الرد
                    if ($notification->reply) {
                        $notification->is_accepted = $notification->reply->rejection_reason === 'مقبول';
                        $notification->is_replied = true;
                        $notification->reply_status = $notification->reply->rejection_reason === 'مقبول' ? 'accepted' : 'rejected';
                    } else {
                        $notification->is_accepted = false;
                        $notification->is_replied = false;
                        $notification->reply_status = null;
                    }
                }
                
                return [
                    'success' => true,
                    'notifications' => $notificationsData,
                    'data' => $notificationsData, // للتوافق مع Frontend
                    'total' => $notifications->total(),
                    'unread_count' => $unreadCount
                ];
            }, 60); // 1 minute cache for notifications
            
        } catch (\Illuminate\Database\QueryException $e) {
            // خطأ في قاعدة البيانات (مثل timeout)
            Log::error('Database error fetching notifications', [
                'user_id' => $request->user()?->id ?? null,
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
                'sql' => $e->getSql() ?? null
            ]);
            
            // إذا كان timeout، أعد استجابة فارغة بدلاً من خطأ
            if (str_contains($e->getMessage(), 'timeout') || str_contains($e->getMessage(), 'timed out')) {
                return response()->json([
                    'success' => true,
                    'notifications' => [],
                    'data' => [],
                    'total' => 0,
                    'unread_count' => 0,
                    'message' => 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.'
                ], 200);
            }
            
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الإشعارات',
                'message' => 'حدث خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.'
            ], 500);
        } catch (\Exception $e) {
            Log::error('Error fetching notifications', [
                'user_id' => $request->user()?->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // ✅ إرجاع استجابة آمنة بدلاً من خطأ 500
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الإشعارات',
                'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ أثناء جلب الإشعارات',
                'notifications' => [],
                'data' => [],
                'total' => 0,
                'unread_count' => 0
            ], 500);
        }
    }
    
    /**
     * Get unread count
     */
    public function unreadCount(Request $request)
    {
        try {
            set_time_limit(30);
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'count' => 0,
                    'unread_count' => 0
                ], 401);
            }
            try {
                $count = Notification::where('user_id', $user->id)
                                    ->where('is_read', false)
                                    ->count();
            } catch (\Illuminate\Database\QueryException $e) {
                if (str_contains($e->getMessage(), 'timeout') || 
                    str_contains($e->getMessage(), 'timed out') ||
                    str_contains($e->getMessage(), 'Connection') ||
                    str_contains($e->getMessage(), 'closed')) {
                    Log::warning('Connection timeout/closed in unreadCount, returning 0', [
                        'user_id' => $user->id,
                        'error' => $e->getMessage()
                    ]);
                    return response()->json([
                        'success' => true,
                        'count' => 0,
                        'unread_count' => 0,
                        'message' => 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.'
                    ], 200);
                }
                throw $e;
            }
            return response()->json([
                'success' => true,
                'count' => $count,
                'unread_count' => $count
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching unread count', [
                'user_id' => $request->user()?->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => true,
                'count' => 0,
                'unread_count' => 0,
                'error' => 'فشل جلب العدد',
                'message' => config('app.debug') ? $e->getMessage() : 'حدث خطأ أثناء جلب عدد الإشعارات'
            ], 200);
        }
    }
    
    /**
     * Mark notification as read
     */
    public function markAsRead($id)
    {
        try {
            $notification = Notification::findOrFail($id);
            
            // التأكد من أن الإشعار يخص المستخدم الحالي
            if ($notification->user_id !== auth()->id()) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'غير مصرح لك'
                ], 403);
            }
            
            $notification->update(['is_read' => true]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث الإشعار'
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error marking notification as read', [
                'notification_id' => $id,
                'user_id' => auth()->id(),
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث الإشعار',
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Mark all notifications as read
     */
    public function markAllAsRead(Request $request)
    {
        try {
            Notification::where('user_id', $request->user()->id)
                       ->where('is_read', false)
                       ->update(['is_read' => true]);
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث جميع الإشعارات'
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error marking all notifications as read', [
                'user_id' => $request->user()->id ?? null,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث الإشعارات',
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Delete notification
     */
    public function destroy($id)
    {
        try {
            $notification = Notification::findOrFail($id);
            
            // التأكد من أن الإشعار يخص المستخدم الحالي
            if ($notification->user_id !== auth()->id()) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح'
                ], 403);
            }
            
            $notification->delete();
            
            return response()->json([
                'success' => true,
                'message' => 'تم حذف الإشعار'
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('Error deleting notification', [
                'notification_id' => $id,
                'user_id' => auth()->id(),
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل حذف الإشعار',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get media-specific notifications (Media Manager only)
     */
    public function getMediaNotifications(Request $request)
    {
        // التحقق من أن المستخدم هو Media Manager
        $user = $request->user();
        if (!$user || $user->role !== 'media_manager') {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات للوصول إلى إشعارات الإعلام. الصلاحيات مقتصرة على مدير الإعلام فقط.'
            ], 403);
        }
        
        try {
            // زيادة timeout للاستعلامات الطويلة
            set_time_limit(60); // 60 ثانية
            
            $notificationTypes = [
                'ready_for_montage',
                'delay_montage',
                'montage_reminder',
                'media_rejected',
                'media_accepted'
            ];
            
            $baseQuery = Notification::where('user_id', $user->id)
                                ->whereIn('notification_type', $notificationTypes);
            
            // فلترة حسب حالة القراءة
            $query = clone $baseQuery;
            if ($request->has('unread_only') && $request->unread_only) {
                $query->where('is_read', false);
            }
            
            // تحديد حد أقصى لعدد العناصر في الصفحة لتجنب timeout
            $perPage = min((int) $request->query('perPage', 20), 50);
            
            // تحميل المشروع والرد مع الحقول الأساسية فقط لتقليل حجم البيانات
            $notifications = $query->with([
                    'project' => function ($q) {
                        $q->select('id', 'serial_number', 'project_name', 'status', 'media_received_date', 'montage_start_date');
                    },
                    'reply' => function ($q) {
                        $q->select('id', 'notification_id', 'replied_by', 'message', 'rejection_reason', 'created_at');
                    }
                ])
                ->orderBy('created_at', 'DESC')
                ->paginate($perPage);
            
            // حساب جميع الإحصائيات في استعلام واحد محسّن
            $statistics = Notification::where('user_id', $user->id)
                ->whereIn('notification_type', $notificationTypes)
                ->where('is_read', false)
                ->selectRaw('
                    notification_type,
                    COUNT(*) as count
                ')
                ->groupBy('notification_type')
                ->pluck('count', 'notification_type')
                ->toArray();
            
            // حساب العدد الإجمالي للإشعارات غير المقروءة
            $unreadCount = Notification::where('user_id', $user->id)
                ->whereIn('notification_type', $notificationTypes)
                ->where('is_read', false)
                ->count();
            
            // إضافة معلومات الرد لكل إشعار
            $notificationsData = $notifications->items();
            foreach ($notificationsData as $notification) {
                // إضافة حقل يشير إلى حالة الرد
                if ($notification->reply) {
                    $notification->is_accepted = $notification->reply->rejection_reason === 'مقبول';
                    $notification->is_replied = true;
                    $notification->reply_status = $notification->reply->rejection_reason === 'مقبول' ? 'accepted' : 'rejected';
                } else {
                    $notification->is_accepted = false;
                    $notification->is_replied = false;
                    $notification->reply_status = null;
                }
            }
            
            return response()->json([
                'success' => true,
                'notifications' => $notificationsData,
                'data' => $notificationsData, // للتوافق مع Frontend
                'total' => $notifications->total(),
                'unread_count' => $unreadCount,
                'statistics' => [
                    'ready_for_montage' => $statistics['ready_for_montage'] ?? 0,
                    'delayed' => $statistics['delay_montage'] ?? 0,
                    'reminders' => $statistics['montage_reminder'] ?? 0,
                    'rejected' => $statistics['media_rejected'] ?? 0,
                    'accepted' => $statistics['media_accepted'] ?? 0,
                ]
            ], 200);
            
        } catch (\Illuminate\Database\QueryException $e) {
            // خطأ في قاعدة البيانات (مثل timeout)
            Log::error('Database error fetching media notifications', [
                'user_id' => $user->id ?? null,
                'error' => $e->getMessage(),
                'code' => $e->getCode()
            ]);
            
            // إذا كان timeout، أعد استجابة فارغة بدلاً من خطأ
            if (str_contains($e->getMessage(), 'timeout') || str_contains($e->getMessage(), 'timed out')) {
                return response()->json([
                    'success' => true,
                    'notifications' => [],
                    'data' => [],
                    'total' => 0,
                    'unread_count' => 0,
                    'statistics' => [
                        'ready_for_montage' => 0,
                        'delayed' => 0,
                        'reminders' => 0,
                        'rejected' => 0,
                        'accepted' => 0,
                    ],
                    'message' => 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.'
                ], 200);
            }
            
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الإشعارات',
                'message' => 'حدث خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.'
            ], 500);
        } catch (\Exception $e) {
            Log::error('Error fetching media notifications', [
                'user_id' => $user->id ?? null,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الإشعارات',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * قبول المونتاج ونقل المشروع إلى حالة "وصل للمتبرع"
     * فقط الإدارة يمكنها قبول إشعارات media_completed
     */
    public function accept(Request $request, $id)
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح لك'
            ], 401);
        }
        
        // التحقق من أن المستخدم admin
        if ($user->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'ليس لديك صلاحيات لقبول المونتاج'
            ], 403);
        }
        
        // التحقق من وجود الإشعار
        // ✅ Admin يمكنه الموافقة على أي إشعار (ليس فقط إشعاراته)
        $notification = Notification::find($id);
        
        if (!$notification) {
            Log::warning('Notification not found for accept', [
                'notification_id' => $id,
                'user_id' => $user->id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'الإشعار غير موجود'
            ], 404);
        }
        
        // التحقق من نوع الإشعار
        $notificationType = trim($notification->notification_type ?? $notification->type ?? '');
        if ($notificationType !== 'media_completed') {
            Log::warning('Invalid notification type for accept', [
                'notification_id' => $id,
                'expected_type' => 'media_completed',
                'actual_type' => $notificationType,
                'notification_type_raw' => $notification->notification_type,
                'type_raw' => $notification->type ?? 'N/A',
            ]);
            return response()->json([
                'success' => false,
                'message' => 'يمكن قبول فقط إشعارات اكتمال المونتاج. نوع الإشعار الحالي: ' . ($notificationType ?: 'غير محدد'),
                'debug' => [
                    'notification_type' => $notificationType,
                    'notification_type_raw' => $notification->notification_type,
                    'type_raw' => $notification->type ?? null,
                    'expected' => 'media_completed',
                ]
            ], 400);
        }
        
        // جلب المشروع أولاً للتحقق من حالته
        $projectId = $notification->related_project_id ?? $notification->project_id ?? null;
        if (!$projectId) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود في الإشعار'
            ], 404);
        }
        
        $project = ProjectProposal::find($projectId);
        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        }
        
        // التحقق من حالة المشروع - إذا كان بالفعل "منتهي"، نعطي رسالة مختلفة
        if ($project->status === 'منتهي') {
            return response()->json([
                'success' => false,
                'message' => 'تم قبول هذا المونتاج مسبقاً والمشروع في حالة "منتهي"'
            ], 400);
        }
        
        // ✅ إذا كان المشروع في حالة "وصل للمتبرع"، نحوله إلى "منتهي"
        // ✅ جميع المشاريع (مقسمة وغير مقسمة) تتبع نفس المنطق
        $shouldComplete = ($project->status === 'وصل للمتبرع');
        
        // التحقق من وجود رد سابق
        $existingReply = NotificationReply::where('notification_id', $notification->id)->first();
        if ($existingReply) {
                // إذا كان الرد السابق هو قبول (rejection_reason = 'مقبول')
            if ($existingReply->rejection_reason === 'مقبول') {
                // إذا كان المشروع لم يتم تحديثه (محاولة سابقة فاشلة)، نحذف الرد ونعيد المحاولة
                if ($project->status !== 'وصل للمتبرع' && $project->status !== 'منتهي') {
                    $existingReply->delete();
                    Log::info('Deleted previous failed acceptance reply', [
                        'notification_id' => $id,
                        'reply_id' => $existingReply->id,
                        'project_status' => $project->status,
                    ]);
                } else {
                    // المشروع تم تحديثه بالفعل
                    $statusMessage = $project->status === 'منتهي' 
                        ? 'تم قبول هذا المونتاج مسبقاً والمشروع في حالة "منتهي"'
                        : 'تم قبول هذا المونتاج مسبقاً والمشروع في حالة "وصل للمتبرع"';
                    return response()->json([
                        'success' => false,
                        'message' => $statusMessage
                    ], 400);
                }
            } else {
                // إذا كان الرد السابق هو رفض، نمنع القبول
                Log::warning('Notification already rejected', [
                    'notification_id' => $id,
                    'reply_id' => $existingReply->id,
                    'rejection_reason' => $existingReply->rejection_reason,
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'تم رفض هذا المونتاج مسبقاً. لا يمكن قبوله الآن.'
                ], 400);
            }
        }
        
        // حفظ حالة المشروع القديمة
        $oldStatus = $project->status;
        
        // ✅ تحديد الحالة الجديدة بناءً على الحالة الحالية
        // ✅ جميع المشاريع (مقسمة وغير مقسمة) تتبع نفس المنطق
        if ($shouldComplete) {
            // تحويل من "وصل للمتبرع" إلى "منتهي"
            $newStatus = 'منتهي';
            $statusMessage = 'تم قبول المونتاج ونقل المشروع إلى حالة "منتهي"';
        } else {
            // تحويل إلى "وصل للمتبرع" (من أي حالة أخرى مثل "تم المونتاج")
            $newStatus = 'وصل للمتبرع';
            $statusMessage = 'تم قبول المونتاج ونقل المشروع إلى حالة "وصل للمتبرع"';
        }
        
        // تحديث حالة المشروع
        // ✅ السماح بتحديث المشاريع اليومية عند قبول المونتاج
        $updateData = [
            'status' => $newStatus,
            'updated_at' => now(),
        ];
        
        // إذا كان التحويل إلى "وصل للمتبرع"، نسجل تاريخ وصول المشروع للمتبرع
        if (!$shouldComplete) {
            $updateData['sent_to_donor_date'] = now()->toDateString();
        } else {
            // ✅ إذا كان التحويل إلى "منتهي"، نسجل تاريخ الإنتهاء
            $updateData['completed_date'] = now()->toDateString();
        }
        
        // ✅ التحقق من البيانات قبل التحديث
        $beforeUpdate = DB::table('project_proposals')
            ->where('id', $project->id)
            ->first();
        
        Log::info('🔵 BEFORE UPDATE - Project status in DB', [
            'project_id' => $project->id,
            'current_status' => $beforeUpdate->status,
            'target_status' => $newStatus,
            'update_data' => $updateData,
            'is_daily_phase' => $project->is_daily_phase,
            'is_monthly_phase' => $project->is_monthly_phase,
            'should_complete' => $shouldComplete,
        ]);
        
        // ✅ استخدام transaction صريح لضمان حفظ التحديث
        DB::beginTransaction();
        
        try {
            // ✅ استخدام DB::table() مباشرة لتجاوز أي تحقق في Model Events
            $updated = DB::table('project_proposals')
                ->where('id', $project->id)
                ->update($updateData);
            
            Log::info('🟡 UPDATE EXECUTED', [
                'project_id' => $project->id,
                'rows_affected' => $updated,
                'update_data' => $updateData,
            ]);
            
            if (!$updated) {
                DB::rollBack();
                Log::error('❌ DB::table update returned 0 rows affected', [
                    'project_id' => $project->id,
                    'update_data' => $updateData,
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'فشل تحديث حالة المشروع. يرجى المحاولة مرة أخرى.'
                ], 500);
            }
            
            // ✅ Commit التغييرات فوراً
            DB::commit();
            
            Log::info('✅ TRANSACTION COMMITTED', [
                'project_id' => $project->id,
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ EXCEPTION during update', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تحديث المشروع: ' . $e->getMessage()
            ], 500);
        }
        
        // ✅ التحقق المباشر من قاعدة البيانات بعد commit
        $dbRecord = DB::table('project_proposals')
            ->where('id', $project->id)
            ->first();
        
        Log::info('🟢 AFTER COMMIT - Project status in DB', [
            'project_id' => $project->id,
            'expected_status' => $newStatus,
            'actual_db_status' => $dbRecord->status,
            'db_completed_date' => $dbRecord->completed_date ?? null,
            'db_sent_to_donor_date' => $dbRecord->sent_to_donor_date ?? null,
            'status_matches' => ($dbRecord->status === $newStatus),
        ]);
        
        // التحقق من أن التحديث تم بنجاح في قاعدة البيانات
        if ($dbRecord->status !== $newStatus) {
            Log::error('Failed to update project status in DB', [
                'project_id' => $project->id,
                'expected_status' => $newStatus,
                'db_status' => $dbRecord->status,
                'old_status' => $oldStatus,
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'فشل تحديث حالة المشروع في قاعدة البيانات. يرجى المحاولة مرة أخرى.',
                'debug' => [
                    'old_status' => $oldStatus,
                    'expected_status' => $newStatus,
                    'db_status' => $dbRecord->status,
                    'update_result' => $updated,
                ]
            ], 500);
        }
        
        // ✅ إعادة بناء Model من البيانات مباشرة بدلاً من refresh لتجنب Model Events
        $project = ProjectProposal::withoutEvents(function () use ($project) {
            return ProjectProposal::find($project->id);
        });
        
        Log::info('Project loaded without events', [
            'project_id' => $project->id,
            'status' => $project->status,
            'completed_date' => $project->completed_date,
            'sent_to_donor_date' => $project->sent_to_donor_date,
        ]);
        
        // ✅ تسجيل تغيير الحالة في Timeline
        if ($oldStatus !== $newStatus) {
            $project->recordStatusChange($oldStatus, $newStatus, $user->id, $statusMessage);
            
            // التحقق من الحالة بعد timeline
            $afterTimeline = DB::table('project_proposals')->where('id', $project->id)->value('status');
            Log::info('Status after timeline record', [
                'project_id' => $project->id,
                'status' => $afterTimeline,
                'expected' => $newStatus,
            ]);
        }
        
        // حفظ القبول
        $reply = NotificationReply::create([
            'notification_id' => $notification->id,
            'replied_by' => $user->id,
            'message' => $statusMessage,
            'rejection_reason' => 'مقبول',
        ]);
        
        // التحقق من الحالة بعد reply
        $afterReply = DB::table('project_proposals')->where('id', $project->id)->value('status');
        Log::info('Status after reply creation', [
            'project_id' => $project->id,
            'status' => $afterReply,
            'expected' => $newStatus,
        ]);
        
        // إنشاء إشعار لقسم الإعلام بقبول المونتاج
        NotificationHelper::createMediaAcceptanceNotification($project, $user);
        
        // التحقق من الحالة بعد notification
        $afterNotification = DB::table('project_proposals')->where('id', $project->id)->value('status');
        Log::info('Status after media acceptance notification', [
            'project_id' => $project->id,
            'status' => $afterNotification,
            'expected' => $newStatus,
        ]);
        
        // تحديث الإشعار الأصلي كمقروء
        $notification->is_read = true;
        $notification->save();
        
        // إعادة تحميل الإشعار مع الرد
        $notification->load('reply');
        
        // إضافة معلومات الرد للإشعار
        $notification->is_accepted = true;
        $notification->is_replied = true;
        $notification->reply_status = 'accepted';
        
        // ✅ الحصول على البيانات النهائية مباشرة من قاعدة البيانات للتأكد من صحتها
        $finalDbRecord = DB::table('project_proposals')
            ->where('id', $project->id)
            ->first();
        
        // ✅ مسح cache المشاريع لضمان ظهور التحديثات فوراً
        // استخدام CacheService مباشرة لضمان مسح جميع cache keys المتعلقة بالمشاريع
        try {
            \App\Services\CacheService::clear(\App\Services\CacheService::PREFIX_PROJECTS);
            // أيضاً مسح cache النسخ الإحصائية
            \App\Services\CacheService::updateVersion('projects');
            
            Log::info('Projects cache cleared successfully after montage acceptance', [
                'project_id' => $project->id,
                'new_status' => $finalDbRecord->status,
                'completed_date' => $finalDbRecord->completed_date,
            ]);
        } catch (\Exception $e) {
            Log::warning('Failed to clear projects cache', [
                'error' => $e->getMessage(),
                'project_id' => $project->id
            ]);
        }
        
        $successMessage = $shouldComplete 
            ? 'تم قبول المونتاج بنجاح وتم نقل المشروع إلى حالة "منتهي"'
            : 'تم قبول المونتاج بنجاح وتم نقل المشروع إلى حالة "وصل للمتبرع"';
        
        Log::info('🎯 FINAL CHECK - Project status after all operations', [
            'project_id' => $project->id,
            'model_status' => $project->status,
            'final_db_status' => $finalDbRecord->status,
            'expected_status' => $newStatus,
            'old_status' => $oldStatus,
            'should_complete' => $shouldComplete,
            'completed_date' => $finalDbRecord->completed_date ?? null,
            'status_still_correct' => ($finalDbRecord->status === $newStatus),
        ]);
        
        // ✅ إذا كانت الحالة في DB لا تزال غير صحيحة، نحاول مرة أخرى
        if ($finalDbRecord->status !== $newStatus) {
            Log::error('❌ CRITICAL: Status changed after operations!', [
                'project_id' => $project->id,
                'expected' => $newStatus,
                'actual_in_db' => $finalDbRecord->status,
            ]);
            
            // ✅ محاولة أخيرة لتحديث الحالة
            DB::table('project_proposals')
                ->where('id', $project->id)
                ->update([
                    'status' => $newStatus,
                    'updated_at' => now(),
                ]);
            
            // التحقق مرة أخرى
            $finalDbRecord = DB::table('project_proposals')
                ->where('id', $project->id)
                ->first();
            
            Log::warning('🔄 RETRY UPDATE', [
                'project_id' => $project->id,
                'status_after_retry' => $finalDbRecord->status,
            ]);
        }
        
        // ✅ إعادة بناء project_full من قاعدة البيانات مباشرة لتجنب أي مشاكل مع Model
        $projectFull = ProjectProposal::withoutEvents(function () use ($project) {
            return ProjectProposal::find($project->id);
        });
        
        return response()->json([
            'success' => true,
            'message' => $successMessage,
            'reply' => $reply,
            'notification' => $notification,
            'project' => [
                'id' => $project->id,
                'status' => $finalDbRecord->status, // ✅ استخدام البيانات مباشرة من DB
                'sent_to_donor_date' => $finalDbRecord->sent_to_donor_date,
                'completed_date' => $finalDbRecord->completed_date,
            ],
            'project_full' => $projectFull,
            'debug_info' => [ // ✅ معلومات للتشخيص
                'update_successful' => true,
                'old_status' => $oldStatus,
                'new_status_expected' => $newStatus,
                'new_status_actual' => $finalDbRecord->status,
                'completed_date' => $finalDbRecord->completed_date,
                'should_complete' => $shouldComplete,
            ]
        ]);
    }

    /**
     * الرد على إشعار اكتمال المونتاج
     * فقط الإدارة يمكنها الرد على إشعارات media_completed
     */
    public function reply(Request $request, $id)
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح لك'
            ], 401);
        }
        
        // التحقق من أن المستخدم admin
        if ($user->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'ليس لديك صلاحيات للرد على الإشعارات'
            ], 403);
        }
        
        // التحقق من وجود الإشعار
        $notification = Notification::where('id', $id)
            ->where('user_id', $user->id)
            ->first();
        
        if (!$notification) {
            return response()->json([
                'success' => false,
                'message' => 'الإشعار غير موجود'
            ], 404);
        }
        
        // التحقق من نوع الإشعار
        if ($notification->notification_type !== 'media_completed') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن الرد فقط على إشعارات اكتمال المونتاج'
            ], 400);
        }
        
        // التحقق من وجود رد سابق
        $existingReply = NotificationReply::where('notification_id', $notification->id)->first();
        if ($existingReply) {
            return response()->json([
                'success' => false,
                'message' => 'تم الرد على هذا الإشعار مسبقاً'
            ], 400);
        }
        
        // التحقق من البيانات المرسلة
        $validator = Validator::make($request->all(), [
            'message' => 'required|string|min:3',
            'rejection_reason' => 'required|string|min:3',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'البيانات غير صحيحة',
                'errors' => $validator->errors()
            ], 422);
        }
        
        // جلب المشروع - جرب related_project_id أولاً، ثم project_id
        $projectId = $notification->related_project_id ?? $notification->project_id ?? null;
        if (!$projectId) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود في الإشعار'
            ], 404);
        }
        
        $project = ProjectProposal::find($projectId);
        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        }
        
        // ✅ حفظ الحالة القديمة قبل التغيير
        $oldStatus = $project->status;
        $newStatus = null;
        $statusChangeNote = null;
        
        // ✅ تحديد الحالة الجديدة بناءً على الحالة الحالية عند الرفض
        // حالات المونتاج: عند رفض المونتاج، نحول جميع حالات المونتاج إلى "يجب إعادة المونتاج"
        $montageStatuses = ['في المونتاج', 'تم المونتاج', 'وصل للمتبرع'];
        
        if (in_array($oldStatus, $montageStatuses)) {
            // ✅ إذا كانت الحالة من حالات المونتاج → نعيدها إلى "يجب إعادة المونتاج"
            $newStatus = 'يجب إعادة المونتاج';
            $statusChangeNote = 'تم رفض المونتاج من قبل الإدارة - إعادة المشروع لحالة "يجب إعادة المونتاج" لإعادة المونتاج';
        } elseif ($oldStatus === 'تم التنفيذ' || $oldStatus === 'منفذ') {
            // إذا كانت الحالة "تم التنفيذ" → نعيدها إلى "جديد" (لأن التنفيذ تم رفضه)
            $newStatus = 'جديد';
            $statusChangeNote = 'تم رفض المشروع - إعادة المشروع لحالة "جديد" (مطلوب إعادته)';
        }
        
        // ✅ تحديث حالة المشروع إذا تم تحديد حالة جديدة
        if ($newStatus) {
            // ✅ استخدام DB::table() مباشرة لتجاوز Model Events (مثل دالة القبول)
            Log::info('🔵 BEFORE REJECTION UPDATE - Project status in DB', [
                'project_id' => $project->id,
                'current_status' => $oldStatus,
                'target_status' => $newStatus,
                'rejection_reason' => $request->rejection_reason ?? 'N/A',
            ]);
            
            // ✅ استخدام transaction صريح لضمان حفظ التحديث
            DB::beginTransaction();
            
            try {
                // ✅ استخدام DB::table() مباشرة لتجاوز أي تحقق في Model Events
                // ✅ حفظ حقول سبب الرفض مع تحديث الحالة
                $updateData = [
                    'status' => $newStatus,
                    'updated_at' => now(),
                ];
                
                // ✅ حفظ حقول سبب الرفض إذا كانت موجودة في الطلب
                if ($request->has('rejection_reason') && !empty($request->rejection_reason)) {
                    $updateData['rejection_reason'] = $request->rejection_reason;
                }
                if ($request->has('rejection_message') && !empty($request->rejection_message)) {
                    $updateData['rejection_message'] = $request->rejection_message;
                }
                if ($request->has('admin_rejection_reason') && !empty($request->admin_rejection_reason)) {
                    $updateData['admin_rejection_reason'] = $request->admin_rejection_reason;
                }
                // ✅ إذا كان rejection_reason موجوداً، احفظه في admin_rejection_reason أيضاً
                if ($request->has('rejection_reason') && !empty($request->rejection_reason) && !isset($updateData['admin_rejection_reason'])) {
                    $updateData['admin_rejection_reason'] = $request->rejection_reason;
                }
                
                $updated = DB::table('project_proposals')
                    ->where('id', $project->id)
                    ->update($updateData);
                
                Log::info('🟡 REJECTION UPDATE EXECUTED', [
                    'project_id' => $project->id,
                    'rows_affected' => $updated,
                    'new_status' => $newStatus,
                ]);
                
                if (!$updated) {
                    DB::rollBack();
                    Log::error('❌ DB::table update returned 0 rows affected (rejection)', [
                        'project_id' => $project->id,
                        'target_status' => $newStatus,
                    ]);
                } else {
                    // ✅ Commit التغييرات فوراً
                    DB::commit();
                    
                    Log::info('✅ REJECTION TRANSACTION COMMITTED', [
                        'project_id' => $project->id,
                        'new_status' => $newStatus,
                    ]);
                }
                
                // ✅ التحقق المباشر من قاعدة البيانات بعد commit
                $dbRecord = DB::table('project_proposals')
                    ->where('id', $project->id)
                    ->first();
                
                Log::info('🟢 AFTER REJECTION COMMIT - Project status in DB', [
                    'project_id' => $project->id,
                    'expected_status' => $newStatus,
                    'actual_db_status' => $dbRecord->status,
                    'status_matches' => ($dbRecord->status === $newStatus),
                ]);
                
            } catch (\Exception $e) {
                DB::rollBack();
                Log::error('❌ EXCEPTION during rejection update', [
                    'project_id' => $project->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
            
            // ✅ تسجيل تغيير الحالة في Timeline
            $project->recordStatusChange(
                $oldStatus,
                $newStatus,
                $user->id,
                $statusChangeNote
            );
            
            // ✅ إنشاء إشعار تغيير الحالة للإدارة
            NotificationHelper::createProjectStatusChangedNotification(
                $project,
                $oldStatus,
                $newStatus,
                $user
            );
            
            // ✅ إذا تم إرجاع المشروع لحالة "يجب إعادة المونتاج"، إرسال إشعار لممنتج المونتاج
            if ($newStatus === 'يجب إعادة المونتاج' && $project->assigned_montage_producer_id) {
                $montageProducer = \App\Models\User::find($project->assigned_montage_producer_id);
                if ($montageProducer) {
                    \App\Models\Notification::create([
                        'user_id' => $montageProducer->id,
                        'project_id' => $project->id,
                        'related_project_id' => $project->id,
                        'notification_type' => 'montage_producer_assigned',
                        'title' => 'مشروع يحتاج إعادة مونتاج',
                        'message' => "تم رفض المونتاج من قبل الإدارة. المشروع {$project->serial_number} - {$project->project_name} يحتاج إعادة مونتاج.",
                        'is_read' => false,
                        'priority' => 'high',
                        'metadata' => [
                            'project_id' => $project->id,
                            'project_name' => $project->project_name,
                            'serial_number' => $project->serial_number,
                            'rejection_reason' => $request->rejection_reason ?? 'تم رفض المونتاج من قبل الإدارة',
                            'rejection_message' => $request->message ?? null,
                            'admin_rejection_reason' => $request->rejection_reason ?? null,
                        ],
                    ]);
                }
            }
            
            // ✅ إعادة بناء Model من البيانات مباشرة بدلاً من refresh لتجنب Model Events
            $project = ProjectProposal::withoutEvents(function () use ($project) {
                return ProjectProposal::find($project->id);
            });
            
            Log::info('Project reloaded after rejection without events', [
                'project_id' => $project->id,
                'status' => $project->status,
                'expected_status' => $newStatus,
            ]);
            
            // ✅ مسح cache للمشاريع بعد تحديث الحالة
            try {
                \App\Services\CacheService::clear(\App\Services\CacheService::PREFIX_PROJECTS);
                \App\Services\CacheService::updateVersion('projects');
                
                Log::info('Projects cache cleared successfully after montage rejection', [
                    'project_id' => $project->id,
                    'new_status' => $project->status,
                ]);
            } catch (\Exception $e) {
                Log::warning('Failed to clear cache after project status change:', [
                    'error' => $e->getMessage()
                ]);
            }
        }
        
        // حفظ الرد
        $reply = NotificationReply::create([
            'notification_id' => $notification->id,
            'replied_by' => $user->id,
            'message' => $request->message,
            'rejection_reason' => $request->rejection_reason,
        ]);
        
        // إنشاء إشعار جديد لقسم الإعلام
        NotificationHelper::createMediaRejectionNotification(
            $project,
            $request->message,
            $request->rejection_reason,
            $user
        );
        
        // تحديث الإشعار الأصلي كمقروء
        $notification->is_read = true;
        $notification->save();
        
        // إعادة تحميل الإشعار مع الرد
        $notification->load('reply');
        
        // إضافة معلومات الرد للإشعار
        $notification->is_accepted = $reply->rejection_reason === 'مقبول';
        $notification->is_replied = true;
        $notification->reply_status = $reply->rejection_reason === 'مقبول' ? 'accepted' : 'rejected';
        
        // ✅ الحصول على البيانات النهائية مباشرة من قاعدة البيانات للتأكد من صحتها
        $finalDbRecord = DB::table('project_proposals')
            ->where('id', $project->id)
            ->first();
        
        Log::info('🎯 FINAL CHECK - Project status after rejection', [
            'project_id' => $project->id,
            'model_status' => $project->status,
            'final_db_status' => $finalDbRecord->status,
            'expected_status' => $newStatus,
            'old_status' => $oldStatus,
            'rejection_reason' => $finalDbRecord->rejection_reason ?? null,
            'admin_rejection_reason' => $finalDbRecord->admin_rejection_reason ?? null,
        ]);
        
        // ✅ إعادة تحميل المشروع للحصول على أحدث البيانات بما في ذلك حقول الرفض
        $project->refresh();
        
        return response()->json([
            'success' => true,
            'message' => $newStatus 
                ? "تم إرسال الرد بنجاح وتم إعادة المشروع لحالة \"{$newStatus}\""
                : 'تم إرسال الرد بنجاح',
            'reply' => $reply,
            'notification' => $notification,
            'project' => [
                'id' => $project->id,
                'status' => $project->status,
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                // ✅ إرجاع حقول سبب الرفض
                'rejection_reason' => $project->rejection_reason,
                'rejection_message' => $project->rejection_message,
                'admin_rejection_reason' => $project->admin_rejection_reason,
                'media_rejection_reason' => $project->media_rejection_reason,
            ]
        ]);
    }
}