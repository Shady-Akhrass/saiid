<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'cairo', sans-serif;
            direction: rtl;
            text-align: right;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        .header {
            width: 100%;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 30px;
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
        .title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .subtitle {
            text-align: center;
            font-size: 16px;
            margin-bottom: 25px;
            color: #666;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .data-table th, .data-table td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: right;
            font-size: 12px;
        }
        .data-table th {
            background-color: #f3f4f6;
            color: #2563eb;
            font-weight: bold;
        }
        .footer {
            position: fixed;
            bottom: 0;
            width: 100%;
            text-align: center;
            font-size: 10px;
            color: #999;
            border-top: 1px solid #eee;
            padding-top: 5px;
        }
    </style>
</head>
<body>
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

    <div class="title">تقرير مجموعة أيتام</div>
    <div class="subtitle">{{ $grouping->name }}</div>

    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 50px;">#</th>
                <th>اسم اليتيم</th>
                <th>رقم الهوية</th>
                <th>الجنس</th>
                <th>تاريخ الميلاد</th>
                <th>العنوان</th>
                <th>الحالة الصحية</th>
            </tr>
        </thead>
        <tbody>
            @foreach($orphans as $index => $orphan)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>{{ $orphan->orphan_full_name }}</td>
                <td>{{ $orphan->orphan_id_number }}</td>
                <td>{{ $orphan->orphan_gender }}</td>
                <td>{{ $orphan->orphan_birth_date }}</td>
                <td>{{ $orphan->current_address }}</td>
                <td>{{ $orphan->health_status }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        تم استخراج هذا التقرير بتاريخ {{ date('Y-m-d') }} - عدد الأيتام: {{ $orphans->count() }} - نظام ساعد لإدارة الأيتام
    </div>
</body>
</html>
