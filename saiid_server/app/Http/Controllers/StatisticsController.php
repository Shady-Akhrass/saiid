<?php

namespace App\Http\Controllers;

use App\Models\Aid;
use App\Models\Orphan;
use App\Models\Patient;
use App\Models\Shelter;
use App\Models\Refugee;
use App\Models\Teacher;
use App\Models\Student;
use App\Models\Employment;
use App\Models\User;
use App\Models\Visitor;
use Illuminate\Http\JsonResponse;

class StatisticsController extends Controller
{
    /**
     * Models to count
     */
    private const MODELS = [
        'aids' => Aid::class,
        'orphans' => Orphan::class,
        'patients' => Patient::class,
        'shelters' => Shelter::class,
        'teachers' => Teacher::class,
        'students' => Student::class,
        'employments' => Employment::class,
        'users' => User::class,
        'visitors' => Visitor::class,
    ];

    /**
     * Get count of all models
     *
     * @return JsonResponse
     */
    public function getStatistics(): JsonResponse
    {
        try {
            $counts = [];

            foreach (self::MODELS as $key => $modelClass) {
                $counts[$key] = $modelClass::count();
            }

            return response()->json([
                'success' => true,
                'data' => $counts,
                'total' => array_sum($counts),
                'timestamp' => now()->toDateTimeString(),
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to fetch statistics',
                'message' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }
}
