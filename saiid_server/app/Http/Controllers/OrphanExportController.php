<?php

namespace App\Http\Controllers;

use App\Models\Orphan;
use App\Models\OrphanGrouping;
use Illuminate\Http\Request;
use Mpdf\Mpdf;
use Mpdf\Config\ConfigVariables;
use Mpdf\Config\FontVariables;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;
use Illuminate\Support\Facades\View;
use App\Exports\OrphanGroupingsAllExport;
use Maatwebsite\Excel\Facades\Excel;

class OrphanExportController extends Controller
{
    private function getMpdf()
    {
        $defaultConfig = (new \Mpdf\Config\ConfigVariables())->getDefaults();
        $fontDirs = $defaultConfig['fontDir'];

        $defaultFontConfig = (new \Mpdf\Config\FontVariables())->getDefaults();
        $fontData = $defaultFontConfig['fontdata'];

        return new Mpdf([
            'fontDir' => array_merge($fontDirs, [
                public_path('fonts'),
            ]),
            'fontdata' => $fontData + [
                'cairo' => [
                    'R' => 'Cairo-Regular.ttf',
                    'useOTL' => 0xFF,
                    'useKashida' => 75,
                ]
            ],
            'default_font' => 'cairo',
            'mode' => 'utf-8',
            'format' => 'A4',
            'margin_left' => 10,
            'margin_right' => 10,
            'margin_top' => 10,
            'margin_bottom' => 10,
            'margin_header' => 0,
            'margin_footer' => 5,
        ]);
    }

    public function exportOrphanPdf($id)
    {
        $orphan = Orphan::where('orphan_id_number', $id)
            ->with(['sponsoredProjects' => function($query) {
                $query->with(['currency', 'projectType']);
            }])
            ->firstOrFail();
        
        // Increase memory and time limit for large PDFs
        ini_set('memory_limit', '256M');
        set_time_limit(120);
        
        $html = View::make('exports.orphan_individual_pdf', compact('orphan'))->render();
        
        $mpdf = $this->getMpdf();
        $mpdf->SetDirectionality('rtl');
        $mpdf->WriteHTML($html);
        
        return response()->streamDownload(function() use ($mpdf) {
            echo $mpdf->Output('', 'S');
        }, "orphan_{$id}.pdf", [
            'Content-Type' => 'application/pdf',
        ]);
    }

    public function exportGroupPdf($id)
    {
        $grouping = OrphanGrouping::findOrFail($id);
        $orphans = $grouping->activeOrphans()->get();
        
        $html = View::make('exports.group_pdf', compact('grouping', 'orphans'))->render();
        
        $mpdf = $this->getMpdf();
        $mpdf->SetDirectionality('rtl');
        $mpdf->WriteHTML($html);
        
        return response()->streamDownload(function() use ($mpdf) {
            echo $mpdf->Output('', 'S');
        }, "group_{$id}.pdf", [
            'Content-Type' => 'application/pdf',
        ]);
    }

    public function exportOrphanWord($id)
    {
        try {
            $orphan = Orphan::where('orphan_id_number', $id)
                ->with(['sponsoredProjects' => function($query) {
                    $query->with(['currency', 'projectType']);
                }])
                ->firstOrFail();
            
            $phpWord = new PhpWord();
            
            $section = $phpWord->addSection();
            
            // Styles
            $paragraphStyle = ['alignment' => 'right', 'rtl' => true];
            $headerStyle = ['bold' => true, 'size' => 16, 'color' => '2563eb'];
            $subHeaderStyle = ['bold' => true, 'size' => 14, 'color' => '333333'];
            $textStyle = ['size' => 12];
            $labelStyle = ['bold' => true, 'size' => 12];

            // Add header with logo
            $header = $section->addHeader();
            $table = $header->addTable();
            $table->addRow();
            
            $headerTextParaStyle = ['alignment' => 'right', 'rtl' => true, 'spaceAfter' => 100];
            $headerTextParaStyleLeft = ['alignment' => 'left', 'spaceAfter' => 100];
            
            $cellAr = $table->addCell(4500);
            $cellAr->addText("جمعية ساعد للتنمية البشرية", ['bold' => true, 'size' => 10, 'rtl' => true], $headerTextParaStyle);
            $cellAr->addText("فلسطين - غزة - خانيونس", ['bold' => true, 'size' => 10, 'rtl' => true], $headerTextParaStyle);
            $cellAr->addText("رقم ترخيص: 7777 - 2006م", ['bold' => true, 'size' => 10, 'rtl' => true], $headerTextParaStyle);
            
            $logoPath = public_path('logo/logo.jpg');
            $logoCell = $table->addCell(2000);
            if (file_exists($logoPath)) {
                $logoCell->addImage($logoPath, ['width' => 80, 'height' => 80, 'align' => 'center']); // Changed 'alignment' to 'align'
            }
            
            $cellEn = $table->addCell(4500);
            $cellEn->addText("SAEED Association for Human Development", ['bold' => true, 'size' => 9], $headerTextParaStyleLeft);
            $cellEn->addText("Palestine - Gaza - Khan Younis", ['bold' => true, 'size' => 9], $headerTextParaStyleLeft);
            $cellEn->addText("License No: 7777 - 2006", ['bold' => true, 'size' => 9], $headerTextParaStyleLeft);

            $section->addText('بطاقة كفالة يتيم', $headerStyle, ['alignment' => 'center', 'rtl' => true]);
            $section->addTextBreak(1);

            // Basic Info
            $section->addText("البيانات الأساسية", $subHeaderStyle, $paragraphStyle);
            $section->addText("الاسم الكامل: {$orphan->orphan_full_name}", $textStyle, $paragraphStyle);
            $section->addText("رقم الهوية: {$orphan->orphan_id_number}", $textStyle, $paragraphStyle);
            $section->addText("الجنس: {$orphan->orphan_gender}", $textStyle, $paragraphStyle);
            $section->addText("تاريخ الميلاد: {$orphan->orphan_birth_date}", $textStyle, $paragraphStyle);
            $section->addText("العنوان الحالي: {$orphan->current_address}", $textStyle, $paragraphStyle);
            if ($orphan->address_details) {
                $section->addText("تفاصيل العنوان: {$orphan->address_details}", $textStyle, $paragraphStyle);
            }
            $section->addText("الحالة الصحية: {$orphan->health_status}", $textStyle, $paragraphStyle);
            if ($orphan->disease_description) {
                $section->addText("وصف الحالة الصحية: {$orphan->disease_description}", $textStyle, $paragraphStyle);
            }
            $section->addText("ملتحق بمركز تحفيظ: " . ($orphan->is_enrolled_in_memorization_center ? 'نعم' : 'لا'), $textStyle, $paragraphStyle);

            $section->addTextBreak(1);

            // Family Info
            $section->addText("بيانات العائلة", $subHeaderStyle, $paragraphStyle);
            $section->addText("عدد الإخوة الذكور: {$orphan->number_of_brothers}", $textStyle, $paragraphStyle);
            $section->addText("عدد الأخوات الإناث: {$orphan->number_of_sisters}", $textStyle, $paragraphStyle);
            $section->addText("اسم الأم: {$orphan->mother_full_name}", $textStyle, $paragraphStyle);
            $section->addText("حالة الأم الوظيفية: {$orphan->mother_job}", $textStyle, $paragraphStyle);
            
            $section->addTextBreak(1);
            $section->addText("بيانات الأب المتوفى", $subHeaderStyle, $paragraphStyle);
            $section->addText("اسم الأب: {$orphan->deceased_father_full_name}", $textStyle, $paragraphStyle);
            $section->addText("تاريخ الوفاة: {$orphan->death_date}", $textStyle, $paragraphStyle);
            $section->addText("سبب الوفاة: {$orphan->death_cause}", $textStyle, $paragraphStyle);

            $section->addTextBreak(1);
            $section->addText("بيانات الوصي", $subHeaderStyle, $paragraphStyle);
            $section->addText("اسم الوصي: {$orphan->guardian_full_name}", $textStyle, $paragraphStyle);
            $section->addText("العلاقة: {$orphan->guardian_relationship}", $textStyle, $paragraphStyle);
            $section->addText("رقم هاتف الوصي: {$orphan->guardian_phone_number}", $textStyle, $paragraphStyle);

            // Sponsorship Info
            if ($orphan->sponsoredProjects->count() > 0) {
                $section->addTextBreak(1);
                $section->addText("بيانات الكفالات والمشاريع المستفيد منها", $subHeaderStyle, $paragraphStyle);
                
                // Assuming $orphan->photo_path exists and is a valid path to the orphan's photo
                // If not, you'll need to define $photoPath based on your application's logic
                $photoPath = public_path('path/to/orphan/photos/' . $orphan->orphan_id_number . '.jpg'); // Example path
                if (file_exists($photoPath)) {
                    $section->addImage($photoPath, [
                        'width' => 80,
                        'height' => 120,
                        'align' => 'right',
                    ]);
                }
                
                $tableStyle = [
                    'borderSize' => 6,
                    'borderColor' => '999999',
                    'cellMargin' => 80
                ];
                $phpWord->addTableStyle('SponsorshipTable', $tableStyle);
                $table = $section->addTable('SponsorshipTable');
                
                $table->addRow();
                $table->addCell(3000)->addText('اسم المشروع', $labelStyle, $paragraphStyle);
                $table->addCell(1500)->addText('المبلغ', $labelStyle, $paragraphStyle);
                $table->addCell(1500)->addText('النوع', $labelStyle, $paragraphStyle);
                $table->addCell(1500)->addText('تاريخ البداية', $labelStyle, $paragraphStyle);
                $table->addCell(1500)->addText('تاريخ النهاية', $labelStyle, $paragraphStyle);
                $table->addCell(2000)->addText('ملاحظات', $labelStyle, $paragraphStyle);

                foreach ($orphan->sponsoredProjects as $project) {
                    $table->addRow();
                    $table->addCell(3000)->addText($project->project_name, $textStyle, $paragraphStyle);
                    $table->addCell(1500)->addText($project->pivot->sponsorship_amount . ' ' . ($project->currency->code ?? ''), $textStyle, $paragraphStyle);
                    $table->addCell(1500)->addText($project->pivot->is_recurring ? 'دائمة' : 'مؤقتة', $textStyle, $paragraphStyle);
                    $table->addCell(1500)->addText($project->pivot->sponsorship_start_date, $textStyle, $paragraphStyle);
                    $table->addCell(1500)->addText($project->pivot->sponsorship_end_date ?? '-', $textStyle, $paragraphStyle);
                    $table->addCell(2000)->addText($project->pivot->notes ?? '-', $textStyle, $paragraphStyle);
                }
            }

            $section->addFooter()->addText("تم استخراج التقرير بتاريخ " . date('Y-m-d'), ['size' => 9], ['alignment' => 'center', 'rtl' => true]);

            $objWriter = IOFactory::createWriter($phpWord, 'Word2007');
            
            $filename = "orphan_{$id}.docx";
            $tempFile = tempnam(sys_get_temp_dir(), 'phpword');
            $objWriter->save($tempFile);

            return response()->download($tempFile, $filename)->deleteFileAfterSend(true);
        } catch (\Exception $e) {
            \Log::error("Word Export Error: " . $e->getMessage());
            return response()->json(['error' => 'Failed to generate Word document: ' . $e->getMessage()], 500);
        }
    }

    public function exportGroupWord($id)
    {
        try {
            $grouping = OrphanGrouping::findOrFail($id);
            $orphans = $grouping->activeOrphans()->get();
            
            $phpWord = new PhpWord();
            
            $section = $phpWord->addSection(['orientation' => 'landscape']);
            
            // Styles
            $paragraphStyle = ['alignment' => 'right', 'rtl' => true];
            $headerStyle = ['bold' => true, 'size' => 16, 'color' => '2563eb'];
            $subHeaderStyle = ['bold' => true, 'size' => 14, 'color' => '333333'];
            $textStyle = ['size' => 10];
            $labelStyle = ['bold' => true, 'size' => 10];

            // Add header with logo
            $header = $section->addHeader();
            $table = $header->addTable();
            $table->addRow();
            
            $headerTextParaStyle = ['alignment' => 'right', 'rtl' => true, 'spaceAfter' => 100];
            $headerTextParaStyleLeft = ['alignment' => 'left', 'spaceAfter' => 100];
            
            $cellAr = $table->addCell(6000);
            $cellAr->addText("جمعية ساعد للتنمية البشرية", ['bold' => true, 'size' => 12, 'rtl' => true], $headerTextParaStyle);
            $cellAr->addText("فلسطين - غزة - خانيونس", ['bold' => true, 'size' => 11, 'rtl' => true], $headerTextParaStyle);
            $cellAr->addText("رقم ترخيص: 7777 - 2006م", ['bold' => true, 'size' => 11, 'rtl' => true], $headerTextParaStyle);
            
            $logoPath = public_path('logo/logo.jpg');
            $logoCell = $table->addCell(3000);
            if (file_exists($logoPath)) {
                $logoCell->addImage($logoPath, ['width' => 90, 'height' => 90, 'align' => 'center']);
            }
            
            $cellEn = $table->addCell(6000);
            $cellEn->addText("SAEED Association for Human Development", ['bold' => true, 'size' => 11], $headerTextParaStyleLeft);
            $cellEn->addText("Palestine - Gaza - Khan Younis", ['bold' => true, 'size' => 10], $headerTextParaStyleLeft);
            $cellEn->addText("License No: 7777 - 2006", ['bold' => true, 'size' => 10], $headerTextParaStyleLeft);

            $section->addText("تقرير مجموعة أيتام: {$grouping->name}", $headerStyle, ['alignment' => 'center', 'rtl' => true]);
            $section->addTextBreak(1);

            // Table of Orphans
            $tableStyle = [
                'borderSize' => 6,
                'borderColor' => '999999',
                'cellMargin' => 80
            ];
            $phpWord->addTableStyle('OrphansTable', $tableStyle);
            $table = $section->addTable('OrphansTable');
            
            $table->addRow();
            $table->addCell(500)->addText('#', $labelStyle, $paragraphStyle);
            $table->addCell(3000)->addText('اسم اليتيم', $labelStyle, $paragraphStyle);
            $table->addCell(2000)->addText('رقم الهوية', $labelStyle, $paragraphStyle);
            $table->addCell(1000)->addText('الجنس', $labelStyle, $paragraphStyle);
            $table->addCell(1500)->addText('تاريخ الميلاد', $labelStyle, $paragraphStyle);
            $table->addCell(3000)->addText('العنوان', $labelStyle, $paragraphStyle);
            $table->addCell(2000)->addText('الحالة الصحية', $labelStyle, $paragraphStyle);

            foreach ($orphans as $index => $orphan) {
                $table->addRow();
                $table->addCell(500)->addText($index + 1, $textStyle, $paragraphStyle);
                $table->addCell(3000)->addText($orphan->orphan_full_name, $textStyle, $paragraphStyle);
                $table->addCell(2000)->addText($orphan->orphan_id_number, $textStyle, $paragraphStyle);
                $table->addCell(1000)->addText($orphan->orphan_gender, $textStyle, $paragraphStyle);
                $table->addCell(1500)->addText($orphan->orphan_birth_date, $textStyle, $paragraphStyle);
                $table->addCell(3000)->addText($orphan->current_address, $textStyle, $paragraphStyle);
                $table->addCell(2000)->addText($orphan->health_status, $textStyle, $paragraphStyle);
            }

            $section->addFooter()->addText("تم استخراج التقرير بتاريخ " . date('Y-m-d') . " - عدد الأيتام: " . $orphans->count(), ['size' => 9], ['alignment' => 'center', 'rtl' => true]);

            $objWriter = IOFactory::createWriter($phpWord, 'Word2007');
            
            $filename = "group_{$id}.docx";
            $tempFile = tempnam(sys_get_temp_dir(), 'phpword');
            $objWriter->save($tempFile);

            return response()->download($tempFile, $filename)->deleteFileAfterSend(true);
        } catch (\Exception $e) {
            \Log::error("Group Word Export Error: " . $e->getMessage());
            return response()->json(['error' => 'Failed to generate Word document: ' . $e->getMessage()], 500);
        }
    }

    public function exportAllGroupsExcel(Request $request)
    {
        $columns = $request->input('columns', []);
        if (is_string($columns)) {
            $columns = explode(',', $columns);
        }
        
        $statusFilter = $request->input('statusFilter', 'all');
        
        return Excel::download(new OrphanGroupingsAllExport($columns, $statusFilter), 'all_orphan_groupings_custom.xlsx');
    }
}
