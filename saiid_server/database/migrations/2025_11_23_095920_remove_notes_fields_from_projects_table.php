<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // التحقق من وجود الأعمدة قبل حذفها
        $connection = Schema::getConnection();
        $database = $connection->getDatabaseName();
        $table = 'projects';
        
        $columns = $connection->select("
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            AND COLUMN_NAME IN ('notes', 'notes_image')
        ", [$database, $table]);
        
        $existingColumns = collect($columns)->pluck('COLUMN_NAME')->toArray();
        
        if (empty($existingColumns)) {
            return; // الأعمدة غير موجودة، تخطي الحذف
        }
        
        Schema::table('projects', function (Blueprint $table) use ($existingColumns) {
            $table->dropColumn($existingColumns);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->text('notes')->nullable()->after('status');
            $table->string('notes_image')->nullable()->after('notes');
        });
    }
};
