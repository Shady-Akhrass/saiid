<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // تحديث السجلات التي لديها updated_at فارغ أو null
        // نضع updated_at = created_at إذا كان created_at موجوداً
        DB::statement("
            UPDATE shelters 
            SET updated_at = created_at 
            WHERE updated_at IS NULL 
            AND created_at IS NOT NULL
        ");

        // إذا كان created_at أيضاً فارغاً، نضع التاريخ الحالي
        DB::statement("
            UPDATE shelters 
            SET updated_at = NOW(), 
                created_at = NOW() 
            WHERE updated_at IS NULL 
            OR created_at IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // لا يمكن التراجع عن هذا التحديث
    }
};

