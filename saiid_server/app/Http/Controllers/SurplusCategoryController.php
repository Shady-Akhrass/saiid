<?php

namespace App\Http\Controllers;

use App\Models\SurplusCategory;
use App\Models\ProjectProposal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class SurplusCategoryController extends Controller
{
    /**
     * قائمة جميع أقسام الوافر
     * GET /api/surplus-categories
     */
    public function index(Request $request)
    {
        try {
            $user = auth()->user();
            $userRole = $user ? ($user->role ?? '') : '';
            
            // ✅ إنشاء cache key بناءً على جميع المعاملات
            $cacheKey = 'surplus_categories_' . md5(json_encode([
                'is_active' => $request->input('is_active'),
                'search' => $request->input('search'),
                'sort_by' => $request->input('sort_by', 'created_at'),
                'sort_order' => $request->input('sort_order', 'desc'),
                'user_role' => $userRole,
            ]));

            // ✅ محاولة جلب البيانات من cache (مدة 60 ثانية)
            // ✅ استخدام cache بدون tags للتوافق مع جميع إعدادات Laravel
            $categoriesWithStats = Cache::remember($cacheKey, 60, function () use ($request, $user, $userRole) {
                    // ✅ استخدام select محدد لتحسين الأداء
                    $query = SurplusCategory::select(['id', 'name', 'description', 'is_active', 'created_by', 'created_at', 'updated_at'])
                        ->with(['creator:id,name']); // ✅ تحميل creator مع select محدد

                    // ✅ تطبيق الفلاتر
                    if ($request->has('is_active') && $request->is_active !== '') {
                        $query->where('is_active', $request->is_active);
                    }

                    // البحث المرن (جزء من الكلمة) - يدعم البحث عن جزء من الكلمة في أي مكان
                    if ($request->has('search') && !empty(trim($request->search))) {
                        $searchTerm = trim($request->search);
                        // تنظيف البحث من المسافات الزائدة
                        $searchTerm = preg_replace('/\s+/', ' ', $searchTerm);
                        
                        $query->where(function ($q) use ($searchTerm) {
                            // البحث في الاسم (جزء من الكلمة)
                            $q->where('name', 'LIKE', '%' . $searchTerm . '%')
                              // البحث في الوصف (جزء من الكلمة)
                              ->orWhere('description', 'LIKE', '%' . $searchTerm . '%');
                        });
                    }

                    // ✅ تطبيق الترتيب
                    $sortBy = $request->input('sort_by', 'created_at');
                    $sortOrder = $request->input('sort_order', 'desc');
                    $query->orderBy($sortBy, $sortOrder);

                    $categories = $query->get();
                    
                    // ✅ جلب جميع المشاريع المرتبطة بأي قسم (بدون تحميل العلاقات غير الضرورية)
                    $allProjects = ProjectProposal::whereNotNull('surplus_category_id')
                        ->select([
                            'id', 'surplus_category_id', 'net_amount_shekel', 'supply_cost',
                            'is_divided_into_phases', 'parent_project_id', 'phase_day',
                            'month_number', 'phase_type'
                        ])
                        ->get();
                    
                    // ✅ فلترة المشاريع للأدمن: استبعاد المشاريع المقسمة الأصلية
                    $isAdmin = $user && in_array(strtolower($userRole), ['admin', 'administrator', 'مدير']);
                    
                    if ($isAdmin) {
                        $allProjects = $allProjects->filter(function($project) {
                            $isDivided = $project->is_divided_into_phases ?? false;
                            $parentProjectId = $project->parent_project_id ?? null;
                            $phaseDay = $project->phase_day ?? null;
                            $monthNumber = $project->month_number ?? null;
                            $phaseType = $project->phase_type ?? null;
                            
                            // ✅ استبعاد المشاريع المقسمة الأصلية
                            $isDividedParent = $isDivided && 
                                !$parentProjectId && 
                                !$phaseDay && 
                                !$monthNumber &&
                                $phaseType !== 'daily' &&
                                $phaseType !== 'monthly';
                            
                            return !$isDividedParent;
                        });
                    }
                    
                    // ✅ حساب الإحصائيات لكل قسم من المشاريع الفعلية
                    return $categories->map(function($category) use ($allProjects) {
                        // ✅ فلترة المشاريع المرتبطة بهذا القسم
                        $categoryProjects = $allProjects->filter(function($project) use ($category) {
                            return $project->surplus_category_id == $category->id;
                        });
                        
                        $totalSurplus = 0;
                        $totalDeficit = 0;
                        
                        foreach ($categoryProjects as $project) {
                            // ✅ حساب الفائض/العجز بالشيكل (نفس منطق Frontend)
                            // ✅ نحسب فقط للمشاريع المحولة للشيكل
                            $netAmountShekel = $project->net_amount_shekel ?? null;
                            if ($netAmountShekel === null || $netAmountShekel == 0) {
                                continue; // تخطي المشاريع غير المحولة للشيكل
                            }
                            
                            // ✅ supply_cost دائماً بالشيكل (حسب التعليقات في الكود)
                            $supplyCostShekel = $project->supply_cost ?? 0;
                            $calculatedSurplus = $netAmountShekel - $supplyCostShekel;
                            
                            if ($calculatedSurplus >= 0) {
                                $totalSurplus += $calculatedSurplus;
                            } else {
                                $totalDeficit += abs($calculatedSurplus);
                            }
                        }
                        
                        // ✅ حساب الرصيد الإجمالي: الفائض - العجز
                        $totalBalance = $totalSurplus - $totalDeficit;
                        
                        // ✅ حساب عدد المشاريع (فقط المشاريع المحولة للشيكل)
                        $surplusProjectsCount = $categoryProjects->filter(function($project) {
                            $netAmountShekel = $project->net_amount_shekel ?? null;
                            if ($netAmountShekel === null || $netAmountShekel == 0) {
                                return false; // تخطي المشاريع غير المحولة للشيكل
                            }
                            $supplyCostShekel = $project->supply_cost ?? 0;
                            return ($netAmountShekel - $supplyCostShekel) > 0;
                        })->count();
                        
                        $deficitProjectsCount = $categoryProjects->filter(function($project) {
                            $netAmountShekel = $project->net_amount_shekel ?? null;
                            if ($netAmountShekel === null || $netAmountShekel == 0) {
                                return false; // تخطي المشاريع غير المحولة للشيكل
                            }
                            $supplyCostShekel = $project->supply_cost ?? 0;
                            return ($netAmountShekel - $supplyCostShekel) < 0;
                        })->count();
                        
                        // ✅ إضافة الإحصائيات المحسوبة
                        return array_merge(
                            $category->toArray(),
                            [
                                'statistics' => [
                                    'category_id' => $category->id,
                                    'category_name' => $category->name,
                                    'total_balance' => round($totalBalance, 2),
                                    'total_surplus' => round($totalSurplus, 2),
                                    'total_deficit' => round($totalDeficit, 2),
                                    'projects_count' => $categoryProjects->count(),
                                    'surplus_projects_count' => $surplusProjectsCount,
                                    'deficit_projects_count' => $deficitProjectsCount,
                                ],
                                'creator_name' => $category->creator ? $category->creator->name : null,
                            ]
                        );
                    });
                });

            return response()->json([
                'success' => true,
                'data' => $categoriesWithStats,
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Error fetching surplus categories: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ في جلب أقسام الفائض',
                'error' => config('app.debug') ? $e->getMessage() : 'خطأ داخلي في الخادم'
            ], 500);
        }
    }

    /**
     * إضافة قسم وافر جديد
     * POST /api/surplus-categories
     */
    public function store(Request $request)
    {
        // ✅ منع supervision من الإضافة (صلاحيات قراءة فقط)
        $user = Auth::user();
        if ($user && $user->role === 'supervision') {
            return response()->json([
                'success' => false,
                'message' => 'ليس لديك صلاحيات للإضافة. الصلاحيات مقتصرة على القراءة فقط.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:surplus_categories,name',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ], [
            'name.required' => 'اسم القسم مطلوب',
            'name.unique' => 'هذا القسم موجود مسبقاً',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $category = SurplusCategory::create([
            'name' => $request->name,
            'description' => $request->description,
            'is_active' => $request->input('is_active', true),
            'created_by' => Auth::id(),
        ]);

        // ✅ مسح cache للأقسام بعد الإنشاء
        $this->clearSurplusCategoriesCache();

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة قسم الوافر بنجاح',
            'data' => $category
        ], 201)
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
        ->header('Pragma', 'no-cache')
        ->header('Expires', '0');
    }

    /**
     * عرض تفاصيل قسم معين
     * GET /api/surplus-categories/{id}
     */
    public function show($id)
    {
        $category = SurplusCategory::with(['creator', 'projectsWithSurplus'])->find($id);

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => array_merge(
                $category->toArray(),
                [
                    'statistics' => $category->getStatistics(),
                    'creator_name' => $category->creator ? $category->creator->name : null,
                ]
            )
        ], 200);
    }

    /**
     * تعديل قسم وافر
     * PATCH /api/surplus-categories/{id}
     */
    public function update(Request $request, $id)
    {
        // ✅ منع supervision من التعديل (صلاحيات قراءة فقط)
        $user = Auth::user();
        if ($user && $user->role === 'supervision') {
            return response()->json([
                'success' => false,
                'message' => 'ليس لديك صلاحيات للتعديل. الصلاحيات مقتصرة على القراءة فقط.'
            ], 403);
        }

        $category = SurplusCategory::find($id);

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255|unique:surplus_categories,name,' . $id,
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ], [
            'name.required' => 'اسم القسم مطلوب',
            'name.unique' => 'هذا القسم موجود مسبقاً',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $category->update($request->only(['name', 'description', 'is_active']));

        // ✅ مسح cache للأقسام بعد التحديث
        $this->clearSurplusCategoriesCache();

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث القسم بنجاح',
            'data' => $category
        ], 200)
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
        ->header('Pragma', 'no-cache')
        ->header('Expires', '0');
    }

    /**
     * حذف قسم وافر
     * DELETE /api/surplus-categories/{id}
     */
    public function destroy($id)
    {
        // ✅ منع supervision من الحذف (صلاحيات قراءة فقط)
        $user = Auth::user();
        if ($user && $user->role === 'supervision') {
            return response()->json([
                'success' => false,
                'message' => 'ليس لديك صلاحيات للحذف. الصلاحيات مقتصرة على القراءة فقط.'
            ], 403);
        }

        $category = SurplusCategory::find($id);

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }

        // التحقق من عدم وجود مشاريع مرتبطة بهذا القسم
        $projectsCount = $category->projects()->count();
        if ($projectsCount > 0) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حذف هذا القسم لأن هناك ' . $projectsCount . ' مشروع مرتبط به'
            ], 400);
        }

        $category->delete();

        // ✅ مسح cache للأقسام بعد الحذف
        $this->clearSurplusCategoriesCache();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف القسم بنجاح'
        ], 200)
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
        ->header('Pragma', 'no-cache')
        ->header('Expires', '0');
    }

    /**
     * الحصول على رصيد قسم معين
     * GET /api/surplus-categories/{id}/balance
     */
    public function getCategoryBalance($id)
    {
        $category = SurplusCategory::find($id);

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }

        $statistics = $category->getStatistics();

        // المشاريع الأخيرة في هذا القسم
        $recentProjects = $category->projectsWithSurplus()
            ->with(['creator', 'surplusRecorder'])
            ->orderBy('surplus_recorded_at', 'desc')
            ->limit(10)
            ->get()
            ->map(function ($project) {
                $hasShekelConversion = $project->hasShekelConversion();
                $currency = $hasShekelConversion ? 'ILS' : 'USD';
                $currencySymbol = $hasShekelConversion ? '₪' : '$';
                
                return [
                    'id' => $project->id,
                    'serial_number' => $project->serial_number,
                    'project_description' => $project->project_description,
                    'surplus_amount' => $project->surplus_amount,
                    'has_deficit' => $project->has_deficit,
                    'currency' => $currency,
                    'currency_symbol' => $currencySymbol,
                    'surplus_recorded_at' => $project->surplus_recorded_at,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'category' => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'description' => $category->description,
                ],
                'statistics' => $statistics,
                'recent_projects' => $recentProjects,
            ]
        ], 200);
    }

    /**
     * تفعيل/تعطيل قسم
     * PATCH /api/surplus-categories/{id}/toggle-status
     */
    public function toggleStatus($id)
    {
        // ✅ منع supervision من التعديل (صلاحيات قراءة فقط)
        $user = Auth::user();
        if ($user && $user->role === 'supervision') {
            return response()->json([
                'success' => false,
                'message' => 'ليس لديك صلاحيات للتعديل. الصلاحيات مقتصرة على القراءة فقط.'
            ], 403);
        }

        $category = SurplusCategory::find($id);

        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'القسم غير موجود'
            ], 404);
        }

        $category->update([
            'is_active' => !$category->is_active
        ]);

        // ✅ مسح cache للأقسام بعد تغيير الحالة
        $this->clearSurplusCategoriesCache();

        return response()->json([
            'success' => true,
            'message' => $category->is_active ? 'تم تفعيل القسم بنجاح' : 'تم تعطيل القسم بنجاح',
            'data' => $category
        ], 200)
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
        ->header('Pragma', 'no-cache')
        ->header('Expires', '0');
    }

    /**
     * إحصائيات جميع الأقسام (للدارة)
     * GET /api/surplus-categories/statistics/all
     */
    public function getAllStatistics()
    {
        // ✅ Cache للإحصائيات لمدة 30 ثانية
        $data = Cache::tags(['surplus_categories', 'surplus_statistics'])->remember('surplus_categories_statistics_all', 30, function () {
            // ✅ استخدام select محدد لتحسين الأداء
            $categories = SurplusCategory::select(['id', 'name', 'description', 'is_active'])
                ->where('is_active', true)
                ->get();

            $statistics = $categories->map(function ($category) {
                return $category->getStatistics();
            });

            // إجمالي عام لكل الأقسام
            $grandTotal = [
                'total_balance' => round($statistics->sum('total_balance'), 2),
                'total_surplus' => round($statistics->sum('total_surplus'), 2),
                'total_deficit' => round($statistics->sum('total_deficit'), 2),
                'total_projects' => $statistics->sum('projects_count'),
                'categories_count' => $categories->count(),
            ];

            return [
                'categories' => $statistics,
                'grand_total' => $grandTotal,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data
        ], 200);
    }

    /**
     * مسح cache لأقسام الوافر والمشاريع
     */
    private function clearSurplusCategoriesCache(): void
    {
        try {
            // ✅ محاولة مسح cache keys المحددة
            if (method_exists(Cache::getStore(), 'tags')) {
                // ✅ إذا كان cache driver يدعم tags (Redis/Memcached)
                Cache::tags(['surplus_categories', 'surplus_statistics', 'surplus_dashboard', 'projects'])->flush();
            } else {
                // ✅ في حالة عدم دعم tags، نمسح cache keys يدوياً
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    // Redis - مسح keys محددة
                    $redis = $cacheDriver->getRedis();
                    $patterns = ['surplus_categories_*', '*surplus_statistics*', '*surplus_dashboard*'];
                    foreach ($patterns as $pattern) {
                        $keys = $redis->keys($pattern);
                        if (!empty($keys)) {
                            $redis->del($keys);
                        }
                    }
                } else {
                    // ✅ Fallback: مسح جميع cache (في حالة file cache)
                    // يمكن تحسينه لاحقاً بمسح keys محددة
                    Cache::flush();
                }
            }
        } catch (\Exception $e) {
            // ✅ في حالة فشل مسح cache، نستمر بدون خطأ
            \Log::warning('Failed to clear surplus categories cache', [
                'error' => $e->getMessage()
            ]);
        }
    }
}

