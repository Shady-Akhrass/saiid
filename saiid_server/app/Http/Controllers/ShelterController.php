<?php

namespace App\Http\Controllers;

use App\Models\Refugee;
use App\Models\Shelter;
use App\Models\Visitor;
use App\Models\ProjectProposal;
use App\Models\Project;
use Illuminate\Http\Request;
use App\Exports\RefugeesExport;
use App\Exports\SheltersExport;
use App\Imports\RefugeesImport;
use App\Imports\SheltersImport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;
use App\Traits\CacheableResponse;

class ShelterController extends Controller
{
    use CacheableResponse;

    public function create(Request $request)
    {
        $validator = Validator::make($request->all(), [
            // Manager Information
            'manager_id_number' => 'required|string|min:9|unique:shelters,manager_id_number',
            'manager_name' => 'required|string|min:3',
            'manager_phone' => ['required', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
            'manager_alternative_phone' => ['nullable', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
            'manager_job_description' => 'required|string',

            // Deputy Manager Information
            'deputy_manager_name' => 'required|string|min:3',
            'deputy_manager_id_number' => 'required|string|min:9|unique:shelters,deputy_manager_id_number',
            'deputy_manager_phone' => ['required', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
            'deputy_manager_alternative_phone' => ['nullable', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
            'deputy_manager_job_description' => 'required|string',

            // Shelter Information
            'camp_name' => 'required|string|min:3',
            'governorate' => 'required|in:محافظة الشمال,محافظة غزة,محافظة الوسطى,محافظة خانيونس,محافظة رفح',
            'district' => 'required|string',
            'detailed_address' => 'required|string',
            'tents_count' => 'required|integer|min:1',
            'families_count' => 'required|integer|min:1',

            // Approval Information
            'excel_sheet' => 'required|file|mimes:xlsx,xls,csv|max:2048',
        ], [
            'required' => 'حقل :attribute مطلوب.',
            'string' => 'حقل :attribute يجب أن يكون نصاً.',
            'min' => [
                'string' => 'حقل :attribute يجب أن يحتوي على الأقل :min أحرف.',
                'numeric' => 'حقل :attribute يجب أن يكون على الأقل :min.',
            ],
            'unique' => 'قيمة :attribute مستخدمة بالفعل.',
            'integer' => 'حقل :attribute يجب أن يكون رقماً صحيحاً.',
            'in' => 'القيمة المحددة في حقل :attribute غير صالحة.',
            'regex' => 'صيغة حقل :attribute غير صحيحة.',
            'mimes' => 'يجب أن يكون الملف من نوع: xlsx, xls, أو csv.',
            'max' => [
                'file' => 'حجم الملف يجب ألا يتجاوز :max كيلوبايت.',
            ],
        ])->setAttributeNames([
            'manager_id_number' => 'رقم هوية المدير',
            'manager_name' => 'اسم المدير',
            'manager_phone' => 'رقم هاتف المدير',
            'manager_alternative_phone' => 'رقم الهاتف البديل للمدير',
            'manager_job_description' => 'الوصف الوظيفي للمدير',
            'deputy_manager_name' => 'اسم نائب المدير',
            'deputy_manager_id_number' => 'رقم هوية نائب المدير',
            'deputy_manager_phone' => 'رقم هاتف نائب المدير',
            'deputy_manager_alternative_phone' => 'رقم الهاتف البديل لنائب المدير',
            'deputy_manager_job_description' => 'الوصف الوظيفي لنائب المدير',
            'camp_name' => 'اسم المخيم',
            'governorate' => 'المحافظة',
            'district' => 'المنطقة',
            'detailed_address' => 'العنوان التفصيلي',
            'tents_count' => 'عدد الخيم',
            'families_count' => 'عدد العائلات',
            'excel_sheet' => 'ملف Excel',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $shelterData = $request->except('excel_sheet');

        if ($request->hasFile('excel_sheet')) {
            $managerId = $request->manager_id_number;
            $extension = $request->file('excel_sheet')->getClientOriginalExtension();
            $fileName = $managerId . '.' . $extension; 
            $filePath = 'excel_sheets/' . $fileName;

            $request->file('excel_sheet')->move(public_path('excel_sheets'), $fileName);

            $shelterData['excel_sheet'] = $filePath;
        }


        try {
            $shelter = Shelter::create($shelterData);
            
            // التأكد من أن updated_at تم تعيينه
            if (!$shelter->updated_at) {
                $shelter->touch();
            }

            return response()->json(['shelter' => $shelter], 201);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Internal Server Error', 'message' => $e->getMessage()], 500);
        }
    }

    public function fetchShelters(Request $request)
    {
        $user = $request->user();
        $cacheKey = $this->buildCacheKey('shelters', $request, $user?->id, $user?->role);
        
        return $this->getCachedResponse($cacheKey, function() use ($request) {
            $searchQuery = trim((string) $request->query('searchQuery', ''));
            // ✅ إضافة حد أقصى لـ perPage لمنع استهلاك الذاكرة الزائد
            $perPage = min((int) $request->query('perPage', 20), 100); // Default 20, max 100
            $page = (int) $request->query('page', 1);

            $searchFields = [
                'manager_id_number',
                'manager_name',
                'manager_phone',
                'deputy_manager_name',
                'deputy_manager_id_number',
                'deputy_manager_phone',
                'camp_name',
                'governorate',
                'district',
                'detailed_address',
            ];

            $query = Shelter::query();

            // بحث عام في عدة حقول
            if ($searchQuery !== '') {
                $query->where(function (Builder $query) use ($searchFields, $searchQuery) {
                    foreach ($searchFields as $field) {
                        $query->orWhere($field, 'LIKE', "%{$searchQuery}%");
                    }
                });
            }

            // محافظة (مطابقة جزئية)
            if ($request->filled('governorate')) {
                $gov = $request->query('governorate');
                $query->where('governorate', 'LIKE', "%{$gov}%");
            }

            // الحي / المنطقة (مطابقة جزئية في أكثر من حقل)
            if ($request->filled('district')) {
                $dist = $request->query('district');
                $query->where(function (Builder $q) use ($dist) {
                    $q->where('district', 'LIKE', "%{$dist}%")
                      ->orWhere('detailed_address', 'LIKE', "%{$dist}%")
                      ->orWhere('camp_name', 'LIKE', "%{$dist}%");
                });
            }

            // المدير - بالاسم
            if ($request->filled('manager_name')) {
                $name = $request->query('manager_name');
                $query->where('manager_name', 'LIKE', "%{$name}%");
            }

            // المدير - برقم الهاتف (الهاتف الأساسي أو البديل)
            if ($request->filled('manager_phone')) {
                $phone = $request->query('manager_phone');
                $query->where(function (Builder $q) use ($phone) {
                    $q->where('manager_phone', 'LIKE', "%{$phone}%")
                      ->orWhere('manager_alternative_phone', 'LIKE', "%{$phone}%");
                });
            }

            // عدد الأسر
            $familiesMin = $request->query('families_count_min');
            $familiesMax = $request->query('families_count_max');
            if ($familiesMin !== null || $familiesMax !== null) {
                $min = $familiesMin !== null && $familiesMin !== '' ? (int) $familiesMin : 0;
                $max = $familiesMax !== null && $familiesMax !== '' ? (int) $familiesMax : PHP_INT_MAX;
                $query->whereBetween('families_count', [$min, $max]);
            }

            // عدد الخيام
            $tentsMin = $request->query('tents_count_min');
            $tentsMax = $request->query('tents_count_max');
            if ($tentsMin !== null || $tentsMax !== null) {
                $min = $tentsMin !== null && $tentsMin !== '' ? (int) $tentsMin : 0;
                $max = $tentsMax !== null && $tentsMax !== '' ? (int) $tentsMax : PHP_INT_MAX;
                $query->whereBetween('tents_count', [$min, $max]);
            }

            // وجود ملف Excel
            if ($request->filled('has_excel')) {
                $hasExcel = (int) $request->query('has_excel') === 1;
                if ($hasExcel) {
                    $query->whereNotNull('excel_sheet');
                } else {
                    $query->whereNull('excel_sheet');
                }
            }

            // استخدام paginate بدلاً من offset/limit لتحسين الأداء
            $shelters = $query->select([
                    'manager_id_number',
                    'manager_name',
                    'manager_phone',
                    'manager_alternative_phone',
                    'manager_job_description',
                    'deputy_manager_name',
                    'deputy_manager_id_number',
                    'deputy_manager_phone',
                    'deputy_manager_alternative_phone',
                    'deputy_manager_job_description',
                    'camp_name',
                    'governorate',
                    'district',
                    'detailed_address',
                    'tents_count',
                    'families_count',
                    'excel_sheet',
                    'created_at',
                    'updated_at' // إضافة updated_at
                ])
                ->orderBy('updated_at', 'DESC') // ترتيب حسب updated_at بدلاً من created_at
                ->paginate($perPage, ['*'], 'page', $page);

            // إضافة excel_url مع timestamp لكل مخيم
            $shelters->getCollection()->transform(function ($shelter) {
                return $this->formatShelterWithExcelMetadata($shelter);
            });

            return [
                'success'       => true,
                'shelters'      => $shelters->items(),
                'totalShelters' => $shelters->total(),
                'totalPages'    => $shelters->lastPage(),
                'currentPage'   => $shelters->currentPage(),
                'perPage'       => $shelters->perPage()
            ];
        });
    }



    public function incrementVisitorCount()
    {
        $visitorCount = Visitor::first();

        if (!$visitorCount) {
            $visitorCount = new Visitor();
            $visitorCount->shelter_visitors = 0;
        }

        $visitorCount->shelter_visitors++;
        $visitorCount->save();

        return response()->json(['success' => true, 'count' => $visitorCount->shelter_visitors]);
    }

     public function fetchAllSheltersForDashboard()
    {
        try {
            // استخدام cache للبيانات الثابتة (5 دقائق) - تحسين الأداء باستخدام Query Builder
            $stats = Cache::remember('shelters_dashboard_stats', 300, function () {
                // استخدام select محدد وتحسين الاستعلامات
                $shelters = Shelter::select(['governorate', 'district', 'tents_count', 'families_count'])
                    ->orderBy('created_at', 'DESC')
                    ->get();
            
            $totalShelters = $shelters->count();
            
            // استخدام Query Builder مباشرة للحسابات بدلاً من Collection operations
            $totalTents = Shelter::sum('tents_count');
            $totalFamilies = Shelter::sum('families_count');
            
            // Group by governorate - استخدام Query Builder
            $governorateCounts = Shelter::selectRaw('governorate, COUNT(*) as count')
                ->groupBy('governorate')
                ->pluck('count', 'governorate')
                ->toArray();
            
            // Group by district - استخدام Query Builder
            $districtCounts = Shelter::selectRaw('district, COUNT(*) as count')
                ->groupBy('district')
                ->pluck('count', 'district')
                ->toArray();
            
            // Tents distribution by governorate - استخدام Query Builder
            $tentsByGovernorate = Shelter::selectRaw('governorate, SUM(tents_count) as total_tents')
                ->groupBy('governorate')
                ->pluck('total_tents', 'governorate')
                ->toArray();
            
            // Families distribution by governorate - استخدام Query Builder
            $familiesByGovernorate = Shelter::selectRaw('governorate, SUM(families_count) as total_families')
                ->groupBy('governorate')
                ->pluck('total_families', 'governorate')
                ->toArray();
            
            // Average tents per shelter - استخدام Query Builder
            $averageTentsPerShelter = $totalShelters > 0 ? round(Shelter::avg('tents_count'), 2) : 0;
            
            // Average families per shelter
            $averageFamiliesPerShelter = $totalShelters > 0 ? round($shelters->avg('families_count'), 2) : 0;
            
            // Average families per tent
            $averageFamiliesPerTent = $totalTents > 0 ? round($totalFamilies / $totalTents, 2) : 0;
            
            // Shelters by size (based on tents_count)
            $shelterSizes = $shelters->map(function ($shelter) {
                $tents = $shelter->tents_count;
                if ($tents < 10) return 'صغير (أقل من 10 خيام)';
                if ($tents < 30) return 'متوسط (10-29 خيمة)';
                if ($tents < 50) return 'كبير (30-49 خيمة)';
                return 'ضخم (50+ خيمة)';
            })->groupBy(fn($size) => $size)->map->count();
            
            // Shelters by capacity (based on families_count)
            $shelterCapacities = $shelters->map(function ($shelter) {
                $families = $shelter->families_count;
                if ($families < 20) return 'صغيرة (أقل من 20 عائلة)';
                if ($families < 50) return 'متوسطة (20-49 عائلة)';
                if ($families < 100) return 'كبيرة (50-99 عائلة)';
                return 'ضخمة (100+ عائلة)';
            })->groupBy(fn($capacity) => $capacity)->map->count();
            
            // Recent shelters (last 30 days)
            $recentSheltersCount = $shelters->filter(function($shelter) {
                return \Carbon\Carbon::parse($shelter->created_at)->isAfter(\Carbon\Carbon::now()->subDays(30));
            })->count();
            
            // Top 5 shelters by tents count
            $topSheltersByTents = $shelters->sortByDesc('tents_count')->take(5)->map(function($shelter) {
                return [
                    'camp_name' => $shelter->camp_name,
                    'tents_count' => $shelter->tents_count,
                    'governorate' => $shelter->governorate,
                    'district' => $shelter->district
                ];
            })->values();
            
            // Top 5 shelters by families count
            $topSheltersByFamilies = $shelters->sortByDesc('families_count')->take(5)->map(function($shelter) {
                return [
                    'camp_name' => $shelter->camp_name,
                    'families_count' => $shelter->families_count,
                    'governorate' => $shelter->governorate,
                    'district' => $shelter->district
                ];
            })->values();
            
            // Manager contact statistics
            $managersWithAlternativePhone = $shelters->whereNotNull('manager_alternative_phone')->count();
            $deputyManagersWithAlternativePhone = $shelters->whereNotNull('deputy_manager_alternative_phone')->count();
            
            // Density metrics
            $totalPopulation = $totalFamilies * 5; // Assuming average 5 people per family
            $averagePopulationPerShelter = $totalShelters > 0 ? round($totalPopulation / $totalShelters, 2) : 0;
            
                return [
                    'totalShelters' => $totalShelters,
                    'totalTents' => $totalTents,
                    'totalFamilies' => $totalFamilies,
                    'totalPopulation' => $totalPopulation,
                    'governorateCounts' => $governorateCounts,
                    'districtCounts' => $districtCounts,
                    'tentsByGovernorate' => $tentsByGovernorate,
                    'familiesByGovernorate' => $familiesByGovernorate,
                    'averageTentsPerShelter' => $averageTentsPerShelter,
                    'averageFamiliesPerShelter' => $averageFamiliesPerShelter,
                    'averageFamiliesPerTent' => $averageFamiliesPerTent,
                    'averagePopulationPerShelter' => $averagePopulationPerShelter,
                    'shelterSizes' => $shelterSizes,
                    'shelterCapacities' => $shelterCapacities,
                    'recentSheltersCount' => $recentSheltersCount,
                    'topSheltersByTents' => $topSheltersByTents,
                    'topSheltersByFamilies' => $topSheltersByFamilies,
                    'managersWithAlternativePhone' => $managersWithAlternativePhone,
                    'deputyManagersWithAlternativePhone' => $deputyManagersWithAlternativePhone,
                ];
            });
            
            return response()->json($stats, 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch shelters dashboard data',
                'message' => $e->getMessage()
            ], 500);
        }
    }

   
    public function importRefugees(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|mimes:xlsx,xls,csv|max:2048',
            'manager_id_number' => 'required|exists:shelters,manager_id_number'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $import = new RefugeesImport($request->input('manager_id_number'));
            Excel::import($import, $request->file('file'));

            // Get imported rows for debugging
            $importedRows = $import->getImportedRows();

            return response()->json([
                'message' => 'تم استيراد البيانات بنجاح',
                'imported_rows' => $importedRows
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Refugee Import Error: ' . $e->getMessage());
            $importedRows = $import->getImportedRows();
            return response()->json([
                'error' => 'حدث خطأ أثناء استيراد البيانات',
                'details' => $e->getMessage(),
                'imported_rows' => $importedRows
            ], 500);
        }
    }
   public function show($id)
    {
        // الحصول على المعاملات من URL
        $requestedTimestamp = request()->query('t');
        $requestedUpdatedAt = request()->query('u');
        $requestedRandom = request()->query('r');

        \Log::info('Excel file download request', [
            'manager_id' => $id,
            't' => $requestedTimestamp,
            'u' => $requestedUpdatedAt,
            'r' => $requestedRandom
        ]);

        // إعادة تحميل البيانات من قاعدة البيانات للتأكد من الحصول على أحدث البيانات
        $shelter = Shelter::where('manager_id_number', $id)->first();

        if (!$shelter) {
            \Log::warning('Shelter not found', ['manager_id' => $id]);
            return response()->json(['error' => 'Shelter not found'], 404);
        }

        // إعادة تحميل البيانات من قاعدة البيانات
        $shelter->refresh();

        if (empty($shelter->excel_sheet)) {
            \Log::warning('Excel sheet path is empty', ['manager_id' => $id]);
            return response()->json(['error' => 'File not found'], 404);
        }

        $filePath = public_path($shelter->excel_sheet);

        if (!file_exists($filePath)) {
            \Log::error('Excel file does not exist', [
                'manager_id' => $id,
                'file_path' => $filePath,
                'excel_sheet' => $shelter->excel_sheet
            ]);
            return response()->json(['error' => 'File not found'], 404);
        }

        // الحصول على معلومات الملف - دائماً من الملف الفعلي
        clearstatcache(true, $filePath); // مسح cache معلومات الملف
        $fileSize = filesize($filePath);
        $lastModified = filemtime($filePath);
        $updatedAtTimestamp = $shelter->updated_at ? $shelter->updated_at->getTimestamp() : null;
        $fileHash = @md5_file($filePath) ?: md5($filePath . $lastModified . $fileSize);

        // التحقق من تطابق المعاملات مع الملف الفعلي
        if ($requestedTimestamp && $requestedTimestamp != $lastModified) {
            \Log::warning('Timestamp mismatch', [
                'manager_id' => $id,
                'requested' => $requestedTimestamp,
                'actual' => $lastModified,
                'file_path' => $shelter->excel_sheet
            ]);
            // لا نرفض الطلب، لكن نسجل التحذير
        }

        if ($requestedUpdatedAt && $requestedUpdatedAt != $updatedAtTimestamp) {
            \Log::warning('Updated_at timestamp mismatch', [
                'manager_id' => $id,
                'requested' => $requestedUpdatedAt,
                'actual' => $updatedAtTimestamp
            ]);
        }

        \Log::info('Serving Excel file', [
            'manager_id' => $id,
            'file_path' => $shelter->excel_sheet,
            'file_size' => $fileSize,
            'last_modified' => $lastModified,
            'updated_at' => $updatedAtTimestamp,
            'file_hash' => $fileHash
        ]);

        // إنشاء ETag فريد بناءً على محتوى الملف و updated_at
        $etag = '"' . $fileHash . ($updatedAtTimestamp ? '-' . $updatedAtTimestamp : '') . '"';

        // إضافة headers قوية جداً لمنع التخزين المؤقت
        $headers = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Length' => $fileSize,
            'Cache-Control' => 'no-cache, no-store, must-revalidate, private, max-age=0, pre-check=0, post-check=0',
            'Pragma' => 'no-cache',
            'Expires' => 'Thu, 01 Jan 1970 00:00:00 GMT',
            'Last-Modified' => gmdate('D, d M Y H:i:s', $lastModified) . ' GMT',
            'ETag' => $etag,
            'X-Content-Type-Options' => 'nosniff',
            'X-Accel-Expires' => '0',
            'X-Cache-Control' => 'no-cache',
            'Vary' => 'Accept-Encoding, User-Agent',
            'X-File-Hash' => $fileHash,
            'X-File-Timestamp' => $lastModified,
            'X-Updated-At' => $updatedAtTimestamp,
        ];

        // عدم استخدام 304 Not Modified أبداً - دائماً إرجاع الملف
        // هذا يضمن الحصول على الملف الأحدث دائماً

        // استخدام timestamp في اسم الملف للتحميل لضمان عدم التخزين المؤقت
        $fileName = basename($filePath);
        $extension = pathinfo($fileName, PATHINFO_EXTENSION);
        $baseName = pathinfo($fileName, PATHINFO_FILENAME);
        // إضافة timestamp و updated_at من قاعدة البيانات لضمان اسم فريد
        // إضافة timestamp عشوائي إضافي لمنع التخزين المؤقت
        $randomSuffix = mt_rand(1000, 9999);
        $downloadFileName = $baseName . '_' . $lastModified . '_' . $updatedAtTimestamp . '_' . $randomSuffix . '.' . $extension;
        
        return response()->download($filePath, $downloadFileName, $headers);
    }
    
    /**
     * Get shelter by manager_id_number
     */
    public function getShelterById($id)
    {
        try {
            $shelter = Shelter::where('manager_id_number', $id)->first();

            if (!$shelter) {
                return response()->json([
                    'success' => false,
                    'error' => 'المخيم غير موجود',
                    'message' => 'Shelter not found'
                ], 404);
            }

            // إضافة timestamp للملف إذا كان موجوداً لاستخدامه في رابط التحميل
            $excelTimestamp = null;
            if (!empty($shelter->excel_sheet)) {
                $filePath = public_path($shelter->excel_sheet);
                if (file_exists($filePath)) {
                    $excelTimestamp = filemtime($filePath);
                }
            }
            
            $formattedShelter = $this->formatShelterWithExcelMetadata($shelter);

            return response()->json([
                'success' => true,
                'shelter' => $formattedShelter
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
     * Update shelter data by manager_id_number
     */
    public function update(Request $request, $id)
    {
        try {
            $shelter = Shelter::where('manager_id_number', $id)->first();

            if (!$shelter) {
                return response()->json([
                    'success' => false,
                    'error' => 'المخيم غير موجود',
                    'message' => 'Shelter not found'
                ], 404);
            }

            // التحقق من رقم هوية مسؤول المخيم للأمان
            $managerIdFromRequest = $request->input('manager_id_number');
            $managerIdVerification = $request->input('manager_id_number_verification');
            
            // إذا كان manager_id_number في الطلب مطابقاً للقيمة الحالية، السماح بالتحديث مباشرة
            if ($managerIdFromRequest && $managerIdFromRequest === $shelter->manager_id_number) {
                // رقم الهوية مطابق - لا حاجة للتحقق الإضافي
            } 
            // إذا تم تغيير manager_id_number، يجب التحقق من القيمة القديمة
            elseif ($managerIdFromRequest && $managerIdFromRequest !== $shelter->manager_id_number) {
                if (!$managerIdVerification || $managerIdVerification !== $shelter->manager_id_number) {
                    return response()->json([
                        'success' => false,
                        'error' => 'رقم هوية مسؤول المخيم غير صحيح',
                        'message' => 'Manager ID verification failed. You must provide the correct current manager ID to update this shelter.'
                    ], 403);
                }
            }
            // إذا لم يتم إرسال manager_id_number، فهذا يعني أن المستخدم لا يريد تغييره
            // والـ $id في الـ route هو manager_id_number الحالي، لذلك نسمح بالتحديث
            // (لا حاجة للتحقق الإضافي لأن الـ route نفسه يضمن أننا نعدل السجل الصحيح)

            $validator = Validator::make($request->all(), [
                'manager_id_number' => 'sometimes|string|min:9|unique:shelters,manager_id_number,' . $id . ',manager_id_number',
                'manager_name' => 'sometimes|string|min:3',
                'manager_phone' => ['sometimes', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
                'manager_alternative_phone' => ['nullable', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
                'manager_job_description' => 'sometimes|string',

                'deputy_manager_name' => 'sometimes|string|min:3',
                'deputy_manager_id_number' => 'sometimes|string|min:9|unique:shelters,deputy_manager_id_number,' . $id . ',manager_id_number',
                'deputy_manager_phone' => ['sometimes', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
                'deputy_manager_alternative_phone' => ['nullable', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
                'deputy_manager_job_description' => 'sometimes|string',

                'camp_name' => 'sometimes|string|min:3',
                'governorate' => 'sometimes|in:محافظة الشمال,محافظة غزة,محافظة الوسطى,محافظة خانيونس,محافظة رفح',
                'district' => 'sometimes|string',
                'detailed_address' => 'sometimes|string',
                'tents_count' => 'sometimes|integer|min:1',
                'families_count' => 'sometimes|integer|min:1',

                'excel_sheet' => 'sometimes|file|mimes:xlsx,xls,csv|max:2048',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 400);
            }

            // البدء بـ updateData بدون excel_sheet
            $updateData = $request->except(['excel_sheet', '_method']);

            // معالجة ملف Excel إذا تم رفعه
            if ($request->hasFile('excel_sheet')) {
                \Log::info('Excel file detected in update request', [
                    'manager_id' => $id,
                    'file_name' => $request->file('excel_sheet')->getClientOriginalName(),
                    'file_size' => $request->file('excel_sheet')->getSize(),
                    'is_valid' => $request->file('excel_sheet')->isValid()
                ]);

                // حذف الملف القديم إذا كان موجوداً
                if (!empty($shelter->excel_sheet)) {
                    $oldFilePath = public_path($shelter->excel_sheet);
                    if (file_exists($oldFilePath)) {
                        @unlink($oldFilePath);
                        \Log::info('Old Excel file deleted', ['path' => $oldFilePath]);
                    }
                }

                $newManagerId = $request->manager_id_number ?? $shelter->manager_id_number;
                $extension = $request->file('excel_sheet')->getClientOriginalExtension();
                
                // إضافة timestamp لضمان اسم فريد وتجنب مشاكل الـ cache
                $timestamp = time();
                $fileName = $newManagerId . '_' . $timestamp . '.' . $extension;
                $filePath = 'excel_sheets/' . $fileName;
                $fullPath = public_path('excel_sheets') . '/' . $fileName;

                // التأكد من وجود المجلد
                if (!file_exists(public_path('excel_sheets'))) {
                    mkdir(public_path('excel_sheets'), 0755, true);
                    \Log::info('Created excel_sheets directory');
                }

                // نقل الملف
                try {
                    $moved = $request->file('excel_sheet')->move(public_path('excel_sheets'), $fileName);
                    
                    if ($moved && file_exists($fullPath)) {
                        // ⚠️ مهم جداً: إضافة excel_sheet إلى updateData
                        $updateData['excel_sheet'] = $filePath;
                        
                        \Log::info('Excel file saved successfully', [
                            'path' => $filePath,
                            'full_path' => $fullPath,
                            'file_size' => filesize($fullPath),
                            'updateData_has_excel' => isset($updateData['excel_sheet']),
                            'updateData_excel_value' => $updateData['excel_sheet']
                        ]);
                    } else {
                        \Log::error('Failed to save Excel file - file not found after move', [
                            'path' => $filePath,
                            'full_path' => $fullPath,
                            'moved' => $moved ? 'true' : 'false',
                            'exists' => file_exists($fullPath) ? 'true' : 'false'
                        ]);
                        return response()->json([
                            'success' => false,
                            'error' => 'فشل حفظ ملف Excel',
                            'message' => 'حدث خطأ أثناء حفظ الملف'
                        ], 500);
                    }
                } catch (\Exception $e) {
                    \Log::error('Exception while saving Excel file', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);
                    return response()->json([
                        'success' => false,
                        'error' => 'فشل حفظ ملف Excel',
                        'message' => $e->getMessage()
                    ], 500);
                }
            } else {
                \Log::info('No Excel file in update request', [
                    'manager_id' => $id,
                    'has_file' => $request->hasFile('excel_sheet'),
                    'all_files' => $request->allFiles()
                ]);
            }

            // استخدام DB transaction للتأكد من التحديث
            \DB::beginTransaction();
            try {
                // تسجيل البيانات قبل التحديث
                \Log::info('Before update', [
                    'manager_id' => $id,
                    'old_excel_sheet' => $shelter->excel_sheet,
                    'new_excel_sheet' => $updateData['excel_sheet'] ?? 'not in update',
                    'has_excel_in_update' => isset($updateData['excel_sheet']),
                    'updateData_keys' => array_keys($updateData),
                    'updateData_full' => $updateData
                ]);

                // التأكد من أن excel_sheet في updateData قبل التحديث
                if (isset($updateData['excel_sheet'])) {
                    \Log::info('Excel sheet will be updated', [
                        'old' => $shelter->excel_sheet,
                        'new' => $updateData['excel_sheet']
                    ]);
                }

                // تحديث البيانات مع التأكد من تحديث updated_at
                $shelter->update($updateData);
                
                // التأكد من تحديث updated_at (حتى لو لم تتغير البيانات)
                if (!$shelter->wasChanged()) {
                    $shelter->touch();
                }
                
                // إعادة تحميل البيانات من قاعدة البيانات للتأكد من التحديث
                $shelter->refresh();
                
                \DB::commit();
                
                // تسجيل البيانات بعد التحديث
                \Log::info('After update', [
                    'manager_id' => $id,
                    'excel_sheet' => $shelter->excel_sheet,
                    'updated_at' => $shelter->updated_at
                ]);
            } catch (\Exception $e) {
                \DB::rollBack();
                \Log::error('Update failed', [
                    'manager_id' => $id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                throw $e;
            }
            
            // إعادة تحميل البيانات مرة أخرى بعد commit للتأكد
            $shelter = Shelter::where('manager_id_number', $id)->first();
            
            if (!$shelter) {
                \Log::error('Shelter not found after update', ['manager_id' => $id]);
                return response()->json([
                    'success' => false,
                    'error' => 'فشل تحديث البيانات',
                    'message' => 'المخيم غير موجود بعد التحديث'
                ], 500);
            }
            
            // التحقق من أن الملف تم تحديثه فعلياً
            if (isset($updateData['excel_sheet'])) {
                $expectedPath = public_path($shelter->excel_sheet);
                if (!file_exists($expectedPath)) {
                    \Log::error('Excel file not found after update', [
                        'manager_id' => $id,
                        'expected_path' => $expectedPath,
                        'excel_sheet_in_db' => $shelter->excel_sheet
                    ]);
                } else {
                    \Log::info('Excel file verified after update', [
                        'manager_id' => $id,
                        'file_path' => $shelter->excel_sheet,
                        'file_size' => filesize($expectedPath),
                        'file_modified' => filemtime($expectedPath)
                    ]);
                }
            }
            
            // إضافة timestamp للملف إذا كان موجوداً لاستخدامه في رابط التحميل
            $excelTimestamp = null;
            $fileLastModified = null;
            if (!empty($shelter->excel_sheet)) {
                $excelFilePath = public_path($shelter->excel_sheet);
                if (file_exists($excelFilePath)) {
                    $fileLastModified = filemtime($excelFilePath);
                    $excelTimestamp = $fileLastModified;
                }
            }
            
            $formattedShelter = $this->formatShelterWithExcelMetadata($shelter);

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث بيانات المخيم بنجاح',
                'shelter' => $formattedShelter,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'خطأ في تحديث البيانات',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete shelter and attached excel file
     */
    public function destroy($id)
    {
        try {
            $shelter = Shelter::where('manager_id_number', $id)->first();

            if (!$shelter) {
                return response()->json([
                    'success' => false,
                    'error' => 'المخيم غير موجود',
                    'message' => 'Shelter not found'
                ], 404);
            }

            if (!empty($shelter->excel_sheet)) {
                $filePath = public_path($shelter->excel_sheet);
                if (file_exists($filePath)) {
                    @unlink($filePath);
                }
            }

            $shelter->delete();

            return response()->json([
                'success' => true,
                'message' => 'تم حذف المخيم بنجاح'
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'خطأ في حذف المخيم',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Append dynamic Excel metadata (timestamp, hash, url...) to shelter payload.
     */
    protected function formatShelterWithExcelMetadata(Shelter $shelter): array
    {
        $shelterData = $shelter->toArray();

        $updatedAtTimestamp = $shelter->updated_at ? $shelter->updated_at->getTimestamp() : null;
        $excelTimestamp = null;
        $excelFileHash = null;
        $excelFileSize = null;
        $excelUrl = null;

        if (!empty($shelter->excel_sheet)) {
            $excelPath = public_path($shelter->excel_sheet);
            if (file_exists($excelPath)) {
                clearstatcache(true, $excelPath);
                $excelTimestamp = filemtime($excelPath);
                $excelFileSize = filesize($excelPath);
                $excelFileHash = @md5_file($excelPath) ?: null;
                $randomParam = mt_rand(100000, 999999);
                $excelUrl = url("/api/excel/{$shelter->manager_id_number}?t={$excelTimestamp}&u=" . $updatedAtTimestamp . "&r={$randomParam}");
            }
        }

        $shelterData['excel_timestamp'] = $excelTimestamp;
        $shelterData['updated_at_timestamp'] = $updatedAtTimestamp;
        $shelterData['excel_file_hash'] = $excelFileHash;
        $shelterData['excel_file_size'] = $excelFileSize;
        $shelterData['excel_url'] = $excelUrl;

        return $shelterData;
    }

    /**
     * Get shelter benefits (executed projects for a shelter)
     * 
     * @param Request $request
     * @param string $id - manager_id_number
     * @return \Illuminate\Http\JsonResponse
     */
    public function getShelterBenefits(Request $request, $id)
    {
        try {
            $user = $request->user();
            
            // التحقق من الصلاحيات
            if (!in_array($user->role, ['admin', 'project_coordinator', 'executed_projects_coordinator'])) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحية للوصول إلى هذه البيانات'
                ], 403);
            }

            // البحث عن المخيم
            $shelter = Shelter::where('manager_id_number', $id)->first();

            if (!$shelter) {
                return response()->json([
                    'success' => false,
                    'error' => 'المخيم غير موجود',
                    'message' => 'Shelter not found'
                ], 404);
            }

            // جلب جميع المشاريع المرتبطة بالمخيم أولاً (للتشخيص)
            $allProjectsForShelter = ProjectProposal::where(function($query) use ($id) {
                    // البحث باستخدام string comparison للتأكد من المطابقة
                    $query->whereRaw('CAST(shelter_id AS CHAR) = ?', [(string)$id])
                          ->orWhere('shelter_id', (string)$id)
                          ->orWhereRaw('LTRIM(RTRIM(CAST(shelter_id AS CHAR))) = ?', [(string)$id]);
                })
                ->select([
                    'id',
                    'serial_number',
                    'project_name',
                    'status',
                    'shelter_id',
                    'execution_date'
                ])
                ->get();

            // جلب المشاريع المنفذة للمخيم من project_proposals
            $projects = ProjectProposal::whereIn('status', ['تم التنفيذ', 'منفذ'])
                ->where(function($query) use ($id) {
                    // البحث باستخدام string comparison للتأكد من المطابقة
                    $query->whereRaw('CAST(shelter_id AS CHAR) = ?', [(string)$id])
                          ->orWhere('shelter_id', (string)$id)
                          ->orWhereRaw('LTRIM(RTRIM(CAST(shelter_id AS CHAR))) = ?', [(string)$id]);
                })
                ->select([
                    'id',
                    'serial_number',
                    'project_name',
                    'project_description',
                    'project_type',
                    'quantity',
                    'execution_date',
                    'donor_name',
                    'status',
                    'shelter_id',
                    'created_at',
                    'updated_at'
                ])
                ->with([
                    'shelter' => function($q) {
                        $q->select('manager_id_number', 'camp_name', 'governorate', 'district');
                    }
                ])
                ->orderBy('execution_date', 'DESC')
                ->orderBy('created_at', 'DESC')
                ->get();

            // جلب المشاريع المنفذة من جدول projects القديم أيضاً
            $oldProjects = Project::where(function($query) use ($id) {
                    $query->whereRaw('CAST(shelter_id AS CHAR) = ?', [(string)$id])
                          ->orWhere('shelter_id', (string)$id)
                          ->orWhereRaw('LTRIM(RTRIM(CAST(shelter_id AS CHAR))) = ?', [(string)$id]);
                })
                ->where('status', 'مكتمل')
                ->select([
                    'id',
                    'project_name',
                    'aid_type as project_type',
                    'quantity',
                    'execution_date',
                    'status',
                    'shelter_id',
                    'created_at',
                    'updated_at'
                ])
                ->with([
                    'shelter' => function($q) {
                        $q->select('manager_id_number', 'camp_name', 'governorate', 'district');
                    }
                ])
                ->orderBy('execution_date', 'DESC')
                ->orderBy('created_at', 'DESC')
                ->get();

            // جلب المشاريع المرتبطة من خلال project_id في project_proposals
            $projectsViaOldTable = ProjectProposal::whereIn('status', ['تم التنفيذ', 'منفذ'])
                ->whereHas('executedProject', function($query) use ($id) {
                    $query->where(function($q) use ($id) {
                        $q->whereRaw('CAST(shelter_id AS CHAR) = ?', [(string)$id])
                          ->orWhere('shelter_id', (string)$id)
                          ->orWhereRaw('LTRIM(RTRIM(CAST(shelter_id AS CHAR))) = ?', [(string)$id]);
                    });
                })
                ->select([
                    'id',
                    'serial_number',
                    'project_name',
                    'project_description',
                    'project_type',
                    'quantity',
                    'execution_date',
                    'donor_name',
                    'status',
                    'shelter_id',
                    'project_id',
                    'created_at',
                    'updated_at'
                ])
                ->with([
                    'shelter' => function($q) {
                        $q->select('manager_id_number', 'camp_name', 'governorate', 'district');
                    },
                    'executedProject' => function($q) {
                        $q->select('id', 'shelter_id');
                    }
                ])
                ->orderBy('execution_date', 'DESC')
                ->orderBy('created_at', 'DESC')
                ->get();

            // دمج المشاريع من جميع المصادر وإزالة التكرارات
            $allProjects = $projects->concat($oldProjects->map(function($oldProject) {
                return (object)[
                    'id' => $oldProject->id,
                    'serial_number' => null,
                    'project_name' => $oldProject->project_name,
                    'project_description' => $oldProject->project_name,
                    'project_type' => $oldProject->project_type,
                    'quantity' => $oldProject->quantity,
                    'execution_date' => $oldProject->execution_date,
                    'donor_name' => null,
                    'status' => 'تم التنفيذ',
                    'shelter_id' => $oldProject->shelter_id,
                    'shelter' => $oldProject->shelter,
                    'created_at' => $oldProject->created_at,
                    'updated_at' => $oldProject->updated_at,
                ];
            }))->concat($projectsViaOldTable)
            ->unique('id') // إزالة التكرارات بناءً على ID
            ->values(); // إعادة ترقيم المفاتيح

            // تنسيق البيانات
            $benefits = $allProjects->map(function($project) {
                return [
                    'id' => $project->id,
                    'serial_number' => $project->serial_number,
                    'project_name' => $project->project_name,
                    'project_description' => $project->project_description,
                    'project_type' => $project->project_type,
                    'quantity' => $project->quantity,
                    'execution_date' => $project->execution_date ? $project->execution_date->format('Y-m-d') : null,
                    'execution_completed_at' => $project->execution_date ? $project->execution_date->format('Y-m-d\TH:i:s.000000\Z') : null,
                    'donor_name' => $project->donor_name,
                    'status' => $project->status,
                    'shelter_id' => $project->shelter_id,
                    'shelter' => $project->shelter ? [
                        'id' => $project->shelter->manager_id_number,
                        'manager_id_number' => $project->shelter->manager_id_number,
                        'camp_name' => $project->shelter->camp_name,
                        'governorate' => $project->shelter->governorate,
                        'district' => $project->shelter->district,
                    ] : null,
                ];
            });

            // معلومات تشخيصية (يمكن إزالتها لاحقاً)
            $debugInfo = [
                'shelter_id_searched' => (string)$id,
                'shelter_found' => $shelter ? true : false,
                'shelter_manager_id' => $shelter ? $shelter->manager_id_number : null,
                'shelter_camp_name' => $shelter ? $shelter->camp_name : null,
                'all_projects_for_shelter_count' => $allProjectsForShelter->count(),
                'all_projects_for_shelter' => $allProjectsForShelter->map(function($p) {
                    return [
                        'id' => $p->id,
                        'serial_number' => $p->serial_number,
                        'project_name' => $p->project_name,
                        'status' => $p->status,
                        'shelter_id' => $p->shelter_id,
                        'execution_date' => $p->execution_date ? $p->execution_date->format('Y-m-d') : null,
                    ];
                })->toArray(),
                'projects_from_proposals_count' => $projects->count(),
                'projects_from_old_table_count' => $oldProjects->count(),
                'projects_via_old_table_count' => $projectsViaOldTable->count(),
                'total_projects_found' => $allProjects->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'shelter' => [
                        'id' => $shelter->manager_id_number,
                        'manager_id_number' => $shelter->manager_id_number,
                        'camp_name' => $shelter->camp_name,
                        'governorate' => $shelter->governorate,
                        'district' => $shelter->district,
                    ],
                    'benefits' => $benefits,
                    'total_benefits' => $benefits->count(),
                    'debug' => $debugInfo, // معلومات تشخيصية - يمكن إزالتها لاحقاً
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'خطأ في الخادم',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
