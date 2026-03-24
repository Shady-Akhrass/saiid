<?php

namespace App\Http\Controllers;

use App\Models\ProjectSubcategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class ProjectSubcategoryController extends Controller
{
    /**
     * Get all subcategories
     * GET /api/project-subcategories
     */
    public function index(Request $request)
    {
        try {
            // ✅ دعم cache busting parameter من Frontend
            $useCache = !$request->has('_t');
            
            // ✅ بناء cache key بناءً على المعايير
            $cacheKey = 'subcategories_' . md5(json_encode([
                'project_type' => $request->input('project_type'),
                'is_active' => $request->input('is_active'),
            ]));
            
            // ✅ محاولة جلب البيانات من cache (30 ثانية) - فقط إذا لم يكن هناك _t
            if ($useCache) {
                $cachedData = Cache::get($cacheKey);
                if ($cachedData !== null) {
                    return response()->json([
                        'success' => true,
                        'data' => $cachedData
                    ], 200)
                    ->header('Cache-Control', 'public, max-age=30')
                    ->header('X-Cache', 'HIT');
                }
            }
            
            $query = ProjectSubcategory::query();

            // Filter by project type if provided
            if ($request->has('project_type')) {
                $query->byProjectType($request->project_type);
            }

            // Filter by active status if provided
            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            } else {
                // Default: show active only
                $query->active();
            }

            $subcategories = $query->orderBy('project_type')
                ->orderBy('name_ar')
                ->get();

            // ✅ إضافة الإحصائيات فقط إذا طُلب ذلك (افتراضياً: نعم لتوافق مع الكود القديم)
            // يمكن تعطيلها بإرسال include_statistics=false لتحسين الأداء
            $includeStatistics = $request->boolean('include_statistics', true);
            
            if ($includeStatistics) {
                // Add statistics to each subcategory with error handling
                $subcategories->transform(function ($subcategory) {
                    try {
                        $subcategory->statistics = $subcategory->getStatistics();
                    } catch (\Exception $e) {
                        // في حالة خطأ، نضع إحصائيات افتراضية
                        Log::warning('Failed to get statistics for subcategory', [
                            'subcategory_id' => $subcategory->id,
                            'error' => $e->getMessage()
                        ]);
                        $subcategory->statistics = [
                            'total_projects' => 0,
                            'total_amount' => 0,
                            'total_beneficiaries' => 0,
                        ];
                    }
                    return $subcategory;
                });
            }

            // ✅ حفظ في cache لمدة 30 ثانية
            if ($useCache) {
                Cache::put($cacheKey, $subcategories, 30);
            }

            return response()->json([
                'success' => true,
                'data' => $subcategories
            ], 200)
            ->header('Cache-Control', 'public, max-age=30')
            ->header('X-Cache', 'MISS');
        } catch (\Exception $e) {
            Log::error('Error fetching subcategories: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب التفريعات',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get subcategories by project type
     * GET /api/project-subcategories/by-type/{type}
     * 
     * @param string|int $type - يمكن أن يكون ID أو اسم النوع
     */
    public function getByProjectType($type)
    {
        try {
            // ✅ دعم cache busting parameter من Frontend
            $request = request();
            $useCache = !$request->has('_t');
            
            // ✅ التحقق من أن النوع ليس [object Object] (خطأ شائع من Frontend)
            if ($type === '[object Object]' || $type === '[object%20Object]' || str_contains($type, 'object Object')) {
                Log::warning('Invalid project type parameter received', [
                    'type' => $type,
                    'url' => $request->fullUrl(),
                    'referer' => $request->header('Referer'),
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'نوع المشروع غير صحيح',
                    'message' => 'يبدو أن كائن JavaScript تم إرساله بدلاً من معرف أو اسم نوع المشروع. يرجى التأكد من إرسال project_type.id أو project_type.name',
                    'hint' => 'تأكد من استخدام projectType.id أو projectType.name في URL'
                ], 400);
            }
            
            // ✅ بناء cache key
            $cacheKey = 'subcategories_by_type_' . md5($type);
            
            // ✅ محاولة جلب البيانات من cache (30 ثانية) - فقط إذا لم يكن هناك _t
            if ($useCache) {
                $cachedData = Cache::get($cacheKey);
                if ($cachedData !== null) {
                    return response()->json([
                        'success' => true,
                        'data' => $cachedData
                    ], 200)
                    ->header('Cache-Control', 'public, max-age=30')
                    ->header('X-Cache', 'HIT');
                }
            }
            
            // محاولة جلب النوع (ID أو اسم)
            $projectType = null;
            if (is_numeric($type)) {
                $projectType = \App\Models\ProjectType::find($type);
            } else {
                $projectType = \App\Models\ProjectType::where('name', $type)->first();
            }
            
            if (!$projectType) {
                Log::warning('Project type not found', [
                    'type' => $type,
                    'is_numeric' => is_numeric($type),
                    'url' => $request->fullUrl(),
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'نوع المشروع غير موجود',
                    'message' => "نوع المشروع '{$type}' غير موجود في قاعدة البيانات"
                ], 404);
            }

            $subcategories = ProjectSubcategory::byProjectType($projectType->name)
                ->active()
                ->orderBy('name_ar')
                ->get(['id', 'name_ar', 'name', 'project_type']);

            // ✅ حفظ في cache لمدة 30 ثانية
            if ($useCache) {
                Cache::put($cacheKey, $subcategories, 30);
            }

            return response()->json([
                'success' => true,
                'data' => $subcategories
            ], 200)
            ->header('Cache-Control', 'public, max-age=30')
            ->header('X-Cache', 'MISS');
        } catch (\Exception $e) {
            Log::error('Error fetching subcategories by type: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب التفريعات',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get single subcategory
     * GET /api/project-subcategories/{id}
     */
    public function show($id)
    {
        try {
            // ✅ تحميل التفرعية مع المشاريع المرتبطة
            $subcategory = ProjectSubcategory::with([
                'projects' => function($q) {
                    $q->select([
                        'id', 'serial_number', 'project_name', 'project_description',
                        'donor_name', 'donor_code', 'project_type', 'status',
                        'net_amount', 'amount_in_usd', 'currency_id',
                        'subcategory_id', 'created_at', 'updated_at'
                    ])->with([
                        'currency:id,currency_code,currency_name_ar'
                    ])->orderBy('created_at', 'DESC');
                },
                'projectType:id,name' // ✅ تحميل نوع المشروع
            ])->findOrFail($id);
            
            $subcategory->statistics = $subcategory->getStatistics();

            return response()->json([
                'success' => true,
                'data' => $subcategory
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'التفرعية غير موجودة'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error fetching subcategory: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب التفرعية',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get subcategory statistics
     * GET /api/project-subcategories/{id}/statistics
     */
    public function getStatistics($id)
    {
        try {
            $subcategory = ProjectSubcategory::findOrFail($id);
            $statistics = $subcategory->getStatistics();
            $projectsByStatus = $subcategory->getProjectsByStatus();

            return response()->json([
                'success' => true,
                'data' => [
                    'subcategory' => [
                        'id' => $subcategory->id,
                        'name_ar' => $subcategory->name_ar,
                        'name' => $subcategory->name,
                        'project_type' => $subcategory->project_type,
                    ],
                    'statistics' => array_merge($statistics, [
                        'projects_by_status' => $projectsByStatus
                    ])
                ]
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'التفرعية غير موجودة'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error fetching subcategory statistics: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب إحصائيات التفرعية',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create new subcategory (Admin only)
     * POST /api/project-subcategories
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name_ar' => 'required|string|max:255',
            'name' => 'nullable|string|max:255',
            'project_type' => 'required|exists:project_types,name', // ✅ التحقق من وجود النوع في جدول project_types
            'description' => 'nullable|string',
        ], [
            'name_ar.required' => 'اسم التفرعية بالعربية مطلوب',
            'project_type.required' => 'نوع المشروع مطلوب',
            'project_type.exists' => 'نوع المشروع المحدد غير موجود في قاعدة البيانات',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $subcategory = ProjectSubcategory::create([
                'name_ar' => $request->name_ar,
                'name' => $request->name ?? $request->name_ar,
                'project_type' => $request->project_type,
                'description' => $request->description,
                'is_active' => true,
            ]);

            // ✅ مسح cache للتفريعات والمشاريع بعد الإنشاء
            $this->clearSubcategoriesCache();

            return response()->json([
                'success' => true,
                'message' => 'تم إنشاء التفرعية بنجاح',
                'data' => $subcategory
            ], 201)
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
        } catch (\Exception $e) {
            Log::error('Error creating subcategory: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل إنشاء التفرعية',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update subcategory (Admin only)
     * PATCH /api/project-subcategories/{id}
     */
    public function update(Request $request, $id)
    {
        try {
            $subcategory = ProjectSubcategory::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'name_ar' => 'sometimes|required|string|max:255',
                'name' => 'nullable|string|max:255',
                'project_type' => 'sometimes|required|exists:project_types,name', // ✅ التحقق من وجود النوع في جدول project_types
                'description' => 'nullable|string',
            ], [
                'name_ar.required' => 'اسم التفرعية بالعربية مطلوب',
                'project_type.exists' => 'نوع المشروع المحدد غير موجود في قاعدة البيانات',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'error' => 'خطأ في التحقق من البيانات',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Update fields
            if ($request->has('name_ar')) {
                $subcategory->name_ar = $request->name_ar;
            }
            if ($request->has('name')) {
                $subcategory->name = $request->name;
            }
            if ($request->has('project_type')) {
                $subcategory->project_type = $request->project_type;
            }
            if ($request->has('description')) {
                $subcategory->description = $request->description;
            }

            $subcategory->save();

            // ✅ مسح cache للتفريعات والمشاريع بعد التحديث
            $this->clearSubcategoriesCache();

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث التفرعية بنجاح',
                'data' => $subcategory
            ], 200)
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'التفرعية غير موجودة'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error updating subcategory: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث التفرعية',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete subcategory (Admin only)
     * DELETE /api/project-subcategories/{id}
     */
    public function destroy($id)
    {
        try {
            $subcategory = ProjectSubcategory::findOrFail($id);

            // Check if there are projects using this subcategory
            $projectsCount = $subcategory->projects()->count();
            
            if ($projectsCount > 0) {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن حذف التفرعية',
                    'message' => "يوجد {$projectsCount} مشروع مرتبط بهذه التفرعية. يرجى نقل المشاريع إلى تفرعية أخرى أولاً."
                ], 422);
            }

            $subcategory->delete();

            // ✅ مسح cache للتفريعات والمشاريع بعد الحذف
            $this->clearSubcategoriesCache();

            return response()->json([
                'success' => true,
                'message' => 'تم حذف التفرعية بنجاح'
            ], 200)
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'التفرعية غير موجودة'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error deleting subcategory: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل حذف التفرعية',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle subcategory status (Admin only)
     * PATCH /api/project-subcategories/{id}/toggle-status
     */
    public function toggleStatus($id)
    {
        try {
            $subcategory = ProjectSubcategory::findOrFail($id);
            $subcategory->is_active = !$subcategory->is_active;
            $subcategory->save();

            // ✅ مسح cache للتفريعات والمشاريع بعد تغيير الحالة
            $this->clearSubcategoriesCache();

            return response()->json([
                'success' => true,
                'message' => $subcategory->is_active ? 'تم تفعيل التفرعية' : 'تم تعطيل التفرعية',
                'data' => $subcategory
            ], 200)
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'التفرعية غير موجودة'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error toggling subcategory status: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث حالة التفرعية',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * مسح cache للتفريعات والمشاريع
     */
    private function clearSubcategoriesCache(): void
    {
        try {
            // ✅ استخدام Cache tags إذا كان متاحاً (Redis/Memcached)
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['subcategories', 'projects'])->flush();
            } else {
                // ✅ في حالة عدم دعم tags، نمسح cache keys المتعلقة
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    // Redis - مسح keys محددة
                    $redis = $cacheDriver->getRedis();
                    $patterns = ['*subcategories*', '*projects_*'];
                    foreach ($patterns as $pattern) {
                        $keys = $redis->keys($pattern);
                        if (!empty($keys)) {
                            $redis->del($keys);
                        }
                    }
                } else {
                    // Fallback: مسح جميع cache
                    Cache::flush();
                }
            }
        } catch (\Exception $e) {
            // ✅ في حالة فشل مسح cache، نستمر بدون خطأ
            Log::warning('Failed to clear subcategories cache', [
                'error' => $e->getMessage()
            ]);
        }
    }
}

