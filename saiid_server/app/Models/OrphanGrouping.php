<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

/**
 * OrphanGrouping Model
 * 
 * Represents a group of orphans with specific criteria and capacity limits.
 * Supports smart selection based on various orphan characteristics.
 */
class OrphanGrouping extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'max_capacity',
        'current_count',
        'selection_criteria',
        'governorate_filter',
        'district_filter',
        'exclude_adopted',
        'exclusion_notes',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'selection_criteria' => 'array',
        'exclude_adopted' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Group statuses
    const STATUS_ACTIVE = 'active';
    const STATUS_INACTIVE = 'inactive';
    const STATUS_FULL = 'full';
    const STATUS_ARCHIVED = 'archived';

    // Member statuses
    const MEMBER_STATUS_ACTIVE = 'active';
    const MEMBER_STATUS_INACTIVE = 'inactive';
    const MEMBER_STATUS_TRANSFERRED = 'transferred';
    const MEMBER_STATUS_GRADUATED = 'graduated';

    /**
     * Get the orphans in this grouping
     */
    public function orphans(): BelongsToMany
    {
        return $this->belongsToMany(Orphan::class, 'orphan_grouping_members', 'grouping_id', 'orphan_id', 'id', 'orphan_id_number')
            ->withPivot(['status', 'joined_at', 'left_at', 'notes'])
            ->withTimestamps();
    }

    /**
     * Get active members only
     */
    public function activeOrphans(): BelongsToMany
    {
        return $this->orphans()
            ->wherePivot('status', self::MEMBER_STATUS_ACTIVE);
    }

    /**
     * Get the admin who created this grouping
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the admin who last updated this grouping
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Check if group is at full capacity
     */
    public function isFull(): bool
    {
        return $this->current_count >= $this->max_capacity;
    }

    /**
     * Get available capacity
     */
    public function getAvailableCapacity(): int
    {
        return max(0, $this->max_capacity - $this->current_count);
    }

    /**
     * Update current count based on active members
     */
    public function updateCurrentCount(): void
    {
        $this->current_count = $this->activeOrphans()->count();
        $this->save();
    }

    /**
     * Get eligible orphans based on selection criteria
     */
    public function getEligibleOrphans(): \Illuminate\Database\Eloquent\Collection
    {
        $query = Orphan::query();

        // Apply location filters (using current_address enum)
        if ($this->governorate_filter) {
            $query->where('current_address', $this->governorate_filter);
        }
        // Note: district_filter is not available in the current table structure

        // Apply exclusion rules
        if ($this->exclude_adopted) {
            // Note: adoption_status field doesn't exist in current table structure
            // This would need to be added to the orphans table
            // $query->where('adoption_status', '!=', 'adopted');
        }

        // Apply selection criteria
        $criteria = $this->selection_criteria ?? [];
        
        // Parent status filters
        if (isset($criteria['mother_status']) && !empty($criteria['mother_status'])) {
            $motherStatusConditions = [];
            foreach ($criteria['mother_status'] as $status) {
                if ($status === 'deceased') {
                    $motherStatusConditions[] = 'is_mother_deceased = نعم';
                } elseif ($status === 'alive') {
                    $motherStatusConditions[] = 'is_mother_deceased = لا';
                }
            }
            if (!empty($motherStatusConditions)) {
                $query->whereRaw('(' . implode(' OR ', $motherStatusConditions) . ')');
            }
        }

        // Health conditions filter
        if (isset($criteria['health_conditions']) && !empty($criteria['health_conditions'])) {
            $healthConditions = [];
            foreach ($criteria['health_conditions'] as $condition) {
                if ($condition === 'healthy') {
                    $healthConditions[] = 'health_status = جيدة';
                } elseif ($condition === 'sick' || $condition === 'chronic') {
                    $healthConditions[] = 'health_status = مريض';
                }
            }
            if (!empty($healthConditions)) {
                $query->whereRaw('(' . implode(' OR ', $healthConditions) . ')');
            }
        }

        // Memorization filter
        if (isset($criteria['in_memorization'])) {
            if ($criteria['in_memorization']) {
                $query->where('is_enrolled_in_memorization_center', 'نعم');
            } else {
                $query->where('is_enrolled_in_memorization_center', 'لا');
            }
        }

        // Age range filter
        if (isset($criteria['age_range'])) {
            $minAge = $criteria['age_range']['min'] ?? 0;
            $maxAge = $criteria['age_range']['max'] ?? 100;
            
            $query->whereRaw('TIMESTAMPDIFF(YEAR, orphan_birth_date, CURDATE()) BETWEEN ? AND ?', [$minAge, $maxAge]);
        }

        // Gender filter
        if (isset($criteria['gender']) && $criteria['gender'] !== 'both') {
            $gender = $criteria['gender'] === 'male' ? 'ذكر' : 'أنثى';
            $query->where('orphan_gender', $gender);
        }

        // Exclude already assigned orphans
        $assignedOrphanIds = $this->orphans()->pluck('orphan_id_number')->toArray();
        if (!empty($assignedOrphanIds)) {
            $query->whereNotIn('orphan_id_number', $assignedOrphanIds);
        }

        return $query->get();
    }

    /**
     * Add orphan to group
     */
    public function addOrphan($orphanId, $notes = null): bool
    {
        if ($this->isFull()) {
            return false;
        }

        $this->orphans()->attach($orphanId, [
            'status' => self::MEMBER_STATUS_ACTIVE,
            'joined_at' => now(),
            'notes' => $notes,
        ]);

        $this->updateCurrentCount();
        return true;
    }

    /**
     * Remove orphan from group
     */
    public function removeOrphan($orphanId, $status = self::MEMBER_STATUS_INACTIVE, $notes = null): bool
    {
        $this->orphans()->updateExistingPivot($orphanId, [
            'status' => $status,
            'left_at' => now(),
            'notes' => $notes,
        ]);

        $this->updateCurrentCount();
        return true;
    }

    /**
     * Smart selection - automatically select orphans based on criteria
     */
    public function smartSelect(int $count = null): \Illuminate\Database\Eloquent\Collection
    {
        $count = $count ?? $this->getAvailableCapacity();
        $eligibleOrphans = $this->getEligibleOrphans();
        
        return $eligibleOrphans->take($count);
    }

    /**
     * Fuzzy search for orphans
     */
    public static function fuzzySearch(string $query): \Illuminate\Database\Eloquent\Collection
    {
        return Orphan::where('orphan_full_name', 'LIKE', "%{$query}%")
            ->orWhere('current_address', 'LIKE', "%{$query}%")
            ->orWhere('orphan_id_number', 'LIKE', "%{$query}%")
            ->get();
    }

    /**
     * Scope for active groups
     */
    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    /**
     * Scope for groups with available capacity
     */
    public function scopeWithCapacity($query)
    {
        return $query->whereRaw('current_count < max_capacity');
    }

    /**
     * Get group statistics
     */
    public function getStatistics(): array
    {
        $orphans = $this->activeOrphans();
        
        return [
            'total_count' => $orphans->count(),
            'male_count' => $orphans->where('orphan_gender', 'ذكر')->count(),
            'female_count' => $orphans->where('orphan_gender', 'أنثى')->count(),
            'average_age' => $orphans->avg(function($orphan) {
                return Carbon::parse($orphan->orphan_birth_date)->age;
            }),
            'health_distribution' => [
                'healthy' => $orphans->where('health_status', 'جيدة')->count(),
                'sick' => $orphans->where('health_status', 'مريض')->count(),
            ],
            'memorization_count' => $orphans->where('is_enrolled_in_memorization_center', 'نعم')->count(),
            'parent_status' => [
                'mother_deceased' => $orphans->where('is_mother_deceased', 'نعم')->count(),
                'mother_alive' => $orphans->where('is_mother_deceased', 'لا')->count(),
            ],
        ];
    }
}
