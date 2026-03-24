#!/bin/bash

# 🔍 سكريبت للتحقق من صور ملاحظات المشاريع
# استخدام: ./scripts/check-project-notes-images.sh

echo "🔍 التحقق من صور ملاحظات المشاريع..."
echo ""

# التحقق من وجود المجلد
PROJECT_NOTES_DIR="public/project_notes_images"

if [ ! -d "$PROJECT_NOTES_DIR" ]; then
    echo "❌ المجلد غير موجود: $PROJECT_NOTES_DIR"
    echo "📝 إنشاء المجلد..."
    mkdir -p "$PROJECT_NOTES_DIR"
    chmod 755 "$PROJECT_NOTES_DIR"
    echo "✅ تم إنشاء المجلد"
else
    echo "✅ المجلد موجود: $PROJECT_NOTES_DIR"
fi

echo ""
echo "📊 عدد الملفات في المجلد:"
FILE_COUNT=$(find "$PROJECT_NOTES_DIR" -type f | wc -l)
echo "   $FILE_COUNT ملف"

echo ""
echo "📋 آخر 10 ملفات:"
ls -lt "$PROJECT_NOTES_DIR" | head -11 | tail -10

echo ""
echo "🔍 التحقق من ملف محدد (1765190768.jpg):"
if [ -f "$PROJECT_NOTES_DIR/1765190768.jpg" ]; then
    echo "✅ الملف موجود"
    echo "   الحجم: $(du -h "$PROJECT_NOTES_DIR/1765190768.jpg" | cut -f1)"
    echo "   الصلاحيات: $(stat -c "%a" "$PROJECT_NOTES_DIR/1765190768.jpg")"
else
    echo "❌ الملف غير موجود: $PROJECT_NOTES_DIR/1765190768.jpg"
fi

echo ""
echo "✅ انتهى التحقق"
