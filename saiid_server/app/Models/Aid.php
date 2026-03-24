<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Aid extends Model
{
    use HasFactory;
    protected $primaryKey = 'id_number';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id_number',
        'name',
        'birth_date',
        'gender',
        'health_status',
        'disease_description',
        'marital_status',
        'number_of_brothers',
        'number_of_sisters',
        'job',
        'salary',
        'original_address',
        'current_address',
        'address_details',
        'guardian_phone_number',
        'alternative_phone_number',
        'aid',
        'nature_of_aid',
        'data_approval_name',

    ];
}
