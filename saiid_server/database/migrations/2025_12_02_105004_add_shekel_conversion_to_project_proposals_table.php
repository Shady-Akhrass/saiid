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
            // سعر صرف الدولار للشيكل (يدوي من مدير المشاريع)
            $table->decimal('shekel_exchange_rate', 10, 4)->nullable()->after('net_amount');
            
            // المبلغ الصافي بالشيكل (محسوب تلقائياً)
            $table->decimal('net_amount_shekel', 15, 2)->nullable()->after('shekel_exchange_rate');
            
            // تاريخ التحويل
            $table->timestamp('shekel_converted_at')->nullable()->after('net_amount_shekel');
            
            // من قام بالتحويل
            $table->unsignedBigInteger('shekel_converted_by')->nullable()->after('shekel_converted_at');
            
            // Foreign key
            $table->foreign('shekel_converted_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('project_proposals', function (Blueprint $table) {
            $table->dropForeign(['shekel_converted_by']);
            $table->dropColumn([
                'shekel_exchange_rate',
                'net_amount_shekel',
                'shekel_converted_at',
                'shekel_converted_by'
            ]);
        });
    }
};
