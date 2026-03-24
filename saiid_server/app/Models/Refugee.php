<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Refugee extends Model
{
    protected $primaryKey = 'husband_id_number';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'manager_id_number',
        'husband_id_number',
        'husband_name',
        'wife_name',
        'wife_id_number',
        'governorate',
        'district',
        'detailed_address',
        'phone_number',
        'alternative_phone_number',
        'male_family_members',
        'female_family_members',
        'children_under_2_years',
        'children_2_to_6_years',
        'children_6_to_18_years',
        'elderly_above_60',
        'pregnant_women',
        'nursing_women',
        'special_cases_count',
        'special_case_gender',
        'special_case_age',
        'special_case_type',
        'disease_type',
        'needs_type',
        'additional_details',
    ];
    public function shelter()
    {
        return $this->belongsTo(Shelter::class, 'manager_id_number', 'manager_id_number');
    }
}
