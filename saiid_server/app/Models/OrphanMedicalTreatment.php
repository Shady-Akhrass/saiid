<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrphanMedicalTreatment extends Model
{
    use HasFactory;

    protected $fillable = [
        'orphan_name',
        'orphan_id_number',
        'guardian_name',
        'guardian_id_number',
        'guardian_phone_number',
        'currently_in_khan_younis',
        'treatment_type',
        'physical_therapy_type',
        'physical_therapy_other_description',
        'is_registered_in_orphans',
    ];

    protected $casts = [
        'currently_in_khan_younis' => 'boolean',
        'is_registered_in_orphans' => 'boolean',
    ];

    /**
     * Relationship to Orphan model (if registered)
     */
    public function orphan()
    {
        return $this->belongsTo(Orphan::class, 'orphan_id_number', 'orphan_id_number');
    }
}

