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
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->integer('quantity')->nullable()->default(0)->after('net_amount'); // عدد الطرود
            $table->decimal('unit_cost', 10, 2)->nullable()->after('quantity'); // تكلفة الطرد الواحد
            $table->decimal('supply_cost', 10, 2)->nullable()->after('unit_cost'); // التكلفة الإجمالية
            $table->decimal('surplus_amount', 10, 2)->nullable()->after('supply_cost'); // الوافر/العجز
            $table->boolean('has_deficit')->default(false)->after('surplus_amount'); // وجود عجز
            $table->text('surplus_notes')->nullable()->after('has_deficit');
            $table->timestamp('surplus_recorded_at')->nullable()->after('surplus_notes');
            $table->unsignedBigInteger('surplus_recorded_by')->nullable()->after('surplus_recorded_at');
            
            // Foreign key
            $table->foreign('surplus_recorded_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropForeign(['surplus_recorded_by']);
            $table->dropColumn([
                'quantity',
                'unit_cost',
                'supply_cost',
                'surplus_amount',
                'has_deficit',
                'surplus_notes',
                'surplus_recorded_at',
                'surplus_recorded_by'
            ]);
        });
    }
};
