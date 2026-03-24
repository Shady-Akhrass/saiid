<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class ProjectSubcategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'name_ar',
        'project_type',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Boot method to handle cache clearing
     */
    protected static function boot()
    {
        parent::boot();

        // ✅ مسح الكاش تلقائياً عند إنشاء تفريعة جديدة
        static::created(function ($model) {
            static::clearSubcategoriesCache();
        });

        // ✅ مسح الكاش تلقائياً عند تحديث تفريعة
        static::updated(function ($model) {
            static::clearSubcategoriesCache();
        });

        // ✅ مسح الكاش تلقائياً عند حذف تفريعة
        static::deleted(function ($model) {
            static::clearSubcategoriesCache();
        });
    }

    /**
     * مسح cache للتفريعات والمشاريع
     * يتم استدعاؤها تلقائياً من Model Events
     */
    protected static function clearSubcategoriesCache(): void
    {
        try {
            // ✅ استخدام Cache tags إذا كان متاحاً (Redis/Memcached)
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['subcategories', 'projects'])->flush();
            } else {
                // ✅ في حالة عدم دعم tags، نمسح cache keys المتعلقة
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    // Redis - مسح keys محددة
                    $redis = $cacheDriver->getRedis();
                    $patterns = ['*subcategories*', '*projects_*'];
                    foreach ($patterns as $pattern) {
                        $keys = $redis->keys($pattern);
                        if (!empty($keys)) {
                            $redis->del($keys);
                        }
                    }
                } else {
                    // Fallback: مسح جميع cache
                    Cache::flush();
                }
            }
        } catch (\Exception $e) {
            // ✅ في حالة فشل مسح cache، نستمر بدون خطأ
            Log::warning('Failed to clear subcategories cache from Model Event', [
                'error' => $e->getMessage()
            ]);
        }
    }

    // ==================== Relationships ====================

    /**
     * Get all projects in this subcategory
     */
    public function projects()
    {
        return $this->hasMany(ProjectProposal::class, 'subcategory_id');
    }

    /**
     * Get project type (via name matching)
     */
    public function projectType()
    {
        return $this->belongsTo(ProjectType::class, 'project_type', 'name');
    }

    // ==================== Scopes ====================

    /**
     * Scope for filtering by project type
     */
    public function scopeByProjectType($query, $type)
    {
        return $query->where('project_type', $type);
    }

    /**
     * Scope for active subcategories only
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // ==================== Helper Methods ====================

    /**
     * Get statistics for this subcategory
     * Returns: total_projects, total_amount, total_beneficiaries
     * ✅ عدد المستفيدين يُحسب من جدول beneficiaries (من ملفات Excel المرفوعة)
     * ✅ يشمل: المشاريع غير المقسمة + المشاريع المقسمة شهرياً + المشاريع المقسمة يومياً
     */
    public function getStatistics()
    {
        try {
            // ✅ استخدام استعلامات قاعدة البيانات مباشرة بدلاً من تحميل جميع البيانات
            // هذا يحسن الأداء بشكل كبير خاصة مع عدد كبير من المشاريع
            
            // حساب عدد المشاريع والمبلغ الإجمالي باستخدام aggregation
            $projectStats = $this->projects()
                ->where('status', '!=', 'ملغى')
                ->selectRaw('COUNT(*) as total_projects, COALESCE(SUM(net_amount), 0) as total_amount')
                ->first();
            
            $totalProjects = $projectStats->total_projects ?? 0;
            $totalAmount = round($projectStats->total_amount ?? 0, 2);
            
            // ✅ حساب عدد المستفيدين من جدول beneficiaries مباشرة
            // استخدام subquery لتجنب تحميل جميع project IDs في الذاكرة
            $totalBeneficiaries = DB::table('beneficiaries')
                ->whereIn('project_proposal_id', function($query) {
                    $query->select('id')
                        ->from('project_proposals')
                        ->where('subcategory_id', $this->id)
                        ->where('status', '!=', 'ملغى');
                })
                ->count();
            
            return [
                'total_projects' => (int) $totalProjects,
                'total_amount' => $totalAmount,
                'total_beneficiaries' => $totalBeneficiaries,
            ];
        } catch (\Exception $e) {
            // ✅ في حالة حدوث خطأ (مثل timeout)، نرجع قيم افتراضية
            Log::warning('Error calculating subcategory statistics', [
                'subcategory_id' => $this->id,
                'error' => $e->getMessage()
            ]);
            
            return [
                'total_projects' => 0,
                'total_amount' => 0,
                'total_beneficiaries' => 0,
            ];
        }
    }

    /**
     * Get projects grouped by status
     */
    public function getProjectsByStatus()
    {
        return $this->projects()
            ->where('status', '!=', 'ملغى')
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();
    }
}

