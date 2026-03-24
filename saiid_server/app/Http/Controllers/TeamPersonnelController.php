<?php

namespace App\Http\Controllers;

use App\Models\TeamPersonnel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class TeamPersonnelController extends Controller
{
    /**
     * Get all researchers
     * ✅ جلب البيانات مباشرة من قاعدة البيانات (بدون cache عند وجود _t)
     */
    public function getResearchers(Request $request)
    {
        try {
            // ✅ دعم cache busting parameter من Frontend
            $useCache = !$request->has('_t');
            
            if ($useCache) {
                $cacheKey = 'researchers_' . ($request->user()?->id ?? 'guest');
                $cached = Cache::get($cacheKey);
                
                if ($cached !== null) {
                    return response()->json($cached, 200);
                }
            }
            
            // ✅ جلب مباشر من قاعدة البيانات
            $researchers = TeamPersonnel::researchers()
                                        ->active()
                                        ->orderBy('name')
                                        ->get();
            
            $response = [
                'success' => true,
                'researchers' => $researchers,
                'count' => $researchers->count()
            ];
            
            if ($useCache) {
                Cache::put($cacheKey, $response, 300);
            }
            
            return response()->json($response, 200)
                ->header('Cache-Control', $useCache ? 'private, max-age=300' : 'no-cache, must-revalidate');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الباحثين',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all photographers
     * ✅ جلب البيانات مباشرة من قاعدة البيانات (بدون cache عند وجود _t)
     */
    public function getPhotographers(Request $request)
    {
        try {
            // ✅ دعم cache busting parameter من Frontend
            $useCache = !$request->has('_t');
            
            if ($useCache) {
                $cacheKey = 'photographers_' . ($request->user()?->id ?? 'guest');
                $cached = Cache::get($cacheKey);
                
                if ($cached !== null) {
                    return response()->json($cached, 200);
                }
            }
            
            // ✅ جلب مباشر من قاعدة البيانات
            $photographers = TeamPersonnel::photographers()
                                         ->active()
                                         ->orderBy('name')
                                         ->get();
            
            $response = [
                'success' => true,
                'photographers' => $photographers,
                'count' => $photographers->count()
            ];
            
            if ($useCache) {
                Cache::put($cacheKey, $response, 300);
            }
            
            return response()->json($response, 200)
                ->header('Cache-Control', $useCache ? 'private, max-age=300' : 'no-cache, must-revalidate');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب المصورين',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add new researcher
     */
    public function addResearcher(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:3',
            'phone_number' => 'required|string|regex:/^05\d{8}$/|unique:team_personnel,phone_number',
            'department' => 'nullable|string',
        ], [
            'name.required' => 'يرجى إدخال الاسم',
            'phone_number.required' => 'يرجى إدخال رقم الجوال',
            'phone_number.regex' => 'رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام',
            'phone_number.unique' => 'رقم الجوال موجود مسبقاً',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            DB::beginTransaction();

        try {
            $researcher = TeamPersonnel::create([
                'name' => $request->name,
                'phone_number' => $request->phone_number,
                'personnel_type' => 'باحث',
                'department' => $request->department ?? 'مشاريع',
                'is_active' => true,
            ]);
                
                // ✅ إبطال cache بعد الإنشاء
                $this->clearPersonnelCache();
                
                DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'تم إضافة الباحث بنجاح',
                    'researcher' => $researcher->fresh() // ✅ إرجاع السجل الكامل المحدث
                ], 201)
                    ->header('Cache-Control', 'no-cache, must-revalidate')
                    ->header('Content-Type', 'application/json');
                
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إضافة الباحث',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add new photographer
     */
    public function addPhotographer(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:3',
            'phone_number' => 'required|string|regex:/^05\d{8}$/|unique:team_personnel,phone_number',
            'department' => 'nullable|string',
        ], [
            'name.required' => 'يرجى إدخال الاسم',
            'phone_number.required' => 'يرجى إدخال رقم الجوال',
            'phone_number.regex' => 'رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام',
            'phone_number.unique' => 'رقم الجوال موجود مسبقاً',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            DB::beginTransaction();

        try {
            $photographer = TeamPersonnel::create([
                'name' => $request->name,
                'phone_number' => $request->phone_number,
                'personnel_type' => 'مصور',
                'department' => $request->department ?? 'إعلام',
                'is_active' => true,
            ]);
                
                // ✅ إبطال cache بعد الإنشاء
                $this->clearPersonnelCache();
                
                DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'تم إضافة المصور بنجاح',
                    'photographer' => $photographer->fresh() // ✅ إرجاع السجل الكامل المحدث
                ], 201)
                    ->header('Cache-Control', 'no-cache, must-revalidate')
                    ->header('Content-Type', 'application/json');
                
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إضافة المصور',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all available personnel (researchers and photographers)
     * ✅ جلب البيانات مباشرة من قاعدة البيانات (بدون cache عند وجود _t)
     */
    public function getAvailablePersonnel(Request $request)
    {
        try {
            // ✅ دعم cache busting parameter من Frontend
            $useCache = !$request->has('_t');
            
            if ($useCache) {
                $cacheKey = 'available_personnel_' . ($request->user()?->id ?? 'guest');
                $cached = Cache::get($cacheKey);
                
                if ($cached !== null) {
                    return response()->json($cached, 200);
                }
            }
            
            // ✅ جلب مباشر من قاعدة البيانات
            $researchers = TeamPersonnel::researchers()
                                        ->active()
                                        ->orderBy('name')
                                        ->get();
            
            $photographers = TeamPersonnel::photographers()
                                          ->active()
                                          ->orderBy('name')
                                          ->get();
            
            $response = [
                'success' => true,
                'researchers' => $researchers,
                'photographers' => $photographers,
                'researchers_count' => $researchers->count(),
                'photographers_count' => $photographers->count()
            ];
            
            if ($useCache) {
                Cache::put($cacheKey, $response, 300);
            }
            
            return response()->json($response, 200)
                ->header('Cache-Control', $useCache ? 'private, max-age=300' : 'no-cache, must-revalidate');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب العاملين',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update personnel
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|min:3',
            'phone_number' => 'sometimes|string|regex:/^05\d{8}$/|unique:team_personnel,phone_number,' . $id,
            'department' => 'sometimes|nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            DB::beginTransaction();

        try {
            $personnel = TeamPersonnel::findOrFail($id);
            $personnel->update($request->all());
                
                // ✅ إعادة تحميل السجل من قاعدة البيانات
                $personnel->refresh();
                
                // ✅ إبطال cache بعد التحديث
                $this->clearPersonnelCache();
                
                DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث البيانات بنجاح',
                    'personnel' => $personnel // ✅ إرجاع السجل الكامل المحدث
                ], 200)
                    ->header('Cache-Control', 'no-cache, must-revalidate')
                    ->header('Content-Type', 'application/json');
                
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث البيانات',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete personnel
     */
    public function destroy($id)
    {
        try {
            $personnel = TeamPersonnel::findOrFail($id);
            
            // التحقق من أن العامل غير مرتبط بأي فريق
            if ($personnel->teams()->count() > 0) {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن حذف العامل',
                    'message' => 'العامل مرتبط بفريق أو أكثر'
                ], 422);
            }
            
            $personnel->delete();
            
            // ✅ إبطال cache بعد الحذف
            $this->clearPersonnelCache();
            
            return response()->json([
                'success' => true,
                'message' => 'تم حذف العامل بنجاح'
            ], 200)
                ->header('Cache-Control', 'no-cache, must-revalidate')
                ->header('Content-Type', 'application/json');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل حذف العامل',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * إبطال cache العاملين
     */
    private function clearPersonnelCache(): void
    {
        try {
            // إبطال جميع cache keys المتعلقة بالعاملين
            $patterns = ['researchers_', 'photographers_', 'available_personnel_'];
            
            foreach ($patterns as $pattern) {
                // محاولة استخدام cache tags إذا كان متاحاً
                if (method_exists(Cache::getStore(), 'tags')) {
                    try {
                        Cache::tags(['team_personnel'])->flush();
                        break; // إذا نجح، لا حاجة للاستمرار
                    } catch (\Exception $e) {
                        // إذا لم تكن tags متاحة، استخدم الطريقة البديلة
                    }
                }
            }
            
            // إبطال cache يدوياً (لـ file cache)
            Cache::flush(); // ملاحظة: هذا يمسح كل cache، يمكن تحسينه لاحقاً
            
        } catch (\Exception $e) {
            \Log::warning('فشل إبطال cache العاملين', [
                'error' => $e->getMessage()
            ]);
        }
    }
}
