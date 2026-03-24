<?php

namespace Database\Seeders;

use App\Models\ProjectProposal;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProjectProposalSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get first user as creator
        $creator = User::first();
        if (!$creator) {
            $this->command->error('No users found. Please run UserSeeder first.');
            return;
        }

        $projectTypes = ['إغاثي', 'تنموي', 'طبي', 'تعليمي'];
        $statuses = [
            'جديد',
            'قيد التوزيع',
            'جاهز للتنفيذ',
            'تم اختيار المخيم',
            'قيد التنفيذ',
            'منفذ',
            'في المونتاج',
            'تم المونتاج',
            'وصل للمتبرع',
            'ملغى',
            'معاد مونتاجه'
        ];

        $donors = [
            'جمعية الكويت للإغاثة',
            'الهيئة الخيرية الإسلامية العالمية',
            'مؤسسة الملك سلمان للإغاثة',
            'منظمة الإغاثة الإسلامية',
            'جمعية دار البر',
            'جمعية الأطفال المرضى',
            'مؤسسة نون الخيرية',
            'جمعية العون المباشر',
            'مؤسسة طيبة الخيرية',
            'جمعية إحسان',
            'بنك الطعام الكويتي',
            'جمعية الرحمة العالمية',
            'مؤسسة التميز الخيرية',
            'جمعية الأمل الخيرية',
            'منظمة أطباء بلا حدود',
            'يونيسف الكويت',
            'الهلال الأحمر الكويتي',
            'جمعية الهلال الأحمر السعودي',
            'مؤسسة قطر الخيرية'
        ];

        $projectDescriptions = [
            'توفير مواد غذائية للأسر المحتاجة في المناطق المتضررة',
            'بناء مساكن مؤقتة للنازحين والمشردين',
            'توزيع حصص غذائية شهرية للأسر الفقيرة',
            'تجهيز عيادات متنقلة للمناطق النائية',
            'توفير الأدوية والمعدات الطبية للمستشفيات',
            'بناء مدارس في المناطق المحرومة',
            'توفير الكتب والمواد التعليمية للطلاب',
            'تدريب المعلمين في المناطق النائية',
            'توفير مياه شرب نظيفة للقرى المحرومة',
            'حفر آبار ارتوازية في المناطق الجافة',
            'توزيع ملابس شتوية للأسر المحتاجة',
            'توفير أغطية وأغطية شتوية للنازحين',
            'تجهيز مطابم مركزية لتوزيع الوجبات',
            'توفير سلات غذائية رمضانية',
            'بناء مراكز تدريب مهني للشباب',
            'توفير معدات زراعية للمزارعين الصغار',
            'توزيع قروض صغيرة للأسر المنتجة',
            'بناء دور أيتام ورعاية شاملة',
            'توفير رعاية صحية للأطفال اليتامى',
            'تجهيز مراكز تعليمية لذوي الاحتياجات الخاصة'
        ];

        $currencyIds = [1, 2, 3, 4, 5]; // Assuming first 5 currencies exist

        $projects = [];

        for ($i = 1; $i <= 500; $i++) {
            $donationAmount = $this->generateRandomAmount();
            $currencyId = $currencyIds[array_rand($currencyIds)];
            $exchangeRate = $this->getExchangeRate($currencyId);
            $amountInUSD = $donationAmount * $exchangeRate;
            
            $adminDiscount = rand(0, 15) / 100; // 0-15%
            $discountAmount = $amountInUSD * $adminDiscount;
            $netAmount = $amountInUSD - $discountAmount;

            $projects[] = [
                'serial_number' => 'PRJ-' . str_pad($i, 6, '0', STR_PAD_LEFT),
                'donor_code' => 'DON-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'project_description' => $projectDescriptions[array_rand($projectDescriptions)],
                'donor_name' => $donors[array_rand($donors)],
                'project_type' => $projectTypes[array_rand($projectTypes)],
                'donation_amount' => $donationAmount,
                'currency_id' => $currencyId,
                'exchange_rate' => $exchangeRate,
                'amount_in_usd' => $amountInUSD,
                'admin_discount_percentage' => $adminDiscount * 100,
                'discount_amount' => $discountAmount,
                'net_amount' => $netAmount,
                'quantity' => rand(1, 1000),
                'estimated_duration_days' => rand(7, 90),
                'status' => $statuses[array_rand($statuses)],
                'assigned_to_team_id' => rand(1, 10),
                'assigned_photographer_id' => rand(1, 20),
                'assigned_by' => $creator->id,
                'assignment_date' => $this->randomDate(),
                'shelter_id' => 'SHELTER-' . str_pad(rand(1, 50), 3, '0', STR_PAD_LEFT),
                'execution_date' => $this->randomDate(),
                'media_received_date' => $this->randomDate(),
                'montage_start_date' => $this->randomDate(),
                'montage_completed_date' => $this->randomDate(),
                'sent_to_donor_date' => $this->randomDate(),
                'transferred_to_projects' => rand(0, 1),
                'project_id' => rand(1, 100),
                'notes' => $this->generateRandomNotes(),
                'created_by' => $creator->id,
                'created_at' => $this->randomDate(),
                'updated_at' => now(),
            ];
        }

        // Insert in chunks to avoid memory issues
        $chunks = array_chunk($projects, 100);
        foreach ($chunks as $chunk) {
            ProjectProposal::insert($chunk);
        }

        $this->command->info('500 project proposals seeded successfully!');
    }

    private function generateRandomAmount(): float
    {
        $ranges = [
            [100, 1000],
            [1000, 5000],
            [5000, 10000],
            [10000, 50000],
            [50000, 100000]
        ];

        $range = $ranges[array_rand($ranges)];
        return rand($range[0] * 100, $range[1] * 100) / 100;
    }

    private function getExchangeRate(int $currencyId): float
    {
        $rates = [
            1 => 1.0000, // USD
            2 => 0.3050, // KWD
            3 => 0.7090, // JOD
            4 => 0.2670, // SAR
            5 => 0.9170, // EUR
        ];

        return $rates[$currencyId] ?? 1.0000;
    }

    private function randomDate(): string
    {
        $start = now()->subMonths(6);
        $end = now();
        return $start->addDays(rand(0, $start->diffInDays($end)))->format('Y-m-d');
    }

    private function generateRandomNotes(): string
    {
        $notes = [
            'مشروع عاجل يحتاج إلى متابعة سريعة',
            'تم التنسيق مع الجهة المتبرعة',
            'يحتاج إلى متابعة ميدانية',
            'المشروع في مرحلة التخطيط النهائي',
            'تم إعداد التقرير المبدئي',
            'في انتظار الموافقة النهائية',
            'تم التأكد من جميع المتطلبات',
            'مشروع ذو أولوية قصوى',
            'يحتاج إلى تنسيق إضافي',
            'تم التأكد من صحة البيانات',
            'المشروع جاهز للتنفيذ الفوري',
            'تم إعداد كافة المستندات المطلوبة',
            'في انتظار تخصيص الفريق المناسب',
            'تم التحقق من الميزانية المتاحة',
            'مشروع استراتيجي ذو أهمية عالية'
        ];

        return $notes[array_rand($notes)];
    }
}
