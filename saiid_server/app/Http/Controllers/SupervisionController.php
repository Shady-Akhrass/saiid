<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\ProjectProposal;
use App\Models\Orphan;
use App\Models\Aid;
use App\Models\Shelter;
use App\Models\Patient;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\Employment;
use App\Models\Beneficiary;
use App\Models\TeamPersonnel;
use Carbon\Carbon;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\SupervisionReportExport;

class SupervisionController extends Controller
{
    /**
     * التحقق من أن المستخدم مدير مشاريع فقط (يُسمح له بتقرير المشاريع المفصل والتصدير projects فقط)
     */
    private function isOnlyProjectManager(Request $request): bool
    {
        $user = $request->user();
        if (!$user) {
            return false;
        }
        $role = strtolower(trim($user->role ?? ''));
        return in_array($role, ['project_manager', 'projectmanager', 'مدير مشاريع']);
    }

    /**
     * رفض وصول مدير المشاريع لـ endpoints الإشراف غير المسموح له بها
     */
    private function rejectIfOnlyProjectManager(Request $request): ?\Illuminate\Http\JsonResponse
    {
        if ($this->isOnlyProjectManager($request)) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات للوصول إلى هذا القسم. الصلاحيات مقتصرة على الإشراف والإدارة. يمكنك الوصول إلى تقرير المشاريع المفصل فقط.',
            ], 403);
        }
        return null;
    }

    /**
     * التحقق من أن المستخدم مدير إعلام فقط (يُسمح له بإحصائيات المصورين والممنتجين فقط)
     */
    private function isOnlyMediaManager(Request $request): bool
    {
        $user = $request->user();
        if (!$user) {
            return false;
        }
        $role = strtolower(trim($user->role ?? ''));
        return in_array($role, ['media_manager', 'مدير إعلام']);
    }

    /**
     * رفض وصول مدير الإعلام لـ endpoints الإشراف غير المسموح له بها (إحصائيات المصورين/الممنتجين فقط)
     */
    private function rejectIfOnlyMediaManager(Request $request): ?\Illuminate\Http\JsonResponse
    {
        if ($this->isOnlyMediaManager($request)) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات للوصول إلى هذا القسم. يمكنك الوصول إلى إحصائيات المصورين وإحصائيات الممنتجين فقط.',
            ], 403);
        }
        return null;
    }

    /**
     * Summary Dashboard - ملخص شامل لجميع أقسام النظام
     * GET /api/supervision/summary-dashboard
     */
    public function summaryDashboard(Request $request)
    {
        if ($reject = $this->rejectIfOnlyProjectManager($request)) {
            return $reject;
        }
        if ($reject = $this->rejectIfOnlyMediaManager($request)) {
            return $reject;
        }
        try {
            // ✅ Caching للـ Dashboard - TTL 300 ثانية (5 دقائق)
            $cacheKey = 'supervision_summary_dashboard';
            
            // محاولة جلب البيانات من cache
            $cachedData = Cache::get($cacheKey);
            if ($cachedData !== null && !$request->has('_refresh')) {
                return response()->json([
                    'success' => true,
                    'data' => $cachedData,
                    'cached' => true
                ], 200);
            }

            // جلب إحصائيات المشاريع - جميع المشاريع في النظام
            $projectsTotal = ProjectProposal::count();
            $projectsByStatus = ProjectProposal::selectRaw('status, COUNT(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status')
                ->toArray();
            $projectsByType = ProjectProposal::selectRaw('project_type, COUNT(*) as count')
                ->groupBy('project_type')
                ->pluck('count', 'project_type')
                ->toArray();

            // جلب إحصائيات الأيتام
            $orphansTotal = Orphan::count();
            // الأيتام المكفولين = الأيتام المرتبطين بمشاريع كفالة نشطة
            $orphansSponsored = \DB::table('orphan_project_proposals')
                ->distinct('orphan_id_number')
                ->count('orphan_id_number');

            // جلب إحصائيات المساعدات
            $aidsTotal = Aid::count();

            // جلب إحصائيات المخيمات
            $sheltersTotal = Shelter::count();
            $sheltersFamiliesTotal = Shelter::sum('number_of_families');

            // جلب إحصائيات المرضى
            $patientsTotal = Patient::count();

            // جلب إحصائيات الطلاب
            $studentsTotal = Student::count();

            // جلب إحصائيات المعلمين 
            $teachersTotal = Teacher::count();

            // جلب إحصائيات فرص العمل
            $employmentsTotal = Employment::count();

            $dashboardData = [
                'projects' => [
                    'total' => $projectsTotal,
                    'by_status' => $projectsByStatus,
                    'by_type' => $projectsByType,
                ],
                'orphans' => [
                    'total' => $orphansTotal,
                    'sponsored' => $orphansSponsored,
                    'not_sponsored' => $orphansTotal - $orphansSponsored,
                ],
                'aids' => [
                    'total' => $aidsTotal,
                ],
                'shelters' => [
                    'total' => $sheltersTotal,
                    'total_families' => $sheltersFamiliesTotal,
                ],
                'patients' => [
                    'total' => $patientsTotal,
                ],
                'students' => [
                    'total' => $studentsTotal,
                ],
                'teachers' => [
                    'total' => $teachersTotal,
                ],
                'employments' => [
                    'total' => $employmentsTotal,
                ],
            ];

            // تخزين في cache
            Cache::put($cacheKey, $dashboardData, 300);

            return response()->json([
                'success' => true,
                'data' => $dashboardData,
                'cached' => false
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Supervision Summary Dashboard Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل جلب ملخص لوحة التحكم',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Financial Summary - ملخص مالي شامل
     * GET /api/supervision/financial-summary
     */
    public function financialSummary(Request $request)
    {
        if ($reject = $this->rejectIfOnlyProjectManager($request)) {
            return $reject;
        }
        if ($reject = $this->rejectIfOnlyMediaManager($request)) {
            return $reject;
        }
        try {
            // ✅ Caching - TTL 300 ثانية
            $cacheKey = 'supervision_financial_summary';
            
            $cachedData = Cache::get($cacheKey);
            if ($cachedData !== null && !$request->has('_refresh')) {
                return response()->json([
                    'success' => true,
                    'data' => $cachedData,
                    'cached' => true
                ], 200);
            }

            // حساب المبالغ الإجمالية
            // ✅ استخدام forSurplusStatistics: يستبعد المشاريع الأصلية المقسمة
            // يشمل: المشاريع الفرعية (شهرية + يومية) + المشاريع غير المقسمة
            $baseQuery = ProjectProposal::forSurplusStatistics();
            
            // المبلغ الإجمالي قبل الخصم (بالدولار)
            $totalValueUsd = $baseQuery->clone()
                ->selectRaw('SUM(COALESCE(donation_amount, 0) * COALESCE(exchange_rate, 1)) as total')
                ->value('total') ?? 0;

            // المبلغ الصافي بعد الخصم
            $totalNetAmount = $baseQuery->clone()
                ->selectRaw('SUM(COALESCE(net_amount, 0)) as total')
                ->value('total') ?? 0;

            // حساب الخصم الإداري
            $adminDiscountAmount = round($totalValueUsd - $totalNetAmount, 2);
            
            // حساب نسبة الخصم الإداري (من المبلغ الإجمالي)
            $adminDiscountPercentage = $totalValueUsd > 0 
                ? round(($adminDiscountAmount / $totalValueUsd) * 100, 2) 
                : 0;
            
            // عدد المشاريع الإجمالي
            $totalProjects = $baseQuery->clone()->count();

            // المبالغ حسب العملة
            $byCurrency = ProjectProposal::forSurplusStatistics()
                ->join('currencies', 'project_proposals.currency_id', '=', 'currencies.id')
                ->selectRaw('currencies.currency_code, currencies.currency_name_ar, 
                            SUM(COALESCE(donation_amount, 0)) as total,
                            SUM(COALESCE(amount_in_usd, 0)) as in_usd,
                            COUNT(*) as count')
                ->groupBy('currencies.id', 'currencies.currency_code', 'currencies.currency_name_ar')
                ->get()
                ->mapWithKeys(function($item) {
                    return [$item->currency_code => [
                        'count' => (int)$item->count,
                        'total' => round($item->total, 2),
                        'in_usd' => round($item->in_usd, 2),
                    ]];
                })
                ->toArray();

            // المبالغ حسب نوع المشروع
            $byProjectType = ProjectProposal::forSurplusStatistics()
                ->selectRaw('project_type, 
                            SUM(COALESCE(amount_in_usd, 0)) as total_usd,
                            COUNT(*) as count')
                ->groupBy('project_type')
                ->get()
                ->mapWithKeys(function($item) {
                    return [$item->project_type => [
                        'count' => (int)$item->count,
                        'total_usd' => round($item->total_usd, 2),
                    ]];
                })
                ->toArray();

            // اتجاه شهري (آخر 6 أشهر)
            $monthlyTrend = [];
            for ($i = 5; $i >= 0; $i--) {
                $date = Carbon::now()->subMonths($i);
                $month = $date->format('Y-m');
                
                $monthData = ProjectProposal::forSurplusStatistics()
                    ->whereYear('created_at', $date->year)
                    ->whereMonth('created_at', $date->month)
                    ->selectRaw('SUM(COALESCE(donation_amount, 0) * COALESCE(exchange_rate, 1)) as total, COUNT(*) as count')
                    ->first();
                
                $monthlyTrend[] = [
                    'month' => $month,
                    'month_name' => $date->locale('ar')->translatedFormat('F Y'),
                    'count' => (int)($monthData->count ?? 0),
                    'total_usd' => round($monthData->total ?? 0, 2),
                ];
            }

            $financialData = [
                // الحقول الأساسية (متوافقة مع Frontend)
                'total_in_usd' => round($totalValueUsd, 2),
                'admin_discount_percentage' => $adminDiscountPercentage,
                'admin_discount_amount' => $adminDiscountAmount,
                'net_amount' => round($totalNetAmount, 2),
                'total_projects' => $totalProjects,
                
                // الحقول القديمة (للتوافق مع الكود الموجود)
                'total_projects_value_usd' => round($totalValueUsd, 2),
                'total_net_amount' => round($totalNetAmount, 2),
                'discount_amount' => $adminDiscountAmount,
                
                // بيانات إضافية
                'by_currency' => $byCurrency,
                'by_project_type' => $byProjectType,
                'monthly_trend' => $monthlyTrend,
            ];

            Cache::put($cacheKey, $financialData, 300);

            return response()->json([
                'success' => true,
                'data' => $financialData,
                'cached' => false
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Supervision Financial Summary Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الملخص المالي',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Performance Summary - ملخص الأداء
     * GET /api/supervision/performance-summary
     */
    public function performanceSummary(Request $request)
    {
        if ($reject = $this->rejectIfOnlyProjectManager($request)) {
            return $reject;
        }
        if ($reject = $this->rejectIfOnlyMediaManager($request)) {
            return $reject;
        }
        try {
            // ✅ Caching - TTL 300 ثانية
            $cacheKey = 'supervision_performance_summary';
            
            $cachedData = Cache::get($cacheKey);
            if ($cachedData !== null && !$request->has('_refresh')) {
                return response()->json([
                    'success' => true,
                    'data' => $cachedData,
                    'cached' => true
                ], 200);
            }

            $baseQuery = ProjectProposal::query();

            // المشاريع المكتملة
            $completedProjects = $baseQuery->clone()->where('status', 'وصل للمتبرع')->count();

            // المشاريع قيد التنفيذ
            $inProgressProjects = $baseQuery->clone()->whereIn('status', ['قيد التنفيذ', 'تم التنفيذ', 'في المونتاج', 'تم المونتاج'])->count();

            // المشاريع المتأخرة في التنفيذ
            $delayedExecution = ProjectProposal::delayed()->count();

            // المشاريع المتأخرة في المونتاج
            $delayedMedia = ProjectProposal::montageDelayed()->count();

            // إجمالي المشاريع
            $totalProjects = $baseQuery->clone()->count();

            // نسبة الإنجاز
            $completionRate = $totalProjects > 0 ? round(($completedProjects / $totalProjects) * 100, 2) : 0;

            // متوسط وقت الإنجاز (بالأيام) للمشاريع المكتملة
            $completedProjectsWithDates = ProjectProposal::where('status', 'وصل للمتبرع')
                ->whereNotNull('created_at')
                ->whereNotNull('updated_at')
                ->get();

            $totalDays = 0;
            $count = 0;
            foreach ($completedProjectsWithDates as $project) {
                $days = Carbon::parse($project->created_at)->diffInDays(Carbon::parse($project->updated_at));
                $totalDays += $days;
                $count++;
            }
            $averageCompletionTime = $count > 0 ? round($totalDays / $count, 1) : 0;

            // المشاريع الجديدة (آخر 30 يوم)
            $newProjects = $baseQuery->clone()
                ->where('created_at', '>=', Carbon::now()->subDays(30))
                ->count();

            // المشاريع المرفوضة
            $rejectedProjects = $baseQuery->clone()
                ->where('status', 'مرفوض')
                ->count();

            $performanceData = [
                'total_projects' => $totalProjects,
                'completed_projects' => $completedProjects,
                'in_progress_projects' => $inProgressProjects,
                'delayed_execution' => $delayedExecution,
                'delayed_media' => $delayedMedia,
                'new_projects_last_30_days' => $newProjects,
                'rejected_projects' => $rejectedProjects,
                'completion_rate' => $completionRate,
                'average_completion_time_days' => $averageCompletionTime,
            ];

            Cache::put($cacheKey, $performanceData, 300);

            return response()->json([
                'success' => true,
                'data' => $performanceData,
                'cached' => false
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Supervision Performance Summary Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل جلب ملخص الأداء',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Detailed Projects Report - تقرير المشاريع المفصل
     * GET /api/supervision/detailed-projects
     */
    public function detailedProjectsReport(Request $request)
    {
        if ($reject = $this->rejectIfOnlyMediaManager($request)) {
            return $reject;
        }
        try {
            $query = ProjectProposal::query()
                ->with([
                    'currency:id,currency_code,currency_name_ar', 
                    'shelter:manager_id_number,camp_name,manager_name', 
                    'creator:id,name'
                ]);

            // الفلترة حسب الحالة
            if ($request->has('status') && !empty($request->status)) {
                $query->where('status', $request->status);
            }

            // الفلترة حسب نوع المشروع
            if ($request->has('project_type') && !empty($request->project_type)) {
                $query->where('project_type', $request->project_type);
            }

            // الفلترة حسب التاريخ
            if ($request->has('start_date') && !empty($request->start_date)) {
                $query->whereDate('created_at', '>=', $request->start_date);
            }
            if ($request->has('end_date') && !empty($request->end_date)) {
                $query->whereDate('created_at', '<=', $request->end_date);
            }

            // البحث
            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('serial_number', 'like', "%{$search}%")
                      ->orWhere('project_name', 'like', "%{$search}%")
                      ->orWhere('project_description', 'like', "%{$search}%")
                      ->orWhere('donor_name', 'like', "%{$search}%")
                      ->orWhere('donor_code', 'like', "%{$search}%")
                      ->orWhere('internal_code', 'like', "%{$search}%");
                });
            }

            // الترتيب
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            // Pagination
            $perPage = $request->get('per_page', 15);
            $projects = $query->paginate($perPage);

            // حساب الإحصائيات الإجمالية (مع الفلاتر المطبقة)
            // إعادة بناء نفس الـ query بدون pagination للحصول على الإجماليات
            $statsQuery = ProjectProposal::query();
            
            // تطبيق نفس الفلاتر
            if ($request->has('status') && !empty($request->status)) {
                $statsQuery->where('status', $request->status);
            }
            if ($request->has('project_type') && !empty($request->project_type)) {
                $statsQuery->where('project_type', $request->project_type);
            }
            if ($request->has('start_date') && !empty($request->start_date)) {
                $statsQuery->whereDate('created_at', '>=', $request->start_date);
            }
            if ($request->has('end_date') && !empty($request->end_date)) {
                $statsQuery->whereDate('created_at', '<=', $request->end_date);
            }
            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $statsQuery->where(function($q) use ($search) {
                    $q->where('serial_number', 'like', "%{$search}%")
                      ->orWhere('project_name', 'like', "%{$search}%")
                      ->orWhere('project_description', 'like', "%{$search}%")
                      ->orWhere('donor_name', 'like', "%{$search}%")
                      ->orWhere('donor_code', 'like', "%{$search}%")
                      ->orWhere('internal_code', 'like', "%{$search}%");
                });
            }
            
            // حساب الإجماليات
            $totalProjects = $statsQuery->count();
            $totalAmount = $statsQuery->sum('amount_in_usd') ?? 0;

            return response()->json([
                'success' => true,
                'data' => $projects->items(),
                'pagination' => [
                    'current_page' => $projects->currentPage(),
                    'last_page' => $projects->lastPage(),
                    'per_page' => $projects->perPage(),
                    'total' => $projects->total(),
                ],
                'total_amount' => round($totalAmount, 2),
                'total_projects' => $totalProjects
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Supervision Detailed Projects Report Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل جلب تقرير المشاريع المفصل',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Detailed Financial Report - التقرير المالي المفصل
     * GET /api/supervision/detailed-financial
     * يدعم الفلاتر: start_date, end_date (أو from_date/to_date أو from/to)، currency، project_type
     */
    public function detailedFinancialReport(Request $request)
    {
        if ($reject = $this->rejectIfOnlyProjectManager($request)) {
            return $reject;
        }
        if ($reject = $this->rejectIfOnlyMediaManager($request)) {
            return $reject;
        }
        try {
            // توحيد معاملات الفلترة (دعم أسماء مختلفة من الواجهة)
            $startDate = $request->filled('start_date') ? $request->start_date
                : ($request->filled('from_date') ? $request->from_date : $request->input('from'));
            $endDate   = $request->filled('end_date')   ? $request->end_date
                : ($request->filled('to_date')   ? $request->to_date   : $request->input('to'));
            $currency    = $request->filled('currency')     ? trim($request->currency)     : null;
            $projectType = $request->filled('project_type') ? trim($request->project_type) : null;

            // بناء الـ query الأساسي
            // ✅ استخدام forSurplusStatistics: يستبعد المشاريع الأصلية المقسمة
            $query = ProjectProposal::forSurplusStatistics();

            if ($currency) {
                $query->whereHas('currency', function($q) use ($currency) {
                    $q->where('currency_code', $currency);
                });
            }
            if ($projectType) {
                $query->where('project_type', $projectType);
            }
            if ($startDate) {
                $query->whereDate('created_at', '>=', $startDate);
            }
            if ($endDate) {
                $query->whereDate('created_at', '<=', $endDate);
            }

            // ✅ 1. الإحصائيات الأساسية (قبل pagination)
            $totalInUsd = $query->sum('amount_in_usd') ?? 0;
            $totalNetAmount = $query->sum('net_amount') ?? 0;
            $totalProjects = $query->count();
            $averageAmount = $totalProjects > 0 ? $totalInUsd / $totalProjects : 0;
            $maxAmount = $query->max('amount_in_usd') ?? 0;
            $minAmount = $query->min('amount_in_usd') ?? 0;
            
            // حساب الخصم الإداري
            $adminDiscountAmount = round($totalInUsd - $totalNetAmount, 2);
            $adminDiscountPercentage = $totalInUsd > 0 
                ? round(($adminDiscountAmount / $totalInUsd) * 100, 2) 
                : 0;

            // ✅ 2. التوزيع حسب العملة (تطبيق نفس الفلاتر)
            $byCurrencyQuery = ProjectProposal::forSurplusStatistics()
                ->join('currencies', 'project_proposals.currency_id', '=', 'currencies.id')
                ->select(
                    'currencies.currency_code',
                    \DB::raw('COUNT(*) as count'),
                    \DB::raw('SUM(project_proposals.donation_amount) as total'),
                    \DB::raw('SUM(project_proposals.amount_in_usd) as in_usd')
                );
            if ($currency) {
                $byCurrencyQuery->where('currencies.currency_code', $currency);
            }
            if ($projectType) {
                $byCurrencyQuery->where('project_proposals.project_type', $projectType);
            }
            if ($startDate) {
                $byCurrencyQuery->whereDate('project_proposals.created_at', '>=', $startDate);
            }
            if ($endDate) {
                $byCurrencyQuery->whereDate('project_proposals.created_at', '<=', $endDate);
            }
            $byCurrency = $byCurrencyQuery->groupBy('currencies.currency_code')
                ->get()
                ->mapWithKeys(function ($item) {
                    return [$item->currency_code => [
                        'count' => (int)$item->count,
                        'total' => round($item->total, 2),
                        'in_usd' => round($item->in_usd, 2)
                    ]];
                });

            // ✅ 3. التوزيع حسب نوع المشروع (تطبيق نفس الفلاتر)
            $byTypeQuery = ProjectProposal::forSurplusStatistics()
                ->select(
                    'project_type',
                    \DB::raw('COUNT(*) as count'),
                    \DB::raw('SUM(amount_in_usd) as total_usd')
                );
            if ($currency) {
                $byTypeQuery->join('currencies', 'project_proposals.currency_id', '=', 'currencies.id')
                           ->where('currencies.currency_code', $currency);
            }
            if ($startDate) {
                $byTypeQuery->whereDate('project_proposals.created_at', '>=', $startDate);
            }
            if ($endDate) {
                $byTypeQuery->whereDate('project_proposals.created_at', '<=', $endDate);
            }
            if ($projectType) {
                $byTypeQuery->where('project_proposals.project_type', $projectType);
            }
            $byType = $byTypeQuery->groupBy('project_type')
                ->get()
                ->mapWithKeys(function ($item) {
                    return [$item->project_type => [
                        'count' => (int)$item->count,
                        'total_usd' => round($item->total_usd, 2)
                    ]];
                });

            // ✅ 4. التوزيع حسب الحالة (تطبيق نفس الفلاتر)
            $byStatusQuery = ProjectProposal::forSurplusStatistics()
                ->select(
                    'status',
                    \DB::raw('COUNT(*) as count'),
                    \DB::raw('SUM(amount_in_usd) as total_usd')
                );
            if ($currency) {
                $byStatusQuery->join('currencies', 'project_proposals.currency_id', '=', 'currencies.id')
                             ->where('currencies.currency_code', $currency);
            }
            if ($startDate) {
                $byStatusQuery->whereDate('project_proposals.created_at', '>=', $startDate);
            }
            if ($endDate) {
                $byStatusQuery->whereDate('project_proposals.created_at', '<=', $endDate);
            }
            if ($projectType) {
                $byStatusQuery->where('project_proposals.project_type', $projectType);
            }
            $byStatus = $byStatusQuery->groupBy('status')
                ->get()
                ->mapWithKeys(function ($item) {
                    return [$item->status => [
                        'count' => (int)$item->count,
                        'total_usd' => round($item->total_usd, 2)
                    ]];
                });

            // ✅ 5. التوزيع حسب التفريعات (تطبيق نفس الفلاتر)
            $bySubcategoryQuery = ProjectProposal::forSurplusStatistics()
                ->leftJoin('project_subcategories', 'project_proposals.subcategory_id', '=', 'project_subcategories.id')
                ->select(
                    \DB::raw('COALESCE(project_subcategories.name_ar, project_subcategories.name, CONCAT("التفريعة ", project_proposals.subcategory_id)) as subcategory_name'),
                    \DB::raw('COUNT(*) as count'),
                    \DB::raw('SUM(project_proposals.amount_in_usd) as total_usd')
                )
                ->whereNotNull('project_proposals.subcategory_id');
            if ($startDate) {
                $bySubcategoryQuery->whereDate('project_proposals.created_at', '>=', $startDate);
            }
            if ($endDate) {
                $bySubcategoryQuery->whereDate('project_proposals.created_at', '<=', $endDate);
            }
            if ($projectType) {
                $bySubcategoryQuery->where('project_proposals.project_type', $projectType);
            }
            if ($currency) {
                $bySubcategoryQuery->join('currencies', 'project_proposals.currency_id', '=', 'currencies.id')
                                   ->where('currencies.currency_code', $currency);
            }
            $bySubcategory = $bySubcategoryQuery->groupBy('project_proposals.subcategory_id', 'project_subcategories.name_ar', 'project_subcategories.name')
                ->get()
                ->mapWithKeys(function ($item) {
                    return [$item->subcategory_name => [
                        'count' => (int)$item->count,
                        'total_usd' => round($item->total_usd, 2)
                    ]];
                });

            // ✅ 6. الاتجاه الشهري: إذا وُجدت فترة (من-إلى) نعرض أشهرها، وإلا آخر 6 أشهر
            $monthlyTrend = [];
            if ($startDate && $endDate) {
                $start = Carbon::parse($startDate)->startOfMonth();
                $end   = Carbon::parse($endDate)->endOfMonth();
                for ($m = $start->copy(); $m->lte($end); $m->addMonth()) {
                    $monthStart = $m->copy()->startOfMonth();
                    $monthEnd   = $m->copy()->endOfMonth();
                    $monthQuery = ProjectProposal::forSurplusStatistics()
                        ->select(
                            \DB::raw('COUNT(*) as count'),
                            \DB::raw('SUM(amount_in_usd) as total_usd')
                        )
                        ->whereDate('created_at', '>=', $monthStart)
                        ->whereDate('created_at', '<=', $monthEnd);
                    if ($currency) {
                        $monthQuery->join('currencies', 'project_proposals.currency_id', '=', 'currencies.id')
                                   ->where('currencies.currency_code', $currency);
                    }
                    if ($projectType) {
                        $monthQuery->where('project_proposals.project_type', $projectType);
                    }
                    $monthData = $monthQuery->first();
                    $monthlyTrend[] = [
                        'month' => $m->format('Y-m'),
                        'month_name' => $m->locale('ar')->translatedFormat('F Y'),
                        'count' => (int)($monthData->count ?? 0),
                        'total_usd' => round($monthData->total_usd ?? 0, 2)
                    ];
                }
            } else {
                for ($i = 5; $i >= 0; $i--) {
                    $month = Carbon::now()->subMonths($i);
                    $monthStart = $month->copy()->startOfMonth();
                    $monthEnd = $month->copy()->endOfMonth();
                    $monthQuery = ProjectProposal::forSurplusStatistics()
                        ->select(
                            \DB::raw('COUNT(*) as count'),
                            \DB::raw('SUM(amount_in_usd) as total_usd')
                        )
                        ->whereDate('created_at', '>=', $monthStart)
                        ->whereDate('created_at', '<=', $monthEnd);
                    if ($currency) {
                        $monthQuery->join('currencies', 'project_proposals.currency_id', '=', 'currencies.id')
                                   ->where('currencies.currency_code', $currency);
                    }
                    if ($projectType) {
                        $monthQuery->where('project_proposals.project_type', $projectType);
                    }
                    $monthData = $monthQuery->first();
                    $monthlyTrend[] = [
                        'month' => $month->format('Y-m'),
                        'month_name' => $month->locale('ar')->translatedFormat('F Y'),
                        'count' => (int)($monthData->count ?? 0),
                        'total_usd' => round($monthData->total_usd ?? 0, 2)
                    ];
                }
            }

            // Response النهائي
            return response()->json([
                'success' => true,
                'data' => [
                    // الحقول الأساسية (متوافقة مع Frontend)
                    'total_in_usd' => round($totalInUsd, 2),
                    'admin_discount_percentage' => $adminDiscountPercentage,
                    'admin_discount_amount' => $adminDiscountAmount,
                    'net_amount' => round($totalNetAmount, 2),
                    
                    // إحصائيات إضافية
                    'total_projects' => $totalProjects,
                    'average_amount' => round($averageAmount, 2),
                    'max_amount' => round($maxAmount, 2),
                    'min_amount' => round($minAmount, 2),
                    
                    // توزيعات
                    'by_currency' => $byCurrency,
                    'by_type' => $byType,
                    'by_status' => $byStatus,
                    'by_subcategory' => $bySubcategory,
                    'monthly_trend' => $monthlyTrend
                ]
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Supervision Detailed Financial Report Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل جلب التقرير المالي المفصل',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Detailed Beneficiaries Report - تقرير المستفيدين المفصل
     * GET /api/supervision/detailed-beneficiaries
     */
    public function detailedBeneficiariesReport(Request $request)
    {
        if ($reject = $this->rejectIfOnlyProjectManager($request)) {
            return $reject;
        }
        if ($reject = $this->rejectIfOnlyMediaManager($request)) {
            return $reject;
        }
        try {
            $query = Beneficiary::query()
                ->with(['project:id,serial_number,project_name,project_type,status']);

            // الفلترة حسب المشروع
            if ($request->has('project_id') && !empty($request->project_id)) {
                $query->where('project_id', $request->project_id);
            }

            // الفلترة حسب نوع المساعدة
            if ($request->has('aid_type') && !empty($request->aid_type)) {
                $query->where('aid_type', $request->aid_type);
            }

            // الفلترة حسب التاريخ
            if ($request->has('start_date') && !empty($request->start_date)) {
                $query->whereDate('created_at', '>=', $request->start_date);
            }
            if ($request->has('end_date') && !empty($request->end_date)) {
                $query->whereDate('created_at', '<=', $request->end_date);
            }

            // البحث
            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('full_name', 'like', "%{$search}%")
                      ->orWhere('id_number', 'like', "%{$search}%")
                      ->orWhere('phone_number', 'like', "%{$search}%");
                });
            }

            // الترتيب
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            // Pagination
            $perPage = $request->get('per_page', 15);
            $beneficiaries = $query->paginate($perPage);

            // حساب الإحصائيات
            $stats = [
                'total_beneficiaries' => $beneficiaries->total(),
                'unique_projects' => Beneficiary::when($request->has('start_date'), function($q) use ($request) {
                    $q->whereDate('created_at', '>=', $request->start_date);
                })->when($request->has('end_date'), function($q) use ($request) {
                    $q->whereDate('created_at', '<=', $request->end_date);
                })->distinct('project_id')->count('project_id'),
            ];

            return response()->json([
                'success' => true,
                'data' => $beneficiaries->items(),
                'statistics' => $stats,
                'pagination' => [
                    'current_page' => $beneficiaries->currentPage(),
                    'last_page' => $beneficiaries->lastPage(),
                    'per_page' => $beneficiaries->perPage(),
                    'total' => $beneficiaries->total(),
                ]
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Supervision Detailed Beneficiaries Report Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل جلب تقرير المستفيدين المفصل',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Montage Producers Statistics - إحصائيات منتجي المونتاج
     * GET /api/supervision/montage-producers-statistics
     * يدعم فلترة التاريخ: start_date, end_date (YYYY-MM-DD)، _refresh لتجاوز الـ cache
     */
    public function montageProducersStatistics(Request $request)
    {
        if ($reject = $this->rejectIfOnlyProjectManager($request)) {
            return $reject;
        }
        try {
            // ✅ فلترة المدة (التاريخ) - حقل created_at
            $startDate = $request->filled('start_date') ? $request->start_date : null;
            $endDate = $request->filled('end_date') ? $request->end_date : null;

            // ✅ Caching - مفتاح يتضمن الفترة عند وجودها
            $cacheKey = 'supervision_montage_producers_statistics' . ($startDate ? '_' . $startDate : '') . ($endDate ? '_' . $endDate : '');
            
            $cachedData = Cache::get($cacheKey);
            if ($cachedData !== null && !$request->has('_refresh')) {
                return response()->json([
                    'success' => true,
                    'data' => $cachedData,
                    'cached' => true
                ], 200);
            }

            // دالة تطبيق فلترة التاريخ على query
            $applyDateFilter = function ($query) use ($startDate, $endDate) {
                if ($startDate) {
                    $query->whereDate('created_at', '>=', $startDate);
                }
                if ($endDate) {
                    $query->whereDate('created_at', '<=', $endDate);
                }
                return $query;
            };

            // جلب جميع منتجي المونتاج النشطين
            $producers = \App\Models\User::where('role', 'montage_producer')
                ->where('is_active', true)
                ->select('id', 'name', 'email', 'phone_number', 'created_at')
                ->get();

            $producersData = [];
            $totalStats = [
                'total_producers' => $producers->count(),
                'total_assigned_projects' => 0,
                'total_completed_projects' => 0,
                'total_current_projects' => 0,
                'total_delayed_projects' => 0,
                'total_delivered_projects' => 0,
                'total_redone_projects' => 0,
                'total_finished_projects' => 0,
            ];

            foreach ($producers as $producer) {
                // إحصائيات المشاريع المسندة (مع فلترة التاريخ)
                $baseQuery = ProjectProposal::where('assigned_montage_producer_id', $producer->id);
                $baseQuery = $applyDateFilter($baseQuery);

                $totalProjects = $baseQuery->clone()->count();
                $currentProjects = $baseQuery->clone()->where('status', 'في المونتاج')->count();
                $completedProjects = $baseQuery->clone()->where('status', 'تم المونتاج')->count();
                $deliveredProjects = $baseQuery->clone()->where('status', 'وصل للمتبرع')->count();
                $redoneProjects = $baseQuery->clone()->where('status', 'يجب إعادة المونتاج')->count();
                $finishedProjects = $baseQuery->clone()->where('status', 'منتهي')->count();
                
                // المشاريع المتأخرة (أكثر من 5 أيام في المونتاج)
                $delayedProjects = $baseQuery->clone()
                    ->where('status', 'في المونتاج')
                    ->whereNotNull('montage_producer_assigned_at')
                    ->where('montage_producer_assigned_at', '<', Carbon::now()->subDays(5))
                    ->count();

                // حساب متوسط وقت الإنجاز (بالساعات) - مع فلترة التاريخ
                $completedWithDatesQuery = ProjectProposal::where('assigned_montage_producer_id', $producer->id)
                    ->whereNotNull('montage_producer_assigned_at')
                    ->whereNotNull('montage_completed_date');
                $completedWithDates = $applyDateFilter($completedWithDatesQuery)->get();

                $totalHours = 0;
                $countCompleted = 0;
                foreach ($completedWithDates as $project) {
                    if ($project->montage_producer_assigned_at && $project->montage_completed_date) {
                        $assignedAt = Carbon::parse($project->montage_producer_assigned_at);
                        $completedAt = Carbon::parse($project->montage_completed_date);
                        $totalHours += $assignedAt->diffInHours($completedAt);
                        $countCompleted++;
                    }
                }
                $averageCompletionTime = $countCompleted > 0 ? round($totalHours / $countCompleted, 1) : 0;

                // المشاريع المنجزة آخر 30 يوم - مع فلترة التاريخ
                $recentCompletedQuery = ProjectProposal::where('assigned_montage_producer_id', $producer->id)
                    ->where('status', 'تم المونتاج')
                    ->where('montage_completed_date', '>=', Carbon::now()->subDays(30));
                $recentCompleted = $applyDateFilter($recentCompletedQuery)->count();

                // نسبة الإنجاز
                $completionRate = $totalProjects > 0 
                    ? round((($completedProjects + $deliveredProjects + $finishedProjects) / $totalProjects) * 100, 2) 
                    : 0;

                // إضافة بيانات المنتج
                $producersData[] = [
                    'id' => $producer->id,
                    'name' => $producer->name,
                    'phone_number' => $producer->phone_number,
                    'created_at' => $producer->created_at,
                    'statistics' => [
                        'total_projects' => $totalProjects,
                        'current_projects' => $currentProjects,
                        'completed_projects' => $completedProjects,
                        'delivered_projects' => $deliveredProjects,
                        'redone_projects' => $redoneProjects,
                        'finished_projects' => $finishedProjects,
                        'delayed_projects' => $delayedProjects,
                        'recent_completed_30_days' => $recentCompleted,
                        'average_completion_hours' => $averageCompletionTime,
                        'completion_rate' => $completionRate,
                    ]
                ];

                // تحديث الإجماليات
                $totalStats['total_assigned_projects'] += $totalProjects;
                $totalStats['total_completed_projects'] += $completedProjects;
                $totalStats['total_current_projects'] += $currentProjects;
                $totalStats['total_delayed_projects'] += $delayedProjects;
                $totalStats['total_delivered_projects'] += $deliveredProjects;
                $totalStats['total_redone_projects'] += $redoneProjects;
                $totalStats['total_finished_projects'] += $finishedProjects;
            }

            // ترتيب المنتجين حسب عدد المشاريع المنجزة (الأكثر إنتاجية أولاً)
            usort($producersData, function($a, $b) {
                return $b['statistics']['completed_projects'] <=> $a['statistics']['completed_projects'];
            });

            // حساب متوسطات عامة
            $producersCount = $totalStats['total_producers'];
            $averages = [
                'avg_projects_per_producer' => $producersCount > 0 
                    ? round($totalStats['total_assigned_projects'] / $producersCount, 1) 
                    : 0,
                'avg_completed_per_producer' => $producersCount > 0 
                    ? round((
                        $totalStats['total_completed_projects'] + 
                        $totalStats['total_delivered_projects'] + 
                        $totalStats['total_finished_projects']
                      ) / $producersCount, 1) 
                    : 0,
                'overall_completion_rate' => $totalStats['total_assigned_projects'] > 0
                    ? round((($totalStats['total_completed_projects'] + $totalStats['total_delivered_projects'] + $totalStats['total_finished_projects']) / $totalStats['total_assigned_projects']) * 100, 2)
                    : 0,
            ];

            $statisticsData = [
                'total_statistics' => $totalStats,
                'averages' => $averages,
                'producers' => $producersData,
            ];

            Cache::put($cacheKey, $statisticsData, 300);

            return response()->json([
                'success' => true,
                'data' => $statisticsData,
                'cached' => false
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Supervision Montage Producers Statistics Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل جلب إحصائيات منتجي المونتاج',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Photographers Statistics - إحصائيات المصورين
     * GET /api/supervision/photographers-statistics
     * يدعم فلترة التاريخ: start_date, end_date (YYYY-MM-DD)، _refresh لتجاوز الـ cache
     */
    public function getPhotographersStatistics(Request $request)
    {
        if ($reject = $this->rejectIfOnlyProjectManager($request)) {
            return $reject;
        }
        try {
            // ✅ فلترة المدة (التاريخ) - حقل created_at
            $startDate = $request->filled('start_date') ? $request->start_date : null;
            $endDate = $request->filled('end_date') ? $request->end_date : null;

            // ✅ Caching - مفتاح يتضمن الفترة عند وجودها
            $cacheKey = 'supervision_photographers_statistics' . ($startDate ? '_' . $startDate : '') . ($endDate ? '_' . $endDate : '');
            
            $cachedData = Cache::get($cacheKey);
            if ($cachedData !== null && !$request->has('_refresh')) {
                return response()->json([
                    'success' => true,
                    'data' => $cachedData,
                    'cached' => true
                ], 200);
            }

            // دالة تطبيق فلترة التاريخ على query
            $applyDateFilter = function ($query) use ($startDate, $endDate) {
                if ($startDate) {
                    $query->whereDate('created_at', '>=', $startDate);
                }
                if ($endDate) {
                    $query->whereDate('created_at', '<=', $endDate);
                }
                return $query;
            };

            // ✅ جلب جميع المصورين النشطين
            $photographers = TeamPersonnel::where('personnel_type', 'مصور')
                ->where('is_active', true)
                ->get();

            $totalPhotographers = $photographers->count();
            
            // ✅ حساب الإحصائيات الإجمالية (مع فلترة التاريخ)
            $baseQuery = ProjectProposal::whereNotNull('assigned_photographer_id');
            $baseQuery = $applyDateFilter($baseQuery);
            $totalAssignedProjects = (clone $baseQuery)->count();
            $totalCompletedProjects = (clone $baseQuery)->where('status', 'تم التنفيذ')->count();
            $totalCurrentProjects = (clone $baseQuery)->whereIn('status', ['قيد التنفيذ', 'جاهز للتنفيذ'])->count();
            $totalDelayedProjects = (clone $baseQuery)
                ->whereIn('status', ['قيد التنفيذ', 'جاهز للتنفيذ'])
                ->whereNotNull('assignment_date')
                ->whereRaw('DATEDIFF(NOW(), assignment_date) > 5')
                ->count();
            $totalSentToMontage = (clone $baseQuery)
                ->whereIn('status', ['في المونتاج', 'تم المونتاج', 'وصل للمتبرع', 'منتهي'])
                ->count();
            $totalRedoneProjects = (clone $baseQuery)->where('status', 'يجب إعادة المونتاج')->count();
            $totalFinishedProjects = (clone $baseQuery)->where('status', 'منتهي')->count();

            // ✅ حساب المتوسطات
            $avgProjectsPerPhotographer = $totalPhotographers > 0 
                ? round($totalAssignedProjects / $totalPhotographers, 1) 
                : 0;
            $avgCompletedPerPhotographer = $totalPhotographers > 0 
                ? round($totalCompletedProjects / $totalPhotographers, 1) 
                : 0;
            $overallCompletionRate = $totalAssignedProjects > 0 
                ? round(($totalCompletedProjects / $totalAssignedProjects) * 100, 1) 
                : 0;

            // ✅ حساب إحصائيات كل مصور (مع فلترة التاريخ)
            $photographersWithStats = $photographers->map(function ($photographer) use ($applyDateFilter) {
                // ✅ استخدام base query مرة واحدة مع فلترة التاريخ
                $baseQuery = ProjectProposal::where('assigned_photographer_id', $photographer->id);
                $baseQuery = $applyDateFilter($baseQuery);
                
                // ✅ حساب الإحصائيات باستخدام استعلامات منفصلة لتجنب مشاكل clone
                $totalProjects = (clone $baseQuery)->count();
                $completedProjects = (clone $baseQuery)->where('status', 'تم التنفيذ')->count();
                $currentProjects = (clone $baseQuery)
                    ->whereIn('status', ['قيد التنفيذ', 'جاهز للتنفيذ'])
                    ->count();
                $sentToMontage = (clone $baseQuery)
                    ->whereIn('status', ['في المونتاج', 'تم المونتاج', 'وصل للمتبرع', 'منتهي'])
                    ->count();
                $finishedProjects = (clone $baseQuery)->where('status', 'منتهي')->count();
                $delayedProjects = (clone $baseQuery)
                    ->whereIn('status', ['قيد التنفيذ', 'جاهز للتنفيذ'])
                    ->whereNotNull('assignment_date')
                    ->whereRaw('DATEDIFF(NOW(), assignment_date) > 5')
                    ->count();
                $redoneProjects = (clone $baseQuery)
                    ->where('status', 'يجب إعادة المونتاج')
                    ->count();
                
                // المشاريع المنجزة في آخر 30 يوم
                $recentCompleted30Days = (clone $baseQuery)
                    ->where('status', 'تم التنفيذ')
                    ->whereNotNull('execution_date')
                    ->where('execution_date', '>=', Carbon::now()->subDays(30))
                    ->count();
                
                // متوسط ساعات الإنجاز (من assignment_date إلى execution_date)
                $avgCompletionHours = (clone $baseQuery)
                    ->where('status', 'تم التنفيذ')
                    ->whereNotNull('execution_date')
                    ->whereNotNull('assignment_date')
                    ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, assignment_date, execution_date)) as avg_hours')
                    ->value('avg_hours') ?: 0;
                
                // ✅ حساب نسبة الإنجاز بشكل صحيح: (المشاريع المنجزة / إجمالي المشاريع) * 100
                // ⚠️ مهم: يجب أن يكون totalProjects > 0 لتجنب القسمة على صفر
                $completionRate = 0;
                if ($totalProjects > 0) {
                    $completionRate = round(($completedProjects / $totalProjects) * 100, 1);
                    // ✅ التأكد من أن النسبة بين 0 و 100
                    $completionRate = max(0, min(100, $completionRate));
                }

                return [
                    'id' => $photographer->id,
                    'name' => $photographer->name,
                    'phone_number' => $photographer->phone_number,
                    'email' => null, // جدول team_personnel لا يحتوي على حقل email
                    'is_active' => $photographer->is_active ?? true,
                    'statistics' => [
                        'total_projects' => $totalProjects,
                        'completed_projects' => $completedProjects,
                        'current_projects' => $currentProjects,
                        'sent_to_montage' => $sentToMontage,
                        'finished_projects' => $finishedProjects,
                        'delayed_projects' => $delayedProjects,
                        'redone_projects' => $redoneProjects,
                        'recent_completed_30_days' => $recentCompleted30Days,
                        'average_completion_hours' => round($avgCompletionHours, 1),
                        'completion_rate' => $completionRate
                    ]
                ];
            })
            ->sortByDesc(function ($photographer) {
                // ✅ ترتيب حسب إجمالي المشاريع (تنازلي)
                return $photographer['statistics']['total_projects'];
            })
            ->values();

            $statisticsData = [
                'total_statistics' => [
                    'total_photographers' => $totalPhotographers,
                    'total_assigned_projects' => $totalAssignedProjects,
                    'total_completed_projects' => $totalCompletedProjects,
                    'total_current_projects' => $totalCurrentProjects,
                    'total_delayed_projects' => $totalDelayedProjects,
                    'total_sent_to_montage' => $totalSentToMontage,
                    'total_redone_projects' => $totalRedoneProjects,
                    'total_finished_projects' => $totalFinishedProjects
                ],
                'averages' => [
                    'avg_projects_per_photographer' => $avgProjectsPerPhotographer,
                    'avg_completed_per_photographer' => $avgCompletedPerPhotographer,
                    'overall_completion_rate' => $overallCompletionRate
                ],
                'photographers' => $photographersWithStats
            ];

            Cache::put($cacheKey, $statisticsData, 300);

            return response()->json([
                'success' => true,
                'data' => $statisticsData,
                'cached' => false
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Photographers Statistics Error:', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'فشل تحميل إحصائيات المصورين',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export Report - تصدير التقارير إلى Excel
     * GET /api/supervision/export
     */
    public function exportReport(Request $request)
    {
        if ($reject = $this->rejectIfOnlyMediaManager($request)) {
            return $reject;
        }
        $reportType = $request->get('report_type', 'projects');
        // مدير المشاريع مسموح له فقط تصدير تقرير المشاريع (report_type=projects)
        if ($this->isOnlyProjectManager($request) && $reportType !== 'projects') {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات لتصدير هذا التقرير. يمكنك تصدير تقرير المشاريع المفصل فقط.',
            ], 403);
        }
        try {
            $format = $request->get('format', 'xlsx');

            $filename = "supervision_report_{$reportType}_" . date('Y-m-d_His') . ".{$format}";

            switch ($reportType) {
                case 'projects':
                    return $this->exportProjects($request, $filename);
                
                case 'financial':
                    return $this->exportFinancial($request, $filename);
                
                case 'beneficiaries':
                    return $this->exportBeneficiaries($request, $filename);
                
                case 'summary':
                    return $this->exportSummary($request, $filename);
                
                default:
                    return response()->json([
                        'success' => false,
                        'error' => 'نوع التقرير غير صالح'
                    ], 400);
            }

        } catch (\Exception $e) {
            \Log::error('Supervision Export Report Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل تصدير التقرير',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export Projects Report to Excel
     * تطبيق نفس فلترة detailed-projects (التاريخ، الحالة، نوع المشروع، البحث، الترتيب) ثم تصدير النتائج
     */
    private function exportProjects(Request $request, $filename)
    {
        $query = ProjectProposal::query()->with([
            'currency:id,currency_code,currency_symbol,currency_name_ar,exchange_rate_to_usd',
            'assignedToTeam:id,team_name,team_leader_name',
            'photographer:id,name,phone_number',
            'creator:id,name,phone_number',
            'shelter' => function ($q) {
                $q->select('manager_id_number', 'camp_name', 'governorate', 'district');
            },
        ]);

        // فلترة التاريخ (created_at) — نفس منطق detailed-projects (بدائل: start_date/end_date أو created_at_start/created_at_end)
        $startDate = $request->filled('start_date') ? $request->start_date : $request->get('created_at_start');
        $endDate = $request->filled('end_date') ? $request->end_date : $request->get('created_at_end');
        if ($startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        // فلترة الحالة ونوع المشروع
        if ($request->filled('status') && $request->status !== 'all' && $request->status !== 'الكل') {
            $query->where('status', $request->status);
        }
        if ($request->filled('project_type') && $request->project_type !== 'all' && $request->project_type !== 'الكل') {
            $query->where('project_type', $request->project_type);
        }

        // البحث النصي
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('serial_number', 'like', "%{$search}%")
                    ->orWhere('project_name', 'like', "%{$search}%")
                    ->orWhere('project_description', 'like', "%{$search}%")
                    ->orWhere('donor_name', 'like', "%{$search}%")
                    ->orWhere('donor_code', 'like', "%{$search}%")
                    ->orWhere('internal_code', 'like', "%{$search}%");
            });
        }

        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $projects = $query->orderBy($sortBy, $sortOrder)->get();

        return Excel::download(
            new \App\Exports\SupervisionProjectsExport($projects),
            $filename
        );
    }

    /**
     * Export Financial Report to Excel
     */
    private function exportFinancial(Request $request, $filename)
    {
        // يمكن إنشاء Export class مخصص للتقرير المالي
        $query = ProjectProposal::query()
            ->with(['currency:id,currency_code,currency_name_ar']);

        if ($request->has('currency') && !empty($request->currency)) {
            $query->whereHas('currency', function($q) use ($request) {
                $q->where('currency_code', $request->currency);
            });
        }
        if ($request->has('project_type') && !empty($request->project_type)) {
            $query->where('project_type', $request->project_type);
        }
        if ($request->has('start_date') && !empty($request->start_date)) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date') && !empty($request->end_date)) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $projects = $query->get();

        return Excel::download(
            new \App\Exports\ProjectProposalsExport($projects), 
            $filename
        );
    }

    /**
     * Export Beneficiaries Report to Excel
     */
    private function exportBeneficiaries(Request $request, $filename)
    {
        $query = Beneficiary::query()
            ->with(['project:id,serial_number,project_name,project_type']);

        if ($request->has('project_id') && !empty($request->project_id)) {
            $query->where('project_id', $request->project_id);
        }
        if ($request->has('aid_type') && !empty($request->aid_type)) {
            $query->where('aid_type', $request->aid_type);
        }
        if ($request->has('start_date') && !empty($request->start_date)) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date') && !empty($request->end_date)) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $beneficiaries = $query->get();

        // استخدام Export class موجود أو إنشاء واحد جديد
        return Excel::download(
            new \App\Exports\BeneficiariesExport($beneficiaries), 
            $filename
        );
    }

    /**
     * Export Summary Report to Excel
     */
    private function exportSummary(Request $request, $filename)
    {
        // يمكن إنشاء تقرير ملخص شامل
        $summaryData = $this->summaryDashboard($request)->getData(true)['data'];
        
        // هنا يمكن إنشاء Export class مخصص للملخص
        // مؤقتاً نستخدم export المشاريع
        $projects = ProjectProposal::with(['currency', 'shelter', 'creator'])->get();
        
        return Excel::download(
            new \App\Exports\ProjectProposalsExport($projects), 
            $filename
        );
    }
}
