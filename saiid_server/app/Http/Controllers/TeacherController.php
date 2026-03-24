<?php

namespace App\Http\Controllers;

use App\Models\Teacher;
use App\Models\Visitor;
use Illuminate\Http\Request;
use App\Exports\TeachersExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Validator;
use Illuminate\Database\Eloquent\Builder;

class TeacherController extends Controller
{

    public function create(Request $request)
    {
        $validator = Validator::make(
            $request->all(),
            [
                'name' => 'required|min:4',
                'id_number' => 'required|regex:/^\d{9}$/|unique:teachers,id_number',
                'birth_date' => 'required|date',
                'gender' => 'required|in:ذكر,أنثى',
                'university_major' => 'required|in:صف,رياضيات,عربي,انجليزي,علوم',
                'marital_status' => 'required|in:متزوج,أرمل,مطلق,أعزب',
                'address_details' => 'required',
                'guardian_phone_number' => 'required|regex:/^\d{10}$/',
                'alternative_phone_number' => 'required|regex:/^\d{10}$/',
            ],
            [
                'name.required' => 'يرجى إدخال الاسم رباعي',
                'name.min' => 'الاسم يجب أن يكون رباعي',
                'id_number.required' => 'يرجى إدخال رقم الهوية',
                'id_number.regex' => 'رقم الهوية يجب أن يتكون من 9 أرقام',
                'id_number.unique' => 'رقم الهوية موجود مسبقاً',
                'birth_date.required' => 'يرجى إدخال تاريخ الميلاد',
                'gender.required' => 'يرجى اختيار الجنس',
                'gender.in' => 'يرجى اختيار جنس صحيح',
                'university_major.required' => 'يرجى اختيار التخصص الجامعي',
                'university_major.in' => 'يرجى اختيار تخصص جامعي صحيح',
                'marital_status.required' => 'يرجى اختيار الحالة الإجتماعية',
                'marital_status.in' => 'يرجى اختيار حالة اجتماعية صحيحة',
                'address_details.required' => 'يرجى إدخال عنوان السكن بالتفصيل',
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
            'التخصص الجامعي' => 'university_major',
            'الحالة الإجتماعية' => 'marital_status',
            'عنوان السكن بالتفصيل' => 'address_details',
            'رقم الجوال' => 'guardian_phone_number',
            'رقم الجوال البديل' => 'alternative_phone_number',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $data = Teacher::create($request->all());

        return response()->json([
            'message' => 'تمت إضافة بيانات المعلم بنجاح',
            'data' => $data,
        ], 201);
    }
    public function fetchTeachers(Request $request)
    {
        $searchQuery = $request->query('searchQuery');
        $perPage = $request->query('perPage', 10);
        $page = $request->query('page', 1);
        $limit = (int) $perPage;
        $offset = ($page - 1) * $limit;

        $searchFields = [
            'name',
            'id_number',
            'university_major',
            'marital_status',
        ];

        $query = Teacher::query();
        if ($searchQuery) {
            $query->where(function (Builder $query) use ($searchFields, $searchQuery) {
                foreach ($searchFields as $field) {
                    $query->orWhere($field, 'LIKE', "%{$searchQuery}%");
                }
            });
        }

        $totalTeachers = $query->count();

        $teachers = $query->orderBy('created_at', 'DESC')
            ->offset($offset)
            ->limit($limit)
            ->get();

        return response()->json([
            'teachers' => $teachers,
            'totalTeachers' => $totalTeachers,
            'totalPages' => ceil($totalTeachers / $limit),
            'currentPage' => $page
        ], 200);
    }
    public function incrementVisitorCount()
    {
        $visitorCount = Visitor::first();

        if (!$visitorCount) {
            $visitorCount = new Visitor();
            $visitorCount->teacher_visitors = 0;
        }

        $visitorCount->teacher_visitors++;
        $visitorCount->save();

        return response()->json(['success' => true, 'count' => $visitorCount->teacher_visitors]);
    }

    public function fetchAllTeachersForDashboard()
    {
        $teachers = Teacher::orderBy('created_at', 'DESC')->get();
        $totalTeachers = $teachers->count();

        $visitorCount = Visitor::first();
        $totalTeacherVisitors = $visitorCount ? $visitorCount->teacher_visitors : 0;

        $maritalStatusCounts = $teachers->groupBy('marital_status')->map->count();
        $universityMajorCounts = $teachers->groupBy('university_major')->map->count();
        $addressCounts = $teachers->groupBy('address_details')->map->count();

       $teacherAgeGroups = $teachers->map(function ($teacher) {
        $age = \Carbon\Carbon::parse($teacher->birth_date)->age;
    
        if ($age < 22) return 'أقل من 22 عامًا';
        if ($age < 32) return 'من 22 إلى 31 عامًا';
        if ($age < 42) return 'من 32 إلى 41 عامًا';
        if ($age < 52) return 'من 42 إلى 51 عامًا';
        if ($age < 62) return 'من 52 إلى 61 عامًا';
        return 'أكثر من 61 عامًا';
        })->groupBy(fn($age) => $age)->map->count();



        return response()->json([
            'totalTeachers' => $totalTeachers,
            'totalVisitors' => $totalTeacherVisitors,
            'maritalStatusCounts' => $maritalStatusCounts,
            'universityMajorCounts' => $universityMajorCounts,
            'addressCounts' => $addressCounts,
            'teacherAgeGroups' => $teacherAgeGroups,
        ], 200);
    }

    public function exportTeachersToExcel()
    {
        return Excel::download(new TeachersExport, 'teachers.xlsx');
    }
}
