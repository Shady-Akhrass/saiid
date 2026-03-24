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
        Schema::create('project_warehouse_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_proposal_id')->constrained('project_proposals')->onDelete('cascade');
            $table->foreignId('warehouse_item_id')->constrained('warehouse_items')->onDelete('cascade');
            $table->decimal('quantity_per_unit', 10, 2); // الكمية للطرد الواحد
            $table->decimal('unit_price', 10, 2); // سعر وقت الطلب
            $table->decimal('total_price_per_unit', 10, 2); // محسوب تلقائياً
            $table->enum('status', ['pending', 'confirmed', 'cancelled'])->default('pending');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_warehouse_items');
    }
};
