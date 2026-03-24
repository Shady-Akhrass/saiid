@echo off
REM 🧹 سكريبت مسح Cache بعد تحديث CORS (Windows)
REM استخدام: scripts\clear-cors-cache.bat

echo 🧹 مسح Cache بعد تحديث CORS...
echo.

REM مسح Config Cache
echo 📝 مسح Config Cache...
php artisan config:clear

REM مسح Application Cache
echo 💾 مسح Application Cache...
php artisan cache:clear

REM مسح Route Cache
echo 🛣️  مسح Route Cache...
php artisan route:clear

REM مسح View Cache
echo 👁️  مسح View Cache...
php artisan view:clear

REM مسح Compiled Files
echo 🔨 مسح Compiled Files...
php artisan clear-compiled

echo.
echo ✅ تم مسح Cache بنجاح!
echo.
echo ⚠️  يجب إعادة تشغيل Backend الآن:
echo    - إذا كان يعمل على local: أوقف وأعد تشغيل php artisan serve
echo    - إذا كان على Production: أعد تشغيل PHP-FPM/Nginx
echo.

pause
