<?php

namespace App\Http\Controllers;

use App\Models\Employment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Database\Eloquent\Builder;

class EmploymentController extends Controller
{

    public function index() {}


    public function create(Request $request)
    {
        $validator = Validator::make(
            $request->all(),
            [
                'name' => 'required|min:4',
                'birth_date' => 'required|date',
                'address' => 'required',
                'specialization' => 'required',
                'phone_number' => 'required|regex:/^\d{10}$/',
                'previous_work_url' => 'required',
            ],
            [
                'name.required' => 'يرجى إدخال الاسم رباعي',
                'name.min' => 'الاسم يجب أن يكون رباعي',
                'birth_date.required' => 'يرجى إدخال تاريخ الميلاد',
                'address.required' => 'يرجى اختيار عنوان السكن ',
                'specialization.required' => 'يرجى اختيار التخصص ',
                'phone_number.required' => 'يرجى إدخال رقم الجوال ',
                'phone_number.regex' => 'رقم الجوال البديل يجب أن يتكون من 10 أرقام',
                'previous_work_url.required' => 'يرجى إدخال رابط اعمال سابقة'
            ]
        )->setAttributeNames([
            'الاسم رباعي' => 'name',
            'تاريخ الميلاد' => 'birth_date',
            'عنوان السكن' => 'address',
            'التخصص' => 'specialization',
            'رقم الجوال' => 'phone_number',
            'رابط الأعمال السابقة' => 'previous_work_url'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        $data = Employment::create($request->all());

        return response()->json([
            'message' => 'تمت إضافة بيانات المعلم بنجاح',
            'data' => $data,
        ], 201);
    }

    public function fetchEmployments(Request $request)
    {
        $searchQuery = $request->query('searchQuery');
        $perPage = $request->query('perPage', 10);
        $page = $request->query('page', 1);
        $limit = (int) $perPage;
        $offset = ($page - 1) * $limit;

        $searchFields = [
            'name',
            'address',
            'specialization',
            'phone_number',
            'previous_work_url',
        ];

        $query = Employment::query();
        if ($searchQuery) {
            $query->where(function (Builder $query) use ($searchFields, $searchQuery) {
                foreach ($searchFields as $field) {
                    $query->orWhere($field, 'LIKE', "%{$searchQuery}%");
                }
            });
        }

        $totalEmployments = $query->count();

        $employments = $query->orderBy('created_at', 'DESC')
            ->offset($offset)
            ->limit($limit)
            ->get();

        return response()->json([
            'employments' => $employments,
            '$totalEmployments' => $totalEmployments,
            'totalPages' => ceil($totalEmployments / $limit),
            'currentPage' => $page
        ], 200);
    }
    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(Employment $employment)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Employment $employment)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Employment $employment)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Employment $employment)
    {
        //
    }
}
