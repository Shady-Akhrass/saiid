<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use Illuminate\Http\Request;
use App\Exports\PatientsExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;

class PatientController extends Controller
{
    public function create(Request $request)
    {
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
                'current_address' => 'required',
                'guardian_phone_number' => 'required|regex:/^\d{10}$/',
                'alternative_phone_number' => 'required|regex:/^\d{10}$/',
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
                'current_address.required' => 'يرجى اختيار عنوان السكن الحالي',
                'guardian_phone_number.required' => 'يرجى إدخال رقم الجوال',
                'guardian_phone_number.regex' => 'رقم الجوال يجب أن يتكون من 10 أرقام',
                'alternative_phone_number.required' => 'يرجى إدخال رقم الجوال البديل',
                'alternative_phone_number.regex' => 'رقم الجوال البديل يجب أن يتكون من 10 أرقام',

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
            'عنوان السكن الحالي' => 'current_address',
            'رقم الجوال' => 'guardian_phone_number',
            'رقم الجوال البديل' => 'alternative_phone_number',

        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $data = Patient::create($request->all());

        // Return success response
        return response()->json([
            'message' => 'تمت إضافة بيانات رب الأسرة بنجاح',
            'data' => $data,
        ], 201);
    }
    public function fetchPatients(Request $request)
    {
        $searchQuery = $request->query('searchQuery');
        $perPage = min((int) $request->query('perPage', 20), 100); // Default 20, max 100
        $page = (int) $request->query('page', 1);

        $searchFields = [
            'name',
            'id_number',
            'guardian_phone_number',
            'health_status',
        ];

        $query = Patient::query();
        if ($searchQuery) {
            $query->where(function (Builder $query) use ($searchFields, $searchQuery) {
                foreach ($searchFields as $field) {
                    $query->orWhere($field, 'LIKE', "%{$searchQuery}%");
                }
            });
        }

        // استخدام select() لتحديد الأعمدة المطلوبة فقط لتحسين الأداء
        $patients = $query->select([
                'id_number',
                'name',
                'birth_date',
                'gender',
                'health_status',
                'marital_status',
                'number_of_brothers',
                'number_of_sisters',
                'current_address',
                'guardian_phone_number',
                'alternative_phone_number',
                'created_at',
                'updated_at'
            ])
            ->orderBy('created_at', 'DESC')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'patients' => $patients->items(),
            'totalPatients' => $patients->total(),
            'totalPages' => $patients->lastPage(),
            'currentPage' => $patients->currentPage(),
            'perPage' => $patients->perPage()
        ], 200);
    }

    // public function incrementVisitorCount()
    // {
    //     $visitorCount = Visitor::first();

    //     if (!$visitorCount) {

    //         $visitorCount = new Visitor();
    //         $visitorCount->aid_visitors = 0;
    //     }

    //     $visitorCount->aid_visitors++;
    //     $visitorCount->save();

    //     return response()->json(['success' => true, 'count' => $visitorCount->aid_visitors]);
    // }

   public function fetchAllPatientsForDashboard()
    {
        // استخدام cache للبيانات الثابتة (5 دقائق)
        $stats = Cache::remember('patients_dashboard_stats', 300, function () {
            $patients = Patient::orderBy('created_at', 'DESC')->get();
            $totalPatients = $patients->count();
    
            // Group by gender
            $genderCounts = $patients->groupBy('gender')->map->count();
            
            // Group by health_status
            $healthStatusCounts = $patients->groupBy('health_status')->map->count();
            
            // Group by marital_status
            $maritalStatusCounts = $patients->groupBy('marital_status')->map->count();
            
            // Group by current_address
            $currentAddressCounts = $patients->groupBy('current_address')->map->count();
    
            // Age distribution (calculate age from birth_date)
            $ageGroups = $patients->map(function ($patient) {
                $birthDate = \Carbon\Carbon::parse($patient->birth_date);
                $age = $birthDate->age;
                
                if ($age < 18) return '0-17 سنة';
                if ($age < 30) return '18-29 سنة';
                if ($age < 45) return '30-44 سنة';
                if ($age < 60) return '45-59 سنة';
                return '60+ سنة';
            })->groupBy(fn($ageGroup) => $ageGroup)->map->count();
    
            // Calculate average siblings
            $averageBrothers = $patients->avg('number_of_brothers');
            $averageSisters = $patients->avg('number_of_sisters');
            $averageSiblings = $averageBrothers + $averageSisters;
    
            // Recent patients (last 30 days)
            $recentPatientsCount = $patients->filter(function($patient) {
                return \Carbon\Carbon::parse($patient->created_at)->isAfter(\Carbon\Carbon::now()->subDays(30));
            })->count();
    
            // Patients with diseases (health_status = 'مريض')
            $sickPatientsCount = $patients->where('health_status', 'مريض')->count();
            $healthyPatientsCount = $patients->where('health_status', 'جيدة')->count();
    
            // Gender breakdown by health status
            $genderHealthBreakdown = $patients->groupBy(function($patient) {
                return $patient->gender . ' - ' . $patient->health_status;
            })->map->count();
    
            return [
                'totalPatients' => $totalPatients,
                'genderCounts' => $genderCounts,
                'healthStatusCounts' => $healthStatusCounts,
                'maritalStatusCounts' => $maritalStatusCounts,
                'currentAddressCounts' => $currentAddressCounts,
                'ageGroups' => $ageGroups,
                'genderHealthBreakdown' => $genderHealthBreakdown,
                'averageBrothers' => round($averageBrothers, 2),
                'averageSisters' => round($averageSisters, 2),
                'averageSiblings' => round($averageSiblings, 2),
                'recentPatientsCount' => $recentPatientsCount,
                'sickPatientsCount' => $sickPatientsCount,
                'healthyPatientsCount' => $healthyPatientsCount,
            ];
        });
        
        return response()->json($stats, 200);
    }
    public function exportPatientsToExcel()
    {
        return Excel::download(new PatientsExport, 'orphans.xlsx');
    }
}
