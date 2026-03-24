#!/bin/bash

# 🧹 سكريبت مسح Cache بعد تحديث CORS
# استخدام: ./scripts/clear-cors-cache.sh

echo "🧹 مسح Cache بعد تحديث CORS..."
echo ""

# مسح Config Cache
echo "📝 مسح Config Cache..."
php artisan config:clear

# مسح Application Cache
echo "💾 مسح Application Cache..."
php artisan cache:clear

# مسح Route Cache
echo "🛣️  مسح Route Cache..."
php artisan route:clear

# مسح View Cache
echo "👁️  مسح View Cache..."
php artisan view:clear

# مسح Compiled Files
echo "🔨 مسح Compiled Files..."
php artisan clear-compiled

echo ""
echo "✅ تم مسح Cache بنجاح!"
echo ""
echo "⚠️  يجب إعادة تشغيل Backend الآن:"
echo "   - إذا كان يعمل على local: أوقف وأعد تشغيل php artisan serve"
echo "   - إذا كان على Production: أعد تشغيل PHP-FPM/Nginx"
echo ""
