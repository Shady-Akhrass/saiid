<?php

namespace App\Services;

use App\Models\ProjectProposal;
use App\Models\ProjectType;
use App\Models\ProjectSubcategory;
use App\Models\Currency;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Carbon\Carbon;

class ProjectProposalService
{
    // Constants
    private const STATUS_NEW = 'جديد';
    private const PHASE_TYPE_DAILY = 'daily';
    private const PHASE_TYPE_MONTHLY = 'monthly';
    private const PROJECT_IMAGES_DIR = 'project_images';
    private const PROJECT_NOTES_IMAGES_DIR = 'project_notes_images';

    /**
     * Validate and get project type from request
     */
    public function getProjectTypeFromRequest(Request $request, ?ProjectProposal $existingProject = null): array
    {
        // Try project_type_id first
        if ($request->has('project_type_id') && $request->project_type_id) {
            $projectType = ProjectType::find($request->project_type_id);
            if (!$projectType) {
                return [
                    'projectType' => null,
                    'error' => [
                        'message' => 'نوع المشروع المحدد غير موجود في قاعدة البيانات',
                        'code' => 422
                    ]
                ];
            }
            return ['projectType' => $projectType, 'error' => null];
        }

        // Try project_type (for backward compatibility)
        if ($request->has('project_type') && $request->project_type) {
            $projectType = ProjectType::where('name', $request->project_type)->first();
            if (!$projectType) {
                return [
                    'projectType' => null,
                    'error' => [
                        'message' => "نوع المشروع '{$request->project_type}' غير موجود في قاعدة البيانات",
                        'code' => 422
                    ]
                ];
            }
            return ['projectType' => $projectType, 'error' => null];
        }

        // If no project type in request, use existing project's type
        if ($existingProject && $existingProject->projectType) {
            return ['projectType' => $existingProject->projectType, 'error' => null];
        }

        // If creating new project and no type provided
        if (!$existingProject) {
            return [
                'projectType' => null,
                'error' => [
                    'message' => 'يجب إرسال project_type_id أو project_type',
                    'code' => 422
                ]
            ];
        }

        return ['projectType' => null, 'error' => null];
    }

    /**
     * Validate subcategory matches project type
     */
    public function validateSubcategory(Request $request, ProjectType $projectType): ?array
    {
        if (!$request->has('subcategory_id') || !$request->subcategory_id) {
            return null;
        }

        $subcategory = ProjectSubcategory::find($request->subcategory_id);
        if (!$subcategory) {
            return [
                'message' => 'التفرعية المحددة غير موجودة في قاعدة البيانات',
                'code' => 422
            ];
        }

        if ($subcategory->project_type !== $projectType->name) {
            return [
                'message' => "التفرعية المحددة من نوع '{$subcategory->project_type}' بينما المشروع من نوع '{$projectType->name}'",
                'code' => 422
            ];
        }

        return null;
    }

    /**
     * Calculate financial amounts (USD, discount, net)
     */
    public function calculateFinancialAmounts(float $donationAmount, float $exchangeRate, float $adminDiscountPercentage): array
    {
        $amountInUsd = round($donationAmount * $exchangeRate, 2);
        $discountAmount = round($amountInUsd * ($adminDiscountPercentage / 100), 2);
        $netAmount = round($amountInUsd - $discountAmount, 2);

        return [
            'amount_in_usd' => $amountInUsd,
            'discount_amount' => $discountAmount,
            'net_amount' => $netAmount
        ];
    }

    /**
     * Process phase-related fields from request.
     * Supports both flat (phase_type, total_months) and nested (phase_division.type, phase_division.total_months) payloads.
     */
    public function processPhaseFields(Request $request, array $projectData): array
    {
        try {
            // دعم phase_division من الفرونت (كائن يحتوي type, total_months, phase_start_date)
            $phaseDivision = $request->input('phase_division');
            if (is_array($phaseDivision)) {
                if (empty($projectData['phase_type']) && !empty($phaseDivision['type'])) {
                    $type = is_string($phaseDivision['type']) ? strtolower(trim($phaseDivision['type'])) : $phaseDivision['type'];
                    if (in_array($type, [self::PHASE_TYPE_DAILY, self::PHASE_TYPE_MONTHLY])) {
                        $projectData['phase_type'] = $type;
                    } else {
                        $projectData['phase_type'] = $phaseDivision['type'];
                    }
                }
                if (!isset($projectData['total_months']) && isset($phaseDivision['total_months'])) {
                    $val = $phaseDivision['total_months'];
                    if ($val !== null && $val !== '' && is_numeric($val) && (int)$val > 0) {
                        $projectData['total_months'] = (int) $val;
                    }
                }
                if (empty($projectData['phase_start_date']) && !empty($phaseDivision['phase_start_date'])) {
                    $projectData['phase_start_date'] = $this->normalizePhaseStartDate($phaseDivision['phase_start_date']);
                }
                if (!isset($projectData['phase_duration_days']) && isset($phaseDivision['phase_duration_days'])) {
                    $val = $phaseDivision['phase_duration_days'];
                    if ($val !== null && $val !== '' && is_numeric($val) && (int)$val > 0) {
                        $projectData['phase_duration_days'] = (int) $val;
                    }
                }
            }

            $hasPhaseType = $this->columnExists('project_proposals', 'phase_type');
            $hasTotalMonths = $this->columnExists('project_proposals', 'total_months');
            $hasPhaseDurationDays = $this->columnExists('project_proposals', 'phase_duration_days');
            $hasPhaseStartDate = $this->columnExists('project_proposals', 'phase_start_date');

            if ($hasPhaseType) {
                $phaseType = $request->input('phase_type') ?? ($projectData['phase_type'] ?? null);
                if ($phaseType !== null && $phaseType !== '') {
                    $phaseType = is_string($phaseType) ? strtolower(trim($phaseType)) : $phaseType;
                    if (in_array($phaseType, [self::PHASE_TYPE_DAILY, self::PHASE_TYPE_MONTHLY])) {
                        $projectData['phase_type'] = $phaseType;
                    }
                }
            }

            if ($hasTotalMonths) {
                $totalMonths = $request->input('total_months') ?? ($projectData['total_months'] ?? null);
                if ($totalMonths !== null && $totalMonths !== '' && is_numeric($totalMonths) && (int)$totalMonths > 0) {
                    $projectData['total_months'] = (int) $totalMonths;
                } elseif (isset($projectData['is_divided_into_phases']) && $projectData['is_divided_into_phases']
                    && isset($projectData['phase_type']) && $projectData['phase_type'] === self::PHASE_TYPE_MONTHLY) {
                    unset($projectData['total_months']);
                }
            }

            if ($hasPhaseDurationDays) {
                $phaseDurationDays = $request->input('phase_duration_days') ?? ($projectData['phase_duration_days'] ?? null);
                if ($phaseDurationDays !== null && $phaseDurationDays !== '' && is_numeric($phaseDurationDays) && (int)$phaseDurationDays > 0) {
                    $projectData['phase_duration_days'] = (int) $phaseDurationDays;
                } elseif (isset($projectData['is_divided_into_phases']) && $projectData['is_divided_into_phases']
                    && isset($projectData['phase_type']) && $projectData['phase_type'] === self::PHASE_TYPE_DAILY) {
                    if (config('app.debug')) {
                        Log::warning('phase_duration_days is missing for daily divided project');
                    }
                } else {
                    $projectData['phase_duration_days'] = null;
                }
            }

            if ($hasPhaseStartDate) {
                $phaseStartDate = $request->input('phase_start_date') ?? ($projectData['phase_start_date'] ?? null);
                if ($phaseStartDate !== null && $phaseStartDate !== '') {
                    $projectData['phase_start_date'] = $this->normalizePhaseStartDate($phaseStartDate);
                } elseif (isset($projectData['is_divided_into_phases']) && $projectData['is_divided_into_phases']
                    && isset($projectData['phase_type']) && $projectData['phase_type'] === self::PHASE_TYPE_MONTHLY
                    && !empty($projectData['total_months'])) {
                    // مشروع مقسم شهرياً بدون تاريخ بداية: استخدام أول يوم من الشهر الحالي لإنشاء الشهور الفرعية
                    $projectData['phase_start_date'] = Carbon::now()->startOfMonth()->format('Y-m-d');
                    Log::info('Monthly divided project: phase_start_date set to start of current month', [
                        'phase_start_date' => $projectData['phase_start_date'],
                        'total_months' => $projectData['total_months']
                    ]);
                } elseif (isset($projectData['is_divided_into_phases']) && $projectData['is_divided_into_phases']) {
                    if (config('app.debug')) {
                        Log::warning('phase_start_date is missing for divided project');
                    }
                } else {
                    $projectData['phase_start_date'] = null;
                }
            }
        } catch (\Exception $e) {
            Log::warning('Could not check database columns, skipping new phase fields', [
                'error' => $e->getMessage()
            ]);
        }

        return $projectData;
    }

    /**
     * Clean project data by removing null/empty values while preserving important fields
     */
    public function cleanProjectData(array $projectData): array
    {
        // ✅ الحقول المحسوبة والعلاقات التي يجب إزالتها
        $excludedFields = [
            // الحقول المحسوبة (accessors) - ليست حقول فعلية في قاعدة البيانات
            'is_delayed', 'delayed_days', 'calculated_beneficiaries',
            'remaining_days', 'notes_image_url', 'notes_image_download_url',
            // العلاقات (relationships) - لا يجب تحديثها مباشرة
            'currency', 'subcategory', 'creator', 'shelter', 'projectType',
            'assignedToTeam', 'assignedResearcher', 'photographer',
            'assignedMontageProducer', 'assignedBy', 'surplusRecorder',
            'warehouseItems', 'confirmedWarehouseItems', 'pendingWarehouseItems',
            'timeline', 'dailyPhases', 'monthlyPhases', 'parentProject',
            'project', 'surplusCategory'
        ];
        
        $importantFields = [
            'is_divided_into_phases',
            'phase_type',
            'phase_duration_days',
            'total_months',
            'phase_start_date',
            'is_daily_phase',
            'is_monthly_phase',
            'parent_project_id',
            'phase_day',
            'month_number',
            'month_start_date'
        ];

        $cleanedData = [];
        foreach ($projectData as $key => $value) {
            // ✅ إزالة الحقول المحسوبة والعلاقات
            if (in_array($key, $excludedFields)) {
                continue;
            }
            
            if (in_array($key, $importantFields)) {
                $cleanedData[$key] = $value;
            } elseif ($value === false || $value === 0 || $value === '0') {
                $cleanedData[$key] = $value;
            } elseif ($value !== null && $value !== '') {
                $cleanedData[$key] = $value;
            }
        }

        return $cleanedData;
    }

    /**
     * Build project name
     */
    public function buildProjectName(?string $requestedName, ?string $donorCode, ?string $projectType, ?string $serialNumber = null): string
    {
        if (!empty($requestedName)) {
            return Str::limit(trim($requestedName), 255);
        }

        $parts = array_filter([$donorCode, $projectType, $serialNumber]);
        return implode(' - ', $parts) ?: 'مشروع جديد';
    }

    /**
     * Normalize boolean value
     */
    public function normalizeBoolean($value, bool $default = false): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_string($value)) {
            $lower = strtolower(trim($value));
            return in_array($lower, ['1', 'true', 'yes', 'on', 'y']);
        }
        if (is_numeric($value)) {
            return (int)$value !== 0;
        }
        return $default;
    }

    /**
     * Normalize phase start date to Y-m-d (for API/request input)
     */
    private function normalizePhaseStartDate($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception $e) {
            Log::warning('Could not parse phase_start_date', ['value' => $value, 'error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Check if column exists in table
     */
    private function columnExists(string $table, string $column): bool
    {
        try {
            $columns = \Schema::getColumnListing($table);
            return in_array($column, $columns);
        } catch (\Exception $e) {
            Log::warning("Could not check column existence: {$table}.{$column}", [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Create new project
     */
    public function createProject(Request $request, User $user): array
    {
        try {
            // Get currency
            $currency = Currency::findOrFail($request->currency_id);
            
            // Get project type
            $projectTypeResult = $this->getProjectTypeFromRequest($request);
            if ($projectTypeResult['error']) {
                return [
                    'success' => false,
                    'error' => $projectTypeResult['error']['message'],
                    'code' => $projectTypeResult['error']['code']
                ];
            }
            $projectType = $projectTypeResult['projectType'];
            
            // Validate subcategory
            $subcategoryError = $this->validateSubcategory($request, $projectType);
            if ($subcategoryError) {
                return [
                    'success' => false,
                    'error' => $subcategoryError['message'],
                    'code' => $subcategoryError['code']
                ];
            }
            
            // Prepare project data (include phase fields so divided projects get them from request)
            $projectData = $request->only([
                'donor_code',
                'donor_name',
                'subcategory_id',
                'donation_amount',
                'currency_id',
                'admin_discount_percentage',
                'estimated_duration_days',
                'phase_duration_days',
                'phase_start_date',
                'phase_type',
                'total_months',
                'beneficiaries_per_unit',
                'notes'
            ]);
            
            // Remove calculated amounts (calculated in Model)
            unset($projectData['amount_in_usd']);
            unset($projectData['discount_amount']);
            unset($projectData['net_amount']);
            
            // Process is_divided_into_phases
            if ($request->has('is_divided_into_phases')) {
                $projectData['is_divided_into_phases'] = $this->normalizeBoolean($request->input('is_divided_into_phases'), false);
            } else {
                $projectData['is_divided_into_phases'] = false;
            }
            
            // Process is_urgent
            if ($request->has('is_urgent')) {
                $projectData['is_urgent'] = $this->normalizeBoolean($request->input('is_urgent'), false);
            } else {
                $projectData['is_urgent'] = false;
            }
            
            // Process phase fields
            $projectData = $this->processPhaseFields($request, $projectData);
            
            // Remove internal_code (auto-generated)
            unset($projectData['internal_code']);
            
            // Add project type
            $projectData['project_type_id'] = $projectType->id;
            $projectData['project_type'] = $projectType->name;
            
            // Process project_description
            $projectDescription = $request->input('project_description');
            if ($projectDescription !== null && trim($projectDescription) === '') {
                $projectData['project_description'] = null;
            } elseif ($projectDescription !== null) {
                $projectData['project_description'] = $projectDescription;
            }
            
            // Add notes image if uploaded
            if ($request->has('notes_image_path')) {
                $projectData['notes_image'] = $request->input('notes_image_path');
            }
            
            // Build project name
            if (!empty($request->input('project_name'))) {
                $projectData['project_name'] = Str::limit(trim($request->input('project_name')), 255);
            } else {
                $projectData['project_name'] = $this->buildProjectName(
                    null,
                    $request->input('donor_code'),
                    $request->input('project_type')
                );
            }
            
            $projectData['exchange_rate'] = $currency->exchange_rate_to_usd;
            $projectData['created_by'] = $user->id;
            $projectData['status'] = self::STATUS_NEW;
            
            // Clean project data
            $projectTypeId = $projectData['project_type_id'] ?? null;
            $projectData = $this->cleanProjectData($projectData);
            
            // Ensure project_type_id is preserved
            if ($projectTypeId !== null && $projectTypeId !== '') {
                $projectData['project_type_id'] = $projectTypeId;
            }
            
            // إنشاء المشروع والمراحل الشهرية/اليومية داخل معاملة واحدة (إما كل شيء ينجح أو يتم التراجع)
            $txResult = DB::transaction(function () use ($projectData, $user) {
                $project = ProjectProposal::create($projectData);
                
                $project->recordStatusChange(null, self::STATUS_NEW, $user->id, 'تم إنشاء المشروع');
                
                $phaseResult = null;
                // ✅ منطق مبسط وواضح لإنشاء المراحل اليومية/الشهرية
                if ($project->is_divided_into_phases) {
                    // للمشاريع اليومية: نحتاج نوع daily + عدد أيام + تاريخ بداية
                    if ($project->phase_type === self::PHASE_TYPE_DAILY && $project->phase_duration_days) {
                        // إذا لم يُرسل تاريخ بداية من الفرونت، نستخدم تاريخ اليوم كبداية افتراضية
                        if (!$project->phase_start_date) {
                            $project->phase_start_date = Carbon::today()->format('Y-m-d');
                            $project->save();
                        }
                        
                        $dailyPhases = $project->createDailyPhases();
                        if ($dailyPhases && $dailyPhases->count() > 0) {
                            $project->load(['currency', 'creator', 'dailyPhases']);
                            $phaseResult = [
                                'type' => 'daily',
                                'count' => $dailyPhases->count(),
                                'phases' => $dailyPhases
                            ];
                        }
                    }
                    // للمشاريع الشهرية: نحتاج نوع monthly + total_months > 0
                    elseif ($project->phase_type === self::PHASE_TYPE_MONTHLY && $project->total_months) {
                        $firstMonthlyPhase = $project->createMonthlyPhases();
                        $monthlyCount = $project->monthlyPhases()->count();
                        
                        if ($monthlyCount > 0) {
                            $project->load(['currency', 'creator', 'monthlyPhases']);
                            $phaseResult = [
                                'type' => 'monthly',
                                'count' => $monthlyCount,
                                'total_months' => $project->total_months,
                                'first_phase' => $firstMonthlyPhase
                            ];
                        }
                    }
                }

                // تسجيل سبب عدم إنشاء الشهور المقسمة عند المشاريع الشهرية (لتسهيل التشخيص)
                $noMonthlyPhases = $phaseResult === null || (isset($phaseResult['type']) && $phaseResult['type'] !== 'monthly');
                if ($project->is_divided_into_phases && $noMonthlyPhases) {
                    $isMonthlyIntent = ($this->columnExists('project_proposals', 'phase_type') && $project->phase_type === self::PHASE_TYPE_MONTHLY);
                    if ($isMonthlyIntent) {
                        $startDate = $project->phase_start_date;
                        Log::warning('Monthly divided project created but no monthly phases were created', [
                            'project_id' => $project->id,
                            'phase_start_date' => $startDate instanceof \DateTimeInterface ? $startDate->format('Y-m-d') : $startDate,
                            'total_months' => $project->total_months,
                            'phase_type' => $project->phase_type,
                            'reason' => !$project->phase_start_date ? 'phase_start_date_missing' : (!$project->total_months ? 'total_months_missing' : 'unknown')
                        ]);
                    }
                }
                
                if (!$phaseResult) {
                    $project->load(['currency', 'creator']);
                }
                
                return ['project' => $project, 'phase_result' => $phaseResult];
            });
            
            $project = $txResult['project'];
            $phaseResult = $txResult['phase_result'];

            // Verify project was persisted (id exists in DB)
            $verified = ProjectProposal::find($project->id);
            if (!$verified) {
                Log::error('Project created in transaction but not found after commit', [
                    'project_id' => $project->id,
                    'serial_number' => $project->serial_number ?? null,
                ]);
                return [
                    'success' => false,
                    'error' => 'فشل التحقق من حفظ المشروع في قاعدة البيانات',
                    'code' => 500
                ];
            }

            if ($project->is_divided_into_phases) {
                Log::info('Divided project created', [
                    'project_id' => $project->id,
                    'phase_type' => $project->phase_type ?? null,
                    'total_months' => $project->total_months ?? null,
                    'phase_result_type' => $phaseResult ? ($phaseResult['type'] ?? null) : null,
                    'phase_result_count' => $phaseResult ? ($phaseResult['count'] ?? 0) : 0,
                ]);
            }

            return [
                'success' => true,
                'project' => $verified->load(['currency', 'creator']),
                'serial_number' => $verified->serial_number,
                'phase_result' => $phaseResult
            ];
            
        } catch (\Illuminate\Database\QueryException $e) {
            Log::error('Database error when creating project', [
                'error' => $e->getMessage(),
                'sql_state' => $e->getCode()
            ]);
            
            return [
                'success' => false,
                'error' => $this->handleDatabaseException($e),
                'code' => 500
            ];
        } catch (\Exception $e) {
            Log::error('Error creating project', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return [
                'success' => false,
                'error' => $this->handleDatabaseException($e),
                'code' => 500
            ];
        }
    }

    /**
     * Handle database exceptions
     */
    private function handleDatabaseException(\Exception $e): string
    {
        $errorMessage = $e->getMessage();
        
        if (str_contains($errorMessage, 'Column not found') || str_contains($errorMessage, 'Unknown column')) {
            return 'يبدو أن بعض الحقول غير موجودة في قاعدة البيانات. يرجى تطبيق Migration أو SQL Script.';
        }
        
        if (str_contains($errorMessage, 'Data truncated')) {
            preg_match("/Data truncated for column '([^']+)'/", $errorMessage, $matches);
            $problematicColumn = $matches[1] ?? 'unknown';
            return "القيمة المرسلة للحقل '{$problematicColumn}' غير صحيحة. يرجى التحقق من البيانات.";
        }
        
        if (str_contains($errorMessage, 'internal_code')) {
            return 'خطأ في توليد الكود الداخلي. يرجى التأكد من تشغيل migration لإضافة حقل internal_code.';
        }
        
        return config('app.debug') ? $errorMessage : 'حدث خطأ أثناء العملية';
    }

    /**
     * Apply advanced search filters to query
     */
    public function applyAdvancedSearchFilters($query, Request $request)
    {
        // Text search
        if ($request->has('search') && !empty($request->search)) {
            $searchTerm = $request->search;
            $query->where(function($q) use ($searchTerm) {
                $q->where('project_name', 'LIKE', "%{$searchTerm}%")
                  ->orWhere('donor_code', 'LIKE', "%{$searchTerm}%")
                  ->orWhere('internal_code', 'LIKE', "%{$searchTerm}%")
                  ->orWhere('donor_name', 'LIKE', "%{$searchTerm}%")
                  ->orWhere('project_description', 'LIKE', "%{$searchTerm}%")
                  ->orWhere('serial_number', 'LIKE', "%{$searchTerm}%");
            });
        }

        // Status filter
        if ($request->has('status') && !empty($request->status)) {
            if (is_array($request->status)) {
                $query->whereIn('status', $request->status);
            } else {
                $query->where('status', $request->status);
            }
        }

        // Project type filters
        if ($request->has('project_type') && !empty($request->project_type)) {
            $query->where('project_type', $request->project_type);
        }
        if ($request->has('project_type_id') && !empty($request->project_type_id)) {
            $query->where('project_type_id', $request->project_type_id);
        }
        if ($request->has('subcategory_id') && !empty($request->subcategory_id)) {
            $query->where('subcategory_id', $request->subcategory_id);
        }

        // Assignment filters
        if ($request->has('shelter_id') && !empty($request->shelter_id)) {
            $query->where('shelter_id', $request->shelter_id);
        }
        if ($request->has('team_id') && !empty($request->team_id)) {
            $query->where('assigned_to_team_id', $request->team_id);
        }
        if ($request->has('researcher_id') && !empty($request->researcher_id)) {
            $query->where('assigned_researcher_id', $request->researcher_id);
        }
        if ($request->has('photographer_id') && !empty($request->photographer_id)) {
            $query->where('assigned_photographer_id', $request->photographer_id);
        }
        if ($request->has('montage_producer_id') && !empty($request->montage_producer_id)) {
            $query->where('assigned_montage_producer_id', $request->montage_producer_id);
        }

        // Date filters
        if ($request->has('created_from') && !empty($request->created_from)) {
            $query->whereDate('created_at', '>=', $request->created_from);
        }
        if ($request->has('created_to') && !empty($request->created_to)) {
            $query->whereDate('created_at', '<=', $request->created_to);
        }
        if ($request->has('execution_from') && !empty($request->execution_from)) {
            $query->whereDate('execution_date', '>=', $request->execution_from);
        }
        if ($request->has('execution_to') && !empty($request->execution_to)) {
            $query->whereDate('execution_date', '<=', $request->execution_to);
        }
        if ($request->has('montage_from') && !empty($request->montage_from)) {
            $query->whereDate('montage_completed_date', '>=', $request->montage_from);
        }
        if ($request->has('montage_to') && !empty($request->montage_to)) {
            $query->whereDate('montage_completed_date', '<=', $request->montage_to);
        }

        // Urgent filter
        if ($request->has('is_urgent')) {
            $isUrgent = $this->normalizeBoolean($request->input('is_urgent'), false);
            $query->where('is_urgent', $isUrgent);
        }
        
        return $query;
    }

    /**
     * Process advanced update data - handle nullification and field types
     */
    public function processAdvancedUpdateData(Request $request, ProjectProposal $project): array
    {
        // ✅ إزالة الحقول المحسوبة والعلاقات التي لا يجب تحديثها
        $excludedFields = [
            '_method', '_token', 'notes_image', 'project_image',
            // الحقول المحسوبة (accessors) - ليست حقول فعلية في قاعدة البيانات
            'is_delayed', 'delayed_days', 'calculated_beneficiaries',
            'remaining_days', 'notes_image_url', 'notes_image_download_url',
            // العلاقات (relationships) - لا يجب تحديثها مباشرة
            'currency', 'subcategory', 'creator', 'shelter', 'projectType',
            'assignedToTeam', 'assignedResearcher', 'photographer',
            'assignedMontageProducer', 'assignedBy', 'surplusRecorder',
            'warehouseItems', 'confirmedWarehouseItems', 'pendingWarehouseItems',
            'timeline', 'dailyPhases', 'monthlyPhases', 'parentProject',
            'project', 'surplusCategory'
        ];
        
        $updateData = $request->except($excludedFields);
        
        // Nullable fields
        $nullableFields = [
            'project_description', 'donor_code', 'internal_code', 'donor_name',
            'notes', 'rejection_reason', 'rejection_message', 'admin_rejection_reason',
            'media_rejection_reason', 'surplus_notes',
            'shelter_id', 'assigned_to_team_id', 'assigned_researcher_id',
            'assigned_photographer_id', 'assigned_montage_producer_id',
            'subcategory_id', 'project_type_id'
        ];

        foreach ($nullableFields as $field) {
            if ($request->has($field)) {
                $value = $request->input($field);
                $updateData[$field] = ($value === null || $value === '' || $value === 'null') ? null : $value;
            }
        }

        // Date fields
        $dateFields = [
            'execution_date', 'media_received_date', 'montage_start_date',
            'montage_completed_date', 'sent_to_donor_date', 'completed_date',
            'assignment_date', 'phase_start_date', 'month_start_date',
            'shekel_converted_at', 'surplus_recorded_at'
        ];

        foreach ($dateFields as $field) {
            if ($request->has($field)) {
                $value = $request->input($field);
                $updateData[$field] = ($value === null || $value === '' || $value === 'null') ? null : $value;
            }
        }

        // Status with auto date updates
        if ($request->has('status')) {
            $newStatus = $request->input('status');
            $updateData['status'] = $newStatus;
            $now = now()->toDateString();
            
            $statusDateMap = [
                'تم التنفيذ' => 'execution_date',
                'في المونتاج' => 'montage_start_date',
                'تم المونتاج' => 'montage_completed_date',
                'وصل للمتبرع' => 'sent_to_donor_date',
                'منتهي' => 'completed_date'
            ];

            if (isset($statusDateMap[$newStatus]) && !isset($updateData[$statusDateMap[$newStatus]])) {
                if (!$project->{$statusDateMap[$newStatus]}) {
                    $updateData[$statusDateMap[$newStatus]] = $now;
                }
            }
        }

        // Boolean fields
        $booleanFields = [
            'is_divided_into_phases', 'is_daily_phase', 'is_monthly_phase',
            'has_deficit', 'transferred_to_projects', 'is_urgent'
        ];

        foreach ($booleanFields as $field) {
            if ($request->has($field)) {
                $updateData[$field] = $this->normalizeBoolean($request->input($field), false);
            }
        }

        // Numeric fields
        $numericFields = [
            'donation_amount', 'exchange_rate', 'amount_in_usd', 'admin_discount_percentage',
            'discount_amount', 'net_amount', 'shekel_exchange_rate', 'net_amount_shekel',
            'quantity', 'beneficiaries_count', 'beneficiaries_per_unit', 'unit_cost',
            'supply_cost', 'surplus_amount', 'satisfaction_shortfall',
            'estimated_duration_days', 'phase_duration_days', 'total_months',
            'month_number', 'phase_day'
        ];

        foreach ($numericFields as $field) {
            if ($request->has($field)) {
                $value = $request->input($field);
                $updateData[$field] = ($value === null || $value === '' || $value === 'null') ? null : (is_numeric($value) ? $value : null);
            }
        }

        return $this->cleanProjectData($updateData);
    }

    /**
     * Get status date updates based on new status
     */
    public function getStatusDateUpdates(string $newStatus, ProjectProposal $project): array
    {
        $updateData = [];
        $now = now()->toDateString();
        
        switch ($newStatus) {
            case 'تم التنفيذ':
                if (!$project->execution_date) {
                    $updateData['execution_date'] = $now;
                }
                break;
            case 'في المونتاج':
                if (!$project->montage_start_date) {
                    $updateData['montage_start_date'] = $now;
                }
                break;
            case 'تم المونتاج':
                if (!$project->montage_completed_date) {
                    $updateData['montage_completed_date'] = $now;
                }
                $updateData['rejection_reason'] = null;
                $updateData['rejection_message'] = null;
                $updateData['admin_rejection_reason'] = null;
                $updateData['media_rejection_reason'] = null;
                break;
            case 'وصل للمتبرع':
                if (!$project->sent_to_donor_date) {
                    $updateData['sent_to_donor_date'] = $now;
                }
                break;
            case 'منتهي':
                if (!$project->completed_date) {
                    $updateData['completed_date'] = $now;
                }
                break;
        }
        
        return $updateData;
    }

    /**
     * Clean project data when reverting to a previous status
     * يحذف البيانات المرتبطة بالحالات المتقدمة عند الرجوع إلى حالة سابقة
     * 
     * @param string $newStatus الحالة الجديدة
     * @param ProjectProposal $project المشروع
     * @return array البيانات المراد حذفها + معلومات إضافية (warehouse_items_deleted)
     */
    public function cleanDataForStatusRevert(string $newStatus, ProjectProposal $project): array
    {
        $cleanupData = [];
        $warehouseItemsToDelete = false;
        
        // ترتيب الحالات من الأقدم إلى الأحدث
        $statusOrder = [
            'جديد' => 1,
            'قيد التوريد' => 2,
            'تم التوريد' => 3,
            'قيد التوزيع' => 4,
            'مسند لباحث' => 5,
            'جاهز للتنفيذ' => 6,
            'تم اختيار المخيم' => 7,
            'قيد التنفيذ' => 8,
            'تم التنفيذ' => 9,
            'في المونتاج' => 10,
            'تم المونتاج' => 11,
            'يجب إعادة المونتاج' => 11,
            'وصل للمتبرع' => 12,
            'منتهي' => 13,
            'ملغى' => 0,
            'مؤجل' => 0,
        ];
        
        $currentStatusOrder = $statusOrder[$project->status] ?? 0;
        $newStatusOrder = $statusOrder[$newStatus] ?? 0;
        
        // ✅ الحالات الخاصة (ملغى، مؤجل) لا تحذف البيانات
        if ($newStatus === 'ملغى' || $newStatus === 'مؤجل') {
            return [];
        }
        
        // إذا كانت الحالة الجديدة قبل الحالة الحالية (رجوع للخلف)، نحذف البيانات
        if ($newStatusOrder > 0 && $currentStatusOrder > 0 && $newStatusOrder < $currentStatusOrder) {
            
            // ✅ إذا رجع إلى "جديد" - حذف كل شيء وتبقى بيانات المشروع عند الإنشاء فقط
            if ($newStatusOrder <= 1) {
                $cleanupData = [
                    'shelter_id' => null,
                    'assigned_to_team_id' => null,
                    'assigned_researcher_id' => null,
                    'assigned_photographer_id' => null,
                    'assigned_montage_producer_id' => null,
                    'assigned_by' => null,
                    'assignment_date' => null,
                    'execution_date' => null,
                    'media_received_date' => null,
                    'montage_start_date' => null,
                    'montage_producer_assigned_at' => null,
                    'montage_completed_at' => null,
                    'montage_completed_date' => null,
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                    'surplus_amount' => null,
                    'has_deficit' => false,
                    'surplus_notes' => null,
                    'surplus_recorded_at' => null,
                    'surplus_recorded_by' => null,
                    'surplus_category_id' => null,
                    'rejection_reason' => null,
                    'rejection_message' => null,
                    'admin_rejection_reason' => null,
                    'media_rejection_reason' => null,
                    'quantity' => null,
                    'beneficiaries_count' => null,
                    'beneficiaries_per_unit' => null,
                    'unit_cost' => null,
                    'supply_cost' => null,
                    'transferred_to_projects' => false,
                    'project_id' => null,
                ];
                $warehouseItemsToDelete = true;
            }
            // ✅ إذا رجع إلى "قيد التوريد" - حذف بيانات التوريد وتواريخ التوريد والفائض وإرجاع للمخزن وحذف منتج المونتاج وتواريخه وحذف المصور والباحث وتواريخ الإسناد وحذف المخيم
            elseif ($newStatusOrder <= 2) {
                $cleanupData = [
                    'shelter_id' => null,
                    'assigned_to_team_id' => null,
                    'assigned_researcher_id' => null,
                    'assigned_photographer_id' => null,
                    'assigned_montage_producer_id' => null,
                    'assigned_by' => null,
                    'assignment_date' => null,
                    'execution_date' => null,
                    'media_received_date' => null,
                    'montage_start_date' => null,
                    'montage_producer_assigned_at' => null,
                    'montage_completed_at' => null,
                    'montage_completed_date' => null,
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                    'surplus_amount' => null,
                    'has_deficit' => false,
                    'surplus_notes' => null,
                    'surplus_recorded_at' => null,
                    'surplus_recorded_by' => null,
                    'surplus_category_id' => null,
                    'rejection_reason' => null,
                    'rejection_message' => null,
                    'admin_rejection_reason' => null,
                    'media_rejection_reason' => null,
                    'supply_cost' => null, // ✅ بيانات التوريد
                ];
                $warehouseItemsToDelete = true; // ✅ إرجاع للمخزن
            }
            // ✅ إذا رجع إلى "تم التوريد" - حذف بيانات الإسناد من الباحث والمصور وتواريخ الإسناد وحذف المخيم المرتبط والتاريخ المرتبط وحذف بيانات التوزيع وبيانات الإعلام
            elseif ($newStatusOrder <= 3) {
                $cleanupData = [
                    'shelter_id' => null,
                    'assigned_to_team_id' => null,
                    'assigned_researcher_id' => null,
                    'assigned_photographer_id' => null,
                    'assigned_montage_producer_id' => null,
                    'assigned_by' => null,
                    'assignment_date' => null,
                    'execution_date' => null,
                    'media_received_date' => null,
                    'montage_start_date' => null,
                    'montage_producer_assigned_at' => null,
                    'montage_completed_at' => null,
                    'montage_completed_date' => null,
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                    'rejection_reason' => null,
                    'rejection_message' => null,
                    'admin_rejection_reason' => null,
                    'media_rejection_reason' => null,
                ];
            }
            // ✅ إذا رجع إلى "قيد التوزيع" - نفس منطق "تم التوريد"
            elseif ($newStatusOrder <= 4) {
                $cleanupData = [
                    'shelter_id' => null,
                    'assigned_to_team_id' => null,
                    'assigned_researcher_id' => null,
                    'assigned_photographer_id' => null,
                    'assigned_montage_producer_id' => null,
                    'assigned_by' => null,
                    'assignment_date' => null,
                    'execution_date' => null,
                    'media_received_date' => null,
                    'montage_start_date' => null,
                    'montage_producer_assigned_at' => null,
                    'montage_completed_at' => null,
                    'montage_completed_date' => null,
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                    'rejection_reason' => null,
                    'rejection_message' => null,
                    'admin_rejection_reason' => null,
                    'media_rejection_reason' => null,
                ];
            }
            // ✅ إذا رجع إلى "مسند لباحث" - حذف بيانات الباحث وما بعدها
            elseif ($newStatusOrder <= 5) {
                $cleanupData = [
                    'assigned_researcher_id' => null,
                    'assigned_photographer_id' => null,
                    'assigned_montage_producer_id' => null,
                    'assigned_by' => null,
                    'assignment_date' => null,
                    'execution_date' => null,
                    'media_received_date' => null,
                    'montage_start_date' => null,
                    'montage_producer_assigned_at' => null,
                    'montage_completed_at' => null,
                    'montage_completed_date' => null,
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                    'surplus_amount' => null,
                    'has_deficit' => false,
                    'surplus_notes' => null,
                    'surplus_recorded_at' => null,
                    'surplus_recorded_by' => null,
                    'surplus_category_id' => null,
                ];
            }
            // ✅ إذا رجع إلى "جاهز للتنفيذ" - حذف بيانات التوزيع والمخيم المرتبط وحذف بيانات الإعلام من المونتاج ومنتج المونتاج المسند إليه وتواريخ الإسناد
            elseif ($newStatusOrder <= 6) {
                $cleanupData = [
                    'shelter_id' => null,
                    'assigned_photographer_id' => null,
                    'assigned_montage_producer_id' => null,
                    'execution_date' => null,
                    'media_received_date' => null,
                    'montage_start_date' => null,
                    'montage_producer_assigned_at' => null,
                    'montage_completed_at' => null,
                    'montage_completed_date' => null,
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                    'rejection_reason' => null,
                    'rejection_message' => null,
                    'admin_rejection_reason' => null,
                    'media_rejection_reason' => null,
                ];
            }
            // ✅ إذا رجع إلى "تم اختيار المخيم" - حذف بيانات التنفيذ وما بعدها
            elseif ($newStatusOrder <= 7) {
                $cleanupData = [
                    'assigned_photographer_id' => null,
                    'assigned_montage_producer_id' => null,
                    'execution_date' => null,
                    'media_received_date' => null,
                    'montage_start_date' => null,
                    'montage_producer_assigned_at' => null,
                    'montage_completed_at' => null,
                    'montage_completed_date' => null,
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                    'surplus_amount' => null,
                    'has_deficit' => false,
                    'surplus_notes' => null,
                    'surplus_recorded_at' => null,
                    'surplus_recorded_by' => null,
                    'surplus_category_id' => null,
                ];
            }
            // ✅ إذا رجع إلى "قيد التنفيذ" - حذف بيانات التنفيذ وما بعدها من مونتاج
            elseif ($newStatusOrder <= 8) {
                $cleanupData = [
                    'execution_date' => null,
                    'media_received_date' => null,
                    'montage_start_date' => null,
                    'montage_producer_assigned_at' => null,
                    'montage_completed_at' => null,
                    'montage_completed_date' => null,
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                    'surplus_amount' => null,
                    'has_deficit' => false,
                    'surplus_notes' => null,
                    'surplus_recorded_at' => null,
                    'surplus_recorded_by' => null,
                    'surplus_category_id' => null,
                ];
            }
            // ✅ إذا رجع إلى "تم التنفيذ" - حذف بيانات المونتاج وما بعدها
            elseif ($newStatusOrder <= 9) {
                $cleanupData = [
                    'assigned_montage_producer_id' => null,
                    'media_received_date' => null,
                    'montage_start_date' => null,
                    'montage_producer_assigned_at' => null,
                    'montage_completed_at' => null,
                    'montage_completed_date' => null,
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                    'rejection_reason' => null,
                    'rejection_message' => null,
                    'admin_rejection_reason' => null,
                    'media_rejection_reason' => null,
                ];
            }
            // ✅ إذا رجع إلى "في المونتاج" - حذف بيانات المونتاج المكتمل وما بعدها
            elseif ($newStatusOrder <= 10) {
                $cleanupData = [
                    'montage_completed_at' => null,
                    'montage_completed_date' => null,
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                    'rejection_reason' => null,
                    'rejection_message' => null,
                    'admin_rejection_reason' => null,
                    'media_rejection_reason' => null,
                ];
            }
            // ✅ إذا رجع إلى "تم المونتاج" - حذف بيانات ما بعد المونتاج
            elseif ($newStatusOrder <= 11) {
                $cleanupData = [
                    'sent_to_donor_date' => null,
                    'completed_date' => null,
                ];
            }
            // ✅ إذا رجع إلى "وصل للمتبرع" - حذف بيانات الإنهاء
            elseif ($newStatusOrder <= 12) {
                $cleanupData = [
                    'completed_date' => null,
                ];
            }
        }
        
        // ✅ إضافة علامة لحذف warehouse items إذا لزم الأمر
        if ($warehouseItemsToDelete) {
            $cleanupData['_delete_warehouse_items'] = true;
        }
        
        return $cleanupData;
    }
}

