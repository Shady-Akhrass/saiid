<?php

namespace App\Http\Controllers;

use App\Models\Refugee;
use Illuminate\Http\Request;
use App\Imports\RefugeesImport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Validator;
use App\Exports\RefugeesExport;

class RefugeeController extends Controller
{
    public function create(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'husband_id_number' => 'required|string|unique:refugees,husband_id_number',
            'husband_name' => 'required|string',
            'wife_name' => 'required|string',
            'wife_id_number' => 'required|string|unique:refugees,wife_id_number',
            'governorate' => 'required|string',
            'district' => 'required|string',
            'detailed_address' => 'required|string',
            'phone_number' => 'required|string',
            'male_family_members' => 'required|integer',
            'female_family_members' => 'required|integer',
            'children_under_2_years' => 'required|integer',
            'children_2_to_6_years' => 'required|integer',
            'children_6_to_18_years' => 'required|integer',
            'elderly_above_60' => 'required|integer',
            'pregnant_women' => 'required|integer',
            'nursing_women' => 'required|integer',
            'special_cases_count' => 'required|integer',
            'special_case_gender' => 'nullable|string',
            'special_case_age' => 'nullable|integer',
            'special_case_type' => 'nullable|string',
            'disease_type' => 'nullable|string',
            'needs_type' => 'nullable|string',
            'additional_details' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 400);
        }

        $refugee = Refugee::create($request->all());

        return response()->json([
            'success' => true,
            'data' => $refugee
        ], 201);
    }

    public function exportRefugeesToExcel()
    {
        return Excel::download(new RefugeesExport, 'refugees.xlsx');
    }
}
