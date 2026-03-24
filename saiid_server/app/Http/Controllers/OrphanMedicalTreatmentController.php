<?php

namespace App\Http\Controllers;

use App\Models\OrphanMedicalTreatment;
use App\Models\Orphan;
use Illuminate\Http\Request;
use App\Exports\OrphanMedicalTreatmentsExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;

class OrphanMedicalTreatmentController extends Controller
{
    /**
     * Create new orphan medical treatment registration
     */
    public function create(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'orphan_name' => 'required|string|min:3',
            'orphan_id_number' => 'required|string|regex:/^\d{9}$/|unique:orphan_medical_treatments,orphan_id_number',
            'guardian_name' => 'required|string|min:3',
            'guardian_id_number' => 'required|string|regex:/^\d{9}$/',
            'guardian_phone_number' => ['required', 'string', 'regex:/^(056|059)[0-9]{7}$/'],
            'currently_in_khan_younis' => 'required|boolean',
            'treatment_type' => 'required|in:علاج طبيعي,علاج النطق وتأخر الكلام,الصحة النفسية,الأسنان',
            'physical_therapy_type' => 'required_if:treatment_type,علاج طبيعي|nullable|in:شلل دماغي,تأخر نمو,إصابة حرب,أخرى',
            'physical_therapy_other_description' => 'required_if:physical_therapy_type,أخرى|nullable|string',
        ], [
            'orphan_name.required' => 'يرجى إدخال اسم اليتيم',
            'orphan_name.min' => 'اسم اليتيم يجب أن يكون على الأقل 3 أحرف',
            'orphan_id_number.required' => 'يرجى إدخال رقم هوية اليتيم',
            'orphan_id_number.regex' => 'رقم هوية اليتيم يجب أن يتكون من 9 أرقام',
            'orphan_id_number.unique' => 'هذا اليتيم مسجل بالفعل في نظام العلاج الطبي. لا يمكن التسجيل مرة أخرى.',
            'guardian_name.required' => 'يرجى إدخال اسم الوصي',
            'guardian_name.min' => 'اسم الوصي يجب أن يكون على الأقل 3 أحرف',
            'guardian_id_number.required' => 'يرجى إدخال رقم هوية الوصي',
            'guardian_id_number.regex' => 'رقم هوية الوصي يجب أن يتكون من 9 أرقام',
            'guardian_phone_number.required' => 'يرجى إدخال رقم جوال الوصي',
            'guardian_phone_number.regex' => 'رقم جوال الوصي يجب أن يبدأ بـ 056 أو 059 ويتكون من 10 أرقام',
            'currently_in_khan_younis.required' => 'يرجى تأكيد الإقامة الحالية في خانيونس',
            'treatment_type.required' => 'يرجى اختيار نوع العلاج',
            'treatment_type.in' => 'نوع العلاج المحدد غير صحيح',
            'physical_therapy_type.required_if' => 'يرجى اختيار نوع العلاج الطبيعي',
            'physical_therapy_type.in' => 'نوع العلاج الطبيعي المحدد غير صحيح',
            'physical_therapy_other_description.required_if' => 'يرجى كتابة وصف العلاج الطبيعي الآخر',
        ])->setAttributeNames([
            'orphan_name' => 'اسم اليتيم',
            'orphan_id_number' => 'رقم هوية اليتيم',
            'guardian_name' => 'اسم الوصي',
            'guardian_id_number' => 'رقم هوية الوصي',
            'guardian_phone_number' => 'رقم جوال الوصي',
            'currently_in_khan_younis' => 'الإقامة في خانيونس',
            'treatment_type' => 'نوع العلاج',
            'physical_therapy_type' => 'نوع العلاج الطبيعي',
            'physical_therapy_other_description' => 'وصف العلاج الطبيعي الآخر',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        // Check if orphan is registered in the main orphans table
        $orphan = Orphan::where('orphan_id_number', $request->orphan_id_number)->first();
        
        $treatmentData = $request->all();
        $warning = null;
        
        if ($orphan) {
            $treatmentData['is_registered_in_orphans'] = true;
        } else {
            $treatmentData['is_registered_in_orphans'] = false;
            $warning = 'تنبيه: اليتيم غير مسجل في قاعدة بيانات الأيتام الأصلية. يرجى تسجيله أولاً في نموذج تسجيل الأيتام ثم العودة لإكمال التسجيل هنا.';
        }

        try {
            $treatment = OrphanMedicalTreatment::create($treatmentData);
            
            $response = [
                'treatment' => $treatment,
                'message' => 'تم تسجيل اليتيم للعلاج بنجاح',
                'success' => true
            ];
            
            if ($warning) {
                $response['warning'] = $warning;
            }
            
            return response()->json($response, 201);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'حدث خطأ أثناء التسجيل',
                'message' => $e->getMessage(),
                'success' => false
            ], 500);
        }
    }

    /**
     * Check if orphan is registered in main orphans table and medical treatment system
     */
    public function checkOrphanRegistration($orphan_id_number)
    {
        try {
            // Check if already registered in medical treatment system
            $existingTreatment = OrphanMedicalTreatment::where('orphan_id_number', $orphan_id_number)->first();
            
            if ($existingTreatment) {
                return response()->json([
                    'success' => false,
                    'is_registered' => true,
                    'already_registered_in_treatment' => true,
                    'error' => 'هذا اليتيم مسجل بالفعل في نظام العلاج الطبي',
                    'message' => 'لا يمكن التسجيل مرة أخرى. اليتيم مسجل بتاريخ: ' . $existingTreatment->created_at->format('Y-m-d'),
                    'existing_treatment' => [
                        'treatment_type' => $existingTreatment->treatment_type,
                        'registered_at' => $existingTreatment->created_at->format('Y-m-d H:i:s')
                    ]
                ], 409); // 409 Conflict
            }
            
            // Check if registered in main orphans table
            $orphan = Orphan::where('orphan_id_number', $orphan_id_number)->first();
            
            if ($orphan) {
                return response()->json([
                    'success' => true,
                    'is_registered' => true,
                    'already_registered_in_treatment' => false,
                    'orphan' => [
                        'orphan_full_name' => $orphan->orphan_full_name,
                        'orphan_id_number' => $orphan->orphan_id_number,
                    ],
                    'message' => 'اليتيم مسجل في قاعدة البيانات ويمكن المتابعة للتسجيل في نظام العلاج'
                ], 200);
            } else {
                return response()->json([
                    'success' => true,
                    'is_registered' => false,
                    'already_registered_in_treatment' => false,
                    'warning' => 'اليتيم غير مسجل في قاعدة بيانات الأيتام الأصلية. يرجى تسجيله أولاً.',
                    'message' => 'يمكنك المتابعة في التسجيل ولكن يُنصح بتسجيل اليتيم في النموذج الأصلي أولاً'
                ], 200);
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'حدث خطأ أثناء التحقق',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Fetch all orphan medical treatments with pagination and search
     */
    public function fetchOrphanMedicalTreatments(Request $request)
    {
        $searchQuery = $request->query('searchQuery');
        $perPage = $request->query('perPage', 10);
        $page = $request->query('page', 1);
        $limit = (int) $perPage;
        $offset = ($page - 1) * $limit;

        $searchFields = [
            'orphan_name',
            'orphan_id_number',
            'guardian_name',
            'guardian_id_number',
            'guardian_phone_number',
            'treatment_type',
            'physical_therapy_type',
        ];

        $query = OrphanMedicalTreatment::query();
        
        if ($searchQuery) {
            $query->where(function (Builder $query) use ($searchFields, $searchQuery) {
                foreach ($searchFields as $field) {
                    $query->orWhere($field, 'LIKE', "%{$searchQuery}%");
                }
            });
        }

        // استخدام paginate بدلاً من offset/limit لتحسين الأداء
        $treatments = $query->orderBy('created_at', 'DESC')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'treatments' => $treatments->items(),
            'totalTreatments' => $treatments->total(),
            'totalPages' => $treatments->lastPage(),
            'currentPage' => $treatments->currentPage()
        ], 200);
    }

    /**
     * Fetch all orphan medical treatments data for dashboard
     */
    public function fetchAllForDashboard()
    {
        // حساب الإحصائيات مباشرة من قاعدة البيانات بدلاً من جلب جميع السجلات
        $totalTreatments = OrphanMedicalTreatment::count();
    
        // Group by treatment type - استعلام محسّن
        $treatmentTypeCounts = OrphanMedicalTreatment::selectRaw('treatment_type, COUNT(*) as count')
            ->groupBy('treatment_type')
            ->pluck('count', 'treatment_type')
            ->toArray();
        
        // Group by physical therapy type - استعلام محسّن
        $physicalTherapyTypeCounts = OrphanMedicalTreatment::where('treatment_type', 'علاج طبيعي')
            ->selectRaw('physical_therapy_type, COUNT(*) as count')
            ->groupBy('physical_therapy_type')
            ->pluck('count', 'physical_therapy_type')
            ->toArray();
        
        // Count registered vs not registered orphans - استعلام محسّن
        $registrationStatusCounts = [
            'مسجل في قاعدة الأيتام' => OrphanMedicalTreatment::where('is_registered_in_orphans', true)->count(),
            'غير مسجل في قاعدة الأيتام' => OrphanMedicalTreatment::where('is_registered_in_orphans', false)->count(),
        ];
        
        // Count of orphans currently in Khan Younis - استعلام محسّن
        $khanYounisResidents = OrphanMedicalTreatment::where('currently_in_khan_younis', true)->count();
        $notKhanYounisResidents = OrphanMedicalTreatment::where('currently_in_khan_younis', false)->count();
        
        // Recent treatments (last 30 days) - استعلام محسّن
        $recentTreatmentsCount = OrphanMedicalTreatment::where('created_at', '>=', \Carbon\Carbon::now()->subDays(30))->count();
        
        // Treatment type breakdown by registration status - استعلام محسّن
        $treatmentByRegistrationStatus = [];
        $treatmentTypes = OrphanMedicalTreatment::selectRaw('treatment_type, is_registered_in_orphans, COUNT(*) as count')
            ->groupBy('treatment_type', 'is_registered_in_orphans')
            ->get();
        
        foreach ($treatmentTypes as $item) {
            $type = $item->treatment_type;
            if (!isset($treatmentByRegistrationStatus[$type])) {
                $treatmentByRegistrationStatus[$type] = [
                    'مسجل' => 0,
                    'غير مسجل' => 0,
                ];
            }
            if ($item->is_registered_in_orphans) {
                $treatmentByRegistrationStatus[$type]['مسجل'] = $item->count;
            } else {
                $treatmentByRegistrationStatus[$type]['غير مسجل'] = $item->count;
            }
        }
    
        return response()->json([
            'totalTreatments' => $totalTreatments,
            'treatmentTypeCounts' => $treatmentTypeCounts,
            'physicalTherapyTypeCounts' => $physicalTherapyTypeCounts,
            'registrationStatusCounts' => $registrationStatusCounts,
            'khanYounisResidents' => $khanYounisResidents,
            'notKhanYounisResidents' => $notKhanYounisResidents,
            'recentTreatmentsCount' => $recentTreatmentsCount,
            'treatmentByRegistrationStatus' => $treatmentByRegistrationStatus,
        ], 200);
    }

    /**
     * Export orphan medical treatments to Excel
     */
    public function exportToExcel()
    {
        return Excel::download(new OrphanMedicalTreatmentsExport, 'orphan_medical_treatments.xlsx');
    }
}

