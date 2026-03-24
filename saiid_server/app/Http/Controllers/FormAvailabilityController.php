<?php

namespace App\Http\Controllers;

use App\Models\FormAvailability;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class FormAvailabilityController extends Controller
{
    // Allowed types
    private $types = ['orphan', 'patient', 'shelter', 'aids', 'employment'];

    public function index()
    {
        return response()->json(FormAvailability::all());
    }

    public function show($id)
    {
        $formAvailability = FormAvailability::findOrFail($id);
        return response()->json($formAvailability);
    }

    // public function store(Request $request)
    // {
    //     $data = $request->validate([
    //         'type' => ['required', 'in:' . implode(',', $this->types)],
    //         'is_available' => ['sometimes', 'boolean'],
    //         'notes' => ['sometimes', 'nullable', 'string'],
    //     ]);

    //     $model = FormAvailability::create($data);

    //     return response()->json($model, Response::HTTP_CREATED);
    // }

    public function update(Request $request, $id)
    {
        $formAvailability = FormAvailability::findOrFail($id);
        
        $data = $request->validate([
            'type' => ['sometimes', 'in:' . implode(',', $this->types)],
            'is_available' => ['sometimes', 'boolean'],
            'notes' => ['sometimes', 'nullable', 'string'], // Added notes field
        ]);

        $formAvailability->update($data);

        return response()->json($formAvailability);
    }
}