@echo off
REM 🔍 سكريبت للتحقق من صور ملاحظات المشاريع (Windows)
REM استخدام: scripts\check-project-notes-images.bat

echo 🔍 التحقق من صور ملاحظات المشاريع...
echo.

REM التحقق من وجود المجلد
set PROJECT_NOTES_DIR=public\project_notes_images

if not exist "%PROJECT_NOTES_DIR%" (
    echo ❌ المجلد غير موجود: %PROJECT_NOTES_DIR%
    echo 📝 إنشاء المجلد...
    mkdir "%PROJECT_NOTES_DIR%"
    echo ✅ تم إنشاء المجلد
) else (
    echo ✅ المجلد موجود: %PROJECT_NOTES_DIR%
)

echo.
echo 📊 عدد الملفات في المجلد:
dir /b "%PROJECT_NOTES_DIR%" 2>nul | find /c /v ""
if errorlevel 1 (
    echo    0 ملف
)

echo.
echo 📋 آخر 10 ملفات:
dir /o-d "%PROJECT_NOTES_DIR%" 2>nul | findstr /v "^$" | findstr /v "^ Directory" | findstr /v "^ Volume" | findstr /v "^ " | head -10

echo.
echo 🔍 التحقق من ملف محدد (1765190768.jpg):
if exist "%PROJECT_NOTES_DIR%\1765190768.jpg" (
    echo ✅ الملف موجود
    for %%A in ("%PROJECT_NOTES_DIR%\1765190768.jpg") do echo    الحجم: %%~zA bytes
) else (
    echo ❌ الملف غير موجود: %PROJECT_NOTES_DIR%\1765190768.jpg
)

echo.
echo ✅ انتهى التحقق
pause
