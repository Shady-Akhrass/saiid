<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Services\ProjectsCacheService;
use Carbon\Carbon;

class ProjectProposal extends Model
{
    use HasFactory;

    protected $fillable = [
        'serial_number',
        'donor_code',
        'internal_code',
        'project_name',
        'project_description',
        'donor_name',
        'project_type',
        'project_type_id',
        'subcategory_id',
        'donation_amount',
        'currency_id',
        'exchange_rate',
        'amount_in_usd',
        'admin_discount_percentage',
        'discount_amount',
        'net_amount',
        'shekel_exchange_rate',
        'net_amount_shekel',
        'shekel_converted_at',
        'shekel_converted_by',
        'quantity',
        'beneficiaries_count',
        'beneficiaries_per_unit',
        'unit_cost',
        'supply_cost',
        'surplus_amount',
        'has_deficit',
        'surplus_notes',
        'surplus_recorded_at',
        'surplus_recorded_by',
        'surplus_category_id',
        'estimated_duration_days',
        'is_divided_into_phases',
        'phase_type',
        'phase_duration_days',
        'phase_start_date',
        'total_months',
        'month_number',
        'is_monthly_phase',
        'month_start_date',
        'status',
        'is_urgent',
        'rejection_reason', // ✅ سبب رفض المونتاج
        'rejection_message', // ✅ رسالة رفض المونتاج
        'admin_rejection_reason', // ✅ سبب رفض الإدارة
        'media_rejection_reason', // ✅ سبب رفض مدير الإعلام
        'assigned_to_team_id',
        'assigned_researcher_id',
        'assigned_photographer_id',
        'assigned_montage_producer_id',
        'assigned_by',
        'assignment_date',
        'shelter_id',
        'execution_date',
        'media_received_date',
        'montage_start_date',
        'montage_producer_assigned_at',
        'montage_completed_at',
        'montage_completed_date',
        'sent_to_donor_date',
        'completed_date',
        'transferred_to_projects',
        'project_id',
        'parent_project_id',
        'phase_day',
        'is_daily_phase',
        'notes',
        'notes_image',
        'project_image',
        'beneficiaries_excel_file',
        'created_by',
    ];

    protected $casts = [
        'donation_amount' => 'decimal:2',
        'exchange_rate' => 'decimal:4',
        'amount_in_usd' => 'decimal:2',
        'admin_discount_percentage' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'shekel_exchange_rate' => 'decimal:4',
        'net_amount_shekel' => 'decimal:2',
        'shekel_converted_at' => 'datetime',
        'quantity' => 'integer',
        'beneficiaries_count' => 'integer',
        'beneficiaries_per_unit' => 'integer',
        'unit_cost' => 'decimal:2',
        'supply_cost' => 'decimal:2',
        'surplus_amount' => 'decimal:2',
        'has_deficit' => 'boolean',
        'surplus_recorded_at' => 'datetime',
        'estimated_duration_days' => 'integer',
        'is_divided_into_phases' => 'boolean',
        'phase_type' => 'string',
        'phase_duration_days' => 'integer',
        'phase_start_date' => 'date',
        'total_months' => 'integer',
        'month_number' => 'integer',
        'is_monthly_phase' => 'boolean',
        'month_start_date' => 'date',
        'phase_day' => 'integer',
        'is_daily_phase' => 'boolean',
        'is_urgent' => 'boolean',
        'assignment_date' => 'date',
        'execution_date' => 'date',
        'media_received_date' => 'date',
        'montage_start_date' => 'date',
        'montage_producer_assigned_at' => 'datetime',
        'montage_completed_at' => 'datetime',
        'montage_completed_date' => 'date',
        'sent_to_donor_date' => 'date',
        'completed_date' => 'date',
        'transferred_to_projects' => 'boolean',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array
     */
    protected $appends = [
        'project_image_url',
        'notes_image_url',
        'notes_image_download_url', // ✅ إضافة URL للتحميل
        'remaining_days', // ✅ إضافة الأيام المتبقية
        'is_delayed', // ✅ إضافة حالة التأخير
        'delayed_days', // ✅ إضافة عدد أيام التأخير
        'calculated_beneficiaries', // ✅ إضافة عدد المستفيدين المحسوب
        'sponsored_orphans_count', // ✅ إضافة عدد الأيتام المكفولين
        'has_sponsored_orphans', // ✅ للتحقق من وجود أيتام مكفولين
    ];

    /**
     * العلاقات المحملة تلقائياً (Eager Loading Defaults)
     * لتحسين الأداء وتقليل N+1 queries
     *
     * @var array
     */
    protected $with = [
        // يمكن تفعيل هذا إذا أردت تحميل العلاقات دائماً
        // 'currency',
        // 'projectType',
        // ✅ تحميل صور الملاحظات لتجنب N+1 في أغلب السيناريوهات
        'noteImages',
    ];

    /**
     * Boot method to handle auto-calculations and serial number
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            // توليد رقم تسلسلي تلقائي
            if (empty($model->serial_number)) {
                $lastSerial = self::orderBy('id', 'desc')->first();
                $model->serial_number = $lastSerial ? ($lastSerial->id + 1000) : 1000;
            }

            // ✅ توليد كود داخلي تلقائي لكل مشروع (بغض النظر عن وجود donor_code)
            if (empty($model->internal_code)) {
                try {
                    $generatedCode = $model->generateInternalCode();
                    // ✅ التأكد من أن الكود بالضبط 7 أحرف قبل الإسناد
                    if (strlen($generatedCode) !== 7) {
                        \Log::error('Generated internal_code has wrong length', [
                            'code' => $generatedCode,
                            'length' => strlen($generatedCode),
                            'expected' => 7
                        ]);
                        throw new \Exception('الكود الداخلي المولد بطول غير صحيح: ' . strlen($generatedCode) . ' بدلاً من 7');
                    }
                    $model->internal_code = $generatedCode;
                    \Log::info('Generated internal_code for project', [
                        'internal_code' => $generatedCode,
                        'length' => strlen($generatedCode)
                    ]);
                } catch (\Exception $e) {
                    // إذا فشل توليد الكود (مثلاً العمود غير موجود في قاعدة البيانات)، نتركه null
                    // سيتم توليده لاحقاً أو يمكن إضافته يدوياً
                    \Log::warning('Failed to generate internal_code for project', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);
                    // لا نرمي exception حتى لا نمنع إنشاء المشروع
                    // لكن نترك internal_code = null
                    $model->internal_code = null;
                }
            } else {
                // ✅ إذا كان هناك internal_code من الـ request، نتحقق من طوله
                if (strlen($model->internal_code) > 7) {
                    \Log::warning('internal_code from request is too long, truncating', [
                        'original' => $model->internal_code,
                        'length' => strlen($model->internal_code)
                    ]);
                    $model->internal_code = substr($model->internal_code, 0, 7);
                }
            }

            // ✅ حساب المبالغ تلقائياً (إلا للمشاريع اليومية - لأنها تم حسابها مسبقاً)
            // المشاريع اليومية يتم إنشاؤها مع القيم الصحيحة مباشرة، لا نحتاج إعادة الحساب
            // المشاريع الشهرية تحتاج calculateAmounts() لحساب amount_in_usd والخصم
            if (!$model->is_daily_phase) {
                $model->calculateAmounts();
            }
        });

        static::updating(function ($model) {
            // ✅ إعادة حساب المبالغ عند التحديث (إلا للمشاريع اليومية)
            // المشاريع اليومية يجب أن تحافظ على القيم المحسوبة من المشروع الأصلي
            if (!$model->is_daily_phase && $model->isDirty(['donation_amount', 'exchange_rate', 'admin_discount_percentage'])) {
                $model->calculateAmounts();
            }
        });

        // ✅ مسح الكاش تلقائياً عند إنشاء مشروع جديد
        static::created(function ($model) {
            static::clearProjectsCache();
        });

        // ✅ مسح الكاش تلقائياً عند تحديث مشروع
        static::updated(function ($model) {
            // ✅ Logging: تتبع تغييرات الحالة
            if ($model->isDirty('status')) {
                $backtrace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 15);
                $caller = $backtrace[8] ?? $backtrace[5] ?? $backtrace[3] ?? $backtrace[0];
                
                $oldStatus = $model->getOriginal('status');
                $newStatus = $model->status;
                
                Log::info('⚠️ PROJECT_STATUS_CHANGED_IN_MODEL', [
                    'project_id' => $model->id,
                    'donor_code' => $model->donor_code,
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus,
                    'caller_file' => $caller['file'] ?? 'unknown',
                    'caller_line' => $caller['line'] ?? 'unknown',
                    'caller_function' => $caller['function'] ?? 'unknown',
                    'timestamp' => now()->toDateTimeString()
                ]);
                
                // ✅ حماية: منع تغيير الحالة تلقائياً من "قيد التنفيذ" إلى "تم التنفيذ"
                // ✅ الحالة "قيد التنفيذ" يجب أن تبقى حتى يغيرها مدير المشاريع أو مدير الإعلام فقط
                if ($oldStatus === 'قيد التنفيذ' && $newStatus === 'تم التنفيذ') {
                    // ✅ التحقق من أن التغيير جاء من endpoint مسموح به
                    $allowedCallers = [
                        'updateExecutionStatus',
                        'markAsExecuted',
                        'update',
                    ];
                    
                    $callerFunction = $caller['function'] ?? '';
                    $callerFile = $caller['file'] ?? '';
                    
                    // ✅ التحقق من أن الاستدعاء جاء من Controller وليس من observer أو cron job
                    $isFromController = strpos($callerFile, 'Controller.php') !== false;
                    $isAllowedFunction = in_array($callerFunction, $allowedCallers) || strpos($callerFunction, 'update') !== false;
                    
                    if (!$isFromController || !$isAllowedFunction) {
                        Log::error('❌ UNAUTHORIZED_STATUS_CHANGE_FROM_IN_PROGRESS_TO_EXECUTED', [
                            'project_id' => $model->id,
                            'donor_code' => $model->donor_code,
                            'old_status' => $oldStatus,
                            'new_status' => $newStatus,
                            'caller_file' => $callerFile,
                            'caller_function' => $callerFunction,
                            'is_from_controller' => $isFromController,
                            'is_allowed_function' => $isAllowedFunction,
                            'warning' => 'تم منع تغيير الحالة تلقائياً - يجب أن يتم التغيير من قبل مدير المشاريع أو مدير الإعلام فقط'
                        ]);
                        
                        // ✅ إعادة الحالة إلى "قيد التنفيذ"
                        DB::table('project_proposals')
                            ->where('id', $model->id)
                            ->update([
                                'status' => 'قيد التنفيذ',
                                'updated_at' => now()
                            ]);
                        
                        // ✅ إعادة تحميل الحالة الصحيحة
                        $model->refresh();
                        
                        Log::info('✅ STATUS_REVERTED_TO_IN_PROGRESS', [
                            'project_id' => $model->id,
                            'final_status' => $model->status
                        ]);
                    }
                }
            }
            
            // ✅ حماية: عندما transferred_to_projects يصبح 1، يجب أن تكون الحالة "قيد التنفيذ" وليس "تم التنفيذ"
            if ($model->isDirty('transferred_to_projects') && $model->transferred_to_projects == 1) {
                Log::info('🟡 TRANSFERRED_TO_PROJECTS_CHANGED', [
                    'project_id' => $model->id,
                    'donor_code' => $model->donor_code,
                    'transferred_to_projects' => $model->transferred_to_projects,
                    'current_status' => $model->status,
                    'expected_status' => 'قيد التنفيذ'
                ]);
                
                // ✅ إذا كانت الحالة "تم التنفيذ" أو أي حالة أخرى غير "قيد التنفيذ"، نصححها
                if ($model->status !== 'قيد التنفيذ') {
                    Log::warning('⚠️ CORRECTING_STATUS_AFTER_TRANSFER', [
                        'project_id' => $model->id,
                        'donor_code' => $model->donor_code,
                        'incorrect_status' => $model->status,
                        'corrected_status' => 'قيد التنفيذ',
                        'transferred_to_projects' => $model->transferred_to_projects,
                        'reason' => 'عندما transferred_to_projects = 1، يجب أن تكون الحالة "قيد التنفيذ"'
                    ]);
                    
                    // ✅ تحديث مباشر في قاعدة البيانات بدون observers
                    DB::table('project_proposals')
                        ->where('id', $model->id)
                        ->update([
                            'status' => 'قيد التنفيذ',
                            'updated_at' => now()
                        ]);
                    
                    // ✅ إعادة تحميل الحالة الصحيحة
                    $model->refresh();
                    
                    Log::info('✅ STATUS_CORRECTED_SUCCESSFULLY', [
                        'project_id' => $model->id,
                        'final_status' => $model->status
                    ]);
                } else {
                    Log::info('✅ STATUS_ALREADY_CORRECT', [
                        'project_id' => $model->id,
                        'status' => $model->status
                    ]);
                }
            }
            
            static::clearProjectsCache();
            
            // ✅ إذا كان المشروع فرعي (daily_phase أو monthly_phase) وتغيرت حالته
            // نتحقق من حالة المشروع الأصلي عند:
            // 1. عندما يصبح "وصل للمتبرع" (للتأكد من تحديث المشروع الأصلي)
            // 2. عندما يصبح "منتهى" (للتأكد من تحديث المشروع الأصلي عند انتهاء جميع المشاريع الفرعية)
            if (($model->is_daily_phase || $model->is_monthly_phase) && 
                $model->isDirty('status') && 
                ($model->status === 'وصل للمتبرع' || $model->status === 'منتهي')) {
                $model->updateParentProjectStatus();
            }
        });

        // ✅ مسح الكاش تلقائياً عند حذف مشروع
        static::deleted(function ($model) {
            static::clearProjectsCache();
        });
    }

    /**
     * مسح cache للمشاريع
     * يتم استدعاؤها تلقائياً من Model Events
     */
    protected static function clearProjectsCache(): void
    {
        try {
            // ✅ استخدام Cache tags إذا كان متاحاً (Redis/Memcached)
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['projects'])->flush();
            } else {
                // ✅ في حالة عدم دعم tags، نمسح فقط cache keys التي تبدأ بـ 'projects_'
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    // Redis - مسح keys محددة
                    $redis = $cacheDriver->getRedis();
                    $keys = $redis->keys('*projects_*');
                    if (!empty($keys)) {
                        $redis->del($keys);
                    }
                } else {
                    // Fallback: مسح جميع cache (للملفات/قاعدة البيانات)
                    Cache::flush();
                }
            }
        } catch (\Exception $e) {
            // ✅ في حالة فشل مسح cache، نستمر بدون خطأ
            Log::warning('Failed to clear projects cache from Model Event', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Generate internal code automatically
     * Format: YYNNNNN (Year 2 digits + 5 digits sequential)
     * Example: 2500001, 2500002, ... (for year 2025)
     * Example: 2600001, 2600002, ... (for year 2026)
     * 
     * @return string
     */
    public function generateInternalCode(): string
    {
        // التحقق من وجود العمود في قاعدة البيانات
        try {
            // محاولة استعلام بسيط للتحقق من وجود العمود
            $columns = DB::select("SHOW COLUMNS FROM project_proposals LIKE 'internal_code'");
            if (empty($columns)) {
                throw new \Exception('حقل internal_code غير موجود في قاعدة البيانات. يرجى تشغيل migration أولاً.');
            }
        } catch (\Exception $e) {
            // إذا كان هناك خطأ في الاستعلام، نرمي exception واضح
            if (strpos($e->getMessage(), 'internal_code') !== false) {
                throw $e;
            }
            // إذا كان خطأ آخر (مثل جدول غير موجود)، نرمي exception عام
            throw new \Exception('خطأ في التحقق من وجود حقل internal_code: ' . $e->getMessage());
        }
        
        $currentYear = (int) Carbon::now()->format('y'); // 2-digit year (25, 26, etc.)
        $yearPrefix = str_pad($currentYear, 2, '0', STR_PAD_LEFT);
        
        // البحث عن آخر كود داخلي في نفس السنة
        $lastInternalCode = self::where('internal_code', 'like', $yearPrefix . '%')
            ->whereNotNull('internal_code')
            ->orderBy('internal_code', 'desc')
            ->value('internal_code');
        
        if ($lastInternalCode && strlen($lastInternalCode) === 7) {
            // استخراج الرقم التسلسلي من آخر كود (آخر 5 أرقام)
            $lastSequence = (int) substr($lastInternalCode, 2);
            $nextSequence = $lastSequence + 1;
        } else {
            // إذا لم يكن هناك كود في هذه السنة، نبدأ من 1
            $nextSequence = 1;
        }
        
        // التأكد من أن الرقم التسلسلي لا يتجاوز 5 أرقام (99999)
        if ($nextSequence > 99999) {
            throw new \Exception('تم الوصول إلى الحد الأقصى للأكواد الداخلية لهذه السنة (99999)');
        }
        
        // دمج السنة مع الرقم التسلسلي (7 أرقام: 2 للسنة + 5 للرقم)
        $internalCode = $yearPrefix . str_pad($nextSequence, 5, '0', STR_PAD_LEFT);
        
        // ✅ التأكد من أن الكود بالضبط 7 أرقام
        if (strlen($internalCode) !== 7) {
            throw new \Exception('الكود الداخلي المولد غير صحيح: ' . $internalCode . ' (الطول: ' . strlen($internalCode) . ')');
        }
        
        // التأكد من أن الكود فريد (double-check لتجنب race conditions)
        $maxAttempts = 10;
        $attempts = 0;
        while (self::where('internal_code', $internalCode)->exists() && $attempts < $maxAttempts) {
            $nextSequence++;
            if ($nextSequence > 99999) {
                throw new \Exception('تم الوصول إلى الحد الأقصى للأكواد الداخلية لهذه السنة');
            }
            $internalCode = $yearPrefix . str_pad($nextSequence, 5, '0', STR_PAD_LEFT);
            
            // ✅ التأكد مرة أخرى من الطول
            if (strlen($internalCode) !== 7) {
                throw new \Exception('الكود الداخلي المولد غير صحيح: ' . $internalCode);
            }
            
            $attempts++;
        }
        
        if ($attempts >= $maxAttempts) {
            throw new \Exception('فشل في توليد كود داخلي فريد بعد عدة محاولات');
        }
        
        // ✅ التأكد النهائي من الطول قبل الإرجاع
        if (strlen($internalCode) !== 7) {
            throw new \Exception('الكود الداخلي النهائي غير صحيح: ' . $internalCode);
        }
        
        return $internalCode;
    }

    /**
     * Calculate amounts automatically
     */
    public function calculateAmounts()
    {
        // ✅ التحقق من وجود القيم المطلوبة
        if (!$this->donation_amount || !$this->exchange_rate) {
            \Log::warning('Cannot calculate amounts - missing required values', [
                'donation_amount' => $this->donation_amount,
                'exchange_rate' => $this->exchange_rate,
                'project_id' => $this->id ?? 'new'
            ]);
            return;
        }
        
        // حساب المبلغ بالدولار
        $this->amount_in_usd = round($this->donation_amount * $this->exchange_rate, 2);
        
        // حساب الخصم (إذا كان admin_discount_percentage موجوداً، وإلا 0)
        $discountPercentage = $this->admin_discount_percentage ?? 0;
        $this->discount_amount = round($this->amount_in_usd * ($discountPercentage / 100), 2);
        
        // حساب المبلغ الصافي
        $this->net_amount = round($this->amount_in_usd - $this->discount_amount, 2);
        
        // ✅ Log للحسابات (للت debugging)
        \Log::debug('Calculated amounts', [
            'donation_amount' => $this->donation_amount,
            'exchange_rate' => $this->exchange_rate,
            'admin_discount_percentage' => $discountPercentage,
            'amount_in_usd' => $this->amount_in_usd,
            'discount_amount' => $this->discount_amount,
            'net_amount' => $this->net_amount,
            'project_id' => $this->id ?? 'new'
        ]);
    }

    // ==================== Relationships ====================

    public function currency()
    {
        return $this->belongsTo(Currency::class);
    }

    public function projectType()
    {
        return $this->belongsTo(ProjectType::class, 'project_type_id');
    }

    public function subcategory()
    {
        return $this->belongsTo(ProjectSubcategory::class, 'subcategory_id');
    }

    public function assignedToTeam()
    {
        return $this->belongsTo(Team::class, 'assigned_to_team_id');
    }

    public function assignedResearcher()
    {
        return $this->belongsTo(TeamPersonnel::class, 'assigned_researcher_id');
    }

    public function photographer()
    {
        return $this->belongsTo(TeamPersonnel::class, 'assigned_photographer_id');
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function assignedMontageProducer()
    {
        return $this->belongsTo(User::class, 'assigned_montage_producer_id');
    }

    public function shelter()
    {
        return $this->belongsTo(Shelter::class, 'shelter_id', 'manager_id_number');
    }

    public function executedProject()
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function parentProject()
    {
        return $this->belongsTo(ProjectProposal::class, 'parent_project_id');
    }

    public function dailyPhases()
    {
        return $this->hasMany(ProjectProposal::class, 'parent_project_id')->where('is_daily_phase', true)->orderBy('phase_day');
    }

    public function monthlyPhases()
    {
        return $this->hasMany(ProjectProposal::class, 'parent_project_id')->where('is_monthly_phase', true)->orderBy('month_number');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function timeline()
    {
        return $this->hasMany(ProjectTimeline::class, 'project_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'project_id');
    }

    public function warehouseItems()
    {
        return $this->hasMany(ProjectWarehouseItem::class);
    }

    public function confirmedWarehouseItems()
    {
        return $this->hasMany(ProjectWarehouseItem::class)->where('status', 'confirmed');
    }

    public function pendingWarehouseItems()
    {
        return $this->hasMany(ProjectWarehouseItem::class)->where('status', 'pending');
    }

    public function surplusRecorder()
    {
        return $this->belongsTo(User::class, 'surplus_recorded_by');
    }

    public function surplusCategory()
    {
        return $this->belongsTo(SurplusCategory::class, 'surplus_category_id');
    }

    public function mediaArchives()
    {
        return $this->hasMany(MediaArchive::class, 'project_proposal_id');
    }

    public function beforeMontageArchives()
    {
        return $this->hasMany(MediaArchive::class, 'project_proposal_id')
                    ->where('archive_type', 'before_montage');
    }

    public function afterMontageArchives()
    {
        return $this->hasMany(MediaArchive::class, 'project_proposal_id')
                    ->where('archive_type', 'after_montage');
    }

    public function beneficiaries()
    {
        return $this->hasMany(Beneficiary::class, 'project_proposal_id');
    }

    /**
     * All images associated with this project proposal (project + notes)
     */
    public function images()
    {
        return $this->hasMany(ProjectProposalImage::class);
    }

    /**
     * Project images (type = project)
     */
    public function projectImages()
    {
        return $this->images()
            ->where('type', 'project')
            ->orderBy('display_order');
    }

    /**
     * Notes images (type = note)
     */
    public function noteImages()
    {
        return $this->images()
            ->where('type', 'note')
            ->orderBy('display_order');
    }

    public function sponsoredOrphans()
    {
        return $this->belongsToMany(Orphan::class, 'orphan_project_proposals', 'project_proposal_id', 'orphan_id_number')
                    ->withPivot('is_recurring', 'sponsorship_amount', 'sponsorship_start_date', 'sponsorship_end_date', 'notes')
                    ->withTimestamps();
    }

    public function recurringOrphans()
    {
        return $this->belongsToMany(Orphan::class, 'orphan_project_proposals', 'project_proposal_id', 'orphan_id_number')
                    ->wherePivot('is_recurring', true)
                    ->withPivot('is_recurring', 'sponsorship_amount', 'sponsorship_start_date', 'sponsorship_end_date', 'notes')
                    ->withTimestamps();
    }

    // ==================== Scopes ====================

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByType($query, $type)
    {
        // دعم كلا الخيارين: ID أو الاسم
        if (is_numeric($type)) {
            return $query->where('project_type_id', $type);
        }
        // للتوافق مع الكود القديم
        return $query->where('project_type', $type);
    }

    public function scopeAssignedToMontageProducer($query, $producerId)
    {
        return $query->where('assigned_montage_producer_id', $producerId);
    }

    public function scopeDelayed($query)
    {
        return $query->where('status', 'قيد التنفيذ')
                     ->whereNotNull('assignment_date')
                     ->whereNotNull('estimated_duration_days')
                     ->whereRaw('DATEDIFF(NOW(), assignment_date) > (estimated_duration_days + 2)');
    }

    public function scopeMontageDelayed($query)
    {
        return $query->where('status', 'في المونتاج')
                     ->whereNotNull('media_received_date')
                     ->whereRaw('DATEDIFF(NOW(), media_received_date) > 5');
    }

    /**
     * Scope to exclude child phases (daily and monthly phases) for statistics
     * يستبعد المشاريع المتفرعية (اليومية والشهرية) من الإحصائيات
     * لأنها تعتبر تكرار - المبالغ موجودة في المشروع الأصلي
     */
    public function scopeForStatistics($query)
    {
        return $query->where(function($q) {
            // ✅ استبعاد المشاريع المتفرعية (اليومية والشهرية)
            // المشاريع التي تُحسب: المشاريع غير المقسمة + المشاريع الأصلية المقسمة فقط
            $q->where(function($excludeChildQ) {
                $excludeChildQ
                    // ✅ استبعاد المشاريع اليومية (is_daily_phase = true)
                    ->where(function($notDailyQ) {
                        $notDailyQ->where('is_daily_phase', '!=', true)
                                  ->orWhereNull('is_daily_phase');
                    })
                    // ✅ استبعاد المشاريع الشهرية (is_monthly_phase = true)
                    ->where(function($notMonthlyQ) {
                        $notMonthlyQ->where('is_monthly_phase', '!=', true)
                                    ->orWhereNull('is_monthly_phase');
                    })
                    // ✅ استبعاد أي مشروع له parent_project_id (مشروع فرعي)
                    ->whereNull('parent_project_id')
                    // ✅ استبعاد أي مشروع له phase_day (مشروع يومي)
                    ->whereNull('phase_day')
                    // ✅ استبعاد أي مشروع له month_number (مشروع شهري)
                    ->whereNull('month_number');
            });
        });
    }

    /**
     * Scope to exclude divided parent projects for surplus statistics
     * يستبعد المشاريع الأصلية المقسمة من إحصائيات الوافر
     * ✅ إبقاء المشاريع الفرعية (اليومية والشهرية) والمشاريع غير المقسمة فقط
     */
    public function scopeForSurplusStatistics($query)
    {
        return $query->where(function($q) {
            // ✅ المشاريع الفرعية (اليومية أو الشهرية)
            $q->where(function($childQ) {
                $childQ->where('is_daily_phase', true)
                       ->orWhere('is_monthly_phase', true)
                       ->orWhereNotNull('parent_project_id')
                       ->orWhereNotNull('phase_day')
                       ->orWhereNotNull('month_number');
            })
            // ✅ أو المشاريع غير المقسمة
            ->orWhere(function($nonDividedQ) {
                $nonDividedQ->where(function($dividedCheck) {
                    $dividedCheck->where('is_divided_into_phases', false)
                                 ->orWhereNull('is_divided_into_phases');
                })
                ->where(function($phaseCheck) {
                    $phaseCheck->where('is_daily_phase', false)
                              ->orWhereNull('is_daily_phase');
                })
                ->where(function($monthlyCheck) {
                    $monthlyCheck->where('is_monthly_phase', false)
                                ->orWhereNull('is_monthly_phase');
                })
                ->whereNull('parent_project_id')
                ->whereNull('phase_day')
                ->whereNull('month_number');
            });
        });
    }

    public function scopeForUser($query, $user)
    {
        // إذا كان المستخدم غير موجود، لا نرجع أي مشاريع (يحتاج authentication)
        if (!$user) {
            return $query->where('id', null);
        }

        // إذا كان الدور غير معرف، نرجع query فارغ (يحتاج role معرف)
        if (!$user->role) {
            return $query->where('id', null);
        }

        // Admin يرى كل المشاريع (الأصلية فقط - ليس المشاريع اليومية والشهرية الفرعية)
        // 🎯 المنطق: أي مشروع له parent_project_id أو is_monthly_phase أو is_daily_phase ⇒ لا يظهر للإدارة
        if ($user->role === 'admin') {
            // ✅ استبعاد جميع المشاريع الفرعية باستخدام شروط متعددة
            return $query->where(function($q) {
                $q->whereNull('parent_project_id')
                  ->where(function($subQ) {
                      $subQ->where('is_monthly_phase', false)
                           ->orWhereNull('is_monthly_phase')
                           ->orWhere('is_monthly_phase', 0);
                  })
                  ->where(function($subQ) {
                      $subQ->where('is_daily_phase', false)
                           ->orWhereNull('is_daily_phase')
                           ->orWhere('is_daily_phase', 0);
                  })
                  ->whereNull('month_number')
                  ->whereNull('phase_day');
            });
        }

        // Project Manager يرى: جديد، قيد التوريد، تم التوريد، مسند لباحث، جاهز للتنفيذ، قيد التنفيذ
        // المشاريع غير المقسمة + المشاريع اليومية (ليس المشاريع الأصلية المقسمة)
        // **مهم**: استبعاد مشاريع الكفالات (لا يراها project_manager)
        // مشاريع الكفالات: project_type = 'الكفالات' AND subcategory = 'كفالة أيتام'
        if ($user->role === 'project_manager') {
            return $query->where(function($q) {
                $q->where(function($subQ) {
                    // المشاريع غير المقسمة
                    $subQ->where('is_divided_into_phases', false)
                         ->orWhereNull('is_divided_into_phases');
                })->orWhere('is_daily_phase', true);
            })
            ->whereIn('status', ['جديد', 'قيد التوريد', 'تم التوريد', 'مسند لباحث', 'جاهز للتنفيذ', 'قيد التنفيذ'])
            // استبعاد مشاريع الكفالات: project_type = 'الكفالات' AND subcategory = 'كفالة أيتام'
            ->where(function($q) {
                $q->where('project_type', '!=', 'الكفالات')
                  ->orWhereNull('project_type')
                  ->orWhereDoesntHave('subcategory', function($subQ) {
                      $subQ->where(function($nameQ) {
                          $nameQ->where('name_ar', 'كفالة أيتام')
                                ->orWhere('name', 'Orphan Sponsorship');
                      });
                  });
            });
        }

        // Orphan Sponsor Coordinator يرى: مشاريع الكفالات فقط
        // يجب أن يكون: project_type = 'الكفالات' AND subcategory = 'كفالة أيتام'
        // 🎯 المنطق المطلوب:
        // ✅ المشاريع غير المقسمة: تظهر
        // ❌ المشاريع الأصلية المقسمة: لا تظهر
        // ✅ المشاريع الفرعية (شهرية/يومية): تظهر
        // جميع الحالات: جديد، قيد التوريد، تم التوريد، مسند لباحث، جاهز للتنفيذ، قيد التنفيذ، تم التنفيذ، في المونتاج، تم المونتاج، وصل للمتبرع
        if ($user->role === 'orphan_sponsor_coordinator') {
            return $query->where('project_type', 'الكفالات')
                        ->whereHas('subcategory', function($subQ) {
                            $subQ->where(function($nameQ) {
                                $nameQ->where('name_ar', 'كفالة أيتام')
                                      ->orWhere('name', 'Orphan Sponsorship');
                            });
                        })
                        ->where(function($phaseQ) {
                            // ✅ المشاريع غير المقسمة (parent_project_id IS NULL و is_divided_into_phases = false/NULL)
                            $phaseQ->where(function($nonDividedQ) {
                                $nonDividedQ->where(function($dividedCheck) {
                                    $dividedCheck->where('is_divided_into_phases', false)
                                                 ->orWhereNull('is_divided_into_phases');
                                })
                                ->whereNull('parent_project_id')
                                ->where(function($monthlyCheck) {
                                    $monthlyCheck->where('is_monthly_phase', false)
                                                 ->orWhereNull('is_monthly_phase');
                                })
                                ->where(function($dailyCheck) {
                                    $dailyCheck->where('is_daily_phase', false)
                                               ->orWhereNull('is_daily_phase');
                                });
                            })
                            // ✅ المشاريع الفرعية (شهرية أو يومية) - أي مشروع له parent_project_id أو is_monthly_phase = true أو is_daily_phase = true
                            ->orWhere(function($subProjectsQ) {
                                $subProjectsQ->whereNotNull('parent_project_id')
                                             ->orWhere('is_monthly_phase', true)
                                             ->orWhere('is_daily_phase', true)
                                             ->orWhereNotNull('month_number')
                                             ->orWhereNotNull('phase_day');
                            });
                        })
                        ->whereIn('status', [
                            'جديد',
                            'قيد التوريد',
                            'تم التوريد',
                            'مسند لباحث',
                            'جاهز للتنفيذ',
                            'قيد التنفيذ',
                            'تم التنفيذ',
                            'في المونتاج',
                            'تم المونتاج',
                            'وصل للمتبرع'
                        ]);
        }

        // Media Manager يرى: 
        // - مسند لباحث (لإسناد المصور) - جميع المشاريع
        // - جاهز للتنفيذ (بعد إسناد المصور) - جميع المشاريع
        // - تم التنفيذ, قيد المونتاج, تم المونتاج, وصل للمتبرع - فقط المشاريع اليومية
        if ($user->role === 'media_manager') {
            return $query->where(function($q) {
                // المشاريع في حالة "مسند لباحث" أو "جاهز للتنفيذ" - جميع المشاريع
                $q->whereIn('status', ['مسند لباحث', 'جاهز للتنفيذ'])
                  // أو المشاريع اليومية في حالات المونتاج
                  ->orWhere(function($subQ) {
                      $subQ->where('is_daily_phase', true)
                           ->whereIn('status', ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'وصل للمتبرع']);
                  });
            });
        }

        // Montage Producer يرى: المشاريع المسندة له فقط
        if ($user->role === 'montage_producer') {
            return $query->where('assigned_montage_producer_id', $user->id)
                        ->whereIn('status', ['في المونتاج', 'تم المونتاج', 'وصل للمتبرع', 'يجب إعادة المونتاج']);
        }

        // Executed Projects Coordinator يرى: 
        // - جاهز للتنفيذ، تم اختيار المخيم، قيد التنفيذ (لإدارة التنفيذ)
        // - تم التنفيذ، منفذ، في المونتاج، تم المونتاج، معاد مونتاجه، وصل للمتبرع (لإدارة المستفيدين)
        // المشاريع اليومية والمشاريع الشهرية فقط (وليس المشروع الأصلي)
        if ($user->role === 'executed_projects_coordinator') {
            return $query->where(function($q) {
                $q->where('is_daily_phase', true)
                  ->orWhere('is_monthly_phase', true);
            })
            ->whereIn('status', [
                'جاهز للتنفيذ', 
                'تم اختيار المخيم', 
                'قيد التنفيذ',
                'تم التنفيذ',
                'منفذ',
                'في المونتاج',
                'تم المونتاج',
                'معاد مونتاجه',
                'وصل للمتبرع'
            ]);
        }

        // Executor يرى المشاريع المخصصة لفريقه
        if ($user->role === 'executor') {
            // الحصول على الفرق التي ينتمي إليها المستخدم
            $teamIds = DB::table('team_members')
                ->where('user_id', $user->id)
                ->where('is_active', true)
                ->pluck('team_id');
            
            if ($teamIds->isEmpty()) {
                return $query->where('id', null); // لا فرق = لا مشاريع
            }
            
            return $query->whereIn('assigned_to_team_id', $teamIds)
                        ->whereIn('status', ['قيد التنفيذ', 'تم التنفيذ']);
        }

        // إذا كان الدور غير معروف، لا نرجع أي مشاريع
        return $query->where('id', null);
    }

    // ==================== Helper Methods ====================

    /**
     * Determine if the project can be assigned to a researcher.
     *
     * - حالة "تم التوريد": يسمح بإسناد الباحث (الحالة المطلوبة لإسناد الباحث لأول مرة)
     * - حالة "مسند لباحث": يسمح بإعادة إسناد الباحث إذا لزم الأمر
     * - ممنوع الإسناد في حالات: "جديد", "قيد التوريد" (يجب إتمام التوريد أولاً)
     */
    public function canAssign(): bool
    {
        // ✅ السماح بإسناد/تعديل الباحث في جميع الحالات
        // ممنوع فقط للمشاريع المنتهية أو الملغاة
        $nonAssignableStatuses = ['منتهي', 'ملغى'];
        
        if (in_array($this->status, $nonAssignableStatuses)) {
            return false;
        }

        return true;
    }

    /**
     * Check if project is delayed in execution
     */
    public function isExecutionDelayed()
    {
        if ($this->status !== 'قيد التنفيذ' || !$this->assignment_date || !$this->estimated_duration_days) {
            return false;
        }

        $daysSinceAssignment = Carbon::now()->diffInDays(Carbon::parse($this->assignment_date));
        return $daysSinceAssignment > ($this->estimated_duration_days + 2);
    }

    /**
     * Check if project is delayed in montage
     */
    public function isMontageDelayed()
    {
        if ($this->status !== 'في المونتاج' || !$this->media_received_date) {
            return false;
        }

        $daysSinceReceived = Carbon::now()->diffInDays(Carbon::parse($this->media_received_date));
        return $daysSinceReceived > 5;
    }

    /**
     * Get days since assignment
     */
    public function getDaysSinceAssignment()
    {
        if (!$this->assignment_date) {
            return 0;
        }

        return Carbon::now()->diffInDays(Carbon::parse($this->assignment_date));
    }

    /**
     * Get estimated completion date
     */
    public function getEstimatedCompletionDate()
    {
        if (!$this->assignment_date || !$this->estimated_duration_days) {
            return null;
        }

        return Carbon::parse($this->assignment_date)->addDays($this->estimated_duration_days);
    }

    /**
     * Get days since project creation
     */
    public function getDaysSinceCreation()
    {
        if (!$this->created_at) {
            return 0;
        }

        return Carbon::now()->diffInDays(Carbon::parse($this->created_at));
    }

    /**
     * Get remaining days until completion
     * Returns negative value if delayed, positive if on time, null if not applicable
     *
     * للمشاريع اليومية: يستخدم execution_date بدلاً من created_at
     * للمشاريع الأخرى: يستخدم created_at
     * Calculation: estimated_duration_days - days_since_start
     * ✅ العداد يتوقف عند "وصل للمتبرع" أو "منتهي" (لا يُرجع 0 عند "تم التنفيذ")
     */
    public function getRemainingDays()
    {
        // ✅ العداد يتوقف عند "وصل للمتبرع" أو "منتهي"
        $counterStoppedStatuses = ['وصل للمتبرع', 'منتهي'];
        if (in_array($this->status, $counterStoppedStatuses)) {
            return null; // المشروع وصل للمتبرع أو منتهي، العداد متوقف
        }

        // الحالات الملغاة - لا توجد أيام متبقية
        $cancelledStatuses = ['ملغى'];
        if (in_array($this->status, $cancelledStatuses)) {
            return null;
        }

        // ✅ للمشاريع اليومية: استخدام execution_date بدلاً من created_at
        if ($this->is_daily_phase && $this->execution_date) {
            if (!$this->estimated_duration_days) {
                return null;
            }
            
            $today = Carbon::today();
            $executionDate = Carbon::parse($this->execution_date)->startOfDay();
            
            // حساب الأيام المتبقية حتى تاريخ التنفيذ
            // diffInDays مع false يعطي الفرق الموقع (موجب للمستقبل، سالب للماضي)
            $daysUntilExecution = $today->diffInDays($executionDate, false);
            
            // الأيام المتبقية = الأيام حتى التنفيذ + مدة التنفيذ
            // مثال: execution_date = 30 ديسمبر، اليوم = 26 ديسمبر
            // daysUntilExecution = 4، estimated_duration_days = 1
            // remainingDays = 4 + 1 = 5 أيام
            // لكن هذا غير منطقي... execution_date هو تاريخ التنفيذ نفسه
            // لذا الأيام المتبقية = daysUntilExecution فقط
            // وإذا كان execution_date في الماضي، نرجع القيمة السالبة (متأخر)
            $remainingDays = $daysUntilExecution;
            
            return $remainingDays;
        }

        // للمشاريع الأخرى: استخدام created_at (المنطق القديم)
        // يجب أن يكون هناك تاريخ إنشاء وعدد أيام مقدرة
        if (!$this->created_at || !$this->estimated_duration_days) {
            return null;
        }

        // حساب الأيام المتبقية لجميع الحالات النشطة (جديد، قيد التوريد، قيد التوزيع، جاهز للتنفيذ، قيد التنفيذ، إلخ)
        $daysSinceCreation = $this->getDaysSinceCreation();
        $remainingDays = $this->estimated_duration_days - $daysSinceCreation;

        // نرجع القيمة الفعلية (سواء كانت سالبة أو موجبة)
        return $remainingDays;
    }

    /**
     * Check if project is delayed
     * Project is delayed if remaining_days < 2 (0, 1, or negative)
     * But not delayed if status is "تم التنفيذ", "وصل للمتبرع", "منتهي" or cancelled
     */
    public function isDelayed()
    {
        // ✅ العداد متوقف أو المرحلة بعد التنفيذ - لا يعتبر متأخر
        $notDelayedStatuses = ['وصل للمتبرع', 'منتهي', 'تم التنفيذ', 'منفذ'];
        if (in_array($this->status, $notDelayedStatuses)) {
            return false;
        }

        // الحالات الملغاة - لا تعتبر متأخرة
        $cancelledStatuses = ['ملغى'];
        if (in_array($this->status, $cancelledStatuses)) {
            return false;
        }

        $remainingDays = $this->getRemainingDays();
        // متأخر إذا كانت الأيام المتبقية أقل من يومين (0 أو 1 أو سالبة)
        return $remainingDays !== null && $remainingDays < 2;
    }

    /**
     * Get delayed days count (positive number)
     * Calculates how many days the project is delayed
     * Formula: delayed_days = 2 - remaining_days (when remaining_days < 2)
     * ✅ يرجع 0 عند "وصل للمتبرع" أو "منتهي" (العداد متوقف)
     */
    public function getDelayedDays()
    {
        // ✅ العداد متوقف عند "وصل للمتبرع" أو "منتهي"
        if (in_array($this->status, ['وصل للمتبرع', 'منتهي'])) {
            return 0;
        }

        if (!$this->isDelayed()) {
            return 0;
        }

        $remainingDays = $this->getRemainingDays();
        
        // إذا كانت الأيام المتبقية أقل من 2، نحسب التأخير
        // الصيغة: delayed_days = 2 - remaining_days
        // remaining_days = 1 -> delayed_days = 1
        // remaining_days = 0 -> delayed_days = 2
        // remaining_days = -1 -> delayed_days = 3
        // remaining_days = -2 -> delayed_days = 4
        return 2 - $remainingDays;
    }

    /**
     * Accessor for remaining_days (for API response)
     */
    public function getRemainingDaysAttribute()
    {
        return $this->getRemainingDays();
    }

    /**
     * Accessor for is_delayed (for API response)
     */
    public function getIsDelayedAttribute()
    {
        return $this->isDelayed();
    }

    /**
     * Accessor for delayed_days (for API response)
     */
    public function getDelayedDaysAttribute()
    {
        return $this->getDelayedDays();
    }

    /**
     * Record status change in timeline
     */
    public function recordStatusChange($oldStatus, $newStatus, $userId, $notes = null)
    {
        ProjectTimeline::create([
            'project_id' => $this->id,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'changed_by' => $userId,
            'notes' => $notes,
        ]);
    }

    /**
     * تحديث حالة المشروع الأصلي بناءً على حالات المشاريع الفرعية
     * - عندما تصبح جميع المشاريع الفرعية في حالة "وصل للمتبرع"، تتغير حالة المشروع الأصلي إلى "وصل للمتبرع"
     * - عندما تصبح جميع المشاريع الفرعية في حالة "منتهى"، تتغير حالة المشروع الأصلي إلى "منتهى"
     */
    public function updateParentProjectStatus()
    {
        // التحقق من أن هذا المشروع فرعي
        if (!$this->parent_project_id) {
            return;
        }
        
        $parentProject = self::find($this->parent_project_id);
        if (!$parentProject || !$parentProject->is_divided_into_phases) {
            return;
        }
        
        // جلب جميع المشاريع الفرعية
        $phases = collect();
        
        if ($parentProject->phase_type === 'daily') {
            $phases = $parentProject->dailyPhases()->get();
        } elseif ($parentProject->phase_type === 'monthly') {
            $phases = $parentProject->monthlyPhases()->get();
        }
        
        // إذا لم يكن هناك مشاريع فرعية، لا نفعل شيء
        if ($phases->isEmpty()) {
            return;
        }
        
        // التحقق من أن جميع المشاريع الفرعية في حالة "وصل للمتبرع"
        $allSentToDonor = $phases->every(function($phase) {
            return $phase->status === 'وصل للمتبرع';
        });
        
        // التحقق من أن جميع المشاريع الفرعية في حالة "منتهى"
        $allCompleted = $phases->every(function($phase) {
            return $phase->status === 'منتهي';
        });
        
        // إذا كانت جميع المشاريع الفرعية في حالة "وصل للمتبرع"
        // وتكون حالة المشروع الأصلي ليست "وصل للمتبرع"، نحدثها
        if ($allSentToDonor && $parentProject->status !== 'وصل للمتبرع') {
            $oldStatus = $parentProject->status;
            
            $parentProject->update([
                'status' => 'وصل للمتبرع',
                'sent_to_donor_date' => $parentProject->sent_to_donor_date ?? now(),
            ]);
            
            // تسجيل التغيير في Timeline
            $parentProject->recordStatusChange(
                $oldStatus,
                'وصل للمتبرع',
                $this->created_by ?? auth()->id() ?? 1,
                "تم تحديث حالة المشروع الأصلي إلى 'وصل للمتبرع' لأن جميع المشاريع الفرعية وصلت للمتبرع"
            );
            
            // مسح الكاش
            static::clearProjectsCache();
        }
        
        // ✅ إذا كانت جميع المشاريع الفرعية في حالة "منتهى"
        // وتكون حالة المشروع الأصلي ليست "منتهى"، نحدثها
        if ($allCompleted && $parentProject->status !== 'منتهي') {
            $oldStatus = $parentProject->status;
            
            $parentProject->update([
                'status' => 'منتهي',
                'completed_date' => $parentProject->completed_date ?? now(),
            ]);
            
            // تسجيل التغيير في Timeline
            $parentProject->recordStatusChange(
                $oldStatus,
                'منتهي',
                $this->created_by ?? auth()->id() ?? 1,
                "تم تحديث حالة المشروع الأصلي إلى 'منتهي' لأن جميع المشاريع الفرعية انتهت"
            );
            
            // مسح الكاش
            static::clearProjectsCache();
        }
    }

    /**
     * Get montage duration in days
     * Returns the number of days between montage start and completion
     */
    public function getMontageDuration()
    {
        if (!$this->montage_start_date || !$this->montage_completed_date) {
            return null;
        }

        return Carbon::parse($this->montage_start_date)
                    ->diffInDays(Carbon::parse($this->montage_completed_date));
    }

    /**
     * Get average montage duration for all completed projects
     */
    public static function getAverageMontageDuration()
    {
        // ✅ استخدام Query Builder مع استبعاد المشاريع المتفرعية
        $result = self::forStatistics()
            ->where('status', 'وصل للمتبرع')
            ->whereNotNull('montage_start_date')
            ->whereNotNull('montage_completed_date')
            ->selectRaw('AVG(DATEDIFF(montage_completed_date, montage_start_date)) as avg_duration')
            ->first();

        return $result && $result->avg_duration ? round($result->avg_duration, 2) : 0;
    }

    /**
     * Get percentage of delayed montage projects
     * ✅ يستبعد المشاريع المتفرعية من الإحصائيات
     */
    public static function getMontageDelayPercentage()
    {
        $totalMontageProjects = self::forStatistics()
            ->whereIn('status', ['في المونتاج', 'تم المونتاج', 'وصل للمتبرع'])
            ->whereNotNull('media_received_date')
            ->count();

        if ($totalMontageProjects === 0) {
            return 0;
        }

        // ✅ استخدام scope مع استبعاد المشاريع المتفرعية
        $delayedProjects = self::forStatistics()->montageDelayed()->count();

        return round(($delayedProjects / $totalMontageProjects) * 100, 2);
    }

    /**
     * Get days since media received
     */
    public function getDaysSinceMediaReceived()
    {
        if (!$this->media_received_date) {
            return null;
        }

        return Carbon::now()->diffInDays(Carbon::parse($this->media_received_date));
    }

    /**
     * Get days remaining before montage delay (5 days limit)
     */
    public function getDaysRemainingBeforeDelay()
    {
        if (!$this->media_received_date || $this->status !== 'في المونتاج') {
            return null;
        }

        $daysSinceReceived = $this->getDaysSinceMediaReceived();
        $daysRemaining = 5 - $daysSinceReceived;

        return $daysRemaining > 0 ? $daysRemaining : 0;
    }

    /**
     * Check if project is approaching montage delay (within 2 days)
     */
    public function isApproachingMontageDelay()
    {
        if ($this->status !== 'في المونتاج' || !$this->media_received_date) {
            return false;
        }

        $daysRemaining = $this->getDaysRemainingBeforeDelay();
        return $daysRemaining !== null && $daysRemaining <= 2 && $daysRemaining > 0;
    }

    /**
     * Get the project image URL or default image
     */
    public function getProjectImageUrlAttribute()
    {
        if ($this->project_image) {
            // Always return the API endpoint for better reliability
            // Try to get the current request URL, fallback to config
            try {
                $baseUrl = request()->getSchemeAndHttpHost();
                // If localhost without port, add port 8000 for local development
                if (str_contains($baseUrl, 'localhost') && !str_contains($baseUrl, ':')) {
                    $baseUrl = str_replace('localhost', 'localhost:8000', $baseUrl);
                }
            } catch (\Exception $e) {
                $baseUrl = config('app.url', 'http://localhost:8000');
            }
            return rtrim($baseUrl, '/') . '/api/project-proposals/' . $this->id . '/image';
        }
        
        return null;
    }

    /**
     * Get the project image path (for API responses)
     */
    public function getProjectImagePathAttribute()
    {
        return $this->project_image;
    }

    /**
     * Get the notes image URL (direct URL to image on file server)
     */
    public function getNotesImageUrlAttribute()
    {
        // ✅ إذا لم يكن هناك أي صور ملاحظات ولا قيمة قديمة في notes_image، لا يوجد رابط
        $hasNoteImages = $this->relationLoaded('noteImages')
            ? $this->noteImages->isNotEmpty()
            : $this->noteImages()->exists();

        if (!$hasNoteImages && !$this->notes_image) {
            return null;
        }

        // ✅ دعم البيانات القديمة: إذا كان notes_image يحتوي على URL كامل، استخدمه مباشرة
        if (!$hasNoteImages && $this->notes_image &&
            (str_starts_with($this->notes_image, 'http://') || str_starts_with($this->notes_image, 'https://'))) {
            return $this->notes_image;
        }

        // ✅ الحصول على base URL للـ API
        // في Production، استخدم config('app.url') مباشرة لضمان URL صحيح
        $baseUrl = config('app.url', 'http://localhost:8000');
        
        // ✅ في Development فقط، جرب request()->getSchemeAndHttpHost() أولاً
        if (config('app.env') === 'local') {
        try {
                $requestUrl = request()->getSchemeAndHttpHost();
                if ($requestUrl) {
                    // ✅ في Development، إذا كان localhost بدون port، أضف port 8000
                    if (str_contains($requestUrl, 'localhost') && !str_contains($requestUrl, 'localhost:')) {
                        $baseUrl = str_replace('localhost', 'localhost:8000', $requestUrl);
                    } elseif (!str_contains($requestUrl, 'localhost')) {
                        $baseUrl = $requestUrl;
                    }
            }
        } catch (\Exception $e) {
                // Fallback to config
            }
        }
        
        // ✅ في Development فقط: التأكد من أن localhost يحتوي على port
        if (config('app.env') === 'local' && str_contains($baseUrl, 'localhost') && !str_contains($baseUrl, 'localhost:')) {
                $baseUrl = str_replace('localhost', 'localhost:8000', $baseUrl);
            }

        // ✅ استخدام route مع ID (موصى به - يعمل في جميع الصفحات)
        // ✅ هذا الـ route يعمل بشكل موثوق في قائمة المشاريع وصفحة التفاصيل
        $cacheBuster = '?v=';
        if ($this->updated_at) {
            $cacheBuster .= $this->updated_at->timestamp;
        } else {
            $cacheBuster .= time();
        }
        
        // ✅ استخدام `/api/project-note-image/{id}` - يعمل بشكل أفضل من `/api/project_notes_images/{filename}`
        return rtrim($baseUrl, '/') . '/api/project-note-image/' . $this->id . $cacheBuster;
    }

    /**
     * ✅ Get download URL for notes image (with Content-Disposition: attachment)
     */
    public function getNotesImageDownloadUrlAttribute()
    {
        $hasNoteImages = $this->relationLoaded('noteImages')
            ? $this->noteImages->isNotEmpty()
            : $this->noteImages()->exists();

        if (!$hasNoteImages && !$this->notes_image) {
            return null;
        }

        // ✅ الحصول على base URL للـ API
        $baseUrl = config('app.url', 'http://localhost:8000');
        
        // ✅ في Development فقط، جرب request()->getSchemeAndHttpHost() أولاً
        if (config('app.env') === 'local') {
            try {
                $requestUrl = request()->getSchemeAndHttpHost();
                if ($requestUrl) {
                    if (str_contains($requestUrl, 'localhost') && !str_contains($requestUrl, 'localhost:')) {
                        $baseUrl = str_replace('localhost', 'localhost:8000', $requestUrl);
                    } elseif (!str_contains($requestUrl, 'localhost')) {
                        $baseUrl = $requestUrl;
                    }
                }
            } catch (\Exception $e) {
                // Fallback to config
            }
        }
        
        // ✅ استخدام route للتحميل
        return rtrim($baseUrl, '/') . '/api/project-note-image/' . $this->id . '/download';
    }

    /**
     * Get the notes image path (for API responses)
     */
    public function getNotesImagePathAttribute()
    {
        // ✅ إذا كانت هناك صور ملاحظات في الجدول الجديد، استخدم أول صورة (حسب display_order)
        $firstNoteImage = $this->relationLoaded('noteImages')
            ? $this->noteImages->first()
            : $this->noteImages()->orderBy('display_order')->first();

        if ($firstNoteImage) {
            return $firstNoteImage->image_path;
        }

        // ✅ توافق خلفي: استخدام الحقل القديم مباشرة إذا لم توجد صور في الجدول الجديد
        return $this->notes_image;
    }

    /**
     * Get calculated beneficiaries count
     * Uses manual count if available, otherwise calculates: quantity × beneficiaries_per_unit
     */
    public function getCalculatedBeneficiariesAttribute()
    {
        // إذا كان هناك عدد يدوي، استخدمه
        if ($this->beneficiaries_count > 0) {
            return $this->beneficiaries_count;
        }
        
        // حساب تلقائي: عدد الطرود × عدد المستفيدين لكل طرد
        $quantity = $this->quantity ?? 0;
        $perUnit = $this->beneficiaries_per_unit ?? 0;
        
        return $quantity;
    }

    /**
     * Calculate daily amount for phased projects
     */
    public function getDailyAmount()
    {
        if (!$this->is_divided_into_phases || !$this->phase_duration_days || $this->phase_duration_days <= 0) {
            return null;
        }
        
        // ✅ التحقق من وجود net_amount
        if (!$this->net_amount || $this->net_amount <= 0) {
            \Log::warning('Cannot calculate daily amount - net_amount is missing or invalid', [
                'project_id' => $this->id,
                'net_amount' => $this->net_amount,
                'phase_duration_days' => $this->phase_duration_days,
                'is_divided_into_phases' => $this->is_divided_into_phases
            ]);
            return null;
        }
        
        $dailyAmount = round($this->net_amount / $this->phase_duration_days, 2);
        
        // ✅ Log للحساب (للت debugging)
        \Log::debug('Calculated daily amount', [
            'project_id' => $this->id,
            'net_amount' => $this->net_amount,
            'phase_duration_days' => $this->phase_duration_days,
            'daily_amount' => $dailyAmount
        ]);
        
        return $dailyAmount;
    }

    /**
     * Get current phase day (1-based)
     */
    public function getCurrentPhaseDay()
    {
        if (!$this->is_divided_into_phases || !$this->phase_start_date || !$this->phase_duration_days) {
            return null;
        }
        
        $daysSinceStart = Carbon::now()->diffInDays(Carbon::parse($this->phase_start_date));
        
        if ($daysSinceStart < 0) {
            return null; // Phase hasn't started yet
        }
        
        if ($daysSinceStart >= $this->phase_duration_days) {
            return null; // Phase completed
        }
        
        return $daysSinceStart + 1; // 1-based day number
    }

    /**
     * Check if project is in active phase period
     */
    public function isInActivePhase()
    {
        if (!$this->is_divided_into_phases) {
            return false;
        }
        
        $currentDay = $this->getCurrentPhaseDay();
        return $currentDay !== null;
    }

    /**
     * Check if this is a parent project (not a daily phase or monthly phase)
     */
    public function isParentProject()
    {
        return !$this->is_daily_phase && !$this->is_monthly_phase && $this->is_divided_into_phases;
    }

    /**
     * Calculate monthly donation amount (in original currency, before conversion and discount)
     */
    public function getMonthlyDonationAmount()
    {
        if (!$this->is_divided_into_phases || $this->phase_type !== 'monthly' || !$this->total_months || $this->total_months <= 0) {
            return null;
        }
        
        // ✅ تقسيم المبلغ الأصلي بالعملة المحلية (قبل التحويل والخصم)
        return round($this->donation_amount / $this->total_months, 2);
    }

    /**
     * توريث صور الملاحظات من المشروع الأصلي للمشروع الفرعي.
     * - إن وُجدت صفوف في project_proposal_images (type=note) تُنسخ للفرعي.
     * - إن وُجدت صورة في الحقل القديم notes_image فقط، يُنشأ سطر واحد للفرعي بنفس المسار.
     * لا يتم نسخ الملفات على القرص، الفرعي يشير لنفس الملفات.
     */
    public function copyNoteImagesToChild(self $child): int
    {
        $rows = $this->getNoteImagesDataForInheritance();
        if ($rows->isEmpty()) {
            return 0;
        }
        $now = now();
        $inserts = $rows->map(fn ($row) => [
            'project_proposal_id' => $child->id,
            'image_path' => $row['image_path'],
            'display_order' => $row['display_order'],
            'type' => 'note',
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();
        ProjectProposalImage::insert($inserts);
        return count($inserts);
    }

    /**
     * توريث صور الملاحظات لجميع المشاريع الفرعية دفعة واحدة (أداء أفضل).
     * يجلب صور الأب مرة واحدة ثم إدراج جماعي لكل فرعي.
     */
    public function copyNoteImagesToAllChildren(\Illuminate\Support\Collection $children): int
    {
        $rows = $this->getNoteImagesDataForInheritance();
        if ($rows->isEmpty() || $children->isEmpty()) {
            return 0;
        }
        $now = now();
        $total = 0;
        foreach ($children as $child) {
            $inserts = $rows->map(fn ($row) => [
                'project_proposal_id' => $child->id,
                'image_path' => $row['image_path'],
                'display_order' => $row['display_order'],
                'type' => 'note',
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();
            ProjectProposalImage::insert($inserts);
            $total += count($inserts);
        }
        return $total;
    }

    /**
     * جلب بيانات صور الملاحظات للتوريث (من الجدول أو الحقل notes_image).
     * @return \Illuminate\Support\Collection<int, array{image_path: string, display_order: int}>
     */
    protected function getNoteImagesDataForInheritance(): \Illuminate\Support\Collection
    {
        $noteImages = $this->noteImages()->orderBy('display_order')->get();
        if ($noteImages->isNotEmpty()) {
            return $noteImages->map(fn ($img) => [
                'image_path' => $img->image_path,
                'display_order' => $img->display_order,
            ]);
        }
        if (!empty($this->notes_image)) {
            return collect([['image_path' => $this->notes_image, 'display_order' => 0]]);
        }
        return collect([]);
    }

    /**
     * Create all daily phase projects
     */
    public function createDailyPhases()
    {
        if (!$this->is_divided_into_phases || !$this->phase_duration_days || !$this->phase_start_date) {
            return collect([]);
        }

        $dailyAmount = $this->getDailyAmount();
        if ($dailyAmount === null) {
            return collect([]);
        }

        $dailyPhases = collect([]);
        $startDate = Carbon::parse($this->phase_start_date);

        for ($day = 1; $day <= $this->phase_duration_days; $day++) {
            $executionDate = $startDate->copy()->addDays($day - 1);
            
            // ✅ حساب المبلغ اليومي بالعملة المحلية (لـ donation_amount)
            // $dailyAmount هو بالدولار (net_amount / days)
            // نحتاج تحويله للعملة المحلية: donation_amount = dailyAmount / exchange_rate
            $dailyAmountInLocalCurrency = $this->exchange_rate > 0 
                ? round($dailyAmount / $this->exchange_rate, 2) 
                : $dailyAmount;
            
            $dailyPhase = self::create([
                // serial_number will be auto-generated in boot method
                'donor_code' => $this->donor_code,
                'project_name' => $this->project_name . ' - اليوم ' . $day,
                'project_description' => $this->project_description,
                'donor_name' => $this->donor_name,
                'project_type' => $this->project_type,
                'project_type_id' => $this->project_type_id, // ✅ إضافة project_type_id
                // ✅ إضافة: نسخ subcategory_id من المشروع الأصلي
                'subcategory_id' => $this->subcategory_id,
                // ✅ وضع المبلغ بالعملة المحلية في donation_amount
                'donation_amount' => $dailyAmountInLocalCurrency,
                'currency_id' => $this->currency_id,
                'exchange_rate' => $this->exchange_rate,
                // ✅ المبلغ بالدولار = المبلغ اليومي (net_amount من المشروع الأصلي / عدد الأيام)
                'amount_in_usd' => $dailyAmount,
                'admin_discount_percentage' => 0, // ✅ لا خصم على المشاريع اليومية (الخصم تم على المشروع الأصلي)
                'discount_amount' => 0,
                // ✅ المبلغ الصافي = المبلغ اليومي بالدولار (لأن الخصم تم تطبيقه على المشروع الأصلي)
                'net_amount' => $dailyAmount,
                'estimated_duration_days' => 1,
                'is_divided_into_phases' => false,
                'phase_duration_days' => null,
                'phase_start_date' => null,
                'status' => 'جديد',
                'parent_project_id' => $this->id,
                'phase_day' => $day,
                'is_daily_phase' => true,
                'execution_date' => $executionDate->format('Y-m-d'),
                'created_by' => $this->created_by,
                // ✅ توريث الملاحظات وصورة الملاحظات من المشروع الأصلي
                'notes' => $this->notes,
                'notes_image' => $this->notes_image,
            ]);

            // Record in timeline
            $dailyPhase->recordStatusChange(null, 'جديد', $this->created_by, "تم إنشاء المشروع اليومي - اليوم {$day}");

            // ✅ توريث صور الملاحظات (من project_proposal_images) للمشروع الفرعي
            $this->copyNoteImagesToChild($dailyPhase);

            $dailyPhases->push($dailyPhase);
        }

        // Record in parent project timeline
        $this->recordStatusChange($this->status, $this->status, $this->created_by, "تم إنشاء {$this->phase_duration_days} مشروع يومي");

        // ✅ مسح cache للمشاريع المقسمة الفرعية الجديدة
        $this->clearProjectsCacheVersion();

        return $dailyPhases;
    }

    /**
     * Delete all daily phase projects
     */
    public function deleteDailyPhases()
    {
        $deletedCount = $this->dailyPhases()->delete();
        
        if ($deletedCount > 0) {
            $this->recordStatusChange($this->status, $this->status, $this->created_by ?? 1, "تم حذف المشاريع اليومية");
        }
        
        return $deletedCount;
    }

    /**
     * Sync daily phases when parent project is updated
     */
    public function syncDailyPhases()
    {
        // Delete existing daily phases
        $this->deleteDailyPhases();
        
        // Create new daily phases if still divided
        if ($this->is_divided_into_phases) {
            return $this->createDailyPhases();
        }
        
        return collect([]);
    }

    /**
     * Create all monthly phase projects
     * ✅ تم التعديل: إنشاء جميع الشهور دفعة واحدة بدلاً من الشهر الأول فقط
     */
    public function createMonthlyPhases()
    {
        if (!$this->is_divided_into_phases || $this->phase_type !== 'monthly' || !$this->total_months) {
            return null;
        }

        // إذا لم يُرسل تاريخ البدء، استخدام أول يوم من الشهر الحالي لإنشاء الشهور الفرعية
        if ($this->phase_start_date) {
            $startDate = Carbon::parse($this->phase_start_date);
        } else {
            $startDate = Carbon::now()->startOfMonth();
            $this->update(['phase_start_date' => $startDate->format('Y-m-d')]);
        }

        $monthlyDonationAmount = $this->getMonthlyDonationAmount();
        if ($monthlyDonationAmount === null) {
            return null;
        }
        $monthlyPhases = collect();
        
        // ✅ إنشاء جميع الشهور دفعة واحدة
        for ($monthNumber = 1; $monthNumber <= $this->total_months; $monthNumber++) {
            // حساب تاريخ بداية الشهر (من تاريخ بداية المشروع الأصلي)
            // ✅ استخدام addMonths بدلاً من addDays لضمان الانتقال للشهر التالي في التقويم
            $monthStartDate = $startDate->copy()->addMonths($monthNumber - 1)->startOfMonth();
            
            $monthlyPhase = self::create([
                'donor_code' => $this->donor_code,
                'project_name' => $this->project_name . ' - الشهر ' . $monthNumber,
                'project_description' => $this->project_description,
                'donor_name' => $this->donor_name,
                'project_type' => $this->project_type,
                'project_type_id' => $this->project_type_id,
                // ✅ المبلغ الشهري بالعملة المحلية (قبل التحويل والخصم)
                'donation_amount' => $monthlyDonationAmount,
                'currency_id' => $this->currency_id,
                'exchange_rate' => $this->exchange_rate,
                // ✅ نفس نسبة الخصم الإداري من المشروع الأب
                'admin_discount_percentage' => $this->admin_discount_percentage,
                // amount_in_usd, discount_amount, net_amount سيتم حسابها تلقائياً في boot()
                'estimated_duration_days' => $this->estimated_duration_days,
                'is_divided_into_phases' => false,
                'phase_type' => null,
                'phase_duration_days' => null,
                'phase_start_date' => null,
                'total_months' => null,
                'status' => 'جديد',
                'parent_project_id' => $this->id,
                'phase_day' => null,
                'is_daily_phase' => false,
                'month_number' => $monthNumber,
                'is_monthly_phase' => true,
                'month_start_date' => $monthStartDate->format('Y-m-d'),
                'execution_date' => $monthStartDate->format('Y-m-d'),
                'created_by' => $this->created_by,
                // ✅ إضافة: نسخ subcategory_id من المشروع الأصلي
                'subcategory_id' => $this->subcategory_id,
                // ✅ توريث الملاحظات وصورة الملاحظات من المشروع الأصلي
                'notes' => $this->notes,
                'notes_image' => $this->notes_image,
            ]);

            // Record in timeline
            $monthlyPhase->recordStatusChange(null, 'جديد', $this->created_by, "تم إنشاء المشروع الشهري - الشهر {$monthNumber}");

            // ✅ توريث صور الملاحظات (من project_proposal_images) للمشروع الفرعي
            $this->copyNoteImagesToChild($monthlyPhase);
            
            $monthlyPhases->push($monthlyPhase);
        }

        // Record in parent project timeline
        $this->recordStatusChange($this->status, $this->status, $this->created_by, "تم إنشاء جميع المشاريع الشهرية ({$this->total_months} مشروع)");

        // ✅ إضافة الأيتام الثابتين تلقائياً للمشاريع الشهرية الجديدة
        if ($this->isSponsorshipProject()) {
            foreach ($monthlyPhases as $monthlyPhase) {
                $this->syncRecurringOrphansToMonthlyPhase($monthlyPhase);
            }
        }

        // ✅ مسح cache للمشاريع المقسمة الفرعية الجديدة
        $this->clearProjectsCacheVersion();

        // ✅ إرجاع الشهر الأول للتوافق مع الكود الموجود
        return $monthlyPhases->first();
    }

    /**
     * Create next monthly phase project (called by Command)
     */
    public function createNextMonthlyPhase()
    {
        if (!$this->is_divided_into_phases || $this->phase_type !== 'monthly' || !$this->total_months || !$this->phase_start_date) {
            return null;
        }

        // حساب عدد الشهور المتبقية
        $existingMonths = $this->monthlyPhases()->count();
        if ($existingMonths >= $this->total_months) {
            return null; // تم إنشاء جميع الشهور
        }

        $nextMonthNumber = $existingMonths + 1;
        $startDate = Carbon::parse($this->phase_start_date);
        // ✅ استخدام addMonths بدلاً من addDays لضمان الانتقال للشهر التالي في التقويم
        $nextMonthStartDate = $startDate->copy()->addMonths($nextMonthNumber - 1)->startOfMonth();

        $monthlyDonationAmount = $this->getMonthlyDonationAmount();
        if ($monthlyDonationAmount === null) {
            return null;
        }

        $monthlyPhase = self::create([
            'donor_code' => $this->donor_code,
            'project_name' => $this->project_name . ' - الشهر ' . $nextMonthNumber,
            'project_description' => $this->project_description,
            'donor_name' => $this->donor_name,
            'project_type' => $this->project_type,
            'project_type_id' => $this->project_type_id,
            // ✅ المبلغ الشهري بالعملة المحلية (قبل التحويل والخصم)
            'donation_amount' => $monthlyDonationAmount,
            'currency_id' => $this->currency_id,
            'exchange_rate' => $this->exchange_rate,
            // ✅ نفس نسبة الخصم الإداري من المشروع الأب
            'admin_discount_percentage' => $this->admin_discount_percentage,
            // amount_in_usd, discount_amount, net_amount سيتم حسابها تلقائياً في boot()
            'estimated_duration_days' => $this->estimated_duration_days, // ✅ استخدام نفس عدد الأيام من المشروع الأصلي
            'is_divided_into_phases' => false,
            'phase_type' => null,
            'phase_duration_days' => null,
            'phase_start_date' => null,
            'total_months' => null,
            'status' => 'جديد',
            'parent_project_id' => $this->id,
            'phase_day' => null,
            'is_daily_phase' => false,
            'month_number' => $nextMonthNumber,
            'is_monthly_phase' => true,
            'month_start_date' => $nextMonthStartDate->format('Y-m-d'),
            'execution_date' => $nextMonthStartDate->format('Y-m-d'),
            'created_by' => $this->created_by,
            // ✅ إضافة: نسخ subcategory_id من المشروع الأصلي
            'subcategory_id' => $this->subcategory_id,
            // ✅ توريث الملاحظات وصورة الملاحظات من المشروع الأصلي
            'notes' => $this->notes,
            'notes_image' => $this->notes_image,
        ]);

        // Record in timeline
        $monthlyPhase->recordStatusChange(null, 'جديد', $this->created_by, "تم إنشاء المشروع الشهري - الشهر {$nextMonthNumber}");

        // ✅ توريث صور الملاحظات (من project_proposal_images) للمشروع الفرعي
        $this->copyNoteImagesToChild($monthlyPhase);

        // Record in parent project timeline
        $this->recordStatusChange($this->status, $this->status, $this->created_by, "تم إنشاء المشروع الشهري - الشهر {$nextMonthNumber} من {$this->total_months}");

        // ✅ إضافة الأيتام الثابتين تلقائياً للمشروع الشهري الجديد
        if ($this->isSponsorshipProject()) {
            $this->syncRecurringOrphansToMonthlyPhase($monthlyPhase);
        }

        // ✅ مسح cache للمشاريع المقسمة الفرعية الجديدة
        $this->clearProjectsCacheVersion();

        return $monthlyPhase;
    }

    /**
     * Delete all monthly phase projects
     */
    public function deleteMonthlyPhases()
    {
        $deletedCount = $this->monthlyPhases()->delete();
        
        if ($deletedCount > 0) {
            $this->recordStatusChange($this->status, $this->status, $this->created_by ?? 1, "تم حذف المشاريع الشهرية");
        }
        
        return $deletedCount;
    }

    /**
     * Update child projects (daily or monthly phases) when parent project is updated
     * ✅ تحديث المشاريع الفرعية تلقائياً عند تحديث المشروع الأصلي
     */
    public function updateChildProjects($updatedFields = [])
    {
        // التحقق من أن هذا مشروع أصلي (ليس مشروع فرعي)
        if (!$this->isParentProject()) {
            return;
        }

        // ✅ معالجة خاصة: إذا تم تحديث phase_duration_days للمشاريع اليومية
        // يجب حذف المشاريع القديمة وإنشاء جديدة بالعدد الجديد مع إعادة حساب المبالغ
        if ($this->phase_type === 'daily' && in_array('phase_duration_days', $updatedFields)) {
            // حذف المشاريع اليومية القديمة
            $this->deleteDailyPhases();
            
            // إنشاء مشاريع يومية جديدة بالعدد الجديد (سيتم حساب المبالغ تلقائياً)
            if ($this->is_divided_into_phases && $this->phase_duration_days && $this->phase_start_date) {
                $this->createDailyPhases();
                $this->recordStatusChange(
                    $this->status,
                    $this->status,
                    $this->created_by ?? 1,
                    "تم تحديث عدد الأيام إلى {$this->phase_duration_days} وإعادة حساب المبالغ وإنشاء المشاريع اليومية الجديدة"
                );
                $this->clearProjectsCacheVersion();
                return; // لا حاجة للمتابعة لأننا أنشأنا مشاريع جديدة
            }
        }

        // ✅ معالجة خاصة: إذا تم تحديث phase_start_date للمشاريع اليومية
        // يجب إعادة إنشاء المشاريع بالتواريخ الجديدة
        if ($this->phase_type === 'daily' && in_array('phase_start_date', $updatedFields)) {
            // حذف المشاريع اليومية القديمة
            $this->deleteDailyPhases();
            
            // إنشاء مشاريع يومية جديدة بالتواريخ الجديدة
            if ($this->is_divided_into_phases && $this->phase_duration_days && $this->phase_start_date) {
                $this->createDailyPhases();
                $this->recordStatusChange(
                    $this->status,
                    $this->status,
                    $this->created_by ?? 1,
                    "تم تحديث تاريخ البدء وإعادة إنشاء المشاريع اليومية"
                );
                $this->clearProjectsCacheVersion();
                return; // لا حاجة للمتابعة لأننا أنشأنا مشاريع جديدة
            }
        }

        // تحديد الحقول التي يجب تحديثها في المشاريع الفرعية
        $allSyncableFields = [
            'donor_code',
            'donor_name',
            'project_description',
            'project_type',
            'project_type_id',
            'subcategory_id',
            'currency_id',
            'exchange_rate',
            'project_name',
        ];

        // للمشاريع الشهرية فقط: تحديث admin_discount_percentage
        $monthlySyncableFields = array_merge($allSyncableFields, ['admin_discount_percentage']);

        // إذا تم تمرير updatedFields، نحدّث فقط الحقول التي تم تحديثها
        $fieldsToSync = [];
        $monthlyFieldsToSync = [];
        
        if (!empty($updatedFields)) {
            // تصفية الحقول التي يجب مزامنتها
            $fieldsToSync = array_intersect($allSyncableFields, $updatedFields);
            $monthlyFieldsToSync = array_intersect($monthlySyncableFields, $updatedFields);
        } else {
            // إذا لم يتم تمرير updatedFields، نحدّث جميع الحقول القابلة للمزامنة
            $fieldsToSync = $allSyncableFields;
            $monthlyFieldsToSync = $monthlySyncableFields;
        }

        // إذا لم يكن هناك حقول للتحديث، لا نفعل شيء
        if (empty($fieldsToSync) && empty($monthlyFieldsToSync)) {
            return;
        }

        // إعداد بيانات التحديث للمشاريع اليومية (بدون project_name)
        $dailyUpdateData = [];
        foreach ($fieldsToSync as $field) {
            if ($field !== 'project_name' && isset($this->$field)) {
                $dailyUpdateData[$field] = $this->$field;
            }
        }

        // إعداد بيانات التحديث للمشاريع الشهرية (بدون project_name)
        $monthlyUpdateData = [];
        foreach ($monthlyFieldsToSync as $field) {
            if ($field !== 'project_name' && isset($this->$field)) {
                $monthlyUpdateData[$field] = $this->$field;
            }
        }

        $hasUpdates = false;

        // تحديث اسم المشروع في المشاريع الفرعية (مع الحفاظ على "- اليوم X" أو "- الشهر X")
        if (in_array('project_name', $fieldsToSync) || in_array('project_name', $monthlyFieldsToSync)) {
            // تحديث المشاريع اليومية
            $dailyPhases = $this->dailyPhases()->get();
            foreach ($dailyPhases as $dailyPhase) {
                $phaseUpdateData = $dailyUpdateData;
                
                // استخراج رقم اليوم من الاسم الحالي أو استخدام phase_day
                if (preg_match('/\s-\sاليوم\s(\d+)$/', $dailyPhase->project_name, $matches)) {
                    $dayNumber = $matches[1];
                } else {
                    $dayNumber = $dailyPhase->phase_day ?? 1;
                }
                
                $phaseUpdateData['project_name'] = $this->project_name . ' - اليوم ' . $dayNumber;
                
                // تحديث المشروع اليومي
                $dailyPhase->update($phaseUpdateData);
                $hasUpdates = true;
            }

            // تحديث المشاريع الشهرية
            $monthlyPhases = $this->monthlyPhases()->get();
            foreach ($monthlyPhases as $monthlyPhase) {
                $phaseUpdateData = $monthlyUpdateData;
                
                // استخراج رقم الشهر من الاسم الحالي أو استخدام month_number
                if (preg_match('/\s-\sالشهر\s(\d+)$/', $monthlyPhase->project_name, $matches)) {
                    $monthNumber = $matches[1];
                } else {
                    $monthNumber = $monthlyPhase->month_number ?? 1;
                }
                
                $phaseUpdateData['project_name'] = $this->project_name . ' - الشهر ' . $monthNumber;
                
                // تحديث المشروع الشهري
                $monthlyPhase->update($phaseUpdateData);
                $hasUpdates = true;
            }
        } else {
            // إذا لم يتم تحديث project_name، نحدّث الحقول الأخرى فقط
            // تحديث المشاريع اليومية
            if (!empty($dailyUpdateData)) {
                $this->dailyPhases()->update($dailyUpdateData);
                $hasUpdates = true;
            }

            // تحديث المشاريع الشهرية
            if (!empty($monthlyUpdateData)) {
                $this->monthlyPhases()->update($monthlyUpdateData);
                $hasUpdates = true;
            }
        }

        // تسجيل في Timeline
        if ($hasUpdates) {
            $this->recordStatusChange(
                $this->status,
                $this->status,
                $this->created_by ?? 1,
                "تم تحديث المشاريع الفرعية تلقائياً عند تحديث المشروع الأصلي"
            );
        }

        // مسح cache
        $this->clearProjectsCacheVersion();
    }

    // ==================== Warehouse & Surplus Methods ====================

    /**
     * حساب تكلفة الطرد الواحد (للأصناف المؤكدة فقط)
     */
    public function calculateUnitCost()
    {
        return $this->confirmedWarehouseItems()->sum('total_price_per_unit');
    }

    /**
     * حساب تكلفة الطرد الواحد المتوقعة (لجميع الأصناف بما فيها pending)
     */
    public function calculateExpectedUnitCost()
    {
        return $this->warehouseItems()
            ->whereIn('status', ['pending', 'confirmed'])
            ->sum('total_price_per_unit');
    }

    /**
     * حساب التكلفة الإجمالية للتوريد
     */
    public function calculateSupplyCost()
    {
        if (!$this->quantity || $this->quantity <= 0) {
            return 0;
        }
        return round($this->calculateUnitCost() * $this->quantity, 2);
    }

    /**
     * حساب الوافر/العجز (يستخدم المبلغ المتاح بالعملة الصحيحة)
     * ✅ المشاريع الأصلية المقسمة ترجع 0 لأن الفائض/العجز يُحسب من المشاريع الفرعية
     */
    public function calculateSurplus()
    {
        // ✅ المشاريع الأصلية المقسمة لا تُحسب لأن الفائض/العجز في المشاريع الفرعية
        if ($this->isParentProject()) {
            return 0;
        }
        
        $supplyCost = $this->calculateSupplyCost();
        $availableAmount = $this->getAvailableAmountForSupply();
        return round($availableAmount - $supplyCost, 2);
    }

    /**
     * التحقق من وجود عجز
     * ✅ المشاريع الأصلية المقسمة لا يوجد فيها عجز لأن الفائض/العجز في المشاريع الفرعية
     */
    public function hasDeficit()
    {
        // ✅ المشاريع الأصلية المقسمة لا يوجد فيها عجز
        if ($this->isParentProject()) {
            return false;
        }
        
        return $this->calculateSurplus() < 0;
    }

    /**
     * تسجيل الوافر (يستخدم المبلغ المتاح بالعملة الصحيحة)
     * ✅ المشاريع الأصلية المقسمة لا تُسجل فيها فائض/عجز (null) لأن الفائض/العجز في المشاريع الفرعية
     */
    public function recordSurplus($userId, $notes = null)
    {
        // ✅ المشاريع الأصلية المقسمة لا تُسجل فيها فائض/عجز
        if ($this->isParentProject()) {
            $this->update([
                'unit_cost' => null,
                'supply_cost' => null,
                'surplus_amount' => null,
                'has_deficit' => false,
                'surplus_notes' => $notes ?? 'المشروع مقسم - الفائض/العجز يُحسب من المشاريع الفرعية',
                'surplus_recorded_at' => now(),
                'surplus_recorded_by' => $userId,
            ]);
            return;
        }
        
        $unitCost = $this->calculateUnitCost();
        $supplyCost = $this->calculateSupplyCost();
        $availableAmount = $this->getAvailableAmountForSupply();
        $surplus = round($availableAmount - $supplyCost, 2);
        
        $this->update([
            'unit_cost' => $unitCost,
            'supply_cost' => $supplyCost,
            'surplus_amount' => $surplus,
            'has_deficit' => $surplus < 0,
            'surplus_notes' => $notes,
            'surplus_recorded_at' => now(),
            'surplus_recorded_by' => $userId,
        ]);
    }

    // ==================== Shekel Conversion Methods ====================

    /**
     * تحويل المبلغ الصافي للشيكل
     * 
     * العملية:
     * 1. استخدام net_amount (المبلغ الصافي بعد تحويله للدولار وخصم النسبة الإدارية)
     * 2. خصم نسبة خصم النقل (transfer_discount_percentage) من net_amount
     * 3. تحويل المبلغ بعد الخصم للشيكل باستخدام سعر الصرف
     * 
     * ملاحظة: نسبة خصم النقل هي نفسها نسبة الخصم للتحويل
     * 
     * @param float $exchangeRate سعر الصرف (1 دولار = ? شيكل)
     * @param int $userId معرف المستخدم
     * @param float $transferDiscountPercentage نسبة خصم النقل (مطلوبة - هي نفسها نسبة الخصم للتحويل)
     * @return float المبلغ بالشيكل بعد خصم نسبة النقل
     */
    public function convertToShekel($exchangeRate, $userId, $transferDiscountPercentage)
    {
        // ✅ استخدام net_amount (المبلغ الصافي بعد تحويله للدولار وخصم النسبة الإدارية)
        // net_amount = amount_in_usd - (amount_in_usd * admin_discount_percentage / 100)
        $baseAmount = $this->net_amount;
        
        // ✅ إذا لم يكن net_amount موجوداً، نحسبه من amount_in_usd مع خصم النسبة الإدارية
        if (!$baseAmount || $baseAmount <= 0) {
            // حساب المبلغ بالدولار (قبل الخصم)
            $amountInUsd = $this->amount_in_usd ?? round($this->donation_amount * ($this->exchange_rate ?? 1), 2);
            
            // خصم النسبة الإدارية من المبلغ بالدولار
            $adminDiscountPercentage = $this->admin_discount_percentage ?? 0;
            $adminDiscountAmount = round($amountInUsd * ($adminDiscountPercentage / 100), 2);
            $baseAmount = round($amountInUsd - $adminDiscountAmount, 2);
        }
        
        // ✅ خصم نسبة خصم النقل من net_amount (هي نفسها نسبة الخصم للتحويل)
        $transferDiscountAmount = round($baseAmount * ($transferDiscountPercentage / 100), 2);
        $netAmountAfterTransferDiscount = round($baseAmount - $transferDiscountAmount, 2);
        
        // ✅ تحويل المبلغ بعد خصم نسبة النقل للشيكل باستخدام سعر الصرف
        $netAmountShekel = round($netAmountAfterTransferDiscount * $exchangeRate, 2);
        
        // ✅ Log للحسابات (للتشخيص)
        \Log::info('Convert to Shekel Calculation', [
            'project_id' => $this->id,
            'net_amount' => $this->net_amount, // المبلغ الصافي بعد تحويله للدولار وخصم النسبة الإدارية
            'base_amount' => $baseAmount,
            'transfer_discount_percentage' => $transferDiscountPercentage, // نسبة خصم النقل (هي نفسها نسبة الخصم للتحويل)
            'transfer_discount_amount' => $transferDiscountAmount,
            'net_amount_after_transfer_discount' => $netAmountAfterTransferDiscount,
            'shekel_exchange_rate' => $exchangeRate, // سعر الصرف (1 دولار = ? شيكل)
            'net_amount_shekel' => $netAmountShekel, // المبلغ النهائي بالشيكل
        ]);
        
        $this->update([
            'shekel_exchange_rate' => $exchangeRate,
            'net_amount_shekel' => $netAmountShekel,
            'shekel_converted_at' => now(),
            'shekel_converted_by' => $userId,
        ]);
        
        return $netAmountShekel;
    }

    /**
     * التحقق من وجود تحويل للشيكل
     */
    public function hasShekelConversion()
    {
        return !is_null($this->shekel_exchange_rate) && !is_null($this->net_amount_shekel);
    }

    /**
     * الحصول على المبلغ المتاح للتوريد (بالشيكل إذا تم التحويل، وإلا بالدولار)
     */
    public function getAvailableAmountForSupply()
    {
        return $this->hasShekelConversion() ? $this->net_amount_shekel : $this->net_amount;
    }

    /**
     * العملة المستخدمة للتوريد
     */
    public function getSupplyCurrency()
    {
        return $this->hasShekelConversion() ? 'ILS' : 'USD';
    }

    // ==================== Beneficiaries Methods ====================

    /**
     * Check if project has beneficiaries Excel file
     */
    public function hasBeneficiariesFile()
    {
        return !empty($this->beneficiaries_excel_file);
    }

    /**
     * Get beneficiaries Excel file URL
     */
    public function getBeneficiariesExcelUrlAttribute()
    {
        if (!$this->beneficiaries_excel_file) {
            return null;
        }

        // If it's already a full URL, return it
        if (str_starts_with($this->beneficiaries_excel_file, 'http://') || 
            str_starts_with($this->beneficiaries_excel_file, 'https://')) {
            return $this->beneficiaries_excel_file;
        }

        // Get base URL
        try {
            $baseUrl = request()->getSchemeAndHttpHost();
            if (str_contains($baseUrl, 'localhost') && !str_contains($baseUrl, ':')) {
                $baseUrl = str_replace('localhost', 'localhost:8000', $baseUrl);
            }
        } catch (\Exception $e) {
            $baseUrl = config('app.url', 'http://localhost:8000');
        }

        return rtrim($baseUrl, '/') . '/' . ltrim($this->beneficiaries_excel_file, '/');
    }

    /**
     * مسح cache version للمشاريع - يتم استدعاؤه عند إنشاء/تحديث/حذف مشاريع مقسمة فرعية
     * هذا يضمن أن المشاريع المقسمة الفرعية الجديدة تظهر فوراً في قائمة المشاريع
     * ✅ يستخدم Service مركزي لإدارة cache
     */
    private function clearProjectsCacheVersion(): void
    {
        ProjectsCacheService::updateCacheVersion('ProjectProposal Model - Phase Creation', $this->id);
    }

    /**
     * Accessor لتسهيل الوصول لسبب الرفض من أي مصدر
     * يعيد أول سبب رفض موجود بالترتيب: rejection_reason -> admin_rejection_reason -> media_rejection_reason
     * 
     * @return string|null
     */
    public function getRejectionReasonDisplayAttribute()
    {
        return $this->rejection_reason 
            ?? $this->admin_rejection_reason 
            ?? $this->media_rejection_reason 
            ?? null;
    }

    /**
     * Get count of sponsored orphans
     * Uses loaded relation when present to avoid N+1 queries in listings.
     */
    public function getSponsoredOrphansCount()
    {
        if ($this->relationLoaded('sponsoredOrphans')) {
            return $this->sponsoredOrphans->count();
        }
        return $this->sponsoredOrphans()->count();
    }

    /**
     * Get count of recurring orphans
     */
    public function getRecurringOrphansCount()
    {
        return $this->recurringOrphans()->count();
    }

    /**
     * Check if this is a sponsorship project
     * يتم التحقق من project_type + subcategory معاً
     * يجب أن يكون: project_type = 'الكفالات' AND subcategory = 'كفالة أيتام'
     */
    public function isSponsorshipProject()
    {
        // يجب أن يكون نوع المشروع = 'الكفالات'
        if ($this->project_type !== 'الكفالات') {
            return false;
        }

        // يجب أن يكون له تفريعة
        if (!$this->subcategory_id) {
            return false;
        }

        // التحقق من subcategory name_ar = 'كفالة أيتام' أو name = 'Orphan Sponsorship'
        $subcategory = $this->subcategory;
        if ($subcategory && (
            strtolower(trim($subcategory->name_ar ?? '')) === 'كفالة أيتام' ||
            strtolower(trim($subcategory->name ?? '')) === 'orphan sponsorship'
        )) {
            return true;
        }

        return false;
    }

    /**
     * Sync recurring orphans to monthly phases
     * إضافة الأيتام الثابتين تلقائياً للمشاريع الشهرية الجديدة
     */
    public function syncRecurringOrphansToMonthlyPhases()
    {
        if (!$this->is_divided_into_phases || $this->phase_type !== 'monthly') {
            return;
        }

        // جلب الأيتام الثابتين من المشروع الأصلي
        $recurringOrphans = $this->recurringOrphans()->get();

        if ($recurringOrphans->isEmpty()) {
            return;
        }

        // جلب جميع المشاريع الشهرية
        $monthlyPhases = $this->monthlyPhases()->get();

        foreach ($monthlyPhases as $monthlyPhase) {
            $this->syncRecurringOrphansToMonthlyPhase($monthlyPhase);
        }
    }

    /**
     * Sync recurring orphans to a single monthly phase
     * إضافة الأيتام الثابتين لمشروع شهري واحد
     */
    private function syncRecurringOrphansToMonthlyPhase($monthlyPhase)
    {
        // جلب الأيتام الثابتين من المشروع الأصلي
        $recurringOrphans = $this->recurringOrphans()->get();

        if ($recurringOrphans->isEmpty()) {
            return;
        }

        foreach ($recurringOrphans as $orphan) {
            // التحقق من أن اليتيم غير موجود بالفعل في المشروع الشهري
            // ✅ إصلاح: التحقق مباشرة من pivot table لتجنب غموض orphan_id_number
            $exists = DB::table('orphan_project_proposals')
                ->where('project_proposal_id', $monthlyPhase->id)
                ->where('orphan_id_number', $orphan->orphan_id_number)
                ->exists();

            if (!$exists) {
                // إضافة اليتيم الثابت للمشروع الشهري
                $monthlyPhase->sponsoredOrphans()->attach($orphan->orphan_id_number, [
                    'is_recurring' => true,
                    'sponsorship_amount' => $orphan->pivot->sponsorship_amount ?? null,
                    'sponsorship_start_date' => $orphan->pivot->sponsorship_start_date ?? null,
                    'notes' => $orphan->pivot->notes ?? null,
                ]);
            }
        }
    }

    /**
     * Accessor for sponsored_orphans_count
     */
    public function getSponsoredOrphansCountAttribute()
    {
        return $this->getSponsoredOrphansCount();
    }

    /**
     * Accessor for has_sponsored_orphans
     */
    public function getHasSponsoredOrphansAttribute()
    {
        return $this->getSponsoredOrphansCount() > 0;
    }
}


