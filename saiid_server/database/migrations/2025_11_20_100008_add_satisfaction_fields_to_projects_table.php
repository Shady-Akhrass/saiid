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
        Schema::table('projects', function (Blueprint $table) {
            // حقول تقييم حالة المخيم (التلقائي بناءً على الكمية)
            $table->enum('shelter_satisfaction_status', ['مكتفي', 'يحتاج المزيد'])->nullable()->after('status');
            $table->integer('satisfaction_shortfall')->default(0)->after('shelter_satisfaction_status'); // العجز
            $table->text('satisfaction_notes')->nullable()->after('satisfaction_shortfall');
            $table->unsignedBigInteger('satisfaction_recorded_by')->nullable()->after('satisfaction_notes');
            $table->timestamp('satisfaction_recorded_at')->nullable()->after('satisfaction_recorded_by');
            
            // Foreign key
            $table->foreign('satisfaction_recorded_by')->references('id')->on('users')->onDelete('set null');
            
            // Index
            $table->index('shelter_satisfaction_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropForeign(['satisfaction_recorded_by']);
            $table->dropIndex(['projects_shelter_satisfaction_status_index']);
            $table->dropColumn([
                'shelter_satisfaction_status',
                'satisfaction_shortfall',
                'satisfaction_notes',
                'satisfaction_recorded_by',
                'satisfaction_recorded_at'
            ]);
        });
    }
};

