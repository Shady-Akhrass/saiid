<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class WarehouseManagerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // إنشاء مدير مخزن
        User::create([
            'name' => 'مدير المخزن',
            'email' => 'warehouse@saiid.com',
            'password' => Hash::make('warehouse123'),
            'role' => 'warehouse_manager',
            'department' => 'إدارة', // أو 'مشاريع' حسب التنظيم
            'is_active' => true,
        ]);

        $this->command->info('✅ تم إنشاء مدير المخزن بنجاح!');
        $this->command->info('📧 Email: warehouse@saiid.com');
        $this->command->info('🔑 Password: warehouse123');
    }
}
