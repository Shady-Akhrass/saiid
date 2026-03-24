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
        Schema::table('media_archives', function (Blueprint $table) {
            $table->string('donor_code')->nullable()->after('donor_name');
            $table->string('internal_code')->nullable()->after('donor_code');
            $table->string('producer_name')->nullable()->after('photographer_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('media_archives', function (Blueprint $table) {
            $table->dropColumn(['donor_code', 'internal_code', 'producer_name']);
        });
    }
};
