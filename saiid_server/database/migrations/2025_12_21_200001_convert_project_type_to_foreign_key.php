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
        // 1. إضافة عمود project_type_id جديد
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->unsignedBigInteger('project_type_id')->nullable()->after('project_type')->comment('نوع المشروع (Foreign Key)');
        });

        // 2. تحويل البيانات الموجودة من ENUM إلى Foreign Key
        $types = DB::table('project_types')->get();
        foreach ($types as $type) {
            DB::table('project_proposals')
                ->where('project_type', $type->name)
                ->update(['project_type_id' => $type->id]);
        }

        // 3. جعل project_type_id NOT NULL بعد تحويل البيانات
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->unsignedBigInteger('project_type_id')->nullable(false)->change();
        });

        // 4. إضافة Foreign Key
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->foreign('project_type_id', 'fk_project_type')
                  ->references('id')
                  ->on('project_types')
                  ->onDelete('restrict');
        });

        // 5. حذف عمود project_type القديم (ENUM)
        // ملاحظة: سنحتفظ به مؤقتاً للتوافق، يمكن حذفه لاحقاً
        // Schema::table('project_proposals', function (Blueprint $table) {
        //     $table->dropColumn('project_type');
        // });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropForeign('fk_project_type');
            $table->dropColumn('project_type_id');
        });
    }
};

