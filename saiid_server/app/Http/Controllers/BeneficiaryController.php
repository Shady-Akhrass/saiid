<?php

namespace App\Http\Controllers;

use App\Models\Beneficiary;
use App\Models\ProjectProposal;
use App\Imports\BeneficiariesImport;
use App\Exports\BeneficiariesTemplateExport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class BeneficiaryController extends Controller
{
    /**
     * Upload Excel file for beneficiaries
     */
    public function uploadExcel(Request $request, $projectId)
    {
        $user = $request->user();
        
        // Check permissions
        if (!$user || !in_array(strtolower($user->role ?? ''), ['admin', 'executed_projects_coordinator'])) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات لرفع ملف Excel للمستفيدين'
            ], 403);
        }

        // Find project
        $project = ProjectProposal::find($projectId);
        if (!$project) {
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود',
                'message' => 'المشروع المحدد غير موجود'
            ], 404);
        }

        // Check project status - السماح بجميع الحالات بعد "تم التنفيذ"
        $executedStatuses = ['تم التنفيذ', 'منفذ', 'في المونتاج', 'تم المونتاج', 'معاد مونتاجه', 'وصل للمتبرع'];
        if (!in_array($project->status, $executedStatuses)) {
            return response()->json([
                'success' => false,
                'error' => 'حالة المشروع غير صحيحة',
                'message' => 'يمكن رفع ملف Excel للمستفيدين فقط للمشاريع في حالة "تم التنفيذ" أو ما بعدها'
            ], 400);
        }

        // Validate file
        $validator = Validator::make($request->all(), [
            'file' => 'required|mimes:xlsx,xls,csv|max:10240', // 10MB max
        ], [
            'file.required' => 'يرجى اختيار ملف Excel',
            'file.mimes' => 'يجب أن يكون الملف بصيغة Excel (xlsx, xls, csv)',
            'file.max' => 'حجم الملف يجب أن يكون أقل من 10 ميجابايت'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 400);
        }

        try {
            // Delete old file if exists
            if ($project->beneficiaries_excel_file) {
                $oldFilePath = public_path($project->beneficiaries_excel_file);
                if (file_exists($oldFilePath)) {
                    @unlink($oldFilePath);
                }
            }

            // Delete old beneficiaries
            Beneficiary::where('project_proposal_id', $projectId)->delete();

            // Save file
            $file = $request->file('file');
            $timestamp = time();
            $fileName = "project_{$projectId}_{$timestamp}." . $file->extension();
            $filePath = 'beneficiaries_excel/' . $fileName;
            $fullPath = public_path('beneficiaries_excel');

            // Create directory if not exists
            if (!file_exists($fullPath)) {
                mkdir($fullPath, 0755, true);
            }

            // Move file
            $file->move($fullPath, $fileName);

            // Update project
            $project->beneficiaries_excel_file = $filePath;
            $project->save();

            // Import beneficiaries
            $import = new BeneficiariesImport($projectId);
            
            // حساب عدد المستفيدين قبل الاستيراد
            $beneficiariesCountBefore = Beneficiary::where('project_proposal_id', $projectId)->count();
            
            Excel::import($import, $fullPath . '/' . $fileName);
            
            // حساب عدد المستفيدين بعد الاستيراد
            $beneficiariesCountAfter = Beneficiary::where('project_proposal_id', $projectId)->count();
            $importedCount = $beneficiariesCountAfter - $beneficiariesCountBefore;
            
            $errors = $import->getErrors();

            return response()->json([
                'success' => true,
                'message' => 'تم رفع ملف Excel واستيراد المستفيدين بنجاح',
                'imported_count' => $importedCount,
                'total_beneficiaries' => $beneficiariesCountAfter,
                'errors' => $errors,
                'file_path' => $filePath
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error uploading beneficiaries Excel: ' . $e->getMessage(), [
                'project_id' => $projectId,
                'user_id' => $user->id ?? null
            ]);

            return response()->json([
                'success' => false,
                'error' => 'حدث خطأ أثناء رفع الملف',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get beneficiaries for a project
     */
    public function getBeneficiaries($projectId)
    {
        $project = ProjectProposal::find($projectId);
        if (!$project) {
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود'
            ], 404);
        }

        $beneficiaries = $project->beneficiaries()->get();

        return response()->json([
            'success' => true,
            'data' => $beneficiaries,
            'count' => $beneficiaries->count()
        ], 200);
    }

    /**
     * Delete beneficiaries for a project
     */
    public function deleteBeneficiaries($projectId)
    {
        $user = request()->user();
        
        // Check permissions
        if (!$user || !in_array(strtolower($user->role ?? ''), ['admin', 'executed_projects_coordinator'])) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات لحذف المستفيدين'
            ], 403);
        }

        $project = ProjectProposal::find($projectId);
        if (!$project) {
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود'
            ], 404);
        }

        try {
            // Delete beneficiaries
            $deletedCount = Beneficiary::where('project_proposal_id', $projectId)->delete();

            // Delete file
            if ($project->beneficiaries_excel_file) {
                $filePath = public_path($project->beneficiaries_excel_file);
                if (file_exists($filePath)) {
                    @unlink($filePath);
                }
                $project->beneficiaries_excel_file = null;
                $project->save();
            }

            return response()->json([
                'success' => true,
                'message' => 'تم حذف المستفيدين بنجاح',
                'deleted_count' => $deletedCount
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error deleting beneficiaries: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'حدث خطأ أثناء حذف المستفيدين',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export beneficiaries to Excel
     */
    public function exportBeneficiaries($projectId)
    {
        $project = ProjectProposal::find($projectId);
        if (!$project) {
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود'
            ], 404);
        }

        $beneficiaries = $project->beneficiaries()->get();

        return Excel::download(new class($beneficiaries) implements FromCollection, WithHeadings {
            private $beneficiaries;

            public function __construct($beneficiaries)
            {
                $this->beneficiaries = $beneficiaries;
            }

            public function collection()
            {
                return $this->beneficiaries->map(function ($beneficiary) {
                    return [
                        'الاسم' => $beneficiary->name,
                        'رقم الهوية' => $beneficiary->id_number,
                        'رقم الهاتف' => $beneficiary->phone,
                        'العنوان' => $beneficiary->address,
                        'المحافظة' => $beneficiary->governorate,
                        'المنطقة' => $beneficiary->district,
                        'نوع المساعدة' => $beneficiary->aid_type,
                        'ملاحظات' => $beneficiary->notes,
                    ];
                });
            }

            public function headings(): array
            {
                return [
                    'الاسم',
                    'رقم الهوية',
                    'رقم الهاتف',
                    'العنوان',
                    'المحافظة',
                    'المنطقة',
                    'نوع المساعدة',
                    'ملاحظات',
                ];
            }
        }, "beneficiaries_project_{$projectId}.xlsx");
    }

    /**
     * Download Excel template for beneficiaries
     * Returns an empty Excel file with column headers only
     */
    public function downloadTemplate($id)
    {
        $user = request()->user();
        
        // Check permissions
        if (!$user || !in_array(strtolower($user->role ?? ''), ['admin', 'executed_projects_coordinator'])) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات لتنزيل قالب Excel للمستفيدين'
            ], 403);
        }

        // Verify project exists
        $project = ProjectProposal::find($id);
        if (!$project) {
            return response()->json([
                'success' => false,
                'error' => 'المشروع غير موجود',
                'message' => 'المشروع المحدد غير موجود'
            ], 404);
        }
        
        $fileName = "beneficiaries_template_project_{$id}.xlsx";

        // Pass project ID to export class to get aid_type from subcategory
        return Excel::download(new BeneficiariesTemplateExport($id), $fileName);
    }

    /**
     * Get statistics for beneficiaries by aid type
     */
    public function getStatistics()
    {
        $user = request()->user();
        
        // Check permissions - Admin only
        if (!$user || strtolower($user->role ?? '') !== 'admin') {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'الإحصائيات متاحة للإدارة فقط'
            ], 403);
        }

        try {
            // Get all unique aid types
            $aidTypes = Beneficiary::whereNotNull('aid_type')
                ->groupBy('aid_type')
                ->pluck('aid_type');

            $statistics = [];
            foreach ($aidTypes as $aidType) {
                $count = Beneficiary::getUniqueBeneficiariesCountByAidType($aidType);
                $statistics[] = [
                    'aid_type' => $aidType,
                    'unique_beneficiaries_count' => $count
                ];
            }

            // Total unique beneficiaries across all types
            $totalUnique = Beneficiary::groupBy('id_number')->count();

            return response()->json([
                'success' => true,
                'data' => [
                    'by_aid_type' => $statistics,
                    'total_unique_beneficiaries' => $totalUnique
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error getting beneficiaries statistics: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'حدث خطأ أثناء جلب الإحصائيات',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get unique beneficiaries by aid type
     */
    public function getUniqueBeneficiariesByAidType($aidType)
    {
        $user = request()->user();
        
        // Check permissions - Admin only
        if (!$user || strtolower($user->role ?? '') !== 'admin') {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'هذه البيانات متاحة للإدارة فقط'
            ], 403);
        }

        try {
            $beneficiaries = Beneficiary::getUniqueBeneficiariesByAidType($aidType);

            return response()->json([
                'success' => true,
                'aid_type' => $aidType,
                'data' => $beneficiaries,
                'count' => $beneficiaries->count()
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error getting beneficiaries by aid type: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'حدث خطأ أثناء جلب البيانات',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get beneficiaries counts for multiple projects (optimized for performance)
     * ✅ تحسين الأداء: جلب عدد المستفيدين لعدة مشاريع في طلب واحد
     */
    public function getBeneficiariesCounts(Request $request)
    {
        $user = $request->user();
        
        // Check permissions
        if (!$user || !in_array(strtolower($user->role ?? ''), ['admin', 'executed_projects_coordinator'])) {
            return response()->json([
                'success' => false,
                'error' => 'غير مصرح',
                'message' => 'ليس لديك صلاحيات لجلب عدد المستفيدين'
            ], 403);
        }

        try {
            $projectIds = $request->input('project_ids', []);
            
            if (empty($projectIds) || !is_array($projectIds)) {
                return response()->json([
                    'success' => false,
                    'error' => 'معاملات غير صحيحة',
                    'message' => 'يجب إرسال قائمة معرفات المشاريع (project_ids)'
                ], 400);
            }

            // ✅ جلب عدد المستفيدين لجميع المشاريع في query واحد
            $counts = Beneficiary::whereIn('project_proposal_id', $projectIds)
                ->selectRaw('project_proposal_id, COUNT(*) as count')
                ->groupBy('project_proposal_id')
                ->pluck('count', 'project_proposal_id')
                ->toArray();

            // ✅ إضافة 0 للمشاريع التي لا تحتوي على مستفيدين
            $result = [];
            foreach ($projectIds as $projectId) {
                $result[$projectId] = $counts[$projectId] ?? 0;
            }

            return response()->json([
                'success' => true,
                'data' => $result,
                'total_projects' => count($projectIds),
                'projects_with_beneficiaries' => count($counts)
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error getting beneficiaries counts: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'حدث خطأ أثناء جلب عدد المستفيدين',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
