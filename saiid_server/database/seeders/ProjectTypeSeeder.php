<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProjectTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $types = [
            ['name' => 'إغاثي', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'تنموي', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'طبي', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'تعليمي', 'created_at' => now(), 'updated_at' => now()],
        ];

        DB::table('project_types')->insertOrIgnore($types);
    }
}

