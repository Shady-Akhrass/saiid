<?php

namespace App\Exports;

use App\Models\Project;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Carbon\Carbon;

class ProjectsExport implements FromCollection, WithHeadings, WithMapping
{
    protected $startDate;
    protected $endDate;
    protected $statuses;

    public function __construct($startDate = null, $endDate = null, $statuses = null)
    {
        $this->startDate = $startDate;
        $this->endDate = $endDate;
        $this->statuses = $statuses;
    }

    public function collection()
    {
        $query = Project::with('shelter');

        // فلترة حسب تاريخ التنفيذ (execution_date)
        if ($this->startDate) {
            $query->where('execution_date', '>=', Carbon::parse($this->startDate)->format('Y-m-d'));
        }

        if ($this->endDate) {
            $query->where('execution_date', '<=', Carbon::parse($this->endDate)->format('Y-m-d'));
        }

        // فلترة حسب الحالات المتعددة
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

        return $query->orderBy('execution_date', 'DESC')->get();
    }

    public function headings(): array
    {
        return [
            'اسم المشروع',
            'نوع المساعدة',
            'الكمية',
            'اسم المخيم',
            'المحافظة',
            'المنطقة',
            'تاريخ التنفيذ',
            'الحالة',
            'تاريخ الإنشاء',
            'تاريخ التحديث'
        ];
    }

    public function map($project): array
    {
        return [
            $project->project_name,
            $project->aid_type,
            $project->quantity,
            $project->shelter ? $project->shelter->camp_name : 'غير محدد',
            $project->shelter ? $project->shelter->governorate : 'غير محدد',
            $project->shelter ? $project->shelter->district : 'غير محدد',
            $project->execution_date ? Carbon::parse($project->execution_date)->format('Y-m-d') : 'غير محدد',
            $project->status,
            $project->created_at ? Carbon::parse($project->created_at)->format('Y-m-d H:i:s') : 'غير محدد',
            $project->updated_at ? Carbon::parse($project->updated_at)->format('Y-m-d H:i:s') : 'غير محدد',
        ];
    }
}

