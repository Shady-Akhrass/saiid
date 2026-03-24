<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Shelter extends Model
{
    use HasFactory;

    protected $primaryKey = 'manager_id_number';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'manager_id_number',
        'manager_name',
        'manager_phone',
        'manager_alternative_phone',
        'manager_job_description',
        'deputy_manager_name',
        'deputy_manager_id_number',
        'deputy_manager_phone',
        'deputy_manager_alternative_phone',
        'deputy_manager_job_description',
        'camp_name',
        'governorate',
        'district',
        'detailed_address',
        'tents_count',
        'families_count',
        'excel_sheet',
    ];

    protected $casts = [
        'tents_count' => 'integer',
        'families_count' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get all projects for this shelter
     */
    public function projects()
    {
        return $this->hasMany(Project::class, 'shelter_id', 'manager_id_number');
    }
}
