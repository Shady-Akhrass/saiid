<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create admin user
        User::updateOrCreate(
            ['email' => 'admin@saiid.org'],
            [
                'name' => 'Admin User',
                'email' => 'admin@saiid.org',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'department' => 'إدارة', // Valid enum value
                'is_active' => true,
                'phone_number' => '+966500000000',
                'added_by' => null, // System created
            ]
        );

        $this->command->info('Admin user created successfully: admin@saiid.org / password');
    }
}
