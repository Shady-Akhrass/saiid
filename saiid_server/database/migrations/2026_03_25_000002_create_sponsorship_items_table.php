<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sponsorship_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sponsorship_group_id')->constrained('sponsorship_groups')->onDelete('cascade');
            $table->string('name');
            $table->string('donor_code')->nullable();
            $table->integer('orphans_count')->default(0);
            $table->decimal('cost', 15, 2)->default(0);
            $table->foreignId('currency_id')->constrained('currencies')->onDelete('restrict');
            $table->decimal('amount_in_usd', 15, 2)->default(0);
            $table->json('images')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sponsorship_items');
    }
};
