<?php

namespace App\Http\Controllers;

use App\Models\ProjectType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class ProjectTypeController extends Controller
{
    /**
     * Get all project types
     * GET /api/project-types
     */
    public function index(Request $request)
    {
        try {
            // ✅ استخدام Cache لتحسين الأداء (30 دقيقة)
            $cacheKey = 'project_types_list';
            $types = Cache::remember($cacheKey, 1800, function () {
                try {
                    return ProjectType::select('id', 'name', 'created_at', 'updated_at')
                        ->orderBy('name')
                        ->get();
                } catch (\Exception $e) {
                    Log::error('Error fetching project types from database', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);
                    // ✅ إرجاع أنواع افتراضية عند فشل جلب البيانات
                    return $this->getDefaultProjectTypes();
                }
            });

            // ✅ إذا طلب المستخدم تحديث البيانات (bypass cache)
            if ($request->has('refresh') && $request->boolean('refresh')) {
                Cache::forget($cacheKey);
                try {
                    $types = ProjectType::select('id', 'name', 'created_at', 'updated_at')
                        ->orderBy('name')
                        ->get();
                } catch (\Exception $e) {
                    Log::error('Error fetching project types after refresh', [
                        'error' => $e->getMessage()
                    ]);
                    // ✅ إرجاع أنواع افتراضية عند فشل جلب البيانات
                    $types = $this->getDefaultProjectTypes();
                }
            }

            // ✅ التحقق من أن $types ليست فارغة
            if ($types->isEmpty()) {
                Log::warning('Project types list is empty, using default types');
                $types = $this->getDefaultProjectTypes();
            }

            return response()->json([
                'success' => true,
                'data' => $types,
                'count' => $types->count(),
                'is_default' => $types->first() && $types->first()->id === null // ✅ إشارة أن هذه أنواع افتراضية
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching project types', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // ✅ إرجاع أنواع افتراضية عند فشل التحميل
            $defaultTypes = $this->getDefaultProjectTypes();
            
            return response()->json([
                'success' => true, // ✅ نجاح مع أنواع افتراضية
                'data' => $defaultTypes,
                'count' => $defaultTypes->count(),
                'is_default' => true, // ✅ إشارة أن هذه أنواع افتراضية
                'warning' => 'فشل تحميل أنواع المشاريع - استخدام الأنواع الافتراضية',
                'error_message' => config('app.debug') ? $e->getMessage() : null
            ], 200); // ✅ إرجاع 200 بدلاً من 500 لأننا نرجع بيانات صالحة
        }
    }

    /**
     * الحصول على أنواع المشاريع الافتراضية
     * يتم استخدامها عند فشل جلب البيانات من قاعدة البيانات
     */
    private function getDefaultProjectTypes()
    {
        // ✅ أنواع المشاريع الافتراضية - متوافقة مع مسميات قاعدة البيانات (adj style)
        $defaultTypes = collect([
            ['id' => null, 'name' => 'إغاثي', 'created_at' => null, 'updated_at' => null],
            ['id' => null, 'name' => 'تعليمي', 'created_at' => null, 'updated_at' => null],
            ['id' => null, 'name' => 'طبي', 'created_at' => null, 'updated_at' => null],
            ['id' => null, 'name' => 'إنشائي', 'created_at' => null, 'updated_at' => null],
            ['id' => null, 'name' => 'اجتماعي', 'created_at' => null, 'updated_at' => null],
            ['id' => null, 'name' => 'الكفالات', 'created_at' => null, 'updated_at' => null],
            ['id' => null, 'name' => 'موسمي', 'created_at' => null, 'updated_at' => null],
        ]);

        // ✅ تحويل إلى Collection من Models (للتوافق مع الاستجابة العادية)
        return $defaultTypes->map(function ($type) {
            $projectType = new ProjectType();
            $projectType->id = $type['id'];
            $projectType->name = $type['name'];
            $projectType->created_at = $type['created_at'];
            $projectType->updated_at = $type['updated_at'];
            return $projectType;
        });
    }

    /**
     * Get single project type
     * GET /api/project-types/{id}
     */
    public function show($id)
    {
        try {
            $type = ProjectType::findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $type
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'نوع المشروع غير موجود'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error fetching project type: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب نوع المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create new project type (Admin only)
     * POST /api/project-types
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:2|max:255|unique:project_types,name',
        ], [
            'name.required' => 'اسم نوع المشروع مطلوب',
            'name.min' => 'اسم نوع المشروع يجب أن يكون حرفين على الأقل',
            'name.unique' => 'اسم نوع المشروع موجود بالفعل',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'خطأ في التحقق من البيانات',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $type = ProjectType::create([
                'name' => $request->name,
            ]);

            // ✅ مسح Cache بعد الإنشاء
            Cache::forget('project_types_list');

            return response()->json([
                'success' => true,
                'message' => 'تم إنشاء نوع المشروع بنجاح',
                'data' => $type
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error creating project type', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'فشل إنشاء نوع المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update project type (Admin only)
     * PATCH /api/project-types/{id}
     */
    public function update(Request $request, $id)
    {
        try {
            $type = ProjectType::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|min:2|max:255|unique:project_types,name,' . $id,
            ], [
                'name.required' => 'اسم نوع المشروع مطلوب',
                'name.min' => 'اسم نوع المشروع يجب أن يكون حرفين على الأقل',
                'name.unique' => 'اسم نوع المشروع موجود بالفعل',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'error' => 'خطأ في التحقق من البيانات',
                    'errors' => $validator->errors()
                ], 422);
            }

            $oldName = $type->name;
            $type->name = $request->name;
            $type->save();

            // تحديث المشاريع المرتبطة إذا تغير الاسم
            if ($oldName !== $request->name) {
                // تحديث project_type في project_proposals (إذا كان موجوداً)
                DB::table('project_proposals')
                    ->where('project_type', $oldName)
                    ->update(['project_type' => $request->name]);
                
                // تحديث project_type في project_subcategories
                DB::table('project_subcategories')
                    ->where('project_type', $oldName)
                    ->update(['project_type' => $request->name]);
                
                // ✅ مسح cache للمشاريع والتفريعات بعد تحديث نوع المشروع
                // لأن DB::table()->update() لا يطلق Model Events
                $this->clearProjectsCache();
                $this->clearSubcategoriesCache();
            }

            // ✅ مسح Cache بعد التحديث
            Cache::forget('project_types_list');

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث نوع المشروع بنجاح',
                'data' => $type
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'نوع المشروع غير موجود'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error updating project type: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث نوع المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete project type (Admin only)
     * DELETE /api/project-types/{id}
     */
    public function destroy($id)
    {
        try {
            $type = ProjectType::findOrFail($id);

            // التحقق من وجود مشاريع مرتبطة
            $projectsCount = $type->projects()->count();
            
            if ($projectsCount > 0) {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن حذف نوع المشروع',
                    'message' => "يوجد {$projectsCount} مشروع مرتبط بهذا النوع. يرجى نقل المشاريع إلى نوع آخر أولاً."
                ], 422);
            }

            $type->delete();

            // ✅ مسح Cache بعد الحذف
            Cache::forget('project_types_list');

            return response()->json([
                'success' => true,
                'message' => 'تم حذف نوع المشروع بنجاح'
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => 'نوع المشروع غير موجود'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error deleting project type: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'فشل حذف نوع المشروع',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * مسح cache للمشاريع
     * يتم استدعاؤها عند تحديث نوع المشروع الذي يؤثر على المشاريع
     */
    private function clearProjectsCache(): void
    {
        try {
            // ✅ استخدام Cache tags إذا كان متاحاً (Redis/Memcached)
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['projects'])->flush();
            } else {
                // ✅ في حالة عدم دعم tags، نمسح فقط cache keys التي تبدأ بـ 'projects_'
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    // Redis - مسح keys محددة
                    $redis = $cacheDriver->getRedis();
                    $keys = $redis->keys('*projects_*');
                    if (!empty($keys)) {
                        $redis->del($keys);
                    }
                } else {
                    // Fallback: مسح جميع cache (للملفات/قاعدة البيانات)
                    Cache::flush();
                }
            }
        } catch (\Exception $e) {
            // ✅ في حالة فشل مسح cache، نستمر بدون خطأ
            Log::warning('Failed to clear projects cache from ProjectTypeController', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * مسح cache للتفريعات
     */
    private function clearSubcategoriesCache(): void
    {
        try {
            // ✅ استخدام Cache tags إذا كان متاحاً (Redis/Memcached)
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['subcategories'])->flush();
            } else {
                // ✅ في حالة عدم دعم tags، نمسح cache keys المتعلقة
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    // Redis - مسح keys محددة
                    $redis = $cacheDriver->getRedis();
                    $keys = $redis->keys('*subcategories*');
                    if (!empty($keys)) {
                        $redis->del($keys);
                    }
                } else {
                    // Fallback: مسح جميع cache
                    Cache::flush();
                }
            }
        } catch (\Exception $e) {
            // ✅ في حالة فشل مسح cache، نستمر بدون خطأ
            Log::warning('Failed to clear subcategories cache from ProjectTypeController', [
                'error' => $e->getMessage()
            ]);
        }
    }
}

