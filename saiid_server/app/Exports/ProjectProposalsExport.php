<?php

namespace App\Exports;

use App\Models\ProjectProposal;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ProjectProposalsExport implements FromCollection, WithHeadings, WithMapping, WithColumnWidths, WithStyles
{
    protected $startDate;
    protected $endDate;
    protected $statuses;
    protected $projectType;

    /** عند تمرير مجموعة مسبقة التحميل (مثلاً من تصدير الإشراف) تُستخدم بدلاً من بناء الاستعلام */
    protected $preloadedCollection;

    public function __construct($startDate = null, $endDate = null, $statuses = null, $projectType = null, $preloadedCollection = null)
    {
        $this->startDate = $startDate;
        $this->endDate = $endDate;
        $this->statuses = $statuses;
        $this->projectType = $projectType;
        $this->preloadedCollection = $preloadedCollection;
    }

    /**
     * Return collection of project proposals with filters
     */
    public function collection()
    {
        if ($this->preloadedCollection !== null) {
            return $this->preloadedCollection;
        }
        // ✅ إصلاح: استخدام select محدد للعلاقات لتجنب أخطاء الأعمدة غير الموجودة
        // ✅ إضافة select صريح لضمان جلب quantity وجميع الحقول المطلوبة
        $query = ProjectProposal::select([
            'id', 'serial_number', 'donor_code', 'project_name', 'project_description',
            'donor_name', 'project_type', 'project_type_id', 'subcategory_id', 'donation_amount',
            'currency_id', 'exchange_rate', 'amount_in_usd', 'admin_discount_percentage',
            'discount_amount', 'net_amount', 'shekel_exchange_rate', 'net_amount_shekel',
            'quantity', 'beneficiaries_count', 'beneficiaries_per_unit', 'unit_cost',
            'supply_cost', 'surplus_amount', 'has_deficit', 'estimated_duration_days',
            'status', 'assigned_to_team_id', 'assigned_researcher_id', 'assigned_photographer_id',
            'assigned_montage_producer_id', 'shelter_id', 'execution_date', 'created_at',
            'montage_completed_date', 'sent_to_donor_date', 'completed_date', 'notes',
            // Only include fields that actually exist in database
            'is_divided_into_phases', 'phase_duration_days', 'phase_start_date',
            'parent_project_id', 'phase_day', 'is_daily_phase'
        ])->with([
            'currency:id,currency_code,currency_name_ar,exchange_rate_to_usd',
            'assignedToTeam:id,team_name,team_leader_name',
            'photographer:id,name,phone_number',
            'researcher:id,name,phone_number',
            'creator:id,name,phone_number',
            // ✅ إصلاح: استخدام closure لتحديد select بشكل صحيح (جدول shelters لا يحتوي على id أو name)
            'shelter' => function($query) {
                $query->select('manager_id_number', 'camp_name', 'governorate', 'district');
            },
        ]);

        // Filter by date range
        if ($this->startDate) {
            $query->whereDate('created_at', '>=', $this->startDate);
        }

        if ($this->endDate) {
            $query->whereDate('created_at', '<=', $this->endDate);
        }

        // Filter by multiple statuses
        if ($this->statuses && is_array($this->statuses) && count($this->statuses) > 0) {
            // إزالة القيم الفارغة من المصفوفة
            $statuses = array_filter($this->statuses, function($status) {
                return !empty($status) && $status !== 'all' && $status !== 'الكل';
            });
            
            if (count($statuses) > 0) {
                $query->whereIn('status', $statuses);
            }
        } elseif ($this->statuses && is_string($this->statuses) && $this->statuses !== 'all' && $this->statuses !== 'الكل') {
            // دعم حالة واحدة كسلسلة نصية للتوافق مع الكود القديم
            $query->where('status', $this->statuses);
        }

        // Filter by project type
        if ($this->projectType) {
            $query->where('project_type', $this->projectType);
        }

        return $query->orderBy('created_at', 'DESC')->get();
    }

    /**
     * Define headings for Excel export
     */
    public function headings(): array
    {
        return [
            'الرقم التسلسلي',
            'اسم المشروع',
            'كود المتبرع',
            'وصف المشروع',
            'اسم الجهة المتبرعة',
            'نوع المشروع',
            'مبلغ التبرع',
            'العملة',
            'سعر الصرف',
            'المبلغ بالدولار',
            'نسبة الخصم الإداري (%)',
            'قيمة الخصم',
            'المبلغ الصافي (USD)',
            'المبلغ الصافي بالشيكل (ILS)',
            'عدد المستفيدين',
            'العدد',
            'العجز/الفائض',
            'قيمة العجز/الفائض',
            'المدة التقديرية (أيام)',
            'الحالة',
            'اسم الفريق',
            'اسم المصور',
            'اسم الباحث',
            'التكلفة',
            'تكلفة التوريد بالشيكل',
            'المبلغ الصافي بالدولار',
            'المبلغ بالشيكل بعد التوريد',
            'حالة العجز/الفائض',
            'قيمة العجز/الفائض',
            'الأولوية',
            'مشروع يومي',
            'مقسم إلى مراحل',
            'مدة المرحلة (أيام)',
            'تاريخ بداية المرحلة',
            'اسم المخيم',
            'تاريخ الإنشاء',
            'تاريخ التوزيع',
            'تاريخ التنفيذ',
            'تاريخ إكمال المونتاج',
            'تاريخ الإرسال للمتبرع',
            'الملاحظات',
        ];
    }

    /**
     * Map data for each row
     */
    public function map($project): array
    {
        // حساب المبلغ الصافي بالشيكل (بعد التحويل)
        $netAmountShekel = '-';
        if ($project->net_amount_shekel) {
            // استخدام المبلغ الصافي المحول مباشرة
            $netAmountShekel = number_format($project->net_amount_shekel, 2);
        } elseif ($project->net_amount && $project->shekel_exchange_rate) {
            // حساب المبلغ الصافي بالشيكل إذا لم يكن محفوظاً
            $netAmountShekel = number_format($project->net_amount * $project->shekel_exchange_rate, 2);
        }

        // حساب العجز/الفائض
        $surplusDeficitType = '-';
        $surplusDeficitValue = '-';
        
        // استخدام surplus_amount إذا كان موجوداً (القيمة المحفوظة)
        if ($project->surplus_amount !== null) {
            $surplusAmount = (float)$project->surplus_amount;
            if ($surplusAmount > 0) {
                $surplusDeficitType = 'فائض';
                $surplusDeficitValue = number_format($surplusAmount, 2);
            } elseif ($surplusAmount < 0) {
                $surplusDeficitType = 'عجز';
                $surplusDeficitValue = number_format(abs($surplusAmount), 2);
            } else {
                $surplusDeficitType = 'متوازن';
                $surplusDeficitValue = '0.00';
            }
        } elseif ($project->supply_cost && $project->net_amount) {
            // حساب من supply_cost و net_amount إذا لم يكن surplus_amount موجوداً
            $difference = $project->net_amount - $project->supply_cost;
            
            if ($difference > 0) {
                $surplusDeficitType = 'فائض';
                $surplusDeficitValue = number_format($difference, 2);
            } elseif ($difference < 0) {
                $surplusDeficitType = 'عجز';
                $surplusDeficitValue = number_format(abs($difference), 2);
            } else {
                $surplusDeficitType = 'متوازن';
                $surplusDeficitValue = '0.00';
            }
        }

        return [
            $project->serial_number ?? $project->id,
            $project->project_name ?? '-',
            $project->donor_code ?? '-',
            $project->project_description ?? '-',
            $project->donor_name ?? '-',
            $project->project_type ?? '-',
            number_format($project->donation_amount ?? 0, 2),
            $project->currency ? $project->currency->currency_code : '-',
            $project->exchange_rate ? number_format($project->exchange_rate, 4) : '-',
            number_format($project->amount_in_usd ?? 0, 2),
            $project->admin_discount_percentage ? number_format($project->admin_discount_percentage, 2) . '%' : '0%',
            number_format($project->discount_amount ?? 0, 2),
            number_format($project->net_amount ?? 0, 2),
            $netAmountShekel,
            $project->beneficiaries_count ?? $project->beneficiaries_count ?? '-',
            ($project->quantity !== null) ? $project->quantity : '-',
            $surplusDeficitType,
            $surplusDeficitValue,
            $project->estimated_duration_days ?? '-',
            $project->status ?? '-',
            $project->assignedToTeam ? $project->assignedToTeam->team_name : '-',
            $this->getPhotographerName($project),
            $this->getResearcherName($project),
            $project->creator ? $project->creator->name : '-',
            number_format($project->donation_amount ?? 0, 2), // التكلفة = donation_amount
            $this->getSupplyCostShekel($project),
            number_format($project->net_amount ?? 0, 2), // المبلغ الصافي بالدولار
            $this->getNetAmountShekelAfterSupply($project),
            $surplusDeficitType,
            $surplusDeficitValue,
            $project->priority ?? '-',
            $project->is_daily_phase ? 'نعم' : 'لا',
            $project->is_divided_into_phases ? 'نعم' : 'لا',
            $project->phase_duration_days ?? '-',
            $project->phase_start_date ? $project->phase_start_date->format('Y-m-d') : '-',
            $project->shelter ? $project->shelter->camp_name : '-',
            $project->created_at ? $project->created_at->format('Y-m-d H:i:s') : '-',
            $project->assignment_date ? $project->assignment_date->format('Y-m-d') : '-',
            $project->execution_date ? $project->execution_date->format('Y-m-d') : '-',
            $project->montage_completed_date ? $project->montage_completed_date->format('Y-m-d') : '-',
            $project->sent_to_donor_date ? $project->sent_to_donor_date->format('Y-m-d') : '-',
            $project->notes ?? '-',
        ];
    }

    /**
     * Get photographer name with debugging
     */
    private function getPhotographerName($project)
    {
        // Check if photographer relationship exists
        if ($project->photographer) {
            return $project->photographer->name ?? 'No Name';
        }
        
        // Check if photographer_id exists but no relationship loaded
        if ($project->assigned_photographer_id) {
            return 'ID: ' . $project->assigned_photographer_id . ' (Not Loaded)';
        }
        
        // No photographer assigned
        return 'No Photographer';
    }

    /**
     * Get researcher name
     */
    private function getResearcherName($project)
    {
        if ($project->researcher) {
            return $project->researcher->name ?? 'No Name';
        }
        
        if ($project->assigned_researcher_id) {
            return 'ID: ' . $project->assigned_researcher_id . ' (Not Loaded)';
        }
        
        return 'No Researcher';
    }

    /**
     * Get cost
     */
    private function getCost($project)
    {
        return $project->donation_amount ? number_format($project->donation_amount, 2) : '-';
    }

    /**
     * Get supply cost in shekel
     */
    private function getSupplyCostShekel($project)
    {
        if ($project->supply_cost) {
            return number_format($project->supply_cost, 2);
        }
        return '-';
    }

    /**
     * Get net amount in USD
     */
    private function getNetAmountUSD($project)
    {
        if ($project->net_amount) {
            return number_format($project->net_amount, 2);
        }
        return '-';
    }

    /**
     * Get net amount in shekel after supply
     */
    private function getNetAmountShekelAfterSupply($project)
    {
        $netAmountShekel = '-';
        if ($project->net_amount_shekel) {
            $netAmountShekel = number_format($project->net_amount_shekel, 2);
        } elseif ($project->net_amount && $project->shekel_exchange_rate) {
            $netAmountShekel = number_format($project->net_amount * $project->shekel_exchange_rate, 2);
        }
        return $netAmountShekel;
    }

    /**
     * Get priority
     */
    private function getPriority($project)
    {
        return $project->priority ?? '-';
    }

    /**
     * Get is daily phase
     */
    private function getIsDailyPhase($project)
    {
        return $project->is_daily_phase ? 'نعم' : 'لا';
    }

    /**
     * Get is divided into phases
     */
    private function getIsDividedIntoPhases($project)
    {
        return $project->is_divided_into_phases ? 'نعم' : 'لا';
    }

    /**
     * Get phase duration days
     */
    private function getPhaseDurationDays($project)
    {
        return $project->phase_duration_days ?? '-';
    }

    /**
     * Get phase start date
     */
    private function getPhaseStartDate($project)
    {
        return $project->phase_start_date ? $project->phase_start_date->format('Y-m-d') : '-';
    }

    /**
     * Set column widths
     */
    public function columnWidths(): array
    {
        return [
            'A' => 15,  // الرقم التسلسلي
            'B' => 35,  // اسم المشروع
            'C' => 15,  // كود المتبرع
            'D' => 40,  // وصف المشروع
            'E' => 25,  // اسم الجهة المتبرعة
            'F' => 15,  // نوع المشروع
            'G' => 15,  // مبلغ التبرع
            'H' => 10,  // العملة
            'I' => 12,  // سعر الصرف
            'J' => 15,  // المبلغ بالدولار
            'K' => 18,  // نسبة الخصم
            'L' => 15,  // قيمة الخصم
            'M' => 18,  // المبلغ الصافي (USD)
            'N' => 20,  // المبلغ الصافي بالشيكل (ILS)
            'O' => 15,  // عدد المستفيدين
            'P' => 15,  // العدد
            'Q' => 15,  // العجز/الفائض
            'R' => 18,  // قيمة العجز/الفائض
            'S' => 18,  // المدة التقديرية
            'T' => 15,  // الحالة
            'U' => 20,  // اسم الفريق
            'V' => 20,  // اسم المصور
            'W' => 20,  // اسم المخيم
            'X' => 18,  // تاريخ الإنشاء
            'Y' => 15,  // تاريخ التوزيع
            'Z' => 15,  // تاريخ التنفيذ
            'AA' => 18, // تاريخ إكمال المونتاج
            'AB' => 15, // تاريخ الإرسال
            'AC' => 30, // ملاحظات
        ];
    }

    /**
     * Apply styles to the worksheet
     */
    public function styles(Worksheet $sheet)
    {
        // تنسيق صف العناوين
        $sheet->getStyle('1')->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 12,
            ],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'E8F4F8']
            ],
            'alignment' => [
                'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER,
                'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER,
            ],
        ]);

        // تنسيق أعمدة المبالغ المالية (محاذاة لليمين)
        $sheet->getStyle('G:N')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle('R')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_RIGHT);
        
        // تنسيق عمود العدد (محاذاة لليمين)
        $sheet->getStyle('P')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_RIGHT);
        
        // تنسيق عمود العجز/الفائض
        $sheet->getStyle('Q')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

        return [
            1 => ['font' => ['bold' => true, 'size' => 12]],
        ];
    }
}

