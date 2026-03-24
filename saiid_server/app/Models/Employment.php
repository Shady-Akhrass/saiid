<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Employment extends Model
{
    use HasFactory;

    protected $fillable = [
        "name",
        "birth_date",
        "address",
        "specialization",
        "phone_number",
        "previous_work_url"
    ];
}
