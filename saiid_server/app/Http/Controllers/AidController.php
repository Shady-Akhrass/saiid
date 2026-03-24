<?php

namespace App\Http\Controllers;
use App\Models\FormAvailability;
use App\Exports\AidsExport;
use App\Models\Aid;
use App\Models\Visitor;
use App\Traits\CacheableResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Facades\Excel;

class AidController extends Controller
{
    use CacheableResponse;
    private function checkFormAvailability()
    {
        $formAvailability = FormAvailability::where('type', 'aid')->first();
        
        if (!$formAvailability) {
            $formAvailability = FormAvailability::create([
                'type' => 'aid',
                'is_available' => true,
                'notes' => 'Default availability'
            ]);
        }
        
        return $formAvailability->is_available;
    }
    public function create(Request $request)
    {
            if (!$this->checkFormAvailability()) {
            return response()->json([
                'error' => 'نموذج تسجيل المساعدات غير متاح حالياً',
                'message' => 'The orphan registration form is currently unavailable'
            ], 403);
        }

        
        $validator  = Validator::make(
            $request->all(),
            [
                'name' => 'required|min:4',
                'id_number' => 'required|regex:/^\d{9}$/',
                'birth_date' => 'required|date',
                'gender' => 'required',
                'health_status' => 'required',
                'marital_status' => 'required',
                // 'number_of_brothers' => 'required_if:marital_status,متزوج,أرمل,مطلق|integer',
                // 'number_of_sisters' => 'required_if:marital_status,متزوج,أرمل,مطلق|integer',
                'job' => 'required',
                'salary' => 'required',
                'original_address' => 'required',
                'current_address' => 'required',
                'address_details' => 'required',
                'guardian_phone_number' => 'required|regex:/^\d{10}$/',
                'alternative_phone_number' => 'required|regex:/^\d{10}$/',
                'aid' => 'required',
                'nature_of_aid' => 'required_if:aid,وزارة التنمية,وكالة الغوث',
            ],
            [
                'name.required' => 'يرجى إدخال الاسم رباعي',
                'name.min' => 'الاسم يجب أن يكون رباعي',
                'id_number.required' => 'يرجى إدخال رقم الهوية',
                'id_number.regex' => 'رقم الهوية يجب أن يتكون من 9 أرقام',
                'birth_date.required' => 'يرجى إدخال تاريخ الميلاد',
                'gender.required' => 'يرجى اختيار الجنس',
                'health_status.required' => 'يرجى اختيار حالة الصحة',
                'marital_status.required' => 'يرجى اختيار الحالة الإجتماعية',
                'number_of_brothers.required_if' => 'يرجى إدخال عدد الأبناء الذكور',
                'number_of_sisters.required_if' => 'يرجى إدخال عدد البنات الإناث',
                'job.required' => 'يرجى اختيار نوع العمل',
                'salary.required' => 'يرجى اختيار مستوى الدخل',
                'original_address.required' => 'يرجى اختيار عنوان السكن الأساسي',
                'current_address.required' => 'يرجى اختيار عنوان السكن الحالي',
                'address_details.required' => 'يرجى إدخال عنوان السكن بالتفصيل',
                'guardian_phone_number.required' => 'يرجى إدخال رقم الجوال',
                'guardian_phone_number.regex' => 'رقم الجوال يجب أن يتكون من 10 أرقام',
                'alternative_phone_number.required' => 'يرجى إدخال رقم الجوال البديل',
                'alternative_phone_number.regex' => 'رقم الجوال البديل يجب أن يتكون من 10 أرقام',
                'aid.required' => 'يرجى اختيار نوع المساعدة',
                'nature_of_aid.required_if' => 'يرجى إدخال طبيعة المساعدة',

            ]
        )->setAttributeNames([
            'الاسم رباعي' => 'name',
            'رقم الهوية' => 'id_number',
            'تاريخ الميلاد' => 'birth_date',
            'الجنس' => 'gender',
            'الحالة الصحية' => 'health_status',
            'الحالة الإجتماعية' => 'marital_status',
            'عدد الأبناء الذكور' => 'number_of_brothers',
            'عدد البنات الإناث' => 'number_of_sisters',
            'نوع العمل' => 'job',
            'مستوى الدخل' => 'salary',
            'عنوان السكن الأساسي' => 'original_address',
            'عنوان السكن الحالي' => 'current_address',
            'عنوان السكن بالتفصيل' => 'address_details',
            'رقم الجوال' => 'guardian_phone_number',
            'رقم الجوال البديل' => 'alternative_phone_number',
            'نوع المساعدة' => 'aid',
            'طبيعة المساعدة' => 'nature_of_aid',

        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $data = Aid::create($request->all());

        // Return success response
        return response()->json([
            'message' => 'تمت إضافة بيانات رب الأسرة بنجاح',
            'data' => $data,
        ], 201);
    }
    public function fetchAids(Request $request)
    {
        $user = $request->user();
        $cacheKey = $this->buildCacheKey('aids', $request, $user?->id, $user?->role);
        
        return $this->getCachedResponse($cacheKey, function() use ($request) {
            $searchQuery = $request->query('searchQuery');
            $perPage = min((int) $request->query('perPage', 20), 100); // Default 20, max 100
            $page = (int) $request->query('page', 1);

            $searchFields = [
                'aid',
                'nature_of_aid',
                'name',
                'id_number',
                'health_status',
                'job',
                'original_address',
                'current_address',
            ];

            $query = Aid::query();
            if ($searchQuery) {
                $query->where(function (Builder $query) use ($searchFields, $searchQuery) {
                    foreach ($searchFields as $field) {
                        $query->orWhere($field, 'LIKE', "%{$searchQuery}%");
                    }
                });
            }

            // استخدام select() لتحديد الأعمدة المطلوبة فقط لتحسين الأداء
            $aids = $query->select([
                    'id_number',
                    'name',
                    'birth_date',
                    'gender',
                    'health_status',
                    'marital_status',
                    'job',
                    'salary',
                    'original_address',
                    'current_address',
                    'guardian_phone_number',
                    'alternative_phone_number',
                    'aid',
                    'nature_of_aid',
                    'created_at',
                    'updated_at'
                ])
                ->orderBy('created_at', 'DESC')
                ->paginate($perPage, ['*'], 'page', $page);

            return [
                'aids' => $aids->items(),
                'totalAids' => $aids->total(),
                'totalPages' => $aids->lastPage(),
                'currentPage' => $aids->currentPage(),
                'perPage' => $aids->perPage()
            ];
        });
    }

    public function incrementVisitorCount()
    {
        $visitorCount = Visitor::first();

        if (!$visitorCount) {

            $visitorCount = new Visitor();
            $visitorCount->aid_visitors = 0;
        }

        $visitorCount->aid_visitors++;
        $visitorCount->save();

        return response()->json(['success' => true, 'count' => $visitorCount->aid_visitors]);
    }

    public function fetchAllAidsForDashboard()
    {
        // استخدام cache للبيانات الثابتة (5 دقائق)
        $stats = Cache::remember('aids_dashboard_stats', 300, function () {
            $aids = Aid::orderBy('created_at', 'DESC')->get();
            $totalAids = $aids->count();
    
            $visitorCount = Visitor::first();
            $totalAidVisitors = $visitorCount ? $visitorCount->aid_visitors : 0;
    
            // Group by health_status (matches the schema field)
            $healthStatusCounts = $aids->groupBy('health_status')->map->count();
            
            // Group by aid (this is your aid type field)
            $aidTypeCounts = $aids->groupBy('aid')->map->count();
            
            // Group by job
            $jobCounts = $aids->groupBy('job')->map->count();
            
            // Group by marital_status
            $maritalStatusCounts = $aids->groupBy('marital_status')->map->count();
            
            // Group by gender
            $genderCounts = $aids->groupBy('gender')->map->count();
            
            // Group by current_address
            $currentAddressCounts = $aids->groupBy('current_address')->map->count();
            
            // Group by original_address
            $originalAddressCounts = $aids->groupBy('original_address')->map->count();
    
            // Calculate average salary
            $averageSalary = $aids->avg('salary');
    
            // Age distribution (calculate age from birth_date)
            $ageGroups = $aids->map(function ($aid) {
                $birthDate = \Carbon\Carbon::parse($aid->birth_date);
                $age = $birthDate->age;
                
                if ($age < 18) return '0-17 سنة';
                if ($age < 30) return '18-29 سنة';
                if ($age < 45) return '30-44 سنة';
                if ($age < 60) return '45-59 سنة';
                return '60+ سنة';
            })->groupBy(fn($ageGroup) => $ageGroup)->map->count();
    
            // Recent aids (last 30 days)
            $recentAidsCount = $aids->filter(function($aid) {
                return \Carbon\Carbon::parse($aid->created_at)->isAfter(\Carbon\Carbon::now()->subDays(30));
            })->count();
    
            return [
                'totalAids' => $totalAids,
                'totalVisitors' => $totalAidVisitors,
                'statusCounts' => $healthStatusCounts,
                'aidTypeCounts' => $aidTypeCounts,
                'jobCounts' => $jobCounts,
                'maritalStatusCounts' => $maritalStatusCounts,
                'genderCounts' => $genderCounts,
                'currentAddressCounts' => $currentAddressCounts,
                'originalAddressCounts' => $originalAddressCounts,
                'ageGroups' => $ageGroups,
                'averageSalary' => round($averageSalary, 2),
                'recentAidsCount' => $recentAidsCount,
            ];
        });
        
        return response()->json($stats, 200);
    }
    public function exportAidsToExcel()
    {
        return Excel::download(new AidsExport, 'orphans.xlsx');
    }
}
