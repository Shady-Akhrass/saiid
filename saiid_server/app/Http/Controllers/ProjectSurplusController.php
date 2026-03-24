<?php

namespace App\Http\Controllers;

use App\Models\ProjectProposal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;

class ProjectSurplusController extends Controller
{
    /**
     * Dashboard الوافر - إحصائيات عامة
     * GET /api/surplus/dashboard
     */
    public function getSurplusDashboard(Request $request)
    {
        try {
            // ✅ استبعاد المشاريع الأصلية المقسمة (لأنها تكرار)
            // ✅ إبقاء المشاريع الفرعية (اليومية والشهرية) والمشاريع غير المقسمة فقط
            try {
                // ✅ بناء query يستبعد المشاريع الأصلية المقسمة
                $baseQuery = $this->excludeDividedParentProjects(
                    ProjectProposal::whereNotNull('surplus_amount')
                );

                    // إجمالي الوافر (المشاريع التي has_deficit = false)
                    $totalSurplus = (clone $baseQuery)
                        ->where('has_deficit', false)
                        ->sum('surplus_amount') ?? 0;

                    // إجمالي العجز (المشاريع التي has_deficit = true)
                    $totalDeficit = (clone $baseQuery)
                        ->where('has_deficit', true)
                        ->sum('surplus_amount') ?? 0;

                    // عدد المشاريع مع وافر
                    $projectsWithSurplusCount = (clone $baseQuery)
                        ->where('has_deficit', false)
                        ->count();

                    // عدد المشاريع مع عجز
                    $projectsWithDeficitCount = (clone $baseQuery)
                        ->where('has_deficit', true)
                        ->count();
                } catch (\Exception $e) {
                    Log::error('Error calculating surplus totals in dashboard', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);
                    $totalSurplus = 0;
                    $totalDeficit = 0;
                    $projectsWithSurplusCount = 0;
                    $projectsWithDeficitCount = 0;
                }

                // ✅ إحصائيات حسب الأقسام - استخدام select محدد مع معالجة الأخطاء
                $categoriesStats = [];
                try {
                    // ✅ محاولة جلب إحصائيات الأقسام، وإذا فشل نتركها فارغة
                    $categoriesStats = \App\Models\SurplusCategory::select(['id', 'name', 'description'])
                        ->where('is_active', true)
                        ->get()
                        ->map(function ($category) {
                            try {
                                return $category->getStatistics();
                            } catch (\Exception $e) {
                                Log::error('Error getting statistics for category ' . $category->id, [
                                    'error' => $e->getMessage(),
                                    'trace' => $e->getTraceAsString()
                                ]);
                                // ✅ إرجاع إحصائيات فارغة في حالة الخطأ
                                return [
                                    'category_id' => $category->id,
                                    'category_name' => $category->name,
                                    'total_balance' => 0,
                                    'total_surplus' => 0,
                                    'total_deficit' => 0,
                                    'projects_count' => 0,
                                    'surplus_projects_count' => 0,
                                    'deficit_projects_count' => 0,
                                ];
                            }
                        })
                        ->filter(); // ✅ إزالة القيم null
                } catch (\Exception $e) {
                    // ✅ إذا فشل (مثلاً جدول غير موجود)، نترك categoriesStats فارغة
                    \Log::info('Surplus categories table may not exist, skipping categories stats', [
                        'error' => $e->getMessage()
                    ]);
                    $categoriesStats = [];
                }

                // ✅ المشاريع الأخيرة مع وافر/عجز - استخدام select محدد لتحسين الأداء
                // ✅ استبعاد المشاريع الأصلية المقسمة (لأنها تكرار)
                $recentProjects = [];
                try {
                    // ✅ بناء query يستبعد المشاريع الأصلية المقسمة
                    $recentProjectsQuery = $this->excludeDividedParentProjects(
                        ProjectProposal::whereNotNull('surplus_amount')
                    );
                    
                    // ✅ محاولة تحميل المشاريع مع surplus_category_id، وإذا فشل نستخدم بدونها
                    try {
                        $recentProjects = (clone $recentProjectsQuery)
                            ->select([
                                'id', 'serial_number', 'donor_code', 'internal_code', 'project_description', 'net_amount',
                                'net_amount_shekel', 'shekel_exchange_rate', 'supply_cost',
                                'surplus_amount', 'has_deficit', 'surplus_recorded_at', 'surplus_recorded_by', 'surplus_category_id'
                            ])
                            ->with([
                                'creator:id,name', 
                                'surplusRecorder:id,name',
                                'surplusCategory:id,name'
                            ])
                            ->orderBy('surplus_recorded_at', 'desc')
                            ->limit(10)
                            ->get()
                            ->map(function ($project) {
                                try {
                                    // تحديد العملة والمبلغ المتاح
                                    $hasShekelConversion = false;
                                    try {
                                        if (method_exists($project, 'hasShekelConversion')) {
                                            $hasShekelConversion = $project->hasShekelConversion();
                                        }
                                    } catch (\Exception $e) {
                                        Log::warning('Error checking shekel conversion for project ' . $project->id, [
                                            'error' => $e->getMessage()
                                        ]);
                                    }
                                    
                                    $currency = $hasShekelConversion ? 'ILS' : 'USD';
                                    $currencySymbol = $hasShekelConversion ? '₪' : '$';
                                    
                                    // ✅ الحصول على المبلغ المتاح مع معالجة الأخطاء
                                    $availableAmount = 0;
                                    try {
                                        if (method_exists($project, 'getAvailableAmountForSupply')) {
                                            $availableAmount = $project->getAvailableAmountForSupply();
                                        } else {
                                            $availableAmount = $project->net_amount_shekel ?? $project->net_amount ?? 0;
                                        }
                                    } catch (\Exception $e) {
                                        Log::warning('Error getting available amount for project ' . $project->id, [
                                            'error' => $e->getMessage()
                                        ]);
                                        $availableAmount = $project->net_amount_shekel ?? $project->net_amount ?? 0;
                                    }
                                    
                                    $result = [
                                        'id' => $project->id,
                                        'serial_number' => $project->serial_number,
                                        'donor_code' => $project->donor_code,
                                        'internal_code' => $project->internal_code,
                                        'project_code' => $project->donor_code ?? $project->internal_code, // ✅ كود المتبرع أولاً، وإلا الكود الداخلي
                                        'project_description' => $project->project_description,
                                        'net_amount' => $project->net_amount,
                                        'net_amount_shekel' => $project->net_amount_shekel,
                                        'shekel_exchange_rate' => $project->shekel_exchange_rate,
                                        'available_amount' => $availableAmount,
                                        'currency' => $currency,
                                        'currency_symbol' => $currencySymbol,
                                        'supply_cost' => $project->supply_cost,
                                        'surplus_amount' => $project->surplus_amount,
                                        'has_deficit' => $project->has_deficit,
                                        'surplus_recorded_at' => $project->surplus_recorded_at,
                                        'surplus_recorded_by' => $project->surplusRecorder ? $project->surplusRecorder->name : null,
                                    ];
                                    
                                    // ✅ إضافة surplus_category إذا كان موجوداً
                                    if (isset($project->surplusCategory) && $project->surplusCategory) {
                                        $result['surplus_category'] = [
                                            'id' => $project->surplusCategory->id,
                                            'name' => $project->surplusCategory->name,
                                        ];
                                    }
                                    
                                    return $result;
                                } catch (\Exception $e) {
                                    Log::warning('Error mapping project in recent projects', [
                                        'project_id' => $project->id ?? null,
                                        'error' => $e->getMessage()
                                    ]);
                                    return null;
                                }
                            })
                            ->filter(); // ✅ إزالة القيم null
                    } catch (\Exception $e) {
                        // ✅ إذا فشل بسبب عدم وجود العمود، نستخدم بدون surplus_category_id
                        Log::info('Trying to load recent projects without surplus_category_id', [
                            'error' => $e->getMessage()
                        ]);
                        
                        $recentProjects = (clone $recentProjectsQuery)
                            ->select([
                                'id', 'serial_number', 'donor_code', 'internal_code', 'project_description', 'net_amount',
                                'net_amount_shekel', 'shekel_exchange_rate', 'supply_cost',
                                'surplus_amount', 'has_deficit', 'surplus_recorded_at', 'surplus_recorded_by'
                            ])
                            ->with([
                                'creator:id,name', 
                                'surplusRecorder:id,name'
                            ])
                            ->orderBy('surplus_recorded_at', 'desc')
                            ->limit(10)
                            ->get()
                            ->map(function ($project) {
                                try {
                                    // ✅ تحديد العملة والمبلغ المتاح مع معالجة الأخطاء
                                    $hasShekelConversion = false;
                                    try {
                                        if (method_exists($project, 'hasShekelConversion')) {
                                            $hasShekelConversion = $project->hasShekelConversion();
                                        }
                                    } catch (\Exception $e) {
                                        Log::warning('Error checking shekel conversion for project ' . $project->id . ' (fallback)', [
                                            'error' => $e->getMessage()
                                        ]);
                                    }
                                    
                                    $currency = $hasShekelConversion ? 'ILS' : 'USD';
                                    $currencySymbol = $hasShekelConversion ? '₪' : '$';
                                    
                                    // ✅ الحصول على المبلغ المتاح مع معالجة الأخطاء
                                    $availableAmount = 0;
                                    try {
                                        if (method_exists($project, 'getAvailableAmountForSupply')) {
                                            $availableAmount = $project->getAvailableAmountForSupply();
                                        } else {
                                            $availableAmount = $project->net_amount_shekel ?? $project->net_amount ?? 0;
                                        }
                                    } catch (\Exception $e) {
                                        Log::warning('Error getting available amount for project ' . $project->id . ' (fallback)', [
                                            'error' => $e->getMessage()
                                        ]);
                                        $availableAmount = $project->net_amount_shekel ?? $project->net_amount ?? 0;
                                    }
                                    
                                    return [
                                        'id' => $project->id,
                                        'serial_number' => $project->serial_number,
                                        'donor_code' => $project->donor_code,
                                        'internal_code' => $project->internal_code,
                                        'project_code' => $project->donor_code ?? $project->internal_code, // ✅ كود المتبرع أولاً، وإلا الكود الداخلي
                                        'project_description' => $project->project_description,
                                        'net_amount' => $project->net_amount,
                                        'net_amount_shekel' => $project->net_amount_shekel,
                                        'shekel_exchange_rate' => $project->shekel_exchange_rate,
                                        'available_amount' => $availableAmount,
                                        'currency' => $currency,
                                        'currency_symbol' => $currencySymbol,
                                        'supply_cost' => $project->supply_cost,
                                        'surplus_amount' => $project->surplus_amount,
                                        'has_deficit' => $project->has_deficit,
                                        'surplus_recorded_at' => $project->surplus_recorded_at,
                                        'surplus_recorded_by' => $project->surplusRecorder ? $project->surplusRecorder->name : null,
                                    ];
                                } catch (\Exception $e) {
                                    Log::warning('Error mapping project in recent projects (fallback)', [
                                        'project_id' => $project->id ?? null,
                                        'error' => $e->getMessage()
                                    ]);
                                    return null;
                                }
                            })
                            ->filter();
                    }
                } catch (\Exception $e) {
                    Log::error('Error fetching recent projects in dashboard', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);
                    $recentProjects = [];
                }

            $data = [
                'total_surplus' => round($totalSurplus, 2),
                'total_deficit' => round(abs($totalDeficit), 2),
                'net_surplus' => round($totalSurplus - $totalDeficit, 2), // الوافر الصافي
                'projects_with_surplus_count' => $projectsWithSurplusCount,
                'projects_with_deficit_count' => $projectsWithDeficitCount,
                'categories_statistics' => $categoriesStats,
                'recent_projects' => $recentProjects,
                'currency_note' => 'المبالغ قد تكون بالدولار أو الشيكل حسب كل مشروع',
            ];

            return response()->json([
                'success' => true,
                'data' => $data
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error in getSurplusDashboard', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب بيانات الوافر',
                'error' => config('app.debug') ? $e->getMessage() : 'يرجى المحاولة مرة أخرى'
            ], 500);
        }
    }

    /**
     * تقرير مفصل للوافر
     * GET /api/surplus/report
     * ✅ جميع المبالغ بالشيكل (ILS) لأن التوريد يتم بالشيكل
     */
    public function getSurplusReport(Request $request)
    {
        // ✅ استبعاد المشاريع الأصلية المقسمة (لأنها تكرار)
        // ✅ إبقاء المشاريع الفرعية (اليومية والشهرية) والمشاريع غير المقسمة فقط
        $query = $this->excludeDividedParentProjects(
            ProjectProposal::whereNotNull('surplus_amount')
        )->with(['creator:id,name', 'surplusRecorder:id,name', 'surplusCategory:id,name']);

        // Filter by surplus/deficit
        if ($request->has('type')) {
            if ($request->type === 'surplus') {
                $query->where('has_deficit', false);
            } elseif ($request->type === 'deficit') {
                $query->where('has_deficit', true);
            }
        }

        // Filter by date range
        if ($request->has('from_date')) {
            $query->whereDate('surplus_recorded_at', '>=', $request->from_date);
        }
        if ($request->has('to_date')) {
            $query->whereDate('surplus_recorded_at', '<=', $request->to_date);
        }

        // Filter by project type
        if ($request->has('project_type')) {
            $query->where('project_type', $request->project_type);
        }

        // Filter by surplus category
        if ($request->has('surplus_category_id')) {
            $query->where('surplus_category_id', $request->surplus_category_id);
        }

        // Search by serial number, donor code, internal code, or description
        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('serial_number', 'like', '%' . $request->search . '%')
                  ->orWhere('donor_code', 'like', '%' . $request->search . '%')
                  ->orWhere('internal_code', 'like', '%' . $request->search . '%')
                  ->orWhere('project_description', 'like', '%' . $request->search . '%');
            });
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'surplus_recorded_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination - استخدام select محدد لتحسين الأداء
        $perPage = $request->input('per_page', 15);
        $projects = $query->select([
            'id', 'serial_number', 'donor_code', 'internal_code', 'project_name', 'project_description', 'project_type',
            'net_amount', 'net_amount_shekel', 'shekel_exchange_rate', 'supply_cost',
            'surplus_amount', 'has_deficit', 'surplus_recorded_at', 'created_at', 'surplus_category_id'
        ])->paginate($perPage);

        // ✅ حساب المجاميع للصفحة الحالية بالشيكل دائماً
        $currentPageIds = $projects->pluck('id');
        $currentPageSurplus = 0;
        $currentPageDeficit = 0;
        
        // ✅ تحميل المشاريع لحساب الوافر بالشيكل
        $projectsForCalculation = ProjectProposal::whereIn('id', $currentPageIds)
            ->select([
                'id', 'net_amount', 'net_amount_shekel', 'shekel_exchange_rate', 
                'supply_cost', 'surplus_amount', 'has_deficit'
            ])
            ->get();
        
        foreach ($projectsForCalculation as $project) {
            // ✅ حساب الوافر بالشيكل دائماً
            $surplusInShekel = $this->getSurplusInShekel($project);
            
            if ($project->has_deficit) {
                $currentPageDeficit += abs($surplusInShekel);
            } else {
                $currentPageSurplus += $surplusInShekel;
            }
        }

        // ✅ تحويل البيانات - جميع المبالغ بالشيكل
        $transformedProjects = $projects->getCollection()->map(function ($project) {
            try {
                // ✅ حساب الوافر بالشيكل دائماً
                $surplusInShekel = $this->getSurplusInShekel($project);
                
                // ✅ الحصول على المبلغ المتاح للتوريد مع معالجة الأخطاء
                $availableAmount = 0;
                if (method_exists($project, 'getAvailableAmountForSupply')) {
                    try {
                        $availableAmount = $project->getAvailableAmountForSupply();
                    } catch (\Exception $e) {
                        Log::warning('Error getting available amount for project ' . $project->id, [
                            'error' => $e->getMessage()
                        ]);
                        // ✅ Fallback: استخدام net_amount_shekel أو net_amount
                        $availableAmount = $project->net_amount_shekel ?? $project->net_amount ?? 0;
                    }
                } else {
                    // ✅ Fallback: استخدام net_amount_shekel أو net_amount
                    $availableAmount = $project->net_amount_shekel ?? $project->net_amount ?? 0;
                }
                
                return [
                    'id' => $project->id,
                    'serial_number' => $project->serial_number,
                    'donor_code' => $project->donor_code,
                    'internal_code' => $project->internal_code,
                    'project_code' => $project->donor_code ?? $project->internal_code, // ✅ كود المتبرع أولاً، وإلا الكود الداخلي
                    'project_name' => $project->project_name,
                    'project_description' => $project->project_description,
                    'project_type' => $project->project_type,
                    'net_amount' => $project->net_amount,
                    'net_amount_shekel' => $project->net_amount_shekel,
                    'shekel_exchange_rate' => $project->shekel_exchange_rate,
                    'available_amount' => $availableAmount,
                    'currency' => 'ILS', // ✅ دائماً بالشيكل في التقرير
                    'currency_symbol' => '₪',
                    'supply_cost' => $project->supply_cost ?? 0, // ✅ supply_cost بالشيكل دائماً
                    'supply_cost_shekel' => $project->supply_cost ?? 0, // ✅ إضافة supply_cost_shekel للتوافق
                    'surplus_amount' => $surplusInShekel, // ✅ الوافر بالشيكل
                    'has_deficit' => $project->has_deficit ?? false,
                    'surplus_recorded_at' => $project->surplus_recorded_at,
                    'created_at' => $project->created_at,
                    'surplus_category' => $project->surplusCategory ? [
                        'id' => $project->surplusCategory->id,
                        'name' => $project->surplusCategory->name,
                    ] : null,
                ];
            } catch (\Exception $e) {
                Log::error('Error transforming project in surplus report', [
                    'project_id' => $project->id ?? null,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                // ✅ إرجاع بيانات أساسية في حالة الخطأ
                return [
                    'id' => $project->id ?? null,
                    'serial_number' => $project->serial_number ?? null,
                    'donor_code' => $project->donor_code ?? null,
                    'internal_code' => $project->internal_code ?? null,
                    'project_code' => $project->donor_code ?? $project->internal_code ?? null, // ✅ كود المتبرع أولاً، وإلا الكود الداخلي
                    'project_name' => $project->project_name ?? null,
                    'project_description' => $project->project_description ?? null,
                    'project_type' => $project->project_type ?? null,
                    'net_amount' => $project->net_amount ?? 0,
                    'net_amount_shekel' => $project->net_amount_shekel ?? 0,
                    'available_amount' => $project->net_amount_shekel ?? $project->net_amount ?? 0,
                    'currency' => 'ILS',
                    'currency_symbol' => '₪',
                    'supply_cost' => $project->supply_cost ?? 0,
                    'supply_cost_shekel' => $project->supply_cost ?? 0,
                    'surplus_amount' => $project->surplus_amount ?? 0,
                    'has_deficit' => $project->has_deficit ?? false,
                    'surplus_recorded_at' => $project->surplus_recorded_at,
                    'created_at' => $project->created_at,
                    'surplus_category' => null,
                ];
            }
        })->filter(); // ✅ إزالة القيم null

        return response()->json([
            'success' => true,
            'data' => [
                'projects' => $transformedProjects,
                'current_page' => $projects->currentPage(),
                'last_page' => $projects->lastPage(),
                'per_page' => $projects->perPage(),
                'total' => $projects->total(),
            ],
            'summary' => [
                'current_page_surplus' => round($currentPageSurplus, 2),
                'current_page_deficit' => round($currentPageDeficit, 2),
                'current_page_net' => round($currentPageSurplus - $currentPageDeficit, 2),
                'currency' => 'ILS',
                'currency_symbol' => '₪',
                'note' => 'جميع المبالغ بالشيكل (ILS) لأن التوريد يتم بالشيكل',
            ]
        ], 200);
    }

    /**
     * تفاصيل الوافر لمشروع معين
     * GET /api/projects/{projectId}/surplus
     */
    public function getProjectSurplus($projectId)
    {
        $project = ProjectProposal::with([
            'confirmedWarehouseItems.warehouseItem',
            'creator',
            'surplusRecorder'
            // TODO: إضافة 'surplusCategory' بعد رفع migrations
        ])->find($projectId);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        }

        if (is_null($project->surplus_amount)) {
            return response()->json([
                'success' => false,
                'message' => 'لم يتم تسجيل الوافر لهذا المشروع بعد'
            ], 404);
        }

        $items = $project->confirmedWarehouseItems->map(function ($item) use ($project) {
            return [
                'item_name' => $item->warehouseItem->item_name,
                'quantity_per_unit' => $item->quantity_per_unit,
                'unit_price' => $item->unit_price,
                'total_price_per_unit' => $item->total_price_per_unit,
                'total_quantity' => $item->quantity_per_unit * $project->quantity,
                'total_cost' => $item->total_price_per_unit * $project->quantity,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'project' => [
                    'id' => $project->id,
                    'serial_number' => $project->serial_number,
                    'donor_code' => $project->donor_code,
                    'internal_code' => $project->internal_code,
                    'project_code' => $project->donor_code ?? $project->internal_code, // ✅ كود المتبرع أولاً، وإلا الكود الداخلي
                    'project_description' => $project->project_description,
                    'project_type' => $project->project_type,
                    'donor_name' => $project->donor_name,
                    'net_amount' => $project->net_amount,
                    'quantity' => $project->quantity,
                ],
                'supply_details' => [
                    'items' => $items,
                    'unit_cost' => $project->unit_cost,
                    'supply_cost' => $project->supply_cost,
                ],
                'surplus_details' => [
                    'surplus_amount' => $project->surplus_amount,
                    'has_deficit' => $project->has_deficit,
                    'surplus_notes' => $project->surplus_notes,
                    'surplus_recorded_at' => $project->surplus_recorded_at,
                    'surplus_recorded_by' => $project->surplusRecorder ? $project->surplusRecorder->name : null,
                    // TODO: إضافة surplus_category بعد رفع migrations
                    // 'surplus_category' => $project->surplusCategory ? [
                    //     'id' => $project->surplusCategory->id,
                    //     'name' => $project->surplusCategory->name,
                    //     'description' => $project->surplusCategory->description,
                    // ] : null,
                ],
            ]
        ], 200);
    }

    /**
     * تعديل ملاحظات الوافر
     * PATCH /api/projects/{projectId}/surplus
     */
    public function updateSurplus(Request $request, $projectId)
    {
        // ✅ منع supervision من التعديل (صلاحيات قراءة فقط)
        $user = Auth::user();
        if ($user && $user->role === 'supervision') {
            return response()->json([
                'success' => false,
                'message' => 'ليس لديك صلاحيات للتعديل. الصلاحيات مقتصرة على القراءة فقط.'
            ], 403);
        }

        $project = ProjectProposal::find($projectId);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        }

        if (is_null($project->surplus_amount)) {
            return response()->json([
                'success' => false,
                'message' => 'لم يتم تسجيل الوافر لهذا المشروع بعد'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'surplus_notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $project->update([
            'surplus_notes' => $request->surplus_notes,
        ]);

        // ✅ مسح cache للفائض والمشاريع بعد التحديث
        $this->clearSurplusCache();

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث ملاحظات الوافر بنجاح',
            'data' => $project
        ], 200);
    }

    /**
     * حساب الوافر بالشيكل لمشروع معين
     * 
     * ✅ الحساب: الفائض = المبلغ الصافي بالشيكل - تكلفة التوريد بالشيكل
     * ✅ تكلفة التوريد = تكلفة الطرد الواحد × عدد الطرود (كلها بالشيكل)
     * 
     * @param ProjectProposal $project
     * @return float
     */
    /**
     * حساب الوافر بالشيكل لمشروع معين
     * 
     * ✅ استخدام نفس منطق calculateSurplus() من ProjectProposal Model
     * ✅ بعد تأكيد التوريد، surplus_amount المحفوظ يكون بالشيكل دائماً
     * ✅ إذا كان هناك surplus_amount محفوظ، نستخدمه مباشرة
     * ✅ إذا لم يكن، نحسبه باستخدام: getAvailableAmountForSupply() - supply_cost
     * 
     * @param ProjectProposal $project
     * @return float
     */
    private function getSurplusInShekel($project)
    {
        try {
            if (!$project) {
                return 0;
            }
            
            // ✅ بعد تأكيد التوريد، surplus_amount المحفوظ يكون بالشيكل دائماً
            // لأنه تم حسابه وحفظه عند التوريد باستخدام: getAvailableAmountForSupply() - supply_cost
            // لذلك نستخدم القيمة المحفوظة مباشرة إذا كانت موجودة
            if (!is_null($project->surplus_amount)) {
                return round($project->surplus_amount, 2);
            }
            
            // ✅ إذا لم يكن هناك surplus_amount محفوظ، نحسبه
            // استخدام نفس المنطق المستخدم في calculateSurplus() و recordSurplus()
            if (method_exists($project, 'calculateSurplus')) {
                $calculatedSurplus = $project->calculateSurplus();
                // ✅ calculateSurplus() يستخدم: getAvailableAmountForSupply() - calculateSupplyCost()
                // و getAvailableAmountForSupply() يرجع net_amount_shekel إذا كان محولاً، أو net_amount إذا لم يكن
                // و calculateSupplyCost() = supply_cost (دائماً بالشيكل)
                // لذلك النتيجة تكون بالشيكل إذا كان محولاً، أو بالدولار إذا لم يكن
                
                // ✅ إذا كان المشروع محولاً للشيكل، النتيجة بالشيكل
                if ($project->hasShekelConversion()) {
                    return round($calculatedSurplus, 2);
                }
                
                // ✅ إذا لم يكن محولاً للشيكل، النتيجة بالدولار
                // لكن في التقرير نريد الشيكل دائماً
                // لذلك نستخدم surplus_amount المحفوظ أو 0
                return 0;
            }
            
            // ✅ Fallback: حساب يدوي
            $availableAmount = $project->getAvailableAmountForSupply(); // بالشيكل إذا محول، أو بالدولار إذا لم يكن
            $supplyCost = $project->supply_cost ?? 0; // دائماً بالشيكل
            
            // ✅ إذا كان المشروع محولاً للشيكل، availableAmount بالشيكل
            if ($project->hasShekelConversion() && $project->net_amount_shekel) {
                $surplusAmountShekel = $availableAmount - $supplyCost;
                return round($surplusAmountShekel, 2);
            }
            
            // ✅ إذا لم يكن محولاً للشيكل، availableAmount بالدولار و supply_cost بالشيكل
            // لا يمكننا حساب الوافر بالشيكل بدون تحويل للشيكل
            return 0;
        } catch (\Exception $e) {
            Log::warning('Error calculating surplus in shekel', [
                'project_id' => $project->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            // ✅ في حالة الخطأ، نستخدم surplus_amount المحفوظ مباشرة
            return round($project->surplus_amount ?? 0, 2);
        }
    }

    /**
     * بناء query يستبعد المشاريع الأصلية المقسمة
     * ✅ إبقاء المشاريع الفرعية (اليومية والشهرية) والمشاريع غير المقسمة فقط
     * 
     * @param \Illuminate\Database\Eloquent\Builder|null $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    private function excludeDividedParentProjects($query = null)
    {
        if ($query === null) {
            $query = ProjectProposal::query();
        }
        
        // ✅ استخدام scope الجديد من ProjectProposal model
        return $query->forSurplusStatistics();
    }

    /**
     * مسح cache للفائض والمشاريع
     */
    private function clearSurplusCache(): void
    {
        try {
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['surplus_dashboard', 'surplus_statistics', 'surplus_categories', 'projects'])->flush();
            } else {
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    $redis = $cacheDriver->getRedis();
                    $patterns = ['*surplus*', '*projects_*'];
                    foreach ($patterns as $pattern) {
                        $keys = $redis->keys($pattern);
                        if (!empty($keys)) {
                            $redis->del($keys);
                        }
                    }
                } else {
                    Cache::flush();
                }
            }
        } catch (\Exception $e) {
            Log::warning('Failed to clear surplus cache', [
                'error' => $e->getMessage()
            ]);
        }
    }
}
