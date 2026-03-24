<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

class SurplusCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * العلاقة مع المستخدم الذي أنشأ القسم
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * العلاقة مع المشاريع التي تنتمي لهذا القسم
     */
    public function projects()
    {
        return $this->hasMany(ProjectProposal::class, 'surplus_category_id');
    }

    /**
     * المشاريع التي لها وافر/عجز في هذا القسم
     * ✅ يستبعد المشاريع الأصلية المقسمة (لأنها تكرار)
     * ✅ إبقاء المشاريع الفرعية (اليومية والشهرية) والمشاريع غير المقسمة فقط
     */
    public function projectsWithSurplus()
    {
        return $this->hasMany(ProjectProposal::class, 'surplus_category_id')
            ->whereNotNull('surplus_amount')
            ->forSurplusStatistics(); // ✅ استبعاد المشاريع الأصلية المقسمة
    }

    /**
     * حساب الرصيد التراكمي للقسم (مجموع الوافر - مجموع العجز) - بالشيكل دائماً
     * ✅ استخدام surplus_amount المحفوظ مباشرة (نفس القيمة المعروضة في قائمة المشاريع)
     */
    public function getTotalBalance()
    {
        try {
            // ✅ استخدام surplus_amount المحفوظ مباشرة (نفس القيمة المعروضة في قائمة المشاريع)
            $totalSurplus = $this->projectsWithSurplus()
                ->where('has_deficit', false)
                ->sum('surplus_amount') ?? 0;
            
            $totalDeficit = $this->projectsWithSurplus()
                ->where('has_deficit', true)
                ->sum('surplus_amount') ?? 0;
            
            // ✅ totalDeficit سالب، لذلك نستخدم abs() للعرض
            return $totalSurplus - $totalDeficit;
        } catch (\Exception $e) {
            Log::error('Error in getTotalBalance', [
                'category_id' => $this->id,
                'error' => $e->getMessage()
            ]);
            return 0;
        }
    }

    /**
     * حساب إجمالي الوافر فقط (المشاريع الموجبة) - بالشيكل دائماً
     * ✅ استخدام surplus_amount المحفوظ مباشرة (نفس القيمة المعروضة في قائمة المشاريع)
     */
    public function getTotalSurplus()
    {
        try {
            // ✅ استخدام surplus_amount المحفوظ مباشرة (نفس القيمة المعروضة في قائمة المشاريع)
            return $this->projectsWithSurplus()
                ->where('has_deficit', false)
                ->sum('surplus_amount') ?? 0;
        } catch (\Exception $e) {
            Log::error('Error in getTotalSurplus', [
                'category_id' => $this->id,
                'error' => $e->getMessage()
            ]);
            return 0;
        }
    }

    /**
     * حساب إجمالي العجز فقط (المشاريع السالبة) - بالشيكل دائماً
     * ✅ استخدام surplus_amount المحفوظ مباشرة (نفس القيمة المعروضة في قائمة المشاريع)
     */
    public function getTotalDeficit()
    {
        try {
            // ✅ استخدام surplus_amount المحفوظ مباشرة (نفس القيمة المعروضة في قائمة المشاريع)
            // totalDeficit سالب، لذلك نستخدم abs() للعرض
            $totalDeficit = $this->projectsWithSurplus()
                ->where('has_deficit', true)
                ->sum('surplus_amount') ?? 0;
            
            return abs($totalDeficit);
        } catch (\Exception $e) {
            Log::error('Error in getTotalDeficit', [
                'category_id' => $this->id,
                'error' => $e->getMessage()
            ]);
            return 0;
        }
    }

    /**
     * الحصول على مبلغ الفائض/العجز للمشروع بالشيكل
     * 
     * ✅ الحساب: الفائض = المبلغ الصافي بالشيكل - تكلفة التوريد بالشيكل
     * ✅ تكلفة التوريد = تكلفة الطرد الواحد × عدد الطرود (كلها بالشيكل)
     * 
     * @param ProjectProposal $project
     * @return float
     */
    private function getProjectSurplusInShekel($project)
    {
        try {
            if (!$project) {
                return 0;
            }
            
            // ✅ التحقق من وجود تحويل للشيكل مع معالجة الأخطاء
            $hasShekelConversion = false;
            try {
                if (method_exists($project, 'hasShekelConversion')) {
                    $hasShekelConversion = $project->hasShekelConversion();
                } else {
                    // ✅ Fallback: التحقق يدوياً
                    $hasShekelConversion = !is_null($project->shekel_exchange_rate ?? null) && !is_null($project->net_amount_shekel ?? null);
                }
            } catch (\Exception $e) {
                Log::warning('Error checking shekel conversion in getProjectSurplusInShekel', [
                    'project_id' => $project->id ?? null,
                    'error' => $e->getMessage()
                ]);
                // ✅ Fallback: التحقق يدوياً
                $hasShekelConversion = !is_null($project->shekel_exchange_rate ?? null) && !is_null($project->net_amount_shekel ?? null);
            }
            
            // ✅ إذا كان المشروع محولاً للشيكل
            if ($hasShekelConversion && $project->net_amount_shekel) {
                // ✅ حساب الفائض/العجز بالشيكل
                // الفائض = المبلغ الصافي بالشيكل - تكلفة التوريد بالشيكل
                $netAmountShekel = $project->net_amount_shekel ?? 0;
                
                // ✅ تكلفة التوريد بالشيكل
                // الأصناف في المخزن بالشيكل دائماً، إذن supply_cost بالشيكل
                $supplyCostShekel = $project->supply_cost ?? 0;
                
                // ✅ حساب الفائض/العجز بالشيكل
                $surplusAmountShekel = $netAmountShekel - $supplyCostShekel;
                return round($surplusAmountShekel, 2);
            } else {
                // ✅ إذا لم يكن محولاً للشيكل، نستخدم surplus_amount مباشرة
                // (يجب أن يكون بالشيكل إذا تم تأكيد التوريد)
                return round($project->surplus_amount ?? 0, 2);
            }
        } catch (\Exception $e) {
            Log::warning('Error calculating project surplus in shekel', [
                'project_id' => $project->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            // ✅ في حالة الخطأ، نستخدم surplus_amount مباشرة
            return round($project->surplus_amount ?? 0, 2);
        }
    }

    /**
     * عدد المشاريع في هذا القسم
     */
    public function getProjectsCount()
    {
        return $this->projectsWithSurplus()->count();
    }

    /**
     * عدد المشاريع مع وافر
     */
    public function getSurplusProjectsCount()
    {
        return $this->projectsWithSurplus()
            ->where('has_deficit', false)
            ->count();
    }

    /**
     * عدد المشاريع مع عجز
     */
    public function getDeficitProjectsCount()
    {
        return $this->projectsWithSurplus()
            ->where('has_deficit', true)
            ->count();
    }

    /**
     * الحصول على إحصائيات كاملة للقسم
     */
    public function getStatistics()
    {
        try {
            return [
                'category_id' => $this->id,
                'category_name' => $this->name,
                'total_balance' => round($this->getTotalBalance(), 2),
                'total_surplus' => round($this->getTotalSurplus(), 2),
                'total_deficit' => round($this->getTotalDeficit(), 2),
                'projects_count' => $this->getProjectsCount(),
                'surplus_projects_count' => $this->getSurplusProjectsCount(),
                'deficit_projects_count' => $this->getDeficitProjectsCount(),
            ];
        } catch (\Exception $e) {
            Log::error('Error in getStatistics for category ' . $this->id, [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            // ✅ إرجاع إحصائيات فارغة في حالة الخطأ
            return [
                'category_id' => $this->id,
                'category_name' => $this->name ?? 'غير محدد',
                'total_balance' => 0,
                'total_surplus' => 0,
                'total_deficit' => 0,
                'projects_count' => 0,
                'surplus_projects_count' => 0,
                'deficit_projects_count' => 0,
            ];
        }
    }

    /**
     * Scope للأقسام النشطة فقط
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}

