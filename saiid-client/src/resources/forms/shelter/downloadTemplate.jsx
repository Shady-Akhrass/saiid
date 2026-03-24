import React from 'react';
import ExcelJS from 'exceljs';
import { downloadWorkbookAsFile } from '../../../utils/excelDownload';

const DownloadTemplate = () => {
    const headers = [
        'رقم هوية رب الأسرة',
        'عدد أفراد الأسرة (ذكور)',
        'عدد أفراد الأسرة (إناث)',
        'عدد الأطفال (أقل من سنتين)',
        'عدد الأطفال (2-6 سنوات)',
        'عدد الأطفال (6-18 سنة)',
        'عدد كبار السن (فوق 60)',
        'عدد النساء الحوامل',
        'عدد المرضعات',
        'اسم رب الأسرة',
        'اسم الزوجة',
        'رقم هوية الزوجة',
        'المحافظة',
        'الحي',
        'العنوان التفصيلي',
        'رقم الهاتف',
        'رقم هاتف بديل',
        'عدد الحالات الخاصة',
        'جنس صاحب الحالة الخاصة',
        'عمر صاحب الحالة الخاصة',
        'نوع الحالة الخاصة',
        'نوع المرض',
        'نوع الاحتياجات',
        'تفاصيل إضافية',

    ];

    const templateData = [
        headers,
        // Add an empty row as example
        Array(headers.length).fill('')
    ];

    const downloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('بيانات النازحين');
        templateData.forEach((row) => worksheet.addRow(row));
        headers.forEach((_, i) => { worksheet.getColumn(i + 1).width = 20; });
        await downloadWorkbookAsFile(workbook, 'نموذج_بيانات_النازحين.xlsx');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-3xl w-full bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                        تحميل نموذج بيانات النازحين
                    </h2>

                    <div className="space-y-6" dir='rtl'>
                        <p className="text-gray-600 text-lg text-center">
                            قم بتحميل نموذج Excel فارغ لتعبئة بيانات النازحين.
                            يحتوي النموذج على كافة الحقول المطلوبة مع عناوين باللغة العربية.
                        </p>

                        <div className="bg-blue-50 border-2 border-blue-100 rounded-lg p-6" dir='rtl'>
                            <h3 className="font-bold text-blue-800 mb-3 text-lg">تعليمات:</h3>
                            <ul className="list-disc list-inside text-blue-700 space-y-2 marker:text-blue-500">
                                <li>قم بتعبئة البيانات في الأعمدة المناسبة</li>
                                <li>لا تقم بتغيير ترتيب الأعمدة</li>
                                <li>  المحافظة يجب أن تكون من القائمة المحددة (محافظة رفح، محافظة خانيونس، محافطة الوسطى، محافظة غزة، محافظة الشمال)</li>
                                <li>جميع الأرقام يجب أن تكون صحيحة</li>
                                <li>رقم الهوية يجب أن يكون 9 أرقام</li>
                            </ul>
                        </div>

                        <button
                            onClick={downloadTemplate}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center space-x-3 rtl:space-x-reverse shadow-md hover:shadow-lg"
                        >
                            <span className="text-lg">تحميل النموذج</span>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DownloadTemplate;
