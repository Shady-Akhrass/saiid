<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Beneficiary extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_proposal_id',
        'name',
        'id_number',
        'phone',
        'address',
        'governorate',
        'district',
        'aid_type',
        'notes',
    ];

    // ==================== Relationships ====================

    /**
     * Get the project proposal that this beneficiary belongs to
     */
    public function projectProposal()
    {
        return $this->belongsTo(ProjectProposal::class, 'project_proposal_id');
    }

    // ==================== Accessors ====================

    /**
     * Get aid type from subcategory if not stored locally
     */
    public function getAidTypeAttribute($value)
    {
        // If aid_type is stored, return it
        if ($value) {
            return $value;
        }

        // Otherwise, get it from project's subcategory
        if ($this->projectProposal && $this->projectProposal->subcategory) {
            return $this->projectProposal->subcategory->name_ar;
        }

        return null;
    }

    // ==================== Scopes ====================

    /**
     * Scope to filter beneficiaries by aid type
     */
    public function scopeByAidType($query, $aidType)
    {
        return $query->where('aid_type', $aidType);
    }

    // ==================== Static Methods ====================

    /**
     * Get count of unique beneficiaries by aid type (excluding duplicates by id_number)
     * 
     * @param string $aidType
     * @return int
     */
    public static function getUniqueBeneficiariesCountByAidType($aidType)
    {
        return self::where('aid_type', $aidType)
            ->groupBy('id_number')
            ->count();
    }

    /**
     * Get list of unique beneficiaries by aid type (excluding duplicates by id_number)
     * 
     * @param string $aidType
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public static function getUniqueBeneficiariesByAidType($aidType)
    {
        return self::where('aid_type', $aidType)
            ->select('id_number', 'name', 'phone', 'address', 'governorate', 'district')
            ->groupBy('id_number', 'name', 'phone', 'address', 'governorate', 'district')
            ->get();
    }
}
