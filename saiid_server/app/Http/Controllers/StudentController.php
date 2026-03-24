<?php

namespace App\Http\Controllers;

use App\Models\Student;
use App\Models\Visitor;
use Illuminate\Http\Request;
use App\Exports\StudentsExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class StudentController extends Controller
{

    public function create(Request $request)
    {
        $validator = Validator::make(
            $request->all(),
            [
                'name' => 'required|min:4',
                'id_number' => 'required|regex:/^\d{9}$/|unique:students,id_number',
                'birth_date' => 'required|date',
                'gender' => 'required|in:ذكر,أنثى',
                'academic_stage' => 'required|in:الابتدائية,الاعدادية',
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
                'academic_stage.required' => 'يرجى اختيار المرحلة الدراسية',
                'academic_stage.in' => 'يرجى اختيار مرحلة دراسية صحيحة',
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
            'المرحلة الدراسية' => 'academic_stage',
            'عنوان السكن بالتفصيل' => 'address_details',
            'رقم الجوال' => 'guardian_phone_number',
            'رقم الجوال البديل' => 'alternative_phone_number',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $data = Student::create($request->all());

        return response()->json([
            'message' => 'تمت إضافة بيانات الطالب بنجاح',
            'data' => $data,
        ], 201);
    }

    public function fetchStudents(Request $request)
    {
        $searchQuery = $request->query('searchQuery');
        $perPage = $request->query('perPage', 10);
        $page = $request->query('page', 1);
        $limit = (int) $perPage;
        $offset = ($page - 1) * $limit;

        $searchFields = [
            'name',
            'id_number',
            'gender',
            'academic_stage',
            'guardian_phone_number',
        ];

        $query = Student::query();
        if ($searchQuery) {
            $query->where(function (Builder $query) use ($searchFields, $searchQuery) {
                foreach ($searchFields as $field) {
                    $query->orWhere($field, 'LIKE', "%{$searchQuery}%");
                }
            });
        }

        $totalStudents = $query->count();

        $students = $query->orderBy('created_at', 'DESC')
            ->offset($offset)
            ->limit($limit)
            ->get();

        return response()->json([
            'students' => $students,
            'totalStudents' => $totalStudents,
            'totalPages' => ceil($totalStudents / $limit),
            'currentPage' => $page
        ], 200);
    }

    public function incrementVisitorCount()
    {
        $visitorCount = Visitor::first();

        if (!$visitorCount) {
            $visitorCount = new Visitor();
            $visitorCount->student_visitors = 0;
        }

        $visitorCount->student_visitors++;
        $visitorCount->save();

        return response()->json(['success' => true, 'count' => $visitorCount->student_visitors]);
    }

    public function fetchAllStudentsForDashboard()
    {
        $students = Student::orderBy('created_at', 'DESC')->get();
        $totalStudents = $students->count();

        $visitorCount = Visitor::first();
        $totalStudentVisitors = $visitorCount ? $visitorCount->student_visitors : 0;

        $genderCounts = $students->groupBy('gender')->map->count();
        $academicStageCounts = $students->groupBy('academic_stage')->map->count();

        // Age groups based on birth_date
        $studentAgeGroups = $students->map(function ($student) {
        $age = Carbon::parse($student->birth_date)->age;
        if ($age < 7) return '6 سنوات أو أقل';
        if ($age < 10) return 'من 7 إلى 9 سنوات';
        if ($age < 13) return 'من 10 إلى 12 سنة';
        return '13 سنة أو أكثر';
        })->groupBy(fn($age) => $age)->map->count();

        return response()->json([
            'totalStudents' => $totalStudents,
            'totalVisitors' => $totalStudentVisitors,
            'genderCounts' => $genderCounts,
            'academicStageCounts' => $academicStageCounts,
            'studentAgeGroups' => $studentAgeGroups,
        ], 200);
    }
    public function exportStudentsToExcel()
    {
        return Excel::download(new StudentsExport, 'students.xlsx');
    }
}
