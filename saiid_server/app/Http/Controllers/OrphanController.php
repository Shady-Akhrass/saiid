<?php

namespace App\Http\Controllers;

use App\Models\Orphan;
use App\Models\Visitor;
use App\Models\FormAvailability;
use App\Traits\CacheableResponse;
use Illuminate\Http\Request;
use App\Exports\OrphansExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;

class OrphanController extends Controller
{
    use CacheableResponse;

    /**
     * Check if orphan form is available
     */
    private function checkFormAvailability()
    {
        $formAvailability = FormAvailability::where('type', 'orphan')->first();
        
        if (!$formAvailability) {
            $formAvailability = FormAvailability::create([
                'type' => 'orphan',
                'is_available' => true,
                'notes' => 'Default availability'
            ]);
        }
        
        return $formAvailability->is_available;
    }

    /**
     * Create new orphan with form availability check
     */
    public function create(Request $request)
    {
        if (!$this->checkFormAvailability()) {
            return response()->json([
                'error' => 'نموذج تسجيل الأيتام غير متاح حالياً',
                'message' => 'The orphan registration form is currently unavailable'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'orphan_id_number' => 'required|string|min:9|unique:orphans,orphan_id_number',
            'orphan_full_name' => 'required|string|min:3',
            'orphan_birth_date' => [
                'required',
                'date',
                function ($attribute, $value, $fail) {
                    $birthDate = \Carbon\Carbon::parse($value);
                    $twelveYearsAgo = \Carbon\Carbon::now()->subYears(12);
                    if ($birthDate->lt($twelveYearsAgo)) {
                        $fail('يجب أن يكون عمر اليتيم أقل من 12 عامًا.');
                    }
                },
            ],
            'orphan_gender' => 'required|in:ذكر,أنثى',
            'health_status' => 'required|in:جيدة,مريض',
            'disease_description' => 'nullable|string',
            'original_address' => 'required|in:محافظة الشمال,محافظة غزة,محافظة الوسطى,محافظة خانيونس,محافظة رفح',
            'current_address' => 'required|in:محافظة الشمال,محافظة غزة,محافظة الوسطى,محافظة خانيونس,محافظة رفح',
            'address_details' => 'nullable|string',
            'number_of_brothers' => 'nullable|integer|min:0',
            'number_of_sisters' => 'nullable|integer|min:0',
            'is_enrolled_in_memorization_center' => 'required|in:نعم,لا',
            'orphan_photo' => 'required|file|image|max:2048',
            'guardian_id_number' => 'required|string|min:9',
            'guardian_full_name' => 'required|string|min:3',
            'guardian_relationship' => 'required|string|min:2',
            'guardian_phone_number' => ['required', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
            'alternative_phone_number' => ['nullable', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
            'deceased_father_full_name' => 'required|string|min:3',
            'deceased_father_birth_date' => 'required|date',
            'death_date' => 'required|date',
            'death_cause' => 'required|in:شهيد حرب,وفاة طبيعية,وفاة بسبب المرض',
            'previous_father_job' => 'nullable|string',
            'death_certificate' => 'required|file|image|max:2048',
            'mother_full_name' => 'required|string|min:3',
            'mother_id_number' => 'required|string|min:9',
            'is_mother_deceased' => 'required|in:نعم,لا',
            'mother_birth_date' => 'required|date',
            'mother_death_date' => 'nullable|date',
            'mother_death_certificate' => 'nullable|file|image|max:2048',
            'mother_status' => 'required|in:أرملة,متزوجة',
            'mother_job' => 'required|string|min:3',
            'data_approval_name' => 'required|string|min:3',
        ], [
            'required' => 'حقل :attribute مطلوب.',
            'string' => 'حقل :attribute يجب أن يكون نصاً.',
            'min' => [
                'string' => 'حقل :attribute يجب أن يحتوي على الأقل :min أحرف.',
                'numeric' => 'حقل :attribute يجب أن يكون على الأقل :min.',
            ],
            'unique' => 'قيمة :attribute مستخدمة بالفعل.',
            'date' => 'حقل :attribute يجب أن يكون تاريخاً صحيحاً.',
            'in' => 'القيمة المحددة في حقل :attribute غير صالحة.',
            'integer' => 'حقل :attribute يجب أن يكون رقماً صحيحاً.',
            'file' => 'حقل :attribute يجب أن يكون ملفاً.',
            'image' => 'حقل :attribute يجب أن يكون صورة.',
            'max' => [
                'file' => 'حجم :attribute يجب ألا يتجاوز :max كيلوبايت.',
            ],
            'regex' => 'صيغة حقل :attribute غير صحيحة.',
            'orphan_birth_date' => 'يجب أن يكون عمر اليتيم أقل من 12 عامًا.',
        ])->setAttributeNames([
            'orphan_id_number' => 'رقم هوية اليتيم',
            'orphan_full_name' => 'الاسم الكامل لليتيم',
            'orphan_birth_date' => 'تاريخ ميلاد اليتيم',
            'orphan_gender' => 'جنس اليتيم',
            'health_status' => 'الحالة الصحية',
            'disease_description' => 'وصف المرض',
            'original_address' => 'العنوان الأصلي',
            'current_address' => 'العنوان الحالي',
            'address_details' => 'تفاصيل العنوان',
            'number_of_brothers' => 'عدد الإخوة',
            'number_of_sisters' => 'عدد الأخوات',
            'is_enrolled_in_memorization_center' => 'ملتحق بمركز تحفيظ',
            'orphan_photo' => 'صورة اليتيم',
            'guardian_id_number' => 'رقم هوية الوصي',
            'guardian_full_name' => 'الاسم الكامل للوصي',
            'guardian_relationship' => 'صلة القرابة بالوصي',
            'guardian_phone_number' => 'رقم هاتف الوصي',
            'alternative_phone_number' => 'رقم الهاتف البديل',
            'deceased_father_full_name' => 'الاسم الكامل للأب المتوفى',
            'deceased_father_birth_date' => 'تاريخ ميلاد الأب المتوفى',
            'death_date' => 'تاريخ الوفاة',
            'death_cause' => 'سبب الوفاة',
            'previous_father_job' => 'وظيفة الأب السابقة',
            'death_certificate' => 'شهادة الوفاة',
            'mother_full_name' => 'الاسم الكامل للأم',
            'mother_id_number' => 'رقم هوية الأم',
            'is_mother_deceased' => 'هل الأم متوفاة',
            'mother_birth_date' => 'تاريخ ميلاد الأم',
            'mother_death_date' => 'تاريخ وفاة الأم',
            'mother_death_certificate' => 'شهادة وفاة الأم',
            'mother_status' => 'حالة الأم',
            'mother_job' => 'وظيفة الأم',
            'data_approval_name' => 'اسم معتمد البيانات',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $orphanData = $request->all();
        
        // Handle orphan photo
        if ($request->hasFile('orphan_photo')) {
            $fileName = time() . '.' . $request->file('orphan_photo')->extension();
            $request->file('orphan_photo')->move(public_path('orphan_photos'), $fileName);
            $orphanData['orphan_photo'] = 'orphan_photos/' . $fileName;
        }

        // Handle father death certificate
        if ($request->hasFile('death_certificate')) {
            $fileName = time() . '1.' . $request->file('death_certificate')->extension();
            $request->file('death_certificate')->move(public_path('death_certificates'), $fileName);
            $orphanData['death_certificate'] = 'death_certificates/' . $fileName;
        }

        // Handle mother death certificate - only if mother is deceased
        if ($request->input('is_mother_deceased') === 'نعم' && $request->hasFile('mother_death_certificate')) {
            $fileName = time() . '2.' . $request->file('mother_death_certificate')->extension();
            $request->file('mother_death_certificate')->move(public_path('mother_death_certificates'), $fileName);
            $orphanData['mother_death_certificate'] = 'mother_death_certificates/' . $fileName;
        }

        try {
            $orphan = Orphan::create($orphanData);
            return response()->json(['orphan' => $orphan, 'message' => 'تم إنشاء سجل اليتيم بنجاح'], 201);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Internal Server Error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get orphan by ID
     */
    public function getOrphanById($id)
    {
        try {
            $orphan = Orphan::where('orphan_id_number', $id)->first();
            
            if (!$orphan) {
                return response()->json([
                    'success' => false,
                    'error' => 'اليتيم غير موجود',
                    'message' => 'Orphan not found'
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'orphan' => $orphan
            ], 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'خطأ في الخادم',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update orphan data by ID
     */
    public function update(Request $request, $id)
    {
        \Log::info('=== ORPHAN UPDATE REQUEST ===');
        \Log::info('Orphan ID: ' . $id);
        \Log::info('Request Method: ' . $request->method());
        \Log::info('Content Type: ' . $request->header('Content-Type'));
        
        \Log::info('Has orphan_photo file: ' . ($request->hasFile('orphan_photo') ? 'Yes' : 'No'));
        \Log::info('Has death_certificate file: ' . ($request->hasFile('death_certificate') ? 'Yes' : 'No'));
        \Log::info('Has mother_death_certificate file: ' . ($request->hasFile('mother_death_certificate') ? 'Yes' : 'No'));
        \Log::info('is_mother_deceased value: ' . $request->input('is_mother_deceased'));
    
        try {
            $orphan = Orphan::where('orphan_id_number', $id)->first();
            
            if (!$orphan) {
                return response()->json([
                    'success' => false,
                    'error' => 'اليتيم غير موجود',
                    'message' => 'Orphan not found'
                ], 404);
            }
    
            // Validation
            $validator = Validator::make($request->all(), [
                'orphan_id_number' => 'sometimes|string|min:9|unique:orphans,orphan_id_number,' . $id . ',orphan_id_number',
                'orphan_full_name' => 'sometimes|string|min:3',
                'orphan_birth_date' => 'sometimes|date',
                'orphan_gender' => 'sometimes|in:ذكر,أنثى',
                'health_status' => 'sometimes|in:جيدة,مريض',
                'disease_description' => 'nullable|string',
                'original_address' => 'sometimes|in:محافظة الشمال,محافظة غزة,محافظة الوسطى,محافظة خانيونس,محافظة رفح',
                'current_address' => 'sometimes|in:محافظة الشمال,محافظة غزة,محافظة الوسطى,محافظة خانيونس,محافظة رفح',
                'address_details' => 'nullable|string',
                'number_of_brothers' => 'nullable|integer|min:0',
                'number_of_sisters' => 'nullable|integer|min:0',
                'is_enrolled_in_memorization_center' => 'sometimes|in:نعم,لا',
                'guardian_id_number' => 'sometimes|string|min:9',
                'guardian_full_name' => 'sometimes|string|min:3',
                'guardian_relationship' => 'sometimes|string|min:2',
                'guardian_phone_number' => 'nullable|string',
                'alternative_phone_number' => 'nullable|string',
                'deceased_father_full_name' => 'sometimes|string|min:3',
                'deceased_father_birth_date' => 'sometimes|date',
                'death_date' => 'sometimes|date',
                'death_cause' => 'sometimes|in:شهيد حرب,وفاة طبيعية,وفاة بسبب المرض',
                'previous_father_job' => 'nullable|string',
                'orphan_photo' => 'sometimes|file|image|mimes:jpeg,png,jpg,gif|max:2048',
                'death_certificate' => 'sometimes|file|image|mimes:jpeg,png,jpg,gif|max:2048',
                'mother_full_name' => 'sometimes|string|min:3',
                'mother_id_number' => 'sometimes|string|min:9',
                'is_mother_deceased' => 'sometimes|in:نعم,لا',
                'mother_birth_date' => 'sometimes|date',
                'mother_death_date' => 'nullable|date',
                'mother_death_certificate' => 'sometimes|file|image|mimes:jpeg,png,jpg,gif|max:2048',
                'mother_status' => 'sometimes|in:أرملة,متزوجة',
                'mother_job' => 'nullable|string',
                'data_approval_name' => 'nullable|string',
            ]);
    
            if ($validator->fails()) {
                \Log::error('Validation failed:', $validator->errors()->toArray());
                return response()->json(['errors' => $validator->errors()], 400);
            }
    
            $updateData = [];
    
            // Handle orphan photo upload
            if ($request->hasFile('orphan_photo') && $request->file('orphan_photo')->isValid()) {
                try {
                    \Log::info('Processing orphan photo upload...');
                    
                    if (!empty($orphan->orphan_photo)) {
                        $oldPhotoPath = public_path($orphan->orphan_photo);
                        if (file_exists($oldPhotoPath)) {
                            unlink($oldPhotoPath);
                            \Log::info('Deleted old photo: ' . $orphan->orphan_photo);
                        }
                    }
                    
                    $file = $request->file('orphan_photo');
                    $fileName = time() . '.' . $file->extension();
                    
                    $photoDir = public_path('orphan_photos');
                    if (!file_exists($photoDir)) {
                        mkdir($photoDir, 0755, true);
                    }
                    
                    $file->move($photoDir, $fileName);
                    $newPhotoPath = 'orphan_photos/' . $fileName;
                    $updateData['orphan_photo'] = $newPhotoPath;
                    
                    \Log::info('✅ New orphan photo saved to: ' . $newPhotoPath);
                    
                } catch (\Exception $e) {
                    \Log::error('❌ Error uploading orphan photo: ' . $e->getMessage());
                    return response()->json([
                        'success' => false,
                        'error' => 'فشل رفع صورة اليتيم',
                        'message' => $e->getMessage()
                    ], 500);
                }
            }
    
            // Handle death certificate upload
            if ($request->hasFile('death_certificate') && $request->file('death_certificate')->isValid()) {
                try {
                    \Log::info('Processing death certificate upload...');
                    
                    if (!empty($orphan->death_certificate)) {
                        $oldCertPath = public_path($orphan->death_certificate);
                        if (file_exists($oldCertPath)) {
                            unlink($oldCertPath);
                            \Log::info('Deleted old certificate: ' . $orphan->death_certificate);
                        }
                    }
                    
                    $file = $request->file('death_certificate');
                    $fileName = time() . '1.' . $file->extension();
                    
                    $certDir = public_path('death_certificates');
                    if (!file_exists($certDir)) {
                        mkdir($certDir, 0755, true);
                    }
                    
                    $file->move($certDir, $fileName);
                    $newCertPath = 'death_certificates/' . $fileName;
                    $updateData['death_certificate'] = $newCertPath;
                    
                    \Log::info('✅ New death certificate saved to: ' . $newCertPath);
                    
                } catch (\Exception $e) {
                    \Log::error('❌ Error uploading death certificate: ' . $e->getMessage());
                    return response()->json([
                        'success' => false,
                        'error' => 'فشل رفع شهادة الوفاة',
                        'message' => $e->getMessage()
                    ], 500);
                }
            }

            // Handle mother death certificate upload - only if mother is deceased
            if ($request->hasFile('mother_death_certificate') && $request->file('mother_death_certificate')->isValid()) {
                $isMotherDeceased = $request->input('is_mother_deceased', $orphan->is_mother_deceased);
                
                if ($isMotherDeceased === 'نعم') {
                    try {
                        \Log::info('Processing mother death certificate upload...');
                        
                        if (!empty($orphan->mother_death_certificate)) {
                            $oldMotherCertPath = public_path($orphan->mother_death_certificate);
                            if (file_exists($oldMotherCertPath)) {
                                unlink($oldMotherCertPath);
                                \Log::info('Deleted old mother certificate: ' . $orphan->mother_death_certificate);
                            }
                        }
                        
                        $file = $request->file('mother_death_certificate');
                        $fileName = time() . '2.' . $file->extension();
                        
                        $motherCertDir = public_path('mother_death_certificates');
                        if (!file_exists($motherCertDir)) {
                            mkdir($motherCertDir, 0755, true);
                        }
                        
                        $file->move($motherCertDir, $fileName);
                        $newMotherCertPath = 'mother_death_certificates/' . $fileName;
                        $updateData['mother_death_certificate'] = $newMotherCertPath;
                        
                        \Log::info('✅ New mother death certificate saved to: ' . $newMotherCertPath);
                        
                    } catch (\Exception $e) {
                        \Log::error('❌ Error uploading mother death certificate: ' . $e->getMessage());
                        return response()->json([
                            'success' => false,
                            'error' => 'فشل رفع شهادة وفاة الأم',
                            'message' => $e->getMessage()
                        ], 500);
                    }
                } else {
                    \Log::info('Mother is not deceased, skipping certificate upload');
                }
            }

            // If mother is no longer deceased, remove the certificate
            if ($request->has('is_mother_deceased') && $request->input('is_mother_deceased') === 'لا') {
                if (!empty($orphan->mother_death_certificate)) {
                    $oldMotherCertPath = public_path($orphan->mother_death_certificate);
                    if (file_exists($oldMotherCertPath)) {
                        unlink($oldMotherCertPath);
                        \Log::info('Deleted mother certificate as mother is no longer deceased');
                    }
                    $updateData['mother_death_certificate'] = null;
                }
            }
    
            // Add other fields to update array
            $orphanData = $request->except(['orphan_photo', 'death_certificate', 'mother_death_certificate', 'isChecked', '_method']);
            
            foreach ($orphanData as $key => $value) {
                if ($value !== null && $value !== '') {
                    $updateData[$key] = $value;
                }
            }
    
            // Update database
            if (!empty($updateData)) {
                $updateData['updated_at'] = now();
                
                $updated = \DB::table('orphans')
                    ->where('orphan_id_number', $id)
                    ->update($updateData);
    
                \Log::info('Database update result: ' . ($updated ? 'SUCCESS' : 'NO CHANGES'));
                \Log::info('Updated fields: ' . json_encode(array_keys($updateData)));
            }
    
            $orphan = Orphan::where('orphan_id_number', $id)->first();
            
            if ($orphan->orphan_photo) {
                $orphan->orphan_photo = $orphan->orphan_photo . '?v=' . time();
            }
            if ($orphan->death_certificate) {
                $orphan->death_certificate = $orphan->death_certificate . '?v=' . time();
            }
            if ($orphan->mother_death_certificate) {
                $orphan->mother_death_certificate = $orphan->mother_death_certificate . '?v=' . time();
            }
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث بيانات اليتيم بنجاح',
                'orphan' => $orphan,
                'updated_fields' => array_keys($updateData)
            ], 200);
    
        } catch (\Exception $e) {
            \Log::error('❌ Error in update: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            if (isset($newPhotoPath) && file_exists(public_path($newPhotoPath))) {
                unlink(public_path($newPhotoPath));
            }
            if (isset($newCertPath) && file_exists(public_path($newCertPath))) {
                unlink(public_path($newCertPath));
            }
            if (isset($newMotherCertPath) && file_exists(public_path($newMotherCertPath))) {
                unlink(public_path($newMotherCertPath));
            }
            
            return response()->json([
                'success' => false,
                'error' => 'خطأ في الخادم',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check form availability status
     */
    public function checkAvailability()
    {
        $formAvailability = FormAvailability::where('type', 'orphan')->first();
        
        return response()->json([
            'is_available' => $formAvailability ? $formAvailability->is_available : true,
            'notes' => $formAvailability ? $formAvailability->notes : null
        ], 200);
    }

    /**
     * Display mother death certificate
     */
    public function mother_death_certificate($id)
    {
        $orphan = Orphan::findOrFail($id);
        
        if (empty($orphan->mother_death_certificate)) {
            return response()->json(['error' => 'Mother death certificate not found'], 404);
        }
        
        $imagePath = public_path($orphan->mother_death_certificate);
        if (!file_exists($imagePath)) {
            return response()->json(['error' => 'Image file not found'], 404);
        }
        return response()->file($imagePath);
    }

    // Existing methods...
    use CacheableResponse;

    public function fetchOrphans(Request $request)
    {
        $user = $request->user();
        $cacheKey = $this->buildCacheKey('orphans_v2', $request, $user?->id, $user?->role);
        
        return $this->getCachedResponse($cacheKey, function() use ($request) {
            $searchQuery = $request->query('searchQuery');
            $perPage = min((int) $request->query('perPage', 20), 100); // Default 20, max 100
            $page = (int) $request->query('page', 1);

            $searchFields = [
                'orphan_id_number',
                'orphan_full_name',
                'original_address',
                'current_address',
                'health_status',
                'deceased_father_full_name',
                'death_cause',
                'mother_full_name',
                'mother_status',
                'mother_job',
                'guardian_full_name',
                'guardian_relationship',
                'guardian_phone_number',
                'alternative_phone_number',
                'is_enrolled_in_memorization_center',
                'mother_id_number',
            ];

            $query = Orphan::query();
            if ($searchQuery) {
                $query->where(function (Builder $query) use ($searchFields, $searchQuery) {
                    foreach ($searchFields as $field) {
                        $query->orWhere($field, 'LIKE', "%{$searchQuery}%");
                    }
                });
            }

            $orphans = $query->orderBy('created_at', 'DESC')
                ->paginate($perPage, ['*'], 'page', $page);

            return [
                'success' => true,
                'orphans' => $orphans->items(),
                'totalOrphans' => $orphans->total(),
                'totalPages' => $orphans->lastPage(),
                'currentPage' => $orphans->currentPage()
            ];
        });
    }

    public function incrementVisitorCount()
    {
        $visitorCount = Visitor::first();

        if (!$visitorCount) {
            $visitorCount = new Visitor();
            $visitorCount->orphan_visitors = 0;
        }

        $visitorCount->orphan_visitors++;
        $visitorCount->save();

        return response()->json(['success' => true, 'count' => $visitorCount->orphan_visitors]);
    }

    public function fetchAllOrphansForDashboard()
    {
        // استخدام cache للبيانات الثابتة (5 دقائق)
        $stats = Cache::remember('orphans_dashboard_stats', 300, function () {
            // حساب الإحصائيات مباشرة من قاعدة البيانات بدلاً من جلب جميع السجلات
            $totalOrphans = Orphan::count();

            $visitorCount = Visitor::first();
            $totalOrphanVisitors = $visitorCount ? $visitorCount->orphan_visitors : 0;

            // حساب الإحصائيات باستخدام استعلامات محسّنة
            $motherStatusCounts = Orphan::selectRaw('mother_status, COUNT(*) as count')
                ->groupBy('mother_status')
                ->pluck('count', 'mother_status')
                ->toArray();

            $deathCauseCounts = Orphan::selectRaw('death_cause, COUNT(*) as count')
                ->groupBy('death_cause')
                ->pluck('count', 'death_cause')
                ->toArray();

            $originalAddressCounts = Orphan::selectRaw('original_address, COUNT(*) as count')
                ->groupBy('original_address')
                ->pluck('count', 'original_address')
                ->toArray();

            // حساب الفئات العمرية باستخدام استعلام محسّن
            $ageGroups = Orphan::selectRaw('
                    CASE 
                        WHEN TIMESTAMPDIFF(YEAR, orphan_birth_date, CURDATE()) < 5 THEN "0-4"
                        WHEN TIMESTAMPDIFF(YEAR, orphan_birth_date, CURDATE()) < 10 THEN "5-9"
                        ELSE "10-14"
                    END as age_group,
                    COUNT(*) as count
                ')
                ->groupBy('age_group')
                ->pluck('count', 'age_group')
                ->toArray();

            $motherDeceasedCounts = Orphan::selectRaw('is_mother_deceased, COUNT(*) as count')
                ->groupBy('is_mother_deceased')
                ->pluck('count', 'is_mother_deceased')
                ->toArray();

            $genderCounts = Orphan::selectRaw('orphan_gender, COUNT(*) as count')
                ->groupBy('orphan_gender')
                ->pluck('count', 'orphan_gender')
                ->toArray();

            return [
                'totalOrphans' => $totalOrphans,
                'totalVisitors' => $totalOrphanVisitors,  
                'motherStatusCounts' => $motherStatusCounts,
                'deathCauseCounts' => $deathCauseCounts,
                'originalAddressCounts' => $originalAddressCounts,
                'ageGroups' => $ageGroups,
                'motherDeceasedCounts' => $motherDeceasedCounts,
                'genderCounts' => $genderCounts,
            ];
        });
        
        return response()->json($stats, 200);
    }

    /**
     * Get orphan image by orphan_id_number
     * يستخدم orphan_photo من قاعدة البيانات إذا كان موجوداً
     */
    public function show($orphanIdNumber)
    {
        try {
            // البحث عن اليتيم باستخدام orphan_id_number
            $orphan = Orphan::where('orphan_id_number', $orphanIdNumber)->first();
            
            if (!$orphan) {
                return response()->json([
                    'success' => false,
                    'error' => 'اليتيم غير موجود',
                    'message' => 'Orphan not found'
                ], 404);
            }

            $imagePath = null;
            $triedPaths = [];

            // ✅ استخدام orphan_photo من قاعدة البيانات إذا كان موجوداً
            if (!empty($orphan->orphan_photo)) {
                // ✅ إذا كان URL كامل، إرجاع redirect
                if (str_starts_with($orphan->orphan_photo, 'http://') || str_starts_with($orphan->orphan_photo, 'https://')) {
                    return redirect($orphan->orphan_photo);
                }
                
                // ✅ إذا كان يبدأ بـ /، استخدمه مباشرة
                if (str_starts_with($orphan->orphan_photo, '/')) {
                    $imagePath = public_path($orphan->orphan_photo);
                    $triedPaths[] = $orphan->orphan_photo;
                } else {
                    // ✅ مسار نسبي
                    $imagePath = public_path($orphan->orphan_photo);
                    $triedPaths[] = $orphan->orphan_photo;
                }
            } else {
                // ✅ إذا لم يكن orphan_photo موجوداً، استخدم الـ endpoint الافتراضي
                $imagePath = public_path("orphan_photos/{$orphanIdNumber}.jpg");
                $triedPaths[] = "orphan_photos/{$orphanIdNumber}.jpg";
            }

            // ✅ التحقق من وجود الملف
            if (!file_exists($imagePath)) {
                // ✅ محاولة أنواع مختلفة من الصور
                $extensions = ['jpg', 'jpeg', 'png', 'gif'];
                $found = false;
                
                // محاولة البحث باستخدام orphan_id_number مع امتدادات مختلفة
                foreach ($extensions as $ext) {
                    $testPath = public_path("orphan_photos/{$orphanIdNumber}.{$ext}");
                    $triedPaths[] = "orphan_photos/{$orphanIdNumber}.{$ext}";
                    
                    if (file_exists($testPath)) {
                        $imagePath = $testPath;
                        $found = true;
                        break;
                    }
                }
                
                // إذا كان orphan_photo موجوداً لكن الملف غير موجود، حاول البحث في نفس المجلد
                if (!$found && !empty($orphan->orphan_photo)) {
                    $photoDir = dirname($orphan->orphan_photo);
                    $photoFileName = basename($orphan->orphan_photo);
                    
                    // محاولة البحث في نفس المجلد مع امتدادات مختلفة
                    foreach ($extensions as $ext) {
                        $testPath = public_path("{$photoDir}/{$orphanIdNumber}.{$ext}");
                        $triedPaths[] = "{$photoDir}/{$orphanIdNumber}.{$ext}";
                        
                        if (file_exists($testPath)) {
                            $imagePath = $testPath;
                            $found = true;
                            break;
                        }
                    }
                }
                
                if (!$found) {
                    return response()->json([
                        'success' => false,
                        'error' => 'ملف الصورة غير موجود',
                        'message' => 'Image file not found',
                        'orphan_id_number' => $orphanIdNumber,
                        'orphan_photo_from_db' => $orphan->orphan_photo ?? null,
                        'tried_paths' => array_unique($triedPaths)
                    ], 404);
                }
            }

            // ✅ تحديد Content-Type بناءً على امتداد الملف
            $extension = strtolower(pathinfo($imagePath, PATHINFO_EXTENSION));
            $contentType = 'image/jpeg'; // افتراضي
            
            switch ($extension) {
                case 'png':
                    $contentType = 'image/png';
                    break;
                case 'gif':
                    $contentType = 'image/gif';
                    break;
                case 'webp':
                    $contentType = 'image/webp';
                    break;
                default:
                    $contentType = 'image/jpeg';
            }

            // ✅ إرجاع الصورة مع headers مناسبة
            return response()->file($imagePath, [
                'Content-Type' => $contentType,
                'Cache-Control' => 'public, max-age=3600',
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Error loading orphan image: ' . $e->getMessage(), [
                'orphan_id_number' => $orphanIdNumber,
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'خطأ في الخادم',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function death_certificate($id)
    {
        $orphan = Orphan::findOrFail($id);
        $imagePath = public_path($orphan->death_certificate);
        if (!file_exists($imagePath)) {
            return response()->json(['error' => 'Image not found'], 404);
        }
        return response()->file($imagePath);
    }

    public function exportOrphansToExcel()
    {
        return Excel::download(new OrphansExport, 'orphans.xlsx');
    }
    /**
 * Delete orphan record and associated images
 */
    /**
 * Delete orphan record and associated images
 */
    public function destroy(Request $request, $id)
    {
        \Log::info('=== ORPHAN DELETE REQUEST ===');
        \Log::info('Orphan ID: ' . $id);
        \Log::info('Request body: ' . $request->getContent());
        
        try {
            // Find orphan by ID
            $orphan = Orphan::where('orphan_id_number', $id)->first();
            
            if (!$orphan) {
                \Log::warning('Orphan not found: ' . $id);
                return response()->json([
                    'success' => false,
                    'error' => 'اليتيم غير موجود',
                    'message' => 'Orphan not found'
                ], 404);
            }
    
            // Verify guardian ID for security
            $guardianId = $request->input('guardian_id_number');
            \Log::info('Guardian ID from request: ' . $guardianId);
            \Log::info('Guardian ID from database: ' . $orphan->guardian_id_number);
            
            if (!$guardianId || $guardianId !== $orphan->guardian_id_number) {
                \Log::warning('Guardian ID mismatch or missing');
                return response()->json([
                    'success' => false,
                    'error' => 'رقم هوية الوصي غير صحيح',
                    'message' => 'Guardian ID verification failed'
                ], 403);
            }
    
            \Log::info('Guardian ID verified successfully');
    
            // Delete orphan photo
            if (!empty($orphan->orphan_photo)) {
                $photoPath = public_path($orphan->orphan_photo);
                if (file_exists($photoPath)) {
                    unlink($photoPath);
                    \Log::info('Deleted orphan photo: ' . $orphan->orphan_photo);
                }
            }
    
            // Delete death certificate
            if (!empty($orphan->death_certificate)) {
                $certPath = public_path($orphan->death_certificate);
                if (file_exists($certPath)) {
                    unlink($certPath);
                    \Log::info('Deleted death certificate: ' . $orphan->death_certificate);
                }
            }
    
            // Delete mother death certificate (if exists)
            if (!empty($orphan->mother_death_certificate)) {
                $motherCertPath = public_path($orphan->mother_death_certificate);
                if (file_exists($motherCertPath)) {
                    unlink($motherCertPath);
                    \Log::info('Deleted mother death certificate: ' . $orphan->mother_death_certificate);
                }
            }
    
            // Delete orphan record from database
            $orphan->delete();
            
            \Log::info('✅ Orphan record deleted successfully');
    
            return response()->json([
                'success' => true,
                'message' => 'تم حذف سجل اليتيم بنجاح'
            ], 200);
    
        } catch (\Exception $e) {
            \Log::error('❌ Error deleting orphan: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'error' => 'خطأ في الخادم',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}