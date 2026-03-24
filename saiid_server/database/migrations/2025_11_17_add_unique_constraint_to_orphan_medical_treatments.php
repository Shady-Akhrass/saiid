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
        // التحقق من وجود constraint بالفعل
        $connection = Schema::getConnection();
        $database = $connection->getDatabaseName();
        $table = 'orphan_medical_treatments';
        $column = 'orphan_id_number';
        
        $constraintExists = $connection->select("
            SELECT COUNT(*) as count
            FROM information_schema.table_constraints
            WHERE constraint_schema = ?
            AND table_name = ?
            AND constraint_name = ?
        ", [$database, $table, "{$table}_{$column}_unique"]);
        
        if ($constraintExists[0]->count > 0) {
            return; // Constraint موجود بالفعل
        }
        
        // التحقق من وجود قيم مكررة قبل إضافة constraint
        $duplicates = $connection->select("
            SELECT orphan_id_number, COUNT(*) as count
            FROM orphan_medical_treatments
            GROUP BY orphan_id_number
            HAVING count > 1
        ");
        
        if (count($duplicates) > 0) {
            // إذا كان هناك قيم مكررة، تخطي إضافة constraint
            return;
        }
        
        Schema::table('orphan_medical_treatments', function (Blueprint $table) {
            // Add unique constraint to prevent duplicate registrations
            $table->unique('orphan_id_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orphan_medical_treatments', function (Blueprint $table) {
            // Remove unique constraint
            $table->dropUnique(['orphan_id_number']);
        });
    }
};

