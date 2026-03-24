<?php

namespace App\Http\Controllers;

use App\Models\MediaArchive;
use App\Models\ProjectProposal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\Eloquent\Builder;

class MediaArchiveController extends Controller
{
    /**
     * Display a listing of the archives with search and filters
     */
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user || !in_array(strtolower($user->role ?? ''), ['media_manager', 'admin'])) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات للوصول للأرشيف'
                ], 403);
            }

            $perPage = $request->query('perPage', 15);
            $page = $request->query('page', 1);
            
            $query = MediaArchive::query();

            // البحث
            if ($request->has('search') && $request->search) {
                $query->search($request->search);
            }

            // فلترة حسب نوع الأرشيف
            if ($request->has('archive_type') && $request->archive_type) {
                $query->byType($request->archive_type);
            }

            // فلترة حسب نوع المشروع
            if ($request->has('project_type') && $request->project_type) {
                $query->where('project_type', $request->project_type);
            }

            // فلترة حسب تاريخ الأرشفة
            if ($request->has('date_from') && $request->date_from) {
                $query->whereDate('archived_at', '>=', $request->date_from);
            }
            if ($request->has('date_to') && $request->date_to) {
                $query->whereDate('archived_at', '<=', $request->date_to);
            }

            // ترتيب حسب تاريخ الأرشفة (الأحدث أولاً)
            $query->orderBy('archived_at', 'DESC');

            // Pagination - الحقول donor_code, internal_code, producer_name ستظهر تلقائياً من الجدول
            $archives = $query->with(['projectProposal:id,serial_number,project_name', 'archivedBy:id,name'])
                             ->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'success' => true,
                'data' => $archives->items(),
                'pagination' => [
                    'current_page' => $archives->currentPage(),
                    'last_page' => $archives->lastPage(),
                    'per_page' => $archives->perPage(),
                    'total' => $archives->total(),
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error fetching media archives', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الأرشيف',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created archive
     */
    public function store(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user || !in_array(strtolower($user->role ?? ''), ['media_manager', 'admin'])) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات لإضافة أرشيف'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'project_proposal_id' => 'required|exists:project_proposals,id',
                'archive_type' => 'required|in:before_montage,after_montage',
                'local_path' => 'required|string',
                'notes' => 'nullable|string',
            ], [
                'project_proposal_id.required' => 'يرجى اختيار المشروع',
                'project_proposal_id.exists' => 'المشروع المحدد غير موجود',
                'archive_type.required' => 'يرجى اختيار نوع الأرشيف',
                'archive_type.in' => 'نوع الأرشيف يجب أن يكون: before_montage أو after_montage',
                'local_path.required' => 'يرجى إدخال مسار الملفات',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 400);
            }

            // جلب المشروع
            $project = ProjectProposal::with(['assignedToTeam', 'photographer', 'assignedMontageProducer'])->findOrFail($request->project_proposal_id);

            // جلب اسم الفريق
            $teamName = null;
            if ($project->assignedToTeam) {
                $teamName = $project->assignedToTeam->team_name;
            }

            // جلب اسم المصور
            $photographerName = null;
            if ($project->photographer) {
                $photographerName = $project->photographer->name;
            }

            // جلب اسم الممنتج
            $producerName = null;
            if ($project->assignedMontageProducer) {
                $producerName = $project->assignedMontageProducer->name;
            }

            // إنشاء الأرشيف
            $archive = MediaArchive::create([
                'project_proposal_id' => $project->id,
                'archive_type' => $request->archive_type,
                'local_path' => $request->local_path,
                'notes' => $request->notes,
                'archived_by' => $user->id,
                'archived_at' => now(),
                // نسخ المعلومات التفصيلية
                'project_name' => $project->project_name ?? $project->project_description,
                'serial_number' => $project->serial_number,
                'donor_name' => $project->donor_name,
                'donor_code' => $project->donor_code,
                'internal_code' => $project->internal_code,
                'project_type' => $project->project_type,
                'team_name' => $teamName,
                'photographer_name' => $photographerName,
                'producer_name' => $producerName,
                'execution_date' => $project->execution_date,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'تم إضافة الأرشيف بنجاح',
                'data' => $archive->load(['projectProposal:id,serial_number,project_name', 'archivedBy:id,name'])
            ], 201);

        } catch (\Exception $e) {
            Log::error('Error creating media archive', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل إضافة الأرشيف',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified archive
     */
    public function show($id)
    {
        try {
            $archive = MediaArchive::with([
                'projectProposal:id,serial_number,project_name,project_description,donor_name,project_type,execution_date',
                'archivedBy:id,name,email'
            ])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $archive
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error fetching media archive', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الأرشيف',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified archive
     */
    public function update(Request $request, $id)
    {
        try {
            $user = $request->user();
            
            if (!$user || !in_array(strtolower($user->role ?? ''), ['media_manager', 'admin'])) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات لتحديث الأرشيف'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'local_path' => 'nullable|string',
                'notes' => 'nullable|string',
            ], [
                'local_path.string' => 'مسار الملفات يجب أن يكون نص',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 400);
            }

            $archive = MediaArchive::findOrFail($id);

            $updateData = [];
            if ($request->has('local_path')) {
                $updateData['local_path'] = $request->local_path;
            }
            if ($request->has('notes')) {
                $updateData['notes'] = $request->notes;
            }

            $archive->update($updateData);

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث الأرشيف بنجاح',
                'data' => $archive->load(['projectProposal:id,serial_number,project_name', 'archivedBy:id,name'])
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error updating media archive', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث الأرشيف',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified archive
     */
    public function destroy($id)
    {
        try {
            $user = request()->user();
            
            if (!$user || !in_array(strtolower($user->role ?? ''), ['media_manager', 'admin'])) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات لحذف الأرشيف'
                ], 403);
            }

            $archive = MediaArchive::findOrFail($id);
            $archive->delete();

            return response()->json([
                'success' => true,
                'message' => 'تم حذف الأرشيف بنجاح'
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error deleting media archive', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل حذف الأرشيف',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available projects for archiving
     */
    public function getProjectsForArchive(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user || !in_array(strtolower($user->role ?? ''), ['media_manager', 'admin'])) {
                return response()->json([
                    'success' => false,
                    'error' => 'غير مصرح',
                    'message' => 'ليس لديك صلاحيات للوصول'
                ], 403);
            }

            // جلب المشاريع المنفذة المتاحة للأرشفة (تم التنفيذ والمراحل التي تليها)
            // استبعاد المشاريع التي تم أرشفتها بالفعل
            $archivedProjectIds = MediaArchive::pluck('project_proposal_id')->toArray();
            
            $projects = ProjectProposal::whereIn('status', ['تم التنفيذ', 'في المونتاج', 'تم المونتاج', 'وصل للمتبرع'])
                ->whereNotIn('id', $archivedProjectIds)
                ->with(['assignedMontageProducer:id,name'])
                ->select('id', 'serial_number', 'project_name', 'donor_name', 'donor_code', 'internal_code', 'project_type', 'execution_date', 'status', 'assigned_montage_producer_id')
                ->orderBy('execution_date', 'DESC')
                ->get()
                ->map(function ($project) {
                    return [
                        'id' => $project->id,
                        'serial_number' => $project->serial_number,
                        'project_name' => $project->project_name,
                        'donor_name' => $project->donor_name,
                        'donor_code' => $project->donor_code,
                        'internal_code' => $project->internal_code,
                        'project_type' => $project->project_type,
                        'execution_date' => $project->execution_date,
                        'status' => $project->status,
                        'producer_name' => $project->assignedMontageProducer ? $project->assignedMontageProducer->name : null,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $projects
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error fetching available projects for archive', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'فشل جلب المشاريع',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
