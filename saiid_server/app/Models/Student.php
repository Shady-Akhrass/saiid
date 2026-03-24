<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Student extends Model
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
        'academic_stage',
        'address_details',
        'guardian_phone_number',
        'alternative_phone_number',
    ];

}
