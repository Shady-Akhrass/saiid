<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Teacher extends Model
{
    use HasFactory;
    protected $primaryKey = 'id_number';
    public $incrementing = false;
    protected $keyType = 'bigint';

    protected $fillable = [
        'id_number',
        'name',
        'birth_date',
        'gender',
        'university_major',
        'marital_status',
        'address_details',
        'guardian_phone_number',
        'alternative_phone_number',
    ];
}
