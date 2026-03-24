<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Visitor extends Model
{
    use HasFactory;
    protected $fillable = [
        'orphan_visitors',
        'aid_visitors',
        'teacher_visitors',
        'student_visitors',
        'shelter_visitors',
    ];
}
