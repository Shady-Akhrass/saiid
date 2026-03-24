<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            margin: 15mm 15mm 25mm 15mm;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'cairo', 'Tajawal', sans-serif;
            direction: rtl;
            text-align: right;
            color: #1e293b;
            margin: 0;
            padding: 0;
            background: #fff;
            font-size: 12px;
            line-height: 1.6;
        }

        /* ===== HEADER ===== */
        .header {
            width: 100%;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }

        .header-table {
            width: 100%;
            border-collapse: collapse;
        }

        .header-table td {
            width: 33.33%;
            vertical-align: middle;
        }

        .institution-ar {
            font-weight: bold;
            font-size: 14px;
            text-align: right;
            line-height: 1.8;
        }

        .institution-en {
            font-weight: bold;
            font-size: 12px;
            text-align: left;
            font-family: Arial, sans-serif;
            line-height: 1.8;
            white-space: nowrap;
        }

        .logo-container {
            text-align: center;
        }

        .logo {
            max-height: 100px;
        }

        /* ===== TITLE ===== */
        .title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 18px;
        }

        /* ===== PROFILE SECTION ===== */
        .profile-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
        }

        .profile-table td {
            vertical-align: top;
        }

        .photo-cell {
            width: 90px;
            padding-left: 10px;
        }

        .photo-box {
            width: 80px;
            height: 120px;
            border: 2px solid #cbd5e1;
            border-radius: 4px;
            text-align: center;
            overflow: hidden;
            background-color: #f8fafc;
        }

        .photo-box img {
            width: 80px;
            height: 120px;
            display: block;
        }

        .no-photo {
            padding-top: 50px;
            color: #94a3b8;
            font-size: 11px;
            font-weight: bold;
        }

        .photo-id {
            width: 80px;
            text-align: center;
            margin-top: 6px;
            font-size: 10px;
            color: #fff;
            background-color: #2563eb;
            padding: 3px 0;
            font-weight: bold;
            border-radius: 0 0 4px 4px;
        }

        /* ===== ORPHAN NAME ===== */
        .orphan-name {
            font-size: 16px;
            font-weight: bold;
            color: #1e40af;
            padding-bottom: 6px;
            margin-bottom: 15px; /* Increased margin */
            border-bottom: none; /* Removed underline */
        }

        /* ===== INFO TABLE ===== */
        .info-table {
            width: 100%;
            border-collapse: collapse;
        }

        .info-table tr {
            border-bottom: 1px solid #f1f5f9;
        }

        .info-table tr:last-child {
            border-bottom: none;
        }

        .info-table td {
            padding: 5px 4px;
            vertical-align: top;
        }

        .info-table .lbl {
            width: 120px;
            font-weight: bold;
            color: #475569;
            font-size: 11px;
        }

        .info-table .lbl::after {
            content: ':';
        }

        .info-table .val {
            color: #1e293b;
            font-size: 12px;
            font-weight: 600;
        }

        /* ===== INFO CARDS ===== */
        .info-card {
            border: 1px solid #e2e8f0;
            margin-bottom: 14px;
            overflow: hidden;
        }

        .info-card-body {
            padding: 6px 14px;
        }

        /* ===== BADGES ===== */
        .badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
        }

        .badge-green {
            background-color: #dcfce7;
            color: #166534;
        }

        .badge-red {
            background-color: #fee2e2;
            color: #991b1b;
        }

        .badge-blue {
            background-color: #dbeafe;
            color: #1e40af;
        }

        .badge-amber {
            background-color: #fef3c7;
            color: #92400e;
        }

        /* ===== TWO COLUMN ===== */
        .two-col {
            width: 100%;
            border-collapse: separate;
            border-spacing: 6px 0;
            margin-bottom: 14px;
        }

        .two-col > tbody > tr > td {
            width: 50%;
            vertical-align: top !important; /* Strict top alignment */
        }

        .two-col .info-card {
            margin-bottom: 0;
        }

        /* ===== FATHER GRID ===== */
        .father-grid {
            width: 100%;
            border-collapse: collapse;
        }

        .father-grid td {
            width: 33.33%;
            padding: 8px 6px;
            vertical-align: top;
        }

        .father-grid .f-label {
            font-weight: bold;
            color: #475569;
            font-size: 11px;
            display: block;
            margin-bottom: 2px;
        }

        .father-grid .f-value {
            font-size: 12px;
            font-weight: 600;
            color: #1e293b;
        }

        /* ===== SPONSORSHIP TABLE ===== */
        .sponsor-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            font-size: 11px;
        }

        .sponsor-table thead tr {
            background-color: #f1f5f9;
        }

        .sponsor-table th {
            padding: 7px 10px;
            text-align: right;
            font-weight: bold;
            color: #334155;
            border-bottom: 2px solid #cbd5e1;
            font-size: 11px;
        }

        .sponsor-table td {
            padding: 6px 10px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
        }

        .sponsor-table tbody tr:nth-child(even) {
            background-color: #f8fafc;
        }

        .sponsor-table .amount {
            font-weight: bold;
            color: #059669;
        }

        .sponsor-count-badge {
            display: inline-block;
            padding: 1px 10px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
            margin-right: 10px;
        }

        /* ===== FOOTER ===== */
        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
            padding: 8px 15mm;
            background-color: #fff;
        }

        .footer-line {
            height: 2px;
            background-color: #3b82f6;
            margin-bottom: 8px;
        }

        .footer-table {
            width: 100%;
            border-collapse: collapse;
        }

        .footer-table td {
            font-size: 9px;
            color: #94a3b8;
            padding: 0;
        }
    </style>
</head>
<body>

    <!-- HEADER -->
    <div class="header">
        <table class="header-table">
            <tr>
                <td class="institution-ar">
                    جمعية ساعد للتنمية البشرية<br>
                    فلسطين - غزة - خانيونس<br>
                    رقم ترخيص: 7777 - 2006م
                </td>
                <td class="logo-container">
                    @if(file_exists(public_path('logo/logo.jpg')))
                        <img src="{{ public_path('logo/logo.jpg') }}" class="logo" alt="Logo">
                    @endif
                </td>
                <td class="institution-en">
                    SAEED Association for Human Development<br>
                    Palestine - Gaza - Khan Younis<br>
                    License No: 7777 - 2006
                </td>
            </tr>
        </table>
    </div>

    <!-- TITLE -->
    @if($orphan->sponsoredProjects && $orphan->sponsoredProjects->count() > 0)
        <div class="title">بطاقة كفالة يتيم</div>
    @else
        <div class="title">بطاقة يتيم</div>
    @endif

    <!-- PROFILE WITH PHOTO -->
    @php
        $photoBase64 = null;
        $photoFound = false;
        
        // 1. Try directly from database path
        if (!empty($orphan->orphan_photo)) {
            $dbPath = public_path($orphan->orphan_photo);
            if (file_exists($dbPath) && !is_dir($dbPath)) {
                $photoPath = $dbPath;
                $photoFound = true;
            }
        }
        
        // 2. Try common patterns if not found
        if (!$photoFound) {
            $extensions = ['jpg', 'jpeg', 'png', 'gif'];
            foreach ($extensions as $ext) {
                $testPath = public_path('orphan_photos/' . $orphan->orphan_id_number . '.' . $ext);
                if (file_exists($testPath)) {
                    $photoPath = $testPath;
                    $photoFound = true;
                    break;
                }
            }
        }
        
        // 3. We NO LONGER use base64 to avoid memory exhaustion (500 errors)
        // mPDF can handle local file paths directly if passed correctly.
    @endphp

    <table class="profile-table">
        <tr>
            <td>
                <div class="orphan-name">{{ $orphan->orphan_full_name }}</div>
                <table class="info-table">
                    <tr>
                        <td class="lbl">رقم الهوية</td>
                        <td class="val">{{ $orphan->orphan_id_number }}</td>
                    </tr>
                    <tr>
                        <td class="lbl">الجنس</td>
                        <td class="val">
                            <span class="badge {{ $orphan->orphan_gender == 'ذكر' ? 'badge-blue' : 'badge-amber' }}">{{ $orphan->orphan_gender }}</span>
                        </td>
                    </tr>
                    <tr>
                        <td class="lbl">تاريخ الميلاد</td>
                        <td class="val">{{ $orphan->orphan_birth_date }}</td>
                    </tr>
                    <tr>
                        <td class="lbl">الحالة الصحية</td>
                        <td class="val">
                            {{ $orphan->health_status }}
                            @if($orphan->disease_description)
                                <div style="font-size: 10px; color: #64748b; font-weight: normal; margin-top: 2px;">
                                    ({{ $orphan->disease_description }})
                                </div>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td class="lbl">العنوان الحالي</td>
                        <td class="val">{{ $orphan->current_address }}</td>
                    </tr>
                    @if($orphan->address_details)
                    <tr>
                        <td class="lbl">تفاصيل العنوان</td>
                        <td class="val">{{ $orphan->address_details }}</td>
                    </tr>
                    @endif
                </table>
            </td>
            <td class="photo-cell">
                <div class="photo-box">
                    @if($photoFound) 
                        <img src="{{ $photoPath }}" width="80" height="120" alt="صورة اليتيم">
                    @else
                        <div class="no-photo">لا توجد صورة</div>
                    @endif
                </div>
                <div class="photo-id">{{ $orphan->orphan_id_number }}</div>
            </td>
        </tr>
    </table>

  <!-- FAMILY & GUARDIAN -->
<table width="100%" cellpadding="0" cellspacing="4" style="border-collapse: separate; margin-bottom: 14px;">
    <tr>
        <td width="50%" valign="top" style="vertical-align: top;">
            <div class="info-card">
                <table style="width:100%; border-collapse:collapse;">
                    <tr>
                        <td style="background-color:#2563eb; color:#fff; padding:6px 14px; font-weight:bold; font-size:13px;">
                            بيانات العائلة
                        </td>
                    </tr>
                </table>
                <div class="info-card-body">
                    <table class="info-table">
                        <tr>
                            <td class="lbl">عدد الإخوة</td>
                            <td class="val">
                                <span class="badge badge-blue">{{ $orphan->number_of_brothers }} ذكور</span>
                                <span class="badge badge-amber">{{ $orphan->number_of_sisters }} إناث</span>
                            </td>
                        </tr>
                        <tr>
                            <td class="lbl">التحفيظ</td>
                            <td class="val">
                                @if($orphan->is_enrolled_in_memorization_center)
                                    <span class="badge badge-green">ملتحق بمركز تحفيظ</span>
                                @else
                                    <span class="badge badge-red">غير ملتحق</span>
                                @endif
                            </td>
                        </tr>
                        <tr>
                            <td colspan="2" style="height: 10px;"></td>
                        </tr>
                    </table>
                </div>
            </div>
        </td>
        <td width="50%" valign="top" style="vertical-align: top;">
            <div class="info-card">
                <table style="width:100%; border-collapse:collapse;">
                    <tr>
                        <td style="background-color:#2563eb; color:#fff; padding:6px 14px; font-weight:bold; font-size:13px;">
                            بيانات الوصي
                        </td>
                    </tr>
                </table>
                <div class="info-card-body">
                    <table class="info-table">
                        <tr>
                            <td class="lbl">اسم الوصي</td>
                            <td class="val">{{ $orphan->guardian_full_name }}</td>
                        </tr>
                        <tr>
                            <td class="lbl">رقم الهوية</td>
                            <td class="val">{{ $orphan->guardian_id_number }}</td>
                        </tr>
                        <tr>
                            <td class="lbl">رقم الهاتف</td>
                            <td class="val">{{ $orphan->guardian_phone_number }}</td>
                        </tr>
                        <tr>
                            <td class="lbl">العلاقة باليتيم</td>
                            <td class="val">
                                <span class="badge badge-blue">{{ $orphan->guardian_relationship }}</span>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="2" style="height: 10px;"></td>
                        </tr>
                    </table>
                </div>
            </div>
        </td>
    </tr>
</table>

    <!-- MOTHER'S DATA -->
    @php
        $isMotherDeceased = in_array(strtolower(trim($orphan->is_mother_deceased ?? '')), ['yes', 'نعم', 'true', '1', 1, true], true);
    @endphp
    <div class="info-card">
        <table style="width:100%; border-collapse:collapse;">
            <tr>
                <td style="background-color:{{ $isMotherDeceased ? '#64748b' : '#2563eb' }}; color:#fff; padding:6px 14px; font-weight:bold; font-size:13px;">
                    بيانات الأم @if($isMotherDeceased) متوفاة - رحمها الله @endif
                </td>
            </tr>
        </table>
        <div class="info-card-body">
            <table class="father-grid">
                <tr>
                    <td>
                        <span class="f-label">اسم الأم:</span>
                        <span class="f-value">{{ $orphan->mother_full_name }}</span>
                    </td>
                    <td>
                        <span class="f-label">رقم الهوية:</span>
                        <span class="f-value">{{ $orphan->mother_id_number }}</span>
                    </td>
                    <td>
                        <span class="f-label">تاريخ الميلاد:</span>
                        <span class="f-value">{{ $orphan->mother_birth_date ? ($orphan->mother_birth_date instanceof \Carbon\Carbon ? $orphan->mother_birth_date->format('Y/m/d') : $orphan->mother_birth_date) : '—' }}</span>
                    </td>
                </tr>
                <tr>
                    <td>
                        <span class="f-label">حالة الأم:</span>
                        <span class="f-value">
                            @if($isMotherDeceased)
                                <span class="badge badge-red">متوفاة</span>
                            @else
                                <span class="badge badge-blue">{{ $orphan->mother_status }}</span>
                            @endif
                        </span>
                    </td>
                    <td>
                        <span class="f-label">المهنة:</span>
                        <span class="f-value">{{ $orphan->mother_job ?: '—' }}</span>
                    </td>
                    <td>
                        @if($isMotherDeceased)
                            <span class="f-label">تاريخ الوفاة:</span>
                            <span class="f-value">{{ $orphan->mother_death_date ? ($orphan->mother_death_date instanceof \Carbon\Carbon ? $orphan->mother_death_date->format('Y/m/d') : $orphan->mother_death_date) : '—' }}</span>
                        @endif
                    </td>
                </tr>
            </table>
        </div>
    </div>

    <!-- DECEASED FATHER -->
    <div class="info-card">
        <table style="width:100%; border-collapse:collapse;">
            <tr>
                <td style="background-color:#64748b; color:#fff; padding:6px 14px; font-weight:bold; font-size:13px;">
                    بيانات الأب المتوفى - رحمه الله
                </td>
            </tr>
        </table>
        <div class="info-card-body">
            <table class="father-grid">
                <tr>
                    <td>
                        <span class="f-label">اسم الأب:</span>
                        <span class="f-value">{{ $orphan->deceased_father_full_name }}</span>
                    </td>
                    <td>
                        <span class="f-label">تاريخ الوفاة:</span>
                        <span class="f-value">{{ $orphan->death_date }}</span>
                    </td>
                    <td>
                        <span class="f-label">سبب الوفاة:</span>
                        <span class="f-value">{{ $orphan->death_cause }}</span>
                    </td>
                </tr>
            </table>
        </div>
    </div>

    <!-- SPONSORSHIP PROJECTS -->
    @if($orphan->sponsoredProjects && $orphan->sponsoredProjects->count() > 0)
    <div class="info-card">
        <table style="width:100%; border-collapse:collapse;">
            <tr>
                <td style="background-color:#ea580c; color:#fff; padding:6px 14px; font-weight:bold; font-size:13px;">
                    بيانات الكفالات والمشاريع
                    <span class="sponsor-count-badge">{{ $orphan->sponsoredProjects->count() }} كفالة</span>
                </td>
            </tr>
        </table>
        <div class="info-card-body" style="padding: 4px 8px;">
            <table class="sponsor-table">
                <thead>
                    <tr>
                        <th style="width: 5%;">#</th>
                        <th>اسم الكافل</th>
                        <th>المشروع</th>
                        <th style="width: 15%;">المبلغ</th>
                        <th style="width: 10%;">النوع</th>
                        <th style="width: 13%;">البداية</th>
                        <th style="width: 13%;">النهاية</th>
                        <th>ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($orphan->sponsoredProjects as $index => $project)
                    <tr>
                        <td style="text-align: center; color: #94a3b8; font-weight: bold;">{{ $index + 1 }}</td>
                        <td style="font-weight: bold; color: #1e40af;">{{ $project->donor_name ?? '—' }}</td>
                        <td style="font-weight: 600;">{{ $project->project_name }}</td>
                        <td class="amount">{{ number_format($project->pivot->sponsorship_amount, 2) }} {{ $project->currency->code ?? '' }}</td>
                        <td>
                            @if($project->pivot->is_recurring)
                                <span class="badge badge-green">دائمة</span>
                            @else
                                <span class="badge badge-amber">مؤقتة</span>
                            @endif
                        </td>
                        <td>{{ $project->pivot->sponsorship_start_date }}</td>
                        <td>{{ $project->pivot->sponsorship_end_date ?? '—' }}</td>
                        <td style="color: #64748b; font-size: 10px;">{{ $project->pivot->notes ?? '—' }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>
    @endif

    <!-- FOOTER -->
    <div class="footer">
        <div class="footer-line"></div>
        <table class="footer-table">
            <tr>
                <td style="text-align: right;">جمعية ساعد للتنمية البشرية</td>
                <td style="text-align: center;">
                    تم استخراج هذا التقرير بتاريخ <strong>{{ date('Y-m-d') }}</strong> — نظام ساعد لإدارة الأيتام
                </td>
                <td style="text-align: left; font-family: Arial, sans-serif;">SAEED Orphan Management System</td>
            </tr>
        </table>
    </div>

</body>
</html>