<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProjectSubcategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $subcategories = [
            // إغاثي
            [
                'name' => 'Food Distribution',
                'name_ar' => 'إطعام',
                'project_type' => 'إغاثي',
                'description' => 'مشاريع توزيع الطعام والوجبات للمحتاجين',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Health Baskets',
                'name_ar' => 'سلال صحية',
                'project_type' => 'إغاثي',
                'description' => 'توزيع سلال صحية تحتوي على مواد غذائية صحية',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Shelter',
                'name_ar' => 'مأوى',
                'project_type' => 'إغاثي',
                'description' => 'توفير مأوى للمحتاجين والمشردين',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Clothing',
                'name_ar' => 'ملابس',
                'project_type' => 'إغاثي',
                'description' => 'توزيع الملابس للمحتاجين',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            
            // تنموي
            [
                'name' => 'Vocational Training',
                'name_ar' => 'تدريب مهني',
                'project_type' => 'تنموي',
                'description' => 'برامج تدريب مهني لتأهيل الأفراد للعمل',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Small Projects',
                'name_ar' => 'مشاريع صغيرة',
                'project_type' => 'تنموي',
                'description' => 'دعم المشاريع الصغيرة والمتوسطة',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Agriculture',
                'name_ar' => 'زراعة',
                'project_type' => 'تنموي',
                'description' => 'مشاريع زراعية لتحقيق الاكتفاء الذاتي',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            
            // طبي
            [
                'name' => 'Surgical Operations',
                'name_ar' => 'عمليات جراحية',
                'project_type' => 'طبي',
                'description' => 'تمويل العمليات الجراحية للمحتاجين',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Medications',
                'name_ar' => 'أدوية',
                'project_type' => 'طبي',
                'description' => 'توفير الأدوية للمرضى المحتاجين',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Medical Tests',
                'name_ar' => 'فحوصات',
                'project_type' => 'طبي',
                'description' => 'تمويل الفحوصات الطبية للمحتاجين',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            
            // تعليمي
            [
                'name' => 'Scholarships',
                'name_ar' => 'منح دراسية',
                'project_type' => 'تعليمي',
                'description' => 'منح دراسية للطلاب المحتاجين',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'School Supplies',
                'name_ar' => 'قرطاسية',
                'project_type' => 'تعليمي',
                'description' => 'توفير القرطاسية والكتب المدرسية',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Educational Devices',
                'name_ar' => 'أجهزة',
                'project_type' => 'تعليمي',
                'description' => 'توفير الأجهزة التعليمية مثل الحواسيب والأجهزة اللوحية',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Orphan Sponsorship',
                'name_ar' => 'كفالة أيتام',
                'project_type' => 'الكفالات',
                'description' => 'مشاريع كفالة الأيتام - رعاية شهرية للأيتام',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        DB::table('project_subcategories')->insert($subcategories);
    }
}

