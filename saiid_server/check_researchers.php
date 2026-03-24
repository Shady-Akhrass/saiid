<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\TeamPersonnel;

$all = TeamPersonnel::all();
echo "Total personnel: " . $all->count() . "\n";

$researchers = TeamPersonnel::where('personnel_type', 'باحث')->get();
echo "Researchers count: " . $researchers->count() . "\n";

$activeResearchers = TeamPersonnel::where('personnel_type', 'باحث')->where('is_active', true)->get();
echo "Active researchers count: " . $activeResearchers->count() . "\n";

foreach ($researchers as $r) {
    echo "- ID: {$r->id}, Name: {$r->name}, Type: '{$r->personnel_type}', Active: " . ($r->is_active ? 'Yes' : 'No') . "\n";
}
