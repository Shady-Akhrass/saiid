<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class ProjectType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
    ];

    // ==================== Relationships ====================

    /**
     * Get all projects of this type
     */
    public function projects()
    {
        return $this->hasMany(ProjectProposal::class, 'project_type_id');
    }

    /**
     * Get all subcategories of this type
     */
    public function subcategories()
    {
        return $this->hasMany(ProjectSubcategory::class, 'project_type', 'name');
    }

    // ==================== Scopes ====================

    /**
     * Scope for ordering by name
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('name');
    }

    // ==================== Helper Methods ====================

    /**
     * Get statistics for this project type
     * ✅ عدد المستفيدين يُحسب من جدول beneficiaries (من ملفات Excel المرفوعة)
     * ✅ يشمل: المشاريع غير المقسمة + المشاريع المقسمة شهرياً + المشاريع المقسمة يومياً
     */
    public function getStatistics()
    {
        // ✅ جلب جميع المشاريع المرتبطة بنوع المشروع (غير المقسمة + المقسمة)
        // يشمل: المشاريع غير المقسمة + المشاريع المقسمة الأصلية + المشاريع المتفرعية (اليومية والشهرية)
        $projects = $this->projects()
            ->where('status', '!=', 'ملغى')
            ->get();
        
        // ✅ حساب عدد المستفيدين من جدول beneficiaries مباشرة
        // جمع عدد المستفيدين من جميع المشاريع المرتبطة بنوع المشروع
        // (غير المقسمة + المقسمة شهرياً + المقسمة يومياً)
        $projectIds = $projects->pluck('id')->toArray();
        
        $totalBeneficiaries = 0;
        if (!empty($projectIds)) {
            $totalBeneficiaries = DB::table('beneficiaries')
                ->whereIn('project_proposal_id', $projectIds)
                ->count();
        }
        
        return [
            'total_projects' => $projects->count(),
            'total_amount' => round($projects->sum('net_amount'), 2),
            'total_beneficiaries' => $totalBeneficiaries,
        ];
    }
}

