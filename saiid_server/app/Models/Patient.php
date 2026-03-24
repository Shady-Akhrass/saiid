<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
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
        'current_address',
        'guardian_phone_number',
        'alternative_phone_number',
        'data_approval_name',

    ];
}
